import { monthIndex, monthToDate } from './months.ts';
import type { CashFlow, DcaSeriesPoint } from './types.ts';
import { xirr } from './xirr.ts';

export interface AnnualCpi {
  year: number;
  value: number;
}

export interface MonthlyCpi {
  m: string;
  cpi: number;
  /** true kalau bulan ini hasil ekstrapolasi, bukan diinterpolasi dari dua titik data nyata. */
  estimated: boolean;
}

/**
 * Bank Dunia hanya menerbitkan CPI tahunan, sedangkan simulasi DCA berjalan bulanan.
 *
 * Nilai tahunan adalah RATA-RATA sepanjang tahun, jadi ia diangkurkan ke pertengahan
 * tahun (Juli), bukan Januari — mengangkurkan ke Januari menggeser seluruh kurva
 * setengah tahun dan konsisten melebih-lebihkan inflasi di paruh pertama periode.
 * Di antara angkur dipakai interpolasi geometrik, karena inflasi bekerja majemuk.
 */
export function interpolateMonthlyCpi(annual: readonly AnnualCpi[], fromMonth: string, toMonth: string): MonthlyCpi[] {
  const points = [...annual]
    .filter((a) => Number.isFinite(a.value) && a.value > 0)
    .sort((a, b) => a.year - b.year);
  if (points.length < 2) return [];

  const anchors = points.map((p) => ({ index: monthIndex(`${p.year}-07`), value: p.value }));
  const first = anchors[0] as { index: number; value: number };
  const last = anchors[anchors.length - 1] as { index: number; value: number };
  const second = anchors[1] as { index: number; value: number };
  const secondLast = anchors[anchors.length - 2] as { index: number; value: number };

  /** Laju bulanan majemuk antara dua angkur. */
  const rateBetween = (a: { index: number; value: number }, b: { index: number; value: number }) =>
    (b.value / a.value) ** (1 / (b.index - a.index));

  const leadingRate = rateBetween(first, second);
  const trailingRate = rateBetween(secondLast, last);

  const out: MonthlyCpi[] = [];
  const start = monthIndex(fromMonth);
  const end = monthIndex(toMonth);

  for (let i = start; i <= end; i += 1) {
    // Sebelum data pertama dan sesudah data terakhir, kurva diteruskan memakai laju
    // terdekat yang diketahui — dan ditandai `estimated` supaya bisa disebut apa adanya.
    if (i <= first.index) {
      out.push({ m: monthKeyOf(i), cpi: first.value * leadingRate ** (i - first.index), estimated: i < first.index });
      continue;
    }
    if (i >= last.index) {
      out.push({ m: monthKeyOf(i), cpi: last.value * trailingRate ** (i - last.index), estimated: i > last.index });
      continue;
    }
    let left = first;
    let right = last;
    for (let k = 0; k < anchors.length - 1; k += 1) {
      const a = anchors[k] as { index: number; value: number };
      const b = anchors[k + 1] as { index: number; value: number };
      if (i >= a.index && i <= b.index) {
        left = a;
        right = b;
        break;
      }
    }
    out.push({ m: monthKeyOf(i), cpi: left.value * rateBetween(left, right) ** (i - left.index), estimated: false });
  }

  return out;
}

function monthKeyOf(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/**
 * Faktor pengali yang mengubah rupiah bulan mana pun menjadi rupiah bulan acuan.
 * Rp900.000 di 2016 punya daya beli lebih besar daripada Rp900.000 hari ini, jadi
 * faktornya di atas 1 untuk bulan-bulan lampau.
 */
export function buildDeflators(monthly: readonly MonthlyCpi[], baseMonth: string): Map<string, number> {
  const base = monthly.find((p) => p.m === baseMonth)?.cpi ?? monthly[monthly.length - 1]?.cpi;
  const out = new Map<string, number>();
  if (!base || base <= 0) return out;
  for (const point of monthly) {
    if (point.cpi > 0) out.set(point.m, base / point.cpi);
  }
  return out;
}

export interface RealMetrics {
  /** Total setoran dinyatakan dalam daya beli bulan acuan. */
  realTotalInvested: number;
  realTotalReturnPct: number;
  realXirr: number | null;
  /** Berapa persen inflasi menggerus hasil nominalnya. */
  inflationDragPct: number;
}

/**
 * Hitung ulang hasil DCA dalam daya beli hari ini.
 *
 * Caranya bukan mengurangi return nominal dengan angka inflasi rata-rata, melainkan
 * menaikkan tiap setoran ke nilai rupiah hari ini sebelum dibandingkan dengan nilai
 * akhir. Setoran 2016 "berbobot" lebih besar daripada setoran tahun lalu, dan hanya
 * cara ini yang menangkap perbedaan itu ketika laju inflasinya berubah-ubah.
 */
export function realMetrics(
  series: readonly DcaSeriesPoint[],
  contribution: number,
  currentValue: number,
  deflators: ReadonlyMap<string, number>,
  nominalTotalReturnPct: number,
): RealMetrics | null {
  if (series.length === 0 || contribution <= 0) return null;

  let realInvested = 0;
  const flows: CashFlow[] = [];
  for (const point of series) {
    const deflator = deflators.get(point.m) ?? 1;
    const amount = contribution * deflator;
    realInvested += amount;
    flows.push({ when: monthToDate(point.m), amount: -amount });
  }
  if (realInvested <= 0) return null;

  const lastMonth = series[series.length - 1]?.m;
  if (lastMonth) flows.push({ when: monthToDate(lastMonth), amount: currentValue });

  const realTotalReturnPct = ((currentValue - realInvested) / realInvested) * 100;
  return {
    realTotalInvested: realInvested,
    realTotalReturnPct,
    realXirr: xirr(flows),
    inflationDragPct: nominalTotalReturnPct - realTotalReturnPct,
  };
}

/** Aritmetika kunci bulan "YYYY-MM". Dipakai bersama oleh frontend dan script pipeline. */

export function monthIndex(key: string): number {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  return year * 12 + (month - 1);
}

export function fromMonthIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

export function addMonths(key: string, delta: number): string {
  return fromMonthIndex(monthIndex(key) + delta);
}

/** Selisih dalam bulan: monthsBetween("2020-01", "2020-04") === 3 */
export function monthsBetween(from: string, to: string): number {
  return monthIndex(to) - monthIndex(from);
}

/** Tanggal 1 bulan tersebut dalam UTC — dipakai sebagai tanggal arus kas XIRR. */
export function monthToDate(key: string): Date {
  return new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
}

export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

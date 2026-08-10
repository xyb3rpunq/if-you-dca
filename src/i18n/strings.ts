export type Lang = 'id' | 'en';

type Entry = Record<Lang, string>;

/**
 * Kamus UI. Bahasa Indonesia ditulis lebih dulu dan diperlakukan sebagai bahasa
 * utama — pengguna sasaran proyek ini berbahasa Indonesia, dan terjemahan Inggris
 * mengikuti, bukan sebaliknya.
 */
export const strings = {
  'app.name': { id: 'Value Terminal', en: 'Value Terminal' },
  'app.tagline': {
    id: 'Kalau kamu rutin nabung tiap bulan, sekarang jadi berapa?',
    en: 'If you invested every month, what would it be worth now?',
  },

  'nav.dashboard': { id: 'Dashboard', en: 'Dashboard' },
  'nav.simulator': { id: 'Simulator DCA', en: 'DCA Simulator' },
  'nav.rankings': { id: 'Peringkat', en: 'Rankings' },
  'nav.value': { id: 'Value Lens', en: 'Value Lens' },
  'nav.portfolio': { id: 'Rencana Saya', en: 'My Plan' },
  'nav.glossary': { id: 'Istilah', en: 'Glossary' },
  'nav.menu': { id: 'Buka menu', en: 'Open menu' },

  'common.loading': { id: 'Memuat data…', en: 'Loading data…' },
  'common.error': { id: 'Data gagal dimuat', en: 'Failed to load data' },
  'common.errorHint': {
    id: 'Coba muat ulang halaman. Kalau tetap gagal, mungkin data pasar sedang diperbarui.',
    en: 'Try reloading. If it keeps failing, the market data may be mid-refresh.',
  },
  'common.retry': { id: 'Coba lagi', en: 'Retry' },
  'common.updated': { id: 'Diperbarui', en: 'Updated' },
  'common.live': { id: 'Live', en: 'Live' },
  'common.nearLive': { id: 'Near-live', en: 'Near-live' },
  'common.partial': { id: 'Data parsial', en: 'Partial data' },
  'common.partialHint': {
    id: 'Aset ini belum ada sepanjang periode yang dipilih, jadi simulasinya dimulai sejak bulan pertama datanya tersedia.',
    en: 'This asset did not exist for the whole period, so the simulation starts from its first available month.',
  },
  'common.all': { id: 'Semua', en: 'All' },
  'common.search': { id: 'Cari aset…', en: 'Search assets…' },
  'common.noResults': { id: 'Tidak ada aset yang cocok.', en: 'No matching assets.' },
  'common.perMonth': { id: '/bulan', en: '/month' },
  'common.months': { id: 'bulan', en: 'months' },
  'common.back': { id: 'Kembali', en: 'Back' },
  'common.copied': { id: 'Tautan disalin', en: 'Link copied' },
  'common.share': { id: 'Bagikan hasil ini', en: 'Share this result' },

  'metric.invested': { id: 'Total setoran', en: 'Total invested' },
  'metric.value': { id: 'Nilai sekarang', en: 'Current value' },
  'metric.profit': { id: 'Untung/rugi', en: 'Profit / loss' },
  'metric.return': { id: 'Total return', en: 'Total return' },
  'metric.multiple': { id: 'Multiple', en: 'Multiple' },
  'metric.xirr': { id: 'XIRR', en: 'XIRR' },
  'metric.twr': { id: 'TWR', en: 'TWR' },
  'metric.cagr': { id: 'CAGR', en: 'CAGR' },
  'metric.volatility': { id: 'Volatilitas', en: 'Volatility' },
  'metric.maxDrawdown': { id: 'Penurunan terdalam', en: 'Max drawdown' },
  'metric.assetDrawdown': { id: 'Jatuh terdalam harga', en: 'Asset max drawdown' },
  'metric.sharpe': { id: 'Sharpe', en: 'Sharpe' },
  'metric.sortino': { id: 'Sortino', en: 'Sortino' },
  'metric.beta': { id: 'Beta', en: 'Beta' },
  'metric.alpha': { id: 'Alpha', en: 'Alpha' },
  'metric.units': { id: 'Unit terkumpul', en: 'Units accumulated' },
  'metric.avgPrice': { id: 'Harga rata-rata kamu', en: 'Your average price' },
  'metric.lastPrice': { id: 'Harga terkini', en: 'Latest price' },

  'dash.heroLead': {
    id: 'Simulasi nyata berbasis harga historis: setor {amount} tiap bulan, tanpa menebak waktu masuk.',
    en: 'A real simulation on historical prices: invest {amount} every month, no market timing.',
  },
  'dash.pickPeriod': { id: 'Durasi', en: 'Duration' },
  'dash.topMovers': { id: 'Hasil terbaik', en: 'Best performers' },
  'dash.worst': { id: 'Hasil terburuk', en: 'Worst performers' },
  'dash.marketSnapshot': { id: 'Kondisi pasar', en: 'Market snapshot' },
  'dash.cryptoLive': { id: 'Harga kripto live', en: 'Live crypto prices' },
  'dash.seeAll': { id: 'Lihat semua peringkat', en: 'See full rankings' },
  'dash.statLine': {
    id: '{positive} dari {count} aset menguntungkan pada periode ini. Median return {median}.',
    en: '{positive} of {count} assets were profitable over this period. Median return {median}.',
  },
  'dash.trySimulator': { id: 'Coba dengan angkamu sendiri', en: 'Try your own numbers' },

  'sim.title': { id: 'Simulator DCA', en: 'DCA Simulator' },
  'sim.lead': {
    id: 'Pilih aset, tentukan setoran bulanan dan durasinya. Semua dihitung dari harga penutupan bulanan yang sebenarnya.',
    en: 'Pick assets, set your monthly amount and duration. Everything runs on real monthly closing prices.',
  },
  'sim.amount': { id: 'Setoran per bulan', en: 'Monthly amount' },
  'sim.period': { id: 'Durasi', en: 'Duration' },
  'sim.asset': { id: 'Aset', en: 'Asset' },
  'sim.chartValue': { id: 'Nilai portofolio', en: 'Portfolio value' },
  'sim.chartInvested': { id: 'Total setoran', en: 'Total invested' },
  'sim.custom': { id: 'Bebas', en: 'Custom' },
  'sim.from': { id: 'Dari bulan', en: 'From month' },
  'sim.to': { id: 'Sampai bulan', en: 'To month' },
  'sim.rangeMonths': { id: '{n} setoran bulanan', en: '{n} monthly contributions' },
  'sim.rangeInvalid': {
    id: 'Bulan mulai harus sebelum bulan akhir, dan rentangnya minimal 2 bulan.',
    en: 'The start month must precede the end month, and the range needs at least 2 months.',
  },
  'sim.rangeClamped': {
    id: 'Data tersedia mulai {from}. Rentangnya dipotong ke situ.',
    en: 'Data starts at {from}. The range has been trimmed to match.',
  },
  'sim.emptyPick': { id: 'Pilih minimal satu aset untuk memulai.', en: 'Pick at least one asset to start.' },
  'sim.breakdown': { id: 'Rincian per aset', en: 'Per-asset breakdown' },
  'sim.combined': { id: 'Gabungan', en: 'Combined' },

  'rank.title': { id: 'Peringkat Aset', en: 'Asset Rankings' },
  'rank.lead': {
    id: 'Semua aset yang dilacak, diurutkan dari hasil DCA terbaik. Klik judul kolom untuk mengubah urutan.',
    en: 'Every tracked asset, ranked by DCA outcome. Click a column header to re-sort.',
  },
  'rank.asset': { id: 'Aset', en: 'Asset' },
  'rank.category': { id: 'Kategori', en: 'Category' },
  'rank.summaryMean': { id: 'Rata-rata', en: 'Mean' },
  'rank.summaryMedian': { id: 'Median', en: 'Median' },
  'rank.summaryPositive': { id: 'Untung', en: 'Profitable' },
  'rank.summaryBest': { id: 'Terbaik', en: 'Best' },
  'rank.summaryWorst': { id: 'Terburuk', en: 'Worst' },
  'rank.medianNote': {
    id: 'Median lebih jujur daripada rata-rata di sini: satu pemenang ekstrem bisa menarik rata-rata jauh ke atas dan bikin hasil tipikal terlihat lebih bagus dari kenyataan.',
    en: 'Median is the fairer number here: one extreme winner can drag the mean up and make the typical outcome look better than it was.',
  },

  'value.title': { id: 'Value Lens', en: 'Value Lens' },
  'value.lead': {
    id: 'Rasio fundamental dibaca lewat saringan value investing klasik — batas P/E dan P/B yang dirumuskan Benjamin Graham untuk investor defensif.',
    en: 'Fundamental ratios read through a classic value-investing screen — the P/E and P/B limits Benjamin Graham set for defensive investors.',
  },
  'value.unavailable': { id: 'Data fundamental belum tersedia', en: 'Fundamental data not available yet' },
  'value.unavailableHint': {
    id: 'Data fundamental untuk saham ini gagal diambil pada penyegaran terakhir. Halaman lain tidak terpengaruh.',
    en: 'Fundamental data for this stock failed on the last refresh. Other pages are unaffected.',
  },
  'value.grahamNumber': { id: 'Graham Number', en: 'Graham Number' },
  'value.marginOfSafety': { id: 'Margin of Safety', en: 'Margin of Safety' },
  'value.verdict.cheap': { id: 'Terlihat murah dibanding fundamentalnya', en: 'Looks cheap relative to fundamentals' },
  'value.verdict.fair': { id: 'Terlihat wajar', en: 'Looks fairly priced' },
  'value.verdict.expensive': { id: 'Terlihat mahal dibanding fundamentalnya', en: 'Looks expensive relative to fundamentals' },
  'value.verdict.unknown': { id: 'Data belum cukup untuk menilai', en: 'Not enough data to assess' },
  'value.notAdvice': {
    id: 'Ini pembacaan rasio secara mekanis, bukan rekomendasi beli atau jual. Angka murah bisa berarti perusahaannya memang sedang bermasalah.',
    en: 'This is a mechanical reading of ratios, not a buy or sell recommendation. Cheap numbers can also mean the business is genuinely in trouble.',
  },
  'value.pickStock': { id: 'Pilih saham', en: 'Pick a stock' },
  'value.valuation': { id: 'Valuasi', en: 'Valuation' },
  'value.quality': { id: 'Kualitas Bisnis', en: 'Business Quality' },
  'value.health': { id: 'Kesehatan Keuangan', en: 'Financial Health' },
  'value.dividend': { id: 'Dividen', en: 'Dividend' },
  'value.dcf': { id: 'Kalkulator Nilai Wajar', en: 'Fair Value Calculator' },
  'value.trend': { id: 'Pemeriksaan tren', en: 'Trend checks' },
  'value.trendNote': {
    id: 'Rasio hanya potret satu waktu. Pemeriksaan ini melihat arah tiga tahun terakhir, karena ROE 20% sekali dan ROE 20% bertahun-tahun adalah dua hal yang berbeda.',
    en: 'Ratios are a single snapshot. These checks look at the last three years’ direction, because 20% ROE once and 20% ROE for years are very different things.',
  },
  'value.check.profitable': { id: 'Perusahaannya laba', en: 'Company is profitable' },
  'value.check.earningsGrowing': { id: 'Laba bertumbuh', en: 'Earnings growing' },
  'value.check.revenueGrowing': { id: 'Pendapatan bertumbuh', en: 'Revenue growing' },
  'value.check.cashBacked': { id: 'Laba didukung uang tunai', en: 'Earnings backed by cash' },
  'value.check.equityGrowing': { id: 'Ekuitas bertumbuh', en: 'Equity growing' },
  'value.cashBackedNote': {
    id: 'Laba bisa dicatat sebelum uangnya benar-benar diterima, jadi laba yang jauh melampaui arus kas layak ditelusuri. Yang dipakai di sini arus kas BEBAS — sudah dikurangi belanja modal — sehingga perusahaan padat modal yang sedang gencar berinvestasi bisa gagal uji ini secara wajar. Gagal di sini adalah undangan untuk memeriksa, bukan vonis.',
    en: 'Profit can be booked before the cash arrives, so earnings far above cash flow are worth investigating. The figure used here is FREE cash flow — after capital spending — so a capital-intensive company in a heavy investment phase can fail this legitimately. A failure here is an invitation to look closer, not a verdict.',
  },
  'value.qualityScore': { id: '{passed} dari {known} pemeriksaan lolos', en: '{passed} of {known} checks passed' },
  'value.bookValueFixed': {
    id: 'Nilai buku dari penyedia data dilaporkan dalam mata uang berbeda dari harganya, dan sudah dikoreksi. Tanpa koreksi, P/B dan Graham Number saham ini akan meleset puluhan kali lipat.',
    en: 'The provider reported book value in a different currency than the price; it has been corrected. Without the fix, this stock’s P/B and Graham Number would be off by orders of magnitude.',
  },
  'value.growthAssumption': { id: 'Pertumbuhan arus kas', en: 'Cash flow growth' },
  'value.discountRate': { id: 'Tingkat diskonto', en: 'Discount rate' },
  'value.terminalGrowth': { id: 'Pertumbuhan abadi', en: 'Terminal growth' },
  'value.years': { id: 'Tahun proyeksi', en: 'Projection years' },
  'value.intrinsic': { id: 'Perkiraan nilai wajar', en: 'Estimated fair value' },
  'value.dcfNote': {
    id: 'Geser asumsinya sendiri dan perhatikan betapa jauh hasilnya berubah — itulah pelajaran utamanya. DCF bukan mesin kebenaran; ia memperlihatkan harga macam apa yang masuk akal JIKA asumsimu benar. Angka bawaan di sini konservatif, bukan prediksi.',
    en: 'Move the assumptions and watch how far the answer swings — that is the real lesson. A DCF is not a truth machine; it shows what price makes sense IF your assumptions hold. The defaults here are conservative, not a forecast.',
  },
  'value.noFcf': {
    id: 'Perusahaan ini tidak melaporkan arus kas bebas positif, jadi model ini tidak bisa dipakai untuknya.',
    en: 'This company reports no positive free cash flow, so this model cannot be applied to it.',
  },
  'value.notApplicable': {
    id: 'Value Lens hanya berlaku untuk saham. Emas, minyak, kurs, dan kripto tidak punya laba, ekuitas, maupun arus kas — tidak ada yang bisa dinilai dengan rasio fundamental.',
    en: 'Value Lens applies to stocks only. Gold, oil, currencies and crypto have no earnings, equity or cash flow — there is nothing for fundamental ratios to measure.',
  },
  'value.perShare': { id: 'per saham', en: 'per share' },
  'value.vs': { id: 'vs harga', en: 'vs price' },

  'pf.title': { id: 'Rencana Saya', en: 'My Plan' },
  'pf.lead': {
    id: 'Bagi budget bulananmu ke beberapa aset, lalu lihat bagaimana kombinasi itu akan berjalan secara historis.',
    en: 'Split your monthly budget across assets and see how that mix would have played out historically.',
  },
  'pf.budget': { id: 'Budget bulanan', en: 'Monthly budget' },
  'pf.allocation': { id: 'Alokasi', en: 'Allocation' },
  'pf.remaining': { id: 'Sisa belum dialokasikan', en: 'Unallocated' },
  'pf.overBudget': { id: 'Alokasi melebihi budget', en: 'Allocation exceeds budget' },
  'pf.addAsset': { id: 'Tambah aset', en: 'Add asset' },
  'pf.diversification': { id: 'Seberapa terdiversifikasi?', en: 'How diversified is this?' },
  'pf.corrHigh': {
    id: 'Aset-asetmu bergerak sangat mirip (korelasi rata-rata {value}). Saat satu jatuh, yang lain cenderung ikut — jadi manfaat diversifikasinya kecil.',
    en: 'Your assets move very much together (average correlation {value}). When one falls the others tend to follow, so the diversification benefit is small.',
  },
  'pf.corrMedium': {
    id: 'Aset-asetmu bergerak agak berbeda satu sama lain (korelasi rata-rata {value}) — cukup untuk meredam sebagian guncangan.',
    en: 'Your assets move somewhat independently (average correlation {value}) — enough to cushion part of a shock.',
  },
  'pf.corrLow': {
    id: 'Aset-asetmu bergerak cukup mandiri (korelasi rata-rata {value}). Ini kombinasi yang terdiversifikasi dengan baik secara historis.',
    en: 'Your assets move fairly independently (average correlation {value}). Historically this is a well-diversified mix.',
  },
  'pf.scenarios': { id: 'Rentang skenario ke depan', en: 'Forward scenario range' },
  'pf.scenarioLead': {
    id: 'Bukan ramalan. Ini sekadar memproyeksikan tiga kemungkinan memakai volatilitas historis portofoliomu sendiri — hasil sebenarnya bisa di luar ketiganya.',
    en: 'Not a forecast. This projects three possibilities from your portfolio’s own historical volatility — the real outcome can land outside all three.',
  },
  'pf.pessimistic': { id: 'Pesimis', en: 'Pessimistic' },
  'pf.moderate': { id: 'Moderat', en: 'Moderate' },
  'pf.optimistic': { id: 'Optimis', en: 'Optimistic' },
  'pf.years': { id: 'Proyeksi {n} tahun ke depan', en: 'Projected {n} years ahead' },

  'gloss.title': { id: 'Istilah, Dijelaskan Sederhana', en: 'Terms, Explained Simply' },
  'gloss.lead': {
    id: 'Semua istilah yang muncul di situs ini, tanpa jargon. Kalau ada yang masih membingungkan, itu kesalahan penjelasannya — bukan kesalahanmu.',
    en: 'Every term used on this site, without jargon. If something is still confusing, that is the explanation’s fault — not yours.',
  },
  'gloss.formula': { id: 'Rumus', en: 'Formula' },

  'footer.disclaimer': {
    id: 'Value Terminal adalah alat edukasi & simulasi berbasis data historis. Ini BUKAN nasihat keuangan. Performa masa lalu tidak menjamin hasil masa depan — terutama untuk aset volatil seperti kripto.',
    en: 'Value Terminal is an educational simulation tool built on historical data. This is NOT financial advice. Past performance does not guarantee future results — especially for volatile assets like crypto.',
  },
  'footer.source': { id: 'Kode sumber', en: 'Source code' },
  'footer.dataSources': { id: 'Sumber data', en: 'Data sources' },
  'footer.dataNote': {
    id: 'Riwayat harga dari TradingView, disegarkan berkala lewat Yahoo Finance. Harga kripto live dari CoinGecko.',
    en: 'Price history from TradingView, refreshed periodically via Yahoo Finance. Live crypto prices from CoinGecko.',
  },

  'tech.extremes': { id: 'Puncak & Dasar', en: 'Peak & Trough' },
  'tech.ath': { id: 'Tertinggi sepanjang data', en: 'All-time high' },
  'tech.atl': { id: 'Terendah sepanjang data', en: 'All-time low' },
  'tech.fromAth': { id: 'dari puncak', en: 'from peak' },
  'tech.fromAtl': { id: 'dari dasar', en: 'from trough' },
  'tech.athNote': {
    id: 'Diukur dari harga tertinggi & terendah di dalam tiap bulan, bukan dari penutupan — puncak sesungguhnya hampir tidak pernah terjadi tepat saat pasar tutup. Data tersedia sejak {from}.',
    en: 'Measured from each month’s intraday high and low, not the close — real peaks almost never happen exactly at the closing bell. Data available since {from}.',
  },
  'tech.levels': { id: 'Support & Resistance', en: 'Support & Resistance' },
  'tech.levelsNote': {
    id: 'Level tempat harga berulang kali berbalik dalam 2 tahun terakhir, dikelompokkan otomatis dari data harian. Semakin sering disentuh, semakin banyak pelaku pasar yang memperhatikannya.',
    en: 'Levels where price repeatedly turned over the last 2 years, clustered automatically from daily data. The more touches, the more market participants watch it.',
  },
  'tech.support': { id: 'Support (di bawah harga)', en: 'Support (below price)' },
  'tech.resistance': { id: 'Resistance (di atas harga)', en: 'Resistance (above price)' },
  'tech.noLevels': { id: 'Tidak ada level yang jelas terbentuk.', en: 'No clear levels formed.' },
  'tech.pivots': { id: 'Pivot Point bulanan', en: 'Monthly pivot points' },
  'tech.pivotBasis': { id: 'Dihitung dari bulan penuh terakhir: {period}', en: 'Computed from the last full month: {period}' },
  'tech.indicators': { id: 'Indikator Teknikal', en: 'Technical Indicators' },
  'tech.indicatorsNote': {
    id: 'Dihitung dari {bars} bar harian dengan rumus baku — RSI & ATR memakai pemulusan Wilder, Bollinger memakai simpangan baku populasi.',
    en: 'Computed from {bars} daily bars using standard formulas — RSI & ATR use Wilder smoothing, Bollinger uses population standard deviation.',
  },
  'tech.movingAverages': { id: 'Rata-rata bergerak', en: 'Moving averages' },
  'tech.above': { id: 'di atas', en: 'above' },
  'tech.below': { id: 'di bawah', en: 'below' },
  'tech.upper': { id: 'Pita atas', en: 'Upper band' },
  'tech.middle': { id: 'Tengah', en: 'Middle' },
  'tech.lower': { id: 'Pita bawah', en: 'Lower band' },
  'tech.bandwidth': { id: 'Lebar pita', en: 'Bandwidth' },
  'tech.disclaimer': {
    id: 'Indikator menggambarkan apa yang SUDAH terjadi pada harga, bukan apa yang akan terjadi. RSI di atas 70 bisa bertahan berbulan-bulan pada aset yang sedang tren kuat, dan level support bisa ditembus kapan saja. Tidak ada satu pun angka di sini yang merupakan sinyal beli atau jual.',
    en: 'Indicators describe what price has ALREADY done, not what it will do. RSI above 70 can persist for months in a strong trend, and support levels break all the time. None of these numbers is a buy or sell signal.',
  },
  'tech.news': { id: 'Berita Terkini', en: 'Latest News' },
  'tech.noNews': {
    id: 'Belum ada berita relevan yang terkumpul untuk aset ini.',
    en: 'No relevant news collected for this asset yet.',
  },
  'tech.newsNote': {
    id: 'Dikumpulkan otomatis dari Yahoo Finance dan Google News, lalu disaring agar hanya menyisakan judul yang benar-benar menyebut aset ini. Judul dan tautan berasal dari penerbitnya masing-masing — isinya bukan tanggung jawab situs ini, dan tidak diverifikasi.',
    en: 'Collected automatically from Yahoo Finance and Google News, then filtered to keep only headlines that actually name this asset. Titles and links belong to their publishers — their content is neither endorsed nor verified here.',
  },
  'nav.assetDetail': { id: 'Detail aset', en: 'Asset detail' },

  'settings.language': { id: 'Bahasa', en: 'Language' },
  'settings.currency': { id: 'Mata uang', en: 'Currency' },
  'settings.basis': { id: 'Perhitungan return', en: 'Return basis' },
  'basis.total': { id: 'Dividen ikut', en: 'With dividends' },
  'basis.price': { id: 'Harga saja', en: 'Price only' },
  'basis.total.full': {
    id: 'Total return — dividen diinvestasikan ulang',
    en: 'Total return — dividends reinvested',
  },
  'basis.price.full': { id: 'Price return — pergerakan harga saja', en: 'Price return — price movement only' },
  'basis.explainTotal': {
    id: 'Angka di halaman ini mengasumsikan setiap dividen langsung dibelikan saham yang sama. Untuk saham dividen tinggi, ini bisa mengubah hasil secara drastis.',
    en: 'The figures on this page assume every dividend is immediately used to buy more of the same stock. For high-dividend stocks this can change the outcome dramatically.',
  },
  'basis.explainPrice': {
    id: 'Angka di halaman ini hanya menghitung pergerakan harga. Dividen yang pernah dibayarkan tidak dihitung sama sekali — untuk saham IDX berdividen tinggi, hasilnya tampak jauh lebih buruk dari kenyataan.',
    en: 'The figures on this page count price movement only. Dividends already paid are ignored entirely — for high-dividend IDX stocks this understates the real outcome substantially.',
  },
  'basis.noDividendData': {
    id: 'Aset ini tidak membagikan dividen, jadi kedua perhitungan menghasilkan angka yang sama.',
    en: 'This asset pays no dividend, so both bases produce the same figures.',
  },
  'basis.dividendAdds': {
    id: 'Dividen menambah {value} sepanjang riwayat aset ini.',
    en: 'Dividends added {value} over this asset’s history.',
  },

  'metric.realReturn': { id: 'Return riil', en: 'Real return' },
  'metric.realXirr': { id: 'XIRR riil', en: 'Real XIRR' },
  'metric.realInvested': { id: 'Setoran (nilai hari ini)', en: 'Invested (today’s money)' },
  'metric.inflationDrag': { id: 'Termakan inflasi', en: 'Lost to inflation' },
  'real.lead': {
    id: 'Setelah inflasi rupiah: setoranmu dari tahun-tahun lalu dinaikkan ke daya beli hari ini sebelum dibandingkan.',
    en: 'After rupiah inflation: contributions from earlier years are restated in today’s purchasing power before comparison.',
  },
  'real.estimated': {
    id: 'Data inflasi resmi tersedia sampai {year}; bulan setelahnya diperkirakan dari tren terakhir.',
    en: 'Official inflation data runs to {year}; later months are extrapolated from the latest trend.',
  },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof strings;

export interface GlossaryTerm {
  key: string;
  term: Entry;
  short: Entry;
  long: Entry;
  formula?: string;
}

/**
 * Penjelasan istilah. Ditulis untuk orang yang belum pernah membuka aplikasi
 * sekuritas, memakai analogi konkret, bukan definisi kamus.
 */
export const glossary: GlossaryTerm[] = [
  {
    key: 'dca',
    term: { id: 'DCA (Dollar-Cost Averaging)', en: 'DCA (Dollar-Cost Averaging)' },
    short: {
      id: 'Menyetor jumlah yang sama tiap bulan, tanpa peduli harga sedang naik atau turun.',
      en: 'Investing the same amount every month, regardless of whether prices are up or down.',
    },
    long: {
      id: 'Karena jumlah uangnya tetap, kamu otomatis dapat lebih banyak unit saat harga murah dan lebih sedikit saat mahal. Hasilnya, harga rata-rata yang kamu bayar cenderung lebih rendah daripada rata-rata harga sepanjang periode itu. Keuntungan terbesarnya bukan matematis, tapi psikologis: kamu tidak perlu menebak kapan waktu terbaik untuk masuk.',
      en: 'Because the amount is fixed, you automatically buy more units when prices are low and fewer when they are high. Your average purchase price therefore tends to land below the average price over the period. The biggest benefit is not mathematical but psychological: you never have to guess the right moment to buy.',
    },
  },
  {
    key: 'totalReturn',
    term: { id: 'Total Return', en: 'Total Return' },
    short: { id: 'Untung atau rugi total dalam persen, dibanding uang yang kamu setor.', en: 'Total gain or loss in percent, against what you put in.' },
    long: {
      id: 'Angka paling gampang dipahami, tapi paling gampang menyesatkan kalau dipakai membandingkan. Untung 100% dalam 2 tahun jauh lebih hebat daripada untung 100% dalam 20 tahun, padahal angkanya sama persis. Untuk membandingkan, pakai XIRR.',
      en: 'The easiest number to grasp and the easiest to be misled by. A 100% gain in 2 years is far better than 100% in 20 years, yet the number is identical. Use XIRR when comparing.',
    },
    formula: '(Nilai Akhir − Total Setoran) / Total Setoran × 100',
  },
  {
    key: 'multiple',
    term: { id: 'Multiple', en: 'Multiple' },
    short: { id: 'Berapa kali lipat uangmu berkembang. 2× artinya jadi dua kali lipat.', en: 'How many times your money grew. 2× means it doubled.' },
    long: {
      id: '1× berarti kamu persis balik modal — tidak untung, tidak rugi. Di bawah 1× berarti rugi. Sama seperti Total Return, angka ini tidak memperhitungkan berapa lama waktu yang dibutuhkan.',
      en: '1× means you exactly broke even. Below 1× means a loss. Like Total Return, it ignores how long the money took to get there.',
    },
    formula: 'Nilai Akhir / Total Setoran',
  },
  {
    key: 'totalVsPrice',
    term: { id: 'Total Return vs Price Return', en: 'Total Return vs Price Return' },
    short: {
      id: 'Price return cuma menghitung naik-turun harga. Total return juga menghitung dividen yang kamu terima.',
      en: 'Price return counts only price movement. Total return also counts the dividends you received.',
    },
    long: {
      id: 'Perusahaan yang untung bisa membagikan sebagian labanya sebagai dividen tunai. Uang itu nyata dan masuk ke rekeningmu, tapi tidak muncul di grafik harga — bahkan harga sahamnya biasanya turun sedikit di hari dividen dibagikan. Akibatnya, kalau kamu hanya melihat grafik, saham yang rajin membagi dividen terlihat jauh lebih buruk daripada kenyataannya. Selisihnya besar untuk saham IDX: pada UNTR selama 10 tahun, price return −4,7% sementara total return +51,8%. Dari rugi jadi untung, hanya karena dividennya dihitung. Perhitungan total return di situs ini mengasumsikan setiap dividen langsung dibelikan saham yang sama — kalau kamu membelanjakan dividennya, hasil aslinya ada di antara kedua angka itu.',
      en: 'A profitable company may pay part of its earnings out as cash dividends. That money is real and lands in your account, but it never shows up on the price chart — in fact the share price usually dips slightly on the day a dividend is paid. So if you only look at the chart, a reliable dividend payer looks far worse than it really was. The gap is large for IDX stocks: over 10 years UNTR shows −4.7% on price return but +51.8% on total return. From a loss to a gain, purely by counting the dividends. Total return here assumes every dividend is immediately reinvested into the same stock — if you spend the dividends instead, your real outcome sits between the two numbers.',
    },
  },
  {
    key: 'realReturn',
    term: { id: 'Return Riil', en: 'Real Return' },
    short: {
      id: 'Hasil investasimu setelah dikurangi inflasi — berapa banyak barang yang benar-benar bisa kamu beli.',
      en: 'Your return after inflation — how much more you can actually buy.',
    },
    long: {
      id: 'Uang Rp900 ribu di 2016 bisa membeli lebih banyak barang daripada Rp900 ribu hari ini. Kalau setoranmu tumbuh 30% dalam sepuluh tahun sementara harga-harga naik 33%, secara angka kamu untung tapi secara daya beli kamu justru mundur. Return riil menghitungnya dengan menaikkan setiap setoran lama ke nilai rupiah hari ini lebih dulu, baru dibandingkan dengan nilai akhir. Ini nyaris tidak pernah ditampilkan kalkulator investasi, padahal justru angka inilah yang menentukan apakah kamu benar-benar jadi lebih kaya.',
      en: 'Rp900,000 in 2016 bought more than Rp900,000 does today. If your contributions grew 30% over ten years while prices rose 33%, the numbers say you gained but your purchasing power went backwards. Real return handles this by restating every past contribution in today’s rupiah before comparing it to the final value. Investment calculators almost never show this, yet it is the number that decides whether you actually became better off.',
    },
    formula: 'Setoran riil = Σ (setoran × CPI_sekarang / CPI_bulan_itu)',
  },
  {
    key: 'cagr',
    term: { id: 'CAGR', en: 'CAGR' },
    short: { id: 'Laju pertumbuhan rata-rata per tahun, kalau uangnya disetor sekaligus di awal.', en: 'Average yearly growth rate, if the money went in all at once at the start.' },
    long: {
      id: 'Bayangkan seluruh naik-turun yang berantakan itu diratakan jadi satu garis mulus. CAGR adalah kemiringan garis itu. Cocok untuk investasi sekali setor, tidak cocok untuk DCA — untuk DCA pakai XIRR.',
      en: 'Imagine flattening all the messy ups and downs into one smooth line. CAGR is that line’s slope. Right for lump-sum investing, wrong for DCA — use XIRR there.',
    },
    formula: '(Nilai Akhir / Nilai Awal)^(1/tahun) − 1',
  },
  {
    key: 'xirr',
    term: { id: 'XIRR', en: 'XIRR' },
    short: { id: 'Return tahunan yang benar untuk DCA, karena memperhitungkan kapan tiap setoran masuk.', en: 'The correct annual return for DCA, because it accounts for when each contribution arrived.' },
    long: {
      id: 'Uang yang kamu setor 10 tahun lalu punya waktu 10 tahun untuk tumbuh. Uang yang kamu setor bulan lalu baru punya sebulan. Total Return memperlakukan keduanya sama, XIRR tidak. Karena itu XIRR adalah satu-satunya angka di halaman ini yang adil untuk membandingkan strategi dengan durasi berbeda.',
      en: 'Money you invested 10 years ago had 10 years to grow. Money from last month had one. Total Return treats both the same; XIRR does not. That makes XIRR the only number here that fairly compares strategies of different durations.',
    },
    formula: 'Cari r sehingga Σ [ CF_i / (1+r)^(t_i) ] = 0',
  },
  {
    key: 'twr',
    term: { id: 'TWR (Time-Weighted Return)', en: 'TWR (Time-Weighted Return)' },
    short: { id: 'Pertumbuhan asetnya sendiri, terlepas dari kapan kamu menyetor.', en: 'The asset’s own growth, independent of when you contributed.' },
    long: {
      id: 'XIRR menilai hasil yang KAMU dapat; TWR menilai kualitas ASETNYA. Kalau XIRR-mu jauh di bawah TWR, itu bukan salah asetnya — kebanyakan uangmu kebetulan masuk saat harga sudah tinggi.',
      en: 'XIRR measures what YOU got; TWR measures how the ASSET did. If your XIRR sits far below TWR, that is not the asset’s fault — most of your money simply arrived after prices had already risen.',
    },
  },
  {
    key: 'volatility',
    term: { id: 'Volatilitas', en: 'Volatility' },
    short: { id: 'Seberapa liar harga bergoyang naik-turun dalam setahun.', en: 'How wildly the price swings over a year.' },
    long: {
      id: 'Volatilitas 20% kira-kira berarti dalam setahun biasa, harga bisa bergerak 20% ke atas atau ke bawah dari rata-ratanya. Deposito mendekati 0%. Saham blue-chip biasanya 15–25%. Bitcoin sering di atas 60%. Volatilitas tinggi bukan otomatis buruk — tapi artinya kamu harus tahan melihat angkamu merah cukup lama.',
      en: 'Volatility of 20% roughly means that in a typical year, the price can swing 20% above or below its average. A savings deposit is near 0%. Blue-chip stocks are usually 15–25%. Bitcoin is often above 60%. High volatility is not automatically bad — but it means you must be able to stomach long stretches of red.',
    },
    formula: 'stdev(return bulanan) × √12',
  },
  {
    key: 'maxDrawdown',
    term: { id: 'Max Drawdown', en: 'Max Drawdown' },
    short: { id: 'Jatuh terdalam dari titik tertinggi — seberapa sakit di momen terburuk.', en: 'The deepest fall from a peak — how bad it got at the worst moment.' },
    long: {
      id: 'Ini angka yang paling jarang dilihat orang tapi paling menentukan apakah kamu bertahan atau menyerah. Drawdown −60% artinya pernah ada masa portofoliomu tinggal 40% dari nilai puncaknya. Pertanyaannya bukan "apakah asetnya bagus", tapi "apakah aku sanggup tidak menjual di titik itu".',
      en: 'The number people look at least and that decides most whether they hold on or give up. A −60% drawdown means your portfolio was once worth 40% of its peak. The question is not "is this a good asset" but "could I have held through that".',
    },
  },
  {
    key: 'sharpe',
    term: { id: 'Sharpe Ratio', en: 'Sharpe Ratio' },
    short: { id: 'Berapa banyak keuntungan yang kamu dapat untuk setiap satuan gejolak yang kamu tanggung.', en: 'How much return you earned for each unit of turbulence you endured.' },
    long: {
      id: 'Di bawah 1 biasanya dianggap biasa saja, di atas 1 bagus, di atas 2 sangat bagus. Aset yang untungnya besar tapi Sharpe-nya rendah artinya keuntungan itu ditebus dengan naik-turun yang brutal.',
      en: 'Below 1 is generally unremarkable, above 1 is good, above 2 is excellent. An asset with big gains but a low Sharpe earned them through brutal swings.',
    },
    formula: '(Return − Suku Bunga Bebas Risiko) / Volatilitas',
  },
  {
    key: 'sortino',
    term: { id: 'Sortino Ratio', en: 'Sortino Ratio' },
    short: { id: 'Seperti Sharpe, tapi hanya menghukum gejolak ke bawah.', en: 'Like Sharpe, but it only penalises downward swings.' },
    long: {
      id: 'Sharpe menganggap lonjakan naik yang tiba-tiba sebagai "risiko" juga, padahal tidak ada yang keberatan portofolionya naik mendadak. Sortino memperbaiki itu: yang dihitung cuma penurunan. Kalau Sortino jauh lebih tinggi dari Sharpe, artinya gejolak aset itu condong ke arah yang kamu suka.',
      en: 'Sharpe treats sudden jumps upward as "risk" too, though nobody objects to their portfolio jumping up. Sortino fixes that by counting only the downside. A Sortino far above the Sharpe means the asset’s turbulence leans in the direction you want.',
    },
  },
  {
    key: 'beta',
    term: { id: 'Beta', en: 'Beta' },
    short: { id: 'Seberapa keras aset ini bergerak mengikuti pasar secara keseluruhan.', en: 'How strongly this asset moves along with the overall market.' },
    long: {
      id: 'Beta 1 berarti bergerak seirama indeks. Beta 2 berarti saat pasar naik 10%, aset ini cenderung naik 20% — dan saat pasar turun 10%, turun 20% juga. Beta di bawah 1 berarti lebih kalem dari pasar. Pembanding di situs ini adalah S&P 500.',
      en: 'Beta 1 means it moves in step with the index. Beta 2 means when the market rises 10% this asset tends to rise 20% — and falls 20% when the market falls 10%. Below 1 means calmer than the market. The benchmark here is the S&P 500.',
    },
  },
  {
    key: 'alpha',
    term: { id: 'Alpha', en: 'Alpha' },
    short: { id: 'Kelebihan hasil di atas yang "seharusnya" didapat untuk risiko sebesar itu.', en: 'Return earned beyond what that level of risk "should" have produced.' },
    long: {
      id: 'Kalau sebuah aset dua kali lebih berisiko dari pasar, wajar kalau hasilnya juga lebih besar — itu belum prestasi. Alpha mengukur sisanya: hasil yang tidak bisa dijelaskan hanya oleh risiko yang diambil. Alpha positif berarti mengungguli ekspektasi.',
      en: 'If an asset is twice as risky as the market, a bigger return is only fair — that is not yet an achievement. Alpha measures the remainder: return that risk alone cannot explain. Positive alpha means it beat expectations.',
    },
  },
  {
    key: 'correlation',
    term: { id: 'Korelasi', en: 'Correlation' },
    short: { id: 'Seberapa mirip dua aset bergerak. 1 = selalu searah, 0 = tidak berhubungan.', en: 'How similarly two assets move. 1 = always together, 0 = unrelated.' },
    long: {
      id: 'Ini inti dari diversifikasi. Punya lima saham bank Indonesia terdengar seperti lima aset, tapi kalau korelasinya 0,9 kamu praktis cuma punya satu. Diversifikasi yang berguna butuh aset yang tidak jatuh bersamaan.',
      en: 'This is what diversification actually means. Holding five Indonesian bank stocks sounds like five assets, but at a correlation of 0.9 you effectively hold one. Useful diversification needs assets that do not fall at the same time.',
    },
  },
  {
    key: 'grahamNumber',
    term: { id: 'Graham Number', en: 'Graham Number' },
    short: { id: 'Perkiraan harga wajar maksimum menurut saringan Benjamin Graham.', en: 'An estimated maximum fair price under Benjamin Graham’s screen.' },
    long: {
      id: 'Graham menetapkan dua batas untuk saham konservatif: P/E maksimum 15 dan P/B maksimum 1,5. Dikalikan, 15 × 1,5 = 22,5 — dari situlah angka dalam rumus ini berasal. Hasilnya adalah harga tertinggi yang masih lolos kedua saringan sekaligus. Rumus ini lahir untuk perusahaan industri era 1970-an, jadi sering menganggap perusahaan teknologi modern "kemahalan" karena aset utamanya tidak tercatat di neraca.',
      en: 'Graham set two limits for conservative stocks: a maximum P/E of 15 and maximum P/B of 1.5. Multiplied, 15 × 1.5 = 22.5 — the source of the number in this formula. The result is the highest price that still clears both screens. It was designed for 1970s industrial companies, so it often calls modern tech "overpriced" because their main assets never appear on the balance sheet.',
    },
    formula: '√(22,5 × EPS × Nilai Buku per Saham)',
  },
  {
    key: 'marginOfSafety',
    term: { id: 'Margin of Safety', en: 'Margin of Safety' },
    short: { id: 'Selisih antara perkiraan nilai wajar dan harga pasar saat ini.', en: 'The gap between estimated fair value and today’s market price.' },
    long: {
      id: 'Gagasannya sederhana: perkiraan nilai wajarmu pasti meleset, jadi beli cukup jauh di bawahnya supaya ada ruang untuk salah. Graham menyarankan margin sekitar sepertiga. Margin negatif berarti harga pasar sudah di atas perkiraan nilai wajarnya.',
      en: 'The idea is simple: your fair-value estimate will be wrong, so buy far enough below it to leave room for that error. Graham suggested roughly a third. A negative margin means the market price already sits above the estimated value.',
    },
    formula: '(Nilai Wajar − Harga Pasar) / Nilai Wajar × 100',
  },
  {
    key: 'pe',
    term: { id: 'P/E Ratio', en: 'P/E Ratio' },
    short: { id: 'Harga saham dibagi laba per saham — berapa tahun laba untuk "membayar" harganya.', en: 'Share price divided by earnings per share — how many years of profit it takes to "pay for" the price.' },
    long: {
      id: 'P/E 15 kira-kira berarti kamu membayar 15 tahun laba saat ini. P/E tinggi tidak otomatis buruk: pasar mungkin memperkirakan labanya akan tumbuh cepat. Tapi P/E tinggi berarti kamu membayar di muka untuk pertumbuhan yang belum terjadi.',
      en: 'A P/E of 15 roughly means paying 15 years of current profit. A high P/E is not automatically bad: the market may expect profits to grow fast. But it does mean paying up front for growth that has not happened yet.',
    },
  },
  {
    key: 'pb',
    term: { id: 'P/B Ratio', en: 'P/B Ratio' },
    short: { id: 'Harga saham dibanding nilai buku bersih perusahaan.', en: 'Share price against the company’s net book value.' },
    long: {
      id: 'P/B 1 berarti harga pasarnya sama dengan nilai aset bersih di pembukuan. Berguna untuk bank dan perusahaan padat aset; kurang berarti untuk perusahaan perangkat lunak yang aset utamanya adalah kode dan orang, bukan gedung.',
      en: 'A P/B of 1 means the market price equals net assets on the books. Useful for banks and asset-heavy businesses; much less meaningful for software companies whose main assets are code and people, not buildings.',
    },
  },
  {
    key: 'roe',
    term: { id: 'ROE', en: 'ROE' },
    short: { id: 'Seberapa efisien perusahaan mengubah modal pemegang saham jadi laba.', en: 'How efficiently a company turns shareholder capital into profit.' },
    long: {
      id: 'ROE 20% berarti dari tiap Rp100 modal pemilik, perusahaan menghasilkan Rp20 laba setahun. Konsisten di atas 15% selama bertahun-tahun biasanya tanda bisnis yang punya keunggulan nyata. Tapi hati-hati: ROE bisa terlihat tinggi hanya karena perusahaan berutang banyak.',
      en: 'An ROE of 20% means every Rp100 of owner capital produces Rp20 of annual profit. Consistently above 15% for years usually signals a real competitive advantage. But beware: ROE can look high simply because the company borrowed heavily.',
    },
  },
  {
    key: 'debtToEquity',
    term: { id: 'Debt-to-Equity', en: 'Debt-to-Equity' },
    short: { id: 'Perbandingan utang terhadap modal sendiri.', en: 'Debt measured against the company’s own capital.' },
    long: {
      id: 'D/E 1 berarti utangnya sebesar modal sendiri. Utang memperbesar keuntungan saat bisnis lancar, dan memperbesar kerugian saat tidak. Perusahaan dengan utang rendah lebih tahan saat keadaan memburuk.',
      en: 'A D/E of 1 means debt equals equity. Debt magnifies gains when business is good and magnifies losses when it is not. Low-debt companies survive bad conditions better.',
    },
  },
  {
    key: 'dividendYield',
    term: { id: 'Dividend Yield', en: 'Dividend Yield' },
    short: { id: 'Dividen setahun dibagi harga saham, dalam persen.', en: 'Annual dividend divided by share price, in percent.' },
    long: {
      id: 'Yield 4% berarti untuk tiap Rp1 juta saham, kamu terima sekitar Rp40 ribu setahun sebagai dividen tunai. Yield yang tiba-tiba sangat tinggi sering bukan kabar baik — biasanya karena harga sahamnya yang jatuh, bukan dividennya yang naik.',
      en: 'A 4% yield means roughly Rp40k of cash dividends a year per Rp1m of shares held. A suddenly very high yield is often not good news — usually the share price fell rather than the dividend rising.',
    },
  },
  {
    key: 'ath',
    term: { id: 'ATH / ATL', en: 'ATH / ATL' },
    short: {
      id: 'Harga tertinggi dan terendah yang pernah tercapai sepanjang data yang tersedia.',
      en: 'The highest and lowest price ever reached within the available data.',
    },
    long: {
      id: 'Diukur dari harga tertinggi dan terendah DI DALAM tiap bulan, bukan dari harga penutupan — puncak sesungguhnya hampir tidak pernah terjadi tepat saat pasar tutup, dan memakai penutupan bisa meleset belasan persen pada aset volatil. Jarak dari puncak berguna sebagai konteks: aset yang −50% dari puncaknya sedang murah dibanding masa lalunya, tapi itu tidak otomatis berarti akan pulih. Banyak aset tidak pernah kembali ke puncaknya.',
      en: 'Measured from each month’s intraday high and low, not the close — real peaks almost never happen exactly at the closing bell, and using closes can miss by double digits on volatile assets. Distance from the peak is useful context: an asset 50% below its high is cheap relative to its own past, but that does not mean it will recover. Plenty of assets never return to their peak.',
    },
  },
  {
    key: 'supportResistance',
    term: { id: 'Support & Resistance', en: 'Support & Resistance' },
    short: {
      id: 'Level harga tempat pasar berulang kali berbalik arah.',
      en: 'Price levels where the market has repeatedly turned around.',
    },
    long: {
      id: 'Support adalah level di bawah harga sekarang tempat penurunan berkali-kali berhenti; resistance adalah kebalikannya di atas. Levelnya dihitung otomatis dengan mencari titik balik lokal pada data harian dua tahun, lalu mengelompokkan yang berdekatan jadi satu zona — karena pasar memperlakukan rentang 1% sebagai satu level, bukan sepuluh garis berbeda. Semakin sering disentuh, semakin banyak pelaku pasar yang memperhatikannya. Tapi level bukan dinding: yang ditembus akan berbalik peran, resistance lama jadi support baru. Ini deskripsi kebiasaan harga, bukan ramalan.',
      en: 'Support is a level below the current price where declines have repeatedly stopped; resistance is its mirror above. Levels are found automatically by locating local turning points in two years of daily data, then clustering nearby ones into a single zone — because the market treats a 1% range as one level, not ten separate lines. More touches means more participants watching. But levels are not walls: once broken they swap roles, old resistance becoming new support. This describes price habits, not the future.',
    },
  },
  {
    key: 'rsi',
    term: { id: 'RSI', en: 'RSI' },
    short: {
      id: 'Ukuran 0–100 tentang seberapa kuat kenaikan dibanding penurunan belakangan ini.',
      en: 'A 0–100 measure of how strong recent gains are compared to recent losses.',
    },
    long: {
      id: 'Di atas 70 sering disebut "jenuh beli", di bawah 30 "jenuh jual". Tapi istilah itu menyesatkan kalau dibaca sebagai sinyal: aset yang sedang tren kuat bisa bertahan di atas 70 selama berbulan-bulan sambil terus naik, dan menjual hanya karena RSI tinggi adalah cara klasik ketinggalan kenaikan terbesar. RSI paling berguna sebagai konteks — "kenaikan ini sudah seberapa cepat" — bukan sebagai perintah. Situs ini memakai pemulusan Wilder, definisi aslinya, sehingga angkanya cocok dengan platform lain.',
      en: 'Above 70 is often called "overbought", below 30 "oversold". Those labels mislead when read as signals: an asset in a strong trend can hold above 70 for months while continuing to climb, and selling merely because RSI is high is a classic way to miss the biggest part of a move. RSI is most useful as context — "how fast has this run" — not as an instruction. This site uses Wilder smoothing, the original definition, so the numbers match other platforms.',
    },
    formula: 'RSI = 100 − 100 / (1 + rata-rata untung / rata-rata rugi)',
  },
  {
    key: 'macd',
    term: { id: 'MACD', en: 'MACD' },
    short: {
      id: 'Selisih dua rata-rata bergerak — menunjukkan momentum sedang menguat atau melemah.',
      en: 'The gap between two moving averages — shows whether momentum is building or fading.',
    },
    long: {
      id: 'MACD adalah selisih rata-rata 12 periode dan 26 periode. Garis sinyal adalah rata-rata dari MACD itu sendiri, dan histogram adalah jarak keduanya. Histogram positif berarti momentum jangka pendek lebih kuat dari jangka menengah. Seperti semua indikator berbasis rata-rata, MACD selalu terlambat — ia mengonfirmasi pergerakan yang sudah terjadi, tidak mendahuluinya.',
      en: 'MACD is the gap between a 12-period and a 26-period average. The signal line is an average of MACD itself, and the histogram is the distance between them. A positive histogram means short-term momentum is outpacing the medium term. Like every average-based indicator, MACD always lags — it confirms moves that already happened rather than anticipating them.',
    },
    formula: 'MACD = EMA(12) − EMA(26); Sinyal = EMA(MACD, 9)',
  },
  {
    key: 'bollinger',
    term: { id: 'Bollinger Bands', en: 'Bollinger Bands' },
    short: {
      id: 'Pita di atas dan di bawah harga rata-rata, melebar saat pasar bergejolak.',
      en: 'Bands above and below the average price that widen when the market gets turbulent.',
    },
    long: {
      id: 'Pitanya berjarak dua simpangan baku dari rata-rata 20 periode. Saat pasar tenang pita menyempit; saat bergejolak pita melebar. Harga menyentuh pita atas BUKAN berarti terlalu mahal — dalam tren kuat, harga bisa merayap di sepanjang pita atas untuk waktu lama. Yang lebih sering berguna adalah lebar pitanya: penyempitan ekstrem sering mendahului pergerakan besar, meski arahnya tidak bisa diketahui dari situ.',
      en: 'The bands sit two standard deviations from a 20-period average. When the market is calm they narrow; when it is turbulent they widen. Price touching the upper band does NOT mean it is too expensive — in a strong trend price can ride the upper band for a long time. More often useful is the bandwidth: extreme compression often precedes a large move, though it says nothing about direction.',
    },
  },
  {
    key: 'atr',
    term: { id: 'ATR', en: 'ATR' },
    short: {
      id: 'Rata-rata jarak gerak harga per periode, dalam satuan rupiah atau dolar.',
      en: 'The average distance price travels per period, in rupiah or dollars.',
    },
    long: {
      id: 'Berbeda dari volatilitas yang dinyatakan dalam persen, ATR memberi angka dalam satuan harga: "saham ini biasanya bergerak Rp250 sehari". Berguna untuk menakar apakah pergerakan hari ini tergolong biasa atau luar biasa, dan sering dipakai untuk menentukan jarak batas rugi yang masuk akal. ATR memperhitungkan lompatan harga antar hari, bukan hanya rentang dalam hari itu.',
      en: 'Unlike volatility expressed in percent, ATR gives a figure in price units: "this stock typically moves Rp250 a day". Useful for judging whether today’s move is ordinary or unusual, and often used to size a sensible stop distance. ATR accounts for gaps between days, not just the range within a single day.',
    },
  },
  {
    key: 'stochastic',
    term: { id: 'Stochastic Oscillator', en: 'Stochastic Oscillator' },
    short: {
      id: 'Posisi harga penutupan di dalam rentang tertinggi–terendah periode terakhir.',
      en: 'Where the closing price sits inside the recent high-low range.',
    },
    long: {
      id: 'Nilai 100 berarti harga menutup tepat di puncak rentang 14 periode terakhir; 0 berarti tepat di dasarnya. %D adalah versi yang dihaluskan. Sama seperti RSI, angka ekstrem lebih menggambarkan kekuatan tren daripada titik balik — harga yang terus menutup di puncak rentangnya adalah tanda tren kuat, bukan tanda akan berbalik.',
      en: 'A reading of 100 means price closed exactly at the top of the last 14 periods’ range; 0 means exactly at the bottom. %D is a smoothed version. As with RSI, extreme readings describe trend strength more than turning points — price closing repeatedly at the top of its range signals a strong trend, not an imminent reversal.',
    },
  },
  {
    key: 'pivotPoints',
    term: { id: 'Pivot Point', en: 'Pivot Points' },
    short: {
      id: 'Level acuan yang dihitung mekanis dari tertinggi, terendah, dan penutupan periode sebelumnya.',
      en: 'Reference levels computed mechanically from the previous period’s high, low and close.',
    },
    long: {
      id: 'Tidak ada penilaian sama sekali di dalamnya — hanya aritmetika dari tiga angka. Kegunaannya justru karena itu: rumusnya sama bagi semua orang, jadi banyak pelaku pasar melihat level yang persis sama. Situs ini menghitungnya dari bulan penuh terakhir, bukan bulan berjalan, karena pivot dari periode yang belum tutup berubah tiap hari dan tidak berarti apa-apa.',
      en: 'There is no judgement in these at all — just arithmetic on three numbers. That is precisely why they matter: everyone computes them the same way, so many participants watch identical levels. This site computes them from the last complete month, not the current one, because pivots from an unfinished period shift daily and mean nothing.',
    },
    formula: 'P = (H + L + C) / 3; R1 = 2P − L; S1 = 2P − H',
  },
  {
    key: 'ruleOf72',
    term: { id: 'Rule of 72', en: 'Rule of 72' },
    short: { id: 'Cara cepat menghitung berapa tahun uang jadi dua kali lipat.', en: 'A quick way to estimate how long money takes to double.' },
    long: {
      id: 'Bagi 72 dengan persentase return tahunanmu. Return 8% per tahun? 72 ÷ 8 = 9 tahun untuk berlipat dua. Hitungan kasar yang cukup akurat untuk return antara 5% dan 20%.',
      en: 'Divide 72 by your annual return percentage. Earning 8% a year? 72 ÷ 8 = 9 years to double. A rough shortcut that stays accurate between roughly 5% and 20%.',
    },
    formula: 'tahun ≈ 72 / return tahunan (%)',
  },
];

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
    id: 'Rasio fundamental butuh API key gratis (Financial Modeling Prep atau Finnhub) yang dipasang sebagai GitHub Secret. Simulasi DCA, peringkat, dan semua metrik risiko tetap jalan penuh tanpa itu.',
    en: 'Fundamental ratios need a free API key (Financial Modeling Prep or Finnhub) stored as a GitHub Secret. DCA simulations, rankings and all risk metrics work fully without it.',
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

  'settings.language': { id: 'Bahasa', en: 'Language' },
  'settings.currency': { id: 'Mata uang', en: 'Currency' },
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

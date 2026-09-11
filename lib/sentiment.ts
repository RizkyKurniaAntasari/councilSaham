/**
 * Leksikon sentimen & tema berita pasar modal Indonesia.
 * Bobot: -3 (sangat negatif) sampai +3 (sangat positif).
 */

export const LEXICON: Record<string, number> = {
  // --- sangat positif ---
  "rekor laba": 3,
  "laba melonjak": 3,
  "laba melesat": 3,
  "cetak laba": 2.5,
  "laba naik": 2.5,
  "laba tumbuh": 2.5,
  "pendapatan naik": 2,
  "pendapatan melonjak": 2.5,
  "kinerja positif": 2,
  "bagi dividen": 2.5,
  "tebar dividen": 2.5,
  dividen: 1.5,
  "dividen interim": 2,
  "buyback": 2,
  "beli kembali saham": 2,
  akuisisi: 2,
  mengakuisisi: 2,
  "caplok": 1.5,
  ekspansi: 1.8,
  "kontrak baru": 2.5,
  "raih kontrak": 2.5,
  "teken kontrak": 2.2,
  "menang tender": 2.5,
  "kerja sama": 1.2,
  kolaborasi: 1.2,
  "mou": 1,
  "pabrik baru": 2,
  "smelter": 1.5,
  "kapasitas produksi": 1.5,
  "produksi meningkat": 2,
  "target produksi": 1,
  "harga batu bara naik": 2,
  "harga nikel naik": 2,
  "harga emas naik": 2,
  "harga cpo naik": 2,
  "permintaan meningkat": 1.8,
  "rekomendasi beli": 2,
  "target harga naik": 2,
  "buy": 1.5,
  "upgrade": 1.8,
  "outperform": 2,
  "overweight": 1.8,
  "arus masuk asing": 2,
  "net buy asing": 2,
  "diborong asing": 2,
  "auto reject atas": 2,
  ara: 1.5,
  melesat: 2,
  melonjak: 2,
  menguat: 1.5,
  meroket: 2.5,
  "cuan": 1.5,
  "ekspansi bisnis": 2,
  "ipo anak usaha": 1.8,
  "stock split": 1,
  "masuk indeks": 1.8,
  "lq45": 1,
  "efisiensi": 1.2,
  "hemat biaya": 1.2,
  "turun utang": 1.5,
  "lunasi utang": 1.8,
  "restrukturisasi berhasil": 1.5,
  "insentif pemerintah": 1.5,
  "hilirisasi": 1.5,
  "subsidi": 0.8,

  // --- sangat negatif ---
  "rugi": -2.5,
  "merugi": -2.8,
  "kerugian": -2.5,
  "laba turun": -2.5,
  "laba anjlok": -3,
  "pendapatan turun": -2,
  "kinerja menurun": -2,
  "gagal bayar": -3,
  "default": -3,
  pkpu: -3,
  pailit: -3,
  bangkrut: -3,
  "suspensi": -2.8,
  "disuspend": -2.8,
  "delisting": -3,
  "gugatan": -2,
  "digugat": -2,
  "tersangka": -2.8,
  korupsi: -3,
  "penyelidikan": -2,
  "penyidikan": -2.2,
  "sanksi": -2,
  "denda": -1.8,
  "peringatan bei": -2,
  "unusual market activity": -2,
  uma: -2,
  "auto reject bawah": -2,
  arb: -1.5,
  anjlok: -2.5,
  merosot: -2,
  ambles: -2.5,
  "melemah": -1.5,
  terkoreksi: -1.2,
  "tertekan": -1.5,
  "net sell asing": -2,
  "dilepas asing": -2,
  "arus keluar asing": -2,
  "rekomendasi jual": -2,
  "target harga turun": -2,
  sell: -1.5,
  downgrade: -2,
  underperform: -2,
  underweight: -1.8,
  "right issue": -1.2,
  "rights issue": -1.2,
  "dilusi": -1.5,
  "private placement": -1,
  "utang membengkak": -2.5,
  "beban bunga": -1.2,
  "harga batu bara turun": -2,
  "harga nikel turun": -2,
  "harga cpo turun": -2,
  "permintaan turun": -1.8,
  "produksi turun": -1.8,
  "kecelakaan kerja": -2,
  "tutup tambang": -2.5,
  "izin dicabut": -2.8,
  "moratorium": -1.8,
  "pemutusan hubungan kerja": -2,
  phk: -2,
  "mundur": -1.2,
  "direktur mengundurkan diri": -1.5,
  "mogok": -1.8,
  "force majeure": -2.2,
};

export type ThemeKey =
  | "kinerja"
  | "aksi_korporasi"
  | "dividen"
  | "ekspansi"
  | "komoditas"
  | "regulasi"
  | "kepemilikan"
  | "analis"
  | "teknikal"
  | "risiko_hukum"
  | "utang"
  | "makro";

/**
 * grade "utama"   = katalis spesifik emiten yang layak jadi dasar tesis.
 * grade "sekunder"= obrolan pasar (rekomendasi harian, pergerakan harga, makro) —
 *                   tetap ditampilkan, tapi kekuatannya dipangkas dan syarat buktinya lebih ketat.
 */
export const THEMES: {
  key: ThemeKey;
  label: string;
  keywords: string[];
  horizon: string;
  grade: "utama" | "sekunder";
}[] = [
  {
    key: "kinerja",
    grade: "utama",
    label: "Kinerja Keuangan",
    horizon: "Jangka pendek–menengah (1–2 kuartal)",
    keywords: ["laba", "rugi", "pendapatan", "kinerja", "laporan keuangan", "kuartal", "semester", "ebitda", "margin", "omzet", "penjualan"],
  },
  {
    key: "aksi_korporasi",
    grade: "utama",
    label: "Aksi Korporasi",
    horizon: "Jangka menengah (1–4 kuartal)",
    keywords: ["akuisisi", "merger", "divestasi", "right issue", "rights issue", "private placement", "buyback", "stock split", "ipo", "spin off", "anak usaha", "obligasi", "penerbitan saham"],
  },
  {
    key: "dividen",
    grade: "utama",
    label: "Dividen",
    horizon: "Jangka pendek (menjelang cum date)",
    keywords: ["dividen", "cum date", "ex date", "payout", "rups", "tebar dividen"],
  },
  {
    key: "ekspansi",
    grade: "utama",
    label: "Ekspansi & Proyek Baru",
    horizon: "Jangka panjang (1–3 tahun)",
    keywords: ["ekspansi", "pabrik", "smelter", "kapasitas", "proyek", "investasi", "capex", "kontrak", "tender", "konstruksi", "hilirisasi", "tambang baru", "konsesi"],
  },
  {
    key: "komoditas",
    grade: "utama",
    label: "Harga Komoditas",
    horizon: "Jangka pendek (mengikuti siklus harga)",
    keywords: ["batu bara", "batubara", "nikel", "emas", "tembaga", "timah", "cpo", "minyak", "gas", "harga komoditas", "newcastle", "lme"],
  },
  {
    key: "regulasi",
    grade: "utama",
    label: "Regulasi & Kebijakan",
    horizon: "Jangka menengah–panjang",
    keywords: ["pemerintah", "kebijakan", "regulasi", "aturan", "izin", "royalti", "pajak", "bea", "ekspor", "impor", "kementerian", "esdm", "ojk", "subsidi", "dmo"],
  },
  {
    key: "kepemilikan",
    grade: "utama",
    label: "Kepemilikan & Investor",
    horizon: "Jangka pendek",
    keywords: ["pemegang saham", "kepemilikan", "asing", "net buy", "net sell", "institusi", "insider", "borong", "akumulasi", "divestasi saham", "pengendali"],
  },
  {
    key: "analis",
    grade: "sekunder",
    label: "Rekomendasi Analis",
    horizon: "Jangka pendek",
    keywords: ["target harga", "rekomendasi", "analis", "sekuritas", "riset", "buy", "sell", "hold", "upgrade", "downgrade", "valuasi"],
  },
  {
    key: "teknikal",
    grade: "sekunder",
    label: "Pergerakan Harga",
    horizon: "Jangka sangat pendek (harian)",
    keywords: ["saham naik", "saham turun", "ara", "arb", "auto reject", "menguat", "melemah", "top gainer", "top loser", "volume", "resistance", "support"],
  },
  {
    key: "risiko_hukum",
    grade: "utama",
    label: "Risiko Hukum & Tata Kelola",
    horizon: "Tidak pasti — risiko ekor",
    keywords: ["gugatan", "sengketa", "korupsi", "tersangka", "penyidikan", "kpk", "kejaksaan", "sanksi", "denda", "suspensi", "uma", "pailit", "pkpu", "skandal"],
  },
  {
    key: "utang",
    grade: "utama",
    label: "Struktur Utang",
    horizon: "Jangka menengah",
    keywords: ["utang", "obligasi", "pinjaman", "refinancing", "restrukturisasi", "gagal bayar", "kredit", "bunga", "der", "leverage"],
  },
  {
    key: "makro",
    grade: "sekunder",
    label: "Makro & Pasar",
    horizon: "Jangka menengah",
    keywords: ["ihsg", "suku bunga", "inflasi", "rupiah", "the fed", "bank indonesia", "resesi", "pertumbuhan ekonomi", "indeks"],
  },
];

const NEGATORS = ["tidak", "belum", "bukan", "tanpa", "gagal", "batal"];

export interface SentimentResult {
  score: number; // -1..1
  label: "POSITIF" | "NEGATIF" | "NETRAL";
  matched: string[];
}

export function analyzeSentiment(text: string): SentimentResult {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  let total = 0;
  let hits = 0;
  const matched: string[] = [];

  for (const [phrase, weight] of Object.entries(LEXICON)) {
    const idx = t.indexOf(` ${phrase}`);
    if (idx === -1 && !t.includes(` ${phrase} `)) continue;
    const at = idx === -1 ? t.indexOf(` ${phrase} `) : idx;
    const before = t.slice(Math.max(0, at - 22), at);
    const negated = NEGATORS.some((n) => before.includes(` ${n} `) || before.trim().endsWith(n));
    total += negated ? -weight * 0.6 : weight;
    hits++;
    matched.push(phrase);
  }

  if (!hits) return { score: 0, label: "NETRAL", matched: [] };
  const avg = total / Math.sqrt(hits);
  const score = Math.max(-1, Math.min(1, avg / 3));
  return {
    score,
    label: score > 0.12 ? "POSITIF" : score < -0.12 ? "NEGATIF" : "NETRAL",
    matched: matched.slice(0, 6),
  };
}

export function detectThemes(text: string): string[] {
  const t = text.toLowerCase();
  const found: { label: string; hits: number }[] = [];
  for (const theme of THEMES) {
    const hits = theme.keywords.filter((k) => t.includes(k)).length;
    if (hits) found.push({ label: theme.label, hits });
  }
  return found
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((f) => f.label);
}

export function themeMeta(label: string) {
  return THEMES.find((t) => t.label === label);
}

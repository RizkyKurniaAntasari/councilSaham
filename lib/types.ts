export type Stance = "STRONG_BUY" | "BUY" | "HOLD" | "REDUCE" | "SELL";

export interface Candle {
  t: number; // epoch ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Profile {
  ticker: string;
  symbol: string; // simbol Yahoo, mis. ADMR.JK
  name: string;
  sector?: string;
  industry?: string;
  website?: string;
  summary?: string;
  employees?: number;
  address?: string;
  officers: { name: string; title?: string; age?: number; yearBorn?: number }[];
}

export interface QuoteSnapshot {
  price: number;
  previousClose: number;
  change: number;
  changePct: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume3m?: number;
  marketCap?: number;
  high52w?: number;
  low52w?: number;
  currency: string;
  exchange?: string;
  marketState?: string;
  updatedAt: number;
}

export interface Ownership {
  insidersPct?: number;
  institutionsPct?: number;
  institutionsFloatPct?: number;
  institutionsCount?: number;
  sharesOutstanding?: number;
  floatShares?: number;
  topHolders: { name: string; pct?: number; shares?: number; value?: number; date?: string }[];
  insiderTransactions: {
    name: string;
    relation?: string;
    action?: string;
    shares?: number;
    value?: number;
    date?: string;
  }[];
  source: string;
  note?: string;
}

export interface FundamentalMetric {
  key: string;
  label: string;
  value: number | null;
  display: string;
  score: number | null; // 0-100
  weight: number;
  verdict: string;
  benchmark?: string;
}

export interface FundamentalReport {
  available: boolean;
  score: number; // 0-100
  grade: string;
  metrics: FundamentalMetric[];
  highlights: string[];
  risks: string[];
  financials: {
    revenue?: number;
    netIncome?: number;
    revenueGrowth?: number;
    earningsGrowth?: number;
    grossMargin?: number;
    operatingMargin?: number;
    profitMargin?: number;
    roe?: number;
    roa?: number;
    der?: number;
    currentRatio?: number;
    totalCash?: number;
    totalDebt?: number;
    freeCashflow?: number;
    bookValue?: number;
    eps?: number;
    per?: number;
    pbv?: number;
    psr?: number;
    evToEbitda?: number;
    dividendYield?: number;
    payoutRatio?: number;
  };
}

export interface IndicatorSet {
  ma5: number | null;
  ma20: number | null;
  ma50: number | null;
  ma100: number | null;
  ma200: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: { macd: number; signal: number; hist: number } | null;
  bb: { upper: number; mid: number; lower: number; pctB: number; widthPct: number } | null;
  atr14: number | null;
  atrPct: number | null;
  stoch: { k: number; d: number } | null;
  obvSlopePct: number | null;
  volume: { last: number; avg20: number; avg60: number; ratio20: number; ratio60: number } | null;
  adx14: number | null;
  return1d: number | null;
  return5d: number | null;
  return20d: number | null;
  return60d: number | null;
  return250d: number | null;
  distFrom52wHigh: number | null;
  distFrom52wLow: number | null;
  vwap20: number | null;
}

export interface TechnicalSignal {
  name: string;
  value: string;
  signal: "BULLISH" | "BEARISH" | "NETRAL";
  weight: number;
  note: string;
}

export interface TechnicalReport {
  available: boolean;
  score: number;
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS";
  trendStrength: string;
  phase: string;
  indicators: IndicatorSet;
  signals: TechnicalSignal[];
  supports: number[];
  resistances: number[];
  levels: {
    entry: number | null;
    stopLoss: number | null;
    target1: number | null;
    target2: number | null;
    riskRewardRatio: number | null;
  };
  patterns: string[];
  highlights: string[];
  risks: string[];
  /** Komponen skor teknikal: skor komponen × bobot. */
  breakdown: { label: string; score: number; weight: number; detail: string }[];
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  snippet?: string;
  sentiment: number; // -1..1
  sentimentLabel: "POSITIF" | "NEGATIF" | "NETRAL";
  matchedKeywords: string[];
  relevance: number; // 0..1
  themes: string[];
}

export interface NewsReport {
  available: boolean;
  items: NewsItem[];
  score: number; // 0-100
  avgSentiment: number;
  counts: { positive: number; negative: number; neutral: number; total: number };
  buzz: { last24h: number; last7d: number; last30d: number; buzzLevel: string };
  topThemes: { theme: string; count: number; sentiment: number }[];
  sources: string[];
  highlights: string[];
  risks: string[];
}

export type StoryVerdict = "TERVALIDASI" | "SEBAGIAN_VALID" | "LEMAH" | "BELUM_TERVALIDASI" | "MENCURIGAKAN";

export interface StoryCheck {
  key: string;
  label: string;
  passed: boolean | null;
  score: number; // 0-100
  weight: number;
  evidence: string;
}

export interface Story {
  id: string;
  theme: string;
  /** "utama" = katalis spesifik emiten; "sekunder" = obrolan pasar umum. */
  grade: "utama" | "sekunder";
  title: string;
  narrative: string;
  strength: number; // 0-100
  verdict: StoryVerdict;
  checks: StoryCheck[];
  supportingNews: { title: string; url: string; source: string; publishedAt: number }[];
  firstSeen: number;
  lastSeen: number;
  sourceCount: number;
  impactHorizon: string;
}

export interface MomentumReport {
  score: number; // 0-100
  state: string;
  priceMomentum: number;
  volumeMomentum: number;
  newsMomentum: number;
  accelerating: boolean;
  flags: string[];
  divergence: string[];
  stories: Story[];
  summary: string;
}

export interface CouncilMember {
  id: string;
  name: string;
  role: string;
  emoji: string;
  score: number; // 0-100
  stance: Stance;
  confidence: number; // 0-100
  weight: number;
  rationale: string[];
  concerns: string[];
}

export interface CouncilVerdict {
  score: number;
  stance: Stance;
  label: string;
  confidence: number;
  consensus: string;
  disagreement: number;
  members: CouncilMember[];
  actionPlan: {
    horizon: string;
    entry: string;
    stopLoss: string;
    target: string;
    positionSizing: string;
    invalidation: string;
  };
  keyReasons: string[];
  keyRisks: string[];
  watchlist: string[];
  plan?: TradePlan;
  position?: { pct: number; basis: string };
  narrative?: string;
  narrativeSource?: "ai" | "rule";
}

export interface CouncilAI {
  ringkasan_eksekutif: string;
  tesis_bull: string[];
  tesis_bear: string[];
  pembacaan_story: { tema: string; penilaian: string }[];
  debat_dewan: string;
  rekomendasi: string;
  yang_harus_dipantau: string[];
  peringatan: string;
}

export interface AnalysisResult {
  ticker: string;
  symbol: string;
  generatedAt: number;
  profile: Profile;
  quote: QuoteSnapshot;
  candles: Candle[];
  ownership: Ownership;
  fundamental: FundamentalReport;
  technical: TechnicalReport;
  news: NewsReport;
  momentum: MomentumReport;
  cycle: CycleReport;
  dataRec: DataRecommendation;
  entry?: EntrySignal;
  market?: RelativeStrength;
  council: CouncilVerdict;
  ai?: CouncilAI;
  dataQuality: { sources: string[]; warnings: string[]; completeness: number };
}

/* ------------------------------------------------------------------ */
/* Siklus saham (Wyckoff) & rekomendasi berbasis data                   */
/* ------------------------------------------------------------------ */

export type CyclePhase = "AKUMULASI" | "MARKUP" | "DISTRIBUSI" | "MARKDOWN";

export interface CycleEvidence {
  label: string;
  value: string;
  /** Fase yang didukung oleh bukti ini (null = netral). */
  supports: CyclePhase | null;
}

export interface CycleReport {
  available: boolean;
  phase: CyclePhase;
  label: string;
  stage: string;
  confidence: number; // 0-100
  /** Probabilitas relatif tiap fase, total 100. */
  scores: Record<CyclePhase, number>;
  daysInPhase: number;
  range: { high: number; low: number; widthPct: number };
  metrics: {
    ma50Slope: number | null;
    cmf: number | null;
    upDownVolume: number | null;
    position52w: number | null;
    priorTrend: number | null;
    adx: number | null;
  };
  evidence: CycleEvidence[];
  next: { phase: CyclePhase; trigger: string; invalidation: string };
  timeline: { t: number; phase: CyclePhase; price: number }[];
  summary: string;
}

/** Satu komponen skor: berapa poin yang disumbangkan dan dari data apa. */
export interface ScoreItem {
  label: string;
  points: number; // kontribusi bertanda terhadap skor akhir
  detail: string;
}

export interface PriceLevel {
  price: number;
  pct: number; // jarak dari harga terakhir, %
  basis: string; // rumus/alasan angka ini
}

export interface TradePlan {
  /** BELI = rencana pembelian; PEGANG = panduan bagi pemegang saat fase bearish. */
  mode: "BELI" | "PEGANG";
  price: number;
  atr: number;
  tick: number;
  entryLow: PriceLevel | null;
  entryHigh: PriceLevel | null;
  stopLoss: PriceLevel;
  target1: PriceLevel;
  target2: PriceLevel | null;
  reentry: PriceLevel | null;
  riskPct: number | null; // tengah entry → stop
  rewardPct: number | null; // tengah entry → target 1
  riskReward1: number | null;
  riskReward2: number | null;
  /** R/R ke TP1 bila beli di batas bawah zona entry. */
  riskRewardAtLow: number | null;
  invalidation: string;
}

export type RecAction = "BELI" | "BELI_BERTAHAP" | "PANTAU" | "AMBIL_UNTUNG" | "HINDARI";

export interface DataRecommendation {
  action: RecAction;
  label: string;
  score: number; // 0-100
  horizon: string;
  entry: { low: number; high: number } | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
  riskReward: number | null;
  reasons: string[];
  warnings: string[];
  /** Rincian pembentuk skor: basis fase + penyesuaian. */
  breakdown: ScoreItem[];
  plan: TradePlan;
  position: { pct: number; basis: string };
}

export interface ScreenerRow {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change1d: number;
  return5d: number | null;
  return20d: number | null;
  return60d: number | null;
  volRatio: number; // volume hari terakhir / rata-rata 20 hari
  volSurge5d: number; // rata-rata volume 5 hari / rata-rata 60 hari
  avgValue20: number; // nilai transaksi rata-rata 20 hari (Rp)
  valueToday: number;
  rsi: number | null;
  trendingScore: number; // 0-100
  trendingReasons: string[];
  /** Skor trending khusus saham yang naik (0 = tidak sedang naik). */
  upTrendingScore: number;
  upTrendingReasons: string[];
  accumulationScore: number; // 0-100
  cycle: Pick<CycleReport, "phase" | "label" | "stage" | "confidence" | "scores" | "daysInPhase" | "range" | "summary">;
  rec: Omit<DataRecommendation, "plan">;
  timing: {
    verdict: EntryVerdict;
    label: string;
    score: number;
    situation: string;
    pattern: Pick<CandlePattern, "name" | "bullish" | "barsAgo" | "strength" | "followThrough" | "volumeConfirmed"> | null;
    waitFor: string | null;
    trigger: { label: string; price: number } | null;
  };
  spark: number[];
}

export interface ScreenerResult {
  generatedAt: number;
  universe: number;
  scanned: number;
  failed: string[];
  rows: ScreenerRow[];
}

/* ------------------------------------------------------------------ */
/* IHSG (Indeks Harga Saham Gabungan)                                    */
/* ------------------------------------------------------------------ */

export interface IhsgReport {
  symbol: string; // ^JKSE
  price: number;
  change: number;
  changePct: number;
  updatedAt: number; // waktu candle terakhir
  returns: { d1: number | null; d5: number | null; d20: number | null; d60: number | null; ytd: number | null; y1: number | null };
  high52w: number;
  low52w: number;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  rsi: number | null;
  trend: TechnicalReport["trend"];
  trendStrength: string;
  techScore: number;
  techBreakdown: TechnicalReport["breakdown"];
  supports: number[];
  resistances: number[];
  cycle: CycleReport;
  spark: number[];
  candles?: Candle[];
}

/** Kinerja saham dibanding IHSG pada periode yang sama (selisih poin persen). */
export interface RelativeStrength {
  ihsgPrice: number;
  ihsgChangePct: number;
  stock20: number | null;
  ihsg20: number | null;
  rs20: number | null;
  stock60: number | null;
  ihsg60: number | null;
  rs60: number | null;
  stock250: number | null;
  ihsg250: number | null;
  rs250: number | null;
}

/* ------------------------------------------------------------------ */
/* Timing entry: struktur MA + pola candlestick + perlawanan pembeli      */
/* ------------------------------------------------------------------ */

export interface CandlePattern {
  key: string;
  name: string;
  bullish: boolean;
  bars: number; // jumlah candle pembentuk pola
  reliability: number; // 1 lemah · 2 sedang · 3 kuat (literatur umum)
  meaning: string;
  context: string; // kenapa pola ini relevan di lokasinya
  t: number;
  index: number;
  barsAgo: number;
  volumeConfirmed: boolean; // volume ≥ 1,2× rata-rata 20H
  followThrough: boolean | null; // candle berikutnya menembus high/low pola (null = belum ada candle berikutnya)
  strength: number; // 0–5
  high: number;
  low: number;
}

export type EntryVerdict = "SIAP" | "TUNGGU" | "BELUM" | "HINDARI";

export interface EntryCheck {
  label: string;
  status: "ok" | "wait" | "bad";
  detail: string;
}

export interface MaLevel {
  label: "MA20" | "MA50" | "MA200";
  value: number;
  distPct: number; // harga vs MA, %
  above: boolean;
  slopePct: number | null; // kemiringan 10 hari
}

export interface EntrySignal {
  verdict: EntryVerdict;
  label: string;
  score: number; // kesiapan 0–100
  situation: string; // ringkasan posisi harga vs MA
  maLevels: MaLevel[];
  obstacle: { label: string; price: number; distPct: number } | null;
  rejection: string | null;
  patterns: CandlePattern[]; // pola ≤5 candle terakhir
  history: CandlePattern[]; // ±120 hari, untuk penanda grafik
  buyerSignals: string[];
  checklist: EntryCheck[];
  waitFor: string[];
  trigger: { label: string; price: number } | null;
  breakdown: ScoreItem[];
}

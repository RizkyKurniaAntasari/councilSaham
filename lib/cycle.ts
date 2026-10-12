import { adx, clamp, last, pctChange, rsi, sma } from "./indicators";
import type { Candle, CycleEvidence, CyclePhase, CycleReport } from "./types";

/**
 * Deteksi 4 siklus saham ala Wyckoff: Akumulasi → Mark Up → Distribusi → Mark Down.
 *
 * Setiap fase diberi skor dari bukti yang bisa diukur di tape harga & volume:
 *  - struktur tren (harga vs MA50/MA200, kemiringan MA50, higher high / lower low)
 *  - konteks sebelumnya (fase datar setelah turun = akumulasi, setelah naik = distribusi)
 *  - aliran dana (Chaikin Money Flow, rasio volume naik vs volume turun)
 *  - kekuatan tren (ADX) dan posisi dalam rentang 52 minggu
 * Skor lalu dinormalisasi menjadi probabilitas relatif.
 */

export const PHASES: CyclePhase[] = ["AKUMULASI", "MARKUP", "DISTRIBUSI", "MARKDOWN"];

export const PHASE_LABEL: Record<CyclePhase, string> = {
  AKUMULASI: "Akumulasi",
  MARKUP: "Mark Up",
  DISTRIBUSI: "Distribusi",
  MARKDOWN: "Mark Down",
};

export const PHASE_DESC: Record<CyclePhase, string> = {
  AKUMULASI:
    "Harga bergerak datar setelah periode turun. Pelaku besar diam-diam mengumpulkan barang — volume beli mulai mendominasi meski harga belum naik.",
  MARKUP:
    "Harga keluar dari area akumulasi dan naik membentuk higher high & higher low. Permintaan melebihi penawaran, tren naik terstruktur.",
  DISTRIBUSI:
    "Harga tertahan di area tinggi setelah kenaikan panjang. Pelaku besar mulai melepas barang ke pembeli ritel — volume jual mulai mendominasi.",
  MARKDOWN:
    "Harga jatuh dari area distribusi membentuk lower high & lower low. Penawaran melebihi permintaan, tren turun terstruktur.",
};

const NEXT: Record<CyclePhase, CyclePhase> = {
  AKUMULASI: "MARKUP",
  MARKUP: "DISTRIBUSI",
  DISTRIBUSI: "MARKDOWN",
  MARKDOWN: "AKUMULASI",
};

interface Features {
  price: number;
  ma20: number | null;
  ma50: number | null;
  maLong: number | null; // MA200, fallback MA100 bila riwayat pendek
  maLongLabel: string;
  ma50Slope: number | null; // % perubahan MA50 dalam 20 bar
  ret20: number | null;
  ret60: number | null;
  priorTrend: number | null; // perubahan harga bar -120 → bar -40
  position52w: number | null; // 0 = di dasar 52M, 100 = di puncak
  cmf: number | null; // Chaikin Money Flow 40 bar, -1..1
  upDownVolume: number | null; // volume hari naik / volume hari turun (30 bar)
  adx: number | null;
  rsi: number | null;
  higherHighs: boolean;
  higherLows: boolean;
  lowerHighs: boolean;
  lowerLows: boolean;
  rangeHigh: number;
  rangeLow: number;
  rangeWidthPct: number;
  volTrend: number | null; // rata-rata volume 20 / 60
}

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

function features(candles: Candle[]): Features {
  const n = candles.length;
  const closes = candles.map((c) => c.c);
  const price = closes[n - 1];

  const ma20Series = sma(closes, 20);
  const ma50Series = sma(closes, 50);
  const ma200 = last(sma(closes, 200));
  const ma100 = last(sma(closes, 100));
  const ma50 = last(ma50Series);
  const ma50Prev = n > 70 ? ma50Series[n - 21] : null;

  const ret = (d: number) => (n > d ? pctChange(closes[n - 1 - d], price) : null);

  const win = candles.slice(-250);
  const hi52 = Math.max(...win.map((c) => c.h));
  const lo52 = Math.min(...win.map((c) => c.l));

  // Chaikin Money Flow 40 bar
  const cmfWin = candles.slice(-40);
  let mfv = 0;
  let vol = 0;
  for (const c of cmfWin) {
    const span = c.h - c.l;
    const clv = span > 0 ? ((c.c - c.l) - (c.h - c.c)) / span : 0;
    mfv += clv * c.v;
    vol += c.v;
  }

  // Volume hari naik vs hari turun (30 bar)
  let upVol = 0;
  let downVol = 0;
  for (let i = Math.max(1, n - 30); i < n; i++) {
    if (candles[i].c > candles[i - 1].c) upVol += candles[i].v;
    else if (candles[i].c < candles[i - 1].c) downVol += candles[i].v;
  }

  const seg = (from: number, to: number) => candles.slice(Math.max(0, n - from), n - to);
  const recent = seg(20, 0);
  const prior = seg(40, 20);
  const hiRecent = Math.max(...recent.map((c) => c.h));
  const loRecent = Math.min(...recent.map((c) => c.l));
  const hiPrior = prior.length ? Math.max(...prior.map((c) => c.h)) : hiRecent;
  const loPrior = prior.length ? Math.min(...prior.map((c) => c.l)) : loRecent;

  const rangeWin = candles.slice(-40);
  const rangeHigh = Math.max(...rangeWin.map((c) => c.h));
  const rangeLow = Math.min(...rangeWin.map((c) => c.l));

  const vols = candles.map((c) => c.v);
  const v20 = sum(vols.slice(-20)) / Math.min(20, n);
  const v60 = sum(vols.slice(-60)) / Math.min(60, n);

  return {
    price,
    ma20: last(ma20Series),
    ma50,
    maLong: ma200 ?? ma100,
    maLongLabel: ma200 !== null ? "MA200" : "MA100",
    ma50Slope: ma50 !== null && ma50Prev ? pctChange(ma50Prev, ma50) : null,
    ret20: ret(20),
    ret60: ret(60),
    priorTrend: n > 120 ? pctChange(closes[n - 120], closes[n - 40]) : n > 60 ? pctChange(closes[0], closes[n - 40]) : null,
    position52w: hi52 > lo52 ? ((price - lo52) / (hi52 - lo52)) * 100 : null,
    cmf: vol > 0 ? mfv / vol : null,
    upDownVolume: downVol > 0 ? upVol / downVol : upVol > 0 ? 3 : null,
    adx: last(adx(candles, 14)),
    rsi: last(rsi(closes, 14)),
    higherHighs: hiRecent > hiPrior * 1.01,
    higherLows: loRecent > loPrior * 1.01,
    lowerHighs: hiRecent < hiPrior * 0.99,
    lowerLows: loRecent < loPrior * 0.99,
    rangeHigh,
    rangeLow,
    rangeWidthPct: rangeLow > 0 ? ((rangeHigh - rangeLow) / rangeLow) * 100 : 0,
    volTrend: v60 > 0 ? v20 / v60 : null,
  };
}

/** Skor mentah tiap fase (0-100) dari fitur. */
function rawScores(f: Features): Record<CyclePhase, number> {
  const s: Record<CyclePhase, number> = { AKUMULASI: 0, MARKUP: 0, DISTRIBUSI: 0, MARKDOWN: 0 };
  const slope = f.ma50Slope ?? 0;
  const flat = Math.abs(slope) < 3;
  const weakTrend = f.adx !== null ? f.adx < 25 : flat;
  const cmf = f.cmf ?? 0;
  const udv = f.upDownVolume ?? 1;
  const pos = f.position52w ?? 50;
  const prior = f.priorTrend ?? 0;
  const nearMa50 = f.ma50 !== null && Math.abs(pctChange(f.ma50, f.price)) < 8;

  // --- Mark Up ---
  if (f.ma50 !== null && f.price > f.ma50) s.MARKUP += 15;
  if (f.ma50 !== null && f.maLong !== null && f.ma50 > f.maLong) s.MARKUP += 15;
  s.MARKUP += clamp(slope / 6, 0, 1) * 15;
  s.MARKUP += clamp((f.ret60 ?? 0) / 25, 0, 1) * 15;
  if (f.higherHighs) s.MARKUP += 7;
  if (f.higherLows) s.MARKUP += 5;
  if ((f.adx ?? 0) > 22 && (f.ret20 ?? 0) > 0) s.MARKUP += 10;
  if (cmf > 0) s.MARKUP += 8;
  if (pos > 60) s.MARKUP += 10;

  // --- Mark Down ---
  if (f.ma50 !== null && f.price < f.ma50) s.MARKDOWN += 15;
  if (f.ma50 !== null && f.maLong !== null && f.ma50 < f.maLong) s.MARKDOWN += 15;
  s.MARKDOWN += clamp(-slope / 6, 0, 1) * 15;
  s.MARKDOWN += clamp(-(f.ret60 ?? 0) / 25, 0, 1) * 15;
  if (f.lowerLows) s.MARKDOWN += 7;
  if (f.lowerHighs) s.MARKDOWN += 5;
  if ((f.adx ?? 0) > 22 && (f.ret20 ?? 0) < 0) s.MARKDOWN += 10;
  if (cmf < 0) s.MARKDOWN += 8;
  if (pos < 40) s.MARKDOWN += 10;

  // --- Akumulasi: datar setelah turun, dana masuk ---
  s.AKUMULASI += clamp(-prior / 25, 0, 1) * 12 + clamp((50 - pos) / 40, 0, 1) * 10;
  if (flat) s.AKUMULASI += 12;
  if (weakTrend) s.AKUMULASI += 10;
  s.AKUMULASI += clamp(cmf / 0.15, 0, 1) * 16;
  s.AKUMULASI += clamp((udv - 1) / 0.5, 0, 1) * 10;
  if (f.higherLows) s.AKUMULASI += 8;
  if (nearMa50) s.AKUMULASI += 7;
  if (f.maLong !== null && f.price < f.maLong * 1.05) s.AKUMULASI += 5;
  if (!f.lowerLows) s.AKUMULASI += 5;

  // --- Distribusi: datar setelah naik, dana keluar ---
  s.DISTRIBUSI += clamp(prior / 30, 0, 1) * 12 + clamp((pos - 50) / 40, 0, 1) * 10;
  if (flat) s.DISTRIBUSI += 12;
  if (weakTrend) s.DISTRIBUSI += 10;
  s.DISTRIBUSI += clamp(-cmf / 0.15, 0, 1) * 16;
  s.DISTRIBUSI += clamp((1 - udv) / 0.4, 0, 1) * 10;
  if (f.lowerHighs) s.DISTRIBUSI += 8;
  if (nearMa50) s.DISTRIBUSI += 7;
  if (f.maLong !== null && f.price > f.maLong * 0.95) s.DISTRIBUSI += 5;
  if (!f.higherHighs) s.DISTRIBUSI += 5;

  // Tren kuat menekan kemungkinan fase datar, dan sebaliknya.
  if (!flat && !weakTrend) {
    s.AKUMULASI *= 0.75;
    s.DISTRIBUSI *= 0.75;
  }
  return s;
}

function normalize(raw: Record<CyclePhase, number>): Record<CyclePhase, number> {
  const sq = PHASES.map((p) => Math.max(0, raw[p]) ** 2);
  const total = sq.reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<CyclePhase, number>;
  PHASES.forEach((p, i) => (out[p] = Math.round((sq[i] / total) * 100)));
  return out;
}

function topPhase(scores: Record<CyclePhase, number>): CyclePhase {
  return PHASES.reduce((best, p) => (scores[p] > scores[best] ? p : best), PHASES[0]);
}

/** Klasifikasi cepat (dipakai juga untuk timeline). */
export function classifyPhase(candles: Candle[]): { phase: CyclePhase; scores: Record<CyclePhase, number> } {
  const scores = normalize(rawScores(features(candles)));
  return { phase: topPhase(scores), scores };
}

function fmtP(v: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
}

function sgn(v: number, d = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(d).replace(".", ",")}`;
}

export const EMPTY_CYCLE: CycleReport = {
  available: false,
  phase: "AKUMULASI",
  label: "Tidak diketahui",
  stage: "Data tidak cukup",
  confidence: 0,
  scores: { AKUMULASI: 25, MARKUP: 25, DISTRIBUSI: 25, MARKDOWN: 25 },
  daysInPhase: 0,
  range: { high: 0, low: 0, widthPct: 0 },
  metrics: { ma50Slope: null, cmf: null, upDownVolume: null, position52w: null, priorTrend: null, adx: null },
  evidence: [],
  next: { phase: "MARKUP", trigger: "—", invalidation: "—" },
  timeline: [],
  summary: "Riwayat harga terlalu pendek untuk membaca siklus.",
};

export function buildCycle(candles: Candle[], opts: { timeline?: boolean } = {}): CycleReport {
  if (candles.length < 60) return EMPTY_CYCLE;

  const f = features(candles);
  const scores = normalize(rawScores(f));
  const phase = topPhase(scores);
  const sorted = [...PHASES].sort((a, b) => scores[b] - scores[a]);
  const margin = scores[sorted[0]] - scores[sorted[1]];
  const confidence = Math.round(clamp(scores[phase] * 0.7 + margin * 0.6));

  // Timeline fase: klasifikasi ulang setiap 5 bar ke belakang (maks ~1 tahun).
  const step = 5;
  const points: { t: number; phase: CyclePhase; price: number }[] = [];
  const maxBack = opts.timeline === false ? 120 : 250;
  for (let back = 0; back <= maxBack; back += step) {
    const end = candles.length - back;
    if (end < 60) break;
    const slice = candles.slice(0, end);
    const c = slice[slice.length - 1];
    points.unshift({ t: c.t, phase: classifyPhase(slice).phase, price: c.c });
  }
  // Hitung lama fase saat ini (toleransi 1 titik "noise").
  let firstMatch = points.length - 1;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].phase === phase) firstMatch = i;
    else if (i === 0 || points[i - 1].phase !== phase) break;
  }
  const daysInPhase = (points.length - firstMatch) * step;

  // Sub-tahap
  const distMa50 = f.ma50 ? pctChange(f.ma50, f.price) : 0;
  const nearTop = f.price >= f.rangeHigh * 0.97;
  const nearBottom = f.price <= f.rangeLow * 1.03;
  let stage: string;
  switch (phase) {
    case "AKUMULASI":
      if (nearTop && (f.volTrend ?? 1) > 1.1) stage = "Akhir — Sign of Strength, mendekati breakout";
      else if (candles.slice(-10).some((c) => c.l < f.rangeLow * 1.005) && f.price > f.rangeLow * 1.03)
        stage = "Spring — uji dasar lalu memantul";
      else if (daysInPhase < 25) stage = "Awal — penurunan mulai tertahan";
      else stage = "Tengah — pengumpulan barang dalam rentang";
      break;
    case "MARKUP":
      if ((f.rsi ?? 50) > 72 || distMa50 > 20) stage = "Lanjut — mulai overextended";
      else if (daysInPhase <= 20) stage = "Awal — baru keluar dari area akumulasi";
      else stage = "Tengah — tren naik berjalan sehat";
      break;
    case "DISTRIBUSI":
      if (f.ma50 !== null && f.price < f.ma50 && (f.cmf ?? 0) < 0) stage = "Akhir — Sign of Weakness, rawan breakdown";
      else if (nearTop) stage = "Upthrust — uji puncak tanpa tenaga";
      else stage = "Awal — kenaikan mulai kehilangan tenaga";
      break;
    default:
      if ((f.rsi ?? 50) < 30) stage = "Kapitulasi — jenuh jual, waspada pantulan";
      else if (nearBottom) stage = "Berjalan — mencetak dasar baru";
      else stage = "Berjalan — tren turun belum selesai";
  }

  // Bukti
  const evidence: CycleEvidence[] = [];
  if (f.ma50 !== null) {
    evidence.push({
      label: "Harga vs MA50",
      value: `${sgn(distMa50)}%`,
      supports: distMa50 > 3 ? "MARKUP" : distMa50 < -3 ? "MARKDOWN" : null,
    });
  }
  if (f.ma50 !== null && f.maLong !== null) {
    const up = f.ma50 > f.maLong;
    evidence.push({ label: `MA50 vs ${f.maLongLabel}`, value: up ? "Di atas" : "Di bawah", supports: up ? "MARKUP" : "MARKDOWN" });
  }
  if (f.ma50Slope !== null) {
    evidence.push({
      label: "Kemiringan MA50 (20 hari)",
      value: `${sgn(f.ma50Slope)}%`,
      supports: f.ma50Slope > 3 ? "MARKUP" : f.ma50Slope < -3 ? "MARKDOWN" : null,
    });
  }
  if (f.priorTrend !== null) {
    evidence.push({
      label: "Tren sebelum fase ini",
      value: `${sgn(f.priorTrend)}%`,
      supports: f.priorTrend < -10 ? "AKUMULASI" : f.priorTrend > 15 ? "DISTRIBUSI" : null,
    });
  }
  if (f.cmf !== null) {
    evidence.push({
      label: "Chaikin Money Flow (40H)",
      value: sgn(f.cmf, 2),
      supports: f.cmf > 0.05 ? (f.ret60 ?? 0) > 15 ? "MARKUP" : "AKUMULASI" : f.cmf < -0.05 ? (f.ret60 ?? 0) < -15 ? "MARKDOWN" : "DISTRIBUSI" : null,
    });
  }
  if (f.upDownVolume !== null) {
    evidence.push({
      label: "Volume naik / volume turun (30H)",
      value: `${f.upDownVolume.toFixed(2).replace(".", ",")}x`,
      supports: f.upDownVolume > 1.2 ? "AKUMULASI" : f.upDownVolume < 0.85 ? "DISTRIBUSI" : null,
    });
  }
  if (f.adx !== null) {
    evidence.push({
      label: "ADX (kekuatan tren)",
      value: f.adx.toFixed(1).replace(".", ","),
      supports: f.adx < 20 ? (f.position52w ?? 50) < 50 ? "AKUMULASI" : "DISTRIBUSI" : null,
    });
  }
  if (f.position52w !== null) {
    evidence.push({
      label: "Posisi di rentang 52 minggu",
      value: `${f.position52w.toFixed(0)}%`,
      supports: f.position52w < 30 ? "AKUMULASI" : f.position52w > 75 ? "DISTRIBUSI" : null,
    });
  }
  evidence.push({
    label: "Struktur swing 20H vs 20H sebelumnya",
    value: f.higherHighs && f.higherLows
      ? "Higher high & higher low"
      : f.lowerHighs && f.lowerLows
        ? "Lower high & lower low"
        : f.higherLows
          ? "Higher low"
          : f.lowerHighs
            ? "Lower high"
            : "Datar",
    supports: f.higherHighs && f.higherLows ? "MARKUP" : f.lowerHighs && f.lowerLows ? "MARKDOWN" : f.higherLows ? "AKUMULASI" : f.lowerHighs ? "DISTRIBUSI" : null,
  });

  const nextPhase = NEXT[phase];
  const rh = fmtP(f.rangeHigh);
  const rl = fmtP(f.rangeLow);
  const next = {
    AKUMULASI: {
      trigger: `Breakout di atas ${rh} (puncak rentang 40 hari) dengan volume > 1,5x rata-rata menandai masuk fase Mark Up.`,
      invalidation: `Tutup di bawah ${rl} dengan volume besar — akumulasi gagal, kembali ke Mark Down.`,
    },
    MARKUP: {
      trigger: `Waspadai fase Distribusi bila harga gagal membuat high baru, MA50 mendatar, dan volume jual mulai dominan.`,
      invalidation: `Tren naik rusak bila harga tutup di bawah MA50${f.ma50 ? ` (${fmtP(f.ma50)})` : ""} disertai volume besar.`,
    },
    DISTRIBUSI: {
      trigger: `Breakdown di bawah ${rl} (dasar rentang 40 hari) menandai awal fase Mark Down.`,
      invalidation: `Breakout di atas ${rh} dengan volume besar — distribusi batal, berubah jadi re-akumulasi.`,
    },
    MARKDOWN: {
      trigger: `Penurunan melambat, MA50 mendatar, dan volume beli mulai mendominasi — tanda awal Akumulasi.`,
      invalidation: `Selama masih mencetak lower low di bawah ${rl}, belum ada alasan menganggap dasar sudah terbentuk.`,
    },
  }[phase];

  const label = PHASE_LABEL[phase];
  const summary = `${label} (${stage.split(" — ")[0].toLowerCase()}) dengan keyakinan ${confidence}% — berlangsung sekitar ${daysInPhase} hari bursa. ${PHASE_DESC[phase]}`;

  return {
    available: true,
    phase,
    label,
    stage,
    confidence,
    scores,
    daysInPhase,
    range: { high: f.rangeHigh, low: f.rangeLow, widthPct: f.rangeWidthPct },
    metrics: {
      ma50Slope: f.ma50Slope,
      cmf: f.cmf,
      upDownVolume: f.upDownVolume,
      position52w: f.position52w,
      priorTrend: f.priorTrend,
      adx: f.adx,
    },
    evidence,
    next: { phase: nextPhase, ...next },
    timeline: opts.timeline === false ? [] : points,
    summary,
  };
}

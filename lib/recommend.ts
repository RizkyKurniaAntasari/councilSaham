import { clamp, pctChange } from "./indicators";
import type { CycleReport, DataRecommendation, IndicatorSet, RecAction } from "./types";

/**
 * Rekomendasi berbasis data: menggabungkan fase siklus, momentum, aliran dana,
 * dan likuiditas menjadi satu aksi beserta level entry / stop loss / target.
 */

export const REC_LABEL: Record<RecAction, string> = {
  BELI: "Beli",
  BELI_BERTAHAP: "Beli Bertahap",
  PANTAU: "Pantau",
  AMBIL_UNTUNG: "Ambil Untung / Kurangi",
  HINDARI: "Hindari",
};

function fmtP(v: number): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v);
}

/** Bulatkan ke fraksi harga BEI. */
export function idxTick(price: number): number {
  const tick = price < 200 ? 1 : price < 500 ? 2 : price < 2000 ? 5 : price < 5000 ? 10 : 25;
  return Math.round(price / tick) * tick;
}

export function buildRecommendation(
  cycle: CycleReport,
  ind: IndicatorSet,
  ctx: { price: number; avgValue20: number; supports?: number[]; resistances?: number[] },
): DataRecommendation {
  const { price, avgValue20 } = ctx;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const stage = cycle.stage.toLowerCase();
  const atr = ind.atr14 ?? price * 0.03;
  const rsi = ind.rsi14 ?? 50;
  const cmf = cycle.metrics.cmf ?? 0;
  const vr = ind.volume?.ratio20 ?? 1;

  if (!cycle.available) {
    return {
      action: "PANTAU",
      label: REC_LABEL.PANTAU,
      score: 50,
      horizon: "—",
      entry: null,
      stopLoss: null,
      target1: null,
      target2: null,
      riskReward: null,
      reasons: ["Riwayat harga belum cukup untuk membaca siklus."],
      warnings: [],
    };
  }

  // 1. Basis dari fase siklus
  let score: number;
  switch (cycle.phase) {
    case "AKUMULASI":
      score = stage.startsWith("akhir") ? 70 : stage.startsWith("spring") ? 68 : stage.startsWith("tengah") ? 60 : 54;
      reasons.push(`Fase ${cycle.label} (${cycle.stage}) — area pengumpulan barang, risiko turun relatif terbatas.`);
      break;
    case "MARKUP":
      score = stage.startsWith("lanjut") ? 55 : stage.startsWith("awal") ? 76 : 70;
      reasons.push(`Fase ${cycle.label} (${cycle.stage}) — tren naik sedang berjalan.`);
      break;
    case "DISTRIBUSI":
      score = stage.startsWith("akhir") ? 22 : 34;
      reasons.push(`Fase ${cycle.label} (${cycle.stage}) — pelaku besar cenderung melepas barang.`);
      break;
    default:
      score = stage.startsWith("kapitulasi") ? 30 : 15;
      reasons.push(`Fase ${cycle.label} (${cycle.stage}) — tren turun belum berakhir.`);
  }

  // Keyakinan rendah menarik skor ke tengah
  score = 50 + (score - 50) * (0.55 + (cycle.confidence / 100) * 0.45);

  // 2. Aliran dana
  if (cmf > 0.1) {
    score += 6;
    reasons.push(`Aliran dana masuk kuat (CMF ${cmf.toFixed(2)}).`);
  } else if (cmf > 0.03) {
    score += 3;
  } else if (cmf < -0.1) {
    score -= 6;
    warnings.push(`Aliran dana keluar (CMF ${cmf.toFixed(2)}).`);
  } else if (cmf < -0.03) {
    score -= 3;
  }

  // 3. Momentum
  if (ind.macd && ind.macd.hist > 0 && ind.macd.macd > ind.macd.signal) {
    score += 4;
    reasons.push("MACD di atas garis sinyal — momentum menguat.");
  } else if (ind.macd && ind.macd.hist < 0) {
    score -= 3;
  }
  if (rsi > 75) {
    score -= 8;
    warnings.push(`RSI ${rsi.toFixed(0)} — jenuh beli, rawan koreksi; jangan kejar harga.`);
  } else if (rsi < 30 && cycle.phase !== "MARKDOWN") {
    score += 3;
    reasons.push(`RSI ${rsi.toFixed(0)} — jenuh jual, peluang pantulan.`);
  } else if (rsi >= 50 && rsi <= 68) {
    score += 3;
  }

  // 4. Konfirmasi volume
  const up = (ind.return1d ?? 0) > 0;
  if (vr >= 2 && up) {
    score += 5;
    reasons.push(`Volume ${vr.toFixed(1)}x rata-rata saat harga naik — ada partisipasi besar.`);
  } else if (vr >= 2 && !up) {
    score -= 5;
    warnings.push(`Volume ${vr.toFixed(1)}x rata-rata saat harga turun — tekanan jual besar.`);
  }

  // 5. Tren jangka panjang
  if (ind.ma200 !== null) {
    if (price > ind.ma200) score += 2;
    else score -= 2;
  }

  // 6. Likuiditas
  if (avgValue20 < 1e9) {
    score -= 10;
    warnings.push("Likuiditas tipis (nilai transaksi < Rp1 M/hari) — sulit keluar-masuk, rawan digoreng.");
  } else if (avgValue20 < 5e9) {
    score -= 4;
    warnings.push("Likuiditas terbatas (< Rp5 M/hari) — gunakan ukuran posisi kecil.");
  }
  if (ind.atrPct !== null && ind.atrPct > 6) {
    warnings.push(`Volatilitas tinggi (ATR ${ind.atrPct.toFixed(1)}%) — stop loss lebar, kecilkan posisi.`);
  }

  score = Math.round(clamp(score));

  // Aksi
  let action: RecAction;
  if (score >= 70) action = "BELI";
  else if (score >= 58) action = cycle.phase === "MARKUP" && !stage.startsWith("lanjut") ? "BELI" : "BELI_BERTAHAP";
  else if (score >= 44) action = "PANTAU";
  else if (score >= 30) action = cycle.phase === "MARKDOWN" ? "HINDARI" : "AMBIL_UNTUNG";
  else action = "HINDARI";
  if (action === "BELI" && cycle.phase === "AKUMULASI") action = "BELI_BERTAHAP";

  // Level harga
  const supports = (ctx.supports ?? []).filter((s) => s < price);
  const resistances = (ctx.resistances ?? []).filter((r) => r > price);
  let entry: DataRecommendation["entry"] = null;
  let stopLoss: number | null = null;
  let target1: number | null = null;
  let target2: number | null = null;
  let horizon = "—";

  if (action === "BELI" || action === "BELI_BERTAHAP" || action === "PANTAU") {
    if (cycle.phase === "AKUMULASI") {
      const lo = Math.max(cycle.range.low, price - atr * 1.5);
      entry = { low: idxTick(Math.min(lo, price)), high: idxTick(price) };
      stopLoss = idxTick(Math.min(cycle.range.low - atr * 0.5, price - atr * 1.5));
      const height = cycle.range.high - cycle.range.low;
      target1 = idxTick(Math.max(cycle.range.high, price + atr * 2));
      target2 = idxTick(Math.max(cycle.range.high + height, price + atr * 4));
      horizon = "Menengah (1–3 bulan) — cicil di area bawah rentang, tambah saat breakout";
    } else {
      const pullback = Math.max(ind.ma20 ?? price - atr, price - atr * 1.2);
      entry = { low: idxTick(Math.min(pullback, price - atr * 0.5)), high: idxTick(price) };
      const supportStop = supports[0] ? supports[0] - atr * 0.3 : price - atr * 2;
      stopLoss = idxTick(Math.max(Math.min(supportStop, price - atr * 1.5), price - atr * 3));
      // Resistance yang terlalu dekat bukan target yang layak — ambil yang memberi ruang ≥ 1,5x ATR.
      const farEnough = resistances.filter((r) => r >= price + atr * 1.5);
      target1 = idxTick(farEnough[0] ?? price + atr * 3);
      target2 = idxTick(Math.max(farEnough[1] ?? price + atr * 5, target1 + atr));
      horizon = cycle.phase === "MARKUP" ? "Pendek–menengah (2–6 minggu) — ikuti tren, beli saat pullback" : "Tunggu konfirmasi sebelum masuk";
    }
    if (stopLoss !== null && stopLoss <= 0) stopLoss = null;
  } else {
    horizon = action === "AMBIL_UNTUNG" ? "Kurangi posisi saat pantulan" : "Jauhi sampai muncul tanda akumulasi";
    if (supports[0]) warnings.push(`Support terdekat di ${fmtP(supports[0])} — bila jebol, penurunan bisa berlanjut.`);
  }

  const risk = entry && stopLoss !== null ? entry.high - stopLoss : null;
  const riskReward = risk && risk > 0 && target1 ? (target1 - entry!.high) / risk : null;
  if (riskReward !== null && riskReward < 1.2 && (action === "BELI" || action === "BELI_BERTAHAP")) {
    warnings.push(`Rasio risk/reward hanya ${riskReward.toFixed(1)} — tunggu harga lebih dekat ke area entry bawah.`);
    score = Math.max(0, score - 6);
    if (action === "BELI" && score < 70) action = "BELI_BERTAHAP";
  }
  if (ind.distFrom52wHigh !== null && ind.distFrom52wHigh > -3 && cycle.phase === "MARKUP") {
    reasons.push("Harga di dekat puncak 52 minggu — kekuatan relatif tinggi.");
  }
  if (target1 && entry) {
    const up = pctChange(entry.high, target1);
    if (up > 0) reasons.push(`Potensi ke target pertama ${up.toFixed(1).replace(".", ",")}%.`);
  }

  return {
    action,
    label: REC_LABEL[action],
    score,
    horizon,
    entry,
    stopLoss,
    target1,
    target2,
    riskReward,
    reasons: reasons.slice(0, 5),
    warnings: warnings.slice(0, 4),
  };
}

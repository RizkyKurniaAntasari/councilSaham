import { IDX_TICKERS, type IdxTicker } from "../data/idx-tickers";
import { cached } from "./cache";
import { buildCycle } from "./cycle";
import { clamp, pivotLevels } from "./indicators";
import { buildRecommendation } from "./recommend";
import { buildTradePlan } from "./tradeplan";
import { buildIndicators } from "./technical";
import type { Candle, ScreenerResult, ScreenerRow } from "./types";
import { fetchChart, toYahooSymbol } from "./yahoo";

/**
 * Pemindai pasar: menarik OHLCV 1 tahun untuk seluruh daftar emiten,
 * lalu menghitung skor trending, fase siklus, skor akumulasi, dan rekomendasi.
 */

const CONCURRENCY = 8;

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function trending(candles: Candle[], ind: ReturnType<typeof buildIndicators>) {
  const vols = candles.map((c) => c.v);
  const v5 = avg(vols.slice(-5));
  const v60 = avg(vols.slice(-60));
  const surge = v60 > 0 ? v5 / v60 : 1;
  const vr = ind.volume?.ratio20 ?? 1;
  const value5 = avg(candles.slice(-5).map((c) => c.c * c.v));
  const ret5 = ind.return5d ?? 0;
  const ret1 = ind.return1d ?? 0;
  const price = candles[candles.length - 1].c;
  const hi20 = Math.max(...candles.slice(-21, -1).map((c) => c.h));

  const reasons: string[] = [];
  let score = 0;
  score += clamp((surge - 1) / 2, 0, 1) * 30;
  score += clamp((vr - 1) / 3, 0, 1) * 15;
  score += clamp((Math.log10(Math.max(value5, 1)) - 9) / 3, 0, 1) * 20;
  score += clamp(Math.abs(ret5) / 15, 0, 1) * 20;
  score += clamp(Math.abs(ret1) / 7, 0, 1) * 8;
  if (price > hi20) score += 7;

  if (surge >= 1.8) reasons.push(`Volume 5 hari ${surge.toFixed(1)}x rata-rata 3 bulan`);
  if (vr >= 2) reasons.push(`Volume hari ini ${vr.toFixed(1)}x rata-rata`);
  if (Math.abs(ret5) >= 8) reasons.push(`${ret5 > 0 ? "Naik" : "Turun"} ${Math.abs(ret5).toFixed(1)}% dalam 5 hari`);
  if (price > hi20) reasons.push("Breakout ke level tertinggi 20 hari");
  if (value5 >= 1e11) reasons.push("Nilai transaksi besar (≥ Rp100 M/hari)");

  return { score: Math.round(clamp(score)), reasons, surge };
}

/**
 * Trending naik: hanya saham dengan momentum positif. Arah harga dinilai,
 * bukan sekadar besarnya gerakan — saham yang ramai karena dijual tidak ikut.
 */
function trendingUp(candles: Candle[], ind: ReturnType<typeof buildIndicators>, surge: number) {
  const ret1 = ind.return1d ?? 0;
  const ret5 = ind.return5d ?? 0;
  const ret20 = ind.return20d ?? 0;
  if (ret1 <= 0 && ret5 <= 0) return { score: 0, reasons: [] as string[] };

  const n = candles.length;
  const lastBar = candles[n - 1];
  const price = lastBar.c;
  const hi20 = Math.max(...candles.slice(-21, -1).map((c) => c.h));
  const value5 = avg(candles.slice(-5).map((c) => c.c * c.v));
  const span = lastBar.h - lastBar.l;
  const closeStrength = span > 0 ? (lastBar.c - lastBar.l) / span : 0.5;
  const vr = ind.volume?.ratio20 ?? 1;

  // Volume dihitung hanya bila hari-hari naik yang mendominasi (bukan volume jual).
  let upVol = 0;
  let downVol = 0;
  for (let i = Math.max(1, n - 5); i < n; i++) {
    if (candles[i].c > candles[i - 1].c) upVol += candles[i].v;
    else if (candles[i].c < candles[i - 1].c) downVol += candles[i].v;
  }
  const buyDominant = upVol >= downVol;

  const reasons: string[] = [];
  let score = 0;
  score += clamp(ret5 / 15, 0, 1) * 25;
  score += clamp(ret1 / 7, 0, 1) * 12;
  score += clamp(ret20 / 30, 0, 1) * 8;
  if (buyDominant) {
    score += clamp((surge - 1) / 2, 0, 1) * 20;
    score += ret1 > 0 ? clamp((vr - 1) / 3, 0, 1) * 10 : 0;
  }
  score += clamp((Math.log10(Math.max(value5, 1)) - 9) / 3, 0, 1) * 10;
  if (price > hi20) score += 8;
  if (closeStrength >= 0.7 && ret1 > 0) score += 4;
  if (ind.ma20 !== null && price > ind.ma20) score += 3;
  // Terlalu jenuh beli: tetap trending, tapi diturunkan sedikit agar tidak mengejar pucuk.
  if ((ind.rsi14 ?? 50) > 80) score -= 6;

  if (ret5 >= 5) reasons.push(`Naik ${ret5.toFixed(1)}% dalam 5 hari`);
  else if (ret1 >= 3) reasons.push(`Naik ${ret1.toFixed(1)}% hari ini`);
  if (buyDominant && surge >= 1.5) reasons.push(`Volume beli 5 hari ${surge.toFixed(1)}x rata-rata 3 bulan`);
  if (buyDominant && ret1 > 0 && vr >= 2) reasons.push(`Volume hari ini ${vr.toFixed(1)}x rata-rata`);
  if (price > hi20) reasons.push("Breakout ke level tertinggi 20 hari");
  if (closeStrength >= 0.7 && ret1 > 0) reasons.push("Tutup dekat harga tertinggi hari ini");
  if ((ind.rsi14 ?? 50) > 80) reasons.push(`RSI ${(ind.rsi14 ?? 0).toFixed(0)} — sudah sangat jenuh beli`);

  return { score: Math.round(clamp(score)), reasons };
}

async function scanOne(info: IdxTicker): Promise<ScreenerRow | null> {
  const { candles } = await fetchChart(toYahooSymbol(info.code), "1y", "1d");
  if (candles.length < 60) return null;

  const ind = buildIndicators(candles);
  const n = candles.length;
  const price = candles[n - 1].c;
  const prev = candles[n - 2]?.c ?? price;
  const avgValue20 = avg(candles.slice(-20).map((c) => c.c * c.v));

  const cycle = buildCycle(candles, { timeline: false });
  const { supports, resistances } = pivotLevels(candles);
  const plan = buildTradePlan(ind, { price, supports, resistances, cycle });
  const rec = buildRecommendation(cycle, ind, { price, avgValue20, plan });
  const tr = trending(candles, ind);
  const trUp = trendingUp(candles, ind, tr.surge);

  const cmf = cycle.metrics.cmf ?? 0;
  const udv = cycle.metrics.upDownVolume ?? 1;
  const accumulationScore = Math.round(
    clamp(cycle.scores.AKUMULASI * 0.6 + clamp(cmf / 0.2, 0, 1) * 25 + clamp(udv - 1, 0, 1) * 15),
  );

  return {
    ticker: info.code,
    name: info.name,
    sector: info.sector,
    price,
    change1d: prev ? ((price - prev) / prev) * 100 : 0,
    return5d: ind.return5d,
    return20d: ind.return20d,
    return60d: ind.return60d,
    volRatio: ind.volume?.ratio20 ?? 1,
    volSurge5d: tr.surge,
    avgValue20,
    valueToday: price * candles[n - 1].v,
    rsi: ind.rsi14,
    trendingScore: tr.score,
    trendingReasons: tr.reasons,
    upTrendingScore: trUp.score,
    upTrendingReasons: trUp.reasons,
    accumulationScore,
    cycle: {
      phase: cycle.phase,
      label: cycle.label,
      stage: cycle.stage,
      confidence: cycle.confidence,
      scores: cycle.scores,
      daysInPhase: cycle.daysInPhase,
      range: cycle.range,
      summary: cycle.summary,
    },
    rec: (({ plan: _plan, ...rest }) => rest)(rec),
    spark: candles.slice(-60).map((c) => c.c),
  };
}

export async function runScreener(universe: IdxTicker[] = IDX_TICKERS): Promise<ScreenerResult> {
  return cached(`screener:v4:${universe.length}`, 10 * 60 * 1000, async () => {
    const rows: ScreenerRow[] = [];
    const failed: string[] = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < universe.length) {
        const info = universe[cursor++];
        try {
          const row = await scanOne(info);
          if (row) rows.push(row);
          else failed.push(info.code);
        } catch {
          failed.push(info.code);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (!rows.length) throw new Error("Sumber data harga tidak dapat dijangkau saat ini.");

    rows.sort((a, b) => b.trendingScore - a.trendingScore);
    return {
      generatedAt: Date.now(),
      universe: universe.length,
      scanned: rows.length,
      failed: failed.sort(),
      rows,
    };
  });
}

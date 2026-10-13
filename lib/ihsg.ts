import { cached } from "./cache";
import { buildCycle } from "./cycle";
import { pctChange } from "./indicators";
import { buildTechnical } from "./technical";
import type { Candle, IhsgReport, IndicatorSet, RelativeStrength } from "./types";
import { fetchChart } from "./yahoo";

export const IHSG_SYMBOL = "^JKSE";

/** Kata kunci pencarian yang diarahkan ke halaman IHSG. */
export const IHSG_ALIASES = ["IHSG", "JKSE", "JCI", "COMPOSITE", "KOMPOSIT", "INDEKS"];

export function isIhsgQuery(q: string): boolean {
  const n = q.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return n.length >= 3 && IHSG_ALIASES.some((a) => a.startsWith(n) || n.startsWith(a));
}

function ytdReturn(candles: Candle[]): number | null {
  const last = candles[candles.length - 1];
  const year = new Date(last.t).getFullYear();
  // Penutupan terakhir tahun lalu sebagai basis YTD.
  for (let i = candles.length - 1; i >= 0; i--) {
    if (new Date(candles[i].t).getFullYear() < year) return pctChange(candles[i].c, last.c);
  }
  return null;
}

/**
 * Laporan IHSG: harga, return multi-periode, tren & skor teknikal, serta fase siklus —
 * memakai mesin yang sama dengan analisis saham agar bisa dibandingkan apel-ke-apel.
 */
export async function getIhsg(opts: { withCandles?: boolean } = {}): Promise<IhsgReport> {
  const report = await cached("ihsg:report:v1", 3 * 60 * 1000, async () => {
    const { candles } = await fetchChart(IHSG_SYMBOL, "2y", "1d");
    if (candles.length < 60) throw new Error("Data IHSG tidak cukup.");
    const technical = buildTechnical(candles);
    const ind = technical.indicators;
    const n = candles.length;
    const last = candles[n - 1];
    const prev = candles[n - 2] ?? last;
    const win = candles.slice(-250);
    const r: IhsgReport = {
      symbol: IHSG_SYMBOL,
      price: last.c,
      change: last.c - prev.c,
      changePct: pctChange(prev.c, last.c),
      updatedAt: last.t,
      returns: {
        d1: ind.return1d,
        d5: ind.return5d,
        d20: ind.return20d,
        d60: ind.return60d,
        ytd: ytdReturn(candles),
        y1: ind.return250d,
      },
      high52w: Math.max(...win.map((c) => c.h)),
      low52w: Math.min(...win.map((c) => c.l)),
      ma20: ind.ma20,
      ma50: ind.ma50,
      ma200: ind.ma200,
      rsi: ind.rsi14,
      trend: technical.trend,
      trendStrength: technical.trendStrength,
      techScore: technical.score,
      techBreakdown: technical.breakdown,
      supports: technical.supports,
      resistances: technical.resistances,
      cycle: buildCycle(candles),
      spark: candles.slice(-60).map((c) => c.c),
      candles,
    };
    return r;
  });
  if (opts.withCandles) return report;
  const { candles: _omit, ...rest } = report;
  return rest;
}

/** Selisih return saham vs IHSG (poin persen) untuk 20, 60, dan 250 hari bursa. */
export function relativeStrength(ind: IndicatorSet, ihsg: IhsgReport): RelativeStrength {
  const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? a - b : null);
  return {
    ihsgPrice: ihsg.price,
    ihsgChangePct: ihsg.changePct,
    stock20: ind.return20d,
    ihsg20: ihsg.returns.d20,
    rs20: diff(ind.return20d, ihsg.returns.d20),
    stock60: ind.return60d,
    ihsg60: ihsg.returns.d60,
    rs60: diff(ind.return60d, ihsg.returns.d60),
    stock250: ind.return250d,
    ihsg250: ihsg.returns.y1,
    rs250: diff(ind.return250d, ihsg.returns.y1),
  };
}

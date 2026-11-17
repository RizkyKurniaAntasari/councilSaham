import { cached } from "./cache";
import { buildCycle } from "./cycle";
import { buildEntrySignal } from "./entrysignal";
import { pctChange } from "./indicators";
import { buildRecommendation } from "./recommend";
import { buildTechnical } from "./technical";
import { buildTradePlan, withQuoteFormat, type QuoteFormat } from "./tradeplan";
import type { Candle, GoldMacro, GoldReport, ScoreItem } from "./types";
import { fetchChart } from "./yahoo";

/**
 * Analisis & rekomendasi emas dunia (XAU/USD).
 *
 * Memakai mesin yang sama dengan saham — teknikal, fase siklus, rencana
 * transaksi, timing, dan skor rekomendasi — supaya cara membacanya seragam.
 * Yang berbeda: harga dalam USD per troy ounce, tidak ada penalti likuiditas
 * bursa, dan ada dua faktor makro khas emas (dolar AS & imbal hasil obligasi AS).
 *
 * Sumber harga: kontrak berjangka emas COMEX terdekat (`GC=F`) — Yahoo tidak
 * menyediakan XAU/USD spot. Selisihnya terhadap spot umumnya di bawah 1%.
 */

export const GOLD_SYMBOL = "GC=F";
export const TROY_OUNCE_GRAM = 31.1034768;

/** Kata kunci pencarian yang diarahkan ke halaman emas. */
export const GOLD_ALIASES = ["EMAS", "GOLD", "XAU", "XAUUSD", "LOGAMMULIA"];

export function isGoldQuery(q: string): boolean {
  const n = q.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return n.length >= 3 && GOLD_ALIASES.some((a) => a.startsWith(n) || n.startsWith(a));
}

/** Di bawah $100 (mis. ATR atau kelipatan harga) tampilkan sen, kecuali angkanya bulat. */
const usd = (v: number) => {
  const digits = Math.abs(v) < 100 && !Number.isInteger(v) ? 2 : 0;
  return `$${new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v)}`;
};

/** USD per troy ounce, dibulatkan ke $1 (atau $0,10 di bawah $1.000). */
export const USD_OZ_FORMAT: QuoteFormat = {
  money: usd,
  tick: (price) => (price >= 1000 ? 1 : 0.1),
  tickLabel: "kelipatan $1",
};

const id = (v: number, d = 1) => v.toFixed(d).replace(".", ",").replace("-", "−");
const signed = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${id(Math.abs(v), d)}`;

function ytdReturn(candles: Candle[]): number | null {
  const lastBar = candles[candles.length - 1];
  const year = new Date(lastBar.t).getFullYear();
  for (let i = candles.length - 1; i >= 0; i--) {
    if (new Date(candles[i].t).getFullYear() < year) return pctChange(candles[i].c, lastBar.c);
  }
  return null;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Nilai terakhir, nilai sehari sebelumnya, dan nilai ±20 bar sebelumnya dari seri harian.
 *
 * Candle harian valas/indeks Yahoo sesekali berisi satu bar cacat (melompat
 * beberapa persen lalu kembali). Karena itu: nilai kemarin diambil dari
 * perubahan resmi di metadata, dan nilai 20 hari lalu memakai median 5 bar di
 * sekitar titik itu — satu bar cacat tidak lagi merusak hasil.
 */
async function series20(symbol: string): Promise<{ value: number; prev: number | null; before: number | null } | null> {
  try {
    const { candles, meta } = await fetchChart(symbol, "6mo", "1d");
    const n = candles.length;
    if (!n) return null;
    const value = candles[n - 1].c;
    const metaPct = meta.regularMarketChangePercent;
    const prev =
      typeof metaPct === "number" && Number.isFinite(metaPct) && Math.abs(metaPct) < 25
        ? value / (1 + metaPct / 100)
        : n > 1
          ? candles[n - 2].c
          : null;
    const before = n > 23 ? median(candles.slice(n - 23, n - 18).map((c) => c.c)) : null;
    return { value, prev, before };
  } catch {
    return null;
  }
}

/**
 * Faktor makro emas. Hubungannya adalah kecenderungan historis, bukan hukum:
 * emas dihargai dalam dolar (dolar melemah → emas cenderung naik) dan tidak
 * memberi bunga (imbal hasil turun → emas lebih menarik). Bobotnya sengaja kecil.
 */
function macroItems(m: GoldMacro): ScoreItem[] {
  const out: ScoreItem[] = [];
  if (m.dxy && m.dxy.ret20 !== null) {
    const r = m.dxy.ret20;
    const p = r <= -1.5 ? 3 : r >= 1.5 ? -3 : 0;
    if (p !== 0) {
      out.push({
        label: "Dolar AS (DXY 20H)",
        points: p,
        detail: `${p > 0 ? "Dolar melemah — biasanya mendorong emas" : "Dolar menguat — biasanya menekan emas"}: indeks dolar ${id(m.dxy.value, 2)}, ${signed(r)}% dalam 20 hari. Aturan: ≤ −1,5% = +3, ≥ +1,5% = −3.`,
      });
    }
  }
  if (m.us10y && m.us10y.chg20 !== null) {
    const c = m.us10y.chg20;
    const p = c <= -0.15 ? 2 : c >= 0.15 ? -2 : 0;
    if (p !== 0) {
      out.push({
        label: "Imbal hasil obligasi AS 10 tahun (20H)",
        points: p,
        detail: `${p > 0 ? "Imbal hasil turun — emas (tanpa bunga) jadi lebih menarik" : "Imbal hasil naik — emas (tanpa bunga) jadi kurang menarik"}: ${id(m.us10y.value, 2)}%, ${signed(c, 2)} poin dalam 20 hari. Aturan: ≤ −0,15 = +2, ≥ +0,15 = −2.`,
      });
    }
  }
  return out;
}

export async function getGold(opts: { withCandles?: boolean } = {}): Promise<GoldReport> {
  const report = await cached("gold:report:v3", 3 * 60 * 1000, async () => {
    const [{ candles, meta }, fx, dxy, tnx] = await Promise.all([
      fetchChart(GOLD_SYMBOL, "2y", "1d"),
      series20("USDIDR=X"),
      series20("DX-Y.NYB"),
      series20("^TNX"),
    ]);
    if (candles.length < 60) throw new Error("Data emas tidak cukup.");

    const n = candles.length;
    const lastBar = candles[n - 1];
    const price = lastBar.c;
    const metaPct = meta.regularMarketChangePercent;
    const changePct =
      typeof metaPct === "number" && Number.isFinite(metaPct) && Math.abs(metaPct) < 25
        ? metaPct
        : pctChange(candles[n - 2].c, price);
    const prevClose = price / (1 + changePct / 100);

    const macro: GoldMacro = {
      dxy: dxy ? { value: dxy.value, ret20: dxy.before !== null ? pctChange(dxy.before, dxy.value) : null } : null,
      us10y: tnx ? { value: tnx.value, chg20: tnx.before !== null ? tnx.value - tnx.before : null } : null,
      usdIdr: fx ? { value: fx.value, ret20: fx.before !== null ? pctChange(fx.before, fx.value) : null } : null,
    };

    const technical = buildTechnical(candles);
    const ind = technical.indicators;
    const cycle = buildCycle(candles);

    // Semua teks & pembulatan di blok ini memakai USD per troy ounce. Blok ini
    // sinkron sepenuhnya (syarat `withQuoteFormat`).
    const { rec, entry } = withQuoteFormat(USD_OZ_FORMAT, () => {
      const plan = buildTradePlan(ind, {
        price,
        supports: technical.supports,
        resistances: technical.resistances,
        cycle,
        swingLow10: Math.min(...candles.slice(-10).map((c) => c.l)),
      });
      const entrySignal = buildEntrySignal(candles, ind, {
        supports: technical.supports,
        resistances: technical.resistances,
        plan,
        cycle,
      });
      const recommendation = buildRecommendation(cycle, ind, {
        price,
        avgValue20: Number.POSITIVE_INFINITY,
        plan,
        rs60: null,
        entry: entrySignal,
        extra: macroItems(macro),
        skipLiquidity: true,
        noun: "emas",
      });
      return { rec: recommendation, entry: entrySignal };
    });

    const perGram = (oz: number, rate: number) => (oz * rate) / TROY_OUNCE_GRAM;
    let idr: GoldReport["idr"] = null;
    if (fx) {
      const now = perGram(price, fx.value);
      const yesterday = fx.prev !== null ? perGram(prevClose, fx.prev) : null;
      const before = fx.before !== null && n > 20 ? perGram(candles[n - 21].c, fx.before) : null;
      idr = {
        perGram: now,
        changePct: yesterday ? pctChange(yesterday, now) : changePct,
        ret20: before ? pctChange(before, now) : null,
        usdIdr: fx.value,
      };
    }

    const win = candles.slice(-250);
    const r: GoldReport = {
      symbol: GOLD_SYMBOL,
      price,
      change: price - prevClose,
      changePct,
      updatedAt: lastBar.t,
      returns: {
        d1: changePct,
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
      atrPct: ind.atrPct,
      trend: technical.trend,
      trendStrength: technical.trendStrength,
      techScore: technical.score,
      techBreakdown: technical.breakdown,
      supports: technical.supports,
      resistances: technical.resistances,
      cycle,
      rec,
      timing: {
        verdict: entry.verdict,
        label: entry.label,
        score: entry.score,
        situation: entry.situation,
        waitFor: entry.waitFor,
        reasons: entry.reasons,
      },
      macro,
      idr,
      spark: candles.slice(-60).map((c) => c.c),
      candles,
    };
    return r;
  });
  if (opts.withCandles) return report;
  const { candles: _omit, ...rest } = report;
  return rest;
}

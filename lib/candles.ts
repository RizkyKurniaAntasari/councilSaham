import type { Candle, CandlePattern } from "./types";

/**
 * Deteksi pola candlestick dengan syarat konteks.
 *
 * Pola pembalikan bullish hanya dihitung bila muncul setelah penurunan atau saat harga
 * menguji penopang (MA20/MA50/support). Hammer di tengah tren naik bukan sinyal beli.
 * Sebaliknya pola bearish hanya dihitung setelah kenaikan atau saat menguji penghalang.
 */

interface Ctx {
  ma20: (number | null)[];
  ma50: (number | null)[];
  supports: number[];
  resistances: number[];
  avgVol20: (number | null)[];
  avgBody14: number[];
}

const body = (c: Candle) => Math.abs(c.c - c.o);
const range = (c: Candle) => Math.max(c.h - c.l, 1e-9);
const upper = (c: Candle) => c.h - Math.max(c.o, c.c);
const lower = (c: Candle) => Math.min(c.o, c.c) - c.l;
const bull = (c: Candle) => c.c > c.o;
const bear = (c: Candle) => c.c < c.o;
const mid = (c: Candle) => (c.o + c.c) / 2;

function fmt(v: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v)}`;
}

/** Turun sebelum bar i: penutupan bar i−1 di bawah penutupan 5 bar sebelumnya. */
function declineBefore(cs: Candle[], i: number, bars = 5): boolean {
  if (i - 1 - bars < 0) return false;
  return cs[i - 1].c < cs[i - 1 - bars].c * 0.985;
}

function riseBefore(cs: Candle[], i: number, bars = 5): boolean {
  if (i - 1 - bars < 0) return false;
  return cs[i - 1].c > cs[i - 1 - bars].c * 1.015;
}

/** Lokasi penopang yang diuji oleh low bar (dalam 1,5%). */
function supportTouched(cs: Candle[], i: number, ctx: Ctx, span = 1): string | null {
  const lo = Math.min(...cs.slice(Math.max(0, i - span + 1), i + 1).map((c) => c.l));
  const near = (lvl: number | null | undefined) => lvl != null && lo <= lvl * 1.015 && lo >= lvl * 0.97;
  if (near(ctx.ma20[i])) return `MA20 ${fmt(ctx.ma20[i] as number)}`;
  if (near(ctx.ma50[i])) return `MA50 ${fmt(ctx.ma50[i] as number)}`;
  const s = ctx.supports.find((x) => near(x));
  if (s !== undefined) return `support ${fmt(s)}`;
  return null;
}

function resistanceTouched(cs: Candle[], i: number, ctx: Ctx, span = 1): string | null {
  const hi = Math.max(...cs.slice(Math.max(0, i - span + 1), i + 1).map((c) => c.h));
  const near = (lvl: number | null | undefined) => lvl != null && hi >= lvl * 0.985 && hi <= lvl * 1.03;
  if (near(ctx.ma50[i])) return `MA50 ${fmt(ctx.ma50[i] as number)}`;
  if (near(ctx.ma20[i])) return `MA20 ${fmt(ctx.ma20[i] as number)}`;
  const r = ctx.resistances.find((x) => near(x));
  if (r !== undefined) return `resistance ${fmt(r)}`;
  return null;
}

type Raw = Omit<
  CandlePattern,
  "t" | "index" | "barsAgo" | "volumeConfirmed" | "followThrough" | "strength" | "context" | "high" | "low"
>;

function detectAt(cs: Candle[], i: number, ctx: Ctx): (Raw & { context: string | null })[] {
  const out: (Raw & { context: string | null })[] = [];
  const c = cs[i];
  const p = cs[i - 1];
  const pp = cs[i - 2];
  const ab = ctx.avgBody14[i] || range(c) * 0.5;
  const longBody = (x: Candle) => body(x) >= ab * 0.9;
  const smallBody = (x: Candle) => body(x) <= ab * 0.4;

  const down = declineBefore(cs, i);
  const up = riseBefore(cs, i);
  const sup1 = supportTouched(cs, i, ctx, 1);
  const res1 = resistanceTouched(cs, i, ctx, 1);
  const bullCtx = down || sup1 !== null;
  const bearCtx = up || res1 !== null;
  const bullWhy = [down ? "setelah penurunan 5 hari" : null, sup1 ? `menguji ${sup1}` : null].filter(Boolean).join(", ");
  const bearWhy = [up ? "setelah kenaikan 5 hari" : null, res1 ? `menguji ${res1}` : null].filter(Boolean).join(", ");

  /* ---------- pola satu candle ---------- */
  const b = body(c);
  const r = range(c);
  if (bullCtx && lower(c) >= Math.max(b, r * 0.05) * 2 && upper(c) <= Math.max(b * 0.6, r * 0.12) && b >= r * 0.05) {
    out.push({
      key: "hammer",
      name: "Hammer",
      bullish: true,
      bars: 1,
      reliability: 2,
      meaning: "Penjual sempat menekan jauh ke bawah, tetapi pembeli menarik harga kembali ke dekat pembukaan — tanda perlawanan pembeli.",
      context: bullWhy,
    });
  } else if (bullCtx && b <= r * 0.1 && lower(c) >= r * 0.6 && upper(c) <= r * 0.15) {
    out.push({
      key: "dragonfly",
      name: "Dragonfly Doji",
      bullish: true,
      bars: 1,
      reliability: 2,
      meaning: "Harga ditekan dalam lalu ditutup kembali di level pembukaan — tekanan jual mulai habis.",
      context: bullWhy,
    });
  } else if (down && upper(c) >= Math.max(b, r * 0.05) * 2 && lower(c) <= Math.max(b * 0.6, r * 0.12) && b >= r * 0.05) {
    out.push({
      key: "inverted_hammer",
      name: "Inverted Hammer",
      bullish: true,
      bars: 1,
      reliability: 1,
      meaning: "Pembeli mencoba mendorong naik setelah penurunan; lemah sendirian — butuh candle hijau berikutnya sebagai konfirmasi.",
      context: bullWhy,
    });
  }
  if (up && upper(c) >= Math.max(b, r * 0.05) * 2 && lower(c) <= Math.max(b * 0.6, r * 0.12) && b >= r * 0.05) {
    out.push({
      key: "shooting_star",
      name: "Shooting Star",
      bullish: false,
      bars: 1,
      reliability: 2,
      meaning: "Pembeli mendorong tinggi tetapi harga dijual kembali ke dekat pembukaan — tekanan jual di area atas.",
      context: bearWhy,
    });
  }

  /* ---------- pola dua candle ---------- */
  if (p) {
    if (bullCtx && bear(p) && bull(c) && c.o <= p.c * 1.002 && c.c >= p.o && b > body(p)) {
      out.push({
        key: "bullish_engulfing",
        name: "Bullish Engulfing",
        bullish: true,
        bars: 2,
        reliability: 3,
        meaning: "Candle hijau menelan seluruh badan candle merah sebelumnya — pembeli mengambil alih kendali.",
        context: bullWhy,
      });
    } else if (bullCtx && bear(p) && longBody(p) && bull(c) && c.o < p.l * 1.002 && c.c > mid(p) && c.c < p.o) {
      out.push({
        key: "piercing",
        name: "Piercing Line",
        bullish: true,
        bars: 2,
        reliability: 2,
        meaning: "Dibuka di bawah low kemarin namun ditutup di atas separuh badan merah kemarin — pembeli menembus balik.",
        context: bullWhy,
      });
    } else if (bullCtx && bear(p) && longBody(p) && bull(c) && smallBody(c) && c.o >= p.c && c.c <= p.o) {
      out.push({
        key: "bullish_harami",
        name: "Bullish Harami",
        bullish: true,
        bars: 2,
        reliability: 1,
        meaning: "Candle hijau kecil di dalam badan merah besar — momentum turun melambat, butuh konfirmasi.",
        context: bullWhy,
      });
    }
    if (bearCtx && bull(p) && bear(c) && c.o >= p.c * 0.998 && c.c <= p.o && b > body(p)) {
      out.push({
        key: "bearish_engulfing",
        name: "Bearish Engulfing",
        bullish: false,
        bars: 2,
        reliability: 3,
        meaning: "Candle merah menelan candle hijau sebelumnya — penjual mengambil alih di area atas.",
        context: bearWhy,
      });
    } else if (bearCtx && bull(p) && longBody(p) && bear(c) && c.o > p.h * 0.998 && c.c < mid(p) && c.c > p.o) {
      out.push({
        key: "dark_cloud",
        name: "Dark Cloud Cover",
        bullish: false,
        bars: 2,
        reliability: 2,
        meaning: "Dibuka di atas high kemarin lalu ditutup di bawah separuh badan hijau kemarin — penjual masuk.",
        context: bearWhy,
      });
    }
  }

  /* ---------- pola tiga candle ---------- */
  if (p && pp) {
    const down3 = declineBefore(cs, i - 2) || supportTouched(cs, i, ctx, 3) !== null;
    const up3 = riseBefore(cs, i - 2) || resistanceTouched(cs, i, ctx, 3) !== null;
    if (down3 && bear(pp) && longBody(pp) && smallBody(p) && Math.max(p.o, p.c) <= pp.c * 1.01 && bull(c) && c.c > mid(pp)) {
      const sup3 = supportTouched(cs, i, ctx, 3);
      out.push({
        key: "morning_star",
        name: "Morning Star",
        bullish: true,
        bars: 3,
        reliability: 3,
        meaning: "Merah panjang → candle kecil ragu-ragu → hijau kuat menutup di atas separuh merah pertama — pembalikan naik klasik.",
        context: [declineBefore(cs, i - 2) ? "setelah penurunan" : null, sup3 ? `menguji ${sup3}` : null].filter(Boolean).join(", "),
      });
    }
    if (up3 && bull(pp) && longBody(pp) && smallBody(p) && Math.min(p.o, p.c) >= pp.c * 0.99 && bear(c) && c.c < mid(pp)) {
      out.push({
        key: "evening_star",
        name: "Evening Star",
        bullish: false,
        bars: 3,
        reliability: 3,
        meaning: "Hijau panjang → candle kecil → merah kuat menutup di bawah separuh hijau pertama — pembalikan turun klasik.",
        context: "setelah kenaikan",
      });
    }
    const soldier = (x: Candle, prev: Candle) =>
      bull(x) && x.c > prev.c && x.o >= Math.min(prev.o, prev.c) && x.o <= Math.max(prev.o, prev.c) * 1.005 && upper(x) <= body(x) * 0.5 && body(x) >= ab * 0.6;
    if (bull(pp) && body(pp) >= ab * 0.6 && soldier(p, pp) && soldier(c, p) && (declineBefore(cs, i - 2, 8) || supportTouched(cs, i, ctx, 3) !== null)) {
      out.push({
        key: "three_white_soldiers",
        name: "Three White Soldiers",
        bullish: true,
        bars: 3,
        reliability: 3,
        meaning: "Tiga candle hijau berturut-turut dengan penutupan makin tinggi — pembeli konsisten mengakumulasi.",
        context: "setelah fase turun/konsolidasi",
      });
    }
  }
  return out;
}

export function detectPatterns(
  cs: Candle[],
  opts: { ma20: (number | null)[]; ma50: (number | null)[]; supports: number[]; resistances: number[]; lookback?: number },
): CandlePattern[] {
  const n = cs.length;
  if (n < 12) return [];
  const avgVol20: (number | null)[] = cs.map((_, i) => {
    if (i < 20) return null;
    let s = 0;
    for (let k = i - 20; k < i; k++) s += cs[k].v;
    return s / 20;
  });
  const avgBody14 = cs.map((_, i) => {
    const w = cs.slice(Math.max(0, i - 14), i);
    return w.length ? w.reduce((a, c) => a + body(c), 0) / w.length : body(cs[i]);
  });
  const ctx: Ctx = { ...opts, avgVol20, avgBody14 };

  const out: CandlePattern[] = [];
  const start = Math.max(8, n - (opts.lookback ?? 120));
  for (let i = start; i < n; i++) {
    for (const raw of detectAt(cs, i, ctx)) {
      const av = avgVol20[i];
      const volumeConfirmed = av !== null && av > 0 && cs[i].v >= av * 1.2;
      // Konfirmasi candle berikutnya: tutup di atas high pola (bullish) / di bawah low pola (bearish).
      const patHigh = Math.max(...cs.slice(i - raw.bars + 1, i + 1).map((x) => x.h));
      const patLow = Math.min(...cs.slice(i - raw.bars + 1, i + 1).map((x) => x.l));
      // null = konfirmasi masih ditunggu (jatahnya 2 candle setelah pola).
      let followThrough: boolean | null = null;
      if (i + 1 < n) {
        const nxt = cs.slice(i + 1, Math.min(n, i + 3));
        const hit = raw.bullish ? nxt.some((x) => x.c > patHigh) : nxt.some((x) => x.c < patLow);
        followThrough = hit ? true : nxt.length >= 2 ? false : null;
      }
      const strength = raw.reliability + (volumeConfirmed ? 1 : 0) + (followThrough ? 1 : 0) - (followThrough === false ? 1 : 0);
      out.push({
        ...raw,
        context: raw.context || (raw.bullish ? "di area penopang" : "di area penghalang"),
        t: cs[i].t,
        index: i,
        barsAgo: n - 1 - i,
        volumeConfirmed,
        followThrough,
        strength: Math.max(0, Math.min(5, strength)),
        high: patHigh,
        low: patLow,
      });
    }
  }
  return out;
}

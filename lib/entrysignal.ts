import { detectPatterns } from "./candles";
import { clamp, sma } from "./indicators";
import { roundTick } from "./tradeplan";
import type {
  Candle,
  CandlePattern,
  CycleReport,
  EntryCheck,
  EntryScenario,
  EntrySignal,
  EntryVerdict,
  IndicatorSet,
  MaLevel,
  ScoreItem,
  TradePlan,
} from "./types";

/**
 * Timing entry: saham boleh bagus, tapi kapan belinya?
 *
 * Membaca (1) struktur harga terhadap MA20/50/200 — termasuk penembusan & penolakan,
 * (2) pola candlestick pembalikan di lokasi yang tepat, dan (3) tanda perlawanan pembeli.
 * Hasilnya vonis Siap Beli / Tunggu Konfirmasi / Belum Ada Setup / Hindari, lengkap
 * dengan syarat konkret berikut harganya.
 */

export const ENTRY_LABEL: Record<EntryVerdict, string> = {
  SIAP: "Siap Beli",
  TUNGGU: "Tunggu Konfirmasi",
  BELUM: "Belum Ada Setup",
  HINDARI: "Hindari Dulu",
};

const rp = (v: number) => `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v)}`;
const pc = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}%`;

function lastCross(closes: number[], ma: (number | null)[], within: number, dir: "up" | "down"): number | null {
  const n = closes.length;
  for (let i = n - 1; i >= Math.max(1, n - within); i--) {
    const a = ma[i - 1];
    const b = ma[i];
    if (a === null || b === null) continue;
    if (dir === "up" && closes[i - 1] <= a && closes[i] > b) return n - 1 - i;
    if (dir === "down" && closes[i - 1] >= a && closes[i] < b) return n - 1 - i;
  }
  return null;
}

export function buildEntrySignal(
  candles: Candle[],
  ind: IndicatorSet,
  ctx: { supports: number[]; resistances: number[]; plan: TradePlan; cycle: CycleReport },
): EntrySignal {
  const n = candles.length;
  const closes = candles.map((c) => c.c);
  const last = candles[n - 1];
  const price = last.c;
  const ma20s = sma(closes, 20);
  const ma50s = sma(closes, 50);
  const ma200s = sma(closes, 200);

  /* ---------- 1. Struktur MA ---------- */
  const maLevels: MaLevel[] = [];
  const pushMa = (label: MaLevel["label"], s: (number | null)[]) => {
    const v = s[n - 1];
    if (v === null) return;
    const prev = n > 10 ? s[n - 11] : null;
    maLevels.push({
      label,
      value: v,
      distPct: ((price - v) / v) * 100,
      above: price > v,
      slopePct: prev ? ((v - prev) / prev) * 100 : null,
    });
  };
  pushMa("MA20", ma20s);
  pushMa("MA50", ma50s);
  pushMa("MA200", ma200s);
  const m = (l: MaLevel["label"]) => maLevels.find((x) => x.label === l);
  const m20 = m("MA20");
  const m50 = m("MA50");
  const m200 = m("MA200");

  const cross20 = lastCross(closes, ma20s, 10, "up");
  const cross50 = lastCross(closes, ma50s, 10, "up");

  // Penolakan: 3 candle terakhir menyentuh MA di atas harga lalu ditutup di bawahnya.
  let rejection: string | null = null;
  for (const lv of [m50, m200, m20]) {
    if (!lv || lv.above) continue;
    const touched = candles.slice(-3).some((c) => c.h >= lv.value * 0.995 && c.c < lv.value);
    if (touched) {
      rejection = `${lv.label} ${rp(lv.value)}`;
      break;
    }
  }

  // Penghalang terdekat di atas harga (MA atau resistance) dalam 5%.
  const overhead = [
    ...maLevels.filter((x) => !x.above).map((x) => ({ label: x.label, price: x.value })),
    ...ctx.resistances.filter((r) => r > price).map((r) => ({ label: "Resistance", price: r })),
  ]
    .map((o) => ({ ...o, distPct: ((o.price - price) / price) * 100 }))
    .filter((o) => o.distPct <= 5)
    .sort((a, b) => a.distPct - b.distPct);
  const obstacle = overhead[0] ?? null;

  let situation: string;
  const below = maLevels.filter((x) => !x.above).map((x) => x.label);
  if (m20 && m50 && m20.above && !m50.above) {
    situation = `Harga ${cross20 !== null ? `menembus MA20 ${cross20 === 0 ? "hari ini" : `${cross20} hari lalu`}` : "di atas MA20"} (${pc(m20.distPct)}), tetapi masih tertahan MA50 ${rp(m50.value)} (${pc(-m50.distPct)} di atas harga).`;
  } else if (m20 && m50 && m20.above && m50.above && m200 && !m200.above) {
    situation = `Harga sudah di atas MA20 & MA50 — fase pemulihan — tetapi MA200 ${rp(m200.value)} (${pc(-m200.distPct)}) masih menjadi penghalang besar.`;
  } else if (below.length === 0 && maLevels.length) {
    const order = m20 && m50 && m200 && m20.value > m50.value && m50.value > m200.value;
    situation = `Harga di atas semua MA${order ? " dengan susunan MA20 > MA50 > MA200 (tren naik sehat)" : ""}. ${
      m20 && m20.distPct > 8 ? `Namun sudah ${pc(m20.distPct)} di atas MA20 — rawan pullback.` : "Entry ideal saat pullback ke MA20."
    }`;
  } else if (m20 && !m20.above && m50 && m50.above) {
    situation = `Harga turun ke bawah MA20 ${rp(m20.value)} namun masih di atas MA50 ${rp(m50.value)} — pullback dalam tren; MA50 jadi penopang.`;
  } else if (below.length === maLevels.length && maLevels.length) {
    situation = `Harga di bawah semua MA (${below.join(", ")}) — tren turun, belum ada tanda pembalikan struktural.`;
  } else {
    situation = `Harga di bawah ${below.join(" & ")} — struktur tren belum mendukung.`;
  }
  if (rejection) situation += ` Dalam 3 hari terakhir harga sempat menyentuh ${rejection} lalu ditolak.`;

  /* ---------- 2. Pola candlestick ---------- */
  const history = detectPatterns(candles, {
    ma20: ma20s,
    ma50: ma50s,
    supports: ctx.supports,
    resistances: ctx.resistances,
    lookback: 120,
  });
  const atr = ind.atr14 && ind.atr14 > 0 ? ind.atr14 : price * 0.03;
  const recent = history.filter((p) => p.barsAgo <= 4).sort((a, b) => a.barsAgo - b.barsAgo || b.strength - a.strength);
  const bestBull = recent.filter((p) => p.bullish && p.followThrough !== false).sort((a, b) => b.strength - a.strength)[0];
  // Pola bearish yang sudah terealisasi — harga telah turun ≥ 0,75×ATR di bawah low pola —
  // tidak lagi menjadi ancaman: penurunannya sudah terjadi.
  const bearAll = recent.filter((p) => !p.bullish && p.followThrough !== false);
  const isRealized = (p: CandlePattern) => price <= p.low - atr * 0.75;
  const realizedBear = bearAll.find(isRealized);
  const bestBear = bearAll.filter((p) => !isRealized(p)).sort((a, b) => b.strength - a.strength)[0];
  if (realizedBear) {
    situation += ` ${realizedBear.name} ${realizedBear.barsAgo} hari lalu sudah terealisasi — harga telah turun ${pc(((price - realizedBear.low) / realizedBear.low) * 100)} di bawah low pola, sehingga tidak lagi dihitung sebagai ancaman.`;
  }

  /* ---------- 3. Perlawanan pembeli ---------- */
  const buyerSignals: string[] = [];
  const last5 = candles.slice(-5);
  const wicks = last5.filter((c) => {
    const r = c.h - c.l;
    return r > 0 && Math.min(c.o, c.c) - c.l >= r * 0.5 && c.c >= c.l + r * 0.5;
  }).length;
  if (wicks >= 2) buyerSignals.push(`${wicks} dari 5 candle terakhir berekor bawah panjang — harga rendah selalu dibeli kembali.`);

  if (n >= 20) {
    const lowA = Math.min(...candles.slice(-20, -10).map((c) => c.l));
    const lowB = Math.min(...candles.slice(-10).map((c) => c.l));
    if (lowB > lowA * 1.005) buyerSignals.push(`Higher low: low 10 hari terakhir ${rp(lowB)} di atas low 10 hari sebelumnya ${rp(lowA)}.`);
  }

  let upV = 0;
  let downV = 0;
  for (let i = Math.max(1, n - 10); i < n; i++) {
    if (candles[i].c > candles[i - 1].c) upV += candles[i].v;
    else if (candles[i].c < candles[i - 1].c) downV += candles[i].v;
  }
  const udv = downV > 0 ? upV / downV : upV > 0 ? 3 : 1;
  if (udv >= 1.3) buyerSignals.push(`Volume hari naik ${udv.toFixed(2).replace(".", ",")}× volume hari turun (10 hari).`);

  const sup = ctx.supports.filter((x) => x < price && x >= price * 0.94).sort((a, b) => b - a)[0];
  if (sup !== undefined) {
    const tests = candles.slice(-20).filter((c) => c.l <= sup * 1.015 && c.c >= sup).length;
    if (tests >= 2) buyerSignals.push(`Support ${rp(sup)} diuji ${tests} kali dalam 20 hari dan selalu bertahan.`);
  }

  // Pantulan dari penopang: low menembus MA/support lalu candle ditutup kembali di atasnya.
  const floors = [
    ...maLevels.filter((x) => x.above).map((x) => ({ label: `${x.label} ${rp(x.value)}`, v: x.value })),
    ...ctx.supports.filter((x) => x < price && x >= price * 0.9).map((x) => ({ label: `support ${rp(x)}`, v: x })),
  ].sort((a, b) => b.v - a.v);
  let reclaim: { label: string; level: number; high: number; low: number; barsAgo: number } | null = null;
  for (let k = 0; k < 2 && !reclaim; k++) {
    const c = candles[n - 1 - k];
    const lv = floors.find((f) => c.l < f.v * 0.997 && c.c > f.v);
    if (lv) reclaim = { label: lv.label, level: lv.v, high: c.h, low: c.l, barsAgo: k };
  }
  const reclaimConfirmed = reclaim !== null && reclaim.barsAgo === 1 && last.c > reclaim.high;
  if (reclaim) {
    buyerSignals.push(
      `Pembeli mempertahankan ${reclaim.label}: low ${rp(reclaim.low)} sempat menembusnya, lalu ditutup kembali di atasnya ${reclaim.barsAgo === 0 ? "hari ini" : "kemarin"}${reclaimConfirmed ? " — dan hari ini dikonfirmasi tutup di atas high pantulan" : ""}.`,
    );
  }

  const vol20 = ind.volume?.avg20 ?? 0;
  const lr = last.h - last.l;
  const strongClose = lr > 0 && last.c >= last.l + lr * 0.75 && last.c > last.o && vol20 > 0 && last.v >= vol20 * 1.2;
  if (strongClose) buyerSignals.push(`Candle terakhir ditutup dekat high dengan volume ${(last.v / vol20).toFixed(1).replace(".", ",")}× rata-rata.`);

  /* ---------- 4. Skor kesiapan ---------- */
  const items: ScoreItem[] = [{ label: "Titik awal", points: 50, detail: "Skor netral sebelum penyesuaian." }];
  const add = (label: string, points: number, detail: string) => {
    if (points !== 0) items.push({ label, points, detail });
  };
  const pullbackInTrend = !!m50?.above && !!m20 && !m20.above;
  if (m20) {
    // Di bawah MA20 saat pullback dalam tren naik bukan kelemahan struktural — penaltinya lebih kecil.
    const p = m20.above ? 10 : pullbackInTrend ? -4 : -10;
    add("Posisi vs MA20", p, `Harga ${pc(m20.distPct)} terhadap MA20 ${rp(m20.value)}${pullbackInTrend ? " (pullback di atas MA50)" : ""}.`);
  }
  if (m50) add("Posisi vs MA50", m50.above ? 8 : -8, `Harga ${pc(m50.distPct)} terhadap MA50 ${rp(m50.value)}.`);
  if (m200) add("Posisi vs MA200", m200.above ? 5 : -5, `Harga ${pc(m200.distPct)} terhadap MA200 ${rp(m200.value)}.`);
  if (m20?.slopePct != null) add("Arah MA20 (10 hari)", m20.slopePct > 0 ? 4 : -4, `MA20 ${m20.slopePct > 0 ? "menanjak" : "menurun"} ${pc(m20.slopePct, 2)}.`);
  if (obstacle) {
    const p = obstacle.distPct < 2 ? -12 : obstacle.distPct < 4 ? -5 : 0;
    add("Penghalang di atas harga", p, `${obstacle.label} ${rp(obstacle.price)} hanya ${pc(obstacle.distPct)} di atas harga — ruang naik sempit.`);
  }
  if (rejection && !reclaim) add("Penolakan di MA", -8, `Harga ditolak di ${rejection} dalam 3 hari terakhir.`);
  if (m20 && m20.distPct > 8) add("Terlalu jauh dari MA20", -12, `Harga ${pc(m20.distPct)} di atas MA20 — risiko pullback tinggi.`);
  if (ind.rsi14 !== null && ind.rsi14 > 72) add("RSI jenuh beli", -8, `RSI ${ind.rsi14.toFixed(1).replace(".", ",")} > 72.`);
  if (bestBull) {
    const pts = Math.min(18, 4 + bestBull.strength * 3);
    add(
      `Pola bullish: ${bestBull.name}`,
      pts,
      `${bestBull.barsAgo === 0 ? "Hari ini" : `${bestBull.barsAgo} hari lalu`}, ${bestBull.context}. Kekuatan ${bestBull.strength}/5${bestBull.volumeConfirmed ? ", dikonfirmasi volume" : ""}${bestBull.followThrough ? ", sudah dikonfirmasi candle berikutnya" : ""}.`,
    );
  }
  if (bestBear) {
    add(
      `Pola bearish: ${bestBear.name}`,
      -Math.min(18, 4 + bestBear.strength * 3),
      `${bestBear.barsAgo === 0 ? "Hari ini" : `${bestBear.barsAgo} hari lalu`}, ${bestBear.context}. Kekuatan ${bestBear.strength}/5.`,
    );
  }
  if (buyerSignals.length) add("Perlawanan pembeli", Math.min(12, buyerSignals.length * 3), `${buyerSignals.length} tanda (+3 per tanda, maks. +12).`);
  if (reclaimConfirmed) add("Pantulan terkonfirmasi", 6, `Penutupan hari ini di atas high candle pantulan dari ${reclaim!.label}.`);
  const score = Math.round(clamp(items.reduce((a, b) => a + b.points, 0)));

  /* ---------- 5. Vonis ---------- */
  const extended = (m20 !== undefined && m20.distPct > 8) || (ind.rsi14 ?? 0) > 72;
  const tightObstacle = obstacle !== null && obstacle.distPct < 2;
  const belowAll = maLevels.length > 0 && maLevels.every((x) => !x.above);
  let verdict: EntryVerdict;
  if ((bestBear && bestBear.strength >= 3) || (belowAll && (m20?.slopePct ?? 0) < 0 && !bestBull && !reclaim)) verdict = "HINDARI";
  else if (
    score >= 68 &&
    !tightObstacle &&
    (!rejection || reclaimConfirmed) &&
    !extended &&
    !bestBear &&
    (bestBull?.followThrough === true ||
      reclaimConfirmed ||
      (!bestBull && !!m20?.above && !!m50?.above && m20.distPct <= 3 && buyerSignals.length >= 2))
  )
    verdict = "SIAP";
  else if (score >= 45 || bestBull || reclaim) verdict = "TUNGGU";
  else verdict = "BELUM";

  const extendedNow = extended;
  /* ---------- 6. Skenario masuk: syarat + zona + stop + target selalu dihitung bersama ---------- */
  const res = ctx.resistances.filter((r) => r > price).sort((a, b) => a - b);
  const mkTarget = (from: number) => {
    const r = res.find((x) => x >= from + atr * 1.5);
    return r !== undefined
      ? { v: roundTick(r, "down"), why: `resistance ${rp(r)}` }
      : { v: roundTick(from + atr * 3, "down"), why: "batas atas zona + 3×ATR" };
  };
  const rrOf = (lo: number, hi: number, stop: number, t: number) => {
    const mid = (lo + hi) / 2;
    return mid > stop ? (t - mid) / (mid - stop) : null;
  };
  const scenarios: EntryScenario[] = [];
  const notes: string[] = [];
  let trigger: EntrySignal["trigger"] = null;

  // Lantai terdekat di bawah harga (dalam 3×ATR) untuk skenario pantulan.
  const floorCands: { v: number; why: string }[] = [];
  if (reclaim) floorCands.push({ v: reclaim.level, why: reclaim.label });
  if (bestBull) floorCands.push({ v: bestBull.low, why: `low ${bestBull.name} ${rp(bestBull.low)}` });
  for (const f of floors) floorCands.push({ v: f.v, why: f.label });
  if (ctx.plan.entryLow) floorCands.push({ v: ctx.plan.entryLow.price, why: `batas bawah zona entry ${rp(ctx.plan.entryLow.price)}` });
  const floor =
    (extendedNow && m20 ? { v: m20.value, why: `MA20 ${rp(m20.value)}` } : null) ??
    floorCands.filter((f) => f.v <= price && f.v >= price - atr * 3).sort((a, b) => b.v - a.v)[0] ??
    floorCands.filter((f) => f.v <= price).sort((a, b) => b.v - a.v)[0] ??
    null;

  if (verdict === "SIAP") {
    const buy = ctx.plan.mode === "BELI" && ctx.plan.entryLow && ctx.plan.entryHigh;
    const lo = buy ? ctx.plan.entryLow!.price : roundTick(price - atr * 0.5);
    const hi = buy ? ctx.plan.entryHigh!.price : roundTick(price);
    const anchor = bestBull?.followThrough ? bestBull.low : reclaimConfirmed ? reclaim!.low : null;
    const stop = buy ? ctx.plan.stopLoss.price : roundTick((anchor ?? price - atr * 1.5) - atr * 0.25, "down");
    const t = buy ? { v: ctx.plan.target1.price, why: "target 1 rencana transaksi" } : mkTarget(hi);
    const why = bestBull?.followThrough
      ? `${bestBull.name} ${bestBull.barsAgo} hari lalu sudah dikonfirmasi candle berikutnya`
      : reclaimConfirmed
        ? `pantulan dari ${reclaim!.label} sudah dikonfirmasi penutupan di atas high ${rp(reclaim!.high)}`
        : `harga di atas MA20 & MA50, hanya ${pc(m20?.distPct ?? 0)} dari MA20, dengan ${buyerSignals.length} tanda perlawanan pembeli`;
    scenarios.push({
      key: "sekarang",
      title: "Siap masuk sekarang",
      condition: `Setup terpenuhi — ${why}.`,
      zoneLow: lo,
      zoneHigh: hi,
      stop,
      target: t.v,
      riskReward: rrOf(lo, hi, stop, t.v),
      basis: buy ? "Zona, stop, dan target dari rencana transaksi (sama dengan Dewan & Siklus)." : `Zona: harga − 0,5×ATR s.d. harga; stop di bawah ${anchor ? "low pola/pantulan" : "harga − 1,5×ATR"} − 0,25×ATR; target ${t.why}.`,
      triggerPrice: null,
      triggerLabel: null,
    });
    if (anchor) trigger = { label: "Batal bila tutup di bawah", price: roundTick(anchor * 0.999, "down") };
    if (obstacle) {
      notes.push(`${obstacle.label} ${rp(obstacle.price)} (${pc(obstacle.distPct)}) di atas harga — area ambil untung sebagian; tambah posisi hanya bila ditutup tembus dengan volume.`);
    }
  } else {
    // Skenario A — Pantulan: beli dekat harga sekarang setelah pembalikan dikonfirmasi.
    if (floor && verdict !== "HINDARI") {
      let condition: string;
      let confirmAt: number | null = null;
      if (extendedNow) {
        condition = `Harga turun kembali ke ${floor.why} lalu muncul pola pembalikan bullish (Hammer, Bullish Engulfing, Morning Star) di sana — jangan membeli di harga sekarang yang sudah ${pc(m20?.distPct ?? 0)} dari MA20.`;
      } else if (bestBull && bestBull.followThrough === null) {
        confirmAt = roundTick(candles[bestBull.index].h * 1.001, "up");
        condition = `Candle berikutnya ditutup di atas high ${bestBull.name} ${rp(confirmAt)}.`;
      } else if (reclaim && !reclaimConfirmed) {
        confirmAt = roundTick(reclaim.high * 1.001, "up");
        condition = `Pantulan dari ${reclaim.label} dikonfirmasi: candle berikutnya ditutup di atas high ${rp(confirmAt)}.`;
      } else {
        condition = `Muncul pola pembalikan bullish (Hammer, Bullish Engulfing, Morning Star, Piercing Line) atau pantulan yang menutup kembali di atas ${floor.why}.`;
      }
      const anchorLow = extendedNow
        ? floor.v
        : Math.min(floor.v, bestBull?.followThrough === null ? bestBull.low : Infinity, reclaim && !reclaimConfirmed ? reclaim.low : Infinity);
      const lo = confirmAt !== null ? roundTick(Math.max(floor.v, confirmAt - atr * 0.5)) : roundTick(floor.v);
      const hi = confirmAt !== null ? roundTick(confirmAt + atr * 0.25) : roundTick(floor.v + atr * 0.5);
      const stop = roundTick(anchorLow - atr * (confirmAt !== null ? 0.25 : 0.75), "down");
      const t = mkTarget(hi);
      scenarios.push({
        key: "pantulan",
        title: pullbackInTrend ? "Beli pullback yang terkonfirmasi" : extendedNow ? "Beli saat pullback ke MA20" : "Beli saat pantulan terkonfirmasi",
        condition,
        zoneLow: Math.min(lo, hi),
        zoneHigh: Math.max(lo, hi),
        stop,
        target: t.v,
        riskReward: rrOf(Math.min(lo, hi), Math.max(lo, hi), stop, t.v),
        basis:
          confirmAt !== null
            ? `Zona dekat level konfirmasi ${rp(confirmAt)} (−0,5×ATR s.d. +0,25×ATR, tidak di bawah ${floor.why}) — jangan mengejar di atasnya. Stop di bawah low ${rp(anchorLow)} − 0,25×ATR. Target ${t.why}.`
            : `Zona di ${floor.why} s.d. +0,5×ATR. Stop ${rp(floor.v)} − 0,75×ATR. Target ${t.why}.`,
        triggerPrice: confirmAt ?? roundTick(floor.v + atr * 0.5),
        triggerLabel:
          confirmAt !== null
            ? "Tutup di atas"
            : price <= floor.v + atr * 0.5
              ? "Sudah di zona — tunggu pola pembalikan di"
              : `Turun ke ${floor.why.split(" Rp")[0]}`,
      });
      if (confirmAt !== null) trigger = { label: "Konfirmasi pantulan", price: confirmAt };
    }

    // Skenario B — Tembus: beli setelah penghalang ditembus, di zona BARU tepat di atas level itu.
    const overheadAll = [
      ...maLevels.filter((x) => !x.above).map((x) => ({ label: x.label, v: x.value, ma: true })),
      ...res.map((r) => ({ label: "resistance", v: r, ma: false })),
    ]
      .filter((o) => (o.v - price) / price <= 0.1)
      .sort((a, b) => a.v - b.v);
    const lvl = overheadAll[0];
    if (lvl) {
      const lt = roundTick(lvl.v * 1.002, "up");
      const lo = lt;
      const hi = roundTick(lt + atr * 0.5);
      const stop = roundTick(lt - atr * 1.25, "down");
      const t = mkTarget(hi);
      const name = lvl.ma ? lvl.label : `resistance ${rp(lvl.v)}`;
      scenarios.push({
        key: "tembus",
        title: `Beli setelah tembus ${name}`,
        condition: `Harga ditutup ≥ ${rp(lt)} (${pc(((lt - price) / price) * 100)} dari sekarang) — menembus ${lvl.ma ? `${name} ${rp(lvl.v)}` : name} — dengan volume ≥ 1,2× rata-rata 20 hari${lvl.label === "MA20" ? ", 2 hari berturut-turut" : ""}.`,
        zoneLow: lo,
        zoneHigh: hi,
        stop,
        target: t.v,
        riskReward: rrOf(lo, hi, stop, t.v),
        basis: `Zona baru setelah tembus: ${rp(lt)} s.d. +0,5×ATR — bukan zona lama di bawahnya. Stop ${rp(lt)} − 1,25×ATR (tembus gagal). Target ${t.why}.`,
        triggerPrice: lt,
        triggerLabel: `Tutup di atas ${name}`,
      });
      trigger ??= { label: `Tutup di atas ${name}`, price: lt };
    }
    // Downtrend: struktur perlu diperbaiki dulu → skenario tembus didahulukan.
    if (belowAll && scenarios.length === 2) scenarios.reverse();
    // Skenario dengan potensi untung < risiko tidak ditawarkan.
    for (let k = scenarios.length - 1; k >= 0; k--) {
      const sc = scenarios[k];
      if (sc.riskReward !== null && sc.riskReward < 1) {
        notes.push(`Skenario "${sc.title}" dilewati: R/R hanya 1:${sc.riskReward.toFixed(2).replace(".", ",")} (target ${rp(sc.target)} terlalu dekat).`);
        scenarios.splice(k, 1);
      }
    }
    scenarios.forEach((sc, k) => (sc.title = `${String.fromCharCode(65 + k)} · ${sc.title}`));
    // Pemicu utama selalu milik skenario A agar syarat, zona, dan pemicu tidak tertukar.
    trigger =
      scenarios[0]?.triggerPrice != null
        ? { label: scenarios[0].triggerLabel ?? "Pemicu", price: scenarios[0].triggerPrice }
        : null;

    if (extended) notes.push(`Harga ${pc(m20?.distPct ?? 0)} dari MA20 — jangan mengejar; tunggu pullback ke MA20${m20 ? ` ${rp(m20.value)}` : ""}.`);
    if (bestBear) {
      notes.push(`${bestBear.name} ${bestBear.barsAgo === 0 ? "hari ini" : `${bestBear.barsAgo} hari lalu`} masih aktif — anggap batal bila harga tutup di atas ${rp(roundTick(bestBear.high * 1.001, "up"))}.`);
    }
    if (verdict === "HINDARI" && !scenarios.length) notes.push("Belum ada skenario masuk yang masuk akal — tunggu struktur harga membaik.");
  }

  const fmtSc = (sc: EntryScenario) =>
    `${sc.title}: ${sc.condition} → beli di ${rp(sc.zoneLow)}–${rp(sc.zoneHigh)}, stop ${rp(sc.stop)}, target ${rp(sc.target)}${sc.riskReward !== null ? ` (R/R 1:${sc.riskReward.toFixed(2).replace(".", ",")})` : ""}.`;
  const waitFor = [...scenarios.map(fmtSc), ...notes];

  /* ---------- 7. Daftar periksa ---------- */
  const checklist: EntryCheck[] = [];
  if (m20) checklist.push({ label: "Harga di atas MA20", status: m20.above ? "ok" : "bad", detail: `${pc(m20.distPct)} vs MA20 ${rp(m20.value)}` });
  if (m50)
    checklist.push({
      label: "Harga di atas MA50",
      status: m50.above ? "ok" : m50.distPct > -3 ? "wait" : "bad",
      detail: m50.above ? `${pc(m50.distPct)} vs MA50 ${rp(m50.value)}` : `Masih ${pc(-m50.distPct)} di bawah MA50 ${rp(m50.value)}`,
    });
  checklist.push({
    label: "Ruang ke penghalang terdekat",
    status: !obstacle || obstacle.distPct >= 4 ? "ok" : obstacle.distPct >= 2 ? "wait" : "bad",
    detail: obstacle ? `${obstacle.label} ${rp(obstacle.price)} (${pc(obstacle.distPct)})` : "Tidak ada MA/resistance dalam 5% di atas harga",
  });
  checklist.push({
    label: "Pola pembalikan / pantulan bullish",
    status: bestBear ? "bad" : bestBull?.followThrough || reclaimConfirmed ? "ok" : "wait",
    detail: bestBear
      ? `${bestBear.name} (bearish) muncul ${bestBear.barsAgo === 0 ? "hari ini" : `${bestBear.barsAgo} hari lalu`}`
      : bestBull
        ? `${bestBull.name} ${bestBull.barsAgo === 0 ? "hari ini" : `${bestBull.barsAgo} hari lalu`}${bestBull.followThrough ? " — sudah dikonfirmasi" : " — menunggu konfirmasi candle berikutnya"}`
        : reclaim
          ? `Pantulan dari ${reclaim.label}${reclaimConfirmed ? " — sudah dikonfirmasi" : " — menunggu konfirmasi candle berikutnya"}`
          : "Belum ada dalam 5 candle terakhir",
  });
  const volOk = (bestBull?.volumeConfirmed ?? false) || strongClose;
  checklist.push({
    label: "Konfirmasi volume",
    status: volOk ? "ok" : "wait",
    detail: volOk ? "Volume ≥ 1,2× rata-rata pada candle pembalikan/penutupan kuat" : "Belum ada lonjakan volume pada candle naik",
  });
  checklist.push({
    label: "Perlawanan pembeli",
    status: buyerSignals.length >= 2 ? "ok" : buyerSignals.length === 1 ? "wait" : "bad",
    detail: `${buyerSignals.length} tanda terdeteksi`,
  });
  checklist.push({
    label: "Tidak terlalu jauh dari rata-rata",
    status: extended ? "bad" : "ok",
    detail: `${m20 ? `${pc(m20.distPct)} dari MA20` : "MA20 —"}${ind.rsi14 !== null ? ` · RSI ${ind.rsi14.toFixed(0)}` : ""}`,
  });

  const reasons = [
    ...checklist.filter((c) => c.status === "ok").map((c) => `${c.label}: ${c.detail}.`),
    ...buyerSignals,
  ];

  return {
    verdict,
    label: ENTRY_LABEL[verdict],
    score,
    situation,
    maLevels,
    obstacle,
    rejection,
    patterns: recent,
    history: history.filter((p) => p.strength >= 2),
    buyerSignals,
    checklist,
    waitFor,
    trigger,
    scenarios,
    reasons,
    breakdown: items,
  };
}

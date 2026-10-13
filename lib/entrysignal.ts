import { detectPatterns } from "./candles";
import { clamp, sma } from "./indicators";
import { roundTick } from "./tradeplan";
import type {
  Candle,
  CycleReport,
  EntryCheck,
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
  const recent = history.filter((p) => p.barsAgo <= 4).sort((a, b) => a.barsAgo - b.barsAgo || b.strength - a.strength);
  const bestBull = recent.filter((p) => p.bullish && p.followThrough !== false).sort((a, b) => b.strength - a.strength)[0];
  const bestBear = recent.filter((p) => !p.bullish && p.followThrough !== false).sort((a, b) => b.strength - a.strength)[0];

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

  const sup = ctx.supports.filter((s) => s < price && s >= price * 0.94).sort((a, b) => b - a)[0];
  if (sup !== undefined) {
    const tests = candles.slice(-20).filter((c) => c.l <= sup * 1.015 && c.c >= sup).length;
    if (tests >= 2) buyerSignals.push(`Support ${rp(sup)} diuji ${tests} kali dalam 20 hari dan selalu bertahan.`);
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
  if (m20) add("Posisi vs MA20", m20.above ? 10 : -10, `Harga ${pc(m20.distPct)} terhadap MA20 ${rp(m20.value)}.`);
  if (m50) add("Posisi vs MA50", m50.above ? 8 : -8, `Harga ${pc(m50.distPct)} terhadap MA50 ${rp(m50.value)}.`);
  if (m200) add("Posisi vs MA200", m200.above ? 5 : -5, `Harga ${pc(m200.distPct)} terhadap MA200 ${rp(m200.value)}.`);
  if (m20?.slopePct != null) add("Arah MA20 (10 hari)", m20.slopePct > 0 ? 4 : -4, `MA20 ${m20.slopePct > 0 ? "menanjak" : "menurun"} ${pc(m20.slopePct, 2)}.`);
  if (obstacle) {
    const p = obstacle.distPct < 2 ? -12 : obstacle.distPct < 4 ? -5 : 0;
    add("Penghalang di atas harga", p, `${obstacle.label} ${rp(obstacle.price)} hanya ${pc(obstacle.distPct)} di atas harga — ruang naik sempit.`);
  }
  if (rejection) add("Penolakan di MA", -8, `Harga ditolak di ${rejection} dalam 3 hari terakhir.`);
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
  const score = Math.round(clamp(items.reduce((a, b) => a + b.points, 0)));

  /* ---------- 5. Vonis ---------- */
  const extended = (m20 !== undefined && m20.distPct > 8) || (ind.rsi14 ?? 0) > 72;
  const tightObstacle = obstacle !== null && obstacle.distPct < 2;
  const belowAll = maLevels.length > 0 && maLevels.every((x) => !x.above);
  let verdict: EntryVerdict;
  if ((bestBear && bestBear.strength >= 3) || (belowAll && (m20?.slopePct ?? 0) < 0 && !bestBull)) verdict = "HINDARI";
  else if (
    score >= 68 &&
    !tightObstacle &&
    !rejection &&
    !extended &&
    !bestBear &&
    (bestBull?.followThrough === true ||
      (!bestBull && !!m20?.above && !!m50?.above && m20.distPct <= 3 && buyerSignals.length >= 2))
  )
    verdict = "SIAP";
  else if (score >= 45 || bestBull) verdict = "TUNGGU";
  else verdict = "BELUM";

  /* ---------- 6. Syarat yang ditunggu ---------- */
  const waitFor: string[] = [];
  let trigger: EntrySignal["trigger"] = null;
  if (verdict === "SIAP") {
    const why = bestBull
      ? `${bestBull.name} ${bestBull.barsAgo === 0 ? "hari ini" : `${bestBull.barsAgo} hari lalu`} sudah dikonfirmasi candle berikutnya`
      : `harga di atas MA20 & MA50, hanya ${pc(m20?.distPct ?? 0)} dari MA20, dengan ${buyerSignals.length} tanda perlawanan pembeli`;
    waitFor.push(
      `Setup terpenuhi — ${why}.` +
        (ctx.plan.entryLow
          ? ` Eksekusi di zona entry ${rp(ctx.plan.entryLow.price)}–${rp(ctx.plan.entryHigh?.price ?? price)} dengan stop loss ${rp(ctx.plan.stopLoss.price)}.`
          : ""),
    );
    if (obstacle) {
      waitFor.push(
        `Catatan: ${obstacle.label} ${rp(obstacle.price)} (${pc(obstacle.distPct)}) di atas harga — area ambil untung sebagian; tambah posisi hanya bila ditutup tembus dengan volume.`,
      );
    }
    const s = bestBull ? bestBull.low : m20?.value;
    if (s) trigger = { label: bestBull ? `Batal bila tutup di bawah low ${bestBull.name}` : "Batal bila tutup di bawah MA20", price: roundTick(s * 0.999, "down") };
  }
  if (verdict !== "SIAP" && obstacle && obstacle.distPct < 4) {
    const t = roundTick(obstacle.price * 1.002, "up");
    waitFor.push(`Penutupan di atas ${obstacle.label} ${rp(t)} (${pc(((t - price) / price) * 100)}) dengan volume ≥ 1,2× rata-rata 20 hari — tanda penghalang ditembus, bukan sekadar disentuh.`);
    trigger = { label: `Tutup di atas ${obstacle.label}`, price: t };
  }
  if (verdict !== "SIAP" && m20 && !m20.above) {
    const t = roundTick(m20.value, "up");
    waitFor.push(`Harga kembali ditutup di atas MA20 ${rp(t)} selama 2 hari berturut-turut.`);
    trigger ??= { label: "Tutup di atas MA20", price: t };
  }
  if (verdict === "SIAP") {
    /* sudah ditangani di atas */
  } else if (!bestBull) {
    const zone =
      m20 && m20.above && m20.distPct < 8
        ? `MA20 ${rp(m20.value)}`
        : sup !== undefined
          ? `support ${rp(sup)}`
          : ctx.plan.entryLow
            ? `batas bawah zona entry ${rp(ctx.plan.entryLow.price)}`
            : "area penopang terdekat";
    waitFor.push(`Pola pembalikan bullish — Hammer, Morning Star, Bullish Engulfing, atau Piercing Line — saat harga menguji ${zone}.`);
  } else if (bestBull.followThrough === null) {
    const t = roundTick(bestBull.high * 1.001, "up");
    waitFor.push(`Konfirmasi ${bestBull.name}: candle berikutnya ditutup di atas high pola ${rp(t)}.`);
    trigger ??= { label: `Konfirmasi ${bestBull.name}`, price: t };
  }
  if (verdict !== "SIAP" && extended) {
    waitFor.push(
      `Harga terlalu jauh dari rata-rata — tunggu pullback ke MA20${m20 ? ` ${rp(m20.value)}` : ""}${ctx.plan.entryLow ? ` / zona entry ${rp(ctx.plan.entryLow.price)}–${rp(ctx.plan.entryHigh?.price ?? price)}` : ""}.`,
    );
  }
  if (bestBear) {
    const t = roundTick(bestBear.high * 1.001, "up");
    waitFor.push(`${bestBear.name} ${bestBear.barsAgo === 0 ? "hari ini" : `${bestBear.barsAgo} hari lalu`} perlu gugur dulu: tutup di atas ${rp(t)}.`);
  }

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
    label: "Pola pembalikan bullish",
    status: bestBear ? "bad" : bestBull ? (bestBull.followThrough ? "ok" : "wait") : "wait",
    detail: bestBear
      ? `${bestBear.name} (bearish) muncul ${bestBear.barsAgo === 0 ? "hari ini" : `${bestBear.barsAgo} hari lalu`}`
      : bestBull
        ? `${bestBull.name} ${bestBull.barsAgo === 0 ? "hari ini" : `${bestBull.barsAgo} hari lalu`}${bestBull.followThrough ? " — sudah dikonfirmasi" : " — menunggu konfirmasi candle berikutnya"}`
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
    breakdown: items,
  };
}

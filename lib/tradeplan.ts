import type { CycleReport, IndicatorSet, PriceLevel, TradePlan } from "./types";

/**
 * Satu-satunya sumber level harga (entry, stop loss, target) untuk seluruh halaman:
 * Dewan Analis, panel Siklus, panel Teknikal, dan Radar Pasar memakai angka yang sama.
 *
 * Setiap level dibulatkan ke fraksi harga BEI dan membawa `basis` — rumus yang
 * menghasilkan angka itu — supaya pengguna bisa memeriksa ulang perhitungannya.
 */

/** Fraksi harga BEI (berlaku untuk saham reguler). */
export function idxTick(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

export function roundTick(v: number, mode: "down" | "up" | "nearest" = "nearest"): number {
  const t = idxTick(v);
  const q = v / t;
  const r = mode === "down" ? Math.floor(q + 1e-9) : mode === "up" ? Math.ceil(q - 1e-9) : Math.round(q);
  return Math.max(t, r * t);
}

export function rp(v: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v)}`;
}

export function pct(v: number, digits = 1, signed = true): string {
  const s = Math.abs(v).toFixed(digits).replace(".", ",");
  return signed ? `${v >= 0 ? "+" : "−"}${s}%` : `${s}%`;
}

function level(price: number, ref: number, basis: string, raw?: number): PriceLevel {
  const note =
    raw !== undefined && Math.abs(raw - price) >= 0.5
      ? ` Hasil hitung ${rp(raw)} dibulatkan ${raw > price ? "ke bawah" : "ke atas"} ke fraksi Rp${idxTick(price)}.`
      : "";
  return { price, pct: ((price - ref) / ref) * 100, basis: basis + note };
}

export function buildTradePlan(
  ind: IndicatorSet,
  ctx: { price: number; supports: number[]; resistances: number[]; cycle: CycleReport },
): TradePlan {
  const { price, cycle } = ctx;
  const atr = ind.atr14 && ind.atr14 > 0 ? ind.atr14 : price * 0.03;
  const atrNote = `ATR(14) = ${rp(atr)} (${pct((atr / price) * 100, 2, false)})`;
  const supports = ctx.supports.filter((s) => s < price).sort((a, b) => b - a);
  const resistances = ctx.resistances.filter((r) => r > price).sort((a, b) => a - b);
  const bullish = !cycle.available || cycle.phase === "AKUMULASI" || cycle.phase === "MARKUP";

  /* ---------------- Mode PEGANG: fase Distribusi / Mark Down ---------------- */
  if (!bullish) {
    const sup = supports.find((s) => s >= price - atr * 3);
    const exitRaw = sup !== undefined ? sup - atr * 0.25 : price - atr * 1.5;
    const exit = roundTick(Math.min(exitRaw, price - atr * 0.5), "down");
    const res = resistances[0];
    const sellRaw = res ?? price + atr * 1.5;
    const sell = roundTick(sellRaw, "down");
    const reentry = roundTick(Math.max(cycle.range.high, ind.ma50 ?? 0, price + atr), "up");

    return {
      mode: "PEGANG",
      price,
      atr,
      tick: idxTick(price),
      entryLow: null,
      entryHigh: null,
      stopLoss: level(
        exit,
        price,
        sup !== undefined
          ? `Support terdekat ${rp(sup)} − 0,25×ATR. ${atrNote}.`
          : `Harga − 1,5×ATR (tidak ada support terdeteksi). ${atrNote}.`,
        Math.min(exitRaw, price - atr * 0.5),
      ),
      target1: level(
        sell,
        price,
        res !== undefined ? `Resistance terdekat ${rp(res)} — area jual saat pantulan.` : `Harga + 1,5×ATR — area jual saat pantulan.`,
        sellRaw,
      ),
      target2: null,
      reentry: level(
        reentry,
        price,
        `Tertinggi dari: puncak rentang 40H ${rp(cycle.range.high)}${ind.ma50 ? `, MA50 ${rp(ind.ma50)}` : ""}, harga + 1×ATR. Beli kembali hanya bila ditutup di atas level ini.`,
        Math.max(cycle.range.high, ind.ma50 ?? 0, price + atr),
      ),
      riskPct: null,
      rewardPct: null,
      riskReward1: null,
      riskReward2: null,
      riskRewardAtLow: null,
      invalidation: `Bagi pemegang: keluar bila harga tutup di bawah ${rp(exit)}. Pandangan negatif batal bila harga tutup di atas ${rp(reentry)} dengan volume > 1,5× rata-rata.`,
    };
  }

  /* ---------------- Mode BELI: fase Akumulasi / Mark Up ---------------- */
  let lowRaw: number;
  let lowBasis: string;
  if (cycle.available && cycle.phase === "AKUMULASI") {
    const fromRange = cycle.range.low + atr * 0.25;
    const fromAtr = price - atr * 1.5;
    if (fromRange >= fromAtr) {
      lowRaw = fromRange;
      lowBasis = `Dasar rentang 40H ${rp(cycle.range.low)} + 0,25×ATR — beli dekat dasar area akumulasi.`;
    } else {
      lowRaw = fromAtr;
      lowBasis = `Harga − 1,5×ATR (dasar rentang ${rp(cycle.range.low)} terlalu jauh).`;
    }
  } else {
    // Mark Up: tunggu pullback ke penopang terdekat (MA20 / support) dalam jangkauan 2×ATR.
    const cands: { v: number; why: string }[] = [];
    if (ind.ma20 !== null && ind.ma20 < price && ind.ma20 >= price - atr * 2) cands.push({ v: ind.ma20, why: `MA20 ${rp(ind.ma20)}` });
    const s = supports.find((x) => x >= price - atr * 2);
    if (s !== undefined) cands.push({ v: s, why: `support ${rp(s)}` });
    const best = cands.sort((a, b) => b.v - a.v)[0];
    if (best) {
      lowRaw = best.v;
      lowBasis = `Pullback ke ${best.why} (penopang tertinggi dalam jangkauan 2×ATR).`;
    } else {
      lowRaw = price - atr;
      lowBasis = `Harga − 1×ATR (tidak ada MA20/support dalam jangkauan 2×ATR).`;
    }
  }
  // Zona entry minimal selebar 0,5×ATR dan tidak di atas harga sekarang.
  if (lowRaw > price - atr * 0.5) {
    lowRaw = price - atr * 0.5;
    lowBasis += " Dibatasi ke harga − 0,5×ATR agar zona entry tidak sempit.";
  }
  const entryLowP = roundTick(lowRaw, "nearest");
  const entryHighP = roundTick(price, "nearest");
  const mid = (entryLowP + entryHighP) / 2;

  // Stop loss: di bawah struktur terdekat di bawah zona entry.
  const below = supports.find((x) => x < entryLowP && x >= entryLowP - atr * 2.5);
  let stopRaw: number;
  let stopBasis: string;
  if (cycle.available && cycle.phase === "AKUMULASI" && cycle.range.low < entryLowP) {
    stopRaw = cycle.range.low - atr * 0.5;
    stopBasis = `Dasar rentang 40H ${rp(cycle.range.low)} − 0,5×ATR — jebol dasar = akumulasi gagal.`;
  } else if (below !== undefined) {
    stopRaw = below - atr * 0.25;
    stopBasis = `Support ${rp(below)} − 0,25×ATR (struktur terdekat di bawah zona entry).`;
  } else {
    stopRaw = entryLowP - atr;
    stopBasis = `Batas bawah entry − 1×ATR (tidak ada support dalam 2,5×ATR).`;
  }
  // Jaga jarak wajar: minimal 0,75×ATR dan maksimal 3×ATR dari tengah zona entry.
  if (stopRaw > mid - atr * 0.75) {
    stopRaw = mid - atr * 0.75;
    stopBasis += " Diturunkan ke tengah entry − 0,75×ATR agar tidak terkena noise harian.";
  } else if (stopRaw < mid - atr * 3) {
    stopRaw = mid - atr * 3;
    stopBasis += " Dinaikkan ke tengah entry − 3×ATR agar risiko per transaksi terkendali.";
  }
  const stopP = roundTick(stopRaw, "down");

  // Target: resistance yang memberi ruang ≥ 1,5×ATR; bila tak ada, proyeksi ATR / measured move.
  const room = resistances.filter((r) => r >= entryHighP + atr * 1.5);
  let t1Raw: number;
  let t1Basis: string;
  if (room[0] !== undefined) {
    t1Raw = room[0];
    t1Basis = `Resistance ${rp(room[0])} (resistance pertama dengan ruang ≥ 1,5×ATR).`;
  } else if (cycle.available && cycle.phase === "AKUMULASI" && cycle.range.high >= entryHighP + atr * 1.5) {
    t1Raw = cycle.range.high;
    t1Basis = `Puncak rentang 40H ${rp(cycle.range.high)}.`;
  } else {
    t1Raw = entryHighP + atr * 3;
    t1Basis = `Batas atas entry + 3×ATR (tidak ada resistance dengan ruang cukup).`;
  }
  let t2Raw: number;
  let t2Basis: string;
  const nextRes = resistances.find((r) => r >= t1Raw + atr);
  if (nextRes !== undefined) {
    t2Raw = nextRes;
    t2Basis = `Resistance berikutnya ${rp(nextRes)}.`;
  } else if (cycle.available && cycle.phase === "AKUMULASI") {
    const height = cycle.range.high - cycle.range.low;
    t2Raw = Math.max(cycle.range.high + height, t1Raw + atr);
    t2Basis = `Measured move: puncak rentang ${rp(cycle.range.high)} + tinggi rentang ${rp(height)}.`;
  } else {
    t2Raw = Math.max(entryHighP + atr * 5, t1Raw + atr);
    t2Basis = `Batas atas entry + 5×ATR.`;
  }
  const t1P = roundTick(t1Raw, "down");
  const t2P = roundTick(t2Raw, "down");

  const riskPct = ((mid - stopP) / mid) * 100;
  const rewardPct = ((t1P - mid) / mid) * 100;
  const rr1 = mid > stopP ? (t1P - mid) / (mid - stopP) : null;
  const rr2 = mid > stopP ? (t2P - mid) / (mid - stopP) : null;

  return {
    mode: "BELI",
    price,
    atr,
    tick: idxTick(price),
    entryLow: level(entryLowP, price, `${lowBasis} ${atrNote}.`, lowRaw),
    entryHigh: level(entryHighP, price, "Harga penutupan terakhir — jangan mengejar di atas level ini."),
    stopLoss: level(stopP, price, stopBasis, stopRaw),
    target1: level(t1P, price, t1Basis, t1Raw),
    target2: level(t2P, price, t2Basis, t2Raw),
    reentry: null,
    riskPct,
    rewardPct,
    riskReward1: rr1,
    riskReward2: rr2,
    riskRewardAtLow: entryLowP > stopP ? (t1P - entryLowP) / (entryLowP - stopP) : null,
    invalidation: `Rencana batal bila harga tutup di bawah ${rp(stopP)} — keluar tanpa menunggu.`,
  };
}

/**
 * Ukuran posisi berbasis risiko: berapa % portofolio agar kerugian bila stop loss
 * tersentuh = `riskBudget`% portofolio. Dikalikan faktor keyakinan dan dibatasi 25%.
 */
export function positionSize(
  plan: TradePlan,
  factor: number,
  factorNote: string,
  riskBudget = 1,
): { pct: number; basis: string } {
  if (plan.mode !== "BELI" || !plan.riskPct || plan.riskPct <= 0 || factor <= 0) {
    return { pct: 0, basis: "Tidak ada alokasi baru — kondisi belum mendukung pembelian." };
  }
  const raw = (riskBudget / plan.riskPct) * 100;
  const sized = raw * factor;
  const capped = Math.min(25, sized);
  const f = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", ",");
  return {
    pct: Math.round(capped * 10) / 10,
    basis:
      `Batas rugi ${pct(riskBudget, 0, false)} portofolio ÷ jarak stop ${pct(plan.riskPct, 1, false)} (dari tengah zona entry ke stop loss)` +
      ` = ${pct(raw, 1, false)}; × ${factorNote} = ${f(factor)} → ${pct(sized, 1, false)}${sized > 25 ? ", dibatasi maksimal 25%" : ""}.` +
      ` Bila stop tersentuh, rugi ≈ ${pct((Math.min(25, sized) * plan.riskPct) / 100, 2, false)} portofolio.`,
  };
}

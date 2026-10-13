import type { CycleReport, IndicatorSet, PriceLevel, TradePlan } from "./types";

/**
 * Satu-satunya sumber level harga (entry, stop loss, target) untuk seluruh halaman:
 * Dewan Analis, panel Siklus, panel Teknikal, dan Radar Pasar memakai angka yang sama.
 *
 * Setiap level dibulatkan ke fraksi harga BEI dan membawa `basis` — rumus yang
 * menghasilkan angka itu — supaya pengguna bisa memeriksa ulang perhitungannya.
 */

/** Fraksi harga BEI (berlaku untuk saham reguler). */
/** R/R minimum di batas atas zona beli: potensi untung ke TP1 = 2× risiko ke stop. */
export const IDEAL_RR = 2;

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
  ctx: { price: number; supports: number[]; resistances: number[]; cycle: CycleReport; swingLow10?: number | null },
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
      idealRR: IDEAL_RR,
      priceVsZone: null,
      distToZonePct: null,
      noRoom: false,
      invalidation: `Bagi pemegang: keluar bila harga tutup di bawah ${rp(exit)}. Pandangan negatif batal bila harga tutup di atas ${rp(reentry)} dengan volume > 1,5× rata-rata.`,
    };
  }

  /* ---------------- Mode BELI: fase Akumulasi / Mark Up ---------------- */
  // Prinsip: zona beli ditentukan oleh STRUKTUR (penopang, stop, target), bukan oleh harga terakhir.
  // Batas atas zona = harga tertinggi yang masih memberi R/R ≥ 1:IDEAL_RR. Saham yang sudah naik
  // melewati batas itu tidak "divalidasi" — rencananya menjadi antre di zona ideal.

  // 1. Penopang struktural di bawah harga.
  let lowRaw: number;
  let lowBasis: string;
  const swingLow10 = ctx.swingLow10 ?? null;
  if (cycle.available && cycle.phase === "AKUMULASI" && cycle.range.low < price) {
    lowRaw = cycle.range.low + atr * 0.25;
    lowBasis = `Dasar rentang akumulasi 40H ${rp(cycle.range.low)} + 0,25×ATR — beli dekat dasar area akumulasi.`;
  } else {
    const cands: { v: number; why: string }[] = [];
    if (ind.ma20 !== null && ind.ma20 < price) cands.push({ v: ind.ma20, why: `MA20 ${rp(ind.ma20)}` });
    if (ind.ma50 !== null && ind.ma50 < price) cands.push({ v: ind.ma50, why: `MA50 ${rp(ind.ma50)}` });
    for (const sp of supports) cands.push({ v: sp, why: `support ${rp(sp)}` });
    if (swingLow10 !== null && swingLow10 < price) cands.push({ v: swingLow10, why: `low 10 hari ${rp(swingLow10)}` });
    // Penopang tertinggi yang benar-benar di bawah harga (minimal 0,25×ATR).
    const best = cands.filter((c) => c.v <= price - atr * 0.25).sort((a, b) => b.v - a.v)[0];
    if (best) {
      lowRaw = best.v;
      lowBasis = `Pullback ke ${best.why} — penopang struktural tertinggi di bawah harga.`;
    } else {
      lowRaw = price - atr;
      lowBasis = `Harga − 1×ATR (tidak ada MA/support di bawah harga).`;
    }
  }

  // 2. Stop loss di bawah struktur penopang.
  const below = supports.find((x) => x < lowRaw && x >= lowRaw - atr * 2.5);
  let stopRaw: number;
  let stopBasis: string;
  if (cycle.available && cycle.phase === "AKUMULASI" && cycle.range.low <= lowRaw) {
    stopRaw = cycle.range.low - atr * 0.5;
    stopBasis = `Dasar rentang 40H ${rp(cycle.range.low)} − 0,5×ATR — jebol dasar = akumulasi gagal.`;
  } else if (below !== undefined) {
    stopRaw = below - atr * 0.25;
    stopBasis = `Support ${rp(below)} − 0,25×ATR (struktur di bawah penopang).`;
  } else {
    stopRaw = lowRaw - atr;
    stopBasis = `Penopang ${rp(lowRaw)} − 1×ATR (tidak ada support lain dalam 2,5×ATR).`;
  }
  if (stopRaw > lowRaw - atr * 0.75) {
    stopRaw = lowRaw - atr * 0.75;
    stopBasis += " Diturunkan ke penopang − 0,75×ATR agar tidak terkena noise harian.";
  } else if (stopRaw < lowRaw - atr * 3) {
    stopRaw = lowRaw - atr * 3;
    stopBasis += " Dinaikkan ke penopang − 3×ATR agar risiko terkendali.";
  }
  const stopP = roundTick(stopRaw, "down");

  // 3. Target struktural — resistance, atau proyeksi dari PENOPANG (bukan dari harga terakhir),
  //    agar harga yang naik tidak ikut "menaikkan" targetnya sendiri.
  const minT1 = Math.max(lowRaw + atr * 2, price + atr * 0.5);
  const room = resistances.filter((r) => r >= minT1);
  let t1Raw: number;
  let t1Basis: string;
  if (room[0] !== undefined) {
    t1Raw = room[0];
    t1Basis = `Resistance ${rp(room[0])} — resistance pertama di atas harga dengan ruang ≥ 2×ATR dari penopang.`;
  } else if (cycle.available && cycle.phase === "AKUMULASI" && cycle.range.high >= minT1) {
    t1Raw = cycle.range.high;
    t1Basis = `Puncak rentang 40H ${rp(cycle.range.high)}.`;
  } else {
    t1Raw = lowRaw + atr * 4;
    t1Basis = `Penopang ${rp(lowRaw)} + 4×ATR (tidak ada resistance di atas harga).`;
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
    t2Raw = t1Raw + atr * 2;
    t2Basis = `Target 1 + 2×ATR.`;
  }
  const t1P = roundTick(t1Raw, "down");
  const t2P = roundTick(t2Raw, "down");

  // 4. Zona ideal: batas atas = stop + (TP1 − stop) ÷ (1 + R) → tepat R/R 1:R.
  const idealMaxRaw = stopP + (t1P - stopP) / (1 + IDEAL_RR);
  let hiRaw = Math.min(price, idealMaxRaw);
  let loRaw = Math.min(lowRaw, hiRaw - atr * 0.25);
  loRaw = Math.max(loRaw, stopP + atr * 0.5);
  const noRoom = hiRaw < stopP + atr * 0.75;
  if (noRoom) {
    hiRaw = stopP + atr * 0.75;
    loRaw = Math.min(loRaw, hiRaw);
  }
  const entryHighP = roundTick(hiRaw, "down");
  const entryLowP = Math.min(roundTick(loRaw, "nearest"), entryHighP);
  const mid = (entryLowP + entryHighP) / 2;

  const above = price > entryHighP * 1.003;
  const belowZone = price < entryLowP * 0.997;
  const priceVsZone: TradePlan["priceVsZone"] = above ? "DI_ATAS" : belowZone ? "DI_BAWAH" : "DALAM";
  const distToZonePct = above ? ((price - entryHighP) / entryHighP) * 100 : belowZone ? ((price - entryLowP) / entryLowP) * 100 : 0;

  const highBasis =
    idealMaxRaw <= price
      ? `Batas atas ideal = stop ${rp(stopP)} + (TP1 ${rp(t1P)} − stop) ÷ ${1 + IDEAL_RR} = ${rp(idealMaxRaw)} → R/R tepat 1:${IDEAL_RR}.` +
        (above ? ` Harga sekarang ${rp(price)} sudah ${pct(distToZonePct)} di atasnya — jangan dikejar, antre beli di zona.` : "")
      : `Harga sekarang ${rp(price)} masih di bawah batas ideal ${rp(idealMaxRaw)} (R/R 1:${IDEAL_RR}) — boleh dibeli hingga harga ini.`;

  const riskPct = ((mid - stopP) / mid) * 100;
  const rewardPct = ((t1P - mid) / mid) * 100;
  const rr1 = mid > stopP ? (t1P - mid) / (mid - stopP) : null;
  const rr2 = mid > stopP ? (t2P - mid) / (mid - stopP) : null;

  return {
    mode: "BELI",
    price,
    atr,
    tick: idxTick(price),
    entryLow: level(entryLowP, price, `${lowBasis} ${atrNote}.`, loRaw),
    entryHigh: level(entryHighP, price, highBasis, hiRaw),
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
    idealRR: IDEAL_RR,
    priceVsZone,
    distToZonePct,
    noRoom,
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

import { clamp } from "./indicators";
import { pct, positionSize, rp } from "./tradeplan";
import type { CycleReport, DataRecommendation, EntrySignal, IndicatorSet, RecAction, ScoreItem, TradePlan } from "./types";

/**
 * Rekomendasi berbasis data: skor 0–100 = basis fase siklus + penyesuaian
 * (aliran dana, momentum, volume, tren panjang, likuiditas, risk/reward).
 * Setiap penyesuaian dicatat di `breakdown` sehingga skor bisa dihitung ulang manual.
 * Level harga diambil dari `TradePlan` — sumber yang sama dengan Dewan Analis.
 */

export const REC_LABEL: Record<RecAction, string> = {
  BELI: "Beli",
  BELI_BERTAHAP: "Beli Bertahap",
  PANTAU: "Pantau",
  AMBIL_UNTUNG: "Ambil Untung / Kurangi",
  HINDARI: "Hindari",
};

/** Ambang aksi — ditampilkan juga di UI agar pengguna tahu dari mana label berasal. */
export const REC_BANDS =
  "≥70 Beli · 58–69 Beli (Mark Up) / Beli Bertahap · 44–57 Pantau · 30–43 Ambil Untung (Hindari bila Mark Down) · <30 Hindari. Fase Akumulasi maksimal Beli Bertahap; R/R < 1 maksimal Pantau.";

export { idxTick } from "./tradeplan";

function phaseBase(cycle: CycleReport): { base: number; why: string } {
  const st = cycle.stage.toLowerCase();
  switch (cycle.phase) {
    case "AKUMULASI":
      if (st.startsWith("akhir")) return { base: 70, why: "Akumulasi akhir (Sign of Strength)" };
      if (st.startsWith("spring")) return { base: 68, why: "Akumulasi — Spring" };
      if (st.startsWith("tengah")) return { base: 60, why: "Akumulasi tengah" };
      return { base: 54, why: "Akumulasi awal" };
    case "MARKUP":
      if (st.startsWith("lanjut")) return { base: 55, why: "Mark Up lanjut (mulai overextended)" };
      if (st.startsWith("awal")) return { base: 76, why: "Mark Up awal (baru breakout)" };
      return { base: 70, why: "Mark Up tengah" };
    case "DISTRIBUSI":
      return st.startsWith("akhir") ? { base: 22, why: "Distribusi akhir (Sign of Weakness)" } : { base: 34, why: "Distribusi" };
    default:
      return st.startsWith("kapitulasi") ? { base: 30, why: "Mark Down — kapitulasi" } : { base: 15, why: "Mark Down berjalan" };
  }
}

export function buildRecommendation(
  cycle: CycleReport,
  ind: IndicatorSet,
  ctx: {
    price: number;
    avgValue20: number;
    plan: TradePlan;
    rs60?: { stock: number; ihsg: number } | null;
    entry?: EntrySignal | null;
  },
): DataRecommendation {
  const { avgValue20, plan } = ctx;
  const items: ScoreItem[] = [];
  const add = (label: string, points: number, detail: string) => {
    if (points !== 0) items.push({ label, points: Math.round(points * 10) / 10, detail });
  };

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
      reasons: ["Riwayat harga kurang dari 60 hari — siklus belum bisa dibaca."],
      warnings: [],
      breakdown: [{ label: "Netral", points: 50, detail: "Data tidak cukup." }],
      plan,
      position: { pct: 0, basis: "Tidak ada alokasi — data tidak cukup." },
    };
  }

  // 1. Basis fase, ditarik ke 50 sesuai keyakinan fase.
  const { base, why } = phaseBase(cycle);
  items.push({ label: "Basis fase siklus", points: base, detail: `${why} → basis ${base}.` });
  const factor = 0.55 + (cycle.confidence / 100) * 0.45;
  const shrunk = 50 + (base - 50) * factor;
  add(
    "Penyesuaian keyakinan fase",
    shrunk - base,
    `Keyakinan fase ${cycle.confidence}% → faktor ${factor.toFixed(2).replace(".", ",")}; skor ditarik ke 50: 50 + (${base} − 50) × ${factor.toFixed(2).replace(".", ",")} = ${shrunk.toFixed(1).replace(".", ",")}.`,
  );

  // 2. Aliran dana (Chaikin Money Flow 40H)
  const cmf = cycle.metrics.cmf;
  if (cmf !== null) {
    const p = cmf > 0.1 ? 6 : cmf > 0.03 ? 3 : cmf < -0.1 ? -6 : cmf < -0.03 ? -3 : 0;
    add("Aliran dana (CMF 40H)", p, `CMF ${cmf.toFixed(2).replace(".", ",")}: >0,10 = +6, >0,03 = +3, <−0,03 = −3, <−0,10 = −6.`);
  }

  // 3. Momentum MACD
  if (ind.macd) {
    const p = ind.macd.hist > 0 ? 4 : ind.macd.hist < 0 ? -3 : 0;
    add(
      "Momentum MACD",
      p,
      `Histogram ${ind.macd.hist.toFixed(2).replace(".", ",")} (${p > 0 ? "MACD di atas sinyal" : "MACD di bawah sinyal"}).`,
    );
  }

  // 4. RSI
  const rsi = ind.rsi14;
  if (rsi !== null) {
    const p = rsi > 75 ? -8 : rsi < 30 && cycle.phase !== "MARKDOWN" ? 3 : rsi >= 50 && rsi <= 68 ? 3 : 0;
    add(
      "RSI(14)",
      p,
      `RSI ${rsi.toFixed(1).replace(".", ",")}: >75 jenuh beli = −8, 50–68 sehat = +3, <30 jenuh jual (bukan Mark Down) = +3.`,
    );
  }

  // 5. Konfirmasi volume hari terakhir
  const vr = ind.volume?.ratio20 ?? null;
  if (vr !== null && vr >= 2) {
    const up = (ind.return1d ?? 0) > 0;
    add(
      "Konfirmasi volume",
      up ? 5 : -5,
      `Volume ${vr.toFixed(1).replace(".", ",")}× rata-rata 20H saat harga ${up ? "naik" : "turun"} (${pct(ind.return1d ?? 0)}).`,
    );
  }

  // 6. Tren jangka panjang
  if (ind.ma200 !== null) {
    const above = ctx.price > ind.ma200;
    add("Tren panjang (MA200)", above ? 2 : -2, `Harga ${above ? "di atas" : "di bawah"} MA200 ${rp(ind.ma200)}.`);
  }

  // 6b. Kekuatan relatif vs IHSG (60 hari bursa)
  if (ctx.rs60) {
    const gap = ctx.rs60.stock - ctx.rs60.ihsg;
    const p = gap > 5 ? 3 : gap < -5 ? -3 : 0;
    add(
      "Kekuatan relatif vs IHSG",
      p,
      `Return 60H saham ${pct(ctx.rs60.stock)} vs IHSG ${pct(ctx.rs60.ihsg)} → selisih ${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(1).replace(".", ",")} poin (>+5 = +3, <−5 = −3).`,
    );
  }

  // 6c. Timing entry (struktur MA + pola candle + perlawanan pembeli)
  if (ctx.entry) {
    const e = ctx.entry;
    const p = e.verdict === "SIAP" ? 4 : e.verdict === "BELUM" ? -2 : e.verdict === "HINDARI" ? -6 : 0;
    add(
      "Timing entry",
      p,
      `${e.label} (kesiapan ${e.score}/100): Siap Beli = +4, Tunggu = 0, Belum Ada Setup = −2, Hindari = −6.`,
    );
  }

  // 7. Likuiditas
  const liqM = avgValue20 / 1e9;
  if (avgValue20 < 1e9) add("Likuiditas", -10, `Nilai transaksi rata-rata 20H Rp${liqM.toFixed(2).replace(".", ",")} M < Rp1 M/hari.`);
  else if (avgValue20 < 5e9) add("Likuiditas", -4, `Nilai transaksi rata-rata 20H Rp${liqM.toFixed(1).replace(".", ",")} M < Rp5 M/hari.`);

  // 8. Risk/reward rencana
  if (plan.mode === "BELI" && plan.riskReward1 !== null && plan.riskReward1 < 1.2) {
    add(
      "Risk/reward kurang",
      -6,
      `R/R ke target 1 hanya 1:${plan.riskReward1.toFixed(2).replace(".", ",")} (< 1:1,2).`,
    );
  }

  const raw = items.reduce((a, b) => a + b.points, 0);
  const score = Math.round(clamp(raw));

  // Aksi
  const st = cycle.stage.toLowerCase();
  let action: RecAction;
  if (score >= 70) action = "BELI";
  else if (score >= 58) action = cycle.phase === "MARKUP" && !st.startsWith("lanjut") ? "BELI" : "BELI_BERTAHAP";
  else if (score >= 44) action = "PANTAU";
  else if (score >= 30) action = cycle.phase === "MARKDOWN" ? "HINDARI" : "AMBIL_UNTUNG";
  else action = "HINDARI";
  if (action === "BELI" && cycle.phase === "AKUMULASI") action = "BELI_BERTAHAP";
  if ((action === "BELI" || action === "BELI_BERTAHAP") && plan.mode !== "BELI") action = "PANTAU";
  // Potensi untung lebih kecil dari risiko → jangan beli di harga sekarang.
  const rrBlocked =
    (action === "BELI" || action === "BELI_BERTAHAP") && plan.riskReward1 !== null && plan.riskReward1 < 1;
  if (rrBlocked) action = "PANTAU";

  // Alasan & peringatan dengan angka — diambil dari komponen skor terbesar.
  const reasons: string[] = [`${why}: ${cycle.summary.split(" — ")[0]}.`];
  const warnings: string[] = [];
  for (const it of items.filter((x) => x.label !== "Basis fase siklus" && x.label !== "Penyesuaian keyakinan fase").sort((a, b) => Math.abs(b.points) - Math.abs(a.points))) {
    const line = `${it.label} (${it.points > 0 ? "+" : ""}${String(it.points).replace(".", ",")}): ${it.detail}`;
    if (it.points > 0 && reasons.length < 5) reasons.push(line);
    if (it.points < 0 && warnings.length < 4) warnings.push(line);
  }
  if (rrBlocked) {
    warnings.unshift(
      `Aksi diturunkan ke Pantau: R/R 1:${plan.riskReward1!.toFixed(2).replace(".", ",")} < 1 dari tengah zona entry — potensi untung ke TP1 lebih kecil dari risiko.` +
        (plan.entryLow && plan.riskRewardAtLow !== null && plan.riskRewardAtLow >= 1
          ? ` Beli hanya di batas bawah ${rp(plan.entryLow.price)} (R/R 1:${plan.riskRewardAtLow.toFixed(2).replace(".", ",")}).`
          : " Tunggu struktur harga yang lebih baik."),
    );
  }
  const timingPending =
    (action === "BELI" || action === "BELI_BERTAHAP") && ctx.entry && ctx.entry.verdict !== "SIAP";
  if (timingPending && ctx.entry) {
    warnings.unshift(`Jangan buru-buru — timing: ${ctx.entry.label}. ${ctx.entry.waitFor[0] ?? ""}`.trim());
  }
  if (ind.atrPct !== null && ind.atrPct > 6) {
    warnings.push(`Volatilitas tinggi: ATR ${ind.atrPct.toFixed(1).replace(".", ",")}% dari harga — stop lebar, posisi diperkecil otomatis.`);
  }

  const position =
    action === "BELI"
      ? positionSize(plan, 1, "faktor aksi Beli 1")
      : action === "BELI_BERTAHAP"
        ? positionSize(plan, 0.6, "faktor aksi Beli Bertahap 0,6")
        : { pct: 0, basis: "Tidak ada alokasi baru pada aksi ini." };

  const horizon =
    timingPending
      ? `Tunggu konfirmasi timing dulu, lalu ${cycle.phase === "AKUMULASI" ? "cicil 1–3 bulan" : "ikuti tren 2–6 minggu"}`
      : action === "BELI" || action === "BELI_BERTAHAP"
      ? cycle.phase === "AKUMULASI"
        ? "1–3 bulan — cicil di zona entry, tambah saat breakout puncak rentang"
        : "2–6 minggu — ikuti tren, beli saat pullback ke zona entry"
      : action === "PANTAU"
        ? "Tunggu — masuk hanya bila harga turun ke zona entry atau skor membaik"
        : action === "AMBIL_UNTUNG"
          ? "Kurangi posisi saat harga memantul ke area jual"
          : "Jauhi sampai muncul tanda akumulasi";

  const buy = plan.mode === "BELI";
  return {
    action,
    label: REC_LABEL[action],
    score,
    horizon,
    entry: buy && plan.entryLow && plan.entryHigh ? { low: plan.entryLow.price, high: plan.entryHigh.price } : null,
    stopLoss: buy ? plan.stopLoss.price : null,
    target1: buy ? plan.target1.price : null,
    target2: buy ? plan.target2?.price ?? null : null,
    riskReward: buy ? plan.riskReward1 : null,
    reasons,
    warnings,
    breakdown: items,
    plan,
    position,
  };
}

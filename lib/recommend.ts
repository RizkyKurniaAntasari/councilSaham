import { clamp } from "./indicators";
import { IDEAL_RR, pct, positionSize, rp } from "./tradeplan";
import type { CycleReport, DataRecommendation, EntrySignal, IndicatorSet, RecAction, ScoreItem, TradePlan } from "./types";

/**
 * Rekomendasi berbasis data: skor 0–100 = basis fase siklus + penyesuaian
 * (aliran dana, momentum, volume, tren panjang, likuiditas, risk/reward).
 * Setiap penyesuaian dicatat di `breakdown` sehingga skor bisa dihitung ulang manual.
 * Level harga diambil dari `TradePlan` — sumber yang sama dengan Dewan Analis.
 *
 * Mesin yang sama dipakai untuk saham dan emas: aset non-saham mengirim faktor
 * tambahannya lewat `ctx.extra` dan mematikan penalti likuiditas bursa.
 */

export const REC_LABEL: Record<RecAction, string> = {
  BELI: "Beli",
  BELI_BERTAHAP: "Beli Bertahap",
  PANTAU: "Pantau",
  AMBIL_UNTUNG: "Ambil Untung / Kurangi",
  HINDARI: "Hindari",
};

/** Ambang skor → aksi. Satu sumber untuk logika dan teks penjelasannya. */
export const BUY_SCORE = 70;
export const BUY_STAGED_SCORE = 58;
export const WATCH_SCORE = 44;
export const TRIM_SCORE = 30;

/** Jarak harga di atas zona ideal (persen) yang membuat aksi beli tidak lagi realistis. */
export const MAX_CHASE_PCT = 10;

/** Ambang aksi — ditampilkan juga di UI agar pengguna tahu dari mana label berasal. */
export const REC_BANDS =
  `≥${BUY_SCORE} Beli · ${BUY_STAGED_SCORE}–${BUY_SCORE - 1} Beli (Mark Up) / Beli Bertahap · ${WATCH_SCORE}–${BUY_STAGED_SCORE - 1} Pantau · ` +
  `${TRIM_SCORE}–${WATCH_SCORE - 1} Ambil Untung (Hindari bila Mark Down, Pantau bila Akumulasi) · <${TRIM_SCORE} Hindari. ` +
  `Fase Akumulasi maksimal Beli Bertahap; R/R < 1, timing Hindari Dulu, atau harga > ${MAX_CHASE_PCT}% di atas zona ideal maksimal Pantau.`;

export { idxTick } from "./tradeplan";

/** Angka gaya Indonesia: koma desimal dan tanda minus tipografis. */
const id = (v: number, d = 1) => v.toFixed(d).replace(".", ",").replace("-", "−");

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

/** Arti fase dalam satu kalimat awam — dipakai di kalimat utama rekomendasi. */
const PHASE_PLAIN: Record<CycleReport["phase"], string> = {
  AKUMULASI: "harga bergerak datar setelah turun dan mulai dikumpulkan pembeli",
  MARKUP: "harga sedang dalam tren naik yang terstruktur",
  DISTRIBUSI: "harga tertahan di area atas dan mulai dilepas penjual",
  MARKDOWN: "harga sedang dalam tren turun",
};

export interface RecommendContext {
  price: number;
  avgValue20: number;
  plan: TradePlan;
  rs60?: { stock: number; ihsg: number } | null;
  entry?: EntrySignal | null;
  /** Faktor khusus aset (mis. dolar AS & imbal hasil untuk emas) — ikut dijumlahkan ke skor. */
  extra?: ScoreItem[];
  /** Lewati penalti likuiditas bursa (untuk aset yang bukan saham BEI). */
  skipLiquidity?: boolean;
  /** Kata benda aset untuk kalimat penjelasan. Bawaan: "saham". */
  noun?: string;
}

export function buildRecommendation(cycle: CycleReport, ind: IndicatorSet, ctx: RecommendContext): DataRecommendation {
  const { avgValue20, plan } = ctx;
  const noun = ctx.noun ?? "saham";
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
      headline: "Pantau dulu: riwayat harga terlalu pendek untuk dinilai.",
      steps: ["Tunggu sampai tersedia minimal 60 hari data perdagangan sebelum mengambil keputusan."],
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
    `Fase ini baru ${cycle.confidence}% pasti, jadi skornya ditarik mendekati netral (50): 50 + (${base} − 50) × ${id(factor, 2)} = ${id(shrunk)}.`,
  );

  // 2. Aliran dana (Chaikin Money Flow 40H)
  const cmf = cycle.metrics.cmf;
  if (cmf !== null) {
    const p = cmf > 0.1 ? 6 : cmf > 0.03 ? 3 : cmf < -0.1 ? -6 : cmf < -0.03 ? -3 : 0;
    const meaning =
      p >= 6 ? "Dana masuk kuat" : p > 0 ? "Dana mulai masuk" : p <= -6 ? "Dana keluar deras" : p < 0 ? "Dana mulai keluar" : "Aliran dana seimbang";
    add(
      "Aliran dana (CMF 40H)",
      p,
      `${meaning}: Chaikin Money Flow 40 hari ${id(cmf, 2)}. Aturan: >0,10 = +6, >0,03 = +3, <−0,03 = −3, <−0,10 = −6.`,
    );
  }

  // 3. Momentum MACD — arah histogram ikut dinilai, bukan hanya tandanya.
  if (ind.macd) {
    const { hist, histPrev } = ind.macd;
    const rising = histPrev === null ? null : hist > histPrev;
    let p: number;
    let meaning: string;
    if (hist > 0) {
      p = rising === false ? 2 : 4;
      meaning = rising === false ? "Momentum masih positif tetapi melemah" : "Momentum positif dan menguat";
    } else if (hist < 0) {
      p = rising === true ? -1 : -3;
      meaning = rising === true ? "Momentum masih negatif tetapi mulai membaik" : "Momentum negatif dan memburuk";
    } else {
      p = 0;
      meaning = "Momentum netral";
    }
    add(
      "Momentum MACD",
      p,
      `${meaning}: histogram MACD ${id(hist, 2)}${histPrev !== null ? ` (kemarin ${id(histPrev, 2)})` : ""}. ` +
        `Aturan: positif & naik = +4, positif & turun = +2, negatif & naik = −1, negatif & turun = −3.`,
    );
  }

  // 4. RSI
  const rsi = ind.rsi14;
  if (rsi !== null) {
    const p = rsi > 75 ? -8 : rsi < 30 && cycle.phase !== "MARKDOWN" ? 3 : rsi >= 50 && rsi <= 68 ? 3 : 0;
    const meaning =
      rsi > 75
        ? "Sudah jenuh beli — rawan koreksi"
        : rsi < 30
          ? cycle.phase === "MARKDOWN"
            ? "Jenuh jual, tetapi dalam tren turun itu belum tanda berbalik"
            : "Jenuh jual — berpeluang memantul"
          : rsi >= 50 && rsi <= 68
            ? "Momentum sehat, belum jenuh beli"
            : "Momentum netral";
    add("RSI(14)", p, `${meaning}: RSI ${id(rsi)}. Aturan: >75 = −8, 50–68 = +3, <30 di luar Mark Down = +3.`);
  }

  // 5. Konfirmasi volume hari terakhir
  const vr = ind.volume?.ratio20 ?? null;
  if (vr !== null && vr >= 2) {
    const up = (ind.return1d ?? 0) > 0;
    add(
      "Konfirmasi volume",
      up ? 5 : -5,
      `${up ? "Kenaikan didukung volume besar" : "Penurunan disertai volume besar (tekanan jual nyata)"}: volume ${id(vr)}× rata-rata 20 hari saat harga ${pct(ind.return1d ?? 0)}. Aturan: volume ≥ 2× saat naik = +5, saat turun = −5.`,
    );
  }

  // 6. Tren jangka panjang
  if (ind.ma200 !== null) {
    const above = ctx.price > ind.ma200;
    add(
      "Tren panjang (MA200)",
      above ? 2 : -2,
      `Harga ${above ? "di atas" : "di bawah"} rata-rata 200 hari ${rp(ind.ma200)} — tren jangka panjang ${above ? "naik" : "turun"}. Aturan: di atas = +2, di bawah = −2.`,
    );
  }

  // 6b. Kekuatan relatif vs IHSG (60 hari bursa)
  if (ctx.rs60) {
    const gap = ctx.rs60.stock - ctx.rs60.ihsg;
    const p = gap > 5 ? 3 : gap < -5 ? -3 : 0;
    add(
      "Kekuatan relatif vs IHSG",
      p,
      `${p > 0 ? "Lebih kuat dari pasar" : "Lebih lemah dari pasar"}: 60 hari terakhir ${noun} ${pct(ctx.rs60.stock)} vs IHSG ${pct(ctx.rs60.ihsg)}, selisih ${gap >= 0 ? "+" : "−"}${id(Math.abs(gap))} poin. Aturan: >+5 = +3, <−5 = −3.`,
    );
  }

  // 6c. Faktor khusus aset
  for (const x of ctx.extra ?? []) add(x.label, x.points, x.detail);

  // 6d. Timing entry (struktur MA + pola candle + perlawanan pembeli)
  if (ctx.entry) {
    const e = ctx.entry;
    const p = e.verdict === "SIAP" ? 4 : e.verdict === "BELUM" ? -2 : e.verdict === "HINDARI" ? -6 : 0;
    add(
      "Timing entry",
      p,
      `${e.label} (kesiapan ${e.score}/100). Aturan: Siap Beli = +4, Tunggu = 0, Belum Ada Setup = −2, Hindari Dulu = −6.`,
    );
  }

  // 7. Likuiditas
  if (!ctx.skipLiquidity) {
    const liqM = avgValue20 / 1e9;
    if (avgValue20 < 1e9)
      add("Likuiditas", -10, `Sulit keluar-masuk: nilai transaksi rata-rata 20 hari hanya Rp${id(liqM, 2)} miliar/hari (< Rp1 miliar = −10).`);
    else if (avgValue20 < 5e9)
      add("Likuiditas", -4, `Kurang likuid: nilai transaksi rata-rata 20 hari Rp${id(liqM)} miliar/hari (< Rp5 miliar = −4).`);
  }

  // 7b. Posisi harga terhadap zona ideal (zona dihitung dari stop & target, bukan dari harga terakhir)
  if (plan.mode === "BELI" && plan.noRoom) {
    add(
      "Tidak ada ruang R/R",
      -8,
      `Target ${rp(plan.target1.price)} terlalu dekat dengan stop ${rp(plan.stopLoss.price)} — tidak ada harga beli yang memberi potensi untung ${IDEAL_RR}× risikonya.`,
    );
  } else if (plan.mode === "BELI" && plan.priceVsZone === "DI_ATAS" && plan.entryHigh) {
    add(
      "Harga di atas zona ideal",
      -5,
      `Harga sudah ${pct(plan.distToZonePct ?? 0)} di atas batas zona beli ${rp(plan.entryHigh.price)} — membeli sekarang berarti R/R di bawah 1:${IDEAL_RR}.`,
    );
  }

  // 8. Risk/reward rencana
  if (plan.mode === "BELI" && plan.riskReward1 !== null && plan.riskReward1 < 1.2) {
    add("Risk/reward kurang", -6, `Potensi untung ke target 1 hanya ${id(plan.riskReward1, 2)}× risikonya (di bawah 1,2×).`);
  }

  // Skor = jumlah semua komponen, dibatasi ke 0–100. Pembatasan dicatat sebagai
  // komponen sendiri supaya total rincian selalu sama dengan skor akhir.
  const rawSum = items.reduce((a, b) => a + b.points, 0);
  const bounded = clamp(rawSum);
  if (bounded !== rawSum) {
    add("Batas skor 0–100", bounded - rawSum, `Jumlah komponen ${id(rawSum)} melewati rentang skor, dibatasi ke ${bounded}.`);
  }
  const score = Math.round(bounded);

  // Aksi
  const st = cycle.stage.toLowerCase();
  let action: RecAction;
  if (score >= BUY_SCORE) action = "BELI";
  else if (score >= BUY_STAGED_SCORE) action = cycle.phase === "MARKUP" && !st.startsWith("lanjut") ? "BELI" : "BELI_BERTAHAP";
  else if (score >= WATCH_SCORE) action = "PANTAU";
  else if (score >= TRIM_SCORE)
    // "Ambil untung" hanya masuk akal bila ada kenaikan yang bisa diambil (Mark Up / Distribusi).
    // Akumulasi yang lemah = belum siap → Pantau; Mark Down = Hindari.
    action = cycle.phase === "MARKDOWN" ? "HINDARI" : cycle.phase === "AKUMULASI" ? "PANTAU" : "AMBIL_UNTUNG";
  else action = "HINDARI";
  if (action === "BELI" && cycle.phase === "AKUMULASI") action = "BELI_BERTAHAP";
  const isBuy = () => action === "BELI" || action === "BELI_BERTAHAP";

  // Pembatas: label beli tidak boleh bertentangan dengan rencana atau timing.
  // Yang pertama terpenuhi dicatat sebagai alasan utama penurunan ke Pantau.
  let blocker: "MODE" | "NO_ROOM" | "RR" | "TIMING" | "FAR" | null = null;
  if (isBuy()) {
    if (plan.mode !== "BELI") blocker = "MODE";
    else if (plan.noRoom) blocker = "NO_ROOM";
    // Potensi untung lebih kecil dari risiko → jangan beli di harga sekarang.
    else if (plan.riskReward1 !== null && plan.riskReward1 < 1) blocker = "RR";
    // Timing menyatakan "Hindari Dulu" (pola bearish kuat / struktur turun).
    else if (ctx.entry?.verdict === "HINDARI") blocker = "TIMING";
    // Zona ideal terlalu jauh di bawah harga → "beli" tidak bisa dieksekusi di harga sekarang.
    else if (plan.priceVsZone === "DI_ATAS" && (plan.distToZonePct ?? 0) > MAX_CHASE_PCT && plan.entryLow && plan.entryHigh)
      blocker = "FAR";
  }
  if (blocker) action = "PANTAU";

  const buyPlan = plan.mode === "BELI" && !!plan.entryLow && !!plan.entryHigh;
  const zone = buyPlan ? `${rp(plan.entryLow!.price)}–${rp(plan.entryHigh!.price)}` : null;

  // Alasan & peringatan dengan angka — diambil dari komponen skor terbesar.
  // Baris fase: pendukung bila fasenya bullish (Akumulasi / Mark Up), pemberat bila bearish.
  const phaseLine = `${why}: ${cycle.summary.split(" — ")[0]}.`;
  const bullishPhase = cycle.phase === "AKUMULASI" || cycle.phase === "MARKUP";
  const reasons: string[] = bullishPhase ? [phaseLine] : [];
  const warnings: string[] = [];
  const scored = items
    .filter((x) => x.label !== "Basis fase siklus" && x.label !== "Penyesuaian keyakinan fase" && x.label !== "Batas skor 0–100")
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  for (const it of scored) {
    const line = `${it.label} (${it.points > 0 ? "+" : "−"}${String(Math.abs(it.points)).replace(".", ",")} poin): ${it.detail}`;
    if (it.points > 0 && reasons.length < 5) reasons.push(line);
    if (it.points < 0 && warnings.length < 4) warnings.push(line);
  }

  if (!bullishPhase) warnings.unshift(phaseLine);

  let blockerText = "";
  if (blocker === "RR") {
    blockerText =
      `potensi untung ke target 1 hanya ${id(plan.riskReward1!, 2)}× risikonya (kurang dari 1×) bila beli di tengah zona.` +
      (plan.entryLow && plan.riskRewardAtLow !== null && plan.riskRewardAtLow >= 1
        ? ` Beli hanya di batas bawah ${rp(plan.entryLow.price)} (R/R 1:${id(plan.riskRewardAtLow, 2)}).`
        : " Tunggu struktur harga yang lebih baik.");
  } else if (blocker === "TIMING" && ctx.entry) {
    blockerText = `timing ${ctx.entry.label} — ${ctx.entry.situation}`.trim();
  } else if (blocker === "FAR") {
    blockerText = `harga ${rp(ctx.price)} sudah ${pct(plan.distToZonePct ?? 0)} di atas zona beli ideal ${zone} (batas ${MAX_CHASE_PCT}%). Antre di zona itu atau tunggu struktur baru terbentuk.`;
  } else if (blocker === "NO_ROOM") {
    blockerText = `target ${rp(plan.target1.price)} terlalu dekat dengan stop ${rp(plan.stopLoss.price)} — tidak ada ruang untung yang sepadan dengan risikonya.`;
  } else if (blocker === "MODE") {
    blockerText = "fase siklus belum mendukung pembelian.";
  }
  if (blocker) warnings.unshift(`Aksi diturunkan ke Pantau: ${blockerText}`);

  const chasing = isBuy() && plan.priceVsZone === "DI_ATAS" && buyPlan;
  if (chasing) {
    warnings.unshift(
      `Jangan kejar harga: ${rp(ctx.price)} sudah ${pct(plan.distToZonePct ?? 0)} di atas zona ideal. Antre beli di ${zone} (R/R ≥ 1:${IDEAL_RR}).`,
    );
  }
  const timingPending = isBuy() && !!ctx.entry && ctx.entry.verdict !== "SIAP";
  if (timingPending && ctx.entry) {
    warnings.unshift(`Jangan buru-buru — timing: ${ctx.entry.label}. ${ctx.entry.waitFor[0] ?? ""}`.trim());
  }
  if (ind.atrPct !== null && ind.atrPct > 6) {
    warnings.push(`Volatilitas tinggi: ATR ${id(ind.atrPct)}% dari harga — stop lebar, posisi diperkecil otomatis.`);
  }

  const position =
    action === "BELI"
      ? positionSize(plan, 1, "faktor aksi Beli 1")
      : action === "BELI_BERTAHAP"
        ? positionSize(plan, 0.6, "faktor aksi Beli Bertahap 0,6")
        : { pct: 0, basis: "Tidak ada alokasi baru pada aksi ini." };

  const follow = cycle.phase === "AKUMULASI" ? "cicil 1–3 bulan" : "ikuti tren 2–6 minggu";
  const horizon = chasing
    ? `Antre beli di zona ideal ${zone}, lalu ${follow}`
    : timingPending
      ? `Tunggu konfirmasi timing dulu, lalu ${follow}`
      : isBuy()
        ? cycle.phase === "AKUMULASI"
          ? "1–3 bulan — cicil di zona entry, tambah saat breakout puncak rentang"
          : "2–6 minggu — ikuti tren, beli saat pullback ke zona entry"
        : action === "PANTAU"
          ? "Tunggu — masuk hanya bila harga turun ke zona entry atau skor membaik"
          : action === "AMBIL_UNTUNG"
            ? "Kurangi posisi saat harga memantul ke area jual"
            : "Jauhi sampai muncul tanda akumulasi";

  /* ---------------- Penjelasan awam: kalimat utama + langkah ---------------- */
  const posItems = scored.filter((x) => x.points > 0);
  const negItems = scored.filter((x) => x.points < 0);
  const sumOf = (xs: ScoreItem[]) => xs.reduce((a, b) => a + b.points, 0);
  // Nilai dasar = basis fase setelah disesuaikan keyakinannya (dua komponen pertama).
  const baseValue = sumOf(items.filter((x) => x.label === "Basis fase siklus" || x.label === "Penyesuaian keyakinan fase"));
  const tally =
    `nilai dasar fase ${id(baseValue)}` +
    (posItems.length ? `, ditambah ${id(sumOf(posItems))} dari ${posItems.length} faktor pendukung` : ", tanpa faktor pendukung") +
    (negItems.length ? `, dikurangi ${id(Math.abs(sumOf(negItems)))} dari ${negItems.length} faktor pemberat` : ", tanpa faktor pemberat") +
    (bounded !== rawSum ? " (dibatasi ke rentang 0–100)" : "");
  const phasePlain = PHASE_PLAIN[cycle.phase];
  const rr = plan.riskReward1;
  /** Syarat timing pertama, tanpa awalan huruf skenario ("A · "). */
  const waitFor = ctx.entry?.waitFor[0]?.replace(/^[A-Z] · /, "") ?? null;
  const steps: string[] = [];
  let headline: string;

  if (isBuy()) {
    headline =
      `${REC_LABEL[action]} — skor ${score}/100. Fase ${cycle.label}: ${phasePlain}. Hitungannya: ${tally}.` +
      (chasing ? " Tetapi jangan beli di harga sekarang — tunggu di zona beli." : "");
    if (chasing) steps.push(`Pasang antrean beli di ${zone}. Harga sekarang ${rp(ctx.price)} terlalu tinggi untuk risiko yang sepadan.`);
    else if (plan.priceVsZone === "DI_BAWAH")
      steps.push(`Harga ${rp(ctx.price)} sudah di bawah zona beli ${zone} — tunggu harga kembali masuk zona; jangan beli saat masih turun.`);
    else
      steps.push(
        `Harga ${rp(ctx.price)} berada di zona beli ${zone} — boleh mulai masuk${action === "BELI_BERTAHAP" ? " bertahap (mis. 2–3 kali cicil), jangan sekaligus" : ""}.`,
      );
    // Saat harga di atas zona, langkah pertama sudah berisi antrean di zona — jangan diulang.
    if (timingPending && waitFor && !chasing) steps.push(`Tunggu konfirmasi dulu: ${waitFor}`);
    steps.push(
      `Pasang stop loss di ${rp(plan.stopLoss.price)}${plan.riskPct !== null ? ` (rugi ±${id(plan.riskPct)}% dari tengah zona)` : ""}. Bila harga ditutup di bawahnya, keluar tanpa menunggu.`,
    );
    steps.push(
      `Ambil untung sebagian di ${rp(plan.target1.price)}${plan.rewardPct !== null ? ` (untung ±${id(plan.rewardPct)}%)` : ""}` +
        (plan.target2 ? `, sisanya di ${rp(plan.target2.price)}` : "") +
        (rr !== null ? `. Tiap 1 bagian risiko berpotensi untung ${id(rr, 2)} bagian (R/R 1:${id(rr, 2)}).` : "."),
    );
    if (position.pct > 0)
      steps.push(`Pakai maksimal ±${String(position.pct).replace(".", ",")}% portofolio, supaya kalau stop loss kena kerugiannya tetap kecil.`);
  } else if (action === "PANTAU") {
    headline = blocker
      ? `Pantau dulu — skor ${score}/100 sebenarnya cukup untuk beli, tetapi ${blockerText}`
      : `Pantau dulu — skor ${score}/100 belum mencapai ${BUY_STAGED_SCORE} (ambang beli). Fase ${cycle.label}: ${phasePlain}. Hitungannya: ${tally}.`;
    if (buyPlan && !plan.noRoom)
      steps.push(`Belum perlu beli. Kalau mau bersiap, zona beli yang sepadan risikonya ada di ${zone} (stop ${rp(plan.stopLoss.price)}).`);
    else if (plan.reentry) steps.push(`Belum perlu beli. Pertimbangkan lagi hanya bila harga ditutup di atas ${rp(plan.reentry.price)}.`);
    else steps.push("Belum perlu beli — tunggu struktur harga yang memberi ruang untung lebih besar dari risikonya.");
    if (waitFor) steps.push(`Yang ditunggu: ${waitFor}`);
    steps.push(`Bagi yang sudah punya: tahan selama harga tidak ditutup di bawah ${rp(plan.stopLoss.price)}.`);
  } else if (action === "AMBIL_UNTUNG") {
    headline = `Ambil untung / kurangi — skor ${score}/100. Fase ${cycle.label}: ${phasePlain}. Hitungannya: ${tally}.`;
    steps.push(`Jangan menambah posisi. Jual sebagian saat harga memantul ke sekitar ${rp(plan.target1.price)}.`);
    steps.push(`Keluar seluruhnya bila harga ditutup di bawah ${rp(plan.stopLoss.price)}.`);
    if (plan.reentry) steps.push(`Beli kembali hanya bila harga ditutup di atas ${rp(plan.reentry.price)} dengan volume besar.`);
  } else {
    headline = `Hindari — skor ${score}/100. Fase ${cycle.label}: ${phasePlain}. Hitungannya: ${tally}.`;
    steps.push(`Jangan beli sekarang — ${noun} yang sedang turun bisa terus turun; murah belum tentu sudah dasar.`);
    steps.push(
      plan.mode === "PEGANG"
        ? `Bagi yang masih memegang: keluar bila harga ditutup di bawah ${rp(plan.stopLoss.price)}, atau jual saat memantul ke ${rp(plan.target1.price)}.`
        : `Bagi yang masih memegang: keluar bila harga ditutup di bawah ${rp(plan.stopLoss.price)}.`,
    );
    if (plan.reentry) steps.push(`Lihat lagi hanya bila harga ditutup di atas ${rp(plan.reentry.price)} — tanda tren mulai berbalik.`);
  }

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
    headline,
    steps,
  };
}

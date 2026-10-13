import { clamp } from "./indicators";
import { pct, positionSize } from "./tradeplan";
import type {
  CouncilMember,
  CouncilVerdict,
  FundamentalReport,
  MomentumReport,
  NewsReport,
  QuoteSnapshot,
  Stance,
  TechnicalReport,
  TradePlan,
} from "./types";

function stanceOf(score: number): Stance {
  if (score >= 78) return "STRONG_BUY";
  if (score >= 63) return "BUY";
  if (score >= 45) return "HOLD";
  if (score >= 32) return "REDUCE";
  return "SELL";
}

export function stanceLabel(s: Stance): string {
  switch (s) {
    case "STRONG_BUY":
      return "Akumulasi Kuat";
    case "BUY":
      return "Beli / Akumulasi";
    case "HOLD":
      return "Tahan / Wait & See";
    case "REDUCE":
      return "Kurangi Posisi";
    case "SELL":
      return "Jual / Hindari";
  }
}

function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(v)}`;
}

export function buildCouncil(
  fundamental: FundamentalReport,
  technical: TechnicalReport,
  news: NewsReport,
  momentum: MomentumReport,
  quote: QuoteSnapshot,
  plan?: TradePlan,
): CouncilVerdict {
  const ind = technical.indicators;
  const members: CouncilMember[] = [];

  /* 1. Analis Fundamental ------------------------------------------------ */
  {
    const score = fundamental.available ? fundamental.score : 50;
    const rationale: string[] = [];
    const concerns: string[] = [];
    if (fundamental.available) {
      rationale.push(`Skor fundamental ${fundamental.score}/100 (grade ${fundamental.grade}) dari ${fundamental.metrics.length} metrik terukur.`);
      rationale.push(...fundamental.highlights.slice(0, 3));
      concerns.push(...fundamental.risks.slice(0, 3));
      const f = fundamental.financials;
      if (f.per !== undefined && f.per > 0 && f.earningsGrowth !== undefined) {
        const peg = f.earningsGrowth > 0 ? f.per / f.earningsGrowth : null;
        if (peg !== null) {
          rationale.push(
            `PEG ≈ ${peg.toFixed(2)} — ${peg < 1 ? "valuasi masih tertinggal dibanding laju pertumbuhan laba" : "valuasi sudah memperhitungkan pertumbuhan"}.`,
          );
        }
      }
    } else {
      concerns.push("Laporan keuangan tidak dapat diambil — penilaian fundamental tidak bisa dilakukan dan bobot suara saya diturunkan.");
    }
    members.push({
      id: "fundamental",
      name: "Analis Fundamental",
      role: "Menilai kualitas bisnis, valuasi, dan kesehatan neraca",
      emoji: "📊",
      score,
      stance: stanceOf(score),
      confidence: fundamental.available ? clamp(45 + fundamental.metrics.length * 5) : 20,
      weight: fundamental.available ? 1.6 : 0.4,
      rationale,
      concerns,
    });
  }

  /* 2. Analis Teknikal --------------------------------------------------- */
  {
    const score = technical.available ? technical.score : 50;
    const rationale: string[] = [];
    const concerns: string[] = [];
    if (technical.available) {
      rationale.push(`${technical.phase}; kekuatan tren: ${technical.trendStrength.toLowerCase()}.`);
      rationale.push(...technical.highlights.slice(0, 3));
      concerns.push(...technical.risks.slice(0, 3));
      if (technical.patterns.length) rationale.push(`Pola terdeteksi: ${technical.patterns.slice(0, 2).join("; ")}.`);
      if (technical.levels.riskRewardRatio !== null) {
        const rr = technical.levels.riskRewardRatio;
        (rr >= 2 ? rationale : concerns).push(
          `Risk/reward ke target pertama ≈ 1:${rr.toFixed(2)} — ${rr >= 2 ? "rasio menarik" : "rasio kurang ideal, butuh entry lebih rendah"}.`,
        );
      }
    } else {
      concerns.push("Riwayat harga tidak cukup untuk analisis teknikal.");
    }
    members.push({
      id: "teknikal",
      name: "Analis Teknikal",
      role: "Membaca tren, momentum harga, dan level kunci",
      emoji: "📈",
      score,
      stance: stanceOf(score),
      confidence: technical.available ? Math.round(clamp(55 + (ind.adx14 ?? 20))) : 20,
      weight: technical.available ? 1.4 : 0.4,
      rationale,
      concerns,
    });
  }

  /* 3. Analis Sentimen & Berita ------------------------------------------ */
  {
    const score = news.available ? news.score : 50;
    const rationale: string[] = [];
    const concerns: string[] = [];
    if (news.available) {
      rationale.push(
        `${news.counts.total} berita relevan (${news.counts.positive} positif / ${news.counts.negative} negatif / ${news.counts.neutral} netral), intensitas ${news.buzz.buzzLevel.toLowerCase()}.`,
      );
      if (news.topThemes.length) {
        rationale.push(`Tema dominan: ${news.topThemes.slice(0, 3).map((t) => t.theme).join(", ")}.`);
      }
      rationale.push(...news.highlights.slice(0, 2));
      concerns.push(...news.risks.slice(0, 3));
    } else {
      concerns.push("Tidak ada berita relevan yang bisa dijadikan dasar — kekosongan informasi itu sendiri adalah risiko.");
    }
    members.push({
      id: "sentimen",
      name: "Analis Sentimen & Berita",
      role: "Mengukur nada dan intensitas pemberitaan publik",
      emoji: "📰",
      score,
      stance: stanceOf(score),
      confidence: clamp(25 + news.counts.total * 4),
      weight: news.available ? 1.0 : 0.3,
      rationale,
      concerns,
    });
  }

  /* 4. Validator Momentum & Story ---------------------------------------- */
  {
    // Hanya story bertema katalis spesifik emiten yang dihitung sebagai bukti;
    // "obrolan pasar" (rekomendasi harian, pergerakan harga, makro) tidak menaikkan skor.
    const validated = momentum.stories.filter(
      (s) => s.verdict === "TERVALIDASI" && s.grade === "utama",
    );
    const suspicious = momentum.stories.filter((s) => s.verdict === "MENCURIGAKAN");
    let score = momentum.score;
    if (validated.length) score = clamp(score + validated.length * 6);
    if (suspicious.length) score = clamp(score - suspicious.length * 18);
    if (momentum.flags.length) score = clamp(score - momentum.flags.length * 5);

    const rationale: string[] = [momentum.summary];
    const concerns: string[] = [...momentum.flags, ...momentum.divergence];
    for (const s of validated.slice(0, 2)) {
      rationale.push(`Story tervalidasi — ${s.theme} (kekuatan ${s.strength}/100): ${s.title}`);
    }
    for (const s of suspicious.slice(0, 2)) {
      concerns.push(`Story mencurigakan — ${s.theme}: kenaikan harga tidak sebanding dengan bukti pendukung.`);
    }
    members.push({
      id: "momentum",
      name: "Validator Momentum & Story",
      role: "Memverifikasi apakah narasi pasar didukung data harga, volume, dan fundamental",
      emoji: "🔍",
      score,
      stance: stanceOf(score),
      confidence: clamp(35 + momentum.stories.length * 12 + news.counts.total * 2),
      weight: 1.3,
      rationale,
      concerns,
    });
  }

  /* 5. Manajer Risiko ---------------------------------------------------- */
  {
    let score = 70;
    const rationale: string[] = [];
    const concerns: string[] = [];

    const atrPct = ind.atrPct;
    if (atrPct !== null) {
      if (atrPct > 6) {
        score -= 22;
        concerns.push(`Volatilitas harian sangat tinggi (ATR ${atrPct.toFixed(1)}% dari harga) — potensi swing ekstrem.`);
      } else if (atrPct > 3.5) {
        score -= 10;
        concerns.push(`Volatilitas di atas rata-rata (ATR ${atrPct.toFixed(1)}%).`);
      } else {
        score += 6;
        rationale.push(`Volatilitas terkendali (ATR ${atrPct.toFixed(1)}% dari harga).`);
      }
    }

    const der = fundamental.financials.der;
    if (der !== undefined) {
      if (der > 180) {
        score -= 18;
        concerns.push(`Leverage tinggi (DER ${der.toFixed(0)}%) — sensitif terhadap suku bunga dan pelemahan arus kas.`);
      } else if (der < 70) {
        score += 8;
        rationale.push(`Struktur permodalan konservatif (DER ${der.toFixed(0)}%).`);
      }
    }

    const dd = ind.distFrom52wHigh;
    if (dd !== null && dd < -35) {
      score -= 8;
      concerns.push(`Harga ${Math.abs(dd).toFixed(0)}% di bawah puncak 52 minggu — tren jangka panjang sedang rusak.`);
    }

    const liquidity = quote.avgVolume3m ?? ind.volume?.avg20 ?? 0;
    const turnover = liquidity * quote.price;
    if (turnover > 0 && turnover < 2e9) {
      score -= 14;
      concerns.push("Likuiditas harian tipis (nilai transaksi rata-rata di bawah ~Rp 2 miliar) — sulit keluar posisi besar tanpa menggerakkan harga.");
    } else if (turnover >= 5e10) {
      score += 6;
      rationale.push("Likuiditas sangat baik — mudah masuk dan keluar posisi.");
    }

    if (fundamental.financials.freeCashflow !== undefined && fundamental.financials.freeCashflow < 0) {
      score -= 8;
      concerns.push("Arus kas bebas negatif — risiko pendanaan lanjutan (rights issue/utang baru).");
    }

    if (momentum.flags.length) {
      score -= momentum.flags.length * 6;
      concerns.push("Terdapat anomali harga/volume yang belum terjelaskan.");
    }

    score = clamp(score);
    if (!concerns.length) rationale.push("Tidak ada faktor risiko struktural yang menonjol pada data yang tersedia.");

    members.push({
      id: "risiko",
      name: "Manajer Risiko",
      role: "Menjaga modal: volatilitas, leverage, likuiditas, dan skenario terburuk",
      emoji: "🛡️",
      score,
      stance: stanceOf(score),
      confidence: 70,
      weight: 1.5,
      rationale,
      concerns,
    });
  }

  /* 6. Kontrarian -------------------------------------------------------- */
  {
    const rsi = ind.rsi14 ?? 50;
    const fundScore = fundamental.available ? fundamental.score : 50;
    let score = 50;
    const rationale: string[] = [];
    const concerns: string[] = [];

    if (rsi < 35 && fundScore >= 60) {
      score = 78;
      rationale.push(`Pasar sedang pesimistis (RSI ${rsi.toFixed(0)}) padahal fundamental masih solid (${fundScore}/100) — inilah titik di mana peluang biasanya muncul.`);
    } else if (rsi > 72 && momentum.score > 70) {
      score = 26;
      concerns.push(`Semua orang sudah bullish (RSI ${rsi.toFixed(0)}, momentum ${momentum.score}/100) — pembeli marginal makin sedikit, risiko pembalikan meningkat.`);
    } else if (news.avgSentiment > 0.35 && fundScore < 45) {
      score = 30;
      concerns.push("Berita ramai positif tapi fundamental lemah — narasi berlari mendahului angka.");
    } else if (news.avgSentiment < -0.3 && fundScore >= 62) {
      score = 72;
      rationale.push("Berita negatif menekan harga sementara kualitas bisnis tidak berubah — potensi salah harga.");
    } else {
      score = clamp(50 + (fundScore - 50) * 0.4 - (momentum.score - 50) * 0.25);
      rationale.push("Tidak ada ekstrem sentimen yang jelas; posisi kontrarian netral.");
    }

    const dd = ind.distFrom52wHigh ?? 0;
    if (dd < -50 && fundScore < 45) {
      score = clamp(score - 15);
      concerns.push("Saham sudah turun dalam dengan fundamental lemah — hati-hati 'value trap', murah bisa jadi makin murah.");
    }

    members.push({
      id: "kontrarian",
      name: "Kontrarian",
      role: "Menantang konsensus dan mencari sisi yang diabaikan pasar",
      emoji: "🎯",
      score,
      stance: stanceOf(score),
      confidence: 60,
      weight: 0.9,
      rationale,
      concerns,
    });
  }

  /* 7. Strategis Portofolio ---------------------------------------------- */
  {
    const cap = quote.marketCap ?? 0;
    let score = 55;
    const rationale: string[] = [];
    const concerns: string[] = [];

    if (cap >= 5e13) {
      score += 12;
      rationale.push("Kapitalisasi besar (big cap) — cocok sebagai inti portofolio, biasanya diikuti dana institusi.");
    } else if (cap >= 5e12) {
      score += 6;
      rationale.push("Kapitalisasi menengah — keseimbangan antara pertumbuhan dan stabilitas.");
    } else if (cap > 0) {
      score -= 6;
      concerns.push("Kapitalisasi kecil — bobot portofolio sebaiknya dibatasi karena risiko spesifik tinggi.");
    }

    const dy = fundamental.financials.dividendYield;
    if (dy !== undefined && dy > 4) {
      score += 8;
      rationale.push(`Yield dividen ${dy.toFixed(1)}% memberi bantalan imbal hasil saat harga stagnan.`);
    }

    const consistency = [fundamental.available ? fundamental.score : null, technical.available ? technical.score : null, news.available ? news.score : null].filter(
      (v): v is number => v !== null,
    );
    if (consistency.length >= 2) {
      const spread = Math.max(...consistency) - Math.min(...consistency);
      if (spread < 20) {
        score += 8;
        rationale.push("Fundamental, teknikal, dan sentimen sejalan — tesis lebih kokoh untuk dipegang.");
      } else if (spread > 45) {
        score -= 8;
        concerns.push("Terjadi perbedaan tajam antar dimensi analisis — tesis belum jernih, sebaiknya masuk bertahap.");
      }
    }

    if (technical.trend === "UPTREND" && fundamental.available && fundamental.score >= 60) {
      score += 10;
      rationale.push("Kombinasi tren naik + fundamental sehat adalah setup yang paling layak dipegang jangka menengah.");
    }

    members.push({
      id: "strategis",
      name: "Strategis Portofolio",
      role: "Menempatkan saham ini dalam konteks portofolio dan horizon investasi",
      emoji: "🧭",
      score: clamp(score),
      stance: stanceOf(clamp(score)),
      confidence: 65,
      weight: 1.1,
      rationale,
      concerns,
    });
  }

  /* --- Agregasi --------------------------------------------------------- */
  const totalWeight = members.reduce((a, m) => a + m.weight, 0);
  const score = Math.round(members.reduce((a, m) => a + m.score * m.weight, 0) / totalWeight);
  const stance = stanceOf(score);

  const mean = members.reduce((a, m) => a + m.score, 0) / members.length;
  const sd = Math.sqrt(members.reduce((a, m) => a + (m.score - mean) ** 2, 0) / members.length);
  const disagreement = Math.round(sd);

  const avgConfidence = members.reduce((a, m) => a + m.confidence * m.weight, 0) / totalWeight;
  const confidence = Math.round(clamp(avgConfidence - sd * 1.2));

  const bullish = members.filter((m) => m.score >= 60).length;
  const bearish = members.filter((m) => m.score <= 40).length;
  const consensus =
    sd < 10
      ? `Konsensus kuat — ${bullish} anggota bullish, ${bearish} bearish, sisanya netral.`
      : sd < 20
        ? `Konsensus moderat dengan perbedaan pandangan wajar (${bullish} bullish vs ${bearish} bearish).`
        : `Dewan terbelah tajam (${bullish} bullish vs ${bearish} bearish) — keyakinan diturunkan dan disarankan masuk bertahap.`;

  // Ukuran posisi berbasis risiko: faktor sikap × faktor keyakinan dewan.
  const stanceFactor = stance === "STRONG_BUY" ? 1 : stance === "BUY" ? 0.75 : 0;
  const confFactor = confidence >= 70 ? 1 : confidence >= 50 ? 0.8 : 0.5;
  const rrDead = !!plan && plan.riskReward1 !== null && plan.riskReward1 < 1 && !(plan.riskRewardAtLow !== null && plan.riskRewardAtLow >= 1);
  const position = plan && !rrDead
    ? positionSize(
        plan,
        stanceFactor * confFactor,
        `faktor sikap ${stanceFactor.toString().replace(".", ",")} (${stanceLabel(stance)}) × faktor keyakinan ${confFactor.toString().replace(".", ",")} (keyakinan dewan ${confidence}%)`,
      )
    : { pct: 0, basis: rrDead ? "0% — risk/reward < 1 di seluruh zona entry." : "Rencana transaksi tidak tersedia." };

  const horizon =
    momentum.stories.some((s) => s.verdict === "TERVALIDASI" && s.impactHorizon.includes("panjang"))
      ? "6–24 bulan (tesis struktural)"
      : technical.trend === "UPTREND"
        ? "1–6 bulan (mengikuti tren)"
        : "Tunggu konfirmasi — belum ada horizon yang jelas";

  const keyReasons = Array.from(
    new Set(
      members
        .filter((m) => m.score >= 58)
        .sort((a, b) => b.score * b.weight - a.score * a.weight)
        .flatMap((m) => m.rationale.slice(0, 2))
        .filter(Boolean),
    ),
  ).slice(0, 6);

  const keyRisks = Array.from(
    new Set(members.flatMap((m) => m.concerns).filter(Boolean)),
  ).slice(0, 7);

  const watchlist: string[] = [];
  if (plan?.mode === "BELI" && plan.entryLow) {
    watchlist.push(`Zona entry ${fmtPrice(plan.entryLow.price)}–${fmtPrice(plan.entryHigh?.price)}: masuk hanya di zona ini, jangan mengejar di atasnya.`);
  } else if (plan?.reentry) {
    watchlist.push(`Penutupan di atas ${fmtPrice(plan.reentry.price)} dengan volume > 1,5× rata-rata = tanda awal pembalikan.`);
  }
  if (technical.resistances.length) watchlist.push(`Tembus ${fmtPrice(technical.resistances[0])} dengan volume > 1,5x rata-rata = konfirmasi lanjutan tren.`);
  if (technical.supports[0]) watchlist.push(`Penutupan di bawah ${fmtPrice(technical.supports[0])} membatalkan tesis beli jangka pendek.`);
  watchlist.push("Rilis laporan keuangan kuartalan berikutnya — cek apakah pertumbuhan laba mengonfirmasi narasi.");
  if (momentum.stories.length) {
    watchlist.push(`Perkembangan story "${momentum.stories[0].theme}" — butuh konfirmasi rilis resmi emiten, bukan sekadar pemberitaan.`);
  }
  watchlist.push("Keterbukaan informasi IDX (IDXnet) untuk aksi korporasi & transaksi afiliasi.");

  let narrative = buildRuleNarrative(score, stance, members, momentum, technical, fundamental, news, disagreement);
  if ((stance === "STRONG_BUY" || stance === "BUY") && plan?.riskReward1 != null && plan.riskReward1 < 1) {
    narrative += ` Namun di harga sekarang risk/reward ke TP1 hanya 1:${plan.riskReward1.toFixed(2).replace(".", ",")}, jadi eksekusi ditahan sampai harga mendekati batas bawah zona entry.`;
  }

  return {
    score,
    stance,
    label: stanceLabel(stance),
    confidence,
    consensus,
    disagreement,
    members,
    actionPlan: buildActionPlan(score, stance, plan, position, horizon, quote.price),
    keyReasons,
    keyRisks,
    watchlist,
    plan,
    position,
    narrative,
    narrativeSource: "rule",
  };
}

function buildActionPlan(
  score: number,
  stance: Stance,
  plan: TradePlan | undefined,
  position: { pct: number; basis: string },
  horizon: string,
  price: number,
): CouncilVerdict["actionPlan"] {
  const buyStance = stance === "STRONG_BUY" || stance === "BUY";
  if (!plan) {
    return {
      horizon,
      entry: "—",
      stopLoss: "—",
      target: "—",
      positionSizing: position.basis,
      invalidation: "—",
    };
  }
  const lv = (l: { price: number; pct: number } | null | undefined) => (l ? `${fmtPrice(l.price)} (${pct(l.pct)})` : "—");
  if (plan.mode === "BELI") {
    const zone = `${fmtPrice(plan.entryLow?.price)}–${fmtPrice(plan.entryHigh?.price)}`;
    return {
      horizon,
      entry: buyStance
        ? plan.riskReward1 !== null && plan.riskReward1 < 1
          ? plan.entryLow && plan.riskRewardAtLow !== null && plan.riskRewardAtLow >= 1
            ? `Sikap beli, tetapi R/R dari tengah zona hanya 1:${plan.riskReward1.toFixed(2).replace(".", ",")}. Pasang antrean beli hanya di ${fmtPrice(plan.entryLow.price)} (R/R 1:${plan.riskRewardAtLow.toFixed(2).replace(".", ",")}); jangan beli di harga sekarang.`
            : `Sikap beli, tetapi R/R 1:${plan.riskReward1.toFixed(2).replace(".", ",")} < 1 di seluruh zona entry — tunda pembelian.`
          : `Cicil di zona ${zone}, jangan mengejar di atas ${fmtPrice(plan.entryHigh?.price)}.`
        : stance === "HOLD"
          ? `Belum beli — skor dewan ${score} masih di bawah ambang Beli (63). Bila skor naik ke ≥63, gunakan zona entry ${zone}.`
          : `Tidak membuka posisi baru — skor dewan ${score} di bawah ambang Tahan (45).`,
      stopLoss: `${lv(plan.stopLoss)} — ${plan.stopLoss.basis}`,
      target:
        `TP1 ${lv(plan.target1)}${plan.target2 ? ` • TP2 ${lv(plan.target2)}` : ""}` +
        (plan.riskReward1 !== null ? ` — R/R 1:${plan.riskReward1.toFixed(2).replace(".", ",")}` : "") +
        `. ${plan.target1.basis}`,
      positionSizing: position.pct > 0 ? `±${position.pct.toString().replace(".", ",")}% portofolio, dibagi 2–3 kali beli. ${position.basis}` : position.basis,
      invalidation: plan.invalidation,
    };
  }
  return {
    horizon,
    entry: `Tidak membuka posisi baru — fase bearish. Pertimbangkan beli kembali hanya di atas ${fmtPrice(plan.reentry?.price)} (${pct(((plan.reentry?.price ?? price) - price) / price * 100)}).`,
    stopLoss: `Batas keluar pemegang ${lv(plan.stopLoss)} — ${plan.stopLoss.basis}`,
    target: `Area jual saat pantulan ${lv(plan.target1)} — ${plan.target1.basis}`,
    positionSizing: position.basis,
    invalidation: plan.invalidation,
  };
}

function buildRuleNarrative(
  score: number,
  stance: Stance,
  members: CouncilMember[],
  momentum: MomentumReport,
  technical: TechnicalReport,
  fundamental: FundamentalReport,
  news: NewsReport,
  disagreement: number,
): string {
  const top = [...members].sort((a, b) => b.score - a.score)[0];
  const bottom = [...members].sort((a, b) => a.score - b.score)[0];
  const validated = momentum.stories.filter((s) => s.verdict === "TERVALIDASI");

  return [
    `Dewan analis memberi skor gabungan ${score}/100 dengan rekomendasi ${stanceLabel(stance).toUpperCase()}.`,
    fundamental.available
      ? `Dari sisi fundamental, skor ${fundamental.score}/100 (grade ${fundamental.grade}) menggambarkan ${fundamental.score >= 65 ? "bisnis yang sehat" : fundamental.score >= 50 ? "kondisi yang campuran" : "kualitas keuangan yang lemah"}.`
      : "Fundamental tidak dapat dinilai karena data laporan keuangan tidak tersedia.",
    technical.available
      ? `Secara teknikal saham berada pada ${technical.phase.toLowerCase()} dengan skor ${technical.score}/100.`
      : "",
    `Sisi pemberitaan ${news.available ? `menunjukkan intensitas ${news.buzz.buzzLevel.toLowerCase()} dengan sentimen ${news.avgSentiment > 0.12 ? "cenderung positif" : news.avgSentiment < -0.12 ? "cenderung negatif" : "netral"}` : "tidak memberi sinyal karena berita relevan tidak ditemukan"}.`,
    validated.length
      ? `Story yang berhasil tervalidasi: ${validated.map((s) => s.theme).join(", ")} — narasi ini didukung pergerakan harga, volume, dan angka fundamental sekaligus.`
      : momentum.stories.length
        ? "Belum ada story yang lolos seluruh uji validasi; narasi yang beredar masih perlu konfirmasi tambahan."
        : "Tidak ada narasi/katalis dominan yang terdeteksi saat ini.",
    `Suara paling optimistis datang dari ${top.name} (${top.score}/100) dan paling waspada dari ${bottom.name} (${bottom.score}/100).`,
    disagreement > 20
      ? "Karena perbedaan pandangan antar anggota cukup lebar, eksekusi sebaiknya dilakukan bertahap dengan ukuran posisi lebih kecil."
      : "Tingkat kesepakatan antar anggota relatif tinggi, sehingga tesis ini dapat dieksekusi sesuai rencana.",
  ]
    .filter(Boolean)
    .join(" ");
}

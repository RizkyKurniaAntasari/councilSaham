import { clamp, pctChange } from "./indicators";
import { themeMeta } from "./sentiment";
import type {
  Candle,
  FundamentalReport,
  MomentumReport,
  NewsItem,
  NewsReport,
  Story,
  StoryCheck,
  StoryVerdict,
  TechnicalReport,
} from "./types";

const DAY = 86400000;

function idxAt(candles: Candle[], ts: number): number {
  if (!candles.length) return -1;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const d = Math.abs(candles[i].t - ts);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function verdictOf(strength: number, flagged: boolean): StoryVerdict {
  if (flagged) return "MENCURIGAKAN";
  if (strength >= 75) return "TERVALIDASI";
  if (strength >= 58) return "SEBAGIAN_VALID";
  if (strength >= 42) return "BELUM_TERVALIDASI";
  return "LEMAH";
}

/** Apakah fundamental mendukung tema story tertentu? */
function fundamentalSupport(
  theme: string,
  fundamental: FundamentalReport,
): { score: number; evidence: string } {
  const f = fundamental.financials;
  if (!fundamental.available) {
    return { score: 45, evidence: "Data fundamental tidak tersedia untuk memverifikasi klaim ini." };
  }

  switch (theme) {
    case "Kinerja Keuangan": {
      const g = f.earningsGrowth;
      const r = f.revenueGrowth;
      if (g === undefined && r === undefined)
        return { score: 45, evidence: "Angka pertumbuhan laba/pendapatan tidak tersedia." };
      const score = clamp(50 + (g ?? 0) * 0.6 + (r ?? 0) * 0.4);
      return {
        score,
        evidence: `Pertumbuhan laba ${g !== undefined ? `${g.toFixed(1)}%` : "n/a"}, pendapatan ${
          r !== undefined ? `${r.toFixed(1)}%` : "n/a"
        } (YoY) — ${score >= 60 ? "angka mendukung narasi" : score >= 45 ? "angka belum jelas mendukung" : "angka justru berlawanan dengan narasi"}.`,
      };
    }
    case "Dividen": {
      const dy = f.dividendYield;
      const payout = f.payoutRatio;
      if (dy === undefined) return { score: 45, evidence: "Data dividend yield tidak tersedia." };
      const sustain = payout === undefined ? 60 : payout > 100 ? 25 : payout > 75 ? 50 : 82;
      const score = clamp(dy * 8 + sustain * 0.5);
      return {
        score,
        evidence: `Yield ${dy.toFixed(2)}%${
          payout !== undefined ? `, payout ratio ${payout.toFixed(0)}%` : ""
        } — ${sustain >= 70 ? "pembayaran terlihat berkelanjutan" : "keberlanjutan dividen patut dicermati"}.`,
      };
    }
    case "Ekspansi & Proyek Baru": {
      const fcf = f.freeCashflow;
      const der = f.der;
      const cash = f.totalCash;
      const canFund = (fcf !== undefined && fcf > 0) || (der !== undefined && der < 100);
      const score = clamp((canFund ? 72 : 38) + (cash && cash > 0 ? 6 : 0));
      return {
        score,
        evidence: canFund
          ? `Neraca cukup untuk mendanai ekspansi (FCF ${fcf !== undefined ? (fcf > 0 ? "positif" : "negatif") : "n/a"}, DER ${der !== undefined ? `${der.toFixed(0)}%` : "n/a"}).`
          : `Kapasitas pendanaan terbatas (FCF ${fcf !== undefined ? (fcf > 0 ? "positif" : "negatif") : "n/a"}, DER ${der !== undefined ? `${der.toFixed(0)}%` : "n/a"}) — eksekusi proyek berisiko butuh utang/rights issue.`,
      };
    }
    case "Struktur Utang": {
      const der = f.der;
      const cr = f.currentRatio;
      if (der === undefined) return { score: 45, evidence: "Rasio utang tidak tersedia." };
      const score = clamp(100 - der * 0.4 + (cr ? (cr - 1) * 10 : 0));
      return {
        score,
        evidence: `DER ${der.toFixed(0)}%${cr ? `, current ratio ${cr.toFixed(2)}x` : ""} — ${
          score >= 60 ? "beban utang relatif terkendali" : "beban utang menjadi risiko nyata"
        }.`,
      };
    }
    case "Harga Komoditas": {
      const margin = f.profitMargin;
      const score = margin === undefined ? 50 : clamp(45 + margin * 1.4);
      return {
        score,
        evidence:
          margin === undefined
            ? "Margin tidak tersedia untuk mengukur sensitivitas terhadap harga komoditas."
            : `Net margin ${margin.toFixed(1)}% — ${margin > 15 ? "perusahaan punya bantalan margin saat harga komoditas berfluktuasi" : "margin tipis membuat laba sangat sensitif terhadap harga komoditas"}.`,
      };
    }
    case "Aksi Korporasi": {
      const der = f.der;
      const score = der === undefined ? 50 : clamp(85 - der * 0.3);
      return {
        score,
        evidence: `Kemampuan mendanai aksi korporasi ${
          score >= 60 ? "memadai" : "terbatas"
        } berdasarkan struktur permodalan saat ini${der !== undefined ? ` (DER ${der.toFixed(0)}%)` : ""}.`,
      };
    }
    case "Risiko Hukum & Tata Kelola":
      return {
        score: 35,
        evidence: "Isu hukum/tata kelola tidak bisa divalidasi dari laporan keuangan — perlakukan sebagai risiko ekor.",
      };
    default: {
      const score = clamp(fundamental.score);
      return {
        score,
        evidence: `Tidak ada metrik spesifik untuk tema ini; memakai skor fundamental umum (${fundamental.score}/100) sebagai proksi.`,
      };
    }
  }
}

function buildStory(
  theme: string,
  grade: "utama" | "sekunder",
  articles: NewsItem[],
  candles: Candle[],
  technical: TechnicalReport,
  fundamental: FundamentalReport,
): Story {
  const sorted = [...articles].sort((a, b) => a.publishedAt - b.publishedAt);
  const firstSeen = sorted[0].publishedAt;
  const lastSeen = sorted[sorted.length - 1].publishedAt;
  const sources = new Set(articles.map((a) => a.source));
  const sentiment = avg(articles.map((a) => a.sentiment));
  const now = Date.now();

  const checks: StoryCheck[] = [];

  // 1. Liputan media
  const coverageScore = clamp(articles.length * 12 + sources.size * 10);
  checks.push({
    key: "liputan",
    label: "Liputan media",
    passed: articles.length >= 3 && sources.size >= 2,
    score: coverageScore,
    weight: 1.1,
    evidence: `${articles.length} artikel dari ${sources.size} sumber berbeda (${Array.from(sources).slice(0, 3).join(", ")}${sources.size > 3 ? ", …" : ""}).`,
  });

  // 2. Kesegaran
  const ageDays = (now - lastSeen) / DAY;
  const freshScore = clamp(100 - ageDays * 7);
  checks.push({
    key: "kesegaran",
    label: "Kesegaran informasi",
    passed: ageDays <= 7,
    score: freshScore,
    weight: 0.9,
    evidence: `Berita terakhir ${ageDays < 1 ? "kurang dari 24 jam lalu" : `${Math.round(ageDays)} hari lalu`}; story pertama muncul ${Math.round((now - firstSeen) / DAY)} hari lalu.`,
  });

  // 3. Konfirmasi harga
  const startIdx = idxAt(candles, firstSeen);
  const priceThen = startIdx >= 0 ? candles[startIdx].c : null;
  const priceNow = candles.length ? candles[candles.length - 1].c : null;
  const moveSince = priceThen && priceNow ? pctChange(priceThen, priceNow) : null;
  const expectedDirection = sentiment >= 0 ? 1 : -1;
  const aligned = moveSince !== null && Math.sign(moveSince) === expectedDirection && Math.abs(moveSince) > 1.5;
  const priceScore =
    moveSince === null ? 50 : clamp(50 + expectedDirection * moveSince * 2.2);
  checks.push({
    key: "konfirmasi_harga",
    label: "Konfirmasi harga",
    passed: moveSince === null ? null : aligned,
    score: priceScore,
    weight: 1.4,
    evidence:
      moveSince === null
        ? "Tidak ada data harga pembanding sejak story muncul."
        : `Harga bergerak ${moveSince >= 0 ? "+" : ""}${moveSince.toFixed(1)}% sejak story pertama muncul, sementara nada berita ${sentiment >= 0 ? "positif" : "negatif"} — ${aligned ? "pasar mengonfirmasi narasi" : "pasar belum/tidak mengonfirmasi narasi"}.`,
  });

  // 4. Konfirmasi volume
  let volScore = 50;
  let volEvidence = "Data volume tidak cukup untuk diuji.";
  let volPassed: boolean | null = null;
  if (startIdx > 20 && candles.length - startIdx >= 2) {
    const after = avg(candles.slice(startIdx).map((c) => c.v));
    const before = avg(candles.slice(Math.max(0, startIdx - 20), startIdx).map((c) => c.v));
    if (before > 0) {
      const ratio = after / before;
      volScore = clamp(35 + ratio * 28);
      volPassed = ratio >= 1.2;
      volEvidence = `Volume rata-rata setelah story ${ratio.toFixed(2)}x dibanding 20 hari sebelumnya — ${
        ratio >= 2 ? "partisipasi melonjak tajam" : ratio >= 1.2 ? "ada peningkatan partisipasi" : "tidak ada lonjakan partisipasi berarti"
      }.`;
    }
  }
  checks.push({
    key: "konfirmasi_volume",
    label: "Konfirmasi volume",
    passed: volPassed,
    score: volScore,
    weight: 1.2,
    evidence: volEvidence,
  });

  // 5. Dukungan fundamental
  const fs = fundamentalSupport(theme, fundamental);
  checks.push({
    key: "dukungan_fundamental",
    label: "Dukungan fundamental",
    passed: fs.score >= 60 ? true : fs.score >= 45 ? null : false,
    score: fs.score,
    weight: 1.5,
    evidence: fs.evidence,
  });

  // 6. Konsistensi sentimen antar artikel
  const spread = articles.length > 1 ? Math.sqrt(avg(articles.map((a) => (a.sentiment - sentiment) ** 2))) : 0;
  const consistencyScore = clamp(100 - spread * 130);
  checks.push({
    key: "konsistensi",
    label: "Konsistensi antar sumber",
    passed: spread < 0.35,
    score: consistencyScore,
    weight: 0.8,
    evidence:
      articles.length > 1
        ? `Deviasi sentimen antar artikel ${spread.toFixed(2)} — ${spread < 0.25 ? "sumber-sumber kompak" : spread < 0.45 ? "ada perbedaan nada antar sumber" : "sumber saling bertentangan"}.`
        : "Hanya satu artikel — konsistensi tidak bisa diuji.",
  });

  // 7. Daya tahan story
  const spanDays = (lastSeen - firstSeen) / DAY;
  const durabilityScore = clamp(30 + spanDays * 6 + articles.length * 4);
  checks.push({
    key: "daya_tahan",
    label: "Daya tahan narasi",
    passed: spanDays >= 3,
    score: durabilityScore,
    weight: 0.9,
    evidence:
      spanDays < 1
        ? "Semua berita muncul dalam satu hari — bisa jadi sekadar riak sesaat."
        : `Narasi bertahan ${Math.round(spanDays)} hari di pemberitaan — ${spanDays >= 14 ? "tema struktural" : spanDays >= 3 ? "tema berkelanjutan" : "tema berumur pendek"}.`,
  });

  // 8. Selaras dengan struktur teknikal
  const techScore = technical.available
    ? clamp(sentiment >= 0 ? technical.score : 100 - technical.score)
    : 50;
  checks.push({
    key: "selaras_teknikal",
    label: "Selaras dengan struktur teknikal",
    passed: techScore >= 60 ? true : techScore >= 45 ? null : false,
    score: techScore,
    weight: 1.0,
    evidence: technical.available
      ? `Tren ${technical.trend.toLowerCase()} dengan skor teknikal ${technical.score}/100 — ${techScore >= 60 ? "grafik mendukung arah narasi" : "grafik belum mendukung arah narasi"}.`
      : "Struktur teknikal tidak tersedia.",
  });

  // 9. Kualitas tema — obrolan pasar umum tidak setara katalis spesifik emiten
  checks.push({
    key: "kualitas_tema",
    label: "Kualitas tema",
    passed: grade === "utama",
    score: grade === "utama" ? 85 : 35,
    weight: 1.1,
    evidence:
      grade === "utama"
        ? "Tema ini merupakan katalis spesifik emiten yang layak dijadikan dasar tesis investasi."
        : "Tema ini tergolong obrolan pasar umum (rekomendasi harian, pergerakan harga, atau berita makro), bukan katalis spesifik emiten — kekuatannya sengaja dipangkas.",
  });

  const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
  const strength = Math.round(checks.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight);

  // Bendera merah: harga sudah lari jauh sementara liputan tipis & fundamental tidak mendukung
  const suspicious =
    moveSince !== null &&
    moveSince > 25 &&
    articles.length <= 2 &&
    sources.size <= 1 &&
    fs.score < 50;

  const verdict = verdictOf(strength, suspicious);

  const meta = themeMeta(theme);
  // Judul diambil dari artikel yang paling spesifik ke tema ini (tema muncul paling awal
  // di daftar tema artikel), bukan sekadar artikel paling relevan secara umum.
  const topArticle = [...articles].sort((a, b) => {
    const ai = a.themes.indexOf(theme);
    const bi = b.themes.indexOf(theme);
    return ai - bi || b.relevance - a.relevance || b.publishedAt - a.publishedAt;
  })[0];

  const narrative = [
    `Tema ${theme.toLowerCase()} muncul di ${articles.length} pemberitaan dari ${sources.size} sumber dalam ${Math.max(1, Math.round(spanDays))} hari terakhir dengan nada ${sentiment > 0.12 ? "positif" : sentiment < -0.12 ? "negatif" : "netral"}.`,
    moveSince !== null
      ? `Sejak narasi ini pertama terdeteksi, harga bergerak ${moveSince >= 0 ? "+" : ""}${moveSince.toFixed(1)}%.`
      : "",
    verdict === "TERVALIDASI"
      ? "Pemeriksaan silang harga, volume, dan fundamental sama-sama mendukung — story ini layak dijadikan dasar tesis investasi."
      : verdict === "SEBAGIAN_VALID"
        ? "Sebagian pemeriksaan mendukung, sebagian belum — perlakukan sebagai tesis yang masih butuh konfirmasi lanjutan."
        : verdict === "MENCURIGAKAN"
          ? "Kenaikan harga jauh melampaui bukti pendukungnya dengan liputan yang sangat tipis — waspadai risiko penggerakan harga tanpa dasar."
          : verdict === "LEMAH"
            ? "Mayoritas pemeriksaan gagal — story ini lemah dan tidak layak dijadikan alasan utama transaksi."
            : "Bukti masih terlalu sedikit untuk menyimpulkan; tunggu konfirmasi harga, volume, atau rilis resmi emiten.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `${theme}-${firstSeen}`,
    theme,
    grade,
    title: topArticle?.title ?? theme,
    narrative,
    strength,
    verdict,
    checks,
    supportingNews: articles
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 6)
      .map((a) => ({ title: a.title, url: a.url, source: a.source, publishedAt: a.publishedAt })),
    firstSeen,
    lastSeen,
    sourceCount: sources.size,
    impactHorizon: meta?.horizon ?? "Tidak ditentukan",
  };
}

export function buildMomentum(
  candles: Candle[],
  technical: TechnicalReport,
  news: NewsReport,
  fundamental: FundamentalReport,
): MomentumReport {
  const ind = technical.indicators;

  const priceMomentum = clamp(
    50 + (ind.return5d ?? 0) * 1.6 + (ind.return20d ?? 0) * 0.7 + (ind.return60d ?? 0) * 0.25,
  );

  const volRatio = ind.volume?.ratio20 ?? 1;
  const volTrend = ind.volume && ind.volume.avg60 ? ind.volume.avg20 / ind.volume.avg60 : 1;
  const volumeMomentum = clamp(30 + volRatio * 22 + (volTrend - 1) * 45);

  const baseline = Math.max(1, news.buzz.last30d / 4);
  const buzzRatio = news.buzz.last7d / baseline;
  const newsMomentum = clamp(35 + buzzRatio * 22 + news.avgSentiment * 30);

  const accelerating =
    (ind.return5d ?? 0) > Math.max(0, (ind.return20d ?? 0) / 4) && volRatio > 1.1;

  const score = Math.round(priceMomentum * 0.45 + volumeMomentum * 0.28 + newsMomentum * 0.27);

  const flags: string[] = [];
  const divergence: string[] = [];

  if ((ind.return20d ?? 0) > 20 && news.buzz.last30d === 0) {
    flags.push("Harga naik >20% dalam sebulan tanpa berita relevan yang terdeteksi — kenaikan tanpa katalis publik.");
  }
  if (volRatio > 3 && Math.abs(ind.return1d ?? 0) < 1) {
    flags.push("Volume melonjak >3x tanpa pergerakan harga berarti — indikasi akumulasi/distribusi terselubung.");
  }
  if (volRatio > 3 && news.buzz.last24h === 0) {
    flags.push("Lonjakan volume harian tanpa berita — cek pengumuman resmi di keterbukaan informasi IDX.");
  }
  if (news.avgSentiment > 0.25 && (ind.return5d ?? 0) < -3) {
    divergence.push("Sentimen berita positif tapi harga turun — kemungkinan 'sell the news' atau berita sudah terdiskon.");
  }
  if (news.avgSentiment < -0.25 && (ind.return5d ?? 0) > 3) {
    divergence.push("Sentimen berita negatif tapi harga naik — kemungkinan bad news sudah priced-in atau ada penggerak lain.");
  }
  if ((ind.obvSlopePct ?? 0) < -5 && (ind.return20d ?? 0) > 5) {
    divergence.push("Harga naik namun OBV turun — kenaikan tidak didukung aliran dana, rawan pembalikan.");
  }
  if ((ind.obvSlopePct ?? 0) > 5 && (ind.return20d ?? 0) < -5) {
    divergence.push("Harga turun namun OBV naik — indikasi akumulasi diam-diam saat harga tertekan.");
  }
  if ((ind.rsi14 ?? 50) > 75 && volRatio > 2) {
    flags.push("RSI sangat jenuh beli disertai volume ekstrem — fase euforia, risiko koreksi tajam meningkat.");
  }

  // --- Deteksi story ---
  const horizon = Date.now() - 45 * DAY;
  const recent = news.items.filter((n) => n.publishedAt >= horizon && n.relevance >= 0.4);
  const byTheme = new Map<string, NewsItem[]>();
  for (const item of recent) {
    for (const theme of item.themes) {
      const arr = byTheme.get(theme) ?? [];
      arr.push(item);
      byTheme.set(theme, arr);
    }
  }

  const stories = Array.from(byTheme.entries())
    .map(([theme, arr]) => ({ theme, arr, grade: themeMeta(theme)?.grade ?? "utama" }))
    .filter(({ arr, grade }) =>
      grade === "sekunder"
        ? arr.length >= 4
        : arr.length >= 2 || arr.some((a) => Math.abs(a.sentiment) > 0.45),
    )
    .map(({ theme, arr, grade }) => buildStory(theme, grade, arr, candles, technical, fundamental))
    .sort((a, b) => {
      const rank = (v: StoryVerdict) =>
        v === "MENCURIGAKAN" ? 4 : v === "TERVALIDASI" ? 3 : v === "SEBAGIAN_VALID" ? 2 : 1;
      const gradeRank = (g: Story["grade"]) => (g === "utama" ? 1 : 0);
      return (
        gradeRank(b.grade) - gradeRank(a.grade) ||
        rank(b.verdict) - rank(a.verdict) ||
        b.strength - a.strength
      );
    })
    .slice(0, 6);

  const state =
    score >= 75
      ? "Momentum kuat"
      : score >= 60
        ? "Momentum positif"
        : score >= 45
          ? "Momentum netral"
          : score >= 30
            ? "Momentum melemah"
            : "Momentum negatif";

  const validated = stories.filter((s) => s.verdict === "TERVALIDASI" && s.grade === "utama").length;
  const summary = [
    `${state} (${score}/100): harga ${priceMomentum >= 55 ? "menguat" : priceMomentum <= 45 ? "melemah" : "datar"}, volume ${volumeMomentum >= 60 ? "meningkat" : volumeMomentum <= 40 ? "mengering" : "normal"}, pemberitaan ${news.buzz.buzzLevel.toLowerCase()}.`,
    stories.length
      ? `${stories.length} story terdeteksi, ${validated} di antaranya tervalidasi lintas data.`
      : "Belum ada story/katalis yang cukup kuat terdeteksi dari pemberitaan 45 hari terakhir.",
    accelerating ? "Momentum sedang berakselerasi." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    score,
    state,
    priceMomentum: Math.round(priceMomentum),
    volumeMomentum: Math.round(volumeMomentum),
    newsMomentum: Math.round(newsMomentum),
    accelerating,
    flags,
    divergence,
    stories,
    summary,
  };
}

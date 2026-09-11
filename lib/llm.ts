import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisResult, CouncilAI, CouncilVerdict } from "./types";

const MODEL = process.env.COUNCIL_MODEL || "claude-opus-5";

export function llmEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Kamu adalah notulis Dewan Analis (AI Council) sebuah platform analisis saham Bursa Efek Indonesia.

Kamu MENERIMA hasil perhitungan kuantitatif yang sudah jadi (skor fundamental, teknikal, sentimen berita, momentum, hasil validasi story, dan suara tiap anggota dewan). Tugasmu adalah MENYINTESIS, bukan menghitung ulang dan bukan mengarang angka baru.

Aturan keras:
- Gunakan HANYA angka dan fakta yang ada di data masukan. Dilarang mengarang harga, rasio, target, tanggal, atau nama pihak yang tidak ada di data.
- Jika sebuah data bertanda tidak tersedia, katakan terus terang bahwa data itu tidak tersedia dan turunkan tingkat keyakinan.
- Tulis dalam bahasa Indonesia yang jernih, lugas, dan padat. Hindari jargon tanpa penjelasan.
- Bersikap seimbang: sebutkan apa yang mendukung DAN apa yang melemahkan tesis. Jangan jadi cheerleader.
- Ini analisis edukatif, bukan nasihat investasi personal. Jangan menjanjikan hasil.

Balas HANYA dengan satu objek JSON valid, tanpa teks pembuka, tanpa penutup, tanpa pagar kode markdown. Bentuk objek:
{
  "ringkasan_eksekutif": string (3-5 kalimat, menjawab "apa yang sebenarnya terjadi pada saham ini sekarang"),
  "tesis_bull": string[] (2-5 poin, masing-masing satu kalimat dengan bukti angkanya),
  "tesis_bear": string[] (2-5 poin, masing-masing satu kalimat dengan bukti angkanya),
  "pembacaan_story": [{"tema": string, "penilaian": string (1-2 kalimat: apakah narasi ini terbukti, apa buktinya, apa yang masih kurang)}],
  "debat_dewan": string (2-4 kalimat yang merangkum di mana anggota dewan berbeda pendapat dan mengapa),
  "rekomendasi": string (2-4 kalimat: apa yang sebaiknya dilakukan, untuk profil investor seperti apa, dengan syarat apa),
  "yang_harus_dipantau": string[] (3-5 pemicu konkret yang akan mengubah kesimpulan),
  "peringatan": string (1-2 kalimat tentang keterbatasan data pada analisis ini)
}`;

/** Ringkas hasil analisis jadi payload kecil supaya hemat token & fokus. */
function toPayload(a: AnalysisResult) {
  const t = a.technical;
  const ind = t.indicators;
  return {
    emiten: {
      ticker: a.ticker,
      nama: a.profile.name,
      sektor: a.profile.sector ?? "tidak tersedia",
      industri: a.profile.industry ?? "tidak tersedia",
      direksi_komisaris: a.profile.officers.slice(0, 5).map((o) => `${o.name}${o.title ? ` (${o.title})` : ""}`),
    },
    harga: {
      terakhir: a.quote.price,
      perubahan_persen: Number(a.quote.changePct.toFixed(2)),
      tertinggi_52m: a.quote.high52w ?? null,
      terendah_52m: a.quote.low52w ?? null,
      kapitalisasi_pasar: a.quote.marketCap ?? null,
      mata_uang: a.quote.currency,
    },
    fundamental: a.fundamental.available
      ? {
          skor: a.fundamental.score,
          grade: a.fundamental.grade,
          metrik: a.fundamental.metrics.map((m) => ({ nama: m.label, nilai: m.display, skor: m.score })),
          keunggulan: a.fundamental.highlights,
          risiko: a.fundamental.risks,
        }
      : "tidak tersedia",
    teknikal: t.available
      ? {
          skor: t.score,
          tren: t.trend,
          fase: t.phase,
          kekuatan_tren: t.trendStrength,
          rsi14: ind.rsi14 !== null ? Number(ind.rsi14.toFixed(1)) : null,
          macd_hist: ind.macd ? Number(ind.macd.hist.toFixed(3)) : null,
          ma20: ind.ma20,
          ma50: ind.ma50,
          ma200: ind.ma200,
          rasio_volume_20h: ind.volume ? Number(ind.volume.ratio20.toFixed(2)) : null,
          return_5h: ind.return5d,
          return_20h: ind.return20d,
          return_60h: ind.return60d,
          support: t.supports,
          resistance: t.resistances,
          level: t.levels,
          pola: t.patterns,
        }
      : "tidak tersedia",
    berita: {
      jumlah: a.news.counts,
      intensitas: a.news.buzz,
      sentimen_rata2: Number(a.news.avgSentiment.toFixed(3)),
      tema_teratas: a.news.topThemes,
      judul_terbaru: a.news.items.slice(0, 12).map((n) => ({
        judul: n.title,
        sumber: n.source,
        sentimen: n.sentimentLabel,
        umur_hari: Math.round((Date.now() - n.publishedAt) / 86400000),
      })),
    },
    momentum: {
      skor: a.momentum.score,
      status: a.momentum.state,
      momentum_harga: a.momentum.priceMomentum,
      momentum_volume: a.momentum.volumeMomentum,
      momentum_berita: a.momentum.newsMomentum,
      berakselerasi: a.momentum.accelerating,
      anomali: a.momentum.flags,
      divergensi: a.momentum.divergence,
    },
    story_terdeteksi: a.momentum.stories.map((s) => ({
      tema: s.theme,
      judul: s.title,
      kekuatan: s.strength,
      vonis: s.verdict,
      horizon_dampak: s.impactHorizon,
      jumlah_sumber: s.sourceCount,
      hasil_uji: s.checks.map((c) => ({ uji: c.label, skor: c.score, lolos: c.passed, bukti: c.evidence })),
    })),
    suara_dewan: a.council.members.map((m) => ({
      anggota: m.name,
      skor: m.score,
      sikap: m.stance,
      keyakinan: m.confidence,
      bobot: m.weight,
      alasan: m.rationale,
      kekhawatiran: m.concerns,
    })),
    skor_gabungan: a.council.score,
    sikap_gabungan: a.council.stance,
    kualitas_data: a.dataQuality,
  };
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function asStringArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max);
}

export async function synthesizeCouncil(analysis: AnalysisResult): Promise<CouncilAI | null> {
  if (!llmEnabled()) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Berikut hasil analisis kuantitatif untuk ${analysis.ticker} (${analysis.profile.name}). Sintesiskan menjadi kesimpulan dewan sesuai format JSON yang diminta.\n\n${JSON.stringify(
            toPayload(analysis),
          )}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJson(text) as Partial<CouncilAI> | null;
    if (!parsed || typeof parsed.ringkasan_eksekutif !== "string") return null;

    return {
      ringkasan_eksekutif: parsed.ringkasan_eksekutif,
      tesis_bull: asStringArray(parsed.tesis_bull),
      tesis_bear: asStringArray(parsed.tesis_bear),
      pembacaan_story: Array.isArray(parsed.pembacaan_story)
        ? parsed.pembacaan_story
            .filter(
              (s): s is { tema: string; penilaian: string } =>
                !!s && typeof s === "object" && typeof (s as any).tema === "string" && typeof (s as any).penilaian === "string",
            )
            .slice(0, 6)
        : [],
      debat_dewan: typeof parsed.debat_dewan === "string" ? parsed.debat_dewan : "",
      rekomendasi: typeof parsed.rekomendasi === "string" ? parsed.rekomendasi : "",
      yang_harus_dipantau: asStringArray(parsed.yang_harus_dipantau),
      peringatan: typeof parsed.peringatan === "string" ? parsed.peringatan : "",
    };
  } catch {
    return null;
  }
}

/** Tempelkan hasil sintesis AI ke verdict dewan (rule engine tetap jadi tulang punggung). */
export function mergeAiNarrative(council: CouncilVerdict, ai: CouncilAI): CouncilVerdict {
  return {
    ...council,
    narrative: ai.ringkasan_eksekutif,
    narrativeSource: "ai",
    keyReasons: ai.tesis_bull.length ? ai.tesis_bull : council.keyReasons,
    keyRisks: ai.tesis_bear.length ? ai.tesis_bear : council.keyRisks,
    watchlist: ai.yang_harus_dipantau.length ? ai.yang_harus_dipantau : council.watchlist,
  };
}

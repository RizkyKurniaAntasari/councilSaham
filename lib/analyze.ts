import { IDX_INDEX } from "../data/idx-tickers";
import { buildOwnership, buildProfile, buildQuote } from "./company";
import { buildCouncil } from "./council";
import { buildFundamental } from "./fundamental";
import { llmEnabled, mergeAiNarrative, synthesizeCouncil } from "./llm";
import { fetchNews } from "./news";
import { buildMomentum } from "./story";
import { buildTechnical } from "./technical";
import type { AnalysisResult, NewsReport } from "./types";
import { fetchChart, fetchQuoteSummary, normalizeTicker, toYahooSymbol } from "./yahoo";

const EMPTY_NEWS: NewsReport = {
  available: false,
  items: [],
  score: 50,
  avgSentiment: 0,
  counts: { positive: 0, negative: 0, neutral: 0, total: 0 },
  buzz: { last24h: 0, last7d: 0, last30d: 0, buzzLevel: "Senyap" },
  topThemes: [],
  sources: [],
  highlights: [],
  risks: ["Sumber berita tidak dapat dijangkau saat ini."],
};

export class TickerNotFoundError extends Error {
  constructor(public readonly ticker: string) {
    super(`Data untuk ${ticker} tidak ditemukan`);
    this.name = "TickerNotFoundError";
  }
}

export async function analyze(
  tickerInput: string,
  opts: { withAi?: boolean } = {},
): Promise<AnalysisResult> {
  const ticker = normalizeTicker(tickerInput);
  if (!ticker || ticker.length < 2) throw new TickerNotFoundError(tickerInput);
  const symbol = toYahooSymbol(ticker);

  const localName = IDX_INDEX.get(ticker)?.name ?? ticker;

  const [chartResult, qs, newsEarly] = await Promise.all([
    fetchChart(symbol, "2y", "1d").catch((err: unknown) => {
      throw err instanceof Error ? err : new Error("gagal memuat data harga");
    }),
    fetchQuoteSummary(symbol).catch(() => null),
    fetchNews(ticker, localName).catch(() => EMPTY_NEWS),
  ]);

  const { candles, meta } = chartResult;
  if (!candles.length) throw new TickerNotFoundError(ticker);

  const profile = buildProfile(ticker, symbol, qs, meta);
  const quote = buildQuote(candles, qs, meta);
  const ownership = buildOwnership(qs);
  const fundamental = buildFundamental(qs);
  const technical = buildTechnical(candles);

  // Kalau nama resmi berbeda jauh dari daftar lokal, ambil ulang berita memakai nama resmi.
  let news = newsEarly;
  const officialShort = profile.name.replace(/\b(PT|Tbk|\(Persero\)|Persero)\b/gi, "").trim();
  if (officialShort && officialShort.toLowerCase() !== localName.toLowerCase() && officialShort.length > 3) {
    news = await fetchNews(ticker, profile.name).catch(() => newsEarly);
  }

  const momentum = buildMomentum(candles, technical, news, fundamental);
  let council = buildCouncil(fundamental, technical, news, momentum, quote);

  const sources: string[] = ["Yahoo Finance (harga & OHLCV)"];
  const warnings: string[] = [];
  if (qs) sources.push("Yahoo Finance (fundamental & kepemilikan)");
  else warnings.push("Data fundamental dan kepemilikan tidak dapat diambil — analisis fundamental dilewati.");
  if (news.available) sources.push("Google News RSS (pemberitaan Indonesia)");
  else warnings.push("Tidak ada berita relevan yang ditemukan untuk emiten ini.");
  if (process.env.NEWSAPI_KEY) sources.push("NewsAPI.org");
  if (candles.length < 250) warnings.push("Riwayat harga kurang dari 1 tahun — indikator jangka panjang (MA200) tidak tersedia.");
  if (ownership.source === "Tidak tersedia") warnings.push("Data struktur kepemilikan tidak tersedia dari sumber gratis; rujuk laporan tahunan emiten & KSEI.");

  const completeness = Math.round(
    ((qs ? 40 : 0) + (news.available ? 25 : 0) + (technical.available ? 25 : 0) + (ownership.topHolders.length ? 10 : 0)),
  );

  const result: AnalysisResult = {
    ticker,
    symbol,
    generatedAt: Date.now(),
    profile,
    quote,
    candles,
    ownership,
    fundamental,
    technical,
    news,
    momentum,
    council,
    dataQuality: { sources, warnings, completeness },
  };

  if (opts.withAi && llmEnabled()) {
    const ai = await synthesizeCouncil(result);
    if (ai) {
      council = mergeAiNarrative(council, ai);
      result.council = council;
      result.ai = ai;
      result.dataQuality.sources.push("Claude (sintesis naratif dewan)");
    }
  }

  return result;
}

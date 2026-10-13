import { IDX_INDEX } from "../data/idx-tickers";
import { buildOwnership, buildProfile, buildQuote } from "./company";
import { buildCouncil } from "./council";
import { buildCycle } from "./cycle";
import { buildEntrySignal } from "./entrysignal";
import { getIhsg, relativeStrength } from "./ihsg";
import { buildFundamental } from "./fundamental";
import { llmEnabled, mergeAiNarrative, synthesizeCouncil } from "./llm";
import { fetchNews } from "./news";
import { buildRecommendation } from "./recommend";
import { buildTradePlan } from "./tradeplan";
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

  const [chartResult, qs, newsEarly, ihsg] = await Promise.all([
    fetchChart(symbol, "2y", "1d").catch((err: unknown) => {
      throw err instanceof Error ? err : new Error("gagal memuat data harga");
    }),
    fetchQuoteSummary(symbol).catch(() => null),
    fetchNews(ticker, localName).catch(() => EMPTY_NEWS),
    getIhsg().catch(() => null),
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
  const cycle = buildCycle(candles);
  const avgValue20 =
    candles.slice(-20).reduce((acc, c) => acc + c.c * c.v, 0) / Math.max(1, Math.min(20, candles.length));
  const lastPrice = candles[candles.length - 1].c;
  // Satu rencana transaksi dipakai Teknikal, Siklus, dan Dewan Analis agar angkanya identik.
  const plan = buildTradePlan(technical.indicators, {
    price: lastPrice,
    supports: technical.supports,
    resistances: technical.resistances,
    cycle,
  });
  if (technical.available) {
    technical.levels =
      plan.mode === "BELI"
        ? {
            entry: plan.entryHigh?.price ?? lastPrice,
            stopLoss: plan.stopLoss.price,
            target1: plan.target1.price,
            target2: plan.target2?.price ?? null,
            riskRewardRatio: plan.riskReward1,
          }
        : { entry: null, stopLoss: plan.stopLoss.price, target1: plan.target1.price, target2: null, riskRewardRatio: null };
  }
  const entry = buildEntrySignal(candles, technical.indicators, {
    supports: technical.supports,
    resistances: technical.resistances,
    plan,
    cycle,
  });
  const market = ihsg ? relativeStrength(technical.indicators, ihsg) : undefined;
  const dataRec = buildRecommendation(cycle, technical.indicators, {
    price: lastPrice,
    avgValue20,
    plan,
    rs60:
      market && market.stock60 !== null && market.ihsg60 !== null ? { stock: market.stock60, ihsg: market.ihsg60 } : null,
    entry,
  });
  let council = buildCouncil(fundamental, technical, news, momentum, quote, plan, entry);

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
    cycle,
    dataRec,
    entry,
    market,
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

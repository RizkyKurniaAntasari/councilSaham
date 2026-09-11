import { IDX_INDEX } from "../data/idx-tickers";
import type { Candle, Ownership, Profile, QuoteSnapshot } from "./types";
import { num, str } from "./yahoo";

export function buildProfile(
  ticker: string,
  symbol: string,
  qs: Record<string, any> | null,
  chartMeta: Record<string, any>,
): Profile {
  const ap = qs?.assetProfile ?? {};
  const price = qs?.price ?? {};
  const local = IDX_INDEX.get(ticker);

  const name =
    str(price.longName) ??
    str(price.shortName) ??
    str(chartMeta.longName) ??
    str(chartMeta.shortName) ??
    local?.name ??
    ticker;

  const officers = (ap.companyOfficers ?? [])
    .map((o: any) => ({
      name: str(o.name) ?? "—",
      title: str(o.title),
      age: num(o.age),
      yearBorn: num(o.yearBorn),
    }))
    .filter((o: { name: string }) => o.name !== "—")
    .slice(0, 8);

  const addressParts = [str(ap.address1), str(ap.address2), str(ap.city), str(ap.state), str(ap.country)].filter(
    Boolean,
  );

  return {
    ticker,
    symbol,
    name,
    sector: str(ap.sector) ?? local?.sector,
    industry: str(ap.industry),
    website: str(ap.website),
    summary: str(ap.longBusinessSummary),
    employees: num(ap.fullTimeEmployees),
    address: addressParts.length ? addressParts.join(", ") : undefined,
    officers,
  };
}

export function buildQuote(
  candles: Candle[],
  qs: Record<string, any> | null,
  chartMeta: Record<string, any>,
): QuoteSnapshot {
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const price = num(chartMeta.regularMarketPrice) ?? lastCandle?.c ?? 0;
  // Catatan: `chartPreviousClose` adalah penutupan sebelum AWAL rentang chart (mis. 2 tahun lalu),
  // bukan penutupan kemarin — jadi jangan dipakai sebagai acuan utama.
  const previousClose =
    num(chartMeta.previousClose) ??
    num(qs?.price?.regularMarketPreviousClose) ??
    prevCandle?.c ??
    num(chartMeta.chartPreviousClose) ??
    price;

  const sd = qs?.summaryDetail ?? {};
  const p = qs?.price ?? {};

  const change = price - previousClose;
  const changePct = previousClose ? (change / previousClose) * 100 : 0;

  const window52w = candles.slice(-250);

  return {
    price,
    previousClose,
    change,
    changePct,
    open: num(p.regularMarketOpen) ?? lastCandle?.o ?? price,
    dayHigh: num(p.regularMarketDayHigh) ?? lastCandle?.h ?? price,
    dayLow: num(p.regularMarketDayLow) ?? lastCandle?.l ?? price,
    volume: num(chartMeta.regularMarketVolume) ?? lastCandle?.v ?? 0,
    avgVolume3m: num(sd.averageVolume) ?? num(sd.averageDailyVolume3Month),
    marketCap: num(p.marketCap) ?? num(sd.marketCap),
    high52w:
      num(chartMeta.fiftyTwoWeekHigh) ??
      num(sd.fiftyTwoWeekHigh) ??
      (window52w.length ? Math.max(...window52w.map((c) => c.h)) : undefined),
    low52w:
      num(chartMeta.fiftyTwoWeekLow) ??
      num(sd.fiftyTwoWeekLow) ??
      (window52w.length ? Math.min(...window52w.map((c) => c.l)) : undefined),
    currency: str(chartMeta.currency) ?? "IDR",
    exchange: str(chartMeta.fullExchangeName) ?? str(chartMeta.exchangeName) ?? "IDX",
    marketState: str(p.marketState) ?? str(chartMeta.marketState),
    updatedAt: Date.now(),
  };
}

export function buildOwnership(qs: Record<string, any> | null): Ownership {
  const empty: Ownership = {
    topHolders: [],
    insiderTransactions: [],
    source: "Tidak tersedia",
    note: "Data kepemilikan tidak tersedia dari sumber saat ini. Rujukan resmi: laporan bulanan registrasi pemegang saham di situs KSEI/IDX dan laporan tahunan emiten.",
  };
  if (!qs) return empty;

  const mhb = qs.majorHoldersBreakdown ?? {};
  const ks = qs.defaultKeyStatistics ?? {};
  const inst = qs.institutionOwnership?.ownershipList ?? [];
  const fund = qs.fundOwnership?.ownershipList ?? [];
  const insiders = qs.insiderHolders?.holders ?? [];
  const trans = qs.insiderTransactions?.transactions ?? [];

  const pct = (v: unknown) => {
    const n = num(v);
    if (n === undefined) return undefined;
    return n > 1 ? n : n * 100;
  };

  const holders = [...inst, ...fund]
    .map((h: any) => ({
      name: str(h.organization) ?? "—",
      pct: pct(h.pctHeld),
      shares: num(h.position),
      value: num(h.value),
      date: num(h.reportDate) ? new Date((num(h.reportDate) as number) * 1000).toISOString() : undefined,
    }))
    .filter((h) => h.name !== "—")
    .sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0))
    .slice(0, 10);

  const insiderHolders = insiders
    .map((h: any) => ({
      name: str(h.name) ?? "—",
      pct: undefined as number | undefined,
      shares: num(h.positionDirect) ?? num(h.positionIndirect),
      value: undefined as number | undefined,
      date: str(h.relation),
    }))
    .filter((h: { name: string; shares?: number }) => h.name !== "—" && h.shares)
    .slice(0, 6);

  const insiderTransactions = trans
    .map((t: any) => ({
      name: str(t.filerName) ?? "—",
      relation: str(t.filerRelation),
      action: str(t.transactionText) ?? str(t.moneyText),
      shares: num(t.shares),
      value: num(t.value),
      date: num(t.startDate) ? new Date((num(t.startDate) as number) * 1000).toISOString() : undefined,
    }))
    .filter((t: { name: string }) => t.name !== "—")
    .slice(0, 10);

  const hasAny =
    holders.length > 0 ||
    insiderHolders.length > 0 ||
    insiderTransactions.length > 0 ||
    num(mhb.insidersPercentHeld) !== undefined;

  return {
    insidersPct: pct(mhb.insidersPercentHeld),
    institutionsPct: pct(mhb.institutionsPercentHeld),
    institutionsFloatPct: pct(mhb.institutionsFloatPercentHeld),
    institutionsCount: num(mhb.institutionsCount),
    sharesOutstanding: num(ks.sharesOutstanding),
    floatShares: num(ks.floatShares),
    topHolders: [...holders, ...insiderHolders].slice(0, 12),
    insiderTransactions,
    source: hasAny ? "Yahoo Finance (agregat pelaporan kepemilikan)" : "Tidak tersedia",
    note: hasAny
      ? "Cakupan data kepemilikan untuk emiten IDX sering tidak lengkap. Untuk struktur pemegang saham resmi, rujuk laporan tahunan emiten dan data KSEI."
      : empty.note,
  };
}

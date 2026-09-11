import { cached, cacheGet, cacheSet } from "./cache";
import type { Candle } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BASES = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

/** Nilai Yahoo sering berbentuk { raw, fmt }. Ambil angkanya. */
export function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "object" && v !== null && "raw" in (v as Record<string, unknown>)) {
    const raw = (v as { raw?: unknown }).raw;
    return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
  }
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "object" && v !== null && "fmt" in (v as Record<string, unknown>)) {
    const fmt = (v as { fmt?: unknown }).fmt;
    if (typeof fmt === "string" && fmt.trim()) return fmt.trim();
  }
  return undefined;
}

async function httpJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url.split("?")[0]}`);
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/* Cookie + crumb (dibutuhkan endpoint quoteSummary versi baru)         */
/* ------------------------------------------------------------------ */

type Creds = { cookie: string; crumb: string };

async function fetchCreds(): Promise<Creds | null> {
  const cachedCreds = cacheGet<Creds>("yahoo:creds");
  if (cachedCreds) return cachedCreds;

  try {
    let cookie = "";
    for (const seed of ["https://fc.yahoo.com", "https://finance.yahoo.com/quote/AAPL"]) {
      const res = await fetch(seed, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (!res) continue;
      const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
      const list =
        typeof anyHeaders.getSetCookie === "function"
          ? anyHeaders.getSetCookie()
          : [res.headers.get("set-cookie") ?? ""];
      const jar = list
        .filter(Boolean)
        .map((c) => c.split(";")[0])
        .filter((c) => /^(A1|A3|A1S|GUC|B)=/.test(c));
      if (jar.length) {
        cookie = jar.join("; ");
        break;
      }
    }
    if (!cookie) return null;

    const crumbRes = await fetch(`${BASES[0]}/v1/test/getcrumb`, {
      headers: { "User-Agent": UA, Accept: "text/plain,*/*", Cookie: cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.length > 32 || crumb.includes("<")) return null;

    return cacheSet("yahoo:creds", { cookie, crumb }, 45 * 60 * 1000);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Chart / OHLCV                                                       */
/* ------------------------------------------------------------------ */

export interface ChartResult {
  candles: Candle[];
  meta: Record<string, any>;
}

export async function fetchChart(symbol: string, range = "2y", interval = "1d"): Promise<ChartResult> {
  return cached(`yahoo:chart:${symbol}:${range}:${interval}`, 3 * 60 * 1000, async () => {
    let lastErr: unknown = null;
    for (const base of BASES) {
      try {
        const url = `${base}/v8/finance/chart/${encodeURIComponent(
          symbol,
        )}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;
        const json = await httpJson(url);
        const result = json?.chart?.result?.[0];
        if (!result) throw new Error("chart kosong");

        const ts: number[] = result.timestamp ?? [];
        const q = result.indicators?.quote?.[0] ?? {};

        const candles: Candle[] = [];
        for (let i = 0; i < ts.length; i++) {
          const c = q.close?.[i];
          if (c === null || c === undefined || !Number.isFinite(c)) continue;
          const o = q.open?.[i] ?? c;
          const h = q.high?.[i] ?? c;
          const l = q.low?.[i] ?? c;
          const v = q.volume?.[i] ?? 0;
          candles.push({
            t: ts[i] * 1000,
            o: Number(o),
            h: Number(h),
            l: Number(l),
            c: Number(c),
            v: Number(v) || 0,
          });
        }
        if (!candles.length) throw new Error("tidak ada candle valid");
        return { candles, meta: result.meta ?? {} };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("gagal mengambil data harga");
  });
}

/* ------------------------------------------------------------------ */
/* quoteSummary (profil, fundamental, kepemilikan)                     */
/* ------------------------------------------------------------------ */

const MODULES = [
  "assetProfile",
  "price",
  "summaryDetail",
  "defaultKeyStatistics",
  "financialData",
  "majorHoldersBreakdown",
  "institutionOwnership",
  "fundOwnership",
  "insiderHolders",
  "insiderTransactions",
  "incomeStatementHistory",
  "balanceSheetHistory",
  "cashflowStatementHistory",
  "earningsTrend",
  "recommendationTrend",
  "calendarEvents",
].join("%2C");

export async function fetchQuoteSummary(symbol: string): Promise<Record<string, any> | null> {
  return cached(`yahoo:qs:${symbol}`, 15 * 60 * 1000, async () => {
    const creds = await fetchCreds();

    const attempts: { url: string; headers: Record<string, string> }[] = [];
    if (creds) {
      for (const base of BASES) {
        attempts.push({
          url: `${base}/v10/finance/quoteSummary/${encodeURIComponent(
            symbol,
          )}?modules=${MODULES}&crumb=${encodeURIComponent(creds.crumb)}&formatted=false`,
          headers: { Cookie: creds.cookie },
        });
      }
    }
    for (const base of BASES) {
      attempts.push({
        url: `${base}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${MODULES}`,
        headers: {},
      });
    }

    for (const attempt of attempts) {
      try {
        const json = await httpJson(attempt.url, attempt.headers);
        const result = json?.quoteSummary?.result?.[0];
        if (result) return result as Record<string, any>;
      } catch {
        /* coba endpoint berikutnya */
      }
    }
    return null;
  });
}

/* ------------------------------------------------------------------ */
/* Pencarian simbol                                                    */
/* ------------------------------------------------------------------ */

export interface YahooSearchHit {
  symbol: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
}

export async function searchSymbols(query: string): Promise<YahooSearchHit[]> {
  if (!query.trim()) return [];
  return cached(`yahoo:search:${query.toLowerCase()}`, 10 * 60 * 1000, async () => {
    for (const base of BASES) {
      try {
        const url = `${base}/v1/finance/search?q=${encodeURIComponent(
          query,
        )}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
        const json = await httpJson(url);
        const quotes: YahooSearchHit[] = json?.quotes ?? [];
        return quotes.filter((q) => q.symbol);
      } catch {
        /* lanjut */
      }
    }
    return [];
  });
}

/* ------------------------------------------------------------------ */
/* Utilitas simbol IDX                                                 */
/* ------------------------------------------------------------------ */

export function normalizeTicker(input: string): string {
  return input.trim().toUpperCase().replace(/\.JK$/i, "").replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function toYahooSymbol(ticker: string): string {
  const t = normalizeTicker(ticker);
  return `${t}.JK`;
}

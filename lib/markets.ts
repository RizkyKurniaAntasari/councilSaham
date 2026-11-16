import { cached } from "./cache";
import { pctChange } from "./indicators";
import type { GoldIdr, MarketQuote, MarketsReport, NftFloor } from "./types";
import { fetchChart } from "./yahoo";

/**
 * Ringkasan pasar lintas aset: indeks Indonesia & global, emas (XAU/USD dan
 * rupiah per gram), komoditas, valas, dan kripto — semuanya dari Yahoo Finance
 * lewat `fetchChart`, sumber yang sama dengan analisis saham.
 */

const TROY_OUNCE_GRAM = 31.1034768;

export const MARKET_SYMBOLS: { id: string; group: string; name: string; symbol: string }[] = [
  { id: "ihsg", group: "Indonesia", name: "IHSG", symbol: "^JKSE" },
  { id: "lq45", group: "Indonesia", name: "LQ45", symbol: "^JKLQ45" },
  { id: "usdidr", group: "Indonesia", name: "USD/IDR", symbol: "USDIDR=X" },
  { id: "sp500", group: "Indeks global", name: "S&P 500", symbol: "^GSPC" },
  { id: "dow", group: "Indeks global", name: "Dow Jones", symbol: "^DJI" },
  { id: "nasdaq", group: "Indeks global", name: "Nasdaq", symbol: "^IXIC" },
  { id: "nikkei", group: "Indeks global", name: "Nikkei 225", symbol: "^N225" },
  { id: "hangseng", group: "Indeks global", name: "Hang Seng", symbol: "^HSI" },
  { id: "shanghai", group: "Indeks global", name: "Shanghai", symbol: "000001.SS" },
  { id: "kospi", group: "Indeks global", name: "KOSPI", symbol: "^KS11" },
  { id: "sti", group: "Indeks global", name: "Straits Times", symbol: "^STI" },
  { id: "ftse", group: "Indeks global", name: "FTSE 100", symbol: "^FTSE" },
  { id: "dax", group: "Indeks global", name: "DAX", symbol: "^GDAXI" },
  // Yahoo tidak menyediakan XAU/USD spot; kontrak berjangka emas COMEX terdekat
  // dipakai sebagai acuan (selisihnya terhadap spot umumnya di bawah 1%).
  { id: "gold", group: "Emas & komoditas", name: "Emas dunia (XAU/USD)", symbol: "GC=F" },
  { id: "silver", group: "Emas & komoditas", name: "Perak", symbol: "SI=F" },
  { id: "oil", group: "Emas & komoditas", name: "Minyak WTI", symbol: "CL=F" },
  { id: "btc", group: "Kripto", name: "Bitcoin", symbol: "BTC-USD" },
  { id: "eth", group: "Kripto", name: "Ethereum", symbol: "ETH-USD" },
];

async function quoteOf(spec: (typeof MARKET_SYMBOLS)[number]): Promise<MarketQuote> {
  const { candles, meta } = await fetchChart(spec.symbol, "3mo", "1d");
  if (candles.length < 2) throw new Error("data kurang");
  const n = candles.length;
  const price = candles[n - 1].c;

  // Perubahan harian: pakai angka resmi dari meta bila ada (candle harian valas
  // Yahoo kadang cacat), selain itu hitung dari penutupan sebelumnya.
  const metaPct = Number(meta.regularMarketChangePercent);
  const usable = typeof meta.regularMarketChangePercent === "number" && Number.isFinite(metaPct) && Math.abs(metaPct) < 40;
  const changePct = usable ? metaPct : pctChange(candles[n - 2].c, price);
  const prev = price / (1 + changePct / 100);

  return {
    id: spec.id,
    group: spec.group,
    name: spec.name,
    symbol: spec.symbol,
    currency: typeof meta.currency === "string" ? meta.currency : "",
    price,
    change: price - prev,
    changePct,
    return20d: n > 20 ? pctChange(candles[n - 21].c, price) : null,
    spark: candles.slice(-40).map((c) => c.c),
    updatedAt: candles[n - 1].t,
  };
}

export async function getMarkets(): Promise<MarketsReport> {
  return cached("markets:v1", 3 * 60 * 1000, async () => {
    const settled = await Promise.allSettled(MARKET_SYMBOLS.map(quoteOf));
    const quotes: MarketQuote[] = [];
    const failed: string[] = [];
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") quotes.push(r.value);
      else failed.push(MARKET_SYMBOLS[i].name);
    });
    if (!quotes.length) throw new Error("Sumber data pasar tidak dapat dijangkau saat ini.");

    const g = quotes.find((q) => q.id === "gold");
    const fx = quotes.find((q) => q.id === "usdidr");
    let gold: GoldIdr | null = null;
    if (g && fx) {
      const now = (g.price * fx.price) / TROY_OUNCE_GRAM;
      const before = ((g.price - g.change) * (fx.price - fx.change)) / TROY_OUNCE_GRAM;
      gold = { usdPerOz: g.price, usdIdr: fx.price, idrPerGram: now, changePct: pctChange(before, now) };
    }
    return { generatedAt: Date.now(), quotes, gold, failed };
  });
}

/* ------------------------------------------------------------------ */
/* Harga dasar (floor) koleksi NFT — CoinGecko, tanpa API key          */
/* ------------------------------------------------------------------ */

const NFT_COLLECTIONS = ["cryptopunks", "bored-ape-yacht-club", "pudgy-penguins", "azuki", "milady-maker"];

async function nftOf(slug: string): Promise<NftFloor | null> {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/nfts/${slug}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as Record<string, any>;
    const floor = Number(d?.floor_price?.native_currency);
    if (!Number.isFinite(floor) || floor <= 0) return null;
    const opt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      id: slug,
      name: typeof d.name === "string" ? d.name : slug,
      symbol: typeof d.symbol === "string" ? d.symbol : "",
      nativeCurrency: typeof d.native_currency_symbol === "string" ? d.native_currency_symbol : "ETH",
      floorNative: floor,
      floorUsd: opt(d?.floor_price?.usd),
      change24hPct: opt(d?.floor_price_in_usd_24h_percentage_change),
      volume24hUsd: opt(d?.volume_24h?.usd),
    };
  } catch {
    return null;
  }
}

/** Diambil berurutan (API gratis dibatasi lajunya) dan di-cache 30 menit. */
export async function getNftFloors(): Promise<NftFloor[]> {
  return cached("markets:nft:v1", 30 * 60 * 1000, async () => {
    const out: NftFloor[] = [];
    for (let i = 0; i < NFT_COLLECTIONS.length; i++) {
      if (i) await new Promise((r) => setTimeout(r, 1200));
      const row = await nftOf(NFT_COLLECTIONS[i]);
      if (row) out.push(row);
    }
    // Hasil kosong (kena batas laju) tidak boleh mengunci cache 30 menit.
    if (!out.length) throw new Error("Data NFT sedang tidak tersedia.");
    return out;
  });
}

import { cached } from "./cache";
import { fetchGoogleNews, normKey, type RawItem } from "./news";
import { analyzeSentiment } from "./sentiment";
import type { MarketNewsItem, MarketNewsReport, MarketTopicId } from "./types";

/**
 * Berita pasar per topik — di luar berita emiten: IHSG, emas & XAU, indeks
 * global, NFT, kripto, dan makro. Setiap hasil pencarian disaring ulang dengan
 * kata kunci topik supaya artikel yang hanya "nyerempet" tidak ikut tampil.
 */

interface Topic {
  id: MarketTopicId;
  label: string;
  icon: string;
  queries: { q: string; locale?: "id" | "en" }[];
  /** Judul/cuplikan harus memuat salah satu kata kunci ini. */
  must: RegExp;
}

export const MARKET_TOPICS: Topic[] = [
  {
    id: "ihsg",
    label: "IHSG",
    icon: "🇮🇩",
    queries: [{ q: "IHSG when:3d" }, { q: '"indeks harga saham gabungan" OR "bursa efek indonesia" when:3d' }],
    must: /\bihsg\b|indeks harga saham gabungan|bursa efek indonesia|\bbei\b|\bidx\b|\blq45\b/i,
  },
  {
    id: "saham",
    label: "Saham",
    icon: "📈",
    queries: [{ q: "saham emiten BEI when:2d" }, { q: '"rekomendasi saham" OR "saham pilihan" when:2d' }],
    must: /\bsaham\b|\bemiten\b/i,
  },
  {
    id: "emas",
    label: "Emas & XAU",
    icon: "🥇",
    queries: [
      { q: "harga emas when:3d" },
      { q: '"XAU/USD" OR XAUUSD OR "emas dunia" OR "emas antam" when:3d' },
    ],
    must: /\bemas\b|\bgold\b|xau|logam mulia/i,
  },
  {
    id: "global",
    label: "Indeks global",
    icon: "🌐",
    queries: [
      { q: '"Wall Street" OR Nasdaq OR "Dow Jones" OR "S&P 500" when:3d' },
      { q: 'Nikkei OR "Hang Seng" OR "bursa Asia" OR "bursa Eropa" OR Kospi when:3d' },
    ],
    must: /wall street|nasdaq|dow jones|s&p|nikkei|hang seng|kospi|shanghai|\bdax\b|ftse|bursa (asia|eropa|global|as|saham as)|indeks (global|saham as)/i,
  },
  {
    id: "nft",
    label: "NFT",
    icon: "🖼️",
    queries: [{ q: "NFT when:14d" }, { q: "NFT market when:3d", locale: "en" }],
    must: /\bnfts?\b|non-fungible/i,
  },
  {
    id: "kripto",
    label: "Kripto",
    icon: "🪙",
    queries: [{ q: "bitcoin OR ethereum OR kripto when:2d" }],
    must: /bitcoin|\bbtc\b|ethereum|\beth\b|kripto|crypto|altcoin/i,
  },
  {
    id: "ekonomi",
    label: "Ekonomi & rupiah",
    icon: "🏦",
    queries: [{ q: 'rupiah OR "Bank Indonesia" OR inflasi OR "The Fed" OR "suku bunga" when:3d' }],
    must: /rupiah|bank indonesia|inflasi|the fed|suku bunga|bi rate|ekonomi|\bpdb\b/i,
  },
];

const PER_TOPIC = 30;

export function isMarketTopic(v: string): v is MarketTopicId {
  return MARKET_TOPICS.some((t) => t.id === v);
}

async function topicNews(topic: Topic): Promise<MarketNewsItem[]> {
  return cached(`marketnews:v1:${topic.id}`, 5 * 60 * 1000, async () => {
    const batches = await Promise.all(topic.queries.map((x) => fetchGoogleNews(x.q, x.locale ?? "id")));
    const seen = new Set<string>();
    const items: MarketNewsItem[] = [];
    const raw = ([] as RawItem[]).concat(...batches).sort((a, b) => b.publishedAt - a.publishedAt);
    for (const r of raw) {
      if (!/^https?:\/\//i.test(r.url)) continue;
      const key = normKey(r.title);
      if (!key || seen.has(key)) continue;
      // Cuplikan Google News hanya mengulang judul + nama media — buang bila begitu.
      const repeatsTitle = r.snippet.toLowerCase().startsWith(r.title.toLowerCase().slice(0, 40));
      const snippet = r.snippet && !repeatsTitle ? r.snippet : "";
      if (!topic.must.test(`${r.title} ${snippet}`)) continue;
      seen.add(key);
      const s = analyzeSentiment(`${r.title}. ${snippet}`);
      items.push({
        id: `${topic.id}-${key.replace(/ /g, "-")}-${r.publishedAt}`,
        topic: topic.id,
        topicLabel: topic.label,
        title: r.title,
        url: r.url,
        source: r.source,
        publishedAt: r.publishedAt,
        snippet: snippet || undefined,
        sentiment: s.score,
        sentimentLabel: s.label,
      });
      if (items.length >= PER_TOPIC) break;
    }
    // Sumber gagal total → lempar agar daftar kosong tidak ter-cache.
    if (!items.length && batches.every((b) => !b.length)) throw new Error("sumber berita tidak merespons");
    return items;
  });
}

export async function getMarketNews(topic: MarketTopicId | "semua"): Promise<MarketNewsReport> {
  const settled = await Promise.allSettled(MARKET_TOPICS.map((t) => topicNews(t)));
  if (settled.every((r) => r.status === "rejected")) throw new Error("Sumber berita tidak dapat dijangkau saat ini.");
  const byTopic = new Map<MarketTopicId, MarketNewsItem[]>();
  settled.forEach((r, i) => byTopic.set(MARKET_TOPICS[i].id, r.status === "fulfilled" ? r.value : []));

  let items: MarketNewsItem[];
  if (topic === "semua") {
    // Satu artikel bisa muncul di beberapa topik — tampilkan sekali saja.
    const seen = new Set<string>();
    items = [];
    for (const t of MARKET_TOPICS) {
      for (const it of byTopic.get(t.id) ?? []) {
        const key = normKey(it.title);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(it);
      }
    }
    items.sort((a, b) => b.publishedAt - a.publishedAt);
  } else {
    items = byTopic.get(topic) ?? [];
  }

  const now = Date.now();
  return {
    generatedAt: now,
    topic,
    topics: MARKET_TOPICS.map((t) => ({
      id: t.id,
      label: t.label,
      icon: t.icon,
      count: byTopic.get(t.id)?.length ?? 0,
    })),
    items,
    counts: {
      positive: items.filter((n) => n.sentimentLabel === "POSITIF").length,
      negative: items.filter((n) => n.sentimentLabel === "NEGATIF").length,
      neutral: items.filter((n) => n.sentimentLabel === "NETRAL").length,
      total: items.length,
    },
    avgSentiment: items.length ? items.reduce((a, b) => a + b.sentiment, 0) / items.length : 0,
    last24h: items.filter((n) => now - n.publishedAt <= 86400000).length,
  };
}

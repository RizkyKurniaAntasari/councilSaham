import { cached } from "./cache";
import { clamp } from "./indicators";
import { analyzeSentiment, detectThemes } from "./sentiment";
import type { NewsItem, NewsReport } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

interface RawItem {
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  snippet: string;
}

async function fetchGoogleNews(query: string): Promise<RawItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml,application/xml,text/xml,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.split("<item>").slice(1);
    const items: RawItem[] = [];
    for (const raw of blocks) {
      const block = raw.split("</item>")[0];
      const rawTitle = tag(block, "title");
      if (!rawTitle) continue;
      const sourceTag = tag(block, "source");
      // Google News menambahkan " - Nama Media" di akhir judul
      let title = rawTitle;
      const dashIdx = title.lastIndexOf(" - ");
      let source = sourceTag;
      if (dashIdx > 20) {
        const tail = title.slice(dashIdx + 3).trim();
        if (tail.length < 40) {
          title = title.slice(0, dashIdx).trim();
          if (!source) source = tail;
        }
      }
      const link = tag(block, "link");
      const pub = tag(block, "pubDate");
      const ts = pub ? Date.parse(pub) : NaN;
      items.push({
        title,
        url: link,
        source: source || "Google News",
        publishedAt: Number.isFinite(ts) ? ts : Date.now(),
        snippet: decodeEntities(tag(block, "description")).slice(0, 320),
      });
    }
    return items;
  } catch {
    return [];
  }
}

async function fetchNewsApi(query: string): Promise<RawItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      query,
    )}&language=id&sortBy=publishedAt&pageSize=30`;
    const res = await fetch(url, {
      headers: { "X-Api-Key": key, "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { articles?: any[] };
    return (json.articles ?? []).map((a) => ({
      title: String(a.title ?? ""),
      url: String(a.url ?? ""),
      source: String(a.source?.name ?? "NewsAPI"),
      publishedAt: Date.parse(a.publishedAt ?? "") || Date.now(),
      snippet: String(a.description ?? "").slice(0, 320),
    }));
  } catch {
    return [];
  }
}

function normKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

function buzzLevel(last7d: number): string {
  if (last7d >= 25) return "Sangat ramai";
  if (last7d >= 12) return "Ramai";
  if (last7d >= 5) return "Normal";
  if (last7d >= 1) return "Sepi";
  return "Senyap";
}

export async function fetchNews(ticker: string, companyName: string): Promise<NewsReport> {
  const cacheKey = `news:${ticker}:${companyName}`;
  return cached(cacheKey, 5 * 60 * 1000, async () => {
    const shortName = companyName
      .replace(/\b(PT|Tbk|\(Persero\)|Persero)\b/gi, "")
      .replace(/\([^)]*\)/g, "")
      .trim();

    const queries = [
      `"${ticker}" saham`,
      `"saham ${ticker}"`,
      shortName.length > 3 ? `"${shortName}"` : `${ticker} IDX`,
      `${ticker} emiten OR IDX OR BEI`,
    ];

    const batches = await Promise.all([
      ...queries.map((q) => fetchGoogleNews(q)),
      fetchNewsApi(`${ticker} OR "${shortName}"`),
    ]);

    const seen = new Set<string>();
    const raw: RawItem[] = [];
    for (const batch of batches) {
      for (const item of batch) {
        const key = normKey(item.title);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        raw.push(item);
      }
    }

    const tickerRe = new RegExp(`\\b${ticker}\\b`, "i");
    const nameTokens = shortName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const items: NewsItem[] = raw
      .map((r, i) => {
        const text = `${r.title}. ${r.snippet}`;
        const lower = text.toLowerCase();
        let relevance = 0;
        if (tickerRe.test(text)) relevance += 0.6;
        const nameHits = nameTokens.filter((t) => lower.includes(t)).length;
        relevance += Math.min(0.4, nameHits * 0.18);
        if (/\b(saham|emiten|bei|idx|bursa)\b/i.test(text)) relevance += 0.12;
        relevance = Math.min(1, relevance);

        const s = analyzeSentiment(text);
        return {
          id: `${ticker}-${i}-${r.publishedAt}`,
          title: r.title,
          url: r.url,
          source: r.source,
          publishedAt: r.publishedAt,
          snippet: r.snippet,
          sentiment: s.score,
          sentimentLabel: s.label,
          matchedKeywords: s.matched,
          relevance,
          themes: detectThemes(text),
        } satisfies NewsItem;
      })
      .filter((n) => n.relevance >= 0.3)
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, 40);

    const now = Date.now();
    const day = 86400000;
    const last24h = items.filter((n) => now - n.publishedAt <= day).length;
    const last7d = items.filter((n) => now - n.publishedAt <= 7 * day).length;
    const last30d = items.filter((n) => now - n.publishedAt <= 30 * day).length;

    const counts = {
      positive: items.filter((n) => n.sentimentLabel === "POSITIF").length,
      negative: items.filter((n) => n.sentimentLabel === "NEGATIF").length,
      neutral: items.filter((n) => n.sentimentLabel === "NETRAL").length,
      total: items.length,
    };

    // Sentimen tertimbang: berita lebih baru & lebih relevan berbobot lebih besar
    let weighted = 0;
    let weightSum = 0;
    for (const n of items) {
      const ageDays = (now - n.publishedAt) / day;
      const recency = Math.exp(-ageDays / 14);
      const w = recency * (0.4 + n.relevance * 0.6);
      weighted += n.sentiment * w;
      weightSum += w;
    }
    const avgSentiment = weightSum ? weighted / weightSum : 0;

    const themeMap = new Map<string, { count: number; sum: number }>();
    for (const n of items) {
      for (const t of n.themes) {
        const cur = themeMap.get(t) ?? { count: 0, sum: 0 };
        cur.count++;
        cur.sum += n.sentiment;
        themeMap.set(t, cur);
      }
    }
    const topThemes = Array.from(themeMap.entries())
      .map(([theme, v]) => ({ theme, count: v.count, sentiment: v.sum / v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const score = clamp(50 + avgSentiment * 45 + Math.min(8, last7d * 0.4));

    const highlights = items
      .filter((n) => n.sentiment > 0.2)
      .slice(0, 4)
      .map((n) => `${n.source}: ${n.title}`);
    const risks = items
      .filter((n) => n.sentiment < -0.2)
      .slice(0, 4)
      .map((n) => `${n.source}: ${n.title}`);

    if (!items.length) {
      risks.push("Tidak ditemukan berita relevan — story/katalis belum bisa diverifikasi dari sisi pemberitaan.");
    }

    return {
      available: items.length > 0,
      items,
      score: Math.round(score),
      avgSentiment,
      counts,
      buzz: { last24h, last7d, last30d, buzzLevel: buzzLevel(last7d) },
      topThemes,
      sources: Array.from(new Set(items.map((n) => n.source))).slice(0, 12),
      highlights,
      risks,
    } satisfies NewsReport;
  });
}

"use client";

import { useMemo, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { NewsReport } from "@/lib/types";
import { Badge, ScoreBar, Section, Stat } from "./ui";

type Filter = "semua" | "POSITIF" | "NEGATIF" | "NETRAL";

export default function NewsPanel({ news, ticker }: { news: NewsReport; ticker: string }) {
  const [filter, setFilter] = useState<Filter>("semua");
  const [theme, setTheme] = useState<string | null>(null);
  const [limit, setLimit] = useState(12);

  const filtered = useMemo(() => {
    return news.items.filter(
      (n) => (filter === "semua" || n.sentimentLabel === filter) && (!theme || n.themes.includes(theme)),
    );
  }, [news.items, filter, theme]);

  return (
    <Section
      id="berita"
      title={`Berita Terkait ${ticker}`}
      icon="📰"
      subtitle="Dikumpulkan dari agregator berita Indonesia, disaring berdasarkan relevansi terhadap emiten, lalu diberi skor sentimen memakai leksikon pasar modal berbahasa Indonesia."
      right={
        <Badge tone={news.avgSentiment > 0.12 ? "bull" : news.avgSentiment < -0.12 ? "bear" : "warn"}>
          Sentimen {news.avgSentiment > 0.12 ? "positif" : news.avgSentiment < -0.12 ? "negatif" : "netral"} ·{" "}
          {news.score}/100
        </Badge>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Total berita relevan" value={news.counts.total} />
        <Stat label="24 jam terakhir" value={news.buzz.last24h} />
        <Stat label="7 hari terakhir" value={news.buzz.last7d} />
        <Stat label="Intensitas" value={news.buzz.buzzLevel} />
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 sm:grid-cols-3">
        <ScoreBar
          label="Berita positif"
          score={news.counts.total ? (news.counts.positive / news.counts.total) * 100 : 0}
          right={`${news.counts.positive} berita`}
        />
        <ScoreBar
          label="Berita netral"
          score={news.counts.total ? (news.counts.neutral / news.counts.total) * 100 : 0}
          right={`${news.counts.neutral} berita`}
        />
        <ScoreBar
          label="Berita negatif"
          score={news.counts.total ? (news.counts.negative / news.counts.total) * 100 : 0}
          right={`${news.counts.negative} berita`}
        />
      </div>

      {news.topThemes.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Tema yang sedang dibicarakan
          </p>
          <div className="flex flex-wrap gap-2">
            {news.topThemes.map((t) => (
              <button
                key={t.theme}
                onClick={() => setTheme(theme === t.theme ? null : t.theme)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  theme === t.theme
                    ? "border-brandx bg-brandx/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                {t.theme}
                <span className="ml-1.5 text-slate-500">{t.count}</span>
                <span className={`ml-1.5 ${t.sentiment > 0.1 ? "text-bull" : t.sentiment < -0.1 ? "text-bear" : "text-slate-500"}`}>
                  {t.sentiment > 0.1 ? "▲" : t.sentiment < -0.1 ? "▼" : "•"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(["semua", "POSITIF", "NETRAL", "NEGATIF"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filter === f ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {f.toLowerCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {filtered.length} berita ditampilkan{theme ? ` · tema "${theme}"` : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-3xl">🔕</p>
          <p className="mt-3 text-sm font-medium text-slate-300">Tidak ada berita yang cocok</p>
          <p className="muted mt-1.5">
            {news.items.length
              ? "Coba ubah filter sentimen atau tema."
              : `Tidak ditemukan pemberitaan relevan untuk ${ticker} saat ini. Ketiadaan berita sendiri merupakan informasi: tidak ada katalis publik yang menggerakkan harga.`}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {filtered.slice(0, limit).map((n) => (
            <li key={n.id}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-slate-100 group-hover:text-white">
                      {n.title}
                    </p>
                    {n.snippet && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.snippet}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-400">{n.source}</span>
                      <span>·</span>
                      <span>{timeAgo(n.publishedAt)}</span>
                      {n.themes.map((t) => (
                        <span key={t} className="rounded-full bg-white/5 px-2 py-0.5">
                          {t}
                        </span>
                      ))}
                      {n.matchedKeywords.length > 0 && (
                        <span className="text-slate-600">kata kunci: {n.matchedKeywords.slice(0, 3).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0">
                    <Badge
                      tone={
                        n.sentimentLabel === "POSITIF" ? "bull" : n.sentimentLabel === "NEGATIF" ? "bear" : "neutral"
                      }
                    >
                      {n.sentimentLabel === "POSITIF" ? "▲" : n.sentimentLabel === "NEGATIF" ? "▼" : "•"}{" "}
                      {(n.sentiment * 100).toFixed(0)}
                    </Badge>
                  </span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > limit && (
        <button onClick={() => setLimit((l) => l + 12)} className="btn-ghost mt-4 w-full">
          Tampilkan {Math.min(12, filtered.length - limit)} berita lagi
        </button>
      )}

      {news.sources.length > 0 && (
        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          Sumber yang muncul: {news.sources.join(", ")}. Tautan mengarah ke situs penerbit aslinya.
        </p>
      )}
    </Section>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDateTime, timeAgo } from "@/lib/format";
import type {
  MarketNewsReport,
  MarketQuote,
  MarketsReport,
  MarketTopicId,
  NftFloor,
} from "@/lib/types";
import { Sparkline } from "./cycle-ui";
import { Badge, Section, Stat } from "./ui";

type TopicFilter = MarketTopicId | "semua";
type SentimentFilter = "semua" | "POSITIF" | "NETRAL" | "NEGATIF";

const TOPIC_IDS: MarketTopicId[] = ["ihsg", "saham", "emas", "global", "nft", "kripto", "ekonomi"];

const id = (v: number, min = 0, max = 2) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: min, maximumFractionDigits: max });

function fmtPrice(q: MarketQuote): string {
  const a = Math.abs(q.price);
  return a >= 10000 ? id(q.price, 0, 0) : a >= 100 ? id(q.price, 2, 2) : id(q.price, 2, 4);
}

function Pct({ v, digits = 2 }: { v: number | null; digits?: number }) {
  if (v === null || !Number.isFinite(v)) return <span className="text-slate-500">—</span>;
  return (
    <span className={`font-semibold tabular ${v > 0 ? "text-bull" : v < 0 ? "text-bear" : "text-slate-400"}`}>
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {Math.abs(v).toFixed(digits).replace(".", ",")}%
    </span>
  );
}

/** Kode mata uang hanya ditampilkan untuk aset yang dikutip dalam mata uang (bukan poin indeks). */
function unitOf(q: MarketQuote): string {
  if (q.group === "Indeks global" || q.id === "ihsg" || q.id === "lq45" || q.id === "usdidr") return "";
  return q.currency;
}

function QuoteCard({ q }: { q: MarketQuote }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs font-medium text-slate-400">{q.name}</span>
        <span className="shrink-0 text-xs">
          <Pct v={q.changePct} />
        </span>
      </div>
      <p className="mt-1 text-lg font-bold tabular text-white">
        {fmtPrice(q)}
        {unitOf(q) && <span className="ml-1 text-[10px] font-medium text-slate-500">{unitOf(q)}</span>}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <Sparkline values={q.spark} width={84} height={26} />
        <span className="text-[10px] text-slate-500">
          20H <Pct v={q.return20d} digits={1} />
        </span>
      </div>
    </>
  );
  const cls = "block rounded-xl border border-white/8 bg-white/[0.03] p-3 transition";
  const href = q.id === "ihsg" ? "/ihsg" : q.id === "gold" ? "/emas" : null;
  return href ? (
    <Link
      href={href}
      className={`${cls} hover:border-brandx/40 hover:bg-white/[0.06]`}
      title={q.id === "gold" ? "Buka rekomendasi emas" : "Buka analisis IHSG"}
    >
      {body}
    </Link>
  ) : (
    <div className={cls} title={`${q.symbol} · ${fmtDateTime(q.updatedAt)}`}>
      {body}
    </div>
  );
}

function MarketStrip() {
  const [d, setD] = useState<MarketsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/markets");
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Gagal memuat data pasar.");
      setD(j as MarketsReport);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data pasar.");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const groups = useMemo(() => {
    const out: { name: string; quotes: MarketQuote[] }[] = [];
    for (const q of d?.quotes ?? []) {
      const g = out.find((x) => x.name === q.group);
      if (g) g.quotes.push(q);
      else out.push({ name: q.group, quotes: [q] });
    }
    return out;
  }, [d]);

  return (
    <Section
      title="Ringkasan Pasar"
      icon="🌐"
      subtitle="IHSG, indeks global, emas (XAU/USD dan rupiah per gram), komoditas, dan kripto. Diperbarui tiap 3 menit; data bisa tertunda ±15 menit."
      right={d ? <span className="text-xs text-slate-500">Diperbarui {timeAgo(d.generatedAt)}</span> : undefined}
    >
      {error && !d && (
        <div className="rounded-xl border border-bear/30 bg-bear/10 p-4 text-sm text-bear">
          {error}{" "}
          <button onClick={() => void load()} className="font-semibold underline">
            Coba lagi
          </button>
        </div>
      )}
      {!d && !error && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="skeleton h-[104px]" />
          ))}
        </div>
      )}
      {d && (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.name}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.name}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {g.quotes.map((q) => (
                  <QuoteCard key={q.id} q={q} />
                ))}
                {g.name === "Emas & komoditas" && d.gold && (
                  <Link
                    href="/emas"
                    className="block rounded-xl border border-warn/30 bg-warn/[0.06] p-3 transition hover:border-warn/60"
                    title="Harga emas dunia dikonversi ke rupiah per gram. Belum termasuk selisih jual-beli, ongkos cetak, dan pajak — harga emas batangan ritel lebih tinggi. Klik untuk rekomendasi emas."
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-medium text-warn">Emas per gram</span>
                      <span className="shrink-0 text-xs">
                        <Pct v={d.gold.changePct} />
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-bold tabular text-white">Rp {id(d.gold.idrPerGram, 0, 0)}</p>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                      ${id(d.gold.usdPerOz, 0, 0)}/oz × Rp {id(d.gold.usdIdr, 0, 0)} ÷ 31,1 g — acuan, bukan harga
                      ritel
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-warn">Lihat rekomendasi emas →</p>
                  </Link>
                )}
              </div>
            </div>
          ))}
          {d.failed.length > 0 && (
            <p className="text-[11px] text-slate-600">Tidak termuat saat ini: {d.failed.join(", ")}.</p>
          )}
        </div>
      )}
    </Section>
  );
}

function NftTable() {
  const [rows, setRows] = useState<NftFloor[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/markets?nft=1")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: { nfts: NftFloor[] }) => setRows(j.nfts))
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-500">
        Harga dasar koleksi NFT sedang tidak tersedia dari sumbernya (batas laju API). Berita NFT tetap tampil di bawah.
      </p>
    );
  }
  if (!rows) return <div className="skeleton mb-4 h-40" />;

  const usd = (v: number | null) => (v === null ? "—" : `$${id(v, 0, v >= 1000 ? 0 : 2)}`);
  return (
    <div className="mb-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5 font-medium">Koleksi</th>
            <th className="px-4 py-2.5 text-right font-medium">Harga dasar</th>
            <th className="px-4 py-2.5 text-right font-medium">≈ USD</th>
            <th className="px-4 py-2.5 text-right font-medium">24 jam</th>
            <th className="px-4 py-2.5 text-right font-medium">Volume 24 jam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n.id} className="border-t border-white/8">
              <td className="px-4 py-2.5 font-medium text-slate-100">
                {n.name} <span className="text-xs font-normal text-slate-500">{n.symbol}</span>
              </td>
              <td className="px-4 py-2.5 text-right tabular text-slate-200">
                {id(n.floorNative, 2, 2)} {n.nativeCurrency}
              </td>
              <td className="px-4 py-2.5 text-right tabular text-slate-300">{usd(n.floorUsd)}</td>
              <td className="px-4 py-2.5 text-right">
                <Pct v={n.change24hPct} />
              </td>
              <td className="px-4 py-2.5 text-right tabular text-slate-300">{usd(n.volume24hUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-white/8 px-4 py-2 text-[11px] text-slate-600">
        Harga dasar (floor price) dari CoinGecko. NFT sangat tidak likuid dan spekulatif.
      </p>
    </div>
  );
}

export default function MarketNews() {
  const [topic, setTopic] = useState<TopicFilter>("semua");
  const [data, setData] = useState<MarketNewsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState<SentimentFilter>("semua");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(15);

  // Topik awal dari URL (?topik=emas) agar tautan bisa dibagikan.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("topik");
    if (t && (TOPIC_IDS as string[]).includes(t)) setTopic(t as TopicFilter);
  }, []);

  const load = useCallback(async (t: TopicFilter, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/market-news?topic=${encodeURIComponent(t)}`, { signal });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Gagal memuat berita.");
      setData(j as MarketNewsReport);
      setError(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Gagal memuat berita.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void load(topic, ctrl.signal);
    return () => ctrl.abort();
  }, [topic, load]);

  const pick = (t: TopicFilter) => {
    setTopic(t);
    setLimit(15);
    const url = new URL(window.location.href);
    if (t === "semua") url.searchParams.delete("topik");
    else url.searchParams.set("topik", t);
    window.history.replaceState(null, "", url);
  };

  // Data yang sedang tampil bisa milik topik sebelumnya selama pemuatan.
  const fresh = data && data.topic === topic ? data : null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (fresh?.items ?? []).filter(
      (n) =>
        (sentiment === "semua" || n.sentimentLabel === sentiment) &&
        (!q || `${n.title} ${n.source}`.toLowerCase().includes(q)),
    );
  }, [fresh, sentiment, query]);

  const topics = data?.topics ?? [];
  const tone = !fresh ? "neutral" : fresh.avgSentiment > 0.08 ? "bull" : fresh.avgSentiment < -0.08 ? "bear" : "warn";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Berita Pasar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Konteks di luar satu emiten: arah IHSG, emas & XAU/USD, indeks global, NFT, kripto, serta ekonomi &
          rupiah. Untuk berita per emiten, buka halaman sahamnya lewat pencarian.
        </p>
      </div>

      <MarketStrip />

      <Section
        id="berita"
        title="Berita per Topik"
        icon="📰"
        subtitle="Dikumpulkan dari Google News, disaring ulang dengan kata kunci topik, lalu diberi skor sentimen dengan leksikon pasar modal berbahasa Indonesia."
        right={
          fresh ? (
            <Badge tone={tone}>
              Nada {tone === "bull" ? "positif" : tone === "bear" ? "negatif" : "netral"} · {fresh.counts.total} berita
            </Badge>
          ) : undefined
        }
      >
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Topik berita">
          {[{ id: "semua" as TopicFilter, label: "Semua", icon: "🗞️", count: null as number | null }, ...topics].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={topic === t.id}
              onClick={() => pick(t.id)}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                topic === t.id
                  ? "border-brandx bg-brandx/20 text-white"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <span aria-hidden>{t.icon}</span> {t.label}
              {t.count !== null && <span className="ml-1.5 font-normal text-slate-500">{t.count}</span>}
            </button>
          ))}
        </div>

        {topic === "nft" && (
          <div className="mt-4">
            <NftTable />
          </div>
        )}

        {fresh && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="24 jam terakhir" value={fresh.last24h} />
            <Stat label="Positif" value={fresh.counts.positive} tone="bull" />
            <Stat label="Netral" value={fresh.counts.neutral} />
            <Stat label="Negatif" value={fresh.counts.negative} tone="bear" />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(15);
            }}
            placeholder="Cari judul atau sumber…"
            aria-label="Cari berita"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brandx/60 focus:outline-none sm:max-w-xs"
          />
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(["semua", "POSITIF", "NETRAL", "NEGATIF"] as SentimentFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setSentiment(f);
                  setLimit(15);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  sentiment === f ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {f.toLowerCase()}
              </button>
            ))}
          </div>
          {fresh && <p className="text-xs text-slate-500">{filtered.length} berita ditampilkan</p>}
        </div>

        {error && !fresh && !loading && (
          <div className="mt-4 rounded-xl border border-bear/30 bg-bear/10 p-4 text-sm text-bear">
            {error}{" "}
            <button onClick={() => void load(topic)} className="font-semibold underline">
              Coba lagi
            </button>
          </div>
        )}

        {!fresh && loading && (
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-[76px]" />
            ))}
          </div>
        )}

        {fresh && filtered.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-3xl">🔕</p>
            <p className="mt-3 text-sm font-medium text-slate-300">Tidak ada berita yang cocok</p>
            <p className="muted mt-1.5">
              {fresh.items.length
                ? "Coba ubah kata pencarian atau filter sentimen."
                : "Belum ada pemberitaan untuk topik ini dalam beberapa hari terakhir."}
            </p>
          </div>
        )}

        {fresh && filtered.length > 0 && (
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
                      <p className="text-sm font-medium leading-snug text-slate-100 group-hover:text-white">{n.title}</p>
                      {n.snippet && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.snippet}</p>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-400">{n.topicLabel}</span>
                        <span className="font-medium text-slate-400">{n.source}</span>
                        <span>·</span>
                        <span title={fmtDateTime(n.publishedAt)}>{timeAgo(n.publishedAt)}</span>
                      </div>
                    </div>
                    <span className="shrink-0">
                      <Badge
                        tone={n.sentimentLabel === "POSITIF" ? "bull" : n.sentimentLabel === "NEGATIF" ? "bear" : "neutral"}
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

        {fresh && filtered.length > limit && (
          <button onClick={() => setLimit((l) => l + 15)} className="btn-ghost mt-4 w-full">
            Tampilkan {Math.min(15, filtered.length - limit)} berita lagi
          </button>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
          Skor sentimen dihitung otomatis dari judul memakai leksikon — sarkasme dan konteks halus bisa terlewat.
          Tautan mengarah ke situs penerbit aslinya.
        </p>
      </Section>
    </div>
  );
}

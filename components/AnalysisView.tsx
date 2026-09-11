"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult, CouncilAI, CouncilVerdict } from "@/lib/types";
import CouncilPanel from "./CouncilPanel";
import FundamentalPanel from "./FundamentalPanel";
import NewsPanel from "./NewsPanel";
import OwnershipPanel from "./OwnershipPanel";
import PriceChart from "./PriceChart";
import SearchBar from "./SearchBar";
import StockHeader from "./StockHeader";
import StoryPanel from "./StoryPanel";
import TechnicalPanel from "./TechnicalPanel";

const NAV = [
  { id: "dewan", label: "Dewan Analis" },
  { id: "momentum", label: "Momentum & Story" },
  { id: "grafik", label: "Grafik" },
  { id: "teknikal", label: "Teknikal" },
  { id: "fundamental", label: "Fundamental" },
  { id: "berita", label: "Berita" },
  { id: "kepemilikan", label: "Kepemilikan" },
];

function Skeleton({ ticker }: { ticker: string }) {
  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <div className="flex items-center gap-3">
          <div className="h-9 w-20 skeleton" />
          <div className="h-7 w-56 skeleton" />
        </div>
        <div className="mt-6 h-10 w-48 skeleton" />
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 skeleton" />
          ))}
        </div>
      </div>
      <div className="card card-pad">
        <div className="h-6 w-64 skeleton" />
        <div className="mt-5 h-64 skeleton" />
      </div>
      <p className="text-center text-sm text-slate-500">
        Mengumpulkan data harga, laporan keuangan, dan berita untuk{" "}
        <strong className="text-slate-300">{ticker}</strong>…
      </p>
    </div>
  );
}

export default function AnalysisView({ ticker }: { ticker: string }) {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "unavailable" | "error">("idle");
  const [activeNav, setActiveNav] = useState("dewan");

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    setAiState("idle");
    try {
      const res = await fetch(`/api/analysis/${encodeURIComponent(ticker)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat analisis.");
        return;
      }
      setData(json as AnalysisResult);
    } catch {
      setError("Tidak dapat terhubung ke server data. Periksa koneksi internet lalu coba lagi.");
    }
  }, [ticker]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lapisan sintesis AI menyusul setelah data utama tampil.
  useEffect(() => {
    if (!data || aiState !== "idle") return;
    let cancelled = false;
    setAiState("loading");
    (async () => {
      try {
        const res = await fetch("/api/council", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const json = (await res.json()) as {
          enabled: boolean;
          ai?: CouncilAI | null;
          council?: CouncilVerdict;
          error?: string;
        };
        if (cancelled) return;
        if (!json.enabled) {
          setAiState("unavailable");
          return;
        }
        if (json.ai && json.council) {
          setData((prev) => (prev ? { ...prev, ai: json.ai ?? undefined, council: json.council! } : prev));
          setAiState("done");
        } else {
          setAiState("error");
        }
      } catch {
        if (!cancelled) setAiState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, aiState, ticker]);

  useEffect(() => {
    if (!data) return;
    const onScroll = () => {
      for (const item of [...NAV].reverse()) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 140) {
          setActiveNav(item.id);
          return;
        }
      }
      setActiveNav(NAV[0].id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [data]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl">
          <SearchBar size="sm" initial={ticker} />
        </div>
        <div className="card card-pad mx-auto max-w-2xl text-center">
          <p className="text-4xl">🔎</p>
          <h1 className="mt-4 text-lg font-semibold text-white">Data tidak dapat dimuat</h1>
          <p className="muted mx-auto mt-2 max-w-lg">{error}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => void load()} className="btn-primary">
              Coba lagi
            </button>
            <Link href="/" className="btn-ghost">
              Kembali ke beranda
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl">
          <SearchBar size="sm" initial={ticker} />
        </div>
        <Skeleton ticker={ticker.toUpperCase()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="mx-auto max-w-3xl">
        <SearchBar size="sm" />
      </div>

      <StockHeader a={data} />

      <nav className="sticky top-16 z-30 -mx-4 overflow-x-auto border-y border-white/10 bg-ink-950/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <ul className="flex min-w-max gap-1">
          {NAV.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`inline-block rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeNav === item.id
                    ? "bg-brandx/20 text-brandx"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <CouncilPanel a={data} aiLoading={aiState === "loading"} />

      {aiState === "loading" && (
        <div className="card flex items-center gap-3 px-5 py-3.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brandx" />
          <p className="text-xs text-slate-400">
            Dewan sedang menyusun sintesis naratif dengan Claude… hasil rule engine di atas sudah final dan
            akan diperkaya begitu selesai.
          </p>
        </div>
      )}
      {aiState === "unavailable" && (
        <div className="card px-5 py-3.5">
          <p className="text-xs text-slate-500">
            💡 Lapisan sintesis AI nonaktif. Set <code className="text-slate-300">ANTHROPIC_API_KEY</code> di
            environment Vercel untuk mengaktifkan ringkasan naratif, pembacaan story, dan debat dewan versi
            Claude. Seluruh skor & rekomendasi di atas tetap berjalan penuh tanpa API key.
          </p>
        </div>
      )}

      <StoryPanel momentum={data.momentum} aiNotes={data.ai?.pembacaan_story ?? []} />

      <div id="grafik" className="scroll-mt-24">
        <PriceChart
          candles={data.candles}
          supports={data.technical.supports}
          resistances={data.technical.resistances}
          currency={data.quote.currency}
        />
      </div>

      <TechnicalPanel t={data.technical} />
      <FundamentalPanel f={data.fundamental} />
      <NewsPanel news={data.news} ticker={data.ticker} />
      <OwnershipPanel o={data.ownership} p={data.profile} />

      <div className="card card-pad">
        <h2 className="section-title">Bagaimana analisis ini dibuat</h2>
        <div className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-400 md:grid-cols-2">
          <div>
            <p className="mb-1.5 font-semibold text-slate-200">Alur data</p>
            <p>
              Harga & OHLCV 2 tahun diambil dari Yahoo Finance, laporan keuangan dan data kepemilikan dari
              modul fundamental Yahoo, berita dari agregator berita Indonesia. Semua indikator teknikal
              (RSI, MACD, Bollinger, ATR, ADX, OBV, stochastic, pivot support/resistance) dihitung sendiri
              di server, bukan diambil jadi dari pihak ketiga.
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-slate-200">Cara skor dibentuk</p>
            <p>
              Tiap dimensi menghasilkan skor 0–100 dengan bobot per metrik. Dewan Analis menggabungkan tujuh
              sudut pandang memakai bobot yang otomatis turun ketika datanya tidak tersedia — sehingga
              kekosongan data menurunkan keyakinan, bukan dipoles menjadi angka palsu.
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-slate-200">Validasi story</p>
            <p>
              Narasi dari berita tidak langsung dipercaya. Setiap story diuji lewat 9 pemeriksaan silang ke
              data harga, volume, dan laporan keuangan. Story yang harganya sudah lari jauh tanpa bukti
              pendukung ditandai <strong className="text-bear">mencurigakan</strong>.
            </p>
          </div>
          <div>
            <p className="mb-1.5 font-semibold text-slate-200">Batasan</p>
            <p>
              Data dari sumber gratis bisa tertunda, tidak lengkap, atau salah — terutama untuk emiten kecil.
              Sentimen dihitung berbasis leksikon, sehingga sarkasme dan konteks halus bisa terlewat. Selalu
              verifikasi ke keterbukaan informasi resmi IDX sebelum bertransaksi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

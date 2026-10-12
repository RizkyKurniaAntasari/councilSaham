"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtDateTime, fmtNumber, fmtPct } from "@/lib/format";
import type { CyclePhase, RecAction, ScreenerResult, ScreenerRow } from "@/lib/types";
import { PHASE_META, PHASE_ORDER, PhaseBadge, RecBadge, Sparkline } from "./cycle-ui";
import { scoreColor } from "./ui";

type Tab = "rekomendasi" | "trending-naik" | "trending" | "akumulasi" | "siklus";

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  {
    id: "rekomendasi",
    label: "Rekomendasi",
    icon: "🎯",
    desc: "Peringkat saham berdasarkan gabungan fase siklus, aliran dana, momentum, dan likuiditas — lengkap dengan area entry, stop loss, dan target.",
  },
  {
    id: "trending-naik",
    label: "Trending Naik",
    icon: "🚀",
    desc: "Hanya saham yang sedang naik: kenaikan harga 1–20 hari, volume yang didominasi hari naik (bukan volume jual), breakout 20 hari, dan penutupan kuat. Saham yang ramai karena dilepas tidak masuk daftar ini.",
  },
  {
    id: "trending",
    label: "Trending (Semua)",
    icon: "🔥",
    desc: "Saham yang paling ramai: lonjakan volume, nilai transaksi besar, dan pergerakan harga tajam dalam beberapa hari terakhir.",
  },
  {
    id: "akumulasi",
    label: "Tahap Akumulasi",
    icon: "🧲",
    desc: "Saham yang bergerak datar setelah turun sementara aliran dana masuk — kandidat sebelum fase Mark Up.",
  },
  {
    id: "siklus",
    label: "4 Siklus",
    icon: "🔄",
    desc: "Seluruh emiten dikelompokkan ke dalam fase Akumulasi, Mark Up, Distribusi, dan Mark Down.",
  },
];

const LIQ_OPTIONS = [
  { label: "Semua likuiditas", value: 0 },
  { label: "≥ Rp1 M/hari", value: 1e9 },
  { label: "≥ Rp10 M/hari", value: 1e10 },
  { label: "≥ Rp50 M/hari", value: 5e10 },
];

const REC_FILTERS: { label: string; value: RecAction[] }[] = [
  { label: "Beli & Beli Bertahap", value: ["BELI", "BELI_BERTAHAP"] },
  { label: "Semua", value: ["BELI", "BELI_BERTAHAP", "PANTAU", "AMBIL_UNTUNG", "HINDARI"] },
  { label: "Ambil Untung & Hindari", value: ["AMBIL_UNTUNG", "HINDARI"] },
];

function Pct({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-500">—</span>;
  return <span className={v >= 0 ? "text-bull" : "text-bear"}>{fmtPct(v, 1)}</span>;
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className="inline-grid h-7 w-9 place-items-center rounded-lg text-xs font-bold tabular text-ink-950"
      style={{ backgroundColor: scoreColor(score) }}
    >
      {score}
    </span>
  );
}

function TickerCell({ r }: { r: ScreenerRow }) {
  return (
    <Link href={`/saham/${r.ticker}`} className="group flex min-w-0 items-center gap-2.5">
      <span className="grid h-8 w-14 shrink-0 place-items-center rounded-lg bg-brandx/15 text-xs font-bold tracking-wide text-brandx group-hover:bg-brandx/25">
        {r.ticker}
      </span>
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-xs font-medium text-slate-200 group-hover:text-white">
          {r.name}
        </span>
        <span className="block text-[10px] text-slate-500">{r.sector}</span>
      </span>
    </Link>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-3 py-2.5 text-xs tabular text-slate-300 ${right ? "text-right" : ""} ${className}`}>
      {children}
    </td>
  );
}

function Empty() {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">Tidak ada saham yang cocok dengan filter.</p>;
}

function RecommendationTable({ rows }: { rows: ScreenerRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1080px]">
        <thead className="border-b border-white/10">
          <tr>
            <Th>#</Th>
            <Th>Emiten</Th>
            <Th>Skor</Th>
            <Th>Aksi</Th>
            <Th>Fase</Th>
            <Th right>Harga</Th>
            <Th right>Area entry</Th>
            <Th right>Stop loss</Th>
            <Th right>Target 1</Th>
            <Th right>R/R</Th>
            <Th>Alasan utama</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={r.ticker} className="transition hover:bg-white/[0.03]">
              <Td className="text-slate-500">{i + 1}</Td>
              <td className="px-3 py-2.5">
                <TickerCell r={r} />
              </td>
              <Td>
                <ScorePill score={r.rec.score} />
              </Td>
              <Td>
                <RecBadge action={r.rec.action} small />
              </Td>
              <Td>
                <PhaseBadge phase={r.cycle.phase} small />
              </Td>
              <Td right className="font-semibold text-white">
                {fmtNumber(r.price, 0)}
              </Td>
              <Td right>{r.rec.entry ? `${fmtNumber(r.rec.entry.low, 0)}–${fmtNumber(r.rec.entry.high, 0)}` : "—"}</Td>
              <Td right className="text-bear">
                {r.rec.stopLoss ? fmtNumber(r.rec.stopLoss, 0) : "—"}
              </Td>
              <Td right className="text-bull">
                {r.rec.target1 ? fmtNumber(r.rec.target1, 0) : "—"}
              </Td>
              <Td right>{r.rec.riskReward !== null ? fmtNumber(r.rec.riskReward, 1) : "—"}</Td>
              <td className="min-w-[260px] max-w-[340px] px-3 py-2.5 text-[11px] leading-snug text-slate-400">
                {r.rec.reasons[1] ?? r.rec.reasons[0]}
                {r.rec.warnings[0] && <span className="mt-0.5 block text-warn/90">⚠ {r.rec.warnings[0]}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendingTable({ rows, up }: { rows: ScreenerRow[]; up?: boolean }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1080px]">
        <thead className="border-b border-white/10">
          <tr>
            <Th>#</Th>
            <Th>Emiten</Th>
            <Th>Skor</Th>
            <Th>60 hari</Th>
            <Th right>Harga</Th>
            <Th right>1 hari</Th>
            <Th right>5 hari</Th>
            <Th right>Vol 5H / 3B</Th>
            <Th right>Nilai hari ini</Th>
            <Th>Fase</Th>
            <Th>Kenapa trending</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={r.ticker} className="transition hover:bg-white/[0.03]">
              <Td className="text-slate-500">{i + 1}</Td>
              <td className="px-3 py-2.5">
                <TickerCell r={r} />
              </td>
              <Td>
                <ScorePill score={up ? r.upTrendingScore : r.trendingScore} />
              </Td>
              <td className="px-3 py-1">
                <Sparkline values={r.spark} />
              </td>
              <Td right className="font-semibold text-white">
                {fmtNumber(r.price, 0)}
              </Td>
              <Td right>
                <Pct v={r.change1d} />
              </Td>
              <Td right>
                <Pct v={r.return5d} />
              </Td>
              <Td right className={r.volSurge5d >= 1.8 ? "font-semibold text-warn" : ""}>
                {fmtNumber(r.volSurge5d, 1)}x
              </Td>
              <Td right>{fmtCompact(r.valueToday)}</Td>
              <Td>
                <PhaseBadge phase={r.cycle.phase} small />
              </Td>
              <td className="min-w-[240px] max-w-[320px] px-3 py-2.5 text-[11px] leading-snug text-slate-400">
                {(up ? r.upTrendingReasons : r.trendingReasons).slice(0, 2).join(" · ") ||
                  (up ? "Momentum naik" : "Aktivitas di atas rata-rata")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccumulationTable({ rows }: { rows: ScreenerRow[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1080px]">
        <thead className="border-b border-white/10">
          <tr>
            <Th>#</Th>
            <Th>Emiten</Th>
            <Th>Skor akumulasi</Th>
            <Th>60 hari</Th>
            <Th>Tahap</Th>
            <Th right>Lama</Th>
            <Th right>Harga</Th>
            <Th right>Rentang 40H</Th>
            <Th right>20 hari</Th>
            <Th>Rekomendasi</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={r.ticker} className="transition hover:bg-white/[0.03]">
              <Td className="text-slate-500">{i + 1}</Td>
              <td className="px-3 py-2.5">
                <TickerCell r={r} />
              </td>
              <Td>
                <div className="flex items-center gap-2">
                  <ScorePill score={r.accumulationScore} />
                  <span className="text-[10px] text-slate-500">yakin {r.cycle.confidence}%</span>
                </div>
              </Td>
              <td className="px-3 py-1">
                <Sparkline values={r.spark} />
              </td>
              <td className="max-w-[240px] px-3 py-2.5 text-[11px] leading-snug text-slate-300">{r.cycle.stage}</td>
              <Td right>±{r.cycle.daysInPhase}H</Td>
              <Td right className="font-semibold text-white">
                {fmtNumber(r.price, 0)}
              </Td>
              <Td right>
                {fmtNumber(r.cycle.range.low, 0)}–{fmtNumber(r.cycle.range.high, 0)}
              </Td>
              <Td right>
                <Pct v={r.return20d} />
              </Td>
              <Td>
                <RecBadge action={r.rec.action} small />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type MobileKind = "rec" | "trend" | "trendUp" | "acc";

function MiniStat({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-xs font-semibold tabular text-slate-200 ${className}`}>{children}</p>
    </div>
  );
}

/** Versi kartu dari tabel untuk layar ponsel. */
function MobileList({ rows, kind }: { rows: ScreenerRow[]; kind: MobileKind }) {
  if (!rows.length) {
    return (
      <div className="md:hidden">
        <Empty />
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/5 md:hidden">
      {rows.map((r, i) => {
        const score =
          kind === "rec"
            ? r.rec.score
            : kind === "trend"
              ? r.trendingScore
              : kind === "trendUp"
                ? r.upTrendingScore
                : r.accumulationScore;
        const reason =
          kind === "rec"
            ? r.rec.reasons[1] ?? r.rec.reasons[0]
            : kind === "trend"
              ? r.trendingReasons.slice(0, 2).join(" · ")
              : kind === "trendUp"
                ? r.upTrendingReasons.slice(0, 2).join(" · ")
                : r.cycle.stage;
        return (
          <li key={r.ticker}>
            <Link href={`/saham/${r.ticker}`} className="block px-4 py-3.5 transition active:bg-white/[0.05]">
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-xs tabular text-slate-500">{i + 1}</span>
                <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-brandx/15 text-xs font-bold tracking-wide text-brandx">
                  {r.ticker}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-100">{r.name}</span>
                  <span className="block text-[11px] tabular text-slate-500">
                    {fmtNumber(r.price, 0)} · <Pct v={r.change1d} />
                  </span>
                </span>
                <ScorePill score={score} />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-8">
                {(kind === "rec" || kind === "acc") && <RecBadge action={r.rec.action} small />}
                <PhaseBadge phase={r.cycle.phase} small />
                {kind !== "rec" && (
                  <span className="ml-auto">
                    <Sparkline values={r.spark} width={84} height={22} />
                  </span>
                )}
              </div>

              <div
                className={`mt-2.5 grid gap-2 pl-8 ${kind === "rec" ? "grid-cols-[1.6fr_1fr_1fr_0.6fr]" : "grid-cols-4"}`}
              >
                {kind === "rec" ? (
                  <>
                    <MiniStat label="Entry">
                      {r.rec.entry ? `${fmtNumber(r.rec.entry.low, 0)}–${fmtNumber(r.rec.entry.high, 0)}` : "—"}
                    </MiniStat>
                    <MiniStat label="Stop" className="text-bear">
                      {r.rec.stopLoss ? fmtNumber(r.rec.stopLoss, 0) : "—"}
                    </MiniStat>
                    <MiniStat label="Target" className="text-bull">
                      {r.rec.target1 ? fmtNumber(r.rec.target1, 0) : "—"}
                    </MiniStat>
                    <MiniStat label="R/R">{r.rec.riskReward !== null ? fmtNumber(r.rec.riskReward, 1) : "—"}</MiniStat>
                  </>
                ) : kind === "acc" ? (
                  <>
                    <MiniStat label="Lama">±{r.cycle.daysInPhase}H</MiniStat>
                    <MiniStat label="Bawah">{fmtNumber(r.cycle.range.low, 0)}</MiniStat>
                    <MiniStat label="Atas">{fmtNumber(r.cycle.range.high, 0)}</MiniStat>
                    <MiniStat label="20 hari">
                      <Pct v={r.return20d} />
                    </MiniStat>
                  </>
                ) : (
                  <>
                    <MiniStat label="5 hari">
                      <Pct v={r.return5d} />
                    </MiniStat>
                    <MiniStat label="20 hari">
                      <Pct v={r.return20d} />
                    </MiniStat>
                    <MiniStat label="Vol 5H" className={r.volSurge5d >= 1.8 ? "text-warn" : ""}>
                      {fmtNumber(r.volSurge5d, 1)}x
                    </MiniStat>
                    <MiniStat label="Nilai">{fmtCompact(r.valueToday, "")}</MiniStat>
                  </>
                )}
              </div>

              {reason && <p className="mt-2 pl-8 text-[11px] leading-snug text-slate-400">{reason}</p>}
              {kind === "rec" && r.rec.warnings[0] && (
                <p className="mt-1 pl-8 text-[11px] leading-snug text-warn/90">⚠ {r.rec.warnings[0]}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CycleBoard({ rows }: { rows: ScreenerRow[] }) {
  return (
    <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-2 xl:grid-cols-4">
      {PHASE_ORDER.map((p, i) => {
        const list = rows.filter((r) => r.cycle.phase === p).sort((a, b) => b.cycle.confidence - a.cycle.confidence);
        const m = PHASE_META[p];
        return (
          <div key={p} className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 p-4" style={{ boxShadow: `inset 0 3px 0 ${m.color}` }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  <span className="mr-1.5 text-slate-500">{i + 1}.</span>
                  {m.icon} {m.label}
                </p>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold tabular text-slate-300">
                  {list.length}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{m.short}</p>
            </div>
            <ul className="max-h-[300px] divide-y md:max-h-[520px] divide-white/5 overflow-y-auto">
              {list.length === 0 && <li className="p-4 text-xs text-slate-500">Tidak ada.</li>}
              {list.map((r) => (
                <li key={r.ticker}>
                  <Link
                    href={`/saham/${r.ticker}`}
                    className="flex items-center justify-between gap-2 px-4 py-2.5 transition hover:bg-white/[0.04]"
                    title={r.cycle.summary}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-100">{r.ticker}</span>
                      <span className="block truncate text-[10px] text-slate-500">{r.cycle.stage.split(" — ")[0]}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xs tabular">
                        <Pct v={r.return20d} />
                      </span>
                      <span className="block text-[10px] tabular text-slate-500">yakin {r.cycle.confidence}%</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MarketBreadth({ rows }: { rows: ScreenerRow[] }) {
  const counts = PHASE_ORDER.map((p) => ({ p, n: rows.filter((r) => r.cycle.phase === p).length }));
  const total = rows.length || 1;
  const bullish = counts[0].n + counts[1].n;
  const tone =
    bullish / total >= 0.6
      ? { text: "Mayoritas emiten di fase Akumulasi/Mark Up — kondisi pasar cenderung sehat.", cls: "text-bull" }
      : bullish / total <= 0.4
        ? { text: "Mayoritas emiten di fase Distribusi/Mark Down — pasar sedang tertekan, utamakan manajemen risiko.", cls: "text-bear" }
        : { text: "Pasar terbelah — pilih saham secara selektif.", cls: "text-warn" };
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="stat-label">Peta siklus pasar</p>
          <p className={`mt-1 text-sm font-medium ${tone.cls}`}>{tone.text}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          {counts.map(({ p, n }) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PHASE_META[p].color }} />
              {PHASE_META[p].label} <strong className="tabular text-slate-200">{n}</strong>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-white/5">
        {counts.map(({ p, n }) => (
          <div
            key={p}
            style={{ width: `${(n / total) * 100}%`, backgroundColor: PHASE_META[p].color }}
            title={`${PHASE_META[p].label}: ${n} emiten`}
          />
        ))}
      </div>
    </div>
  );
}

export default function MarketRadar() {
  const [data, setData] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rekomendasi");
  const [sector, setSector] = useState("Semua");
  const [minLiq, setMinLiq] = useState(1e9);
  const [recFilter, setRecFilter] = useState(0);
  const [phaseFilter, setPhaseFilter] = useState<CyclePhase | "SEMUA">("SEMUA");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setData(null);
    setError(null);
    try {
      const res = await fetch("/api/screener");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memindai pasar.");
        return;
      }
      setData(json as ScreenerResult);
    } catch {
      setError("Tidak dapat terhubung ke server data. Periksa koneksi lalu coba lagi.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sectors = useMemo(
    () => ["Semua", ...Array.from(new Set((data?.rows ?? []).map((r) => r.sector))).sort()],
    [data],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toUpperCase();
    return (data?.rows ?? []).filter(
      (r) =>
        (sector === "Semua" || r.sector === sector) &&
        r.avgValue20 >= minLiq &&
        (phaseFilter === "SEMUA" || r.cycle.phase === phaseFilter) &&
        (!term || r.ticker.includes(term) || r.name.toUpperCase().includes(term)),
    );
  }, [data, sector, minLiq, phaseFilter, q]);

  const view = useMemo(() => {
    switch (tab) {
      case "rekomendasi":
        return filtered
          .filter((r) => REC_FILTERS[recFilter].value.includes(r.rec.action))
          .sort((a, b) => (recFilter === 2 ? a.rec.score - b.rec.score : b.rec.score - a.rec.score))
          .slice(0, 40);
      case "trending-naik":
        return filtered
          .filter((r) => r.upTrendingScore > 0)
          .sort((a, b) => b.upTrendingScore - a.upTrendingScore)
          .slice(0, 30);
      case "trending":
        return [...filtered].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 30);
      case "akumulasi":
        return filtered
          .filter((r) => r.cycle.phase === "AKUMULASI")
          .sort((a, b) => b.accumulationScore - a.accumulationScore);
      default:
        return filtered;
    }
  }, [filtered, tab, recFilter]);

  const topPicks = useMemo(
    () =>
      filtered
        .filter((r) => r.rec.action === "BELI" || r.rec.action === "BELI_BERTAHAP")
        .sort((a, b) => b.rec.score - a.rec.score)
        .slice(0, 3),
    [filtered],
  );

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip">📡 Pemindai pasar otomatis</span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Radar Pasar IDX</h1>
          <p className="muted mt-1 max-w-2xl">
            Saham trending, saham dalam tahap akumulasi, pemetaan 4 siklus (Akumulasi → Mark Up → Distribusi →
            Mark Down), dan rekomendasi berbasis data untuk seluruh emiten di daftar pantauan.
          </p>
        </div>
        {data && (
          <div className="text-xs text-slate-500 sm:text-right">
            <p>
              {data.scanned} dari {data.universe} emiten dipindai · {fmtDateTime(data.generatedAt)}
            </p>
            <button onClick={() => void load()} className="mt-1 text-brandx hover:underline">
              Muat ulang
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="card card-pad text-center">
          <p className="text-sm text-slate-300">{error}</p>
          <button onClick={() => void load()} className="btn-primary mt-4">
            Coba lagi
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="space-y-4">
          <div className="card card-pad">
            <div className="h-4 w-full skeleton" />
          </div>
          <div className="card card-pad space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 skeleton" />
            ))}
          </div>
          <p className="text-center text-sm text-slate-500">
            Memindai harga & volume 1 tahun seluruh emiten… pemindaian pertama bisa memakan 10–30 detik.
          </p>
        </div>
      )}

      {data && (
        <>
          <MarketBreadth rows={filtered} />

          {topPicks.length > 0 && (
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              {topPicks.map((r, i) => (
                <Link
                  key={r.ticker}
                  href={`/saham/${r.ticker}`}
                  className="card group w-[82%] shrink-0 snap-start p-4 transition hover:border-bull/40 md:w-auto"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Pilihan data #{i + 1}</p>
                      <p className="mt-1 text-lg font-black tracking-wide text-white">{r.ticker}</p>
                      <p className="truncate text-xs text-slate-400">{r.name}</p>
                    </div>
                    <ScorePill score={r.rec.score} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <RecBadge action={r.rec.action} small />
                    <PhaseBadge phase={r.cycle.phase} small />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-slate-500">Entry</p>
                      <p className="font-semibold tabular text-slate-200">
                        {r.rec.entry ? `${fmtNumber(r.rec.entry.low, 0)}–${fmtNumber(r.rec.entry.high, 0)}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Stop</p>
                      <p className="font-semibold tabular text-bear">{r.rec.stopLoss ? fmtNumber(r.rec.stopLoss, 0) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Target</p>
                      <p className="font-semibold tabular text-bull">{r.rec.target1 ? fmtNumber(r.rec.target1, 0) : "—"}</p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-[11px] leading-snug text-slate-400">{r.cycle.stage}</p>
                </Link>
              ))}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10 p-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={(e) => {
                    setTab(t.id);
                    e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                    tab === t.id ? "bg-brandx/20 text-brandx" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-white/10 px-4 py-3 sm:flex sm:flex-wrap sm:items-center">
              <p className="col-span-2 text-xs leading-relaxed text-slate-400 sm:mr-auto sm:max-w-xl">{active.desc}</p>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kode / nama"
                className="col-span-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm sm:w-36 sm:px-2.5 sm:py-1.5 sm:text-xs text-slate-200 placeholder:text-slate-500 focus:border-brandx/50 focus:outline-none"
              />
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full min-w-0 rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200 sm:w-auto sm:py-1.5"
              >
                {sectors.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                value={minLiq}
                onChange={(e) => setMinLiq(Number(e.target.value))}
                className="w-full min-w-0 rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200 sm:w-auto sm:py-1.5"
              >
                {LIQ_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {tab === "rekomendasi" && (
                <select
                  value={recFilter}
                  onChange={(e) => setRecFilter(Number(e.target.value))}
                  className="w-full min-w-0 rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200 sm:w-auto sm:py-1.5"
                >
                  {REC_FILTERS.map((o, i) => (
                    <option key={o.label} value={i}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {(tab === "rekomendasi" || tab === "trending" || tab === "trending-naik") && (
                <select
                  value={phaseFilter}
                  onChange={(e) => setPhaseFilter(e.target.value as CyclePhase | "SEMUA")}
                  className="w-full min-w-0 rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200 sm:w-auto sm:py-1.5"
                >
                  <option value="SEMUA">Semua fase</option>
                  {PHASE_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PHASE_META[p].label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {tab === "rekomendasi" && (
              <>
                <MobileList rows={view} kind="rec" />
                <RecommendationTable rows={view} />
              </>
            )}
            {tab === "trending-naik" && (
              <>
                <MobileList rows={view} kind="trendUp" />
                <TrendingTable rows={view} up />
              </>
            )}
            {tab === "trending" && (
              <>
                <MobileList rows={view} kind="trend" />
                <TrendingTable rows={view} />
              </>
            )}
            {tab === "akumulasi" && (
              <>
                <MobileList rows={view} kind="acc" />
                <AccumulationTable rows={view} />
              </>
            )}
            {tab === "siklus" && <CycleBoard rows={view} />}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PHASE_ORDER.map((p, i) => (
              <div key={p} className="card p-4" style={{ boxShadow: `inset 3px 0 0 ${PHASE_META[p].color}` }}>
                <p className="text-sm font-semibold text-white">
                  {i + 1}. {PHASE_META[p].icon} {PHASE_META[p].label}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {
                    {
                      AKUMULASI:
                        "Datar setelah turun panjang, MA50 mendatar, Chaikin Money Flow positif, volume hari naik > hari turun. Strategi: cicil beli di bawah rentang.",
                      MARKUP:
                        "Harga > MA50 > MA200, MA50 menanjak, higher high & higher low, ADX menguat. Strategi: ikuti tren, beli saat pullback.",
                      DISTRIBUSI:
                        "Datar di area tinggi setelah naik panjang, momentum melemah, aliran dana keluar, lower high. Strategi: ambil untung bertahap.",
                      MARKDOWN:
                        "Harga < MA50 < MA200, MA50 menurun, lower high & lower low. Strategi: hindari sampai muncul tanda akumulasi.",
                    }[p]
                  }
                </p>
              </div>
            ))}
          </div>

          {data.failed.length > 0 && (
            <p className="text-[11px] text-slate-600">
              Gagal dimuat (data tidak tersedia/terlalu pendek): {data.failed.join(", ")}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-slate-500">
            Rekomendasi dihasilkan aturan otomatis dari data harga & volume publik yang bisa tertunda — bukan nasihat
            investasi. Fase siklus adalah probabilitas, bukan kepastian; selalu konfirmasi di halaman analisis lengkap
            tiap emiten (fundamental, berita, validasi story) sebelum bertransaksi.
          </p>
        </>
      )}
    </div>
  );
}

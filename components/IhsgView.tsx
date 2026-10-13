"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import type { IhsgReport } from "@/lib/types";
import { CycleWave, PHASE_META, PHASE_ORDER, PhaseBadge } from "./cycle-ui";
import PriceChart from "./PriceChart";
import { ScoreRing, Section, Stat } from "./ui";

const fmtIdx = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined ? "—" : v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtRet = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}%`);

export default function IhsgView() {
  const [d, setD] = useState<IhsgReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/ihsg?full=1");
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Gagal memuat IHSG.");
      else setD(j as IhsgReport);
    } catch {
      setError("Tidak dapat terhubung ke server data.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="card card-pad mx-auto mt-6 max-w-xl text-center">
        <p className="text-sm text-slate-300">{error}</p>
        <button onClick={() => void load()} className="btn-primary mt-4">
          Coba lagi
        </button>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="space-y-5 py-4">
        <div className="card card-pad h-48 skeleton" />
        <div className="card card-pad h-96 skeleton" />
      </div>
    );
  }

  const up = d.changePct >= 0;
  const rangePos = d.high52w > d.low52w ? ((d.price - d.low52w) / (d.high52w - d.low52w)) * 100 : 50;
  const c = d.cycle;
  const techSum = d.techBreakdown.reduce((a, b) => a + b.score * b.weight, 0);

  return (
    <div className="space-y-5 py-4">
      {/* Header */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-xl bg-brandx/15 px-3 py-1.5 text-base font-black tracking-wider text-brandx sm:text-lg">
            IHSG
          </span>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl">Indeks Harga Saham Gabungan</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">IDX Composite · {d.symbol}</span>
          <span className="chip">Data per {fmtDate(d.updatedAt)}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="text-3xl font-bold tabular text-white sm:text-4xl">{fmtIdx(d.price)}</p>
            <p className={`mt-1 text-sm font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
              {up ? "▲ +" : "▼ −"}
              {fmtIdx(Math.abs(d.change))} ({fmtRet(d.changePct)})
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[240px] sm:flex-1">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>{fmtIdx(d.low52w, 0)}</span>
              <span>Rentang 52 minggu</span>
              <span>{fmtIdx(d.high52w, 0)}</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-gradient-to-r from-bear/50 via-warn/40 to-bull/50">
              <div
                className="absolute -top-1 h-3.5 w-1 rounded-full bg-white shadow"
                style={{ left: `calc(${Math.max(0, Math.min(100, rangePos))}% - 2px)` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-6">
          <Stat label="5 hari" value={fmtRet(d.returns.d5)} tone={(d.returns.d5 ?? 0) >= 0 ? "bull" : "bear"} />
          <Stat label="20 hari" value={fmtRet(d.returns.d20)} tone={(d.returns.d20 ?? 0) >= 0 ? "bull" : "bear"} />
          <Stat label="60 hari" value={fmtRet(d.returns.d60)} tone={(d.returns.d60 ?? 0) >= 0 ? "bull" : "bear"} />
          <Stat label="Sejak awal tahun" value={fmtRet(d.returns.ytd)} tone={(d.returns.ytd ?? 0) >= 0 ? "bull" : "bear"} />
          <Stat label="1 tahun" value={fmtRet(d.returns.y1)} tone={(d.returns.y1 ?? 0) >= 0 ? "bull" : "bear"} />
          <Stat label="RSI (14)" value={d.rsi !== null ? d.rsi.toFixed(1).replace(".", ",") : "—"} />
          <Stat label="MA 20" value={fmtIdx(d.ma20, 0)} />
          <Stat label="MA 50" value={fmtIdx(d.ma50, 0)} />
          <Stat label="MA 200" value={fmtIdx(d.ma200, 0)} />
          <Stat label="Dari puncak 52M" value={fmtRet(((d.price - d.high52w) / d.high52w) * 100)} tone="bear" />
          <Stat label="Dari dasar 52M" value={fmtRet(((d.price - d.low52w) / d.low52w) * 100)} tone="bull" />
          <Stat label="Tren" value={d.trend} tone={d.trend === "UPTREND" ? "bull" : d.trend === "DOWNTREND" ? "bear" : undefined} />
        </div>
      </section>

      {/* Grafik */}
      {d.candles && (
        <PriceChart candles={d.candles} supports={d.supports} resistances={d.resistances} currency="poin indeks" />
      )}

      {/* Siklus */}
      {c.available && (
        <Section
          id="siklus"
          title="Siklus Pasar (IHSG)"
          icon="🔄"
          subtitle="Fase Wyckoff indeks dibaca dengan mesin yang sama seperti saham: struktur tren, aliran dana, dan volume."
          right={<PhaseBadge phase={c.phase} />}
        >
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                <CycleWave phase={c.phase} daysInPhase={c.daysInPhase} scores={c.scores} />
              </div>
              <p className="text-base font-semibold text-white">
                {PHASE_META[c.phase].icon} {c.label} <span className="font-normal text-slate-400">· {c.stage}</span>
              </p>
              <p className="text-sm leading-relaxed text-slate-400">{c.summary}</p>
              {c.timeline.length > 1 && (
                <div>
                  <p className="stat-label mb-2">Riwayat fase ±1 tahun</p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    {c.timeline.map((p, i) => (
                      <div
                        key={i}
                        className="h-full flex-1"
                        style={{ backgroundColor: PHASE_META[p.phase].color }}
                        title={`${fmtDate(p.t)} · ${PHASE_META[p.phase].label} · ${fmtIdx(p.price)}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
                    {PHASE_ORDER.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_META[p].color }} />
                        {PHASE_META[p].label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="stat-label">Fase berikutnya: {PHASE_META[c.next.phase].label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-bull">Pemicu · </span>
                  {c.next.trigger.replace(/Rp /g, "")}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-bear">Pembatal · </span>
                  {c.next.invalidation.replace(/Rp /g, "")}
                </p>
              </div>
              <ul className="divide-y divide-white/5 rounded-2xl border border-white/8">
                {c.evidence.map((e) => (
                  <li key={e.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5">
                    <span className="min-w-0 text-xs text-slate-400">{e.label}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="whitespace-nowrap text-xs font-semibold tabular text-slate-100">{e.value}</span>
                      {e.supports ? <PhaseBadge phase={e.supports} small /> : <span className="text-[10px] text-slate-600">netral</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>
      )}

      {/* Teknikal */}
      <Section
        id="teknikal"
        title="Teknikal IHSG"
        icon="📈"
        subtitle="Skor teknikal indeks dengan rincian komponennya, serta level support & resistance terdekat."
      >
        <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-row items-center gap-4 lg:flex-col">
            <ScoreRing score={d.techScore} size={116} sublabel="teknikal" />
            <p className="max-w-[200px] text-xs leading-relaxed text-slate-400 lg:text-center">
              {d.trend} · {d.trendStrength}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ul className="divide-y divide-white/5 rounded-xl border border-white/8">
              {d.techBreakdown.map((b) => (
                <li key={b.label} className="px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-300">{b.label}</span>
                    <span className="shrink-0 tabular text-slate-400">
                      {b.weight === 1 ? (
                        <span className={b.score >= 0 ? "font-semibold text-bull" : "font-semibold text-bear"}>
                          {b.score > 0 ? "+" : "−"}
                          {Math.abs(b.score)}
                        </span>
                      ) : (
                        <>
                          {b.score} × {Math.round(b.weight * 100)}% ={" "}
                          <span className="font-semibold text-white">{(b.score * b.weight).toFixed(1).replace(".", ",")}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{b.detail.replace(/Rp /g, "")}</p>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 bg-white/[0.03] px-3 py-2 text-xs">
                <span className="font-semibold text-white">Skor teknikal</span>
                <span className="font-bold tabular text-white">
                  {techSum.toFixed(1).replace(".", ",")} → {d.techScore}
                </span>
              </li>
            </ul>
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="stat-label text-bear">Resistance</p>
                  <ul className="mt-1.5 space-y-1 text-sm tabular text-slate-200">
                    {d.resistances.length ? (
                      d.resistances.map((r, i) => (
                        <li key={i}>
                          R{i + 1} · {fmtIdx(r, 0)}
                          <span className="ml-1 text-[11px] text-slate-500">{fmtRet(((r - d.price) / d.price) * 100)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">Tidak terdeteksi</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="stat-label text-bull">Support</p>
                  <ul className="mt-1.5 space-y-1 text-sm tabular text-slate-200">
                    {d.supports.length ? (
                      d.supports.map((s, i) => (
                        <li key={i}>
                          S{i + 1} · {fmtIdx(s, 0)}
                          <span className="ml-1 text-[11px] text-slate-500">{fmtRet(((s - d.price) / d.price) * 100)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">Tidak terdeteksi</li>
                    )}
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Level dari deteksi swing pivot 160 hari terakhir. Saat IHSG mendekati support, tekanan jual pasar
                biasanya mereda; saat menembus resistance dengan volume, sentimen pasar cenderung membaik.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <div className="card card-pad flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Ingin tahu saham mana yang lebih kuat dari IHSG? Radar Pasar memeringkat seluruh emiten, termasuk
          kekuatan relatifnya terhadap indeks.
        </p>
        <Link href="/pasar" className="btn-primary">
          📡 Buka Radar Pasar
        </Link>
      </div>
    </div>
  );
}

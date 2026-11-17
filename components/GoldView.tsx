"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "@/lib/format";
import { REC_BANDS } from "@/lib/recommend";
import type { GoldReport } from "@/lib/types";
import { CycleWave, PHASE_META, PhaseBadge, RecBadge, TimingBadge } from "./cycle-ui";
import { PlanLevels, PlanRiskLine, RecExplain, ScoreBreakdown } from "./plan-ui";
import PriceChart from "./PriceChart";
import { BulletList, ScoreRing, Section, Stat } from "./ui";

const TROY_OUNCE_GRAM = 31.1034768;

const num = (v: number, d = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (v: number | null | undefined, d = 0) => (v === null || v === undefined ? "—" : `$${num(v, d)}`);
const fmtRet = (v: number | null, d = 2) =>
  v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d).replace(".", ",")}%`;
const tone = (v: number | null) => ((v ?? 0) >= 0 ? ("bull" as const) : ("bear" as const));

export default function GoldView() {
  const [d, setD] = useState<GoldReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/gold?full=1");
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Gagal memuat data emas.");
      else setD(j as GoldReport);
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
  const rec = d.rec;
  const rate = d.idr?.usdIdr ?? null;
  /** USD per troy ounce → rupiah per gram dengan kurs saat ini. */
  const perGram = rate ? (oz: number) => `Rp ${num((oz * rate) / TROY_OUNCE_GRAM)}/gram` : undefined;
  const techSum = d.techBreakdown.reduce((a, b) => a + b.score * b.weight, 0);
  // Teks siklus ditulis mesin saham dengan awalan "Rp" — untuk emas satuannya dolar.
  const fix = (s: string) => s.replace(/Rp /g, "$");

  return (
    <div className="space-y-5 py-4">
      {/* Header */}
      <section className="card card-pad">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-xl bg-warn/15 px-3 py-1.5 text-base font-black tracking-wider text-warn sm:text-lg">
            XAU
          </span>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl">Emas Dunia (XAU/USD)</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip">Kontrak berjangka COMEX · {d.symbol}</span>
          <span className="chip">Data per {fmtDate(d.updatedAt)}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">USD per troy ounce</p>
            <p className="text-3xl font-bold tabular text-white sm:text-4xl">{usd(d.price, 2)}</p>
            <p className={`mt-1 text-sm font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
              {up ? "▲ +" : "▼ −"}
              {usd(Math.abs(d.change), 2)} ({fmtRet(d.changePct)})
            </p>
          </div>
          {d.idr && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Setara rupiah per gram</p>
              <p className="text-2xl font-bold tabular text-white sm:text-3xl">Rp {num(d.idr.perGram)}</p>
              <p className={`mt-1 text-sm font-semibold tabular ${d.idr.changePct >= 0 ? "text-bull" : "text-bear"}`}>
                {fmtRet(d.idr.changePct)} <span className="font-normal text-slate-500">· kurs Rp {num(d.idr.usdIdr)}</span>
              </p>
            </div>
          )}
          <div className="w-full sm:w-auto sm:min-w-[220px] sm:flex-1">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>{usd(d.low52w)}</span>
              <span>Rentang 52 minggu</span>
              <span>{usd(d.high52w)}</span>
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
          <Stat label="5 hari" value={fmtRet(d.returns.d5)} tone={tone(d.returns.d5)} />
          <Stat label="20 hari" value={fmtRet(d.returns.d20)} tone={tone(d.returns.d20)} />
          <Stat label="60 hari" value={fmtRet(d.returns.d60)} tone={tone(d.returns.d60)} />
          <Stat label="Sejak awal tahun" value={fmtRet(d.returns.ytd)} tone={tone(d.returns.ytd)} />
          <Stat label="1 tahun" value={fmtRet(d.returns.y1)} tone={tone(d.returns.y1)} />
          <Stat label="RSI (14)" value={d.rsi !== null ? d.rsi.toFixed(1).replace(".", ",") : "—"} />
          <Stat label="MA 20" value={usd(d.ma20)} />
          <Stat label="MA 50" value={usd(d.ma50)} />
          <Stat label="MA 200" value={usd(d.ma200)} />
          <Stat label="Dari puncak 52M" value={fmtRet(((d.price - d.high52w) / d.high52w) * 100)} tone="bear" />
          <Stat label="Dari dasar 52M" value={fmtRet(((d.price - d.low52w) / d.low52w) * 100)} tone="bull" />
          <Stat label="Tren" value={d.trend} tone={d.trend === "UPTREND" ? "bull" : d.trend === "DOWNTREND" ? "bear" : undefined} />
        </div>
      </section>

      {/* Rekomendasi */}
      <Section
        id="rekomendasi"
        title="Rekomendasi Emas"
        icon="🎯"
        subtitle="Skor 0–100 dari fase siklus, aliran dana, momentum, timing, serta dua faktor khas emas: dolar AS dan imbal hasil obligasi AS."
        right={<RecBadge action={rec.action} />}
      >
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <ScoreRing score={rec.score} size={96} sublabel="skor" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <RecBadge action={rec.action} />
                  <TimingBadge verdict={d.timing.verdict} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{rec.horizon}</p>
              </div>
            </div>

            <RecExplain rec={rec} />

            {rec.reasons.length > 0 && (
              <div>
                <p className="stat-label mb-1.5 text-bull">Yang mendukung</p>
                <BulletList items={rec.reasons.map(fix)} tone="bull" />
              </div>
            )}
            {rec.warnings.length > 0 && (
              <div>
                <p className="stat-label mb-1.5 text-warn">Yang memberatkan / perlu diwaspadai</p>
                <BulletList items={rec.warnings} tone="warn" />
              </div>
            )}

            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
              <p className="stat-label">Timing: {d.timing.label} · kesiapan {d.timing.score}/100</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{d.timing.situation}</p>
              {d.timing.waitFor[0] && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  <span className="font-semibold text-warn">Menunggu · </span>
                  {d.timing.waitFor[0]}
                </p>
              )}
            </div>

            <details className="group">
              <summary className="-my-1.5 select-none py-1.5 text-xs font-semibold text-brandx">
                <span className="group-open:hidden">▼ Lihat cara skor {rec.score} dihitung</span>
                <span className="hidden group-open:inline">▲ Sembunyikan rincian skor</span>
              </summary>
              <div className="mt-3">
                <ScoreBreakdown items={rec.breakdown} total={rec.score} note={`Ambang aksi: ${REC_BANDS}`} />
              </div>
            </details>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="stat-label mb-1">
                {rec.plan.mode === "BELI" ? "Rencana transaksi (USD per troy ounce)" : "Panduan bagi pemegang (fase bearish)"}
              </p>
              <PlanLevels plan={rec.plan} money={(v) => usd(v)} sub={perGram} />
              <div className="mt-2">
                <PlanRiskLine plan={rec.plan} tickLabel="kelipatan $1" />
              </div>
              <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-slate-400">Ukuran posisi</span>
                  <span className="text-sm font-semibold tabular text-white">
                    {rec.position.pct > 0 ? `±${String(rec.position.pct).replace(".", ",")}% portofolio` : "0%"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{rec.position.basis}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="stat-label mb-2">Penggerak makro emas</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <Stat
                  label="Indeks dolar (DXY)"
                  value={
                    d.macro.dxy ? (
                      <>
                        {num(d.macro.dxy.value, 2)}{" "}
                        <span className="text-xs font-medium text-slate-400">{fmtRet(d.macro.dxy.ret20, 1)} · 20H</span>
                      </>
                    ) : (
                      "—"
                    )
                  }
                />
                <Stat
                  label="Imbal hasil AS 10 th"
                  value={
                    d.macro.us10y ? (
                      <>
                        {num(d.macro.us10y.value, 2)}%{" "}
                        <span className="text-xs font-medium text-slate-400">
                          {d.macro.us10y.chg20 === null
                            ? "—"
                            : `${d.macro.us10y.chg20 >= 0 ? "+" : "−"}${Math.abs(d.macro.us10y.chg20).toFixed(2).replace(".", ",")} poin`}{" "}
                          · 20H
                        </span>
                      </>
                    ) : (
                      "—"
                    )
                  }
                />
                <Stat
                  label="Kurs USD/IDR"
                  value={
                    d.macro.usdIdr ? (
                      <>
                        {num(d.macro.usdIdr.value)}{" "}
                        <span className="text-xs font-medium text-slate-400">{fmtRet(d.macro.usdIdr.ret20, 1)} · 20H</span>
                      </>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Emas dihargai dalam dolar dan tidak memberi bunga, jadi cenderung naik saat dolar dan imbal hasil turun —
                kecenderungan historis, bukan kepastian, sehingga bobotnya kecil (±3 dan ±2 poin).
                {d.idr && d.idr.ret20 !== null && d.returns.d20 !== null && (
                  <>
                    {" "}
                    Bagi pemegang rupiah, hasil 20 hari adalah {fmtRet(d.idr.ret20, 1)} (emas {fmtRet(d.returns.d20, 1)} digabung
                    perubahan kurs): rupiah yang melemah menambah untung emas, rupiah yang menguat menguranginya.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Grafik */}
      {d.candles && (
        <PriceChart candles={d.candles} supports={d.supports} resistances={d.resistances} currency="USD per troy ounce" />
      )}

      {/* Siklus */}
      {c.available && (
        <Section
          id="siklus"
          title="Siklus Harga Emas"
          icon="🔄"
          subtitle="Fase Wyckoff dibaca dengan mesin yang sama seperti saham: struktur tren, aliran dana, dan volume kontrak."
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
              <p className="text-sm leading-relaxed text-slate-400">{fix(c.summary)}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Keyakinan" value={`${c.confidence}%`} />
                <Stat label="Lama fase" value={`±${c.daysInPhase} hari`} />
                <Stat label="Atas rentang 40H" value={usd(c.range.high)} />
                <Stat label="Bawah rentang 40H" value={usd(c.range.low)} />
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="stat-label">Fase berikutnya: {PHASE_META[c.next.phase].label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-bull">Pemicu · </span>
                  {fix(c.next.trigger)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  <span className="font-semibold text-bear">Pembatal · </span>
                  {fix(c.next.invalidation)}
                </p>
              </div>
              <ul className="divide-y divide-white/5 rounded-2xl border border-white/8">
                {c.evidence.map((e) => (
                  <li key={e.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5">
                    <span className="min-w-0 text-xs text-slate-400">{e.label}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="whitespace-nowrap text-xs font-semibold tabular text-slate-100">{fix(e.value)}</span>
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
        title="Teknikal Emas"
        icon="📈"
        subtitle="Skor teknikal dengan rincian komponennya, serta level support & resistance terdekat."
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
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{b.detail}</p>
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
                          R{i + 1} · {usd(r)}
                          <span className="ml-1 text-[11px] text-slate-500">{fmtRet(((r - d.price) / d.price) * 100, 1)}</span>
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
                          S{i + 1} · {usd(s)}
                          <span className="ml-1 text-[11px] text-slate-500">{fmtRet(((s - d.price) / d.price) * 100, 1)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">Tidak terdeteksi</li>
                    )}
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">Level dari deteksi swing pivot 160 hari terakhir.</p>
            </div>
          </div>
        </div>
      </Section>

      <section className="rounded-2xl border border-warn/25 bg-warn/6 p-5">
        <h2 className="text-sm font-semibold text-warn">Yang perlu dipahami sebelum memakai angka ini</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-amber-100/75">
          <li>
            Harga memakai kontrak berjangka emas COMEX terdekat, bukan XAU/USD spot — selisihnya umumnya di bawah 1%, dan
            bisa melompat saat pergantian kontrak.
          </li>
          <li>
            Rupiah per gram adalah konversi matematis (harga × kurs ÷ 31,1035 gram). Harga emas batangan ritel (Antam,
            Pegadaian, dll.) lebih tinggi karena ongkos cetak dan selisih jual-beli, jadi level di atas tidak bisa
            dipakai langsung sebagai harga beli emas fisik.
          </li>
          <li>
            Rekomendasi ini murni dari harga, volume, dan dua indikator makro. Keputusan bank sentral, geopolitik, dan
            data inflasi bisa mengubah arah emas dalam sehari — cek tab berita emas sebelum bertindak.
          </li>
          <li>Ini bukan nasihat investasi dan tidak mempertimbangkan kondisi keuangan Anda.</li>
        </ul>
        <Link href="/berita?topik=emas" className="btn-ghost mt-4">
          📰 Baca berita emas & XAU terbaru
        </Link>
      </section>
    </div>
  );
}

import { fmtCompact, fmtDateTime, fmtIDR, fmtInt, fmtPct } from "@/lib/format";
import Link from "next/link";
import type { AnalysisResult } from "@/lib/types";
import { Badge, ScoreRing, Stat } from "./ui";

function VsIhsg({ m }: { m: NonNullable<AnalysisResult["market"]> }) {
  const f = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;
  const rows = [
    { label: "20 hari", s: m.stock20, i: m.ihsg20, d: m.rs20 },
    { label: "60 hari", s: m.stock60, i: m.ihsg60, d: m.rs60 },
    { label: "1 tahun", s: m.stock250, i: m.ihsg250, d: m.rs250 },
  ].filter((r) => r.s !== null && r.i !== null && r.d !== null) as { label: string; s: number; i: number; d: number }[];
  if (!rows.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href="/ihsg" className="stat-label hover:text-slate-300">
          Kinerja vs IHSG
        </Link>
        <span className="text-[11px] tabular text-slate-500">
          IHSG {m.ihsgPrice.toLocaleString("id-ID", { maximumFractionDigits: 2 })} ({f(m.ihsgChangePct)})
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{r.label}</p>
            <p className={`text-sm font-semibold tabular ${r.d >= 0 ? "text-bull" : "text-bear"}`}>
              {r.d >= 0 ? "+" : "−"}
              {Math.abs(r.d).toFixed(1).replace(".", ",")} poin
            </p>
            <p className="truncate text-[10px] tabular text-slate-500">
              {f(r.s)} vs {f(r.i)}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
        Selisih return saham dikurangi return IHSG pada periode yang sama. Positif = lebih kuat dari pasar.
      </p>
    </div>
  );
}

export default function StockHeader({ a }: { a: AnalysisResult }) {
  const q = a.quote;
  const up = q.changePct >= 0;
  const rangePos =
    q.high52w && q.low52w && q.high52w > q.low52w
      ? ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100
      : null;

  return (
    <section className="card card-pad animate-fade-up">
      {/* Ponsel: identitas → skor → harga & statistik. Desktop: skor di kolom kanan. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl bg-brandx/15 px-3 py-1.5 text-base font-black tracking-wider text-brandx sm:text-lg">
              {a.ticker}
            </span>
            <h1 className="min-w-0 text-lg font-bold leading-snug tracking-tight text-white sm:text-2xl">
              {a.profile.name}
            </h1>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {a.profile.sector && <span className="chip">🏭 {a.profile.sector}</span>}
            {a.profile.industry && <span className="chip">{a.profile.industry}</span>}
            <span className="chip">{q.exchange ?? "IDX"}</span>
            {q.marketState && <span className="chip">Pasar: {q.marketState}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex-col lg:justify-center lg:gap-3 lg:px-6 lg:py-5">
          <div className="lg:hidden">
            <ScoreRing score={a.council.score} size={88} sublabel="skor" />
          </div>
          <div className="hidden lg:block">
            <ScoreRing score={a.council.score} size={132} sublabel="skor dewan" />
          </div>
          <div className="min-w-0 space-y-2 lg:text-center">
            <p className="stat-label lg:hidden">Skor Dewan Analis</p>
            <Badge tone={a.council.score >= 63 ? "bull" : a.council.score >= 45 ? "warn" : "bear"}>
              {a.council.label}
            </Badge>
            <p className="text-[11px] leading-snug text-slate-500">
              Keyakinan {a.council.confidence}% · kelengkapan data {a.dataQuality.completeness}%
            </p>
          </div>
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <p className="text-3xl font-bold tabular text-white sm:text-4xl">{fmtIDR(q.price)}</p>
              <p className={`mt-1 text-sm font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
                {up ? "▲" : "▼"} {fmtIDR(Math.abs(q.change))} ({fmtPct(q.changePct)})
              </p>
            </div>
            {rangePos !== null && (
              <div className="w-full sm:w-auto sm:min-w-[220px] sm:flex-1">
                <div className="mb-1 flex justify-between gap-2 text-[11px] text-slate-500">
                  <span>{fmtIDR(q.low52w)}</span>
                  <span className="hidden min-[400px]:inline">Rentang 52 minggu</span>
                  <span className="min-[400px]:hidden">52 mgg</span>
                  <span>{fmtIDR(q.high52w)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-gradient-to-r from-bear/50 via-warn/40 to-bull/50">
                  <div
                    className="absolute -top-1 h-3.5 w-1 rounded-full bg-white shadow"
                    style={{ left: `calc(${Math.max(0, Math.min(100, rangePos))}% - 2px)` }}
                  />
                </div>
              </div>
            )}
          </div>

          {a.market && <VsIhsg m={a.market} />}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
            <Stat label="Buka" value={fmtIDR(q.open)} />
            <Stat label="Tertinggi hari ini" value={fmtIDR(q.dayHigh)} />
            <Stat label="Terendah hari ini" value={fmtIDR(q.dayLow)} />
            <Stat label="Volume" value={fmtCompact(q.volume, "")} />
            <Stat label="Kapitalisasi pasar" value={fmtCompact(q.marketCap)} />
            <Stat label="Rata-rata volume 3 bln" value={fmtCompact(q.avgVolume3m, "")} />
            <Stat
              label="Nilai transaksi harian"
              value={fmtCompact((q.avgVolume3m ?? q.volume) * q.price)}
            />
            <Stat label="Lembar beredar" value={fmtCompact(a.ownership.sharesOutstanding, "")} />
          </div>
        </div>
      </div>

      <div className="divider my-5" />

      <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <span>Diperbarui {fmtDateTime(a.generatedAt)}</span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {a.dataQuality.sources.map((s) => (
            <span key={s}>· {s}</span>
          ))}
        </span>
      </div>

      {a.dataQuality.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-warn/25 bg-warn/8 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-warn">Catatan kualitas data</p>
          <ul className="space-y-1 text-xs text-amber-100/70">
            {a.dataQuality.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

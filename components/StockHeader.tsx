import { fmtCompact, fmtDateTime, fmtIDR, fmtInt, fmtPct } from "@/lib/format";
import type { AnalysisResult } from "@/lib/types";
import { Badge, ScoreRing, Stat } from "./ui";

export default function StockHeader({ a }: { a: AnalysisResult }) {
  const q = a.quote;
  const up = q.changePct >= 0;
  const rangePos =
    q.high52w && q.low52w && q.high52w > q.low52w
      ? ((q.price - q.low52w) / (q.high52w - q.low52w)) * 100
      : null;

  return (
    <section className="card card-pad animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl bg-brandx/15 px-3 py-1.5 text-lg font-black tracking-wider text-brandx">
              {a.ticker}
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{a.profile.name}</h1>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {a.profile.sector && <span className="chip">🏭 {a.profile.sector}</span>}
            {a.profile.industry && <span className="chip">{a.profile.industry}</span>}
            <span className="chip">{q.exchange ?? "IDX"}</span>
            {q.marketState && <span className="chip">Pasar: {q.marketState}</span>}
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-3xl font-bold tabular text-white sm:text-4xl">{fmtIDR(q.price)}</p>
              <p className={`mt-1 text-sm font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
                {up ? "▲" : "▼"} {fmtIDR(Math.abs(q.change))} ({fmtPct(q.changePct)})
              </p>
            </div>
            {rangePos !== null && (
              <div className="min-w-[200px] flex-1">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>{fmtIDR(q.low52w)}</span>
                  <span>Rentang 52 minggu</span>
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

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
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

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5">
          <ScoreRing score={a.council.score} size={132} sublabel="skor dewan" />
          <Badge
            tone={
              a.council.score >= 63 ? "bull" : a.council.score >= 45 ? "warn" : "bear"
            }
          >
            {a.council.label}
          </Badge>
          <p className="text-center text-[11px] text-slate-500">
            Keyakinan {a.council.confidence}% · kelengkapan data {a.dataQuality.completeness}%
          </p>
        </div>
      </div>

      <div className="divider my-5" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
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

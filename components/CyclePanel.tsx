import { fmtDate, fmtIDR, fmtNumber } from "@/lib/format";
import type { CycleReport, DataRecommendation } from "@/lib/types";
import { CycleWave, PHASE_META, PHASE_ORDER, PhaseBadge, RecBadge } from "./cycle-ui";
import { REC_BANDS } from "@/lib/recommend";
import { PlanLevels, PlanRiskLine, ScoreBreakdown } from "./plan-ui";
import { BulletList, ScoreRing, Section, Stat } from "./ui";

function Timeline({ points }: { points: CycleReport["timeline"] }) {
  if (points.length < 2) return null;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {points.map((p, i) => (
          <div
            key={i}
            className="h-full flex-1"
            style={{ backgroundColor: PHASE_META[p.phase].color, opacity: i === points.length - 1 ? 1 : 0.75 }}
            title={`${fmtDate(p.t)} · ${PHASE_META[p.phase].label} · ${fmtIDR(p.price)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
        <span>{fmtDate(points[0].t)}</span>
        <span>Hari ini</span>
      </div>
    </div>
  );
}

export default function CyclePanel({ cycle, rec }: { cycle: CycleReport; rec: DataRecommendation }) {
  if (!cycle.available) {
    return (
      <Section id="siklus" title="Siklus Saham" icon="🔄">
        <p className="muted">{cycle.summary}</p>
      </Section>
    );
  }

  return (
    <Section
      id="siklus"
      title="Siklus Saham & Rekomendasi Data"
      icon="🔄"
      subtitle="Posisi saham dalam 4 siklus Wyckoff — Akumulasi, Mark Up, Distribusi, Mark Down — dibaca dari struktur tren, aliran dana, dan volume."
      right={<PhaseBadge phase={cycle.phase} />}
    >
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
            <CycleWave phase={cycle.phase} daysInPhase={cycle.daysInPhase} scores={cycle.scores} />
          </div>

          <div>
            <p className="text-base font-semibold text-white">
              {PHASE_META[cycle.phase].icon} {cycle.label}{" "}
              <span className="font-normal text-slate-400">· {cycle.stage}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{cycle.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Keyakinan" value={`${cycle.confidence}%`} />
            <Stat label="Lama fase" value={`±${cycle.daysInPhase} hari`} />
            <Stat label="Atas rentang 40H" value={fmtIDR(cycle.range.high)} />
            <Stat label="Bawah rentang 40H" value={fmtIDR(cycle.range.low)} />
          </div>

          <div>
            <p className="stat-label mb-2">Riwayat fase ±1 tahun</p>
            <Timeline points={cycle.timeline} />
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
              {PHASE_ORDER.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_META[p].color }} />
                  {PHASE_META[p].label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <p className="stat-label">Probabilitas tiap fase</p>
            {PHASE_ORDER.map((p) => (
              <div key={p}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">
                    {PHASE_META[p].icon} {PHASE_META[p].label}
                  </span>
                  <span className="font-semibold tabular text-slate-200">{cycle.scores[p]}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, cycle.scores[p])}%`, backgroundColor: PHASE_META[p].color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="stat-label">Rekomendasi berbasis data</p>
                <div className="mt-2">
                  <RecBadge action={rec.action} />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{rec.horizon}</p>
              </div>
              <ScoreRing score={rec.score} size={92} sublabel="skor" />
            </div>

            {/* Level harga — angka sama persis dengan Dewan Analis & Teknikal */}
            <div className="mt-4">
              <p className="stat-label mb-1">
                {rec.plan.mode === "BELI" ? "Rencana transaksi" : "Panduan bagi pemegang (fase bearish)"}
              </p>
              <PlanLevels plan={rec.plan} />
              <div className="mt-2">
                <PlanRiskLine plan={rec.plan} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">Ukuran posisi</span>
                <span className="text-sm font-semibold tabular text-white">
                  {rec.position.pct > 0 ? `±${String(rec.position.pct).replace(".", ",")}% portofolio` : "0%"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{rec.position.basis}</p>
            </div>

            <div className="mt-4 space-y-3">
              <BulletList items={rec.reasons} tone="bull" />
              <BulletList items={rec.warnings} tone="warn" />
            </div>

            <details className="group mt-4">
              <summary className="-my-1.5 select-none py-1.5 text-xs font-semibold text-brandx">
                <span className="group-open:hidden">▼ Lihat cara skor {rec.score} dihitung</span>
                <span className="hidden group-open:inline">▲ Sembunyikan rincian skor</span>
              </summary>
              <div className="mt-3">
                <ScoreBreakdown items={rec.breakdown} total={rec.score} note={`Ambang aksi: ${REC_BANDS}`} />
              </div>
            </details>

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Rekomendasi ini hanya membaca harga & volume (siklus, aliran dana, momentum, likuiditas). Sikap Dewan
              Analis di atas bisa berbeda karena ikut menimbang fundamental, berita, dan validasi story — level
              harganya tetap sama.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="stat-label">Fase berikutnya: {PHASE_META[cycle.next.phase].label}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-bull">Pemicu · </span>
              {cycle.next.trigger}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-bear">Pembatal · </span>
              {cycle.next.invalidation}
            </p>
          </div>

          <div>
            <p className="stat-label mb-2">Bukti yang dibaca</p>
            <ul className="divide-y divide-white/5 rounded-2xl border border-white/8">
              {cycle.evidence.map((e) => (
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
      </div>
    </Section>
  );
}

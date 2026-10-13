"use client";

import { useState } from "react";
import type { AnalysisResult, CouncilMember, Stance } from "@/lib/types";
import { PlanLevels, PlanRiskLine } from "./plan-ui";
import { Badge, BulletList, ScoreBar, ScoreRing, Section, scoreColor, scoreText } from "./ui";

function stanceTone(s: Stance): "bull" | "bear" | "warn" | "neutral" {
  if (s === "STRONG_BUY" || s === "BUY") return "bull";
  if (s === "SELL" || s === "REDUCE") return "bear";
  return "warn";
}

function stanceShort(s: Stance): string {
  switch (s) {
    case "STRONG_BUY":
      return "Akumulasi Kuat";
    case "BUY":
      return "Beli";
    case "HOLD":
      return "Tahan";
    case "REDUCE":
      return "Kurangi";
    case "SELL":
      return "Jual";
  }
}

const STANCE_BANDS = "≥78 Akumulasi Kuat · 63–77 Beli · 45–62 Tahan · 32–44 Kurangi · <32 Jual";

function CouncilMath({ c }: { c: AnalysisResult["council"] }) {
  const totalW = c.members.reduce((a, m) => a + m.weight, 0);
  const sumContrib = c.members.reduce((a, m) => a + (m.score * m.weight) / totalW, 0);
  const avgConf = c.members.reduce((a, m) => a + m.confidence * m.weight, 0) / totalW;
  const f = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
  return (
    <div className="mt-3 space-y-3">
      <ul className="divide-y divide-white/5 rounded-xl border border-white/8 text-xs">
        {c.members.map((m) => (
          <li key={m.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <span className="min-w-0 text-slate-300">
              {m.emoji} {m.name}
            </span>
            <span className="shrink-0 tabular text-slate-400">
              {Math.round(m.score)} × {f(m.weight)} ÷ {f(totalW)} ={" "}
              <span className="font-semibold text-white">{f((m.score * m.weight) / totalW, 2)}</span>
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 bg-white/[0.03] px-3 py-2">
          <span className="font-semibold text-white">Skor dewan</span>
          <span className="font-bold tabular text-white">
            {f(sumContrib, 2)} → {c.score}
          </span>
        </li>
      </ul>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Kontribusi = skor × bobot ÷ total bobot ({f(totalW)}). Bobot turun otomatis bila data anggota tidak tersedia.
        Sikap ditentukan dari skor: {STANCE_BANDS}.
      </p>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Keyakinan {c.confidence}% = rata-rata keyakinan berbobot {f(avgConf)}% − 1,2 × sebaran skor antar anggota (±
        {c.disagreement}). Makin dewan tidak sepakat, makin rendah keyakinannya.
      </p>
    </div>
  );
}

function MemberCard({ m }: { m: CouncilMember }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-lg">
            {m.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{m.name}</p>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{m.role}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-xl font-bold tabular ${scoreText(m.score)}`}>{Math.round(m.score)}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">/100</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${m.score}%`, backgroundColor: scoreColor(m.score) }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={stanceTone(m.stance)}>{stanceShort(m.stance)}</Badge>
        <span className="chip">Keyakinan {Math.round(m.confidence)}%</span>
        <span className="chip">Bobot suara {m.weight.toFixed(1)}x</span>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-semibold text-brandx transition hover:text-brandx/80"
      >
        {open ? "Sembunyikan argumen" : "Lihat argumen lengkap"} {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {m.rationale.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-bull">
                Yang mendukung
              </p>
              <BulletList items={m.rationale} tone="bull" />
            </div>
          )}
          {m.concerns.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-bear">
                Yang dikhawatirkan
              </p>
              <BulletList items={m.concerns} tone="bear" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CouncilPanel({
  a,
  aiLoading,
}: {
  a: AnalysisResult;
  aiLoading?: boolean;
}) {
  const c = a.council;
  const ai = a.ai;

  return (
    <Section
      id="dewan"
      title="Dewan Analis — Rekomendasi Akhir"
      icon="⚖️"
      subtitle="Tujuh analis dengan sudut pandang berbeda menilai saham ini, lalu suaranya digabung dengan bobot sesuai ketersediaan dan kualitas data."
      right={
        <Badge tone={c.narrativeSource === "ai" ? "info" : "neutral"}>
          {c.narrativeSource === "ai" ? "✨ Disintesis AI" : aiLoading ? "✨ Sintesis AI berjalan…" : "Rule engine"}
        </Badge>
      }
    >
      {/* Verdict utama */}
      <div className="grid gap-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-4 sm:p-5 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-row items-center gap-5 lg:flex-col lg:items-center">
          <ScoreRing score={c.score} size={128} sublabel="gabungan" />
          <div className="text-center">
            <Badge tone={stanceTone(c.stance)}>{c.label}</Badge>
            <p className="mt-2 text-[11px] text-slate-500">
              Keyakinan {c.confidence}% · sebaran suara ±{c.disagreement}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-200">{c.narrative}</p>
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
            <strong className="text-slate-300">Konsensus dewan:</strong> {c.consensus}
          </p>

          {ai?.debat_dewan && (
            <p className="rounded-xl border border-brandx/20 bg-brandx/8 px-4 py-3 text-xs leading-relaxed text-slate-300">
              <strong className="text-brandx">Catatan perdebatan:</strong> {ai.debat_dewan}
            </p>
          )}
        </div>
      </div>

      {/* Rencana aksi */}
      {c.plan ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
            <p className="stat-label flex items-center gap-1.5">
              <span aria-hidden>🎯</span>
              {c.plan.mode === "BELI" ? "Rencana transaksi" : "Panduan bagi pemegang"}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{c.actionPlan.entry}</p>
            <div className="mt-2">
              <PlanLevels plan={c.plan} />
            </div>
            <div className="mt-2">
              <PlanRiskLine plan={c.plan} />
            </div>
          </div>
          <div className="grid gap-3">
            {[
              { label: "Horizon", value: c.actionPlan.horizon, icon: "⏳", sub: undefined as string | undefined },
              {
                label: "Ukuran posisi",
                value: c.position && c.position.pct > 0 ? `±${String(c.position.pct).replace(".", ",")}% portofolio, dibagi 2–3 kali beli` : "0% — tidak ada alokasi baru",
                icon: "⚖️",
                sub: c.position?.basis,
              },
              { label: "Pembatal tesis", value: c.actionPlan.invalidation, icon: "❌", sub: undefined },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="stat-label flex items-center gap-1.5">
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{item.value}</p>
                {item.sub && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.sub}</p>}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Horizon", value: c.actionPlan.horizon, icon: "⏳" },
            { label: "Rencana entry", value: c.actionPlan.entry, icon: "🎯" },
            { label: "Stop loss", value: c.actionPlan.stopLoss, icon: "🛑" },
            { label: "Target harga", value: c.actionPlan.target, icon: "🏁" },
            { label: "Ukuran posisi", value: c.actionPlan.positionSizing, icon: "⚖️" },
            { label: "Pembatal tesis", value: c.actionPlan.invalidation, icon: "❌" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="stat-label flex items-center gap-1.5">
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cara skor dewan dihitung */}
      <details className="group mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer list-none text-xs font-semibold text-brandx">
          <span className="group-open:hidden">▼ Lihat cara skor dewan {c.score} dihitung</span>
          <span className="hidden group-open:inline">▲ Sembunyikan perhitungan</span>
        </summary>
        <CouncilMath c={c} />
      </details>

      {ai?.rekomendasi && (
        <div className="mt-5 rounded-2xl border border-bull/20 bg-bull/6 p-4 sm:p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bull">
            ✨ Rekomendasi naratif (AI)
          </p>
          <p className="text-sm leading-relaxed text-slate-200">{ai.rekomendasi}</p>
        </div>
      )}

      {/* Alasan & risiko */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-bull/20 bg-bull/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bull">Tesis pendukung</h3>
          <BulletList items={c.keyReasons} tone="bull" empty="Tidak ada faktor pendukung yang menonjol." />
        </div>
        <div className="rounded-2xl border border-bear/20 bg-bear/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bear">Risiko & keberatan</h3>
          <BulletList items={c.keyRisks} tone="bear" empty="Tidak ada risiko struktural yang menonjol." />
        </div>
      </div>

      {/* Yang harus dipantau */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Yang harus dipantau berikutnya</h3>
        <BulletList items={c.watchlist} tone="warn" />
      </div>

      {/* Anggota dewan */}
      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold text-white">Suara masing-masing anggota</h3>
        <p className="muted mb-4">
          Klik tiap kartu untuk membaca argumen dan kekhawatiran yang mendasari skornya.
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {c.members.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      </div>

      {/* Ringkasan skor dimensi */}
      <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreBar label="Fundamental" score={a.fundamental.available ? a.fundamental.score : 50} />
        <ScoreBar label="Teknikal" score={a.technical.available ? a.technical.score : 50} />
        <ScoreBar label="Sentimen berita" score={a.news.score} />
        <ScoreBar label="Momentum & story" score={a.momentum.score} />
      </div>

      {ai?.peringatan && (
        <p className="mt-4 rounded-xl border border-warn/20 bg-warn/8 px-4 py-3 text-xs leading-relaxed text-amber-100/80">
          ⚠️ {ai.peringatan}
        </p>
      )}
    </Section>
  );
}

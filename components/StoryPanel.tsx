"use client";

import { useState } from "react";
import { fmtDate, timeAgo } from "@/lib/format";
import type { MomentumReport, Story, StoryVerdict } from "@/lib/types";
import { Badge, BulletList, ScoreBar, Section, scoreColor } from "./ui";

const VERDICT_META: Record<
  StoryVerdict,
  { label: string; tone: "bull" | "bear" | "warn" | "neutral" | "info"; icon: string; blurb: string }
> = {
  TERVALIDASI: {
    label: "Tervalidasi",
    tone: "bull",
    icon: "✅",
    blurb: "Narasi terkonfirmasi oleh harga, volume, dan fundamental sekaligus.",
  },
  SEBAGIAN_VALID: {
    label: "Sebagian valid",
    tone: "info",
    icon: "🟡",
    blurb: "Sebagian bukti mendukung, sebagian masih kosong.",
  },
  BELUM_TERVALIDASI: {
    label: "Belum tervalidasi",
    tone: "warn",
    icon: "⏳",
    blurb: "Bukti belum cukup untuk menyimpulkan apa pun.",
  },
  LEMAH: {
    label: "Lemah",
    tone: "bear",
    icon: "⚠️",
    blurb: "Mayoritas uji validasi gagal — narasi rapuh.",
  },
  MENCURIGAKAN: {
    label: "Mencurigakan",
    tone: "bear",
    icon: "🚨",
    blurb: "Harga bergerak jauh melampaui bukti yang ada — waspadai penggerakan harga.",
  },
};

function CheckRow({
  label,
  score,
  passed,
  evidence,
}: {
  label: string;
  score: number;
  passed: boolean | null;
  evidence: string;
}) {
  const icon = passed === true ? "✓" : passed === false ? "✕" : "?";
  const iconClass =
    passed === true
      ? "bg-bull/15 text-bull"
      : passed === false
        ? "bg-bear/15 text-bear"
        : "bg-white/8 text-slate-400";
  return (
    <div className="flex gap-3 border-b border-white/5 py-3 last:border-0">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-bold ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-slate-100">{label}</p>
          <span className="shrink-0 text-xs font-semibold tabular" style={{ color: scoreColor(score) }}>
            {Math.round(score)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{evidence}</p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(2, score)}%`, backgroundColor: scoreColor(score) }}
          />
        </div>
      </div>
    </div>
  );
}

function StoryCard({ s, aiNote }: { s: Story; aiNote?: string }) {
  const [open, setOpen] = useState(s.verdict === "TERVALIDASI" || s.verdict === "MENCURIGAKAN");
  const meta = VERDICT_META[s.verdict];
  const passed = s.checks.filter((c) => c.passed === true).length;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 transition ${
        s.verdict === "MENCURIGAKAN"
          ? "border-bear/35 bg-bear/6"
          : s.verdict === "TERVALIDASI"
            ? "border-bull/30 bg-bull/6"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>
              {meta.icon} {meta.label}
            </Badge>
            <span className="chip">{s.theme}</span>
            {s.grade === "sekunder" && (
              <span className="chip text-slate-500" title="Tema ini obrolan pasar umum, bukan katalis spesifik emiten">
                obrolan pasar
              </span>
            )}
            <span className="chip">{s.sourceCount} sumber</span>
            <span className="chip">{s.impactHorizon}</span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-snug text-white">{s.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular" style={{ color: scoreColor(s.strength) }}>
            {s.strength}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">kekuatan</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">{s.narrative}</p>

      {aiNote && (
        <p className="mt-3 rounded-xl border border-brandx/20 bg-brandx/8 px-3.5 py-2.5 text-xs leading-relaxed text-slate-300">
          <strong className="text-brandx">✨ Pembacaan AI:</strong> {aiNote}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>
          {passed}/{s.checks.length} uji validasi lolos
        </span>
        <span>·</span>
        <span>Terdeteksi {timeAgo(s.firstSeen)}</span>
        <span>·</span>
        <span>Update terakhir {timeAgo(s.lastSeen)}</span>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-semibold text-brandx transition hover:text-brandx/80"
      >
        {open ? "Tutup rincian validasi" : "Buka rincian uji validasi"} {open ? "▲" : "▼"}
      </button>

      {open && (
        <>
          <div className="mt-3 rounded-xl border border-white/10 bg-ink-950/50 px-4 py-1">
            {s.checks.map((c) => (
              <CheckRow key={c.key} label={c.label} score={c.score} passed={c.passed} evidence={c.evidence} />
            ))}
          </div>

          {s.supportingNews.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Berita pendukung
              </p>
              <ul className="space-y-1.5">
                {s.supportingNews.map((n, i) => (
                  <li key={i}>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-2 text-xs text-slate-400 transition hover:text-slate-100"
                    >
                      <span className="text-slate-600">›</span>
                      <span className="flex-1 leading-relaxed">
                        <span className="group-hover:underline">{n.title}</span>
                        <span className="ml-1.5 text-slate-600">
                          — {n.source}, {fmtDate(n.publishedAt)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StoryPanel({
  momentum,
  aiNotes = [],
}: {
  momentum: MomentumReport;
  aiNotes?: { tema: string; penilaian: string }[];
}) {
  return (
    <Section
      id="momentum"
      title="Momentum & Validasi Story"
      icon="🔍"
      subtitle="Mendeteksi narasi yang sedang menggerakkan saham, lalu mengujinya lewat 9 pemeriksaan silang: liputan media, kesegaran, konfirmasi harga, konfirmasi volume, dukungan fundamental, konsistensi sumber, daya tahan, keselarasan teknikal, dan kualitas tema."
      right={
        <Badge tone={momentum.score >= 60 ? "bull" : momentum.score >= 45 ? "warn" : "bear"}>
          {momentum.state} · {momentum.score}/100
        </Badge>
      }
    >
      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 sm:grid-cols-3">
        <ScoreBar label="Momentum harga" score={momentum.priceMomentum} />
        <ScoreBar label="Momentum volume" score={momentum.volumeMomentum} />
        <ScoreBar label="Momentum pemberitaan" score={momentum.newsMomentum} />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-300">{momentum.summary}</p>

      {(momentum.flags.length > 0 || momentum.divergence.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {momentum.flags.length > 0 && (
            <div className="rounded-2xl border border-bear/25 bg-bear/6 p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-bear">
                🚩 Anomali terdeteksi
              </h3>
              <BulletList items={momentum.flags} tone="bear" />
            </div>
          )}
          {momentum.divergence.length > 0 && (
            <div className="rounded-2xl border border-warn/25 bg-warn/6 p-4 sm:p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-warn">
                ↔️ Divergensi sinyal
              </h3>
              <BulletList items={momentum.divergence} tone="warn" />
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold text-white">
          Story terdeteksi ({momentum.stories.length})
        </h3>
        <p className="muted mb-4">
          Setiap narasi diuji terhadap data pasar dan laporan keuangan — bukan sekadar dihitung banyaknya
          berita.
        </p>

        {momentum.stories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-3xl">🗞️</p>
            <p className="mt-3 text-sm font-medium text-slate-300">
              Belum ada story yang cukup kuat untuk divalidasi
            </p>
            <p className="muted mx-auto mt-1.5 max-w-md">
              Tidak ditemukan tema berita berulang dalam 45 hari terakhir. Saham ini sedang bergerak tanpa
              narasi publik yang dominan — pergerakan harga kemungkinan didorong faktor teknikal, sektoral,
              atau arus dana, bukan katalis spesifik emiten.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {momentum.stories.map((s) => (
              <StoryCard
                key={s.id}
                s={s}
                aiNote={aiNotes.find((n) => n.tema.toLowerCase().includes(s.theme.toLowerCase().split(" ")[0]))?.penilaian}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}

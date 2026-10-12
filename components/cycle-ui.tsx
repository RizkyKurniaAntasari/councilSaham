import type { CyclePhase, RecAction } from "@/lib/types";

export const PHASE_ORDER: CyclePhase[] = ["AKUMULASI", "MARKUP", "DISTRIBUSI", "MARKDOWN"];

export const PHASE_META: Record<
  CyclePhase,
  { label: string; icon: string; color: string; cls: string; short: string }
> = {
  AKUMULASI: {
    label: "Akumulasi",
    icon: "🧲",
    color: "#5b8cff",
    cls: "border-brandx/35 bg-brandx/12 text-brandx",
    short: "Datar setelah turun, dana mulai masuk",
  },
  MARKUP: {
    label: "Mark Up",
    icon: "🚀",
    color: "#16c784",
    cls: "border-bull/35 bg-bull/12 text-bull",
    short: "Tren naik, higher high & higher low",
  },
  DISTRIBUSI: {
    label: "Distribusi",
    icon: "📦",
    color: "#f5a623",
    cls: "border-warn/35 bg-warn/12 text-warn",
    short: "Datar di atas, dana mulai keluar",
  },
  MARKDOWN: {
    label: "Mark Down",
    icon: "🔻",
    color: "#ea3943",
    cls: "border-bear/35 bg-bear/12 text-bear",
    short: "Tren turun, lower high & lower low",
  },
};

export const REC_META: Record<RecAction, { label: string; cls: string }> = {
  BELI: { label: "Beli", cls: "border-bull/40 bg-bull/15 text-bull" },
  BELI_BERTAHAP: { label: "Beli Bertahap", cls: "border-lime-400/35 bg-lime-400/10 text-lime-400" },
  PANTAU: { label: "Pantau", cls: "border-white/15 bg-white/5 text-slate-300" },
  AMBIL_UNTUNG: { label: "Ambil Untung", cls: "border-warn/35 bg-warn/12 text-warn" },
  HINDARI: { label: "Hindari", cls: "border-bear/35 bg-bear/12 text-bear" },
};

export function PhaseBadge({ phase, small }: { phase: CyclePhase; small?: boolean }) {
  const m = PHASE_META[phase];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${m.cls} ${
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}

export function RecBadge({ action, small }: { action: RecAction; small?: boolean }) {
  const m = REC_META[action];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border font-semibold ${m.cls} ${
        small ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      {m.label}
    </span>
  );
}

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "#16c784" : "#ea3943"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Diagram gelombang 4 siklus. Titik putih menandai posisi saham saat ini;
 * posisinya di dalam segmen mengikuti lama fase berjalan.
 */
export function CycleWave({
  phase,
  daysInPhase,
  scores,
}: {
  phase: CyclePhase;
  daysInPhase: number;
  scores?: Record<CyclePhase, number>;
}) {
  const W = 480;
  const H = 170;
  const top = 34;
  const bottom = 118;
  // Tiap fase: segmen 120px. Akumulasi datar bawah, markup naik, distribusi datar atas, markdown turun.
  const seg = [
    `M 0 ${bottom} C 40 ${bottom + 6}, 80 ${bottom - 6}, 120 ${bottom}`,
    `M 120 ${bottom} C 170 ${bottom}, 190 ${top}, 240 ${top}`,
    `M 240 ${top} C 280 ${top - 6}, 320 ${top + 6}, 360 ${top}`,
    `M 360 ${top} C 410 ${top}, 430 ${bottom}, 480 ${bottom}`,
  ];
  const idx = PHASE_ORDER.indexOf(phase);
  const frac = Math.min(0.88, Math.max(0.12, daysInPhase / 70));
  const x = idx * 120 + frac * 120;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const y =
    phase === "AKUMULASI"
      ? bottom
      : phase === "DISTRIBUSI"
        ? top
        : phase === "MARKUP"
          ? bottom - (bottom - top) * ease(frac)
          : top + (bottom - top) * ease(frac);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Posisi siklus: ${PHASE_META[phase].label}`}>
      {PHASE_ORDER.map((p, i) => (
        <rect
          key={p}
          x={i * 120 + 1}
          y={8}
          width={118}
          height={H - 16}
          rx={10}
          fill={PHASE_META[p].color}
          opacity={p === phase ? 0.1 : 0.03}
        />
      ))}
      {seg.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={PHASE_META[PHASE_ORDER[i]].color}
          strokeWidth={PHASE_ORDER[i] === phase ? 4 : 2.5}
          strokeLinecap="round"
          opacity={PHASE_ORDER[i] === phase ? 1 : 0.45}
        />
      ))}
      <circle cx={x} cy={y} r={11} fill={PHASE_META[phase].color} opacity={0.25}>
        <animate attributeName="r" values="9;15;9" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={6} fill="#fff" stroke={PHASE_META[phase].color} strokeWidth={3} />
      {PHASE_ORDER.map((p, i) => (
        <g key={p}>
          <text
            x={i * 120 + 60}
            y={H - 26}
            textAnchor="middle"
            fontSize={12}
            fontWeight={p === phase ? 700 : 500}
            fill={p === phase ? PHASE_META[p].color : "#94a3b8"}
          >
            {i + 1}. {PHASE_META[p].label}
          </text>
          {scores && (
            <text x={i * 120 + 60} y={H - 12} textAnchor="middle" fontSize={10} fill="#64748b">
              {scores[p]}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

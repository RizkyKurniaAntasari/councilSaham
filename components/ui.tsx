import type { ReactNode } from "react";

export function scoreColor(score: number): string {
  if (score >= 70) return "#16c784";
  if (score >= 55) return "#7ed957";
  if (score >= 45) return "#f5a623";
  if (score >= 30) return "#f97316";
  return "#ea3943";
}

export function scoreText(score: number): string {
  if (score >= 70) return "text-bull";
  if (score >= 55) return "text-lime-400";
  if (score >= 45) return "text-warn";
  if (score >= 30) return "text-orange-400";
  return "text-bear";
}

export function ScoreRing({
  score,
  label,
  size = 120,
  sublabel,
}: {
  score: number;
  label?: string;
  size?: number;
  sublabel?: string;
}) {
  const stroke = size >= 100 ? 10 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * c;
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular text-white" style={{ fontSize: size / 4 }}>
            {Math.round(score)}
          </span>
          {sublabel && <span className="text-[10px] uppercase tracking-wider text-slate-500">{sublabel}</span>}
        </div>
      </div>
      {label && <span className="mt-2 text-center text-xs font-medium text-slate-400">{label}</span>}
    </div>
  );
}

export function ScoreBar({
  score,
  label,
  right,
}: {
  score: number;
  label: string;
  right?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-xs font-semibold tabular text-slate-200">{right ?? `${Math.round(score)}/100`}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "bull" | "bear" | "warn" | "neutral" | "info";
}) {
  const tones: Record<string, string> = {
    bull: "border-bull/30 bg-bull/12 text-bull",
    bear: "border-bear/30 bg-bear/12 text-bear",
    warn: "border-warn/30 bg-warn/12 text-warn",
    info: "border-brandx/30 bg-brandx/12 text-brandx",
    neutral: "border-white/10 bg-white/5 text-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  subtitle,
  icon,
  right,
  children,
  id,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="card card-pad animate-fade-up scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2">
            {icon && <span aria-hidden>{icon}</span>}
            {title}
          </h2>
          {subtitle && <p className="muted mt-1 max-w-2xl">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "bull" | "bear" }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="stat-label">{label}</p>
      <p
        className={`stat-value tabular mt-0.5 ${tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function BulletList({
  items,
  tone = "neutral",
  empty,
}: {
  items: string[];
  tone?: "bull" | "bear" | "warn" | "neutral";
  empty?: string;
}) {
  if (!items.length) {
    return empty ? <p className="muted italic">{empty}</p> : null;
  }
  const dot =
    tone === "bull" ? "bg-bull" : tone === "bear" ? "bg-bear" : tone === "warn" ? "bg-warn" : "bg-slate-500";
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-300">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

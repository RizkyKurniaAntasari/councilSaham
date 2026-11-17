import { fmtNumber } from "@/lib/format";
import type { DataRecommendation, PriceLevel, ScoreItem, TradePlan } from "@/lib/types";

/** Cara menulis harga. Bawaan rupiah; emas memakai USD per troy ounce. */
export type Money = (v: number) => string;
const idr: Money = (v) => `Rp ${fmtNumber(v, 0)}`;

function signedPct(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;
}

function LevelRow({
  label,
  level,
  tone,
  extra,
  money = idr,
  sub,
}: {
  label: string;
  level: PriceLevel;
  tone: "bull" | "bear" | "neutral";
  extra?: string;
  money?: Money;
  /** Nilai setara di satuan lain, mis. rupiah per gram untuk emas. */
  sub?: Money;
}) {
  const color = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-white";
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-right">
          <span className={`text-sm font-semibold tabular ${color}`}>{money(level.price)}</span>
          <span className="ml-1.5 text-[11px] tabular text-slate-500">{signedPct(level.pct)}</span>
          {sub && <span className="block text-[11px] tabular text-slate-500">≈ {sub(level.price)}</span>}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {extra ? `${extra} ` : ""}
        {level.basis}
      </p>
    </li>
  );
}

/** Daftar level rencana transaksi lengkap dengan rumus tiap angka. */
export function PlanLevels({ plan, money, sub }: { plan: TradePlan; money?: Money; sub?: Money }) {
  const fmt = { money, sub };
  if (plan.mode === "PEGANG") {
    return (
      <ul className="divide-y divide-white/5">
        <LevelRow label="Area jual saat pantulan" level={plan.target1} tone="bull" {...fmt} />
        <LevelRow label="Batas keluar pemegang" level={plan.stopLoss} tone="bear" {...fmt} />
        {plan.reentry && <LevelRow label="Syarat beli kembali (tutup di atas)" level={plan.reentry} tone="neutral" {...fmt} />}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {plan.entryHigh && <LevelRow label="Batas atas zona entry" level={plan.entryHigh} tone="neutral" {...fmt} />}
      {plan.entryLow && <LevelRow label="Batas bawah zona entry" level={plan.entryLow} tone="neutral" {...fmt} />}
      <LevelRow label="Stop loss" level={plan.stopLoss} tone="bear" {...fmt} />
      <LevelRow
        label="Target 1"
        level={plan.target1}
        tone="bull"
        {...fmt}
        extra={plan.riskReward1 !== null ? `R/R 1:${plan.riskReward1.toFixed(2).replace(".", ",")}.` : undefined}
      />
      {plan.target2 && (
        <LevelRow
          label="Target 2"
          level={plan.target2}
          tone="bull"
          {...fmt}
          extra={plan.riskReward2 !== null ? `R/R 1:${plan.riskReward2.toFixed(2).replace(".", ",")}.` : undefined}
        />
      )}
    </ul>
  );
}

/** Ringkasan risiko rencana: jarak stop & potensi dari tengah zona entry. */
export function PlanRiskLine({ plan, tickLabel = "fraksi BEI" }: { plan: TradePlan; tickLabel?: string }) {
  if (plan.mode !== "BELI" || plan.riskPct === null || plan.rewardPct === null) return null;
  return (
    <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-slate-400">
      {plan.priceVsZone === "DI_ATAS" && plan.entryHigh && (
        <span className="mb-1 block font-semibold text-warn">
          Harga sekarang {plan.distToZonePct !== null ? `+${plan.distToZonePct.toFixed(1).replace(".", ",")}%` : ""} di atas
          zona ideal — jangan dikejar, antre beli di zona.
        </span>
      )}
      {plan.priceVsZone === "DALAM" && (
        <span className="mb-1 block font-semibold text-bull">Harga sekarang berada di dalam zona ideal.</span>
      )}
      Zona ideal dihitung dari stop & target (batas atas = R/R 1:{plan.idealRR}), bukan dari harga terakhir. Dari tengah
      zona: risiko ke stop{" "}
      <span className="font-semibold text-bear">{plan.riskPct.toFixed(1).replace(".", ",")}%</span>, potensi ke TP1{" "}
      <span className="font-semibold text-bull">{plan.rewardPct.toFixed(1).replace(".", ",")}%</span>. Semua harga dibulatkan
      ke {tickLabel} (stop & target dibulatkan ke bawah).
    </p>
  );
}

/** Tabel rincian skor: tiap baris menyumbang poin, totalnya = skor akhir. */
export function ScoreBreakdown({ items, total, note }: { items: ScoreItem[]; total: number; note?: string }) {
  const sum = items.reduce((a, b) => a + b.points, 0);
  return (
    <div>
      <ul className="divide-y divide-white/5 rounded-xl border border-white/8">
        {items.map((it, i) => (
          <li key={i} className="px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-slate-300">{it.label}</span>
              <span
                className={`shrink-0 text-xs font-semibold tabular ${
                  i === 0 ? "text-white" : it.points > 0 ? "text-bull" : it.points < 0 ? "text-bear" : "text-slate-400"
                }`}
              >
                {i === 0 ? "" : it.points > 0 ? "+" : "−"}
                {Math.abs(it.points).toFixed(1).replace(".", ",")}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{it.detail}</p>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 bg-white/[0.03] px-3 py-2">
          <span className="text-xs font-semibold text-white">Skor akhir</span>
          <span className="text-xs font-bold tabular text-white">
            {sum.toFixed(1).replace(".", ",")} → {total}
          </span>
        </li>
      </ul>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{note}</p>}
    </div>
  );
}

/** Penjelasan awam sebuah rekomendasi: kalimat utama + langkah yang harus dilakukan. */
export function RecExplain({ rec }: { rec: Pick<DataRecommendation, "headline" | "steps" | "action"> }) {
  const tone =
    rec.action === "BELI" || rec.action === "BELI_BERTAHAP"
      ? "border-bull/25 bg-bull/[0.06]"
      : rec.action === "PANTAU"
        ? "border-warn/25 bg-warn/[0.06]"
        : "border-bear/25 bg-bear/[0.06]";
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${tone}`}>
      <p className="text-sm font-semibold leading-relaxed text-white">{rec.headline}</p>
      {rec.steps.length > 0 && (
        <>
          <p className="stat-label mt-3">Yang perlu dilakukan</p>
          <ol className="mt-1.5 space-y-1.5">
            {rec.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-200">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

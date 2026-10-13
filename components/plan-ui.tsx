import { fmtNumber } from "@/lib/format";
import type { PriceLevel, ScoreItem, TradePlan } from "@/lib/types";

function signedPct(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;
}

function LevelRow({
  label,
  level,
  tone,
  extra,
}: {
  label: string;
  level: PriceLevel;
  tone: "bull" | "bear" | "neutral";
  extra?: string;
}) {
  const color = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-white";
  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-right">
          <span className={`text-sm font-semibold tabular ${color}`}>Rp {fmtNumber(level.price, 0)}</span>
          <span className="ml-1.5 text-[11px] tabular text-slate-500">{signedPct(level.pct)}</span>
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
export function PlanLevels({ plan }: { plan: TradePlan }) {
  if (plan.mode === "PEGANG") {
    return (
      <ul className="divide-y divide-white/5">
        <LevelRow label="Area jual saat pantulan" level={plan.target1} tone="bull" />
        <LevelRow label="Batas keluar pemegang" level={plan.stopLoss} tone="bear" />
        {plan.reentry && <LevelRow label="Syarat beli kembali (tutup di atas)" level={plan.reentry} tone="neutral" />}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {plan.entryHigh && <LevelRow label="Batas atas zona entry" level={plan.entryHigh} tone="neutral" />}
      {plan.entryLow && <LevelRow label="Batas bawah zona entry" level={plan.entryLow} tone="neutral" />}
      <LevelRow label="Stop loss" level={plan.stopLoss} tone="bear" />
      <LevelRow
        label="Target 1"
        level={plan.target1}
        tone="bull"
        extra={plan.riskReward1 !== null ? `R/R 1:${plan.riskReward1.toFixed(2).replace(".", ",")}.` : undefined}
      />
      {plan.target2 && (
        <LevelRow
          label="Target 2"
          level={plan.target2}
          tone="bull"
          extra={plan.riskReward2 !== null ? `R/R 1:${plan.riskReward2.toFixed(2).replace(".", ",")}.` : undefined}
        />
      )}
    </ul>
  );
}

/** Ringkasan risiko rencana: jarak stop & potensi dari tengah zona entry. */
export function PlanRiskLine({ plan }: { plan: TradePlan }) {
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
      ke fraksi BEI (stop & target dibulatkan ke bawah).
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

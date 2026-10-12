import { fmtIDR, fmtNumber, fmtPct } from "@/lib/format";
import type { TechnicalReport } from "@/lib/types";
import { Badge, BulletList, ScoreRing, Section, Stat } from "./ui";

function signalTone(s: "BULLISH" | "BEARISH" | "NETRAL") {
  return s === "BULLISH" ? "bull" : s === "BEARISH" ? "bear" : "neutral";
}

export default function TechnicalPanel({ t }: { t: TechnicalReport }) {
  const ind = t.indicators;

  if (!t.available) {
    return (
      <Section title="Analisis Teknikal" icon="📈">
        <p className="muted">Riwayat harga tidak cukup panjang untuk analisis teknikal.</p>
      </Section>
    );
  }

  const rows: { label: string; value: string; hint?: string }[] = [
    { label: "MA 20", value: fmtIDR(ind.ma20), hint: ind.ma20 ? (ind.ma20 < (t.levels.entry ?? 0) ? "harga di atas" : "harga di bawah") : undefined },
    { label: "MA 50", value: fmtIDR(ind.ma50) },
    { label: "MA 200", value: fmtIDR(ind.ma200) },
    { label: "RSI (14)", value: ind.rsi14 !== null ? fmtNumber(ind.rsi14, 1) : "—" },
    { label: "MACD", value: ind.macd ? fmtNumber(ind.macd.macd, 2) : "—" },
    { label: "Histogram MACD", value: ind.macd ? fmtNumber(ind.macd.hist, 3) : "—" },
    { label: "Stochastic %K", value: ind.stoch ? fmtNumber(ind.stoch.k, 1) : "—" },
    { label: "ADX (14)", value: ind.adx14 !== null ? fmtNumber(ind.adx14, 1) : "—" },
    { label: "ATR (14)", value: ind.atr14 !== null ? `${fmtNumber(ind.atr14, 1)} (${fmtNumber(ind.atrPct, 2)}%)` : "—" },
    { label: "Bollinger %B", value: ind.bb ? `${fmtNumber(ind.bb.pctB, 0)}%` : "—" },
    { label: "Lebar Bollinger", value: ind.bb ? `${fmtNumber(ind.bb.widthPct, 1)}%` : "—" },
    { label: "VWAP 20 hari", value: fmtIDR(ind.vwap20) },
  ];

  return (
    <Section
      id="teknikal"
      title="Analisis Teknikal"
      icon="📈"
      subtitle="Membaca struktur tren, momentum, partisipasi volume, dan level harga penting."
      right={
        <Badge tone={t.trend === "UPTREND" ? "bull" : t.trend === "DOWNTREND" ? "bear" : "warn"}>
          {t.trend} · {t.trendStrength}
        </Badge>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-row items-center gap-4 lg:flex-col">
          <ScoreRing score={t.score} size={116} sublabel="teknikal" />
          <p className="max-w-[180px] text-center text-xs leading-relaxed text-slate-400">{t.phase}</p>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Return 5 hari" value={fmtPct(ind.return5d)} tone={(ind.return5d ?? 0) >= 0 ? "bull" : "bear"} />
            <Stat label="Return 20 hari" value={fmtPct(ind.return20d)} tone={(ind.return20d ?? 0) >= 0 ? "bull" : "bear"} />
            <Stat label="Return 60 hari" value={fmtPct(ind.return60d)} tone={(ind.return60d ?? 0) >= 0 ? "bull" : "bear"} />
            <Stat label="Return 1 tahun" value={fmtPct(ind.return250d)} tone={(ind.return250d ?? 0) >= 0 ? "bull" : "bear"} />
            <Stat label="Dari puncak 52M" value={fmtPct(ind.distFrom52wHigh)} tone="bear" />
            <Stat label="Dari dasar 52M" value={fmtPct(ind.distFrom52wLow)} tone="bull" />
            <Stat
              label="Volume vs 20H"
              value={ind.volume ? `${fmtNumber(ind.volume.ratio20, 2)}x` : "—"}
              tone={ind.volume && ind.volume.ratio20 > 1.2 ? "bull" : undefined}
            />
            <Stat
              label="Aliran dana (OBV)"
              value={ind.obvSlopePct !== null ? fmtPct(ind.obvSlopePct, 1) : "—"}
              tone={(ind.obvSlopePct ?? 0) >= 0 ? "bull" : "bear"}
            />
          </div>

          {t.patterns.length > 0 && (
            <div className="mt-4 rounded-xl border border-brandx/20 bg-brandx/8 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brandx">
                Pola terdeteksi
              </p>
              <ul className="space-y-1 text-sm text-slate-200">
                {t.patterns.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Level perdagangan */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Level kunci</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="stat-label text-bear">Resistance</p>
              <ul className="mt-1.5 space-y-1 text-sm tabular text-slate-200">
                {t.resistances.length ? (
                  t.resistances.map((r, i) => (
                    <li key={i}>
                      R{i + 1} · {fmtIDR(r)}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Tidak terdeteksi (harga di area tertinggi)</li>
                )}
              </ul>
            </div>
            <div>
              <p className="stat-label text-bull">Support</p>
              <ul className="mt-1.5 space-y-1 text-sm tabular text-slate-200">
                {t.supports.length ? (
                  t.supports.map((s, i) => (
                    <li key={i}>
                      S{i + 1} · {fmtIDR(s)}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Tidak terdeteksi (harga di area terendah)</li>
                )}
              </ul>
            </div>
          </div>
          <div className="divider my-4" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="stat-label">Stop loss teknikal</p>
              <p className="mt-0.5 font-semibold tabular text-bear">{fmtIDR(t.levels.stopLoss)}</p>
            </div>
            <div>
              <p className="stat-label">Risk / reward (TP1)</p>
              <p className="mt-0.5 font-semibold tabular text-white">
                {t.levels.riskRewardRatio !== null ? `1 : ${fmtNumber(t.levels.riskRewardRatio, 2)}` : "—"}
              </p>
            </div>
            <div>
              <p className="stat-label">Target 1</p>
              <p className="mt-0.5 font-semibold tabular text-bull">{fmtIDR(t.levels.target1)}</p>
            </div>
            <div>
              <p className="stat-label">Target 2</p>
              <p className="mt-0.5 font-semibold tabular text-bull">{fmtIDR(t.levels.target2)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Nilai indikator</h3>
          <dl className="grid gap-x-5 gap-y-2.5 text-sm min-[420px]:grid-cols-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
                <dt className="text-xs text-slate-400">{r.label}</dt>
                <dd className="tabular font-medium text-slate-100">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Sinyal */}
      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Pembacaan sinyal</h3>
        {/* Ponsel: kartu per sinyal */}
        <ul className="space-y-2 sm:hidden">
          {t.signals.map((s, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">{s.name}</p>
                  <p className="mt-0.5 break-words text-xs tabular text-slate-400">{s.value}</p>
                </div>
                <Badge tone={signalTone(s.signal)}>{s.signal}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{s.note}</p>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Indikator</th>
                <th className="px-4 py-3 font-medium">Nilai</th>
                <th className="px-4 py-3 font-medium">Sinyal</th>
                <th className="px-4 py-3 font-medium">Interpretasi</th>
              </tr>
            </thead>
            <tbody>
              {t.signals.map((s, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-200">{s.name}</td>
                  <td className="px-4 py-3 tabular text-slate-300">{s.value}</td>
                  <td className="px-4 py-3">
                    <Badge tone={signalTone(s.signal)}>{s.signal}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-slate-400">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-bull/20 bg-bull/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bull">Sinyal positif</h3>
          <BulletList items={t.highlights} tone="bull" empty="Tidak ada sinyal teknikal positif yang menonjol." />
        </div>
        <div className="rounded-2xl border border-bear/20 bg-bear/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bear">Sinyal negatif</h3>
          <BulletList items={t.risks} tone="bear" empty="Tidak ada sinyal teknikal negatif yang menonjol." />
        </div>
      </div>
    </Section>
  );
}

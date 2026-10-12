import { fmtCompact, fmtNumber, fmtPctPlain } from "@/lib/format";
import type { FundamentalReport } from "@/lib/types";
import { Badge, BulletList, ScoreRing, Section, scoreColor } from "./ui";

export default function FundamentalPanel({ f }: { f: FundamentalReport }) {
  if (!f.available) {
    return (
      <Section id="fundamental" title="Analisis Fundamental" icon="📊">
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center">
          <p className="text-3xl">📉</p>
          <p className="mt-3 text-sm font-medium text-slate-300">Data laporan keuangan tidak tersedia</p>
          <p className="muted mx-auto mt-1.5 max-w-lg">
            Sumber data gratis kadang tidak menyediakan laporan keuangan lengkap untuk emiten IDX tertentu —
            terutama emiten baru IPO atau berkapitalisasi kecil. Skor fundamental dikeluarkan dari
            perhitungan dewan dan bobot suaranya diturunkan. Rujuk laporan keuangan resmi di situs IDX atau
            emiten.
          </p>
        </div>
      </Section>
    );
  }

  const fin = f.financials;
  const groups: { title: string; keys: string[] }[] = [
    { title: "Valuasi", keys: ["per", "pbv", "evEbitda", "psr"] },
    { title: "Profitabilitas", keys: ["roe", "roa", "npm", "opm", "gpm"] },
    { title: "Pertumbuhan", keys: ["revGrowth", "epsGrowth"] },
    { title: "Kesehatan Neraca", keys: ["der", "currentRatio", "fcf"] },
    { title: "Dividen", keys: ["divYield", "payout"] },
  ];

  return (
    <Section
      id="fundamental"
      title="Analisis Fundamental"
      icon="📊"
      subtitle="Menilai kualitas bisnis dari valuasi, profitabilitas, pertumbuhan, kesehatan neraca, dan kebijakan dividen."
      right={
        <Badge tone={f.score >= 65 ? "bull" : f.score >= 48 ? "warn" : "bear"}>
          Grade {f.grade} · {f.score}/100
        </Badge>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-row items-center gap-4 lg:flex-col">
          <ScoreRing score={f.score} size={116} sublabel="fundamental" />
          <p className="max-w-[180px] text-center text-xs leading-relaxed text-slate-400">
            Dihitung dari {f.metrics.length} metrik dengan bobot berbeda sesuai relevansinya.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "Pendapatan (TTM)", value: fmtCompact(fin.revenue) },
            { label: "Laba bersih", value: fmtCompact(fin.netIncome) },
            { label: "EPS", value: fin.eps !== undefined ? fmtNumber(fin.eps, 2) : "—" },
            { label: "Nilai buku / saham", value: fin.bookValue !== undefined ? fmtNumber(fin.bookValue, 2) : "—" },
            { label: "Kas", value: fmtCompact(fin.totalCash) },
            { label: "Total utang", value: fmtCompact(fin.totalDebt) },
            { label: "Arus kas bebas", value: fmtCompact(fin.freeCashflow) },
            { label: "ROE", value: fin.roe !== undefined ? fmtPctPlain(fin.roe, 2) : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <p className="stat-label">{s.label}</p>
              <p className="stat-value tabular mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {groups.map((g) => {
          const metrics = f.metrics.filter((m) => g.keys.includes(m.key));
          if (!metrics.length) return null;
          return (
            <div key={g.title}>
              <h3 className="mb-3 text-sm font-semibold text-white">{g.title}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {metrics.map((m) => (
                  <div key={m.key} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-slate-200">{m.label}</p>
                      <p className="shrink-0 text-base font-bold tabular text-white">{m.display}</p>
                    </div>
                    {m.score !== null && (
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(2, m.score)}%`, backgroundColor: scoreColor(m.score) }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.verdict}</p>
                    {m.benchmark && (
                      <p className="mt-1 text-[11px] text-slate-600">Patokan: {m.benchmark}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-bull/20 bg-bull/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bull">Kekuatan fundamental</h3>
          <BulletList items={f.highlights} tone="bull" empty="Tidak ada metrik yang menonjol kuat." />
        </div>
        <div className="rounded-2xl border border-bear/20 bg-bear/6 p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-bear">Kelemahan fundamental</h3>
          <BulletList items={f.risks} tone="bear" empty="Tidak ada metrik yang berada di zona bahaya." />
        </div>
      </div>
    </Section>
  );
}

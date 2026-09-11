import { fmtCompact, fmtDate, fmtInt, fmtPctPlain } from "@/lib/format";
import type { Ownership, Profile } from "@/lib/types";
import { Section, Stat } from "./ui";

export default function OwnershipPanel({ o, p }: { o: Ownership; p: Profile }) {
  const hasHolders = o.topHolders.length > 0;
  const hasTransactions = o.insiderTransactions.length > 0;

  return (
    <Section
      id="kepemilikan"
      title="Kepemilikan & Manajemen"
      icon="🏛️"
      subtitle="Siapa yang memiliki dan menjalankan perusahaan ini — pemegang saham besar, kepemilikan institusi, dan jajaran pengurus."
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Kepemilikan insider" value={o.insidersPct !== undefined ? fmtPctPlain(o.insidersPct, 2) : "—"} />
        <Stat
          label="Kepemilikan institusi"
          value={o.institutionsPct !== undefined ? fmtPctPlain(o.institutionsPct, 2) : "—"}
        />
        <Stat label="Lembar saham beredar" value={fmtCompact(o.sharesOutstanding, "")} />
        <Stat label="Saham free float" value={fmtCompact(o.floatShares, "")} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Pemegang saham */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Pemegang saham terbesar</h3>
          {hasHolders ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 font-medium">Nama</th>
                    <th className="pb-2 text-right font-medium">Lembar</th>
                    <th className="pb-2 text-right font-medium">%</th>
                  </tr>
                </thead>
                <tbody>
                  {o.topHolders.map((h, i) => (
                    <tr key={i} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-3 text-slate-200">{h.name}</td>
                      <td className="py-2.5 text-right tabular text-slate-300">
                        {h.shares !== undefined ? fmtCompact(h.shares, "") : "—"}
                      </td>
                      <td className="py-2.5 text-right tabular text-slate-300">
                        {h.pct !== undefined ? fmtPctPlain(h.pct, 2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">
              Rincian pemegang saham tidak tersedia dari sumber data gratis untuk emiten ini.
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{o.note}</p>
        </div>

        {/* Manajemen */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Direksi & Komisaris</h3>
          {p.officers.length ? (
            <ul className="space-y-2.5">
              {p.officers.map((of, i) => (
                <li key={i} className="flex items-start gap-3 border-b border-white/5 pb-2.5 last:border-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brandx/15 text-xs font-bold text-brandx">
                    {of.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100">{of.name}</p>
                    <p className="text-xs text-slate-500">
                      {of.title ?? "—"}
                      {of.age ? ` · ${of.age} tahun` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Data jajaran pengurus tidak tersedia dari sumber saat ini.</p>
          )}
        </div>
      </div>

      {hasTransactions && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-1 text-sm font-semibold text-white">Transaksi orang dalam</h3>
          <p className="muted mb-3">
            Pembelian oleh pihak internal sering menjadi sinyal keyakinan; penjualan besar patut ditelusuri
            alasannya.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 font-medium">Nama</th>
                  <th className="pb-2 font-medium">Hubungan</th>
                  <th className="pb-2 font-medium">Aksi</th>
                  <th className="pb-2 text-right font-medium">Lembar</th>
                  <th className="pb-2 text-right font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {o.insiderTransactions.map((t, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-3 text-slate-200">{t.name}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-400">{t.relation ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-400">{t.action ?? "—"}</td>
                    <td className="py-2.5 text-right tabular text-slate-300">
                      {t.shares !== undefined ? fmtInt(t.shares) : "—"}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {t.date ? fmtDate(Date.parse(t.date)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profil perusahaan */}
      {(p.summary || p.website || p.address) && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Tentang perusahaan</h3>
          {p.summary && <p className="text-sm leading-relaxed text-slate-300">{p.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {p.website && (
              <a
                href={p.website}
                target="_blank"
                rel="noopener noreferrer"
                className="chip hover:bg-white/10"
              >
                🔗 {p.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {p.employees !== undefined && <span className="chip">👥 {fmtInt(p.employees)} karyawan</span>}
            {p.address && <span className="chip">📍 {p.address}</span>}
          </div>
        </div>
      )}
    </Section>
  );
}

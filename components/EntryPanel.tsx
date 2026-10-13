import { fmtDate, fmtNumber } from "@/lib/format";
import type { CandlePattern, EntrySignal, EntryVerdict } from "@/lib/types";
import { ScoreBreakdown } from "./plan-ui";
import { ScoreRing, Section } from "./ui";

const VERDICT_META: Record<EntryVerdict, { cls: string; icon: string; note: string }> = {
  SIAP: {
    cls: "border-bull/40 bg-bull/15 text-bull",
    icon: "✅",
    note: "Struktur MA mendukung, ada konfirmasi pembeli, dan ruang naik cukup.",
  },
  TUNGGU: {
    cls: "border-warn/40 bg-warn/12 text-warn",
    icon: "⏳",
    note: "Ada potensi, tetapi syarat di bawah belum terpenuhi — jangan buru-buru beli.",
  },
  BELUM: {
    cls: "border-white/15 bg-white/5 text-slate-300",
    icon: "➖",
    note: "Belum ada setup beli yang jelas dari struktur harga maupun pola candle.",
  },
  HINDARI: {
    cls: "border-bear/40 bg-bear/12 text-bear",
    icon: "⛔",
    note: "Tekanan jual masih dominan — tunggu tanda pembalikan dulu.",
  },
};

/** Ilustrasi mini pola: [open, high, low, close] dinormalisasi 0–10. */
const GLYPHS: Record<string, [number, number, number, number][]> = {
  hammer: [[7, 7.5, 1, 8]],
  dragonfly: [[8, 8.2, 1, 8]],
  inverted_hammer: [[3, 9, 2.6, 4]],
  shooting_star: [[3, 9.5, 2.5, 2]],
  bullish_engulfing: [
    [6, 6.5, 3.5, 4],
    [3.5, 7.5, 3, 7],
  ],
  bearish_engulfing: [
    [4, 6.5, 3.5, 6],
    [6.5, 7, 2.5, 3],
  ],
  piercing: [
    [8, 8.5, 4, 4.5],
    [3.5, 7, 3, 6.8],
  ],
  dark_cloud: [
    [3, 7, 2.5, 6.5],
    [7.5, 8, 4, 4.3],
  ],
  bullish_harami: [
    [8, 8.5, 2.5, 3],
    [4.5, 6.5, 4, 6],
  ],
  morning_star: [
    [8.5, 9, 4, 4.5],
    [3.5, 4.2, 2.5, 3.2],
    [4.5, 8, 4.2, 7.5],
  ],
  evening_star: [
    [2, 6.5, 1.5, 6],
    [7, 8, 6.5, 7.4],
    [6.5, 6.8, 2, 2.5],
  ],
  three_white_soldiers: [
    [2, 4.5, 1.6, 4.2],
    [3.6, 6.6, 3.4, 6.3],
    [5.6, 8.8, 5.4, 8.5],
  ],
};

function PatternGlyph({ k, bullish }: { k: string; bullish: boolean }) {
  const bars = GLYPHS[k] ?? [[3, 8, 2, 7]];
  const W = 18 * bars.length + 6;
  const y = (v: number) => 46 - v * 4.2;
  return (
    <svg width={W} height={50} viewBox={`0 0 ${W} 50`} aria-hidden className="shrink-0">
      {bars.map(([o, h, l, c], i) => {
        const x = 6 + i * 18;
        const up = c >= o;
        const color = up ? "#16c784" : "#ea3943";
        return (
          <g key={i}>
            <line x1={x + 5} x2={x + 5} y1={y(h)} y2={y(l)} stroke={color} strokeWidth={1.5} />
            <rect x={x} y={y(Math.max(o, c))} width={10} height={Math.max(1.5, Math.abs(y(o) - y(c)))} fill={color} rx={1} />
          </g>
        );
      })}
      <title>{bullish ? "Pola bullish" : "Pola bearish"}</title>
    </svg>
  );
}

function PatternCard({ p }: { p: CandlePattern }) {
  const status =
    p.followThrough === true ? (
      <span className="text-bull">✓ dikonfirmasi candle berikutnya</span>
    ) : p.followThrough === false ? (
      <span className="text-bear">✗ gagal dikonfirmasi</span>
    ) : (
      <span className="text-warn">… menunggu konfirmasi</span>
    );
  return (
    <li className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <PatternGlyph k={p.key} bullish={p.bullish} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className={`text-sm font-semibold ${p.bullish ? "text-bull" : "text-bear"}`}>
            {p.bullish ? "▲" : "▼"} {p.name}
          </p>
          <span className="text-[11px] tabular text-slate-500">
            {p.barsAgo === 0 ? "hari ini" : `${p.barsAgo} hari lalu`} · {fmtDate(p.t)}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{p.meaning}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Lokasi: {p.context}.</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className="text-slate-400">Kekuatan {p.strength}/5</span>
          <span className={p.volumeConfirmed ? "text-bull" : "text-slate-500"}>
            {p.volumeConfirmed ? "✓ volume ≥ 1,2× rata-rata" : "volume biasa"}
          </span>
          {status}
        </div>
      </div>
    </li>
  );
}

const LIBRARY: { key: string; name: string; bullish: boolean; desc: string }[] = [
  { key: "hammer", name: "Hammer", bullish: true, desc: "Ekor bawah ≥ 2× badan setelah turun / di penopang." },
  { key: "dragonfly", name: "Dragonfly Doji", bullish: true, desc: "Buka = tutup di atas, ekor bawah panjang." },
  { key: "inverted_hammer", name: "Inverted Hammer", bullish: true, desc: "Ekor atas panjang setelah turun; butuh konfirmasi." },
  { key: "bullish_engulfing", name: "Bullish Engulfing", bullish: true, desc: "Hijau menelan badan merah sebelumnya." },
  { key: "piercing", name: "Piercing Line", bullish: true, desc: "Buka di bawah low, tutup di atas separuh merah kemarin." },
  { key: "bullish_harami", name: "Bullish Harami", bullish: true, desc: "Hijau kecil di dalam merah besar; momentum turun melambat." },
  { key: "morning_star", name: "Morning Star", bullish: true, desc: "Merah panjang → kecil → hijau kuat." },
  { key: "three_white_soldiers", name: "Three White Soldiers", bullish: true, desc: "Tiga hijau beruntun, tutup makin tinggi." },
  { key: "shooting_star", name: "Shooting Star", bullish: false, desc: "Ekor atas panjang setelah naik." },
  { key: "bearish_engulfing", name: "Bearish Engulfing", bullish: false, desc: "Merah menelan hijau sebelumnya." },
  { key: "dark_cloud", name: "Dark Cloud Cover", bullish: false, desc: "Buka di atas high, tutup di bawah separuh hijau kemarin." },
  { key: "evening_star", name: "Evening Star", bullish: false, desc: "Hijau panjang → kecil → merah kuat." },
];

export default function EntryPanel({ e, price }: { e: EntrySignal; price: number }) {
  const meta = VERDICT_META[e.verdict];
  // Tangga harga: MA + harga sekarang diurutkan dari tertinggi.
  const ladder = [
    ...e.maLevels.map((m) => ({ label: m.label, value: m.value, isPrice: false, dist: ((m.value - price) / price) * 100 })),
    { label: "Harga", value: price, isPrice: true, dist: 0 },
  ].sort((a, b) => b.value - a.value);

  return (
    <Section
      id="timing"
      title="Timing Beli — Kapan Masuk?"
      icon="⏱️"
      subtitle="Saham bagus belum tentu harus dibeli hari ini. Bagian ini membaca posisi harga terhadap MA, pola candlestick pembalikan, dan tanda perlawanan pembeli — lalu menyebutkan syarat konkret yang perlu ditunggu."
      right={
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>
          {meta.icon} {e.label}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <ScoreRing score={e.score} size={84} sublabel="kesiapan" />
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${meta.cls.split(" ").pop()}`}>
                {meta.icon} {e.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{meta.note}</p>
            </div>
          </div>

          <div>
            <p className="stat-label mb-2">Posisi harga terhadap MA</p>
            <p className="mb-3 text-sm leading-relaxed text-slate-300">{e.situation}</p>
            <ul className="overflow-hidden rounded-xl border border-white/8">
              {ladder.map((r) => (
                <li
                  key={r.label}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${
                    r.isPrice ? "bg-brandx/15 font-semibold text-white" : "border-t border-white/5 text-slate-300"
                  }`}
                >
                  <span>{r.isPrice ? "▶ Harga sekarang" : r.label}</span>
                  <span className="tabular">
                    Rp {fmtNumber(r.value, 0)}
                    {!r.isPrice && (
                      <span className={`ml-2 ${r.value > price ? "text-bear" : "text-bull"}`}>
                        {r.value > price ? "penghalang" : "penopang"} ({r.dist >= 0 ? "+" : "−"}
                        {Math.abs(r.dist).toFixed(1).replace(".", ",")}%)
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="stat-label mb-2">Pola candlestick 5 hari terakhir</p>
            {e.patterns.length ? (
              <ul className="space-y-2">
                {e.patterns.map((p, i) => (
                  <PatternCard key={`${p.key}-${i}`} p={p} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-400">
                Belum ada pola pembalikan yang valid di 5 candle terakhir. Pola hanya dihitung bila muncul di lokasi yang
                tepat — setelah penurunan atau saat menguji MA/support.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div
            className={`rounded-2xl border p-4 ${e.verdict === "SIAP" ? "border-bull/25 bg-bull/[0.06]" : "border-warn/25 bg-warn/[0.06]"}`}
          >
            <p className={`stat-label mb-2 ${e.verdict === "SIAP" ? "text-bull" : "text-warn"}`}>
              {e.verdict === "SIAP" ? "Eksekusi" : "Skenario masuk — syarat dulu, baru beli"}
            </p>
            {e.scenarios.length ? (
              <ul className="space-y-3">
                {e.scenarios.map((sc) => (
                  <li key={sc.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-semibold text-white">{sc.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      <span className="font-semibold text-warn">Syarat · </span>
                      {sc.condition}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Zona beli</p>
                        <p className="font-semibold tabular text-white">
                          {fmtNumber(sc.zoneLow, 0)}–{fmtNumber(sc.zoneHigh, 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Stop loss</p>
                        <p className="font-semibold tabular text-bear">{fmtNumber(sc.stop, 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Target</p>
                        <p className="font-semibold tabular text-bull">{fmtNumber(sc.target, 0)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">R/R</p>
                        <p className="font-semibold tabular text-white">
                          {sc.riskReward !== null ? `1:${sc.riskReward.toFixed(2).replace(".", ",")}` : "—"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{sc.basis}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-300">Belum ada skenario masuk yang masuk akal.</p>
            )}
            {e.waitFor.slice(e.scenarios.length).length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {e.waitFor.slice(e.scenarios.length).map((w, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
            {e.trigger && (
              <p className="mt-3 rounded-lg bg-black/20 px-3 py-2 text-xs text-slate-300">
                {e.verdict === "SIAP" ? "Batas validitas" : "Pemicu utama"}: <strong className="text-white">{e.trigger.label}</strong> —{" "}
                <span className="font-semibold tabular text-white">Rp {fmtNumber(e.trigger.price, 0)}</span>
                <span className="text-slate-500"> ({((e.trigger.price - price) / price * 100 >= 0 ? "+" : "−") + Math.abs(((e.trigger.price - price) / price) * 100).toFixed(1).replace(".", ",")}%)</span>
              </p>
            )}
          </div>

          <div>
            <p className="stat-label mb-2">Daftar periksa</p>
            <ul className="divide-y divide-white/5 rounded-xl border border-white/8">
              {e.checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5 px-3 py-2">
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      c.status === "ok" ? "bg-bull/20 text-bull" : c.status === "wait" ? "bg-warn/20 text-warn" : "bg-bear/20 text-bear"
                    }`}
                  >
                    {c.status === "ok" ? "✓" : c.status === "wait" ? "…" : "✗"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-slate-200">{c.label}</span>
                    <span className="block text-[11px] text-slate-500">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="stat-label mb-2">Tanda perlawanan pembeli</p>
            {e.buyerSignals.length ? (
              <ul className="space-y-1.5">
                {e.buyerSignals.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-bull" />
                    {s}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">Belum terlihat — tidak ada ekor bawah panjang, higher low, atau support yang dipertahankan.</p>
            )}
          </div>
        </div>
      </div>

      <details className="group mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="-my-1.5 select-none py-1.5 text-xs font-semibold text-brandx">
          <span className="group-open:hidden">▼ Lihat cara skor kesiapan {e.score} dihitung & kamus pola</span>
          <span className="hidden group-open:inline">▲ Sembunyikan</span>
        </summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <ScoreBreakdown
            items={e.breakdown}
            total={e.score}
            note="Vonis: Siap Beli bila skor ≥ 68, tanpa penghalang < 2%, tanpa penolakan MA, tidak overextended, tanpa pola bearish, DAN pola bullish sudah dikonfirmasi candle berikutnya (atau tanpa pola: di atas MA20 & MA50, ≤ 3% dari MA20, ≥ 2 tanda pembeli). Pola yang belum dikonfirmasi = Tunggu. Hindari bila ada pola bearish kuat atau harga di bawah semua MA dengan MA20 menurun."
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {LIBRARY.map((l) => (
              <li key={l.key} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <PatternGlyph k={l.key} bullish={l.bullish} />
                <span className="min-w-0">
                  <span className={`block text-xs font-semibold ${l.bullish ? "text-bull" : "text-bear"}`}>{l.name}</span>
                  <span className="block text-[11px] leading-snug text-slate-500">{l.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </Section>
  );
}

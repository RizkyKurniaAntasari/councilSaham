"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import type { ScreenerResult, ScreenerRow } from "@/lib/types";
import { PhaseBadge, RecBadge, Sparkline, TimingBadge } from "./cycle-ui";

const LIQ = [
  { label: "≥ Rp1 M/hari", value: 1e9 },
  { label: "≥ Rp5 M/hari", value: 5e9 },
  { label: "≥ Rp20 M/hari", value: 2e10 },
  { label: "Semua", value: 0 },
];

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1).replace(".", ",")}%`;
const rr = (v: number | null) => (v === null ? "—" : `1:${v.toFixed(2).replace(".", ",")}`);

/** Kriteria "Siap Masuk": timing Siap Beli + rekomendasi tidak negatif + R/R ≥ 1,2 + likuid. */
function isReady(r: ScreenerRow, minLiq: number) {
  const sc = r.timing.scenario;
  return (
    r.timing.verdict === "SIAP" &&
    r.rec.action !== "HINDARI" &&
    r.rec.action !== "AMBIL_UNTUNG" &&
    !!sc &&
    (sc.riskReward ?? 0) >= 1.2 &&
    r.avgValue20 >= minLiq
  );
}

/** Jarak pemicu skenario terdekat dari harga sekarang (%). */
const triggerDist = (r: ScreenerRow) => {
  const sc = r.timing.nearScenario;
  return sc?.triggerPrice != null ? Math.abs((sc.triggerPrice - r.price) / r.price) : Infinity;
};

/** "Hampir siap": skenario terdekat tinggal satu pemicu yang jaraknya ≤ 3% dari harga, R/R ≥ 1,5. */
function isAlmost(r: ScreenerRow, minLiq: number) {
  const sc = r.timing.nearScenario;
  return (
    r.timing.verdict === "TUNGGU" &&
    r.rec.action !== "HINDARI" &&
    r.rec.action !== "AMBIL_UNTUNG" &&
    !!sc &&
    (sc.riskReward ?? 0) >= 1.5 &&
    triggerDist(r) <= 0.03 &&
    r.avgValue20 >= minLiq
  );
}

function Level({ label, value, cls = "text-white" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular ${cls}`}>{value}</p>
    </div>
  );
}

function ReadyCard({ r, rank }: { r: ScreenerRow; rank: number }) {
  const sc = r.timing.scenario!;
  const up = r.change1d >= 0;
  const riskPct = ((sc.zoneLow + sc.zoneHigh) / 2 - sc.stop) / ((sc.zoneLow + sc.zoneHigh) / 2) * 100;
  const rewardPct = (sc.target - (sc.zoneLow + sc.zoneHigh) / 2) / ((sc.zoneLow + sc.zoneHigh) / 2) * 100;
  return (
    <li className="card min-w-0 overflow-hidden">
      <div className="flex items-start gap-3 border-b border-white/10 p-4">
        <span className="mt-1 w-5 shrink-0 text-xs tabular text-slate-500">{rank}</span>
        <Link
          href={`/saham/${r.ticker}#timing`}
          className="grid h-10 w-16 shrink-0 place-items-center rounded-xl bg-bull/15 text-sm font-black tracking-wide text-bull hover:bg-bull/25"
        >
          {r.ticker}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{r.name}</p>
          <p className="text-[11px] tabular text-slate-500">
            {r.sector} · Rp {fmtNumber(r.price, 0)}{" "}
            <span className={up ? "text-bull" : "text-bear"}>{pct(r.change1d)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TimingBadge verdict={r.timing.verdict} small />
            <RecBadge action={r.rec.action} small />
            <PhaseBadge phase={r.cycle.phase} small />
          </div>
        </div>
        <div className="hidden shrink-0 sm:block">
          <Sparkline values={r.spark} width={96} height={34} />
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            <Level label="Zona beli" value={`${fmtNumber(sc.zoneLow, 0)}–${fmtNumber(sc.zoneHigh, 0)}`} />
            <Level label="Stop loss" value={`${fmtNumber(sc.stop, 0)} (${pct(-riskPct)})`} cls="text-bear" />
            <Level label="Target" value={`${fmtNumber(sc.target, 0)} (${pct(rewardPct)})`} cls="text-bull" />
            <Level label="Risk / reward" value={rr(sc.riskReward)} />
          </div>
          <div className="rounded-lg border border-white/8 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Ukuran posisi</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {r.rec.position.pct > 0
                ? `±${String(r.rec.position.pct).replace(".", ",")}% portofolio`
                : "Kecil / uji coba — rekomendasi data belum Beli"}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{r.rec.position.basis}</p>
          </div>
          <p className="rounded-lg bg-bear/10 px-3 py-2 text-[11px] leading-snug text-slate-300">
            <span className="font-semibold text-bear">Batal bila · </span>
            {r.timing.trigger
              ? `harga tutup di bawah Rp ${fmtNumber(r.timing.trigger.price, 0)} (low pola/pantulan) — setup gugur, keluar tanpa menunggu stop loss.`
              : `harga tutup di bawah stop loss Rp ${fmtNumber(sc.stop, 0)} — keluar tanpa menunggu.`}
          </p>
        </div>

        <div>
          <p className="stat-label mb-2">
            Kenapa siap masuk ({r.timing.checks.ok}/{r.timing.checks.total} syarat terpenuhi)
          </p>
          <p className="mb-2 rounded-lg bg-bull/10 px-3 py-2 text-xs leading-relaxed text-slate-200">{sc.condition}</p>
          <ul className="space-y-1.5">
            {r.timing.reasons.map((x, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-bull" />
                {x}
              </li>
            ))}
            {r.rec.reasons.slice(0, 2).map((x, i) => (
              <li key={`r${i}`} className="flex gap-2 text-xs leading-relaxed text-slate-400">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brandx" />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{r.timing.situation}</p>
          <Link
            href={`/saham/${r.ticker}#timing`}
            className="-mx-1 mt-1 inline-block rounded px-1 py-1.5 text-xs font-semibold text-brandx hover:underline"
          >
            Lihat analisis lengkap {r.ticker} →
          </Link>
        </div>
      </div>
    </li>
  );
}

function AlmostCard({ r }: { r: ScreenerRow }) {
  const sc = r.timing.nearScenario!;
  const t = { label: sc.triggerLabel ?? "Pemicu", price: sc.triggerPrice! };
  return (
    <li className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-2.5">
        <Link
          href={`/saham/${r.ticker}#timing`}
          className="grid h-8 w-14 shrink-0 place-items-center rounded-lg bg-warn/15 text-xs font-bold text-warn"
        >
          {r.ticker}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-200">{r.name}</p>
          <p className="text-[11px] tabular text-slate-500">
            Rp {fmtNumber(r.price, 0)} · pemicu {t.label.toLowerCase()} Rp {fmtNumber(t.price, 0)} ({pct(((t.price - r.price) / r.price) * 100)})
          </p>
        </div>
        <RecBadge action={r.rec.action} small />
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-300">{sc.title.replace(/^[AB] · /, "")}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-warn/90">⏳ {sc.condition}</p>
      <p className="mt-1 text-[11px] tabular text-slate-400">
        Bila terpenuhi: beli {fmtNumber(sc.zoneLow, 0)}–{fmtNumber(sc.zoneHigh, 0)} · stop {fmtNumber(sc.stop, 0)} · target{" "}
        {fmtNumber(sc.target, 0)} · R/R {rr(sc.riskReward)}
      </p>
    </li>
  );
}

export default function SiapMasuk() {
  const [data, setData] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minLiq, setMinLiq] = useState(1e9);
  const [sector, setSector] = useState("Semua");

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/screener");
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Gagal memindai pasar.");
      else setData(j as ScreenerResult);
    } catch {
      setError("Tidak dapat terhubung ke server data.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const sectors = useMemo(() => ["Semua", ...Array.from(new Set((data?.rows ?? []).map((r) => r.sector))).sort()], [data]);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => sector === "Semua" || r.sector === sector), [data, sector]);
  const ready = useMemo(
    () =>
      rows
        .filter((r) => isReady(r, minLiq))
        .sort((a, b) => b.timing.score - a.timing.score || (b.timing.scenario?.riskReward ?? 0) - (a.timing.scenario?.riskReward ?? 0)),
    [rows, minLiq],
  );
  const almost = useMemo(
    () =>
      rows
        .filter((r) => isAlmost(r, minLiq))
        .sort((a, b) => triggerDist(a) - triggerDist(b))
        .slice(0, 12),
    [rows, minLiq],
  );

  return (
    <div className="space-y-5 py-4">
      <div>
        <span className="chip">✅ Timing entry terkonfirmasi</span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Siap Masuk Hari Ini</h1>
        <p className="muted mt-1 max-w-3xl">
          Hanya saham yang syarat timing-nya <strong className="text-slate-200">sudah terpenuhi</strong> — bukan sekadar
          bagus. Tiap saham disertai alasan, zona beli, stop loss, target, dan batas validitas setup.
        </p>
      </div>

      <details className="card group p-4">
        <summary className="-my-1.5 select-none py-1.5 text-xs font-semibold text-brandx">
          <span className="group-open:hidden">▼ Kriteria "Siap Masuk"</span>
          <span className="hidden group-open:inline">▲ Sembunyikan kriteria</span>
        </summary>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-400">
          <li>
            1. Vonis timing <strong className="text-bull">Siap Beli</strong>: pola pembalikan bullish (Hammer, Bullish
            Engulfing, Morning Star, dll.) <em>sudah dikonfirmasi</em> candle berikutnya, atau pantulan dari MA/support
            sudah dikonfirmasi, atau harga di atas MA20 & MA50 dan ≤ 3% dari MA20 dengan ≥ 2 tanda perlawanan pembeli.
          </li>
          <li>2. Tidak ada penghalang (MA/resistance) &lt; 2% di atas harga, tidak overextended (≤ 8% dari MA20, RSI ≤ 72), dan tidak ada pola bearish aktif.</li>
          <li>3. Rekomendasi data bukan "Ambil Untung" atau "Hindari".</li>
          <li>4. Risk/reward skenario ≥ 1:1,2, dan nilai transaksi rata-rata memenuhi filter likuiditas.</li>
          <li>
            <strong className="text-warn">Hampir siap</strong>: masih menunggu satu pemicu yang jaraknya ≤ 3% dari harga,
            dengan R/R skenario ≥ 1:1,5.
          </li>
        </ul>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={minLiq}
          onChange={(e) => setMinLiq(Number(e.target.value))}
          className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200"
        >
          {LIQ.map((o) => (
            <option key={o.value} value={o.value}>
              Likuiditas {o.label}
            </option>
          ))}
        </select>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-2 text-xs text-slate-200"
        >
          {sectors.map((s) => (
            <option key={s}>{s === "Semua" ? "Semua sektor" : s}</option>
          ))}
        </select>
        {data && (
          <span className="ml-auto text-[11px] text-slate-500">
            {data.scanned} emiten dipindai · {fmtDateTime(data.generatedAt)}{" "}
            <button onClick={() => void load()} className="rounded px-1.5 py-1 text-brandx hover:underline">
              ↻ Muat ulang
            </button>
          </span>
        )}
      </div>

      {error && (
        <div className="card card-pad text-center">
          <p className="text-sm text-slate-300">{error}</p>
          <button onClick={() => void load()} className="btn-primary mt-4">
            Coba lagi
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card h-48 skeleton" />
          ))}
          <p className="text-center text-sm text-slate-500">Memindai timing seluruh emiten… bisa 10–30 detik.</p>
        </div>
      )}

      {data && (
        <>
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              ✅ Siap masuk <span className="rounded-full bg-bull/15 px-2 py-0.5 text-xs font-bold text-bull">{ready.length}</span>
            </h2>
            {ready.length ? (
              <ul className="space-y-4">
                {ready.map((r, i) => (
                  <ReadyCard key={r.ticker} r={r} rank={i + 1} />
                ))}
              </ul>
            ) : (
              <p className="card p-5 text-sm leading-relaxed text-slate-400">
                Tidak ada saham yang memenuhi seluruh syarat hari ini. Ini sinyal untuk bersabar — memaksakan entry
                tanpa konfirmasi adalah sumber kerugian terbesar. Pantau daftar "Hampir siap" di bawah.
              </p>
            )}
          </section>

          <section>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
              ⏳ Hampir siap <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-bold text-warn">{almost.length}</span>
            </h2>
            <p className="muted mb-3">Belum boleh dibeli — tunggu pemicunya terjadi dulu, lalu cek ulang di halaman saham.</p>
            {almost.length ? (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {almost.map((r) => (
                  <AlmostCard key={r.ticker} r={r} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada.</p>
            )}
          </section>

          <p className="text-[11px] leading-relaxed text-slate-500">
            Daftar ini dihasilkan aturan otomatis dari data harga & volume yang bisa tertunda — bukan nasihat investasi.
            Selalu baca analisis lengkap tiap emiten (fundamental, berita, kondisi IHSG) dan patuhi stop loss.
          </p>
        </>
      )}
    </div>
  );
}

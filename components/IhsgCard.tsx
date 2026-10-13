"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IhsgReport } from "@/lib/types";
import { PhaseBadge, Sparkline } from "./cycle-ui";

function Ret({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular ${v === null ? "text-slate-500" : v >= 0 ? "text-bull" : "text-bear"}`}>
        {v === null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}%`}
      </p>
    </div>
  );
}

/** Kartu ringkas IHSG: harga, return, tren, dan fase siklus. Klik → halaman /ihsg. */
export default function IhsgCard() {
  const [d, setD] = useState<IhsgReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/ihsg")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: IhsgReport) => setD(j))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!d) return <div className="card h-[132px] skeleton" />;

  const up = d.changePct >= 0;
  const trendTone =
    d.trend === "UPTREND" ? "border-bull/30 bg-bull/10 text-bull" : d.trend === "DOWNTREND" ? "border-bear/30 bg-bear/10 text-bear" : "border-warn/30 bg-warn/10 text-warn";

  return (
    <Link href="/ihsg" className="card group block p-4 transition hover:border-brandx/40 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Indeks Harga Saham Gabungan</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold tabular text-white">
              {d.price.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-sm font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
              {up ? "▲ +" : "▼ −"}
              {Math.abs(d.change).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ({up ? "+" : "−"}
              {Math.abs(d.changePct).toFixed(2).replace(".", ",")}%)
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${trendTone}`}>
              {d.trend} · skor {d.techScore}
            </span>
            {d.cycle.available && <PhaseBadge phase={d.cycle.phase} small />}
          </div>
        </div>
        <div className="shrink-0">
          <Sparkline values={d.spark} width={120} height={40} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <Ret label="5 hari" v={d.returns.d5} />
        <Ret label="20 hari" v={d.returns.d20} />
        <Ret label="YTD" v={d.returns.ytd} />
        <Ret label="1 tahun" v={d.returns.y1} />
      </div>
      <p className="mt-3 text-xs font-semibold text-brandx group-hover:underline">Lihat analisis IHSG →</p>
    </Link>
  );
}

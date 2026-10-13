"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { IhsgReport } from "@/lib/types";

/** Nilai IHSG ringkas untuk header — diperbarui tiap 3 menit. */
export default function IhsgTicker() {
  const [d, setD] = useState<Pick<IhsgReport, "price" | "changePct"> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ihsg");
        if (!res.ok) return;
        const j = (await res.json()) as IhsgReport;
        if (alive) setD({ price: j.price, changePct: j.changePct });
      } catch {
        /* biarkan kosong */
      }
    };
    void load();
    const id = setInterval(load, 3 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const up = (d?.changePct ?? 0) >= 0;
  return (
    <Link
      href="/ihsg"
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs transition hover:bg-white/10"
      title="Indeks Harga Saham Gabungan"
    >
      <span className="font-semibold text-slate-300">IHSG</span>
      {d ? (
        <>
          <span className="font-semibold tabular text-white">
            {d.price.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
          </span>
          <span className={`font-semibold tabular ${up ? "text-bull" : "text-bear"}`}>
            {up ? "▲" : "▼"}
            {Math.abs(d.changePct).toFixed(2).replace(".", ",")}%
          </span>
        </>
      ) : (
        <span className="h-3 w-16 animate-pulse rounded bg-white/10" />
      )}
    </Link>
  );
}

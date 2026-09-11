"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

interface Hit {
  ticker: string;
  name: string;
  sector?: string;
  source: "lokal" | "bursa";
}

export default function SearchBar({
  size = "lg",
  autoFocus = false,
  initial = "",
}: {
  size?: "lg" | "sm";
  autoFocus?: boolean;
  initial?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { results?: Hit[] };
        setHits(json.results ?? []);
        setActive(0);
      } catch {
        /* dibatalkan */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (ticker: string) => {
    setOpen(false);
    router.push(`/saham/${ticker.toUpperCase()}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && hits[active]) go(hits[active].ticker);
      else if (q.trim()) go(q.trim());
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const inputClass = useMemo(
    () =>
      size === "lg"
        ? "h-14 pl-12 pr-28 text-base sm:text-lg"
        : "h-11 pl-10 pr-20 text-sm",
    [size],
  );

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <svg
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 ${
            size === "lg" ? "h-5 w-5" : "h-4 w-4"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Cari kode saham atau nama emiten… (mis. ADMR)"
          aria-label="Cari saham"
          className={`w-full rounded-2xl border border-white/10 bg-ink-900/80 font-medium text-white placeholder:text-slate-500 outline-none transition focus:border-brandx/60 focus:ring-2 focus:ring-brandx/30 ${inputClass}`}
        />
        <button
          onClick={() => q.trim() && go(q.trim())}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-brandx font-semibold text-white transition hover:bg-brandx/85 ${
            size === "lg" ? "px-5 py-2.5 text-sm" : "px-3.5 py-1.5 text-xs"
          }`}
        >
          Analisis
        </button>
      </div>

      {open && (hits.length > 0 || loading) && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-2xl shadow-black/60">
          {!q && (
            <p className="border-b border-white/5 px-4 py-2 text-[11px] uppercase tracking-wider text-slate-500">
              Sering dicari
            </p>
          )}
          <ul className="max-h-80 overflow-y-auto py-1">
            {hits.map((h, i) => (
              <li key={`${h.ticker}-${i}`}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h.ticker)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                    i === active ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="grid h-9 w-14 shrink-0 place-items-center rounded-lg bg-brandx/15 text-sm font-bold tracking-wide text-brandx">
                    {h.ticker}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">{h.name}</span>
                    <span className="block text-xs text-slate-500">
                      {h.sector ?? (h.source === "bursa" ? "Dari data bursa" : "IDX")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

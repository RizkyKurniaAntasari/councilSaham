"use client";

import { useMemo, useRef, useState } from "react";
import { sma } from "@/lib/indicators";
import { fmtCompact, fmtDate, fmtInt } from "@/lib/format";
import type { Candle } from "@/lib/types";

const RANGES = [
  { key: "1M", days: 22 },
  { key: "3M", days: 66 },
  { key: "6M", days: 130 },
  { key: "1T", days: 250 },
  { key: "2T", days: 9999 },
] as const;

const W = 1000;
const H = 430;
const PAD_L = 8;
const PAD_R = 76;
const TOP = 14;
const PRICE_H = 292;
const VOL_TOP = 330;
const VOL_H = 78;

export default function PriceChart({
  candles,
  supports = [],
  resistances = [],
  currency = "IDR",
}: {
  candles: Candle[];
  supports?: number[];
  resistances?: number[];
  currency?: string;
}) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("6M");
  const [mode, setMode] = useState<"candle" | "area">("candle");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 130;
    const data = candles.slice(-days);
    const closesAll = candles.map((c) => c.c);
    const ma20All = sma(closesAll, 20);
    const ma50All = sma(closesAll, 50);
    const offset = candles.length - data.length;

    const highs = data.map((c) => c.h);
    const lows = data.map((c) => c.l);
    const extraLevels = [...supports, ...resistances].filter(
      (v) => v >= Math.min(...lows) * 0.85 && v <= Math.max(...highs) * 1.15,
    );
    let min = Math.min(...lows, ...extraLevels);
    let max = Math.max(...highs, ...extraLevels);
    const span = max - min || max * 0.1 || 1;
    min -= span * 0.08;
    max += span * 0.08;

    const maxVol = Math.max(...data.map((c) => c.v), 1);
    const innerW = W - PAD_L - PAD_R;
    const step = innerW / Math.max(data.length, 1);

    const x = (i: number) => PAD_L + i * step + step / 2;
    const y = (v: number) => TOP + PRICE_H - ((v - min) / (max - min)) * PRICE_H;
    const vy = (v: number) => VOL_TOP + VOL_H - (v / maxVol) * VOL_H;

    const linePath = (values: (number | null)[]) => {
      let d = "";
      let started = false;
      for (let i = 0; i < data.length; i++) {
        const v = values[offset + i];
        if (v === null || v === undefined) {
          started = false;
          continue;
        }
        d += `${started ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
        started = true;
      }
      return d.trim();
    };

    const closePath = linePath(data.map((c) => c.c));
    const areaPath =
      data.length > 1
        ? `${closePath} L${x(data.length - 1).toFixed(2)},${(TOP + PRICE_H).toFixed(2)} L${x(0).toFixed(2)},${(
            TOP + PRICE_H
          ).toFixed(2)} Z`
        : "";

    const gridValues: number[] = [];
    for (let i = 0; i <= 4; i++) gridValues.push(min + ((max - min) / 4) * i);

    const tickIdx: number[] = [];
    const tickCount = Math.min(6, data.length);
    for (let i = 0; i < tickCount; i++) {
      tickIdx.push(Math.round((i * (data.length - 1)) / Math.max(tickCount - 1, 1)));
    }

    return {
      data,
      offset,
      ma20All,
      ma50All,
      min,
      max,
      maxVol,
      step,
      x,
      y,
      vy,
      linePath,
      closePath,
      areaPath,
      gridValues,
      tickIdx,
    };
  }, [candles, rangeKey, supports, resistances]);

  const { data } = view;
  const first = data[0];
  const lastCandle = data[data.length - 1];
  const periodChange = first && lastCandle ? ((lastCandle.c - first.c) / first.c) * 100 : 0;
  const up = periodChange >= 0;
  const hovered = hover !== null ? data[hover] : null;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !data.length) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round((rel - PAD_L - view.step / 2) / view.step);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  const fmtAxis = (v: number) =>
    v >= 10000 ? fmtInt(Math.round(v)) : v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

  return (
    <div className="card card-pad">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Grafik Harga</h2>
          <p className="muted mt-0.5">
            Periode {rangeKey}:{" "}
            <span className={up ? "text-bull" : "text-bear"}>
              {up ? "+" : ""}
              {periodChange.toFixed(2)}%
            </span>{" "}
            · MA20 <span className="text-amber-400">—</span> · MA50 <span className="text-sky-400">—</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rangeKey === r.key ? "bg-brandx text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(["candle", "area"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  mode === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "candle" ? "Candle" : "Area"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-[330px] w-full min-w-[560px] sm:h-[430px]"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="Grafik harga saham"
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? "#16c784" : "#ea3943"} stopOpacity="0.35" />
              <stop offset="100%" stopColor={up ? "#16c784" : "#ea3943"} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid harga */}
          {view.gridValues.map((v, i) => (
            <g key={`g-${i}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={view.y(v)}
                y2={view.y(v)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <text
                x={W - PAD_R + 8}
                y={view.y(v) + 4}
                fill="#64748b"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {fmtAxis(v)}
              </text>
            </g>
          ))}

          {/* level support & resistance */}
          {resistances.slice(0, 2).map((r, i) =>
            r > view.min && r < view.max ? (
              <g key={`r-${i}`}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={view.y(r)}
                  y2={view.y(r)}
                  stroke="#ea3943"
                  strokeOpacity="0.45"
                  strokeDasharray="6 5"
                  strokeWidth="1"
                />
                <text x={PAD_L + 4} y={view.y(r) - 5} fill="#ea3943" fontSize="10" opacity="0.85">
                  R{i + 1} {fmtAxis(r)}
                </text>
              </g>
            ) : null,
          )}
          {supports.slice(0, 2).map((s, i) =>
            s > view.min && s < view.max ? (
              <g key={`s-${i}`}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={view.y(s)}
                  y2={view.y(s)}
                  stroke="#16c784"
                  strokeOpacity="0.45"
                  strokeDasharray="6 5"
                  strokeWidth="1"
                />
                <text x={PAD_L + 4} y={view.y(s) + 13} fill="#16c784" fontSize="10" opacity="0.85">
                  S{i + 1} {fmtAxis(s)}
                </text>
              </g>
            ) : null,
          )}

          {/* volume */}
          {data.map((c, i) => {
            const prev = data[i - 1];
            const green = prev ? c.c >= prev.c : c.c >= c.o;
            const h = VOL_TOP + VOL_H - view.vy(c.v);
            return (
              <rect
                key={`v-${i}`}
                x={view.x(i) - Math.max(view.step * 0.32, 0.6)}
                y={view.vy(c.v)}
                width={Math.max(view.step * 0.64, 1.2)}
                height={Math.max(h, 0.6)}
                fill={green ? "#16c784" : "#ea3943"}
                opacity={hover === i ? 0.85 : 0.4}
              />
            );
          })}
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={VOL_TOP + VOL_H}
            y2={VOL_TOP + VOL_H}
            stroke="rgba(255,255,255,0.1)"
          />
          <text x={W - PAD_R + 8} y={VOL_TOP + 12} fill="#64748b" fontSize="10">
            Volume
          </text>

          {/* harga */}
          {mode === "area" ? (
            <>
              <path d={view.areaPath} fill="url(#areaFill)" />
              <path
                d={view.closePath}
                fill="none"
                stroke={up ? "#16c784" : "#ea3943"}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </>
          ) : (
            data.map((c, i) => {
              const green = c.c >= c.o;
              const color = green ? "#16c784" : "#ea3943";
              const bodyTop = view.y(Math.max(c.o, c.c));
              const bodyH = Math.max(Math.abs(view.y(c.o) - view.y(c.c)), 1);
              const bw = Math.max(view.step * 0.62, 1);
              return (
                <g key={`c-${i}`} opacity={hover === null || hover === i ? 1 : 0.78}>
                  <line
                    x1={view.x(i)}
                    x2={view.x(i)}
                    y1={view.y(c.h)}
                    y2={view.y(c.l)}
                    stroke={color}
                    strokeWidth={Math.min(1.4, Math.max(view.step * 0.12, 0.7))}
                  />
                  <rect x={view.x(i) - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} />
                </g>
              );
            })
          )}

          {/* moving average */}
          <path d={view.linePath(view.ma20All)} fill="none" stroke="#fbbf24" strokeWidth="1.6" opacity="0.9" />
          <path d={view.linePath(view.ma50All)} fill="none" stroke="#38bdf8" strokeWidth="1.6" opacity="0.9" />

          {/* sumbu waktu */}
          {view.tickIdx.map((idx) => (
            <text
              key={`t-${idx}`}
              x={view.x(idx)}
              y={H - 6}
              fill="#64748b"
              fontSize="10"
              textAnchor="middle"
            >
              {data[idx] ? fmtDate(data[idx].t) : ""}
            </text>
          ))}

          {/* crosshair */}
          {hovered && hover !== null && (
            <g>
              <line
                x1={view.x(hover)}
                x2={view.x(hover)}
                y1={TOP}
                y2={VOL_TOP + VOL_H}
                stroke="rgba(255,255,255,0.35)"
                strokeDasharray="4 4"
              />
              <circle cx={view.x(hover)} cy={view.y(hovered.c)} r="3.5" fill="#fff" />
            </g>
          )}
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-white/10 bg-ink-950/92 px-3 py-2 text-xs shadow-xl backdrop-blur">
            <p className="mb-1 font-semibold text-white">{fmtDate(hovered.t)}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular text-slate-300">
              <span className="text-slate-500">Buka</span>
              <span className="text-right">{fmtAxis(hovered.o)}</span>
              <span className="text-slate-500">Tertinggi</span>
              <span className="text-right">{fmtAxis(hovered.h)}</span>
              <span className="text-slate-500">Terendah</span>
              <span className="text-right">{fmtAxis(hovered.l)}</span>
              <span className="text-slate-500">Tutup</span>
              <span className={`text-right font-semibold ${hovered.c >= hovered.o ? "text-bull" : "text-bear"}`}>
                {fmtAxis(hovered.c)}
              </span>
              <span className="text-slate-500">Volume</span>
              <span className="text-right">{fmtCompact(hovered.v, "")}</span>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Harga dalam {currency}. Garis putus-putus hijau = support, merah = resistance (hasil deteksi swing
        pivot otomatis). Arahkan kursor ke grafik untuk detail harian.
      </p>
    </div>
  );
}

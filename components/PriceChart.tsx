"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sma } from "@/lib/indicators";
import { fmtCompact, fmtInt } from "@/lib/format";
import type { Candle, CandlePattern } from "@/lib/types";

const RANGES = [
  { key: "1B", label: "1B", days: 22 },
  { key: "3B", label: "3B", days: 66 },
  { key: "6B", label: "6B", days: 130 },
  { key: "1T", label: "1T", days: 250 },
  { key: "2T", label: "2T", days: 9999 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const BULL = "#16c784";
const BEAR = "#ea3943";
const MA20_COLOR = "#fbbf24";
const MA50_COLOR = "#38bdf8";

const PAD_L = 4;
const PAD_R = 68; // ruang label sumbu harga
const TOP = 10;
const AXIS_H = 24; // ruang label tanggal
const GAP = 10; // jarak panel harga ↔ volume

/** Kelipatan "bulat" untuk garis grid harga. */
function niceTicks(min: number, max: number, target: number): number[] {
  const raw = (max - min) / Math.max(target, 1);
  if (!(raw > 0)) return [min];
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v);
  return out;
}

function fmtPrice(v: number): string {
  return v >= 1000 ? fmtInt(Math.round(v)) : v.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/** Lebar kotak label S/R mengikuti panjang teksnya (font 10px). */
function levelLabelW(text: string): number {
  return 8 + text.length * 6;
}

function fmtTick(ts: number, long: boolean): string {
  return new Date(ts).toLocaleDateString(
    "id-ID",
    long ? { month: "short", year: "2-digit" } : { day: "numeric", month: "short" },
  );
}

function fmtFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function Toggle({
  on,
  onClick,
  color,
  children,
}: {
  on: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
        on ? "border-white/15 bg-white/10 text-white" : "border-white/5 bg-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      {color && <span className="h-0.5 w-3 rounded" style={{ backgroundColor: on ? color : "#475569" }} />}
      {children}
    </button>
  );
}

export default function PriceChart({
  candles,
  supports = [],
  resistances = [],
  currency = "IDR",
  patterns = [],
}: {
  candles: Candle[];
  supports?: number[];
  resistances?: number[];
  currency?: string;
  /** Pola candlestick untuk ditandai di grafik (▲ bullish di bawah candle, ▼ bearish di atas). */
  patterns?: CandlePattern[];
}) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("6B");
  const [mode, setMode] = useState<"candle" | "area">("candle");
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [showPatterns, setShowPatterns] = useState(true);
  const patternsByT = useMemo(() => {
    const map = new Map<number, CandlePattern[]>();
    for (const p of patterns) map.set(p.t, [...(map.get(p.t) ?? []), p]);
    return map;
  }, [patterns]);
  const [hover, setHover] = useState<{ i: number; y: number } | null>(null);

  // Grafik digambar dalam piksel asli kontainer — tanpa skala viewBox,
  // sehingga posisi kursor selalu tepat di candle yang ditunjuk.
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    const w = Math.floor(el.getBoundingClientRect().width);
    setWidth(w);
    // Di layar sempit 6 bulan terlalu padat — mulai dari 3 bulan.
    if (w < 640) setRangeKey("3B");
    return () => ro.disconnect();
  }, []);

  const H = width < 640 ? 340 : 440;
  const VOL_H = Math.round(H * 0.16);
  const PRICE_H = H - TOP - AXIS_H - GAP - VOL_H;
  const VOL_TOP = TOP + PRICE_H + GAP;

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 130;
    const data = candles.slice(-days);
    const offset = candles.length - data.length;
    const closesAll = candles.map((c) => c.c);
    const ma20 = sma(closesAll, 20).slice(offset);
    const ma50 = sma(closesAll, 50).slice(offset);

    const lows = data.map((c) => c.l);
    const highs = data.map((c) => c.h);
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    const levels = showLevels
      ? [...supports.slice(0, 2), ...resistances.slice(0, 2)].filter((v) => v >= lo * 0.9 && v <= hi * 1.1)
      : [];
    let min = Math.min(lo, ...levels);
    let max = Math.max(hi, ...levels);
    const span = max - min || max * 0.1 || 1;
    min -= span * 0.06;
    max += span * 0.06;

    const innerW = Math.max(width - PAD_L - PAD_R, 1);
    const step = innerW / Math.max(data.length, 1);
    const maxVol = Math.max(...data.map((c) => c.v), 1);

    const x = (i: number) => PAD_L + i * step + step / 2;
    const y = (v: number) => TOP + PRICE_H - ((v - min) / (max - min)) * PRICE_H;
    const priceAt = (py: number) => min + ((TOP + PRICE_H - py) / PRICE_H) * (max - min);
    const vy = (v: number) => VOL_TOP + VOL_H - (v / maxVol) * VOL_H;

    const linePath = (values: (number | null)[]) => {
      let d = "";
      let started = false;
      values.forEach((v, i) => {
        if (v === null || v === undefined) {
          started = false;
          return;
        }
        d += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        started = true;
      });
      return d;
    };
    const closePath = linePath(data.map((c) => c.c));
    const areaPath =
      data.length > 1 ? `${closePath}L${x(data.length - 1).toFixed(1)},${TOP + PRICE_H}L${x(0).toFixed(1)},${TOP + PRICE_H}Z` : "";

    const gridValues = niceTicks(min, max, PRICE_H > 260 ? 6 : 5);
    const tickCount = Math.max(2, Math.min(8, Math.floor(innerW / 95)));
    const tickIdx = Array.from({ length: tickCount }, (_, k) =>
      Math.round(((k + 0.5) * (data.length - 1)) / tickCount),
    );

    return { data, ma20, ma50, min, max, step, x, y, vy, priceAt, linePath, closePath, areaPath, gridValues, tickIdx };
  }, [candles, rangeKey, supports, resistances, showLevels, width, PRICE_H, VOL_TOP, VOL_H]);

  const { data } = view;
  const first = data[0];
  const lastIdx = data.length - 1;
  const lastCandle = data[lastIdx];
  const periodChange = first && lastCandle ? ((lastCandle.c - first.c) / first.c) * 100 : 0;
  const up = periodChange >= 0;
  const longRange = rangeKey === "1T" || rangeKey === "2T";

  // Legenda menampilkan candle yang ditunjuk, atau candle terakhir bila kursor di luar grafik.
  const activeIdx = hover?.i ?? lastIdx;
  const active = data[activeIdx];
  const prevClose = activeIdx > 0 ? data[activeIdx - 1].c : active?.o;
  const activeChange = active && prevClose ? ((active.c - prevClose) / prevClose) * 100 : 0;

  const updateHover = (clientX: number, clientY: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    if (!data.length || px < PAD_L || px > width - PAD_R) {
      setHover(null);
      return;
    }
    const i = Math.floor((px - PAD_L) / view.step);
    setHover({ i: Math.max(0, Math.min(lastIdx, i)), y: py });
  };

  const tag = (yPos: number, text: string, fill: string, textFill = "#fff") => {
    const yy = Math.max(TOP + 9, Math.min(TOP + PRICE_H - 9, yPos));
    return (
      <g>
        <rect x={width - PAD_R + 2} y={yy - 9} width={PAD_R - 4} height={18} rx={4} fill={fill} />
        <text
          x={width - PAD_R / 2}
          y={yy + 4}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={textFill}
          fontFamily="ui-monospace, monospace"
        >
          {text}
        </text>
      </g>
    );
  };

  // Label sumbu kanan: harga terakhir + nilai MA (mengikuti candle yang ditunjuk).
  // Disusun ulang agar tidak saling menimpa.
  const ma20Val = view.ma20[activeIdx] ?? null;
  const ma50Val = view.ma50[activeIdx] ?? null;
  const axisTags = (() => {
    const list: { y: number; text: string; fill: string; textFill: string }[] = [];
    if (lastCandle) {
      const lc = data.length > 1 && lastCandle.c >= data[lastIdx - 1].c ? BULL : BEAR;
      list.push({ y: view.y(lastCandle.c), text: fmtPrice(lastCandle.c), fill: lc, textFill: "#fff" });
    }
    if (showMa20 && ma20Val !== null) list.push({ y: view.y(ma20Val), text: fmtPrice(ma20Val), fill: MA20_COLOR, textFill: "#0b1020" });
    if (showMa50 && ma50Val !== null) list.push({ y: view.y(ma50Val), text: fmtPrice(ma50Val), fill: MA50_COLOR, textFill: "#0b1020" });
    const minGap = 19;
    const lo = TOP + 9;
    const hi = TOP + PRICE_H - 9;
    list.sort((a, b) => a.y - b.y);
    for (let i = 0; i < list.length; i++) {
      list[i].y = Math.max(lo, Math.min(hi, list[i].y));
      if (i > 0 && list[i].y - list[i - 1].y < minGap) list[i].y = list[i - 1].y + minGap;
    }
    // Bila mentok di bawah, geser seluruh tumpukan ke atas.
    const overflow = list.length ? list[list.length - 1].y - hi : 0;
    if (overflow > 0) list.forEach((t) => (t.y -= overflow));
    return list;
  })();

  const hy = hover ? hover.y : null;
  const inPrice = hy !== null && hy >= TOP && hy <= TOP + PRICE_H;
  const lastColor = lastCandle && data.length > 1 && lastCandle.c >= data[lastIdx - 1].c ? BULL : BEAR;

  return (
    <div className="card card-pad">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Grafik Harga</h2>
          <p className="muted mt-0.5">
            Perubahan {RANGES.find((r) => r.key === rangeKey)?.label}:{" "}
            <span className={`font-semibold ${up ? "text-bull" : "text-bear"}`}>
              {up ? "+" : ""}
              {periodChange.toFixed(2).replace(".", ",")}%
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Rentang waktu">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeKey(r.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  rangeKey === r.key ? "bg-brandx text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Jenis grafik">
            {(["candle", "area"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  mode === m ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {m === "candle" ? "Candle" : "Garis"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda OHLC — selalu terlihat, tidak menutupi candle */}
      {active && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs tabular">
          <span className="font-semibold text-white">
            {fmtFullDate(active.t)}
            {!hover && <span className="ml-1.5 font-normal text-slate-500">(terakhir)</span>}
          </span>
          <span className="text-slate-500">
            B <span className="text-slate-200">{fmtPrice(active.o)}</span>
          </span>
          <span className="text-slate-500">
            T <span className="text-slate-200">{fmtPrice(active.h)}</span>
          </span>
          <span className="text-slate-500">
            R <span className="text-slate-200">{fmtPrice(active.l)}</span>
          </span>
          <span className="text-slate-500">
            Tutup <span className="font-semibold text-white">{fmtPrice(active.c)}</span>
          </span>
          <span className={`font-semibold ${activeChange >= 0 ? "text-bull" : "text-bear"}`}>
            {activeChange >= 0 ? "▲ +" : "▼ "}
            {activeChange.toFixed(2).replace(".", ",")}%
          </span>
          <span className="text-slate-500">
            Vol <span className="text-slate-200">{active.v > 0 ? fmtCompact(active.v, "") : "—"}</span>
          </span>
          {showPatterns &&
            (patternsByT.get(active.t) ?? []).map((p) => (
              <span key={p.key} className={`font-semibold ${p.bullish ? "text-bull" : "text-bear"}`}>
                {p.bullish ? "▲" : "▼"} {p.name}
              </span>
            ))}
          {showMa20 && (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MA20_COLOR }} />
              MA20{" "}
              <span className="font-semibold" style={{ color: MA20_COLOR }}>
                {ma20Val !== null ? fmtPrice(ma20Val) : "—"}
              </span>
            </span>
          )}
          {showMa50 && (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MA50_COLOR }} />
              MA50{" "}
              <span className="font-semibold" style={{ color: MA50_COLOR }}>
                {ma50Val !== null ? fmtPrice(ma50Val) : "—"}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Toggle overlay */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Toggle on={showMa20} onClick={() => setShowMa20((v) => !v)} color={MA20_COLOR}>
          MA20{ma20Val !== null && <span className="tabular" style={{ color: showMa20 ? MA20_COLOR : undefined }}>{fmtPrice(ma20Val)}</span>}
        </Toggle>
        <Toggle on={showMa50} onClick={() => setShowMa50((v) => !v)} color={MA50_COLOR}>
          MA50{ma50Val !== null && <span className="tabular" style={{ color: showMa50 ? MA50_COLOR : undefined }}>{fmtPrice(ma50Val)}</span>}
        </Toggle>
        <Toggle on={showLevels} onClick={() => setShowLevels((v) => !v)}>
          <span className="text-bull">S</span>/<span className="text-bear">R</span> Support &amp; Resistance
        </Toggle>
        {patterns.length > 0 && (
          <Toggle on={showPatterns} onClick={() => setShowPatterns((v) => !v)}>
            <span className="text-bull">▲</span>
            <span className="text-bear">▼</span> Pola candle
          </Toggle>
        )}
      </div>

      <div ref={boxRef} className="relative w-full select-none" style={{ height: H }}>
        {width > 0 && data.length > 0 && (
          <svg
            width={width}
            height={H}
            className="block cursor-crosshair touch-pan-y"
            onPointerMove={(e) => updateHover(e.clientX, e.clientY, e.currentTarget)}
            onPointerDown={(e) => updateHover(e.clientX, e.clientY, e.currentTarget)}
            onPointerLeave={() => setHover(null)}
            role="img"
            aria-label="Grafik harga saham"
          >
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? BULL : BEAR} stopOpacity="0.3" />
                <stop offset="100%" stopColor={up ? BULL : BEAR} stopOpacity="0" />
              </linearGradient>
              <clipPath id="priceClip">
                <rect x={PAD_L} y={TOP} width={width - PAD_L - PAD_R} height={PRICE_H} />
              </clipPath>
            </defs>

            {/* Grid harga */}
            {view.gridValues.map((v) => (
              <g key={`g-${v}`}>
                <line x1={PAD_L} x2={width - PAD_R} y1={view.y(v)} y2={view.y(v)} stroke="rgba(255,255,255,0.06)" />
                <text
                  x={width - PAD_R + 8}
                  y={view.y(v) + 4}
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                >
                  {fmtPrice(v)}
                </text>
              </g>
            ))}

            {/* Grid waktu */}
            {view.tickIdx.map((idx) => (
              <g key={`t-${idx}`}>
                <line
                  x1={view.x(idx)}
                  x2={view.x(idx)}
                  y1={TOP}
                  y2={VOL_TOP + VOL_H}
                  stroke="rgba(255,255,255,0.04)"
                />
                <text x={view.x(idx)} y={H - 7} fill="#64748b" fontSize="11" textAnchor="middle">
                  {data[idx] ? fmtTick(data[idx].t, longRange) : ""}
                </text>
              </g>
            ))}

            {/* Support & resistance */}
            {showLevels && (
              <g clipPath="url(#priceClip)">
                {resistances.slice(0, 2).map((r, i) =>
                  r > view.min && r < view.max ? (
                    <g key={`r-${i}`}>
                      <line
                        x1={PAD_L}
                        x2={width - PAD_R}
                        y1={view.y(r)}
                        y2={view.y(r)}
                        stroke={BEAR}
                        strokeOpacity="0.55"
                        strokeDasharray="6 5"
                      />
                      <rect
                        x={PAD_L + 2}
                        y={view.y(r) - 17}
                        width={levelLabelW(`R${i + 1} ${fmtPrice(r)}`)}
                        height={15}
                        rx={3}
                        fill="rgba(234,57,67,0.15)"
                      />
                      <text x={PAD_L + 6} y={view.y(r) - 6} fill={BEAR} fontSize="10" fontWeight="600">
                        R{i + 1} {fmtPrice(r)}
                      </text>
                    </g>
                  ) : null,
                )}
                {supports.slice(0, 2).map((s, i) =>
                  s > view.min && s < view.max ? (
                    <g key={`s-${i}`}>
                      <line
                        x1={PAD_L}
                        x2={width - PAD_R}
                        y1={view.y(s)}
                        y2={view.y(s)}
                        stroke={BULL}
                        strokeOpacity="0.55"
                        strokeDasharray="6 5"
                      />
                      <rect
                        x={PAD_L + 2}
                        y={view.y(s) + 2}
                        width={levelLabelW(`S${i + 1} ${fmtPrice(s)}`)}
                        height={15}
                        rx={3}
                        fill="rgba(22,199,132,0.15)"
                      />
                      <text x={PAD_L + 6} y={view.y(s) + 13} fill={BULL} fontSize="10" fontWeight="600">
                        S{i + 1} {fmtPrice(s)}
                      </text>
                    </g>
                  ) : null,
                )}
              </g>
            )}

            {/* Volume */}
            <text x={PAD_L + 4} y={VOL_TOP + 11} fill="#64748b" fontSize="10">
              Volume
            </text>
            {data.map((c, i) => {
              const prev = data[i - 1];
              const green = prev ? c.c >= prev.c : c.c >= c.o;
              const yy = view.vy(c.v);
              const bw = Math.max(view.step * 0.7, 1);
              return (
                <rect
                  key={`v-${i}`}
                  x={view.x(i) - bw / 2}
                  y={yy}
                  width={bw}
                  height={Math.max(VOL_TOP + VOL_H - yy, 0.5)}
                  fill={green ? BULL : BEAR}
                  opacity={hover?.i === i ? 0.9 : 0.35}
                />
              );
            })}
            <line x1={PAD_L} x2={width - PAD_R} y1={VOL_TOP + VOL_H} y2={VOL_TOP + VOL_H} stroke="rgba(255,255,255,0.1)" />

            {/* Harga */}
            <g clipPath="url(#priceClip)">
              {mode === "area" ? (
                <>
                  <path d={view.areaPath} fill="url(#areaFill)" />
                  <path d={view.closePath} fill="none" stroke={up ? BULL : BEAR} strokeWidth="2" strokeLinejoin="round" />
                </>
              ) : (
                data.map((c, i) => {
                  const green = c.c >= c.o;
                  const color = green ? BULL : BEAR;
                  const bw = Math.max(Math.min(view.step * 0.7, 14), 1);
                  const bodyTop = view.y(Math.max(c.o, c.c));
                  const bodyH = Math.max(Math.abs(view.y(c.o) - view.y(c.c)), 1);
                  return (
                    <g key={`c-${i}`}>
                      <line
                        x1={view.x(i)}
                        x2={view.x(i)}
                        y1={view.y(c.h)}
                        y2={view.y(c.l)}
                        stroke={color}
                        strokeWidth={view.step > 6 ? 1.2 : 0.8}
                      />
                      <rect x={view.x(i) - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} rx={bw > 4 ? 1 : 0} />
                    </g>
                  );
                })
              )}

              {showMa20 && (
                <path d={view.linePath(view.ma20)} fill="none" stroke={MA20_COLOR} strokeWidth="1.6" opacity="0.9" />
              )}
              {showMa50 && (
                <path d={view.linePath(view.ma50)} fill="none" stroke={MA50_COLOR} strokeWidth="1.6" opacity="0.9" />
              )}
            </g>

            {/* Penanda pola candlestick */}
            {showPatterns && mode === "candle" && (
              <g clipPath="url(#priceClip)" pointerEvents="none">
                {data.map((c, i) => {
                  const ps = patternsByT.get(c.t);
                  if (!ps) return null;
                  const x = view.x(i);
                  const s = Math.max(4, Math.min(6, view.step * 0.6));
                  return (
                    <g key={`p-${i}`}>
                      {ps.some((p) => p.bullish) && (
                        <path
                          d={`M${x},${view.y(c.l) + 5} l${s},${s * 1.6} l${-s * 2},0 z`}
                          fill={BULL}
                          opacity={0.95}
                        />
                      )}
                      {ps.some((p) => !p.bullish) && (
                        <path
                          d={`M${x},${view.y(c.h) - 5} l${s},${-s * 1.6} l${-s * 2},0 z`}
                          fill={BEAR}
                          opacity={0.95}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Garis & label harga terakhir */}
            {lastCandle && (
              <>
                <line
                  x1={PAD_L}
                  x2={width - PAD_R}
                  y1={view.y(lastCandle.c)}
                  y2={view.y(lastCandle.c)}
                  stroke={lastColor}
                  strokeOpacity="0.5"
                  strokeDasharray="2 3"
                />
              </>
            )}
            {axisTags.map((t) => (
              <g key={`${t.fill}-${t.text}`}>{tag(t.y, t.text, t.fill, t.textFill)}</g>
            ))}

            {/* Crosshair */}
            {hover && active && (
              <g pointerEvents="none">
                {/* sorot kolom candle */}
                <rect
                  x={PAD_L + hover.i * view.step}
                  y={TOP}
                  width={Math.max(view.step, 1)}
                  height={VOL_TOP + VOL_H - TOP}
                  fill="rgba(255,255,255,0.05)"
                />
                <line
                  x1={view.x(hover.i)}
                  x2={view.x(hover.i)}
                  y1={TOP}
                  y2={VOL_TOP + VOL_H}
                  stroke="rgba(255,255,255,0.45)"
                  strokeDasharray="4 4"
                />
                {inPrice && (
                  <>
                    <line
                      x1={PAD_L}
                      x2={width - PAD_R}
                      y1={hy!}
                      y2={hy!}
                      stroke="rgba(255,255,255,0.45)"
                      strokeDasharray="4 4"
                    />
                    {tag(hy!, fmtPrice(view.priceAt(hy!)), "#334155")}
                  </>
                )}
                <circle
                  cx={view.x(hover.i)}
                  cy={view.y(active.c)}
                  r="4"
                  fill="#fff"
                  stroke={active.c >= active.o ? BULL : BEAR}
                  strokeWidth="2"
                />
                {/* label tanggal di sumbu bawah */}
                {(() => {
                  const label = fmtTick(active.t, false) + " " + new Date(active.t).getFullYear().toString().slice(2);
                  const lw = 74;
                  const lx = Math.max(PAD_L, Math.min(width - PAD_R - lw, view.x(hover.i) - lw / 2));
                  return (
                    <g>
                      <rect x={lx} y={H - AXIS_H + 3} width={lw} height={18} rx={4} fill="#334155" />
                      <text x={lx + lw / 2} y={H - AXIS_H + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff">
                        {label}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Harga dalam {currency}. Arahkan kursor (atau sentuh di ponsel) untuk melihat detail tiap hari di bilah atas
        grafik. Garis putus hijau = support, merah = resistance (deteksi swing pivot otomatis).
        {patterns.length > 0 && " ▲/▼ = pola candlestick bullish/bearish yang valid menurut lokasinya."}
      </p>
    </div>
  );
}

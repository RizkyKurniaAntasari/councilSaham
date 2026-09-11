import type { Candle } from "./types";

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period || period <= 0) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** RSI Wilder */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null,
  );
  const firstIdx = macdLine.findIndex((v) => v !== null);
  const compact = firstIdx === -1 ? [] : (macdLine.slice(firstIdx) as number[]);
  const signalCompact = ema(compact, signal);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  if (firstIdx !== -1) {
    for (let i = 0; i < signalCompact.length; i++) signalLine[firstIdx + i] = signalCompact[i];
  }
  const hist: (number | null)[] = values.map((_, i) =>
    macdLine[i] !== null && signalLine[i] !== null ? (macdLine[i] as number) - (signalLine[i] as number) : null,
  );
  return { macdLine, signalLine, hist };
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const variance = window.reduce((acc, v) => acc + (v - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { upper, mid, lower };
}

export function trueRange(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.h - c.l;
    const prevClose = candles[i - 1].c;
    return Math.max(c.h - c.l, Math.abs(c.h - prevClose), Math.abs(c.l - prevClose));
  });
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const tr = trueRange(candles);
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;
  let prev = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < tr.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  const k: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...window.map((c) => c.h));
    const ll = Math.min(...window.map((c) => c.l));
    k[i] = hh === ll ? 50 : ((candles[i].c - ll) / (hh - ll)) * 100;
  }
  const valid = k.map((v) => (v === null ? 0 : v));
  const d = sma(valid, dPeriod).map((v, i) => (k[i] === null ? null : v));
  return { k, d };
}

export function obv(candles: Candle[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const prev = out[i - 1];
    if (candles[i].c > candles[i - 1].c) out.push(prev + candles[i].v);
    else if (candles[i].c < candles[i - 1].c) out.push(prev - candles[i].v);
    else out.push(prev);
  }
  return out;
}

/** ADX Wilder yang disederhanakan (butuh minimal 2*period candle). */
export function adx(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period * 2) return out;
  const tr = trueRange(candles);
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].h - candles[i - 1].h;
    const down = candles[i - 1].l - candles[i].l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const smooth = (arr: number[]) => {
    const res: (number | null)[] = new Array(arr.length).fill(null);
    let acc = arr.slice(1, period + 1).reduce((a, b) => a + b, 0);
    res[period] = acc;
    for (let i = period + 1; i < arr.length; i++) {
      acc = acc - acc / period + arr[i];
      res[i] = acc;
    }
    return res;
  };
  const sTr = smooth(tr);
  const sPlus = smooth(plusDM);
  const sMinus = smooth(minusDM);
  const dx: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    const t = sTr[i];
    const p = sPlus[i];
    const m = sMinus[i];
    if (t === null || p === null || m === null || t === 0) continue;
    const pdi = (p / t) * 100;
    const mdi = (m / t) * 100;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100;
  }
  const start = dx.findIndex((v) => v !== null);
  if (start === -1) return out;
  const dxVals = dx.slice(start).map((v) => (v === null ? 0 : v));
  if (dxVals.length < period) return out;
  let prev = dxVals.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[start + period - 1] = prev;
  for (let i = period; i < dxVals.length; i++) {
    prev = (prev * (period - 1) + dxVals[i]) / period;
    out[start + i] = prev;
  }
  return out;
}

/** Support & resistance dari swing pivot. */
export function pivotLevels(candles: Candle[], lookback = 5, maxLevels = 4) {
  const highs: number[] = [];
  const lows: number[] = [];
  const recent = candles.slice(-160);
  for (let i = lookback; i < recent.length - lookback; i++) {
    const window = recent.slice(i - lookback, i + lookback + 1);
    const isHigh = recent[i].h >= Math.max(...window.map((c) => c.h));
    const isLow = recent[i].l <= Math.min(...window.map((c) => c.l));
    if (isHigh) highs.push(recent[i].h);
    if (isLow) lows.push(recent[i].l);
  }
  const price = candles[candles.length - 1].c;

  const cluster = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const groups: number[][] = [];
    for (const v of sorted) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(v - last[last.length - 1]) / v < 0.02) last.push(v);
      else groups.push([v]);
    }
    return groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  };

  const resistances = cluster(highs)
    .filter((v) => v > price * 1.005)
    .sort((a, b) => a - b)
    .slice(0, maxLevels);
  const supports = cluster(lows)
    .filter((v) => v < price * 0.995)
    .sort((a, b) => b - a)
    .slice(0, maxLevels);
  return { supports, resistances };
}

export function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

export function linRegSlopePct(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  if (den === 0 || meanY === 0) return 0;
  return ((num / den) / Math.abs(meanY)) * 100 * n;
}

export function last<T>(arr: (T | null)[]): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && arr[i] !== undefined) return arr[i] as T;
  }
  return null;
}

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

/** Skala linier nilai ke 0-100 dengan titik netral 50. */
export function scoreLinear(value: number, worst: number, best: number): number {
  if (!Number.isFinite(value)) return 50;
  if (worst === best) return 50;
  return clamp(((value - worst) / (best - worst)) * 100);
}

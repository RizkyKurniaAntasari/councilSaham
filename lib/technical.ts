import {
  adx,
  atr,
  bollinger,
  clamp,
  ema,
  last,
  linRegSlopePct,
  macd,
  obv,
  pctChange,
  pivotLevels,
  rsi,
  sma,
  stochastic,
} from "./indicators";
import type { Candle, IndicatorSet, TechnicalReport, TechnicalSignal } from "./types";

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function buildIndicators(candles: Candle[]): IndicatorSet {
  const closes = candles.map((c) => c.c);
  const vols = candles.map((c) => c.v);
  const n = closes.length;
  const price = closes[n - 1];

  const m = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const st = stochastic(candles);
  const obvSeries = obv(candles);
  const atrSeries = atr(candles, 14);
  const adxSeries = adx(candles, 14);

  const bbUpper = last(bb.upper);
  const bbMid = last(bb.mid);
  const bbLower = last(bb.lower);

  const vol20 = avg(vols.slice(-20));
  const vol60 = avg(vols.slice(-60));
  const lastVol = vols[n - 1] ?? 0;

  const window52w = candles.slice(-250);
  const high52w = window52w.length ? Math.max(...window52w.map((c) => c.h)) : null;
  const low52w = window52w.length ? Math.min(...window52w.map((c) => c.l)) : null;

  const atrLast = last(atrSeries);

  // VWAP 20 hari (pendekatan memakai typical price)
  const last20 = candles.slice(-20);
  const tpv = last20.reduce((acc, c) => acc + ((c.h + c.l + c.c) / 3) * c.v, 0);
  const totalVol = last20.reduce((acc, c) => acc + c.v, 0);

  const ret = (days: number) =>
    n > days ? pctChange(closes[n - 1 - days], price) : null;

  return {
    ma5: last(sma(closes, 5)),
    ma20: last(sma(closes, 20)),
    ma50: last(sma(closes, 50)),
    ma100: last(sma(closes, 100)),
    ma200: last(sma(closes, 200)),
    ema12: last(ema(closes, 12)),
    ema26: last(ema(closes, 26)),
    rsi14: last(rsi(closes, 14)),
    macd:
      last(m.macdLine) !== null && last(m.signalLine) !== null
        ? {
            macd: last(m.macdLine) as number,
            signal: last(m.signalLine) as number,
            hist: (last(m.hist) as number) ?? 0,
          }
        : null,
    bb:
      bbUpper !== null && bbMid !== null && bbLower !== null
        ? {
            upper: bbUpper,
            mid: bbMid,
            lower: bbLower,
            pctB: bbUpper === bbLower ? 50 : ((price - bbLower) / (bbUpper - bbLower)) * 100,
            widthPct: bbMid ? ((bbUpper - bbLower) / bbMid) * 100 : 0,
          }
        : null,
    atr14: atrLast,
    atrPct: atrLast !== null && price ? (atrLast / price) * 100 : null,
    stoch:
      last(st.k) !== null ? { k: last(st.k) as number, d: (last(st.d) as number) ?? 50 } : null,
    obvSlopePct: obvSeries.length > 20 ? linRegSlopePct(obvSeries.slice(-20)) : null,
    volume: vol20
      ? {
          last: lastVol,
          avg20: vol20,
          avg60: vol60,
          ratio20: vol20 ? lastVol / vol20 : 0,
          ratio60: vol60 ? lastVol / vol60 : 0,
        }
      : null,
    adx14: last(adxSeries),
    return1d: ret(1),
    return5d: ret(5),
    return20d: ret(20),
    return60d: ret(60),
    return250d: ret(250),
    distFrom52wHigh: high52w ? pctChange(high52w, price) : null,
    distFrom52wLow: low52w ? pctChange(low52w, price) : null,
    vwap20: totalVol ? tpv / totalVol : null,
  };
}

function detectPatterns(candles: Candle[], ind: IndicatorSet): string[] {
  const out: string[] = [];
  const n = candles.length;
  if (n < 30) return out;
  const price = candles[n - 1].c;

  if (ind.ma50 && ind.ma200) {
    const closes = candles.map((c) => c.c);
    const ma50Series = sma(closes, 50);
    const ma200Series = sma(closes, 200);
    for (let i = Math.max(1, n - 30); i < n; i++) {
      const a1 = ma50Series[i - 1];
      const b1 = ma200Series[i - 1];
      const a2 = ma50Series[i];
      const b2 = ma200Series[i];
      if (a1 !== null && b1 !== null && a2 !== null && b2 !== null) {
        if (a1 <= b1 && a2 > b2) out.push("Golden Cross (MA50 memotong MA200 ke atas) dalam 30 hari terakhir");
        if (a1 >= b1 && a2 < b2) out.push("Death Cross (MA50 memotong MA200 ke bawah) dalam 30 hari terakhir");
      }
    }
  }

  if (ind.bb && ind.bb.widthPct < 8) out.push("Bollinger Squeeze — volatilitas menyempit, potensi breakout");
  if (ind.bb && ind.bb.pctB > 100) out.push("Harga menembus di atas upper Bollinger Band (overextended)");
  if (ind.bb && ind.bb.pctB < 0) out.push("Harga jatuh di bawah lower Bollinger Band (oversold ekstrem)");

  const last20 = candles.slice(-20);
  const maxHigh20 = Math.max(...last20.map((c) => c.h));
  if (price >= maxHigh20 * 0.995) out.push("Breakout ke level tertinggi 20 hari");
  const minLow20 = Math.min(...last20.map((c) => c.l));
  if (price <= minLow20 * 1.005) out.push("Breakdown ke level terendah 20 hari");

  if (ind.volume && ind.volume.ratio20 >= 3) out.push(`Lonjakan volume ${ind.volume.ratio20.toFixed(1)}x rata-rata 20 hari`);

  // Divergensi RSI sederhana
  const closes = candles.map((c) => c.c);
  const rsiSeries = rsi(closes, 14);
  if (n > 40) {
    const segA = closes.slice(-40, -20);
    const segB = closes.slice(-20);
    const rsiA = rsiSeries.slice(-40, -20).filter((v): v is number => v !== null);
    const rsiB = rsiSeries.slice(-20).filter((v): v is number => v !== null);
    if (segA.length && segB.length && rsiA.length && rsiB.length) {
      const priceUp = Math.max(...segB) > Math.max(...segA);
      const rsiDown = Math.max(...rsiB) < Math.max(...rsiA);
      const priceDown = Math.min(...segB) < Math.min(...segA);
      const rsiUp = Math.min(...rsiB) > Math.min(...rsiA);
      if (priceUp && rsiDown) out.push("Divergensi bearish: harga membuat high baru tapi RSI melemah");
      if (priceDown && rsiUp) out.push("Divergensi bullish: harga membuat low baru tapi RSI menguat");
    }
  }

  return Array.from(new Set(out)).slice(0, 6);
}

export function buildTechnical(candles: Candle[]): TechnicalReport {
  const empty: TechnicalReport = {
    available: false,
    score: 50,
    trend: "SIDEWAYS",
    trendStrength: "Data tidak cukup",
    phase: "Tidak diketahui",
    indicators: buildIndicators(candles.length ? candles : [{ t: Date.now(), o: 0, h: 0, l: 0, c: 0, v: 0 }]),
    signals: [],
    supports: [],
    resistances: [],
    levels: { entry: null, stopLoss: null, target1: null, target2: null, riskRewardRatio: null },
    patterns: [],
    highlights: [],
    risks: ["Riwayat harga terlalu pendek untuk analisis teknikal yang bermakna."],
    breakdown: [],
  };
  if (candles.length < 30) return empty;

  const ind = buildIndicators(candles);
  const price = candles[candles.length - 1].c;
  const signals: TechnicalSignal[] = [];

  const push = (
    name: string,
    value: string,
    signal: TechnicalSignal["signal"],
    weight: number,
    note: string,
  ) => signals.push({ name, value, signal, weight, note });

  // 1. Posisi terhadap moving average
  const maRefs: { label: string; value: number | null; weight: number }[] = [
    { label: "MA20", value: ind.ma20, weight: 1 },
    { label: "MA50", value: ind.ma50, weight: 1.2 },
    { label: "MA200", value: ind.ma200, weight: 1.5 },
  ];
  let maScore = 0;
  let maWeight = 0;
  for (const ref of maRefs) {
    if (ref.value === null) continue;
    const above = price > ref.value;
    const dist = pctChange(ref.value, price);
    maWeight += ref.weight;
    maScore += (above ? 1 : 0) * ref.weight;
    push(
      `Harga vs ${ref.label}`,
      `${dist >= 0 ? "+" : ""}${dist.toFixed(1)}%`,
      above ? "BULLISH" : "BEARISH",
      ref.weight,
      above
        ? `Harga bertahan di atas ${ref.label} — struktur tren jangka ${
            ref.label === "MA20" ? "pendek" : ref.label === "MA50" ? "menengah" : "panjang"
          } masih positif.`
        : `Harga di bawah ${ref.label} — tekanan jual masih dominan di jangka ${
            ref.label === "MA20" ? "pendek" : ref.label === "MA50" ? "menengah" : "panjang"
          }.`,
    );
  }
  const maAlignmentScore = maWeight ? (maScore / maWeight) * 100 : 50;

  // 2. Susunan MA (perfect order)
  let alignmentBonus = 0;
  if (ind.ma20 && ind.ma50 && ind.ma200) {
    if (ind.ma20 > ind.ma50 && ind.ma50 > ind.ma200) {
      alignmentBonus = 10;
      push("Susunan MA", "MA20 > MA50 > MA200", "BULLISH", 1.5, "Perfect bullish alignment — tren naik terstruktur.");
    } else if (ind.ma20 < ind.ma50 && ind.ma50 < ind.ma200) {
      alignmentBonus = -10;
      push("Susunan MA", "MA20 < MA50 < MA200", "BEARISH", 1.5, "Perfect bearish alignment — downtrend terstruktur.");
    } else {
      push("Susunan MA", "Berpotongan", "NETRAL", 1, "MA saling berpotongan — pasar dalam fase transisi/konsolidasi.");
    }
  }

  // 3. RSI
  let rsiScore = 50;
  if (ind.rsi14 !== null) {
    const r = ind.rsi14;
    if (r >= 70) {
      rsiScore = 35;
      push("RSI(14)", r.toFixed(1), "BEARISH", 1.2, "Overbought — rawan aksi ambil untung jangka pendek.");
    } else if (r >= 55) {
      rsiScore = 78;
      push("RSI(14)", r.toFixed(1), "BULLISH", 1.2, "Momentum positif dan belum jenuh beli.");
    } else if (r >= 45) {
      rsiScore = 55;
      push("RSI(14)", r.toFixed(1), "NETRAL", 1, "Momentum seimbang, belum ada arah dominan.");
    } else if (r >= 30) {
      rsiScore = 38;
      push("RSI(14)", r.toFixed(1), "BEARISH", 1.2, "Momentum melemah, tekanan jual masih terasa.");
    } else {
      rsiScore = 62;
      push("RSI(14)", r.toFixed(1), "BULLISH", 1, "Oversold — berpotensi technical rebound, butuh konfirmasi volume.");
    }
  }

  // 4. MACD
  let macdScore = 50;
  if (ind.macd) {
    const bullish = ind.macd.macd > ind.macd.signal;
    const above0 = ind.macd.macd > 0;
    macdScore = bullish ? (above0 ? 85 : 62) : above0 ? 45 : 22;
    push(
      "MACD(12,26,9)",
      `${ind.macd.macd.toFixed(2)} / sig ${ind.macd.signal.toFixed(2)}`,
      bullish ? "BULLISH" : "BEARISH",
      1.3,
      bullish
        ? `MACD di atas garis sinyal${above0 ? " dan di atas nol — tren naik terkonfirmasi." : " namun masih di bawah nol — pemulihan awal."}`
        : `MACD di bawah garis sinyal${above0 ? " tapi masih di atas nol — koreksi dalam uptrend." : " dan di bawah nol — momentum bearish."}`,
    );
  }

  // 5. Volume
  let volScore = 50;
  if (ind.volume) {
    const r = ind.volume.ratio20;
    const priceUp = (ind.return1d ?? 0) > 0;
    if (r >= 2 && priceUp) {
      volScore = 88;
      push("Volume vs rata-rata 20H", `${r.toFixed(2)}x`, "BULLISH", 1.3, "Kenaikan harga disertai volume besar — akumulasi kuat.");
    } else if (r >= 2 && !priceUp) {
      volScore = 25;
      push("Volume vs rata-rata 20H", `${r.toFixed(2)}x`, "BEARISH", 1.3, "Volume besar saat harga turun — indikasi distribusi.");
    } else if (r >= 1.2) {
      volScore = priceUp ? 70 : 40;
      push("Volume vs rata-rata 20H", `${r.toFixed(2)}x`, priceUp ? "BULLISH" : "BEARISH", 1, "Volume di atas normal, partisipasi pasar meningkat.");
    } else if (r < 0.6) {
      volScore = 42;
      push("Volume vs rata-rata 20H", `${r.toFixed(2)}x`, "NETRAL", 0.8, "Volume kering — pergerakan harga kurang meyakinkan.");
    } else {
      push("Volume vs rata-rata 20H", `${r.toFixed(2)}x`, "NETRAL", 0.8, "Volume normal.");
    }
  }

  // 6. OBV
  let obvScore = 50;
  if (ind.obvSlopePct !== null) {
    const s = ind.obvSlopePct;
    obvScore = clamp(50 + s * 0.6);
    push(
      "On-Balance Volume (20H)",
      `${s >= 0 ? "+" : ""}${s.toFixed(1)}%`,
      s > 5 ? "BULLISH" : s < -5 ? "BEARISH" : "NETRAL",
      1,
      s > 5 ? "Aliran dana masuk (akumulasi)." : s < -5 ? "Aliran dana keluar (distribusi)." : "Aliran dana relatif seimbang.",
    );
  }

  // 7. ADX / kekuatan tren
  let trendStrength = "Tidak terukur";
  if (ind.adx14 !== null) {
    const a = ind.adx14;
    trendStrength = a >= 40 ? "Sangat kuat" : a >= 25 ? "Kuat" : a >= 20 ? "Sedang" : "Lemah / sideways";
    push("ADX(14)", a.toFixed(1), "NETRAL", 0.8, `Kekuatan tren: ${trendStrength.toLowerCase()}.`);
  }

  // 8. Posisi 52 minggu
  let posScore = 50;
  if (ind.distFrom52wHigh !== null && ind.distFrom52wLow !== null) {
    const range = Math.abs(ind.distFrom52wLow) + Math.abs(ind.distFrom52wHigh);
    const posPct = range ? (Math.abs(ind.distFrom52wLow) / range) * 100 : 50;
    posScore = clamp(posPct);
    push(
      "Posisi dalam rentang 52 minggu",
      `${posPct.toFixed(0)}% dari bawah`,
      posPct > 70 ? "BULLISH" : posPct < 30 ? "BEARISH" : "NETRAL",
      1,
      `${ind.distFrom52wHigh.toFixed(1)}% dari puncak 52 minggu, ${ind.distFrom52wLow.toFixed(1)}% dari dasar.`,
    );
  }

  // 9. Return multi-periode
  const returnScore = clamp(
    50 +
      ((ind.return5d ?? 0) * 0.8 + (ind.return20d ?? 0) * 0.5 + (ind.return60d ?? 0) * 0.25),
  );

  const f1 = (v: number) => v.toFixed(1).replace(".", ",");
  const aboveCount = maRefs.filter((r) => r.value !== null && price > r.value).length;
  const maCount = maRefs.filter((r) => r.value !== null).length;
  const breakdown: TechnicalReport["breakdown"] = [
    {
      label: "Posisi harga vs MA20/50/200",
      score: Math.round(maAlignmentScore),
      weight: 0.22,
      detail: `Di atas ${aboveCount} dari ${maCount} MA (bobot MA20 1, MA50 1,2, MA200 1,5).`,
    },
    {
      label: "RSI(14)",
      score: rsiScore,
      weight: 0.13,
      detail: ind.rsi14 !== null ? `RSI ${f1(ind.rsi14)}: ≥70 jenuh beli=35, 55–70=78, 45–55=55, 30–45=38, <30=62.` : "Tidak tersedia.",
    },
    {
      label: "MACD(12,26,9)",
      score: macdScore,
      weight: 0.17,
      detail: ind.macd
        ? `MACD ${ind.macd.macd > ind.macd.signal ? "di atas" : "di bawah"} sinyal, ${ind.macd.macd > 0 ? "di atas" : "di bawah"} nol.`
        : "Tidak tersedia.",
    },
    {
      label: "Volume vs rata-rata 20H",
      score: volScore,
      weight: 0.12,
      detail: ind.volume ? `Rasio ${ind.volume.ratio20.toFixed(2).replace(".", ",")}× saat harga ${(ind.return1d ?? 0) > 0 ? "naik" : "turun/datar"}.` : "Tidak tersedia.",
    },
    {
      label: "Aliran dana OBV (20H)",
      score: Math.round(obvScore),
      weight: 0.09,
      detail: ind.obvSlopePct !== null ? `Kemiringan OBV ${f1(ind.obvSlopePct)}% → 50 + kemiringan × 0,6.` : "Tidak tersedia.",
    },
    {
      label: "Posisi dalam rentang 52 minggu",
      score: Math.round(posScore),
      weight: 0.12,
      detail: "0 = di dasar 52 minggu, 100 = di puncak.",
    },
    {
      label: "Return 5/20/60 hari",
      score: Math.round(returnScore),
      weight: 0.15,
      detail: `50 + 0,8×(${f1(ind.return5d ?? 0)}%) + 0,5×(${f1(ind.return20d ?? 0)}%) + 0,25×(${f1(ind.return60d ?? 0)}%).`,
    },
  ];
  if (alignmentBonus !== 0) {
    breakdown.push({
      label: "Bonus susunan MA",
      score: alignmentBonus,
      weight: 1,
      detail: alignmentBonus > 0 ? "MA20 > MA50 > MA200: +10 poin." : "MA20 < MA50 < MA200: −10 poin.",
    });
  }

  const score = clamp(
    maAlignmentScore * 0.22 +
      rsiScore * 0.13 +
      macdScore * 0.17 +
      volScore * 0.12 +
      obvScore * 0.09 +
      posScore * 0.12 +
      returnScore * 0.15 +
      alignmentBonus,
  );

  const trend: TechnicalReport["trend"] =
    score >= 60 && (ind.ma50 === null || price > ind.ma50)
      ? "UPTREND"
      : score <= 40
        ? "DOWNTREND"
        : "SIDEWAYS";

  const phase = (() => {
    if (trend === "UPTREND" && (ind.rsi14 ?? 50) > 70) return "Uptrend — fase euforia / jenuh beli";
    if (trend === "UPTREND") return "Uptrend — fase markup";
    if (trend === "DOWNTREND" && (ind.rsi14 ?? 50) < 30) return "Downtrend — fase kapitulasi";
    if (trend === "DOWNTREND") return "Downtrend — fase markdown";
    if ((ind.obvSlopePct ?? 0) > 5) return "Sideways — indikasi akumulasi";
    if ((ind.obvSlopePct ?? 0) < -5) return "Sideways — indikasi distribusi";
    return "Sideways — konsolidasi";
  })();

  const { supports, resistances } = pivotLevels(candles);
  const atrValue = ind.atr14 ?? price * 0.03;
  const stopLoss = supports[0] ? Math.min(supports[0] * 0.985, price - atrValue * 1.5) : price - atrValue * 2;
  const target1 = resistances[0] ?? price + atrValue * 3;
  const target2 = resistances[1] ?? price + atrValue * 5;
  const risk = price - stopLoss;
  const reward = target1 - price;

  const patterns = detectPatterns(candles, ind);

  const highlights: string[] = [];
  const risks: string[] = [];
  for (const s of signals) {
    if (s.signal === "BULLISH" && highlights.length < 5) highlights.push(`${s.name}: ${s.note}`);
    if (s.signal === "BEARISH" && risks.length < 5) risks.push(`${s.name}: ${s.note}`);
  }
  if (ind.atrPct !== null && ind.atrPct > 5) {
    risks.push(`Volatilitas tinggi (ATR ${ind.atrPct.toFixed(1)}% dari harga) — ukuran posisi perlu dikecilkan.`);
  }

  return {
    available: true,
    score: Math.round(score),
    trend,
    trendStrength,
    phase,
    indicators: ind,
    signals,
    supports,
    resistances,
    levels: {
      entry: price,
      stopLoss: Math.max(0, stopLoss),
      target1,
      target2,
      riskRewardRatio: risk > 0 ? reward / risk : null,
    },
    patterns,
    highlights,
    risks,
    breakdown,
  };
}

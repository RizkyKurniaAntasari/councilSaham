import { clamp } from "./indicators";
import type { FundamentalMetric, FundamentalReport } from "./types";
import { num } from "./yahoo";

/** Skor "lebih kecil lebih baik" dengan zona ideal. */
function scoreLowerBetter(v: number, ideal: number, bad: number): number {
  if (v <= 0) return 20;
  if (v <= ideal) return clamp(85 + (ideal - v) * (10 / Math.max(ideal, 1)));
  if (v >= bad) return clamp(25 - (v - bad));
  return clamp(85 - ((v - ideal) / (bad - ideal)) * 60);
}

/** Skor "lebih besar lebih baik" dengan zona ideal. */
function scoreHigherBetter(v: number, bad: number, ideal: number): number {
  if (v <= bad) return clamp(20 + (v - bad) * 2);
  if (v >= ideal) return clamp(88 + (v - ideal) * 0.5);
  return clamp(20 + ((v - bad) / (ideal - bad)) * 68);
}

function grade(score: number): string {
  if (score >= 82) return "A";
  if (score >= 72) return "B+";
  if (score >= 62) return "B";
  if (score >= 52) return "C+";
  if (score >= 42) return "C";
  if (score >= 32) return "D";
  return "E";
}

export function buildFundamental(qs: Record<string, any> | null): FundamentalReport {
  if (!qs) {
    return {
      available: false,
      score: 50,
      grade: "N/A",
      metrics: [],
      highlights: [],
      risks: ["Data laporan keuangan tidak tersedia dari sumber saat ini — analisis fundamental dilewati."],
      financials: {},
    };
  }

  const sd = qs.summaryDetail ?? {};
  const ks = qs.defaultKeyStatistics ?? {};
  const fd = qs.financialData ?? {};
  const incomeHistory = qs.incomeStatementHistory?.incomeStatementHistory ?? [];
  const balanceHistory = qs.balanceSheetHistory?.balanceSheetStatements ?? [];

  const latestIncome = incomeHistory[0] ?? {};
  const prevIncome = incomeHistory[1] ?? {};
  const latestBalance = balanceHistory[0] ?? {};

  const per = num(sd.trailingPE) ?? num(ks.trailingPE) ?? null;
  const pbv = num(ks.priceToBook) ?? null;
  const psr = num(ks.priceToSalesTrailing12Months) ?? num(sd.priceToSalesTrailing12Months) ?? null;
  const evEbitda = num(ks.enterpriseToEbitda) ?? null;

  const roeRaw = num(fd.returnOnEquity);
  const roe = roeRaw !== undefined ? roeRaw * 100 : null;
  const roaRaw = num(fd.returnOnAssets);
  const roa = roaRaw !== undefined ? roaRaw * 100 : null;

  const derRaw = num(fd.debtToEquity);
  const der = derRaw !== undefined ? (derRaw > 10 ? derRaw : derRaw * 100) : null;

  const currentRatio = num(fd.currentRatio) ?? null;
  const profitMargin =
    num(fd.profitMargins) !== undefined ? (num(fd.profitMargins) as number) * 100 : null;
  const grossMargin =
    num(fd.grossMargins) !== undefined ? (num(fd.grossMargins) as number) * 100 : null;
  const operatingMargin =
    num(fd.operatingMargins) !== undefined ? (num(fd.operatingMargins) as number) * 100 : null;

  let revenueGrowth =
    num(fd.revenueGrowth) !== undefined ? (num(fd.revenueGrowth) as number) * 100 : null;
  let earningsGrowth =
    num(fd.earningsGrowth) !== undefined ? (num(fd.earningsGrowth) as number) * 100 : null;

  // Fallback pertumbuhan dari laporan tahunan bila financialData kosong
  const revNow = num(latestIncome.totalRevenue);
  const revPrev = num(prevIncome.totalRevenue);
  if (revenueGrowth === null && revNow && revPrev) revenueGrowth = ((revNow - revPrev) / Math.abs(revPrev)) * 100;
  const niNow = num(latestIncome.netIncome);
  const niPrev = num(prevIncome.netIncome);
  if (earningsGrowth === null && niNow && niPrev) earningsGrowth = ((niNow - niPrev) / Math.abs(niPrev)) * 100;

  const dividendYieldRaw = num(sd.dividendYield) ?? num(sd.trailingAnnualDividendYield);
  const dividendYield =
    dividendYieldRaw !== undefined ? (dividendYieldRaw > 1 ? dividendYieldRaw : dividendYieldRaw * 100) : null;
  const payoutRaw = num(sd.payoutRatio);
  const payoutRatio = payoutRaw !== undefined ? (payoutRaw > 1 ? payoutRaw : payoutRaw * 100) : null;

  const eps = num(ks.trailingEps) ?? num(sd.trailingEps) ?? null;
  const bookValue = num(ks.bookValue) ?? null;
  const freeCashflow = num(fd.freeCashflow) ?? null;
  const totalCash = num(fd.totalCash) ?? null;
  const totalDebt = num(fd.totalDebt) ?? null;

  const metrics: FundamentalMetric[] = [];
  const add = (
    key: string,
    label: string,
    value: number | null,
    display: string,
    score: number | null,
    weight: number,
    verdict: string,
    benchmark?: string,
  ) => metrics.push({ key, label, value, display, score, weight, verdict, benchmark });

  // Valuasi
  if (per !== null) {
    const s = per <= 0 ? 15 : scoreLowerBetter(per, 10, 30);
    add(
      "per",
      "PER (Price to Earnings)",
      per,
      per <= 0 ? "Rugi" : `${per.toFixed(2)}x`,
      s,
      1.2,
      per <= 0
        ? "Perusahaan membukukan rugi — PER tidak bermakna."
        : per < 8
          ? "Valuasi murah relatif terhadap laba."
          : per < 15
            ? "Valuasi wajar."
            : per < 25
              ? "Valuasi agak premium."
              : "Valuasi mahal — butuh pertumbuhan tinggi untuk membenarkannya.",
      "Wajar IDX: 8–15x",
    );
  }
  if (pbv !== null) {
    add(
      "pbv",
      "PBV (Price to Book)",
      pbv,
      `${pbv.toFixed(2)}x`,
      scoreLowerBetter(pbv, 1.2, 5),
      1,
      pbv < 1
        ? "Diperdagangkan di bawah nilai buku — potensi undervalued (cek kualitas aset)."
        : pbv < 2.5
          ? "PBV wajar."
          : "PBV premium — pasar memberi ekspektasi tinggi.",
      "Wajar IDX: 1–2,5x",
    );
  }
  if (evEbitda !== null) {
    add(
      "evEbitda",
      "EV/EBITDA",
      evEbitda,
      `${evEbitda.toFixed(2)}x`,
      scoreLowerBetter(evEbitda, 6, 18),
      0.8,
      evEbitda < 6 ? "Murah secara enterprise value." : evEbitda < 12 ? "Wajar." : "Premium.",
      "Wajar: 6–12x",
    );
  }
  if (psr !== null) {
    add("psr", "Price to Sales", psr, `${psr.toFixed(2)}x`, scoreLowerBetter(psr, 1, 8), 0.6, psr < 1 ? "Murah terhadap penjualan." : psr < 3 ? "Wajar." : "Premium.", "Wajar: <3x");
  }

  // Profitabilitas
  if (roe !== null) {
    add(
      "roe",
      "ROE (Return on Equity)",
      roe,
      `${roe.toFixed(2)}%`,
      scoreHigherBetter(roe, 0, 20),
      1.5,
      roe > 20 ? "Sangat profitabel — manajemen efisien mengelola ekuitas." : roe > 12 ? "Profitabilitas sehat." : roe > 0 ? "Profitabilitas rendah." : "Merugi — ekuitas tergerus.",
      "Bagus: >15%",
    );
  }
  if (roa !== null) {
    add("roa", "ROA (Return on Assets)", roa, `${roa.toFixed(2)}%`, scoreHigherBetter(roa, 0, 12), 0.8, roa > 10 ? "Aset sangat produktif." : roa > 5 ? "Aset cukup produktif." : "Produktivitas aset rendah.", "Bagus: >8%");
  }
  if (profitMargin !== null) {
    add("npm", "Net Profit Margin", profitMargin, `${profitMargin.toFixed(2)}%`, scoreHigherBetter(profitMargin, 0, 20), 1.2, profitMargin > 20 ? "Margin bersih tebal." : profitMargin > 8 ? "Margin sehat." : profitMargin > 0 ? "Margin tipis — sensitif terhadap kenaikan biaya." : "Merugi di level bersih.", "Bagus: >10%");
  }
  if (operatingMargin !== null) {
    add("opm", "Operating Margin", operatingMargin, `${operatingMargin.toFixed(2)}%`, scoreHigherBetter(operatingMargin, 0, 25), 0.8, operatingMargin > 20 ? "Efisiensi operasional tinggi." : operatingMargin > 8 ? "Operasional sehat." : "Efisiensi operasional perlu diperbaiki.");
  }
  if (grossMargin !== null) {
    add("gpm", "Gross Margin", grossMargin, `${grossMargin.toFixed(2)}%`, scoreHigherBetter(grossMargin, 5, 40), 0.6, grossMargin > 35 ? "Daya tawar produk kuat." : "Margin kotor moderat.");
  }

  // Pertumbuhan
  if (revenueGrowth !== null) {
    add("revGrowth", "Pertumbuhan Pendapatan (YoY)", revenueGrowth, `${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}%`, scoreHigherBetter(revenueGrowth, -15, 25), 1.3, revenueGrowth > 20 ? "Pertumbuhan pendapatan agresif." : revenueGrowth > 5 ? "Tumbuh sehat." : revenueGrowth > -5 ? "Stagnan." : "Pendapatan menyusut.", "Bagus: >10%");
  }
  if (earningsGrowth !== null) {
    add("epsGrowth", "Pertumbuhan Laba (YoY)", earningsGrowth, `${earningsGrowth >= 0 ? "+" : ""}${earningsGrowth.toFixed(1)}%`, scoreHigherBetter(earningsGrowth, -30, 30), 1.4, earningsGrowth > 25 ? "Laba tumbuh kencang — pendorong utama re-rating." : earningsGrowth > 5 ? "Laba tumbuh." : earningsGrowth > -10 ? "Laba relatif datar." : "Laba turun signifikan.", "Bagus: >15%");
  }

  // Kesehatan neraca
  if (der !== null) {
    add("der", "DER (Debt to Equity)", der, `${der.toFixed(1)}%`, scoreLowerBetter(der, 40, 180), 1.3, der < 50 ? "Neraca konservatif, risiko leverage rendah." : der < 100 ? "Leverage moderat, masih terkendali." : der < 200 ? "Leverage tinggi — sensitif terhadap suku bunga." : "Leverage sangat tinggi — risiko solvabilitas.", "Aman: <100%");
  }
  if (currentRatio !== null) {
    const s = currentRatio < 1 ? 25 : currentRatio <= 3 ? clamp(60 + (currentRatio - 1) * 17) : 70;
    add("currentRatio", "Current Ratio", currentRatio, `${currentRatio.toFixed(2)}x`, s, 0.9, currentRatio < 1 ? "Likuiditas jangka pendek ketat." : currentRatio < 3 ? "Likuiditas sehat." : "Likuiditas sangat longgar (bisa berarti aset menganggur).", "Sehat: 1,5–3x");
  }
  if (freeCashflow !== null) {
    add("fcf", "Free Cash Flow", freeCashflow, freeCashflow >= 0 ? "Positif" : "Negatif", freeCashflow > 0 ? 82 : 28, 1, freeCashflow > 0 ? "Arus kas bebas positif — mampu mendanai ekspansi/dividen sendiri." : "Arus kas bebas negatif — bergantung pendanaan eksternal.");
  }

  // Dividen
  if (dividendYield !== null && dividendYield > 0) {
    add("divYield", "Dividend Yield", dividendYield, `${dividendYield.toFixed(2)}%`, scoreHigherBetter(dividendYield, 0, 6), 0.8, dividendYield > 6 ? "Yield dividen sangat menarik (cek keberlanjutannya)." : dividendYield > 3 ? "Yield dividen menarik." : "Yield dividen kecil.", "Menarik: >4%");
  }
  if (payoutRatio !== null && payoutRatio > 0) {
    const s = payoutRatio > 100 ? 30 : payoutRatio > 70 ? 55 : payoutRatio > 20 ? 80 : 65;
    add("payout", "Payout Ratio", payoutRatio, `${payoutRatio.toFixed(1)}%`, s, 0.5, payoutRatio > 100 ? "Dividen melebihi laba — tidak berkelanjutan." : payoutRatio > 70 ? "Payout tinggi, ruang ekspansi terbatas." : "Payout sehat dan berkelanjutan.");
  }

  const scored = metrics.filter((m) => m.score !== null);
  const totalWeight = scored.reduce((a, m) => a + m.weight, 0);
  const score = totalWeight
    ? Math.round(scored.reduce((a, m) => a + (m.score as number) * m.weight, 0) / totalWeight)
    : 50;

  const highlights = scored
    .filter((m) => (m.score as number) >= 72)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 5)
    .map((m) => `${m.label} ${m.display} — ${m.verdict}`);

  const risks = scored
    .filter((m) => (m.score as number) <= 42)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 5)
    .map((m) => `${m.label} ${m.display} — ${m.verdict}`);

  if (metrics.length < 4) {
    risks.push("Cakupan data fundamental terbatas — skor fundamental punya keyakinan rendah.");
  }

  return {
    available: metrics.length > 0,
    score,
    grade: grade(score),
    metrics,
    highlights,
    risks,
    financials: {
      revenue: revNow ?? num(fd.totalRevenue),
      netIncome: niNow ?? undefined,
      revenueGrowth: revenueGrowth ?? undefined,
      earningsGrowth: earningsGrowth ?? undefined,
      grossMargin: grossMargin ?? undefined,
      operatingMargin: operatingMargin ?? undefined,
      profitMargin: profitMargin ?? undefined,
      roe: roe ?? undefined,
      roa: roa ?? undefined,
      der: der ?? undefined,
      currentRatio: currentRatio ?? undefined,
      totalCash: totalCash ?? undefined,
      totalDebt: totalDebt ?? undefined,
      freeCashflow: freeCashflow ?? undefined,
      bookValue: bookValue ?? undefined,
      eps: eps ?? undefined,
      per: per ?? undefined,
      pbv: pbv ?? undefined,
      psr: psr ?? undefined,
      evToEbitda: evEbitda ?? undefined,
      dividendYield: dividendYield ?? undefined,
      payoutRatio: payoutRatio ?? undefined,
    },
  };
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AnalysisView from "@/components/AnalysisView";
import { IDX_INDEX } from "@/data/idx-tickers";

export const dynamic = "force-dynamic";

function clean(raw: string): string {
  return decodeURIComponent(raw).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const ticker = clean((await params).ticker);
  const name = IDX_INDEX.get(ticker)?.name;
  return {
    title: `Analisis Saham ${ticker}${name ? ` — ${name}` : ""}`,
    description: `Analisis lengkap saham ${ticker}${
      name ? ` (${name})` : ""
    }: berita terkait, fundamental, teknikal, grafik, kepemilikan, validasi story & momentum, plus rekomendasi Dewan Analis.`,
  };
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const ticker = clean((await params).ticker);
  if (ticker === "IHSG" || ticker === "JKSE" || ticker === "JCI") redirect("/ihsg");
  return <AnalysisView ticker={ticker} />;
}

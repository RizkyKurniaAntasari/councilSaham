import { NextResponse } from "next/server";
import { IDX_TICKERS, POPULAR_TICKERS } from "@/data/idx-tickers";
import { searchSymbols } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SearchHit {
  ticker: string;
  name: string;
  sector?: string;
  source: "lokal" | "bursa";
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  if (!q) {
    const popular = POPULAR_TICKERS.map((code) => {
      const hit = IDX_TICKERS.find((t) => t.code === code);
      return { ticker: code, name: hit?.name ?? code, sector: hit?.sector, source: "lokal" as const };
    });
    return NextResponse.json({ results: popular });
  }

  const needle = q.toUpperCase();
  const local: SearchHit[] = IDX_TICKERS.filter(
    (t) => t.code.includes(needle) || t.name.toUpperCase().includes(needle),
  )
    .sort((a, b) => {
      const aStart = a.code.startsWith(needle) ? 0 : 1;
      const bStart = b.code.startsWith(needle) ? 0 : 1;
      return aStart - bStart || a.code.localeCompare(b.code);
    })
    .slice(0, 8)
    .map((t) => ({ ticker: t.code, name: t.name, sector: t.sector, source: "lokal" as const }));

  const seen = new Set(local.map((l) => l.ticker));
  const remote = await searchSymbols(q).catch(() => []);
  const fromExchange: SearchHit[] = remote
    .filter((r) => r.symbol.endsWith(".JK"))
    .map((r) => ({
      ticker: r.symbol.replace(".JK", ""),
      name: r.longname ?? r.shortname ?? r.symbol,
      sector: undefined,
      source: "bursa" as const,
    }))
    .filter((r) => !seen.has(r.ticker))
    .slice(0, 6);

  return NextResponse.json({ results: [...local, ...fromExchange] });
}

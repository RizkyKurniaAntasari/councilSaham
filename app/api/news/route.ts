import { NextResponse } from "next/server";
import { IDX_INDEX } from "@/data/idx-tickers";
import { fetchNews } from "@/lib/news";
import { normalizeTicker } from "@/lib/yahoo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = normalizeTicker(url.searchParams.get("ticker") ?? "");
  if (!ticker) {
    return NextResponse.json({ error: "Parameter ?ticker= wajib diisi." }, { status: 400 });
  }
  const name = url.searchParams.get("name") ?? IDX_INDEX.get(ticker)?.name ?? ticker;
  try {
    const news = await fetchNews(ticker, name);
    return NextResponse.json(news);
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal mengambil berita: ${err instanceof Error ? err.message : "tidak diketahui"}` },
      { status: 502 },
    );
  }
}

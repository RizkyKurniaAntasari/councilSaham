import { NextResponse } from "next/server";
import { getMarketNews, isMarketTopic } from "@/lib/marketnews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("topic") ?? "semua").toLowerCase();
  const topic = isMarketTopic(raw) ? raw : "semua";
  try {
    return NextResponse.json(await getMarketNews(topic), {
      headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memuat berita: ${err instanceof Error ? err.message : "kesalahan tidak diketahui"}` },
      { status: 502 },
    );
  }
}

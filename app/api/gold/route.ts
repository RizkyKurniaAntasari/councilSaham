import { NextResponse } from "next/server";
import { getGold } from "@/lib/gold";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const full = new URL(req.url).searchParams.get("full") === "1";
  try {
    const report = await getGold({ withCandles: full });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memuat data emas: ${err instanceof Error ? err.message : "kesalahan tidak diketahui"}` },
      { status: 502 },
    );
  }
}

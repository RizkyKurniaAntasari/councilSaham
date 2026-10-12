import { NextResponse } from "next/server";
import { runScreener } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runScreener();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memindai pasar: ${err instanceof Error ? err.message : "kesalahan tidak diketahui"}` },
      { status: 502 },
    );
  }
}

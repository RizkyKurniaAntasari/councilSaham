import { NextResponse } from "next/server";
import { analyze, TickerNotFoundError } from "@/lib/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  try {
    const result = await analyze(ticker);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    const notFound = err instanceof TickerNotFoundError;
    const looksMissing =
      notFound || (err instanceof Error && /404|chart kosong|tidak ada candle/i.test(err.message));
    const message = looksMissing
      ? `Ticker "${ticker.toUpperCase()}" tidak ditemukan di Bursa Efek Indonesia. Pastikan kode emiten sudah benar (contoh: ADMR, BBRI, TLKM).`
      : `Gagal mengambil data: ${err instanceof Error ? err.message : "kesalahan tidak diketahui"}`;
    return NextResponse.json({ error: message }, { status: looksMissing ? 404 : 502 });
  }
}

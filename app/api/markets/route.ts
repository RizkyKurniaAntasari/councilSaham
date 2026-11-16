import { NextResponse } from "next/server";
import { getMarkets, getNftFloors } from "@/lib/markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** `?nft=1` mengembalikan harga dasar koleksi NFT (sumber terpisah & lebih lambat). */
export async function GET(req: Request) {
  const nft = new URL(req.url).searchParams.get("nft") === "1";
  try {
    if (nft) {
      return NextResponse.json(
        { nfts: await getNftFloors() },
        { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
      );
    }
    return NextResponse.json(await getMarkets(), {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memuat data pasar: ${err instanceof Error ? err.message : "kesalahan tidak diketahui"}` },
      { status: 502 },
    );
  }
}

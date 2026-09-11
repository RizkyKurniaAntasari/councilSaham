import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyze";
import { llmEnabled } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Sintesis naratif Dewan Analis oleh Claude.
 * Dipanggil terpisah dari /api/analysis supaya halaman tampil dulu,
 * lalu lapisan AI menyusul begitu siap.
 */
export async function POST(req: Request) {
  if (!llmEnabled()) {
    return NextResponse.json(
      { enabled: false, message: "ANTHROPIC_API_KEY belum diset — dewan berjalan dengan rule engine saja." },
      { status: 200 },
    );
  }
  try {
    const body = (await req.json()) as { ticker?: string };
    if (!body.ticker) {
      return NextResponse.json({ error: "Field 'ticker' wajib diisi." }, { status: 400 });
    }
    const result = await analyze(body.ticker, { withAi: true });
    return NextResponse.json({
      enabled: true,
      ai: result.ai ?? null,
      council: result.council,
    });
  } catch (err) {
    return NextResponse.json(
      { enabled: true, error: `Sintesis AI gagal: ${err instanceof Error ? err.message : "tidak diketahui"}` },
      { status: 502 },
    );
  }
}

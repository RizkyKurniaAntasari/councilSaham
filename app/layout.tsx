import type { Metadata, Viewport } from "next";
import Link from "next/link";
import IhsgTicker from "@/components/IhsgTicker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AASaham — Analisis Saham IDX dengan Dewan Analis AI",
    template: "%s · AASaham",
  },
  description:
    "Analisis saham Bursa Efek Indonesia: berita terkini, fundamental, teknikal, chart, kepemilikan, deteksi momentum & validasi story, plus rekomendasi lengkap dari Dewan Analis.",
  keywords: ["saham", "IDX", "analisis saham", "BEI", "fundamental", "teknikal", "momentum", "story saham"],
  openGraph: {
    title: "AASaham — Analisis Saham IDX dengan Dewan Analis AI",
    description:
      "Cari emiten IDX, baca berita terkait, lihat analisis fundamental & teknikal, validasi story/momentum, dan dapatkan rekomendasi dari Dewan Analis.",
    type: "website",
    locale: "id_ID",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
            <Link href="/" className="group flex shrink-0 items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brandx to-bull text-sm font-black text-ink-950">
                AA
              </span>
              <span className="flex flex-col leading-none">
                <span className="hidden text-base font-bold tracking-tight text-white min-[420px]:block">AASaham</span>
                <span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 min-[420px]:block">
                  Analisis Saham IDX
                </span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 whitespace-nowrap text-sm">
              <Link
                href="/"
                className="hidden rounded-lg px-3 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white sm:inline-block"
              >
                Beranda
              </Link>
              <IhsgTicker />
              <Link
                href="/pasar"
                aria-label="Radar Pasar"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-200 transition hover:bg-white/10 hover:text-white sm:border-transparent sm:bg-transparent sm:font-normal sm:text-slate-300"
              >
                📡 <span className="hidden min-[420px]:inline">Radar </span>
                <span className="hidden sm:inline">Pasar</span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</main>

        <footer className="border-t border-white/10 bg-ink-950/60">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <p className="text-xs leading-relaxed text-slate-500">
              <strong className="text-slate-400">Disclaimer:</strong> AASaham adalah alat bantu riset dan
              edukasi. Seluruh skor, validasi story, dan rekomendasi dihasilkan otomatis dari data publik
              yang bisa saja tidak lengkap, tertunda, atau keliru. Ini bukan nasihat investasi. Keputusan
              jual/beli sepenuhnya tanggung jawab Anda — selalu verifikasi ke laporan resmi emiten,
              keterbukaan informasi IDX, dan penasihat berizin.
            </p>
            <p className="mt-3 text-xs text-slate-600">
              Sumber data: Yahoo Finance, Google News. Dibangun dengan Next.js.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

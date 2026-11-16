import type { Metadata } from "next";
import MarketNews from "@/components/MarketNews";

export const metadata: Metadata = {
  title: "Berita Pasar — IHSG, Emas & XAU, Indeks Global, NFT, Kripto",
  description:
    "Berita pasar terkini di luar emiten: IHSG, harga emas dan XAU/USD, indeks global (Wall Street, Nikkei, Hang Seng), NFT, kripto, serta ekonomi & rupiah — lengkap dengan ringkasan harga lintas aset.",
};

export default function BeritaPage() {
  return <MarketNews />;
}

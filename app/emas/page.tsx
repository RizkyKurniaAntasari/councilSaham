import type { Metadata } from "next";
import GoldView from "@/components/GoldView";

export const metadata: Metadata = {
  title: "Emas (XAU/USD) — Rekomendasi, Zona Beli, Stop & Target",
  description:
    "Analisis emas dunia XAU/USD: rekomendasi dengan alasan dan rincian skor, zona beli, stop loss, target, fase siklus, pengaruh dolar AS dan imbal hasil obligasi, serta harga emas per gram dalam rupiah.",
};

export default function EmasPage() {
  return <GoldView />;
}

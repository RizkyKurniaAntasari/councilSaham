import type { Metadata } from "next";
import IhsgView from "@/components/IhsgView";

export const metadata: Metadata = {
  title: "IHSG — Indeks Harga Saham Gabungan",
  description:
    "Analisis IHSG: grafik, fase siklus pasar (Akumulasi, Mark Up, Distribusi, Mark Down), skor teknikal dengan rincian, serta support & resistance indeks.",
};

export default function IhsgPage() {
  return <IhsgView />;
}

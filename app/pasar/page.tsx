import type { Metadata } from "next";
import MarketRadar from "@/components/MarketRadar";

export const metadata: Metadata = {
  title: "Radar Pasar — Saham Trending, Akumulasi & 4 Siklus",
  description:
    "Pemindai saham IDX: saham trending, saham dalam tahap akumulasi, pemetaan siklus Akumulasi–Mark Up–Distribusi–Mark Down, dan rekomendasi berbasis data.",
};

export default function PasarPage() {
  return <MarketRadar />;
}

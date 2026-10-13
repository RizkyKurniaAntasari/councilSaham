import type { Metadata } from "next";
import SiapMasuk from "@/components/SiapMasuk";

export const metadata: Metadata = {
  title: "Siap Masuk — Saham dengan Timing Entry Terkonfirmasi",
  description:
    "Daftar saham IDX yang timing entry-nya sudah terkonfirmasi (pola candlestick, pantulan MA/support, struktur MA) lengkap dengan alasan, zona beli, stop loss, target, dan risk/reward.",
};

export default function SiapMasukPage() {
  return <SiapMasuk />;
}

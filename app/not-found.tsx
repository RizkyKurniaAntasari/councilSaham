import Link from "next/link";
import SearchBar from "@/components/SearchBar";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-16 text-center">
      <p className="text-5xl">🧭</p>
      <h1 className="mt-5 text-2xl font-bold text-white">Halaman tidak ditemukan</h1>
      <p className="muted mt-2">
        Coba cari kode emiten IDX (contoh: ADMR) atau kembali ke beranda.
      </p>
      <div className="mt-8">
        <SearchBar size="lg" />
      </div>
      <Link href="/" className="btn-ghost mt-6">
        Kembali ke beranda
      </Link>
    </div>
  );
}

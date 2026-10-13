import Link from "next/link";
import IhsgCard from "@/components/IhsgCard";
import SearchBar from "@/components/SearchBar";
import { IDX_INDEX, POPULAR_TICKERS } from "@/data/idx-tickers";

const FEATURES = [
  {
    icon: "📡",
    title: "Radar Pasar: Trending & 4 Siklus",
    body: "Pindai seluruh emiten sekaligus: saham yang sedang trending, saham di tahap akumulasi, pemetaan siklus Akumulasi → Mark Up → Distribusi → Mark Down, plus rekomendasi berbasis data lengkap dengan entry, stop loss, dan target.",
  },
  {
    icon: "🔍",
    title: "Validasi Story & Momentum",
    body: "Fitur inti. Narasi yang beredar di berita tidak ditelan mentah — tiap story diuji lewat 9 pemeriksaan silang ke data harga, volume, dan laporan keuangan, lalu diberi vonis: tervalidasi, sebagian valid, lemah, atau mencurigakan.",
  },
  {
    icon: "⚖️",
    title: "Dewan Analis 7 Sudut Pandang",
    body: "Analis fundamental, teknikal, sentimen, validator story, manajer risiko, kontrarian, dan strategis portofolio menilai secara terpisah, berdebat, lalu menghasilkan satu rekomendasi dengan rencana aksi konkret.",
  },
  {
    icon: "📰",
    title: "Berita Terkait, Terfilter",
    body: "Berita dikumpulkan dari agregator Indonesia, disaring relevansinya terhadap emiten, lalu diberi skor sentimen memakai leksikon pasar modal berbahasa Indonesia — bukan kamus sentimen bahasa Inggris.",
  },
  {
    icon: "📊",
    title: "Fundamental Bergradasi",
    body: "PER, PBV, ROE, ROA, DER, margin, pertumbuhan, arus kas bebas, dividend yield — masing-masing diberi skor terhadap patokan wajar IDX, bukan sekadar ditampilkan sebagai angka mentah.",
  },
  {
    icon: "📈",
    title: "Teknikal & Grafik Interaktif",
    body: "Candlestick dengan MA20/MA50, volume, level support & resistance hasil deteksi swing pivot, plus RSI, MACD, Bollinger, ATR, ADX, OBV, dan stochastic yang dihitung sendiri di server.",
  },
  {
    icon: "🏛️",
    title: "Kepemilikan & Manajemen",
    body: "Struktur pemegang saham, porsi institusi & insider, transaksi orang dalam, serta jajaran direksi dan komisaris — supaya Anda tahu siapa yang mengendalikan perusahaan.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Ketik kode saham",
    body: "Masukkan kode 4 huruf emiten IDX seperti ADMR, BBRI, atau TLKM. Autocomplete membantu jika Anda hanya ingat namanya.",
  },
  {
    n: "02",
    title: "Data dikumpulkan & dihitung",
    body: "Sistem menarik harga 2 tahun, laporan keuangan, kepemilikan, dan berita terbaru, lalu menghitung puluhan indikator secara paralel.",
  },
  {
    n: "03",
    title: "Story divalidasi silang",
    body: "Narasi dari berita diuji terhadap pergerakan harga, lonjakan volume, dan angka fundamental. Yang tidak lolos ditandai.",
  },
  {
    n: "04",
    title: "Dewan memutuskan",
    body: "Tujuh analis memberi skor dan argumen, digabung dengan bobot sesuai kualitas data, menghasilkan rekomendasi lengkap dengan entry, stop loss, target, dan ukuran posisi.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <section className="text-center">
        <span className="chip mx-auto">🇮🇩 Khusus emiten Bursa Efek Indonesia</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
          Analisis saham IDX yang{" "}
          <span className="bg-gradient-to-r from-brandx to-bull bg-clip-text text-transparent">
            membuktikan storynya
          </span>
          , bukan cuma mengulang beritanya.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-400">
          Cari satu kode saham, dapatkan berita terkait, analisis fundamental, teknikal, grafik, struktur
          kepemilikan, deteksi momentum, validasi story lintas data, dan rekomendasi lengkap dari Dewan
          Analis.
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <SearchBar size="lg" autoFocus />
        </div>

        <div className="mx-auto mt-6 max-w-2xl text-left">
          <IhsgCard />
        </div>

        <div className="mt-5">
          <Link href="/pasar" className="btn-ghost">
            📡 Buka Radar Pasar — saham trending, akumulasi & 4 siklus
          </Link>
        </div>

        <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-slate-500">Coba:</span>
          {POPULAR_TICKERS.slice(0, 8).map((t) => (
            <Link
              key={t}
              href={`/saham/${t}`}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-brandx/50 hover:bg-brandx/10 hover:text-white"
              title={IDX_INDEX.get(t)?.name}
            >
              {t}
            </Link>
          ))}
        </div>
      </section>

      {/* Fitur */}
      <section>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Tujuh lapis analisis, dari satu emiten sampai seluruh pasar
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
          Setiap lapisan menghasilkan skor 0–100 yang bisa ditelusuri alasannya — tidak ada angka yang muncul
          tanpa penjelasan.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card card-pad transition hover:border-white/20 hover:bg-ink-900/90"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-xl">{f.icon}</span>
              <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cara kerja */}
      <section className="card card-pad">
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">Cara kerjanya</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="text-3xl font-black text-white/10">{s.n}</span>
              <h3 className="mt-1 text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Validasi story - penjelasan */}
      <section className="card card-pad">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <span className="chip">Fitur unggulan</span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
              Sembilan uji untuk membuktikan sebuah story
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Di pasar, harga sering bergerak lebih dulu lalu ceritanya dikarang belakangan. Karena itu setiap
              narasi yang terdeteksi dari pemberitaan diuji terhadap bukti yang tidak bisa dikarang: tape
              harga, volume transaksi, dan angka di laporan keuangan.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { label: "✅ Tervalidasi", cls: "border-bull/30 bg-bull/10 text-bull" },
                { label: "🟡 Sebagian valid", cls: "border-brandx/30 bg-brandx/10 text-brandx" },
                { label: "⏳ Belum tervalidasi", cls: "border-warn/30 bg-warn/10 text-warn" },
                { label: "⚠️ Lemah", cls: "border-bear/30 bg-bear/10 text-bear" },
                { label: "🚨 Mencurigakan", cls: "border-bear/50 bg-bear/15 text-bear" },
              ].map((v) => (
                <span
                  key={v.label}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${v.cls}`}
                >
                  {v.label}
                </span>
              ))}
            </div>
          </div>

          <ol className="space-y-3">
            {[
              ["Liputan media", "Berapa banyak artikel, dari berapa sumber berbeda?"],
              ["Kesegaran informasi", "Masih hangat atau sudah basi?"],
              ["Konfirmasi harga", "Apakah harga bergerak sesuai arah narasi sejak story muncul?"],
              ["Konfirmasi volume", "Apakah partisipasi pasar benar-benar meningkat?"],
              ["Dukungan fundamental", "Apakah angka laporan keuangan mendukung klaimnya?"],
              ["Konsistensi sumber", "Apakah sumber-sumber kompak atau saling bertentangan?"],
              ["Daya tahan narasi", "Bertahan berminggu-minggu atau riak satu hari?"],
              ["Keselarasan teknikal", "Apakah struktur grafik searah dengan narasi?"],
              ["Kualitas tema", "Katalis spesifik emiten, atau sekadar obrolan pasar harian?"],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brandx/15 text-xs font-bold text-brandx">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-100">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Daftar emiten populer */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-white">Mulai dari emiten populer</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {POPULAR_TICKERS.map((code) => {
            const info = IDX_INDEX.get(code);
            return (
              <Link
                key={code}
                href={`/saham/${code}`}
                className="card flex items-center gap-3 p-4 transition hover:border-brandx/40 hover:bg-ink-900/90"
              >
                <span className="grid h-11 w-16 shrink-0 place-items-center rounded-xl bg-brandx/15 text-sm font-bold tracking-wide text-brandx">
                  {code}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-100">
                    {info?.name ?? code}
                  </span>
                  <span className="block text-xs text-slate-500">{info?.sector ?? "IDX"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-warn/25 bg-warn/6 p-6">
        <h2 className="text-base font-semibold text-warn">Sebelum Anda memakai ini untuk transaksi</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/75">
          AASaham menghitung dari data publik yang bisa tertunda atau tidak lengkap, dan seluruh skor
          dihasilkan oleh aturan otomatis. Anggap ini sebagai pendapat kedua yang terstruktur, bukan
          kebenaran. Rekomendasi di sini bukan nasihat investasi, tidak mempertimbangkan kondisi keuangan
          maupun toleransi risiko Anda, dan tidak menjamin hasil apa pun. Selalu verifikasi ke laporan
          keuangan resmi dan keterbukaan informasi IDX sebelum mengambil keputusan.
        </p>
      </section>
    </div>
  );
}

# AASaham — Analisis Saham IDX dengan Dewan Analis

Aplikasi Next.js untuk menganalisis emiten Bursa Efek Indonesia. Cari satu kode saham (mis. `ADMR`), lalu dapatkan:

- **Berita terkait** yang sudah disaring relevansinya dan diberi skor sentimen memakai leksikon pasar modal berbahasa Indonesia
- **Analisis fundamental** bergradasi (PER, PBV, ROE, ROA, DER, margin, pertumbuhan, FCF, dividend yield) dengan skor per metrik terhadap patokan wajar IDX
- **Analisis teknikal** lengkap (MA, RSI, MACD, Bollinger, ATR, ADX, OBV, Stochastic, VWAP, support/resistance dari swing pivot)
- **Grafik interaktif** candlestick + volume + MA + level S/R, dengan pemilih rentang dan crosshair
- **Kepemilikan & manajemen** — pemegang saham besar, porsi institusi/insider, transaksi orang dalam, direksi & komisaris
- **Deteksi momentum & validasi story** — fitur inti
- **Rekomendasi Dewan Analis** — 7 sudut pandang, digabung dengan bobot, lengkap dengan rencana aksi
- **Siklus saham (Wyckoff)** — posisi emiten dalam 4 siklus: Akumulasi, Mark Up, Distribusi, Mark Down
- **Radar Pasar** (`/pasar`) — saham trending, saham di tahap akumulasi, peta 4 siklus, dan rekomendasi berbasis data untuk seluruh daftar emiten

## Timing Beli — pola candlestick & struktur MA

Saham yang bagus belum tentu harus dibeli hari ini. Panel **Timing Beli** di halaman saham (dan tab **Sinyal Beli** di Radar Pasar) menilai kesiapan entry dari:

- **Struktur MA** — posisi harga terhadap MA20/50/200, penembusan terbaru, dan penolakan (mis. *"menembus MA20 2 hari lalu tetapi tertahan MA50 Rp X"*).
- **Pola candlestick** (`lib/candles.ts`) — Hammer, Inverted Hammer, Dragonfly Doji, Bullish Engulfing, Piercing Line, Bullish Harami, Morning Star, Three White Soldiers, serta pola bearish Shooting Star, Bearish Engulfing, Dark Cloud Cover, Evening Star. Pola hanya dihitung bila lokasinya tepat (setelah turun/naik atau saat menguji MA/support), lalu dinilai konfirmasi volume dan konfirmasi candle berikutnya.
- **Perlawanan pembeli** — ekor bawah panjang, higher low, support yang bertahan, volume hari naik vs turun.

Vonisnya *Siap Beli* (pola/pantulan sudah terkonfirmasi atau struktur kuat dekat MA20), *Tunggu Konfirmasi*, *Belum Ada Setup*, atau *Hindari Dulu*. Pola ditandai ▲/▼ di grafik; pola bearish yang sudah terealisasi (harga turun ≥ 0,75×ATR di bawahnya) tidak lagi dihitung.

Syarat selalu berbentuk **skenario** yang konsisten — syarat, zona beli, stop, target, dan R/R dihitung bersama:

- **Pantulan** — beli dekat harga sekarang setelah pembalikan dikonfirmasi (mis. *tutup di atas high candle pantulan dari MA50*). Bila harga sudah > 8% dari MA20, skenarionya pullback ke MA20.
- **Tembus** — beli di zona *baru* tepat di atas MA/resistance yang ditembus, dengan stop & target yang dihitung ulang.

**Zona beli ideal, bukan harga terakhir.** Batas atas zona = stop + (TP1 − stop) ÷ 3 — harga tertinggi yang masih memberi R/R 1:2 — dengan stop di bawah penopang struktural dan target dari resistance (atau proyeksi dari penopang, bukan dari harga). Saham yang sudah naik melewati zona tidak divalidasi sebagai *Siap Beli*; skenarionya menjadi **Antre beli di zona ideal**. Zona skenario pantulan/tembus juga dipangkas ke batas R/R 1:2, dan skenario yang tidak memungkinkan R/R itu dilewati.

### Siap Masuk (`/siap-masuk`)

Daftar terpisah berisi saham yang timing-nya **sudah** Siap Beli, rekomendasinya bukan Ambil Untung/Hindari, R/R ≥ 1:1,2, dan likuid — lengkap dengan alasan, zona beli, stop loss, target, ukuran posisi, dan batas validitas setup. Bagian *Hampir siap* menampilkan saham yang tinggal satu pemicu (≤ 3% dari harga) dengan R/R ≥ 1:1,5.

## IHSG

Halaman `/ihsg` (juga lewat pencarian "IHSG" / "JCI") menampilkan IDX Composite (`^JKSE`): grafik, return 5H–1 tahun & YTD, fase siklus pasar, skor teknikal dengan rinciannya, serta support/resistance. Nilai IHSG tampil di header setiap halaman. Di halaman saham, blok **Kinerja vs IHSG** menunjukkan selisih return saham terhadap indeks (20H, 60H, 1 tahun); selisih 60H > +5 poin menambah 3 poin skor rekomendasi data, < −5 poin mengurangi 3 poin.

## Radar Pasar & 4 Siklus Saham

Halaman `/pasar` memindai OHLCV 1 tahun seluruh emiten di `data/idx-tickers.ts` (hasil di-cache 10 menit), lalu menyajikan:

| Tab | Isi |
|-----|-----|
| 🎯 Rekomendasi | Peringkat aksi (Beli, Beli Bertahap, Pantau, Ambil Untung, Hindari) + area entry, stop loss, target, risk/reward |
| 🚀 Trending Naik | Khusus saham yang naik: kenaikan 1–20 hari, volume yang didominasi hari naik (bukan volume jual), breakout 20 hari, penutupan kuat; RSI > 80 diberi penalti |
| 🔥 Trending (Semua) | Lonjakan volume 5 hari vs 3 bulan, nilai transaksi, gerak harga 1 & 5 hari, breakout 20 hari |
| 🧲 Tahap Akumulasi | Emiten berfase Akumulasi diurutkan menurut skor akumulasi (probabilitas fase + Chaikin Money Flow + rasio volume naik/turun) |
| 🔄 4 Siklus | Papan kanban seluruh emiten per fase |

Deteksi fase (`lib/cycle.ts`) menilai tiap fase dari struktur tren (harga vs MA50/MA200, kemiringan MA50, higher high/lower low), konteks tren sebelumnya, aliran dana (CMF 40 hari, volume hari naik vs turun), ADX, dan posisi dalam rentang 52 minggu. Skor dinormalisasi jadi probabilitas, dilengkapi sub-tahap (mis. *Spring*, *Sign of Strength*, *Upthrust*, *Kapitulasi*), lama fase, riwayat fase ±1 tahun, serta pemicu & pembatal menuju fase berikutnya. Rekomendasi (`lib/recommend.ts`) menggabungkan fase tersebut dengan momentum, konfirmasi volume, dan likuiditas. Panel yang sama juga muncul di halaman analisis tiap emiten.

### Rencana transaksi & perhitungan yang bisa diperiksa

Seluruh level harga (zona entry, stop loss, target, syarat beli kembali) berasal dari satu mesin, `lib/tradeplan.ts`, sehingga Dewan Analis, panel Siklus, panel Teknikal, dan Radar Pasar selalu menampilkan angka yang sama. Setiap level:

- dibulatkan ke fraksi harga BEI (stop & target dibulatkan ke bawah) dan mencatat pembulatannya,
- membawa rumusnya, mis. *"Support Rp 2.910 − 0,25×ATR"* atau *"Resistance pertama dengan ruang ≥ 1,5×ATR"*,
- dihitung R/R-nya dari tengah zona entry; bila R/R < 1 aksi diturunkan ke *Pantau* dan disarankan antre di batas bawah zona.

Ukuran posisi berbasis risiko: `1% portofolio ÷ jarak stop × faktor keyakinan` (maks. 25%). Skor Dewan, skor teknikal, dan skor rekomendasi data masing-masing punya rincian poin yang totalnya sama dengan skor akhir.

## Fitur inti: validasi story & momentum

Narasi dari berita tidak ditelan mentah. Setiap story yang terdeteksi diuji lewat **9 pemeriksaan silang**:

| # | Uji | Pertanyaan yang dijawab |
|---|-----|--------------------------|
| 1 | Liputan media | Berapa artikel, dari berapa sumber berbeda? |
| 2 | Kesegaran informasi | Masih hangat atau sudah basi? |
| 3 | Konfirmasi harga | Harga bergerak sesuai arah narasi sejak story muncul? |
| 4 | Konfirmasi volume | Partisipasi pasar benar-benar meningkat? |
| 5 | Dukungan fundamental | Angka laporan keuangan mendukung klaimnya? |
| 6 | Konsistensi sumber | Sumber kompak atau saling bertentangan? |
| 7 | Daya tahan narasi | Bertahan berminggu-minggu atau riak sehari? |
| 8 | Keselarasan teknikal | Struktur grafik searah dengan narasi? |
| 9 | Kualitas tema | Katalis spesifik emiten, atau sekadar obrolan pasar harian? |

Hasilnya salah satu vonis: **Tervalidasi**, **Sebagian valid**, **Belum tervalidasi**, **Lemah**, atau **Mencurigakan** (harga sudah lari jauh melampaui bukti pendukungnya — indikasi penggerakan harga).

## Dewan Analis

Tujuh anggota menilai secara terpisah lalu suaranya digabung dengan bobot yang **otomatis turun saat datanya tidak tersedia** — kekosongan data menurunkan keyakinan, bukan dipoles jadi angka palsu.

| Anggota | Fokus |
|---------|-------|
| 📊 Analis Fundamental | Kualitas bisnis, valuasi, kesehatan neraca |
| 📈 Analis Teknikal | Tren, momentum harga, level kunci |
| 📰 Analis Sentimen & Berita | Nada dan intensitas pemberitaan |
| 🔍 Validator Momentum & Story | Apakah narasi didukung data |
| 🛡️ Manajer Risiko | Volatilitas, leverage, likuiditas |
| 🎯 Kontrarian | Menantang konsensus |
| 🧭 Strategis Portofolio | Konteks portofolio & horizon |

Output akhir: skor 0–100, sikap (Akumulasi Kuat → Jual), tingkat keyakinan, konsensus, plus rencana aksi (horizon, entry, stop loss, target, ukuran posisi, pembatal tesis).

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000. **Tidak perlu API key** — seluruh analisis berjalan penuh tanpa konfigurasi tambahan.

## Deploy ke Vercel lewat GitHub

1. Buat repo baru di GitHub, lalu:

```bash
git init && git add -A && git commit -m "AASaham: platform analisis saham IDX"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```

2. Buka [vercel.com/new](https://vercel.com/new), import repo tersebut.
3. Vercel mendeteksi Next.js otomatis — biarkan semua setelan default, klik **Deploy**.
4. (Opsional) tambahkan environment variable di **Settings → Environment Variables**.

Region function sudah diset ke `sin1` (Singapura) di `vercel.json` agar latensi ke sumber data lebih rendah dari Indonesia.

## Environment variables (semuanya opsional)

| Variabel | Guna |
|----------|------|
| `ANTHROPIC_API_KEY` | Mengaktifkan lapisan sintesis naratif Dewan Analis oleh Claude. Tanpa ini, dewan tetap berjalan penuh memakai rule engine. |
| `COUNCIL_MODEL` | Model Claude yang dipakai. Default `claude-opus-5`. |
| `NEWSAPI_KEY` | Sumber berita tambahan dari NewsAPI.org sebagai pelengkap Google News RSS. |
| `CACHE_TTL` | TTL cache in-memory dalam detik. Default `300`. |

Salin `.env.example` menjadi `.env.local` untuk pengembangan lokal.

### Catatan tentang integrasi Claude

Pemanggilan Claude memakai `client.messages.create` biasa dengan instruksi format JSON di system prompt (bukan `output_config`/`betas`), supaya kode tidak pecah saat tipe SDK berubah antar versi. Konsekuensinya, *server-side refusal fallback* tidak dipasang; bila responsnya ditolak atau gagal diparse, aplikasi otomatis kembali ke narasi rule engine tanpa error ke pengguna. Semua pemanggilan dibungkus `try/catch` dan lapisan AI bersifat aditif — tidak pernah memblokir tampilan analisis utama.

## Sumber data

| Data | Sumber |
|------|--------|
| Harga & OHLCV (2 tahun) | Yahoo Finance chart API |
| Laporan keuangan, kepemilikan, profil | Yahoo Finance quoteSummary |
| Berita | Google News RSS (`hl=id&gl=ID`), opsional NewsAPI.org |
| Indikator teknikal | Dihitung sendiri di server (`lib/indicators.ts`) |

Semua request di-cache di memori per instance (TTL 3–15 menit) dengan dedupe request paralel, sehingga beberapa pengguna yang membuka ticker sama tidak menembak sumber berkali-kali.

## Struktur proyek

```
app/
  page.tsx                    Landing page
  saham/[ticker]/page.tsx     Halaman analisis
  api/analysis/[ticker]/      Endpoint analisis lengkap
  api/council/                Sintesis naratif AI (opsional)
  api/news/                   Endpoint berita saja
  api/search/                 Autocomplete ticker
components/                   Panel UI (chart, dewan, story, teknikal, dll)
lib/
  yahoo.ts        Pengambilan data + cookie/crumb Yahoo
  indicators.ts   Matematika indikator murni
  technical.ts    Skor & sinyal teknikal
  fundamental.ts  Skor fundamental per metrik
  news.ts         Pengambilan & penilaian berita
  sentiment.ts    Leksikon sentimen + tema (bahasa Indonesia)
  story.ts        Deteksi momentum & validasi story
  council.ts      Rule engine Dewan Analis
  llm.ts          Lapisan sintesis Claude (opsional)
  analyze.ts      Orkestrator
data/idx-tickers.ts           Daftar emiten untuk autocomplete
```

## Keterbatasan yang perlu Anda tahu

- Data berasal dari sumber gratis yang bisa **tertunda, tidak lengkap, atau keliru** — terutama untuk emiten kecil dan yang baru IPO. Endpoint Yahoo tidak resmi dan bisa berubah sewaktu-waktu; bila fundamental gagal diambil, aplikasi tetap jalan dengan bobot suara yang diturunkan.
- Sentimen dihitung berbasis leksikon, jadi **sarkasme dan konteks halus bisa terlewat**.
- Cache bersifat in-memory per instance serverless, sehingga tidak dibagi antar instance Vercel.
- Data struktur kepemilikan untuk emiten IDX sering kosong di sumber gratis. Rujukan resmi: laporan tahunan emiten dan data KSEI.

## Disclaimer

AASaham adalah alat bantu riset dan edukasi. Seluruh skor, validasi story, dan rekomendasi dihasilkan otomatis dari data publik. **Ini bukan nasihat investasi** dan tidak mempertimbangkan kondisi keuangan maupun toleransi risiko Anda. Keputusan jual/beli sepenuhnya tanggung jawab Anda — selalu verifikasi ke laporan resmi emiten, keterbukaan informasi IDX, dan penasihat berizin.

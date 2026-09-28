# Jarkoman

Halaman ajakan mabar (jarkoman) untuk **VALORANT**, **CS2**, **Mobile Legends: Bang Bang**, dan **R.E.P.O.**, lengkap dengan dashboard admin. Setiap game punya tampilan sendiri: font, warna, layout, dan animasi yang diambil dari identitas game itu. Pemain konfirmasi lewat WhatsApp ke **0882-2336-7352** (bisa diganti per jarkoman).

Riset, arah desain, dan alasan tiap keputusan ada di [`docs/PLAN.md`](docs/PLAN.md).

## Isi

| Halaman | Fungsi |
|---|---|
| `/` | Jarkoman utama: judul, jadwal, hitung mundur, detail match, skuad, form konfirmasi ke WhatsApp, simpan ke kalender, bagikan, jadwal lain |
| `/?id=<id>` | Jarkoman tertentu (link ini yang dibagikan ke grup) |
| `/admin/` | Dashboard: login, buat/duplikat/hapus jarkoman, ganti game, judul, jadwal, mode, map, rank, pemain, catatan, nomor WA, gambar latar, preview langsung, teks siap tempel untuk grup WA, ekspor/impor cadangan |

Tema per game:

| Game | Font | Ciri |
|---|---|---|
| VALORANT | Anton + Barlow | Ink/bone, merah `#FF4655`, wipe diagonal, kartu agent select, tombol LOCK IN, varian terang/gelap |
| CS2 | Saira Stencil One + Rajdhani + Noto Sans | HUD (skor, timer ronde), pola recoil AK-47, radar, scoreboard, buy menu, sisi T/CT |
| MLBB | Cinzel + Kanit | Emas metalik, lineup ala loading screen, peta 3 lane, callout FIRST BLOOD sampai SAVAGE sesuai jumlah pemain, blue/red side |
| R.E.P.O. | Teko + VT323 + Archivo Narrow | Senter mengikuti kursor, monitor CRT truk, semibot berwarna, kuota hazard, mode lampu nyala |

## Deploy ke Netlify lewat GitHub

1. Pastikan kode ada di GitHub (repo ini). Kalau kerja di branch lain, gabungkan ke `main` atau atur branch produksi di Netlify.
2. Buka [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → pilih GitHub → pilih repo `Jarkoman_Repo`.
3. Pengaturan build otomatis terbaca dari `netlify.toml` (build `npm run build`, publish `dist`, Node 22). Tidak perlu diubah.
4. Sebelum atau sesudah deploy pertama, buka **Site configuration → Environment variables** dan tambahkan:
   - `ADMIN_PASSWORD` = password untuk masuk dashboard (wajib).
   - `JARKOMAN_SECRET` = string acak panjang (opsional, untuk menandatangani token login).
5. Deploy (atau **Trigger deploy** kalau variabel ditambahkan setelah deploy pertama).
6. Buka `https://<nama-situs>.netlify.app/admin/`, login, atur jarkoman, lalu tekan **Publikasikan**.

Tidak ada database yang perlu disiapkan: data disimpan di **Netlify Blobs**, yang aktif otomatis di situs Netlify.

## Cara pakai singkat

1. Di dashboard, pilih game (tampilan halaman langsung berubah di preview).
2. Isi judul, tanggal, jam, zona waktu, mode, map, rank, host, lobby, dan link voice.
3. Tambahkan pemain yang sudah konfirmasi. Tandai "Belum pasti" kalau masih ragu. Pemain di luar jumlah slot otomatis jadi cadangan.
4. Tekan **Simpan** (atau Ctrl/Cmd + S).
5. Tekan **Teks untuk grup WA**: salin teks jarkoman, atau langsung kirim lewat WhatsApp. Link di teks itu membuka halaman jarkoman dengan preview gambar sesuai game.

Status "slot penuh", "lagi main", dan "selesai" dihitung otomatis dari jumlah pemain dan jam. Status "dibatalkan" diset manual.

## Gambar game

- Artwork utama tiap tema digambar dengan kode (SVG/CSS), jadi halaman selalu utuh walaupun sumber gambar luar sedang mati.
- Gambar resmi diambil saat runtime oleh function `/api/media`, lalu di-cache CDN Netlify:
  - VALORANT: [valorant-api.com](https://valorant-api.com) (splash map dan portrait agent).
  - CS2 dan R.E.P.O.: Steam (`appdetails` app 730 dan 3241660).
  - MLBB: App Store (iTunes Lookup, app 1160056295).
- Di dashboard bagian **Gambar latar**, pilih "Otomatis", pilih dari galeri resmi, atau tempel URL gambar sendiri.

## Preview link di WhatsApp

`netlify/edge-functions/og.ts` mengganti judul, deskripsi, dan gambar preview khusus untuk bot (WhatsApp, Telegram, Discord, dll), sesuai jarkoman yang dibuka. Gambar preview ada di `public/og/`. WhatsApp menyimpan cache preview; kalau preview lama masih muncul, bagikan link dengan tambahan parameter, misalnya `...?id=abc&v=2`.

## Menjalankan di komputer

```bash
npm install
npm run dev        # http://localhost:5173 , admin di /admin/
```

Mode dev menjalankan handler Functions yang sama dengan penyimpanan file di `.data/`. Password admin lokal adalah `admin`, atau isi `ADMIN_PASSWORD` di file `.env` (contoh di `.env.example`). Galeri gambar resmi butuh akses internet ke sumber di atas.

Perintah lain:

```bash
npm test           # unit test (waktu/zona, pesan WA, kalender, sanitasi, login, simpan, konflik, media, edge function)
npm run typecheck
npm run build
npm run preview    # menyajikan hasil build, API tetap jalan
```

## Struktur

```
index.html, admin/index.html   entri halaman publik dan admin
src/shared/                    logika bersama (tipe, katalog game, waktu, WA, kalender, sanitasi, API client)
src/public/                    halaman publik, komponen bersama, dan 4 tema di src/public/themes/
src/admin/                     dashboard admin
netlify/functions/             /api/state, /api/login, /api/media (Netlify Functions v2)
netlify/lib/                   auth token, penyimpanan Blobs, sumber media
netlify/edge-functions/og.ts   meta preview link untuk bot
public/og/                     gambar preview link per game
tests/                         unit test (Vitest)
docs/PLAN.md                   riset, desain, dan rencana
```

## Keamanan

- Password hanya dicek di server (Netlify Function). Token login ditandatangani HMAC-SHA256 dan berlaku 7 hari; mengganti `ADMIN_PASSWORD` membatalkan semua token lama.
- Semua data dari dashboard divalidasi ulang di server (panjang teks, URL hanya http/https, jumlah slot, dll).
- Simpan dari dua perangkat sekaligus tidak saling menimpa diam-diam: dashboard menampilkan pilihan saat ada versi lebih baru.

## Catatan

- Ikon situs (`public/favicon.svg`) masih placeholder berupa huruf "JK". Ganti dengan logo sendiri kalau ada.
- Ini proyek fan non-komersial, tidak berafiliasi dengan Riot Games, Valve, Moonton, atau semiwork. Nama dan aset game milik pemiliknya masing-masing.

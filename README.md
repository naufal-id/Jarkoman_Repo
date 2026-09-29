# Jarkoman

Halaman ajakan mabar (jarkoman) untuk **VALORANT**, **CS2**, **Mobile Legends: Bang Bang**, dan **R.E.P.O.**, lengkap dengan dashboard admin. Setiap game punya tampilan sendiri: font, warna, layout, dan animasi yang diambil dari identitas game itu. Pemain konfirmasi lewat WhatsApp

Riset, arah desain, dan alasan tiap keputusan ada di [`docs/PLAN.md`](docs/PLAN.md).

## Isi

| Halaman     | Fungsi                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | Jarkoman utama: judul, jadwal, hitung mundur, detail match, skuad, form konfirmasi ke WhatsApp, simpan ke kalender, bagikan, jadwal lain                                                                            |
| `/?id=<id>` | Jarkoman tertentu (link ini yang dibagikan ke grup)                                                                                                                                                                 |
| `/admin/`   | Dashboard: login, buat/duplikat/hapus jarkoman, ganti game, judul, jadwal, mode, map, rank, pemain, catatan, nomor WA, gambar utama, musik, preview langsung, teks siap tempel untuk grup WA, ekspor/impor cadangan |

Tema per game:

| Game     | Font                                     | Ciri                                                                                                                                            |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| VALORANT | Anton + Barlow                           | Key art di panel diagonal bertepi merah, ink/bone, kartu agent select, tombol LOCK IN, varian terang/gelap                                      |
| CS2      | Saira Stencil One + Rajdhani + Noto Sans | Key art di layar ber-HUD dengan pola recoil AK-47, latar cahaya oranye dari key art, radar, scoreboard, buy menu, sisi T/CT                     |
| MLBB     | Cinzel + Kanit                           | Poster sebagai banner lobby yang memudar ke biru malam, emas metalik, lineup ala loading screen, peta 3 lane, callout FIRST BLOOD sampai SAVAGE |
| R.E.P.O. | Teko + VT323 + Archivo Narrow            | Key art diputar di monitor CRT truk, senter mengikuti kursor, semibot bermata besar, kuota hazard, mode lampu nyala                             |

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
3. Pilih cara pemain masuk skuad (lihat bagian berikut). Kamu tetap bisa menambah pemain sendiri. Tandai "Belum pasti" kalau masih ragu. Pemain di luar jumlah slot otomatis jadi cadangan.
4. Tekan **Simpan** (atau Ctrl/Cmd + S).
5. Tekan **Teks untuk grup WA**: salin teks jarkoman, atau langsung kirim lewat WhatsApp. Link di teks itu membuka halaman jarkoman dengan preview gambar sesuai game.

Status "slot penuh", "lagi main", dan "selesai" dihitung otomatis dari jumlah pemain dan jam. Status "dibatalkan" diset manual.

## Pemain masuk skuad sendiri (LOCK IN)

Di dashboard bagian **Skuad**, setiap jarkoman punya pilihan **Cara pemain masuk skuad**:

| Pilihan                         | Yang terjadi saat pengunjung menekan tombol utama (LOCK IN, SIAP TEMPUR, dst.)                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Langsung lewat website (bawaan) | Nama, role, dan pick langsung masuk skuad jarkoman itu dan tampil di halaman. Kalau slot penuh, masuk cadangan. Host tidak perlu menginput. Kabari host lewat WhatsApp jadi opsional |
| Lewat WhatsApp, diisi host      | Tombol membuka WhatsApp dengan pesan konfirmasi, lalu host memasukkan pemain sendiri (cara lama)                                                                                     |

- Pendaftaran selalu terikat ke satu jarkoman (lewat id-nya). Form di jarkoman lain tetap kosong.
- Nama yang sama tidak bisa didaftarkan dua kali di satu jarkoman.
- Pemain bisa **Batal ikut** dari perangkat yang dipakai mendaftar. Perangkat lain tidak bisa membatalkan pendaftaran orang lain.
- Pendaftar baru muncul di dashboard dalam hitungan detik dengan label "Daftar lewat website", tanpa membuang perubahan yang sedang kamu edit. Menyimpan draft lama juga tidak menghapus pendaftar yang masuk setelahnya.

## Musik

Tiap jarkoman bisa punya musik, diatur di dashboard bagian **Musik**:

| Pilihan      | Keterangan                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Musik bawaan | Lagu orisinal per game yang disintesis langsung di browser (tanpa file): "Protocol" (VALORANT), "Freeze Time" (CS2), "Land of Dawn" (MLBB), "Night Shift" (R.E.P.O.). Ikut berganti kalau game diganti |
| Upload lagu  | MP3, M4A, OGG, WAV, atau FLAC maksimal 4,5 MB, disimpan di Netlify Blobs dan diputar berulang. Pakai lagu yang boleh kamu gunakan                                                                      |
| Link audio   | Link langsung ke file audio (`https://…/lagu.mp3`). Link YouTube/Spotify tidak bisa dipakai sebagai musik latar                                                                                        |
| Tanpa musik  | Tombol musik tidak ditampilkan                                                                                                                                                                         |

Musik tidak pernah berbunyi sendiri (browser juga memblokir itu). Pengunjung menyalakannya lewat tombol musik di kiri bawah; kalau pernah dinyalakan, musik lanjut setelah klik pertama di kunjungan berikutnya. Musik berhenti saat tab disembunyikan. Lagu upload yang tidak dipakai lagi dihapus otomatis setelah 24 jam saat admin menyimpan.

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
npm test           # unit test (waktu/zona, pesan WA, kalender, sanitasi, login, simpan, konflik, pendaftaran langsung, media, audio, edge function)
npm run typecheck
npm run build
npm run preview    # menyajikan hasil build, API tetap jalan
```

## Struktur

```
index.html, admin/index.html   entri halaman publik dan admin
src/shared/                    logika bersama (tipe, katalog game, waktu, WA, kalender, sanitasi, API client)
src/public/                    halaman publik, komponen bersama, dan 4 tema di src/public/themes/
src/public/audio/              engine musik bawaan (Web Audio) dan pemutar file
src/admin/                     dashboard admin
public/games/                  key art keempat game (WebP)
netlify/functions/             /api/state, /api/login, /api/join, /api/media, /api/audio (Netlify Functions v2)
netlify/lib/                   auth token, penyimpanan Blobs, sumber media
netlify/edge-functions/og.ts   meta preview link untuk bot
public/og/                     gambar preview link per game
tests/                         unit test (Vitest)
docs/PLAN.md                   riset, desain, dan rencana
```

## Keamanan

- Password hanya dicek di server (Netlify Function). Token login ditandatangani HMAC-SHA256 dan berlaku 7 hari; mengganti `ADMIN_PASSWORD` membatalkan semua token lama.
- Semua data dari dashboard divalidasi ulang di server (panjang teks, URL hanya http/https, jumlah slot, dll).
- Upload lagu butuh login admin, hanya menerima tipe audio, dan dibatasi 4,5 MB.
- Simpan dari dua perangkat sekaligus tidak saling menimpa diam-diam: dashboard menampilkan pilihan saat ada versi lebih baru.
- `/api/join` terbuka tanpa login tapi dibatasi: hanya jarkoman yang pendaftaran langsungnya nyala dan belum selesai/dibatalkan, maksimal 20 nama per jarkoman, nama unik, role harus dari daftar game, plus kolom jebakan untuk bot. Kunci pembatalan ditandatangani HMAC dan hanya disimpan di perangkat pendaftar.
- Setiap tulis ke data memakai tulis bersyarat (ETag Netlify Blobs) dan diulang otomatis kalau bertabrakan, jadi dua orang yang menekan LOCK IN bersamaan tidak saling menimpa.

## Catatan

- Ikon situs (`public/favicon.svg`) masih placeholder berupa huruf "JK". Ganti dengan logo sendiri kalau ada.
- Ini proyek fan non-komersial, tidak berafiliasi dengan Riot Games, Valve, Moonton, atau semiwork. Nama dan aset game milik pemiliknya masing-masing.

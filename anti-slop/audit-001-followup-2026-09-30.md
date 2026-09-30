# Audit 001 · Laporan lanjutan · 2026-09-30

Menindaklanjuti `audit-001-2026-09-30.md`. Semua nomor 1–27 disetujui dan dikerjakan dalam sprint A–E, ditambah permintaan rombak palet, grid, efek, dan tipografi CS2 dan MLBB. Nomor 28 menunggu file dari pemilik.

Status: **Selesai** = sesuai usulan audit. **Sebagian** = masalahnya tertangani tapi target atau salah satu opsi usulan belum tercapai (alasannya ditulis). **Menunggu** = butuh sesuatu dari pemilik.

## Bukti akhir

| Alat | Cakupan | Hasil |
| --- | --- | --- |
| Unit test (Vitest) | 7 berkas | 66 lulus (dulu 50) |
| Playwright e2e | 4 game × 2 varian di 320 dan 1440 px, alur LOCK IN, batal, ubah role, naik dari cadangan, pindah jarkoman | 19 lulus |
| axe-core | 20 halaman (publik dan admin) | 0 pelanggaran |
| Reflow 320 px | 8 kombinasi tema | Tidak ada scroll ke samping |
| CSP di build produksi | 4 tema dan admin | 0 pelanggaran, satu request state per halaman |
| Prettier, typecheck, build | Seluruh repo | Lulus, juga dijalankan di GitHub Actions |
| Code review (high) setelah sprint E | Diff sprint A–E | 10 temuan, semua diperbaiki (bagian terakhir) |

## A. Wajib diperbaiki

| No | Temuan | Status | Yang dikerjakan | Commit |
| --- | --- | --- | --- | --- |
| 1 | Halaman tertahan di loading | Selesai | Refresh diam baru jalan setelah muat pertama selesai, dengan penjaga sendiri | `eb3076b` |
| 2 | Draft admin basi | Selesai | Draft yang dipulihkan langsung digabung dengan pendaftaran dan pembatalan web sejak draft disimpan | `eb3076b` |
| 3 | Ganti password mematikan "Batal ikut" | Selesai | Kunci ditandatangani `JARKOMAN_SECRET` atau rahasia acak di store; kunci lama tetap sah, juga setelah `JARKOMAN_SECRET` dipasang belakangan | `eb3076b`, `3b10849` |
| 4 | Kontras AA | Selesai | Label "opsional" pakai warna token, merah VALORANT Bone jadi `#b51f31` (4,84:1) | `eb3076b` |
| 5 | Header VALORANT 320 px | Selesai | Ukuran dan jarak disesuaikan di bawah 380 px | `eb3076b` |
| 6 | Fokus admin tak terlihat | Selesai | Cincin fokus di input tanggal/jam dan iframe preview | `eb3076b` |
| 7 | Preview WhatsApp alur lama | Selesai | 4 gambar `public/og` dirender ulang dengan copy dua mode dan tipografi baru; meta description diperbarui | `01ffb42` |

## B. Desain dan animasi

| No | Temuan | Status | Yang dikerjakan | Commit |
| --- | --- | --- | --- | --- |
| 8 | Denyut bombsite CS2 tanpa henti | Selesai | Tiga denyut saat radar terlihat, lalu diam dengan outline | `c313e6a` |
| 9 | Glow MLBB terlalu banyak | Sebagian | Dari 14 selector bercahaya jadi 6 saat diam (lambang, judul section samar, permata ornamen, VS, callout streak, momen victory) dan 3 hanya saat hover. Judul hero kini matte (tepi indigo dan bevel), bukan glow. Lebih dari 3 titik yang diusulkan karena tiap sisanya menandai momen khas MLBB | `b9cfd6e` |
| 10 | Garis kiri dekoratif panel status | Selesai | Diganti label merah ala agent terkunci (VALORANT) dan tanda ACCEPT hijau (CS2) | `01ffb42` |
| 11 | Favicon sama untuk semua game | Selesai | SVG "JK" per game, diganti saat tema dimuat | `01ffb42` |

## C. Teknis

| No | Temuan | Status | Yang dikerjakan | Commit |
| --- | --- | --- | --- | --- |
| 12 | LCP lambat | Sebagian | `/api/state` diambil sejak `<head>`, gambar hero di-preload dengan `srcset` yang sama, hero tidak lagi mulai dari opacity 0. R.E.P.O. 75 → 82–84, MLBB 57 → 58–67. Target ≥ 85 belum tercapai: sisa LCP MLBB sekitar 4,9 detik adalah render delay yang terikat CPU (tema berat di HP simulasi). Preload lewat edge function tidak dipakai karena preload dari klien sudah memotong rantai request yang sama | `32aa9e2` |
| 13 | TBT MLBB 1.050 ms | Selesai | Bara dari sprite yang dibuat sekali, DPR maksimal 1,5, mulai saat browser senggang. TBT 460–870 ms (angka Lighthouse di container ini berfluktuasi) | `32aa9e2` |
| 14 | Belum ada CI dan e2e | Selesai | GitHub Actions (format, typecheck, unit, build, e2e), Playwright di `tests/e2e`, Prettier | `32aa9e2` |
| 15 | Spam pendaftaran | Sebagian | Batas 6 pendaftaran per 10 menit per jaringan per jarkoman (hash IP, respons 429), tombol admin "Hapus semua pendaftar website". Angka 6, bukan 3, supaya satu grup yang berbagi Wi-Fi tetap bisa daftar. Opsi mode "perlu persetujuan host" tidak dibuat: menambah langkah bagi host di alur yang sengaja sekali klik | `32aa9e2`, `3b10849` |
| 16 | Catatan untuk host publik | Selesai | Catatan dikosongkan di API publik; hanya dashboard yang login menerimanya, dan simpanan draft tanpa catatan tidak menghapusnya | `32aa9e2` |
| 17 | Tanpa CSP | Selesai | CSP ketat di `netlify.toml`, hash script inline dijaga test | `32aa9e2` |

## D. Fitur dan animasi baru

| No | Usulan | Status | Yang dikerjakan | Commit |
| --- | --- | --- | --- | --- |
| 18 | Ubah pilihan setelah ikut | Selesai | `PATCH /api/join` dengan kunci perangkat, slot tetap | `5bf7093`, `3b10849` |
| 19 | Petunjuk komposisi tim | Selesai | Role/lane kosong disebut di form dan ditandai di pemilih | `5bf7093` |
| 20 | Momen masuk skuad | Selesai | CS2 layar ACCEPT, MLBB pick terkunci kristal dan sinar emas; VALORANT LOCKED IN dan cap R.E.P.O. dipertahankan. Mati saat reduced motion | `01ffb42` |
| 21 | Kartu baru menyala, tag "Kamu" | Selesai | 4 tema | `01ffb42`, `3b10849` |
| 22 | Batas waktu pendaftaran | Selesai | Pilihan per jarkoman, server menolak dengan `closed`, broadcast WA menyebut jamnya | `5bf7093` |
| 23 | Info naik dari cadangan | Selesai | Panel pendaftar menampilkan "Naik dari cadangan". Toast dashboard tidak dibuat; admin sudah melihat urutan skuad langsung | `5bf7093` |
| 24 | Lineup ↔ peta saling menyorot | Selesai | MLBB (kartu ↔ Land of Dawn) dan CS2 (scoreboard ↔ radar), hover dan fokus | `01ffb42` |
| 25 | Transisi antar-jarkoman | Selesai | Navigasi di dalam halaman dengan View Transition, Back/Forward bekerja, intro tidak diulang | `01ffb42`, `3b10849` |
| 26 | Hero CS2 ikut warna map | Selesai | Warna tiap map (diukur dari screenshot) jadi cahaya hero, radar, dan kartu map | `c313e6a` |
| 27 | Gambar OG dinamis | Selesai | Dashboard menggambar kartu 1200×630 per jarkoman dan mengunggahnya; edge function hanya memakai gambar yang versinya cocok dengan perubahan terakhir, kalau tidak jatuh ke gambar bawaan game | `01ffb42`, `3b10849` |
| 28 | Musik CS2 | Menunggu | Masih "Freeze Time" sintetis. Perlu file MP3 dari pemilik | · |

## Permintaan tambahan: palet, grid, efek, tipografi CS2 dan MLBB

**CS2** (`c313e6a`). Warna diambil dari stylesheet Panorama asli CS2, bukan ditebak: latar gradien biru baja menu, emas T dan biru CT bergradasi, panel skor warna panel menang tim, warna pemain CS2 (kuning, ungu, hijau, biru, oranye) yang menyambungkan radar, scoreboard, dan killfeed, serta gradien rarity per kategori senjata di buy menu dengan harga asli. Grid: scoreboard bersel bergantian, buy menu per kategori dengan kartu loadout, aturan sebagai kartu ronde, judul section bernomor. Tipografi: Saira Condensed menggantikan huruf stensil (UI CS2 memakai Stratum2 Condensed).

**MLBB** (`b9cfd6e`). Palet dari tiga sumber MLBB: langit malam lobby (indigo, nebula ungu, biru mana), cahaya senja peach dan sakura dari poster M-series, dan emas logam bingkai rank. Tepi panel bergradasi cyan-ungu-emas, pola heksagon tipis, bintang di langit hero. Grid: kartu lineup ala loading screen dengan warna lane yang sama di kartu, pemilih lane, dan peta; hitung mundur heksagon. Tipografi satu keluarga Rubik (font UI MLBB): judul hero Rubik Black emas logam bertepi indigo, judul section perak logam, callout pertempuran Rubik Black Italic. Oswald dihapus.

Keduanya diverifikasi axe 0 pelanggaran dan muat di 320 px.

## Temuan review kode setelah sprint E (`3b10849`)

Sepuluh temuan, dikelompokkan menurut area yang diperbaiki.

| Temuan | Perbaikan |
| --- | --- |
| Mengubah pilihan bisa memunculkan kembali pemain yang sudah dihapus admin | Edit dicatat di `editSeq`; simpanan admin hanya memperbarui pemain yang masih ada di draft |
| Percobaan daftar yang ditolak memakan kuota IP, id acak menulis data | Cek batas tanpa menulis, catat hanya setelah berhasil; satu key yang dipangkas otomatis |
| Kunci lama tidak sah setelah `JARKOMAN_SECRET` dipasang | Secret env, secret tersimpan, dan secret lama diterima bersama |
| Store state dibuat ulang tiap request | Satu instance per proses |
| Gambar OG basi bisa dipakai setelah jarkoman diubah | Versi gambar = tanda isi (panjang tetap) + waktu ubah; server hanya menerima format versi itu, edge memeriksa kecocokannya |
| Unggahan OG bisa balapan, gambar lama menimpa yang baru | Antrean dengan pembatalan generasi lama |
| Timer tanda "baru masuk" ter-reset oleh refresh diam | Efek timer sendiri |
| Navigasi antar-jarkoman memicu error hook bersyarat | `use()` selalu dipanggil dengan promise yang dilacak |

Tiga test regresi ditambahkan untuk tiga temuan pertama.

## Sisa pekerjaan

1. **Musik CS2 (#28):** kirim MP3, akan diproses seperti tiga game lain (potong, crossfade, normalisasi volume).
2. **Performa MLBB (#12):** skor mobile 58–67. Langkah berikutnya yang paling berdampak: memecah stylesheet MLBB per bagian di bawah lipatan, dan menunda Land of Dawn sampai mendekati layar.
3. **Lighthouse** di container ini berfluktuasi sampai ±8 poin antar-run; angka di atas adalah rentang dari beberapa run, bukan satu angka terbaik.

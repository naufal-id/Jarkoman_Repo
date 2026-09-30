# JARKOMAN: Riset, Desain, dan Rencana Build

Dokumen ini adalah hasil riset dan rencana sebelum software dibangun. Semua keputusan desain punya alasan tertulis supaya hasilnya terasa dirancang, bukan template.

## 1. Apa yang dibangun

Situs "jarkoman" (jaringan komando, pengumuman ajakan main) untuk ngajak teman mabar. Satu halaman publik yang tampil seperti poster hidup untuk satu sesi game, plus dashboard admin untuk mengganti isinya.

- **Halaman publik** (`/`): game, judul ajakan, tanggal, jam, hitung mundur, mode, map, syarat rank, daftar pemain, slot tersisa, catatan. Tombol konfirmasi membuka WhatsApp ke **0882-2336-7352** (`wa.me/6288223367352`) dengan pesan yang sudah terisi.
- **Dashboard admin** (`/admin`): login password, ganti game, judul, pemain, waktu, tanggal, mode, map, slot, catatan, gambar latar. Ada preview langsung, lalu tombol simpan yang langsung mengubah halaman publik.
- **Hosting**: GitHub, lalu Netlify (build otomatis, Functions, Blobs, Edge Functions).

## 2. Riset per game

### 2.1 VALORANT (Riot Games)

| Aspek | Temuan |
|---|---|
| Warna brand | Merah `#FF4655` (aksen paling dikenal), ink `#0F1923`, bone `#ECE8E1` |
| Tipografi resmi | **Tungsten** (display, kondensed tinggi) dan **DIN Next** (UI dan body). Keduanya komersial |
| Pengganti gratis | **Anton** untuk Tungsten (kondensed, berat, tinggi x besar). **Barlow** untuk DIN Next (grotesk ala rambu jalan, sekeluarga dengan DIN) |
| Role | Duelist, Initiator, Controller, Sentinel |
| Agent (29) | Duelist: Jett, Phoenix, Reyna, Raze, Yoru, Neon, Iso, Waylay. Initiator: Sova, Breach, Skye, KAY/O, Fade, Gekko, Tejo. Controller: Brimstone, Viper, Omen, Astra, Harbor, Clove, Miks. Sentinel: Sage, Cypher, Killjoy, Chamber, Deadlock, Vyse, Veto |
| Map (13) | Ascent, Bind, Haven, Split, Icebox, Breeze, Fracture, Pearl, Lotus, Sunset, Abyss, Corrode, Summit (terbaru, Juni 2026). Pool kompetitif Act 4 2026: Summit, Sunset, Breeze, Haven, Lotus, Split, Ascent |
| Mode | Competitive, Unrated, Swiftplay, Spike Rush, Deathmatch, Team Deathmatch, Escalation, Premier, Custom |
| Rank | Iron, Bronze, Silver, Gold, Platinum, Diamond, Ascendant, Immortal, Radiant |
| Motif visual | Sudut terpotong diagonal, kotak merah kecil, garis tipis dengan tick, label kode `//`, panel ink dan bone berganti, layar agent select dengan tombol LOCK IN |
| Kebijakan fan project | Riot "Legal Jibber Jabber" mengizinkan proyek fan non-komersial dengan disclaimer |

### 2.2 Counter-Strike 2 (Valve)

| Aspek | Temuan |
|---|---|
| Tipografi in-game | `stratum2-bold.ttf` (HUD, angka) dan `notosans-bold.ttf` (UI, scoreboard) |
| Pengganti gratis | **Saira Condensed** untuk judul (setara Stratum2 Condensed yang dipakai CS2 untuk judul besar), **Rajdhani** untuk angka HUD, **Noto Sans** asli untuk teks. Iterasi awal memakai Saira Stencil One, diganti di iterasi 4 karena UI CS2 tidak memakai huruf stensil |
| Warna | Dari stylesheet Panorama CS2 (`panorama/styles/csgostyles.css`, `buymenu.css`, `popup_accept_match.css`, `hud/hudwinpanel.css` via SteamDatabase GameTracking-CS2): latar `#1E2D3D` ke `#14202B`, T `#EABE54`, CT `#96C8FA`, warna pemain kuning/ungu/hijau/biru/oranye, rarity `#B0C3D9` sampai `#EB4B4B`, ACCEPT `#4CAF50` ke `#255E28` |
| Active Duty 2026 | Ancient, Anubis, Dust II, Inferno, Mirage, Nuke, Overpass (Train keluar Januari 2026). Cache kembali ke Competitive/Casual April 2026. Map lain: Train, Vertigo, Office, Italy |
| Mode | Premier, Competitive, Wingman, Casual, Deathmatch, Arms Race, Retakes, Custom (5v5 privat) |
| Rank | Premier CS Rating 7 warna per 5.000 poin (Gray, Light Blue, Blue, Purple, Pink, Red, Yellow 30.000+). Competitive 18 skill group: Silver I sampai The Global Elite |
| Motif visual | HUD (timer ronde, uang `$`, HP/armor), kill feed, radar, scoreboard, pola recoil (spray pattern) AK-47, freeze time, flashbang |

### 2.3 Mobile Legends: Bang Bang (Moonton)

| Aspek | Temuan |
|---|---|
| Logo | Sans dengan detail serif dekoratif, emas metalik di atas hitam, kristal di huruf O |
| Pengganti gratis | Satu keluarga **Rubik** (font UI MLBB menurut wiki komunitasnya): Black kapital dengan isi logam emas atau perak dan tepi gelap untuk judul, Black Italic untuk callout pertempuran. Iterasi awal memakai Cinzel dan Kanit, lalu Oswald di iterasi 3; Oswald terlalu polos dan tidak ada di UI MLBB, jadi diganti di iterasi 4 |
| Warna | Malam `#04061A` ke `#0F1747`, royal `#1B2A78`, nebula ungu Epic/Mythic `#6B3FD6`, biru mana `#72DCFF`, peach dan sakura dari poster M-series, emas logam `#FFE9A3` ke `#A8560F`. Warna lane: EXP `#FF8A55`, Gold `#FFCF4D`, Mid `#B596FF`, Jungle `#4FE39A`, Roam `#5FD0FF` |
| Role | Tank, Fighter, Assassin, Mage, Marksman, Support |
| Lane | EXP Lane, Gold Lane, Mid Lane, Jungle, Roam |
| Rank | Warrior, Elite, Master, Grandmaster, Epic, Legend, Mythic, Mythical Honor, Mythical Glory, Mythical Immortal |
| Mode | Ranked, Classic, Brawl, Custom (5v5 room), Arcade |
| Callout streak | First Blood, Double Kill, Triple Kill, Maniac, Savage. Dipakai untuk jumlah pemain yang sudah masuk (5 pemain = SAVAGE) |
| Gambar | App Store ID `1160056295` (screenshot resmi lewat iTunes Lookup API) |

### 2.4 R.E.P.O. (semiwork)

| Aspek | Temuan |
|---|---|
| Tentang | Retrieve, Extract and Profit Operation. Co-op horror berbasis fisika, 1 sampai 6 pemain, early access sejak 26 Februari 2025, Steam App ID `3241660` |
| Logo | Diidentifikasi komunitas sebagai **Teko** |
| Tokoh | Semibot (robot kapsul, kepala naik turun saat bicara di voice chat), Taxman (bos yang suka mengejek pakai emoji), truk ekstraksi dengan layar CRT, Service Station (toko) |
| Level | Swiftbroom Academy, Headman Manor, McJannek Station, Museum of Human Art |
| Monster | 29 sejak Monster Update v0.3.0 (Huntsman, Headman, Robe, Trudge, Reaper, Clown, Apex Predator, Mentalist, Upscream, Chef, dan lainnya) |
| Pengganti tipografi | **Teko** (display), **VT323** (layar CRT truk), **Archivo Narrow** (body, rasa formulir kerja Taxman) |
| Warna | Void `#0B0A0C`, hazard yellow `#F5B82E`, bone `#EDE6D6`, fosfor CRT `#7CFF6B` khusus di layar truk |
| Motif | Senter di gelap, kedipan lampu neon, garis hazard, kuota ekstraksi, layar CRT, akronim bertitik (M.A.B.A.R.) |

## 3. Keputusan gambar game

Container build memblokir CDN gambar (Steam, Riot, Wikipedia), jadi gambar tidak bisa diunduh dan disimpan ke repo. Solusinya dua lapis:

1. **Artwork orisinal berbasis kode** (SVG, CSS, GSAP) untuk tiap game: diagram 3 lane MOBA, radar dan pola spray, sudut Valorant, semibot. Selalu tampil, tidak bergantung jaringan, dan tidak menyalin logo resmi.
2. **Gambar resmi saat runtime** lewat Netlify Function `/api/media` yang mengambil dari sumber publik lalu di-cache di CDN Netlify:
   - VALORANT: `valorant-api.com` (splash map dan portrait agent, termasuk warna gradien tiap agent).
   - CS2 dan R.E.P.O.: Steam `appdetails` (header, background, screenshot).
   - MLBB: iTunes Lookup API (screenshot App Store resmi).
   Jika sumber gagal, halaman tetap utuh dengan artwork orisinal. Admin juga bisa memilih gambar dari galeri itu atau menempel URL gambar sendiri.

Disclaimer fan project dipasang di footer.

## 4. Arah desain

**Design Read**: poster ajakan mabar untuk teman tongkrongan gamer Indonesia, dengan bahasa visual yang diambil langsung dari identitas tiap game, dial **ENERGY 3 / RHYTHM 3 / MOTION 3** untuk halaman publik, dan **ENERGY 2 / RHYTHM 2 / MOTION 2** untuk admin.

Alasan: jarkoman harus "teriak" di grup WA dan terasa seperti game yang dipilih. Admin adalah alat kerja, jadi lebih tenang dan fokus ke keputusan: isi apa, lihat hasilnya, simpan.

Identitas bersama: wordmark teks **JARKOMAN** (bukan logo gambar), yang ikut berubah font per game. Di tema R.E.P.O. menjadi `J.A.R.K.O.M.A.N.`.

### 4.1 Sistem per game (setiap baris adalah alasan satu kalimat)

**VALORANT, "Protocol Dossier"**
- Warna: ink sebagai dasar, bone untuk panel info, merah hanya untuk CTA, hitungan mundur, dan penanda aktif. Alasan: begitulah Riot memakai merahnya, sebagai sinyal, bukan cat tembok.
- Layout: headline Anton raksasa bertumpuk di kiri, strip info vertikal di kanan, panel bone menyelip di atas ink. Alasan: meniru ritme ink/bone situs resmi tanpa menyalin halamannya.
- Roster: kartu agent select dengan portrait agent (jika ada) dan tombol LOCK IN.
- Animasi: wipe panel merah diagonal sebagai transisi section, huruf headline naik dengan clip, digit hitung mundur bergeser vertikal, tombol terisi dari kiri. Tujuan: memandu mata ke jadwal dan tombol konfirmasi.

**CS2, "Freeze Time"**
- Warna: gunmetal, satu aksen sisi (T gold atau CT blue, bisa dipilih admin). Alasan: dua sisi adalah identitas paling dasar CS.
- Layout: HUD mengelilingi konten (timer di atas, info kiri bawah, kill feed kanan), scoreboard untuk roster, huruf stensil A/B raksasa. Alasan: pemain CS membaca info dari HUD, jadi info sesi ditaruh di tempat yang sama.
- Animasi: hitung mundur freeze time di intro, flash putih satu kali (dimatikan saat reduced motion), titik pola spray muncul berurutan, kill feed masuk dari kanan untuk tiap pemain yang sudah join.

**MLBB, "Land of Dawn"**
- Warna: malam dan royal blue, emas metalik hanya untuk teks display dan ornamen, cyan hanya di kristal. Alasan: sesuai emas metalik logo, dan satu aksen dingin supaya emasnya menonjol.
- Layout: lineup 5v5 ala loading screen, peta 3 lane orisinal yang digambar ulang, plakat info bersudut ornamen. Alasan: loading screen adalah momen "kita satu tim" yang paling diingat pemain.
- Animasi: bar loading intro, kartu pemain meluncur dari dua sisi, lane peta tergambar (stroke), callout streak menghentak sesuai jumlah pemain.

**R.E.P.O., "Night Shift"**
- Warna: void hitam, kuning hazard sebagai satu-satunya aksen, hijau fosfor khusus di layar CRT truk. Alasan: horor butuh gelap, dan kuning hazard adalah warna "alat kerja" yang cocok dengan tema pekerjaan Taxman.
- Layout: layar CRT truk sebagai panel info, semibot berwarna sebagai roster, bar kuota ekstraksi sebagai slot. Alasan: slot pemain memang kuota, dan truk adalah tempat briefing di game.
- Animasi: lampu neon berkedip saat intro, senter mengikuti pointer (hanya menggelapkan latar, teks tetap terbaca), kepala semibot mengangguk saat di-hover, mata monster berkedip sesekali di sudut gelap.

**Admin, "Backstage"**
- Warna: graphite netral, aksen mengikuti game yang sedang diedit. Alasan: satu-satunya warna di layar admin adalah warna game yang sedang disiapkan.
- Font: Archivo variabel dengan sumbu lebar (kondensed untuk label, normal untuk isian). Alasan: satu keluarga, hierarki dari lebar dan berat, tidak bersaing dengan font game di preview.
- Layout: daftar jarkoman di kiri, editor di tengah, preview asli (iframe halaman publik) di kanan dengan mode desktop/HP. Alasan: keputusan admin adalah "isi ini, lihat hasilnya", jadi preview harus selalu terlihat.

### 4.2 Aturan yang dijaga

- Tidak ada angka, testimoni, atau nama pemain palsu. Roster kosong sampai admin mengisi. Data contoh diberi label jelas.
- Semua tombol punya aksi nyata (WA, kalender `.ics`, bagikan, salin, simpan).
- State loading, kosong, dan error ada di halaman publik dan admin.
- `prefers-reduced-motion` mematikan intro, flash, dan animasi berulang.
- Kontras teks minimal WCAG AA, fokus keyboard terlihat, target sentuh minimal 44px.

## 5. Arsitektur

| Bagian | Pilihan | Alasan |
|---|---|---|
| Build | Vite 8, React 19, TypeScript | Multi-page (publik dan admin terpisah), cepat, dukungan Netlify bawaan |
| Animasi | GSAP 3 (ScrollTrigger, SplitText) + `@gsap/react` | Timeline presisi untuk intro dan reveal; semua plugin GSAP gratis |
| Font | `@fontsource` (self-host) | Tidak bergantung CDN Google, hanya file yang dipakai yang diunduh browser |
| Data | Netlify Blobs (`jarkoman/state`) | Gratis, tanpa setup database, konsistensi strong |
| API | Netlify Functions v2: `/api/state` (GET publik, PUT admin), `/api/login`, `/api/media` | Satu sumber data untuk semua pengunjung |
| Auth | Password dari env `ADMIN_PASSWORD`, token HMAC-SHA256 berlaku 7 hari | Tanpa layanan pihak ketiga; ganti password = semua token lama batal |
| Konflik edit | `baseUpdatedAt` dikirim saat simpan, server menolak (409) jika sudah ada versi lebih baru | Aman kalau admin edit dari HP dan laptop |
| Preview link WA | Edge Function mengganti meta Open Graph untuk bot (WhatsApp, Telegram, Discord, dll) | Saat link dibagikan di grup WA, judul dan gambar sesuai game yang aktif |
| Gambar OG | 4 JPG 1200x630 dibuat dari desain sendiri | WhatsApp tidak menampilkan SVG |
| Dev lokal | Plugin Vite yang menjalankan handler Functions yang sama dengan penyimpanan file | `npm run dev` langsung bisa login dan simpan |

### 5.1 Model data

```ts
type GameId = 'valorant' | 'cs2' | 'mlbb' | 'repo'
interface Player { id; name; role; pick; status: 'in' | 'maybe' }
interface Jarkoman {
  id; game; headline; subline; mode; map; rank; lobby; voice;
  date: 'YYYY-MM-DD'; time: 'HH:mm'; endTime; tz: 'WIB' | 'WITA' | 'WIT';
  host; slots; players: Player[]; notes;
  status: 'open' | 'cancelled' | 'done'; // "penuh", "live", "selesai" dihitung otomatis
  wa; bg; variant; updatedAt
}
interface SiteState { version: 1; featuredId; items: Jarkoman[]; updatedAt }
```

## 6. Halaman publik

Urutan mengikuti cerita ajakan: **apa dan kapan** (hero + hitung mundur), **main apa** (mode, map, rank, lobby), **siapa saja** (roster dan slot), **ikut** (form lalu WA), **catatan**, **jadwal lain**, footer.

Fitur fungsional:
- Form join: nama (wajib), role/pick sesuai game, catatan. Tombol membuka `wa.me/6288223367352?text=...` berisi game, jadwal, mode, map, nama, role, dan link sesi.
- Slot penuh: form tetap aktif sebagai daftar cadangan, pesan WA menyebut "cadangan".
- Status otomatis: akan datang (hitung mundur), sedang main, selesai, dibatalkan.
- Simpan ke kalender (`.ics` dengan pengingat 30 menit), bagikan (Web Share API atau salin link).
- `?id=` untuk membuka jarkoman tertentu.

## 7. Dashboard admin

- Login password, pesan jelas jika `ADMIN_PASSWORD` belum diset di Netlify.
- Daftar jarkoman: buat baru, duplikat, hapus (dengan konfirmasi), jadikan utama.
- Editor: pilih game (kartu berfont game masing-masing), judul, subjudul, mode, map, rank, lobby, voice, tanggal, jam mulai dan selesai, zona waktu, status, host, jumlah slot, pemain (tambah, hapus, urutkan, role, pick, status), catatan, nomor WA, varian tema, gambar latar (galeri resmi atau URL).
- Preview iframe langsung (desktop/HP), putar ulang intro.
- Simpan (Ctrl/Cmd+S), indikator perubahan belum disimpan, penanganan konflik.
- Salin teks broadcast WA, salin link, buka halaman.
- Ekspor/impor JSON cadangan.

## 8. Verifikasi

- Vitest: waktu dan zona, builder pesan WA, `.ics`, sanitasi, token, handler Functions dengan Blobs tiruan.
- Build produksi tanpa error.
- Playwright: screenshot 4 tema di desktop dan HP, klik semua kontrol publik dan admin, cek console error, cek overflow horizontal di 360px.

## 9. Iterasi 2: key art asli dan musik

Host memberikan 4 key art resmi. Keputusan penempatan (alasan satu kalimat per keputusan):

| Game | Ukuran | Penempatan | Alasan |
|---|---|---|---|
| VALORANT | 1440×811 | Panel kanan dengan tepi diagonal dan garis merah; banner atas di HP | Judul tetap di area ink sehingga kontras tidak bergantung gambar, dan tepi diagonal adalah bahasa bentuk Valorant |
| CS2 | 616×353 | Layar ber-HUD seukuran asli, pola recoil "ditembakkan" ke tepinya, versi blur jadi cahaya latar | Gambar kecil tidak boleh diperbesar penuh layar; versi blur membawa oranye key art ke seluruh hero |
| MLBB | 1170×655 | Banner lobby di atas hero yang memudar ke biru malam, bagian bawah poster dipotong | Poster berisi tanggal event Asian Games; memotongnya mencegah pengunjung salah membaca jadwal |
| R.E.P.O. | 460×215 | Diputar di monitor CRT truk (ukuran asli) dengan scanline | Gambar paling kecil, dan monitor truk adalah tempat briefing di game |

Semibot roster ikut disesuaikan dengan key art: badan kapsul, dua mata besar putih.

Musik: lagu resmi game dilindungi hak cipta dan tidak bisa diunduh dari container, jadi musik bawaan adalah komposisi orisinal yang disintesis dengan Web Audio (tanpa file). Tempo dan instrumen mengikuti suasana game: synth tegang 104 BPM (VALORANT), drum militer dan bunyi bom 92 BPM (CS2), harpa dan taiko 84 BPM (MLBB), drone dan kotak musik sumbang 70 BPM (R.E.P.O.). Host tetap bisa upload lagu sendiri. Musik tidak pernah autoplay; bar equalizer bergerak hanya saat musik benar-benar berbunyi.

## 10. Iterasi 3: perbaikan dari host

Dikerjakan per sprint, masing-masing diverifikasi di browser (Playwright, desktop dan 360 px, animasi nyala dan mati) sebelum di-commit.

| Sprint | Masalah | Keputusan dan alasan |
|---|---|---|
| Bug form | Nama yang diketik di form satu jarkoman ikut muncul di jarkoman game lain | Kunci penyimpanan form dan status pendaftaran memakai id jarkoman. Kunci global lama dihapus saat halaman dibuka |
| LOCK IN langsung | Host harus menginput setiap pemain yang konfirmasi lewat WA | `/api/join` menambahkan pemain ke skuad jarkoman itu. Nyala secara bawaan, bisa diganti per jarkoman ke mode WhatsApp. Tulis bersyarat (ETag Blobs) supaya pendaftaran bersamaan aman; pendaftaran web tidak mengubah versi admin (`joinSeq` dan jejak `gone`), jadi simpanan admin dari draft lama tidak menghapus pendaftar baru dan tidak memunculkan lagi yang batal. Pembatalan hanya dengan kunci HMAC milik perangkat pendaftar |
| Musik | Musik bawaan sintetis diganti lagu dari host | File diimpor lewat Vite (nama hash, cache permanen), tag ID3 dan cover art dibuang. Klip dipotong di tengah lagu, jadi diputar lewat Web Audio dengan crossfade equal-power; volume disamakan ke sekitar -17 dB RMS karena klip MLBB jauh lebih keras. CS2 tetap sintetis sampai ada lagunya |
| Map VALORANT dan CS2 | Map terlalu kecil | Map sekitar setengah section. CS2 memakai radar overview resmi 12 map dengan ikon loading screen dari file overview game (Anubis diukur ulang karena file resminya tidak lengkap), tombol lantai untuk Nuke/Train/Vertigo, kartu map dengan screenshot dan emblem resmi. VALORANT memakai kartu ala layar loading map dengan minimap dan penanda site/spawn dari callout valorant-api |
| Mode terang R.E.P.O. | Varian "Lampu nyala" tetap gelap | Konsep Service Station dan kantor Taxman di bawah lampu: kertas formulir, tinta hitam, outline tebal dan bayangan keras seperti gaya kartun R.E.P.O. Kuning hazard hanya untuk blok karena teks kuning di atas kertas tidak lolos kontras; monitor CRT tetap gelap karena benda fisik |
| MLBB | Font dan warna font tidak terasa MLBB, peta paling lemah | Serif Romawi diganti Oswald dan Rubik; teks utama putih, emas hanya untuk penekanan, panel kaca biru bertepi biru muda seperti lobby MLBB. Land of Dawn digambar ulang sebagai minimap: EXP Lane atas dan Gold Lane bawah untuk kedua tim, sehingga peta simetris cermin terhadap sungai; Turtle dekat EXP Lane, Lord dekat Gold Lane, tiga menara per lane per tim. Red side diputar 180 derajat seperti tampilan di game |

## 11. Iterasi 4: palet, efek, dan tipografi CS2 dan MLBB

Masukan host: palet CS2 dan MLBB terlalu datar, perlu gradasi dari beberapa warna yang sesuai tema game, komposisi lebih detail dan berlapis, efek dan tipografi lebih kuat (terutama MLBB).

| Game | Keputusan dan alasan |
|---|---|
| CS2 | Palet diambil dari stylesheet UI CS2 sendiri, bukan ditebak: gradien biru baja menu, panel item bergradasi, sel bergantian ala scoreboard, warna panel menang T/CT untuk panel skor. Warna khas tiap map diukur dari screenshot pemilihan map dan dipakai sebagai cahaya hero, radar, dan kartu map. Warna pemain CS2 menyambungkan titik di radar, chip di scoreboard, dan killfeed. Buy menu memakai gradien rarity per kategori senjata dan harga asli; kolom kiri yang dulu kosong diisi kartu loadout yang mengikuti pilihan form. Tombol kirim = tombol ACCEPT hijau. Judul memakai Saira Condensed (setara Stratum2 Condensed), huruf bombsite yang disebut judul ikut warna tim |
| MLBB | Tiga sumber warna: langit malam lobby (indigo, nebula ungu rank Epic/Mythic, biru mana), poster M-series di banner (peach dan sakura dibawa turun sebagai cahaya senja), dan emas logam bingkai rank serta tombol Start. Tepi panel bergradasi cyan ke ungu ke emas, pola heksagon tipis dari motif kristal dan turret. Tipografi satu keluarga Rubik: judul hero emas logam, judul section perak logam, keduanya bertepi gelap. Kartu lineup ala loading screen berbingkai emas dengan warna lane; warna lane yang sama dipakai titik pemain di peta dan pemilih lane. Peta Land of Dawn diberi gradien hutan, sungai, jalur batu, dan cahaya bulan |

Sumber tambahan: kerrang.com dan loudersound.com (anthem VALORANT Champions 2026), MPL Indonesia "We Own This", MurkyYT/cs2-map-icons (aset overview CS2 dari depot game), dokumentasi valorant-api (rumus koordinat minimap), wiki komunitas MLBB (font UI Rubik, tata letak Land of Dawn).

## Sumber riset

- VALORANT brand dan font: valdb.gg/brand, brandcolorcode.com/valorant
- Agent dan map 2026: esports.gg, tracker.gg (Act 4 map pool), ggclan.com
- CS2 map pool dan rank: dotesports.com, wecoach.gg, carrylord.com (Premier colors)
- CS2 font: fontsinuse.com, csnn.pro
- MLBB rank, role, lane: fandom Ranked, playaware.gg, apps.apple.com id1160056295
- MLBB logo: vcgamers.com
- R.E.P.O.: Wikipedia, Steam app 3241660, gamerant.com (maps), destructoid.com (monster update), repogame.fandom.com (Semibots), dafont forum (font logo Teko)

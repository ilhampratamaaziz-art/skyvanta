# 🌦️ SKYVANTA - Portal Prakiraan Cuaca Indonesia Resmi BMKG
> **Proyek Desain & Pengembangan Web (Full-Stack Single Page Application)**  
> *Dibangun untuk Kompetisi Web Development Tingkat Nasional*

---

## 🌟 Gambaran Umum & Konsep Karya
**SKYVANTA** adalah aplikasi web full-stack modern satu halaman (*Single Page Application*) yang menyajikan data meteorologi dan geofisika seluruh wilayah Republik Indonesia secara **100% valid dan real-time langsung dari API resmi Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)**.

Aplikasi ini dirancang dengan standar visual **Ultra-HD Glassmorphism** yang secara khusus diselaraskan (*harmonized*) dengan video latar gerak 4K (*Lake by Snowy Peaks*). Antarmuka memadukan estetika frosted-glass mutakhir, tipografi modern, efek partikel atmosfer dinamis, dan sintesis audio alam prosedural tanpa membebani performa browser.

---

## 🚀 Fitur Unggulan (Competitive Edge)

### 1. 📡 100% Data Resmi & Valid BMKG (Bukan Mock/Palsu)
* **API Terbuka BMKG:** Terintegrasi langsung dengan endpoint resmi BMKG `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}` sesuai Keputusan Menteri Dalam Negeri (Kepmendagri No. 100.1.1-6117).
* **Cakupan Nusantara:** Menjangkau 38 provinsi di Indonesia dengan 70+ titik ibukota dan pusat kota strategis dari Sabang sampai Merauke, serta mendukung input kode ADM4 manual kelurahan/desa manapun di Indonesia.
* **Prakiraan 72 Jam (3 Hari):** Data dirinci per 3 jam mencakup suhu udara (°C & °F), kelembapan (%), kecepatan angin (km/j & knot), arah mata angin (° derajat), tutupan awan (%), curah hujan (mm), dan ikon cuaca resmi SVG dari BMKG.

### 2. 🏔️ UI/UX Ultra-HD Glassmorphism & Live Background Video
* **Live Video Background:** Memanfaatkan video 4K `bg-lake.mp4` dengan transisi loop halus.
* **Kontrol Kontras & Dimmer:** Slider kecerahan video memungkinkan penyesuaian kontras dinamis agar teks tetap tajam dan terbaca sempurna (*HD Readability*).
* **Lapisan Partikel Atmosfer Dinamis:** Canvas interaktif yang secara otomatis menampilkan partikel hujan (*rain streaks*) ketika cuaca hujan, kabut lembut saat berawan, dan pendaran sinar matahari saat cerah.

### 3. 🔊 Web Audio Procedural Ambient Sound Engine
* Menggunakan **Web Audio API bawaan browser** untuk menghasilkan efek suara alam organik tanpa membutuhkan file audio eksternal (100% instan & bebas lag):
  * 🍃 *Angin Pegunungan (Mountain Breeze)*
  * 🌧️ *Hujan Rintik (Gentle Rain)*
  * 🌊 *Ombak Danau (Lake Shoreline)*
* Dilengkapi slider volume master dan tombol mute instan.

### 4. 📈 Visualisasi Grafik Interaktif Multi-Dimensi (Chart.js 4.4)
Tersedia 3 mode analisis grafik dengan kurva bezier halus (*cubic spline*), gradien pencahayaan, dan tooltip cerdas:
1. **Fluktuasi Suhu & Titik Embun:** Membandingkan suhu aktual, suhu terasa (*Apparent Temperature / RealFeel*), dan titik embun (*Dew Point*).
2. **Curah Hujan & Tutupan Awan:** Grafik hybrid (batang presipitasi mm + garis tutupan awan %).
3. **Dinamika Angin & Kelembapan:** Tren kecepatan angin dan persentase kelembapan udara harian.

### 5. 🗺️ Peta Cuaca Interaktif Indonesia (Leaflet.js)
* Peta interaktif bertema *dark-glass cartography* yang memetakan seluruh kepulauan Nusantara.
* Penanda cuaca (*weather pins*) interaktif: klik salah satu pin untuk langsung memuat dan mengarahkan fokus ke prakiraan cuaca kota tersebut secara instan (*smooth fly-to animation*).

### 6. 🚨 Sistem Peringatan Dini Gempa Bumi BMKG Real-Time (TEWS)
* Terhubung langsung ke API Geofisika BMKG `autogempa.json`.
* Menampilkan informasi gempa bumi mutakhir: magnitudo, kedalaman, koordinat pusat gempa, potensi tsunami, skala MMI dirasakan, serta **Peta Guncangan Resmi BMKG (Shakemap)**.

### 7. 📍 Deteksi Geolokasi Pintar ("Lokasi Saya")
* Menggunakan algoritma matematis **Haversine Formula** pada backend untuk mencocokkan koordinat GPS browser pengguna dengan kota/kabupaten terdekat di Indonesia secara instan.

### 8. 🖨️ Cetak & Ekspor Laporan Meteorologi
* Tombol satu-klik untuk mencetak buletin ringkasan cuaca resmi (*print-ready layout*), sangat ideal untuk presentasi di hadapan dewan juri lomba.

---

## 🛠️ Arsitektur Teknologi & Dependensi

### Backend (Server)
* **Runtime:** Node.js v26+
* **Framework:** Express.js 5.3
* **CORS:** Penanganan izin silang origin aman
* **Intelligent In-Memory Cache (TTL):** Cache 10 menit untuk prakiraan cuaca dan 2 menit untuk data gempa bumi guna mematuhi batas *rate limit* BMKG (maks 60 req/min) serta menjamin kecepatan akses super kilat (*sub-millisecond latency*).

### Frontend (Client SPA)
* **Arsitektur:** Single Page Application (HTML5, Vanilla Modern JavaScript ES6+)
* **Styling:** Tailwind CSS + Kustom Glassmorphism CSS (`backdrop-filter: blur(20px)`)
* **Tipografi:** Google Fonts (`Outfit` untuk heading & `Plus Jakarta Sans` untuk teks bacaan)
* **Grafik:** Chart.js 4.4
* **Pemetaan:** Leaflet.js 1.9 dengan CartoDB Dark Tiles
* **Audio Engine:** HTML5 Web Audio API

---

## 💻 Panduan Menjalankan Proyek

### 1. Prasyarat
Pastikan komputer telah terinstal **Node.js** (versi 18 ke atas) dan **npm**.

### 2. Instalasi Dependensi
Buka terminal pada direktori proyek dan jalankan:
```bash
npm install
```

### 3. Menjalankan Server Aplikasi
Jalankan perintah:
```bash
npm start
```
Server akan aktif di:
👉 **`http://localhost:3000`**

Buka tautan tersebut di peramban (Chrome, Edge, Firefox, Safari) untuk menikmati pengalaman aplikasi cuaca HD secara penuh.

### 4. Menjalankan Pengujian Otomatis (Automated Testing)
Untuk membuktikan bahwa seluruh endpoint dan integrasi API BMKG valid dan berfungsi sempurna:
```bash
npm test
```
Skrip uji akan menguji:
* Status server & health check
* Integritas basis data wilayah Nusantara (70+ titik)
* Pengambilan data cuaca live BMKG (Gambir, Jakarta Pusat)
* Pengambilan data gempa terkini BMKG (Autogempa)
* Kalkulasi geolokasi Haversine terdekat
* Penyajian video latar 4K HD

---

## 📜 Kepatuhan & Atribusi Resmi
Aplikasi ini secara sah dan resmi mematuhi regulasi BMKG:
* **Sumber Data:** Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Republik Indonesia.
* **Atribusi Terbuka:** Ditempatkan secara jelas pada header, kartu cuaca utama, dan footer aplikasi.
* **Regulasi Wilayah:** Keputusan Menteri Dalam Negeri (Kepmendagri) No. 100.1.1-6117 Tahun 2022 tentang Kode Wilayah Administrasi Pemerintahan Tingkat IV (ADM4).

---
*Dibuat dengan dedikasi dan ketelitian tingkat tinggi untuk memenangkan kompetisi pengembangan web.*

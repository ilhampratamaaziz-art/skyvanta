# SkyVanta — Platform Informasi Cuaca & Meteorologi Indonesia

SkyVanta adalah aplikasi web full-stack berbasis **Node.js (Express 5)** dan **Vanilla JavaScript (Single Page Application)** yang menyajikan informasi prakiraan cuaca resmi BMKG, peta persebaran suhu dan curah hujan Indonesia, analisis parametrik 72 jam, komparasi cuaca dua lokasi, pemantauan gempa bumi **InaTEWS BMKG**, serta asisten cuaca **AeroAI** (dukungan dwibahasa ID/EN dan toggle `°C`/`°F`).

---

## 1. Rute Halaman (9 Rute SPA)

Aplikasi berjalan sebagai SPA berbasis hash URL pada [public/aurora-router.js](public/aurora-router.js) dan [public/index.html](public/index.html):

| Rute | Modul / Tampilan | Ringkasan Fitur |
|---|---|---|
| `#landing` | Beranda SkyVanta | Hero cuaca lokasi aktif, kartu kota samping (`renderAuroraSideCities`), ringkasan kontribusi **SDG 13** & **SDG 11**, serta akses cepat ke fitur utama. |
| `#dashboard` | Dashboard Cuaca | Kondisi cuaca terkini, indikator parameter meteorologi & turunan (terasa seperti, titik embun, angin, tutupan awan, estimasi UV, indeks kenyamanan), serta akses modal peringatan cuaca. |
| `#map` | Weather Map Indonesia | Peta interaktif Leaflet untuk **38 ibukota provinsi** dengan mode suhu dan mode risiko wilayah (**estimasi SkyVanta, bukan data resmi BMKG**), filter wilayah, dan legenda interaktif. |
| `#forecast` | Prakiraan Cuaca 72 Jam & 3 Hari | Prakiraan per interval 3 jam hingga 3 hari berdasarkan zona waktu lokal wilayah BMKG. |
| `#details` | Detail & Visualisasi Parametrik | Grafik **Chart.js** 4 tab (*Suhu & Embun*, *Hujan & Awan*, *Angin & RH*, *Kenyamanan*), 8 kartu metrik ringkasan, tabel data mentah 72 jam, dan tombol **Ekspor CSV**. |
| `#comparison` | Komparasi Cuaca Seluruh Wilayah | Perbandingan berdampingan **2 lokasi** (`WILAYAH TITIK A` vs `WILAYAH TITIK B`) untuk suhu, kelembapan, angin, curah hujan, dan tutupan awan. |
| `#rainfall` | Peta & Pemantauan Curah Hujan Indonesia | Peta Leaflet sebaran curah hujan (`tp` dalam mm) untuk 38 ibukota provinsi dan legenda intensitas hujan. |
| `#ai` | AeroAI Weather Assistant | Asisten tanya-jawab cuaca dan gempa berbasis konteks BMKG/InaTEWS dengan prompt saran cepat. |
| `#earthquake` | Gempa Bumi & InaTEWS BMKG | Informasi gempa bumi terkini (`autogempa`), peta episentrum Leaflet, citra *shakemap* BMKG, serta daftar gempa terkini (`gempaterkini`). |

---

## 2. Cakupan Lokasi & Sumber Data

### Cakupan Lokasi Sesuai Kode
- **78 lokasi** kurasi utama (kode wilayah ADM4 Kemendagri beserta koordinat) di `wilayah.json` dan `public/locationCodes.js`.
- **38 ibukota provinsi** (`PROVINCIAL_CAPITALS` pada `public/locationCodes.js`) yang digunakan pada `/api/cuaca/capitals`, penanda peta `#map`, dan peta `#rainfall`.
- **83.345 entitas administratif** tingkat kelurahan/desa pada `data/wilayahIndex.json` untuk fitur pencarian `/api/lokasi/cari` dan *location resolver* AeroAI.

### Sumber Data Resmi & Peta
- **Prakiraan Cuaca BMKG**: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}` melalui proxy server [server.js](server.js).
- **Gempa Bumi InaTEWS BMKG**:
  - `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` (gempa dirasakan/terkini dan *shakemap*).
  - `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` (daftar gempa terkini).
- **Peta Dasar**: Leaflet (`public/vendor/leaflet/`) dengan *tile layer* OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Mode Risiko Peta (`GET /api/cuaca/risiko`)**: Ringkasan risiko cuaca 7 wilayah pulau (*Sumatera, Jawa, Bali & Nusa Tenggara, Kalimantan, Sulawesi, Maluku, Papua*) dilabeli secara eksplisit sebagai **"Estimasi SkyVanta, bukan data resmi BMKG"** baik pada respons API maupun di legenda antarmuka peta risiko.

---

## 3. Arsitektur & Cara Kerja AeroAI

- Endpoint `POST /api/ai-assistant` menggabungkan konteks cuaca BMKG/gempa InaTEWS aktual dengan mesin klasifikasi maksud pertanyaan (*intent classification*).
- **Mode LLM (`mode: "llm"`)**: Digunakan bila variabel `LLM_API_KEY` dikonfigurasi (default provider `groq`, model `llama-3.3-70b-versatile`) untuk kueri cuaca yang relevan.
- **Mode Fallback Deterministik (`mode: "fallback"`)**: Aktif otomatis bila `LLM_API_KEY` tidak diisi, pemanggilan LLM gagal/timeout, atau untuk kueri khusus (seperti di luar domain, cakupan pulau/waktu di luar jendela prakiraan) sehingga jawaban tetap dihasilkan berdasarkan data terstruktur tanpa halusinasi angka.

---

## 4. Tumpukan Teknologi

| Lapisan | Implementasi di Kode |
|---|---|
| Frontend | HTML5 (`public/index.html`), Vanilla JavaScript (`public/app.js`, `public/aurora-router.js`, `public/i18n.js`, `public/iconMapper.js`, `public/locationCodes.js`, `public/overview-motion.js`), Service Worker (`public/sw.js`) |
| Styling & Tailwind | **Build lokal** `public/tailwind-built.css` (`tailwind-built.css?v=1.0`, menggunakan `@tailwindcss/vite` / `tailwindcss` v4 di `package.json`, **bukan CDN**), ditambah `public/style.css` dan `public/aurora-redesign.css` |
| Peta & Grafik | Leaflet (bundel lokal di `public/vendor/leaflet/`, `leaflet@^1.9.4` di `package.json`) dan Chart.js `4.4.1` (UMD via jsDelivr) |
| Backend | Node.js (`>= 18`) + Express `5.3.0` (`server.js`) |
| Deploy Config | `vercel.json` (termasuk header keamanan `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) dan `render.yaml` |

### Endpoint Server Utama (`server.js`)

| Metode | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/health` | Status server, *uptime*, ukuran cache, dan jumlah wilayah kurasi (`78`) |
| `GET` | `/api/wilayah` | Daftar 78 lokasi kurasi (mendukung filter `?q=` dan `?provinsi=`) |
| `GET` | `/api/lokasi/cari?q=` | Pencarian hingga 5 entitas dari indeks lengkap ADM4 (`83.345` entitas) |
| `GET` | `/api/provinsi` | Daftar 38 provinsi dan jumlah lokasi kurasi per provinsi |
| `GET` | `/api/nearest?lat=&lon=` | Pencarian lokasi terdekat memakai jarak Haversine |
| `GET` | `/api/cuaca?adm4=` | Prakiraan BMKG ternormalisasi (cache memori TTL 10 menit; `?refresh=1` untuk melewati cache) |
| `GET` | `/api/cuaca/verified` | Daftar kode ADM4 terverifikasi dari `bmkgCache` |
| `GET` | `/api/cuaca/capitals` | Ringkasan cuaca terkini 38 ibukota provinsi untuk penanda peta |
| `GET` | `/api/cuaca/risiko` | Ringkasan 7 wilayah risiko dengan atribusi `"Estimasi SkyVanta, bukan data resmi BMKG"` |
| `GET` | `/api/gempa` | Data gempa terkini InaTEWS BMKG (`autogempa.json`) |
| `GET` | `/api/gempa/terkini` | Daftar gempa terkini InaTEWS BMKG (`gempaterkini.json`) |
| `POST` | `/api/ai-assistant` | Endpoint AeroAI (mode LLM atau fallback deterministik berbasis konteks BMKG/InaTEWS) |
| `GET` | `/wilayah.json` | File JSON daftar 78 lokasi kurasi |

---

## 5. Struktur Folder

```text
.
├── data/
│   ├── bmkgCache.json          # Cache status verifikasi kode ADM4 BMKG
│   └── wilayahIndex.json       # Indeks 83.345 wilayah administratif (ADM4)
├── public/
│   ├── icons/                  # 8 ikon cuaca SVG lokal
│   ├── vendor/leaflet/         # Aset Leaflet CSS/JS & ikon lokal
│   ├── app.js                  # Logika aplikasi utama, API fetch, Chart.js, CSV export, AI UI
│   ├── aurora-redesign.css     # Styling tata letak & kartu antarmuka
│   ├── aurora-router.js        # Router 9 halaman SPA, komparasi, dan peta curah hujan
│   ├── favicon.svg
│   ├── hero-sky.jpg
│   ├── hero-sky.webp
│   ├── i18n.js                 # Kamus & switcher bahasa ID / EN
│   ├── iconMapper.js           # Pemetaan deskripsi cuaca ke ikon SVG lokal
│   ├── index.html              # Dokumen SPA tunggal seluruh 9 tampilan
│   ├── locationCodes.js        # Daftar 78 lokasi & 38 ibukota provinsi
│   ├── manifest.webmanifest
│   ├── overview-motion.js      # Interaksi tampilan ringkasan
│   ├── robots.txt
│   ├── sitemap.xml
│   ├── style.css               # Stylesheet dasar komponen
│   ├── sw.js                   # Service Worker PWA
│   └── tailwind-built.css      # CSS hasil build lokal Tailwind CSS (bukan CDN)
├── tools/
│   ├── buildWilayahIndex.js    # Utilitas pembangun data/wilayahIndex.json
│   └── verifyInitialBmkgCache.js # Utilitas verifikasi awal data/bmkgCache.json
├── .env.example                # Templat variabel lingkungan
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── render.yaml                 # Konfigurasi deployment Render
├── server.js                   # Server Express, proxy BMKG/InaTEWS, AeroAI endpoint
├── test_server.js              # Skrip uji endpoint server (`npm test`)
├── vercel.json                 # Konfigurasi routes & security headers Vercel
└── wilayah.json                # 78 lokasi kurasi beserta kode ADM4 dan koordinat
```

---

## 6. Instalasi & Cara Menjalankan

Prasyarat: **Node.js >= 18** (`engines` di `package.json`).

### 1. Instal dependensi
```bash
npm install
```

### 2. Konfigurasi lingkungan (opsional)
Salin `.env.example` menjadi `.env`:

| Variabel | Contoh di `.env.example` | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port server Express (default `3000`) |
| `NODE_ENV` | `production` | Mode lingkungan Node/Express |
| `LLM_API_KEY` | *(kosong)* | Kunci API LLM opsional untuk AeroAI. Kosongkan untuk memakai mode fallback deterministik berbasis data BMKG |
| `LLM_BASE_URL` | *(kosong)* | Base URL API kompatibel OpenAI (default di `server.js`: `https://api.groq.com/openai/v1`) |
| `LLM_MODEL` | *(kosong)* | Nama model LLM (default di `server.js`: `llama-3.3-70b-versatile`) |
| `LLM_PROVIDER` | *(kosong)* | Nama penyedia LLM (default di `server.js`: `groq`) |

> Jangan menyimpan kunci API atau nilai rahasia pada repositori; `.env` telah dikecualikan oleh `.gitignore` dan `LLM_API_KEY` hanya dibaca di server (`server.js`).

### 3. Jalankan server
```bash
npm start
```
Lalu buka `http://localhost:3000` (untuk pengembangan lokal tersedia juga `npm run dev` yang menjalankan `node server.js`).

### 4. Jalankan pengujian server
```bash
npm test
```
Perintah ini menjalankan `node test_server.js` untuk memeriksa `/api/health`, `/api/wilayah`, `/api/cuaca`, `/api/gempa`, `/api/nearest`, `/api/provinsi`, `/api/cuaca/risiko`, `/api/ai-assistant`, dan respons `index.html`.

---

## 7. Batasan yang Diketahui

1. **Ketergantungan pada API BMKG & InaTEWS**: Data prakiraan 3 jam dan informasi gempa berasal langsung dari `api.bmkg.go.id` serta `data.bmkg.go.id`. Ketersediaan data, kelengkapan field tertentu, dan *rate limit* mengikuti layanan hulu BMKG. API prakiraan publik ini tidak menyediakan arsip observasi iklim historis tahunan, dan SkyVanta bukan sistem peringatan dini resmi pengganti BMKG.
2. **Performa Mobile**: Pengujian Google Lighthouse sebelumnya (`hasil_uji/lighthouse_mobile_median.json`) mencatat skor performa mobile median **71** (LCP **7,97 detik**) dibanding desktop median **94** (LCP **1,53 detik**), terutama karena seluruh logika dan CSS SPA dimuat sekaligus dalam satu dokumen tanpa *code-splitting* per rute.
3. **Mode Risiko Wilayah Peta**: Data `GET /api/cuaca/risiko` menggunakan ringkasan statis 7 wilayah pulau yang berlabel eksplisit **"Estimasi SkyVanta, bukan data resmi BMKG"** dan belum diturunkan otomatis dari agregasi real-time BMKG.
4. **Indeks Wilayah & Runtime Cache**: `data/wilayahIndex.json` (`83.345` entitas) dimuat secara sinkron ke memori saat server aktif. Di lingkungan lokal non-Vercel, `saveBmkgCache()` memperbarui file `data/bmkgCache.json` secara otomatis saat verifikasi berlangsung (di Vercel ditulis ke `/tmp/bmkgCache.json`).
5. **Cakupan Fitur Terbatas Lainnya**: Beberapa label pada rute yang dirender router (`#details`, `#comparison`, `#rainfall`) masih berbahasa Indonesia saat mode bahasa Inggris (`EN`) dipilih; fitur ekspor saat ini mendukung format CSV pada `#details` (`exportWeatherCSV`).

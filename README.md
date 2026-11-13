# SkyVanta — Weather Intelligence Platform untuk Indonesia

Platform cuaca berbasis data resmi BMKG: prakiraan, peta persebaran suhu, analitik
prakiraan, asisten cuaca, dan informasi kegempaan dalam satu antarmuka.

Dibangun untuk Lomba Nasional Web Desain dengan tema
**"Empowering Global Innovators for an Intelligent Future"**.

---

## 1. Deskripsi

SkyVanta adalah aplikasi web full-stack yang menyajikan prakiraan cuaca resmi BMKG
untuk 79 lokasi di Indonesia. Seluruh data cuaca berasal dari layanan BMKG; tidak ada
data cuaca tiruan yang ditampilkan sebagai data resmi. Parameter yang dihitung sendiri
(feels like, titik embun, estimasi UV, indeks kenyamanan) selalu diberi label berbeda
dari nilai yang dilaporkan BMKG.

Aplikasi berjalan sebagai satu halaman (single page) dengan navigasi bagian:
Cuaca, Prakiraan, Peta, Analitik, Iklim, Metodologi, SDGs, dan AI Assistant.

## 2. Latar belakang masalah

- Informasi cuaca resmi tersedia, tetapi sering tersaji teknis dan sulit dipakai
  untuk keputusan harian (apakah perlu payung, aman beraktivitas luar ruang, dsb.).
- Masyarakat membutuhkan satu tempat yang menggabungkan kondisi terkini, prakiraan
  per jam dan harian, serta perbandingan antarwilayah.
- Banyak aplikasi cuaca menampilkan angka tanpa kejelasan sumber dan tanpa memisahkan
  data resmi dari estimasi.
- Literasi cuaca yang rendah membuat respons terhadap cuaca ekstrem bergantung pada
  informasi yang tersebar dan tidak konsisten.

## 3. Tujuan

1. Menyajikan prakiraan BMKG secara utuh, terbaca, dan mudah dipindai.
2. Memisahkan secara tegas data prakiraan BMKG, data estimasi, dan data yang belum
   tersedia.
3. Menyediakan alat bantu keputusan: peta suhu antarkota, analitik prakiraan,
   perbandingan lokasi, dan asisten cuaca berbasis data yang sama.
4. Meningkatkan literasi cuaca dan kesiapsiagaan menghadapi kondisi cuaca ekstrem.

## 4. Fitur

**Kondisi & prakiraan**
- Kondisi terkini: suhu, terasa seperti, kelembapan, titik embun, angin (km/j dan knot),
  tutupan awan, curah hujan, estimasi UV, dan kategori kenyamanan.
- Prakiraan per 3 jam hingga 3 hari, kartu harian, dan ringkasan mingguan.
- Pencarian autocomplete, filter 38 provinsi, riwayat pencarian lokal, deteksi lokasi
  terdekat (Haversine), dan pergantian lokasi yang memperbarui seluruh tampilan.
- Konversi satuan Celsius/Fahrenheit.
- Peringatan cuaca internal, buletin resmi BMKG, dan informasi gempa terkini (TEWS).
- Ekspor data cuaca aktif ke CSV dan grafik aktif ke PNG.

**Peta**
- Peta vektor Indonesia dengan penanda suhu dari data prakiraan per lokasi.
- Mode suhu dan mode risiko cuaca, legenda, filter pulau, tooltip metrik, serta daftar
  cepat ibukota provinsi.

**Analitik (prakiraan BMKG)**
- Empat tab grafik: suhu & titik embun, curah hujan & tutupan awan, angin & kelembapan,
  indeks kenyamanan (estimasi, berlabel).
- KPI dan statistik (minimum, maksimum, rata-rata, total curah hujan, jumlah titik hujan).
- Pemilih lokasi analitik dan rentang prakiraan (seluruh prakiraan / 24 jam pertama).
- Perbandingan hingga empat lokasi untuk parameter suhu, terasa seperti, curah hujan,
  kelembapan, angin, dan tutupan awan.

**Transparansi data (Iklim)**
- Halaman analisis iklim memisahkan tiga status: tersedia (prakiraan), estimasi
  (perhitungan), dan belum tersedia (observasi historis).
- Indikator harian dihitung langsung dari prakiraan: rentang suhu, jumlah titik
  berpotensi hujan, kelembapan rata-rata, indeks kenyamanan, dan angin rata-rata.

**AI Weather Assistant (AeroAI)**
- Menjawab pertanyaan tentang kondisi hari ini, besok, lusa, prakiraan 24 jam, dan
  prakiraan tiga hari menggunakan prakiraan BMKG yang dikirim sebagai konteks.
- Pengelompokan tanggal mengikuti waktu dinding zona waktu lokasi, bukan zona server.
- Bila layanan model bahasa gagal atau tidak dikonfigurasi, jawaban jatuh ke mesin
  aturan berbasis data prakiraan yang sama.
- Status memuat dan pesan galat ditampilkan pada antarmuka percakapan.

**Metodologi & SDGs**
- Halaman metodologi menjelaskan sumber data, alur pengambilan data, pengolahan server,
  visualisasi, cara kerja AI, penanganan kegagalan, dan batasan sistem.
- Halaman SDGs memetakan kontribusi ke SDG 13 dan SDG 11 secara konkret.

## 5. SDGs

**SDG 13 — Climate Action**
Meningkatkan literasi cuaca melalui penyajian prakiraan resmi, potensi hujan, dan
indikator risiko harian sehingga masyarakat dapat menyesuaikan aktivitas dan bersiap
sebelum cuaca ekstrem.

**SDG 11 — Sustainable Cities and Communities**
Mendukung keputusan berbasis data di tingkat kota melalui perbandingan cuaca antarlokasi
dan peta persebaran suhu, dengan data administratif mengikuti kode wilayah resmi.

SkyVanta menyediakan informasi untuk kesiapsiagaan, bukan sistem peringatan dini resmi.
Keputusan keselamatan tetap mengacu pada pengumuman BMKG dan otoritas berwenang.

## 6. Teknologi

| Lapisan | Teknologi |
|---|---|
| Markup & gaya | HTML, CSS kustom, Tailwind CSS (CDN) |
| Frontend | Vanilla JavaScript (tanpa framework) |
| Visualisasi | Chart.js 4.4 dan Canvas API |
| Backend | Node.js + Express 5 |
| Data | BMKG Open Data API |
| AI | Endpoint LLM opsional dengan fallback rule-based |
| Pengujian | Node test script dan Playwright (opsional) |

## 7. Struktur folder

```
.
├── public/
│   ├── index.html        # Seluruh antarmuka dan bagian halaman
│   ├── app.js            # Logika frontend (vanilla JS, Chart.js)
│   ├── style.css         # Sistem desain dan komponen visual
│   ├── favicon.svg
│   ├── peta-indonesia.png
│   └── bg-lake.mp4       # Video latar opsional (dimuat hanya bila diminta)
├── server.js             # Server Express, proxy BMKG, endpoint AI
├── wilayah.json          # Daftar 79 lokasi (kode ADM4 + koordinat)
├── test_server.js        # Pemeriksaan endpoint dasar
├── test-weather-map.mjs  # Uji peta dan marker (Playwright)
├── package.json
├── .env.example
└── README.md
```

## 8. Arsitektur

```
Browser (index.html + app.js)
        │  fetch JSON
        ▼
Express server (server.js)
        │  validasi adm4 + cache
        ▼
BMKG Open Data API
        │
        ▼
Normalisasi payload → current, forecast[], days[], alerts
        │
        ├── UI: hero, prakiraan, peta, analitik, indikator iklim
        └── POST /api/ai-assistant → LLM (opsional) → fallback rule-based
```

**Endpoint**

| Metode | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/wilayah` | Daftar lokasi yang didukung (kode ADM4) |
| GET | `/api/provinsi` | Daftar provinsi beserta jumlah lokasi |
| GET | `/api/nearest?lat=&lon=` | Lokasi terdekat dari koordinat |
| GET | `/api/cuaca?adm4=` | Prakiraan lengkap satu lokasi (`refresh=1` melewati cache) |
| GET | `/api/cuaca/capitals` | Ringkasan suhu untuk marker peta |
| GET | `/api/cuaca/risiko` | Ringkasan risiko cuaca per wilayah |
| GET | `/api/gempa` | Gempa terkini BMKG |
| GET | `/api/health` | Status layanan |
| POST | `/api/ai-assistant` | Pertanyaan cuaca berbasis konteks prakiraan |

## 9. Sumber data

- Prakiraan cuaca: `https://api-apps.bmkg.go.id` melalui endpoint
  `prakiraan-cuaca?adm4={kode_wilayah}`.
- Gempa bumi: layanan gempa BMKG (`autogempa.json`).
- Data administratif wilayah mengikuti kodifikasi Kemendagri (ADM4).
- Setiap tampilan menyertakan atribusi BMKG dan waktu pembaruan data.

## 10. Instalasi

```bash
npm install
```

## 11. Menjalankan

```bash
# Mode produksi
npm start

# Mode pengembangan (server yang sama)
npm run dev
```

Buka `http://localhost:3000`. Frontend dan backend dilayani oleh Express yang sama;
tidak ada proses build terpisah karena antarmuka memakai HTML, CSS, dan JavaScript murni.

Pemeriksaan endpoint:

```bash
npm test
```

## 12. Environment configuration

Buat `.env` berdasarkan `.env.example`.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `PORT` | Tidak | Port server, default `3000` |
| `NODE_ENV` | Tidak | `production` atau `development` |
| `LLM_API_KEY` | Tidak | Kunci layanan model bahasa untuk AeroAI. Bila kosong, dipakai fallback rule-based |
| `LLM_BASE_URL` | Tidak | Base URL API kompatibel OpenAI |
| `LLM_MODEL` | Tidak | Nama model yang dipakai |
| `LLM_PROVIDER` | Tidak | Label penyedia untuk atribusi jawaban |

Kunci API hanya dibaca di server dan tidak pernah dikirim ke browser.

## 13. Batasan sistem

1. Prakiraan BMKG beresolusi 3 jam dan tidak menggantikan pengamatan real-time.
2. Endpoint yang digunakan tidak menyediakan observasi historis, sehingga SkyVanta tidak
   menampilkan tren iklim tahunan atau anomali historis.
3. Estimasi UV dan indeks kenyamanan adalah perhitungan turunan, bukan keluaran BMKG.
4. Cakupan lokasi terbatas pada 79 kode ADM4 yang terdaftar di `wilayah.json`.
5. Kualitas jawaban AeroAI bergantung pada konteks prakiraan yang tersedia; bila data
   tidak ada, jawaban menyatakan keterbatasan tersebut.
6. SkyVanta tidak memprediksi gempa dan tidak menggantikan peringatan resmi BMKG.

## 14. Pengujian & utilitas

- `npm test` (`node test_server.js`): memeriksa endpoint server dan integritas daftar lokasi/API.
- `node run_audit.js`: menjalankan audit browser berbasis Playwright terhadap 9 halaman SkyVanta (pastikan server berjalan di `http://localhost:3000`).
- `tools/buildWilayahIndex.js` & `tools/verifyInitialBmkgCache.js`: skrip utilitas offline untuk membangun `data/wilayahIndex.json` dan memverifikasi `data/bmkgCache.json`.

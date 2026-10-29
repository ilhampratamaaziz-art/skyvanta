# 🏆 PANDUAN LENGKAP LOMBA & PETUNJUK PENGGUNAAN VS CODE
> **SKYVANTA — Portal Prakiraan Cuaca Indonesia Resmi BMKG**  
> *Panduan Teknis, Presentasi Dewan Juri, dan Konfigurasi Visual Studio Code*

---

## 💻 1. Cara Membuka Proyek di Visual Studio Code (VS Code)

Folder proyek Anda berada di:  
📂 `C:\Users\ADVAN\OneDrive\Lampiran\lomba dweb`

### Langkah-langkah:
1. Buka aplikasi **Visual Studio Code**.
2. Klik menu **File** > **Open Folder...** (atau tekan shortcut `Ctrl + K`, lalu `Ctrl + O`).
3. Arahkan dan pilih folder:  
   `C:\Users\ADVAN\OneDrive\Lampiran\lomba dweb`
4. Klik **Select Folder**.
5. Di pojok kiri bawah, jika muncul konfirmasi *"Do you trust the authors of the files in this folder?"*, klik **Yes, I trust the authors**.

---

## ⚡ 2. Cara Menjalankan Aplikasi di VS Code

Tersedia **3 Cara Mudah** yang sudah disiapkan di dalam konfigurasi `.vscode`:

### Cara 1: Menggunakan Tombol F5 (Paling Praktis)
1. Tekan tombol **F5** pada keyboard (atau buka tab **Run and Debug** di bilah kiri, lalu klik tombol hijau ▶️ bertuliskan *"Jalankan Server Cuaca BMKG"*).
2. Server akan otomatis menyala di terminal bawah.
3. Buka peramban (Chrome / Edge / Firefox) dan akses:  
   👉 **http://localhost:3000**

### Cara 2: Melalui Terminal Terintegrasi VS Code
1. Buka terminal di VS Code dengan menekan tombol **Ctrl + `** (tanda petik miring) atau klik menu **Terminal > New Terminal**.
2. Ketik perintah:
   ```bash
   npm start
   ```
3. Tekan Enter. Akses **http://localhost:3000**.

### Cara 3: Menjalankan Pengujian Otomatis (Untuk Diperlihatkan ke Juri)
Di terminal VS Code, jalankan:
```bash
npm test
```
*Script ini akan memverifikasi koneksi API BMKG secara live, endpoint cuaca, gempa terkini, database wilayah, dan video latar. Dewan juri akan sangat terkesan melihat semua checklist tes berwarna hijau!*

---

## 📁 3. Struktur Lengkap Folder Proyek

```
lomba dweb/
│
├── .vscode/                     # Konfigurasi Otomatis Visual Studio Code
│   ├── settings.json            # Format on save, tab size, identasi
│   ├── launch.json              # Konfigurasi Run & Debug (F5)
│   ├── tasks.json               # Task runner otomatis untuk npm start & test
│   └── extensions.json          # Rekomendasi ekstensi Tailwind & Prettier
│
├── public/                      # Folder Berkas Antarmuka Web (Frontend SPA)
│   ├── index.html               # Single Page Application HD Glassmorphism
│   ├── style.css                # Desain frosted-glass, radar scan, kustom styling
│   ├── app.js                   # Logika antarmuka, Chart.js, Proyeksi Peta, Audio Synth
│   ├── favicon.svg              # Ikon tab peramban modern
│   └── bg-lake.mp4              # Video latar gerak 4K (Lanskap danau bersalju)
│
├── server.js                    # Backend Server Express 5 (Proxy API BMKG & Cache TTL)
├── wilayah.json                 # Basis data 72 stasiun kota terverifikasi BMKG se-Indonesia
├── test_server.js               # Pengujian otomatis endpoint & integritas data
├── package.json                 # Pengaturan dependensi proyek Node.js
├── .gitignore                   # Menjaga repository tetap bersih
├── .env.example                 # Contoh variabel lingkungan port
├── README.md                    # Dokumentasi utama proyek
└── PANDUAN_LOMBA.md             # Panduan strategi presentasi dan tanya jawab juri
```

---

## 🎤 4. Panduan Demonstrasi Presentasi di Depan Dewan Juri

Gunakan alur demonstrasi 3 menit berikut saat sesi penjurian:

### Menit 1: Pengenalan & Integritas Data (Data Integrity)
1. **Buka http://localhost:3000** di layar monitor utama.
2. Tunjukkan video latar HD dan antarmuka Glassmorphism yang selaras tanpa dead-space.
3. **Poin Bicara:**
   > *"SKYVANTA adalah aplikasi web cuaca satu halaman (Single Page Application) yang dibangun dengan prinsip integritas data sains 100% otentik. Kami mengonsumsi langsung API terbuka resmi Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Republik Indonesia berdasarkan Kepmendagri No. 100.1.1-6117, mencakup 72 pusat kota strategis di 38 provinsi tanpa satupun data tiruan atau rekayasa."*

### Menit 2: Fitur Interaktif & Keunggulan UI/UX
1. **Tunjukkan Peta Vektor Interaktif Indonesia:**
   - Klik salah satu pin kota di pulau yang berbeda (misalnya dari Jakarta ke Denpasar, Makassar, atau Jayapura).
   - Perhatikan bagaimana data suhu, grafik, dan ringkasan cuaca langsung diperbarui secara *real-time*.
2. **Tunjukkan Grafik Analisis Multi-Dimensi (Chart.js):**
   - Klik tab *Suhu & Embun*, *Hujan & Awan*, dan *Angin & Kelembapan*.
   - Arahkan kursor pada kurva untuk memperlihatkan *glass tooltip* yang responsif.
3. **Aktifkan Fitur Suara Alam (Web Audio Engine):**
   - Klik tombol **Suara Alam: Aktif** dan ubah ke *Angin Pegunungan* atau *Hujan Rintik*.
   - Jelaskan bahwa audio ini dibuat secara prosedural matematika melalui Web Audio API bawaan browser, sehingga 100% bebas lag dan tanpa membutuhkan unduhan file audio eksternal.

### Menit 3: Mitigasi Bencana & Fitur Cetak
1. **Klik Ticker Gempa Bumi BMKG:**
   - Buka modal gempa bumi untuk memperlihatkan data magnitudo, kedalaman, koordinat, dan Peta Guncangan (*Shakemap*) resmi BMKG.
2. **Klik Tombol Cetak (Laporan):**
   - Tunjukkan bahwa tata letak halaman otomatis berubah menjadi format dokumen meteorologi resmi yang bersih dan siap cetak/simpan PDF.

---

## 💡 5. Kunci Menjawab Pertanyaan Teknis Dewan Juri

### Pertanyaan 1: *"Bagaimana aplikasi Anda menangani batasan (rate-limit) 60 request/menit dari API BMKG?"*
> **Jawaban:**  
> *"Kami membangun arsitektur Backend Express dengan In-Memory TTL Cache berdurasi 10 menit untuk prakiraan cuaca dan 2 menit untuk data gempa. Ketika ada permintaan untuk kota yang sama, backend kami menyajikan data dari cache dengan latensi sub-milidetik sehingga server BMKG tidak terbebani dan aplikasi tidak pernah terkena error HTTP 429."*

### Pertanyaan 2: *"Mengapa memilih Peta Vektor SVG buatan sendiri daripada Google Maps atau Leaflet biasa?"*
> **Jawaban:**  
> *"Peta vektor SVG memberikan 3 keunggulan krusial untuk kompetisi: pertama, rendering 100% offline-ready tanpa risiko gagal muat ubin peta eksternal; kedua, bobotnya sangat ringan dengan ketajaman tak terbatas di layar Retina/4K; dan ketiga, kami dapat menyematkan proyeksi matematis koordinat BMKG serta animasi sapuan radar secara presisi."*

### Pertanyaan 3: *"Bagaimana cara menghitung 'Suhu Terasa' (Feels Like) dan Indeks UV?"*
> **Jawaban:**  
> *"Suhu terasa dihitung menggunakan formula meteorologi resmi Australian Apparent Temperature (Steadman Formula) yang mengombinasikan suhu aktual, tekanan uap kelembapan udara, dan kecepatan angin. Sedangkan estimasi Indeks UV dihitung berdasarkan kurva sinusoidal elevasi matahari tropis yang diatenuasi oleh persentase tutupan awan (cloud cover) BMKG."*

---
*Semoga sukses memenangkan lomba web development!*

/**
 * SKYVANTA — Centralized Bilingual Dictionary & Translation Engine (ID / EN)
 * Keeps "SKYVANTA" and "AeroAI" brand names invariant.
 */
(function () {
  const STORAGE_KEY = "skyvanta_lang";

  const WEATHER_DESC_MAP = {
    "cerah": "Clear",
    "cerah berawan": "Partly Cloudy",
    "berawan": "Cloudy",
    "berawan tebal": "Overcast",
    "sangat berawan": "Mostly Cloudy",
    "udara kabur": "Haze",
    "kabut": "Fog",
    "asap": "Smoke",
    "hujan ringan": "Light Rain",
    "hujan sangat ringan": "Very Light Rain",
    "hujan sedang": "Moderate Rain",
    "hujan lebat": "Heavy Rain",
    "hujan sangat lebat": "Very Heavy Rain",
    "hujan lokal": "Isolated Showers",
    "hujan petir": "Thunderstorm",
    "hujan disertai petir": "Thunderstorm",
    "petir": "Thunderstorm",
    "badai guntur": "Thunderstorm",
    "nihil": "None",
    "nihil (kering)": "None (Dry)"
  };

  const I18N_DICTIONARY = {
    id: {
      // Navigation & Chrome
      "nav.logo_title": "SKYVANTA Beranda",
      "nav.landing": "Beranda",
      "nav.landing_title": "Beranda SKYVANTA",
      "nav.dashboard": "Dashboard",
      "nav.dashboard_title": "Dashboard Cuaca",
      "nav.map": "Peta Cuaca",
      "nav.map_title": "Peta Cuaca Indonesia",
      "nav.forecast": "Prakiraan",
      "nav.forecast_title": "Prakiraan Cuaca 72 Jam & 3 Hari",
      "nav.details": "Detail Cuaca",
      "nav.details_title": "Detail Cuaca & Visualisasi Parametrik",
      "nav.comparison": "Komparasi Lokasi",
      "nav.comparison_title": "Komparasi Lokasi & Cuaca Antarkota",
      "nav.rainfall": "Peta Curah Hujan",
      "nav.rainfall_title": "Peta & Pemantauan Curah Hujan",
      "nav.ai": "Asisten AeroAI",
      "nav.ai_title": "Asisten Cuaca AeroAI",
      "nav.earthquake": "Gempa & TEWS",
      "nav.earthquake_title": "Gempa Bumi & InaTEWS BMKG",
      "nav.unit_title": "Ubah Satuan Suhu (°C / °F)",
      "nav.lang_title": "Ubah Bahasa (Indonesia / English)",

      // Header
      "header.badge": "Portal Meteorologi",
      "header.search_placeholder": "Cari kota, kabupaten, kecamatan... (tekan '/' untuk fokus)",
      "header.search_aria": "Cari wilayah atau lokasi",
      "header.detect_title": "Deteksi Lokasi Saya",
      "header.gempa_pill_title": "Gempa Terkini BMKG",
      "header.gempa_ticker_default": "Gempa Terkini",
      "header.refresh_title": "Segarkan Data Cuaca",
      "header.alerts_title": "Peringatan Dini Cuaca",

      // Dynamic Page Titles
      "page.landing": "Beranda SKYVANTA",
      "page.dashboard": "Dashboard Cuaca",
      "page.map": "Peta Cuaca Indonesia",
      "page.forecast": "Prakiraan Cuaca 72 Jam & 3 Hari",
      "page.details": "Detail & Visualisasi Parametrik",
      "page.comparison": "Komparasi Lokasi & Cuaca",
      "page.rainfall": "Peta & Pemantauan Curah Hujan",
      "page.ai": "Asisten AeroAI",
      "page.earthquake": "Gempa Bumi & InaTEWS BMKG",

      // Landing
      "landing.badge": "Portal Cuaca & Meteorologi Nasional",
      "landing.badge_live": "BMKG Data Live",
      "landing.hero_line1": "Memahami Cuaca.",
      "landing.hero_line2": "Mempersiapkan Hari.",
      "landing.hero_desc": "SKYVANTA membantu pengguna memahami kondisi cuaca aktual, melihat prakiraan presisi 72 jam, memantau curah hujan real-time, dan mempersiapkan seluruh aktivitas harian berdasarkan data meteorologi terverifikasi dari berbagai wilayah Indonesia.",
      "landing.cta_explore": "Jelajahi SKYVANTA",
      "landing.cta_map": "Peta Cuaca 38 Provinsi",
      "landing.cta_compare": "Komparasi Wilayah",
      "landing.card_badge_live": "BMKG Live",
      "landing.card_badge_cache": "BMKG Tersimpan",
      "landing.card_badge_unavail": "Data Belum Tersedia",
      "landing.card_wind": "ANGIN",
      "landing.card_humidity": "LEMBAP",
      "landing.card_precip": "PRESIPITASI",
      "landing.card_cta": "Masuk ke Dashboard Cuaca →",
      "landing.feat1_title": "Prakiraan 72 Jam Terperinci",
      "landing.feat1_desc": "Prediksi interval 3 jam suhu, tutupan awan, angin, dan probabilitas hujan berbasis model numerik BMKG.",
      "landing.feat2_title": "Peta & Pantauan Curah Hujan",
      "landing.feat2_desc": "Visualisasi presipitasi aktual seluruh stasiun meteorologi Indonesia dengan klasifikasi intensitas hujan real-time.",
      "landing.feat3_title": "AeroAI Weather Intelligence",
      "landing.feat3_desc": "Asisten meteorologi cerdas yang siap menjawab analisis cuaca, perbandingan kota, dan rekomendasi aktivitas luar ruang.",
      "landing.why_pill_left": "Platform Meteorologi & Mitigasi Bencana",
      "landing.why_pill_right": "38 Provinsi · Data BMKG",
      "landing.why_title": "Mengapa SKYVANTA",
      "landing.why_desc": "SKYVANTA menghadirkan akses informasi cuaca dan gempa bumi berbasis data resmi BMKG yang mudah dipahami, lintas 38 provinsi Indonesia. Melalui visualisasi interaktif, peta sebaran stasiun, dan asisten AI AeroAI, pengguna dapat mengambil keputusan harian yang lebih aman dan berbasis data.",
      "landing.sdg13_title": "SDG 13 · Penanganan Perubahan Iklim",
      "landing.sdg13_desc": "Peningkatan kesiapsiagaan terhadap dinamika cuaca ekstrem dimulai dari pemantauan kondisi atmosfer yang cepat dibaca. SKYVANTA mendukung hal ini melalui prakiraan 72 jam, peta suhu serta curah hujan real-time di 38 provinsi, grafik parametrik, dan peringatan cuaca berbasis data BMKG.",
      "landing.sdg11_title": "SDG 11 · Kota dan Permukiman yang Berkelanjutan",
      "landing.sdg11_desc": "Permukiman yang tangguh membutuhkan informasi risiko bencana hidrometeorologi dan kegempaan yang terbuka bagi warga. Fitur pemantauan gempa InaTEWS BMKG, komparasi cuaca antarwilayah, serta panduan AeroAI membantu masyarakat merencanakan aktivitas dengan lebih siap.",

      // Dashboard
      "dash.verified_badge": "Prakiraan Cuaca Terverifikasi BMKG",
      "dash.narrative": "Platform prakiraan cuaca seluruh wilayah Indonesia berbasis data terverifikasi. Prakiraan 72 jam disajikan dengan analisis suhu, kelembapan atmosfer, dan peringatan dini cuaca.",
      "dash.insight_title": "Analisis Cuaca BMKG",
      "dash.comfort_label": "Skor Kenyamanan Luar Ruang:",
      "dash.rec_title": "Rekomendasi Aktivitas",
      "dash.today": "Hari Ini",
      "dash.wind": "Angin",
      "dash.humidity": "Kelembapan",
      "dash.rain": "Hujan",
      "dash.verified_pill": "Data Terverifikasi BMKG",
      "dash.view_details": "Detail Cuaca →",
      "dash.outlook_title": "Rangkuman 3 Hari",
      "dash.outlook_tag": "Prakiraan",
      "dash.other_cities": "Wilayah Lainnya (Indonesia)",
      "dash.aero_title": "Ringkasan AeroAI",
      "dash.aero_badge": "Berbasis Aturan BMKG",
      "dash.aero_ask": "Tanya AeroAI →",
      "dash.aero_loading": "Menyusun ringkasan dari data BMKG yang dimuat...",
      "dash.aero_source": "Sumber: Data Prakiraan & InaTEWS BMKG yang dimuat",

      // Map
      "map.mode_temp": "Suhu Wilayah",
      "map.mode_risk": "Risiko Ekstrem",
      "map.legend_btn": "Legenda",
      "map.all_regions": "Seluruh Indonesia (38)",
      "map.geo_notice": "Batas administrasi kabupaten/kota memakai lapisan peta dasar",
      "map.stations_label": "38 Stasiun Meteorologi Ibukota Provinsi",

      // Forecast
      "forecast.subtitle": "Interval 3 Jam · Model Meteorologi Numerik BMKG · Navigasi Horisontal Presisi",
      "forecast.scroll_prev": "← Sebelumnya",
      "forecast.scroll_hint": "Geser horizontal ke kanan untuk melihat rentang 72 jam",
      "forecast.scroll_next": "Selanjutnya →",
      "forecast.3day_subtitle": "Analisis tren suhu maksimum, minimum, dan probabilitas presipitasi",

      // Details
      "details.subtitle": "Visualisasi 72 Jam: Suhu, Titik Embun, Curah Hujan, Tutupan Awan, Angin, dan Kelembapan Relatif",
      "details.tab_temp": "Suhu & Embun",
      "details.tab_rain": "Hujan & Awan",
      "details.tab_wind": "Angin & RH",
      "details.tab_comfort": "Kenyamanan",
      "details.export_csv": "Ekspor CSV",
      "details.raw_table_title": "Tabel Data Mentah 72 Jam",
      "details.col_time": "Waktu",
      "details.col_condition": "Kondisi",
      "details.col_temp": "Suhu",
      "details.col_feels": "Terasa",
      "details.col_rain": "Hujan",
      "details.col_clouds": "Awan",
      "details.col_wind": "Angin",
      "details.col_humidity": "Kelembapan",

      // Comparison
      "compare.badge": "Analisis Komparatif Antarkota BMKG",
      "compare.title": "Komparasi Cuaca Antarwilayah di Indonesia",
      "compare.subtitle": "Bandingkan parameter atmosfer, tren suhu, kelembapan, kecepatan angin, dan curah hujan berdampingan seluruh 38 provinsi di Indonesia",
      "compare.swap": "Tukar Posisi Wilayah (A ⇄ B)",
      "compare.presets": "Preset Komparasi Antarwilayah:",
      "compare.point_a": "WILAYAH TITIK A",
      "compare.point_b": "WILAYAH TITIK B",
      "compare.selected": "Terpilih",
      "compare.search_a": "Cari Wilayah A:",
      "compare.search_b": "Cari Wilayah B:",
      "compare.search_placeholder": "Ketik nama kota...",
      "compare.prov_a": "Filter Provinsi A:",
      "compare.prov_b": "Filter Provinsi B:",
      "compare.all_prov": "Semua 38 Provinsi",
      "compare.select_station": "Pilih Lokasi Stasiun BMKG:",
      "compare.chart_title": "Visualisasi Komparasi Metrik Meteorologi",

      // Rainfall
      "rain.subtitle": "Distribusi Presipitasi Aktual Stasiun BMKG Nasional",
      "rain.dry": "0 mm (Kering)",
      "rain.light": "> 0 - < 2.5 mm (Ringan)",
      "rain.moderate": "2.5 - 10 mm (Sedang)",
      "rain.heavy": "> 10 mm (Lebat)",
      "rain.all_id": "Seluruh Indonesia",
      "rain.source": "Sumber: BMKG (field tp)",
      "rain.chart_title": "Grafik Curah Hujan 72 Jam",
      "rain.chart_sub_prefix": "Profil presipitasi (mm) dan tutupan awan (%) di ",
      "rain.stats_title": "Statistik Presipitasi",
      "rain.current_rain": "Curah Hujan Saat Ini",
      "rain.unit_label": "Satuan:",
      "rain.unit_val": "Milimeter (mm)",
      "rain.interval_label": "Interval Data:",
      "rain.interval_val": "3 Jam BMKG",
      "rain.validation_label": "Status Validasi:",
      "rain.validation_val": "Tersinkronisasi",
      "rain.pure_note": "Nilai curah hujan diolah murni dari respons resmi tanpa data sintetis.",

      // AI Assistant
      "ai.online": "Aktif",
      "ai.welcome_title": "Halo! Saya AeroAI",
      "ai.welcome_desc": "Saya asisten cuaca Indonesia Anda. Tanyakan kondisi cuaca kota manapun di Indonesia, komparasi antarkota, prakiraan hujan, suhu tertinggi nasional, atau informasi kegempaan!",
      "ai.input_placeholder": "Tanyakan kondisi cuaca, hujan, atau suhu di Indonesia...",
      "ai.send": "Kirim",

      // Earthquake & Siaga
      "eq.title": "Indonesia Tsunami Early Warning System (InaTEWS)",
      "eq.subtitle": "Pusat Gempa Bumi & Geofisika BMKG Real-Time",
      "eq.live": "InaTEWS Live",
      "eq.mag": "Magnitudo Gempa",
      "eq.depth": "Kedalaman Sumber",
      "eq.epicenter": "Pusat Episentrum:",
      "eq.time": "Waktu Kejadian:",
      "eq.tsunami": "Potensi Tsunami:",
      "eq.mmi": "Skala Guncangan (MMI):",
      "eq.shakemap": "Peta Tingkat Guncangan (Shakemap):",
      "eq.map_title": "Peta Sebaran Gempa Bumi Indonesia",
      "eq.map_subtitle": "Sebaran titik episentrum gempa bumi terkini & dirasakan di Indonesia",
      "eq.leg_1": "< 5.0 (Kuning)",
      "eq.leg_2": "5.0 - 6.0 (Oranye)",
      "eq.leg_3": "6.0 - 7.0 (Merah)",
      "eq.leg_4": "≥ 7.0 (Merah Tua)",
      "eq.map_hint": "Klik titik pada peta atau item daftar untuk melihat detail gempa.",
      "eq.list_title": "Daftar Gempa Terbaru",
      "eq.list_subtitle": "Maksimal 15 kejadian gempa bumi terkini (M ≥ 5.0 & Gempa Dirasakan BMKG)",
      "eq.refresh": "Segarkan Data",
      "eq.siaga_title": "Siaga Cuaca & Gempa",
      "eq.siaga_subtitle": "Panduan edukatif membaca prakiraan meteorologi dan kesiapsiagaan bencana",
      "eq.siaga_badge": "Edukasi Kebencanaan",
      "eq.acc1_title": "1. Cara Membaca Prakiraan Cuaca (Suhu Terasa, Probabilitas, Curah Hujan)",
      "eq.acc1_p1": "<strong class=\"text-slate-900\">Suhu Terasa (Feels Like):</strong> perkiraan suhu yang dirasakan tubuh manusia dengan mempertimbangkan suhu udara, kelembapan relatif, dan kecepatan angin.",
      "eq.acc1_p2": "<strong class=\"text-slate-900\">Probabilitas &amp; Kondisi Hujan:</strong> menunjukkan peluang terjadinya hujan pada rentang waktu prakiraan (interval 3 jam di SKYVANTA) agar pengguna dapat menyiapkan perlindungan lebih awal.",
      "eq.acc1_p3": "<strong class=\"text-slate-900\">Tingkat Curah Hujan:</strong> dikelompokkan menjadi <strong class=\"text-sky-800\">Ringan</strong> (&gt; 0 – &lt; 2,5 mm), <strong class=\"text-blue-900\">Sedang</strong> (2,5 – 10 mm), dan <strong class=\"text-red-900\">Lebat</strong> (&gt; 10 mm).",
      "eq.acc2_title": "2. Panduan Singkat Saat Cuaca Ekstrem & Gempa (Sebelum, Saat, Sesudah)",
      "eq.acc2_p1": "<strong class=\"text-slate-900\">Saat Cuaca Ekstrem:</strong> pantau peringatan dini resmi BMKG, hindari berteduh di bawah pohon besar atau papan reklame saat angin kencang dan petir, serta jauhi area rawan genangan dan banjir saat hujan lebat.",
      "eq.acc2_pre_t": "Gempa · Sebelum",
      "eq.acc2_pre_b": "Kenali jalur evakuasi dan titik kumpul, amankan perabot tinggi ke dinding, serta siapkan tas siaga berisi air minum, P3K, senter, dan salinan dokumen penting.",
      "eq.acc2_dur_t": "Gempa · Saat Terjadi",
      "eq.acc2_dur_b": "Tetap tenang; lindungi kepala dan leher di bawah meja kokoh (merunduk, berlindung, berpegangan), jauhi kaca dan tiang listrik, serta jangan menggunakan lift.",
      "eq.acc2_post_t": "Gempa · Sesudah",
      "eq.acc2_post_b": "Keluar bangunan dengan tertib ke area terbuka, waspada gempa susulan, periksa status potensi tsunami bila berada di pesisir, dan ikuti arahan resmi BMKG.",
      "eq.acc3_title": "3. Cara Membaca Magnitudo, Kedalaman, dan Skala MMI",
      "eq.acc3_p1": "<strong class=\"text-slate-900\">Magnitudo (M):</strong> ukuran energi gempa di sumbernya (ditampilkan di peta sebaran dalam kelompok &lt; 5.0, 5.0–6.0, 6.0–7.0, dan ≥ 7.0).",
      "eq.acc3_p2": "<strong class=\"text-slate-900\">Kedalaman (km):</strong> jarak hiposenter di bawah permukaan bumi; gempa dangkal umumnya menghasilkan guncangan permukaan lebih kuat dibanding gempa dalam pada magnitudo yang sama.",
      "eq.acc3_p3": "<strong class=\"text-slate-900\">Skala MMI (Modified Mercalli Intensity):</strong> tingkat guncangan yang dirasakan manusia dan dampaknya pada bangunan di suatu lokasi (dari skala I tidak terasa hingga XII kerusakan total).",
      "eq.bmkg_sources": "Sumber Resmi BMKG:",
      "eq.src_portal": "Portal BMKG",
      "eq.src_inatews": "InaTEWS BMKG",
      "eq.src_warning": "Peringatan Dini Cuaca",

      // Footer & Alerts Modal
      "footer.copy": "© 2026 SKYVANTA · Platform Informasi Cuaca & Meteorologi Indonesia",
      "footer.meta": "Kepmendagri No. 100.1.1-6117 · InaTEWS",
      "alerts.modal_title": "Peringatan Dini Cuaca",
      "alerts.modal_sub": "Buletin Peringatan Cuaca & Geofisika Terkini",
      "alerts.modal_close": "Tutup Peringatan",
      "alerts.extreme_badge": "PERINGATAN CUACA EKSTREM",
      "alerts.warn_badge": "WASPADA CUACA",
      "alerts.mitigation": "Mitigasi:",
      "alerts.view_all": "Lihat Semua Peringatan",
      "alerts.seismo_title": "BULETIN SEISMOLOGI & GEOFISIKA BMKG",
      "alerts.meteo_title": "PERINGATAN METEOROLOGI BMKG",
      "alerts.none": "Tidak ada peringatan cuaca ekstrem aktif untuk saat ini.",

      // Dynamic JS Labels & Statuses
      "dyn.today": "Hari Ini",
      "dyn.tomorrow": "Besok",
      "dyn.day_after": "Lusa",
      "dyn.day_n": "Hari ke-{n}",
      "dyn.code_adm4": "Kode ADM4",
      "dyn.feels_like": "Terasa {val}°",
      "dyn.unavail_loc": "Data belum tersedia untuk {loc}",
      "dyn.unavail_chart": "Data grafik belum tersedia untuk {loc}",
      "dyn.unavail_rain": "Data curah hujan belum tersedia untuk {loc}",
      "dyn.unavail_eq": "Data gempa belum tersedia",
      "dyn.unavail_eq_list": "Daftar gempa belum tersedia",
      "dyn.unavail_rec": "Data rekomendasi belum tersedia untuk {loc}",
      "dyn.unavail_insight": "Analisis cuaca belum tersedia untuk {loc}.",
      "dyn.syncing_bmkg": "Menghubungi server BMKG untuk sinkronisasi data mutakhir...",
      "dyn.loading_slow": "Koneksi BMKG memerlukan waktu lebih lama dari biasanya...",
      "dyn.refreshed": "✓ Data cuaca berhasil diperbarui!",
      "dyn.loading_sync": "Sinkronisasi BMKG",
      "dyn.loading_desc": "Mengambil data meteorologi resmi...",
      "dyn.min_max": "Min {min}° / Maks {max}°",
      "dyn.updated_at": "Diperbarui: {time}",
      "dyn.dew_point": "Titik embun {val}°",
      "dyn.status_live": "BMKG Live",
      "dyn.status_cached": "BMKG Terverifikasi",
      "dyn.status_stale": "BMKG Riwayat",
      "dyn.status_offline": "Data Offline",
      "dyn.status_unavail": "Data Belum Tersedia",
      "dyn.chart_temp_actual": "Suhu Aktual (°{unit})",
      "dyn.chart_temp_feels": "Terasa Seperti (°{unit})",
      "dyn.chart_dew": "Titik Embun (°{unit})",
      "dyn.chart_rain": "Curah Hujan (mm)",
      "dyn.chart_clouds": "Tutupan Awan (%)",
      "dyn.chart_wind": "Kecepatan Angin (km/jam)",
      "dyn.chart_humidity": "Kelembapan Udara (%)",
      "dyn.chart_comfort": "Indeks Kenyamanan (0-10, hasil hitung)",
      "dyn.popup_province": "Provinsi:",
      "dyn.popup_weather": "Cuaca:",
      "dyn.popup_station": "Stasiun:",
      "dyn.popup_active": "BMKG Aktif",
      "dyn.popup_depth": "Kedalaman:",
      "dyn.popup_coords": "Koordinat:",
      "dyn.eq_mapped": "{n} titik gempa dipetakan",
      "dyn.eq_no_tsunami": "Tidak berpotensi tsunami",
      "dyn.eq_no_felt": "Tidak ada laporan dirasakan",
      "dyn.max_temp": "Suhu Maks",
      "dyn.min_temp": "Suhu Min",
      "dyn.rain_lbl": "Hujan:",
      "dyn.cloud_lbl": "Awan:",
      "dyn.map_provinces": "{n} Provinsi ({region})",
      "dyn.all_ri": "Seluruh RI",
      "dyn.map_mode_risk_toast": "Peta Risiko Cuaca Ekstrem aktif.",
      "dyn.map_mode_temp_toast": "Peta Suhu Ibukota aktif.",
      "dyn.legend_title": "Legenda Skala Suhu Peta",
      "dyn.legend_range": "Rentang Suhu Terpantau",
      "dyn.legend_cool": "Sejuk (< 24°C)",
      "dyn.legend_comfy": "Nyaman (24-28°C)",
      "dyn.legend_warm": "Hangat (29-32°C)",
      "dyn.legend_hot": "Terik (> 32°C)",
      "dyn.legend_risk_low": "Risiko Rendah",
      "dyn.legend_risk_med": "Risiko Sedang",
      "dyn.legend_risk_high": "Risiko Tinggi",
      "dyn.legend_hint": "Klik pin mana saja untuk memuat data meteorologi stasiun BMKG kota tersebut.",
      "dyn.search_not_found": "Lokasi tidak ditemukan.",
      "dyn.search_adm4_hint": "Tekan Enter untuk mencoba kode ADM4 manual.",
      "dyn.search_header": "Hasil Pencarian Lokasi",
      "dyn.search_found": "{n} Wilayah Ditemukan",
      "dyn.geo_unsupported": "Browser Anda tidak mendukung geolokasi",
      "dyn.geo_detecting": "Mendeteksi koordinat GPS Anda...",
      "dyn.geo_nearest": "Lokasi terdekat: {name} ({dist} km)",
      "dyn.geo_not_found": "Tidak dapat menemukan kota terdekat",
      "dyn.geo_match_fail": "Gagal mencocokkan koordinat dengan database",
      "dyn.geo_denied": "Izin akses lokasi ditolak. Silakan pilih kota manual.",
      "dyn.ai_thinking": "AeroAI menganalisis data meteorologi BMKG…",
      "dyn.ai_source": "Sumber: Jaringan Stasiun Meteorologi BMKG",
      "dyn.ai_err": "Gagal menghubungi AeroAI Assistant.",
      "dyn.ai_chip_weather": "📍 Cuaca {loc}",
      "dyn.ai_chip_rain": "🌧️ Potensi Hujan",
      "dyn.ai_chip_rec": "👕 Rekomendasi {loc}",
      "dyn.ai_chip_comp": "⚖️ Komparasi Wilayah",
      "dyn.ai_chip_hot": "🔥 Suhu Tertinggi RI",
      "dyn.ai_chip_eq": "🚨 Gempa BMKG",
      "dyn.uv_low": "Rendah",
      "dyn.uv_med": "Sedang",
      "dyn.uv_high": "Tinggi",
      "dyn.uv_vhigh": "Sangat Tinggi",
      "dyn.uv_ext": "Ekstrem",
      "dyn.rec_jemur": "Jemur Pakaian",
      "dyn.rec_sport": "Olahraga Outdoor",
      "dyn.rec_drive": "Berkendara",
      "dyn.rec_umbrella": "Proteksi / Payung",
      "dyn.dossier_title": "Dossier Cuaca: {loc}",
      "dyn.param_title": "Grafik Analisis Parametrik BMKG - {loc}",
      "dyn.fcast72_title": "Prakiraan Cuaca 72 Jam Terperinci - {loc}",
      "dyn.fcast3d_title": "Prakiraan Cuaca 3 Hari - {loc}",
      "dyn.map_title_loc": "Peta Cuaca Interaktif Indonesia - {loc}",
      "dyn.map_sub_loc": "Lokasi Aktif: {loc} · 38 Stasiun Meteorologi Ibukota Provinsi",
      "dyn.rain_title_loc": "Peta Interaktif Curah Hujan Indonesia - {loc}",
      "dyn.ai_sub_loc": "Asisten Meteorologi Cerdas · Lokasi Aktif: {loc}",
      "dyn.bmkg_gempa": "BMKG GEMPA:",
      "dyn.depth_short": "Kedalaman",
      "dyn.risk_low": "Rendah",
      "dyn.risk_medium": "Sedang",
      "dyn.risk_high": "Tinggi"
    },
    en: {
      // Navigation & Chrome
      "nav.logo_title": "SKYVANTA Home",
      "nav.landing": "Home",
      "nav.landing_title": "SKYVANTA Home",
      "nav.dashboard": "Dashboard",
      "nav.dashboard_title": "Weather Dashboard",
      "nav.map": "Weather Map",
      "nav.map_title": "Indonesia Weather Map",
      "nav.forecast": "Forecast",
      "nav.forecast_title": "72-Hour & 3-Day Weather Forecast",
      "nav.details": "Weather Details",
      "nav.details_title": "Weather Details & Parametric Charts",
      "nav.comparison": "Compare Locations",
      "nav.comparison_title": "Location Comparison Across Indonesia",
      "nav.rainfall": "Rainfall Map",
      "nav.rainfall_title": "Rainfall Map & Monitoring",
      "nav.ai": "AeroAI Assistant",
      "nav.ai_title": "AeroAI Weather Assistant",
      "nav.earthquake": "Quake & TEWS",
      "nav.earthquake_title": "Earthquake & BMKG InaTEWS",
      "nav.unit_title": "Toggle Temperature Unit (°C / °F)",
      "nav.lang_title": "Switch Language (Indonesia / English)",

      // Header
      "header.badge": "Meteorology Portal",
      "header.search_placeholder": "Search city, regency, district... (press '/' to focus)",
      "header.search_aria": "Search region or location",
      "header.detect_title": "Detect My Location",
      "header.gempa_pill_title": "Latest BMKG Earthquake",
      "header.gempa_ticker_default": "Latest Earthquake",
      "header.refresh_title": "Refresh Weather Data",
      "header.alerts_title": "Weather Early Warnings",

      // Dynamic Page Titles
      "page.landing": "SKYVANTA Home",
      "page.dashboard": "Weather Dashboard",
      "page.map": "Indonesia Weather Map",
      "page.forecast": "72-Hour & 3-Day Forecast",
      "page.details": "Weather Details & Parametric Charts",
      "page.comparison": "Location Comparison",
      "page.rainfall": "Rainfall Map & Monitoring",
      "page.ai": "AeroAI Assistant",
      "page.earthquake": "Earthquake & BMKG InaTEWS",

      // Landing
      "landing.badge": "National Weather & Meteorology Portal",
      "landing.badge_live": "BMKG Live Data",
      "landing.hero_line1": "Understand Weather.",
      "landing.hero_line2": "Prepare Your Day.",
      "landing.hero_desc": "SKYVANTA helps people understand current weather conditions, view 72-hour precision forecasts, monitor real-time rainfall, and plan daily activities with verified meteorological data across Indonesia.",
      "landing.cta_explore": "Explore SKYVANTA",
      "landing.cta_map": "38-Province Weather Map",
      "landing.cta_compare": "Compare Locations",
      "landing.card_badge_live": "BMKG Live",
      "landing.card_badge_cache": "BMKG Cached",
      "landing.card_badge_unavail": "Data Unavailable",
      "landing.card_wind": "WIND",
      "landing.card_humidity": "HUMIDITY",
      "landing.card_precip": "PRECIPITATION",
      "landing.card_cta": "Open Weather Dashboard →",
      "landing.feat1_title": "Detailed 72-Hour Forecast",
      "landing.feat1_desc": "3-hour interval predictions for temperature, cloud cover, wind, and rain probability powered by BMKG numerical models.",
      "landing.feat2_title": "Rainfall Map & Monitoring",
      "landing.feat2_desc": "Actual precipitation visualization across Indonesian weather stations with real-time rainfall intensity tiers.",
      "landing.feat3_title": "AeroAI Weather Intelligence",
      "landing.feat3_desc": "Intelligent meteorological assistant ready to explain weather analysis, city comparisons, and outdoor activity tips.",
      "landing.why_pill_left": "Meteorology & Disaster Mitigation Platform",
      "landing.why_pill_right": "38 Provinces · BMKG Data",
      "landing.why_title": "Why SKYVANTA",
      "landing.why_desc": "SKYVANTA delivers accessible weather and earthquake information based on official BMKG data across all 38 Indonesian provinces. Through interactive visualizations, station maps, and the AeroAI assistant, users can make safer data-driven daily decisions.",
      "landing.sdg13_title": "SDG 13 · Climate Action",
      "landing.sdg13_desc": "Building readiness against extreme weather starts with readable atmospheric monitoring. SKYVANTA supports this through 72-hour forecasts, real-time temperature and rainfall maps across 38 provinces, parametric charts, and BMKG-based weather alerts.",
      "landing.sdg11_title": "SDG 11 · Sustainable Cities and Communities",
      "landing.sdg11_desc": "Resilient settlements require open hydrometeorological and seismic risk information for citizens. InaTEWS BMKG earthquake tracking, cross-region weather comparison, and AeroAI guidance help communities plan activities with greater preparedness.",

      // Dashboard
      "dash.verified_badge": "BMKG Verified Weather Forecast",
      "dash.narrative": "Nationwide Indonesian weather forecasting built on verified data. 72-hour outlooks cover temperature, atmospheric humidity, and early weather warnings.",
      "dash.insight_title": "BMKG Weather Analysis",
      "dash.comfort_label": "Outdoor Comfort Score:",
      "dash.rec_title": "Activity Recommendations",
      "dash.today": "Today",
      "dash.wind": "Wind",
      "dash.humidity": "Humidity",
      "dash.rain": "Rain",
      "dash.verified_pill": "BMKG Verified Data",
      "dash.view_details": "Weather Details →",
      "dash.outlook_title": "3-Day Outlook",
      "dash.outlook_tag": "Forecast",
      "dash.other_cities": "Other Regions (Indonesia)",
      "dash.aero_title": "AeroAI Summary",
      "dash.aero_badge": "BMKG Rule-Based",
      "dash.aero_ask": "Ask AeroAI →",
      "dash.aero_loading": "Composing summary from loaded BMKG data...",
      "dash.aero_source": "Source: Loaded BMKG Forecast & InaTEWS Data",

      // Map
      "map.mode_temp": "Temperature",
      "map.mode_risk": "Extreme Risk",
      "map.legend_btn": "Legend",
      "map.all_regions": "All Indonesia (38)",
      "map.geo_notice": "Administrative boundaries use the base map layer",
      "map.stations_label": "38 Provincial Capital Meteorological Stations",

      // Forecast
      "forecast.subtitle": "3-Hour Interval · BMKG Numerical Meteorology Model · Precision Horizontal Scroll",
      "forecast.scroll_prev": "← Previous",
      "forecast.scroll_hint": "Scroll horizontally to view the full 72-hour window",
      "forecast.scroll_next": "Next →",
      "forecast.3day_subtitle": "Analysis of maximum/minimum temperatures and precipitation probability",

      // Details
      "details.subtitle": "72-Hour Visualization: Temperature, Dew Point, Rainfall, Cloud Cover, Wind, and Relative Humidity",
      "details.tab_temp": "Temp & Dew",
      "details.tab_rain": "Rain & Clouds",
      "details.tab_wind": "Wind & RH",
      "details.tab_comfort": "Comfort",
      "details.export_csv": "Export CSV",
      "details.raw_table_title": "72-Hour Raw Data Table",
      "details.col_time": "Time",
      "details.col_condition": "Condition",
      "details.col_temp": "Temp",
      "details.col_feels": "Feels Like",
      "details.col_rain": "Rain",
      "details.col_clouds": "Clouds",
      "details.col_wind": "Wind",
      "details.col_humidity": "Humidity",

      // Comparison
      "compare.badge": "BMKG Inter-City Comparative Analysis",
      "compare.title": "Cross-Region Weather Comparison in Indonesia",
      "compare.subtitle": "Compare atmospheric parameters, temperature trends, humidity, wind speed, and rainfall side-by-side across 38 provinces",
      "compare.swap": "Swap Locations (A ⇄ B)",
      "compare.presets": "Quick Region Comparison Presets:",
      "compare.point_a": "LOCATION A",
      "compare.point_b": "LOCATION B",
      "compare.selected": "Selected",
      "compare.search_a": "Search Location A:",
      "compare.search_b": "Search Location B:",
      "compare.search_placeholder": "Type city name...",
      "compare.prov_a": "Filter Province A:",
      "compare.prov_b": "Filter Province B:",
      "compare.all_prov": "All 38 Provinces",
      "compare.select_station": "Select BMKG Station Location:",
      "compare.chart_title": "Meteorological Metric Comparison",

      // Rainfall
      "rain.subtitle": "Actual Precipitation Distribution Across National BMKG Stations",
      "rain.dry": "0 mm (Dry)",
      "rain.light": "> 0 - < 2.5 mm (Light)",
      "rain.moderate": "2.5 - 10 mm (Moderate)",
      "rain.heavy": "> 10 mm (Heavy)",
      "rain.all_id": "All Indonesia",
      "rain.source": "Source: BMKG (tp field)",
      "rain.chart_title": "72-Hour Rainfall Chart",
      "rain.chart_sub_prefix": "Precipitation (mm) and cloud cover (%) profile in ",
      "rain.stats_title": "Precipitation Statistics",
      "rain.current_rain": "Current Rainfall",
      "rain.unit_label": "Unit:",
      "rain.unit_val": "Millimeter (mm)",
      "rain.interval_label": "Data Interval:",
      "rain.interval_val": "3 Hours BMKG",
      "rain.validation_label": "Validation Status:",
      "rain.validation_val": "Synchronized",
      "rain.pure_note": "Rainfall values are derived strictly from official BMKG responses with no synthetic data.",

      // AI Assistant
      "ai.online": "Online",
      "ai.welcome_title": "Hello! I'm AeroAI",
      "ai.welcome_desc": "I am your Indonesian weather assistant. Ask about current weather in any Indonesian city, inter-city comparisons, rain outlook, national peak temperatures, or seismic updates!",
      "ai.input_placeholder": "Ask about weather conditions, rainfall, or temperatures in Indonesia...",
      "ai.send": "Send",

      // Earthquake & Siaga
      "eq.title": "Indonesia Tsunami Early Warning System (InaTEWS)",
      "eq.subtitle": "BMKG Real-Time Earthquake & Geophysics Center",
      "eq.live": "InaTEWS Live",
      "eq.mag": "Earthquake Magnitude",
      "eq.depth": "Focal Depth",
      "eq.epicenter": "Epicenter:",
      "eq.time": "Origin Time:",
      "eq.tsunami": "Tsunami Potential:",
      "eq.mmi": "Shaking Intensity (MMI):",
      "eq.shakemap": "Shaking Intensity Map (Shakemap):",
      "eq.map_title": "Indonesia Earthquake Distribution Map",
      "eq.map_subtitle": "Recent and felt earthquake epicenters across Indonesia",
      "eq.leg_1": "< 5.0 (Yellow)",
      "eq.leg_2": "5.0 - 6.0 (Orange)",
      "eq.leg_3": "6.0 - 7.0 (Red)",
      "eq.leg_4": "≥ 7.0 (Dark Red)",
      "eq.map_hint": "Click a map marker or list item to view earthquake details.",
      "eq.list_title": "Recent Earthquakes",
      "eq.list_subtitle": "Up to 15 latest seismic events (M ≥ 5.0 & Felt Earthquakes by BMKG)",
      "eq.refresh": "Refresh Data",
      "eq.siaga_title": "Weather & Earthquake Preparedness",
      "eq.siaga_subtitle": "Educational guide for reading meteorological forecasts and disaster readiness",
      "eq.siaga_badge": "Disaster Education",
      "eq.acc1_title": "1. How to Read Weather Forecasts (Feels Like, Probability, Rainfall)",
      "eq.acc1_p1": "<strong class=\"text-slate-900\">Feels Like Temperature:</strong> estimated temperature perceived by the human body factoring in air temperature, relative humidity, and wind speed.",
      "eq.acc1_p2": "<strong class=\"text-slate-900\">Rain Probability &amp; Condition:</strong> indicates the likelihood of rain within the forecast window (3-hour intervals in SKYVANTA) so users can prepare protection early.",
      "eq.acc1_p3": "<strong class=\"text-slate-900\">Rainfall Intensity Tiers:</strong> grouped into <strong class=\"text-sky-800\">Light</strong> (&gt; 0 – &lt; 2.5 mm), <strong class=\"text-blue-900\">Moderate</strong> (2.5 – 10 mm), and <strong class=\"text-red-900\">Heavy</strong> (&gt; 10 mm).",
      "eq.acc2_title": "2. Quick Guide for Extreme Weather & Earthquakes (Before, During, After)",
      "eq.acc2_p1": "<strong class=\"text-slate-900\">During Extreme Weather:</strong> monitor official BMKG warnings, avoid sheltering beneath large trees or billboards during strong winds and lightning, and stay clear of flood-prone areas during heavy rain.",
      "eq.acc2_pre_t": "Earthquake · Before",
      "eq.acc2_pre_b": "Know evacuation routes and assembly points, anchor tall furniture to walls, and prepare a go-bag with drinking water, first-aid kit, flashlight, and document copies.",
      "eq.acc2_dur_t": "Earthquake · During",
      "eq.acc2_dur_b": "Stay calm; protect your head and neck under a sturdy table (drop, cover, hold on), keep away from glass and power poles, and never use elevators.",
      "eq.acc2_post_t": "Earthquake · After",
      "eq.acc2_post_b": "Exit the building calmly to an open space, stay alert for aftershocks, check tsunami status when near the coast, and follow official BMKG instructions.",
      "eq.acc3_title": "3. How to Read Magnitude, Focal Depth, and MMI Scale",
      "eq.acc3_p1": "<strong class=\"text-slate-900\">Magnitude (M):</strong> measure of earthquake energy released at its source (shown on the map in &lt; 5.0, 5.0–6.0, 6.0–7.0, and ≥ 7.0 tiers).",
      "eq.acc3_p2": "<strong class=\"text-slate-900\">Focal Depth (km):</strong> depth of the hypocenter below Earth's surface; shallow earthquakes generally produce stronger surface shaking than deep ones of equal magnitude.",
      "eq.acc3_p3": "<strong class=\"text-slate-900\">MMI Scale (Modified Mercalli Intensity):</strong> level of shaking felt by people and its impact on structures at a location (from I not felt to XII total damage).",
      "eq.bmkg_sources": "Official BMKG Sources:",
      "eq.src_portal": "BMKG Portal",
      "eq.src_inatews": "BMKG InaTEWS",
      "eq.src_warning": "Weather Early Warning",

      // Footer & Alerts Modal
      "footer.copy": "© 2026 SKYVANTA · Indonesian Weather & Meteorology Information Platform",
      "footer.meta": "Kepmendagri No. 100.1.1-6117 · InaTEWS",
      "alerts.modal_title": "Weather Early Warnings",
      "alerts.modal_sub": "Latest Weather & Geophysical Warning Bulletin",
      "alerts.modal_close": "Close Warnings",
      "alerts.extreme_badge": "EXTREME WEATHER WARNING",
      "alerts.warn_badge": "WEATHER ADVISORY",
      "alerts.mitigation": "Mitigation:",
      "alerts.view_all": "View All Warnings",
      "alerts.seismo_title": "BMKG SEISMOLOGY & GEOPHYSICS BULLETIN",
      "alerts.meteo_title": "BMKG METEOROLOGY WARNING",
      "alerts.none": "No active extreme weather warnings at this time.",

      // Dynamic JS Labels & Statuses
      "dyn.today": "Today",
      "dyn.tomorrow": "Tomorrow",
      "dyn.day_after": "Day After",
      "dyn.day_n": "Day {n}",
      "dyn.code_adm4": "ADM4 Code",
      "dyn.feels_like": "Feels like {val}°",
      "dyn.unavail_loc": "Data unavailable for {loc}",
      "dyn.unavail_chart": "Chart data unavailable for {loc}",
      "dyn.unavail_rain": "Rainfall data unavailable for {loc}",
      "dyn.unavail_eq": "Earthquake data unavailable",
      "dyn.unavail_eq_list": "Earthquake list unavailable",
      "dyn.unavail_rec": "Recommendations unavailable for {loc}",
      "dyn.unavail_insight": "Weather analysis unavailable for {loc}.",
      "dyn.syncing_bmkg": "Contacting BMKG server for latest weather synchronization...",
      "dyn.loading_slow": "BMKG connection is taking longer than usual...",
      "dyn.refreshed": "✓ Weather data updated successfully!",
      "dyn.loading_sync": "BMKG Sync",
      "dyn.loading_desc": "Fetching official meteorological data...",
      "dyn.min_max": "Min {min}° / Max {max}°",
      "dyn.updated_at": "Updated: {time}",
      "dyn.dew_point": "Dew point {val}°",
      "dyn.status_live": "BMKG Live",
      "dyn.status_cached": "BMKG Verified",
      "dyn.status_stale": "BMKG Archive",
      "dyn.status_offline": "Offline Data",
      "dyn.status_unavail": "Data Unavailable",
      "dyn.chart_temp_actual": "Actual Temp (°{unit})",
      "dyn.chart_temp_feels": "Feels Like (°{unit})",
      "dyn.chart_dew": "Dew Point (°{unit})",
      "dyn.chart_rain": "Rainfall (mm)",
      "dyn.chart_clouds": "Cloud Cover (%)",
      "dyn.chart_wind": "Wind Speed (km/h)",
      "dyn.chart_humidity": "Relative Humidity (%)",
      "dyn.chart_comfort": "Comfort Index (0-10, calculated)",
      "dyn.popup_province": "Province:",
      "dyn.popup_weather": "Weather:",
      "dyn.popup_station": "Station:",
      "dyn.popup_active": "BMKG Active",
      "dyn.popup_depth": "Depth:",
      "dyn.popup_coords": "Coords:",
      "dyn.eq_mapped": "{n} earthquakes mapped",
      "dyn.eq_no_tsunami": "No tsunami potential",
      "dyn.eq_no_felt": "No felt reports",
      "dyn.max_temp": "Max Temp",
      "dyn.min_temp": "Min Temp",
      "dyn.rain_lbl": "Rain:",
      "dyn.cloud_lbl": "Clouds:",
      "dyn.map_provinces": "{n} Provinces ({region})",
      "dyn.all_ri": "All Indonesia",
      "dyn.map_mode_risk_toast": "Extreme Weather Risk Map active.",
      "dyn.map_mode_temp_toast": "Capital Temperature Map active.",
      "dyn.legend_title": "Map Temperature Legend",
      "dyn.legend_range": "Observed Temp Range",
      "dyn.legend_cool": "Cool (< 24°C)",
      "dyn.legend_comfy": "Comfy (24-28°C)",
      "dyn.legend_warm": "Warm (29-32°C)",
      "dyn.legend_hot": "Hot (> 32°C)",
      "dyn.legend_risk_low": "Low Risk",
      "dyn.legend_risk_med": "Moderate Risk",
      "dyn.legend_risk_high": "High Risk",
      "dyn.legend_hint": "Click any pin to load meteorological data for that city's BMKG station.",
      "dyn.search_not_found": "Location not found.",
      "dyn.search_adm4_hint": "Press Enter to try a manual ADM4 code.",
      "dyn.search_header": "Location Search Results",
      "dyn.search_found": "{n} Regions Found",
      "dyn.geo_unsupported": "Your browser does not support geolocation",
      "dyn.geo_detecting": "Detecting your GPS coordinates...",
      "dyn.geo_nearest": "Nearest location: {name} ({dist} km)",
      "dyn.geo_not_found": "Unable to find nearest city",
      "dyn.geo_match_fail": "Failed to match coordinates with database",
      "dyn.geo_denied": "Location access denied. Please select a city manually.",
      "dyn.ai_thinking": "AeroAI is analyzing BMKG meteorological data…",
      "dyn.ai_source": "Source: BMKG Meteorological Station Network",
      "dyn.ai_err": "Failed to contact AeroAI Assistant.",
      "dyn.ai_chip_weather": "📍 Weather in {loc}",
      "dyn.ai_chip_rain": "🌧️ Rain Potential",
      "dyn.ai_chip_rec": "👕 Tips for {loc}",
      "dyn.ai_chip_comp": "⚖️ Compare Regions",
      "dyn.ai_chip_hot": "🔥 Hottest in ID",
      "dyn.ai_chip_eq": "🚨 BMKG Quake",
      "dyn.uv_low": "Low",
      "dyn.uv_med": "Moderate",
      "dyn.uv_high": "High",
      "dyn.uv_vhigh": "Very High",
      "dyn.uv_ext": "Extreme",
      "dyn.rec_jemur": "Laundry Drying",
      "dyn.rec_sport": "Outdoor Sports",
      "dyn.rec_drive": "Driving",
      "dyn.rec_umbrella": "Umbrella / Gear",
      "dyn.dossier_title": "Weather Dossier: {loc}",
      "dyn.param_title": "BMKG Parametric Analysis - {loc}",
      "dyn.fcast72_title": "Detailed 72-Hour Weather Forecast - {loc}",
      "dyn.fcast3d_title": "3-Day Weather Forecast - {loc}",
      "dyn.map_title_loc": "Interactive Indonesia Weather Map - {loc}",
      "dyn.map_sub_loc": "Active Location: {loc} · 38 Provincial Capital Stations",
      "dyn.rain_title_loc": "Interactive Indonesia Rainfall Map - {loc}",
      "dyn.ai_sub_loc": "Smart Meteorology Assistant · Active Location: {loc}",
      "dyn.bmkg_gempa": "BMKG QUAKE:",
      "dyn.depth_short": "Depth",
      "dyn.risk_low": "Low",
      "dyn.risk_medium": "Moderate",
      "dyn.risk_high": "High"
    }
  };

  function readSavedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "id" || saved === "en") return saved;
    } catch (e) {}
    return "id";
  }

  let currentLang = readSavedLang();

  function getLang() {
    return currentLang;
  }

  function t(key, params) {
    const dict = I18N_DICTIONARY[currentLang] || I18N_DICTIONARY.id;
    let str = dict[key] !== undefined ? dict[key] : (I18N_DICTIONARY.id[key] ?? key);
    if (params && typeof str === "string") {
      Object.keys(params).forEach((k) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
      });
    }
    return str;
  }

  function translateWeatherDesc(desc) {
    if (!desc || typeof desc !== "string") return desc || "";
    if (currentLang === "id") return desc;
    const key = desc.trim().toLowerCase();
    return WEATHER_DESC_MAP[key] || desc;
  }

  function applyTranslations() {
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });

    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      if (!key) return;
      el.innerHTML = t(key);
    });

    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (key) el.setAttribute("title", t(key));
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) el.setAttribute("placeholder", t(key));
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (key) el.setAttribute("aria-label", t(key));
    });

    const toggleIds = ["btn-lang-toggle", "btn-lang-toggle-mobile"];
    toggleIds.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.textContent = currentLang.toUpperCase();
        btn.setAttribute("aria-pressed", currentLang === "en" ? "true" : "false");
        btn.setAttribute("title", t("nav.lang_title"));
        btn.setAttribute("aria-label", t("nav.lang_title"));
      }
    });
  }

  function setLanguage(lang) {
    const next = lang === "en" ? "en" : "id";
    currentLang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}

    applyTranslations();

    if (typeof window.syncAllTitles === "function" && window.STATE?.activeLocation) {
      window.syncAllTitles(window.STATE.activeLocation);
    }
    if (window.STATE?.currentData && typeof window.syncAllComponentsToActiveLocation === "function") {
      window.syncAllComponentsToActiveLocation(
        window.STATE.currentData,
        Boolean(window.STATE.currentData?.isUnavailable)
      );
    }
    if (window.STATE?.gempaData && typeof window.renderMainEarthquakeCard === "function") {
      window.renderMainEarthquakeCard(window.STATE.gempaData);
    }
    if (Array.isArray(window.STATE?.gempaList) && typeof window.renderEarthquakeRecentList === "function") {
      window.renderEarthquakeRecentList(window.STATE.gempaList);
      if (typeof window.renderEarthquakeMapPins === "function" && document.getElementById("view-earthquake")?.classList.contains("is-active-view")) {
        window.renderEarthquakeMapPins(window.STATE.gempaData, window.STATE.gempaList);
      }
    }
    if (document.getElementById("view-map")?.classList.contains("is-active-view") && typeof window.renderVectorMapPins === "function") {
      window.renderVectorMapPins();
    }
    if (typeof window.renderCapitalsQuickList === "function") {
      window.renderCapitalsQuickList();
    }
    document.dispatchEvent(new CustomEvent("skyvanta:langchange", { detail: { lang: currentLang } }));
  }

  function toggleLanguage() {
    setLanguage(currentLang === "id" ? "en" : "id");
  }

  window.SKYVANTA_I18N = I18N_DICTIONARY;
  window.WEATHER_DESC_MAP = WEATHER_DESC_MAP;
  window.getLang = getLang;
  window.t = t;
  window.translateWeatherDesc = translateWeatherDesc;
  window.applyTranslations = applyTranslations;
  window.setLanguage = setLanguage;
  window.toggleLanguage = toggleLanguage;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTranslations);
  } else {
    applyTranslations();
  }
})();

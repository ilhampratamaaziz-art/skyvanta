require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const iconMapper = require('./public/iconMapper.js');
const { locations: LOCATIONS_DATA, PROVINCIAL_CAPITALS: CAPITALS_FROM_LOCATIONS } = require('./public/locationCodes.js');

const app = express();
const PORT = process.env.PORT || 3000;

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'groq';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load verified wilayah database
let wilayahList = [];
try {
  const rawWilayah = fs.readFileSync(path.join(__dirname, 'wilayah.json'), 'utf8');
  wilayahList = JSON.parse(rawWilayah);
} catch (e) {
  console.error('Error loading wilayah.json:', e);
}

// In-Memory Cache
const weatherCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Load Full Administrative Wilayah Index (83,345 Kelurahan/Desa)
const WILAYAH_INDEX_PATH = path.join(__dirname, 'data', 'wilayahIndex.json');
let fullWilayahIndex = [];
try {
  if (fs.existsSync(WILAYAH_INDEX_PATH)) {
    fullWilayahIndex = JSON.parse(fs.readFileSync(WILAYAH_INDEX_PATH, 'utf8'));
    console.log(`[WilayahIndex] Loaded ${fullWilayahIndex.length} administrative entities.`);
  }
} catch (e) {
  console.error('Error loading wilayahIndex.json:', e.message);
}

// Load BMKG Verification Cache (Rule B)
const BMKG_CACHE_PATH = path.join(__dirname, 'data', 'bmkgCache.json');
const BMKG_CACHE_WRITE_PATH = process.env.VERCEL
  ? path.join('/tmp', 'bmkgCache.json')
  : BMKG_CACHE_PATH;
let bmkgVerificationCache = {};
let bmkgCacheWriteWarned = false;
try {
  if (fs.existsSync(BMKG_CACHE_PATH)) {
    bmkgVerificationCache = JSON.parse(fs.readFileSync(BMKG_CACHE_PATH, 'utf8'));
  }
  if (process.env.VERCEL && fs.existsSync(BMKG_CACHE_WRITE_PATH)) {
    const tmpCache = JSON.parse(fs.readFileSync(BMKG_CACHE_WRITE_PATH, 'utf8'));
    bmkgVerificationCache = { ...bmkgVerificationCache, ...tmpCache };
  }
} catch (e) {
  console.error('Error loading bmkgCache.json:', e.message);
}

function saveBmkgCache() {
  try {
    fs.writeFileSync(BMKG_CACHE_WRITE_PATH, JSON.stringify(bmkgVerificationCache, null, 2), 'utf8');
  } catch (e) {
    if (!bmkgCacheWriteWarned) {
      bmkgCacheWriteWarned = true;
      console.warn('[bmkgCache] Skip persisting cache (read-only filesystem):', e.code || e.message);
    }
  }
}

const bmkgWarnedCodes = new Set();

function searchWilayah(query, limit = 5) {
  if (!query || typeof query !== 'string') return [];
  const cleanQ = query.trim().toLowerCase();
  const tokens = cleanQ.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return [];

  const candidates = [];
  for (let i = 0; i < fullWilayahIndex.length; i++) {
    const item = fullWilayahIndex[i];
    const kel = item.kelurahan.toLowerCase();
    const kec = item.kecamatan.toLowerCase();
    const kab = item.kabupaten.toLowerCase();
    const prov = item.provinsi.toLowerCase();

    const allMatch = tokens.every(tok => 
      kel.includes(tok) || kec.includes(tok) || kab.includes(tok) || prov.includes(tok)
    );

    if (allMatch) {
      let score = 0;
      if (kel === cleanQ) score += 100;
      else if (kel.startsWith(cleanQ)) score += 60;
      else if (kel.includes(cleanQ)) score += 40;
      if (kec === cleanQ) score += 80;
      tokens.forEach(tok => {
        if (kel === tok) score += 40;
        else if (kel.includes(tok)) score += 15;
        if (kec === tok) score += 25;
        else if (kec.includes(tok)) score += 10;
        if (kab === tok || kab.replace(/^(kabupaten|kota)\s+/i, '') === tok) score += 25;
        else if (kab.includes(tok)) score += 10;
      });
      candidates.push({ item, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, limit).map(c => c.item);
}

// Known ADM4 aliases & corrections for BMKG API
const ADM4_ALIASES = {
  '14.71.01.1001': '14.71.01.1002', // Kota Pekanbaru (Sukajadi/Jadirejo)
  '81.71.01.1001': '81.71.01.2001', // Kota Ambon (Nusaniwe/Latuhalat)
};

// 38 Official Provincial Capitals of Indonesia
const PROVINCIAL_CAPITALS = [
  // SUMATERA
  { name: 'Banda Aceh', prov: 'Aceh', adm4: '11.71.01.2001', xPct: 10.8, yPct: 22.3, region: 'Sumatera', labelPos: 'top' },
  { name: 'Medan', prov: 'Sumatera Utara', adm4: '12.71.01.1001', xPct: 14.0, yPct: 30.5, region: 'Sumatera', labelPos: 'right' },
  { name: 'Padang', prov: 'Sumatera Barat', adm4: '13.71.01.1001', xPct: 14.8, yPct: 48.0, region: 'Sumatera', labelPos: 'left' },
  { name: 'Pekanbaru', prov: 'Riau', adm4: '14.71.01.1002', xPct: 17.5, yPct: 39.5, region: 'Sumatera', labelPos: 'top' },
  { name: 'Tanjung Pinang', prov: 'Kepulauan Riau', adm4: '21.72.01.1001', xPct: 21.1, yPct: 39.8, region: 'Sumatera', labelPos: 'right' },
  { name: 'Jambi', prov: 'Jambi', adm4: '15.71.01.1001', xPct: 19.5, yPct: 46.5, region: 'Sumatera', labelPos: 'right' },
  { name: 'Palembang', prov: 'Sumatera Selatan', adm4: '16.71.01.1001', xPct: 22.2, yPct: 52.9, region: 'Sumatera', labelPos: 'right' },
  { name: 'Pangkal Pinang', prov: 'Kep. Bangka Belitung', adm4: '19.71.02.1001', xPct: 24.9, yPct: 48.2, region: 'Sumatera', labelPos: 'right' },
  { name: 'Bengkulu', prov: 'Bengkulu', adm4: '17.71.01.1001', xPct: 17.2, yPct: 56.4, region: 'Sumatera', labelPos: 'left' },
  { name: 'Bandar Lampung', prov: 'Lampung', adm4: '18.71.01.1003', xPct: 24.0, yPct: 62.5, region: 'Sumatera', labelPos: 'bottom' },

  // JAWA
  { name: 'Serang', prov: 'Banten', adm4: '36.73.01.1001', xPct: 26.2, yPct: 71.5, region: 'Jawa', labelPos: 'left' },
  { name: 'Jakarta', prov: 'DKI Jakarta', adm4: '31.71.01.1001', xPct: 28.5, yPct: 71.5, region: 'Jawa', labelPos: 'top' },
  { name: 'Bandung', prov: 'Jawa Barat', adm4: '32.73.01.1001', xPct: 30.5, yPct: 74.0, region: 'Jawa', labelPos: 'bottom' },
  { name: 'Semarang', prov: 'Jawa Tengah', adm4: '33.74.01.1001', xPct: 34.5, yPct: 72.1, region: 'Jawa', labelPos: 'top' },
  { name: 'Yogyakarta', prov: 'D.I. Yogyakarta', adm4: '34.71.01.1001', xPct: 34.3, yPct: 76.2, region: 'Jawa', labelPos: 'bottom' },
  { name: 'Surabaya', prov: 'Jawa Timur', adm4: '35.78.01.1001', xPct: 39.2, yPct: 73.0, region: 'Jawa', labelPos: 'right' },

  // BALI & NUSA TENGGARA
  { name: 'Denpasar', prov: 'Bali', adm4: '51.71.01.1001', xPct: 43.2, yPct: 76.4, region: 'Bali & Nusa Tenggara', labelPos: 'bottom' },
  { name: 'Mataram', prov: 'Nusa Tenggara Barat', adm4: '52.71.02.1001', xPct: 45.3, yPct: 77.5, region: 'Bali & Nusa Tenggara', labelPos: 'bottom' },
  { name: 'Kupang', prov: 'Nusa Tenggara Timur', adm4: '53.71.01.1001', xPct: 55.3, yPct: 83.2, region: 'Bali & Nusa Tenggara', labelPos: 'bottom' },

  // KALIMANTAN
  { name: 'Pontianak', prov: 'Kalimantan Barat', adm4: '61.71.01.1002', xPct: 34.1, yPct: 42.4, region: 'Kalimantan', labelPos: 'left' },
  { name: 'Palangka Raya', prov: 'Kalimantan Tengah', adm4: '62.71.01.1001', xPct: 40.5, yPct: 47.1, region: 'Kalimantan', labelPos: 'top' },
  { name: 'Banjarmasin', prov: 'Kalimantan Selatan', adm4: '63.71.01.1001', xPct: 43.2, yPct: 53.5, region: 'Kalimantan', labelPos: 'bottom' },
  { name: 'Samarinda', prov: 'Kalimantan Timur', adm4: '64.72.01.1001', xPct: 47.8, yPct: 41.4, region: 'Kalimantan', labelPos: 'right' },
  { name: 'Tanjung Selor', prov: 'Kalimantan Utara', adm4: '65.01.01.1001', xPct: 47.5, yPct: 30.5, region: 'Kalimantan', labelPos: 'top' },

  // SULAWESI
  { name: 'Manado', prov: 'Sulawesi Utara', adm4: '71.71.01.1001', xPct: 62.0, yPct: 27.5, region: 'Sulawesi', labelPos: 'right' },
  { name: 'Gorontalo', prov: 'Gorontalo', adm4: '75.71.01.1001', xPct: 57.2, yPct: 35.2, region: 'Sulawesi', labelPos: 'bottom' },
  { name: 'Palu', prov: 'Sulawesi Tengah', adm4: '72.71.02.1002', xPct: 53.5, yPct: 43.6, region: 'Sulawesi', labelPos: 'left' },
  { name: 'Mamuju', prov: 'Sulawesi Barat', adm4: '76.02.01.1002', xPct: 52.1, yPct: 52.1, region: 'Sulawesi', labelPos: 'left' },
  { name: 'Makassar', prov: 'Sulawesi Selatan', adm4: '73.71.01.1001', xPct: 53.2, yPct: 64.5, region: 'Sulawesi', labelPos: 'left' },
  { name: 'Kendari', prov: 'Sulawesi Tenggara', adm4: '74.71.03.1001', xPct: 58.4, yPct: 57.8, region: 'Sulawesi', labelPos: 'right' },

  // MALUKU
  { name: 'Ambon', prov: 'Maluku', adm4: '81.71.01.2001', xPct: 70.8, yPct: 58.6, region: 'Maluku', labelPos: 'bottom' },
  { name: 'Sofifi', prov: 'Maluku Utara', adm4: '82.72.01.1001', xPct: 69.1, yPct: 35.7, region: 'Maluku', labelPos: 'right' },

  // PAPUA
  { name: 'Sorong', prov: 'Papua Barat Daya', adm4: '96.71.01.1001', xPct: 77.5, yPct: 42.8, region: 'Papua', labelPos: 'left' },
  { name: 'Manokwari', prov: 'Papua Barat', adm4: '92.02.12.1001', xPct: 80.8, yPct: 41.5, region: 'Papua', labelPos: 'top' },
  { name: 'Nabire', prov: 'Papua Tengah', adm4: '94.01.01.1001', xPct: 85.3, yPct: 46.9, region: 'Papua', labelPos: 'bottom' },
  { name: 'Jayapura', prov: 'Papua', adm4: '91.71.01.1001', xPct: 91.0, yPct: 43.4, region: 'Papua', labelPos: 'top' },
  { name: 'Wamena', prov: 'Papua Pegunungan', adm4: '95.01.01.1001', xPct: 89.0, yPct: 53.5, region: 'Papua', labelPos: 'bottom' },
  { name: 'Merauke', prov: 'Papua Selatan', adm4: '93.01.01.2001', xPct: 92.5, yPct: 71.5, region: 'Papua', labelPos: 'bottom' },
];

let capitalsCache = {
  data: null,
  timestamp: 0
};
const CAPITALS_TTL_MS = 10 * 60 * 1000; // 10 minutes

let gempaCache = {
  data: null,
  timestamp: 0
};
let gempaTerkiniCache = {
  data: null,
  timestamp: 0
};
const GEMPA_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Helpers for Meteorological Calculations & Smart Alerts
function calculateFeelsLike(temperature, humidity, windSpeedKmh) {
  // Australian Apparent Temperature formula: AT = Ta + 0.33×e - 0.70×ws - 4.00
  // e = (humidity / 100) * 6.105 * exp((17.27 * Ta) / (237.7 + Ta))
  const Ta = temperature;
  const ws = (windSpeedKmh || 0) / 3.6; // convert to m/s
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * Ta) / (237.7 + Ta));
  const at = Ta + 0.33 * e - 0.70 * ws - 4.00;
  return Math.round(at * 10) / 10;
}

function calculateDewPoint(temperature, humidity) {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temperature) / (b + temperature)) + Math.log(humidity / 100.0);
  return Math.round(((b * alpha) / (a - alpha)) * 10) / 10;
}

function estimateUVIndex(hour, cloudCover) {
  // Peak UV is between 11:00 and 14:00 local time
  let baseUV = 0;
  if (hour >= 6 && hour <= 18) {
    // Sinusoidal curve peaking at noon (12:00)
    const factor = Math.sin(((hour - 6) / 12) * Math.PI);
    baseUV = factor * 11; // Tropical Indonesia max UV ~ 11-12
  }
  // Attenuation by cloud cover
  const cloudFactor = 1 - (cloudCover / 100) * 0.7;
  const uv = Math.max(0, Math.round(baseUV * cloudFactor * 10) / 10);
  return uv;
}

function getComfortIndex(temp, humidity) {
  if (temp < 22) return { status: 'Sejuk & Dingin', color: 'cyan', desc: 'Suhu sejuk pegunungan' };
  if (temp <= 28 && humidity <= 75) return { status: 'Optimal & Nyaman', color: 'emerald', desc: 'Sangat nyaman untuk aktivitas' };
  if (temp <= 32 && humidity <= 85) return { status: 'Cukup Hangat', color: 'amber', desc: 'Sedikit lembap, cukup terhidrasi' };
  if (temp > 32 || humidity > 85) return { status: 'Gerah & Terik', color: 'rose', desc: 'Udara panas tropis, perbanyak minum air' };
  return { status: 'Normal', color: 'blue', desc: 'Kondisi cuaca wajar' };
}

function generateSmartAlerts(current, forecast) {
  const alerts = [];
  const desc = (current.weather_desc || '').toLowerCase();
  const temp = current.t || 28;
  const wind = current.ws || 0;
  const precip = current.tp || 0;
  const uv = current.uvIndex || 0;

  // 1. Extreme Rain / Thunderstorm
  if (desc.includes('petir') || desc.includes('lebat') || precip >= 15) {
    alerts.push({
      id: 'rain-alert',
      level: 'danger',
      title: 'Peringatan Cuaca Ekstrem: Hujan Lebat & Kilat/Petir',
      message: `Terdeteksi potensi hujan intensitas tinggi (${precip} mm) disertai aktivitas petir di wilayah ini.`,
      advice: 'Hindari berteduh di bawah pohon rindang/baliho, waspadai genangan jalan dan sambaran petir.',
      icon: 'thunder'
    });
  } else if (desc.includes('hujan sedang') || precip >= 5) {
    alerts.push({
      id: 'moderate-rain',
      level: 'warning',
      title: 'Waspada Hujan Sedang',
      message: 'Potensi hujan berdurasi sedang dapat mempengaruhi jarak pandang dan kelancaran mobilitas.',
      advice: 'Siapkan payung/jas hujan dan kurangi laju kecepatan saat berkendara.',
      icon: 'rain'
    });
  }

  // 2. High Wind
  if (wind >= 25) {
    alerts.push({
      id: 'wind-alert',
      level: 'danger',
      title: 'Peringatan Angin Kencang BMKG',
      message: `Kecepatan hembusan angin terdeteksi mencapai ${wind} km/jam.`,
      advice: 'Waspadai potensi pohon tumbang, gelombang perairan tinggi, dan gangguan infrastruktur luar ruang.',
      icon: 'wind'
    });
  } else if (wind >= 18) {
    alerts.push({
      id: 'breeze-alert',
      level: 'info',
      title: 'Hembusan Angin Cukup Kencang',
      message: `Kecepatan angin sekitar ${wind} km/jam. Waspada bagi pengendara roda dua di jembatan atau jalan terbuka.`,
      advice: 'Pastikan barang di balkon terikat dengan aman.',
      icon: 'wind'
    });
  }

  // 3. Extreme Heat / UV Radiation
  if (temp >= 34 || uv >= 9) {
    alerts.push({
      id: 'heat-alert',
      level: 'danger',
      title: 'Peringatan Suhu Panas & Indeks UV Sangat Tinggi',
      message: `Suhu mencapai ${temp}°C dengan indeks radiasi UV ${uv} (Tingkat Sangat Tinggi / Ekstrem).`,
      advice: 'Gunakan tabir surya (SPF 30+), penutup kepala, kacamata hitam, dan minum air putih teratur untuk mencegah dehidrasi.',
      icon: 'sun'
    });
  } else if (temp >= 32 || uv >= 6) {
    alerts.push({
      id: 'uv-alert',
      level: 'warning',
      title: 'Radiasi UV Kategori Tinggi',
      message: `Indeks radiasi UV berada pada tingkat ${uv}. Paparan sinar matahari langsung di siang hari dapat memicu sunburn.`,
      advice: 'Kurangi aktivitas langsung di bawah sinar terik antara pukul 11:00 - 14:00.',
      icon: 'sun'
    });
  }

  // Fallback reassuring alert if condition is safe
  if (alerts.length === 0) {
    alerts.push({
      id: 'normal-alert',
      level: 'success',
      title: 'Kondisi Cuaca Kondusif & Normal',
      message: 'Parameter atmosfer terpantau dalam rentang aman dan stabil tanpa indikasi cuaca ekstrem.',
      advice: 'Sangat baik untuk aktivitas kerja, bepergian, dan olahraga luar ruangan.',
      icon: 'check'
    });
  }

  return alerts;
}

function generateWeatherInsight(lokasi, current, cuacaDays, forecast) {
  let day0Max = -Infinity, day0Min = Infinity;
  let day1Max = -Infinity, day1Min = Infinity;
  let day2Max = -Infinity, day2Min = Infinity;

  if (cuacaDays[0]) {
    cuacaDays[0].forEach(item => {
      if (item.t > day0Max) day0Max = item.t;
      if (item.t < day0Min) day0Min = item.t;
    });
  }
  if (cuacaDays[1]) {
    cuacaDays[1].forEach(item => {
      if (item.t > day1Max) day1Max = item.t;
      if (item.t < day1Min) day1Min = item.t;
    });
  }
  if (cuacaDays[2]) {
    cuacaDays[2].forEach(item => {
      if (item.t > day2Max) day2Max = item.t;
      if (item.t < day2Min) day2Min = item.t;
    });
  }

  const deltaTempTomorrow = (day1Max !== -Infinity && day0Max !== -Infinity)
    ? Math.round((day1Max - day0Max) * 10) / 10
    : 0;

  const deltaTempDayAfter = (day2Max !== -Infinity && day1Max !== -Infinity)
    ? Math.round((day2Max - day1Max) * 10) / 10
    : 0;

  // Outdoor score calculation (0 to 100)
  let outdoorScore = 88;
  const desc = (current.weather_desc || '').toLowerCase();
  if (desc.includes('petir') || desc.includes('lebat')) outdoorScore -= 50;
  else if (desc.includes('hujan')) outdoorScore -= 30;
  else if (desc.includes('awan')) outdoorScore -= 5;

  if (current.t >= 34) outdoorScore -= 20;
  else if (current.t >= 32) outdoorScore -= 10;
  else if (current.t <= 20) outdoorScore -= 10;

  if (current.ws >= 20) outdoorScore -= 15;
  if (current.uvIndex >= 8) outdoorScore -= 15;
  outdoorScore = Math.max(10, Math.min(100, outdoorScore));

  const isRain = desc.includes('hujan') || desc.includes('petir') || (current.tp || 0) > 1;
  const isHot = (current.t || 28) >= 32;

  const jemur = isRain
    ? { status: 'Tidak Disarankan', color: 'rose', reason: 'Pakaian berisiko basah kembali akibat curah hujan' }
    : isHot
    ? { status: 'Sangat Cepat Kering', color: 'emerald', reason: 'Paparan sinar matahari terik dan angin mendukung' }
    : { status: 'Cukup Baik', color: 'cyan', reason: 'Kelembapan dan sirkulasi angin memadai' };

  const olahraga = isRain
    ? { status: 'Olahraga Dalam Ruang', color: 'amber', reason: 'Lintasan licin dan potensi sambaran petir' }
    : outdoorScore >= 75
    ? { status: 'Sangat Ideal', color: 'emerald', reason: 'Suhu dan kualitas udara nyaman untuk berolahraga' }
    : { status: 'Perhatikan Hidrasi', color: 'amber', reason: 'Udara terik, sediakan air minum ekstra' };

  const berkendara = isRain
    ? { status: 'Waspada Licin & Genangan', color: 'rose', reason: 'Kurangi kecepatan kendaraan dan nyalakan lampu' }
    : (current.ws || 0) >= 20
    ? { status: 'Waspada Angin Samping', color: 'amber', reason: 'Hembusan angin terasa di jembatan / tol terbuka' }
    : { status: 'Aman & Lancar', color: 'emerald', reason: 'Jarak pandang dan kondisi aspal kering optimal' };

  const perlindungan = (current.uvIndex || 0) >= 6 || isHot
    ? { status: 'Gunakan Tabir Surya (SPF 30+)', color: 'amber', reason: 'Radiasi sinar UV tinggi di siang hari' }
    : isRain
    ? { status: 'Bawa Payung / Jas Hujan', color: 'blue', reason: 'Antisipasi perubahan cuaca sewaktu-waktu' }
    : { status: 'Pakaian Santai Nyaman', color: 'cyan', reason: 'Kondisi cuaca sangat bersahabat' };

  let riskLevel = 'Rendah (Aman)';
  let riskColor = 'emerald';
  let riskCode = 'low';
  if (desc.includes('petir') || desc.includes('lebat') || (current.ws || 0) >= 25 || (current.t || 28) >= 35) {
    riskLevel = 'Tinggi (Waspada Ekstrem)';
    riskColor = 'rose';
    riskCode = 'high';
  } else if (desc.includes('hujan') || (current.ws || 0) >= 18 || (current.uvIndex || 0) >= 8) {
    riskLevel = 'Sedang (Perhatian)';
    riskColor = 'amber';
    riskCode = 'medium';
  }

  let narrative = `Kondisi di ${lokasi.kotkab || lokasi.desa || 'wilayah terpilih'} saat ini terpantau ${current.weather_desc || 'Berawan'} dengan suhu ${current.t}°C (terasa seperti ${current.feelsLike}°C). `;
  if (deltaTempTomorrow > 0) {
    narrative += `Prakiraan suhu puncak esok hari diprediksi naik sekitar +${deltaTempTomorrow}°C dibanding hari ini. `;
  } else if (deltaTempTomorrow < 0) {
    narrative += `Prakiraan suhu esok hari diprediksi lebih sejuk sekitar ${deltaTempTomorrow}°C dibanding hari ini. `;
  } else {
    narrative += `Fluktuasi suhu esok hari diperkirakan relatif stabil. `;
  }

  if (isRain) {
    narrative += `Masyarakat diimbau mengantisipasi genangan air dan jalanan basah.`;
  } else {
    narrative += `Kondisi sangat mendukung untuk berbagai kegiatan produktif luar ruangan.`;
  }

  return {
    narrative,
    outdoorScore,
    riskLevel,
    riskColor,
    riskCode,
    tempChanges: {
      tomorrow: {
        delta: deltaTempTomorrow,
        label: deltaTempTomorrow > 0 ? `+${deltaTempTomorrow}°C Lebih Panas` : deltaTempTomorrow < 0 ? `${deltaTempTomorrow}°C Lebih Sejuk` : 'Stabil (0°C)'
      },
      dayAfter: {
        delta: deltaTempDayAfter,
        label: deltaTempDayAfter > 0 ? `+${deltaTempDayAfter}°C Lebih Panas` : deltaTempDayAfter < 0 ? `${deltaTempDayAfter}°C Lebih Sejuk` : 'Stabil (0°C)'
      }
    },
    recommendations: {
      jemur,
      olahraga,
      berkendara,
      perlindungan
    }
  };
}

// Distance calculation using Haversine formula (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. Wilayah List Endpoint with optional province filter
// Endpoint Cari Wilayah (Rule C)
app.get('/api/lokasi/cari', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: true, count: 0, data: [] });
  }
  const results = searchWilayah(q, 5);
  return res.json({ success: true, count: results.length, data: results });
});

app.get('/api/wilayah', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  const prov = (req.query.provinsi || '').trim().toLowerCase();
  let filtered = wilayahList;

  if (prov) {
    filtered = filtered.filter(w => w.provinsi.toLowerCase() === prov || w.provinsi.toLowerCase().includes(prov));
  }

  if (query) {
    filtered = filtered.filter(w =>
      w.name.toLowerCase().includes(query) ||
      w.provinsi.toLowerCase().includes(query) ||
      w.kotkab.toLowerCase().includes(query) ||
      w.adm4.includes(query)
    );
  }
  return res.json({ success: true, total: filtered.length, data: filtered });
});

// 1b. Distinct Provinces List Endpoint
app.get('/api/provinsi', (req, res) => {
  const provMap = new Map();
  for (const w of wilayahList) {
    const prov = w.provinsi;
    if (!provMap.has(prov)) {
      provMap.set(prov, {
        name: prov,
        count: 1,
        sampleAdm4: w.adm4
      });
    } else {
      provMap.get(prov).count += 1;
    }
  }
  const provinces = Array.from(provMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return res.json({ success: true, total: provinces.length, data: provinces });
});

// 2. Nearest Wilayah from GPS Coordinates
app.get('/api/nearest', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ success: false, message: 'Valid lat & lon are required' });
  }

  let nearest = null;
  let minDistance = Infinity;

  for (const w of wilayahList) {
    const d = haversineDistance(lat, lon, w.lat, w.lon);
    if (d < minDistance) {
      minDistance = d;
      nearest = { ...w, distanceKm: Math.round(d * 10) / 10 };
    }
  }

  return res.json({ success: true, nearest });
});


// Reusable helper to fetch or read from cache verified BMKG weather data
async function getWeatherDataForAdm4(adm4Input, forceRefresh = false) {
  if (!adm4Input || adm4Input === 'null' || adm4Input === 'undefined') {
    return { status: 'no-data', message: 'BMKG belum menyediakan data untuk wilayah ini' };
  }
  let adm4 = adm4Input.trim();
  if (ADM4_ALIASES[adm4]) adm4 = ADM4_ALIASES[adm4];

  // Rule B: Cek cache verifikasi BMKG dulu
  const verif = bmkgVerificationCache[adm4];
  const now = Date.now();
  if (!forceRefresh && verif && verif.status === 'no-data') {
    const checkedTime = new Date(verif.checkedAt).getTime();
    const TTL_24H = 24 * 60 * 60 * 1000;
    if (now - checkedTime < TTL_24H) {
      return { status: 'no-data', message: 'BMKG belum menyediakan data untuk wilayah ini', adm4 };
    }
  }

  const cached = weatherCache.get(adm4);
  if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
    return { ...cached.payload, status: 'ok', fromCache: true, dataStatus: 'CACHED' };
  }

  try {
    const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;
    const response = await fetch(bmkgUrl, {
      headers: {
        'User-Agent': 'BMKG-Weather-Indonesia-App/1.0',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
      if (cached) {
        return { ...cached.payload, status: 'ok', fromCache: true, rateLimited: response.status === 429, fallback: true, dataStatus: 'STALE' };
      }

      if (response.status === 404) {
        // Rule B: Log 404 hanya sekali per kode, ditulis ke console dengan console.warn
        if (!bmkgWarnedCodes.has(adm4)) {
          bmkgWarnedCodes.add(adm4);
          console.warn(`[BMKG 404] Data cuaca tidak ditemukan untuk kode adm4: ${adm4}`);
        }
        bmkgVerificationCache[adm4] = { status: 'no-data', checkedAt: new Date().toISOString() };
        saveBmkgCache();
      } else {
        console.warn(`[BMKG HTTP ${response.status}] Gagal sementara untuk kode adm4: ${adm4}`);
      }

      return { status: 'no-data', rateLimited: response.status === 429, message: 'BMKG belum menyediakan data untuk wilayah ini', adm4 };
    }

    const rawData = await response.json();
    if (!rawData || !rawData.data || !rawData.data.length || !rawData.data[0].cuaca || !rawData.data[0].cuaca.length) {
      if (cached) return { ...cached.payload, status: 'ok', fromCache: true, dataStatus: 'STALE' };

      if (!bmkgWarnedCodes.has(adm4)) {
        bmkgWarnedCodes.add(adm4);
        console.warn(`[BMKG 404] Data cuaca tidak ditemukan untuk kode adm4: ${adm4}`);
      }
      bmkgVerificationCache[adm4] = { status: 'no-data', checkedAt: new Date().toISOString() };
      saveBmkgCache();

      return { status: 'no-data', rateLimited: response.status === 429, message: 'BMKG belum menyediakan data untuk wilayah ini', adm4 };
    }

    // Success status ok
    bmkgVerificationCache[adm4] = { status: 'ok', checkedAt: new Date().toISOString() };
    saveBmkgCache();

    const lokasi = rawData.lokasi || {};
    const cuacaDays = rawData.data[0].cuaca || [];

    const flattenedCuaca = [];
    let minTemp = Infinity;
    let maxTemp = -Infinity;

    cuacaDays.forEach((dayArr, dayIdx) => {
      dayArr.forEach(item => {
        const localDate = new Date(item.local_datetime || item.datetime);
        const hour = localDate.getHours();
        const t = item.t;
        const hu = item.hu;
        const ws = item.ws;
        const tcc = item.tcc || 0;

        if (t < minTemp) minTemp = t;
        if (t > maxTemp) maxTemp = t;

        const feelsLike = calculateFeelsLike(t, hu, ws);
        const dewPoint = calculateDewPoint(t, hu);
        const uvIndex = estimateUVIndex(hour, tcc);
        const comfort = getComfortIndex(t, hu);
        const localIcon = iconMapper.getWeatherIcon(item.weather_desc, item.weather);
        item.image = localIcon;

        flattenedCuaca.push({
          ...item,
          image: localIcon,
          dayIndex: dayIdx,
          hour,
          feelsLike,
          dewPoint,
          uvIndex,
          comfort
        });
      });
    });

    // Rule 3: Ambil nilai curah hujan dari field tp di data prakiraan BMKG (ambil prakiraan terdekat dengan waktu sekarang)
    const nowMs = Date.now();
    let currentCondition = flattenedCuaca[0] || {};
    let minDiffCurrent = Infinity;
    flattenedCuaca.forEach((slot) => {
      const slotMs = new Date(slot.utc_datetime || slot.datetime).getTime();
      const diff = Math.abs(nowMs - slotMs);
      if (diff < minDiffCurrent) {
        minDiffCurrent = diff;
        currentCondition = slot;
      }
    });
    const currentHour = new Date().getHours();
    const currentUV = estimateUVIndex(currentHour, currentCondition.tcc || 0);

    const smartAlerts = generateSmartAlerts(currentCondition, flattenedCuaca);
    const weatherInsight = generateWeatherInsight(lokasi, currentCondition, cuacaDays, flattenedCuaca);

    const dateNow = new Date();
    const lastUpdatedFormatted = dateNow.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ` ${lokasi.timezone || 'WIB'}`;

    const payload = {
      success: true,
      dataStatus: 'LIVE',
      lokasi: {
        adm4,
        desa: lokasi.desa || '',
        kecamatan: lokasi.kecamatan || '',
        kotkab: lokasi.kotkab || '',
        provinsi: lokasi.provinsi || '',
        lat: lokasi.lat || 0,
        lon: lokasi.lon || 0,
        timezone: lokasi.timezone || 'WIB'
      },
      current: {
        ...currentCondition,
        uvIndex: currentUV,
        minTempToday: minTemp === Infinity ? 25 : minTemp,
        maxTempToday: maxTemp === -Infinity ? 32 : maxTemp,
        feelsLike: calculateFeelsLike(currentCondition.t || 28, currentCondition.hu || 75, currentCondition.ws || 5),
        comfort: getComfortIndex(currentCondition.t || 28, currentCondition.hu || 75)
      },
      days: cuacaDays,
      forecast: flattenedCuaca,
      smartAlerts,
      weatherInsight,
      lastUpdated: dateNow.toISOString(),
      lastUpdatedFormatted,
      source: 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG) Republik Indonesia',
      attribution: 'Platform informasi cuaca berbasis data BMKG (Kepmendagri No. 100.1.1-6117)',
      fetchedAt: dateNow.toISOString(),
      status: 'ok',
      success: true
    };

    weatherCache.set(adm4, { payload, timestamp: now });
    return payload;
  } catch (err) {
    if (cached) return { ...cached.payload, status: 'ok', fromCache: true, fallback: true, dataStatus: 'STALE' };
    throw err;
  }
}

// 3. Official BMKG Weather Forecast Endpoint
app.get('/api/cuaca', async (req, res) => {
  if (req.query.adm4 === 'null' || req.query.adm4 === 'undefined') {
    return res.status(404).json({
      success: false,
      status: 'no-data',
      message: 'BMKG belum menyediakan data untuk wilayah ini',
      dataStatus: 'NO_DATA'
    });
  }
  let adm4 = (req.query.adm4 || '31.71.01.1001').trim();
  const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

  try {
    const result = await getWeatherDataForAdm4(adm4, forceRefresh);
    if (!result || result.status === 'no-data') {
      return res.status(404).json({
        success: false,
        status: 'no-data',
        message: 'BMKG belum menyediakan data untuk wilayah ini',
        adm4
      });
    }
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error in /api/cuaca:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data BMKG' });
  }
});

app.get('/api/cuaca/verified', (req, res) => {
  const verifiedCodes = Object.keys(bmkgVerificationCache).filter(
    (code) => bmkgVerificationCache[code] && bmkgVerificationCache[code].status === 'ok'
  );
  return res.json({ success: true, verifiedCodes });
});

async function fetchCapitalsSnapshot() {
  const now = Date.now();
  if (capitalsCache.data && now - capitalsCache.timestamp < CAPITALS_TTL_MS) {
    const liveCount = capitalsCache.data.filter(c => !c.isFallback).length;
    return { data: capitalsCache.data, fromCache: true, liveCount, totalCount: PROVINCIAL_CAPITALS.length, timestamp: capitalsCache.timestamp };
  }

  const results = [];
  const batchSize = 4;
  let abortedByRateLimit = false;
  for (let i = 0; i < PROVINCIAL_CAPITALS.length; i += batchSize) {
    const slice = PROVINCIAL_CAPITALS.slice(i, i + batchSize);
    if (abortedByRateLimit) {
      results.push(...slice.map(cap => {
        const cached = weatherCache.get(cap.adm4);
        if (cached && cached.payload?.current) {
          const cur = cached.payload.current;
          return { ...cap, temp: cur.t, weatherDesc: cur.weather_desc || 'Cerah Berawan', humidity: cur.hu, windSpeed: cur.ws, windDir: cur.wd || 'Tenggara', precipitation: cur.tp ?? null, tp: cur.tp ?? null, local_datetime: cur.local_datetime || null, cached: true, isFallback: false };
        }
        return { ...cap, temp: null, weatherDesc: null, icon: null, image: null, humidity: null, windSpeed: null, windDir: null, precipitation: null, tp: null, isFallback: true, dataUnavailable: true };
      }));
      continue;
    }
    const hasUncached = slice.some((cap) => {
      const cached = weatherCache.get(cap.adm4);
      return !cached || (now - cached.timestamp >= CACHE_TTL_MS);
    });
    if (i > 0 && hasUncached) {
      await new Promise(r => setTimeout(r, 220));
    }
    const batchResults = await Promise.all(
      slice.map(async (cap) => {
        const w = await getWeatherDataForAdm4(cap.adm4, false);
        if (w && w.rateLimited) abortedByRateLimit = true;
        if (w && w.status === 'ok' && w.current) {
          const cur = w.current;
          const tpVal = cur.tp !== undefined && cur.tp !== null ? cur.tp : null;
          const weatherDesc = cur.weather_desc || 'Cerah Berawan';
          const localIcon = cur.localIcon || iconMapper.getWeatherIcon(weatherDesc, cur.weather);
          return {
            ...cap,
            temp: cur.t,
            weatherDesc,
            icon: localIcon,
            image: localIcon,
            humidity: cur.hu,
            windSpeed: cur.ws,
            windDir: cur.wd || 'Tenggara',
            precipitation: tpVal,
            tp: tpVal,
            local_datetime: cur.local_datetime || cur.datetime || null,
            cached: Boolean(w.fromCache),
            isFallback: cur.t === undefined || cur.t === null
          };
        }

        return {
          ...cap,
          temp: null,
          weatherDesc: null,
          icon: null,
          image: null,
          humidity: null,
          windSpeed: null,
          windDir: null,
          precipitation: null,
          tp: null,
          isFallback: true,
          dataUnavailable: true
        };
      })
    );
    results.push(...batchResults);
  }

  const liveCount = results.filter(c => !c.isFallback).length;
  if (liveCount > 0) {
    capitalsCache = {
      data: results,
      timestamp: now
    };
  } else if (capitalsCache.data) {
    const prevLive = capitalsCache.data.filter(c => !c.isFallback).length;
    if (prevLive > 0) {
      return { data: capitalsCache.data, fromCache: true, liveCount: prevLive, totalCount: PROVINCIAL_CAPITALS.length, timestamp: capitalsCache.timestamp };
    }
  }

  return { data: results, fromCache: false, liveCount, totalCount: PROVINCIAL_CAPITALS.length, timestamp: now };
}

app.get('/api/cuaca/capitals', async (req, res) => {
  try {
    const snap = await fetchCapitalsSnapshot();
    if (snap.fromCache) {
      return res.json({ success: true, fromCache: true, data: snap.data });
    }
    return res.json({ success: true, count: snap.data.length, data: snap.data });
  } catch (err) {
    console.error('Error fetching capitals weather:', err);
    if (capitalsCache.data) {
      return res.json({ success: true, fromCache: true, fallback: true, data: capitalsCache.data });
    }
    return res.status(500).json({ success: false, message: 'Gagal memuat data cuaca ibukota' });
  }
});

// 5. BMKG Real-time Earthquake Endpoint (autogempa)
app.get('/api/gempa', async (req, res) => {
  const now = Date.now();
  if (gempaCache.data && now - gempaCache.timestamp < GEMPA_TTL_MS) {
    return res.json({ success: true, gempa: gempaCache.data, fromCache: true });
  }

  try {
    const response = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      throw new Error('BMKG Earthquake status ' + response.status);
    }
    const data = await response.json();
    const gempa = data.Infogempa ? data.Infogempa.gempa : null;

    if (gempa) {
      // Add full shakemap URL
      if (gempa.Shakemap) {
        gempa.shakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${gempa.Shakemap}`;
      }
      gempaCache = {
        data: gempa,
        timestamp: now
      };
      return res.json({ success: true, gempa });
    } else {
      return res.status(404).json({ success: false, message: 'Data gempa tidak tersedia' });
    }
  } catch (e) {
    console.error('Error fetching BMKG earthquake:', e);
    if (gempaCache.data) {
      return res.json({ success: true, gempa: gempaCache.data, fromCache: true, fallback: true });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil data gempa BMKG' });
  }
});

// 5b. BMKG Recent Earthquakes List Endpoint (gempaterkini)
app.get('/api/gempa/terkini', async (req, res) => {
  const now = Date.now();
  if (gempaTerkiniCache.data && now - gempaTerkiniCache.timestamp < GEMPA_TTL_MS) {
    return res.json({ success: true, list: gempaTerkiniCache.data, gempa: gempaTerkiniCache.data, fromCache: true });
  }

  try {
    const response = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      throw new Error('BMKG Earthquake List status ' + response.status);
    }
    const data = await response.json();
    const gempaList = data.Infogempa && Array.isArray(data.Infogempa.gempa)
      ? data.Infogempa.gempa
      : [];

    gempaTerkiniCache = {
      data: gempaList,
      timestamp: now
    };
    return res.json({ success: true, list: gempaList, gempa: gempaList, total: gempaList.length });
  } catch (e) {
    console.error('Error fetching BMKG earthquake list:', e);
    if (gempaTerkiniCache.data) {
      return res.json({ success: true, list: gempaTerkiniCache.data, gempa: gempaTerkiniCache.data, fromCache: true, fallback: true });
    }
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar gempa BMKG' });
  }
});

// 5. System Health & Stats
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    uptimeSec: Math.floor(process.uptime()),
    cacheSize: weatherCache.size,
    totalWilayah: wilayahList.length,
    timestamp: new Date().toISOString()
  });
});

// 6. Regional Extreme Weather Risk Overview
app.get('/api/cuaca/risiko', (req, res) => {
  const regions = [
    { name: 'Sumatera', risk: 'Sedang', color: 'amber', desc: 'Potensi hujan lokal di pesisir barat & dataran tinggi' },
    { name: 'Jawa', risk: 'Rendah', color: 'emerald', desc: 'Cuaca cerah berawan, kondisi relatif stabil' },
    { name: 'Bali & Nusa Tenggara', risk: 'Rendah', color: 'emerald', desc: 'Kondusif, angin sepoi-sepoi pesisir' },
    { name: 'Kalimantan', risk: 'Sedang', color: 'amber', desc: 'Peluang pembentukan awan konvektif sore hari' },
    { name: 'Sulawesi', risk: 'Sedang', color: 'amber', desc: 'Hujan intensitas ringan di sebagian kawasan tengah' },
    { name: 'Maluku', risk: 'Rendah', color: 'emerald', desc: 'Perairan tenang, cuaca berawan kondusif' },
    { name: 'Papua', risk: 'Tinggi', color: 'rose', desc: 'Waspada potensi hujan lebat di kawasan pegunungan' }
  ];
  return res.json({ success: true, data: regions, attribution: 'BMKG' });
});


// ============================================================
// INDONESIA-WIDE LOCATION RESOLVER & ALIAS DICTIONARY
// ============================================================
const INDONESIA_CITY_ALIASES = {
  'bandar lampung': '18.71.01.1003',
  'lampung': '18.71.01.1003',
  'metro': '18.72.01.1001',
  'jogja': '34.71.01.1001',
  'yogya': '34.71.01.1001',
  'yogyakarta': '34.71.01.1001',
  'sleman': '34.71.01.1001',
  'bantul': '34.71.01.1001',
  'bali': '51.71.01.1001',
  'denpasar': '51.71.01.1001',
  'badung': '51.71.01.1001',
  'kuta': '51.71.01.1001',
  'jakarta': '31.71.01.1001',
  'dki': '31.71.01.1001',
  'gambir': '31.71.01.1001',
  'surabaya': '35.78.01.1001',
  'sidoarjo': '35.78.01.1001',
  'bandung': '32.73.01.1001',
  'cimahi': '32.73.01.1001',
  'medan': '12.71.01.1001',
  'semarang': '33.74.01.1001',
  'makassar': '73.71.01.1001',
  'ujung pandang': '73.71.01.1001',
  'palembang': '16.71.01.1001',
  'padang': '13.71.01.1001',
  'banjarmasin': '63.71.01.1001',
  'samarinda': '64.72.01.1001',
  'balikpapan': '64.71.01.1001',
  'manado': '71.71.01.1001',
  'kupang': '53.71.01.1001',
  'ntt': '53.71.01.1001',
  'jayapura': '91.71.01.1001',
  'papua': '91.71.01.1001',
  'bengkulu': '17.71.01.1001',
  'jambi': '15.71.01.1001',
  'serang': '36.73.01.1001',
  'banten': '36.73.01.1001',
  'tangerang': '36.71.01.1001',
  'bekasi': '32.75.01.1001',
  'bogor': '32.71.01.1001',
  'aceh': '11.71.01.2001',
  'banda aceh': '11.71.01.2001',
  'gorontalo': '75.71.01.1001',
  'ternate': '82.71.01.1001',
  'malut': '82.71.01.1001',
  'manokwari': '92.02.12.1001',
  'tarakan': '65.71.01.1001',
  'kaltara': '65.71.01.1001',
  'tanjung selor': '65.01.01.1001',
  'palangka raya': '62.71.01.1001',
  'kalteng': '62.71.01.1001',
  'kalsel': '63.71.01.1001',
  'kaltim': '64.72.01.1001'
};

function resolveLocationsInQuery(query) {
  if (!query) return [];
  const q = String(query).toLowerCase();
  const matched = [];
  const matchedAdm4s = new Set();
  const matchedKeys = new Set();

  // 1. Longest phrases first from aliases dictionary
  const sortedKeys = Object.keys(INDONESIA_CITY_ALIASES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(q)) {
      let isSub = false;
      for (const m of matchedKeys) {
        if (m.includes(key)) { isSub = true; break; }
      }
      if (!isSub) {
        const adm4 = INDONESIA_CITY_ALIASES[key];
        if (!matchedAdm4s.has(adm4)) {
          const w = wilayahList.find(x => x.adm4 === adm4) ||
                    PROVINCIAL_CAPITALS.find(x => x.adm4 === adm4) ||
                    { name: key.toUpperCase(), kotkab: key.toUpperCase(), adm4 };
          matched.push({ matchedText: key, ...w });
          matchedAdm4s.add(adm4);
          matchedKeys.add(key);
        }
      }
    }
  }

  // 2. Also search all entries in wilayahList
  for (const w of wilayahList) {
    if (matchedAdm4s.has(w.adm4)) continue;
    const cleanKotkab = (w.kotkab || '').toLowerCase().replace(/^(kota|kab\.|kabupaten|kota adm\.)\s*/, '');
    const candidateNames = [cleanKotkab, (w.provinsi || '').toLowerCase()].filter(n => n && n.length >= 4);
    for (const name of candidateNames) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(q)) {
        let isSub = false;
        for (const m of matchedKeys) {
          if (m.includes(name) || name.includes(m)) { isSub = true; break; }
        }
        if (!isSub) {
          matched.push({ matchedText: name, ...w });
          matchedAdm4s.add(w.adm4);
          matchedKeys.add(name);
          break;
        }
      }
    }
  }

  return matched;
}

// ============================================================
// AEROAI INTENT, CONTEXT, GROQ & BILINGUAL ENGINE
// ============================================================
const AI_EN_CITY_ALIASES = {
  'central jakarta': '31.71.01.1001',
  'north jakarta': '31.72.01.1001',
  'west jakarta': '31.73.01.1001',
  'south jakarta': '31.74.01.1001',
  'east jakarta': '31.75.01.1001',
  'west java': '32.73.01.1001',
  'central java': '33.74.01.1001',
  'east java': '35.78.01.1001',
  'north sumatra': '12.71.01.1001',
  'west sumatra': '13.71.01.1001',
  'south sumatra': '16.71.01.1001',
  'south sulawesi': '73.71.01.1001',
  'north sulawesi': '71.71.01.1001',
  'east kalimantan': '64.72.01.1001',
  'west kalimantan': '61.71.01.1002',
  'south kalimantan': '63.71.01.1001',
  'central kalimantan': '62.71.01.1001',
  'north kalimantan': '65.01.01.1001',
  'jakarta pusat': '31.71.01.1001',
  'jakarta selatan': '31.74.01.1001',
  'jakarta barat': '31.73.01.1001',
  'jakarta timur': '31.75.01.1001',
  'jakarta utara': '31.72.01.1001',
  'malang': '35.73.01.1001',
  'solo': '33.72.01.1001',
  'surakarta': '33.72.01.1001',
  'batam': '21.71.01.1001',
  'depok': '32.76.01.1001',
  'cirebon': '32.74.01.1001',
  'pontianak': '61.71.01.1002',
  'pekanbaru': '14.71.01.1002',
  'ambon': '81.71.01.2001',
  'mataram': '52.71.02.1001',
  'kendari': '74.71.03.1001',
  'palu': '72.71.02.1002',
  'mamuju': '76.02.01.1002',
  'sofifi': '82.72.01.1001',
  'sorong': '96.71.01.1001',
  'nabire': '94.01.01.1001',
  'wamena': '95.01.01.1001',
  'merauke': '93.01.01.2001',
  'pangkal pinang': '19.71.02.1001',
  'tanjung pinang': '21.72.01.1001'
};

const AI_WEATHER_DESC_EN = {
  'cerah': 'Clear',
  'cerah berawan': 'Partly Cloudy',
  'berawan': 'Cloudy',
  'berawan tebal': 'Overcast',
  'udara kabur': 'Haze',
  'kabut': 'Fog',
  'asap': 'Smoke',
  'hujan ringan': 'Light Rain',
  'hujan sedang': 'Moderate Rain',
  'hujan lebat': 'Heavy Rain',
  'hujan petir': 'Thunderstorm',
  'hujan disertai petir': 'Thunderstorm',
  'petir': 'Thunderstorm'
};

function translateWeatherDescAI(desc, lang) {
  if (!desc) return lang === 'en' ? 'N/A' : 'Tidak tersedia';
  if (lang !== 'en') return desc;
  const key = String(desc).trim().toLowerCase();
  return AI_WEATHER_DESC_EN[key] || desc;
}

function classifyAIIntent(question, history = []) {
  const q = String(question || '').trim().toLowerCase();

  let timeScope = 'today';
  if (/\b(kemarin|yesterday)\b/i.test(q)) {
    timeScope = 'past';
  } else if (/\b([4-9]|1[0-9])\s*(hari|days?)\b|minggu\s*depan|bulan\s*depan|pekan\s*depan|next\s*(week|month)/i.test(q)) {
    timeScope = 'beyond_limit';
  } else if (/\b(3|tiga|three)[-\s]*(hari|days?)\b|72[-\s]*(jam|hours?)|beberapa\s*hari\s*(ke\s*depan|mendatang|berikutnya)?|next\s*3\s*days|multi[- ]day/i.test(q)) {
    timeScope = '72h';
  } else if (/\blusa\b|day\s*after\s*tomorrow|hari\s*ke[- ]*2/i.test(q)) {
    timeScope = 'day_after';
  } else if (/\b(besok|esok|tomorrow)\b/i.test(q)) {
    timeScope = 'tomorrow';
  } else if (/24\s*(jam|hours?)|next\s*24|sehari\s*ke\s*depan|malam\s*ini|later\s*today|tonight|this\s*evening/i.test(q)) {
    timeScope = '24h';
  } else if (/\b(sekarang|saat\s*ini|right\s*now|currently|current)\b/i.test(q)) {
    timeScope = 'now';
  }

  const hasClothing = /\b(pakaian|baju|jaket|outfit|pakai\s*apa|kenakan|payung|jas\s*hujan|clothing|clothes|wear|dress|umbrella|raincoat)\b/i.test(q);
  const hasActivity = /\b(aktivitas|kegiatan|olahraga|lari|jogging|jemur|berkendara|wisata|jalan[- ]jalan|outdoor|activities|activity|exercise|jog|laundry|driving|safe\s*for)\b/i.test(q);
  const isNationalScope = /(indonesia|nasional|\b38\b|seluruh|ibukota|across\s*indonesia|available\s*bmkg|kota\s*mana|which\s*city)/i.test(q);
  const isHottestQuery = /(suhu\s*tertinggi|paling\s*panas|terpanas|kota\s*terpanas|hottest|highest\s*temp(?:erature)?|warmest\s*city|peak\s*temp)/i.test(q);
  const isExplicitOutOfDomain = /\b(presiden|merdeka|kemerdekaan|menteri|pemilu|partai|resep|nasi\s*goreng|masak|memasak|bumbu|dikali|ditambah|dikurangi|dibagi|akar\s*kuadrat|integral|aljabar|matematika|python|javascript|linked\s*list|merge\s*sort|algoritma|coding|source\s*code|recipe|cooking|multiply|square\s*root|president)\b/i.test(q);
  const hasWeatherDomainKeyword = /\b(cuaca|weather|prakiraan|ramalan|forecast|outlook|suhu|temperatur|temperature|temp|feels\s*like|panas|dingin|sejuk|derajat|warm|hot|cold|cool|hujan|rain|rainy|raining|rainfall|precipitation|presipitasi|gerimis|badai|petir|thunderstorm|angin|wind|windy|gust|kelembapan|kelembaban|lembap|humidity|humid|dew\s*point|titik\s*embun|awan|berawan|cerah|mendung|kabut|udara|langit|cloud|cloudy|clear|overcast|fog|haze|uv|gempa|tsunami|inatews|magnitudo|episentrum|shakemap|guncangan|mmi|earthquake|quake|seismic|tremor|bmkg|iklim|climate|pakaian|baju|jaket|outfit|payung|jas\s*hujan|clothing|clothes|wear|umbrella|raincoat|aktivitas|kegiatan|olahraga|lari|jogging|jemur|berkendara|outdoor|activities|activity|exercise|laundry|driving|banding|kompara|compare|comparison)\b/i.test(q);

  let intent = 'general_weather';
  if (isExplicitOutOfDomain && !hasWeatherDomainKeyword) {
    intent = 'out_of_domain';
  } else if (/(gempa|tsunami|inatews|magnitudo|episentrum|shakemap|guncangan|\bmmi\b|earthquake|quake|seismic|tremor)/i.test(q)) {
    intent = 'earthquake';
  } else if (isHottestQuery && isNationalScope) {
    intent = 'highest_temp';
  } else if (/(banding|kompara|dibanding|\bvs\.?\b|\bversus\b|compare|comparison|mana\s*yang\s*lebih|which\s*is\s*(warmer|hotter|cooler|rainier|better))/i.test(q)) {
    intent = 'comparison';
  } else if (hasClothing) {
    intent = 'clothing';
  } else if (hasActivity) {
    intent = 'activity';
  } else if (/(curah\s*hujan|intensitas\s*hujan|volume\s*hujan|presipitasi|milimeter|\bmm\b|rainfall|precipitation|how\s*much\s*rain)/i.test(q)) {
    intent = 'rainfall';
  } else if (/(potensi\s*hujan|peluang\s*hujan|berpotensi\s*hujan|bakal\s*hujan|akan\s*hujan|kemungkinan\s*hujan|\bhujan\b|rain\s*potential|rain\s*probability|chance\s*of\s*rain|will\s*it\s*rain|going\s*to\s*rain|rain\s*outlook|\brainy?\b|\braining\b)/i.test(q)) {
    intent = 'rain_probability';
    if (timeScope === 'today' && /24/i.test(q)) timeScope = '24h';
  } else if (/(angin|kecepatan\s*angin|arah\s*angin|hembusan|embusan|\bwind\b|wind\s*speed|windy|gust)/i.test(q)) {
    intent = 'wind';
  } else if (/(kelembapan|kelembaban|lembap|titik\s*embun|humidity|humid|dew\s*point|moisture)/i.test(q)) {
    intent = 'humidity';
  } else if (/(suhu|temperatur|feels\s*like|suhu\s*terasa|panas|dingin|sejuk|derajat|temperature|\btemp\b|warm|hot|cold|cool|max\s*temp)/i.test(q)) {
    intent = 'temperature';
  } else if (timeScope === '72h' || timeScope === 'tomorrow' || timeScope === 'day_after' || /(prakiraan|ramalan|forecast|outlook)/i.test(q)) {
    intent = 'daily_forecast';
  } else if (/(cuaca|kondisi\s*cuaca|weather|weather\s*condition)/i.test(q) || (hasWeatherDomainKeyword && /(bagaimana|gimana|today|right\s*now|hari\s*ini|sekarang)/i.test(q))) {
    intent = 'current_weather';
  }

  let isFollowUp = false;
  if (intent !== 'out_of_domain' && Array.isArray(history) && history.length > 0) {
    const lastEntry = [...history].reverse().find(h => h && (h.intent || h.contextLocation));
    const isShortFollowUp = q.split(/\s+/).length <= 7 && /\b(kalau|bagaimana|gimana|dan|di|what\s+about|how\s+about|and|in)\b/i.test(q);
    if (isShortFollowUp && (intent === 'general_weather' || intent === 'current_weather' || intent === 'daily_forecast') && lastEntry?.intent && lastEntry.intent !== 'general_weather' && lastEntry.intent !== 'out_of_domain') {
      if (lastEntry.intent !== 'earthquake' && lastEntry.intent !== 'highest_temp') {
        intent = lastEntry.intent;
      }
      isFollowUp = true;
    } else if (isShortFollowUp) {
      isFollowUp = true;
    }
  }

  // Standalone multi-day / tomorrow question without follow-up inheritance routes to daily_forecast
  if (intent === 'general_weather' && (timeScope === 'tomorrow' || timeScope === 'day_after' || timeScope === '72h')) {
    intent = 'daily_forecast';
  }

  return {
    intent,
    timeScope,
    wantsBothClothingAndActivity: hasClothing && hasActivity,
    isFollowUp,
    hasWeatherDomainKeyword
  };
}

function makeLocationTargetFromEntry(entry, labelOverride = null) {
  if (!entry || !entry.adm4) return null;
  const cleanName = labelOverride || entry.name || entry.kotkab || entry.capital || entry.adm4;
  return {
    adm4: String(entry.adm4).trim(),
    name: String(cleanName).replace(/^Kota Adm\.\s*/i, '').trim(),
    kotkab: entry.kotkab || entry.capital || cleanName,
    provinsi: entry.provinsi || entry.prov || ''
  };
}

function findEntryByAdm4(adm4) {
  if (!adm4) return null;
  const code = String(adm4).trim();
  const fromLocations = LOCATIONS_DATA.find(l => l.adm4 === code);
  if (fromLocations) return makeLocationTargetFromEntry(fromLocations);
  const fromCapitals = CAPITALS_FROM_LOCATIONS.find(c => c.adm4 === code);
  if (fromCapitals) return makeLocationTargetFromEntry(fromCapitals, fromCapitals.capital);
  const fromWilayah = wilayahList.find(w => w.adm4 === code);
  if (fromWilayah) return makeLocationTargetFromEntry(fromWilayah);
  const fromFull = fullWilayahIndex.find(w => w.adm4 === code);
  if (fromFull) return makeLocationTargetFromEntry({ adm4: fromFull.adm4, name: fromFull.kabupaten || fromFull.kelurahan, kotkab: fromFull.kabupaten, provinsi: fromFull.provinsi });
  return { adm4: code, name: code, kotkab: code, provinsi: '' };
}

function resolveSingleLocationText(rawName) {
  if (!rawName) return null;
  const q = String(rawName).trim().toLowerCase();
  if (!q) return null;

  const mergedAliases = { ...INDONESIA_CITY_ALIASES, ...AI_EN_CITY_ALIASES };
  for (const [alias, adm4] of Object.entries(mergedAliases).sort((a, b) => b[0].length - a[0].length)) {
    if (q === alias || new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(q)) {
      return findEntryByAdm4(adm4);
    }
  }

  for (const cap of CAPITALS_FROM_LOCATIONS) {
    const cName = cap.capital.toLowerCase();
    const lName = cap.name.toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
    if (q === cName || q === lName || q.includes(cName) || cName.includes(q)) {
      return makeLocationTargetFromEntry(cap, cap.capital);
    }
  }

  for (const loc of LOCATIONS_DATA) {
    const lName = (loc.name || '').toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
    const lKot = (loc.kotkab || '').toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
    if (q === lName || q === lKot || (q.length >= 4 && (lName.includes(q) || lKot.includes(q)))) {
      return makeLocationTargetFromEntry(loc);
    }
  }

  return null;
}

function detectIslandOnlyQuery(question, explicitTargets) {
  if (explicitTargets && explicitTargets.length > 0) return null;
  const qLower = String(question || '').toLowerCase();
  const compoundProvinceKeys = [
    'kalimantan timur', 'kalimantan barat', 'kalimantan selatan', 'kalimantan tengah', 'kalimantan utara',
    'sumatera utara', 'sumatera barat', 'sumatera selatan',
    'jawa barat', 'jawa tengah', 'jawa timur',
    'sulawesi utara', 'sulawesi tengah', 'sulawesi selatan', 'sulawesi tenggara', 'sulawesi barat',
    'maluku utara', 'west java', 'central java', 'east java', 'north sumatra', 'west sumatra',
    'south sumatra', 'south sulawesi', 'north sulawesi', 'east kalimantan',
    'papua barat', 'papua barat daya', 'papua tengah', 'papua pegunungan', 'papua selatan',
    'nusa tenggara barat', 'nusa tenggara timur'
  ];
  if (compoundProvinceKeys.some(cp => qLower.includes(cp))) return null;

  const islandAliases = {
    'Sumatera': ['sumatera', 'sumatra'],
    'Jawa': ['jawa', 'java'],
    'Kalimantan': ['kalimantan', 'borneo'],
    'Sulawesi': ['sulawesi', 'celebes'],
    'Maluku': ['maluku'],
    'Papua': ['papua', 'irian'],
    'Bali & Nusa Tenggara': ['bali & nusa tenggara', 'bali dan nusa tenggara', 'nusa tenggara']
  };
  for (const [islandName, aliases] of Object.entries(islandAliases)) {
    if (aliases.some(a => new RegExp(`\\b${a}\\b`, 'i').test(qLower))) {
      return islandName;
    }
  }
  return null;
}

function resolveAITargetLocations({ question, intent, contextLocation, location, weatherContext, history }) {
  const qLower = String(question || '').toLowerCase();
  const hits = [];
  const mergedAliases = { ...INDONESIA_CITY_ALIASES, ...AI_EN_CITY_ALIASES };

  const recordHit = (idx, adm4, matchedLen, customLabel = null) => {
    if (!adm4) return;
    hits.push({ idx, adm4, matchedLen, customLabel });
  };

  // 1. Scan aliases (ordered longest first to avoid substring overlaps)
  const sortedAliases = Object.keys(mergedAliases).sort((a, b) => b.length - a.length);
  const occupiedRanges = [];
  const overlaps = (start, end) => occupiedRanges.some(([s, e]) => !(end <= s || start >= e));

  for (const key of sortedAliases) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`\\b${escaped}\\b`, 'ig');
    let m;
    while ((m = reg.exec(qLower)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!overlaps(start, end)) {
        occupiedRanges.push([start, end]);
        recordHit(start, mergedAliases[key], key.length);
      }
    }
  }

  // 2. Scan LOCATIONS_DATA & CAPITALS_FROM_LOCATIONS
  for (const entry of [...CAPITALS_FROM_LOCATIONS, ...LOCATIONS_DATA]) {
    const candidates = [
      entry.capital,
      (entry.name || '').replace(/^Kota Adm\.\s*|^Kota\s+|^Kab\.\s+/i, '').replace(/\s*\([^)]*\)/, ''),
      (entry.kotkab || '').replace(/^Kota Adm\.\s*|^Kota\s+|^Kab\.\s+/i, ''),
      entry.provinsi
    ].filter(c => c && c.length >= 4);

    for (const c of candidates) {
      const cLow = c.toLowerCase();
      const reg = new RegExp(`\\b${cLow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig');
      let m;
      while ((m = reg.exec(qLower)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (!overlaps(start, end)) {
          occupiedRanges.push([start, end]);
          recordHit(start, entry.adm4, cLow.length);
        }
      }
    }
  }

  // 3. Scan fullWilayahIndex only when query has weather/location context and nothing matched yet
  const canScanFullWilayah = intent !== 'out_of_domain' && /\b(cuaca|suhu|hujan|angin|kelembapan|kelembaban|prakiraan|ramalan|awan|mendung|cerah|pakaian|aktivitas|bandingkan|komparasi|weather|forecast|rain|temp|temperature|wind|humidity|clothing|activity|compare|kecamatan|kelurahan|desa|kabupaten|kota)\b/i.test(qLower);
  if (canScanFullWilayah && hits.length === 0 && Array.isArray(fullWilayahIndex) && fullWilayahIndex.length > 0) {
    const stopSet = new Set([
      'cuaca', 'prakiraan', 'kondisi', 'suhu', 'hujan', 'potensi', 'peluang', 'curah', 'angin',
      'kelembapan', 'kelembaban', 'pakaian', 'aktivitas', 'rekomendasi', 'bandingkan', 'komparasi',
      'hari', 'ini', 'besok', 'lusa', 'sekarang', 'saat', 'nanti', 'malam', 'pagi', 'siang', 'sore',
      'dalam', 'jam', 'depan', 'kota', 'wilayah', 'daerah', 'lain', 'lainnya', 'indonesia', 'bmkg',
      'weather', 'forecast', 'rain', 'potential', 'probability', 'next', 'hours', 'today', 'tomorrow',
      'clothing', 'activity', 'activities', 'safe', 'outdoor', 'compare', 'regions', 'other', 'with',
      'between', 'hottest', 'highest', 'temperature', 'wind', 'humidity', 'current', 'what', 'how',
      'which', 'city', 'yang', 'cocok', 'untuk', 'dengan', 'dan', 'atau', 'apa', 'mana', 'berikan', 'saran',
      'aman', 'selama', 'mendatang', 'berikutnya', 'terbaru', 'terkini', 'tiga', 'three', 'sekitar', 'days',
      'siapa', 'presiden', 'pertama', 'republik', 'tahun', 'berapa', 'merdeka', 'tolong', 'buatkan',
      'resep', 'nasi', 'goreng', 'spesial', 'enak', 'hasil', 'dari', 'dikali', 'ditambah', 'akar', 'kuadrat'
    ]);
    const cleanTokens = qLower
      .replace(/[?.,!/:;()]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopSet.has(w) && !/^\d+$/.test(w));

    for (const token of cleanTokens) {
      const exactMatches = fullWilayahIndex.filter(w => {
        const kel = (w.kelurahan || '').toLowerCase();
        const kec = (w.kecamatan || '').toLowerCase();
        const kab = (w.kabupaten || '').toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
        return kel === token || kec === token || kab === token;
      });
      if (exactMatches.length > 0) {
        const best = exactMatches.find(m => (m.kabupaten || '').toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '') === token)
          || exactMatches.find(m => (m.kecamatan || '').toLowerCase() === token)
          || exactMatches[0];
        recordHit(qLower.indexOf(token), best.adm4, token.length, best.kabupaten || best.kelurahan);
        break;
      }
    }
  }

  hits.sort((a, b) => a.idx - b.idx);
  const explicitTargets = [];
  const seenAdm4 = new Set();
  for (const h of hits) {
    if (!seenAdm4.has(h.adm4)) {
      seenAdm4.add(h.adm4);
      const target = findEntryByAdm4(h.adm4);
      if (target) explicitTargets.push(target);
    }
  }

  // Check generic island query only when no city/province matched and intent is general/current
  const islandName = (intent === 'general_weather' || intent === 'current_weather' || intent === 'daily_forecast')
    ? detectIslandOnlyQuery(question, explicitTargets)
    : null;
  if (islandName) {
    return { targets: [], explicitCount: 0, islandName, usedActiveFallback: false };
  }

  // If explicit targets found, handle comparison with "other regions" if only 1 target specified
  if (explicitTargets.length > 0) {
    if (intent === 'comparison' && explicitTargets.length === 1) {
      const otherAdm4 = explicitTargets[0].adm4 === '35.78.01.1001' ? '31.71.01.1001' : '35.78.01.1001';
      const fallbackSecond = findEntryByAdm4(otherAdm4);
      if (fallbackSecond && !seenAdm4.has(fallbackSecond.adm4)) {
        explicitTargets.push(fallbackSecond);
      }
    }
    return { targets: explicitTargets.slice(0, 3), explicitCount: explicitTargets.length, islandName: null, usedActiveFallback: false };
  }

  // Fallback to active frontend location -> contextLocation -> history
  const activeCandidates = [];
  if (location && location.adm4) {
    activeCandidates.push(makeLocationTargetFromEntry(location, location.name || location.kotkab));
  } else if (weatherContext?.lokasi?.adm4) {
    const wl = weatherContext.lokasi;
    activeCandidates.push(makeLocationTargetFromEntry(wl, wl.kotkab || wl.desa));
  }
  if (activeCandidates.length === 0 && contextLocation) {
    const resolvedCtx = resolveSingleLocationText(contextLocation);
    if (resolvedCtx) activeCandidates.push(resolvedCtx);
  }
  if (activeCandidates.length === 0 && Array.isArray(history)) {
    const prevWithLoc = [...history].reverse().find(h => h && h.contextLocation);
    if (prevWithLoc) {
      const resolvedHist = resolveSingleLocationText(prevWithLoc.contextLocation);
      if (resolvedHist) activeCandidates.push(resolvedHist);
    }
  }

  if (intent === 'comparison' && activeCandidates.length === 1) {
    const base = activeCandidates[0];
    const altAdm4 = base.adm4 === '35.78.01.1001' ? '31.71.01.1001' : '35.78.01.1001';
    const alt = findEntryByAdm4(altAdm4);
    if (alt) activeCandidates.push(alt);
  }

  return {
    targets: activeCandidates.slice(0, 2),
    explicitCount: 0,
    islandName: null,
    usedActiveFallback: activeCandidates.length > 0
  };
}

function summarizeSlotGroupAI(slots, lang) {
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const temps = slots.map(s => Number(s.t)).filter(Number.isFinite);
  const humidities = slots.map(s => Number(s.hu)).filter(Number.isFinite);
  const winds = slots.map(s => Number(s.ws)).filter(Number.isFinite);
  const tps = slots.map(s => (s.tp !== undefined && s.tp !== null && Number.isFinite(Number(s.tp)) ? Number(s.tp) : null));
  const validTps = tps.filter(v => v !== null);
  const rainySlots = slots
    .filter(s => (Number(s.tp) > 0) || /hujan|petir/i.test(s.weather_desc || ''))
    .map(s => ({
      time: String(s.local_datetime || s.datetime || '').slice(11, 16) || '-',
      desc: translateWeatherDescAI(s.weather_desc, lang),
      tp: s.tp !== undefined && s.tp !== null ? Number(s.tp) : null,
      hu: s.hu !== undefined ? Number(s.hu) : null
    }));

  const descCounts = {};
  slots.forEach(s => {
    const d = s.weather_desc || '';
    if (d) descCounts[d] = (descCounts[d] || 0) + 1;
  });
  const dominantRaw = Object.keys(descCounts).sort((a, b) => descCounts[b] - descCounts[a])[0] || slots[0].weather_desc || '';

  return {
    slotCount: slots.length,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxTemp: temps.length ? Math.max(...temps) : null,
    avgTemp: temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
    minHu: humidities.length ? Math.min(...humidities) : null,
    maxHu: humidities.length ? Math.max(...humidities) : null,
    avgHu: humidities.length ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null,
    maxWind: winds.length ? Math.max(...winds) : null,
    minWind: winds.length ? Math.min(...winds) : null,
    totalRainMm: validTps.length ? Math.round(validTps.reduce((a, b) => a + b, 0) * 10) / 10 : null,
    maxRainMm: validTps.length ? Math.max(...validTps) : null,
    hasRainfallData: validTps.length > 0,
    rainySlots,
    dominantDesc: translateWeatherDescAI(dominantRaw, lang),
    firstDate: String(slots[0].local_datetime || slots[0].datetime || '').slice(0, 10) || null
  };
}

async function fetchNormalizedWeatherForAI(target, frontendWeatherContext, lang) {
  if (!target || !target.adm4) return null;

  let rawData = null;
  const fcAdm4 = frontendWeatherContext?.lokasi?.adm4;
  if (
    fcAdm4 &&
    fcAdm4 === target.adm4 &&
    frontendWeatherContext.current &&
    Array.isArray(frontendWeatherContext.days) &&
    frontendWeatherContext.days.length > 0
  ) {
    rawData = frontendWeatherContext;
  } else {
    const fetched = await getWeatherDataForAdm4(target.adm4, false);
    if (fetched && fetched.status === 'ok' && fetched.current) {
      rawData = fetched;
    }
  }

  if (!rawData || !rawData.current) {
    return {
      target,
      available: false
    };
  }

  const cur = rawData.current || {};
  const days = Array.isArray(rawData.days) ? rawData.days : [];
  const allForecast = Array.isArray(rawData.forecast) && rawData.forecast.length > 0
    ? rawData.forecast
    : days.flat();

  const nowMs = Date.now();
  let startIdx = 0;
  if (allForecast.length > 0) {
    const futureIdx = allForecast.findIndex(s => {
      const ms = new Date(s.utc_datetime || s.datetime).getTime();
      return Number.isFinite(ms) && ms >= nowMs - (3 * 60 * 60 * 1000);
    });
    startIdx = futureIdx >= 0 ? futureIdx : 0;
  }
  const next24hSlots = allForecast.slice(startIdx, startIdx + 8);

  const curTemp = Number.isFinite(Number(cur.t)) ? Number(cur.t) : null;
  const curHu = Number.isFinite(Number(cur.hu)) ? Number(cur.hu) : null;
  const curWs = Number.isFinite(Number(cur.ws)) ? Number(cur.ws) : null;
  const curTp = cur.tp !== undefined && cur.tp !== null && Number.isFinite(Number(cur.tp)) ? Number(cur.tp) : null;
  const curTcc = cur.tcc !== undefined && cur.tcc !== null && Number.isFinite(Number(cur.tcc)) ? Number(cur.tcc) : null;

  return {
    target: {
      adm4: target.adm4,
      name: target.name || rawData.lokasi?.kotkab || rawData.lokasi?.desa || target.adm4,
      kotkab: rawData.lokasi?.kotkab || target.kotkab || target.name,
      provinsi: rawData.lokasi?.provinsi || target.provinsi || ''
    },
    available: true,
    lastUpdatedFormatted: rawData.lastUpdatedFormatted || null,
    current: {
      temp: curTemp,
      feelsLike: cur.feels_like !== undefined ? Number(cur.feels_like) : (curTemp !== null ? calculateFeelsLike(curTemp, curHu || 70, curWs || 5) : null),
      dewPoint: cur.dew_point !== undefined ? Number(cur.dew_point) : (curTemp !== null && curHu !== null ? calculateDewPoint(curTemp, curHu) : null),
      humidity: curHu,
      windSpeed: curWs,
      windDir: cur.wd || null,
      tp: curTp,
      cloudCover: curTcc,
      weatherDesc: translateWeatherDescAI(cur.weather_desc, lang),
      rawWeatherDesc: cur.weather_desc || '',
      localDatetime: cur.local_datetime || cur.datetime || null
    },
    next24h: summarizeSlotGroupAI(next24hSlots, lang),
    today: summarizeSlotGroupAI(days[0] || next24hSlots, lang),
    tomorrow: summarizeSlotGroupAI(days[1] || [], lang),
    dayAfter: summarizeSlotGroupAI(days[2] || [], lang)
  };
}

function deriveClothingAndActivityHints(locSummary, lang) {
  if (!locSummary || !locSummary.available) return { clothing: [], activities: [] };
  const c = locSummary.current;
  const n24 = locSummary.next24h || locSummary.today || {};
  const hasRain = (c.tp && c.tp > 0) || (n24.rainySlots && n24.rainySlots.length > 0) || /hujan|rain|thunder/i.test(c.rawWeatherDesc);
  const maxT = n24.maxTemp ?? c.temp ?? 28;
  const minT = n24.minTemp ?? c.temp ?? 24;
  const maxW = n24.maxWind ?? c.windSpeed ?? 5;
  const hu = c.humidity ?? n24.avgHu ?? 75;

  if (lang === 'en') {
    const clothing = [];
    if (maxT >= 32) {
      clothing.push('Light, breathable cotton or linen clothing in light colors to manage peak heat.');
    } else if (minT <= 22) {
      clothing.push('Breathable layers with a light jacket or cardigan for cooler hours.');
    } else {
      clothing.push('Comfortable breathable casual wear suited for warm tropical temperatures.');
    }
    if (hasRain) {
      clothing.push('Carry a compact umbrella or waterproof outer layer and wear slip-resistant footwear.');
    } else if (maxT >= 30) {
      clothing.push('Sunglasses, cap, and UV protection for midday sun exposure.');
    }
    if (hu >= 80) {
      clothing.push('Moisture-wicking fabrics help stay comfortable under high humidity.');
    }

    const activities = [];
    if (hasRain) {
      activities.push('Indoor exercise, museum/mall visits, or flexible café work during expected rain windows.');
      activities.push('Schedule outdoor errands or jogging during dry/cloudy intervals before or after rain slots.');
    } else if (maxT >= 33) {
      activities.push('Early morning or late afternoon outdoor sports/walking (avoid 11:00–15:00 peak heat & UV).');
      activities.push('Hydration breaks every 20–30 minutes if working outdoors.');
    } else {
      activities.push('Outdoor jogging, cycling, sightseeing, and laundry drying are generally favorable today.');
    }
    if (maxW >= 25) {
      activities.push(`Exercise caution on two-wheelers or near coastal/exposed areas as wind gusts reach ${maxW} km/h.`);
    }
    return { clothing, activities };
  }

  const clothing = [];
  if (maxT >= 32) {
    clothing.push('Pakaian berbahan katun atau linen yang ringan, tipis, dan menyerap keringat untuk menghadapi suhu puncak siang.');
  } else if (minT <= 22) {
    clothing.push('Baju berlapis nyaman dengan jaket tipis atau kardigan untuk jam pagi/malam yang lebih sejuk.');
  } else {
    clothing.push('Pakaian kasual yang sejuk dan nyaman (katun/rayon) sesuai karakter tropis hari ini.');
  }
  if (hasRain) {
    clothing.push('Siapkan payung lipat atau jas hujan portabel serta alas kaki antiselip.');
  } else if (maxT >= 30) {
    clothing.push('Tambahkan topi, kacamata hitam, atau tabir surya saat beraktivitas di luar pada siang hari.');
  }
  if (hu >= 80) {
    clothing.push('Pilih kain yang cepat kering (quick-dry/katun ringan) karena kelembapan udara cukup tinggi.');
  }

  const activities = [];
  if (hasRain) {
    activities.push('Prioritaskan aktivitas dalam ruangan atau pilih jendela waktu non-hujan untuk perjalanan dan olahraga.');
    activities.push('Saat berkendara ketika hujan turun, kurangi kecepatan dan jaga jarak aman pengereman.');
  } else if (maxT >= 33) {
    activities.push('Lakukan lari, bersepeda, atau aktivitas luar ruangan pada pagi (< 09.00) atau sore (> 16.00) agar terhindar dari panas terik.');
    activities.push('Cuaca kering mendukung penjemuran pakaian dan perjalanan darat yang lancar.');
  } else {
    activities.push('Jogging ringan, bersepeda, aktivitas keluarga di luar ruang, maupun menjemur pakaian relatif kondusif hari ini.');
  }
  if (maxW >= 25) {
    activities.push(`Waspadai hembusan angin hingga ${maxW} km/jam saat berkendara atau berada dekat pepohonan tinggi.`);
  }
  return { clothing, activities };
}

async function callGroqAssistant({ question, lang, intent, timeScope, structuredContext, history }) {
  if (!LLM_API_KEY) return null;
  const targetLangLabel = lang === 'en' ? 'English' : 'Bahasa Indonesia';
  const systemPrompt = [
    `You are AeroAI, SKYVANTA's Indonesian meteorological & disaster-preparedness assistant powered exclusively by official BMKG data.`,
    `STRICT RULES:`,
    `1. LANGUAGE: Respond ONLY in ${targetLangLabel}. Never mix languages in prose.`,
    `2. ZERO FABRICATION: Cite ONLY verified facts from STRUCTURED_BMKG_CONTEXT below. Never invent numbers, temperatures, cities, rankings, or timestamps. If a field or dataset is unavailable, state it honestly.`,
    `3. RAINFALL VS PROBABILITY: BMKG public forecast data provides rainfall volume in millimeters (tp, mm) and weather conditions (weather_desc), NOT a numeric rain probability percentage (%). NEVER equate mm to % or invent a % rain probability; clearly explain rain outlook using BMKG conditions, rainy 3-hour time windows, and rainfall volume in mm.`,
    `4. INTENT PRECISION: Directly answer the specific user intent ("${intent}", timeScope "${timeScope}") in the first paragraph without dumping unrelated boilerplate. Keep formatting concise and readable with clear units (°C, mm, km/h or km/jam, %) and end with "${lang === 'en' ? 'Source: BMKG' : 'Sumber: BMKG'}".`
  ].join('\n');

  const trimmedHistory = Array.isArray(history)
    ? history.slice(-6).filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content).slice(0, 800)
      }))
    : [];

  const userMessage = `QUESTION (${targetLangLabel}): ${question}\n\nSTRUCTURED_BMKG_CONTEXT:\n${JSON.stringify(structuredContext)}`;

  try {
    const endpoint = `${LLM_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.25,
        max_tokens: 750,
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmedHistory,
          { role: 'user', content: userMessage }
        ]
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      console.warn(`AeroAI Groq HTTP ${response.status}; falling back to deterministic engine.`);
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch (err) {
    console.warn('AeroAI Groq unavailable/timeout; falling back to deterministic engine:', err.message);
    return null;
  }
}

function buildRuleBasedAIReply({ intent, timeScope, wantsBothClothingAndActivity, lang, ctx }) {
  const isEn = lang === 'en';
  const srcLine = isEn ? 'Source: BMKG' : 'Sumber: BMKG';
  const fmtVal = (v, unit) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? `${v}${unit}` : (isEn ? 'Unavailable' : 'Tidak tersedia'));

  if (intent === 'out_of_domain') {
    return isEn
      ? `I am AeroAI, SKYVANTA's meteorological and disaster-preparedness assistant. I can only answer questions related to Indonesian weather, climate forecasts, outdoor activity/clothing recommendations, and BMKG InaTEWS earthquake updates.`
      : `Maaf, saya adalah AeroAI, asisten meteorologi dan kesiapsiagaan bencana SKYVANTA. Saya hanya dapat menjawab pertanyaan seputar cuaca, prakiraan iklim, rekomendasi aktivitas/pakaian, dan informasi gempa bumi BMKG (InaTEWS) di Indonesia.`;
  }

  if (timeScope === 'past') {
    return isEn
      ? `Historical weather archives (yesterday) are not available via the current BMKG public forecast feed. I can analyze live conditions and up to 3-day forecasts instead.\n\n${srcLine}`
      : `Data arsip cuaca kemarin belum tersedia pada umpan prakiraan BMKG saat ini. Saya dapat menganalisis kondisi real-time dan prakiraan hingga 3 hari ke depan.\n\n${srcLine}`;
  }

  if (timeScope === 'beyond_limit') {
    return isEn
      ? `Official BMKG public weather forecasts only cover up to 3 days (72 hours) ahead. Extended multi-week forecasts are not available from this feed.\n\n${srcLine}`
      : `Prakiraan cuaca resmi BMKG hanya tersedia hingga sekitar 3 hari (72 jam) ke depan. Data di luar rentang tersebut belum tersedia.\n\n${srcLine}`;
  }

  if (ctx.islandName) {
    const islandCapitals = CAPITALS_FROM_LOCATIONS.filter(c => c.pulau === ctx.islandName);
    const listStr = islandCapitals.map((c, i) => `${i + 1}. ${c.provinsi}: ${c.capital}`).join('\n');
    return isEn
      ? `There are ${islandCapitals.length} provinces in ${ctx.islandName} with provincial capitals:\n${listStr}\n\nWhich city or province would you like me to check?`
      : `Berikut adalah ${islandCapitals.length} provinsi di pulau ${ctx.islandName} beserta ibu kotanya:\n${listStr}\n\nCuaca di provinsi atau kota mana yang ingin Anda lihat?`;
  }

  if (intent === 'earthquake') {
    const g = ctx.gempa;
    if (!g || !g.Magnitude) {
      return isEn
        ? `Latest BMKG earthquake data is temporarily unavailable. Please try again shortly or inspect the Earthquake & InaTEWS tab.\n\n${srcLine} (InaTEWS)`
        : `Data gempa BMKG terkini sedang belum tersedia. Silakan coba kembali beberapa saat lagi atau buka tab Gempa Bumi.\n\n${srcLine} (InaTEWS)`;
    }
    return isEn
      ? `🚨 **Latest BMKG Earthquake Update (InaTEWS)**\n- **Region:** ${g.Wilayah}\n- **Magnitude:** M ${g.Magnitude}\n- **Depth:** ${g.Kedalaman}\n- **Origin Time:** ${g.Tanggal || ''} ${g.Jam || ''}\n- **Tsunami Potential:** ${g.Potensi || 'No tsunami potential'}\n${g.Dirasakan ? `- **Felt (MMI):** ${g.Dirasakan}\n` : ''}\n${srcLine} (InaTEWS)`
      : `🚨 **Informasi Gempa Bumi Terkini (BMKG InaTEWS)**\n- **Wilayah:** ${g.Wilayah}\n- **Magnitudo:** M ${g.Magnitude}\n- **Kedalaman:** ${g.Kedalaman}\n- **Waktu Kejadian:** ${g.Tanggal || ''} ${g.Jam || ''}\n- **Potensi Tsunami:** ${g.Potensi || 'Tidak berpotensi tsunami'}\n${g.Dirasakan ? `- **Dirasakan (MMI):** ${g.Dirasakan}\n` : ''}\n${srcLine} (InaTEWS)`;
  }

  if (intent === 'highest_temp') {
    const nat = ctx.nationalCapitals;
    if (!nat || !Array.isArray(nat.topHot) || nat.topHot.length === 0) {
      return isEn
        ? `Live temperature readings across Indonesia's 38 provincial capitals are temporarily unavailable from BMKG.\n\n${srcLine}`
        : `Data suhu serentak untuk 38 ibu kota provinsi Indonesia sedang belum dapat dimuat dari BMKG. Silakan coba sesaat lagi.\n\n${srcLine}`;
    }
    const leader = nat.topHot[0];
    const rankingLines = nat.topHot.slice(0, 5).map((c, idx) =>
      `${idx + 1}. **${c.name}** (${c.prov}): **${c.temp}°C** · ${translateWeatherDescAI(c.weatherDesc, lang)} (${isEn ? 'Humidity' : 'Kelembapan'} ${c.humidity ?? '-'}%)`
    ).join('\n');

    return isEn
      ? `🔥 **Highest Observed Temperature Across Indonesia (BMKG 38 Provincial Capitals)**\nBased on **${nat.liveCount} of ${nat.totalCount}** verified provincial stations available right now, the highest temperature is in **${leader.name} (${leader.prov})** at **${leader.temp}°C** (${translateWeatherDescAI(leader.weatherDesc, 'en')}).\n\n**Top 5 Warmest Provincial Capitals:**\n${rankingLines}\n\n${srcLine}`
      : `🔥 **Suhu Tertinggi di Indonesia (Data BMKG Ibukota Provinsi)**\nBerdasarkan **${nat.liveCount} dari ${nat.totalCount}** stasiun ibu kota provinsi dengan data BMKG aktif saat ini, suhu tertinggi tercatat di **${leader.name} (${leader.prov})** sebesar **${leader.temp}°C** (${translateWeatherDescAI(leader.weatherDesc, 'id')}).\n\n**5 Kota Terpanas Saat Ini:**\n${rankingLines}\n\n${srcLine}`;
  }

  if (intent === 'comparison') {
    const locs = (ctx.locations || []).filter(Boolean);
    const valid = locs.filter(l => l.available);
    if (locs.length < 2) {
      return isEn
        ? `Please mention at least two regions you would like me to compare (for example: "Compare Central Jakarta and Surabaya").\n\n${srcLine}`
        : `Silakan sebutkan dua wilayah yang ingin dibandingkan (contoh: "Bandingkan cuaca Jakarta Pusat dan Surabaya").`;
    }
    if (valid.length === 0) {
      return isEn
        ? `BMKG weather data for the requested comparison locations is currently unavailable.\n\n${srcLine}`
        : `Data cuaca BMKG untuk wilayah pembanding tersebut sedang tidak tersedia.\n\n${srcLine}`;
    }
    const lines = locs.map((l) => {
      if (!l.available) {
        return isEn ? `- **${l.target.name}:** BMKG data unavailable` : `- **${l.target.name}:** Data BMKG belum tersedia`;
      }
      const c = l.current;
      const t = l.today || {};
      const rangeStr = t.minTemp !== null && t.maxTemp !== null ? `${t.minTemp}–${t.maxTemp}°C` : fmtVal(c.temp, '°C');
      const rainMm = c.tp !== null ? `${c.tp} mm` : (t.totalRainMm !== null ? `${t.totalRainMm} mm` : '0 mm');
      return isEn
        ? `- **${l.target.name}** (${l.target.provinsi}): **${fmtVal(c.temp, '°C')}** (${c.weatherDesc}), Today's Range ${rangeStr}, Humidity ${fmtVal(c.humidity, '%')}, Wind ${fmtVal(c.windSpeed, ' km/h')}, Rainfall ${rainMm}`
        : `- **${l.target.name}** (${l.target.provinsi}): **${fmtVal(c.temp, '°C')}** (${c.weatherDesc}), Rentang Hari Ini ${rangeStr}, Kelembapan ${fmtVal(c.humidity, '%')}, Angin ${fmtVal(c.windSpeed, ' km/jam')}, Curah Hujan ${rainMm}`;
    }).join('\n');

    let summaryNote = '';
    if (valid.length >= 2 && valid[0].current.temp !== null && valid[1].current.temp !== null) {
      const a = valid[0];
      const b = valid[1];
      const diff = Math.round(Math.abs(a.current.temp - b.current.temp) * 10) / 10;
      if (diff === 0) {
        summaryNote = isEn
          ? `\n\nBoth cities are currently at the same temperature (${a.current.temp}°C).`
          : `\n\nKeduanya saat ini mencatat suhu yang sama (${a.current.temp}°C).`;
      } else {
        const warmer = a.current.temp > b.current.temp ? a.target.name : b.target.name;
        const cooler = a.current.temp > b.current.temp ? b.target.name : a.target.name;
        summaryNote = isEn
          ? `\n\n**Key Contrast:** ${warmer} is warmer than ${cooler} by **${diff}°C** right now.`
          : `\n\n**Ringkasan Perbandingan:** ${warmer} lebih hangat **${diff}°C** dibanding ${cooler} saat ini.`;
      }
    }

    const header = isEn
      ? `⚖️ **BMKG Weather Comparison: ${locs.map(l => l.target.name).join(' vs ')}**`
      : `⚖️ **Perbandingan Cuaca BMKG: ${locs.map(l => l.target.name).join(' vs ')}**`;

    return `${header}\n${lines}${summaryNote}\n\n${srcLine}`;
  }

  const primary = (ctx.locations && ctx.locations[0]) || null;
  if (!primary) {
    return isEn
      ? `Which city or region in Indonesia would you like me to analyze? You can select a city in the dashboard or mention a city name in your question.`
      : `Wilayah atau kota mana di Indonesia yang ingin Anda tanyakan? Silakan pilih lokasi aktif atau sebutkan nama kota pada pertanyaan Anda.`;
  }
  if (!primary.available) {
    return isEn
      ? `BMKG weather data for **${primary.target.name}** (ADM4: ${primary.target.adm4}) is currently unavailable or timed out. Please try refreshing or picking a nearby station.\n\n${srcLine}`
      : `Data cuaca BMKG untuk **${primary.target.name}** (ADM4: ${primary.target.adm4}) sedang tidak tersedia. Silakan coba segarkan data atau pilih stasiun terdekat.\n\n${srcLine}`;
  }

  const locTitle = primary.target.provinsi ? `${primary.target.name}, ${primary.target.provinsi}` : primary.target.name;
  const cur = primary.current;
  const n24 = primary.next24h;
  const today = primary.today;
  const tomorrow = primary.tomorrow;
  const dayAfter = primary.dayAfter;
  const updNote = primary.lastUpdatedFormatted
    ? (isEn ? `Updated: ${primary.lastUpdatedFormatted}` : `Diperbarui: ${primary.lastUpdatedFormatted}`)
    : '';

  if (intent === 'rain_probability') {
    const scopeSummary = timeScope === 'tomorrow' && tomorrow ? tomorrow : (n24 || today);
    if (!scopeSummary) {
      return isEn
        ? `Next 24-hour BMKG forecast slots for **${locTitle}** are currently unavailable.\n\n${srcLine}`
        : `Slot prakiraan BMKG 24 jam ke depan untuk **${locTitle}** sedang belum tersedia.\n\n${srcLine}`;
    }
    const periodLabel = timeScope === 'tomorrow'
      ? (isEn ? 'Tomorrow' : 'Besok')
      : (isEn ? 'Next 24 Hours' : '24 Jam ke Depan');
    const rainy = scopeSummary.rainySlots || [];
    const totalMm = scopeSummary.totalRainMm !== null ? `${scopeSummary.totalRainMm} mm` : (isEn ? 'not reported' : 'tidak dilaporkan');

    if (rainy.length > 0) {
      const slotLines = rainy.slice(0, 5).map(s =>
        `- **${s.time}**: ${s.desc}${s.tp !== null ? ` (${s.tp} mm)` : ''}${s.hu !== null ? ` · ${isEn ? 'Humidity' : 'Kelembapan'} ${s.hu}%` : ''}`
      ).join('\n');
      return isEn
        ? `🌧️ **Rain Outlook (${periodLabel}) — ${locTitle}**\nRain conditions appear in **${rainy.length} of ${scopeSummary.slotCount}** 3-hour BMKG forecast windows (accumulated rainfall volume: **${totalMm}**).\n\n**Windows with Rain Potential:**\n${slotLines}\n\n*Note: BMKG public forecasts report expected conditions and rainfall volume in millimeters (mm) rather than numeric % probabilities.*\n${updNote ? `${updNote} · ` : ''}${srcLine}`
        : `🌧️ **Potensi Hujan (${periodLabel}) — ${locTitle}**\nKondisi hujan terpantau pada **${rainy.length} dari ${scopeSummary.slotCount}** slot prakiraan 3-jam BMKG (total akumulasi curah hujan: **${totalMm}**).\n\n**Jendela Waktu Berpotensi Hujan:**\n${slotLines}\n\n*Catatan: Data publik BMKG menyajikan deskripsi cuaca dan volume curah hujan dalam milimeter (mm), bukan angka persentase peluang (%) hujan.*\n${updNote ? `${updNote} · ` : ''}${srcLine}`;
    }

    return isEn
      ? `🌤️ **Rain Outlook (${periodLabel}) — ${locTitle}**\nNo rain is forecast across the **${scopeSummary.slotCount}** 3-hour BMKG windows reviewed (dominant condition: **${scopeSummary.dominantDesc}**, accumulated rainfall volume: **${totalMm}**).\n\n*Note: BMKG public data reports rainfall volume in mm rather than a % probability.*\n${updNote ? `${updNote} · ` : ''}${srcLine}`
      : `🌤️ **Potensi Hujan (${periodLabel}) — ${locTitle}**\nTidak ada indikasi hujan pada **${scopeSummary.slotCount}** slot prakiraan 3-jam BMKG berikutnya (kondisi dominan: **${scopeSummary.dominantDesc}**, akumulasi curah hujan: **${totalMm}**).\n\n*Catatan: Data publik BMKG menampilkan kondisi cuaca dan volume curah hujan (mm), bukan angka persentase peluang (%) hujan.*\n${updNote ? `${updNote} · ` : ''}${srcLine}`;
  }

  if (intent === 'rainfall') {
    const scope = timeScope === 'tomorrow' && tomorrow ? tomorrow : (n24 || today);
    const totalMm = scope?.totalRainMm !== null ? `${scope.totalRainMm} mm` : (isEn ? 'Unavailable' : 'Tidak tersedia');
    const peakMm = scope?.maxRainMm !== null ? `${scope.maxRainMm} mm / 3h` : '-';
    return isEn
      ? `☔ **Rainfall Profile — ${locTitle}**\n- **Current Rainfall Intensity:** ${cur.tp !== null ? `${cur.tp} mm` : '0 mm'}\n- **24-Hour Total Accumulation:** ${totalMm}\n- **Peak 3-Hour Interval:** ${peakMm}\n- **Current Condition:** ${cur.weatherDesc} (Cloud Cover: ${fmtVal(cur.cloudCover, '%')})\n\n${srcLine}`
      : `☔ **Curah Hujan — ${locTitle}**\n- **Curah Hujan Saat Ini:** ${cur.tp !== null ? `${cur.tp} mm` : '0 mm'}\n- **Akumulasi 24 Jam ke Depan:** ${totalMm}\n- **Puncak Interval 3 Jam:** ${peakMm}\n- **Kondisi Saat Ini:** ${cur.weatherDesc} (Tutupan Awan: ${fmtVal(cur.cloudCover, '%')})\n\n${srcLine}`;
  }

  if (intent === 'clothing' || intent === 'activity') {
    const advice = deriveClothingAndActivityHints(primary, lang);
    const headerStats = isEn
      ? `(${cur.weatherDesc}, ${fmtVal(cur.temp, '°C')}, range ${fmtVal(n24?.minTemp, '°C')}–${fmtVal(n24?.maxTemp, '°C')}, humidity ${fmtVal(cur.humidity, '%')}, max wind ${fmtVal(n24?.maxWind ?? cur.windSpeed, ' km/h')})`
      : `(${cur.weatherDesc}, ${fmtVal(cur.temp, '°C')}, rentang ${fmtVal(n24?.minTemp, '°C')}–${fmtVal(n24?.maxTemp, '°C')}, kelembapan ${fmtVal(cur.humidity, '%')}, angin maks ${fmtVal(n24?.maxWind ?? cur.windSpeed, ' km/jam')})`;

    if (wantsBothClothingAndActivity) {
      const clothList = advice.clothing.map(x => `- ${x}`).join('\n');
      const actList = advice.activities.map(x => `- ${x}`).join('\n');
      return isEn
        ? `👕 **Clothing & Activity Guide — ${locTitle}**\nCurrent profile ${headerStats}:\n\n**Clothing Tips:**\n${clothList}\n\n**Activity Tips:**\n${actList}\n\n${srcLine}`
        : `👕 **Rekomendasi Pakaian & Aktivitas — ${locTitle}**\nMengacu pada profil cuaca ${headerStats}:\n\n**Saran Pakaian:**\n${clothList}\n\n**Saran Aktivitas:**\n${actList}\n\n${srcLine}`;
    }

    if (intent === 'clothing') {
      const list = advice.clothing.map(x => `- ${x}`).join('\n');
      return isEn
        ? `👕 **Clothing Recommendations — ${locTitle}**\nBased on ${headerStats}:\n${list}\n\n${srcLine}`
        : `👕 **Rekomendasi Pakaian — ${locTitle}**\nBerdasarkan kondisi ${headerStats}:\n${list}\n\n${srcLine}`;
    }

    const list = advice.activities.map(x => `- ${x}`).join('\n');
    return isEn
      ? `🏃 **Activity Recommendations — ${locTitle}**\nBased on ${headerStats}:\n${list}\n\n${srcLine}`
      : `🏃 **Rekomendasi Aktivitas — ${locTitle}**\nBerdasarkan kondisi ${headerStats}:\n${list}\n\n${srcLine}`;
  }

  if (intent === 'temperature') {
    const tScope = timeScope === 'tomorrow' && tomorrow ? tomorrow : (today || n24);
    const periodLabel = timeScope === 'tomorrow' ? (isEn ? 'Tomorrow' : 'Besok') : (isEn ? 'Today' : 'Hari Ini');
    return isEn
      ? `🌡️ **Temperature Details (${periodLabel}) — ${locTitle}**\n- **Current Air Temp:** ${fmtVal(cur.temp, '°C')}\n- **Feels Like:** ${fmtVal(cur.feelsLike, '°C')}\n- **${periodLabel} Peak / Low:** ${fmtVal(tScope?.maxTemp, '°C')} / ${fmtVal(tScope?.minTemp, '°C')}\n- **Humidity:** ${fmtVal(cur.humidity, '%')}\n\n${srcLine}`
      : `🌡️ **Rincian Suhu (${periodLabel}) — ${locTitle}**\n- **Suhu Udara Saat Ini:** ${fmtVal(cur.temp, '°C')}\n- **Suhu Terasa (Feels Like):** ${fmtVal(cur.feelsLike, '°C')}\n- **Suhu Tertinggi / Terendah ${periodLabel}:** ${fmtVal(tScope?.maxTemp, '°C')} / ${fmtVal(tScope?.minTemp, '°C')}\n- **Kelembapan Relatif:** ${fmtVal(cur.humidity, '%')}\n\n${srcLine}`;
  }

  if (intent === 'wind') {
    return isEn
      ? `💨 **Wind Conditions — ${locTitle}**\n- **Current Wind Speed:** ${fmtVal(cur.windSpeed, ' km/h')}\n- **Direction:** ${cur.windDir || 'N/A'}\n- **24-Hour Wind Range:** ${fmtVal(n24?.minWind, ' km/h')} – ${fmtVal(n24?.maxWind, ' km/h')}\n- **Condition:** ${cur.weatherDesc}\n\n${srcLine}`
      : `💨 **Kondisi Angin — ${locTitle}**\n- **Kecepatan Angin Saat Ini:** ${fmtVal(cur.windSpeed, ' km/jam')}\n- **Arah Angin:** ${cur.windDir || 'Tidak tersedia'}\n- **Rentang Angin 24 Jam:** ${fmtVal(n24?.minWind, ' km/jam')} – ${fmtVal(n24?.maxWind, ' km/jam')}\n- **Kondisi Langit:** ${cur.weatherDesc}\n\n${srcLine}`;
  }

  if (intent === 'humidity') {
    return isEn
      ? `💧 **Humidity Profile — ${locTitle}**\n- **Current Relative Humidity:** ${fmtVal(cur.humidity, '%')}\n- **Dew Point:** ${fmtVal(cur.dewPoint, '°C')}\n- **24-Hour Humidity Range:** ${fmtVal(n24?.minHu, '%')} – ${fmtVal(n24?.maxHu, '%')}\n\n${srcLine}`
      : `💧 **Profil Kelembapan — ${locTitle}**\n- **Kelembapan Relatif Saat Ini:** ${fmtVal(cur.humidity, '%')}\n- **Titik Embun (Dew Point):** ${fmtVal(cur.dewPoint, '°C')}\n- **Rentang Kelembapan 24 Jam:** ${fmtVal(n24?.minHu, '%')} – ${fmtVal(n24?.maxHu, '%')}\n\n${srcLine}`;
  }

  if (intent === 'daily_forecast') {
    if (timeScope === '72h') {
      const formatDayLine = (label, d) => {
        if (!d) return `- **${label}:** ${isEn ? 'Data unavailable' : 'Data tidak tersedia'}`;
        return isEn
          ? `- **${label}:** ${d.dominantDesc}, Temp ${fmtVal(d.minTemp, '°C')}–${fmtVal(d.maxTemp, '°C')}, Rain ${d.totalRainMm !== null ? `${d.totalRainMm} mm` : '0 mm'}, Avg Humidity ${fmtVal(d.avgHu, '%')}`
          : `- **${label}:** ${d.dominantDesc}, Suhu ${fmtVal(d.minTemp, '°C')}–${fmtVal(d.maxTemp, '°C')}, Hujan ${d.totalRainMm !== null ? `${d.totalRainMm} mm` : '0 mm'}, Kelembapan Rata-rata ${fmtVal(d.avgHu, '%')}`;
      };
      return isEn
        ? `📅 **3-Day Forecast Summary — ${locTitle}**\n${formatDayLine('Today', today)}\n${formatDayLine('Tomorrow', tomorrow)}\n${formatDayLine('Day After', dayAfter)}\n\n${srcLine}`
        : `📅 **Ringkasan Prakiraan 3 Hari — ${locTitle}**\n${formatDayLine('Hari Ini', today)}\n${formatDayLine('Besok', tomorrow)}\n${formatDayLine('Lusa', dayAfter)}\n\n${srcLine}`;
    }

    const targetDay = timeScope === 'day_after' ? dayAfter : (timeScope === 'tomorrow' ? tomorrow : today);
    const dayHeading = timeScope === 'day_after'
      ? (isEn ? 'Day After Tomorrow' : 'Lusa')
      : (timeScope === 'tomorrow' ? (isEn ? 'Tomorrow' : 'Besok') : (isEn ? 'Today' : 'Hari Ini'));
    if (!targetDay) {
      return isEn
        ? `BMKG forecast for **${dayHeading}** in **${locTitle}** is not available right now.\n\n${srcLine}`
        : `Data prakiraan BMKG untuk **${dayHeading}** di **${locTitle}** belum tersedia saat ini.\n\n${srcLine}`;
    }
    return isEn
      ? `📅 **BMKG Forecast (${dayHeading}) — ${locTitle}**\n- **Dominant Condition:** ${targetDay.dominantDesc}\n- **Temperature Range:** ${fmtVal(targetDay.minTemp, '°C')} – ${fmtVal(targetDay.maxTemp, '°C')}\n- **Total Rainfall Volume:** ${targetDay.totalRainMm !== null ? `${targetDay.totalRainMm} mm` : '0 mm'}\n- **Average Humidity / Peak Wind:** ${fmtVal(targetDay.avgHu, '%')} / ${fmtVal(targetDay.maxWind, ' km/h')}\n\n${srcLine}`
      : `📅 **Prakiraan Cuaca BMKG (${dayHeading}) — ${locTitle}**\n- **Kondisi Dominan:** ${targetDay.dominantDesc}\n- **Rentang Suhu:** ${fmtVal(targetDay.minTemp, '°C')} – ${fmtVal(targetDay.maxTemp, '°C')}\n- **Total Curah Hujan:** ${targetDay.totalRainMm !== null ? `${targetDay.totalRainMm} mm` : '0 mm'}\n- **Kelembapan Rata-rata / Angin Maks:** ${fmtVal(targetDay.avgHu, '%')} / ${fmtVal(targetDay.maxWind, ' km/jam')}\n\n${srcLine}`;
  }

  const dayRange = today && today.minTemp !== null && today.maxTemp !== null ? `${today.minTemp}–${today.maxTemp}°C` : '-';
  return isEn
    ? `📍 **Current Weather — ${locTitle}**\n- **Condition:** ${cur.weatherDesc}\n- **Temperature / Feels Like:** ${fmtVal(cur.temp, '°C')} / ${fmtVal(cur.feelsLike, '°C')} (Today: ${dayRange})\n- **Humidity:** ${fmtVal(cur.humidity, '%')}\n- **Wind:** ${fmtVal(cur.windSpeed, ' km/h')} (${cur.windDir || '-'})\n- **Current Rainfall Volume:** ${cur.tp !== null ? `${cur.tp} mm` : '0 mm'}\n${updNote ? `\n${updNote} · ` : '\n'}${srcLine}`
    : `📍 **Kondisi Cuaca Saat Ini — ${locTitle}**\n- **Kondisi:** ${cur.weatherDesc}\n- **Suhu / Terasa Seperti:** ${fmtVal(cur.temp, '°C')} / ${fmtVal(cur.feelsLike, '°C')} (Rentang hari ini: ${dayRange})\n- **Kelembapan:** ${fmtVal(cur.humidity, '%')}\n- **Angin:** ${fmtVal(cur.windSpeed, ' km/jam')} (${cur.windDir || '-'})\n- **Curah Hujan Saat Ini:** ${cur.tp !== null ? `${cur.tp} mm` : '0 mm'}\n${updNote ? `\n${updNote} · ` : '\n'}${srcLine}`;
}

// 7. Intelligent AI Weather Assistant (Multi-Intent BMKG + Groq + Bilingual Engine)
app.post('/api/ai-assistant', async (req, res) => {
  const body = req.body || {};
  const q = String(body.question || '').trim();
  const lang = body.lang === 'en' ? 'en' : 'id';

  if (!q) {
    return res.status(400).json({
      success: false,
      reply: lang === 'en' ? 'Question cannot be empty.' : 'Pertanyaan tidak boleh kosong.',
      lang
    });
  }

  try {
    const history = Array.isArray(body.history) ? body.history : [];
    const classified = classifyAIIntent(q, history);
    let intent = classified.intent;
    const { timeScope, wantsBothClothingAndActivity, isFollowUp, hasWeatherDomainKeyword } = classified;
    const resolved = resolveAITargetLocations({
      question: q,
      intent,
      contextLocation: body.contextLocation,
      location: body.location,
      weatherContext: body.weatherContext,
      history
    });

    if (
      intent === 'general_weather' &&
      !hasWeatherDomainKeyword &&
      !isFollowUp &&
      resolved.explicitCount === 0 &&
      !resolved.islandName
    ) {
      intent = 'out_of_domain';
    }

    const ctx = {
      islandName: resolved.islandName,
      locations: [],
      nationalCapitals: null,
      gempa: null
    };

    if (intent === 'out_of_domain') {
      // Do not load weather or earthquake context for out-of-domain queries
    } else if (intent === 'earthquake') {
      if (gempaCache.data && Date.now() - gempaCache.timestamp < GEMPA_TTL_MS) {
        ctx.gempa = gempaCache.data;
      } else {
        try {
          const response = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', {
            headers: { 'User-Agent': 'BMKG-TEWS-App/1.0' },
            signal: AbortSignal.timeout(4500)
          });
          if (response.ok) {
            const gData = await response.json();
            ctx.gempa = gData?.Infogempa?.gempa || null;
            if (ctx.gempa) {
              gempaCache = { data: ctx.gempa, timestamp: Date.now() };
            }
          }
        } catch (e) {}
      }
      if (!ctx.gempa && body.gempaContext && body.gempaContext.Magnitude) {
        ctx.gempa = body.gempaContext;
      }
    } else if (intent === 'highest_temp') {
      try {
        const snap = await fetchCapitalsSnapshot();
        const verifiedCaps = (snap.data || []).filter(c => !c.isFallback && Number.isFinite(Number(c.temp)));
        verifiedCaps.sort((a, b) => Number(b.temp) - Number(a.temp));
        ctx.nationalCapitals = {
          liveCount: verifiedCaps.length,
          totalCount: snap.totalCount,
          topHot: verifiedCaps.slice(0, 8),
          topCool: [...verifiedCaps].reverse().slice(0, 3)
        };
      } catch (e) {
        console.warn('highest_temp capitals snapshot error:', e.message);
      }
    } else if (resolved.targets.length > 0 && timeScope !== 'past' && timeScope !== 'beyond_limit' && !resolved.islandName) {
      ctx.locations = await Promise.all(
        resolved.targets.map(t => fetchNormalizedWeatherForAI(t, body.weatherContext, lang))
      );
    }

    const activeContextLocation = intent === 'out_of_domain'
      ? (body.contextLocation || null)
      : (resolved.targets[0]?.name || body.contextLocation || null);

    let reply = null;
    let mode = 'fallback';
    if (LLM_API_KEY && intent !== 'out_of_domain' && timeScope !== 'past' && timeScope !== 'beyond_limit' && !resolved.islandName) {
      reply = await callGroqAssistant({
        question: q,
        lang,
        intent,
        timeScope,
        structuredContext: ctx,
        history
      });
      if (reply) mode = 'llm';
    }

    if (!reply) {
      reply = buildRuleBasedAIReply({
        intent,
        timeScope,
        wantsBothClothingAndActivity,
        lang,
        ctx
      });
    }

    return res.json({
      success: true,
      reply,
      intent,
      timeScope,
      lang,
      isFollowUp,
      mode,
      contextLocation: activeContextLocation,
      capital: resolved.targets[0]?.name || null,
      provinsi: resolved.targets[0]?.provinsi || null,
      source: intent === 'earthquake' ? 'BMKG InaTEWS' : 'BMKG'
    });
  } catch (err) {
    console.error('Error in AI Assistant handler:', err);
    return res.json({
      success: false,
      lang,
      reply: lang === 'en'
        ? 'Sorry, an error occurred while retrieving BMKG data.'
        : 'Maaf, terjadi kesalahan saat mengambil data.'
    });
  }
});


// Serve wilayah.json explicitly (referenced in vercel.json)
app.get('/wilayah.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'wilayah.json'));
});

// Fallback to SPA index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🌦️ BMKG Weather Platform running on port ${PORT}`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🇮🇩 Total Wilayah Loaded: ${wilayahList.length}`);
    console.log(`====================================================`);
  });
}

module.exports = app;

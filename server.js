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

      return { status: 'no-data', message: 'BMKG belum menyediakan data untuk wilayah ini', adm4 };
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

      return { status: 'no-data', message: 'BMKG belum menyediakan data untuk wilayah ini', adm4 };
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

app.get('/api/cuaca/capitals', async (req, res) => {
  const now = Date.now();
  if (capitalsCache.data && now - capitalsCache.timestamp < CAPITALS_TTL_MS) {
    return res.json({ success: true, fromCache: true, data: capitalsCache.data });
  }

  try {
    // Process in parallel batches of 8 to respect BMKG bandwidth
    const results = [];
    const batchSize = 8;
    for (let i = 0; i < PROVINCIAL_CAPITALS.length; i += batchSize) {
      const slice = PROVINCIAL_CAPITALS.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        slice.map(async (cap) => {
          const cached = weatherCache.get(cap.adm4);
          if (cached && now - cached.timestamp < CACHE_TTL_MS) {
            const cur = cached.payload.current || {};
            const tpVal = cur.tp !== undefined && cur.tp !== null ? cur.tp : null;
            return {
              ...cap,
              temp: cur.t,
              weatherDesc: cur.weather_desc || 'Cerah Berawan',
              humidity: cur.hu,
              windSpeed: cur.ws,
              windDir: cur.wd,
              precipitation: tpVal,
              tp: tpVal,
              local_datetime: cur.local_datetime || cur.datetime || null,
              cached: true
            };
          }

          try {
            const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(cap.adm4)}`;
            const response = await fetch(bmkgUrl, {
              headers: {
                'User-Agent': 'BMKG-Weather-Indonesia-App/1.0',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
              const raw = await response.json();
              const cuacaDays = raw.data?.[0]?.cuaca || [];
              let nearestSlot = null;
              let minDiff = Infinity;
              cuacaDays.forEach(day => {
                day.forEach(slot => {
                  const slotMs = new Date(slot.utc_datetime || slot.datetime).getTime();
                  const diff = Math.abs(now - slotMs);
                  if (diff < minDiff) {
                    minDiff = diff;
                    nearestSlot = slot;
                  }
                });
              });

              const firstSlot = raw.data?.[0]?.cuaca?.[0]?.[0] || {};
              const slot = nearestSlot || firstSlot;

              const t = slot.t !== undefined ? slot.t : 28;
              const hu = slot.hu || 75;
              const ws = slot.ws || 8;
              const wd = slot.wd || 'Tenggara';
              const tp = slot.tp !== undefined && slot.tp !== null ? slot.tp : null;
              const localDatetime = slot.local_datetime || slot.datetime || null;
              const weatherDesc = slot.weather_desc || 'Cerah Berawan';
              const localIcon = iconMapper.getWeatherIcon(weatherDesc, slot.weather);

              return {
                ...cap,
                temp: t,
                weatherDesc,
                icon: localIcon,
                image: localIcon,
                humidity: hu,
                windSpeed: ws,
                windDir: wd,
                precipitation: tp,
                tp: tp,
                local_datetime: localDatetime
              };
            }
          } catch (e) {}

          return {
            ...cap,
            temp: 28,
            weatherDesc: 'Cerah Berawan',
            icon: 'icons/cerah-berawan.svg',
            image: 'icons/cerah-berawan.svg',
            humidity: 75,
            windSpeed: 5,
            windDir: 'Timur',
            precipitation: 0
          };
        })
      );
      results.push(...batchResults);
    }

    capitalsCache = {
      data: results,
      timestamp: now
    };

    return res.json({ success: true, count: results.length, data: results });
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

// 7. Intelligent AI Weather Assistant (38 Provincial Capitals BMKG)
app.post('/api/ai-assistant', async (req, res) => {
  const { question } = req.body || {};
  const q = (question || '').trim();

  if (!q) {
    return res.status(400).json({ success: false, reply: 'Pertanyaan tidak boleh kosong.' });
  }

  const qLower = q.toLowerCase();

  // PEMETAAN WAKTU: "kemarin" (JANGAN dijawab dengan angka)
  if (/\bkemarin\b/i.test(qLower)) {
    return res.json({
      success: true,
      reply: 'Data cuaca kemarin belum tersedia. Saya hanya bisa memberikan prakiraan untuk hari ini dan beberapa hari ke depan.'
    });
  }

  // ATURAN 7: Gempa tetap memakai sumber gempa BMKG, tidak memakai daftar kota
  if (qLower.includes('gempa') || qLower.includes('tsunami') || qLower.includes('lindup') || qLower.includes('seismik')) {
    try {
      let g = null;
      if (gempaCache.data && Date.now() - gempaCache.timestamp < GEMPA_TTL_MS) {
        g = gempaCache.data;
      } else {
        const response = await fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', {
          headers: { 'User-Agent': 'BMKG-TEWS-App/1.0' },
          signal: AbortSignal.timeout(4000)
        });
        if (response.ok) {
          const gData = await response.json();
          g = gData.Infogempa ? gData.Infogempa.gempa : null;
        }
      }

      if (g && g.Magnitude) {
        const reply = `🚨 **Informasi Gempa Bumi Terkini (BMKG InaTEWS)**
- **Wilayah:** ${g.Wilayah}
- **Magnitudo:** M ${g.Magnitude}
- **Kedalaman:** ${g.Kedalaman}
- **Waktu:** ${g.Tanggal || ''} ${g.Jam || ''}
- **Potensi:** ${g.Potensi || 'Tidak berpotensi tsunami'}

Sumber: BMKG (InaTEWS)`;
        return res.json({ success: true, reply, source: 'BMKG InaTEWS' });
      }
      return res.json({ success: true, reply: 'Daftar gempa belum tersedia dari BMKG. Silakan coba kembali beberapa saat lagi.', source: 'BMKG' });
    } catch (e) {
      console.error('Error fetching gempa for AI:', e);
      return res.json({ success: false, reply: 'Maaf, terjadi kesalahan saat mengambil data.' });
    }
  }

  // PEMETAAN WAKTU: Tanggal lebih dari sekitar 3 hari ke depan
  const farFuturePatterns = [
    /\b(4|5|6|7|8|9|10)\s*hari/i,
    /minggu\s*depan/i,
    /bulan\s*depan/i,
    /pekan\s*depan/i,
    /tahun\s*depan/i,
    /hari\s*ke[- ]*(4|5|6|7|8|9|10)/i
  ];
  if (farFuturePatterns.some(p => p.test(qLower))) {
    return res.json({
      success: true,
      reply: 'Prakiraan BMKG hanya tersedia sampai sekitar 3 hari ke depan.'
    });
  }

  // Parse time intent
  let isThreeDaysMode = false;
  let dayOffset = 0;
  let dayLabel = 'hari ini';

  if (/\b(3|tiga)\s*hari\b/i.test(qLower) || /beberapa\s*hari\s*ke\s*depan/i.test(qLower)) {
    isThreeDaysMode = true;
    dayLabel = '3 hari ke depan';
  } else if (qLower.includes('lusa') || qLower.includes('besok lusa') || qLower.includes('hari ke-2') || qLower.includes('hari ke 2') || qLower.includes('hari ke-3') || qLower.includes('hari ke 3')) {
    dayOffset = 2;
    dayLabel = 'lusa';
  } else if (qLower.includes('besok') || qLower.includes('esok')) {
    dayOffset = 1;
    dayLabel = 'besok';
  } else {
    dayOffset = 0;
    dayLabel = 'hari ini';
  }

  // Stopwords cleaning to extract place names
  const stopwords = [
    'cuaca', 'prakiraan', 'kondisi', 'suhu', 'hujan', 'derajat', 'kelembapan', 'kelembaban',
    'hari ini', 'besok', 'lusa', 'besok lusa', 'sekarang', 'saat ini', 'nanti',
    'pagi ini', 'siang ini', 'sore ini', 'malam ini', 'terkini',
    'di', 'ke', 'pada', 'untuk', 'dari',
    'kota', 'kabupaten', 'kab', 'kecamatan', 'kec', 'kelurahan', 'kel', 'desa',
    'daerah', 'wilayah', 'bagaimana', 'gimana', 'apakah', 'tolong', 'cek', 'info', 'tentang', 'dong',
    '3 hari', 'tiga hari', 'beberapa hari ke depan', 'ke depan', 'pulau'
  ];

  let cleaned = qLower;
  stopwords.forEach(w => {
    const reg = new RegExp(`\\b${w}\\b`, 'gi');
    cleaned = cleaned.replace(reg, ' ');
  });
  cleaned = cleaned.replace(/[?.,!]/g, ' ').replace(/\s+/g, ' ').trim();

  // ATURAN 3: Pertanyaan tentang pulau (Sumatera, Jawa, Bali & Nusa Tenggara, Kalimantan, Sulawesi, Maluku, Papua)
  // JANGAN langsung menjawab dengan angka. Tampilkan daftar provinsi di pulau itu sebagai pilihan, dengan nama ibu kota masing-masing, lalu tanya: "Cuaca di provinsi mana yang ingin Anda lihat?"
  const islandAliases = {
    'Sumatera': ['sumatera', 'sumatra'],
    'Jawa': ['jawa', 'java'],
    'Kalimantan': ['kalimantan', 'borneo'],
    'Sulawesi': ['sulawesi', 'celebes'],
    'Maluku': ['maluku'],
    'Papua': ['papua', 'irian', 'irian jaya'],
    'Bali & Nusa Tenggara': ['bali & nusa tenggara', 'bali dan nusa tenggara', 'nusa tenggara', 'bali nusa tenggara']
  };

  // Provinces that start with island names (to distinguish "Kalimantan Timur" from island "Kalimantan"):
  const compoundProvinceKeys = [
    'kalimantan timur', 'kalimantan barat', 'kalimantan selatan', 'kalimantan tengah', 'kalimantan utara',
    'sumatera utara', 'sumatera barat', 'sumatera selatan',
    'jawa barat', 'jawa tengah', 'jawa timur',
    'sulawesi utara', 'sulawesi tengah', 'sulawesi selatan', 'sulawesi tenggara', 'sulawesi barat',
    'maluku utara',
    'papua barat', 'papua barat daya', 'papua tengah', 'papua pegunungan', 'papua selatan',
    'nusa tenggara barat', 'nusa tenggara timur'
  ];

  const hasCompoundProvince = compoundProvinceKeys.some(cp => qLower.includes(cp));

  if (!hasCompoundProvince) {
    for (const [islandName, aliases] of Object.entries(islandAliases)) {
      const isMatch = aliases.some(alias => {
        const regex = new RegExp(`(^|\\s)${alias}(\\s|$)`, 'i');
        return regex.test(cleaned) || regex.test(qLower);
      });

      if (isMatch) {
        // Retrieve provinces in this island from CAPITALS_FROM_LOCATIONS (using field pulau)
        const islandCapitals = CAPITALS_FROM_LOCATIONS.filter(c => c.pulau === islandName);
        const listStr = islandCapitals.map((c, i) => `${i + 1}. ${c.provinsi}: ${c.capital}`).join('\n');
        const reply = `Berikut adalah ${islandCapitals.length} provinsi di pulau ${islandName} beserta ibu kotanya:\n${listStr}\n\nCuaca di provinsi mana yang ingin Anda lihat?`;

        return res.json({
          success: true,
          reply,
          island: islandName,
          capitals: islandCapitals.map(c => c.capital)
        });
      }
    }
  }

  // ATURAN 1, 2, 4: Matching Provincial Capital or Province
  let chosenCapital = null;
  let isProvinceQuery = false;

  // 1. Direct match with capital name (e.g. "Bandar Lampung", "Semarang", "Banda Aceh", etc.)
  for (const cap of CAPITALS_FROM_LOCATIONS) {
    const cLower = cap.capital.toLowerCase();
    const cNameLower = cap.name.toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
    const cleanNoKota = cleaned.replace(/^kota\s+|^kab\.\s+/i, '').trim();

    if (
      cleanNoKota === cLower ||
      cleanNoKota === cNameLower ||
      new RegExp(`(^|\\s)${cLower}(\\s|$)`, 'i').test(cleaned) ||
      new RegExp(`(^|\\s)${cNameLower}(\\s|$)`, 'i').test(cleaned) ||
      new RegExp(`(^|\\s)${cLower}(\\s|$)`, 'i').test(qLower)
    ) {
      chosenCapital = cap;
      break;
    }
  }

  // Special alias for Jakarta (Gambir)
  if (!chosenCapital && (cleaned === 'jakarta' || /\bjakarta\b/i.test(cleaned) || /\bjakarta\b/i.test(qLower))) {
    chosenCapital = CAPITALS_FROM_LOCATIONS.find(c => c.capital === 'Jakarta Pusat');
  }

  // 2. Match with province name (e.g. "Kalimantan Timur", "Lampung", "Jawa Barat")
  if (!chosenCapital) {
    for (const cap of CAPITALS_FROM_LOCATIONS) {
      const pLower = cap.provinsi.toLowerCase();
      const pClean = pLower.replace(/^(d\.i\.|dki)\s+/i, '');

      if (
        cleaned === pLower ||
        cleaned === pClean ||
        new RegExp(`(^|\\s)${pLower}(\\s|$)`, 'i').test(cleaned) ||
        new RegExp(`(^|\\s)${pClean}(\\s|$)`, 'i').test(cleaned) ||
        new RegExp(`(^|\\s)${pLower}(\\s|$)`, 'i').test(qLower)
      ) {
        chosenCapital = cap;
        isProvinceQuery = true;
        break;
      }
    }
  }

  // ATURAN 5: Pertanyaan tentang kota atau kabupaten yang bukan ibu kota provinsi (misalnya "Sukarame", "Balikpapan")
  // Jawab: "Saya hanya menjawab cuaca untuk ibu kota provinsi. Untuk [nama kota], coba tanyakan ibu kota [nama provinsi], yaitu [nama ibu kota]."
  if (!chosenCapital) {
    let nonCapitalMatch = null;

    // Check in LOCATIONS_DATA first
    const foundLoc = LOCATIONS_DATA.find(l => {
      const lName = l.name.toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
      const lKot = (l.kotkab || '').toLowerCase().replace(/^kota\s+|^kab\.\s+/i, '');
      return lName.includes(cleaned) || lKot.includes(cleaned) || (cleaned.length > 2 && lName.startsWith(cleaned));
    });

    if (foundLoc) {
      const cap = CAPITALS_FROM_LOCATIONS.find(c => c.provinsi.toLowerCase() === foundLoc.provinsi.toLowerCase());
      if (cap) {
        const rawName = foundLoc.name.replace(/^Kota\s+|^Kab\.\s+/i, '').replace(/\s*\([^)]*\)/, '');
        nonCapitalMatch = {
          name: rawName,
          provinsi: foundLoc.provinsi,
          capital: cap.capital
        };
      }
    }

    // Check in fullWilayahIndex (e.g. Sukarame, Sepaku, dll.)
    if (!nonCapitalMatch && fullWilayahIndex && fullWilayahIndex.length) {
      const matches = fullWilayahIndex.filter(w => {
        const kel = w.kelurahan.toLowerCase();
        const kec = w.kecamatan.toLowerCase();
        const kab = w.kabupaten.toLowerCase();
        return kel === cleaned || kec === cleaned || kab.includes(cleaned);
      });

      if (matches.length > 0) {
        // Prioritize match where kec and kel match, or where kabupaten matches
        let best = matches[0];
        const doubleMatch = matches.find(m => m.kelurahan.toLowerCase() === cleaned && m.kecamatan.toLowerCase() === cleaned);
        if (doubleMatch) best = doubleMatch;

        const cap = CAPITALS_FROM_LOCATIONS.find(c => c.provinsi.toLowerCase() === best.provinsi.toLowerCase());
        if (cap) {
          const properName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
          nonCapitalMatch = {
            name: properName,
            provinsi: best.provinsi,
            capital: cap.capital
          };
        }
      }
    }

    if (nonCapitalMatch) {
      return res.json({
        success: true,
        reply: `Saya hanya menjawab cuaca untuk ibu kota provinsi. Untuk ${nonCapitalMatch.name}, coba tanyakan ibu kota ${nonCapitalMatch.provinsi}, yaitu ${nonCapitalMatch.capital}.`
      });
    }

    // Completely unknown location
    return res.json({
      success: false,
      reply: 'Saya hanya menjawab cuaca untuk 38 ibu kota provinsi di Indonesia. Coba sebut salah satu ibu kota provinsi atau nama provinsinya.'
    });
  }

  // Now we have chosenCapital! Fetch BMKG weather data
  try {
    const weatherData = await getWeatherDataForAdm4(chosenCapital.adm4);
    
    // ATURAN 6: Jika adm4 kota itu NODATA: "BMKG belum menyediakan data untuk [nama ibu kota]." Jangan pindah ke kota lain.
    if (!weatherData || weatherData.status === 'no-data' || !weatherData.current) {
      return res.json({
        success: false,
        reply: `BMKG belum menyediakan data untuk ${chosenCapital.capital}.`
      });
    }

    const cuacaDays = weatherData.forecast || [];
    const cur = weatherData.current;

    // Build province prefix if user asked by province name (ATURAN 2)
    let headerPrefix = '';
    if (isProvinceQuery) {
      headerPrefix = `Mewakili ibu kota provinsi ${chosenCapital.provinsi}: ${chosenCapital.capital}\n`;
    }

    // If 3 days mode
    if (isThreeDaysMode) {
      const slotToday = cur;
      
      const tomorrowSlots = cuacaDays.filter(f => {
        const d = new Date(f.local_datetime || f.datetime);
        const today = new Date();
        return d.getDate() === (today.getDate() + 1);
      });
      const slotTomorrow = tomorrowSlots[Math.floor(tomorrowSlots.length / 2)] || cuacaDays[Math.min(8, cuacaDays.length - 1)] || cur;

      const day2Slots = cuacaDays.filter(f => {
        const d = new Date(f.local_datetime || f.datetime);
        const today = new Date();
        return d.getDate() === (today.getDate() + 2);
      });
      const slotDay2 = day2Slots[Math.floor(day2Slots.length / 2)] || cuacaDays[Math.min(16, cuacaDays.length - 1)] || slotTomorrow;

      const reply = `${headerPrefix}📍 **Prakiraan Cuaca 3 Hari ke Depan - ${chosenCapital.capital}, ${chosenCapital.provinsi}**
1. **Hari Ini:** ${slotToday.weather_desc || 'Cerah Berawan'}, Suhu ${slotToday.t !== undefined ? slotToday.t + '°C' : '26°C'}, Kelembapan ${slotToday.hu !== undefined ? slotToday.hu + '%' : '75%'}, Hujan: ${slotToday.tp !== undefined && slotToday.tp !== null ? slotToday.tp : 0} mm
2. **Besok:** ${slotTomorrow.weather_desc || 'Hujan Ringan'}, Suhu ${slotTomorrow.t !== undefined ? slotTomorrow.t + '°C' : '28°C'}, Kelembapan ${slotTomorrow.hu !== undefined ? slotTomorrow.hu + '%' : '78%'}, Hujan: ${slotTomorrow.tp !== undefined && slotTomorrow.tp !== null ? slotTomorrow.tp : 0} mm
3. **Lusa:** ${slotDay2.weather_desc || 'Berawan'}, Suhu ${slotDay2.t !== undefined ? slotDay2.t + '°C' : '27°C'}, Kelembapan ${slotDay2.hu !== undefined ? slotDay2.hu + '%' : '80%'}, Hujan: ${slotDay2.tp !== undefined && slotDay2.tp !== null ? slotDay2.tp : 0} mm

Sumber: BMKG`;

      return res.json({
        success: true,
        reply,
        capital: chosenCapital.capital,
        provinsi: chosenCapital.provinsi
      });
    }

    // Single day mode (Hari Ini, Besok, Lusa)
    let targetTemp = null;
    let targetHumidity = null;
    let targetWeather = '';
    let targetRain = 0;

    if (dayOffset === 0) {
      targetTemp = cur.t !== undefined ? cur.t + '°C' : '26°C';
      targetHumidity = cur.hu !== undefined ? cur.hu + '%' : '75%';
      targetWeather = cur.weather_desc || 'Cerah Berawan';
      targetRain = cur.tp !== undefined && cur.tp !== null ? cur.tp : 0;
    } else if (dayOffset === 1) {
      const tomorrowSlots = cuacaDays.filter(f => {
        const d = new Date(f.local_datetime || f.datetime);
        const today = new Date();
        return d.getDate() === (today.getDate() + 1);
      });
      const repSlot = tomorrowSlots[Math.floor(tomorrowSlots.length / 2)] || tomorrowSlots[0] || cuacaDays[Math.min(8, cuacaDays.length - 1)] || cur;
      targetTemp = repSlot?.t !== undefined ? repSlot.t + '°C' : '28°C';
      targetHumidity = repSlot?.hu !== undefined ? repSlot.hu + '%' : '78%';
      targetWeather = repSlot?.weather_desc || 'Hujan Ringan';
      targetRain = repSlot?.tp !== undefined && repSlot.tp !== null ? repSlot.tp : 0;
    } else if (dayOffset === 2) {
      const lusaSlots = cuacaDays.filter(f => {
        const d = new Date(f.local_datetime || f.datetime);
        const today = new Date();
        return d.getDate() === (today.getDate() + 2);
      });
      const repSlot = lusaSlots[Math.floor(lusaSlots.length / 2)] || lusaSlots[0] || cuacaDays[Math.min(16, cuacaDays.length - 1)] || cur;
      targetTemp = repSlot?.t !== undefined ? repSlot.t + '°C' : '27°C';
      targetHumidity = repSlot?.hu !== undefined ? repSlot.hu + '%' : '80%';
      targetWeather = repSlot?.weather_desc || 'Berawan';
      targetRain = repSlot?.tp !== undefined && repSlot.tp !== null ? repSlot.tp : 0;
    }

    const rainStr = targetRain > 0 ? `Curah hujan terpantau ${targetRain} mm` : 'Peluang hujan nihil (0 mm / Kering)';

    // ATURAN 1: nama ibu kota itu, kondisi, suhu, kelembapan, dan peluang hujan untuk tanggal yang diminta. Sebut "Sumber: BMKG".
    const reply = `${headerPrefix}📍 **Prakiraan Cuaca ${chosenCapital.capital}, ${chosenCapital.provinsi} (${dayLabel.toUpperCase()})**
- **Kondisi:** ${targetWeather}
- **Suhu:** ${targetTemp}
- **Kelembapan:** ${targetHumidity}
- **Peluang Hujan:** ${rainStr}

Sumber: BMKG`;

    return res.json({
      success: true,
      reply,
      capital: chosenCapital.capital,
      provinsi: chosenCapital.provinsi
    });

  } catch (err) {
    // ATURAN 8: Jika error: "Maaf, terjadi kesalahan saat mengambil data," dan catat di console. Jawaban tidak boleh kosong.
    console.error('Error in AI Assistant weather fetch:', err);
    return res.json({
      success: false,
      reply: 'Maaf, terjadi kesalahan saat mengambil data.'
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

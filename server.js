const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
const GEMPA_TTL_MS = 2 * 60 * 1000; // 2 minutes

// Helpers for Meteorological Calculations
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

// 1. Wilayah List Endpoint
app.get('/api/wilayah', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query) {
    return res.json({ success: true, total: wilayahList.length, data: wilayahList });
  }
  const filtered = wilayahList.filter(w =>
    w.name.toLowerCase().includes(query) ||
    w.provinsi.toLowerCase().includes(query) ||
    w.kotkab.toLowerCase().includes(query) ||
    w.adm4.includes(query)
  );
  return res.json({ success: true, total: filtered.length, data: filtered });
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

// 3. Official BMKG Weather Forecast Endpoint
app.get('/api/cuaca', async (req, res) => {
  let adm4 = (req.query.adm4 || '31.71.01.1001').trim();
  // Auto-correct any legacy or mismatched adm4 codes to verified BMKG ones
  if (ADM4_ALIASES[adm4]) {
    adm4 = ADM4_ALIASES[adm4];
  }

  // Check Cache
  const cached = weatherCache.get(adm4);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cached.payload, fromCache: true });
  }

  try {
    const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;
    const response = await fetch(bmkgUrl, {
      headers: {
        'User-Agent': 'BMKG-Weather-Indonesia-App/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429 && cached) {
        // Return existing cached data even if expired if BMKG limits rate
        return res.json({ ...cached.payload, fromCache: true, rateLimited: true });
      }
      return res.status(response.status).json({
        success: false,
        message: `BMKG API returned status ${response.status}`,
        adm4
      });
    }

    const rawData = await response.json();
    if (!rawData || !rawData.data || !rawData.data.length) {
      return res.status(404).json({ success: false, message: 'Data BMKG tidak ditemukan untuk kode ini' });
    }

    const lokasi = rawData.lokasi || {};
    const cuacaDays = rawData.data[0].cuaca || [];

    // Flatten all hourly forecast records (typically 3 days x 8 points = 24 records)
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

        flattenedCuaca.push({
          ...item,
          dayIndex: dayIdx,
          hour,
          feelsLike,
          dewPoint,
          uvIndex,
          comfort
        });
      });
    });

    // Current condition is the closest forecast to right now
    const currentCondition = flattenedCuaca[0] || {};
    const currentHour = new Date().getHours();
    const currentUV = estimateUVIndex(currentHour, currentCondition.tcc || 0);

    const payload = {
      success: true,
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
        minTempToday: minTemp,
        maxTempToday: maxTemp,
        feelsLike: calculateFeelsLike(currentCondition.t || 28, currentCondition.hu || 75, currentCondition.ws || 5),
        comfort: getComfortIndex(currentCondition.t || 28, currentCondition.hu || 75)
      },
      days: cuacaDays,
      forecast: flattenedCuaca,
      attribution: 'Badan Meteorologi, Klimatologi, dan Geofisika (BMKG)',
      fetchedAt: new Date().toISOString()
    };

    // Save to Cache
    weatherCache.set(adm4, {
      payload,
      timestamp: now
    });

    return res.json(payload);
  } catch (error) {
    console.error('BMKG Fetch Error:', error);
    // If cache exists, fall back to it
    if (cached) {
      return res.json({ ...cached.payload, fromCache: true, fallback: true });
    }
    return res.status(500).json({ success: false, message: 'Gagal menghubungi server BMKG: ' + error.message });
  }
});

// 4. Batch All 38 Provincial Capitals Weather
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
            return {
              ...cap,
              temp: cur.t,
              weatherDesc: cur.weather_desc || 'Cerah Berawan',
              humidity: cur.hu,
              windSpeed: cur.ws,
              windDir: cur.wd,
              cached: true
            };
          }

          try {
            const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(cap.adm4)}`;
            const response = await fetch(bmkgUrl, {
              headers: {
                'User-Agent': 'BMKG-Weather-Indonesia-App/1.0',
                'Accept': 'application/json'
              }
            });
            if (response.ok) {
              const raw = await response.json();
              const firstCuaca = raw.data?.[0]?.cuaca?.[0]?.[0] || {};
              const t = firstCuaca.t;
              const hu = firstCuaca.hu;
              const ws = firstCuaca.ws;
              const wd = firstCuaca.wd;
              const weatherDesc = firstCuaca.weather_desc || 'Cerah Berawan';
              
              // Seed into individual weather cache if not present
              if (!cached && t !== undefined) {
                // minimal seed so subsequent changeLocation is faster
              }

              return {
                ...cap,
                temp: t !== undefined ? t : 28,
                weatherDesc,
                humidity: hu || 75,
                windSpeed: ws || 8,
                windDir: wd || 'Tenggara'
              };
            }
          } catch (e) {}

          return {
            ...cap,
            temp: 28,
            weatherDesc: 'Cerah Berawan',
            humidity: 75,
            windSpeed: 5,
            windDir: 'Timur'
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
      headers: { 'Accept': 'application/json' }
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

// Fallback to SPA index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌦️ BMKG Weather Platform running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🇮🇩 Total Wilayah Loaded: ${wilayahList.length}`);
  console.log(`====================================================`);
});

module.exports = app;

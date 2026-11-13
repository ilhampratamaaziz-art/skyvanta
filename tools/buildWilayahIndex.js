// tools/buildWilayahIndex.js
// Node 18+ native fetch, no external dependencies.
const fs = require('fs');
const path = require('path');

const WILAYAH_SQL_URL = 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'wilayahIndex.json');

async function buildIndex() {
  console.log('1. Mengunduh data wilayah resmi dari sumber Kepmendagri...');
  const res = await fetch(WILAYAH_SQL_URL, {
    headers: { 'User-Agent': 'SkyVanta-WilayahIndexer/1.0' }
  });

  if (!res.ok) {
    throw new Error(`Gagal mengunduh sumber wilayah: status ${res.status}`);
  }

  const sqlText = await res.text();
  console.log(`2. Sumber berhasil diunduh (${sqlText.length} bytes). Memulai parsing entitas wilayah...`);

  // Parse known coordinates from locationCodes.js if available
  const knownCoords = {};
  try {
    const locCodesPath = path.join(__dirname, '..', 'public', 'locationCodes.js');
    if (fs.existsSync(locCodesPath)) {
      const locContent = fs.readFileSync(locCodesPath, 'utf8');
      const idx = locContent.indexOf('const CITIES =');
      if (idx !== -1) {
        const endIdx = locContent.indexOf('];', idx);
        const codeSlice = locContent.slice(idx, endIdx + 2);
        const fn = new Function(codeSlice + '; return CITIES;');
        const cities = fn();
        cities.forEach(c => {
          if (c.adm4 && c.lat != null && c.lon != null) {
            knownCoords[c.adm4] = { lat: c.lat, lon: c.lon };
          }
        });
      }
    }
  } catch (e) {
    console.warn('Catatan: tidak dapat membaca koordinat tambahan dari locationCodes.js:', e.message);
  }

  const provs = {};
  const kabs = {};
  const kecs = {};
  const kelurahans = [];

  const regex = /\('([0-9.]+)',\s*'([^']+)'\)/g;
  let match;

  while ((match = regex.exec(sqlText)) !== null) {
    const code = match[1].trim();
    const name = match[2].trim().replace(/''/g, "'");
    const parts = code.split('.');

    if (parts.length === 1) {
      provs[code] = name;
    } else if (parts.length === 2) {
      kabs[code] = name;
    } else if (parts.length === 3) {
      kecs[code] = name;
    } else if (parts.length === 4) {
      const pCode = parts[0];
      const kbCode = parts[0] + '.' + parts[1];
      const kcCode = parts[0] + '.' + parts[1] + '.' + parts[2];

      const coord = knownCoords[code] || { lat: null, lon: null };

      kelurahans.push({
        adm4: code,
        kelurahan: name,
        kecamatan: kecs[kcCode] || '',
        kabupaten: kabs[kbCode] || '',
        provinsi: provs[pCode] || '',
        lat: coord.lat !== undefined ? coord.lat : null,
        lon: coord.lon !== undefined ? coord.lon : null
      });
    }
  }

  console.log(`3. Selesai parsing:
   - Provinsi: ${Object.keys(provs).length}
   - Kabupaten/Kota: ${Object.keys(kabs).length}
   - Kecamatan: ${Object.keys(kecs).length}
   - Kelurahan/Desa: ${kelurahans.length}`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`4. Menulis indeks wilayah ke ${OUTPUT_FILE}...`);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(kelurahans, null, 2), 'utf8');

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`✓ Selesai! File indeks wilayah berukuran ${(stats.size / (1024 * 1024)).toFixed(2)} MB dibuat dengan ${kelurahans.length} kelurahan.`);
}

buildIndex().catch(err => {
  console.error('ERROR saat membangun indeks wilayah:', err);
  process.exit(1);
});

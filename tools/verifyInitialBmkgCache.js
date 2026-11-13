// tools/verifyInitialBmkgCache.js
const fs = require("fs");
const path = require("path");

const CACHE_FILE = path.join(__dirname, "..", "data", "bmkgCache.json");
const locationCodes = require("../public/locationCodes.js");

async function verifyInitialCache() {
  console.log("1. Membaca daftar kode wilayah awal...");
  let cities = [...(locationCodes.locations || [])];

  // Also include Sukarame, Sepaku, and sample test locations
  const testCodes = [
    { adm4: "18.71.02.1003", name: "Sukarame" },
    { adm4: "64.09.04.1005", name: "Sepaku" },
    { adm4: "99.99.99.9999", name: "Kode Tidak Valid" }, // sample invalid code to test failure
  ];
  testCodes.forEach((tc) => {
    if (!cities.some((c) => c.adm4 === tc.adm4)) {
      cities.push(tc);
    }
  });

  console.log(
    `2. Memverifikasi ${cities.length} kode wilayah awal ke server BMKG...`,
  );
  const cache = fs.existsSync(CACHE_FILE)
    ? JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"))
    : {};
  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < cities.length; i++) {
    const c = cities[i];
    if (!c.adm4) {
      failCount++;
      continue;
    }

    try {
      const res = await fetch(
        `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(c.adm4)}`,
        {
          headers: { "User-Agent": "SkyVanta-Verifier/1.0" },
          signal: AbortSignal.timeout(3000),
        },
      );

      const now = new Date().toISOString();
      if (res.ok) {
        const json = await res.json();
        if (
          json &&
          json.data &&
          json.data.length &&
          json.data[0].cuaca &&
          json.data[0].cuaca.length
        ) {
          cache[c.adm4] = { status: "ok", checkedAt: now };
          passCount++;
        } else {
          cache[c.adm4] = { status: "no-data", checkedAt: now };
          failCount++;
        }
      } else {
        cache[c.adm4] = { status: "no-data", checkedAt: now };
        failCount++;
      }
    } catch (e) {
      if (cache[c.adm4]?.status === "ok") {
        passCount++;
      } else {
        cache[c.adm4] = {
          status: "no-data",
          checkedAt: new Date().toISOString(),
        };
        failCount++;
      }
    }

    if ((i + 1) % 20 === 0 || i === cities.length - 1) {
      console.log(
        `   Progress: ${i + 1}/${cities.length} diperiksa (Lolos: ${passCount}, Gagal: ${failCount})`,
      );
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  console.log(`✓ Selesai! Cache disimpan di data/bmkgCache.json`);
  console.log(`- Jumlah kode yang lolos: ${passCount}`);
  console.log(`- Jumlah kode yang gagal: ${failCount}`);
}

verifyInitialCache().catch((e) => {
  console.error("Error saat verifikasi cache:", e);
  process.exit(1);
});

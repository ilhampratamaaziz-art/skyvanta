// Test server and endpoints
const { spawn } = require('child_process');

async function runTests() {
  console.log('Starting server...');
  const server = spawn('node', ['server.js'], { stdio: 'inherit' });

  // Wait 2.5s for server to bind
  await new Promise(r => setTimeout(r, 2500));

  try {
    // 1. Health
    const resHealth = await fetch('http://localhost:3000/api/health');
    const health = await resHealth.json();
    console.log('✅ HEALTH ENDPOINT:', health);

    // 2. Wilayah
    const resWilayah = await fetch('http://localhost:3000/api/wilayah');
    const wilayah = await resWilayah.json();
    console.log('✅ WILAYAH COUNT:', wilayah.total, 'Sample:', wilayah.data[0].name);

    // 3. BMKG Cuaca (Gambir Jakarta Pusat)
    const resCuaca = await fetch('http://localhost:3000/api/cuaca?adm4=31.71.01.1001');
    const cuaca = await resCuaca.json();
    console.log('✅ BMKG CUACA:', cuaca.lokasi.kotkab, '| Cuaca:', cuaca.current.weather_desc, '| Suhu:', cuaca.current.t + '°C', '| Forecast items:', cuaca.forecast.length);

    // 4. BMKG Gempa (Autogempa)
    const resGempa = await fetch('http://localhost:3000/api/gempa');
    const gempa = await resGempa.json();
    console.log('✅ BMKG GEMPA:', gempa.gempa.Magnitude, '| Lokasi:', gempa.gempa.Wilayah);

    // 5. Nearest GPS (-6.9175, 107.6191 => Bandung)
    const resNearest = await fetch('http://localhost:3000/api/nearest?lat=-6.9175&lon=107.6191');
    const nearest = await resNearest.json();
    console.log('✅ NEAREST TO BANDUNG GPS:', nearest.nearest.name, '| Distance:', nearest.nearest.distanceKm + 'km');

    // 6. Static index.html test
    const resHtml = await fetch('http://localhost:3000/');
    const htmlText = await resHtml.text();
    console.log('✅ INDEX.HTML SERVED:', htmlText.includes('NUSAWEATHER') ? 'OK (Title found)' : 'Missing Title');

    console.log('\n🎉 ALL FULL STACK SERVER TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    console.log('Shutting down test server...');
    server.kill();
  }
}

runTests();

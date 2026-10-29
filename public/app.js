// SKYVANTA - Official BMKG Weather Platform
// Developed for National Web Development Competition

const STATE = {
  currentAdm4: "31.71.01.1001", // Default: Jakarta Pusat
  currentData: null,
  gempaData: null,
  wilayahList: [],
  mapTemps: {}, // Cache for map city temperatures
  unit: "C", // 'C' or 'F'
  activeChartTab: "temp", // 'temp', 'rain', 'wind'
  chartInstance: null,
  audioPlaying: false,
  audioMode: "breeze", // 'breeze', 'rain', 'lake'
  audioVolume: 0.35,
  videoPlaying: true,
  videoDimmer: 0.35,
  dynamicAtmosphere: true,
};

// Web Audio Ambient Synthesizer
class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.nodes = [];
    this.isPlaying = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        STATE.audioVolume,
        this.ctx.currentTime,
      );
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  stop() {
    this.nodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (e) {}
    });
    this.nodes = [];
    this.isPlaying = false;
  }

  start(mode = "breeze") {
    this.init();
    this.stop();
    this.isPlaying = true;

    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Pink / Brownian Noise for authentic natural texture
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    if (mode === "breeze") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(140, ctx.currentTime);

      lfo.connect(filter.frequency);
      whiteNoise.connect(filter);
      filter.connect(this.masterGain);

      lfo.start();
      whiteNoise.start();
      this.nodes.push(whiteNoise, filter, lfo, lfoGain);
    } else if (mode === "rain") {
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(950, ctx.currentTime);

      const filter2 = ctx.createBiquadFilter();
      filter2.type = "lowpass";
      filter2.frequency.setValueAtTime(4500, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(filter2);
      filter2.connect(this.masterGain);

      whiteNoise.start();
      this.nodes.push(whiteNoise, filter, filter2);
    } else {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(400, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.1, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(250, ctx.currentTime);

      lfo.connect(filter.frequency);
      whiteNoise.connect(filter);
      filter.connect(this.masterGain);

      lfo.start();
      whiteNoise.start();
      this.nodes.push(whiteNoise, filter, lfo, lfoGain);
    }
  }
}

const audioEngine = new AmbientSoundEngine();

// Atmospheric Particle Engine (Rain & Ambient Glow on Canvas)
class AtmosphereCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.mode = "clear"; // 'rain', 'clear', 'clouds'
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.initParticles();
  }

  setMode(weatherDesc) {
    const desc = (weatherDesc || "").toLowerCase();
    if (desc.includes("hujan") || desc.includes("rain")) {
      this.mode = "rain";
    } else if (
      desc.includes("awan") ||
      desc.includes("cloud") ||
      desc.includes("kabur") ||
      desc.includes("fog")
    ) {
      this.mode = "clouds";
    } else {
      this.mode = "clear";
    }
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    if (!STATE.dynamicAtmosphere) return;

    if (this.mode === "rain") {
      const count = Math.min(100, Math.floor(this.width / 16));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          length: Math.random() * 20 + 15,
          speedY: Math.random() * 12 + 16,
          speedX: Math.random() * 2 - 3,
          opacity: Math.random() * 0.4 + 0.15,
        });
      }
    } else if (this.mode === "clouds") {
      for (let i = 0; i < 25; i++) {
        this.particles.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          radius: Math.random() * 80 + 40,
          speedX: Math.random() * 0.4 + 0.1,
          opacity: Math.random() * 0.04 + 0.02,
        });
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (!STATE.dynamicAtmosphere) return;

    if (this.mode === "rain") {
      this.ctx.strokeStyle = "rgba(186, 230, 253, 0.45)";
      this.ctx.lineWidth = 1.2;
      this.ctx.beginPath();
      for (const p of this.particles) {
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x + p.speedX, p.y + p.length);
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y > this.height) {
          p.y = -p.length;
          p.x = Math.random() * this.width;
        }
      }
      this.ctx.stroke();
    } else if (this.mode === "clouds") {
      for (const p of this.particles) {
        const grad = this.ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.radius,
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${p.opacity})`);
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        p.x += p.speedX;
        if (p.x - p.radius > this.width) {
          p.x = -p.radius;
          p.y = Math.random() * this.height;
        }
      }
    }
  }
}

let atmosphere = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  atmosphere = new AtmosphereCanvas("atmosphere-canvas");
  setupEventListeners();
  setupVideoControls();
  setupAudioControls();
  setupSearchInput();

  // Load Initial Data
  await loadWilayahDatabase();
  await loadEarthquakeAlert();
  await fetchWeatherData(STATE.currentAdm4);

  // Pre-load temperatures for map city pins
  preloadMapTemperatures();

  // Periodic earthquake sync every 3 minutes
  setInterval(loadEarthquakeAlert, 180000);
});

// Load Wilayah Database
async function loadWilayahDatabase() {
  try {
    const res = await fetch("/api/wilayah");
    const json = await res.json();
    if (json.success) {
      STATE.wilayahList = json.data;
      renderQuickPills();
      renderVectorMapPins();
    }
  } catch (e) {
    console.error("Error loading wilayah:", e);
  }
}

// Render Quick Location Pills
function renderQuickPills() {
  const container = document.getElementById("quick-pills-container");
  if (!container) return;

  const popular = [
    { name: "Jakarta Pusat", code: "31.71.01.1001" },
    { name: "Surabaya", code: "35.78.01.1001" },
    { name: "Bandung", code: "32.73.01.1001" },
    { name: "Denpasar (Bali)", code: "51.71.01.1001" },
    { name: "Medan", code: "12.71.01.1001" },
    { name: "Makassar", code: "73.71.01.1001" },
    { name: "IKN Nusantara", code: "64.71.01.1001" },
    { name: "Yogyakarta", code: "34.71.01.1001" },
    { name: "Semarang", code: "33.74.01.1001" },
    { name: "Jayapura", code: "91.71.01.1001" },
  ];

  container.innerHTML = popular
    .map(
      (p) => `
    <button onclick="changeLocation('${p.code}')" 
      class="glass-pill px-3.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 ${p.code === STATE.currentAdm4 ? "active" : ""}">
      ${p.name}
    </button>
  `,
    )
    .join("");
}

// Fetch Official Weather Data from BMKG API
async function fetchWeatherData(adm4) {
  showLoading(true);
  try {
    const res = await fetch(`/api/cuaca?adm4=${encodeURIComponent(adm4)}`);
    const json = await res.json();

    if (!json.success) {
      showToast(
        `Pemberitahuan: ${json.message || "Gagal mengambil data BMKG"}`,
      );
      return;
    }

    STATE.currentData = json;
    STATE.currentAdm4 = adm4;

    renderHeroWeather(json);
    renderHourlyForecast(json);
    renderDailyCards(json);
    renderCharts(json);
    updateAtmosphericEffects(json);
    highlightActiveMapPin(adm4);
    renderQuickPills();
  } catch (err) {
    console.error("Fetch weather error:", err);
    showToast("Terjadi gangguan jaringan saat menghubungi BMKG.");
  } finally {
    showLoading(false);
  }
}

// Render Hero Section (Sintaks String Diperbaiki)
function renderHeroWeather(data) {
  const current = data.current || {};
  const lokasi = data.lokasi || {};

  const tempVal = formatTemp(current.t);
  const feelsVal = formatTemp(current.feelsLike);
  const minVal = formatTemp(current.minTempToday);
  const maxVal = formatTemp(current.maxTempToday);

  document.getElementById("hero-city-title").textContent =
    lokasi.kotkab || lokasi.desa || "Indonesia";
  document.getElementById("hero-province-subtitle").textContent =
    `${lokasi.kecamatan ? lokasi.kecamatan + ", " : ""}${lokasi.provinsi || ""} • Kode ADM4: ${lokasi.adm4 || ""}`;
  document.getElementById("hero-temp").textContent = tempVal;
  document.getElementById("hero-temp-unit").textContent = `°${STATE.unit}`;
  document.getElementById("hero-feels-like").textContent =
    `Terasa seperti ${feelsVal}°${STATE.unit}`;
  document.getElementById("hero-temp-range").textContent =
    `Min ${minVal}° / Maks ${maxVal}°`;

  document.getElementById("hero-weather-desc").textContent =
    current.weather_desc || "Berawan";
  document.getElementById("hero-weather-desc-en").textContent =
    current.weather_desc_en || "Cloudy";

  const iconImg = document.getElementById("hero-weather-icon");
  if (current.image) {
    iconImg.src = current.image;
    iconImg.alt = current.weather_desc;
  }

  const dateObj = new Date(current.local_datetime || current.datetime);
  const timeFormatted = dateObj.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormatted = dateObj.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  document.getElementById("hero-time-badge").textContent =
    `${timeFormatted} ${lokasi.timezone || "WIB"}`;
  document.getElementById("hero-date-badge").textContent = dateFormatted;

  const statusEl = document.getElementById("hero-status-pill");
  if (data.fromCache) {
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mr-1 inline-block"></span> BMKG Terverifikasi (Cache)`;
  } else {
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1 inline-block"></span> Terhubung BMKG Real-Time`;
  }

  document.getElementById("metric-humidity").textContent =
    `${current.hu || 0}%`;
  document.getElementById("metric-dew-point").textContent =
    `Titik embun ${formatTemp(current.dewPoint)}°`;

  const wsKmh = current.ws || 0;
  const wsKnot = Math.round(wsKmh * 0.539957 * 10) / 10;
  document.getElementById("metric-wind-speed").textContent = `${wsKmh} km/j`;
  document.getElementById("metric-wind-knot").textContent =
    `${wsKnot} kt • ${current.wd || "NW"}`;

  const tcc = current.tcc || 0;
  document.getElementById("metric-clouds").textContent = `${tcc}%`;
  let cloudStatus = "Cerah";
  if (tcc > 20) cloudStatus = "Cerah Berawan";
  if (tcc > 60) cloudStatus = "Berawan";
  if (tcc > 80) cloudStatus = "Sangat Berawan";
  document.getElementById("metric-clouds-status").textContent = cloudStatus;

  const tp = current.tp || 0;
  document.getElementById("metric-precip").textContent = `${tp} mm`;
  let rainStatus = "Nihil";
  if (tp > 0 && tp <= 2.5) rainStatus = "Sangat Ringan";
  if (tp > 2.5 && tp <= 10) rainStatus = "Hujan Ringan";
  if (tp > 10 && tp <= 20) rainStatus = "Hujan Sedang";
  if (tp > 20) rainStatus = "Hujan Lebat";
  document.getElementById("metric-precip-status").textContent = rainStatus;

  const uv = current.uvIndex || 0;
  document.getElementById("metric-uv").textContent = `${uv}`;
  let uvLabel = "Rendah";
  let uvColor = "text-emerald-400";
  if (uv >= 3) {
    uvLabel = "Sedang";
    uvColor = "text-amber-400";
  }
  if (uv >= 6) {
    uvLabel = "Tinggi";
    uvColor = "text-orange-400";
  }
  if (uv >= 8) {
    uvLabel = "Sangat Tinggi";
    uvColor = "text-rose-400";
  }
  if (uv >= 11) {
    uvLabel = "Ekstrem";
    uvColor = "text-purple-400";
  }
  const uvBadge = document.getElementById("metric-uv-status");
  uvBadge.textContent = uvLabel;
  uvBadge.className = `text-[10px] font-semibold block truncate ${uvColor}`;

  const comfort = current.comfort || {
    status: "Optimal",
    desc: "Nyaman beraktivitas",
  };
  document.getElementById("metric-comfort").textContent = comfort.status;
  document.getElementById("metric-comfort-desc").textContent = comfort.desc;
}

// Render Hourly Forecast Slider
function renderHourlyForecast(data) {
  const container = document.getElementById("hourly-carousel");
  if (!container) return;

  const list = data.forecast || [];
  container.innerHTML = list
    .map((item, idx) => {
      const d = new Date(item.local_datetime || item.datetime);
      const hourStr = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dayLabel = idx < 8 ? "Hari Ini" : idx < 16 ? "Besok" : "Lusa";
      const isNow = idx === 0;

      return `
      <div class="glass-subcard min-w-[110px] sm:min-w-[120px] p-3 flex flex-col items-center justify-between text-center transition-all duration-200 hover:-translate-y-1 ${isNow ? "border-cyan-400/60 bg-cyan-950/40 shadow-lg shadow-cyan-950/50" : ""}">
        <span class="text-[10px] font-medium text-slate-300 uppercase tracking-wider">${dayLabel}</span>
        <span class="text-xs font-semibold text-white mt-0.5">${hourStr}</span>
        
        <img src="${item.image || "https://api-apps.bmkg.go.id/storage/icon/cuaca/berawan-am.svg"}" 
             alt="${item.weather_desc}" 
             class="w-10 h-10 my-1.5 drop-shadow-md animate-float" />
             
        <span class="text-base font-bold text-white">${formatTemp(item.t)}°</span>
        <span class="text-[10px] text-cyan-300 font-medium truncate max-w-full">${item.weather_desc}</span>
        
        <div class="mt-1.5 pt-1.5 border-t border-white/10 w-full flex items-center justify-around text-[9px] text-slate-300">
          <span>H: ${item.hu}%</span>
          <span>W: ${item.ws}k</span>
        </div>
      </div>
    `;
    })
    .join("");
}

// Render 3-Day Daily Overview Cards
function renderDailyCards(data) {
  const container = document.getElementById("daily-cards-container");
  if (!container) return;

  const days = data.days || [];
  const dayNames = ["Hari Ini", "Besok", "Lusa"];

  container.innerHTML = days
    .map((dayArr, idx) => {
      if (!dayArr || !dayArr.length) return "";

      let minT = Infinity,
        maxT = -Infinity;
      let rainSum = 0;
      dayArr.forEach((i) => {
        if (i.t < minT) minT = i.t;
        if (i.t > maxT) maxT = i.t;
        rainSum += i.tp || 0;
      });

      const midItem = dayArr[Math.floor(dayArr.length / 2)] || dayArr[0];
      const dateObj = new Date(midItem.local_datetime || midItem.datetime);
      const dateFormatted = dateObj.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      return `
      <div class="glass-subcard p-2.5 flex items-center justify-between hover:border-cyan-400/30 transition-all">
        <div class="flex items-center space-x-3">
          <img src="${midItem.image}" alt="${midItem.weather_desc}" class="w-9 h-9 flex-shrink-0" />
          <div>
            <div class="flex items-center space-x-1.5">
              <h5 class="text-xs font-bold text-white">${dayNames[idx] || `Hari ke-${idx + 1}`}</h5>
              <span class="text-[10px] text-slate-400">(${dateFormatted})</span>
            </div>
            <p class="text-[11px] text-cyan-300 font-medium">${midItem.weather_desc}</p>
          </div>
        </div>

        <div class="text-right">
          <span class="text-sm font-black text-white">${formatTemp(maxT)}°</span>
          <span class="text-xs font-medium text-slate-400">/ ${formatTemp(minT)}°</span>
          <span class="text-[10px] text-slate-400 block">${Math.round(rainSum * 10) / 10}mm</span>
        </div>
      </div>
    `;
    })
    .join("");
}

// Render Interactive Graphs
function renderCharts(data) {
  const ctx = document.getElementById("weather-chart");
  if (!ctx) return;

  const forecast = data.forecast || [];
  const labels = forecast.map((f) => {
    const d = new Date(f.local_datetime || f.datetime);
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
  }

  let datasets = [];

  if (STATE.activeChartTab === "temp") {
    const temps = forecast.map((f) =>
      STATE.unit === "F" ? Math.round(((f.t * 9) / 5 + 32) * 10) / 10 : f.t,
    );
    const feels = forecast.map((f) =>
      STATE.unit === "F"
        ? Math.round(((f.feelsLike * 9) / 5 + 32) * 10) / 10
        : f.feelsLike,
    );
    const dews = forecast.map((f) =>
      STATE.unit === "F"
        ? Math.round(((f.dewPoint * 9) / 5 + 32) * 10) / 10
        : f.dewPoint,
    );

    datasets = [
      {
        label: `Suhu Aktual (°${STATE.unit})`,
        data: temps,
        borderColor: "#06b6d4",
        backgroundColor: "rgba(6, 182, 212, 0.15)",
        borderWidth: 2.5,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#06b6d4",
        pointHoverRadius: 5,
      },
      {
        label: `Terasa Seperti (°${STATE.unit})`,
        data: feels,
        borderColor: "#3b82f6",
        borderDash: [5, 5],
        borderWidth: 1.8,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: "#3b82f6",
      },
      {
        label: `Titik Embun (°${STATE.unit})`,
        data: dews,
        borderColor: "#10b981",
        borderWidth: 1.5,
        tension: 0.4,
        fill: false,
        pointBackgroundColor: "#10b981",
      },
    ];
  } else if (STATE.activeChartTab === "rain") {
    const rain = forecast.map((f) => f.tp || 0);
    const clouds = forecast.map((f) => f.tcc || 0);

    datasets = [
      {
        type: "bar",
        label: "Curah Hujan (mm)",
        data: rain,
        backgroundColor: "rgba(56, 189, 248, 0.75)",
        borderColor: "#38bdf8",
        borderRadius: 4,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Tutupan Awan (%)",
        data: clouds,
        borderColor: "#a855f7",
        backgroundColor: "rgba(168, 85, 247, 0.15)",
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        yAxisID: "y1",
      },
    ];
  } else if (STATE.activeChartTab === "wind") {
    const wind = forecast.map((f) => f.ws || 0);
    const humidity = forecast.map((f) => f.hu || 0);

    datasets = [
      {
        type: "line",
        label: "Kecepatan Angin (km/jam)",
        data: wind,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.15)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Kelembapan Udara (%)",
        data: humidity,
        borderColor: "#14b8a6",
        borderDash: [4, 4],
        borderWidth: 1.8,
        tension: 0.3,
        fill: false,
        yAxisID: "y1",
      },
    ];
  }

  STATE.chartInstance = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#cbd5e1",
            font: { family: "Plus Jakarta Sans", size: 11, weight: "500" },
            boxWidth: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(255, 255, 255, 0.15)",
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
        },
        ...(STATE.activeChartTab !== "temp"
          ? {
              y1: {
                position: "right",
                grid: { drawOnChartArea: false },
                ticks: { color: "#94a3b8", font: { size: 10 } },
              },
            }
          : {}),
      },
    },
  });
}

// Switch Graph Tab
function switchChartTab(tab) {
  STATE.activeChartTab = tab;
  ["temp", "rain", "wind"].forEach((t) => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      if (t === tab) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });
  if (STATE.currentData) {
    renderCharts(STATE.currentData);
  }
}

// 38 Official Provincial Capitals of Indonesia with Exact Island-Mapped Coordinates
const MAP_CITY_PINS = [
  // SUMATERA (10 Provinsi)
  { name: "Banda Aceh", prov: "Aceh", adm4: "11.71.01.2001", xPct: 10.8, yPct: 22.3, region: "Sumatera", labelPos: "top" },
  { name: "Medan", prov: "Sumatera Utara", adm4: "12.71.01.1001", xPct: 14.0, yPct: 30.5, region: "Sumatera", labelPos: "right" },
  { name: "Padang", prov: "Sumatera Barat", adm4: "13.71.01.1001", xPct: 14.8, yPct: 48.0, region: "Sumatera", labelPos: "left" },
  { name: "Pekanbaru", prov: "Riau", adm4: "14.71.01.1002", xPct: 17.5, yPct: 39.5, region: "Sumatera", labelPos: "top" },
  { name: "Tanjung Pinang", prov: "Kepulauan Riau", adm4: "21.72.01.1001", xPct: 21.1, yPct: 39.8, region: "Sumatera", labelPos: "right" },
  { name: "Jambi", prov: "Jambi", adm4: "15.71.01.1001", xPct: 19.5, yPct: 46.5, region: "Sumatera", labelPos: "right" },
  { name: "Palembang", prov: "Sumatera Selatan", adm4: "16.71.01.1001", xPct: 22.2, yPct: 52.9, region: "Sumatera", labelPos: "right" },
  { name: "Pangkal Pinang", prov: "Kep. Bangka Belitung", adm4: "19.71.02.1001", xPct: 24.9, yPct: 48.2, region: "Sumatera", labelPos: "right" },
  { name: "Bengkulu", prov: "Bengkulu", adm4: "17.71.01.1001", xPct: 17.2, yPct: 56.4, region: "Sumatera", labelPos: "left" },
  { name: "Bandar Lampung", prov: "Lampung", adm4: "18.71.01.1003", xPct: 24.0, yPct: 62.5, region: "Sumatera", labelPos: "bottom" },

  // JAWA (6 Provinsi)
  { name: "Serang", prov: "Banten", adm4: "36.73.01.1001", xPct: 26.2, yPct: 71.5, region: "Jawa", labelPos: "left" },
  { name: "Jakarta", prov: "DKI Jakarta", adm4: "31.71.01.1001", xPct: 28.5, yPct: 71.5, region: "Jawa", labelPos: "top" },
  { name: "Bandung", prov: "Jawa Barat", adm4: "32.73.01.1001", xPct: 30.5, yPct: 74.0, region: "Jawa", labelPos: "bottom" },
  { name: "Semarang", prov: "Jawa Tengah", adm4: "33.74.01.1001", xPct: 34.5, yPct: 72.1, region: "Jawa", labelPos: "top" },
  { name: "Yogyakarta", prov: "D.I. Yogyakarta", adm4: "34.71.01.1001", xPct: 34.3, yPct: 76.2, region: "Jawa", labelPos: "bottom" },
  { name: "Surabaya", prov: "Jawa Timur", adm4: "35.78.01.1001", xPct: 39.2, yPct: 73.0, region: "Jawa", labelPos: "right" },

  // BALI & NUSA TENGGARA (3 Provinsi)
  { name: "Denpasar", prov: "Bali", adm4: "51.71.01.1001", xPct: 43.2, yPct: 76.4, region: "Bali & Nusa Tenggara", labelPos: "bottom" },
  { name: "Mataram", prov: "Nusa Tenggara Barat", adm4: "52.71.02.1001", xPct: 45.3, yPct: 77.5, region: "Bali & Nusa Tenggara", labelPos: "bottom" },
  { name: "Kupang", prov: "Nusa Tenggara Timur", adm4: "53.71.01.1001", xPct: 55.3, yPct: 83.2, region: "Bali & Nusa Tenggara", labelPos: "bottom" },

  // KALIMANTAN (5 Provinsi)
  { name: "Pontianak", prov: "Kalimantan Barat", adm4: "61.71.01.1002", xPct: 34.1, yPct: 42.4, region: "Kalimantan", labelPos: "left" },
  { name: "Palangka Raya", prov: "Kalimantan Tengah", adm4: "62.71.01.1001", xPct: 40.5, yPct: 47.1, region: "Kalimantan", labelPos: "top" },
  { name: "Banjarmasin", prov: "Kalimantan Selatan", adm4: "63.71.01.1001", xPct: 43.2, yPct: 53.5, region: "Kalimantan", labelPos: "bottom" },
  { name: "Samarinda", prov: "Kalimantan Timur", adm4: "64.72.01.1001", xPct: 47.8, yPct: 41.4, region: "Kalimantan", labelPos: "right" },
  { name: "Tanjung Selor", prov: "Kalimantan Utara", adm4: "65.01.01.1001", xPct: 47.5, yPct: 30.5, region: "Kalimantan", labelPos: "top" },

  // SULAWESI (6 Provinsi)
  { name: "Manado", prov: "Sulawesi Utara", adm4: "71.71.01.1001", xPct: 62.0, yPct: 27.5, region: "Sulawesi", labelPos: "right" },
  { name: "Gorontalo", prov: "Gorontalo", adm4: "75.71.01.1001", xPct: 57.2, yPct: 35.2, region: "Sulawesi", labelPos: "bottom" },
  { name: "Palu", prov: "Sulawesi Tengah", adm4: "72.71.02.1002", xPct: 53.5, yPct: 43.6, region: "Sulawesi", labelPos: "left" },
  { name: "Mamuju", prov: "Sulawesi Barat", adm4: "76.02.01.1002", xPct: 52.1, yPct: 52.1, region: "Sulawesi", labelPos: "left" },
  { name: "Makassar", prov: "Sulawesi Selatan", adm4: "73.71.01.1001", xPct: 53.2, yPct: 64.5, region: "Sulawesi", labelPos: "left" },
  { name: "Kendari", prov: "Sulawesi Tenggara", adm4: "74.71.03.1001", xPct: 58.4, yPct: 57.8, region: "Sulawesi", labelPos: "right" },

  // MALUKU (2 Provinsi)
  { name: "Ambon", prov: "Maluku", adm4: "81.71.01.2001", xPct: 70.8, yPct: 58.6, region: "Maluku", labelPos: "bottom" },
  { name: "Sofifi", prov: "Maluku Utara", adm4: "82.72.01.1001", xPct: 69.1, yPct: 35.7, region: "Maluku", labelPos: "right" },

  // PAPUA (6 Provinsi)
  { name: "Sorong", prov: "Papua Barat Daya", adm4: "96.71.01.1001", xPct: 77.5, yPct: 42.8, region: "Papua", labelPos: "left" },
  { name: "Manokwari", prov: "Papua Barat", adm4: "92.02.12.1001", xPct: 80.8, yPct: 41.5, region: "Papua", labelPos: "top" },
  { name: "Nabire", prov: "Papua Tengah", adm4: "94.01.01.1001", xPct: 85.3, yPct: 46.9, region: "Papua", labelPos: "bottom" },
  { name: "Jayapura", prov: "Papua", adm4: "91.71.01.1001", xPct: 91.0, yPct: 43.4, region: "Papua", labelPos: "top" },
  { name: "Wamena", prov: "Papua Pegunungan", adm4: "95.01.01.1001", xPct: 89.0, yPct: 53.5, region: "Papua", labelPos: "bottom" },
  { name: "Merauke", prov: "Papua Selatan", adm4: "93.01.01.2001", xPct: 92.5, yPct: 71.5, region: "Papua", labelPos: "bottom" }
];

let activeMapRegion = 'all';

function renderVectorMapPins() {
  const container = document.getElementById("map-station-pins");
  const tooltip = document.getElementById("map-hover-tooltip");
  const tooltipTitle = document.getElementById("map-tooltip-title");
  const tooltipDesc = document.getElementById("map-tooltip-desc");
  const tooltipTemp = document.getElementById("map-tooltip-temp");
  const tooltipWeather = document.getElementById("map-tooltip-weather");
  if (!container) return;

  container.style.pointerEvents = "auto";

  const html = MAP_CITY_PINS.map((city) => {
    const isActive = city.adm4 === STATE.currentAdm4;
    const temp = STATE.mapTemps && STATE.mapTemps[city.adm4];
    const tempStr =
      temp !== undefined && temp !== null ? Math.round(temp) + "°" : "...";

    const isDimmed = activeMapRegion !== 'all' && city.region !== activeMapRegion;
    const isHighlighted = activeMapRegion !== 'all' && city.region === activeMapRegion;

    const pinClass = [
      "map-city-pin",
      `label-${city.labelPos || 'bottom'}`,
      isActive ? "active" : "",
      isDimmed ? "dimmed" : "",
      isHighlighted ? "highlighted" : ""
    ].filter(Boolean).join(" ");

    const dotClass = "map-pin-dot" + (isActive ? " active" : "");
    const pinId = "map-pin-" + city.adm4.replace(/\./g, "_");
    const tempId = "map-temp-" + city.adm4.replace(/\./g, "_");

    return `<div class="${pinClass}" id="${pinId}"
        style="left:${city.xPct}%; top:${city.yPct}%;"
        data-adm4="${city.adm4}" 
        data-name="${city.name}"
        data-prov="${city.prov}"
        data-region="${city.region}"
        onclick="changeLocation('${city.adm4}')"
        role="button" tabindex="0" aria-label="Cuaca ${city.name}">
      <div class="${dotClass}"></div>
      <div class="map-pin-label">
        <span class="map-pin-city">${city.name}</span>
        <span class="map-pin-temp" id="${tempId}">${tempStr}</span>
      </div>
    </div>`;
  }).join("\n");

  container.innerHTML = html;

  container.querySelectorAll(".map-city-pin").forEach((pin) => {
    pin.addEventListener("mouseenter", () => {
      const name = pin.getAttribute("data-name");
      const prov = pin.getAttribute("data-prov");
      const adm4 = pin.getAttribute("data-adm4");
      const temp = STATE.mapTemps && STATE.mapTemps[adm4];
      const weather = (STATE.mapWeatherDesc && STATE.mapWeatherDesc[adm4]) || "Prakiraan Resmi BMKG";

      if (tooltipTitle) tooltipTitle.textContent = name;
      if (tooltipDesc) tooltipDesc.textContent = prov + " (Provinsi)";
      if (tooltipTemp) tooltipTemp.textContent = temp !== undefined && temp !== null ? Math.round(temp) + "°C" : "--°C";
      if (tooltipWeather) tooltipWeather.textContent = weather;

      const rect = pin.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      tooltip.style.left = rect.left - parentRect.left + rect.width / 2 + "px";
      tooltip.style.top = rect.top - parentRect.top + "px";
      tooltip.classList.remove("hidden");
    });
    pin.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.classList.add("hidden");
    });
    pin.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ")
        changeLocation(pin.getAttribute("data-adm4"));
    });
  });

  renderCapitalsQuickList();
}

// Filter Pulau / Region pada Peta
function filterMapRegion(region) {
  activeMapRegion = region;
  document.querySelectorAll(".map-filter-btn").forEach((btn) => {
    if (btn.getAttribute("data-region") === region) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderVectorMapPins();
}

// Render 38 Ibukota Provinsi Quick List Grid
function renderCapitalsQuickList() {
  const container = document.getElementById("capitals-quick-list");
  if (!container) return;

  const filtered = activeMapRegion === 'all'
    ? MAP_CITY_PINS
    : MAP_CITY_PINS.filter((c) => c.region === activeMapRegion);

  const counterEl = document.getElementById("map-station-count");
  if (counterEl) {
    counterEl.textContent = `${filtered.length} Provinsi (${activeMapRegion === 'all' ? 'Seluruh RI' : activeMapRegion})`;
  }

  container.innerHTML = filtered.map((c) => {
    const isActive = c.adm4 === STATE.currentAdm4;
    const temp = STATE.mapTemps && STATE.mapTemps[c.adm4];
    const tempStr = temp !== undefined && temp !== null ? Math.round(temp) + "°" : "...";
    const cardId = "capital-card-" + c.adm4.replace(/\./g, "_");

    return `
      <div class="capital-card ${isActive ? 'active' : ''}" id="${cardId}" onclick="changeLocation('${c.adm4}')" role="button" tabindex="0">
        <div class="min-w-0 pr-1">
          <p class="capital-card-name truncate">${c.name}</p>
          <p class="capital-card-prov truncate">${c.prov}</p>
        </div>
        <span class="capital-card-temp" id="list-temp-${c.adm4.replace(/\./g, '_')}">${tempStr}</span>
      </div>
    `;
  }).join("");
}

function highlightActiveMapPin(adm4) {
  document.querySelectorAll(".map-city-pin").forEach((pin) => {
    const dot = pin.querySelector(".map-pin-dot");
    if (pin.getAttribute("data-adm4") === adm4) {
      pin.classList.add("active");
      if (dot) dot.classList.add("active");
    } else {
      pin.classList.remove("active");
      if (dot) dot.classList.remove("active");
    }
  });

  document.querySelectorAll(".capital-card").forEach((card) => {
    const id = "capital-card-" + adm4.replace(/\./g, "_");
    if (card.id === id) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

// Preload Suhu Resmi untuk 38 Ibukota Provinsi (Optimized Fast Batch)
async function preloadMapTemperatures() {
  if (!STATE.mapTemps) STATE.mapTemps = {};
  if (!STATE.mapWeatherDesc) STATE.mapWeatherDesc = {};

  try {
    // Coba endpoint batch capitals yang sangat cepat
    const res = await fetch("/api/cuaca/capitals");
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach((item) => {
          if (item.temp !== undefined && item.temp !== null) {
            STATE.mapTemps[item.adm4] = item.temp;
            if (item.weatherDesc) STATE.mapWeatherDesc[item.adm4] = item.weatherDesc;

            const el = document.getElementById("map-temp-" + item.adm4.replace(/\./g, "_"));
            if (el) el.textContent = Math.round(item.temp) + "°";

            const listEl = document.getElementById("list-temp-" + item.adm4.replace(/\./g, "_"));
            if (listEl) listEl.textContent = Math.round(item.temp) + "°";
          }
        });
        return;
      }
    }
  } catch (e) {
    /* fallback to safe pool */
  }

  // Fallback safe concurrent fetch jika diperlukan
  const queue = [...MAP_CITY_PINS];
  const concurrency = 4;
  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const city = queue.shift();
      if (!city) break;
      try {
        const res = await fetch("/api/cuaca?adm4=" + encodeURIComponent(city.adm4));
        if (!res.ok) continue;
        const json = await res.json();
        if (json.success && json.current && json.current.t !== undefined) {
          STATE.mapTemps[city.adm4] = json.current.t;
          if (json.current.weather_desc) {
            STATE.mapWeatherDesc[city.adm4] = json.current.weather_desc;
          }
          const el = document.getElementById("map-temp-" + city.adm4.replace(/\./g, "_"));
          if (el) el.textContent = Math.round(json.current.t) + "°";

          const listEl = document.getElementById("list-temp-" + city.adm4.replace(/\./g, "_"));
          if (listEl) listEl.textContent = Math.round(json.current.t) + "°";
        }
      } catch (err) {}
    }
  });
  await Promise.all(workers);
}

// BMKG Live Earthquake Alert (Sintaks String Diperbaiki)
async function loadEarthquakeAlert() {
  try {
    const res = await fetch("/api/gempa");
    const json = await res.json();
    if (json.success && json.gempa) {
      STATE.gempaData = json.gempa;
      const g = json.gempa;

      const ticker = document.getElementById("gempa-ticker-text");
      if (ticker) {
        ticker.innerHTML = `<strong>BMKG GEMPA:</strong> M ${g.Magnitude} • ${g.Wilayah} • Kedalaman ${g.Kedalaman} (${g.Jam})`;
      }
    }
  } catch (e) {
    console.error("Gempa error:", e);
  }
}

// Show Earthquake Detail Modal (Sintaks String Diperbaiki)
function openGempaModal() {
  const g = STATE.gempaData;
  if (!g) {
    showToast("Data gempa terkini belum siap.");
    return;
  }

  const modal = document.getElementById("gempa-modal");
  document.getElementById("modal-gempa-mag").textContent = `M ${g.Magnitude}`;
  document.getElementById("modal-gempa-depth").textContent = g.Kedalaman;
  document.getElementById("modal-gempa-location").textContent = g.Wilayah;
  document.getElementById("modal-gempa-time").textContent =
    `${g.Tanggal} • ${g.Jam}`;
  document.getElementById("modal-gempa-potensi").textContent =
    g.Potensi || "Tidak berpotensi tsunami";
  document.getElementById("modal-gempa-dirasakan").textContent =
    g.Dirasakan || "Tidak ada laporan dirasakan";

  const shakemapImg = document.getElementById("modal-gempa-shakemap");
  if (g.shakemapUrl) {
    shakemapImg.src = g.shakemapUrl;
    shakemapImg.style.display = "block";
  } else {
    shakemapImg.style.display = "none";
  }

  modal.classList.remove("hidden");
}

function closeGempaModal() {
  const modal = document.getElementById("gempa-modal");
  if (modal) modal.classList.add("hidden");
}

// Geolocation
function detectUserLocation() {
  if (!navigator.geolocation) {
    showToast("Browser Anda tidak mendukung geolokasi");
    return;
  }

  showToast("Mendeteksi koordinat GPS Anda...");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(
          `/api/nearest?lat=${latitude}&lon=${longitude}`,
        );
        const json = await res.json();
        if (json.success && json.nearest) {
          showToast(
            `Lokasi terdekat: ${json.nearest.name} (${json.nearest.distanceKm} km)`,
          );
          changeLocation(json.nearest.adm4);
        } else {
          showToast("Tidak dapat menemukan kota terdekat");
        }
      } catch (e) {
        showToast("Gagal mencocokkan koordinat dengan database");
      }
    },
    (err) => {
      showToast("Izin akses lokasi ditolak. Silakan pilih kota manual.");
    },
    { timeout: 10000 },
  );
}

// Location Change Handler
function changeLocation(adm4) {
  STATE.currentAdm4 = adm4;
  fetchWeatherData(adm4);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Search Input Auto-complete (Sintaks String Diperbaiki)
function setupSearchInput() {
  const searchInput = document.getElementById("city-search-input");
  const dropdown = document.getElementById("search-dropdown");
  if (!searchInput || !dropdown) return;

  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim().toLowerCase();
    if (!val) {
      dropdown.classList.add("hidden");
      return;
    }

    const matches = STATE.wilayahList
      .filter(
        (w) =>
          w.name.toLowerCase().includes(val) ||
          w.provinsi.toLowerCase().includes(val) ||
          w.kotkab.toLowerCase().includes(val) ||
          w.adm4.includes(val),
      )
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div class="p-3 text-xs text-slate-400 text-center">
          Kota tidak ditemukan di daftar cepat.<br/>
          <span class="text-cyan-400">Tekan Enter untuk mencoba kode ADM4 manual.</span>
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    dropdown.innerHTML = matches
      .map(
        (m) => `
      <div onclick="selectSearchResult('${m.adm4}')" 
           class="p-2.5 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-none transition-colors">
        <div>
          <p class="text-xs font-bold text-white">${m.name}</p>
          <p class="text-[10px] text-slate-400">${m.provinsi} • ${m.kotkab}</p>
        </div>
        <span class="text-[10px] text-cyan-400 font-mono">${m.adm4}</span>
      </div>
    `,
      )
      .join("");

    dropdown.classList.remove("hidden");
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = searchInput.value.trim();
      if (/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/.test(val)) {
        dropdown.classList.add("hidden");
        changeLocation(val);
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });
}

function selectSearchResult(adm4) {
  const dropdown = document.getElementById("search-dropdown");
  const searchInput = document.getElementById("city-search-input");
  if (dropdown) dropdown.classList.add("hidden");
  if (searchInput) searchInput.value = "";
  changeLocation(adm4);
}

// Video Controls & Dimmer (Kalkulasi Perkalian Diperbaiki)
function setupVideoControls() {
  const video = document.getElementById("bg-video");
  const playBtn = document.getElementById("btn-toggle-video");
  const playLabel = document.getElementById("video-btn-label");
  const dimmerSlider = document.getElementById("video-dimmer-slider");
  const dimmerLabel = document.getElementById("label-dimmer-val");
  const dimmerLayer = document.getElementById("video-dimmer-layer");

  if (playBtn && video) {
    playBtn.addEventListener("click", () => {
      if (video.paused) {
        video.play();
        playLabel.textContent = "Jeda Video";
        STATE.videoPlaying = true;
      } else {
        video.pause();
        playLabel.textContent = "Putar Video";
        STATE.videoPlaying = false;
      }
    });
  }

  if (dimmerSlider && dimmerLayer) {
    dimmerSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      STATE.videoDimmer = val;
      if (dimmerLabel) dimmerLabel.textContent = `${Math.round(val * 100)}%`;
      dimmerLayer.style.background = `radial-gradient(circle at 50% 25%, rgba(4, 18, 30, ${val * 0.5}) 0%, rgba(2, 10, 18, ${val}) 100%)`;
    });
  }
}

// Audio Controls (Kalkulasi Perkalian Diperbaiki)
function setupAudioControls() {
  const audioBtn = document.getElementById("btn-toggle-audio");
  const audioLabel = document.getElementById("audio-btn-label");
  const audioSelect = document.getElementById("audio-mode-select");
  const volumeSlider = document.getElementById("audio-volume-slider");
  const volumeLabel = document.getElementById("label-volume-val");

  if (audioBtn) {
    audioBtn.addEventListener("click", () => {
      if (audioEngine.isPlaying) {
        audioEngine.stop();
        audioBtn.classList.remove("active");
        audioLabel.textContent = "Suara Alam: Nonaktif";
      } else {
        audioEngine.start(STATE.audioMode);
        audioBtn.classList.add("active");
        audioLabel.textContent = "Suara Alam: Aktif";
      }
    });
  }

  if (audioSelect) {
    audioSelect.addEventListener("change", (e) => {
      STATE.audioMode = e.target.value;
      if (audioEngine.isPlaying) {
        audioEngine.start(STATE.audioMode);
      }
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      STATE.audioVolume = val;
      if (volumeLabel) volumeLabel.textContent = `${Math.round(val * 100)}%`;
      audioEngine.setVolume(val);
    });
  }
}

// Toggle Temperature Unit
function toggleTemperatureUnit() {
  STATE.unit = STATE.unit === "C" ? "F" : "C";

  if (STATE.currentData) {
    renderHeroWeather(STATE.currentData);
    renderHourlyForecast(STATE.currentData);
    renderDailyCards(STATE.currentData);
    renderCharts(STATE.currentData);
  }
}

// Update Dynamic Atmospheric Effects
function updateAtmosphericEffects(data) {
  const current = data.current || {};
  if (atmosphere) {
    atmosphere.setMode(current.weather_desc);
  }

  const video = document.getElementById("bg-video");
  if (video) {
    const desc = (current.weather_desc || "").toLowerCase();
    if (desc.includes("hujan")) {
      video.style.filter =
        "brightness(0.75) contrast(1.15) saturate(0.85) hue-rotate(10deg)";
    } else if (desc.includes("cerah")) {
      video.style.filter = "brightness(1.05) contrast(1.05) saturate(1.15)";
    } else {
      video.style.filter = "brightness(0.88) contrast(1.0) saturate(0.95)";
    }
  }
}

// Toggle Dynamic Atmosphere FX
function toggleAtmosphereFX() {
  STATE.dynamicAtmosphere = !STATE.dynamicAtmosphere;
  const btn = document.getElementById("btn-toggle-atmosphere");
  if (btn) {
    if (STATE.dynamicAtmosphere) {
      btn.classList.add("active");
      btn.textContent = "Partikel: Aktif";
    } else {
      btn.classList.remove("active");
      btn.textContent = "Partikel: Nonaktif";
    }
  }
  if (atmosphere) atmosphere.initParticles();
}

// Helper: Format Temperature
function formatTemp(celsius) {
  if (celsius === undefined || celsius === null) return "--";
  if (STATE.unit === "F") {
    return Math.round((celsius * 9) / 5 + 32);
  }
  return Math.round(celsius);
}

// Loading & Toast Helpers
function showLoading(show) {
  const loader = document.getElementById("global-loader");
  if (loader) {
    if (show) loader.classList.remove("hidden");
    else loader.classList.add("hidden");
  }
}

function showToast(msg) {
  const toast = document.getElementById("toast-notification");
  const toastText = document.getElementById("toast-text");
  if (!toast || !toastText) return;
  toastText.textContent = msg;
  toast.classList.remove("translate-y-20", "opacity-0");
  setTimeout(() => {
    toast.classList.add("translate-y-20", "opacity-0");
  }, 3500);
}

// Print Weather Report
function printWeatherReport() {
  window.print();
}

// Global Event Listeners Setup
function setupEventListeners() {
  window.changeLocation = changeLocation;
  window.switchChartTab = switchChartTab;
  window.detectUserLocation = detectUserLocation;
  window.selectSearchResult = selectSearchResult;
  window.toggleTemperatureUnit = toggleTemperatureUnit;
  window.toggleAtmosphereFX = toggleAtmosphereFX;
  window.openGempaModal = openGempaModal;
  window.closeGempaModal = closeGempaModal;
  window.printWeatherReport = printWeatherReport;
}

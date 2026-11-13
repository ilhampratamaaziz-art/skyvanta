
function formatMarkdownReply(text) {
  if (!text) return "";
  let html = text;

  // Format Markdown tables
  const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, headerLine, bodyLines) => {
    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
    const rows = bodyLines.trim().split('\n').map(row =>
      row.split('|').map(c => c.trim()).filter(Boolean)
    );

    let tableHtml = '<div class="overflow-x-auto my-2 rounded-xl border border-slate-200/90 bg-white/80 shadow-sm"><table class="w-full text-left text-[11px] border-collapse">';
    tableHtml += '<thead class="bg-slate-100 text-slate-800"><tr>';
    headers.forEach(h => {
      tableHtml += `<th class="px-3 py-2 border-b border-slate-200 font-bold">${h}</th>`;
    });
    tableHtml += '</tr></thead><tbody class="divide-y divide-slate-100">';
    rows.forEach(r => {
      tableHtml += '<tr class="hover:bg-slate-50/80 transition-colors">';
      r.forEach((cell, idx) => {
        tableHtml += `<td class="px-3 py-2 text-slate-700 ${idx === 0 ? 'font-bold text-slate-900' : ''}">${cell}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table></div>';
    return tableHtml;
  });

  return html
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");
}

let activeWeatherAbortController = null;
// SKYVANTA - Official BMKG Weather Platform
// Developed for National Web Development Competition

// SINGLE SOURCE OF TRUTH FOR ACTIVE LOCATION
// Read by: Overview, Dashboard/Detail Cuaca, Dossier, Detail Visual Parametrik,
// Forecast, Regional, Weather Map, Curah Hujan, and AI Assistant.
const INITIAL_DEFAULT_ADM4 = "31.71.01.1001";
const savedInitialAdm4 = (typeof localStorage !== "undefined" && localStorage.getItem("skyvanta_active_adm4")) || INITIAL_DEFAULT_ADM4;

const STATE = {
  currentAdm4: savedInitialAdm4,
  activeLocation: {
    adm4: savedInitialAdm4,
    name: "Kota Adm. Jakarta Pusat",
    kotkab: "Kota Adm. Jakarta Pusat",
    kecamatan: "Gambir",
    provinsi: "DKI Jakarta",
    lat: -6.1754,
    lon: 106.8272,
    timezone: "WIB"
  },
  currentData: null,
  gempaData: null,
  gempaList: [],
  wilayahList: [],
  provinceList: [],
  selectedProvince: "all",
  searchHistory: [],
  mapTemps: {}, // Cache for map city temperatures
  mapWeatherDesc: {},
  mapDetails: {}, // Cache for complete map city details (humidity, wind, rain, risk)
  mapMode: "temp", // 'temp' or 'risk'
  regionalRisks: [],
  unit: "C", // 'C' or 'F'
  activeChartTab: "temp", // 'temp', 'rain', 'wind'
  chartInstance: null,
  audioPlaying: false,
  audioMode: "breeze", // 'breeze', 'rain', 'lake'
  audioVolume: 0.35,
  videoPlaying: true,
  dynamicAtmosphere: true,
  aiMessages: [],
  aiContextLocation: "Kota Adm. Jakarta Pusat",
  compareDataA: null,
  compareDataB: null,
  // Weather Analytics
  analyticsTab: "temp",
  analyticsPeriod: "all",
  analyticsData: null,
  analyticsCache: {},
  analyticsPinnedAdm4: null,
  analyticsChartInstance: null,
  compareCache: {},
  compareChartInstance: null,
  climateChartInstance: null,
  compareRequestId: 0,
};

window.STATE = STATE;
window.activeLocation = STATE.activeLocation;


// ============================================================
// NETWORK & TIMEOUT RESILIENCE UTILITIES (BMKG SYNCHRONIZATION)
// ============================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      const e = new Error(`Batas waktu koneksi BMKG (${timeoutMs / 1000}s) terlampaui`);
      e.isTimeout = true;
      throw e;
    }
    throw err;
  }
}

const STORAGE_WEATHER_PREFIX = "skyvanta_cache_cuaca_";

function saveWeatherToLocalCache(adm4, data) {
  try {
    const record = {
      data,
      timestamp: Date.now(),
      savedTimeStr: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    };
    localStorage.setItem(STORAGE_WEATHER_PREFIX + adm4, JSON.stringify(record));
  } catch (e) {
    console.warn("Gagal menyimpan cache cuaca ke localStorage:", e);
  }
}

function getWeatherFromLocalCache(adm4) {
  try {
    const raw = localStorage.getItem(STORAGE_WEATHER_PREFIX + adm4);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function renderHeroErrorState(adm4, errorMsg = "Gagal menghubungi BMKG") {
  const statusEl = document.getElementById("hero-status-pill");
  if (statusEl) {
    statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200/80 inline-flex items-center gap-1";
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 inline-block"></span> BMKG Offline`;
  }
  const lastUpdatedEl = document.getElementById("hero-last-updated");
  if (lastUpdatedEl) {
    lastUpdatedEl.innerHTML = `${errorMsg} · <button type="button" onclick="retryCurrentWeather()" class="text-sky-400 hover:text-sky-300 underline font-bold ml-1">Coba Lagi</button>`;
  }
  const heroDesc = document.getElementById("hero-weather-desc");
  if (heroDesc) {
    heroDesc.textContent = "Data Belum Tersedia";
  }
  const heroDescEn = document.getElementById("hero-weather-desc-en");
  if (heroDescEn) {
    heroDescEn.textContent = "Data Unavailable";
  }
}

let isRetryingWeather = false;
async function retryCurrentWeather() {
  if (isRetryingWeather) return;
  isRetryingWeather = true;
  showToast("Menghubungi server BMKG untuk sinkronisasi...");
  try {
    await fetchWeatherData(STATE.currentAdm4, true);
  } finally {
    setTimeout(() => { isRetryingWeather = false; }, 2000);
  }
}

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

// Initialize Application - Resilient & Non-Blocking Startup Flow
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Mount App Shell immediately
  try {
    atmosphere = new AtmosphereCanvas("atmosphere-canvas");
  } catch (e) {
    console.warn("Atmosphere canvas init:", e);
  }
  setupEventListeners();
  setupVideoControls();
  setupAudioControls();
  setupSearchInput();
    loadSearchHistory();
  startLiveClock();
  initSectionNav();
  initHourlyScrollbarSync();
  initScrollReveal();
  initHeroParallax();

  // Initialize active location titles & pills immediately
  window.activeLocation = STATE.activeLocation;
  syncAllTitles(STATE.activeLocation);
  renderQuickPills();

  // 2. Display smooth BMKG Sync Splash with hard watchdog safety
  showLoading(true, "Sinkronisasi BMKG", "Mengambil data meteorologi resmi...");

  // Safety timer: maximum 4.5 seconds on initial load so the user is NEVER blocked
  const startupWatchdog = setTimeout(() => {
    dismissLoader();
  }, 4500);

  // 3. Load services in parallel via Promise.allSettled (Partial Loading)
  try {
    await Promise.allSettled([
      fetchWeatherData(STATE.currentAdm4),
      loadWilayahDatabase(),
      loadProvinces(),
      loadRegionalRisks(),
      loadEarthquakeAlert()
    ]);
  } catch (err) {
    console.error("Critical error in parallel startup:", err);
  } finally {
    clearTimeout(startupWatchdog);
    dismissLoader();
  }

  // 4. Background tasks (Pre-load map pins & periodic TEWS refresh)
  preloadMapTemperatures();
  setInterval(loadEarthquakeAlert, 120000);
});


// Navigasi bagian: penanda aktif mengikuti posisi gulir
function initSectionNav() {
  const links = Array.from(document.querySelectorAll(".nav-link[href^='#']"));
  if (!links.length) return;

  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (!sections.length || typeof IntersectionObserver === "undefined") return;

  const setActive = (id) => {
    links.forEach((link) => {
      link.classList.toggle(
        "is-active",
        link.getAttribute("href") === "#" + id,
      );
    });
  };

  links.forEach((link) => {
    link.addEventListener("click", () => {
      setActive(link.getAttribute("href").slice(1));
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
  );

  sections.forEach((section) => observer.observe(section));
}


// ============================================================
// MOTION DESIGN & SCROLL REVEAL SYSTEM (GO GREEN INSPIRATION)
// ============================================================
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal-on-scroll');
  if (!elements.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        obs.unobserve(entry.target); // Reveal once without jarring re-animations
      }
    });
  }, {
    rootMargin: '0px 0px -40px 0px',
    threshold: 0.05
  });

  elements.forEach(el => observer.observe(el));
}

function initHeroParallax() {
  const heroBg = document.querySelector('.hero-bg-image');
  if (!heroBg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const heroHeight = window.innerHeight;
        if (scrollY < heroHeight * 1.3) {
          // Subtle, calibrated vertical parallax (22% rate)
          heroBg.style.transform = `translate3d(0, ${(scrollY * 0.22).toFixed(1)}px, 0)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// Indikator iklim harian dari prakiraan BMKG (bukan observasi historis)

// Grafik iklim harian: rentang suhu dan curah hujan dari prakiraan BMKG
function renderClimateChart(data) {
  const canvas = document.getElementById("climate-chart");
  if (!canvas || typeof Chart === "undefined") return;

  if (STATE.climateChartInstance) {
    STATE.climateChartInstance.destroy();
    STATE.climateChartInstance = null;
  }

  const forecast = (data && data.forecast) || [];
  const groups = {};
  forecast.forEach((f) => {
    const raw = String(f.local_datetime || f.datetime || "");
    const iso = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (!groups[iso]) groups[iso] = { min: Infinity, max: -Infinity, rain: 0 };
    const group = groups[iso];
    if (typeof f.t === "number") {
      group.min = Math.min(group.min, f.t);
      group.max = Math.max(group.max, f.t);
    }
    group.rain += f.tp || 0;
  });

  const isos = Object.keys(groups).sort();
  if (!isos.length) return;

  const labels = isos.map((iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  });

  const mins = isos.map((iso) =>
    groups[iso].min === Infinity ? null : tempForUnit(groups[iso].min),
  );
  const maxs = isos.map((iso) =>
    groups[iso].max === -Infinity ? null : tempForUnit(groups[iso].max),
  );
  const rains = isos.map((iso) => Math.round(groups[iso].rain * 10) / 10);

  STATE.climateChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Suhu maksimum (°${STATE.unit})`,
          data: maxs,
          borderColor: "#f5c451",
          backgroundColor: "rgba(245, 196, 81, 0.16)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          fill: "+1",
          yAxisID: "y",
        },
        {
          label: `Suhu minimum (°${STATE.unit})`,
          data: mins,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.12)",
          borderWidth: 2,
          tension: 0.35,
          pointRadius: 3,
          fill: false,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Curah hujan (mm)",
          data: rains,
          backgroundColor: "rgba(96, 165, 250, 0.35)",
          borderColor: "rgba(96, 165, 250, 0.6)",
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.45,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#b9c9de",
            font: { family: "Plus Jakarta Sans", size: 11, weight: "500" },
            boxWidth: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "rgba(5, 15, 33, 0.96)",
          titleColor: "#f2f7ff",
          bodyColor: "#c8d6e8",
          borderColor: "rgba(148, 178, 214, 0.25)",
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#8aa0ba", font: { size: 10 } },
        },
        y: {
          grid: { color: "rgba(148, 178, 214, 0.08)" },
          ticks: { color: "#8aa0ba", font: { size: 10 } },
        },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "#8aa0ba", font: { size: 10 } },
          suggestedMax: Math.max(10, ...rains),
        },
      },
    },
  });
}

function renderClimateIndicators(data) {
  const ids = [
    "climate-temp-range",
    "climate-rain-hours",
    "climate-humidity",
    "climate-comfort",
    "climate-wind",
  ];
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const forecast = (data && data.forecast) || [];

  if (!forecast.length) {
    ids.forEach((id) => set(id, "Data tidak tersedia"));
    renderClimateChart(null);
    set(
      "climate-source-note",
      "Prakiraan BMKG belum tersedia untuk lokasi ini, sehingga indikator tidak dapat dihitung.",
    );
    return;
  }

  const temps = forecast.map((f) => f.t).filter((v) => typeof v === "number");
  const rains = forecast.map((f) => f.tp || 0);
  const humidities = forecast
    .map((f) => f.hu)
    .filter((v) => typeof v === "number");
  const winds = forecast.map((f) => f.ws).filter((v) => typeof v === "number");
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  if (temps.length) {
    set(
      "climate-temp-range",
      `${Math.round(tempForUnit(Math.min(...temps)))}°–${Math.round(tempForUnit(Math.max(...temps)))}°${STATE.unit}`,
    );
  } else {
    set("climate-temp-range", "Data tidak tersedia");
  }

  set(
    "climate-rain-hours",
    `${rains.filter((v) => v > 0).length} dari ${forecast.length} titik`,
  );
  set(
    "climate-humidity",
    humidities.length ? `${Math.round(avg(humidities))}%` : "Data tidak tersedia",
  );

  const comfortAvg =
    forecast.reduce(
      (sum, f) => sum + calculateComfortIndex(f.t, f.hu || 0, f.ws || 0),
      0,
    ) / forecast.length;
  set("climate-comfort", `${Math.round(comfortAvg * 10) / 10}/10`);
  set(
    "climate-wind",
    winds.length ? `${Math.round(avg(winds) * 10) / 10} km/j` : "Data tidak tersedia",
  );

  const lok = (data.lokasi || {}).kotkab || (data.lokasi || {}).desa || "lokasi aktif";
  set(
    "climate-source-note",
    `Sumber: prakiraan BMKG • ${lok} • ${data.lastUpdatedFormatted || "--"}. Dihitung dari ${forecast.length} titik prakiraan 3-jam; bukan observasi historis.`,
  );

  renderClimateChart(data);
}

// Load Wilayah Database
async function loadWilayahDatabase() {
  try {
    const res = await fetchWithTimeout("/api/wilayah", {}, 6000);
    const json = await res.json();
    if (json.success) {
      STATE.wilayahList = json.data;
      const regionCount = document.getElementById("impact-region-count");
      if (regionCount) regionCount.textContent = String(json.data.length);

      // Sync activeLocation name if match found
      if (STATE.activeLocation && STATE.activeLocation.adm4) {
        const found = json.data.find((w) => w.adm4 === STATE.activeLocation.adm4);
        if (found) {
          STATE.activeLocation = {
            ...STATE.activeLocation,
            name: found.name || found.kotkab || STATE.activeLocation.name,
            kotkab: found.kotkab || STATE.activeLocation.kotkab,
            provinsi: found.provinsi || STATE.activeLocation.provinsi,
          };
          window.activeLocation = STATE.activeLocation;
          syncAllTitles(STATE.activeLocation);
        }
      }

      renderQuickPills();
      renderVectorMapPins();
    }
  } catch (e) {
    console.error("Error loading wilayah:", e);
  }
}

// Load Provinces List
async function loadProvinces() {
  try {
    const res = await fetchWithTimeout("/api/provinsi", {}, 6000);
    const json = await res.json();
    if (json.success && json.data) {
      STATE.provinceList = json.data;
      const select = document.getElementById("province-filter-select");
      if (select) {
        select.innerHTML =
          `<option value="all" class="bg-white text-slate-800">Semua Provinsi (${json.total})</option>` +
          json.data
            .map(
              (p) =>
                `<option value="${p.name}" class="bg-white text-slate-800">${p.name} (${p.count})</option>`,
            )
            .join("");
      }
    }
  } catch (e) {
    console.error("Error loading provinces:", e);
  }
}

// Filter by Province
function filterByProvince(prov) {
  STATE.selectedProvince = prov;
  const container = document.getElementById("quick-pills-container");
  if (!container) return;

  if (prov === "all") {
    renderQuickPills();
  } else {
    const filtered = STATE.wilayahList.filter(
      (w) => w.provinsi.toLowerCase() === prov.toLowerCase(),
    );
    container.innerHTML = filtered
      .map(
        (w) => `
      <button onclick="changeLocation('${w.adm4}')" 
        class="glass-pill px-3 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 ${w.adm4 === STATE.currentAdm4 ? "active" : ""}">
        ${w.name}
      </button>
    `,
      )
      .join("");

    if (
      filtered.length > 0 &&
      !filtered.some((w) => w.adm4 === STATE.currentAdm4)
    ) {
      changeLocation(filtered[0].adm4);
    }
  }
}

// Search History (LocalStorage)
function loadSearchHistory() {
  try {
    const saved = localStorage.getItem("skyvanta_history");
    if (saved) {
      STATE.searchHistory = JSON.parse(saved);
      renderSearchHistory();
    }
  } catch (e) {}
}

function saveToSearchHistory(adm4, name, prov) {
  if (!adm4 || !name) return;
  STATE.searchHistory = STATE.searchHistory.filter((item) => item.adm4 !== adm4);
  STATE.searchHistory.unshift({ adm4, name, prov });
  if (STATE.searchHistory.length > 6) STATE.searchHistory.pop();
  try {
    localStorage.setItem("skyvanta_history", JSON.stringify(STATE.searchHistory));
  } catch (e) {}
  renderSearchHistory();
}

function renderSearchHistory() {
  const bar = document.getElementById("recent-searches-bar");
  const chips = document.getElementById("recent-searches-chips");
  if (!bar || !chips) return;

  if (STATE.searchHistory.length === 0) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  chips.innerHTML = STATE.searchHistory
    .map(
      (item) => `
    <button onclick="changeLocation('${item.adm4}')" 
      class="glass-pill px-2.5 py-0.5 text-[11px] text-cyan-200 hover:text-white flex items-center space-x-1 whitespace-nowrap bg-white/[0.04]">
      <span>${item.name}</span>
    </button>
  `,
    )
    .join("");
}

function clearSearchHistory() {
  STATE.searchHistory = [];
  localStorage.removeItem("skyvanta_history");
  renderSearchHistory();
  showToast("Riwayat pencarian telah dibersihkan.");
}

// ============================================================
// SINGLE SOURCE OF TRUTH (activeLocation) & SYNCHRONIZATION ENGINE
// ============================================================

function getActiveLocation() {
  return STATE.activeLocation;
}
window.getActiveLocation = getActiveLocation;

function resolveLocationMeta(adm4, hint = null) {
  if (adm4 === "null") adm4 = null;

  if (hint && (hint.name || hint.kotkab)) {
    return {
      adm4: adm4 || hint.adm4 || null,
      name: hint.name || hint.kotkab || hint.desa || "Wilayah",
      kotkab: hint.kotkab || hint.name || "",
      kecamatan: hint.kecamatan || "",
      desa: hint.desa || "",
      provinsi: hint.provinsi || hint.prov || "",
      lat: hint.lat,
      lon: hint.lon,
      timezone: hint.timezone || "WIB"
    };
  }

  if (STATE.wilayahList && STATE.wilayahList.length) {
    const match = STATE.wilayahList.find(w => w.adm4 === adm4);
    if (match) {
      return {
        adm4: match.adm4,
        name: match.name || match.kotkab || "Wilayah",
        kotkab: match.kotkab || match.name || "",
        kecamatan: match.kecamatan || "",
        desa: match.desa || "",
        provinsi: match.provinsi || "",
        lat: match.lat,
        lon: match.lon,
        timezone: match.timezone || "WIB"
      };
    }
  }

  if (typeof getLocation === "function") {
    const loc = getLocation(adm4);
    if (loc) return { ...loc };
  }

  if (typeof MAP_CITY_PINS !== "undefined" && Array.isArray(MAP_CITY_PINS)) {
    const pin = MAP_CITY_PINS.find(p => p.adm4 === adm4);
    if (pin) {
      return {
        adm4: pin.adm4,
        name: pin.name,
        kotkab: pin.name,
        kecamatan: "",
        desa: "",
        provinsi: pin.prov || pin.region || "",
        lat: pin.lat,
        lon: pin.lon,
        timezone: "WIB"
      };
    }
  }

  const cached = getWeatherFromLocalCache(adm4);
  if (cached && cached.data && cached.data.lokasi) {
    const lok = cached.data.lokasi;
    return {
      adm4,
      name: lok.kotkab || lok.desa || "Wilayah",
      kotkab: lok.kotkab || "",
      kecamatan: lok.kecamatan || "",
      desa: lok.desa || "",
      provinsi: lok.provinsi || "",
      lat: lok.lat,
      lon: lok.lon,
      timezone: lok.timezone || "WIB"
    };
  }

  if (adm4 === "31.71.01.1001") {
    return {
      adm4: "31.71.01.1001",
      name: "Kota Adm. Jakarta Pusat",
      kotkab: "Kota Adm. Jakarta Pusat",
      kecamatan: "Gambir",
      provinsi: "DKI Jakarta",
      lat: -6.1754,
      lon: 106.8272,
      timezone: "WIB"
    };
  }

  return {
    adm4,
    name: STATE.activeLocation?.adm4 === adm4 ? STATE.activeLocation.name : `Wilayah (${adm4})`,
    kotkab: "",
    kecamatan: "",
    desa: "",
    provinsi: "",
    timezone: "WIB"
  };
}
window.resolveLocationMeta = resolveLocationMeta;

function setActiveLocation(adm4, meta = null) {
  if (adm4 === "null") adm4 = null;
  const resolved = resolveLocationMeta(adm4, meta);
  STATE.activeLocation = resolved;
  STATE.currentAdm4 = adm4;
  window.activeLocation = resolved;
  try {
    if (adm4) {
      localStorage.setItem("skyvanta_active_adm4", adm4);
    } else {
      localStorage.removeItem("skyvanta_active_adm4");
    }
  } catch (e) {}

  syncAllTitles(resolved);
  return resolved;
}
window.setActiveLocation = setActiveLocation;

function syncAllTitles(loc) {
  if (!loc) loc = STATE.activeLocation;
  if (!loc) return;
  const locName = loc.name || loc.kotkab || loc.desa || "Wilayah";

  // 1. Overview Card City
  const ovCity = document.getElementById("overview-card-city");
  if (ovCity) ovCity.textContent = locName;

  // 2. Dashboard Titles
  const heroCity = document.getElementById("hero-city-title");
  if (heroCity) heroCity.textContent = loc.kotkab || locName;
  const heroSub = document.getElementById("hero-province-subtitle");
  if (heroSub) {
    heroSub.textContent = `${loc.kecamatan ? loc.kecamatan + ", " : ""}${loc.provinsi || ""} · Kode ADM4: ${loc.adm4 || ""}`;
  }
  const heroRight = document.getElementById("hero-right-city");
  if (heroRight) heroRight.textContent = locName;

  // 3. Dossier Titles
  const dossierTitle = document.getElementById("modal-detail-title");
  if (dossierTitle) dossierTitle.textContent = `Dossier Cuaca: ${locName}`;
  const dossierSub = document.getElementById("modal-detail-subtitle");
  if (dossierSub) {
    dossierSub.textContent = `${loc.kecamatan ? loc.kecamatan + ", " : ""}${loc.provinsi || ""} • Kode ADM4: ${loc.adm4 || ""}`;
  }

  // 4. Detail Visual Parametrik
  const paramTitle = document.getElementById("parametric-chart-title");
  if (paramTitle) paramTitle.textContent = `Grafik Analisis Parametrik BMKG - ${locName}`;

  // 5. Forecast Titles
  const fcast72 = document.getElementById("forecast-page-title");
  if (fcast72) fcast72.textContent = `Prakiraan Cuaca 72 Jam Terperinci - ${locName}`;
  const fcast3d = document.getElementById("forecast-3day-title");
  if (fcast3d) fcast3d.textContent = `Prakiraan Cuaca 3 Hari - ${locName}`;

  // 6. Regional / Map Titles
  const mapTitle = document.getElementById("map-page-title");
  if (mapTitle) mapTitle.textContent = `Peta Cuaca Interaktif Indonesia - ${locName}`;
  const mapSub = document.getElementById("map-page-subtitle");
  if (mapSub) mapSub.textContent = `Lokasi Aktif: ${locName} · 38 Stasiun Meteorologi Ibukota Provinsi`;

  // 7. Curah Hujan Titles
  const rainTitle = document.getElementById("rainfall-page-title");
  if (rainTitle) rainTitle.textContent = `Peta Interaktif Curah Hujan Indonesia - ${locName}`;
  const rainCity = document.getElementById("rainfall-active-city");
  if (rainCity) rainCity.textContent = locName;

  // 8. AI Assistant Subtitle & Chips
  const aiSub = document.getElementById("ai-active-subtitle");
  if (aiSub) aiSub.textContent = `Asisten Meteorologi Cerdas · Lokasi Aktif: ${locName}`;
  updateAIPromptChips(locName);

  // 9. Comparison Sync (Titik A always reflects activeLocation)
  if (typeof currentCompareA !== "undefined") {
    currentCompareA = loc.adm4;
    const chipAName = document.getElementById("chip-a-name");
    if (chipAName) chipAName.textContent = locName;
    const chipAProv = document.getElementById("chip-a-prov");
    if (chipAProv) chipAProv.textContent = `${loc.provinsi || ""} · ADM4: ${loc.adm4}`;
  }
}
window.syncAllTitles = syncAllTitles;

function updateAIPromptChips(locName) {
  const container = document.getElementById("ai-quick-chips");
  if (!container) return;
  container.innerHTML = `
    <button onclick="askAIPrompt('Bagaimana cuaca di ${locName.replace(/'/g, "\\'")} sekarang?')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">📍 Cuaca ${locName}</button>
    <button onclick="askAIPrompt('Apakah di ${locName.replace(/'/g, "\\'")} berpotensi hujan dalam 24 jam ke depan?')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">🌧️ Potensi Hujan</button>
    <button onclick="askAIPrompt('Rekomendasi pakaian dan aktivitas yang pas untuk cuaca di ${locName.replace(/'/g, "\\'")}?')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">👕 Rekomendasi ${locName}</button>
    <button onclick="askAIPrompt('Bandingkan cuaca di ${locName.replace(/'/g, "\\'")} dengan wilayah lainnya.')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">⚖️ Komparasi Wilayah</button>
    <button onclick="askAIPrompt('Kota mana yang memiliki suhu tertinggi berdasarkan data BMKG saat ini?')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">🔥 Suhu Tertinggi RI</button>
    <button onclick="askAIPrompt('Bagaimana kondisi gempa bumi BMKG terbaru?')" class="liquid-glass-pill text-[10px] whitespace-nowrap cursor-pointer">🚨 Gempa BMKG</button>
  `;
}
window.updateAIPromptChips = updateAIPromptChips;

function renderOverviewCard(data, isUnavailable = false) {
  const loc = STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Indonesia";

  const cityEl = document.getElementById("overview-card-city");
  if (cityEl) cityEl.textContent = locName;

  const badgeEl = document.getElementById("overview-card-badge");
  const tempEl = document.getElementById("overview-card-temp");
  const descEl = document.getElementById("overview-card-desc");
  const iconEl = document.getElementById("overview-card-icon");
  const windEl = document.getElementById("overview-card-wind");
  const huEl = document.getElementById("overview-card-hu");
  const precipEl = document.getElementById("overview-card-precip");

  if (isUnavailable || !data || !data.current || data.isUnavailable) {
    if (badgeEl) {
      badgeEl.className = "text-[10px] text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200";
      badgeEl.textContent = "Data Belum Tersedia";
    }
    if (tempEl) tempEl.textContent = "--°" + STATE.unit;
    if (descEl) descEl.textContent = `Data belum tersedia untuk ${locName}`;
    if (iconEl) {
      iconEl.src = "icons/berawan.svg";
      iconEl.alt = "";
    }
    if (windEl) windEl.textContent = "--";
    if (huEl) huEl.textContent = "--";
    if (precipEl) precipEl.textContent = "--";
    return;
  }

  const cur = data.current;
  if (badgeEl) {
    badgeEl.className = "text-[10px] text-sky-700 font-mono bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200";
    badgeEl.textContent = data.fromCache ? "BMKG Tersimpan" : "BMKG Live";
  }
  if (tempEl) tempEl.textContent = `${formatTemp(cur.t)}°${STATE.unit}`;
  if (descEl) descEl.textContent = cur.weather_desc || "Cerah Berawan";
  if (iconEl) {
    const iconSrc = typeof getWeatherIcon === "function"
      ? getWeatherIcon(cur.weather_desc, cur.weather)
      : "icons/berawan.svg";
    iconEl.src = iconSrc;
    iconEl.alt = "";
    iconEl.onerror = function () {
      this.onerror = null;
      this.src = "icons/berawan.svg";
    };
  }
  if (windEl) windEl.textContent = `${cur.ws || 0} km/j`;
  if (huEl) huEl.textContent = `${cur.hu || 0}%`;
  if (precipEl) precipEl.textContent = `${cur.tp || 0} mm`;
}
window.renderOverviewCard = renderOverviewCard;

function renderHeroUnavailableState(locName) {
  const cityTitle = document.getElementById("hero-city-title");
  if (cityTitle) cityTitle.textContent = locName;
  const rightCity = document.getElementById("hero-right-city");
  if (rightCity) rightCity.textContent = locName;
  const desc = document.getElementById("hero-weather-desc");
  if (desc) desc.textContent = `Data belum tersedia untuk ${locName}`;
  const descEn = document.getElementById("hero-weather-desc-en");
  if (descEn) descEn.textContent = `Data unavailable for ${locName}`;
  const temp = document.getElementById("hero-temp");
  if (temp) temp.textContent = "--";
  const feels = document.getElementById("hero-feels-like");
  if (feels) feels.textContent = `Data belum tersedia untuk ${locName}`;
  const range = document.getElementById("hero-temp-range");
  if (range) range.textContent = "Min --° / Maks --°";
  const wind = document.getElementById("metric-wind-speed");
  if (wind) wind.textContent = "-- km/j";
  const hu = document.getElementById("metric-humidity");
  if (hu) hu.textContent = "--%";
  const precip = document.getElementById("metric-precip");
  if (precip) precip.textContent = "-- mm";
  const iconImg = document.getElementById("hero-weather-icon");
  if (iconImg) {
    iconImg.src = "icons/berawan.svg";
    iconImg.alt = "";
  }
  const hrIcon = document.getElementById("hero-right-icon");
  if (hrIcon) {
    hrIcon.src = "icons/berawan.svg";
    hrIcon.alt = "";
  }
  const statusEl = document.getElementById("hero-status-pill");
  if (statusEl) {
    statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1";
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 inline-block"></span> Data Belum Tersedia`;
  }
  const narrative = document.getElementById("hero-editorial-narrative");
  if (narrative) narrative.textContent = `Data prakiraan cuaca resmi BMKG belum tersedia untuk ${locName}.`;
  const fRow = document.getElementById("aurora-forecast-row");
  if (fRow) fRow.innerHTML = `<div class="p-6 text-center text-slate-500 font-medium w-full text-xs">Data belum tersedia untuk ${locName}</div>`;
  const curveCanvas = document.getElementById("aurora-curve-canvas");
  if (curveCanvas) {
    const ctx = curveCanvas.getContext("2d");
    ctx.clearRect(0, 0, curveCanvas.width, curveCanvas.height);
  }
  const insight = document.getElementById("weather-insight-narrative");
  if (insight) insight.textContent = `Analisis cuaca belum tersedia untuk ${locName}.`;
  const recs = document.getElementById("activity-recommendations-list");
  if (recs) recs.innerHTML = `<div class="col-span-2 p-4 text-center text-slate-500 font-medium text-xs">Data rekomendasi belum tersedia untuk ${locName}</div>`;
  const daily = document.getElementById("daily-cards-container");
  if (daily) daily.innerHTML = `<div class="p-4 text-center text-slate-500 font-medium text-xs">Data belum tersedia untuk ${locName}</div>`;
}

function renderDossierUnavailableState(locName) {
  const title = document.getElementById("modal-detail-title");
  if (title) title.textContent = `Dossier Cuaca: ${locName}`;
  const sub = document.getElementById("modal-detail-subtitle");
  if (sub) sub.textContent = `${STATE.activeLocation?.provinsi || ""} • Kode ADM4: ${STATE.activeLocation?.adm4 || ""}`;
  const metrics = document.getElementById("modal-detail-metrics");
  if (metrics) metrics.innerHTML = `<div class="col-span-full p-8 text-center text-slate-500 font-medium bg-white/70 rounded-2xl border border-slate-200/80">Data belum tersedia untuk ${locName}</div>`;
  const tbody = document.getElementById("modal-detail-forecast-tbody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500 font-medium">Data belum tersedia untuk ${locName}</td></tr>`;
}

function renderChartsUnavailableState(locName) {
  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
    STATE.chartInstance = null;
  }
  const ctx = document.getElementById("weather-chart");
  if (ctx && ctx.parentElement) {
    let placeholder = document.getElementById("weather-chart-placeholder");
    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.id = "weather-chart-placeholder";
      placeholder.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-medium text-xs p-4 text-center pointer-events-none";
      ctx.parentElement.style.position = "relative";
      ctx.parentElement.appendChild(placeholder);
    }
    placeholder.textContent = `Data grafik belum tersedia untuk ${locName}`;
    placeholder.style.display = "flex";
  }
}

function renderForecastUnavailableState(locName) {
  const carousel = document.getElementById("hourly-carousel");
  if (carousel) {
    carousel.innerHTML = `<div class="p-8 text-center text-slate-500 font-medium w-full text-xs">Data belum tersedia untuk ${locName}</div>`;
  }
  const weekly = document.getElementById("weekly-forecast-grid");
  if (weekly) {
    weekly.innerHTML = `<div class="p-8 text-center text-slate-500 font-medium col-span-full text-xs">Data belum tersedia untuk ${locName}</div>`;
  }
}

function renderRainfallUnavailableState(locName) {
  if (typeof rainfallChartInstance !== "undefined" && rainfallChartInstance) {
    rainfallChartInstance.destroy();
    rainfallChartInstance = null;
  }
  const city = document.getElementById("rainfall-active-city");
  if (city) city.textContent = locName;
  const current = document.getElementById("rainfall-stat-current");
  if (current) current.textContent = "-- mm";
  const status = document.getElementById("rainfall-stat-status");
  if (status) status.textContent = `Data belum tersedia untuk ${locName}`;
  const canvas = document.getElementById("rainfall-chart-canvas");
  if (canvas && canvas.parentElement) {
    let placeholder = document.getElementById("rainfall-chart-placeholder");
    if (!placeholder) {
      placeholder = document.createElement("div");
      placeholder.id = "rainfall-chart-placeholder";
      placeholder.className = "absolute inset-0 flex items-center justify-center text-slate-500 font-medium text-xs p-4 text-center pointer-events-none";
      canvas.parentElement.style.position = "relative";
      canvas.parentElement.appendChild(placeholder);
    }
    placeholder.textContent = `Data curah hujan belum tersedia untuk ${locName}`;
    placeholder.style.display = "flex";
  }
}

let isInitialLocationSync = true;

function syncAllComponentsToActiveLocation(data, isUnavailable = false) {
  const loc = STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Wilayah";

  syncAllTitles(loc);

  const shouldFlyMap = !isInitialLocationSync;
  isInitialLocationSync = false;

  if (isUnavailable || !data || !data.current || data.isUnavailable) {
    renderOverviewCard(null, true);
    renderHeroUnavailableState(locName);
    renderDossierUnavailableState(locName);
    renderChartsUnavailableState(locName);
    renderForecastUnavailableState(locName);
    if (typeof renderAuroraSideCities === "function") renderAuroraSideCities();
    highlightActiveMapPin(loc.adm4, shouldFlyMap);
    renderRainfallUnavailableState(locName);
    STATE.aiContextLocation = locName;
    renderQuickPills();
    return;
  }

  // --- DATA AVAILABLE ---
  const chartPlaceholder = document.getElementById("weather-chart-placeholder");
  if (chartPlaceholder) chartPlaceholder.style.display = "none";
  const rainPlaceholder = document.getElementById("rainfall-chart-placeholder");
  if (rainPlaceholder) rainPlaceholder.style.display = "none";

  renderOverviewCard(data, false);
  renderHeroWeather(data);
  renderSmartAlerts(data.smartAlerts || []);
  renderWeatherInsight(data.weatherInsight, data);
  renderActivityRecommendations(data.weatherInsight?.recommendations || {});
  renderHourlyForecast(data);
  renderDailyCards(data);
  renderCharts(data);
  highlightActiveMapPin(loc.adm4, shouldFlyMap);
  if (typeof renderAuroraMiniChart === "function") renderAuroraMiniChart();
  if (typeof renderAuroraSideCities === "function") renderAuroraSideCities();
  if (typeof openCityDetailModalInline === "function") openCityDetailModalInline();
  if (typeof renderRainfallChart === "function") renderRainfallChart();
  STATE.aiContextLocation = locName;
  renderQuickPills();
}
window.syncAllComponentsToActiveLocation = syncAllComponentsToActiveLocation;

// Render Quick Location Pills
function renderQuickPills() {
  const container = document.getElementById("quick-pills-container");
  if (!container) return;

  const currentAdm = STATE.activeLocation?.adm4 || STATE.currentAdm4;
  const popular = [
    { name: "Jakarta Pusat", code: "31.71.01.1001" },
    { name: "Surabaya", code: "35.78.01.1001" },
    { name: "Bandung", code: "32.73.01.1001" },
    { name: "Kota Balikpapan", code: "64.71.01.1001" },
    { name: "Denpasar (Bali)", code: "51.71.01.1001" },
    { name: "Medan", code: "12.71.01.1001" },
    { name: "Makassar", code: "73.71.01.1001" },
    { name: "Yogyakarta", code: "34.71.01.1001" },
    { name: "Semarang", code: "33.74.01.1001" },
    { name: "Jayapura", code: "91.71.01.1001" },
  ];

  let pills = [...popular];
  if (STATE.activeLocation && !popular.some(p => p.code === currentAdm)) {
    pills = [{ name: STATE.activeLocation.name, code: currentAdm }, ...popular];
  }

  container.innerHTML = pills
    .map(
      (p) => `
    <button onclick="changeLocation('${p.code}', { name: '${p.name.replace(/'/g, "\\'")}' })" 
      class="glass-pill px-3.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-200 hover:scale-105 ${p.code === currentAdm ? "active" : ""}">
      ${p.name}
    </button>
  `,
    )
    .join("");
}

// Refresh Data Handler (Bypasses Cache)
async function refreshWeatherData() {
  const spinIcon = document.getElementById("refresh-spin-icon");
  const heroSpinIcon = document.getElementById("hero-spin-icon");
  if (spinIcon) spinIcon.classList.add("animate-spin");
  if (heroSpinIcon) heroSpinIcon.classList.add("animate-spin");

  showToast("Menghubungi server BMKG untuk sinkronisasi data mutakhir...");
  await fetchWeatherData(STATE.currentAdm4, true);

  setTimeout(() => {
    if (spinIcon) spinIcon.classList.remove("animate-spin");
    if (heroSpinIcon) heroSpinIcon.classList.remove("animate-spin");
    showToast("✓ Data cuaca berhasil diperbarui!");
  }, 600);
}

// Fetch Official Weather Data from BMKG API (With Timeout, Cache & Fallback)
async function fetchWeatherData(adm4, forceRefresh = false) {
  // Cancel previous in-flight request if user rapidly changed location
  if (activeWeatherAbortController) {
    try { activeWeatherAbortController.abort(); } catch (e) {}
  }
  activeWeatherAbortController = new AbortController();

  if (adm4 === "null") adm4 = null;
  const activeLoc = setActiveLocation(adm4);

  if (!adm4) {
    STATE.currentData = {
      success: false,
      isUnavailable: true,
      lokasi: activeLoc,
      current: null
    };
    STATE.currentAdm4 = null;
    showLoading(false);
    syncAllComponentsToActiveLocation(null, true);
    showToast(`Data belum tersedia untuk ${activeLoc.name}`);
    return;
  }

  showLoading(true, "Sinkronisasi BMKG", `Mengambil data cuaca untuk ${activeLoc.name}...`);
  let loadedSuccessfully = false;

  try {
    const url = forceRefresh
      ? `/api/cuaca?adm4=${encodeURIComponent(adm4)}&refresh=1`
      : `/api/cuaca?adm4=${encodeURIComponent(adm4)}`;

    const res = await fetch(url, { signal: activeWeatherAbortController.signal });
    const json = await res.json();

    if (json.success && json.current) {
      STATE.currentData = json;
      STATE.currentAdm4 = adm4;
      if (json.lokasi) {
        STATE.activeLocation = {
          ...STATE.activeLocation,
          adm4: json.lokasi.adm4 || adm4,
          name: json.lokasi.kotkab || json.lokasi.desa || STATE.activeLocation.name || "Indonesia",
          kotkab: json.lokasi.kotkab || json.lokasi.desa || "",
          kecamatan: json.lokasi.kecamatan || "",
          desa: json.lokasi.desa || "",
          provinsi: json.lokasi.provinsi || "",
          lat: json.lokasi.lat,
          lon: json.lokasi.lon,
          timezone: json.lokasi.timezone || "WIB"
        };
        window.activeLocation = STATE.activeLocation;
      }
      saveWeatherToLocalCache(adm4, json);
      if (!STATE.mapDetails) STATE.mapDetails = {};
      STATE.mapDetails[adm4] = {
        temp: json.current.t,
        weatherDesc: json.current.weather_desc,
        humidity: json.current.hu,
        windSpeed: json.current.ws,
        windDir: json.current.wd,
        precipitation: json.current.tp !== undefined && json.current.tp !== null ? json.current.tp : null,
        tp: json.current.tp !== undefined && json.current.tp !== null ? json.current.tp : null,
        local_datetime: json.current.local_datetime || json.current.datetime || null
      };

      syncAllComponentsToActiveLocation(json, false);
      updateAtmosphericEffects(json);

      if (json.lokasi) {
        saveToSearchHistory(
          adm4,
          json.lokasi.kotkab || json.lokasi.desa || STATE.activeLocation.name,
          json.lokasi.provinsi || "",
        );
      }
      loadedSuccessfully = true;
      return json;
    } else {
      throw new Error(json.message || `Data belum tersedia untuk ${activeLoc.name}`);
    }
  } catch (err) {
    console.warn("Fetch weather error:", err.message);

    // Resilience: Check for cached official data in localStorage for THIS EXACT ADM4
    const localRecord = getWeatherFromLocalCache(adm4);
    if (localRecord && localRecord.data && localRecord.data.current) {
      const cached = localRecord.data;
      cached.fromCache = true;
      cached.isOfflineFallback = true;
      cached.lastUpdatedFormatted = `${localRecord.savedTimeStr} WIB (Data Tersimpan)`;

      STATE.currentData = cached;
      STATE.currentAdm4 = adm4;
      if (cached.lokasi) {
        STATE.activeLocation = {
          ...STATE.activeLocation,
          adm4: cached.lokasi.adm4 || adm4,
          name: cached.lokasi.kotkab || cached.lokasi.desa || STATE.activeLocation.name || "Indonesia",
          kotkab: cached.lokasi.kotkab || cached.lokasi.desa || "",
          provinsi: cached.lokasi.provinsi || ""
        };
        window.activeLocation = STATE.activeLocation;
      }

      syncAllComponentsToActiveLocation(cached, false);
      updateAtmosphericEffects(cached);
      showToast(`Menampilkan data resmi tersimpan (${localRecord.savedTimeStr} WIB).`);
      loadedSuccessfully = true;
      return cached;
    } else {
      // Data is NOT available for this location!
      // DO NOT DISPLAY ANOTHER CITY'S DATA!
      STATE.currentData = {
        lokasi: STATE.activeLocation,
        isUnavailable: true
      };
      syncAllComponentsToActiveLocation(null, true);
      showToast(`Data belum tersedia untuk ${activeLoc.name}`);
    }
  } finally {
    showLoading(false);
  }
}

// Render Hero Section (Sintaks String Diperbaiki)
function renderHeroWeather(data) {
  const activeLoc = STATE.activeLocation || {};
  const current = data?.current || {};
  const lokasi = data?.lokasi || activeLoc;
  const locName = activeLoc.name || lokasi.kotkab || lokasi.desa || "Indonesia";

  const tempVal = formatTemp(current.t);
  const feelsVal = formatTemp(current.feelsLike);
  const minVal = formatTemp(current.minTempToday);
  const maxVal = formatTemp(current.maxTempToday);

  const cityTitle = document.getElementById("hero-city-title");
  if (cityTitle) cityTitle.textContent = locName;
  const rightCity = document.getElementById("hero-right-city");
  if (rightCity) rightCity.textContent = locName;

  const subEl = document.getElementById("hero-province-subtitle");
  if (subEl) {
    subEl.textContent = `${lokasi.kecamatan || activeLoc.kecamatan ? (lokasi.kecamatan || activeLoc.kecamatan) + ", " : ""}${lokasi.provinsi || activeLoc.provinsi || ""} • Kode ADM4: ${lokasi.adm4 || activeLoc.adm4 || ""}`;
  }
  const tempEl = document.getElementById("hero-temp");
  if (tempEl) {
    tempEl.classList.add("metric-val-transition", "updating");
    setTimeout(() => {
      tempEl.textContent = tempVal;
      tempEl.classList.remove("updating");
    }, 120);
  } else {
    document.getElementById("hero-temp").textContent = tempVal;
  }
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
  if (iconImg) {
    const iconSrc = typeof getWeatherIcon === "function"
      ? getWeatherIcon(current.weather_desc, current.weather)
      : "icons/berawan.svg";
    iconImg.src = iconSrc;
    iconImg.alt = "";
    iconImg.onerror = function () {
      this.onerror = null;
      this.src = "icons/berawan.svg";
    };
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

  const lastUpdatedEl = document.getElementById("hero-last-updated");
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = data.lastUpdatedFormatted
      ? `Diperbarui: ${data.lastUpdatedFormatted}`
      : `Diperbarui: ${timeFormatted} ${lokasi.timezone || "WIB"}`;
  }

  const statusEl = document.getElementById("hero-status-pill");
  if (statusEl) {
    const status = data.dataStatus || (data.fromCache ? 'CACHED' : 'LIVE');
    if (status === 'LIVE') {
      statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 inline-flex items-center gap-1";
      statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block"></span> BMKG Live`;
    } else if (status === 'CACHED') {
      statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200/80 inline-flex items-center gap-1";
      statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1 inline-block"></span> BMKG Terverifikasi`;
    } else if (status === 'STALE') {
      statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1";
      statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 inline-block"></span> BMKG Riwayat`;
    } else {
      statusEl.className = "px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200/80 inline-flex items-center gap-1";
      statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 inline-block"></span> Data Offline`;
    }
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
  // Sync Hero Section right side atmospheric card if present
  const hrTemp = document.getElementById('hero-right-temp');
  if (hrTemp) hrTemp.textContent = tempVal;
  const hrUnit = document.getElementById('hero-right-unit');
  if (hrUnit) hrUnit.textContent = '°' + STATE.unit;
  const hrCity = document.getElementById('hero-right-city');
  if (hrCity) hrCity.textContent = lokasi.kotkab || lokasi.desa || 'Indonesia';
  const hrDesc = document.getElementById('hero-right-desc');
  if (hrDesc) hrDesc.textContent = current.weather_desc || 'Berawan';
  const hrHu = document.getElementById('hero-right-hu');
  if (hrHu) hrHu.textContent = (current.hu || 0) + '%';
  const hrWs = document.getElementById('hero-right-ws');
  if (hrWs) hrWs.textContent = wsKmh + ' km/j';
  const hrTcc = document.getElementById('hero-right-tcc');
  if (hrTcc) hrTcc.textContent = (current.tcc || 0) + '%';
  const hrTime = document.getElementById('hero-right-time');
  if (hrTime) hrTime.textContent = timeFormatted + ' ' + (lokasi.timezone || 'WIB');
  const hrIcon = document.getElementById('hero-right-icon');
  if (hrIcon) {
    const iconSrc = typeof getWeatherIcon === 'function'
      ? getWeatherIcon(current.weather_desc, current.weather)
      : 'icons/berawan.svg';
    hrIcon.src = iconSrc;
    hrIcon.alt = '';
    hrIcon.onerror = function () {
      this.onerror = null;
      this.src = 'icons/berawan.svg';
    };
  }

}

// Render Hourly Forecast Slider
function renderHourlyForecast(data) {
  const container = document.getElementById("hourly-carousel");
  if (!container) return;

  const loc = STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Wilayah";

  if (!data || !data.forecast || !data.forecast.length || data.isUnavailable) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500 font-medium w-full text-xs">Data belum tersedia untuk ${locName}</div>`;
    return;
  }

  const list = data.forecast || [];
  container.innerHTML = list
    .map((item, idx) => {
      const d = new Date(item.local_datetime || item.datetime);
      const hourStr = d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dayNames = ["Hari Ini", "Besok", "Lusa"];
      const dayIndex =
        typeof item.dayIndex === "number"
          ? item.dayIndex
          : Math.min(2, Math.floor(idx / 8));
      const dayLabel = dayNames[dayIndex] || `Hari ke-${dayIndex + 1}`;
      const isNow = idx === 0;
      const iconSrc = typeof getWeatherIcon === "function"
        ? getWeatherIcon(item.weather_desc, item.weather)
        : (item.image || "icons/berawan.svg");

      return `
      <div class="hourly-card-premium min-w-[112px] sm:min-w-[124px] p-3 flex flex-col items-center justify-between text-center ${isNow ? "current" : ""}">
        <span class="hourly-day text-slate-500 font-bold text-[10px] tracking-wider uppercase">${dayLabel}</span>
        <span class="text-xs font-bold text-slate-800 mt-0.5">${hourStr}</span>
        
        <img src="${iconSrc}" 
             alt="" 
             onerror="this.onerror=null; this.src='icons/berawan.svg'"
             class="w-10 h-10 my-1.5 drop-shadow-sm animate-float" />
             
        <span class="text-base font-black text-slate-900">${formatTemp(item.t)}°</span>
        <span class="text-[10px] text-sky-700 font-semibold truncate max-w-full">${item.weather_desc}</span>
        
        <div class="hourly-meta text-[10px] text-slate-500 font-medium flex items-center justify-center gap-1.5 mt-1">
          <span>RH ${item.hu}%</span>
          <span>·</span>
          <span>${item.ws} km/j</span>
        </div>
      </div>
    `;
    })
    .join("");
}

// Render 3-Day Daily Overview Cards
function renderDailyCards(data) {
  const container = document.getElementById("daily-cards-container");
  const weeklyGrid = document.getElementById("weekly-forecast-grid");
  const loc = STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Wilayah";

  if (!data || !data.days || !data.days.length || data.isUnavailable) {
    if (container) container.innerHTML = `<div class="p-4 text-center text-slate-500 font-medium text-xs">Data belum tersedia untuk ${locName}</div>`;
    if (weeklyGrid) weeklyGrid.innerHTML = `<div class="p-8 text-center text-slate-500 font-medium col-span-full text-xs">Data belum tersedia untuk ${locName}</div>`;
    return;
  }

  const days = data.days || [];
  const dayNames = ["Hari Ini", "Besok", "Lusa"];

  // 1. Populate hero side panel summary if container exists (Consistent Dark Glass)
  if (container && days.length) {
    container.innerHTML = days
      .map((dayArr, idx) => {
        if (!dayArr || !dayArr.length) return "";
        let minT = Infinity, maxT = -Infinity, rainSum = 0;
        dayArr.forEach((i) => {
          if (i.t < minT) minT = i.t;
          if (i.t > maxT) maxT = i.t;
          rainSum += (i.tp || 0);
        });
        const midItem = dayArr[Math.floor(dayArr.length / 2)] || dayArr[0];
        const dateObj = new Date(midItem.local_datetime || midItem.datetime);
        const dateFormatted = dateObj.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        const iconSrc = typeof getWeatherIcon === "function"
          ? getWeatherIcon(midItem.weather_desc, midItem.weather)
          : (midItem.image || "icons/berawan.svg");

        return `
        <div class="glass-subcard p-2.5 flex items-center justify-between hover:border-sky-400/40 transition-all rounded-xl mb-2">
          <div class="flex items-center gap-2.5">
            <img src="${iconSrc}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-8 h-8 drop-shadow object-contain flex-shrink-0" />
            <div>
              <span class="text-xs font-bold text-slate-900 block">${dayNames[idx] || `Hari ke-${idx + 1}`} <span class="text-[10px] text-slate-500 font-medium">(${dateFormatted})</span></span>
              <span class="text-[11px] text-sky-700 font-semibold">${midItem.weather_desc || 'Cerah'}</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-xs font-black text-slate-900 font-mono">${Math.round(maxT)}° <span class="text-[10px] text-slate-500 font-normal">/ ${Math.round(minT)}°</span></span>
            <span class="text-[10px] text-sky-700 font-bold block">${rainSum.toFixed(1)} mm</span>
          </div>
        </div>
        `;
      })
      .join("");
  }

  // 2. Populate 3-Day Forecast Section (#weekly-forecast-grid) (Consistent Dark Glass)
  if (weeklyGrid && days.length) {
    weeklyGrid.innerHTML = days
      .map((dayArr, idx) => {
        if (!dayArr || !dayArr.length) return "";
        let minT = Infinity, maxT = -Infinity, rainSum = 0;
        dayArr.forEach((i) => {
          if (i.t < minT) minT = i.t;
          if (i.t > maxT) maxT = i.t;
          rainSum += (i.tp || 0);
        });
        const midItem = dayArr[Math.floor(dayArr.length / 2)] || dayArr[0];
        const dateObj = new Date(midItem.local_datetime || midItem.datetime);
        const dateFormatted = dateObj.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        const isToday = idx === 0;
        const iconSrc = typeof getWeatherIcon === "function"
          ? getWeatherIcon(midItem.weather_desc, midItem.weather)
          : (midItem.image || "icons/berawan.svg");

        return `
        <div class="weekly-card ${isToday ? 'today' : ''} p-5 rounded-2xl flex flex-col justify-between transition-all">
          <div class="flex justify-between items-start mb-3">
            <div>
              <span class="weekly-day-name font-bold text-sm text-slate-900">${dayNames[idx] || `Hari ke-${idx + 1}`}</span>
              <p class="weekly-date text-xs text-slate-500 mt-0.5">${dateFormatted}</p>
            </div>
            <span class="text-[10px] px-2.5 py-1 rounded-full ${isToday ? 'bg-sky-100 text-sky-800 font-bold border border-sky-200' : 'bg-slate-100 text-slate-600 font-medium border border-slate-200'}">BMKG</span>
          </div>

          <div class="text-center my-3 py-2 bg-white/60 rounded-xl border border-slate-200/80">
            <img src="${iconSrc}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-12 h-12 mx-auto drop-shadow-sm object-contain mb-1.5" />
            <span class="text-xs font-bold text-slate-800 block">${midItem.weather_desc || 'Cerah'}</span>
          </div>

          <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <div class="text-left">
              <span class="text-[10px] text-slate-500 block font-medium">Suhu Maks</span>
              <span class="text-sm font-black text-slate-900">${Math.round(maxT)}°</span>
            </div>
            <div class="text-right">
              <span class="text-[10px] text-slate-500 block font-medium">Suhu Min</span>
              <span class="text-sm font-black text-slate-700">${Math.round(minT)}°</span>
            </div>
          </div>

          <div class="mt-2 text-[10px] text-slate-500 flex justify-between">
            <span>Hujan: <strong class="text-sky-700 font-bold">${rainSum.toFixed(1)} mm</strong></span>
            <span>Awan: <strong class="text-slate-700 font-semibold">${Math.round(midItem.tcc || 0)}%</strong></span>
          </div>
        </div>
        `;
      })
      .join("");
  }
}

// Render Interactive Graphs
function renderCharts(data) {
  const ctx = document.getElementById("weather-chart");
  if (!ctx) return;

  const loc = STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Wilayah";

  if (!data || !data.forecast || !data.forecast.length || data.isUnavailable) {
    renderChartsUnavailableState(locName);
    return;
  }
  const placeholder = document.getElementById("weather-chart-placeholder");
  if (placeholder) placeholder.style.display = "none";

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
  } else if (STATE.activeChartTab === "comfort") {
    datasets = [
      {
        type: "line",
        label: "Indeks Kenyamanan (0-10, hasil hitung)",
        data: forecast.map((f) =>
          calculateComfortIndex(f.t, f.hu || 0, f.ws || 0),
        ),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.15)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        yAxisID: "y",
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
  ["temp", "rain", "wind", "comfort"].forEach((t) => {
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

// 38 Official Provincial Capitals of Indonesia with Exact Geodetic Coordinates from locationCodes.js
// Position is strictly determined by lat and lon. All manual xPct and yPct removed.
const MAP_CITY_PINS = [
  // SUMATERA (10 Provinsi)
  { name: "Banda Aceh", prov: "Aceh", adm4: "11.71.01.2001", region: "Sumatera", lat: 5.5483, lon: 95.3238 },
  { name: "Medan", prov: "Sumatera Utara", adm4: "12.71.01.1001", region: "Sumatera", lat: 3.5952, lon: 98.6722 },
  { name: "Padang", prov: "Sumatera Barat", adm4: "13.71.01.1001", region: "Sumatera", lat: -0.9471, lon: 100.4172 },
  { name: "Pekanbaru", prov: "Riau", adm4: "14.71.01.1002", region: "Sumatera", lat: 0.5071, lon: 101.4478 },
  { name: "Tanjung Pinang", prov: "Kepulauan Riau", adm4: "21.72.01.1001", region: "Sumatera", lat: 0.9167, lon: 104.45 },
  { name: "Jambi", prov: "Jambi", adm4: "15.71.01.1001", region: "Sumatera", lat: -1.6101, lon: 103.6131 },
  { name: "Palembang", prov: "Sumatera Selatan", adm4: "16.71.01.1001", region: "Sumatera", lat: -2.9761, lon: 104.7754 },
  { name: "Pangkal Pinang", prov: "Kep. Bangka Belitung", adm4: "19.71.02.1001", region: "Sumatera", lat: -2.1333, lon: 106.1167 },
  { name: "Bengkulu", prov: "Bengkulu", adm4: "17.71.01.1001", region: "Sumatera", lat: -3.8004, lon: 102.2655 },
  { name: "Bandar Lampung", prov: "Lampung", adm4: "18.71.01.1003", region: "Sumatera", lat: -5.3834, lon: 105.2635 },

  // JAWA (6 Provinsi)
  { name: "Serang", prov: "Banten", adm4: "36.73.01.1001", region: "Jawa", lat: -6.1104, lon: 106.164 },
  { name: "Jakarta", prov: "DKI Jakarta", adm4: "31.71.01.1001", region: "Jawa", lat: -6.1764, lon: 106.8267 },
  { name: "Bandung", prov: "Jawa Barat", adm4: "32.73.01.1001", region: "Jawa", lat: -6.9147, lon: 107.6098 },
  { name: "Semarang", prov: "Jawa Tengah", adm4: "33.74.01.1001", region: "Jawa", lat: -6.9667, lon: 110.4167 },
  { name: "Yogyakarta", prov: "D.I. Yogyakarta", adm4: "34.71.01.1001", region: "Jawa", lat: -7.7956, lon: 110.3695 },
  { name: "Surabaya", prov: "Jawa Timur", adm4: "35.78.01.1001", region: "Jawa", lat: -7.2575, lon: 112.7521 },

  // BALI & NUSA TENGGARA (3 Provinsi)
  { name: "Denpasar", prov: "Bali", adm4: "51.71.01.1001", region: "Bali & Nusa Tenggara", lat: -8.6705, lon: 115.2126 },
  { name: "Mataram", prov: "Nusa Tenggara Barat", adm4: "52.71.02.1001", region: "Bali & Nusa Tenggara", lat: -8.5833, lon: 116.1167 },
  { name: "Kupang", prov: "Nusa Tenggara Timur", adm4: "53.71.01.1001", region: "Bali & Nusa Tenggara", lat: -10.1772, lon: 123.607 },

  // KALIMANTAN (5 Provinsi)
  { name: "Pontianak", prov: "Kalimantan Barat", adm4: "61.71.01.1002", region: "Kalimantan", lat: -0.0263, lon: 109.3425 },
  { name: "Palangka Raya", prov: "Kalimantan Tengah", adm4: "62.71.01.1001", region: "Kalimantan", lat: -2.2167, lon: 113.9167 },
  { name: "Banjarmasin", prov: "Kalimantan Selatan", adm4: "63.71.01.1001", region: "Kalimantan", lat: -3.3194, lon: 114.5901 },
  { name: "Samarinda", prov: "Kalimantan Timur", adm4: "64.72.01.1001", region: "Kalimantan", lat: -0.5022, lon: 117.1536 },
  { name: "Tanjung Selor", prov: "Kalimantan Utara", adm4: "65.01.01.1001", region: "Kalimantan", lat: 2.8378, lon: 117.365 },

  // SULAWESI (6 Provinsi)
  { name: "Manado", prov: "Sulawesi Utara", adm4: "71.71.01.1001", region: "Sulawesi", lat: 1.4748, lon: 124.8421 },
  { name: "Gorontalo", prov: "Gorontalo", adm4: "75.71.01.1001", region: "Sulawesi", lat: 0.5435, lon: 123.0568 },
  { name: "Palu", prov: "Sulawesi Tengah", adm4: "72.71.02.1002", region: "Sulawesi", lat: -0.9003, lon: 119.8779 },
  { name: "Mamuju", prov: "Sulawesi Barat", adm4: "76.02.01.1002", region: "Sulawesi", lat: -2.6774, lon: 118.887 },
  { name: "Makassar", prov: "Sulawesi Selatan", adm4: "73.71.01.1001", region: "Sulawesi", lat: -5.1477, lon: 119.4327 },
  { name: "Kendari", prov: "Sulawesi Tenggara", adm4: "74.71.03.1001", region: "Sulawesi", lat: -3.9985, lon: 122.5129 },

  // MALUKU (2 Provinsi)
  { name: "Ambon", prov: "Maluku", adm4: "81.71.01.2001", region: "Maluku", lat: -3.6554, lon: 128.1908 },
  { name: "Sofifi", prov: "Maluku Utara", adm4: "82.72.01.1001", region: "Maluku", lat: 0.75, lon: 127.5833 },

  // PAPUA (6 Provinsi)
  { name: "Jayapura", prov: "Papua", adm4: "91.71.01.1001", region: "Papua", lat: -2.5916, lon: 140.669 },
  { name: "Manokwari", prov: "Papua Barat", adm4: "92.02.12.1001", region: "Papua", lat: -0.8615, lon: 134.062 },
  { name: "Sorong", prov: "Papua Barat Daya", adm4: "96.71.01.1001", region: "Papua", lat: -0.8762, lon: 131.2558 },
  { name: "Nabire", prov: "Papua Tengah", adm4: "94.01.01.1001", region: "Papua", lat: -3.3667, lon: 135.4833 },
  { name: "Wamena", prov: "Papua Pegunungan", adm4: "95.01.01.1001", region: "Papua", lat: -4.0994, lon: 138.9442 },
  { name: "Merauke", prov: "Papua Selatan", adm4: "93.01.01.2001", region: "Papua", lat: -8.4991, lon: 140.4019 },
];

let activeMapRegion = "all";
let weatherMapInstance = null;
let weatherMapMarkersLayer = null;

// Rule 10: Satu instance peta per halaman. Hancurkan saat unmount.
function destroyWeatherMap() {
  if (weatherMapInstance) {
    try {
      weatherMapInstance.remove();
    } catch (e) {}
    weatherMapInstance = null;
    weatherMapMarkersLayer = null;
    window.weatherMapInstance = null;
    window.weatherMapMarkersLayer = null;
  }
}
window.destroyWeatherMap = destroyWeatherMap;

function getMarkerColors(temp, isRiskMode, city) {
  const hasTemp = typeof temp === "number" && !isNaN(temp);
  let tempStr = hasTemp ? Math.round(temp) + "°" : "";
  let dotColor = "#9CA3AF";
  let tempBg = "bg-slate-100 text-slate-600 font-bold";

  if (isRiskMode) {
    const regRisk =
      STATE.regionalRisks &&
      STATE.regionalRisks.find(
        (r) => r.name.toLowerCase() === (city.region || "").toLowerCase()
      );
    const risk = regRisk ? regRisk.risk : "Aman";
    tempStr = risk;
    if (risk === "Tinggi") {
      dotColor = "#f43f5e";
      tempBg = "bg-rose-50 text-rose-800 font-bold";
    } else if (risk === "Sedang") {
      dotColor = "#f59e0b";
      tempBg = "bg-amber-50 text-amber-800 font-bold";
    } else {
      dotColor = "#10b981";
      tempBg = "bg-emerald-50 text-emerald-800 font-bold";
    }
  } else if (hasTemp) {
    if (temp >= 33) {
      dotColor = "#f43f5e";
      tempBg = "bg-rose-50 text-rose-800 font-bold";
    } else if (temp >= 29) {
      dotColor = "#f59e0b";
      tempBg = "bg-amber-50 text-amber-800 font-bold";
    } else if (temp >= 24) {
      dotColor = "#10b981";
      tempBg = "bg-emerald-50 text-emerald-800 font-bold";
    } else {
      dotColor = "#0284c7";
      tempBg = "bg-sky-50 text-sky-800 font-bold";
    }
  }
  return { dotColor, tempBg, tempStr, hasTemp };
}

function buildWeatherPinTooltipHtml(city, temp) {
  const hasTemp = typeof temp === "number" && !isNaN(temp);
  if (hasTemp) {
    return `
      <div class="weather-pin-tooltip px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap">
        <span class="font-bold text-slate-900">${city.name}</span>
        <span class="text-slate-400 mx-1">·</span>
        <span class="text-sky-700 font-mono font-bold">${Math.round(temp)}°C</span>
      </div>
    `;
  }
  return `
    <div class="weather-pin-tooltip px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap">
      <span class="font-bold text-slate-900">${city.name}</span>
    </div>
  `;
}

// Rule 3: Pin kota: pakai marker lingkaran kecil berwarna sesuai suhu.
// Label nama dan suhu hanya tampil saat zoom 6 atau lebih. Di zoom lebih kecil, hanya lingkaran.
// Rule 7: Pin aktif (lokasi yang dipilih) diberi highlight dengan warna dan ring yang jelas.
function createLeafletMarkerIcon(city, temp, isActive, isRiskMode, showLabels = false) {
  const { dotColor, tempBg, tempStr } = getMarkerColors(temp, isRiskMode, city);
  const activeClass = isActive ? "pin-active" : "";
  const pulseRingHtml = isActive
    ? `<span class="circle-ring" aria-hidden="true"></span>`
    : "";
  const circleSize = isActive ? 34 : 26;
  const anchorCenter = isActive ? 17 : 13;

  if (!showLabels) {
    // Zoom < 6: Lingkaran saja (26px, atau 34px aktif dengan cincin berdenyut)
    const html = `
      <div class="circle-marker-pin ${activeClass}" aria-label="${city.name}">
        ${pulseRingHtml}
        <span class="circle-dot" style="background-color: ${dotColor};"></span>
      </div>
    `;
    return L.divIcon({
      className: "custom-leaflet-marker-circle",
      html: html,
      iconSize: [circleSize, circleSize],
      iconAnchor: [anchorCenter, anchorCenter],
    });
  }

  // Zoom >= 6: Lingkaran pin + label nama kota dan suhu (jika tersedia)
  const tempBadgeHtml = tempStr
    ? `<span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${tempBg}">${tempStr}</span>`
    : "";
  const labelActiveClass = isActive ? "leaflet-pin-active" : "";

  const html = `
    <div class="leaflet-city-pin ${labelActiveClass}" aria-label="${city.name}">
      <span class="circle-marker-pin ${activeClass}">
        ${pulseRingHtml}
        <span class="circle-dot" style="background-color: ${dotColor};"></span>
      </span>
      <span class="leaflet-city-label flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-full border border-slate-200/90 shadow-md whitespace-nowrap">
        <span class="text-[11px] font-bold text-slate-900">${city.name}</span>
        ${tempBadgeHtml}
      </span>
    </div>
  `;

  return L.divIcon({
    className: "custom-leaflet-marker",
    html: html,
    iconAnchor: [anchorCenter, anchorCenter],
    iconSize: null,
  });
}

function updateWeatherLeafletMarkerIcons() {
  if (!weatherMapMarkersLayer || !weatherMapInstance) return;
  const currentZoom = weatherMapInstance.getZoom();
  const showLabels = currentZoom >= 6;

  weatherMapMarkersLayer.eachLayer((marker) => {
    if (!marker.adm4) return;
    const city = MAP_CITY_PINS.find((c) => c.adm4 === marker.adm4) || {
      name: marker.cityName,
      adm4: marker.adm4,
    };
    const isActive = marker.adm4 === STATE.currentAdm4;
    const temp = STATE.mapTemps && STATE.mapTemps[marker.adm4];

    marker.setIcon(
      createLeafletMarkerIcon(
        city,
        temp,
        isActive,
        STATE.mapMode === "risk",
        showLabels
      )
    );
    if (marker.setTooltipContent) {
      marker.setTooltipContent(buildWeatherPinTooltipHtml(city, temp));
    }
    if (isActive && marker.setZIndexOffset) {
      marker.setZIndexOffset(1000);
    } else if (marker.setZIndexOffset) {
      marker.setZIndexOffset(0);
    }
  });
}

function initWeatherLeafletMap() {
  const container = document.getElementById("weather-leaflet-map");
  if (!container || typeof L === "undefined") return;

  if (weatherMapInstance) {
    try {
      weatherMapInstance.invalidateSize();
    } catch (e) {}
    return;
  }

  // Rule 1: Leaflet basemap OpenStreetMap, height: 520px, position: relative
  // Rule 2: Minimum zoom 4, maksimum zoom 10
  weatherMapInstance = L.map("weather-leaflet-map", {
    zoomControl: false,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 10,
    fadeAnimation: true,
  });
  const zoomCtrl = L.control.zoom({
    position: "topleft",
    zoomInTitle: "Perbesar",
    zoomOutTitle: "Perkecil",
  }).addTo(weatherMapInstance);
  if (zoomCtrl && zoomCtrl._zoomInButton) {
    zoomCtrl._zoomInButton.setAttribute("aria-label", "Perbesar");
  }
  if (zoomCtrl && zoomCtrl._zoomOutButton) {
    zoomCtrl._zoomOutButton.setAttribute("aria-label", "Perkecil");
  }
  window.weatherMapInstance = weatherMapInstance;

  // Rule 1: Ganti basemap ke OpenStreetMap: https://tile.openstreetmap.org/{z}/{x}/{y}.png dengan attribution "© OpenStreetMap contributors". Jangan pakai CARTO.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 4,
    maxZoom: 10,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  }).addTo(weatherMapInstance);

  // Rule 2: Batas awal peta ke Indonesia: southWest [-11, 95], northEast [6, 141]
  const INDO_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
  weatherMapInstance.fitBounds(INDO_BOUNDS, { padding: [10, 10] });

  // Listen for zoom changes to switch between compact circles (<6) and detailed labels (>=6)
  weatherMapInstance.on("zoomend", () => {
    updateWeatherLeafletMarkerIcons();
  });

  // Rule 9: Cek GeoJSON batas provinsi di public/geo/
  fetch("geo/indonesia-provinsi.geojson")
    .then((res) => {
      if (!res.ok) throw new Error("GeoJSON not found");
      return res.json();
    })
    .then((geojson) => {
      if (geojson && weatherMapInstance) {
        L.geoJSON(geojson, {
          style: {
            color: "#0284c7",
            weight: 1.2,
            opacity: 0.5,
            fillColor: "#38bdf8",
            fillOpacity: 0.05,
          },
        }).addTo(weatherMapInstance);
        const notice = document.getElementById("map-geo-status");
        if (notice) notice.style.display = "none";
      }
    })
    .catch(() => {
      // Rule 9: "Batas wilayah belum tersedia" kecil di pojok peta, bukan di tengah
      const notice = document.getElementById("map-geo-status");
      if (notice) notice.style.display = "block";
    });

  weatherMapMarkersLayer = L.layerGroup().addTo(weatherMapInstance);
  window.weatherMapMarkersLayer = weatherMapMarkersLayer;
}

function renderVectorMapPins() {
  const container = document.getElementById("weather-leaflet-map");
  if (!container) return;

  if (!weatherMapInstance) {
    initWeatherLeafletMap();
  }

  if (!weatherMapInstance) return;

  weatherMapInstance.invalidateSize();

  if (!weatherMapMarkersLayer) {
    weatherMapMarkersLayer = L.layerGroup().addTo(weatherMapInstance);
  } else {
    weatherMapMarkersLayer.clearLayers();
  }
  window.weatherMapMarkersLayer = weatherMapMarkersLayer;

  const currentZoom = weatherMapInstance.getZoom();
  const showLabels = currentZoom >= 6;

  const filtered =
    activeMapRegion === "all"
      ? MAP_CITY_PINS
      : MAP_CITY_PINS.filter((c) => c.region === activeMapRegion);

  filtered.forEach((city) => {
    // Rule 5: Hanya tampilkan pin untuk lokasi dengan adm4 valid. Lokasi dengan adm4 null tidak diberi pin.
    if (!city.adm4 || city.adm4 === "null") return;

    // Rule 2: Posisi setiap pin WAJIB dari lat dan lon di locationCodes.js. Hapus semua xPct dan yPct.
    const loc =
      typeof getLocation === "function"
        ? getLocation(city.adm4) || getLocation(city.name)
        : null;
    const lat = loc && loc.lat != null ? loc.lat : city.lat;
    const lon = loc && loc.lon != null ? loc.lon : city.lon;

    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

    const isActive = city.adm4 === STATE.currentAdm4;
    const temp = STATE.mapTemps && STATE.mapTemps[city.adm4];
    const weatherDesc =
      (STATE.mapWeatherDesc && STATE.mapWeatherDesc[city.adm4]) ||
      "Cerah Berawan";
    const tempStr = temp != null ? Math.round(temp) + "°C" : "--";
    const tempBadgeBg = temp != null && temp >= 33 ? "bg-rose-50 text-rose-800" : (temp != null && temp >= 29 ? "bg-amber-50 text-amber-800" : (temp != null && temp >= 24 ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"));

    const icon = createLeafletMarkerIcon(
      city,
      temp,
      isActive,
      STATE.mapMode === "risk",
      showLabels
    );
    const marker = L.marker([lat, lon], { icon: icon });
    marker.adm4 = city.adm4;
    marker.cityName = city.name;

    // Rule 6: Klik pin tetap mengubah activeLocation dan menampilkan panel info
    marker.on("click", (e) => {
      if (e && e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }
      changeLocation(city.adm4, loc || city);
      highlightActiveMapPin(city.adm4, true);
      setTimeout(() => {
        try {
          marker.openPopup();
        } catch (err) {}
      }, 50);
    });

    marker.bindPopup(
      `
      <div class="p-2 text-xs font-sans min-w-[170px]">
        <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
          <span class="font-bold text-slate-900 text-sm">${city.name}</span>
          <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${tempBadgeBg}">${tempStr}</span>
        </div>
        <div class="mt-2 space-y-1 text-slate-600 text-[11px]">
          <p><span class="text-slate-400">Provinsi:</span> <span class="font-semibold text-slate-800">${city.prov}</span></p>
          <p><span class="text-slate-400">Cuaca:</span> <span class="font-bold text-sky-700">${weatherDesc}</span></p>
          <p><span class="text-slate-400">Stasiun:</span> <span class="font-semibold text-emerald-600">BMKG Aktif</span></p>
        </div>
      </div>
    `,
      { offset: [0, -10], closeButton: true }
    );

    marker.bindTooltip(
      buildWeatherPinTooltipHtml(city, temp),
      { direction: "top", offset: [0, -14] }
    );

    if (isActive) marker.setZIndexOffset(1000);

    marker.addTo(weatherMapMarkersLayer);
  });

  renderCapitalsQuickList();

  // Rule 7: Pin aktif diberi highlight. Jangan flyTo saat load awal agar tetap menampilkan seluruh Indonesia.
  const currentLoc = window.activeLocation || STATE.activeLocation;
  if (currentLoc && currentLoc.lat != null && currentLoc.lon != null) {
    highlightActiveMapPin(currentLoc.adm4, false);
  }
}

// Filter Pulau / Region pada Peta
function filterMapRegion(region) {
  activeMapRegion = region;
  document.querySelectorAll("#map-region-filter button").forEach((btn) => {
    if (btn.getAttribute("data-region") === region) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderVectorMapPins();
  renderCapitalsQuickList();

  // If a specific region is selected, fit map bounds to that region's pins
  if (weatherMapInstance && region !== "all") {
    const regionPins = MAP_CITY_PINS.filter(
      (c) => c.region === region && c.lat && c.lon
    );
    if (regionPins.length > 0) {
      const bounds = L.latLngBounds(regionPins.map((c) => [c.lat, c.lon]));
      weatherMapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 9 });
    }
  } else if (weatherMapInstance && region === "all") {
    const INDO_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
    weatherMapInstance.fitBounds(INDO_BOUNDS, { padding: [10, 10] });
  }
}

// Render 38 Ibukota Provinsi Quick List Grid
function renderCapitalsQuickList() {
  const container = document.getElementById("capitals-quick-list");
  if (!container) return;

  const filtered =
    activeMapRegion === "all"
      ? MAP_CITY_PINS
      : MAP_CITY_PINS.filter((c) => c.region === activeMapRegion);

  const counterEl = document.getElementById("map-station-count");
  if (counterEl) {
    counterEl.textContent = `${filtered.length} Provinsi (${activeMapRegion === "all" ? "Seluruh RI" : activeMapRegion})`;
  }

  container.innerHTML = filtered
    .map((c) => {
      const isActive = c.adm4 === STATE.currentAdm4;
      const temp = STATE.mapTemps && STATE.mapTemps[c.adm4];
      const tempStr =
        temp !== undefined && temp !== null ? Math.round(temp) + "°" : "...";
      const cardId = "capital-card-" + c.adm4.replace(/\./g, "_");

      return `
      <div class="capital-card ${isActive ? "active" : ""}" id="${cardId}" onclick="changeLocation('${c.adm4}')" role="button" tabindex="0">
        <div class="min-w-0 pr-1">
          <p class="capital-card-name truncate">${c.name}</p>
          <p class="capital-card-prov truncate">${c.prov}</p>
        </div>
        <span class="capital-card-temp" id="list-temp-${c.adm4.replace(/\./g, "_")}">${tempStr}</span>
      </div>
    `;
    })
    .join("");
}

// Rule 7: Pin aktif (lokasi yang dipilih) diberi highlight dengan warna dan ring yang jelas.
function highlightActiveMapPin(adm4, shouldFly = true) {
  if (adm4 === "null") adm4 = null;

  const currentZoom = weatherMapInstance ? weatherMapInstance.getZoom() : 5;
  const showLabels = currentZoom >= 6;

  if (weatherMapMarkersLayer) {
    weatherMapMarkersLayer.eachLayer((marker) => {
      if (marker.adm4) {
        const isActive = marker.adm4 === adm4;
        const city = MAP_CITY_PINS.find((c) => c.adm4 === marker.adm4) || {
          name: marker.cityName,
          adm4: marker.adm4,
        };
        const temp = STATE.mapTemps && STATE.mapTemps[marker.adm4];
        marker.setIcon(
          createLeafletMarkerIcon(
            city,
            temp,
            isActive,
            STATE.mapMode === "risk",
            showLabels
          )
        );
        if (isActive && marker.setZIndexOffset) {
          marker.setZIndexOffset(1000);
        } else if (marker.setZIndexOffset) {
          marker.setZIndexOffset(0);
        }
      }
    });
  }

  document.querySelectorAll(".capital-card").forEach((card) => {
    if (!adm4) {
      card.classList.remove("active");
      return;
    }
    const id = "capital-card-" + adm4.replace(/\./g, "_");
    if (card.id === id) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  // Rule 2 & 5: Saat activeLocation berubah (misal diklik), peta berpindah ke lat dan lon lokasi itu (flyTo)
  if (weatherMapInstance && shouldFly) {
    const loc = window.activeLocation || STATE.activeLocation;
    if (loc && loc.lat != null && loc.lon != null && !isNaN(loc.lat) && !isNaN(loc.lon)) {
      try {
        const targetZoom = Math.min(10, Math.max(weatherMapInstance.getZoom(), 7));
        weatherMapInstance.flyTo([loc.lat, loc.lon], targetZoom, {
          duration: 1.2,
        });
      } catch (e) {}
    }
  }
}

// Preload Suhu Resmi untuk 38 Ibukota Provinsi (Optimized Fast Batch)
async function preloadMapTemperatures() {
  if (!STATE.mapTemps) STATE.mapTemps = {};
  if (!STATE.mapWeatherDesc) STATE.mapWeatherDesc = {};

  try {
    // Coba endpoint batch capitals yang sangat cepat
    const res = await fetchWithTimeout("/api/cuaca/capitals", {}, 6000);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach((item) => {
          if (item.temp !== undefined && item.temp !== null) {
            STATE.mapTemps[item.adm4] = item.temp;
            if (item.weatherDesc)
              STATE.mapWeatherDesc[item.adm4] = item.weatherDesc;
            if (!STATE.mapDetails) STATE.mapDetails = {};
            STATE.mapDetails[item.adm4] = {
              temp: item.temp,
              weatherDesc: item.weatherDesc || 'Cerah',
              humidity: item.humidity,
              windSpeed: item.windSpeed,
              windDir: item.windDir,
              precipitation: item.tp !== undefined && item.tp !== null ? item.tp : (item.precipitation !== undefined ? item.precipitation : null),
              tp: item.tp !== undefined && item.tp !== null ? item.tp : (item.precipitation !== undefined ? item.precipitation : null),
              local_datetime: item.local_datetime || null
            };

            const el = document.getElementById(
              "map-temp-" + item.adm4.replace(/\./g, "_"),
            );
            if (el) el.textContent = Math.round(item.temp) + "°";

            const listEl = document.getElementById(
              "list-temp-" + item.adm4.replace(/\./g, "_"),
            );
            if (listEl) listEl.textContent = Math.round(item.temp) + "°";
          }
        });
        if (typeof renderRainfallMapPins === 'function') renderRainfallMapPins();
        if (typeof renderAuroraSideCities === 'function') renderAuroraSideCities();
        return;
      }
    }
  } catch (e) {
    /* fallback to safe pool */
  }

  // Fallback safe concurrent fetch jika diperlukan
  const queue = [...MAP_CITY_PINS];
  const concurrency = 4;
  const workers = Array(concurrency)
    .fill(null)
    .map(async () => {
      while (queue.length > 0) {
        const city = queue.shift();
        if (!city) break;
        try {
          const res = await fetch(
            "/api/cuaca?adm4=" + encodeURIComponent(city.adm4),
          );
          if (!res.ok) continue;
          const json = await res.json();
          if (json.success && json.current && json.current.t !== undefined) {
            STATE.mapTemps[city.adm4] = json.current.t;
            if (json.current.weather_desc) {
              STATE.mapWeatherDesc[city.adm4] = json.current.weather_desc;
            }
            const el = document.getElementById(
              "map-temp-" + city.adm4.replace(/\./g, "_"),
            );
            if (el) el.textContent = Math.round(json.current.t) + "°";

            const listEl = document.getElementById(
              "list-temp-" + city.adm4.replace(/\./g, "_"),
            );
            if (listEl) listEl.textContent = Math.round(json.current.t) + "°";
          }
        } catch (err) {}
      }
    });
  await Promise.all(workers);
}

// ============================================================
// BMKG INATEWS & REAL-TIME EARTHQUAKE MONITORING ENGINE
// ============================================================

/**
 * Parsing Coordinates and Lintang/Bujur to Geographic Points
 * Rule 5: Posisi titik peta: pakai Coordinates. Jika kosong, parsing Lintang dan Bujur
 * ("LS" negatif, "LU" dan "BT" positif). Titik di luar rentang dilewati dan dicatat di console.
 */
function parseGempaCoords(item) {
  if (!item) return null;
  let lat = null;
  let lon = null;

  // 1. Coordinates: "lat,lon" (already signed: negative for south/LS, positive for north/LU)
  if (item.Coordinates && typeof item.Coordinates === "string") {
    const parts = item.Coordinates.split(",");
    if (parts.length === 2) {
      const pLat = parseFloat(parts[0].trim());
      const pLon = parseFloat(parts[1].trim());
      if (!isNaN(pLat) && !isNaN(pLon)) {
        lat = pLat;
        lon = pLon;
      }
    }
  }

  // 2. Fallback to Lintang and Bujur if Coordinates missing or NaN
  if ((lat === null || lon === null) && item.Lintang && item.Bujur) {
    const lintangStr = String(item.Lintang).trim().toUpperCase();
    const bujurStr = String(item.Bujur).trim().toUpperCase();
    const latVal = parseFloat(lintangStr);
    const lonVal = parseFloat(bujurStr);

    if (!isNaN(latVal)) {
      lat = lintangStr.includes("LS") ? -Math.abs(latVal) : Math.abs(latVal);
    }
    if (!isNaN(lonVal)) {
      lon = bujurStr.includes("BB") ? -Math.abs(lonVal) : Math.abs(lonVal);
    }
  }

  // 3. Range check for Indonesia region (including offshore seismic zones)
  const MIN_LAT = -13.0;
  const MAX_LAT = 8.0;
  const MIN_LON = 93.0;
  const MAX_LON = 143.0;

  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    console.warn("Titik gempa koordinat tidak valid dilewati:", item);
    return null;
  }

  if (lat < MIN_LAT || lat > MAX_LAT || lon < MIN_LON || lon > MAX_LON) {
    console.warn("Titik gempa di luar rentang peta Indonesia dilewati:", { lat, lon, item });
    return null;
  }

  // Coordinate projection over Indonesia bounds (equirectangular % helpers)
  const xPct = Math.max(3, Math.min(97, ((lon - 94.0) / (142.0 - 94.0)) * 88 + 6));
  const yPct = Math.max(5, Math.min(95, ((7.0 - lat) / (7.0 - (-12.0))) * 76 + 12));

  return { lat, lon, xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 };
}

/**
 * Magnitude Color Classifier
 * Rule 6: M < 5.0 kuning, 5.0 sampai 6.0 oranye, 6.0 sampai 7.0 merah, 7.0 ke atas merah tua.
 */
function getMagnitudeColorInfo(mag) {
  const m = parseFloat(mag) || 0;
  if (m < 5.0) {
    return {
      category: "Ringan/Sedang",
      dotBg: "bg-amber-400",
      dotBorder: "border-amber-300",
      dotShadow: "shadow-[0_0_10px_#f59e0b]",
      badgeBg: "bg-amber-100",
      badgeText: "text-amber-800",
      badgeBorder: "border-amber-300",
      colorName: "kuning"
    };
  } else if (m < 6.0) {
    return {
      category: "Menengah",
      dotBg: "bg-orange-500",
      dotBorder: "border-orange-400",
      dotShadow: "shadow-[0_0_12px_#f97316]",
      badgeBg: "bg-orange-100",
      badgeText: "text-orange-800",
      badgeBorder: "border-orange-300",
      colorName: "oranye"
    };
  } else if (m < 7.0) {
    return {
      category: "Kuat",
      dotBg: "bg-rose-600",
      dotBorder: "border-rose-400",
      dotShadow: "shadow-[0_0_14px_#e11d48]",
      badgeBg: "bg-rose-100",
      badgeText: "text-rose-800",
      badgeBorder: "border-rose-300",
      colorName: "merah"
    };
  } else {
    return {
      category: "Sangat Kuat / Merusak",
      dotBg: "bg-red-900",
      dotBorder: "border-red-500",
      dotShadow: "shadow-[0_0_20px_#7f1d1d]",
      badgeBg: "bg-red-200",
      badgeText: "text-red-950 font-black",
      badgeBorder: "border-red-500",
      colorName: "merah tua"
    };
  }
}

/**
 * Format nama lokasi gempa BMKG hanya untuk tampilan (tanpa mengubah data asli).
 */
function formatGempaWilayah(rawWilayah, fallback = "--") {
  if (typeof rawWilayah !== "string") return fallback;
  const trimmed = rawWilayah.trim();
  if (!trimmed) return fallback;

  const UPPER_ACRONYMS = new Set(["DIY", "DKI", "NTB", "NTT"]);
  let text = trimmed
    .replace(/\bTimurLaut\b/gi, "Timur Laut")
    .replace(/\bBaratLaut\b/gi, "Barat Laut")
    .replace(/\bBaratDaya\b/gi, "Barat Daya")
    .replace(/\bTenggaraDa\b/gi, "Tenggara")
    .replace(/([A-Z]{2,})\.([A-Z]{2,})/g, "$1. $2");

  const toTitleWord = (word) => {
    if (!word) return word;
    if (UPPER_ACRONYMS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  return text
    .split(/\s+/)
    .map((token) => {
      if (!/[A-Z]/.test(token) || /[a-z]/.test(token)) {
        return token;
      }
      return token
        .split("-")
        .map((part) => {
          if (!/[A-Z]/.test(part) || /[a-z]/.test(part)) {
            return part;
          }
          const expanded = part.replace(/BRT/g, " Barat ").trim();
          return expanded
            .split(/\s+/)
            .map((sub) => {
              const m = sub.match(/^([^A-Z0-9]*)([A-Z0-9.]+)([^A-Z0-9]*)$/);
              if (!m) return sub;
              const [, prefix, core, suffix] = m;
              if (!/[A-Z]/.test(core)) return sub;
              const formattedCore = core.endsWith(".")
                ? toTitleWord(core.slice(0, -1)) + "."
                : toTitleWord(core);
              return prefix + formattedCore + suffix;
            })
            .join(" ");
        })
        .join("-");
    })
    .join(" ");
}

/**
 * Rule 3: Isi kartu "Gempa Terkini": Magnitudo, Kedalaman, Lokasi (Wilayah),
 * Waktu (Tanggal dan Jam WIB), Potensi Tsunami (badge hijau jika tidak berpotensi).
 * Rule 8: Jangan tampilkan gambar Shakemap jika URL-nya kosong atau gagal dimuat. Sembunyikan bagian itu.
 */
function renderMainEarthquakeCard(g) {
  if (!g) return;

  const magEl = document.getElementById("modal-gempa-mag");
  const depthEl = document.getElementById("modal-gempa-depth");
  const locEl = document.getElementById("modal-gempa-location");
  const timeEl = document.getElementById("modal-gempa-time");
  const potensiEl = document.getElementById("modal-gempa-potensi");
  const dirasakanEl = document.getElementById("modal-gempa-dirasakan");
  const shakemapSec = document.getElementById("gempa-shakemap-section");
  const shakemapImg = document.getElementById("modal-gempa-shakemap");

  const magVal = parseFloat(g.Magnitude) || 0;
  const colorInfo = getMagnitudeColorInfo(magVal);

  if (magEl) {
    magEl.textContent = `M ${g.Magnitude || "--"}`;
    magEl.className = `text-3xl sm:text-5xl font-black mt-1 block font-mono ${colorInfo.badgeText}`;
  }

  if (depthEl) {
    depthEl.textContent = g.Kedalaman || "--";
  }

  if (locEl) {
    locEl.textContent = formatGempaWilayah(g.Wilayah, "--");
  }

  if (timeEl) {
    const tgl = g.Tanggal || "";
    const jam = g.Jam || "";
    timeEl.textContent = `${tgl}${tgl && jam ? " • " : ""}${jam}`;
  }

  if (potensiEl) {
    const rawPotensi = g.Potensi || "Tidak berpotensi tsunami";
    const isSafe = rawPotensi.toLowerCase().includes("tidak");
    if (isSafe) {
      potensiEl.className = "font-bold text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block";
      potensiEl.textContent = rawPotensi;
    } else {
      potensiEl.className = "font-bold text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-block";
      potensiEl.textContent = rawPotensi;
    }
  }

  if (dirasakanEl) {
    dirasakanEl.textContent = g.Dirasakan || g.Skala || "Tidak ada laporan dirasakan";
  }

  // Shakemap: hide section if URL empty or failed to load
  const sUrl = g.shakemapUrl || (g.Shakemap && g.Shakemap.trim() ? `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap.trim()}` : "");
  if (sUrl && shakemapImg) {
    shakemapImg.src = sUrl;
    shakemapImg.onload = () => {
      if (shakemapSec) shakemapSec.style.display = "block";
    };
    shakemapImg.onerror = () => {
      if (shakemapSec) shakemapSec.style.display = "none";
    };
  } else {
    if (shakemapSec) shakemapSec.style.display = "none";
  }

  // Top nav header ticker
  const ticker = document.getElementById("gempa-ticker-text");
  if (ticker) {
    ticker.innerHTML = `<strong>BMKG GEMPA:</strong> M ${escapeHtml(String(g.Magnitude ?? "--"))} • ${escapeHtml(formatGempaWilayah(g.Wilayah, "--"))} • Kedalaman ${escapeHtml(String(g.Kedalaman ?? "--"))} (${escapeHtml(String(g.Jam ?? "--"))})`;
  }

  // Sync any legacy dash elements if present
  const dashMag = document.getElementById("dash-gempa-mag");
  if (dashMag) dashMag.textContent = `M ${g.Magnitude}`;
  const dashDepth = document.getElementById("dash-gempa-depth");
  if (dashDepth) dashDepth.textContent = g.Kedalaman || "--";
  const dashLoc = document.getElementById("dash-gempa-location");
  if (dashLoc) dashLoc.textContent = formatGempaWilayah(g.Wilayah, "--");
  const dashTime = document.getElementById("dash-gempa-time");
  if (dashTime) dashTime.textContent = `${g.Tanggal || ""} ${g.Jam || ""}`;
  const dashPotensi = document.getElementById("dash-gempa-potensi");
  if (dashPotensi) dashPotensi.textContent = g.Potensi || "Tidak Berpotensi Tsunami";
}

/**
 * Fallback for Main Card when fetch fails
 * Rule 7: Jika fetch gagal, tampilkan "Daftar gempa belum tersedia", bukan "--" atau "Memuat...".
 */
function renderMainEarthquakeUnavailable() {
  const magEl = document.getElementById("modal-gempa-mag");
  const depthEl = document.getElementById("modal-gempa-depth");
  const locEl = document.getElementById("modal-gempa-location");
  const timeEl = document.getElementById("modal-gempa-time");
  const potensiEl = document.getElementById("modal-gempa-potensi");
  const dirasakanEl = document.getElementById("modal-gempa-dirasakan");
  const shakemapSec = document.getElementById("gempa-shakemap-section");

  if (magEl) magEl.textContent = "Data Belum Tersedia";
  if (depthEl) depthEl.textContent = "--";
  if (locEl) locEl.textContent = "Data gempa belum tersedia";
  if (timeEl) timeEl.textContent = "--";
  if (potensiEl) potensiEl.textContent = "Data gempa belum tersedia";
  if (dirasakanEl) dirasakanEl.textContent = "--";
  if (shakemapSec) shakemapSec.style.display = "none";
}

/**
 * Rule 4: Isi daftar "Gempa Terbaru": maksimal 15 item, dari yang paling baru.
 * Setiap item: badge magnitudo berwarna, wilayah, waktu.
 */
function renderEarthquakeRecentList(list) {
  const container = document.getElementById("earthquake-recent-list");
  if (!container) return;

  if (!Array.isArray(list) || list.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-500 font-medium text-xs">Daftar gempa belum tersedia</div>`;
    return;
  }

  // Maksimal 15 item dari yang paling baru
  const items = list.slice(0, 15);

  container.innerHTML = items.map((item, index) => {
    const color = getMagnitudeColorInfo(item.Magnitude);
    return `
      <div onclick="window.focusEarthquake(${index})" class="cursor-pointer p-3.5 rounded-2xl bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs hover:shadow transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3">
          <span class="px-2.5 py-1 rounded-xl text-xs font-black ${color.badgeBg} ${color.badgeText} border ${color.badgeBorder} font-mono flex-shrink-0 shadow-xs">
            M ${item.Magnitude}
          </span>
          <div>
            <h4 class="text-xs font-bold text-slate-900 leading-snug">${escapeHtml(formatGempaWilayah(item.Wilayah, "Episentrum Gempa"))}</h4>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
              <span>Kedalaman: <strong class="text-slate-700">${item.Kedalaman || "--"}</strong></span>
              <span>•</span>
              <span>Koordinat: <strong class="font-mono text-slate-600">${item.Coordinates || (item.Lintang + ', ' + item.Bujur)}</strong></span>
            </div>
          </div>
        </div>
        <div class="text-left sm:text-right flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex sm:flex-col justify-between sm:justify-center items-baseline sm:items-end">
          <span class="text-xs font-bold text-slate-800 font-mono">${item.Jam || ""}</span>
          <span class="text-[10px] text-slate-500 font-medium">${item.Tanggal || ""}</span>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Rule 8: Warna dan radius L.circleMarker berdasarkan magnitudo
 */
function getEarthquakeMarkerStyle(mag) {
  const m = parseFloat(mag) || 0;
  if (m < 5.0) {
    return { color: "#FACC15", radius: 6 };
  } else if (m < 6.0) {
    return { color: "#F97316", radius: 8 };
  } else if (m < 7.0) {
    return { color: "#EF4444", radius: 10 };
  }
  return { color: "#B91C1C", radius: 10 };
}

/**
 * Rule 9: Popup HTML dengan escapeHtml untuk seluruh teks dari data
 */
function buildEarthquakePopupHtml(item, hexColor) {
  const m = parseFloat(item.Magnitude) || 0;
  const magText = escapeHtml(String(item.Magnitude ?? "--"));
  const wilayahText = escapeHtml(formatGempaWilayah(item.Wilayah, "Episentrum Gempa"));
  const kedalamanText = escapeHtml(String(item.Kedalaman || "--"));
  const waktuText = escapeHtml(`${item.Tanggal || ""} ${item.Jam || ""}`.trim() || "--");

  return `
    <div style="min-width:200px; font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; color:#0F172A;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
        <span style="display:inline-block; padding:2px 8px; border-radius:9999px; font-weight:800; background:${hexColor}; color:${m < 5.0 ? '#0F172A' : '#FFFFFF'};">M ${magText}</span>
        <span style="font-size:11px; color:#334155; font-family:monospace;">${waktuText}</span>
      </div>
      <div style="font-weight:700; color:#0F172A; margin-bottom:4px; line-height:1.35;">${wilayahText}</div>
      <div style="font-size:11px; color:#334155; border-top:1px solid #E2E8F0; padding-top:4px;">
        Kedalaman: <strong>${kedalamanText}</strong>
      </div>
    </div>
  `;
}

/**
 * Rule 3, 4, 5: Inisialisasi peta Leaflet gempa di #earthquake-leaflet-map
 */
function initEarthquakeLeafletMap() {
  const container = document.getElementById("earthquake-leaflet-map");
  if (!container || typeof L === "undefined") return null;

  if (window.earthquakeMap) {
    try {
      window.earthquakeMap.remove();
    } catch (e) {}
    window.earthquakeMap = null;
  }

  const map = L.map("earthquake-leaflet-map", {
    zoomControl: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 12,
    fadeAnimation: true,
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 4,
    maxZoom: 12,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const INDO_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
  map.fitBounds(INDO_BOUNDS, { padding: [10, 10] });

  window.earthquakeMap = map;

  try {
    map.invalidateSize();
  } catch (e) {}
  setTimeout(() => {
    if (window.earthquakeMap === map) {
      try {
        map.invalidateSize();
        map.fitBounds(INDO_BOUNDS, { padding: [10, 10] });
      } catch (e) {}
    }
  }, 200);

  return map;
}

/**
 * Rule 6 - 13: Render titik gempa di Leaflet map
 */
function renderEarthquakeMapPins(mainGempa, recentList) {
  const countEl = document.getElementById("earthquake-pin-count");
  const map = initEarthquakeLeafletMap();
  if (!map) return;

  window.earthquakeMarkersByListIndex = {};
  const listSlice = Array.isArray(recentList) ? recentList.slice(0, 15) : [];

  const isSameEarthquake = (a, b) => {
    if (!a || !b) return false;
    return (
      (a.DateTime && a.DateTime === b.DateTime) ||
      (a.Jam === b.Jam && a.Tanggal === b.Tanggal && a.Wilayah === b.Wilayah)
    );
  };

  let mappedCount = 0;
  let mainMarkerRef = null;

  // 1. Plot Gempa Terbaru (STATE.gempaData) dengan lingkaran pulsa halus + label "M"
  if (mainGempa && mainGempa.Magnitude) {
    const coords = parseGempaCoords(mainGempa);
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
      const latLng = L.latLng(coords.lat, coords.lon);
      const style = getEarthquakeMarkerStyle(mainGempa.Magnitude);

      // Pulsing halo & small "M" badge behind main circleMarker
      const pulseIcon = L.divIcon({
        className: "earthquake-main-pulse-icon",
        html: `
          <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center; pointer-events:none;">
            <span class="animate-ping" style="position:absolute; width:24px; height:24px; border-radius:9999px; background-color:${style.color}; opacity:0.55;"></span>
            <span style="position:absolute; top:-4px; right:-4px; background:#0F172A; color:#FFFFFF; font-size:9px; font-weight:900; padding:0 4px; border-radius:4px; line-height:13px; border:1px solid #FFFFFF; box-shadow:0 1px 3px rgba(0,0,0,0.35);">M</span>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker(latLng, { icon: pulseIcon, interactive: false, keyboard: false }).addTo(map);

      const mainMarker = L.circleMarker(latLng, {
        radius: style.radius,
        fillColor: style.color,
        color: "#FFFFFF",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.95,
      })
        .bindPopup(buildEarthquakePopupHtml(mainGempa, style.color))
        .addTo(map);

      mainMarkerRef = { marker: mainMarker, latLng };
      mappedCount++;

      // Link matching items in recentList to this marker
      listSlice.forEach((item, idx) => {
        if (isSameEarthquake(item, mainGempa)) {
          window.earthquakeMarkersByListIndex[idx] = mainMarkerRef;
        }
      });
    } else {
      console.warn("Titik gempa utama koordinat tidak valid dilewati:", mainGempa);
    }
  }

  // 2. Plot Daftar Gempa Terbaru
  listSlice.forEach((item, idx) => {
    if (mainGempa && isSameEarthquake(item, mainGempa)) {
      return;
    }

    const coords = parseGempaCoords(item);
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) {
      return;
    }

    const latLng = L.latLng(coords.lat, coords.lon);
    const style = getEarthquakeMarkerStyle(item.Magnitude);

    const marker = L.circleMarker(latLng, {
      radius: style.radius,
      fillColor: style.color,
      color: "#FFFFFF",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9,
    })
      .bindPopup(buildEarthquakePopupHtml(item, style.color))
      .addTo(map);

    window.earthquakeMarkersByListIndex[idx] = { marker, latLng };
    mappedCount++;
  });

  if (countEl) {
    countEl.textContent = mappedCount > 0
      ? `${mappedCount} titik gempa dipetakan`
      : "Data gempa belum tersedia";
  }
}

/**
 * Rule 11: Klik item di daftar Gempa Terbaru memfokuskan peta dan membuka popup
 */
function focusEarthquake(index) {
  const map = window.earthquakeMap;
  if (!map) return;

  let entry = window.earthquakeMarkersByListIndex && window.earthquakeMarkersByListIndex[index];

  if (!entry && Array.isArray(STATE.gempaList) && STATE.gempaList[index]) {
    const item = STATE.gempaList[index];
    const coords = parseGempaCoords(item);
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
      const latLng = L.latLng(coords.lat, coords.lon);
      map.flyTo(latLng, 6, { animate: true, duration: 0.7 });
    }
    return;
  }

  if (entry && entry.latLng && entry.marker) {
    const mapEl = document.getElementById("earthquake-leaflet-map");
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    map.flyTo(entry.latLng, 6, { animate: true, duration: 0.7 });
    entry.marker.openPopup();
  }
}

function showEarthquakeTooltip() {
  // Digantikan oleh Popup Leaflet
}

function hideEarthquakeTooltip() {
  // Digantikan oleh Popup Leaflet
}

/**
 * Orchestrator: Fetch and render all earthquake data
 * Rule 1 & 2: Server routes /api/gempa and /api/gempa/terkini
 */
async function loadEarthquakeData(forceRefresh = false) {
  // 1. Fetch main earthquake card (/api/gempa)
  try {
    const resMain = await fetchWithTimeout("/api/gempa", {}, 6000);
    const jsonMain = await resMain.json();
    if (jsonMain.success && jsonMain.gempa) {
      STATE.gempaData = jsonMain.gempa;
      renderMainEarthquakeCard(jsonMain.gempa);
    } else {
      renderMainEarthquakeUnavailable();
    }
  } catch (err) {
    console.error("Gagal mengambil data gempa utama:", err);
    renderMainEarthquakeUnavailable();
  }

  // 2. Fetch list of recent earthquakes (/api/gempa/terkini)
  const listContainer = document.getElementById("earthquake-recent-list");
  try {
    const resList = await fetchWithTimeout("/api/gempa/terkini", {}, 6000);
    const jsonList = await resList.json();
    const list = (jsonList && (jsonList.list || jsonList.gempa)) || [];

    if (jsonList.success && Array.isArray(list) && list.length > 0) {
      STATE.gempaList = list;
      renderEarthquakeRecentList(list);
      renderEarthquakeMapPins(STATE.gempaData, list);
    } else {
      if (listContainer) {
        listContainer.innerHTML = `<div class="p-6 text-center text-slate-500 font-medium text-xs">Daftar gempa belum tersedia</div>`;
      }
      renderEarthquakeMapPins(STATE.gempaData, []);
    }
  } catch (err) {
    console.error("Gagal mengambil daftar gempa terkini:", err);
    if (listContainer) {
      listContainer.innerHTML = `<div class="p-6 text-center text-slate-500 font-medium text-xs">Daftar gempa belum tersedia</div>`;
    }
    renderEarthquakeMapPins(STATE.gempaData, []);
  }
}

// BMKG Live Earthquake Alert
async function loadEarthquakeAlert() {
  await loadEarthquakeData();
}

// Show Earthquake Detail Modal
function openGempaModal() {
  const g = STATE.gempaData;
  if (!g) {
    showToast("Data gempa terkini belum siap.");
    return;
  }

  const modal = document.getElementById("gempa-modal");
  renderMainEarthquakeCard(g);

  if (modal) modal.classList.remove("hidden");
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
function changeLocation(adm4, meta = null) {
  if (adm4 === "null") adm4 = null;
  const activeLoc = setActiveLocation(adm4, meta);
  if (!adm4) {
    STATE.currentData = {
      success: false,
      isUnavailable: true,
      lokasi: activeLoc,
      current: null
    };
    STATE.currentAdm4 = null;
    syncAllComponentsToActiveLocation(null, true);
    showToast(`Data belum tersedia untuk ${activeLoc.name || "wilayah ini"}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
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
          (w.name && w.name.toLowerCase().includes(val)) ||
          (w.provinsi && w.provinsi.toLowerCase().includes(val)) ||
          (w.kotkab && w.kotkab.toLowerCase().includes(val)) ||
          (w.adm4 ? w.adm4.includes(val) : false),
      )
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div class="p-4 text-xs text-slate-600 text-center font-medium">
          Lokasi tidak ditemukan.<br/>
          <span class="text-sky-700 font-semibold">Tekan Enter untuk mencoba kode ADM4 manual.</span>
        </div>
      `;
      dropdown.classList.remove("hidden");
      return;
    }

    const highlightMatch = (text, query) => {
      if (!query) return text;
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "gi");
      return text.replace(regex, '<mark class="bg-sky-100 text-sky-800 font-bold px-1 rounded">$1</mark>');
    };

    dropdown.innerHTML = `
      <div class="px-3.5 py-2 text-[11px] text-slate-600 font-bold border-b border-slate-200/90 flex justify-between bg-slate-50/90">
        <span>Hasil Pencarian Lokasi</span>
        <span class="text-sky-700 font-semibold">${matches.length} Wilayah Ditemukan</span>
      </div>
    ` + matches
      .map(
        (m) => `
      <div onclick="selectSearchResult('${m.adm4}', '${m.name.replace(/'/g, "\\'")}')" 
           class="p-3 hover:bg-slate-50/90 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-none transition-colors">
        <div>
          <p class="text-xs font-bold text-slate-900">${highlightMatch(m.name, val)}</p>
          <p class="text-[11px] text-slate-500 font-medium">${highlightMatch(m.provinsi || '', val)} • ${highlightMatch(m.kotkab || '', val)}</p>
        </div>
        <span class="text-[10px] text-slate-500 font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${m.adm4}</span>
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

function selectSearchResult(adm4, name = null) {
  const dropdown = document.getElementById("search-dropdown");
  const searchInput = document.getElementById("city-search-input");
  if (dropdown) dropdown.classList.add("hidden");
  if (searchInput) searchInput.value = "";
  if (!adm4) return;
  const match = STATE.wilayahList ? STATE.wilayahList.find((w) => w.adm4 === adm4) : null;
  changeLocation(adm4, match || (name ? { name, kotkab: name, adm4 } : null));
}

/* Video Controls & Dimmer — Video Background */
function setupVideoControls() {
  const bgVideo = document.getElementById("bg-video");
  const playBtn = document.getElementById("btn-toggle-video");
  const playLabel = document.getElementById("video-btn-label");
  
  if (bgVideo) {
    bgVideo.muted = true;
    bgVideo.loop = true;
    bgVideo.playsInline = true;
    STATE.videoPlaying = false;
    if (playLabel) playLabel.textContent = "Putar Video";
    
    bgVideo.addEventListener("error", () => {
      console.error("Video gagal dimuat. Pastikan bg-lake.mp4 berada satu folder.");
    });
  }
  
  if (playBtn && bgVideo) {
    playBtn.addEventListener("click", async () => {
      if (bgVideo.paused) {
        try {
          await bgVideo.play();
          STATE.videoPlaying = true;
          if (playLabel) playLabel.textContent = "Jeda Video";
        } catch (e) {
          console.error("Video play error:", e);
        }
      } else {
        bgVideo.pause();
        STATE.videoPlaying = false;
        if (playLabel) playLabel.textContent = "Putar Video";
      }
    });
    bgVideo.addEventListener("play", () => {
      STATE.videoPlaying = true;
      if (playLabel) playLabel.textContent = "Jeda Video";
    });
    bgVideo.addEventListener("pause", () => {
      STATE.videoPlaying = false;
      if (playLabel) playLabel.textContent = "Putar Video";
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
    renderClimateIndicators(STATE.currentData);
  }
}

// Update Dynamic Atmospheric Effects
function updateAtmosphericEffects(data) {
  const current = data.current || {};
  if (atmosphere) {
    atmosphere.setMode(current.weather_desc);
  }

  // Update bg animation tint based on weather
  const bgAnim = document.getElementById("bg-animated");
  if (bgAnim) {
    const desc = (current.weather_desc || "").toLowerCase();
    if (desc.includes("hujan")) {
      bgAnim.style.filter = "brightness(0.75) hue-rotate(10deg)";
    } else if (desc.includes("cerah")) {
      bgAnim.style.filter = "brightness(1.05) saturate(1.2)";
    } else {
      bgAnim.style.filter = "brightness(0.9)";
    }
  }
}

// Toggle Dynamic Atmosphere FX
function toggleAtmosphereFX() { /* Particle feature removed */ }

// Helper: Format Temperature
function formatTemp(celsius) {
  if (celsius === undefined || celsius === null) return "--";
  if (STATE.unit === "F") {
    return Math.round((celsius * 9) / 5 + 32);
  }
  return Math.round(celsius);
}

// Loading & Toast Helpers
let loaderWatchdog = null;

function showLoading(show, title = "Sinkronisasi BMKG", subtext = "Mengambil data meteorologi resmi...") {
  const loader = document.getElementById("global-loader");
  if (!loader) return;

  if (loaderWatchdog) {
    clearTimeout(loaderWatchdog);
    loaderWatchdog = null;
  }

  if (show) {
    const titleEl = document.getElementById("global-loader-title");
    const subEl = document.getElementById("global-loader-subtext");
    const actionsEl = document.getElementById("global-loader-actions");
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtext;
    if (actionsEl) actionsEl.classList.add("hidden");

    loader.classList.remove("hidden");
    loader.style.display = "flex";
    loader.style.opacity = "1";
    loader.style.pointerEvents = "auto";

    // Watchdog: after 3.5s of loading, show manual continue button
    loaderWatchdog = setTimeout(() => {
      if (loader && !loader.classList.contains("hidden")) {
        if (subEl) subEl.textContent = "Koneksi BMKG memerlukan waktu lebih lama dari biasanya...";
        if (actionsEl) actionsEl.classList.remove("hidden");
      }
    }, 3500);
  } else {
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    setTimeout(() => {
      loader.classList.add("hidden");
      loader.style.display = "none";
    }, 250);
  }
}

function dismissLoader() {
  const loader = document.getElementById("global-loader");
  if (loader) {
    if (loaderWatchdog) {
      clearTimeout(loaderWatchdog);
      loaderWatchdog = null;
    }
    loader.style.opacity = "0";
    loader.style.pointerEvents = "none";
    setTimeout(() => {
      loader.classList.add("hidden");
      loader.style.display = "none";
    }, 200);
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


// 1. Render Smart Weather Alerts Banner
function renderSmartAlerts(alerts) {
  const banner = document.getElementById("smart-weather-alert-banner");
  if (!banner) return;

  const activeAlerts = (alerts || []).filter((a) => a.level !== "success");
  const alertCountBadge = document.getElementById("header-alert-count");
  if (alertCountBadge) {
    if (activeAlerts.length === 0) {
      alertCountBadge.classList.add("hidden");
      alertCountBadge.style.display = "none";
      alertCountBadge.textContent = "0";
    } else {
      alertCountBadge.classList.remove("hidden");
      alertCountBadge.style.display = "inline-block";
      alertCountBadge.className =
        "absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.2 shadow-sm";
      alertCountBadge.textContent = String(activeAlerts.length);
    }
  }

  if (activeAlerts.length === 0) {
    banner.innerHTML = "";
    return;
  }

  const topAlert = activeAlerts[0];
  const isDanger = topAlert.level === "danger";
  const borderClass = isDanger
    ? "border-rose-500/50 bg-rose-950/30"
    : "border-amber-500/50 bg-amber-950/30";
  const titleColor = isDanger ? "text-rose-300" : "text-amber-300";
  const badgeBg = isDanger
    ? "bg-rose-500 text-white"
    : "bg-amber-500 text-slate-950";

  banner.innerHTML = `
    <div class="glass-panel p-3.5 sm:p-4 rounded-2xl ${borderClass} shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div class="flex items-start space-x-3">
        <div class="w-9 h-9 rounded-xl ${isDanger ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-300"} flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${badgeBg}">
              ${isDanger ? "PERINGATAN CUACA EKSTREM" : "WASPADA CUACA"}
            </span>
            <h4 class="text-xs sm:text-sm font-bold ${titleColor}">${topAlert.title}</h4>
          </div>
          <p class="text-xs text-slate-200 mt-1 font-medium">${topAlert.message}</p>
          <p class="text-[11px] text-slate-300 mt-0.5 italic">Mitigasi: ${topAlert.advice}</p>
        </div>
      </div>
      <button onclick="openOfficialAlertsModal()" class="glass-pill px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 whitespace-nowrap self-end sm:self-center">
        Lihat Semua Peringatan
      </button>
    </div>
  `;
}

// 2. Render Weather Insight
function renderWeatherInsight(insight, data) {
  if (!insight) return;
  const narrativeEl = document.getElementById("weather-insight-narrative");
  const scoreEl = document.getElementById("insight-outdoor-score");
  const barEl = document.getElementById("insight-outdoor-bar");
  const tomorrowEl = document.getElementById("insight-temp-tomorrow");
  const dayAfterEl = document.getElementById("insight-temp-dayafter");
  const riskBadge = document.getElementById("insight-risk-badge");

  if (narrativeEl) narrativeEl.textContent = insight.narrative;
  if (scoreEl) scoreEl.textContent = `${insight.outdoorScore} / 100`;
  if (barEl) {
    barEl.style.width = `${insight.outdoorScore}%`;
    if (insight.outdoorScore < 50)
      barEl.className =
        "h-full bg-rose-500 rounded-full transition-all duration-700";
    else if (insight.outdoorScore < 75)
      barEl.className =
        "h-full bg-amber-400 rounded-full transition-all duration-700";
    else
      barEl.className =
        "h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-700";
  }
  if (tomorrowEl && insight.tempChanges)
    tomorrowEl.textContent = insight.tempChanges.tomorrow.label;
  if (dayAfterEl && insight.tempChanges)
    dayAfterEl.textContent = insight.tempChanges.dayAfter.label;
  if (riskBadge) {
    riskBadge.textContent = insight.riskLevel;
    if (insight.riskCode === "high") {
      riskBadge.className =
        "px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40";
    } else if (insight.riskCode === "medium") {
      riskBadge.className =
        "px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40";
    } else {
      riskBadge.className =
        "px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
    }
  }
}

function getActivityIconSvg(name) {
  const paths = {
    jemur:
      '<path d="M2 5h20"/><path d="M6 5v2l-2 2v8h6V9l-2-2V5"/><path d="M15 5v9h5V5"/>',
    olahraga:
      '<circle cx="15" cy="4" r="2"/><path d="M13 8l-3 5-4-1"/><path d="M10 13l-2 7"/><path d="M13 8l3 3 4-1"/><path d="M13 14l4 2-1 5"/>',
    berkendara:
      '<path d="M5 17H3v-5l2-5h12l3 5v5h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M10 17h4"/>',
    payung:
      '<path d="M22 12a10.06 10.06 0 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>',
  };
  const body = paths[name] || paths.payung;
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// 3. Render Activity Recommendations
function renderActivityRecommendations(recommendations) {
  const container = document.getElementById("activity-recommendations-list");
  if (!container) return;

  const list = [
    {
      name: "Jemur Pakaian",
      icon: "jemur",
      data:
        recommendations.jemur || {
          status: "Cukup Baik",
          color: "cyan",
          reason: "Kondisi memadai",
        },
    },
    {
      name: "Olahraga Outdoor",
      icon: "olahraga",
      data:
        recommendations.olahraga || {
          status: "Ideal",
          color: "emerald",
          reason: "Udara nyaman",
        },
    },
    {
      name: "Berkendara",
      icon: "berkendara",
      data:
        recommendations.berkendara || {
          status: "Aman",
          color: "emerald",
          reason: "Aspal kering",
        },
    },
    {
      name: "Proteksi / Payung",
      icon: "payung",
      data:
        recommendations.perlindungan || {
          status: "Kasual",
          color: "blue",
          reason: "Wajar",
        },
    },
  ];

  container.innerHTML = list
    .map(
      (item) => `
    <div class="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col justify-between">
      <div class="flex items-center space-x-1.5 mb-1">
        <span class="inline-flex items-center justify-center text-slate-700 flex-shrink-0">${getActivityIconSvg(item.icon)}</span>
        <span class="text-[10px] font-bold text-slate-300 truncate">${item.name}</span>
      </div>
      <span class="font-bold text-${item.data.color}-300 text-xs">${item.data.status}</span>
      <span class="text-[9px] text-slate-300 mt-0.5 leading-tight line-clamp-2">${item.data.reason}</span>
    </div>
  `,
    )
    .join("");
}

// 4. Render TEWS Earthquake Card
function renderTEWSGempa(g) {
  if (typeof renderMainEarthquakeCard === "function") {
    renderMainEarthquakeCard(g);
  }
}

// 5. City Weather Detailed Dossier Modal
function openCityDetailModal() {
  if (!STATE.currentData) {
    showToast("Data cuaca belum siap.");
    return;
  }
  const data = STATE.currentData;
  const cur = data.current || {};
  const lok = data.lokasi || {};
  const forecast = data.forecast || [];

  const modal = document.getElementById("city-detail-modal");
  document.getElementById("modal-detail-title").textContent =
    `Dossier Cuaca: ${lok.kotkab || lok.desa || "Indonesia"}`;
  document.getElementById("modal-detail-subtitle").textContent =
    `${lok.kecamatan ? lok.kecamatan + ", " : ""}${lok.provinsi || ""} • Kode ADM4: ${lok.adm4 || ""}`;

  const metricsContainer = document.getElementById("modal-detail-metrics");
  if (metricsContainer) {
    const items = [
      {
        label: "Suhu Udara",
        val: `${formatTemp(cur.t)}°${STATE.unit}`,
        sub: `Terasa ${formatTemp(cur.feelsLike)}°`,
      },
      {
        label: "Kelembapan Relatif",
        val: `${cur.hu || 0}%`,
        sub: `Titik embun ${formatTemp(cur.dewPoint)}°`,
      },
      {
        label: "Kecepatan Angin",
        val: `${cur.ws || 0} km/j`,
        sub: `${Math.round((cur.ws || 0) * 0.54 * 10) / 10} kt (${cur.wd || "NW"})`,
      },
      {
        label: "Curah Hujan",
        val: `${cur.tp || 0} mm`,
        sub: "Presipitasi saat ini",
      },
      {
        label: "Tutupan Awan",
        val: `${cur.tcc || 0}%`,
        sub: cur.weather_desc || "Berawan",
      },
      {
        label: "Indeks Radiasi UV",
        val: `${cur.uvIndex || 0}`,
        sub: "Kategori BMKG",
      },
      {
        label: "Zona Waktu",
        val: `${lok.timezone || "WIB"}`,
        sub: `UTC+${lok.timezone === "WIT" ? 9 : lok.timezone === "WITA" ? 8 : 7}`,
      },
      {
        label: "Koordinat GPS",
        val: `${lok.lat || 0}°, ${lok.lon || 0}°`,
        sub: "Geografis Resmi",
      },
    ];

    metricsContainer.innerHTML = items
      .map(
        (i) => `
      <div class="p-3 rounded-xl bg-white/[0.04] border border-white/10">
        <span class="text-[10px] text-slate-400 block">${i.label}</span>
        <span class="text-base font-bold text-white mt-0.5 block">${i.val}</span>
        <span class="text-[10px] text-cyan-300 block truncate">${i.sub}</span>
      </div>
    `,
      )
      .join("");
  }

  const tbody = document.getElementById("modal-detail-forecast-tbody");
  if (tbody) {
    tbody.innerHTML = forecast
      .map((f, idx) => {
        const d = new Date(f.local_datetime || f.datetime);
        const dayLabel = idx < 8 ? "Hari Ini" : idx < 16 ? "Besok" : "Lusa";
        const timeStr = d.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `
        <tr class="hover:bg-white/[0.03] transition-colors">
          <td class="p-2 font-mono"><span class="text-[10px] text-slate-400 block">${dayLabel}</span>${timeStr}</td>
          <td class="p-2 font-medium text-cyan-200">${f.weather_desc || "-"}</td>
          <td class="p-2 font-bold text-white">${formatTemp(f.t)}°</td>
          <td class="p-2 text-slate-300">${formatTemp(f.feelsLike)}°</td>
          <td class="p-2 text-blue-300">${f.tp || 0} mm</td>
          <td class="p-2 text-slate-300">${f.tcc || 0}%</td>
          <td class="p-2 text-amber-300">${f.ws || 0} km/j</td>
          <td class="p-2 text-teal-300">${f.hu || 0}%</td>
        </tr>
      `;
      })
      .join("");
  }

  if (modal) modal.classList.remove("hidden");
}

function closeCityDetailModal() {
  const modal = document.getElementById("city-detail-modal");
  if (modal) modal.classList.add("hidden");
}

// 6. Weather Comparison Modal
function openCompareModal() {
  const modal = document.getElementById("compare-modal");
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");

  if (selA && selB && STATE.wilayahList.length > 0) {
    const optionsHtml = STATE.wilayahList
      .map(
        (w) =>
          `<option value="${w.adm4}" class="bg-white text-slate-800">${w.name} (${w.provinsi})</option>`,
      )
      .join("");
    selA.innerHTML = optionsHtml;
    selB.innerHTML = optionsHtml;
    selA.value = STATE.currentAdm4;
    selB.value =
      STATE.wilayahList.find((w) => w.adm4 !== STATE.currentAdm4)?.adm4 ||
      STATE.wilayahList[1].adm4;
  }

  updateComparison();
  if (modal) modal.classList.remove("hidden");
}

function closeCompareModal() {
  const modal = document.getElementById("compare-modal");
  if (modal) modal.classList.add("hidden");
}

async function updateComparison() {
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  const container = document.getElementById("compare-results-container");
  if (!selA || !selB || !container) return;

  container.innerHTML = `<div class="col-span-2 text-center p-6 text-xs text-cyan-300 font-medium animate-pulse">Mengambil data perbandingan cuaca BMKG...</div>`;

  try {
    const [resA, resB] = await Promise.all([
      fetch(`/api/cuaca?adm4=${encodeURIComponent(selA.value)}`).then((r) =>
        r.json(),
      ),
      fetch(`/api/cuaca?adm4=${encodeURIComponent(selB.value)}`).then((r) =>
        r.json(),
      ),
    ]);

    const curA = resA.current || {};
    const curB = resB.current || {};
    const lokA = resA.lokasi || {};
    const lokB = resB.lokasi || {};
    const iconSrcA = typeof getWeatherIcon === "function" ? getWeatherIcon(curA.weather_desc, curA.weather) : "icons/berawan.svg";
    const iconSrcB = typeof getWeatherIcon === "function" ? getWeatherIcon(curB.weather_desc, curB.weather) : "icons/berawan.svg";

    container.innerHTML = `
      <div class="p-4 rounded-2xl bg-white/[0.04] border border-cyan-400/30 space-y-3">
        <div class="border-b border-white/10 pb-2">
          <h5 class="text-sm font-bold text-white">${lokA.kotkab || lokA.desa || "Wilayah A"}</h5>
          <p class="text-[11px] text-cyan-300">${lokA.provinsi}</p>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-3xl font-black text-white font-heading">${formatTemp(curA.t)}°${STATE.unit}</span>
          <span class="text-xs font-semibold text-cyan-200 inline-flex items-center gap-1.5"><img src="${iconSrcA}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-5 h-5 object-contain" /> ${curA.weather_desc || "-"}</span>
        </div>
        <div class="space-y-1.5 text-xs text-slate-300">
          <div class="flex justify-between"><span>Suhu Terasa:</span><span class="font-bold text-white">${formatTemp(curA.feelsLike)}°</span></div>
          <div class="flex justify-between"><span>Kelembapan:</span><span class="font-bold text-white">${curA.hu}%</span></div>
          <div class="flex justify-between"><span>Angin:</span><span class="font-bold text-white">${curA.ws} km/j</span></div>
          <div class="flex justify-between"><span>Curah Hujan:</span><span class="font-bold text-white">${curA.tp || 0} mm</span></div>
          <div class="flex justify-between"><span>Indeks UV:</span><span class="font-bold text-white">${curA.uvIndex || 0}</span></div>
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-white/[0.04] border border-blue-400/30 space-y-3">
        <div class="border-b border-white/10 pb-2">
          <h5 class="text-sm font-bold text-white">${lokB.kotkab || lokB.desa || "Wilayah B"}</h5>
          <p class="text-[11px] text-blue-300">${lokB.provinsi}</p>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-3xl font-black text-white font-heading">${formatTemp(curB.t)}°${STATE.unit}</span>
          <span class="text-xs font-semibold text-blue-200 inline-flex items-center gap-1.5"><img src="${iconSrcB}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-5 h-5 object-contain" /> ${curB.weather_desc || "-"}</span>
        </div>
        <div class="space-y-1.5 text-xs text-slate-300">
          <div class="flex justify-between"><span>Suhu Terasa:</span><span class="font-bold text-white">${formatTemp(curB.feelsLike)}°</span></div>
          <div class="flex justify-between"><span>Kelembapan:</span><span class="font-bold text-white">${curB.hu}%</span></div>
          <div class="flex justify-between"><span>Angin:</span><span class="font-bold text-white">${curB.ws} km/j</span></div>
          <div class="flex justify-between"><span>Curah Hujan:</span><span class="font-bold text-white">${curB.tp || 0} mm</span></div>
          <div class="flex justify-between"><span>Indeks UV:</span><span class="font-bold text-white">${curB.uvIndex || 0}</span></div>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="col-span-2 text-center text-xs text-rose-400">Gagal memuat komparasi data cuaca.</div>`;
  }
}

// 7. Official BMKG Warnings Modal
function openOfficialAlertsModal() {
  const modal = document.getElementById("official-alerts-modal");
  const container = document.getElementById("official-alerts-list");
  if (!container) return;

  const alerts = (STATE.currentData && STATE.currentData.smartAlerts) || [];
  const gempa = STATE.gempaData;

  let itemsHtml = "";
  if (gempa && gempa.Magnitude) {
    itemsHtml += `
      <div class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1">
        <div class="flex items-center space-x-1.5 text-rose-400 text-xs font-bold">
          <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>BULETIN SEISMOLOGI & GEOFISIKA BMKG</span>
        </div>
        <h5 class="text-xs font-bold text-white">Gempa Bumi M ${escapeHtml(String(gempa.Magnitude ?? "--"))} • ${escapeHtml(formatGempaWilayah(gempa.Wilayah, "--"))}</h5>
        <p class="text-[11px] text-slate-300">Kedalaman ${gempa.Kedalaman} pada ${gempa.Tanggal} ${gempa.Jam}. ${gempa.Potensi || ""}</p>
      </div>
    `;
  }

  if (alerts.length > 0) {
    itemsHtml += alerts
      .map(
        (a) => `
      <div class="p-3 rounded-xl ${a.level === "danger" ? "bg-rose-950/40 border border-rose-500/40" : a.level === "warning" ? "bg-amber-950/40 border border-amber-500/40" : "bg-emerald-950/40 border border-emerald-500/40"} space-y-1">
        <div class="flex items-center space-x-1.5 ${a.level === "danger" ? "text-rose-400" : a.level === "warning" ? "text-amber-400" : "text-emerald-400"} text-xs font-bold">
          <span>PERINGATAN METEOROLOGI BMKG</span>
        </div>
        <h5 class="text-xs font-bold text-white">${a.title}</h5>
        <p class="text-[11px] text-slate-200">${a.message}</p>
        <p class="text-[10px] text-slate-400 italic">Mitigasi: ${a.advice}</p>
      </div>
    `,
      )
      .join("");
  } else {
    itemsHtml += `<div class="p-4 text-center text-xs text-slate-400">Tidak ada peringatan cuaca ekstrem aktif untuk saat ini.</div>`;
  }

  container.innerHTML = itemsHtml;
  if (modal) modal.classList.remove("hidden");
}

function closeOfficialAlertsModal() {
  const modal = document.getElementById("official-alerts-modal");
  if (modal) modal.classList.add("hidden");
}

// 8. Data Saver Mode
function initDataSaver() {
  const saved = localStorage.getItem("skyvanta_datasaver") === "true";
  STATE.dataSaver = saved;
  const btn = document.getElementById("btn-toggle-datasaver");
  const label = document.getElementById("label-datasaver");
  const bgVideo = document.getElementById("bg-video");

  if (saved) {
    document.body.classList.add("data-saver");
    if (label) label.textContent = "Hemat Data: Aktif";
    if (btn) btn.classList.add("active");
    if (bgVideo) bgVideo.pause();
  }
}

function toggleDataSaver() {
  STATE.dataSaver = !STATE.dataSaver;
  localStorage.setItem("skyvanta_datasaver", STATE.dataSaver);
  const btn = document.getElementById("btn-toggle-datasaver");
  const label = document.getElementById("label-datasaver");
  const bgVideo = document.getElementById("bg-video");

  if (STATE.dataSaver) {
    document.body.classList.add("data-saver");
    if (label) label.textContent = "Hemat Data: Aktif";
    if (btn) btn.classList.add("active");
    if (bgVideo) bgVideo.pause();
    showToast(
      "Mode hemat data aktif: Latar belakang video & partikel dinonaktifkan.",
    );
  } else {
    document.body.classList.remove("data-saver");
    if (label) label.textContent = "Hemat Data";
    if (btn) btn.classList.remove("active");
    if (bgVideo && STATE.videoPlaying) bgVideo.play().catch(() => {});
    showToast("Mode normal aktif: Visual HD dipulihkan.");
  }
}

// 9. Share Weather Info
function shareWeatherInfo() {
  if (!STATE.currentData) {
    showToast("Data cuaca belum siap untuk dibagikan.");
    return;
  }
  const cur = STATE.currentData.current || {};
  const lok = STATE.currentData.lokasi || {};
  const text =
    `Cuaca Terkini BMKG di ${lok.kotkab || lok.desa || "Indonesia"}:\n` +
    `Suhu: ${formatTemp(cur.t)}°${STATE.unit} (${cur.weather_desc || "Berawan"})\n` +
    `Terasa: ${formatTemp(cur.feelsLike)}°${STATE.unit} • Kelembapan: ${cur.hu || 0}%\n` +
    `Angin: ${cur.ws || 0} km/j • UV Index: ${cur.uvIndex || 0}\n` +
    `Sumber: BMKG via SKYVANTA Portal Cuaca Resmi`;

  if (navigator.share) {
    navigator
      .share({
        title: `Prakiraan Cuaca BMKG - ${lok.kotkab || lok.desa}`,
        text: text,
        url: window.location.href,
      })
      .catch(() => {});
  } else {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast("✓ Ringkasan cuaca berhasil disalin ke clipboard!");
      })
      .catch(() => {
        showToast("Gagal menyalin teks ringkasan.");
      });
  }
}

// 10. AI Weather Assistant (AeroAI)
function toggleAIAssistant() {
  const modal = document.getElementById("ai-assistant-modal");
  if (!modal) return;
  const isHidden = modal.classList.contains("hidden");
  if (isHidden) {
    modal.classList.remove("hidden");
    const input = document.getElementById("ai-chat-input");
    if (input) input.focus();
  } else {
    modal.classList.add("hidden");
  }
}

function scrollAIPrompts(offset) {
  const container = document.getElementById("ai-quick-chips");
  if (container) {
    container.scrollBy({ left: offset, behavior: "smooth" });
  }
}

function askAIPrompt(text) {
  const input = document.getElementById("ai-chat-input");
  if (input) {
    input.value = text;
    handleAISubmit(new Event("submit"));
  }
}

async function askAssistant(question) {
  try {
    const res = await fetch("/api/ai-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        contextLocation: STATE.aiContextLocation || (STATE.activeLocation ? STATE.activeLocation.name : null),
        location: STATE.activeLocation || STATE.currentData?.lokasi || null,
        weatherContext: STATE.currentData || {},
        gempaContext: STATE.gempaData || {},
      }),
    });
    const json = await res.json();
    if (json.contextLocation) {
      STATE.aiContextLocation = json.contextLocation;
    }
    return json.reply || "Maaf, sistem meteorologi sedang sibuk.";
  } catch (err) {
    console.error("askAssistant error:", err);
    return "Maaf, terjadi kesalahan saat mengambil data.";
  }
}

async function handleAISubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById("ai-chat-input");
  const container = document.getElementById("ai-chat-messages");
  if (!input || !container) return;

  const query = input.value.trim();
  if (!query) return;

  // Append User Message with stylish bubble
  const userMsgHtml = `
    <div class="ai-msg ai-msg--user flex justify-end mb-3 w-full animate-bubble-in">
      <div class="ai-bubble ai-bubble--user max-w-[84%] px-4 py-3 rounded-2xl rounded-br-xs text-xs font-semibold text-slate-800 shadow-md bg-white/90 backdrop-blur-xl border border-white/95">
        ${escapeHtml(query)}
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", userMsgHtml);
  input.value = "";
  container.scrollTop = container.scrollHeight;

  // Append Loading Indicator
  const loadingId = "ai-loading-" + Date.now();
  const loadingHtml = `
    <div id="${loadingId}" class="ai-msg ai-msg--bot flex items-start gap-2.5 mb-3 w-full animate-bubble-in">
      <div class="ai-avatar w-7 h-7 rounded-full bg-white/90 border border-slate-200 text-sky-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        AI
      </div>
      <div class="ai-bubble ai-bubble--bot ai-bubble--loading max-w-[86%] px-4 py-3 rounded-2xl rounded-tl-xs text-xs text-slate-700 bg-white/90 backdrop-blur-xl border border-white/95 shadow-md flex items-center gap-2">
        <span class="ai-dot w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
        <span class="text-slate-600 font-medium">AeroAI menganalisis data meteorologi BMKG…</span>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", loadingHtml);
  container.scrollTop = container.scrollHeight;

  try {
    const reply = await askAssistant(query);

    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    const formattedReply = typeof formatMarkdownReply === "function"
      ? formatMarkdownReply(reply)
      : reply.replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>");

    const botMsgHtml = `
      <div class="ai-msg ai-msg--bot flex items-start gap-2.5 mb-3 w-full animate-bubble-in">
        <div class="ai-avatar w-7 h-7 rounded-full bg-white/90 border border-slate-200 text-sky-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          AI
        </div>
        <div class="ai-bubble ai-bubble--bot max-w-[86%] px-4 py-3.5 rounded-2xl rounded-tl-xs text-xs text-slate-800 bg-white/90 backdrop-blur-xl border border-white/95 shadow-lg leading-relaxed">
          <div class="space-y-1.5 text-slate-800">${formattedReply}</div>
          <span class="ai-source block text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/80 italic">Sumber: Jaringan Stasiun Meteorologi BMKG</span>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", botMsgHtml);
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    showToast("Gagal menghubungi AI Assistant.");
  }
}

function escapeHtml(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag] || tag,
  );
}

// 11. Map Mode & Regional Risks
async function loadRegionalRisks() {
  try {
    const res = await fetchWithTimeout("/api/cuaca/risiko", {}, 6000);
    const json = await res.json();
    if (json.success && json.data) {
      STATE.regionalRisks = json.data;
    }
  } catch (e) {}
}

function setMapMode(mode) {
  STATE.mapMode = mode;
  const btnTemp = document.getElementById("btn-map-mode-temp");
  const btnRisk = document.getElementById("btn-map-mode-risk");

  if (mode === "risk") {
    if (btnRisk) btnRisk.classList.add("active");
    if (btnTemp) btnTemp.classList.remove("active");
    showToast("Peta Risiko Cuaca Ekstrem aktif.");
  } else {
    if (btnTemp) btnTemp.classList.add("active");
    if (btnRisk) btnRisk.classList.remove("active");
    showToast("Peta Suhu Ibukota aktif.");
  }
  renderVectorMapPins();
}

// 12. Live Clock
function startLiveClock() {
  const clockEl = document.getElementById("footer-live-clock");
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    clockEl.textContent =
      now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " WIB";
  };
  update();
  setInterval(update, 1000);
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
  window.loadEarthquakeData = loadEarthquakeData;
  window.renderTEWSGempa = renderTEWSGempa;
  window.renderMainEarthquakeCard = renderMainEarthquakeCard;
  window.renderEarthquakeRecentList = renderEarthquakeRecentList;
  window.renderEarthquakeMapPins = renderEarthquakeMapPins;
  window.initEarthquakeLeafletMap = initEarthquakeLeafletMap;
  window.focusEarthquake = focusEarthquake;
  window.showEarthquakeTooltip = showEarthquakeTooltip;
  window.hideEarthquakeTooltip = hideEarthquakeTooltip;
  window.refreshWeatherData = refreshWeatherData;
  window.openCityDetailModal = openCityDetailModal;
  window.closeCityDetailModal = closeCityDetailModal;
  window.openCompareModal = openCompareModal;
  window.closeCompareModal = closeCompareModal;
  window.updateComparison = updateComparison;
  window.openOfficialAlertsModal = openOfficialAlertsModal;
  window.closeOfficialAlertsModal = closeOfficialAlertsModal;
  window.toggleDataSaver = toggleDataSaver;
  window.shareWeatherInfo = shareWeatherInfo;
  window.toggleAIAssistant = toggleAIAssistant;
  window.askAssistant = askAssistant;
  window.scrollAIPrompts = scrollAIPrompts;
  window.askAIPrompt = askAIPrompt;
  window.handleAISubmit = handleAISubmit;
  window.setMapMode = setMapMode;
  window.filterByProvince = filterByProvince;
  window.clearSearchHistory = clearSearchHistory;

  // Horizontal mousewheel support for AI Quick Chips
  const aiChipsContainer = document.getElementById("ai-quick-chips");
  if (aiChipsContainer) {
    aiChipsContainer.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          aiChipsContainer.scrollLeft += e.deltaY;
        }
      },
      { passive: false }
    );
  }

  // Keyboard accessibility
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeCityDetailModal();
      closeCompareModal();
      closeAnalyticsCompareModal();
      closeOfficialAlertsModal();
      closeGempaModal();
      const aiModal = document.getElementById("ai-assistant-modal");
      if (aiModal) aiModal.classList.add("hidden");
    }
  });
}

// Weather Analytics Exports
function exportWeatherCSV() {
  if (!STATE.currentData) {
    showToast("Tidak ada data untuk diexport.");
    return;
  }
  const cur = STATE.currentData.current || {};
  const forecast = STATE.currentData.forecast || [];
  const lok = STATE.currentData.lokasi || {};
  const csvRows = [
    "Tanggal,Waktu,Lokasi,Suhu,Kelembapan,Curah_Hujan,Kecepatan_Angin,UV_Index,Deskripsi",
  ];
  const curDate = new Date(cur.local_datetime || cur.datetime);
  csvRows.push(
    `${curDate.toLocaleDateString("id-ID")},${curDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })},${lok.kotkab || lok.desa || "Wilayah"},${cur.t},${cur.hu || 0},${cur.tp || 0},${cur.ws || 0},${cur.uvIndex || 0},${cur.weather_desc || ""}`,
  );
  const forecastLimit = forecast.slice(-24);
  forecastLimit.forEach((f) => {
    const date = new Date(f.local_datetime || f.datetime).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const fDate = new Date(f.local_datetime || f.datetime);
    csvRows.push(
      `${fDate.toLocaleDateString("id-ID")},${date},${lok.kotkab || lok.desa || "Wilayah"},${f.t},${f.hu || 0},${f.tp || 0},${f.ws || 0},${f.uvIndex || 0},${f.weather_desc || ""}`,
    );
  });
  // BOM agar Excel membaca UTF-8 dengan benar
  const blob = new Blob(["\ufeff" + csvRows.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "weather-data-" + new Date().toLocaleDateString("id-ID") + ".csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Data cuaca diexport sebagai CSV");
}

function exportWeatherPNG() {
  if (!STATE.chartInstance) {
    showToast("Tidak ada grafik untuk diexport.");
    return;
  }
  const link = STATE.chartInstance.toBase64Image();
  const el = document.createElement("a");
  el.href = link;
  el.download = "weather-chart-" + new Date().toLocaleDateString("id-ID") + ".png";
  el.click();
  showToast("Grafik diexport sebagai PNG");
}

function calculateComfortIndex(temp, humidity, windSpeed) {
  // Indeks relatif 0-10 dari suhu, kelembapan, dan angin (bukan parameter BMKG)
  if (temp <= 22) return 10;
  if (temp >= 32) return 0;
  if (humidity >= 85) return 3;
  if (humidity <= 60) return 8;
  if (windSpeed > 15) return Math.max(0, 8 - windSpeed / 10);
  if (windSpeed < 5) return Math.min(10, 8 + (5 - windSpeed) / 2);
  const base = 5 + (temp - 27) * 0.3 - (humidity - 72) * 0.05;
  return Math.max(0, Math.min(10, Math.round(base)));
}

// ==========================================================
// ANALITIK CUACA - bersumber dari prakiraan resmi BMKG
// ==========================================================

const ANALYTICS_COMPARE_COLORS = ["#22d3ee", "#60a5fa", "#f59e0b", "#34d399"];

const ANALYTICS_COMPARE_PARAMS = {
  temp: { label: "Suhu (°C)", get: (f) => f.t },
  feelsLike: { label: "Terasa Seperti (°C)", get: (f) => f.feelsLike },
  rain: { label: "Curah Hujan (mm)", get: (f) => f.tp || 0 },
  humidity: { label: "Kelembapan (%)", get: (f) => f.hu },
  wind: { label: "Kecepatan Angin (km/j)", get: (f) => f.ws },
  clouds: { label: "Tutupan Awan (%)", get: (f) => f.tcc || 0 },
};

function tempForUnit(celsius) {
  if (typeof celsius !== "number" || Number.isNaN(celsius)) return null;
  const value = STATE.unit === "F" ? (celsius * 9) / 5 + 32 : celsius;
  return Math.round(value * 10) / 10;
}

function parseLocalDateTime(value) {
  if (!value) return new Date();
  const normalized = String(value).includes("T")
    ? String(value)
    : String(value).replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? new Date() : d;
}

function analyticsForecast() {
  const source = STATE.analyticsData || STATE.currentData;
  if (!source) return [];
  const forecast = source.forecast || [];
  if (STATE.analyticsPeriod === "24h") return forecast.slice(0, 8);
  return forecast;
}

function analyticsLocationLabel() {
  const source = STATE.analyticsData || STATE.currentData;
  if (!source) return "--";
  const lok = source.lokasi || {};
  return lok.kotkab || lok.desa || "Wilayah";
}

function initAnalyticsControls() {
  const select = document.getElementById("analytics-location-select");
  if (select && STATE.wilayahList.length) {
    const previous = select.value;
    select.innerHTML =
      '<option value="">Lokasi Aktif (Otomatis)</option>' +
      STATE.wilayahList
        .map((w) => `<option value="${w.adm4}">${w.name}</option>`)
        .join("");
    select.value = previous || "";
  }
  const period = document.getElementById("analytics-period-select");
  if (period) period.value = STATE.analyticsPeriod || "all";
}

// Muat data untuk bagian analitik (lokasi aktif atau lokasi pilihan)
async function loadAnalyticsData() {
  const locSelect = document.getElementById("analytics-location-select");
  const periodSelect = document.getElementById("analytics-period-select");
  if (periodSelect) STATE.analyticsPeriod = periodSelect.value || "all";

  const adm4 = locSelect ? locSelect.value : "";
  STATE.analyticsPinnedAdm4 = adm4 || null;

  if (!adm4) {
    STATE.analyticsData = null;
  } else if (STATE.analyticsCache[adm4]) {
    STATE.analyticsData = STATE.analyticsCache[adm4];
  } else {
    setAnalyticsStatus("Memuat prakiraan BMKG untuk lokasi ini\u2026");
    try {
      const res = await fetch(`/api/cuaca?adm4=${encodeURIComponent(adm4)}`);
      const json = await res.json();
      if (!json.success) {
        const message = json.message || "Gagal memuat data analitik lokasi.";
        showToast(message);
        setAnalyticsStatus(`Data analitik tidak dapat dimuat: ${message}`);
        return;
      }
      STATE.analyticsCache[adm4] = json;
      STATE.analyticsData = json;
    } catch (e) {
      console.error("Analytics fetch error:", e);
      showToast("Gagal memuat data analitik lokasi.");
      setAnalyticsStatus(
        "Gagal memuat data analitik. Periksa koneksi lalu pilih lokasi kembali.",
      );
      return;
    }
  }

  renderAnalytics();
}


function setAnalyticsStatus(message) {
  const emptyEl = document.getElementById("analytics-chart-empty");
  const canvas = document.getElementById("analytics-chart");
  if (!emptyEl) return;
  if (message) {
    emptyEl.textContent = message;
    emptyEl.classList.remove("hidden");
    emptyEl.classList.add("flex");
    if (canvas) canvas.classList.add("hidden");
  } else {
    emptyEl.classList.add("hidden");
    emptyEl.classList.remove("flex");
    if (canvas) canvas.classList.remove("hidden");
  }
}

function renderAnalytics() {
  const forecast = analyticsForecast();
  const emptyEl = document.getElementById("analytics-chart-empty");
  const canvas = document.getElementById("analytics-chart");
  const kpiGrid = document.getElementById("analytics-kpi-grid");

  if (!forecast.length) {
    if (emptyEl) {
      emptyEl.classList.remove("hidden");
      emptyEl.classList.add("flex");
    }
    if (canvas) canvas.classList.add("hidden");
    if (kpiGrid) kpiGrid.innerHTML = "";
    ["stats-temp", "stats-rain", "stats-wind"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
    return;
  }

  if (emptyEl) {
    emptyEl.classList.add("hidden");
    emptyEl.classList.remove("flex");
  }
  if (canvas) canvas.classList.remove("hidden");

  renderAnalyticsKPIs(forecast);
  renderAnalyticsStats(forecast);
  updateAnalyticsChart();

  const updated = document.getElementById("analytics-last-updated");
  if (updated) {
    const source = STATE.analyticsData || STATE.currentData;
    updated.textContent = `BMKG • ${analyticsLocationLabel()} • ${source?.lastUpdatedFormatted || "--"}`;
  }
}

function analyticsKpiCard(label, value, sub, colorClass, iconSvg) {
  return `
    <div class="glass-subcard p-4 rounded-xl">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">${label}</span>
        <svg class="w-4 h-4 ${colorClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvg}</svg>
      </div>
      <div class="text-xl font-bold text-white">${value}</div>
      <div class="text-[11px] text-slate-400 mt-0.5">${sub}</div>
    </div>
  `;
}

function renderAnalyticsKPIs(forecast) {
  const grid = document.getElementById("analytics-kpi-grid");
  if (!grid) return;

  const temps = forecast.map((f) => f.t).filter((v) => typeof v === "number");
  const rains = forecast.map((f) => f.tp || 0);
  const winds = forecast.map((f) => f.ws || 0);
  const comforts = forecast.map((f) =>
    calculateComfortIndex(f.t, f.hu || 0, f.ws || 0),
  );

  const avg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const rainPoints = rains.filter((r) => r > 0).length;

  const statusCount = {};
  forecast.forEach((f) => {
    const status = f.comfort?.status || "Normal";
    statusCount[status] = (statusCount[status] || 0) + 1;
  });
  let dominantComfort = "--";
  let bestCount = 0;
  Object.keys(statusCount).forEach((key) => {
    if (statusCount[key] > bestCount) {
      bestCount = statusCount[key];
      dominantComfort = key;
    }
  });

  const minTemp = temps.length
    ? Math.round(tempForUnit(Math.min(...temps)))
    : "--";
  const maxTemp = temps.length
    ? Math.round(tempForUnit(Math.max(...temps)))
    : "--";
  const avgTemp = temps.length ? Math.round(tempForUnit(avg(temps))) : "--";
  const totalRain = Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10;
  const avgWind = Math.round(avg(winds) * 10) / 10;
  const maxWind = Math.round(Math.max(...winds) * 10) / 10;
  const avgComfort = Math.round(avg(comforts) * 10) / 10;

  grid.innerHTML = [
    analyticsKpiCard(
      "Suhu Rata-rata",
      `${avgTemp}°${STATE.unit}`,
      `Min ${minTemp}° / Maks ${maxTemp}°`,
      "text-cyan-400",
      '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>',
    ),
    analyticsKpiCard(
      "Total Curah Hujan",
      `${totalRain} mm`,
      `${rainPoints} dari ${forecast.length} titik prakiraan`,
      "text-blue-400",
      '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',
    ),
    analyticsKpiCard(
      "Kecepatan Angin",
      `${avgWind} km/j`,
      `Maks ${maxWind} km/j • Rata-rata`,
      "text-amber-400",
      '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2"></path>',
    ),
    analyticsKpiCard(
      "Indeks Kenyamanan",
      `${avgComfort}/10`,
      dominantComfort,
      "text-emerald-400",
      '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>',
    ),
  ].join("");
}

function renderAnalyticsStats(forecast) {
  const row = (label, value) => `
    <div class="flex items-center justify-between gap-2">
      <span class="text-slate-400">${label}</span>
      <span class="font-semibold text-white">${value}</span>
    </div>
  `;
  const avg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Suhu
  const temps = forecast.map((f) => f.t).filter((v) => typeof v === "number");
  const tempEl = document.getElementById("stats-temp");
  if (tempEl) {
    if (!temps.length) {
      tempEl.innerHTML = '<span class="text-slate-400">Data suhu tidak tersedia</span>';
    } else {
      tempEl.innerHTML = [
        row("Terendah", `${Math.round(tempForUnit(Math.min(...temps)))}°${STATE.unit}`),
        row("Tertinggi", `${Math.round(tempForUnit(Math.max(...temps)))}°${STATE.unit}`),
        row("Rata-rata", `${Math.round(tempForUnit(avg(temps)))}°${STATE.unit}`),
        row(
          "Amplitudo",
          `${Math.round(
            tempForUnit(Math.max(...temps)) - tempForUnit(Math.min(...temps)),
          )}°`,
        ),
      ].join("");
    }
  }

  // Curah hujan
  const rains = forecast.map((f) => f.tp || 0);
  const rainEl = document.getElementById("stats-rain");
  if (rainEl) {
    const totalRain = Math.round(rains.reduce((a, b) => a + b, 0) * 10) / 10;
    rainEl.innerHTML = [
      row("Total", `${totalRain} mm`),
      row("Maks / titik", `${Math.round(Math.max(...rains) * 10) / 10} mm`),
      row("Titik hujan", `${rains.filter((r) => r > 0).length}`),
      row("Rata-rata", `${Math.round(avg(rains) * 10) / 10} mm`),
    ].join("");
  }

  // Angin & kelembapan
  const winds = forecast.map((f) => f.ws || 0);
  const humidities = forecast.map((f) => f.hu || 0);
  const windEl = document.getElementById("stats-wind");
  if (windEl) {
    windEl.innerHTML = [
      row("Angin rata-rata", `${Math.round(avg(winds) * 10) / 10} km/j`),
      row("Angin maks", `${Math.round(Math.max(...winds) * 10) / 10} km/j`),
      row("RH rata-rata", `${Math.round(avg(humidities))}%`),
      row("RH terendah", `${Math.round(Math.min(...humidities))}%`),
    ].join("");
  }
}

function switchAnalyticsTab(tab) {
  STATE.analyticsTab = tab;
  ["temp", "rain", "wind", "comfort"].forEach((t) => {
    const btn = document.getElementById(`analytics-tab-${t}`);
    if (!btn) return;
    if (t === tab) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  updateAnalyticsChart();
}

function analyticsDatasets(forecast, tab) {
  const unit = STATE.unit;
  if (tab === "rain") {
    return [
      {
        type: "bar",
        label: "Curah Hujan (mm)",
        data: forecast.map((f) => f.tp || 0),
        backgroundColor: "rgba(56, 189, 248, 0.65)",
        borderColor: "#38bdf8",
        borderRadius: 4,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Tutupan Awan (%)",
        data: forecast.map((f) => f.tcc || 0),
        borderColor: "#a855f7",
        backgroundColor: "rgba(168, 85, 247, 0.12)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        yAxisID: "y1",
      },
    ];
  }

  if (tab === "wind") {
    return [
      {
        type: "line",
        label: "Kecepatan Angin (km/jam)",
        data: forecast.map((f) => f.ws || 0),
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.12)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Kelembapan Udara (%)",
        data: forecast.map((f) => f.hu || 0),
        borderColor: "#14b8a6",
        borderDash: [4, 4],
        borderWidth: 1.8,
        tension: 0.3,
        fill: false,
        pointRadius: 2,
        yAxisID: "y1",
      },
    ];
  }

  if (tab === "comfort") {
    return [
      {
        type: "line",
        label: "Indeks Kenyamanan (0-10, hasil hitung)",
        data: forecast.map((f) =>
          calculateComfortIndex(f.t, f.hu || 0, f.ws || 0),
        ),
        borderColor: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.12)",
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
        yAxisID: "y",
      },
    ];
  }

  return [
    {
      type: "line",
      label: `Suhu (°${unit})`,
      data: forecast.map((f) =>
        unit === "F" ? Math.round(((f.t * 9) / 5 + 32) * 10) / 10 : f.t,
      ),
      borderColor: "#06b6d4",
      backgroundColor: "rgba(6, 182, 212, 0.12)",
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
      pointRadius: 2,
      yAxisID: "y",
    },
    {
      type: "line",
      label: `Terasa Seperti (°${unit})`,
      data: forecast.map((f) =>
        unit === "F" && typeof f.feelsLike === "number"
          ? Math.round(((f.feelsLike * 9) / 5 + 32) * 10) / 10
          : f.feelsLike,
      ),
      borderColor: "#3b82f6",
      borderDash: [5, 5],
      borderWidth: 1.8,
      tension: 0.4,
      fill: false,
      pointRadius: 2,
      yAxisID: "y",
    },
    {
      type: "line",
      label: `Titik Embun (°${unit})`,
      data: forecast.map((f) =>
        unit === "F" && typeof f.dewPoint === "number"
          ? Math.round(((f.dewPoint * 9) / 5 + 32) * 10) / 10
          : f.dewPoint,
      ),
      borderColor: "#10b981",
      borderWidth: 1.5,
      tension: 0.4,
      fill: false,
      pointRadius: 2,
      yAxisID: "y",
    },
  ];
}

function updateAnalyticsChart() {
  const canvas = document.getElementById("analytics-chart");
  if (!canvas || typeof Chart === "undefined") return;

  const forecast = analyticsForecast();
  if (!forecast.length) return;

  const tab = STATE.analyticsTab || "temp";
  const labels = forecast.map((f) => {
    const d = parseLocalDateTime(f.local_datetime || f.datetime);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  if (STATE.analyticsChartInstance) {
    STATE.analyticsChartInstance.destroy();
    STATE.analyticsChartInstance = null;
  }

  const dualAxis = tab === "rain" || tab === "wind";

  STATE.analyticsChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: analyticsDatasets(forecast, tab) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#cbd5e1",
            font: {
              family: "Plus Jakarta Sans",
              size: 11,
              weight: "500",
            },
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
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 9,
          },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
          ...(tab === "comfort"
            ? { suggestedMin: 0, suggestedMax: 10 }
            : {}),
        },
        ...(dualAxis
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

  const disclaimer = document.getElementById("analytics-disclaimer");
  if (disclaimer) {
    if (tab === "comfort") disclaimer.classList.remove("hidden");
    else disclaimer.classList.add("hidden");
  }
}

// ---------- Perbandingan antar lokasi ----------

function populateCompareSelects() {
  ["1", "2", "3", "4"].forEach((n) => {
    const select = document.getElementById(`compare-analytics-${n}`);
    if (!select || select.dataset.ready === "1" || !STATE.wilayahList.length) {
      return;
    }
    const previous = select.value;
    select.innerHTML =
      '<option value="">— Tidak dipilih —</option>' +
      STATE.wilayahList
        .map((w) => `<option value="${w.adm4}">${w.name}</option>`)
        .join("");
    select.dataset.ready = "1";
    if (previous) select.value = previous;
  });
}

function openAnalyticsCompareModal() {
  const modal = document.getElementById("analytics-compare-modal");
  if (!modal) return;
  populateCompareSelects();

  const first = document.getElementById("compare-analytics-1");
  const second = document.getElementById("compare-analytics-2");
  const baseAdm4 = STATE.analyticsPinnedAdm4 || STATE.currentAdm4;
  if (first && !first.value) first.value = baseAdm4;
  if (second && !second.value) {
    const other = STATE.wilayahList.find((w) => w.adm4 !== baseAdm4);
    if (other) second.value = other.adm4;
  }

  modal.classList.remove("hidden");
  updateAnalyticsComparison();
}

function closeAnalyticsCompareModal() {
  const modal = document.getElementById("analytics-compare-modal");
  if (modal) modal.classList.add("hidden");
}

async function updateAnalyticsComparison() {
  const paramKey =
    document.getElementById("compare-analytics-param")?.value || "temp";
  const param = ANALYTICS_COMPARE_PARAMS[paramKey] || ANALYTICS_COMPARE_PARAMS.temp;

  const selected = [];
  ["1", "2", "3", "4"].forEach((n) => {
    const value = document.getElementById(`compare-analytics-${n}`)?.value;
    if (value && !selected.includes(value)) selected.push(value);
  });

  const canvas = document.getElementById("analytics-compare-chart");
  const statsEl = document.getElementById("analytics-compare-stats");
  if (!canvas) return;

  if (!selected.length) {
    if (STATE.compareChartInstance) {
      STATE.compareChartInstance.destroy();
      STATE.compareChartInstance = null;
    }
    if (statsEl) {
      statsEl.innerHTML =
        '<p class="text-xs text-slate-400 col-span-full">Pilih minimal satu lokasi untuk dibandingkan.</p>';
    }
    return;
  }

  const requestId = (STATE.compareRequestId || 0) + 1;
  STATE.compareRequestId = requestId;

  const sources = await Promise.all(
    selected.map(async (adm4) => {
      if (STATE.compareCache[adm4]) return STATE.compareCache[adm4];
      try {
        const res = await fetch(`/api/cuaca?adm4=${encodeURIComponent(adm4)}`);
        const json = await res.json();
        if (json.success) {
          STATE.compareCache[adm4] = json;
          return json;
        }
      } catch (e) {
        console.error("Compare fetch error:", adm4, e);
      }
      return null;
    }),
  );

  if (STATE.compareRequestId !== requestId) return;

  const valid = sources.filter(Boolean);
  if (!valid.length) {
    if (statsEl) {
      statsEl.innerHTML =
        '<p class="text-xs text-slate-400 col-span-full">Data lokasi tidak dapat dimuat.</p>';
    }
    return;
  }

  const maxPoints = Math.min(...valid.map((s) => (s.forecast || []).length));
  const baseForecast = valid[0].forecast || [];

  const labels = baseForecast.slice(0, maxPoints).map((f) => {
    const d = parseLocalDateTime(f.local_datetime || f.datetime);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  });

  const datasets = valid.map((source, i) => {
    const lok = source.lokasi || {};
    return {
      label: lok.kotkab || lok.desa || `Lokasi ${i + 1}`,
      data: (source.forecast || [])
        .slice(0, maxPoints)
        .map((f) => param.get(f)),
      borderColor: ANALYTICS_COMPARE_COLORS[i % ANALYTICS_COMPARE_COLORS.length],
      backgroundColor:
        ANALYTICS_COMPARE_COLORS[i % ANALYTICS_COMPARE_COLORS.length] + "22",
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    };
  });

  if (STATE.compareChartInstance) STATE.compareChartInstance.destroy();

  STATE.compareChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#cbd5e1",
            font: { family: "Plus Jakarta Sans", size: 11 },
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
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { color: "#94a3b8", font: { size: 10 } },
          title: {
            display: true,
            text: param.label,
            color: "#94a3b8",
            font: { size: 10 },
          },
        },
      },
    },
  });

  if (statsEl) {
    statsEl.innerHTML = valid
      .map((source, i) => {
        const values = (source.forecast || [])
          .slice(0, maxPoints)
          .map((f) => param.get(f))
          .filter((v) => typeof v === "number");
        const lok = source.lokasi || {};
        const avg = values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
        const color =
          ANALYTICS_COMPARE_COLORS[i % ANALYTICS_COMPARE_COLORS.length];
        return `
          <div class="glass-subcard p-3 rounded-xl space-y-1.5">
            <div class="flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full" style="background:${color}"></span>
              <span class="text-[11px] font-semibold text-white truncate">${lok.kotkab || lok.desa || "Lokasi"}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>Rata-rata</span>
              <span class="text-white font-semibold">${Math.round(avg * 10) / 10}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400">
              <span>Min / Maks</span>
              <span class="text-white font-semibold">${values.length ? `${Math.round(Math.min(...values) * 10) / 10} / ${Math.round(Math.max(...values) * 10) / 10}` : "--"}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }
}


// Mobile Drawer Navigation toggle
function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.classList.toggle('open');
}
function closeMobileMenu() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) drawer.classList.remove('open');
}
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;


// Sticky Navbar scroll listener
window.addEventListener('scroll', () => {
  const nav = document.getElementById('main-navbar');
  if (!nav) return;
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });


// ============================================================
// FLOATING NAVBAR "LAINNYA" DROPDOWN
// ============================================================
function toggleNavMoreMenu() {
  const dropdown = document.getElementById("nav-more-dropdown");
  if (!dropdown) return;
  dropdown.classList.toggle("hidden");
}

function closeNavMoreMenu() {
  const dropdown = document.getElementById("nav-more-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  const btn = document.getElementById("btn-nav-more");
  const dropdown = document.getElementById("nav-more-dropdown");
  if (dropdown && !dropdown.classList.contains("hidden")) {
    if (btn && !btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  }
});


// ============================================================
// INTERACTIVE MAP LEGEND POPOVER
// ============================================================
// Rule 6: Tombol Legenda membuka panel legenda saat diklik dan menutupnya saat diklik lagi.
// Panel berisi skala suhu dengan nilai min dan max dari data yang diterima, bukan angka tetap.
// Rule 7: Jika data belum ada, legenda disembunyikan dan panel menampilkan "Data belum tersedia untuk [nama lokasi]".
function toggleMapLegend() {
  const panel = document.getElementById("map-legend-panel");
  const btn = document.getElementById("btn-map-legend");
  if (!panel) return;

  const isHidden = panel.classList.contains("hidden");
  if (isHidden) {
    updateMapLegendContent();
    panel.classList.remove("hidden");
    if (btn) btn.classList.add("active");
  } else {
    panel.classList.add("hidden");
    if (btn) btn.classList.remove("active");
  }
}

function closeMapLegend() {
  const panel = document.getElementById("map-legend-panel");
  const btn = document.getElementById("btn-map-legend");
  if (panel) panel.classList.add("hidden");
  if (btn) btn.classList.remove("active");
}

function updateMapLegendContent() {
  const panel = document.getElementById("map-legend-panel");
  if (!panel) return;

  const currentLoc = window.activeLocation || STATE.activeLocation || {};
  const locName = currentLoc.name || currentLoc.kotkab || "wilayah ini";

  // Collect all available temperatures
  const temps = [];
  if (STATE.mapTemps) {
    Object.values(STATE.mapTemps).forEach((t) => {
      if (typeof t === "number" && !isNaN(t)) temps.push(t);
    });
  }
  if (
    STATE.currentData &&
    STATE.currentData.current &&
    typeof STATE.currentData.current.t === "number"
  ) {
    temps.push(STATE.currentData.current.t);
  }

  // Rule 7: Jika data belum ada, legenda disembunyikan dan panel menampilkan "Data belum tersedia untuk [nama lokasi]"
  if (
    temps.length === 0 ||
    (STATE.currentData && STATE.currentData.isUnavailable)
  ) {
    panel.innerHTML = `
      <div class="p-4 text-center bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl">
        <p class="text-xs font-semibold text-slate-600">Data belum tersedia untuk ${locName}</p>
      </div>
    `;
    return;
  }

  // Rule 6: Panel berisi skala suhu dengan nilai min dan max dari data yang diterima, bukan angka tetap.
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);

  panel.innerHTML = `
    <div class="p-4 space-y-3 text-xs bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl">
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <span class="font-bold text-slate-800 flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-sky-500"></span>
          Legenda Skala Suhu Peta
        </span>
        <button onclick="toggleMapLegend()" class="text-slate-400 hover:text-slate-700 text-sm font-bold leading-none p-1 cursor-pointer">&times;</button>
      </div>

      <!-- Dynamic Temperature Scale (min and max from received data) -->
      <div>
        <div class="flex justify-between items-center text-[11px] font-mono font-bold text-slate-700 mb-1">
          <span class="text-sky-700">Min: ${Math.round(minTemp)}°C</span>
          <span class="text-slate-400 font-normal">Rentang Suhu Terpantau</span>
          <span class="text-rose-700">Max: ${Math.round(maxTemp)}°C</span>
        </div>
        <div class="h-3 w-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 via-amber-400 to-rose-500 shadow-inner"></div>
        <div class="flex justify-between text-[9px] text-slate-500 mt-1 font-medium">
          <span>Sejuk (&lt; 24°C)</span>
          <span>Nyaman (24-28°C)</span>
          <span>Hangat (29-32°C)</span>
          <span>Terik (&gt; 32°C)</span>
        </div>
      </div>

      <!-- Status / Risk scale -->
      <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[10px]">
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span><span class="text-slate-700 font-medium">Risiko Rendah</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span><span class="text-slate-700 font-medium">Risiko Sedang</span></div>
        <div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span><span class="text-slate-700 font-medium">Risiko Tinggi</span></div>
      </div>

      <p class="text-[10px] text-slate-400 pt-1 border-t border-slate-100">Klik pin mana saja untuk memuat data meteorologi stasiun BMKG kota tersebut.</p>
    </div>
  `;
}

function populateMapLegend() {
  updateMapLegendContent();
}
window.toggleMapLegend = toggleMapLegend;
window.closeMapLegend = closeMapLegend;
window.updateMapLegendContent = updateMapLegendContent;



// ============================================================
// 72-HOUR FORECAST VISIBLE SCROLLBAR & DRAG INTERACTION
// ============================================================
function initHourlyScrollbarSync() {
  const carousel = document.getElementById("hourly-carousel");
  const track = document.getElementById("hourly-scrollbar-track");
  const thumb = document.getElementById("hourly-scrollbar-thumb");
  if (!carousel || !track || !thumb) return;

  function updateThumb() {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    if (maxScroll <= 0) {
      thumb.style.width = "100%";
      thumb.style.left = "0%";
      return;
    }
    const ratio = carousel.clientWidth / carousel.scrollWidth;
    const thumbWidthPct = Math.max(12, Math.min(100, ratio * 100));
    const scrollPct = (carousel.scrollLeft / maxScroll) * (100 - thumbWidthPct);
    thumb.style.width = thumbWidthPct + "%";
    thumb.style.left = scrollPct + "%";
  }

  carousel.addEventListener("scroll", updateThumb, { passive: true });
  window.addEventListener("resize", updateThumb);
  setTimeout(updateThumb, 500);

  // PC Desktop Mouse Drag on Track Thumb
  let isDraggingThumb = false;
  let startX = 0;
  let startScrollLeft = 0;

  thumb.addEventListener("mousedown", (e) => {
    isDraggingThumb = true;
    startX = e.clientX;
    startScrollLeft = carousel.scrollLeft;
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDraggingThumb) return;
    const deltaX = e.clientX - startX;
    const trackWidth = track.clientWidth - thumb.clientWidth;
    if (trackWidth <= 0) return;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollLeft = startScrollLeft + (deltaX / trackWidth) * maxScroll;
  });

  window.addEventListener("mouseup", () => {
    if (isDraggingThumb) {
      isDraggingThumb = false;
      document.body.style.userSelect = "";
    }
  });

  // Drag on carousel container directly for PC mouse
  let isDownOnCarousel = false;
  let carouselStartX = 0;
  let carouselScrollLeft = 0;

  carousel.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.closest("select")) return;
    isDownOnCarousel = true;
    carousel.classList.add("is-dragging");
    carouselStartX = e.pageX - carousel.offsetLeft;
    carouselScrollLeft = carousel.scrollLeft;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDownOnCarousel) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - carouselStartX) * 1.5;
    carousel.scrollLeft = carouselScrollLeft - walk;
  });

  window.addEventListener("mouseup", () => {
    if (isDownOnCarousel) {
      isDownOnCarousel = false;
      carousel.classList.remove("is-dragging");
    }
  });
}

function handleTrackClick(e) {
  const carousel = document.getElementById("hourly-carousel");
  const track = document.getElementById("hourly-scrollbar-track");
  const thumb = document.getElementById("hourly-scrollbar-thumb");
  if (!carousel || !track || !thumb || e.target === thumb) return;

  const rect = track.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const trackWidth = rect.width;
  const pct = Math.max(0, Math.min(1, clickX / trackWidth));
  const maxScroll = carousel.scrollWidth - carousel.clientWidth;
  carousel.scrollTo({
    left: pct * maxScroll,
    behavior: "smooth"
  });
}

function updateForecastDisplay() {
  const el = document.getElementById("forecast-parameter-select");
  const param = el ? el.value : "temp";
  if (STATE.currentData) {
    renderHourlyForecast(STATE.currentData);
  }
  return param;
}

function scrollHourlyForecast(offset) {
  const carousel = document.getElementById("hourly-carousel");
  if (carousel) {
    carousel.scrollBy({ left: offset, behavior: "smooth" });
  }
}

window.updateForecastDisplay = updateForecastDisplay;
window.handleTrackClick = handleTrackClick;
window.scrollHourlyForecast = scrollHourlyForecast;

window.toggleNavMoreMenu = toggleNavMoreMenu;
window.closeNavMoreMenu = closeNavMoreMenu;


// Sync 72-Hour Carousel with Custom Scrollbar
function setupHourlyScrollbarSync() {
  const carousel = document.getElementById("hourly-carousel");
  const track = document.getElementById("hourly-scrollbar-track");
  const thumb = document.getElementById("hourly-scrollbar-thumb");
  if (!carousel || !track || !thumb) return;

  function updateThumb() {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    if (maxScroll > 0) {
      const ratio = carousel.scrollLeft / maxScroll;
      const trackWidth = track.clientWidth;
      const thumbWidth = Math.max(50, (carousel.clientWidth / carousel.scrollWidth) * trackWidth);
      thumb.style.width = `${thumbWidth}px`;
      thumb.style.left = `${ratio * (trackWidth - thumbWidth)}px`;
    }
  }

  carousel.addEventListener("scroll", updateThumb, { passive: true });
  window.addEventListener("resize", updateThumb, { passive: true });
  setTimeout(updateThumb, 500);
}

document.addEventListener("DOMContentLoaded", setupHourlyScrollbarSync);

  // Escape key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modals = ["gempa-modal", "ai-assistant-modal", "compare-modal", "official-alerts-modal", "mobile-nav-drawer"];
      modals.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.classList.add("hidden");
          el.classList.remove("open");
        }
      });
    }
  });
  
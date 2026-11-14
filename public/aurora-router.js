/* ============================================================
   SKYVANTA — MULTI-PAGE ROUTER & RAINFALL ENGINE
   ============================================================ */

const PAGE_TITLES = {
  landing: "Beranda SkyVanta",
  dashboard: "Dashboard Cuaca",
  map: "Weather Map Indonesia",
  forecast: "Prakiraan Cuaca 72 Jam & 3 Hari",
  details: "Detail & Visualisasi Parametrik",
  comparison: "Komparasi Cuaca Seluruh Wilayah",
  rainfall: "Peta & Pemantauan Curah Hujan Indonesia",
  ai: "AeroAI Weather Assistant",
  earthquake: "Gempa Bumi & InaTEWS BMKG"
};

const PAGE_ROUTES = ["landing", "dashboard", "map", "forecast", "details", "comparison", "rainfall", "ai", "earthquake"];

var currentCompareA = (window.activeLocation ? window.activeLocation.adm4 : "31.71.01.1001");
var currentCompareB = "35.78.01.1001";

function navigateToPage(pageId, event, options) {
  if (event && event.preventDefault) event.preventDefault();
  if (!PAGE_ROUTES.includes(pageId)) pageId = "landing";

  // 1. Hide all page views
  document.querySelectorAll(".skyvanta-page-view").forEach(el => {
    el.classList.remove("is-active-view");
  });

  // 2. Show targeted page view
  const targetView = document.getElementById("view-" + pageId);
  if (targetView) {
    targetView.classList.add("is-active-view");
  }

  // 3. Update sidebar active state
  document.querySelectorAll(".aurora-nav-btn").forEach(btn => {
    if (btn.getAttribute("data-page") === pageId) {
      btn.classList.add("is-active");
    } else {
      btn.classList.remove("is-active");
    }
  });

  // 4. Update Header Page Title
  const titleEl = document.getElementById("page-title-display");
  if (titleEl) {
    const locName = (window.activeLocation && window.activeLocation.name) ? ` · ${window.activeLocation.name}` : "";
    titleEl.innerHTML = `<span>${PAGE_TITLES[pageId] || "Dashboard Cuaca"}${locName}</span>`;
  }

  // 5. Update browser history & URL
  if (window.location.hash !== "#" + pageId) {
    if (options && options.replaceHistory) {
      window.history.replaceState({ page: pageId }, "", "#" + pageId);
    } else {
      window.history.pushState({ page: pageId }, "", "#" + pageId);
    }
  }

  // Always synchronize titles when navigating to any page
  if (typeof syncAllTitles === "function" && window.activeLocation) {
    syncAllTitles(window.activeLocation);
  }

  // 6. Trigger page-specific re-renders
  // Rule 10: Satu instance peta per halaman. Hancurkan saat unmount.
  if (pageId !== "map" && typeof destroyWeatherMap === "function") {
    destroyWeatherMap();
  }
  // Rule 10: Satu instance peta per halaman. Hancurkan saat unmount.
  if (pageId !== "rainfall" && typeof destroyRainfallMap === "function") {
    destroyRainfallMap();
  }

  if (pageId === "landing") {
    if (typeof renderOverviewCard === "function") {
      renderOverviewCard(STATE.currentData, STATE.currentData?.isUnavailable);
    }
  } else if (pageId === "dashboard") {
    setTimeout(renderAuroraMiniChart, 100);
    setTimeout(renderAuroraSideCities, 100);
  } else if (pageId === "map") {
    setTimeout(renderVectorMapPins, 100);
    setTimeout(renderCapitalsQuickList, 100);
  } else if (pageId === "rainfall") {
    setTimeout(renderRainfallMapPins, 100);
    setTimeout(renderRainfallChart, 100);
  } else if (pageId === "forecast") {
    if (typeof renderHourlyForecast === "function") renderHourlyForecast(STATE.currentData);
    if (typeof renderDailyCards === "function") renderDailyCards(STATE.currentData);
  } else if (pageId === "details") {
    if (typeof renderCharts === "function") renderCharts(STATE.currentData);
    openCityDetailModalInline();
  } else if (pageId === "comparison") {
    if (window.activeLocation && window.activeLocation.adm4 && !STATE.compareHasUserSelection) {
      currentCompareA = window.activeLocation.adm4;
      if (currentCompareB === currentCompareA) {
        currentCompareB = currentCompareA === "35.78.01.1001" ? "31.71.01.1001" : "35.78.01.1001";
      }
    }
    populateCompareSelects().then(() => updateComparison());
  } else if (pageId === "earthquake") {
    if (typeof loadEarthquakeData === "function") {
      loadEarthquakeData();
    } else if (STATE.gempaData && typeof renderTEWSGempa === "function") {
      renderTEWSGempa(STATE.gempaData);
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Inline version of city detail for the Details Page
function openCityDetailModalInline() {
  const loc = window.activeLocation || STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Indonesia";

  const titleEl = document.getElementById("modal-detail-title");
  if (titleEl) titleEl.textContent = `Dossier Cuaca: ${locName}`;
  const subEl = document.getElementById("modal-detail-subtitle");
  if (subEl) subEl.textContent = `${loc.kecamatan ? loc.kecamatan + ", " : ""}${loc.provinsi || ""} • Kode ADM4: ${loc.adm4 || ""}`;

  const metricsContainer = document.getElementById("modal-detail-metrics");
  const tbody = document.getElementById("modal-detail-forecast-tbody");

  if (!STATE.currentData || !STATE.currentData.current || STATE.currentData.isUnavailable) {
    if (metricsContainer) {
      metricsContainer.innerHTML = `<div class="col-span-full p-8 text-center text-slate-500 font-medium bg-white/70 rounded-2xl border border-slate-200/80">Data belum tersedia untuk ${locName}</div>`;
    }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-500 font-medium">Data belum tersedia untuk ${locName}</td></tr>`;
    }
    return;
  }

  const data = STATE.currentData;
  const cur = data.current || {};
  const lok = data.lokasi || loc;
  const forecast = data.forecast || [];
  if (metricsContainer) {
    const formatCoord = (coord) => {
      const num = Number(coord);
      return coord !== undefined && coord !== null && coord !== "" && Number.isFinite(num)
        ? num.toFixed(4)
        : "0";
    };
    const items = [
      { label: "Suhu Udara", val: `${formatTemp(cur.t)}°${STATE.unit}`, sub: `Terasa ${formatTemp(cur.feelsLike)}°` },
      { label: "Kelembapan Relatif", val: `${cur.hu || 0}%`, sub: `Titik embun ${formatTemp(cur.dewPoint)}°` },
      { label: "Kecepatan Angin", val: `${cur.ws || 0} km/j`, sub: `${Math.round((cur.ws || 0) * 0.54 * 10) / 10} kt (${cur.wd || "NW"})` },
      { label: "Curah Hujan", val: `${cur.tp || 0} mm`, sub: "Presipitasi saat ini" },
      { label: "Tutupan Awan", val: `${cur.tcc || 0}%`, sub: cur.weather_desc || "Berawan" },
      { label: "Indeks Radiasi UV", val: `${cur.uvIndex || 0}`, sub: "Kategori BMKG" },
      { label: "Zona Waktu", val: `${lok.timezone || "WIB"}`, sub: `UTC+${lok.timezone === "WIT" ? 9 : lok.timezone === "WITA" ? 8 : 7}` },
      { label: "Koordinat GPS", val: `${formatCoord(lok.lat)}°, ${formatCoord(lok.lon)}°`, sub: "Geografis Resmi", valStyle: "font-size: 1.1rem; overflow-wrap: anywhere;" }
    ];

    metricsContainer.innerHTML = items.map(i => `
      <div class="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 shadow-sm">
        <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">${i.label}</span>
        <span class="text-lg font-black text-slate-800 mt-0.5 block"${i.valStyle ? ` style="${i.valStyle}"` : ""}>${i.val}</span>
        <span class="text-[10px] text-sky-600 font-semibold block truncate">${i.sub}</span>
      </div>
    `).join("");
  }

  if (tbody) {
    tbody.innerHTML = forecast.map((f, idx) => {
      const d = new Date(f.local_datetime || f.datetime);
      const dayLabel = idx < 8 ? "Hari Ini" : idx < 16 ? "Besok" : "Lusa";
      const timeStr = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      const fIcon = typeof getWeatherIcon === 'function' ? getWeatherIcon(f.weather_desc, f.weather) : 'icons/berawan.svg';
      return `
        <tr class="hover:bg-sky-50/60 transition-colors">
          <td class="p-2.5 font-mono"><span class="text-[10px] text-slate-400 block">${dayLabel}</span>${timeStr}</td>
          <td class="p-2.5 font-medium text-slate-700 inline-flex items-center gap-1.5"><img src="${fIcon}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-4 h-4 object-contain inline-block" /> ${f.weather_desc || "-"}</td>
          <td class="p-2.5 font-bold text-slate-900">${formatTemp(f.t)}°</td>
          <td class="p-2.5 text-slate-600">${formatTemp(f.feelsLike)}°</td>
          <td class="p-2.5 font-bold text-sky-600">${f.tp || 0} mm</td>
          <td class="p-2.5 text-slate-600">${f.tcc || 0}%</td>
          <td class="p-2.5 text-slate-600">${f.ws || 0} km/j</td>
          <td class="p-2.5 text-slate-600">${f.hu || 0}%</td>
        </tr>
      `;
    }).join("");
  }
}

// Render Aurora Weather Smooth Curved Line Chart (Light Style)
function renderAuroraMiniChart() {
  const canvas = document.getElementById("aurora-curve-canvas");
  const rowEl = document.getElementById("aurora-forecast-row");
  if (!canvas || !STATE.currentData || !STATE.currentData.forecast) return;

  const forecast = STATE.currentData.forecast.slice(0, 6);
  if (!forecast.length) return;

  if (rowEl) {
    rowEl.innerHTML = forecast.map((f, idx) => {
      const d = new Date(f.local_datetime || f.datetime);
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const dayLabel = idx === 0 ? "Hari Ini" : dayNames[d.getDay()];
      const t = formatTemp(f.t);
      const iconUrl = typeof getWeatherIcon === 'function' ? getWeatherIcon(f.weather_desc, f.weather) : 'icons/berawan.svg';

      return `
        <div class="aurora-daily-item">
          <span class="aurora-daily-temp inline-flex items-center justify-center gap-1">${t}° <img src="${iconUrl}" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-3.5 h-3.5 inline-block opacity-85 drop-shadow-sm" alt="" /></span>
          <span class="aurora-daily-day">${dayLabel}</span>
        </div>
      `;
    }).join("");
  }

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const temps = forecast.map(f => f.t);
  const minT = Math.min(...temps) - 1;
  const maxT = Math.max(...temps) + 1;
  const range = maxT - minT || 1;

  const points = forecast.map((f, i) => {
    const x = (i / (forecast.length - 1)) * (w - 40) + 20;
    const norm = (f.t - minT) / range;
    const y = h - (norm * (h - 45) + 24);
    return { x, y };
  });

  if (points.length < 2) return;

  // 1. Ambient Frosted Wave Glow Fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(2, 132, 199, 0.20)");
  grad.addColorStop(0.5, "rgba(56, 189, 248, 0.08)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0.0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.lineTo(points[0].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // 2. Subtle Secondary Parallel Lower Curve (Aurora style dual-wave)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y + 12);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2 + 12;
    ctx.quadraticCurveTo(points[i].x, points[i].y + 12, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y + 12);
  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Primary Crisp Curve Line with Radiant Sky Highlight
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = "#0284c7";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(2, 132, 199, 0.45)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 4. Draw Clean Nodes
  points.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

// Render Aurora Weather Side Cities (Regional major hubs excluding active city)
function renderAuroraSideCities() {
  const container = document.getElementById("aurora-side-cities-list");
  if (!container) return;

  const currentAdm = (window.activeLocation && window.activeLocation.adm4) || STATE.currentAdm4;
  const allKeyCities = [
    { name: "Surabaya", region: "Jawa Timur", adm4: "35.78.01.1001" },
    { name: "Bandung", region: "Jawa Barat", adm4: "32.73.01.1001" },
    { name: "Denpasar (Bali)", region: "Bali", adm4: "51.71.01.1001" },
    { name: "Medan", region: "Sumatera Utara", adm4: "12.71.01.1001" },
    { name: "Makassar", region: "Sulawesi Selatan", adm4: "73.71.01.1001" },
    { name: "Jakarta Pusat", region: "DKI Jakarta", adm4: "31.71.01.1001" }
  ];

  // Exclude current active city so side cities are genuinely "other cities"
  const keyCities = allKeyCities.filter(c => c.adm4 !== currentAdm).slice(0, 4);

  container.innerHTML = keyCities.map(c => {
    const temp = (STATE.mapTemps && STATE.mapTemps[c.adm4] !== undefined)
      ? (typeof formatTemp === "function" ? formatTemp(STATE.mapTemps[c.adm4]) : Math.round(STATE.mapTemps[c.adm4])) + "°"
      : "--°";
    const desc = (STATE.mapWeatherDesc && STATE.mapWeatherDesc[c.adm4]) || (typeof _t === "function" ? _t("dyn.loading_sync") : "Sinkronisasi BMKG");
    const iconSrc = typeof getWeatherIcon === 'function' ? getWeatherIcon(desc) : 'icons/berawan.svg';

    return `
      <div onclick="changeLocation('${c.adm4}', { name: '${c.name.replace(/'/g, "\\'")}', provinsi: '${c.region.replace(/'/g, "\\'")}' })" class="aurora-side-city-card cursor-pointer">
        <div>
          <span class="text-[10px] text-slate-500 block font-semibold uppercase tracking-wider">${c.region}</span>
          <p class="text-xs font-bold text-slate-800">${c.name}</p>
          <span class="text-[10px] text-sky-600 font-semibold">${desc}</span>
        </div>
        <div class="text-right flex items-center gap-2">
          <span class="text-xl font-black text-slate-900 font-mono">${temp}</span>
          <img src="${iconSrc}" class="w-5 h-5 object-contain" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" />
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================
// RAINFALL INTERACTIVE MAP & CHART SYSTEM (ACTUAL BMKG DATA)
// ============================================================
let activeRainfallRegion = "all";
let rainfallChartInstance = null;
let rainfallMapInstance = null;
let rainfallMapMarkersLayer = null;

// Rule 4: Skala warna curah hujan
function getRainfallColor(tp) {
  if (tp === undefined || tp === null || isNaN(tp)) return null;
  const val = Number(tp);
  if (val === 0) {
    return { color: "#9CA3AF", label: "0 mm (Kering)", category: "none" };
  } else if (val > 0 && val < 2.5) {
    return { color: "#7DD3FC", label: "< 2.5 mm (Ringan)", category: "light" };
  } else if (val >= 2.5 && val <= 10) {
    return { color: "#2563EB", label: "2.5 - 10 mm (Sedang)", category: "moderate" };
  } else {
    return { color: "#EF4444", label: "> 10 mm (Lebat)", category: "heavy" };
  }
}

// Rule 1: Leaflet basemap OpenStreetMap, tinggi 480px
function initRainfallLeafletMap() {
  const container = document.getElementById("rainfall-leaflet-map");
  if (!container || typeof L === "undefined") return;

  if (rainfallMapInstance) {
    try {
      rainfallMapInstance.invalidateSize();
    } catch (e) {}
    return;
  }

  rainfallMapInstance = L.map("rainfall-leaflet-map", {
    zoomControl: true,
    attributionControl: true,
    minZoom: 4,
    maxZoom: 10,
    fadeAnimation: true,
  });
  window.rainfallMapInstance = rainfallMapInstance;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: 4,
    maxZoom: 10,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
  }).addTo(rainfallMapInstance);

  const INDO_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
  rainfallMapInstance.fitBounds(INDO_BOUNDS, { padding: [10, 10] });

  rainfallMapMarkersLayer = L.layerGroup().addTo(rainfallMapInstance);
  window.rainfallMapMarkersLayer = rainfallMapMarkersLayer;
}

// Rule 10: Hancurkan saat unmount
function destroyRainfallMap() {
  if (rainfallMapInstance) {
    try {
      rainfallMapInstance.remove();
    } catch (e) {}
    rainfallMapInstance = null;
    rainfallMapMarkersLayer = null;
    window.rainfallMapInstance = null;
    window.rainfallMapMarkersLayer = null;
  }
}
window.destroyRainfallMap = destroyRainfallMap;

function formatLocalDatetime(dtStr) {
  if (!dtStr) return "-";
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " WIB";
  } catch (e) {
    return dtStr;
  }
}

function renderRainfallMapPins() {
  const container = document.getElementById("rainfall-leaflet-map");
  if (!container) return;

  if (!rainfallMapInstance) {
    initRainfallLeafletMap();
  }

  if (!rainfallMapInstance) return;

  rainfallMapInstance.invalidateSize();

  if (!rainfallMapMarkersLayer) {
    rainfallMapMarkersLayer = L.layerGroup().addTo(rainfallMapInstance);
  } else {
    rainfallMapMarkersLayer.clearLayers();
  }
  window.rainfallMapMarkersLayer = rainfallMapMarkersLayer;

  // Rule 7: Filter wilayah
  const filtered = activeRainfallRegion === "all"
    ? MAP_CITY_PINS
    : MAP_CITY_PINS.filter(c => {
        if (!c.region) return false;
        if (c.region === activeRainfallRegion) return true;
        if (activeRainfallRegion.includes("Bali") && c.region.includes("Bali")) return true;
        return false;
      });

  let validPinCount = 0;

  filtered.forEach((city) => {
    // Rule 2: Posisi marker WAJIB dari lat dan lon di locationCodes.js
    const loc = typeof getLocation === "function" ? getLocation(city.adm4) || getLocation(city.name) : null;
    const lat = loc && loc.lat != null ? loc.lat : city.lat;
    const lon = loc && loc.lon != null ? loc.lon : city.lon;

    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return;

    // Rule 3: Ambil nilai curah hujan dari field tp di data prakiraan BMKG
    const details = STATE.mapDetails && STATE.mapDetails[city.adm4];
    const tp = (details && details.tp !== undefined && details.tp !== null)
      ? details.tp
      : (details && details.precipitation !== undefined && details.precipitation !== null ? details.precipitation : null);

    // Rule 5: Jika tp tidak tersedia untuk lokasi, marker tidak ditampilkan
    if (tp === null || tp === undefined || isNaN(tp)) {
      return;
    }

    const rainInfo = getRainfallColor(tp);
    if (!rainInfo) return;

    validPinCount++;
    const isActive = city.adm4 === STATE.currentAdm4 || (window.activeLocation && city.adm4 === window.activeLocation.adm4);
    const color = rainInfo.color;
    const localDatetime = details && details.local_datetime ? details.local_datetime : "-";
    const formattedTime = localDatetime !== "-" ? formatLocalDatetime(localDatetime) : "Prakiraan Terdekat BMKG";

    const activeClass = isActive
      ? "rainfall-pin-active ring-4 ring-sky-400 ring-offset-2 scale-125 z-30"
      : "hover:scale-125 shadow-md";

    const iconHtml = `
      <div class="rainfall-pin-item ${activeClass} flex items-center justify-center cursor-pointer transition-transform duration-150" title="${city.name}: ${tp} mm">
        <span class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md block flex-shrink-0" style="background-color: ${color};"></span>
      </div>
    `;

    const markerIcon = L.divIcon({
      className: "custom-rainfall-marker",
      html: iconHtml,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const marker = L.marker([lat, lon], { icon: markerIcon });
    marker.adm4 = city.adm4;
    marker.cityName = city.name;

    // Rule 6: Klik marker menampilkan panel kecil: nama lokasi, curah hujan (mm), dan waktu prakiraan dari local_datetime
    marker.bindPopup(`
      <div class="p-2.5 text-xs font-sans min-w-[190px]">
        <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
          <span class="font-bold text-slate-900 text-sm">${city.name}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white" style="background-color: ${color};">
            ${tp} mm
          </span>
        </div>
        <div class="mt-2 space-y-1.5 text-slate-600 text-[11px]">
          <p><span class="text-slate-400">Provinsi:</span> <span class="font-semibold text-slate-800">${city.prov}</span></p>
          <p><span class="text-slate-400">Curah Hujan:</span> <span class="font-bold text-slate-900">${tp} mm (${rainInfo.label})</span></p>
          <p><span class="text-slate-400">Waktu Prakiraan:</span> <span class="font-semibold text-sky-700">${formattedTime}</span></p>
        </div>
      </div>
    `, { offset: [0, -10], closeButton: true });

    marker.on("click", (e) => {
      if (e && e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
      selectRainfallCity(city.adm4, city.name);
      highlightActiveRainfallPin(city.adm4);
      showRainfallTooltip({ name: city.name, adm4: city.adm4, tp, local_datetime: localDatetime });
      marker.openPopup();
    });

    if (isActive && marker.setZIndexOffset) {
      marker.setZIndexOffset(1000);
    }

    marker.addTo(rainfallMapMarkersLayer);
  });

  const countEl = document.getElementById("rainfall-station-count");
  if (countEl) {
    countEl.textContent = `${validPinCount} Stasiun Terpantau (${activeRainfallRegion === "all" ? "Seluruh RI" : activeRainfallRegion})`;
  }
}

function highlightActiveRainfallPin(adm4) {
  if (!rainfallMapMarkersLayer) return;
  rainfallMapMarkersLayer.eachLayer(marker => {
    if (!marker.adm4) return;
    const isActive = marker.adm4 === adm4;
    const city = MAP_CITY_PINS.find(c => c.adm4 === marker.adm4) || { name: marker.cityName, adm4: marker.adm4 };
    const details = STATE.mapDetails && STATE.mapDetails[marker.adm4];
    const tp = (details && details.tp !== undefined && details.tp !== null) ? details.tp : (details && details.precipitation !== undefined ? details.precipitation : 0);
    const rainInfo = getRainfallColor(tp);
    if (!rainInfo) return;

    const color = rainInfo.color;
    const activeClass = isActive
      ? "rainfall-pin-active ring-4 ring-sky-400 ring-offset-2 scale-125 z-30"
      : "hover:scale-125 shadow-md";

    const iconHtml = `
      <div class="rainfall-pin-item ${activeClass} flex items-center justify-center cursor-pointer transition-transform duration-150" title="${city.name}: ${tp} mm">
        <span class="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md block flex-shrink-0" style="background-color: ${color};"></span>
      </div>
    `;

    marker.setIcon(L.divIcon({
      className: "custom-rainfall-marker",
      html: iconHtml,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }));

    if (isActive && marker.setZIndexOffset) {
      marker.setZIndexOffset(1000);
    } else if (marker.setZIndexOffset) {
      marker.setZIndexOffset(0);
    }
  });
}

function selectRainfallCity(adm4, cityName) {
  changeLocation(adm4, { name: cityName, kotkab: cityName });

  const details = STATE.mapDetails && STATE.mapDetails[adm4];
  const statVal = document.getElementById("rainfall-stat-current");
  const statStatus = document.getElementById("rainfall-stat-status");
  const cityLabel = document.getElementById("rainfall-active-city");

  if (cityLabel) cityLabel.textContent = cityName;

  if (details && details.tp !== undefined && details.tp !== null) {
    const tp = details.tp;
    if (statVal) statVal.textContent = tp + " mm";
    if (statStatus) {
      const rainInfo = getRainfallColor(tp);
      statStatus.textContent = rainInfo ? rainInfo.label : (tp > 0 ? "Hujan" : "Nihil (Kering)");
    }
  } else {
    // Rule 5: Panel menampilkan "Data belum tersedia untuk [nama lokasi]"
    if (statVal) statVal.textContent = "-- mm";
    if (statStatus) statStatus.textContent = "Data belum tersedia untuk " + cityName;
  }
}

// Rule 3: Fungsi showRainfallTooltip(lokasi) yang menampilkan panel kecil dengan nama lokasi, curah hujan (mm), dan waktu prakiraan dari field tp dan local_datetime.
// Jangan mengisi angka jika data kosong, tampilkan "Data belum tersedia".
function showRainfallTooltip(lokasi) {
  if (!lokasi) return;
  const name = lokasi.name || lokasi.cityName || lokasi.desa || "Lokasi";
  const adm4 = lokasi.adm4;
  const details = (STATE.mapDetails && adm4 && STATE.mapDetails[adm4]) || lokasi;
  const tp = (details && details.tp !== undefined && details.tp !== null)
    ? details.tp
    : (lokasi.tp !== undefined && lokasi.tp !== null ? lokasi.tp : null);
  const localDatetime = (details && details.local_datetime) || lokasi.local_datetime || null;
  const formattedTime = localDatetime && typeof formatLocalDatetime === "function" ? formatLocalDatetime(localDatetime) : localDatetime;

  // Also update side stats panel if adm4 is present
  if (adm4) {
    selectRainfallCity(adm4, name);
  }

  let tooltipEl = document.getElementById("rainfall-floating-tooltip");
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "rainfall-floating-tooltip";
    tooltipEl.className = "absolute z-50 pointer-events-none bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-xl p-3 text-xs font-sans transition-all duration-150";
    tooltipEl.style.display = "none";
    const wrapper = document.getElementById("rainfall-map-wrapper") || document.body;
    wrapper.appendChild(tooltipEl);
  }

  if (tp === null || tp === undefined || isNaN(tp)) {
    tooltipEl.innerHTML = `
      <div class="font-bold text-slate-800 text-sm mb-1">${name}</div>
      <div class="text-amber-600 font-medium text-xs">Data belum tersedia</div>
    `;
  } else {
    const rainInfo = typeof getRainfallColor === "function" ? getRainfallColor(tp) : { color: "#2563EB", label: "" };
    tooltipEl.innerHTML = `
      <div class="flex items-center justify-between gap-3 pb-1.5 border-b border-slate-100">
        <span class="font-bold text-slate-900 text-sm">${name}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold text-white" style="background-color: ${rainInfo.color};">
          ${tp} mm
        </span>
      </div>
      <div class="mt-1.5 space-y-1 text-slate-600 text-[11px]">
        <div><span class="text-slate-400">Curah Hujan:</span> <span class="font-bold text-slate-800">${tp} mm ${rainInfo.label ? '(' + rainInfo.label + ')' : ''}</span></div>
        <div><span class="text-slate-400">Waktu Prakiraan:</span> <span class="font-semibold text-sky-700">${formattedTime || "Data belum tersedia"}</span></div>
      </div>
    `;
  }

  tooltipEl.style.display = "block";
  tooltipEl.style.opacity = "1";
}

function hideRainfallTooltip() {
  const tooltipEl = document.getElementById("rainfall-floating-tooltip");
  if (tooltipEl) {
    tooltipEl.style.opacity = "0";
    tooltipEl.style.display = "none";
  }
}

// Rule 7: Filter wilayah
function filterRainfallRegion(region) {
  activeRainfallRegion = region;
  document.querySelectorAll(".rainfall-filter-pill").forEach(btn => {
    const r = btn.getAttribute("data-region");
    btn.classList.toggle("active", r === region);
  });

  renderRainfallMapPins();

  if (rainfallMapInstance && region !== "all") {
    const regionPins = MAP_CITY_PINS.filter(c => {
      if (!c.region) return false;
      if (c.region === region) return true;
      if (region.includes("Bali") && c.region.includes("Bali")) return true;
      return false;
    });
    if (regionPins.length > 0) {
      const bounds = L.latLngBounds(regionPins.map(c => [c.lat, c.lon]));
      rainfallMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
  } else if (rainfallMapInstance && region === "all") {
    const INDO_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
    rainfallMapInstance.fitBounds(INDO_BOUNDS, { padding: [10, 10] });
  }
}

// Render Rainfall 72-Hour Actual Curve Chart
function renderRainfallChart() {
  const canvas = document.getElementById("rainfall-chart-canvas");
  const loc = window.activeLocation || STATE.activeLocation || {};
  const locName = loc.name || loc.kotkab || "Wilayah";

  const cityLabel = document.getElementById("rainfall-active-city");
  if (cityLabel) cityLabel.textContent = locName;

  const statVal = document.getElementById("rainfall-stat-current");
  const statStatus = document.getElementById("rainfall-stat-status");

  if (!canvas || !STATE.currentData || STATE.currentData.isUnavailable || !STATE.currentData.forecast || !STATE.currentData.forecast.length) {
    if (rainfallChartInstance) {
      rainfallChartInstance.destroy();
      rainfallChartInstance = null;
    }
    if (statVal) statVal.textContent = "-- mm";
    if (statStatus) statStatus.textContent = `Data belum tersedia untuk ${locName}`;

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
    return;
  }

  const placeholder = document.getElementById("rainfall-chart-placeholder");
  if (placeholder) placeholder.style.display = "none";

  const forecast = STATE.currentData.forecast || [];
  const labels = forecast.map(f => {
    const d = new Date(f.local_datetime || f.datetime);
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  });

  const precipData = forecast.map(f => f.tp || 0);
  const cloudData = forecast.map(f => f.tcc || 0);

  if (rainfallChartInstance) {
    rainfallChartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");
  rainfallChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Curah Hujan (mm)",
          data: precipData,
          backgroundColor: "rgba(2, 132, 199, 0.75)",
          borderColor: "#0284c7",
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: "y"
        },
        {
          type: "line",
          label: "Tutupan Awan (%)",
          data: cloudData,
          borderColor: "#64748b",
          backgroundColor: "rgba(100, 116, 139, 0.08)",
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#1e293b", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
        },
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          titleColor: "#0f172a",
          bodyColor: "#334155",
          borderColor: "#e2e8f0",
          borderWidth: 1
        }
      },
      scales: {
        x: { ticks: { color: "#64748b", font: { size: 10 } }, grid: { display: false } },
        y: {
          title: { display: true, text: "Curah Hujan (mm)", color: "#0284c7" },
          ticks: { color: "#64748b" },
          grid: { color: "rgba(226, 232, 240, 0.6)" },
          beginAtZero: true
        },
        y1: {
          position: "right",
          title: { display: true, text: "Tutupan Awan (%)", color: "#64748b" },
          ticks: { color: "#64748b" },
          grid: { display: false },
          max: 100,
          beginAtZero: true
        }
      }
    }
  });

  // Update current statistics display
  const cur = STATE.currentData.current || {};
  if (statVal) statVal.textContent = (cur.tp || 0) + " mm";
  if (statStatus) {
    const tp = cur.tp || 0;
    statStatus.textContent = tp > 0 ? (tp > 5 ? "Hujan Sedang/Lebat" : "Hujan Ringan") : "Nihil (Kering)";
  }
}

// URL Routing Engine
function handleUrlHashRouting() {
  let hash = window.location.hash.replace("#", "").trim();
  if (!hash || hash === "" || hash === "/" || hash === "landing") {
    hash = "landing";
  } else if (!PAGE_ROUTES.includes(hash)) {
    hash = "dashboard";
  }
  navigateToPage(hash, null, { replaceHistory: true });
}

window.addEventListener("popstate", () => {
  handleUrlHashRouting();
});

function initRouterOnLoad() {
  if (typeof syncAllTitles === "function" && window.activeLocation) {
    syncAllTitles(window.activeLocation);
  }
  handleUrlHashRouting();
  window.addEventListener("resize", () => {
    if (document.getElementById("view-dashboard")?.classList.contains("is-active-view")) {
      renderAuroraMiniChart();
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRouterOnLoad);
} else {
  initRouterOnLoad();
}

window.navigateToPage = navigateToPage;
window.renderAuroraMiniChart = renderAuroraMiniChart;
window.renderAuroraSideCities = renderAuroraSideCities;
window.filterRainfallRegion = filterRainfallRegion;
window.selectRainfallCity = selectRainfallCity;
window.showRainfallTooltip = showRainfallTooltip;
window.hideRainfallTooltip = hideRainfallTooltip;

// ============================================================
// RICH LOCATION COMPARISON ENGINE (ALL 38 PROVINCES COVERAGE)
// ============================================================
if (!currentCompareA) currentCompareA = (window.activeLocation ? window.activeLocation.adm4 : "31.71.01.1001");
if (!currentCompareB) currentCompareB = "35.78.01.1001";

function getCompareLocationList() {
  if (typeof window.locations !== "undefined" && Array.isArray(window.locations) && window.locations.length) {
    return window.locations;
  }
  if (STATE.wilayahList && STATE.wilayahList.length) {
    return STATE.wilayahList;
  }
  return [];
}

function getCompareLocationMeta(adm4, fallbackLabel) {
  const fromGetLoc = (adm4 && typeof window.getLocation === "function") ? window.getLocation(adm4) : null;
  const fromList = getCompareLocationList().find((w) => w.adm4 === adm4) || null;
  const loc = fromGetLoc || fromList;
  const title = (loc && (loc.kotkab || loc.name)) || fallbackLabel || "Wilayah Tidak Diketahui";
  const subtitle = loc ? [loc.kecamatan, loc.provinsi].filter(Boolean).join(", ") : "";
  return {
    adm4: adm4 || "",
    title,
    name: (loc && loc.name) || title,
    provinsi: (loc && loc.provinsi) || "",
    subtitle
  };
}

async function ensureVerifiedBmkgCodes() {
  if (STATE.verifiedBmkgCodes instanceof Set && STATE.verifiedBmkgCodes.size > 0) {
    return STATE.verifiedBmkgCodes;
  }
  try {
    const res = await fetch("/api/cuaca/verified");
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.verifiedCodes)) {
        STATE.verifiedBmkgCodes = new Set(json.verifiedCodes);
        return STATE.verifiedBmkgCodes;
      }
    }
  } catch (e) {
    console.warn("Gagal memuat daftar kode ADM4 terverifikasi:", e);
  }
  return null;
}

async function populateCompareSelects() {
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  const provA = document.getElementById("compare-prov-a");
  const provB = document.getElementById("compare-prov-b");
  if (!selA || !selB) return;

  if (window.activeLocation && window.activeLocation.adm4 && !STATE.compareHasUserSelection) {
    currentCompareA = window.activeLocation.adm4;
    if (currentCompareB === currentCompareA) {
      currentCompareB = currentCompareA === "35.78.01.1001" ? "31.71.01.1001" : "35.78.01.1001";
    }
  }

  let list = getCompareLocationList();
  if (!list.length) {
    try {
      const res = await fetch("/api/wilayah");
      const json = await res.json();
      if (json.success && json.data) {
        STATE.wilayahList = json.data;
        list = json.data;
      }
    } catch (e) {
      console.error("Gagal mengambil data wilayah komparasi:", e);
    }
  }

  const provinces = Array.from(new Set(list.map(w => w.provinsi).filter(Boolean))).sort();

  if (provA && provA.options.length <= 1) {
    provA.innerHTML = '<option value="all">Semua 38 Provinsi</option>' +
      provinces.map(p => `<option value="${p}">${p}</option>`).join('');
  }
  if (provB && provB.options.length <= 1) {
    provB.innerHTML = '<option value="all">Semua 38 Provinsi</option>' +
      provinces.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  filterCompareOptions('a', false);
  filterCompareOptions('b', false);
}

function filterCompareOptions(which, triggerUpdate = true) {
  const sel = document.getElementById(`compare-select-${which}`);
  const searchInput = document.getElementById(`compare-search-${which}`);
  const provSelect = document.getElementById(`compare-prov-${which}`);
  if (!sel) return;

  const query = (searchInput?.value || "").toLowerCase().trim();
  const selectedProv = provSelect?.value || "all";
  const list = getCompareLocationList();

  let filtered = list;
  if (selectedProv !== "all") {
    filtered = filtered.filter(w => (w.provinsi || "").toLowerCase() === selectedProv.toLowerCase());
  }
  if (query) {
    filtered = filtered.filter(w =>
      (w.name || "").toLowerCase().includes(query) ||
      (w.kotkab || "").toLowerCase().includes(query) ||
      (w.provinsi || "").toLowerCase().includes(query) ||
      (w.adm4 || "").includes(query)
    );
  }

  if (filtered.length === 0) {
    sel.innerHTML = '<option value="" disabled>Tidak ada wilayah yang cocok</option>';
    return;
  }

  const grouped = {};
  filtered.forEach(w => {
    const prov = w.provinsi || "Lainnya";
    if (!grouped[prov]) grouped[prov] = [];
    grouped[prov].push(w);
  });

  let optionsHtml = "";
  Object.keys(grouped).sort().forEach(prov => {
    optionsHtml += `<optgroup label="Provinsi ${prov}">`;
    grouped[prov].forEach(w => {
      optionsHtml += `<option value="${w.adm4}">${w.name} (${w.provinsi})</option>`;
    });
    optionsHtml += `</optgroup>`;
  });

  sel.innerHTML = optionsHtml;

  const targetAdm = (which === 'a') ? currentCompareA : currentCompareB;
  const exists = filtered.some(w => w.adm4 === targetAdm);
  if (exists) {
    sel.value = targetAdm;
  } else if (filtered[0]) {
    sel.value = filtered[0].adm4;
    if (which === 'a') currentCompareA = filtered[0].adm4;
    else currentCompareB = filtered[0].adm4;
  }

  if (triggerUpdate) {
    STATE.compareHasUserSelection = true;
    updateComparison();
  }
}

function onCompareSelectChange(which) {
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  STATE.compareHasUserSelection = true;
  if (which === 'a' && selA) currentCompareA = selA.value;
  if (which === 'b' && selB) currentCompareB = selB.value;
  updateComparison();
}

async function setComparePreset(admA, admB) {
  STATE.compareHasUserSelection = true;
  currentCompareA = admA;
  currentCompareB = admB;
  const searchA = document.getElementById("compare-search-a");
  const searchB = document.getElementById("compare-search-b");
  const provA = document.getElementById("compare-prov-a");
  const provB = document.getElementById("compare-prov-b");
  if (searchA) searchA.value = "";
  if (searchB) searchB.value = "";
  if (provA) provA.value = "all";
  if (provB) provB.value = "all";

  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  if (!selA || !selB || selA.options.length === 0 || selB.options.length === 0) {
    await populateCompareSelects();
  } else {
    filterCompareOptions('a', false);
    filterCompareOptions('b', false);
  }

  if (selA) selA.value = admA;
  if (selB) selB.value = admB;
  updateComparison();
}

async function swapCompareLocations() {
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  const activeA = (selA && selA.value) ? selA.value : currentCompareA;
  const activeB = (selB && selB.value) ? selB.value : currentCompareB;

  STATE.compareHasUserSelection = true;
  currentCompareA = activeB;
  currentCompareB = activeA;

  const searchA = document.getElementById("compare-search-a");
  const searchB = document.getElementById("compare-search-b");
  const provA = document.getElementById("compare-prov-a");
  const provB = document.getElementById("compare-prov-b");
  if (searchA) searchA.value = "";
  if (searchB) searchB.value = "";
  if (provA) provA.value = "all";
  if (provB) provB.value = "all";

  if (!selA || !selB || selA.options.length === 0 || selB.options.length === 0) {
    await populateCompareSelects();
  } else {
    filterCompareOptions('a', false);
    filterCompareOptions('b', false);
  }

  if (selA) selA.value = currentCompareA;
  if (selB) selB.value = currentCompareB;
  updateComparison();
}

async function fetchCompareSide(adm4, verifiedSet) {
  const meta = getCompareLocationMeta(adm4);
  if (!adm4) {
    return {
      available: false,
      adm4: "",
      meta,
      message: "Data belum tersedia"
    };
  }

  // Rule 4: Jika kode ADM4 tidak ada di daftar yang lolos tes, jangan dipanggil.
  if (verifiedSet && verifiedSet.size > 0 && !verifiedSet.has(adm4)) {
    return {
      available: false,
      adm4,
      meta,
      message: `Data belum tersedia untuk ${meta.title}`
    };
  }

  try {
    const res = await fetch(`/api/cuaca?adm4=${encodeURIComponent(adm4)}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false || json.status === "no-data" || !json.current || typeof json.current.t !== "number") {
      return {
        available: false,
        adm4,
        meta,
        message: "Data belum tersedia"
      };
    }

    const lok = json.lokasi || {};
    const resolvedTitle = meta.title || lok.kotkab || lok.desa;
    const resolvedProv = meta.provinsi || lok.provinsi || "";
    const resolvedKec = lok.kecamatan ? `${lok.kecamatan}, ` : "";

    return {
      available: true,
      adm4,
      meta: {
        ...meta,
        title: resolvedTitle,
        provinsi: resolvedProv,
        subtitle: `${resolvedKec}${resolvedProv}`.trim()
      },
      cur: json.current,
      lok
    };
  } catch (e) {
    return {
      available: false,
      adm4,
      meta,
      message: "Data belum tersedia"
    };
  }
}

function updateCompareSelectorChip(sideKey, sideResult) {
  const nameEl = document.getElementById(`chip-${sideKey}-name`);
  const provEl = document.getElementById(`chip-${sideKey}-prov`);
  const tempEl = document.getElementById(`chip-${sideKey}-temp`);
  const statusEl = document.getElementById(`badge-loc-${sideKey}-status`);
  if (nameEl) nameEl.textContent = sideResult.meta.title;
  if (provEl) provEl.textContent = `${sideResult.meta.provinsi || ""} · ADM4: ${sideResult.adm4 || "-"}`;
  if (tempEl) {
    tempEl.textContent = sideResult.available
      ? `${formatTemp(sideResult.cur.t)}°${STATE.unit}`
      : "Tidak tersedia";
  }
  if (statusEl) {
    statusEl.textContent = sideResult.available ? "Terverifikasi BMKG" : "Data belum tersedia";
  }
}

function renderCompareSideCard(sideLabel, accent, sideResult) {
  const isSky = accent === "sky";
  const borderCls = isSky ? "border-sky-200/90" : "border-indigo-200/90";
  const badgeCls = isSky
    ? "bg-sky-100 text-sky-800 border-sky-300"
    : "bg-indigo-100 text-indigo-800 border-indigo-300";
  const pillCls = isSky
    ? "bg-sky-50 text-sky-700 border-sky-200"
    : "bg-indigo-50 text-indigo-700 border-indigo-200";
  const valCls = isSky ? "text-sky-700" : "text-indigo-700";

  if (!sideResult.available) {
    return `
      <div class="liquid-glass-card p-6 space-y-4 bg-white/90 border ${borderCls} shadow-lg">
        <div class="flex items-start justify-between border-b border-slate-200/80 pb-3">
          <div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeCls}">${sideLabel}</span>
            <h4 class="text-lg font-black text-slate-900 mt-1">${sideResult.meta.title}</h4>
            <p class="text-xs text-slate-500 font-medium">${sideResult.meta.provinsi || ""}</p>
          </div>
        </div>
        <div class="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
          ${sideResult.message || "Data belum tersedia"}
        </div>
      </div>
    `;
  }

  const cur = sideResult.cur;
  const iconSrc = typeof getWeatherIcon === "function"
    ? getWeatherIcon(cur.weather_desc, cur.weather)
    : "icons/berawan.svg";

  return `
    <div class="liquid-glass-card p-6 space-y-4 bg-white/90 border ${borderCls} shadow-lg">
      <div class="flex items-start justify-between border-b border-slate-200/80 pb-3">
        <div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badgeCls}">${sideLabel}</span>
          <h4 class="text-lg font-black text-slate-900 mt-1">${sideResult.meta.title}</h4>
          <p class="text-xs text-slate-500 font-medium">${sideResult.meta.subtitle || sideResult.meta.provinsi}</p>
        </div>
        <img src="${iconSrc}" alt="" onerror="this.onerror=null; this.src='icons/berawan.svg'" class="w-14 h-14 drop-shadow" />
      </div>

      <div class="flex items-baseline justify-between py-1">
        <div>
          <span class="text-5xl font-black text-slate-900" style="font-family:'Outfit',sans-serif">${formatTemp(cur.t)}°${STATE.unit}</span>
          <span class="text-xs font-semibold text-slate-500 block mt-0.5">Terasa seperti ${formatTemp(cur.feelsLike)}°${STATE.unit}</span>
        </div>
        <span class="px-3 py-1 rounded-full text-xs font-bold border ${pillCls}">${cur.weather_desc || "Berawan"}</span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
        <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
          <span class="text-[10px] text-slate-500 font-bold block uppercase">Kelembapan</span>
          <span class="text-sm font-black text-slate-800">${cur.hu ?? 0}%</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
          <span class="text-[10px] text-slate-500 font-bold block uppercase">Kecepatan Angin</span>
          <span class="text-sm font-black text-slate-800">${cur.ws ?? 0} km/j (${cur.wd || "NW"})</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
          <span class="text-[10px] text-slate-500 font-bold block uppercase">Curah Hujan</span>
          <span class="text-sm font-black ${valCls}">${cur.tp ?? 0} mm</span>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200">
          <span class="text-[10px] text-slate-500 font-bold block uppercase">Tutupan Awan</span>
          <span class="text-sm font-black text-slate-800">${cur.tcc ?? 0}%</span>
        </div>
      </div>
    </div>
  `;
}

let lastCompareSides = null;

function renderComparisonContent(sideA, sideB, resultsContainer, barsContainer) {
  updateCompareSelectorChip("a", sideA);
  updateCompareSelectorChip("b", sideB);

  resultsContainer.innerHTML =
    renderCompareSideCard("WILAYAH TITIK A", "sky", sideA) +
    renderCompareSideCard("WILAYAH TITIK B", "indigo", sideB);

  if (!barsContainer) return;

  if (!sideA.available || !sideB.available) {
    barsContainer.innerHTML = `<div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium">Perbandingan metrik tersedia saat kedua wilayah memiliki data BMKG aktif.</div>`;
    return;
  }

  const curA = sideA.cur;
  const curB = sideB.cur;
  const titleA = sideA.meta.title;
  const titleB = sideB.meta.title;

  const tempA = curA.t || 0;
  const tempB = curB.t || 0;
  const diffTempVal = STATE.unit === "F" ? (Math.abs(tempA - tempB) * 9) / 5 : Math.abs(tempA - tempB);
  const diffTemp = diffTempVal.toFixed(1);
  const tempVerdict = tempA > tempB
    ? `${titleA} lebih hangat ${diffTemp}°${STATE.unit}`
    : (tempA < tempB ? `${titleB} lebih hangat ${diffTemp}°${STATE.unit}` : "Suhu identik");

  const huA = curA.hu || 0;
  const huB = curB.hu || 0;
  const diffHu = Math.abs(huA - huB);
  const wsA = curA.ws || 0;
  const wsB = curB.ws || 0;
  const tpA = curA.tp || 0;
  const tpB = curB.tp || 0;

  barsContainer.innerHTML = `
        <!-- Suhu -->
        <div class="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-800">Perbandingan Suhu Udara:</span>
            <span class="text-[11px] font-bold text-sky-700">${tempVerdict}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 items-center">
            <div>
              <div class="flex justify-between text-[11px] text-slate-600 mb-1">
                <span class="font-bold truncate">${titleA}</span>
                <span class="font-black text-sky-700 font-mono">${formatTemp(tempA)}°${STATE.unit}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="bg-sky-500 h-full rounded-full" style="width: ${Math.min(100, Math.max(10, (tempA / 45) * 100))}%;"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[11px] text-slate-600 mb-1">
                <span class="font-bold truncate">${titleB}</span>
                <span class="font-black text-indigo-700 font-mono">${formatTemp(tempB)}°${STATE.unit}</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="bg-indigo-500 h-full rounded-full" style="width: ${Math.min(100, Math.max(10, (tempB / 45) * 100))}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Kelembapan -->
        <div class="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-slate-800">Kelembapan Udara Relatif:</span>
            <span class="text-[11px] font-bold text-slate-600">Selisih ${diffHu}% RH</span>
          </div>
          <div class="grid grid-cols-2 gap-3 items-center">
            <div>
              <div class="flex justify-between text-[11px] text-slate-600 mb-1">
                <span class="font-bold truncate">${titleA}</span>
                <span class="font-black text-slate-800 font-mono">${huA}%</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="bg-sky-500 h-full rounded-full" style="width: ${huA}%;"></div>
              </div>
            </div>
            <div>
              <div class="flex justify-between text-[11px] text-slate-600 mb-1">
                <span class="font-bold truncate">${titleB}</span>
                <span class="font-black text-slate-800 font-mono">${huB}%</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div class="bg-indigo-500 h-full rounded-full" style="width: ${huB}%;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Angin & Curah Hujan -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 space-y-1.5">
            <span class="font-bold text-slate-800 block text-xs">Kecepatan Angin:</span>
            <div class="flex justify-between text-xs pt-1">
              <span>${titleA}: <strong class="text-sky-700">${wsA} km/j</strong></span>
              <span>${titleB}: <strong class="text-indigo-700">${wsB} km/j</strong></span>
            </div>
          </div>
          <div class="p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 space-y-1.5">
            <span class="font-bold text-slate-800 block text-xs">Presipitasi / Curah Hujan:</span>
            <div class="flex justify-between text-xs pt-1">
              <span>${titleA}: <strong class="text-sky-700">${tpA} mm</strong></span>
              <span>${titleB}: <strong class="text-indigo-700">${tpB} mm</strong></span>
            </div>
          </div>
        </div>
      `;
}

async function updateComparison(options = {}) {
  const selA = document.getElementById("compare-select-a");
  const selB = document.getElementById("compare-select-b");
  const resultsContainer = document.getElementById("compare-results-container");
  const barsContainer = document.getElementById("compare-bars-list");
  if (!selA || !selB || !resultsContainer) return;

  const admA = selA.value || currentCompareA;
  const admB = selB.value || currentCompareB;
  currentCompareA = admA;
  currentCompareB = admB;

  if (options && options.useCache && lastCompareSides && lastCompareSides.admA === admA && lastCompareSides.admB === admB) {
    renderComparisonContent(lastCompareSides.sideA, lastCompareSides.sideB, resultsContainer, barsContainer);
    return;
  }

  const metaA = getCompareLocationMeta(admA);
  const metaB = getCompareLocationMeta(admB);

  // Tampilkan nama kota segera dari locationCodes.js
  const chipAName = document.getElementById("chip-a-name");
  const chipAProv = document.getElementById("chip-a-prov");
  const chipBName = document.getElementById("chip-b-name");
  const chipBProv = document.getElementById("chip-b-prov");
  if (chipAName) chipAName.textContent = metaA.title;
  if (chipAProv) chipAProv.textContent = `${metaA.provinsi || ""} · ADM4: ${admA || "-"}`;
  if (chipBName) chipBName.textContent = metaB.title;
  if (chipBProv) chipBProv.textContent = `${metaB.provinsi || ""} · ADM4: ${admB || "-"}`;

  resultsContainer.innerHTML = `
    <div class="col-span-2 text-center p-8 text-xs text-sky-700 font-bold animate-pulse bg-white/70 rounded-2xl border border-sky-200">
      <div class="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mx-auto mb-2"></div>
      Mengambil data meteorologi BMKG untuk ${metaA.title} dan ${metaB.title}...
    </div>
  `;

  try {
    const verifiedSet = await ensureVerifiedBmkgCodes();
    const [sideA, sideB] = await Promise.all([
      fetchCompareSide(admA, verifiedSet),
      fetchCompareSide(admB, verifiedSet)
    ]);

    if (sideA.available && sideB.available) {
      lastCompareSides = { admA, admB, sideA, sideB };
    }
    renderComparisonContent(sideA, sideB, resultsContainer, barsContainer);
  } catch (err) {
    resultsContainer.innerHTML = `<div class="col-span-2 text-center text-xs text-rose-500 p-6 bg-rose-50 rounded-2xl border border-rose-200">Data belum tersedia</div>`;
  }
}

window.populateCompareSelects = populateCompareSelects;
window.filterCompareOptions = filterCompareOptions;
window.onCompareSelectChange = onCompareSelectChange;
window.setComparePreset = setComparePreset;
window.swapCompareLocations = swapCompareLocations;
window.updateComparison = updateComparison;

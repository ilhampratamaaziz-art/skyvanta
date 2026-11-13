/* ============================================================
   SKYVANTA — LOCAL WEATHER ICON MAPPER
   Maps BMKG weather codes and descriptions to reliable local SVGs.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.iconMapper = exportsObj;
    root.getWeatherIcon = exportsObj.getWeatherIcon;
    root.getWeatherIconInfo = exportsObj.getWeatherIconInfo;
    root.getWeatherEmoji = exportsObj.getWeatherEmoji;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const ICON_DIR = "icons/";
  const DEFAULT_ICON = "berawan.svg";
  const DEFAULT_EMOJI = "☁️";

  // 8 Canonical Local Icons with standard meteorological emojis as fallback
  const ICONS = {
    cerah: { file: "cerah.svg", emoji: "☀️" },
    "cerah-berawan": { file: "cerah-berawan.svg", emoji: "🌤️" },
    berawan: { file: "berawan.svg", emoji: "☁️" },
    "hujan-ringan": { file: "hujan-ringan.svg", emoji: "🌦️" },
    "hujan-sedang": { file: "hujan-sedang.svg", emoji: "🌧️" },
    "hujan-lebat": { file: "hujan-lebat.svg", emoji: "⛈️" },
    petir: { file: "petir.svg", emoji: "⚡" },
    kabut: { file: "kabut.svg", emoji: "🌫️" }
  };

  // BMKG Official Numeric Code Mapping
  const CODE_MAP = {
    0: "cerah",           // Cerah / Clear
    1: "cerah-berawan",   // Cerah Berawan
    2: "cerah-berawan",   // Cerah Berawan
    3: "berawan",         // Berawan
    4: "berawan",         // Berawan Tebal
    5: "kabut",           // Udara Kabur
    10: "kabut",          // Asap
    45: "kabut",          // Kabut
    60: "hujan-ringan",   // Hujan Ringan
    61: "hujan-sedang",   // Hujan Sedang
    63: "hujan-lebat",    // Hujan Lebat
    80: "hujan-ringan",   // Hujan Lokal
    95: "petir",          // Hujan Petir
    97: "petir"           // Hujan Petir Ekstrem
  };

  /**
   * Resolve icon key by checking weather code and descriptive text
   * @param {string|number|null} desc - weather_desc or weather condition string
   * @param {number|string|null} code - BMKG numeric weather code
   * @returns {string} icon key (cerah, cerah-berawan, berawan, etc.)
   */
  function resolveIconKey(desc, code) {
    // 1. Try resolving by numeric BMKG code
    if (code !== undefined && code !== null && code !== "") {
      const numCode = parseInt(code, 10);
      if (!isNaN(numCode) && CODE_MAP[numCode]) {
        return CODE_MAP[numCode];
      }
    }

    // 2. Try resolving by text description
    const text = String(desc || "").toLowerCase().trim();
    if (!text) return "berawan";

    if (text.includes("petir") || text.includes("kilat") || text.includes("guntur") || /\bthunder\b/i.test(text)) {
      return "petir";
    }
    if (text.includes("lebat") || text.includes("ekstrem") || text.includes("torrential") || text.includes("heavy rain")) {
      return "hujan-lebat";
    }
    if (text.includes("sedang") || /\bmoderate\b/i.test(text)) {
      return "hujan-sedang";
    }
    if (text.includes("ringan") || text.includes("lokal") || text.includes("gerimis") || text.includes("drizzle") || text.includes("light rain")) {
      return "hujan-ringan";
    }
    if (text.includes("hujan") || /\brain\b/i.test(text) || /\bshower\b/i.test(text)) {
      return "hujan-sedang";
    }
    if (text.includes("kabut") || text.includes("kabur") || text.includes("asap") || /\bfog\b/i.test(text) || /\bhaze\b/i.test(text) || /\bmist\b/i.test(text) || /\bsmoke\b/i.test(text)) {
      return "kabut";
    }
    if (text.includes("cerah berawan") || text.includes("partly cloudy") || text.includes("sebagian berawan")) {
      return "cerah-berawan";
    }
    if (text.includes("cerah") || /\bclear\b/i.test(text) || /\bsunny\b/i.test(text) || text.includes("terik")) {
      return "cerah";
    }
    if (text.includes("berawan") || text.includes("mendung") || /\bcloudy?\b/i.test(text) || text.includes("overcast")) {
      return "berawan";
    }

    // Rule 4: Default if condition is unknown: berawan
    return "berawan";
  }

  /**
   * Get full info object for weather icon
   */
  function getWeatherIconInfo(desc, code) {
    const key = resolveIconKey(desc, code);
    const item = ICONS[key] || ICONS.berawan;
    return {
      key: key,
      file: item.file,
      src: ICON_DIR + item.file,
      emoji: item.emoji,
      fallbackSrc: ICON_DIR + DEFAULT_ICON
    };
  }

  /**
   * Get icon URL/path (local relative path without spaces)
   */
  function getWeatherIcon(desc, code) {
    return getWeatherIconInfo(desc, code).src;
  }

  /**
   * Get fallback weather emoji
   */
  function getWeatherEmoji(desc, code) {
    return getWeatherIconInfo(desc, code).emoji;
  }

  return {
    ICONS,
    CODE_MAP,
    resolveIconKey,
    getWeatherIconInfo,
    getWeatherIcon,
    getWeatherEmoji
  };
});

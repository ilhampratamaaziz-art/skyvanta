/* ============================================================
   SKYVANTA - Location Codes & Verified BMKG ADM4 Mappings
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const exportsObj = factory();
    root.locations = exportsObj.locations;
    root.locationCodes = exportsObj.locationCodes;
    root.getLocation = exportsObj.getLocation;
    root.PROVINCIAL_CAPITALS = exportsObj.PROVINCIAL_CAPITALS;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const locations = [
  {
    "name": "Jakarta Pusat (Gambir)",
    "kotkab": "Kota Adm. Jakarta Pusat",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.71.01.1001",
    "lat": -6.1764,
    "lon": 106.8267,
    "timezone": "WIB"
  },
  {
    "name": "Jakarta Selatan (Kebayoran Baru)",
    "kotkab": "Kota Adm. Jakarta Selatan",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.74.01.1001",
    "lat": -6.2415,
    "lon": 106.7979,
    "timezone": "WIB"
  },
  {
    "name": "Jakarta Barat (Grogol)",
    "kotkab": "Kota Adm. Jakarta Barat",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.73.01.1001",
    "lat": -6.1674,
    "lon": 106.7884,
    "timezone": "WIB"
  },
  {
    "name": "Jakarta Timur (Matraman)",
    "kotkab": "Kota Adm. Jakarta Timur",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.75.01.1001",
    "lat": -6.2088,
    "lon": 106.8676,
    "timezone": "WIB"
  },
  {
    "name": "Jakarta Utara (Koja)",
    "kotkab": "Kota Adm. Jakarta Utara",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.72.01.1001",
    "lat": -6.1264,
    "lon": 106.9056,
    "timezone": "WIB"
  },
  {
    "name": "Kepulauan Seribu (P. Panggang)",
    "kotkab": "Kab. Adm. Kepulauan Seribu",
    "provinsi": "DKI Jakarta",
    "pulau": "Jawa",
    "adm4": "31.01.01.1001",
    "lat": -5.5786,
    "lon": 106.6033,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bandung",
    "kotkab": "Kota Bandung",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.73.01.1001",
    "lat": -6.9175,
    "lon": 107.6191,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bogor",
    "kotkab": "Kota Bogor",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.71.01.1001",
    "lat": -6.5971,
    "lon": 106.806,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bekasi",
    "kotkab": "Kota Bekasi",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.75.01.1001",
    "lat": -6.2383,
    "lon": 106.9756,
    "timezone": "WIB"
  },
  {
    "name": "Kota Depok",
    "kotkab": "Kota Depok",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.76.03.1001",
    "lat": -6.4243,
    "lon": 106.7812,
    "timezone": "WIB"
  },
  {
    "name": "Kota Cimahi",
    "kotkab": "Kota Cimahi",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.77.01.1001",
    "lat": -6.8722,
    "lon": 107.5422,
    "timezone": "WIB"
  },
  {
    "name": "Kota Cirebon",
    "kotkab": "Kota Cirebon",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.74.01.1001",
    "lat": -6.732,
    "lon": 108.5523,
    "timezone": "WIB"
  },
  {
    "name": "Kota Sukabumi",
    "kotkab": "Kota Sukabumi",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.72.01.1001",
    "lat": -6.9277,
    "lon": 106.93,
    "timezone": "WIB"
  },
  {
    "name": "Kota Tasikmalaya",
    "kotkab": "Kota Tasikmalaya",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.78.01.1001",
    "lat": -7.3274,
    "lon": 108.2207,
    "timezone": "WIB"
  },
  {
    "name": "Kota Banjar",
    "kotkab": "Kota Banjar",
    "provinsi": "Jawa Barat",
    "pulau": "Jawa",
    "adm4": "32.79.01.1001",
    "lat": -7.3712,
    "lon": 108.5342,
    "timezone": "WIB"
  },
  {
    "name": "Kota Serang",
    "kotkab": "Kota Serang",
    "provinsi": "Banten",
    "pulau": "Jawa",
    "adm4": "36.73.01.1001",
    "lat": -6.1104,
    "lon": 106.164,
    "timezone": "WIB"
  },
  {
    "name": "Kota Tangerang",
    "kotkab": "Kota Tangerang",
    "provinsi": "Banten",
    "pulau": "Jawa",
    "adm4": "36.71.01.1001",
    "lat": -6.1783,
    "lon": 106.6319,
    "timezone": "WIB"
  },
  {
    "name": "Kota Tangerang Selatan",
    "kotkab": "Kota Tangerang Selatan",
    "provinsi": "Banten",
    "pulau": "Jawa",
    "adm4": "36.74.01.1001",
    "lat": -6.2886,
    "lon": 106.7179,
    "timezone": "WIB"
  },
  {
    "name": "Kota Cilegon",
    "kotkab": "Kota Cilegon",
    "provinsi": "Banten",
    "pulau": "Jawa",
    "adm4": "36.72.01.1001",
    "lat": -6.017,
    "lon": 106.0538,
    "timezone": "WIB"
  },
  {
    "name": "Kota Semarang",
    "kotkab": "Kota Semarang",
    "provinsi": "Jawa Tengah",
    "pulau": "Jawa",
    "adm4": "33.74.01.1001",
    "lat": -6.9667,
    "lon": 110.4167,
    "timezone": "WIB"
  },
  {
    "name": "Kota Surakarta (Solo)",
    "kotkab": "Kota Surakarta",
    "provinsi": "Jawa Tengah",
    "pulau": "Jawa",
    "adm4": "33.72.01.1001",
    "lat": -7.5755,
    "lon": 110.8243,
    "timezone": "WIB"
  },
  {
    "name": "Kota Salatiga",
    "kotkab": "Kota Salatiga",
    "provinsi": "Jawa Tengah",
    "pulau": "Jawa",
    "adm4": "33.73.01.1001",
    "lat": -7.3305,
    "lon": 110.5084,
    "timezone": "WIB"
  },
  {
    "name": "Kota Tegal",
    "kotkab": "Kota Tegal",
    "provinsi": "Jawa Tengah",
    "pulau": "Jawa",
    "adm4": "33.76.01.1001",
    "lat": -6.8694,
    "lon": 109.1402,
    "timezone": "WIB"
  },
  {
    "name": "Purwokerto (Kab. Banyumas)",
    "kotkab": "Kab. Banyumas",
    "provinsi": "Jawa Tengah",
    "pulau": "Jawa",
    "adm4": "33.02.01.2001",
    "lat": -7.4243,
    "lon": 109.2302,
    "timezone": "WIB"
  },
  {
    "name": "Kota Yogyakarta",
    "kotkab": "Kota Yogyakarta",
    "provinsi": "D.I. Yogyakarta",
    "pulau": "Jawa",
    "adm4": "34.71.01.1001",
    "lat": -7.7956,
    "lon": 110.3695,
    "timezone": "WIB"
  },
  {
    "name": "Kab. Sleman",
    "kotkab": "Kab. Sleman",
    "provinsi": "D.I. Yogyakarta",
    "pulau": "Jawa",
    "adm4": "34.04.01.2001",
    "lat": -7.7156,
    "lon": 110.3556,
    "timezone": "WIB"
  },
  {
    "name": "Kab. Bantul",
    "kotkab": "Kab. Bantul",
    "provinsi": "D.I. Yogyakarta",
    "pulau": "Jawa",
    "adm4": "34.02.01.2001",
    "lat": -7.8879,
    "lon": 110.3283,
    "timezone": "WIB"
  },
  {
    "name": "Kota Surabaya",
    "kotkab": "Kota Surabaya",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.78.01.1001",
    "lat": -7.2575,
    "lon": 112.7521,
    "timezone": "WIB"
  },
  {
    "name": "Kota Malang",
    "kotkab": "Kota Malang",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.73.01.1001",
    "lat": -7.9797,
    "lon": 112.6304,
    "timezone": "WIB"
  },
  {
    "name": "Kota Batu",
    "kotkab": "Kota Batu",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.79.01.1001",
    "lat": -7.8712,
    "lon": 112.527,
    "timezone": "WIB"
  },
  {
    "name": "Kota Kediri",
    "kotkab": "Kota Kediri",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.71.01.1001",
    "lat": -7.848,
    "lon": 112.0178,
    "timezone": "WIB"
  },
  {
    "name": "Kota Madiun",
    "kotkab": "Kota Madiun",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.77.01.1001",
    "lat": -7.6298,
    "lon": 111.5239,
    "timezone": "WIB"
  },
  {
    "name": "Kota Blitar",
    "kotkab": "Kota Blitar",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.72.01.1001",
    "lat": -8.0954,
    "lon": 112.1609,
    "timezone": "WIB"
  },
  {
    "name": "Kota Pasuruan",
    "kotkab": "Kota Pasuruan",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.75.01.1001",
    "lat": -7.6453,
    "lon": 112.9075,
    "timezone": "WIB"
  },
  {
    "name": "Kota Probolinggo",
    "kotkab": "Kota Probolinggo",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.74.01.1001",
    "lat": -7.7543,
    "lon": 113.2159,
    "timezone": "WIB"
  },
  {
    "name": "Kab. Banyuwangi",
    "kotkab": "Kab. Banyuwangi",
    "provinsi": "Jawa Timur",
    "pulau": "Jawa",
    "adm4": "35.10.01.2001",
    "lat": -8.2192,
    "lon": 114.3692,
    "timezone": "WIB"
  },
  {
    "name": "Kota Denpasar",
    "kotkab": "Kota Denpasar",
    "provinsi": "Bali",
    "pulau": "Bali & Nusa Tenggara",
    "adm4": "51.71.01.1001",
    "lat": -8.6705,
    "lon": 115.2126,
    "timezone": "WITA"
  },
  {
    "name": "Kota Mataram",
    "kotkab": "Kota Mataram",
    "provinsi": "Nusa Tenggara Barat",
    "pulau": "Bali & Nusa Tenggara",
    "adm4": "52.71.02.1001",
    "lat": -8.5833,
    "lon": 116.1167,
    "timezone": "WITA"
  },
  {
    "name": "Kota Bima",
    "kotkab": "Kota Bima",
    "provinsi": "Nusa Tenggara Barat",
    "pulau": "Bali & Nusa Tenggara",
    "adm4": "52.72.01.1001",
    "lat": -8.4539,
    "lon": 118.7275,
    "timezone": "WITA"
  },
  {
    "name": "Kota Kupang",
    "kotkab": "Kota Kupang",
    "provinsi": "Nusa Tenggara Timur",
    "pulau": "Bali & Nusa Tenggara",
    "adm4": "53.71.01.1001",
    "lat": -10.1772,
    "lon": 123.607,
    "timezone": "WITA"
  },
  {
    "name": "Labuan Bajo (Manggarai Barat)",
    "kotkab": "Kab. Manggarai Barat",
    "provinsi": "Nusa Tenggara Timur",
    "pulau": "Bali & Nusa Tenggara",
    "adm4": "53.15.01.2001",
    "lat": -8.4964,
    "lon": 119.8877,
    "timezone": "WITA"
  },
  {
    "name": "Kota Banda Aceh",
    "kotkab": "Kota Banda Aceh",
    "provinsi": "Aceh",
    "pulau": "Sumatera",
    "adm4": "11.71.01.2001",
    "lat": 5.5483,
    "lon": 95.3238,
    "timezone": "WIB"
  },
  {
    "name": "Kota Medan",
    "kotkab": "Kota Medan",
    "provinsi": "Sumatera Utara",
    "pulau": "Sumatera",
    "adm4": "12.71.01.1001",
    "lat": 3.5952,
    "lon": 98.6722,
    "timezone": "WIB"
  },
  {
    "name": "Kota Pematang Siantar",
    "kotkab": "Kota Pematang Siantar",
    "provinsi": "Sumatera Utara",
    "pulau": "Sumatera",
    "adm4": "12.72.01.1001",
    "lat": 2.959,
    "lon": 99.0687,
    "timezone": "WIB"
  },
  {
    "name": "Kota Binjai",
    "kotkab": "Kota Binjai",
    "provinsi": "Sumatera Utara",
    "pulau": "Sumatera",
    "adm4": "12.75.01.1001",
    "lat": 3.6001,
    "lon": 98.4854,
    "timezone": "WIB"
  },
  {
    "name": "Kota Padang",
    "kotkab": "Kota Padang",
    "provinsi": "Sumatera Barat",
    "pulau": "Sumatera",
    "adm4": "13.71.01.1001",
    "lat": -0.9471,
    "lon": 100.4172,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bukittinggi",
    "kotkab": "Kota Bukittinggi",
    "provinsi": "Sumatera Barat",
    "pulau": "Sumatera",
    "adm4": "13.75.01.1001",
    "lat": -0.3056,
    "lon": 100.3692,
    "timezone": "WIB"
  },
  {
    "name": "Kota Pekanbaru",
    "kotkab": "Kota Pekanbaru",
    "provinsi": "Riau",
    "pulau": "Sumatera",
    "adm4": "14.71.01.1002",
    "lat": 0.5071,
    "lon": 101.4478,
    "timezone": "WIB"
  },
  {
    "name": "Kota Batam",
    "kotkab": "Kota Batam",
    "provinsi": "Kepulauan Riau",
    "pulau": "Sumatera",
    "adm4": "21.71.01.1002",
    "lat": 1.1301,
    "lon": 104.0529,
    "timezone": "WIB"
  },
  {
    "name": "Kota Tanjung Pinang",
    "kotkab": "Kota Tanjung Pinang",
    "provinsi": "Kepulauan Riau",
    "pulau": "Sumatera",
    "adm4": "21.72.01.1001",
    "lat": 0.9167,
    "lon": 104.45,
    "timezone": "WIB"
  },
  {
    "name": "Kota Jambi",
    "kotkab": "Kota Jambi",
    "provinsi": "Jambi",
    "pulau": "Sumatera",
    "adm4": "15.71.01.1001",
    "lat": -1.6101,
    "lon": 103.6131,
    "timezone": "WIB"
  },
  {
    "name": "Kota Palembang",
    "kotkab": "Kota Palembang",
    "provinsi": "Sumatera Selatan",
    "pulau": "Sumatera",
    "adm4": "16.71.01.1001",
    "lat": -2.9909,
    "lon": 104.7565,
    "timezone": "WIB"
  },
  {
    "name": "Kota Pangkal Pinang",
    "kotkab": "Kota Pangkal Pinang",
    "provinsi": "Kepulauan Bangka Belitung",
    "pulau": "Sumatera",
    "adm4": "19.71.02.1001",
    "lat": -2.1161,
    "lon": 106.1167,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bengkulu",
    "kotkab": "Kota Bengkulu",
    "provinsi": "Bengkulu",
    "pulau": "Sumatera",
    "adm4": "17.71.01.1001",
    "lat": -3.8004,
    "lon": 102.2655,
    "timezone": "WIB"
  },
  {
    "name": "Kota Bandar Lampung",
    "kotkab": "Kota Bandar Lampung",
    "provinsi": "Lampung",
    "pulau": "Sumatera",
    "adm4": "18.71.01.1003",
    "lat": -5.3834,
    "lon": 105.2635,
    "timezone": "WIB"
  },
  {
    "name": "Kota Metro",
    "kotkab": "Kota Metro",
    "provinsi": "Lampung",
    "pulau": "Sumatera",
    "adm4": "18.72.01.1001",
    "lat": -5.1136,
    "lon": 105.3067,
    "timezone": "WIB"
  },
  {
    "name": "Kota Pontianak",
    "kotkab": "Kota Pontianak",
    "provinsi": "Kalimantan Barat",
    "pulau": "Kalimantan",
    "adm4": "61.71.01.1002",
    "lat": -0.0263,
    "lon": 109.3425,
    "timezone": "WIB"
  },
  {
    "name": "Kota Palangka Raya",
    "kotkab": "Kota Palangka Raya",
    "provinsi": "Kalimantan Tengah",
    "pulau": "Kalimantan",
    "adm4": "62.71.01.1001",
    "lat": -2.1997,
    "lon": 113.9503,
    "timezone": "WIB"
  },
  {
    "name": "Kota Banjarmasin",
    "kotkab": "Kota Banjarmasin",
    "provinsi": "Kalimantan Selatan",
    "pulau": "Kalimantan",
    "adm4": "63.71.01.1001",
    "lat": -3.3167,
    "lon": 114.5901,
    "timezone": "WITA"
  },
  {
    "name": "Kota Balikpapan",
    "kotkab": "Kota Balikpapan",
    "provinsi": "Kalimantan Timur",
    "pulau": "Kalimantan",
    "adm4": "64.71.01.1001",
    "lat": -1.2379,
    "lon": 116.8529,
    "timezone": "WITA"
  },
  {
    "name": "Kota Samarinda",
    "kotkab": "Kota Samarinda",
    "provinsi": "Kalimantan Timur",
    "pulau": "Kalimantan",
    "adm4": "64.72.01.1001",
    "lat": -0.5022,
    "lon": 117.1536,
    "timezone": "WITA"
  },
  {
    "name": "Kota Tarakan",
    "kotkab": "Kota Tarakan",
    "provinsi": "Kalimantan Utara",
    "pulau": "Kalimantan",
    "adm4": "65.71.01.1001",
    "lat": 3.3255,
    "lon": 117.5846,
    "timezone": "WITA"
  },
  {
    "name": "Kota Makassar",
    "kotkab": "Kota Makassar",
    "provinsi": "Sulawesi Selatan",
    "pulau": "Sulawesi",
    "adm4": "73.71.01.1001",
    "lat": -5.1477,
    "lon": 119.4327,
    "timezone": "WITA"
  },
  {
    "name": "Kota Manado",
    "kotkab": "Kota Manado",
    "provinsi": "Sulawesi Utara",
    "pulau": "Sulawesi",
    "adm4": "71.71.01.1001",
    "lat": 1.4748,
    "lon": 124.8428,
    "timezone": "WITA"
  },
  {
    "name": "Kota Palu",
    "kotkab": "Kota Palu",
    "provinsi": "Sulawesi Tengah",
    "pulau": "Sulawesi",
    "adm4": "72.71.02.1002",
    "lat": -0.9003,
    "lon": 119.8779,
    "timezone": "WITA"
  },
  {
    "name": "Kota Kendari",
    "kotkab": "Kota Kendari",
    "provinsi": "Sulawesi Tenggara",
    "pulau": "Sulawesi",
    "adm4": "74.71.03.1001",
    "lat": -3.9985,
    "lon": 122.5126,
    "timezone": "WITA"
  },
  {
    "name": "Kota Gorontalo",
    "kotkab": "Kota Gorontalo",
    "provinsi": "Gorontalo",
    "pulau": "Sulawesi",
    "adm4": "75.71.01.1001",
    "lat": 0.5435,
    "lon": 123.0568,
    "timezone": "WITA"
  },
  {
    "name": "Kab. Mamuju",
    "kotkab": "Kab. Mamuju",
    "provinsi": "Sulawesi Barat",
    "pulau": "Sulawesi",
    "adm4": "76.02.01.1002",
    "lat": -2.7492,
    "lon": 118.9673,
    "timezone": "WITA"
  },
  {
    "name": "Kota Ambon",
    "kotkab": "Kota Ambon",
    "provinsi": "Maluku",
    "pulau": "Maluku",
    "adm4": "81.71.01.2001",
    "lat": -3.6547,
    "lon": 128.1906,
    "timezone": "WIT"
  },
  {
    "name": "Kota Ternate",
    "kotkab": "Kota Ternate",
    "provinsi": "Maluku Utara",
    "pulau": "Maluku",
    "adm4": "82.71.01.1001",
    "lat": 0.7614,
    "lon": 127.3197,
    "timezone": "WIT"
  },
  {
    "name": "Kota Jayapura",
    "kotkab": "Kota Jayapura",
    "provinsi": "Papua",
    "pulau": "Papua",
    "adm4": "91.71.01.1001",
    "lat": -2.5916,
    "lon": 140.669,
    "timezone": "WIT"
  },
  {
    "name": "Tanjung Selor",
    "kotkab": "Kab. Bulungan",
    "provinsi": "Kalimantan Utara",
    "pulau": "Kalimantan",
    "adm4": "65.01.01.1001",
    "lat": 2.8143,
    "lon": 117.355,
    "timezone": "WITA"
  },
  {
    "name": "Sofifi (Tidore Kepulauan)",
    "kotkab": "Kota Tidore Kepulauan",
    "provinsi": "Maluku Utara",
    "pulau": "Maluku",
    "adm4": "82.72.01.1001",
    "lat": 0.6562,
    "lon": 127.4393,
    "timezone": "WIT"
  },
  {
    "name": "Kota Sorong",
    "kotkab": "Kota Sorong",
    "provinsi": "Papua Barat Daya",
    "pulau": "Papua",
    "adm4": "96.71.01.1001",
    "lat": -0.8764,
    "lon": 131.2833,
    "timezone": "WIT"
  },
  {
    "name": "Manokwari",
    "kotkab": "Kab. Manokwari",
    "provinsi": "Papua Barat",
    "pulau": "Papua",
    "adm4": "92.02.12.1001",
    "lat": -0.8535,
    "lon": 134.062,
    "timezone": "WIT"
  },
  {
    "name": "Nabire",
    "kotkab": "Kab. Nabire",
    "provinsi": "Papua Tengah",
    "pulau": "Papua",
    "adm4": "94.01.01.1001",
    "lat": -3.3919,
    "lon": 135.4863,
    "timezone": "WIT"
  },
  {
    "name": "Wamena",
    "kotkab": "Kab. Jayawijaya",
    "provinsi": "Papua Pegunungan",
    "pulau": "Papua",
    "adm4": "95.01.01.1001",
    "lat": -4.1018,
    "lon": 138.9458,
    "timezone": "WIT"
  },
  {
    "name": "Merauke",
    "kotkab": "Kab. Merauke",
    "provinsi": "Papua Selatan",
    "pulau": "Papua",
    "adm4": "93.01.01.2001",
    "lat": -8.5701,
    "lon": 140.5794,
    "timezone": "WIT"
  }
];

  const locationCodes = {
  "Jakarta Pusat (Gambir)": "31.71.01.1001",
  "Kota Adm. Jakarta Pusat": "31.71.01.1001",
  "Jakarta Selatan (Kebayoran Baru)": "31.74.01.1001",
  "Kota Adm. Jakarta Selatan": "31.74.01.1001",
  "Jakarta Barat (Grogol)": "31.73.01.1001",
  "Kota Adm. Jakarta Barat": "31.73.01.1001",
  "Jakarta Timur (Matraman)": "31.75.01.1001",
  "Kota Adm. Jakarta Timur": "31.75.01.1001",
  "Jakarta Utara (Koja)": "31.72.01.1001",
  "Kota Adm. Jakarta Utara": "31.72.01.1001",
  "Kepulauan Seribu (P. Panggang)": "31.01.01.1001",
  "Kab. Adm. Kepulauan Seribu": "31.01.01.1001",
  "Kota Bandung": "32.73.01.1001",
  "Kota Bogor": "32.71.01.1001",
  "Kota Bekasi": "32.75.01.1001",
  "Kota Depok": "32.76.03.1001",
  "Kota Cimahi": "32.77.01.1001",
  "Kota Cirebon": "32.74.01.1001",
  "Kota Sukabumi": "32.72.01.1001",
  "Kota Tasikmalaya": "32.78.01.1001",
  "Kota Banjar": "32.79.01.1001",
  "Kota Serang": "36.73.01.1001",
  "Kota Tangerang": "36.71.01.1001",
  "Kota Tangerang Selatan": "36.74.01.1001",
  "Kota Cilegon": "36.72.01.1001",
  "Kota Semarang": "33.74.01.1001",
  "Kota Surakarta (Solo)": "33.72.01.1001",
  "Kota Surakarta": "33.72.01.1001",
  "Kota Salatiga": "33.73.01.1001",
  "Kota Tegal": "33.76.01.1001",
  "Purwokerto (Kab. Banyumas)": "33.02.01.2001",
  "Kab. Banyumas": "33.02.01.2001",
  "Kota Yogyakarta": "34.71.01.1001",
  "Kab. Sleman": "34.04.01.2001",
  "Kab. Bantul": "34.02.01.2001",
  "Kota Surabaya": "35.78.01.1001",
  "Kota Malang": "35.73.01.1001",
  "Kota Batu": "35.79.01.1001",
  "Kota Kediri": "35.71.01.1001",
  "Kota Madiun": "35.77.01.1001",
  "Kota Blitar": "35.72.01.1001",
  "Kota Pasuruan": "35.75.01.1001",
  "Kota Probolinggo": "35.74.01.1001",
  "Kab. Banyuwangi": "35.10.01.2001",
  "Kota Denpasar": "51.71.01.1001",
  "Kota Mataram": "52.71.02.1001",
  "Kota Bima": "52.72.01.1001",
  "Kota Kupang": "53.71.01.1001",
  "Labuan Bajo (Manggarai Barat)": "53.15.01.2001",
  "Kab. Manggarai Barat": "53.15.01.2001",
  "Kota Banda Aceh": "11.71.01.2001",
  "Kota Medan": "12.71.01.1001",
  "Kota Pematang Siantar": "12.72.01.1001",
  "Kota Binjai": "12.75.01.1001",
  "Kota Padang": "13.71.01.1001",
  "Kota Bukittinggi": "13.75.01.1001",
  "Kota Pekanbaru": "14.71.01.1002",
  "Kota Batam": "21.71.01.1002",
  "Kota Tanjung Pinang": "21.72.01.1001",
  "Kota Jambi": "15.71.01.1001",
  "Kota Palembang": "16.71.01.1001",
  "Kota Pangkal Pinang": "19.71.02.1001",
  "Kota Bengkulu": "17.71.01.1001",
  "Kota Bandar Lampung": "18.71.01.1003",
  "Kota Metro": "18.72.01.1001",
  "Kota Pontianak": "61.71.01.1002",
  "Kota Palangka Raya": "62.71.01.1001",
  "Kota Banjarmasin": "63.71.01.1001",
  "Kota Balikpapan": "64.71.01.1001",
  "Kota Samarinda": "64.72.01.1001",
  "Kota Tarakan": "65.71.01.1001",
  "Kota Makassar": "73.71.01.1001",
  "Kota Manado": "71.71.01.1001",
  "Kota Palu": "72.71.02.1002",
  "Kota Kendari": "74.71.03.1001",
  "Kota Gorontalo": "75.71.01.1001",
  "Kab. Mamuju": "76.02.01.1002",
  "Kota Ambon": "81.71.01.2001",
  "Kota Ternate": "82.71.01.1001",
  "Kota Jayapura": "91.71.01.1001",
  "Tanjung Selor": "65.01.01.1001",
  "Kab. Bulungan": "65.01.01.1001",
  "Sofifi (Tidore Kepulauan)": "82.72.01.1001",
  "Kota Tidore Kepulauan": "82.72.01.1001",
  "Kota Sorong": "96.71.01.1001",
  "Manokwari": "92.02.12.1001",
  "Kab. Manokwari": "92.02.12.1001",
  "Nabire": "94.01.01.1001",
  "Kab. Nabire": "94.01.01.1001",
  "Wamena": "95.01.01.1001",
  "Kab. Jayawijaya": "95.01.01.1001",
  "Merauke": "93.01.01.2001",
  "Kab. Merauke": "93.01.01.2001",
  "Balikpapan": "64.71.01.1001"
};

  function getLocation(query) {
    if (!query) return null;
    const q = String(query).toLowerCase().trim();
    const byAdm = locations.find(l => l.adm4 && l.adm4 === query);
    if (byAdm) return byAdm;

    const exact = locations.find(l => 
      (l.name && l.name.toLowerCase() === q) ||
      (l.kotkab && l.kotkab.toLowerCase() === q)
    );
    if (exact) return exact;

    const cleanQ = q.replace(/^(kota|kab\.|kabupaten)\s+/i, '').trim();
    const cleanMatch = locations.find(l => {
      const cleanName = (l.name || '').toLowerCase().replace(/^(kota|kab\.|kabupaten)\s+/i, '').trim();
      const cleanKot = (l.kotkab || '').toLowerCase().replace(/^(kota|kab\.|kabupaten)\s+/i, '').trim();
      return cleanName === cleanQ || cleanKot === cleanQ;
    });
    if (cleanMatch) return cleanMatch;

    for (const [key, code] of Object.entries(locationCodes)) {
      if (key.toLowerCase() === q || key.toLowerCase().replace(/^(kota|kab\.|kabupaten)\s+/i, '').trim() === cleanQ) {
        return locations.find(l => l.adm4 === code) || null;
      }
    }
    return null;
  }


  const PROVINCIAL_CAPITALS = [
    // Sumatera (10)
    { capital: "Banda Aceh", name: "Kota Banda Aceh", provinsi: "Aceh", pulau: "Sumatera", adm4: "11.71.01.2001" },
    { capital: "Medan", name: "Kota Medan", provinsi: "Sumatera Utara", pulau: "Sumatera", adm4: "12.71.01.1001" },
    { capital: "Padang", name: "Kota Padang", provinsi: "Sumatera Barat", pulau: "Sumatera", adm4: "13.71.01.1001" },
    { capital: "Pekanbaru", name: "Kota Pekanbaru", provinsi: "Riau", pulau: "Sumatera", adm4: "14.71.01.1002" },
    { capital: "Tanjung Pinang", name: "Kota Tanjung Pinang", provinsi: "Kepulauan Riau", pulau: "Sumatera", adm4: "21.72.01.1001" },
    { capital: "Jambi", name: "Kota Jambi", provinsi: "Jambi", pulau: "Sumatera", adm4: "15.71.01.1001" },
    { capital: "Palembang", name: "Kota Palembang", provinsi: "Sumatera Selatan", pulau: "Sumatera", adm4: "16.71.01.1001" },
    { capital: "Pangkal Pinang", name: "Kota Pangkal Pinang", provinsi: "Kepulauan Bangka Belitung", pulau: "Sumatera", adm4: "19.71.02.1001" },
    { capital: "Bengkulu", name: "Kota Bengkulu", provinsi: "Bengkulu", pulau: "Sumatera", adm4: "17.71.01.1001" },
    { capital: "Bandar Lampung", name: "Kota Bandar Lampung", provinsi: "Lampung", pulau: "Sumatera", adm4: "18.71.01.1003" },

    // Jawa (6)
    { capital: "Serang", name: "Kota Serang", provinsi: "Banten", pulau: "Jawa", adm4: "36.73.01.1001" },
    { capital: "Jakarta Pusat", name: "Jakarta Pusat (Gambir)", provinsi: "DKI Jakarta", pulau: "Jawa", adm4: "31.71.01.1001" },
    { capital: "Bandung", name: "Kota Bandung", provinsi: "Jawa Barat", pulau: "Jawa", adm4: "32.73.01.1001" },
    { capital: "Semarang", name: "Kota Semarang", provinsi: "Jawa Tengah", pulau: "Jawa", adm4: "33.74.01.1001" },
    { capital: "Yogyakarta", name: "Kota Yogyakarta", provinsi: "D.I. Yogyakarta", pulau: "Jawa", adm4: "34.71.01.1001" },
    { capital: "Surabaya", name: "Kota Surabaya", provinsi: "Jawa Timur", pulau: "Jawa", adm4: "35.78.01.1001" },

    // Bali & Nusa Tenggara (3)
    { capital: "Denpasar", name: "Kota Denpasar", provinsi: "Bali", pulau: "Bali & Nusa Tenggara", adm4: "51.71.01.1001" },
    { capital: "Mataram", name: "Kota Mataram", provinsi: "Nusa Tenggara Barat", pulau: "Bali & Nusa Tenggara", adm4: "52.71.02.1001" },
    { capital: "Kupang", name: "Kota Kupang", provinsi: "Nusa Tenggara Timur", pulau: "Bali & Nusa Tenggara", adm4: "53.71.01.1001" },

    // Kalimantan (5)
    { capital: "Pontianak", name: "Kota Pontianak", provinsi: "Kalimantan Barat", pulau: "Kalimantan", adm4: "61.71.01.1002" },
    { capital: "Palangka Raya", name: "Kota Palangka Raya", provinsi: "Kalimantan Tengah", pulau: "Kalimantan", adm4: "62.71.01.1001" },
    { capital: "Banjarmasin", name: "Kota Banjarmasin", provinsi: "Kalimantan Selatan", pulau: "Kalimantan", adm4: "63.71.01.1001" },
    { capital: "Samarinda", name: "Kota Samarinda", provinsi: "Kalimantan Timur", pulau: "Kalimantan", adm4: "64.72.01.1001" },
    { capital: "Tanjung Selor", name: "Tanjung Selor", provinsi: "Kalimantan Utara", pulau: "Kalimantan", adm4: "65.01.01.1001" },

    // Sulawesi (6)
    { capital: "Manado", name: "Kota Manado", provinsi: "Sulawesi Utara", pulau: "Sulawesi", adm4: "71.71.01.1001" },
    { capital: "Gorontalo", name: "Kota Gorontalo", provinsi: "Gorontalo", pulau: "Sulawesi", adm4: "75.71.01.1001" },
    { capital: "Palu", name: "Kota Palu", provinsi: "Sulawesi Tengah", pulau: "Sulawesi", adm4: "72.71.02.1002" },
    { capital: "Mamuju", name: "Kab. Mamuju", provinsi: "Sulawesi Barat", pulau: "Sulawesi", adm4: "76.02.01.1002" },
    { capital: "Makassar", name: "Kota Makassar", provinsi: "Sulawesi Selatan", pulau: "Sulawesi", adm4: "73.71.01.1001" },
    { capital: "Kendari", name: "Kota Kendari", provinsi: "Sulawesi Tenggara", pulau: "Sulawesi", adm4: "74.71.03.1001" },

    // Maluku (2)
    { capital: "Ambon", name: "Kota Ambon", provinsi: "Maluku", pulau: "Maluku", adm4: "81.71.01.2001" },
    { capital: "Sofifi", name: "Sofifi (Tidore Kepulauan)", provinsi: "Maluku Utara", pulau: "Maluku", adm4: "82.72.01.1001" },

    // Papua (6)
    { capital: "Sorong", name: "Kota Sorong", provinsi: "Papua Barat Daya", pulau: "Papua", adm4: "96.71.01.1001" },
    { capital: "Manokwari", name: "Manokwari", provinsi: "Papua Barat", pulau: "Papua", adm4: "92.02.12.1001" },
    { capital: "Nabire", name: "Nabire", provinsi: "Papua Tengah", pulau: "Papua", adm4: "94.01.01.1001" },
    { capital: "Jayapura", name: "Kota Jayapura", provinsi: "Papua", pulau: "Papua", adm4: "91.71.01.1001" },
    { capital: "Wamena", name: "Wamena", provinsi: "Papua Pegunungan", pulau: "Papua", adm4: "95.01.01.1001" },
    { capital: "Merauke", name: "Merauke", provinsi: "Papua Selatan", pulau: "Papua", adm4: "93.01.01.2001" }
  ];

  return {
    locations,
    PROVINCIAL_CAPITALS,
    locationCodes,
    getLocation,
    DEFAULT_LOCATIONS: locations
  };
});

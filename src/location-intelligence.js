const ROMANIAN_PLACES = [
  ["bucharest", "București", 44.4268, 26.1025],
  ["bucuresti", "București", 44.4268, 26.1025],
  ["cluj napoca", "Cluj-Napoca", 46.7712, 23.6236],
  ["cluj", "Cluj-Napoca", 46.7712, 23.6236],
  ["timisoara", "Timișoara", 45.7489, 21.2087],
  ["iasi", "Iași", 47.1585, 27.6014],
  ["constanta", "Constanța", 44.1598, 28.6348],
  ["craiova", "Craiova", 44.3302, 23.7949],
  ["brasov", "Brașov", 45.6427, 25.5887],
  ["galati", "Galați", 45.4353, 28.008],
  ["ploiesti", "Ploiești", 44.9367, 26.0129],
  ["oradea", "Oradea", 47.0465, 21.9189],
  ["braila", "Brăila", 45.2692, 27.9575],
  ["arad", "Arad", 46.1866, 21.3123],
  ["pitesti", "Pitești", 44.8565, 24.8692],
  ["sibiu", "Sibiu", 45.7983, 24.1256],
  ["bacau", "Bacău", 46.567, 26.9146],
  ["targu mures", "Târgu Mureș", 46.5425, 24.5575],
  ["baia mare", "Baia Mare", 47.6567, 23.5849],
  ["buzau", "Buzău", 45.1507, 26.8236],
  ["botosani", "Botoșani", 47.7486, 26.6694],
  ["satu mare", "Satu Mare", 47.7928, 22.8854],
  ["ramnicu valcea", "Râmnicu Vâlcea", 45.0997, 24.3693],
  ["suceava", "Suceava", 47.6635, 26.2732],
  ["piatra neamt", "Piatra Neamț", 46.9275, 26.3708],
  ["drobeta turnu severin", "Drobeta-Turnu Severin", 44.6369, 22.6597],
  ["targu jiu", "Târgu Jiu", 45.045, 23.274],
  ["tulcea", "Tulcea", 45.1716, 28.7914],
  ["focsani", "Focșani", 45.6965, 27.1865],
  ["alba iulia", "Alba Iulia", 46.067, 23.57],
  ["resita", "Reșița", 45.297, 21.889],
  ["deva", "Deva", 45.8787, 22.911],
  ["slatina", "Slatina", 44.4302, 24.3717],
  ["calarasi", "Călărași", 44.2051, 27.3136],
  ["giurgiu", "Giurgiu", 43.9037, 25.9699],
  ["voluntari", "Voluntari", 44.49, 26.1734],
  ["otopeni", "Otopeni", 44.5506, 26.0727]
].map(([key, city, latitude, longitude]) => ({ key, city, latitude, longitude }));

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finiteCoordinate(value, min, max) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function readHeader(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : String(value || "");
}

export function resolveRomanianPlace(value = "") {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return ROMANIAN_PLACES.find((place) =>
    normalized === place.key ||
    normalized.startsWith(`${place.key} `) ||
    normalized.endsWith(` ${place.key}`) ||
    normalized.includes(` ${place.key} `)
  ) || null;
}

export function resolveViewerLocation({ cf = null, headers = null, overrideCity = "", fallbackCity = "" } = {}) {
  const manualCity = String(overrideCity || "").trim();
  const edgeCity = String(cf?.city || readHeader(headers, "cf-ipcity") || "").trim();
  const configuredCity = String(fallbackCity || "").trim();
  const requestedCity = manualCity || edgeCity || configuredCity;
  const place = resolveRomanianPlace(requestedCity);

  if (place) {
    return {
      city: place.city,
      region: String(cf?.region || readHeader(headers, "cf-region") || "").trim(),
      countryCode: String(cf?.country || readHeader(headers, "cf-ipcountry") || "RO").trim().toUpperCase(),
      latitude: place.latitude,
      longitude: place.longitude,
      source: manualCity ? "manual" : edgeCity ? "edge" : "demo",
      isApproximate: true
    };
  }

  const latitude = finiteCoordinate(cf?.latitude || readHeader(headers, "cf-iplatitude"), -90, 90);
  const longitude = finiteCoordinate(cf?.longitude || readHeader(headers, "cf-iplongitude"), -180, 180);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    city: requestedCity || "Zona ta",
    region: String(cf?.region || readHeader(headers, "cf-region") || "").trim(),
    countryCode: String(cf?.country || readHeader(headers, "cf-ipcountry") || "").trim().toUpperCase(),
    latitude: Math.round(latitude * 10) / 10,
    longitude: Math.round(longitude * 10) / 10,
    source: manualCity ? "manual" : "edge",
    isApproximate: true
  };
}

export function publicViewerLocation(location) {
  if (!location) return null;
  return {
    city: location.city || "Zona ta",
    region: location.region || "",
    countryCode: location.countryCode || "",
    source: location.source || "edge",
    isApproximate: true
  };
}

export function viewerLocationCacheKey(location) {
  if (!location) return "none";
  return normalizeText(location.city) || `${location.latitude}:${location.longitude}`;
}

export function calculateDistanceKm(from, to) {
  if (!from || !to) return null;
  const values = [from.latitude, from.longitude, to.latitude, to.longitude];
  if (!values.every(Number.isFinite)) return null;
  const radians = (degrees) => degrees * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function buildListingProximity(item, viewerLocation) {
  if (!viewerLocation) return null;
  const place = resolveRomanianPlace(item?.location || "");
  if (!place) return null;
  const distanceKm = calculateDistanceKm(viewerLocation, place);
  if (!Number.isFinite(distanceKm)) return null;
  return {
    distanceKm,
    listingCity: place.city,
    label: distanceKm <= 10 ? "în apropiere" : `aprox. ${distanceKm} km`,
    isApproximate: true
  };
}

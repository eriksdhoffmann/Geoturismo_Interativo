/**
 * Geoportal Itajaí — Sistema de Coordenadas (SIRGAS 2000 / UTM 22S & WGS84),
 * Conversões, Escala Cartográfica e Cálculos Geodésicos.
 */
window.GeoCoords = (() => {
  // Elipsoide GRS80 (SIRGAS 2000 / EPSG:31982 — Fuso 22 Sul)
  const A = 6378137.0;
  const F = 1 / 298.257222101;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const K0 = 0.9996;
  const LON0_DEG = -51.0; // Meridiano central Fuso 22S
  const LON0 = (LON0_DEG * Math.PI) / 180;
  const FALSE_EASTING = 500000.0;
  const FALSE_NORTHING = 10000000.0;
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  /**
   * Converte Lat/Lon (WGS84 / SIRGAS 2000) para UTM 22S (EPSG:31982).
   */
  function latLonToUtm22S(lat, lon) {
    const phi = lat * DEG2RAD;
    const lam = lon * DEG2RAD;
    const sinP = Math.sin(phi);
    const cosP = Math.cos(phi);
    const tanP = Math.tan(phi);

    const N = A / Math.sqrt(1 - E2 * sinP * sinP);
    const T = tanP * tanP;
    const C = EP2 * cosP * cosP;
    const AA = cosP * (lam - LON0);

    const M =
      A *
      ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256) * phi -
        ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024) * Math.sin(2 * phi) +
        ((15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024) * Math.sin(4 * phi) -
        ((35 * E2 * E2 * E2) / 3072) * Math.sin(6 * phi));

    const easting =
      FALSE_EASTING +
      K0 *
        N *
        (AA +
          ((1 - T + C) * Math.pow(AA, 3)) / 6 +
          ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(AA, 5)) / 120);

    let northing =
      K0 *
      (M +
        N *
          tanP *
          ((AA * AA) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * Math.pow(AA, 4)) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(AA, 6)) / 720));

    if (lat < 0) northing += FALSE_NORTHING;
    return { easting, northing, zone: '22J' };
  }

  /**
   * Converte UTM 22S (EPSG:31982) para Lat/Lon (WGS84 / SIRGAS 2000).
   */
  function utm22SToLatLon(easting, northing) {
    const x = easting - FALSE_EASTING;
    const y = northing - FALSE_NORTHING;
    const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
    const M = y / K0;
    const mu =
      M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256));

    const phi1 =
      mu +
      ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
      ((21 * e1 * e1) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu) +
      ((151 * Math.pow(e1, 3)) / 96) * Math.sin(6 * mu) +
      ((1097 * Math.pow(e1, 4)) / 512) * Math.sin(8 * mu);

    const sinP1 = Math.sin(phi1);
    const cosP1 = Math.cos(phi1);
    const tanP1 = Math.tan(phi1);

    const N1 = A / Math.sqrt(1 - E2 * sinP1 * sinP1);
    const T1 = tanP1 * tanP1;
    const C1 = EP2 * cosP1 * cosP1;
    const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * sinP1 * sinP1, 1.5);
    const D = x / (N1 * K0);

    const lat =
      phi1 -
      ((N1 * tanP1) / R1) *
        ((D * D) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * Math.pow(D, 4)) / 24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * Math.pow(D, 6)) /
            720);

    const lon =
      LON0 +
      (D -
        ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
        ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * Math.pow(D, 5)) / 120) /
        cosP1;

    return { lat: lat * RAD2DEG, lon: lon * RAD2DEG };
  }

  function toDMS(deg, isLat) {
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(2);
    const hemi = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(5, '0')}"${hemi}`;
  }

  function formatCoords(lat, lon, crsMode = 'utm') {
    if (crsMode === 'utm') {
      const { easting, northing } = latLonToUtm22S(lat, lon);
      return `${easting.toFixed(3).replace('.', ',')}  ${northing.toFixed(3).replace('.', ',')}`;
    }
    if (crsMode === 'dms') {
      return `${toDMS(lat, true)}  ${toDMS(lon, false)}`;
    }
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }

  /**
   * Interpreta texto digitado pelo usuário como coordenada WGS84 ou UTM 22S.
   * Retorna { lat, lon, label } ou null.
   */
  function parseCoordinateQuery(raw) {
    const cleaned = String(raw || '').trim().replace(/;/g, ' ').replace(/\s+/g, ' ');
    // Caso 1: Lat, Lon em graus decimais (ex: -26.9078, -48.6619)
    const mDec = cleaned.match(/^(-?\d{1,2}[.,]\d+)\s*[,\s]\s*(-?\d{1,3}[.,]\d+)$/);
    if (mDec) {
      const a = parseFloat(mDec[1].replace(',', '.'));
      const b = parseFloat(mDec[2].replace(',', '.'));
      if (a >= -35 && a <= -20 && b >= -56 && b <= -44) {
        return { lat: a, lon: b, label: `Coordenada WGS84 (${a.toFixed(5)}, ${b.toFixed(5)})` };
      }
      if (b >= -35 && b <= -20 && a >= -56 && a <= -44) {
        return { lat: b, lon: a, label: `Coordenada WGS84 (${b.toFixed(5)}, ${a.toFixed(5)})` };
      }
    }
    // Caso 2: UTM 22S (ex: 732150, 7021500 ou 732150.5 7021500.2)
    const mUtm = cleaned.match(/^(\d{6}(?:[.,]\d+)?)\s*[,\s]\s*(\d{7}(?:[.,]\d+)?)$/);
    if (mUtm) {
      const e = parseFloat(mUtm[1].replace(',', '.'));
      const n = parseFloat(mUtm[2].replace(',', '.'));
      if (e >= 650000 && e <= 800000 && n >= 6950000 && n <= 7100000) {
        const ll = utm22SToLatLon(e, n);
        return { lat: ll.lat, lon: ll.lon, label: `UTM 22S (${e.toFixed(1)} E, ${n.toFixed(1)} N)` };
      }
    }
    return null;
  }

  /**
   * Calcula escala cartográfica aproximada (1 : N) na latitude atual (96 DPI).
   */
  function getScaleDenominator(lat, zoom) {
    const metersPerPixel = (156543.03392 * Math.cos(lat * DEG2RAD)) / Math.pow(2, zoom);
    // 96 DPI -> 1 pixel = 0.0254 / 96 = 0.0002645833 m
    return Math.round(metersPerPixel / 0.0002645833);
  }

  function getZoomForScale(lat, scaleDenominator) {
    const metersPerPixel = scaleDenominator * 0.0002645833;
    const z = Math.log2((156543.03392 * Math.cos(lat * DEG2RAD)) / metersPerPixel);
    return Math.max(10, Math.min(20, z));
  }

  /**
   * Distância geodésica (Haversine) em metros entre dois L.LatLng.
   */
  function distanceMeters(a, b) {
    const R = 6371008.8;
    const dLat = (b.lat - a.lat) * DEG2RAD;
    const dLon = (b.lng - a.lng) * DEG2RAD;
    const la1 = a.lat * DEG2RAD;
    const la2 = b.lat * DEG2RAD;
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /**
   * Área geodésica aproximada (excesso esférico) em m² de um polígono [{lat, lng}, ...].
   */
  function polygonAreaSqMeters(latlngs) {
    if (!latlngs || latlngs.length < 3) return 0;
    const R = 6378137.0;
    let area = 0;
    const n = latlngs.length;
    for (let i = 0; i < n; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % n];
      area +=
        ((p2.lng - p1.lng) * DEG2RAD) *
        (2 + Math.sin(p1.lat * DEG2RAD) + Math.sin(p2.lat * DEG2RAD));
    }
    return Math.abs((area * R * R) / 2.0);
  }

  function formatDistance(m) {
    if (m >= 1000) return `${(m / 1000).toFixed(2).replace('.', ',')} km`;
    return `${m.toFixed(1).replace('.', ',')} m`;
  }

  function formatArea(m2) {
    if (m2 >= 1000000) return `${(m2 / 1000000).toFixed(3).replace('.', ',')} km²`;
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2).replace('.', ',')} ha (${Math.round(m2).toLocaleString('pt-BR')} m²)`;
    return `${m2.toFixed(1).replace('.', ',')} m²`;
  }

  return {
    latLonToUtm22S,
    utm22SToLatLon,
    toDMS,
    formatCoords,
    parseCoordinateQuery,
    getScaleDenominator,
    getZoomForScale,
    distanceMeters,
    polygonAreaSqMeters,
    formatDistance,
    formatArea,
  };
})();

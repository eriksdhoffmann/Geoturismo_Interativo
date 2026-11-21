/**
 * Geoportal Itajaí — Ferramentas Interativas do Mapa (Padrão Geoportal Florianópolis)
 * Busca Unificada (Bairro/Rua/Lote/Coordenadas), Identificação Multi-Camada,
 * Medição Geodésica (Distância/Área), Desenho & Exportação GeoJSON/KML,
 * Comparador Temporal (Cortina 1984–2024), Zoom por Retângulo, Histórico de Vistas e Impressão.
 */
window.GeoTools = (() => {
  const {
    ITAJAI_CENTER,
    ITAJAI_BOUNDS,
    BASEMAPS,
    buildServiceUrl,
  } = window.GeoCatalog;
  const {
    formatCoords,
    parseCoordinateQuery,
    distanceMeters,
    polygonAreaSqMeters,
    formatDistance,
    formatArea,
    getScaleDenominator,
  } = window.GeoCoords;
  const { prettyFieldName, formatFieldValue, escapeHtml } = window.GeoLayerEngine;

  function createTools(map, engine, ui) {
    // Modo interativo ativo: 'pan' | 'boxZoom' | 'identify' | 'select' | 'measureDist' | 'measureArea' | 'drawPoint' | 'drawLine' | 'drawPoly'
    let activeMode = 'pan';

    // Highlight layer (resultados de busca e ponto identificado)
    const highlightGroup = L.layerGroup().addTo(map);
    const measureGroup = L.layerGroup().addTo(map);
    const drawGroup = L.layerGroup().addTo(map);

    // Histórico de navegação (Undo / Redo)
    const viewHistory = [];
    let historyIdx = -1;
    let suppressHistory = false;

    function recordView() {
      if (suppressHistory) return;
      const entry = { center: map.getCenter(), zoom: map.getZoom() };
      if (historyIdx < viewHistory.length - 1) {
        viewHistory.splice(historyIdx + 1);
      }
      const last = viewHistory[viewHistory.length - 1];
      if (
        last &&
        Math.abs(last.center.lat - entry.center.lat) < 1e-6 &&
        Math.abs(last.center.lng - entry.center.lng) < 1e-6 &&
        last.zoom === entry.zoom
      ) {
        return;
      }
      viewHistory.push(entry);
      if (viewHistory.length > 40) viewHistory.shift();
      historyIdx = viewHistory.length - 1;
      ui.updateHistoryButtons?.(historyIdx > 0, historyIdx < viewHistory.length - 1);
    }

    map.on('moveend', recordView);
    recordView();

    function undoView() {
      if (historyIdx <= 0) return;
      historyIdx--;
      suppressHistory = true;
      const v = viewHistory[historyIdx];
      map.setView(v.center, v.zoom);
      setTimeout(() => {
        suppressHistory = false;
        ui.updateHistoryButtons?.(historyIdx > 0, historyIdx < viewHistory.length - 1);
      }, 300);
    }

    function redoView() {
      if (historyIdx >= viewHistory.length - 1) return;
      historyIdx++;
      suppressHistory = true;
      const v = viewHistory[historyIdx];
      map.setView(v.center, v.zoom);
      setTimeout(() => {
        suppressHistory = false;
        ui.updateHistoryButtons?.(historyIdx > 0, historyIdx < viewHistory.length - 1);
      }, 300);
    }

    function resetHome() {
      const drawerClosed = document.getElementById('workspace')?.classList.contains('drawer-closed');
      const rightPad = drawerClosed || window.innerWidth <= 760 ? 32 : 386;
      map.fitBounds(ITAJAI_BOUNDS, {
        paddingTopLeft: [56, 22],
        paddingBottomRight: [rightPad, 40],
      });
    }

    function locateUser() {
      if (!navigator.geolocation) {
        ui.showToast?.('Geolocalização não suportada neste navegador.', 'error');
        return;
      }
      ui.showToast?.('Obtendo sua localização GPS...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          highlightGroup.clearLayers();
          L.circle([latitude, longitude], {
            radius: Math.min(accuracy, 150),
            color: '#0284c7',
            fillColor: '#38bdf8',
            fillOpacity: 0.2,
            weight: 1.5,
            pane: 'paneHighlight',
          }).addTo(highlightGroup);
          L.circleMarker([latitude, longitude], {
            radius: 7,
            color: '#ffffff',
            weight: 2.5,
            fillColor: '#0284c7',
            fillOpacity: 1,
            pane: 'paneHighlight',
          })
            .bindPopup(`<b>Sua Localização</b><br>Lat: ${latitude.toFixed(6)}<br>Lon: ${longitude.toFixed(6)}<br>Precisão: ±${Math.round(accuracy)} m`)
            .addTo(highlightGroup)
            .openPopup();
          map.setView([latitude, longitude], 16);
        },
        (err) => {
          ui.showToast?.(`Não foi possível obter localização: ${err.message}`, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    // ---- Gerenciamento de Modos Interativos ----
    function setMode(mode) {
      cleanupTransientHandlers();
      activeMode = mode;

      const container = map.getContainer();
      container.classList.remove('cursor-crosshair', 'cursor-identify', 'cursor-zoombox');

      if (mode === 'boxZoom') {
        container.classList.add('cursor-zoombox');
        startBoxZoom();
      } else if (mode === 'identify' || mode === 'select') {
        container.classList.add('cursor-identify');
      } else if (mode.startsWith('measure') || mode.startsWith('draw')) {
        container.classList.add('cursor-crosshair');
      }

      ui.onModeChange?.(mode);
    }

    function getMode() {
      return activeMode;
    }

    function shouldInterceptClick() {
      return activeMode !== 'pan';
    }

    // ---- Zoom por Retângulo (Box Zoom manual sem exigir Shift) ----
    let boxStart = null;
    let boxRect = null;

    function startBoxZoom() {
      map.dragging.disable();
      map.on('mousedown', onBoxDown);
      map.on('mousemove', onBoxMove);
      map.on('mouseup', onBoxUp);
    }

    function stopBoxZoom() {
      map.dragging.enable();
      map.off('mousedown', onBoxDown);
      map.off('mousemove', onBoxMove);
      map.off('mouseup', onBoxUp);
      if (boxRect) {
        map.removeLayer(boxRect);
        boxRect = null;
      }
      boxStart = null;
    }

    function onBoxDown(e) {
      if (e.originalEvent.button !== 0) return;
      boxStart = e.latlng;
      boxRect = L.rectangle([boxStart, boxStart], {
        color: '#0066a1',
        weight: 2,
        dashArray: '5 4',
        fillColor: '#38bdf8',
        fillOpacity: 0.18,
        pane: 'paneHighlight',
      }).addTo(map);
    }

    function onBoxMove(e) {
      if (!boxStart || !boxRect) return;
      boxRect.setBounds(L.latLngBounds(boxStart, e.latlng));
    }

    function onBoxUp(e) {
      if (!boxStart || !boxRect) return;
      const bounds = L.latLngBounds(boxStart, e.latlng);
      map.removeLayer(boxRect);
      boxRect = null;
      boxStart = null;
      if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 15) {
        map.fitBounds(bounds);
      }
      setMode('pan');
    }

    function cleanupTransientHandlers() {
      stopBoxZoom();
      cancelCurrentMeasureSegment();
      cancelCurrentDrawSegment();
    }

    // ---- Medição Geodésica (Distância e Área) ----
    let measurePoints = [];
    let measurePreviewLine = null;
    let measureActiveShape = null;

    function cancelCurrentMeasureSegment() {
      if (measurePreviewLine) {
        map.removeLayer(measurePreviewLine);
        measurePreviewLine = null;
      }
      measurePoints = [];
      measureActiveShape = null;
    }

    function clearMeasurements() {
      cancelCurrentMeasureSegment();
      measureGroup.clearLayers();
      ui.updateMeasureOutput?.('Clique no mapa para iniciar a medição.');
    }

    function updateMeasureRender(hoverLatLng = null) {
      if (measureActiveShape) measureGroup.removeLayer(measureActiveShape);
      if (measurePreviewLine) map.removeLayer(measurePreviewLine);

      const pts = hoverLatLng ? [...measurePoints, hoverLatLng] : [...measurePoints];
      if (!pts.length) return;

      if (activeMode === 'measureDist') {
        measureActiveShape = L.polyline(pts, {
          color: '#e11d48',
          weight: 3,
          dashArray: '6 4',
          pane: 'paneHighlight',
        }).addTo(measureGroup);

        let total = 0;
        for (let i = 1; i < pts.length; i++) total += distanceMeters(pts[i - 1], pts[i]);
        const seg = pts.length >= 2 ? distanceMeters(pts[pts.length - 2], pts[pts.length - 1]) : 0;
        ui.updateMeasureOutput?.(
          `<b>Distância total:</b> ${formatDistance(total)}<br>` +
            `<small>Último segmento: ${formatDistance(seg)} • ${measurePoints.length} vértice(s) (duplo clique finaliza)</small>`
        );
      } else if (activeMode === 'measureArea') {
        if (pts.length >= 3) {
          measureActiveShape = L.polygon(pts, {
            color: '#0284c7',
            weight: 2.5,
            fillColor: '#38bdf8',
            fillOpacity: 0.24,
            pane: 'paneHighlight',
          }).addTo(measureGroup);
          const area = polygonAreaSqMeters(pts);
          let perim = 0;
          for (let i = 0; i < pts.length; i++) perim += distanceMeters(pts[i], pts[(i + 1) % pts.length]);
          ui.updateMeasureOutput?.(
            `<b>Área:</b> ${formatArea(area)}<br>` +
              `<small>Perímetro: ${formatDistance(perim)} • ${measurePoints.length} vértices (duplo clique finaliza)</small>`
          );
        } else {
          measureActiveShape = L.polyline(pts, {
            color: '#0284c7',
            weight: 2.5,
            dashArray: '5 4',
            pane: 'paneHighlight',
          }).addTo(measureGroup);
          const d = pts.length === 2 ? distanceMeters(pts[0], pts[1]) : 0;
          ui.updateMeasureOutput?.(
            `<b>Área:</b> marque ao menos 3 pontos<br><small>Lado inicial: ${formatDistance(d)}</small>`
          );
        }
      }
    }

    function finishMeasurement() {
      if (measurePoints.length < (activeMode === 'measureArea' ? 3 : 2)) return;
      updateMeasureRender(null);
      const last = measurePoints[measurePoints.length - 1];
      let labelText = '';
      if (activeMode === 'measureDist') {
        let total = 0;
        for (let i = 1; i < measurePoints.length; i++) total += distanceMeters(measurePoints[i - 1], measurePoints[i]);
        labelText = formatDistance(total);
      } else {
        labelText = formatArea(polygonAreaSqMeters(measurePoints));
      }
      L.marker(last, {
        interactive: false,
        icon: L.divIcon({
          className: 'geo-measure-badge',
          html: `<span>${escapeHtml(labelText)}</span>`,
          iconSize: null,
        }),
      }).addTo(measureGroup);

      measureActiveShape = null;
      measurePoints = [];
    }

    // ---- Desenho e Anotação no Mapa ----
    const drawnFeatures = [];
    let drawPoints = [];
    let drawPreview = null;
    let drawColor = '#e11d48';

    function setDrawColor(hex) {
      drawColor = hex;
    }

    function cancelCurrentDrawSegment() {
      if (drawPreview) {
        map.removeLayer(drawPreview);
        drawPreview = null;
      }
      drawPoints = [];
    }

    function clearDrawings() {
      cancelCurrentDrawSegment();
      drawGroup.clearLayers();
      drawnFeatures.length = 0;
      ui.updateDrawCount?.(0);
    }

    function finishDrawing(labelInput = '') {
      if (activeMode === 'drawLine' && drawPoints.length >= 2) {
        const line = L.polyline(drawPoints, { color: drawColor, weight: 3.5, pane: 'paneHighlight' }).addTo(drawGroup);
        const label = labelInput || `Linha ${drawnFeatures.length + 1}`;
        line.bindPopup(`<b>${escapeHtml(label)}</b>`);
        drawnFeatures.push({
          type: 'Feature',
          properties: { nome: label, cor: drawColor, tipo: 'Linha' },
          geometry: { type: 'LineString', coordinates: drawPoints.map((p) => [p.lng, p.lat]) },
        });
      } else if (activeMode === 'drawPoly' && drawPoints.length >= 3) {
        const poly = L.polygon(drawPoints, {
          color: drawColor,
          weight: 2.5,
          fillColor: drawColor,
          fillOpacity: 0.25,
          pane: 'paneHighlight',
        }).addTo(drawGroup);
        const label = labelInput || `Área ${drawnFeatures.length + 1}`;
        const area = formatArea(polygonAreaSqMeters(drawPoints));
        poly.bindPopup(`<b>${escapeHtml(label)}</b><br>Área: ${area}`);
        const ring = [...drawPoints.map((p) => [p.lng, p.lat]), [drawPoints[0].lng, drawPoints[0].lat]];
        drawnFeatures.push({
          type: 'Feature',
          properties: { nome: label, cor: drawColor, tipo: 'Polígono', area },
          geometry: { type: 'Polygon', coordinates: [ring] },
        });
      }
      cancelCurrentDrawSegment();
      ui.updateDrawCount?.(drawnFeatures.length);
    }

    function exportDrawingsGeoJSON() {
      if (!drawnFeatures.length) {
        ui.showToast?.('Desenhe ao menos um ponto, linha ou polígono para exportar.', 'info');
        return;
      }
      const fc = { type: 'FeatureCollection', features: drawnFeatures };
      const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'geoportal_itajai_desenhos.geojson';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.showToast?.(`Exportado ${drawnFeatures.length} desenho(s) em GeoJSON!`, 'success');
    }

    // ---- Handlers globais de clique / movimento do mapa ----
    map.on('click', async (e) => {
      if (activeMode === 'identify' || activeMode === 'select') {
        runIdentify(e.latlng);
        return;
      }

      if (activeMode === 'measureDist' || activeMode === 'measureArea') {
        measurePoints.push(e.latlng);
        L.circleMarker(e.latlng, {
          radius: 4.5,
          color: '#ffffff',
          weight: 1.8,
          fillColor: activeMode === 'measureDist' ? '#e11d48' : '#0284c7',
          fillOpacity: 1,
          pane: 'paneHighlight',
        }).addTo(measureGroup);
        updateMeasureRender(null);
        return;
      }

      if (activeMode === 'drawPoint') {
        const label = ui.getDrawLabel?.() || `Ponto ${drawnFeatures.length + 1}`;
        const m = L.circleMarker(e.latlng, {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: drawColor,
          fillOpacity: 1,
          pane: 'paneHighlight',
        }).addTo(drawGroup);
        m.bindPopup(`<b>${escapeHtml(label)}</b><br><small>${formatCoords(e.latlng.lat, e.latlng.lng, 'wgs84')}</small>`).openPopup();
        drawnFeatures.push({
          type: 'Feature',
          properties: { nome: label, cor: drawColor, tipo: 'Ponto' },
          geometry: { type: 'Point', coordinates: [e.latlng.lng, e.latlng.lat] },
        });
        ui.updateDrawCount?.(drawnFeatures.length);
        return;
      }

      if (activeMode === 'drawLine' || activeMode === 'drawPoly') {
        drawPoints.push(e.latlng);
        L.circleMarker(e.latlng, {
          radius: 4,
          color: '#ffffff',
          weight: 1.5,
          fillColor: drawColor,
          fillOpacity: 1,
          pane: 'paneHighlight',
        }).addTo(drawGroup);
        if (drawPreview) map.removeLayer(drawPreview);
        drawPreview =
          activeMode === 'drawPoly' && drawPoints.length >= 3
            ? L.polygon(drawPoints, { color: drawColor, weight: 2, dashArray: '5 4', fillOpacity: 0.18, pane: 'paneHighlight' }).addTo(map)
            : L.polyline(drawPoints, { color: drawColor, weight: 2.5, dashArray: '5 4', pane: 'paneHighlight' }).addTo(map);
      }
    });

    map.on('mousemove', (e) => {
      if ((activeMode === 'measureDist' || activeMode === 'measureArea') && measurePoints.length > 0) {
        updateMeasureRender(e.latlng);
      } else if ((activeMode === 'drawLine' || activeMode === 'drawPoly') && drawPoints.length > 0) {
        if (drawPreview) map.removeLayer(drawPreview);
        const pts = [...drawPoints, e.latlng];
        drawPreview =
          activeMode === 'drawPoly' && pts.length >= 3
            ? L.polygon(pts, { color: drawColor, weight: 2, dashArray: '5 4', fillOpacity: 0.16, pane: 'paneHighlight' }).addTo(map)
            : L.polyline(pts, { color: drawColor, weight: 2.5, dashArray: '5 4', pane: 'paneHighlight' }).addTo(map);
      }
    });

    map.on('dblclick', (e) => {
      if (activeMode === 'measureDist' || activeMode === 'measureArea') {
        L.DomEvent.stop(e);
        finishMeasurement();
      } else if (activeMode === 'drawLine' || activeMode === 'drawPoly') {
        L.DomEvent.stop(e);
        finishDrawing(ui.getDrawLabel?.() || '');
      }
    });

    // ---- Identificação Multi-Camada + Raio-X Urbanístico do Ponto ----
    async function runIdentify(latlng) {
      highlightGroup.clearLayers();
      L.circleMarker(latlng, {
        radius: 8,
        color: '#ffffff',
        weight: 2.5,
        fillColor: '#f59e0b',
        fillOpacity: 0.95,
        pane: 'paneHighlight',
      }).addTo(highlightGroup);

      ui.openIdentifyPanel?.({ loading: true, latlng });
      const results = await engine.identifyAtPoint(latlng);
      ui.openIdentifyPanel?.({ loading: false, latlng, results });
    }

    // ---- Busca Unificada (Coordenadas, Bairros, Ruas, Inscrição Imobiliária) ----
    let bairrosCache = null;

    async function ensureBairrosList() {
      if (bairrosCache) return bairrosCache;
      try {
        const url = `${buildServiceUrl('Hosted/bairros2025/FeatureServer/0')}/query?where=1%3D1&outFields=nome,memorial&returnGeometry=true&outSR=4326&maxAllowableOffset=0.0001&f=geojson`;
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp.ok) {
          const gj = await resp.json();
          bairrosCache = gj.features || [];
        }
      } catch {
        bairrosCache = [];
      }
      return bairrosCache || [];
    }

    function norm(s) {
      return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    async function unifiedSearch(rawQuery) {
      const q = String(rawQuery || '').trim();
      if (q.length < 2) return [];
      const results = [];

      // 1. Coordenada direta (WGS84 ou SIRGAS 2000 UTM 22S)
      const coordHit = parseCoordinateQuery(q);
      if (coordHit) {
        results.push({
          type: 'Coordenada',
          badge: 'GPS',
          title: coordHit.label,
          subtitle: `UTM 22S: ${formatCoords(coordHit.lat, coordHit.lon, 'utm')}`,
          latlng: L.latLng(coordHit.lat, coordHit.lon),
          zoom: 17,
        });
      }

      // 2. Bairros oficiais de Itajaí (busca instantânea)
      const qNorm = norm(q);
      const bairros = await ensureBairrosList();
      for (const f of bairros) {
        const nome = f.properties?.nome || '';
        if (norm(nome).includes(qNorm)) {
          results.push({
            type: 'Bairro',
            badge: 'Bairro',
            title: nome,
            subtitle: 'Divisão Oficial de Bairros — Itajaí/SC',
            geojson: f,
          });
        }
      }

      // 3. Inscrição Imobiliária / Lote (se tiver dígitos ou formato XXX.XXX.XX.XXXX)
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 4) {
        try {
          const safe = q.replace(/'/g, "''");
          const where = `inscricao LIKE '%${safe}%' OR inscricao LIKE '%${digits}%'`;
          const url =
            `${buildServiceUrl('Hosted/Planta_Cadastral/FeatureServer/0')}/query?` +
            new URLSearchParams({
              where,
              outFields: 'inscricao,via,num,setor,quadra,lote,loteamento',
              returnGeometry: 'true',
              outSR: '4326',
              resultRecordCount: '6',
              f: 'geojson',
            }).toString();
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp.ok) {
            const gj = await resp.json();
            for (const f of gj.features || []) {
              const p = f.properties || {};
              results.push({
                type: 'Lote Cadastral',
                badge: 'Lote',
                title: `Inscrição ${p.inscricao || '—'}`,
                subtitle: `${p.via || 'Sem logradouro'}${p.num ? ', ' + p.num : ''} • Setor ${p.setor || '-'} Qd ${p.quadra || '-'} Lt ${p.lote || '-'}`,
                geojson: f,
                activateLayer: 'planta_cadastral',
              });
            }
          }
        } catch {
          // ignora falha de busca remota
        }
      }

      // 4. Sistema Viário (Ruas / Avenidas de Itajaí)
      if (q.length >= 3 && !coordHit) {
        try {
          const safeUpper = q.toUpperCase().replace(/'/g, "''");
          const url =
            `${buildServiceUrl('Hosted/itj_sistema_viario/FeatureServer/0')}/query?` +
            new URLSearchParams({
              where: `UPPER(nome) LIKE '%${safeUpper}%'`,
              outFields: 'nome,hierarquia,largura',
              returnGeometry: 'true',
              outSR: '4326',
              resultRecordCount: '8',
              f: 'geojson',
            }).toString();
          const resp = await fetch(url, { cache: 'no-store' });
          if (resp.ok) {
            const gj = await resp.json();
            const seenNames = new Set();
            for (const f of gj.features || []) {
              const p = f.properties || {};
              const key = (p.nome || '').toUpperCase();
              if (!key || seenNames.has(key)) continue;
              seenNames.add(key);
              results.push({
                type: 'Logradouro',
                badge: 'Via',
                title: p.nome,
                subtitle: `${p.hierarquia || 'Sistema Viário Municipal'}${p.largura ? ' • Largura: ' + p.largura + 'm' : ''}`,
                geojson: f,
              });
            }
          }
        } catch {
          // ignora
        }
      }

      return results.slice(0, 14);
    }

    function focusSearchResult(item) {
      highlightGroup.clearLayers();
      if (item.activateLayer) {
        engine.enableLayer(item.activateLayer);
      }

      if (item.geojson) {
        const hl = L.geoJSON(item.geojson, {
          pane: 'paneHighlight',
          style: {
            color: '#f59e0b',
            weight: 3.5,
            fillColor: '#fbbf24',
            fillOpacity: 0.25,
          },
          pointToLayer: (f, ll) =>
            L.circleMarker(ll, {
              radius: 9,
              color: '#ffffff',
              weight: 2.5,
              fillColor: '#f59e0b',
              fillOpacity: 1,
              pane: 'paneHighlight',
            }),
        }).addTo(highlightGroup);

        const bounds = hl.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [55, 55], maxZoom: item.type === 'Lote Cadastral' ? 19 : 16 });
          const center = bounds.getCenter();
          L.popup({ className: 'geo-custom-popup' })
            .setLatLng(center)
            .setContent(
              `<div class="geo-popup"><div class="geo-popup-header">${escapeHtml(item.type)}: ${escapeHtml(item.title)}</div>` +
                `<div class="geo-popup-body"><p style="margin:0;font-size:12px">${escapeHtml(item.subtitle || '')}</p></div></div>`
            )
            .openOn(map);
        }
      } else if (item.latlng) {
        L.circleMarker(item.latlng, {
          radius: 8,
          color: '#ffffff',
          weight: 2.5,
          fillColor: '#e11d48',
          fillOpacity: 1,
          pane: 'paneHighlight',
        })
          .bindPopup(`<b>${escapeHtml(item.title)}</b><br><small>${escapeHtml(item.subtitle || '')}</small>`)
          .addTo(highlightGroup)
          .openPopup();
        map.setView(item.latlng, item.zoom || 17);
      }
    }

    // ---- Comparador Temporal (Cortina / Swipe 1984 ↔ 2024) ----
    let swipeActive = false;
    let swipeLeftId = 'orto_2024';
    let swipeRightId = 'rest_1984';
    let swipeRightLayer = null;
    let swipePosition = 0.5; // 0..1

    function updateSwipeClip() {
      if (!swipeActive || !swipeRightLayer) return;
      const container = swipeRightLayer.getContainer();
      if (!container) return;
      const size = map.getSize();
      const nw = map.containerPointToLayerPoint([0, 0]);
      const se = map.containerPointToLayerPoint(size);
      const clipX = nw.x + size.x * swipePosition;
      // Recorta a camada direita para exibir apenas à direita da cortina
      container.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`;
    }

    function enableSwipe(leftId = 'orto_2024', rightId = 'rest_1984') {
      disableSwipe();
      swipeLeftId = leftId;
      swipeRightId = rightId;
      swipeActive = true;

      engine.setBasemapActive(leftId, true, true);
      const rightCfg = BASEMAPS.find((b) => b.id === rightId);
      if (rightCfg) {
        swipeRightLayer = engine.ensureBasemapLayer(rightCfg, 'paneSwipeRight');
        swipeRightLayer.addTo(map);
      }
      map.on('move zoom resize', updateSwipeClip);
      setTimeout(updateSwipeClip, 60);
      ui.onSwipeStateChange?.(true, swipeLeftId, swipeRightId, swipePosition);
    }

    function setSwipePosition(ratio) {
      swipePosition = Math.max(0.04, Math.min(0.96, ratio));
      updateSwipeClip();
    }

    function disableSwipe() {
      swipeActive = false;
      map.off('move zoom resize', updateSwipeClip);
      if (swipeRightLayer) {
        const c = swipeRightLayer.getContainer();
        if (c) c.style.clip = '';
        if (map.hasLayer(swipeRightLayer)) map.removeLayer(swipeRightLayer);
        swipeRightLayer = null;
      }
      ui.onSwipeStateChange?.(false, swipeLeftId, swipeRightId, swipePosition);
    }

    // ---- Relatório de Impressão Cartográfica ----
    function buildPrintSummary() {
      const center = map.getCenter();
      const scale = getScaleDenominator(center.lat, map.getZoom());
      return {
        date: new Date().toLocaleString('pt-BR'),
        scale: `1 : ${scale.toLocaleString('pt-BR')}`,
        utm: formatCoords(center.lat, center.lng, 'utm'),
        wgs: formatCoords(center.lat, center.lng, 'wgs84'),
        legends: engine.getActiveLegends(),
      };
    }

    return {
      setMode,
      getMode,
      shouldInterceptClick,
      undoView,
      redoView,
      resetHome,
      locateUser,
      clearMeasurements,
      finishMeasurement,
      setDrawColor,
      clearDrawings,
      finishDrawing,
      exportDrawingsGeoJSON,
      runIdentify,
      unifiedSearch,
      focusSearchResult,
      enableSwipe,
      setSwipePosition,
      disableSwipe,
      buildPrintSummary,
      clearHighlight: () => highlightGroup.clearLayers(),
    };
  }

  return { createTools };
})();

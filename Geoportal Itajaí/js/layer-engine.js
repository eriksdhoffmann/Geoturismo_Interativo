/**
 * Geoportal Itajaí — Motor de Camadas GIS (ArcGIS FeatureServer + XYZ Tiles + Importação Local)
 * Renderização em Canvas 60 FPS, cache em memória, consulta espacial por viewport (BBOX),
 * controle de opacidade em tempo real, legenda automática e importação GeoJSON / KML / SHP (.zip).
 */
window.GeoLayerEngine = (() => {
  const {
    BASEMAPS,
    LAYER_GROUPS,
    buildServiceUrl,
    getLayerById,
  } = window.GeoCatalog;

  // Helpers para formatação de atributos em popups/inspetor
  const HIDDEN_FIELDS = new Set([
    'objectid', 'fid', 'globalid', 'shape__area', 'shape__length',
    'shape_leng', 'shape_area', 'created_user', 'created_date',
    'last_edited_user', 'last_edited_date', 'true_',
  ]);

  const FIELD_LABELS = {
    nome: 'Nome / Sigla',
    descr: 'Descrição',
    legenda: 'Zona (2012)',
    memorial: 'Memorial Descritivo',
    inscricao: 'Inscrição Imobiliária',
    setor: 'Setor',
    quadra: 'Quadra',
    face: 'Face',
    lote: 'Lote',
    via: 'Logradouro',
    nomevia: 'Logradouro',
    num: 'Número',
    numero: 'Número',
    loteamento: 'Loteamento',
    hierarquia: 'Hierarquia Viária',
    largura: 'Largura da Via (m)',
    passeiod: 'Passeio Direito (m)',
    passeioe: 'Passeio Esquerdo (m)',
    leidata: 'Legislação / Data',
    cota: 'Cota (m)',
    tipocurvan: 'Tipo de Curva',
    rua_avenida: 'Logradouro',
    bairro: 'Bairro',
    endereco: 'Endereço',
    tombo: 'Ato de Tombamento',
    tombotipo: 'Tipo de Tombamento',
    uso: 'Uso',
    diametro: 'Diâmetro',
    material: 'Material',
    tipo: 'Tipo',
    posicao: 'Posição',
    profundida: 'Profundidade',
    classe: 'Classe',
    plan: 'Situação / Fase',
    secao_existente: 'Seção Existente',
    unidade_de_saúde__no_ups_: 'Unidade de Saúde',
    logradouro: 'Logradouro',
    número: 'Número',
    mome: 'Escola / Unidade',
    categoria: 'Categoria',
    codigo_da_escola: 'Código',
    altmax: 'Altura Máxima',
    empresa: 'Empresa Responsável',
    n_doc: 'Documento',
    data_sond: 'Data Sondagem',
    local_: 'Local do Marco',
    titulo: 'Título',
    descricao: 'Descrição',
  };

  function prettyFieldName(key) {
    const lk = String(key || '').toLowerCase();
    if (FIELD_LABELS[lk]) return FIELD_LABELS[lk];
    return String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatFieldValue(key, val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') {
      if (key.toLowerCase().includes('data') && val > 100000000000) {
        return new Date(val).toLocaleDateString('pt-BR');
      }
      return Number.isInteger(val) ? val.toLocaleString('pt-BR') : val.toFixed(2).replace('.', ',');
    }
    const str = String(val).trim();
    if (!str || str === 'null' || str === 'Null') return null;
    return str;
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function createEngine(map, callbacks = {}) {
    const canvasRenderer = L.canvas({ padding: 0.45 });
    const basemapLayers = new Map();
    const activeBasemaps = new Set();
    const activeLayers = new Map(); // id -> { cfg, leafletLayer, labelGroup, geojson, opacity, loading, zoomBlocked, controller }
    const dataCache = new Map(); // id -> geojson (para camadas de carregamento completo)
    const userLayers = []; // camadas importadas pelo usuário

    // Panes dedicados para controle rigoroso de sobreposição
    map.createPane('paneBasemapGlobal');
    map.getPane('paneBasemapGlobal').style.zIndex = 200;
    map.createPane('paneBasemapMunicipal');
    map.getPane('paneBasemapMunicipal').style.zIndex = 210;
    map.createPane('paneSwipeRight');
    map.getPane('paneSwipeRight').style.zIndex = 215;
    map.createPane('panePolygons');
    map.getPane('panePolygons').style.zIndex = 410;
    map.createPane('paneLines');
    map.getPane('paneLines').style.zIndex = 430;
    map.createPane('panePoints');
    map.getPane('panePoints').style.zIndex = 450;
    map.createPane('paneHighlight');
    map.getPane('paneHighlight').style.zIndex = 480;

    const polyRenderer = L.canvas({ pane: 'panePolygons', padding: 0.45 });
    const lineRenderer = L.canvas({ pane: 'paneLines', padding: 0.45 });

    // Inicializa todos os tileLayers de basemap sob demanda
    function ensureBasemapLayer(bmCfg, customPane = null) {
      if (!customPane && basemapLayers.has(bmCfg.id)) {
        return basemapLayers.get(bmCfg.id);
      }
      const pane = customPane || (bmCfg.isMunicipalClip ? 'paneBasemapMunicipal' : 'paneBasemapGlobal');
      const opts = {
        minZoom: bmCfg.minZoom || 5,
        maxZoom: bmCfg.maxZoom || 21,
        maxNativeZoom: bmCfg.maxNativeZoom || 19,
        attribution: bmCfg.attribution || '',
        pane,
        opacity: 1,
      };
      if (bmCfg.bounds) opts.bounds = bmCfg.bounds;
      if (bmCfg.errorTileUrl) opts.errorTileUrl = bmCfg.errorTileUrl;
      const layer = L.tileLayer(bmCfg.url, opts);
      if (!customPane) basemapLayers.set(bmCfg.id, layer);
      return layer;
    }

    function setBasemapActive(bmId, enabled, exclusive = false) {
      const bmCfg = BASEMAPS.find((b) => b.id === bmId);
      if (!bmCfg) return;

      if (exclusive && enabled) {
        // Desliga outros basemaps da mesma categoria (ou todos)
        for (const activeId of [...activeBasemaps]) {
          if (activeId !== bmId) {
            const l = basemapLayers.get(activeId);
            if (l && map.hasLayer(l)) map.removeLayer(l);
            activeBasemaps.delete(activeId);
          }
        }
      }

      const layer = ensureBasemapLayer(bmCfg);
      if (enabled) {
        if (!map.hasLayer(layer)) layer.addTo(map);
        activeBasemaps.add(bmId);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        activeBasemaps.delete(bmId);
      }
      callbacks.onStateChange?.();
    }

    function setBasemapOpacity(bmId, opacity) {
      const l = basemapLayers.get(bmId);
      if (l) l.setOpacity(opacity);
    }

    function isBasemapActive(bmId) {
      return activeBasemaps.has(bmId);
    }

    // Estilização inteligente (cores oficiais uniqueValue ou simples)
    function computeFeatureStyle(cfg, feature, opacityOverride) {
      const op = opacityOverride ?? cfg.opacity ?? 0.7;
      const props = feature?.properties || {};

      if (cfg.geomType === 'line') {
        let color = cfg.style?.color || '#2563eb';
        if (cfg.colorField && cfg.colorMap) {
          const val = props[cfg.colorField];
          color = cfg.colorMap[val] || color;
        }
        return {
          color,
          weight: cfg.style?.weight || 2.4,
          dashArray: cfg.style?.dashArray || null,
          opacity: Math.min(1, op),
        };
      }

      // Polígono
      let fillColor = cfg.style?.fillColor || '#3b82f6';
      let color = cfg.style?.color || '#1e293b';
      let fillOpacity = cfg.outlineMode ? (cfg.style?.fillOpacity ?? 0.04) : op;

      if (cfg.colorField && cfg.colorMap) {
        const raw = props[cfg.colorField];
        const mapped = cfg.colorMap[raw];
        if (mapped) {
          fillColor = mapped;
          color = '#2b3440';
        }
      }

      return {
        color,
        weight: cfg.style?.weight ?? 1.2,
        dashArray: cfg.style?.dashArray || null,
        opacity: Math.min(1, op + 0.25),
        fillColor,
        fillOpacity: cfg.outlineMode ? Math.min(0.25, fillOpacity) : Math.min(0.92, fillOpacity),
      };
    }

    function buildFeaturePopupHtml(cfg, feature) {
      const props = feature?.properties || {};
      const titleVal = cfg.titleField ? formatFieldValue(cfg.titleField, props[cfg.titleField]) : null;
      const heading = titleVal ? `${escapeHtml(cfg.name)} — ${escapeHtml(titleVal)}` : escapeHtml(cfg.name);

      const rows = [];
      // Primeiro mostra campos prioritários (subtitleFields)
      const shown = new Set();
      if (cfg.titleField) shown.add(cfg.titleField.toLowerCase());

      const priority = cfg.subtitleFields || [];
      for (const f of priority) {
        const val = formatFieldValue(f, props[f]);
        if (val) {
          rows.push(`<tr><th>${escapeHtml(prettyFieldName(f))}</th><td>${escapeHtml(val)}</td></tr>`);
          shown.add(f.toLowerCase());
        }
      }
      // Depois demais campos relevantes (máx 10 linhas)
      for (const [k, v] of Object.entries(props)) {
        if (rows.length >= 10) break;
        const lk = k.toLowerCase();
        if (HIDDEN_FIELDS.has(lk) || shown.has(lk)) continue;
        const val = formatFieldValue(k, v);
        if (val) {
          rows.push(`<tr><th>${escapeHtml(prettyFieldName(k))}</th><td>${escapeHtml(val)}</td></tr>`);
          shown.add(lk);
        }
      }

      // Se for lote cadastral com inscrição, inclui link direto para a Planta Cadastral Oficial!
      const insc = props.inscricao || props.INSCRICAO;
      const extraLink = insc
        ? `<div class="geo-popup-actions">
             <a class="geo-popup-btn" href="https://arcgis.itajai.sc.gov.br/geoitajai/plantacadastral/plantacadastral.html" target="_blank" rel="noopener">
               Abrir Planta Cadastral Oficial
             </a>
           </div>`
        : '';

      return `
        <div class="geo-popup">
          <div class="geo-popup-header">${heading}</div>
          <div class="geo-popup-body">
            ${rows.length ? `<table class="geo-popup-table">${rows.join('')}</table>` : '<p class="geo-popup-empty">Sem atributos tabulares adicionais.</p>'}
            ${extraLink}
          </div>
        </div>`;
    }

    // Constrói camada Leaflet GeoJSON otimizada em Canvas
    function buildGeoJsonLayer(cfg, geojson, opacity) {
      const isPoint = cfg.geomType === 'point';
      const isLine = cfg.geomType === 'line';
      const pane = isPoint ? 'panePoints' : isLine ? 'paneLines' : 'panePolygons';
      const renderer = isPoint ? canvasRenderer : isLine ? lineRenderer : polyRenderer;

      const geoLayer = L.geoJSON(geojson, {
        pane,
        renderer,
        style: (feature) => computeFeatureStyle(cfg, feature, opacity),
        pointToLayer: (feature, latlng) => {
          const ps = cfg.pointStyle || {
            radius: 6,
            color: '#ffffff',
            weight: 1.8,
            fillColor: '#0066a1',
            fillOpacity: 0.92,
          };
          return L.circleMarker(latlng, {
            ...ps,
            pane: 'panePoints',
            fillOpacity: Math.min(1, (ps.fillOpacity ?? 0.92) * (opacity ?? 1)),
            opacity: Math.min(1, opacity ?? 1),
          });
        },
        onEachFeature: (feature, layer) => {
          // Tooltip leve com rótulo principal ao passar o mouse
          if (cfg.titleField && feature.properties?.[cfg.titleField]) {
            const lbl = String(feature.properties[cfg.titleField]).trim();
            if (lbl) {
              layer.bindTooltip(escapeHtml(lbl), {
                sticky: true,
                direction: 'top',
                className: 'geo-hover-tooltip',
                opacity: 0.94,
              });
            }
          }
          layer.on('click', (ev) => {
            // Se estiver em modo medição, desenho ou identificação global, deixa o tool handler atuar
            if (callbacks.shouldInterceptClick?.()) return;
            L.DomEvent.stopPropagation(ev);
            L.popup({ maxWidth: 360, className: 'geo-custom-popup' })
              .setLatLng(ev.latlng)
              .setContent(buildFeaturePopupHtml(cfg, feature))
              .openOn(map);
          });
        },
      });

      return geoLayer;
    }

    // Rótulos estáticos leves para camadas como Bairros / Zoneamento
    function buildLabelsGroup(cfg, geojson) {
      if (!cfg.labelField || !geojson?.features?.length) return null;
      const group = L.layerGroup();
      const placed = new Set();

      for (const feat of geojson.features) {
        const text = feat.properties?.[cfg.labelField];
        if (!text) continue;
        const key = String(text).trim();
        if (!key) continue;
        // Para zoneamento (187 polígonos), rotula apenas polígonos com área relevante
        try {
          const tmp = L.geoJSON(feat);
          const bounds = tmp.getBounds();
          if (!bounds.isValid()) continue;
          const span = Math.abs(bounds.getEast() - bounds.getWest()) + Math.abs(bounds.getNorth() - bounds.getSouth());
          if (cfg.id !== 'bairros_2025' && span < 0.008) continue;
          if (cfg.id === 'bairros_2025' && placed.has(key)) continue;
          placed.add(key);

          const center = bounds.getCenter();
          L.marker(center, {
            interactive: false,
            icon: L.divIcon({
              className: `geo-map-label ${cfg.id === 'bairros_2025' ? 'geo-label-bairro' : 'geo-label-zona'}`,
              html: `<span>${escapeHtml(key)}</span>`,
              iconSize: null,
            }),
          }).addTo(group);
        } catch {
          // ignora geometria inválida
        }
      }
      return group;
    }

    // Consulta ArcGIS FeatureServer com paginação segura e suporte a BBOX
    async function queryFeatureServer(cfg, { bbox = null, signal = null, maxFeatures = 2500 } = {}) {
      const baseUrl = buildServiceUrl(cfg.service);
      const allFeatures = [];
      let offset = 0;
      const pageSize = 1000;

      while (allFeatures.length < maxFeatures) {
        const params = new URLSearchParams({
          where: '1=1',
          outFields: '*',
          returnGeometry: 'true',
          outSR: '4326',
          f: 'geojson',
          resultOffset: String(offset),
          resultRecordCount: String(pageSize),
        });

        if (cfg.simplify) {
          params.set('maxAllowableOffset', String(cfg.simplify));
        }

        if (bbox) {
          params.set('geometry', `${bbox.getWest()},${bbox.getSouth()},${bbox.getEast()},${bbox.getNorth()}`);
          params.set('geometryType', 'esriGeometryEnvelope');
          params.set('inSR', '4326');
          params.set('spatialRel', 'esriSpatialRelIntersects');
        }

        const resp = await fetch(`${baseUrl}/query?${params.toString()}`, { signal, cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (json.error) throw new Error(json.error.message || 'Erro no serviço ArcGIS');

        const feats = json.features || [];
        allFeatures.push(...feats);

        const exceeded = json.properties?.exceededTransferLimit || json.exceededTransferLimit;
        if (!exceeded || feats.length < pageSize) break;
        offset += pageSize;
      }

      return { type: 'FeatureCollection', features: allFeatures };
    }

    async function enableLayer(layerId) {
      // Verifica se é camada importada pelo usuário
      const userL = userLayers.find((u) => u.id === layerId);
      if (userL) {
        if (!activeLayers.has(layerId)) {
          const gl = buildGeoJsonLayer(userL, userL.geojson, userL.opacity);
          gl.addTo(map);
          activeLayers.set(layerId, {
            cfg: userL,
            leafletLayer: gl,
            labelGroup: null,
            geojson: userL.geojson,
            opacity: userL.opacity,
            loading: false,
            zoomBlocked: false,
            count: userL.geojson.features.length,
          });
          callbacks.onStateChange?.();
        }
        return;
      }

      const found = getLayerById(layerId);
      if (!found) return;
      const { layer: cfg } = found;

      if (activeLayers.has(layerId)) return;

      const state = {
        cfg,
        leafletLayer: null,
        labelGroup: null,
        geojson: null,
        opacity: cfg.opacity ?? 0.75,
        loading: false,
        zoomBlocked: false,
        error: null,
        count: 0,
        controller: null,
      };
      activeLayers.set(layerId, state);

      await loadOrRefreshLayer(layerId);
    }

    async function loadOrRefreshLayer(layerId) {
      const state = activeLayers.get(layerId);
      if (!state || state.cfg.isUserLayer) return;
      const { cfg } = state;

      // Verifica minZoom para camadas densas (ex: 64.598 lotes)
      if (cfg.viewportMode && cfg.minZoom && map.getZoom() < cfg.minZoom) {
        if (state.leafletLayer && map.hasLayer(state.leafletLayer)) {
          map.removeLayer(state.leafletLayer);
          state.leafletLayer = null;
        }
        state.zoomBlocked = true;
        state.loading = false;
        state.error = null;
        callbacks.onStateChange?.();
        return;
      }

      state.zoomBlocked = false;

      // Usa cache se for camada de carga completa
      if (!cfg.viewportMode && dataCache.has(layerId)) {
        const gj = dataCache.get(layerId);
        attachLayerData(state, gj);
        return;
      }

      // Cancela requisição anterior em andamento (viewport pan/zoom rápido)
      if (state.controller) state.controller.abort();
      const controller = new AbortController();
      state.controller = controller;
      state.loading = true;
      state.error = null;
      callbacks.onStateChange?.();

      try {
        const bbox = cfg.viewportMode ? map.getBounds().pad(0.15) : null;
        const gj = await queryFeatureServer(cfg, { bbox, signal: controller.signal });
        if (!activeLayers.has(layerId)) return; // usuário desmarcou durante o fetch
        if (!cfg.viewportMode) dataCache.set(layerId, gj);
        attachLayerData(state, gj);
      } catch (err) {
        if (err.name === 'AbortError') return;
        state.loading = false;
        state.error = err.message || 'Falha ao carregar camada';
        callbacks.onStateChange?.();
        callbacks.onToast?.(`Erro ao carregar "${cfg.name}": ${state.error}`, 'error');
      }
    }

    function attachLayerData(state, geojson) {
      const { cfg } = state;
      if (state.leafletLayer && map.hasLayer(state.leafletLayer)) {
        map.removeLayer(state.leafletLayer);
      }
      if (state.labelGroup && map.hasLayer(state.labelGroup)) {
        map.removeLayer(state.labelGroup);
      }

      const gl = buildGeoJsonLayer(cfg, geojson, state.opacity);
      gl.addTo(map);

      let lg = null;
      if (cfg.labelField) {
        lg = buildLabelsGroup(cfg, geojson);
        if (lg && map.getZoom() >= 12) lg.addTo(map);
      }

      state.leafletLayer = gl;
      state.labelGroup = lg;
      state.geojson = geojson;
      state.count = geojson?.features?.length || 0;
      state.loading = false;
      state.error = null;
      callbacks.onStateChange?.();
    }

    function disableLayer(layerId) {
      const state = activeLayers.get(layerId);
      if (!state) return;
      if (state.controller) state.controller.abort();
      if (state.leafletLayer && map.hasLayer(state.leafletLayer)) map.removeLayer(state.leafletLayer);
      if (state.labelGroup && map.hasLayer(state.labelGroup)) map.removeLayer(state.labelGroup);
      activeLayers.delete(layerId);
      callbacks.onStateChange?.();
    }

    function toggleLayer(layerId, forceState = null) {
      const currentlyOn = activeLayers.has(layerId);
      const next = forceState !== null ? forceState : !currentlyOn;
      if (next) return enableLayer(layerId);
      disableLayer(layerId);
      return Promise.resolve();
    }

    function setLayerOpacity(layerId, opacity) {
      const state = activeLayers.get(layerId);
      if (!state) return;
      state.opacity = opacity;
      if (state.leafletLayer) {
        state.leafletLayer.eachLayer((sub) => {
          if (state.cfg.geomType === 'point' && sub.setStyle) {
            sub.setStyle({ fillOpacity: opacity, opacity });
          } else if (sub.setStyle) {
            sub.setStyle(computeFeatureStyle(state.cfg, sub.feature, opacity));
          }
        });
      }
    }

    function zoomToLayer(layerId) {
      const state = activeLayers.get(layerId);
      if (state?.leafletLayer) {
        const b = state.leafletLayer.getBounds();
        if (b && b.isValid()) {
          map.fitBounds(b, { padding: [36, 36], maxZoom: 17 });
          return true;
        }
      }
      if (state?.cfg?.minZoom) {
        map.setView(window.GeoCatalog.ITAJAI_URBAN_CENTER, state.cfg.minZoom);
        return true;
      }
      map.fitBounds(window.GeoCatalog.ITAJAI_BOUNDS, { padding: [20, 20] });
      return false;
    }

    function clearAllLayers() {
      for (const id of [...activeLayers.keys()]) {
        disableLayer(id);
      }
    }

    // Atualiza camadas viewport-mode e visibilidade de rótulos ao mover/dar zoom
    let moveTimer = null;
    map.on('moveend zoomend', () => {
      const z = map.getZoom();
      for (const [, state] of activeLayers) {
        if (state.labelGroup) {
          const shouldShow = z >= 12;
          if (shouldShow && !map.hasLayer(state.labelGroup)) state.labelGroup.addTo(map);
          if (!shouldShow && map.hasLayer(state.labelGroup)) map.removeLayer(state.labelGroup);
        }
      }
      clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        for (const [id, state] of activeLayers) {
          if (state.cfg.viewportMode) {
            loadOrRefreshLayer(id);
          }
        }
      }, 280);
    });

    // Consulta espacial de identificação multi-camadas em um ponto (lat, lng)
    async function identifyAtPoint(latlng) {
      const results = [];
      const tolDeg = 0.00025 * Math.pow(2, Math.max(0, 15 - map.getZoom()));
      const env = `${latlng.lng - tolDeg},${latlng.lat - tolDeg},${latlng.lng + tolDeg},${latlng.lat + tolDeg}`;

      // 1. Consulta todas as camadas ativas + sempre tenta consultar Bairro e Zoneamento 2024 no ponto
      const targetIds = new Set([...activeLayers.keys()]);
      const coreContextIds = ['bairros_2025', 'zoneamento_2024', 'planta_cadastral'];
      for (const cid of coreContextIds) targetIds.add(cid);

      const tasks = [...targetIds].map(async (id) => {
        const state = activeLayers.get(id);
        const found = state ? { layer: state.cfg } : getLayerById(id);
        if (!found) return;
        const cfg = found.layer;
        const isCoreExtra = !activeLayers.has(id);

        if (cfg.isUserLayer && state?.geojson) {
          // Checagem simples por proximidade/bbox em camadas importadas
          const hits = findLocalHits(state.geojson, latlng, tolDeg);
          if (hits.length) {
            results.push({ layerId: id, layerName: cfg.name, cfg, features: hits, isCoreExtra: false });
          }
          return;
        }

        if (!cfg.service) return;
        try {
          const baseUrl = buildServiceUrl(cfg.service);
          const params = new URLSearchParams({
            geometry: cfg.geomType === 'polygon' ? `${latlng.lng},${latlng.lat}` : env,
            geometryType: cfg.geomType === 'polygon' ? 'esriGeometryPoint' : 'esriGeometryEnvelope',
            inSR: '4326',
            spatialRel: 'esriSpatialRelIntersects',
            outFields: '*',
            returnGeometry: 'false',
            resultRecordCount: '5',
            f: 'json',
          });
          const resp = await fetch(`${baseUrl}/query?${params.toString()}`, { cache: 'no-store' });
          if (!resp.ok) return;
          const json = await resp.json();
          const feats = (json.features || []).map((f) => ({ properties: f.attributes || {} }));
          if (feats.length) {
            results.push({
              layerId: id,
              layerName: cfg.name,
              cfg,
              features: feats,
              isCoreExtra,
            });
          }
        } catch {
          // ignora erro isolado em uma camada
        }
      });

      await Promise.all(tasks);
      // Ordena: contexto principal (Bairro, Zoneamento, Lote) primeiro, depois camadas ativas
      const order = { bairros_2025: 1, zoneamento_2024: 2, planta_cadastral: 3 };
      results.sort((a, b) => (order[a.layerId] || 50) - (order[b.layerId] || 50));
      return results;
    }

    function findLocalHits(geojson, latlng, tolDeg) {
      const hits = [];
      for (const f of geojson.features || []) {
        try {
          const b = L.geoJSON(f).getBounds();
          if (b.isValid() && b.pad(0.05).contains(latlng)) {
            hits.push(f);
            if (hits.length >= 5) break;
          }
        } catch {
          // ignore
        }
      }
      return hits;
    }

    // Exportar camada ativa para arquivo GeoJSON
    function exportLayerGeoJSON(layerId) {
      const state = activeLayers.get(layerId);
      if (!state?.geojson?.features?.length) {
        callbacks.onToast?.('Ative a camada e aguarde o carregamento antes de exportar.', 'info');
        return;
      }
      const blob = new Blob([JSON.stringify(state.geojson, null, 2)], { type: 'application/geo+json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geoportal_itajai_${layerId}.geojson`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      callbacks.onToast?.(`Exportado: geoportal_itajai_${layerId}.geojson (${state.geojson.features.length} feições)`, 'success');
    }

    // Importar arquivo GeoJSON, KML ou Shapefile (.zip) enviado pelo usuário
    async function importUserFile(file) {
      const name = file.name;
      const ext = name.split('.').pop().toLowerCase();
      let geojson = null;

      if (ext === 'geojson' || ext === 'json') {
        const text = await file.text();
        geojson = JSON.parse(text);
      } else if (ext === 'kml') {
        const text = await file.text();
        geojson = parseSimpleKML(text);
      } else if (ext === 'zip') {
        if (typeof window.shp !== 'function') {
          throw new Error('Biblioteca de leitura Shapefile (.zip) ainda carregando. Tente novamente em instantes.');
        }
        const buf = await file.arrayBuffer();
        const parsed = await window.shp(buf);
        geojson = Array.isArray(parsed)
          ? { type: 'FeatureCollection', features: parsed.flatMap((g) => g.features || []) }
          : parsed;
      } else {
        throw new Error('Formato não suportado. Use .geojson, .json, .kml ou Shapefile .zip');
      }

      if (!geojson || !geojson.features || !geojson.features.length) {
        throw new Error('O arquivo não contém feições geográficas válidas.');
      }

      // Detecta tipo dominante de geometria
      const firstType = geojson.features[0]?.geometry?.type || 'Polygon';
      const geomType = firstType.includes('Point') ? 'point' : firstType.includes('Line') ? 'line' : 'polygon';
      const colors = ['#e11d48', '#7c3aed', '#0d9488', '#ea580c', '#2563eb'];
      const color = colors[userLayers.length % colors.length];

      const id = `user_${Date.now()}`;
      const userCfg = {
        id,
        name: name.replace(/\.(geojson|json|kml|zip)$/i, ''),
        geomType,
        isUserLayer: true,
        opacity: 0.72,
        geojson,
        style: { color, weight: 2.2, fillColor: color, fillOpacity: 0.35 },
        pointStyle: { radius: 6, color: '#ffffff', weight: 1.8, fillColor: color, fillOpacity: 0.95 },
        description: `Camada importada localmente (${file.name} — ${geojson.features.length} feições).`,
      };

      userLayers.push(userCfg);
      await enableLayer(id);
      zoomToLayer(id);
      callbacks.onUserLayersChanged?.();
      callbacks.onToast?.(`Camada "${userCfg.name}" importada (${geojson.features.length} feições)!`, 'success');
      return userCfg;
    }

    function parseSimpleKML(xmlText) {
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      const placemarks = [...doc.querySelectorAll('Placemark')];
      const features = [];

      const parseCoords = (str) =>
        str
          .trim()
          .split(/\s+/)
          .map((p) => p.split(',').map(Number))
          .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map((c) => [c[0], c[1]]);

      for (const pm of placemarks) {
        const name = pm.querySelector('name')?.textContent?.trim() || 'Feição KML';
        const desc = pm.querySelector('description')?.textContent?.trim() || '';
        const pt = pm.querySelector('Point coordinates');
        const ls = pm.querySelector('LineString coordinates');
        const pg = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');

        let geometry = null;
        if (pt) {
          const c = parseCoords(pt.textContent)[0];
          if (c) geometry = { type: 'Point', coordinates: c };
        } else if (ls) {
          const c = parseCoords(ls.textContent);
          if (c.length >= 2) geometry = { type: 'LineString', coordinates: c };
        } else if (pg) {
          const c = parseCoords(pg.textContent);
          if (c.length >= 3) geometry = { type: 'Polygon', coordinates: [c] };
        }
        if (geometry) {
          features.push({ type: 'Feature', properties: { nome: name, descricao: desc }, geometry });
        }
      }
      return { type: 'FeatureCollection', features };
    }

    // Constrói legenda dinâmica das camadas ativas
    function getActiveLegends() {
      const items = [];
      for (const [id, state] of activeLayers) {
        const { cfg } = state;
        const entry = { id, name: cfg.name, geomType: cfg.geomType, swatches: [] };
        if (cfg.colorMap) {
          for (const [label, color] of Object.entries(cfg.colorMap)) {
            entry.swatches.push({ label, color });
          }
        } else {
          const color =
            cfg.geomType === 'point'
              ? cfg.pointStyle?.fillColor || '#0066a1'
              : cfg.geomType === 'line'
              ? cfg.style?.color || '#2563eb'
              : cfg.outlineMode
              ? cfg.style?.color || '#0284c7'
              : cfg.style?.fillColor || '#3b82f6';
          entry.swatches.push({
            label: cfg.name,
            color,
            outline: cfg.outlineMode,
            dashed: Boolean(cfg.style?.dashArray),
          });
        }
        items.push(entry);
      }
      return items;
    }

    return {
      activeLayers,
      activeBasemaps,
      userLayers,
      dataCache,
      ensureBasemapLayer,
      setBasemapActive,
      setBasemapOpacity,
      isBasemapActive,
      enableLayer,
      disableLayer,
      toggleLayer,
      setLayerOpacity,
      zoomToLayer,
      clearAllLayers,
      identifyAtPoint,
      exportLayerGeoJSON,
      importUserFile,
      getActiveLegends,
      prettyFieldName,
      formatFieldValue,
      escapeHtml,
    };
  }

  return { createEngine, prettyFieldName, formatFieldValue, escapeHtml };
})();

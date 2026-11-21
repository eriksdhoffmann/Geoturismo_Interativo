/**
 * Geoportal Itajaí — Controlador Principal da Interface (Padrão Geoportal Florianópolis)
 */
(() => {
  const {
    ITAJAI_CENTER,
    ITAJAI_BOUNDS,
    BASEMAPS,
    LAYER_GROUPS,
    OFFICIAL_DOWNLOADS,
    THEMATIC_PRESETS,
    PORTAL_ITEM,
  } = window.GeoCatalog;
  const {
    formatCoords,
    getScaleDenominator,
    getZoomForScale,
  } = window.GeoCoords;
  const { prettyFieldName, formatFieldValue, escapeHtml } = window.GeoLayerEngine;

  // ---- Estado Global da UI ----
  let crsMode = 'utm'; // 'utm' | 'wgs84' | 'dms'
  let drawerTab = 'layers'; // 'layers' | 'legend'
  let openOptionsLayerId = null;
  let activeFloatingPanel = null; // 'basemaps' | 'measure' | 'draw' | 'identify' | 'import' | 'print'
  let searchFilterText = '';
  const expandedGroups = new Set(LAYER_GROUPS.filter((g) => g.expanded).map((g) => g.id));

  // ---- Inicialização do Mapa Leaflet ----
  const map = L.map('map', {
    center: ITAJAI_CENTER,
    zoom: 12,
    minZoom: 10,
    maxZoom: 21,
    zoomControl: false,
    doubleClickZoom: true,
    preferCanvas: true,
  });

  const initRightPad = window.innerWidth <= 760 ? 32 : 386;
  map.fitBounds(ITAJAI_BOUNDS, {
    paddingTopLeft: [56, 22],
    paddingBottomRight: [initRightPad, 40],
  });

  // ---- Toast Helper ----
  function showToast(msg, type = 'info') {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `gp-toast ${type}`;
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s';
      setTimeout(() => el.remove(), 260);
    }, 3600);
  }

  // ---- Instancia Motor de Camadas e Ferramentas ----
  let tools = null;
  const engine = window.GeoLayerEngine.createEngine(map, {
    onStateChange: () => {
      renderLayerDrawer();
      if (activeFloatingPanel === 'basemaps') renderBasemapsPanel();
    },
    onUserLayersChanged: () => {
      expandedGroups.add('user_imported');
      renderLayerDrawer();
    },
    onToast: showToast,
    shouldInterceptClick: () => (tools ? tools.shouldInterceptClick() : false),
  });

  tools = window.GeoTools.createTools(map, engine, {
    showToast,
    onModeChange: handleModeBanner,
    updateHistoryButtons: (canUndo, canRedo) => {
      const bU = document.getElementById('btnUndo');
      const bR = document.getElementById('btnRedo');
      if (bU) bU.disabled = !canUndo;
      if (bR) bR.disabled = !canRedo;
    },
    updateMeasureOutput: (html) => {
      const el = document.getElementById('measureOutput');
      if (el) el.innerHTML = html;
    },
    updateDrawCount: (cnt) => {
      const el = document.getElementById('drawCountBadge');
      if (el) el.textContent = `${cnt} feição(ões) desenhada(s)`;
    },
    getDrawLabel: () => document.getElementById('drawLabelInput')?.value?.trim() || '',
    openIdentifyPanel: renderIdentifyPanel,
    onSwipeStateChange: renderSwipeOverlay,
  });

  // ---- Ativação Padrão Inicial (Ortoimagem Aérea Itajaí 2024 + Bairros) ----
  engine.setBasemapActive('orto_2024', true, false);
  engine.enableLayer('bairros_2025');

  // ==================== CONTROLE DE CAMADAS (DRAWER) ====================
  function getLayerSwatchStyle(cfg) {
    if (cfg.geomType === 'point') {
      return { cls: 'gp-swatch is-point', bg: cfg.pointStyle?.fillColor || '#0066a1' };
    }
    if (cfg.geomType === 'line') {
      const col = cfg.colorMap ? Object.values(cfg.colorMap)[0] : cfg.style?.color || '#2563eb';
      return { cls: 'gp-swatch is-line', bg: col };
    }
    if (cfg.colorMap) {
      const cols = Object.values(cfg.colorMap);
      return {
        cls: 'gp-swatch',
        bg: `linear-gradient(135deg, ${cols[0]} 0%, ${cols[Math.min(2, cols.length - 1)]} 50%, ${cols[Math.min(5, cols.length - 1)]} 100%)`,
      };
    }
    if (cfg.outlineMode) {
      return { cls: 'gp-swatch', bg: 'transparent', border: `2px solid ${cfg.style?.color === '#ffffff' ? '#0284c7' : cfg.style?.color}` };
    }
    return { cls: 'gp-swatch', bg: cfg.style?.fillColor || '#3b82f6' };
  }

  function renderLayerDrawer() {
    const body = document.getElementById('drawerBody');
    const countEl = document.getElementById('activeLayerCount');
    if (!body) return;

    const totalActive = engine.activeLayers.size;
    if (countEl) countEl.textContent = `Camadas (${totalActive})`;

    document.getElementById('tabLayers')?.classList.toggle('active', drawerTab === 'layers');
    document.getElementById('tabLegend')?.classList.toggle('active', drawerTab === 'legend');

    if (drawerTab === 'legend') {
      renderLegendTab(body);
      return;
    }

    const q = searchFilterText.trim().toLowerCase();
    const parts = [];

    // 1. Atalhos rápidos de Mapas Base no topo (idêntico ao padrão Floripa: Orto 2024 e Google Satélite)
    const quickBasemaps = BASEMAPS.filter((b) => b.id === 'orto_2024' || b.id === 'google_sat');
    for (const bm of quickBasemaps) {
      if (q && !bm.name.toLowerCase().includes(q)) continue;
      const checked = engine.isBasemapActive(bm.id);
      parts.push(`
        <div class="gp-layer-row is-basemap">
          <input type="checkbox" class="gp-checkbox" data-basemap-toggle="${bm.id}" ${checked ? 'checked' : ''} />
          <span class="gp-layer-label" data-basemap-label="${bm.id}">${escapeHtml(bm.name)}</span>
          <button class="gp-row-btn" title="Todos os Mapas Base & Comparador 1984–2024" data-open-panel="basemaps">•••</button>
        </div>
      `);
    }

    // 2. Grupo dinâmico de camadas importadas pelo usuário (se houver)
    const groupsToRender = [...LAYER_GROUPS];
    if (engine.userLayers.length) {
      groupsToRender.unshift({
        id: 'user_imported',
        name: 'Camadas Importadas pelo Usuário',
        description: 'Arquivos GeoJSON, KML e Shapefile (.zip) carregados localmente.',
        layers: engine.userLayers,
      });
    }

    for (const group of groupsToRender) {
      const groupMatches = !q || group.name.toLowerCase().includes(q);
      const matchingLayers = group.layers.filter(
        (l) => groupMatches || l.name.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
      );
      if (!matchingLayers.length) continue;

      const isExpanded = q ? true : expandedGroups.has(group.id);
      const activeInGroup = group.layers.filter((l) => engine.activeLayers.has(l.id)).length;
      const groupChecked = activeInGroup > 0;

      parts.push(`<div class="gp-group ${isExpanded ? 'expanded' : ''}" data-group-id="${group.id}">`);
      parts.push(`
        <div class="gp-layer-row is-group" data-group-toggle="${group.id}">
          <input type="checkbox" class="gp-checkbox" data-group-check="${group.id}" ${groupChecked ? 'checked' : ''} title="Ativar/Desativar camada principal do grupo" />
          <span class="gp-layer-label">- ${escapeHtml(group.name)}</span>
          <div class="gp-layer-meta-inline">
            ${activeInGroup > 0 ? `<span class="gp-badge-count">${activeInGroup}</span>` : ''}
            <button class="gp-row-btn" data-group-expand="${group.id}" title="Expandir/Recolher">
              <svg class="gp-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>
        </div>
      `);

      parts.push('<div class="gp-group-children">');
      for (const l of matchingLayers) {
        const st = engine.activeLayers.get(l.id);
        const isOn = Boolean(st);
        const sw = getLayerSwatchStyle(l);
        const optOpen = openOptionsLayerId === l.id;

        parts.push(`
          <div class="gp-layer-row is-child">
            <input type="checkbox" class="gp-checkbox" data-layer-toggle="${l.id}" ${isOn ? 'checked' : ''} />
            <span class="${sw.cls}" style="background:${sw.bg};${sw.border ? `border:${sw.border}` : ''}"></span>
            <span class="gp-layer-label" data-layer-label="${l.id}">${escapeHtml(l.name)}</span>
            <div class="gp-layer-meta-inline">
              ${st?.loading ? '<span class="gp-spinner" title="Carregando feições..."></span>' : ''}
              ${
                st?.zoomBlocked
                  ? `<button class="gp-badge-zoom" data-zoom-min="${l.id}" title="Clique para aproximar o mapa ao zoom mínimo (${l.minZoom})">z${l.minZoom}+</button>`
                  : isOn && !st.loading && st.count > 0
                  ? `<span class="gp-badge-count" title="${st.count} feições carregadas">${st.count}</span>`
                  : ''
              }
              <button class="gp-row-btn" data-layer-opts="${l.id}" title="Opções da camada (opacidade, zoom, exportar)">•••</button>
            </div>
          </div>
        `);

        if (optOpen) {
          const curOpacity = Math.round((st?.opacity ?? l.opacity ?? 0.75) * 100);
          parts.push(`
            <div class="gp-layer-options">
              <div class="gp-opacity-row">
                <span>Opacidade:</span>
                <input type="range" min="10" max="100" value="${curOpacity}" data-layer-opacity="${l.id}" />
                <span style="min-width:32px;text-align:right;font-weight:700">${curOpacity}%</span>
              </div>
              <div class="gp-opt-actions">
                <button class="gp-opt-btn" data-opt-zoom="${l.id}">Aproximar</button>
                <button class="gp-opt-btn" data-opt-export="${l.id}">Exportar GeoJSON</button>
                ${
                  l.downloadId
                    ? `<a class="gp-opt-btn" href="${PORTAL_ITEM}${l.downloadId}" target="_blank" rel="noopener">Download Oficial ↗</a>`
                    : ''
                }
              </div>
              ${l.description ? `<div class="gp-opt-desc">${escapeHtml(l.description)}</div>` : ''}
            </div>
          `);
        }
      }
      parts.push('</div></div>');
    }

    if (!parts.length) {
      parts.push('<div class="gp-search-empty">Nenhuma camada encontrada para o filtro informado.</div>');
    }

    body.innerHTML = parts.join('');
  }

  function renderLegendTab(container) {
    const legends = engine.getActiveLegends();
    if (!legends.length) {
      container.innerHTML =
        '<div class="gp-legend-panel"><div class="gp-search-empty">Nenhuma camada vetorial ativa no momento.<br>Ative camadas na aba "Camadas" para visualizar a legenda.</div></div>';
      return;
    }

    const html = legends
      .map((leg) => {
        const itemsHtml = leg.swatches
          .map((s) => {
            const cls =
              leg.geomType === 'point'
                ? 'gp-swatch is-point'
                : leg.geomType === 'line'
                ? 'gp-swatch is-line'
                : 'gp-swatch';
            const style = s.outline
              ? `background:transparent;border:2px ${s.dashed ? 'dashed' : 'solid'} ${s.color === '#ffffff' ? '#0284c7' : s.color}`
              : `background:${s.color}`;
            return `<div class="gp-legend-item"><span class="${cls}" style="${style}"></span><span>${escapeHtml(s.label)}</span></div>`;
          })
          .join('');
        return `
          <div class="gp-legend-card">
            <div class="gp-legend-title">${escapeHtml(leg.name)}</div>
            <div class="gp-legend-grid">${itemsHtml}</div>
          </div>
        `;
      })
      .join('');
    container.innerHTML = `<div class="gp-legend-panel">${html}</div>`;
  }

  // Event delegation no Controle de Camadas
  document.getElementById('drawerBody')?.addEventListener('click', (e) => {
    const bmCheck = e.target.closest('[data-basemap-toggle]');
    if (bmCheck) {
      const id = bmCheck.dataset.basemapToggle;
      tools.disableSwipe();
      engine.setBasemapActive(id, bmCheck.checked, bmCheck.checked);
      return;
    }
    const bmLbl = e.target.closest('[data-basemap-label]');
    if (bmLbl) {
      const id = bmLbl.dataset.basemapLabel;
      const next = !engine.isBasemapActive(id);
      tools.disableSwipe();
      engine.setBasemapActive(id, next, next);
      return;
    }
    const openPan = e.target.closest('[data-open-panel]');
    if (openPan) {
      toggleFloatingPanel(openPan.dataset.openPanel);
      return;
    }
    const grpCheck = e.target.closest('[data-group-check]');
    if (grpCheck) {
      e.stopPropagation();
      const gid = grpCheck.dataset.groupCheck;
      const g = LAYER_GROUPS.find((x) => x.id === gid) || (gid === 'user_imported' ? { layers: engine.userLayers } : null);
      if (!g) return;
      if (grpCheck.checked) {
        // Liga a primeira camada principal do grupo e expande
        expandedGroups.add(gid);
        if (g.layers[0]) engine.enableLayer(g.layers[0].id);
      } else {
        for (const l of g.layers) engine.disableLayer(l.id);
      }
      renderLayerDrawer();
      return;
    }
    const grpToggle = e.target.closest('[data-group-toggle]');
    if (grpToggle) {
      const gid = grpToggle.dataset.groupToggle;
      if (expandedGroups.has(gid)) expandedGroups.delete(gid);
      else expandedGroups.add(gid);
      renderLayerDrawer();
      return;
    }
    const layerCheck = e.target.closest('[data-layer-toggle]');
    if (layerCheck) {
      engine.toggleLayer(layerCheck.dataset.layerToggle, layerCheck.checked);
      return;
    }
    const layerLbl = e.target.closest('[data-layer-label]');
    if (layerLbl) {
      engine.toggleLayer(layerLbl.dataset.layerLabel);
      return;
    }
    const zoomMin = e.target.closest('[data-zoom-min]');
    if (zoomMin) {
      const id = zoomMin.dataset.zoomMin;
      const st = engine.activeLayers.get(id);
      if (st?.cfg?.minZoom) {
        map.setView(map.getCenter(), st.cfg.minZoom);
      }
      return;
    }
    const optsBtn = e.target.closest('[data-layer-opts]');
    if (optsBtn) {
      const id = optsBtn.dataset.layerOpts;
      openOptionsLayerId = openOptionsLayerId === id ? null : id;
      renderLayerDrawer();
      return;
    }
    const optZoom = e.target.closest('[data-opt-zoom]');
    if (optZoom) {
      const id = optZoom.dataset.optZoom;
      if (!engine.activeLayers.has(id)) {
        engine.enableLayer(id).then(() => engine.zoomToLayer(id));
      } else {
        engine.zoomToLayer(id);
      }
      return;
    }
    const optExp = e.target.closest('[data-opt-export]');
    if (optExp) {
      engine.exportLayerGeoJSON(optExp.dataset.optExport);
      return;
    }
  });

  document.getElementById('drawerBody')?.addEventListener('input', (e) => {
    const rng = e.target.closest('[data-layer-opacity]');
    if (!rng) return;
    const id = rng.dataset.layerOpacity;
    const val = Number(rng.value) / 100;
    engine.setLayerOpacity(id, val);
    const labelSpan = rng.nextElementSibling;
    if (labelSpan) labelSpan.textContent = `${rng.value}%`;
  });

  // Filtro de busca no Controle de Camadas
  document.getElementById('layerSearchInput')?.addEventListener('input', (e) => {
    searchFilterText = e.target.value;
    renderLayerDrawer();
  });

  document.getElementById('tabLayers')?.addEventListener('click', () => {
    drawerTab = 'layers';
    renderLayerDrawer();
  });

  document.getElementById('tabLegend')?.addEventListener('click', () => {
    drawerTab = 'legend';
    renderLayerDrawer();
  });

  document.getElementById('btnClearLayers')?.addEventListener('click', () => {
    engine.clearAllLayers();
    showToast('Todas as camadas vetoriais foram desativadas.', 'info');
  });

  // Abrir/Fechar Drawer
  const workspaceEl = document.getElementById('workspace');
  function setDrawerOpen(open) {
    workspaceEl?.classList.toggle('drawer-closed', !open);
    document.getElementById('btnToolLayers')?.classList.toggle('active', open);
    setTimeout(() => map.invalidateSize(), 260);
  }

  document.getElementById('btnDrawerClose')?.addEventListener('click', () => setDrawerOpen(false));
  document.getElementById('btnDrawerMin')?.addEventListener('click', () => setDrawerOpen(false));
  document.getElementById('btnToolLayers')?.addEventListener('click', () => {
    const isClosed = workspaceEl?.classList.contains('drawer-closed');
    setDrawerOpen(isClosed);
  });

  // ==================== BARRA DE STATUS (COORDENADAS & ESCALA) ====================
  const coordsTextEl = document.getElementById('statusCoordsText');
  const crsSelectEl = document.getElementById('statusCrsSelect');
  const scaleLineEl = document.getElementById('statusScaleLine');
  const scaleSelectEl = document.getElementById('statusScaleSelect');
  let lastMouseLatLng = map.getCenter();

  function updateCoordsDisplay(latlng) {
    if (!coordsTextEl) return;
    coordsTextEl.textContent = formatCoords(latlng.lat, latlng.lng, crsMode);
  }

  function updateScaleDisplay() {
    const center = map.getCenter();
    const z = map.getZoom();
    const denom = getScaleDenominator(center.lat, z);

    // Atualiza opção dinâmica no select de escala
    if (scaleSelectEl) {
      let customOpt = scaleSelectEl.querySelector('option[data-dynamic="1"]');
      if (!customOpt) {
        customOpt = document.createElement('option');
        customOpt.dataset.dynamic = '1';
        scaleSelectEl.prepend(customOpt);
      }
      customOpt.value = String(denom);
      customOpt.textContent = `1 : ${denom.toLocaleString('pt-BR')}`;
      scaleSelectEl.value = String(denom);
    }

    // Barra gráfica métrica (tenta ~75-115px)
    if (scaleLineEl) {
      const mPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, z);
      const targetMeters = mPerPx * 85;
      const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      let chosen = steps[0];
      for (const s of steps) {
        if (s <= targetMeters * 1.35) chosen = s;
      }
      const px = Math.max(46, Math.min(130, Math.round(chosen / mPerPx)));
      scaleLineEl.style.width = `${px}px`;
      scaleLineEl.textContent = chosen >= 1000 ? `${chosen / 1000} km` : `${chosen} m`;
    }
  }

  map.on('mousemove', (e) => {
    lastMouseLatLng = e.latlng;
    updateCoordsDisplay(e.latlng);
  });
  map.on('zoomend moveend', updateScaleDisplay);
  crsSelectEl?.addEventListener('change', (e) => {
    crsMode = e.target.value;
    updateCoordsDisplay(lastMouseLatLng);
  });
  scaleSelectEl?.addEventListener('change', (e) => {
    const targetScale = Number(e.target.value);
    if (targetScale > 0) {
      const z = getZoomForScale(map.getCenter().lat, targetScale);
      map.setZoom(Math.round(z));
    }
  });
  updateCoordsDisplay(lastMouseLatLng);
  updateScaleDisplay();

  // ==================== BUSCA UNIFICADA FLUTUANTE ====================
  const searchBar = document.getElementById('searchBar');
  const searchInput = document.getElementById('searchInput');
  const searchResultsEl = document.getElementById('searchResults');
  let searchTimer = null;

  document.getElementById('btnSearchToggle')?.addEventListener('click', () => {
    const isExp = searchBar.classList.toggle('expanded');
    if (isExp) searchInput.focus();
    else searchResultsEl.classList.remove('open');
  });

  document.getElementById('btnSearchClear')?.addEventListener('click', () => {
    searchInput.value = '';
    searchBar.classList.remove('has-text');
    searchResultsEl.classList.remove('open');
    tools.clearHighlight();
    searchInput.focus();
  });

  searchInput?.addEventListener('input', () => {
    const val = searchInput.value;
    searchBar.classList.toggle('has-text', val.length > 0);
    clearTimeout(searchTimer);
    if (val.trim().length < 2) {
      searchResultsEl.classList.remove('open');
      return;
    }
    searchResultsEl.innerHTML = '<div class="gp-search-empty">Pesquisando no GeoItajaí...</div>';
    searchResultsEl.classList.add('open');
    searchTimer = setTimeout(async () => {
      const hits = await tools.unifiedSearch(val);
      if (!hits.length) {
        searchResultsEl.innerHTML =
          '<div class="gp-search-empty">Nenhum resultado. Tente Bairro (ex: Fazenda, Praia Brava), Rua, Inscrição ou Coordenada.</div>';
        return;
      }
      searchResultsEl.innerHTML = hits
        .map(
          (h, idx) => `
          <div class="gp-search-item" data-search-idx="${idx}">
            <span class="gp-search-badge">${escapeHtml(h.badge)}</span>
            <div>
              <div class="gp-search-item-title">${escapeHtml(h.title)}</div>
              <div class="gp-search-item-sub">${escapeHtml(h.subtitle || '')}</div>
            </div>
          </div>`
        )
        .join('');
      searchResultsEl._hits = hits;
    }, 280);
  });

  searchResultsEl?.addEventListener('click', (e) => {
    const itemEl = e.target.closest('[data-search-idx]');
    if (!itemEl) return;
    const hit = searchResultsEl._hits?.[Number(itemEl.dataset.searchIdx)];
    if (hit) {
      tools.focusSearchResult(hit);
      searchResultsEl.classList.remove('open');
    }
  });

  // ==================== BARRA DE NAVEGAÇÃO ESQUERDA ====================
  document.getElementById('btnCrsInfo')?.addEventListener('click', () => {
    crsMode = crsMode === 'utm' ? 'wgs84' : crsMode === 'wgs84' ? 'dms' : 'utm';
    if (crsSelectEl) crsSelectEl.value = crsMode;
    updateCoordsDisplay(lastMouseLatLng);
    const names = { utm: 'SIRGAS 2000 / UTM 22S (EPSG:31982)', wgs84: 'WGS84 / Graus Decimais', dms: 'Graus, Minutos e Segundos (DMS)' };
    showToast(`Sistema de coordenadas: ${names[crsMode]}`, 'info');
  });
  document.getElementById('btnBoxZoom')?.addEventListener('click', () => {
    tools.setMode(tools.getMode() === 'boxZoom' ? 'pan' : 'boxZoom');
  });
  document.getElementById('btnZoomIn')?.addEventListener('click', () => map.zoomIn());
  document.getElementById('btnZoomOut')?.addEventListener('click', () => map.zoomOut());
  document.getElementById('btnPan')?.addEventListener('click', () => tools.setMode('pan'));
  document.getElementById('btnHome')?.addEventListener('click', () => tools.resetHome());
  document.getElementById('btnUndo')?.addEventListener('click', () => tools.undoView());
  document.getElementById('btnRedo')?.addEventListener('click', () => tools.redoView());
  document.getElementById('btnFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });
  document.getElementById('btnLocate')?.addEventListener('click', () => tools.locateUser());

  // ==================== PAINÉIS FLUTUANTES (BARRA DIREITA) ====================
  const fpEl = document.getElementById('floatingPanel');
  const fpTitle = document.getElementById('fpTitle');
  const fpBody = document.getElementById('fpBody');

  function closeFloatingPanel() {
    activeFloatingPanel = null;
    fpEl?.classList.remove('open');
    document.querySelectorAll('.gp-right-toolbar .gp-tool-btn[data-panel]').forEach((b) => b.classList.remove('active'));
  }

  document.getElementById('fpClose')?.addEventListener('click', () => {
    closeFloatingPanel();
    if (tools.getMode() !== 'pan') tools.setMode('pan');
  });

  function toggleFloatingPanel(panelId) {
    if (activeFloatingPanel === panelId) {
      closeFloatingPanel();
      if (tools.getMode() !== 'pan') tools.setMode('pan');
      return;
    }
    activeFloatingPanel = panelId;
    fpEl?.classList.add('open');
    document.querySelectorAll('.gp-right-toolbar .gp-tool-btn[data-panel]').forEach((b) => {
      b.classList.toggle('active', b.dataset.panel === panelId);
    });

    if (panelId === 'basemaps') renderBasemapsPanel();
    else if (panelId === 'measure') renderMeasurePanel();
    else if (panelId === 'draw') renderDrawPanel();
    else if (panelId === 'identify') {
      tools.setMode('identify');
      renderIdentifyPanel({ idle: true });
    } else if (panelId === 'select') {
      tools.setMode('select');
      renderIdentifyPanel({ idle: true, cadastralMode: true });
    } else if (panelId === 'import') renderImportPanel();
    else if (panelId === 'print') renderPrintPanel();
  }

  document.querySelectorAll('.gp-right-toolbar .gp-tool-btn[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => toggleFloatingPanel(btn.dataset.panel));
  });

  // ---- Banner de Modo Interativo ----
  function handleModeBanner(mode) {
    const banner = document.getElementById('modeBanner');
    const txt = document.getElementById('modeBannerText');
    document.getElementById('btnBoxZoom')?.classList.toggle('active', mode === 'boxZoom');
    document.getElementById('btnPan')?.classList.toggle('active', mode === 'pan');

    const labels = {
      boxZoom: 'Zoom por Retângulo: clique e arraste sobre o mapa',
      identify: 'Identificar Feições: clique em qualquer ponto de Itajaí',
      select: 'Consulta Rápida de Lote & Zoneamento: clique sobre um imóvel',
      measureDist: 'Medindo Distância: clique nos vértices (duplo clique finaliza)',
      measureArea: 'Medindo Área: marque 3+ pontos (duplo clique finaliza)',
      drawPoint: 'Desenho (Ponto): clique no mapa para marcar',
      drawLine: 'Desenho (Linha): clique nos vértices (duplo clique finaliza)',
      drawPoly: 'Desenho (Polígono): marque 3+ pontos (duplo clique finaliza)',
    };
    if (labels[mode]) {
      txt.textContent = labels[mode];
      banner.classList.add('open');
    } else {
      banner.classList.remove('open');
    }
  }

  document.getElementById('btnModeCancel')?.addEventListener('click', () => {
    tools.setMode('pan');
  });

  // ---- Painel 1: Mapas Base & Comparador Temporal 1984–2024 ----
  let swipeUiState = { active: false, left: 'orto_2024', right: 'rest_1984' };

  function renderBasemapsPanel() {
    fpTitle.textContent = 'Mapas Base e Série Histórica (1984–2024)';
    const cards = BASEMAPS.map((bm) => {
      const active = engine.isBasemapActive(bm.id);
      return `
        <div class="gp-basemap-card ${active ? 'active' : ''}" data-bm-select="${bm.id}">
          <span class="gp-basemap-year">${escapeHtml(bm.year)}</span>
          <div class="gp-basemap-name">${escapeHtml(bm.shortName)}</div>
          <div style="font-size:10.5px;color:#64748b;margin-top:2px">${escapeHtml(bm.category)}</div>
        </div>
      `;
    }).join('');

    const bmOptions = (sel) =>
      BASEMAPS.map((b) => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${escapeHtml(b.shortName)} (${b.year})</option>`).join('');

    fpBody.innerHTML = `
      <p style="margin:0 0 8px;color:#55606e;font-size:12px">
        Combine uma imagem oficial de Itajaí sobre satélite global ou alterne entre levantamentos históricos:
      </p>
      <div class="gp-basemap-grid">${cards}</div>
      <div style="border-top:1px solid #e2e8f0;padding-top:10px;margin-top:4px">
        <div style="font-weight:800;margin-bottom:6px;color:#1e293b">Cortina Comparativa (Antes × Depois)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
          <div>
            <label style="font-size:11px;font-weight:700;color:#555">Esquerda</label>
            <select id="swipeLeftSel" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">${bmOptions(swipeUiState.left)}</select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:#555">Direita</label>
            <select id="swipeRightSel" style="width:100%;padding:5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px">${bmOptions(swipeUiState.right)}</select>
          </div>
        </div>
        <div class="gp-btn-row" style="margin:0">
          <button class="gp-btn primary" id="btnStartSwipe">${swipeUiState.active ? 'Atualizar Cortina' : 'Ativar Cortina Comparativa'}</button>
          ${swipeUiState.active ? '<button class="gp-btn danger" id="btnStopSwipe">Desativar</button>' : ''}
        </div>
      </div>
    `;

    fpBody.querySelectorAll('[data-bm-select]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.bmSelect;
        if (swipeUiState.active) tools.disableSwipe();
        const next = !engine.isBasemapActive(id);
        // Evita sobrepor JPEG opaco sobre satélite global; permite combinar PNG transparente sobre satélite
        const clickedBm = BASEMAPS.find((b) => b.id === id);
        const isOpaqueJpg = clickedBm.url.endsWith('.jpg') && clickedBm.isMunicipalClip;
        if (isOpaqueJpg && next) {
          engine.setBasemapActive(id, true, true);
        } else if (clickedBm.isMunicipalClip) {
          for (const b of BASEMAPS) {
            if (b.isMunicipalClip && b.id !== id) engine.setBasemapActive(b.id, false, false);
          }
          engine.setBasemapActive(id, next, false);
        } else {
          for (const b of BASEMAPS) {
            if ((!b.isMunicipalClip || b.url.endsWith('.jpg')) && b.id !== id) {
              engine.setBasemapActive(b.id, false, false);
            }
          }
          engine.setBasemapActive(id, next, false);
        }
        renderBasemapsPanel();
      });
    });

    document.getElementById('btnStartSwipe')?.addEventListener('click', () => {
      const l = document.getElementById('swipeLeftSel').value;
      const r = document.getElementById('swipeRightSel').value;
      tools.enableSwipe(l, r);
      renderBasemapsPanel();
    });
    document.getElementById('btnStopSwipe')?.addEventListener('click', () => {
      tools.disableSwipe();
      renderBasemapsPanel();
    });
  }

  // Controle interativo da cortina arrastável (Swipe)
  const swipeDiv = document.getElementById('swipeDivider');
  const swipeTagL = document.getElementById('swipeTagLeft');
  const swipeTagR = document.getElementById('swipeTagRight');

  function renderSwipeOverlay(active, leftId, rightId, pos) {
    swipeUiState = { active, left: leftId, right: rightId };
    if (!swipeDiv) return;
    swipeDiv.classList.toggle('active', active);
    if (active) {
      swipeDiv.style.left = `${pos * 100}%`;
      const lBm = BASEMAPS.find((b) => b.id === leftId);
      const rBm = BASEMAPS.find((b) => b.id === rightId);
      if (swipeTagL) swipeTagL.textContent = lBm ? lBm.shortName : leftId;
      if (swipeTagR) swipeTagR.textContent = rBm ? rBm.shortName : rightId;
    }
  }

  let draggingSwipe = false;
  swipeDiv?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    draggingSwipe = true;
    map.dragging.disable();
  });
  window.addEventListener('mousemove', (e) => {
    if (!draggingSwipe) return;
    const rect = document.getElementById('map').getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0.05, Math.min(0.95, ratio));
    swipeDiv.style.left = `${clamped * 100}%`;
    tools.setSwipePosition(clamped);
  });
  window.addEventListener('mouseup', () => {
    if (draggingSwipe) {
      draggingSwipe = false;
      map.dragging.enable();
    }
  });

  // ---- Painel 2: Medição (Distância e Área) ----
  function renderMeasurePanel() {
    fpTitle.textContent = 'Medir Distância e Área';
    fpBody.innerHTML = `
      <div class="gp-btn-row">
        <button class="gp-btn ${tools.getMode() === 'measureDist' ? 'active' : ''}" id="btnMeasureDist">📏 Distância</button>
        <button class="gp-btn ${tools.getMode() === 'measureArea' ? 'active' : ''}" id="btnMeasureArea">📐 Área</button>
        <button class="gp-btn danger" id="btnMeasureClear">Limpar</button>
      </div>
      <div id="measureOutput" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:10px;line-height:1.5">
        Escolha <b>Distância</b> ou <b>Área</b> e clique nos pontos desejados sobre o mapa.
      </div>
      <div style="margin-top:8px;display:flex;justify-content:flex-end">
        <button class="gp-btn" id="btnMeasureFinish">Finalizar Traçado</button>
      </div>
    `;
    document.getElementById('btnMeasureDist')?.addEventListener('click', () => {
      tools.setMode('measureDist');
      renderMeasurePanel();
    });
    document.getElementById('btnMeasureArea')?.addEventListener('click', () => {
      tools.setMode('measureArea');
      renderMeasurePanel();
    });
    document.getElementById('btnMeasureClear')?.addEventListener('click', () => tools.clearMeasurements());
    document.getElementById('btnMeasureFinish')?.addEventListener('click', () => tools.finishMeasurement());
  }

  // ---- Painel 3: Desenho e Anotação ----
  function renderDrawPanel() {
    fpTitle.textContent = 'Desenhar e Anotar no Mapa';
    fpBody.innerHTML = `
      <div class="gp-btn-row">
        <button class="gp-btn ${tools.getMode() === 'drawPoint' ? 'active' : ''}" id="btnDrawPt">● Ponto</button>
        <button class="gp-btn ${tools.getMode() === 'drawLine' ? 'active' : ''}" id="btnDrawLn">╱ Linha</button>
        <button class="gp-btn ${tools.getMode() === 'drawPoly' ? 'active' : ''}" id="btnDrawPg">⬠ Polígono</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        <input id="drawLabelInput" type="text" placeholder="Rótulo da anotação (opcional)" style="flex:1;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;font-size:12.5px" />
        <input id="drawColorInput" type="color" value="#e11d48" title="Cor do desenho" style="width:34px;height:30px;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer" />
      </div>
      <div class="gp-btn-row">
        <button class="gp-btn" id="btnDrawFinish">Concluir Linha/Polígono</button>
        <button class="gp-btn primary" id="btnDrawExport">Exportar GeoJSON</button>
        <button class="gp-btn danger" id="btnDrawClear">Limpar</button>
      </div>
      <div id="drawCountBadge" style="font-size:12px;color:#55606e">Clique em uma geometria acima e desenhe sobre o mapa.</div>
    `;
    document.getElementById('btnDrawPt')?.addEventListener('click', () => { tools.setMode('drawPoint'); renderDrawPanel(); });
    document.getElementById('btnDrawLn')?.addEventListener('click', () => { tools.setMode('drawLine'); renderDrawPanel(); });
    document.getElementById('btnDrawPg')?.addEventListener('click', () => { tools.setMode('drawPoly'); renderDrawPanel(); });
    document.getElementById('drawColorInput')?.addEventListener('input', (e) => tools.setDrawColor(e.target.value));
    document.getElementById('btnDrawFinish')?.addEventListener('click', () => tools.finishDrawing(document.getElementById('drawLabelInput')?.value?.trim() || ''));
    document.getElementById('btnDrawExport')?.addEventListener('click', () => tools.exportDrawingsGeoJSON());
    document.getElementById('btnDrawClear')?.addEventListener('click', () => tools.clearDrawings());
  }

  // ---- Painel 4: Identificar Feições / Consulta Urbanística do Ponto ----
  function renderIdentifyPanel({ idle = false, loading = false, latlng = null, results = [], cadastralMode = false } = {}) {
    activeFloatingPanel = cadastralMode ? 'select' : 'identify';
    fpEl?.classList.add('open');
    fpTitle.textContent = cadastralMode ? 'Consulta Rápida — Lote e Zoneamento' : 'Identificação de Feições (Raio-X)';

    if (idle) {
      fpBody.innerHTML = `
        <p style="margin:0;color:#475569;line-height:1.5">
          Clique em qualquer local do mapa de <b>Itajaí</b> para consultar simultaneamente:
          <b>Bairro</b>, <b>Zoneamento 2024</b>, <b>Inscrição Imobiliária (Lote)</b> e todas as camadas ativas no ponto.
        </p>
      `;
      return;
    }

    const utmStr = formatCoords(latlng.lat, latlng.lng, 'utm');
    const wgsStr = formatCoords(latlng.lat, latlng.lng, 'wgs84');
    const dmsStr = formatCoords(latlng.lat, latlng.lng, 'dms');

    const coordBox = `
      <div class="gp-id-coords">
        <div><b>UTM 22S (SIRGAS 2000):</b> ${escapeHtml(utmStr)}</div>
        <div><b>WGS84 (Lat/Lon):</b> ${escapeHtml(wgsStr)}</div>
        <div><b>DMS:</b> ${escapeHtml(dmsStr)}</div>
      </div>
      <div class="gp-btn-row">
        <button class="gp-btn" id="btnCopyPointCoords">Copiar Coordenadas</button>
        <a class="gp-btn" href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latlng.lat},${latlng.lng}" target="_blank" rel="noopener">Street View ↗</a>
        <a class="gp-btn primary" href="https://arcgis.itajai.sc.gov.br/geoitajai/plantacadastral/plantacadastral.html" target="_blank" rel="noopener">Planta Cadastral ↗</a>
      </div>
    `;

    if (loading) {
      fpBody.innerHTML = `${coordBox}<div style="display:flex;align-items:center;gap:8px;padding:12px 0"><span class="gp-spinner"></span><span>Consultando camadas oficiais do GeoItajaí...</span></div>`;
      return;
    }

    let sectionsHtml = '';
    if (!results.length) {
      sectionsHtml = '<div class="gp-search-empty">Nenhuma feição encontrada neste ponto (fora dos limites ou sem camadas intersectadas).</div>';
    } else {
      sectionsHtml = results
        .map((r) => {
          const rows = [];
          const feat = r.features[0];
          const props = feat?.properties || {};
          for (const [k, v] of Object.entries(props)) {
            if (rows.length >= 8) break;
            if (['objectid', 'fid', 'globalid', 'shape__area', 'shape__length'].includes(k.toLowerCase())) continue;
            const fv = formatFieldValue(k, v);
            if (fv) rows.push(`<tr><th>${escapeHtml(prettyFieldName(k))}</th><td>${escapeHtml(fv)}</td></tr>`);
          }
          return `
            <div class="gp-id-section">
              <div class="gp-id-section-head">
                <span>${escapeHtml(r.layerName)}</span>
                <span class="gp-id-tag">${r.isCoreExtra ? 'Contexto Base' : `${r.features.length} feição(ões)`}</span>
              </div>
              <table class="gp-id-table">${rows.join('') || '<tr><td>Sem atributos disponíveis.</td></tr>'}</table>
            </div>
          `;
        })
        .join('');
    }

    fpBody.innerHTML = coordBox + sectionsHtml;
    document.getElementById('btnCopyPointCoords')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(`UTM 22S: ${utmStr} | WGS84: ${wgsStr}`);
      showToast('Coordenadas copiadas para a área de transferência!', 'success');
    });
  }

  // ---- Painel 5: Importar / Exportar Camadas Locais (SHP .zip, GeoJSON, KML) ----
  function renderImportPanel() {
    fpTitle.textContent = 'Importar / Exportar Arquivos SIG';
    fpBody.innerHTML = `
      <p style="margin:0 0 10px;color:#475569;line-height:1.45">
        Carregue arquivos <b>Shapefile (.zip)</b> baixados diretamente do <b>GeoItajaí Downloads</b>, além de <b>GeoJSON</b> ou <b>KML</b>, para sobrepor ao mapa:
      </p>
      <div class="gp-dropzone" id="importDropzone">
        <div style="font-weight:800;font-size:13.5px;color:#0f172a;margin-bottom:4px">Arraste o arquivo aqui ou clique para selecionar</div>
        <div style="font-size:11.5px;color:#64748b">Formatos aceitos: .zip (Shapefile), .geojson, .json, .kml</div>
        <input type="file" id="importFileInput" accept=".zip,.geojson,.json,.kml" style="display:none" />
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:10px">
        <div style="font-weight:800;margin-bottom:6px">Exportar Camadas Ativas</div>
        <div id="importActiveExports"></div>
      </div>
    `;

    const dz = document.getElementById('importDropzone');
    const fi = document.getElementById('importFileInput');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer.files?.[0]) handleImportFile(e.dataTransfer.files[0]);
    });
    fi.addEventListener('change', () => {
      if (fi.files?.[0]) handleImportFile(fi.files[0]);
    });

    const expBox = document.getElementById('importActiveExports');
    const activeIds = [...engine.activeLayers.keys()];
    if (!activeIds.length) {
      expBox.innerHTML = '<div style="font-size:12px;color:#64748b">Ative camadas no Controle de Camadas para exportá-las como GeoJSON.</div>';
    } else {
      expBox.innerHTML = activeIds
        .map((id) => {
          const st = engine.activeLayers.get(id);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9">
            <span style="font-size:12px;font-weight:600">${escapeHtml(st.cfg.name)}</span>
            <button class="gp-opt-btn" data-quick-exp="${id}">GeoJSON</button>
          </div>`;
        })
        .join('');
      expBox.querySelectorAll('[data-quick-exp]').forEach((b) => {
        b.addEventListener('click', () => engine.exportLayerGeoJSON(b.dataset.quickExp));
      });
    }
  }

  async function handleImportFile(file) {
    try {
      showToast(`Processando "${file.name}"...`, 'info');
      await engine.importUserFile(file);
    } catch (err) {
      showToast(`Erro na importação: ${err.message}`, 'error');
    }
  }

  // ---- Painel 6: Impressão Cartográfica ----
  function renderPrintPanel() {
    fpTitle.textContent = 'Imprimir / Salvar Mapa em PDF';
    const info = tools.buildPrintSummary();
    fpBody.innerHTML = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px;line-height:1.55">
        <div><b>Sistema de Referência:</b> SIRGAS 2000 / UTM 22S</div>
        <div><b>Escala Atual:</b> ${escapeHtml(info.scale)}</div>
        <div><b>Centro (UTM 22S):</b> ${escapeHtml(info.utm)}</div>
        <div><b>Data/Hora:</b> ${escapeHtml(info.date)}</div>
        <div><b>Camadas Ativas:</b> ${info.legends.length}</div>
      </div>
      <p style="margin:0 0 10px;font-size:12px;color:#55606e">
        Na janela de impressão do navegador, escolha <b>"Salvar como PDF"</b> em orientação <b>Paisagem</b> com <b>Gráficos de fundo</b> ativados.
      </p>
      <div class="gp-btn-row">
        <button class="gp-btn primary" id="btnTriggerPrint">🖨️ Imprimir / Gerar PDF</button>
      </div>
    `;
    document.getElementById('btnTriggerPrint')?.addEventListener('click', () => {
      closeFloatingPanel();
      setTimeout(() => window.print(), 180);
    });
  }

  // ==================== NAVEGAÇÃO SUPERIOR (MODAIS PADRÃO FLORIPA) ====================
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  function setNavActive(navId) {
    document.querySelectorAll('.gp-nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.nav === navId);
    });
    document.getElementById('mainNav')?.classList.remove('mobile-open');
  }

  function closeModal() {
    modalBackdrop?.classList.remove('open');
    setNavActive('map');
  }

  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  function openNavSection(navId) {
    setNavActive(navId);
    if (navId === 'map') {
      modalBackdrop?.classList.remove('open');
      return;
    }

    modalBackdrop?.classList.add('open');

    if (navId === 'home') {
      modalTitle.textContent = 'Geoportal Itajaí — Visão Geral e Mapas Temáticos Integrados';
      const totalLayers = window.GeoCatalog.getAllLayers().length;
      modalBody.innerHTML = `
        <div class="gp-hero-banner">
          <h3>Todos os dados geoespaciais de Itajaí em um único mapa interativo</h3>
          <p>
            Interface unificada no padrão do Geoportal de Florianópolis conectada em tempo real aos serviços oficiais do
            <b>GeoItajaí</b> (Prefeitura Municipal de Itajaí). Explore zoneamento, lotes cadastrais, inundações históricas,
            hidrografia, Semasa, obras, mobilidade e a série histórica de ortoimagens de <b>1984 a 2024</b> sem trocar de site.
          </p>
          <div class="gp-stats-strip">
            <span class="gp-stat-chip">${totalLayers} camadas oficiais integradas</span>
            <span class="gp-stat-chip">${BASEMAPS.length} mapas base (1984–2024)</span>
            <span class="gp-stat-chip">22 pacotes oficiais de download</span>
            <span class="gp-stat-chip">SIRGAS 2000 / UTM 22S</span>
          </div>
        </div>
        <h4 style="margin:0 0 10px;font-size:15px;font-weight:800;color:#1e293b">Escolha um conjunto temático pronto para abrir no mapa:</h4>
        <div class="gp-preset-grid">
          ${THEMATIC_PRESETS.map(
            (p) => `
            <div class="gp-preset-card" style="border-top:3px solid ${p.color}">
              <div>
                <div class="gp-preset-title">${escapeHtml(p.title)}</div>
                <div class="gp-preset-desc">${escapeHtml(p.desc)}</div>
              </div>
              <button class="gp-btn primary" data-apply-preset="${p.id}">Abrir no Mapa</button>
            </div>`
          ).join('')}
        </div>
      `;
      modalBody.querySelectorAll('[data-apply-preset]').forEach((btn) => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.applyPreset));
      });
    } else if (navId === 'downloads') {
      modalTitle.textContent = 'Central de Downloads — Dados Oficiais do GeoItajaí';
      modalBody.innerHTML = `
        <p style="margin:0 0 14px;color:#475569;line-height:1.5">
          Todos os arquivos publicados em <a href="https://geo.itajai.sc.gov.br/downloads/" target="_blank" rel="noopener" style="color:var(--brand-blue);font-weight:700">geo.itajai.sc.gov.br/downloads/</a>
          reunidos com acesso direto para <b>baixar o arquivo original</b> ou <b>visualizar a camada imediatamente no mapa interativo</b>:
        </p>
        ${OFFICIAL_DOWNLOADS.map(
          (cat) => `
          <div class="gp-dl-cat">
            <div class="gp-dl-cat-head">
              <span>${escapeHtml(cat.title)}</span>
              <span style="font-size:11.5px;color:#64748b;font-weight:700">${cat.items.length} arquivos</span>
            </div>
            <div class="gp-dl-list">
              ${cat.items
                .map(
                  (it) => `
                <div class="gp-dl-row">
                  <div>
                    <div class="gp-dl-name">${escapeHtml(it.label)}</div>
                    <div class="gp-dl-fmt">${escapeHtml(it.format)}</div>
                  </div>
                  <div class="gp-dl-actions">
                    ${
                      it.layerId || it.basemapId
                        ? `<button class="gp-btn primary" data-dl-view-layer="${it.layerId || ''}" data-dl-view-bm="${it.basemapId || ''}">Ver no Mapa</button>`
                        : ''
                    }
                    <a class="gp-btn" href="${PORTAL_ITEM}${it.itemId}" target="_blank" rel="noopener">Baixar (GeoItajaí) ↗</a>
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </div>`
        ).join('')}
      `;

      modalBody.querySelectorAll('[data-dl-view-layer], [data-dl-view-bm]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const lid = btn.dataset.dlViewLayer;
          const bmid = btn.dataset.dlViewBm;
          closeModal();
          setDrawerOpen(true);
          if (bmid) {
            for (const b of BASEMAPS) {
              if (b.isMunicipalClip && b.id !== bmid) engine.setBasemapActive(b.id, false, false);
            }
            engine.setBasemapActive(bmid, true, false);
            showToast('Base aérea oficial ativada no mapa!', 'success');
          }
          if (lid) {
            const found = window.GeoCatalog.getLayerById(lid);
            if (found) expandedGroups.add(found.group.id);
            engine.enableLayer(lid).then(() => {
              if (found?.layer?.minZoom && map.getZoom() < found.layer.minZoom) {
                map.setView(window.GeoCatalog.ITAJAI_URBAN_CENTER, found.layer.minZoom);
              } else {
                engine.zoomToLayer(lid);
              }
            });
            showToast(`Camada "${found?.layer?.name || lid}" ativada no mapa!`, 'success');
          }
        });
      });
    } else if (navId === 'docs') {
      modalTitle.textContent = 'Emissão de Documentos e Consultas Oficiais — Itajaí';
      modalBody.innerHTML = `
        <p style="margin:0 0 16px;color:#475569;line-height:1.5">
          Acesse diretamente os sistemas oficiais de consulta prévia, planta cadastral e emissão de documentos do Município de Itajaí,
          ou utilize a ferramenta de <b>Consulta Rápida</b> clicando em qualquer lote no mapa:
        </p>
        <div class="gp-preset-grid">
          <div class="gp-preset-card">
            <div>
              <div class="gp-preset-title">Planta Cadastral e Espelho do Lote</div>
              <div class="gp-preset-desc">Consulte BCI, matrícula, confrontantes, planta de localização e dados tributários por inscrição imobiliária.</div>
            </div>
            <a class="gp-btn primary" href="https://arcgis.itajai.sc.gov.br/geoitajai/plantacadastral/plantacadastral.html" target="_blank" rel="noopener">Abrir Planta Cadastral ↗</a>
          </div>
          <div class="gp-preset-card">
            <div>
              <div class="gp-preset-title">Consulta Prévia de Zoneamento (2024)</div>
              <div class="gp-preset-desc">Verifique parâmetros construtivos, índices urbanísticos e viabilidade conforme o Plano Diretor vigente.</div>
            </div>
            <a class="gp-btn primary" href="https://arcgis.itajai.sc.gov.br/portal/apps/experiencebuilder/experience/?id=03284fdd05e04bcfbe1ab51d1801efb2" target="_blank" rel="noopener">Consulta Prévia Oficial ↗</a>
          </div>
          <div class="gp-preset-card">
            <div>
              <div class="gp-preset-title">Raio-X Urbanístico Interativo no Mapa</div>
              <div class="gp-preset-desc">Ative a consulta de ponto no mapa para ver Bairro, Zoneamento 2024, Inscrição do Lote e coordenadas SIRGAS 2000.</div>
            </div>
            <button class="gp-btn primary" id="btnDocStartIdentify">Consultar Lote no Mapa</button>
          </div>
          <div class="gp-preset-card">
            <div>
              <div class="gp-preset-title">Portal Oficial GeoItajaí</div>
              <div class="gp-preset-desc">Acesse os dashboards temáticos, relatórios de licenciamento ambiental (INIS) e portal da Prefeitura de Itajaí.</div>
            </div>
            <a class="gp-btn" href="https://geo.itajai.sc.gov.br/" target="_blank" rel="noopener">Acessar geo.itajai.sc.gov.br ↗</a>
          </div>
        </div>
      `;
      document.getElementById('btnDocStartIdentify')?.addEventListener('click', () => {
        closeModal();
        engine.enableLayer('zoneamento_2024');
        engine.enableLayer('planta_cadastral');
        toggleFloatingPanel('select');
        showToast('Clique sobre qualquer ponto ou lote no mapa para emitir o Raio-X.', 'info');
      });
    } else if (navId === 'help') {
      modalTitle.textContent = 'Ajuda e Guia Rápido — Geoportal Itajaí';
      modalBody.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;line-height:1.55">
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">1. Controle de Camadas</h4>
            <p style="margin:0;color:#475569">Use o painel direito para ligar e desligar qualquer camada do GeoItajaí simultaneamente. Clique em <b>•••</b> para ajustar a opacidade, aproximar à camada, baixar a fonte oficial ou exportar em GeoJSON.</p>
          </div>
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">2. Série Histórica 1984–2024</h4>
            <p style="margin:0;color:#475569">Clique no ícone xadrez (<b>Mapas Base</b>) na barra direita para alternar entre Ortoimagens de 2024, 2020, 2013, 2007 e Restituições de 2020 e 1984 — ou ative a <b>Cortina Comparativa</b> arrastável!</p>
          </div>
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">3. Busca Unificada (🔍)</h4>
            <p style="margin:0;color:#475569">Pesquise por <b>Bairro</b> (ex: Praia Brava, Fazenda, Cordeiros), <b>Logradouro</b> (ex: Marcos Konder, Osvaldo Reis), <b>Inscrição Imobiliária</b> ou cole <b>Coordenadas</b> WGS84 ou UTM 22S.</p>
          </div>
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">4. Camadas de Alta Densidade (z14+ / z16+)</h4>
            <p style="margin:0;color:#475569">Camadas com dezenas de milhares de feições (como os 64.598 lotes cadastrais ou redes do Semasa) carregam sob demanda na área visível ao aproximar o mapa — basta clicar no selo amarelo <b>z16+</b>.</p>
          </div>
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">5. Importar Shapefile (.zip) / KML / GeoJSON</h4>
            <p style="margin:0;color:#475569">Baixou um arquivo do GeoItajaí Downloads ou tem um polígono próprio? Use o ícone de <b>Importar/Exportar</b> na barra direita e arraste o arquivo diretamente para o mapa.</p>
          </div>
          <div>
            <h4 style="margin:0 0 6px;color:var(--brand-blue)">6. Referência Geodésica & Créditos</h4>
            <p style="margin:0;color:#475569">Coordenadas exibidas em <b>SIRGAS 2000 / UTM Fuso 22 Sul (EPSG:31982)</b>, WGS84 e DMS. Todos os dados vetoriais e ortoimagens são consumidos ao vivo da infraestrutura pública da <b>Prefeitura de Itajaí (GeoItajaí / ArcGIS Enterprise)</b>.</p>
          </div>
        </div>
      `;
    }
  }

  function applyPreset(presetId) {
    const p = THEMATIC_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    closeModal();
    engine.clearAllLayers();
    tools.disableSwipe();
    engine.setBasemapActive(p.basemap, true, true);
    for (const lid of p.layers) {
      const found = window.GeoCatalog.getLayerById(lid);
      if (found) expandedGroups.add(found.group.id);
      engine.enableLayer(lid);
    }
    map.setView(p.center, p.zoom);
    setDrawerOpen(true);
    renderLayerDrawer();
    showToast(`Mapa temático carregado: ${p.title}`, 'success');
  }

  document.querySelectorAll('.gp-nav-btn[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => openNavSection(btn.dataset.nav));
  });

  document.getElementById('btnMobileMenu')?.addEventListener('click', () => {
    document.getElementById('mainNav')?.classList.toggle('mobile-open');
  });

  // Tecla ESC cancela modo ativo ou fecha modais
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalBackdrop?.classList.contains('open')) closeModal();
      else if (tools.getMode() !== 'pan') tools.setMode('pan');
      else if (activeFloatingPanel) closeFloatingPanel();
    }
  });

  // Render inicial da árvore de camadas
  renderLayerDrawer();
})();

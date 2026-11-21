/**
 * ============================================================================
 * MOTOR INTERATIVO 360° (WebGL Equirectangular + Projeção Esférica de Hotspots)
 * ============================================================================
 *
 * RESUMO DA LÓGICA MATEMÁTICA E DE PROGRAMAÇÃO:
 * 1. Renderização Esférica (Shader WebGL):
 *    Para cada pixel da tela, calculamos o raio 3D da câmera a partir de
 *    (yaw, pitch, hfov) e convertemos o vetor (dx, dy, dz) em coordenadas
 *    esféricas (longitude λ, latitude φ) para amostrar a foto 360° (u, v).
 *
 * 2. Projeção Direta 3D -> 2D (Ancoragem dos Hotspots na Foto 360°):
 *    Dado um ponto clicável em (pitch, yaw):
 *      x = cos(pitch) * sin(yaw)
 *      y = sin(pitch)
 *      z = cos(pitch) * cos(yaw)
 *    Rotacionamos (x, y, z) pela matriz inversa da câmera e projetamos na tela:
 *      screenX = W/2 + (x_cam / z_cam) * focalLength
 *      screenY = H/2 - (y_cam / z_cam) * focalLength
 *
 * 3. Projeção Inversa 2D -> 3D (Modo Criador / Captura de Clique na Esfera):
 *    Converte o clique do mouse (mouseX, mouseY) de volta para (pitch, yaw)
 *    com precisão de 0.1°, permitindo adicionar novos pontos clicáveis sem
 *    precisar adivinhar coordenadas!
 */

(function () {
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  const state = {
    currentSceneId: null,
    yaw: 0,
    pitch: -8,
    hfov: 95,
    targetYaw: 0,
    targetPitch: -8,
    targetHfov: 95,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    autoRotate: false,
    show3DLabels: false,
    activeCategoryFilter: "all",
    editorMode: false,
    lastClickedCoords: { pitch: 0, yaw: 0 },
    isTransitioning: false,
    cleanup3DModal: null,
    leafletMap: null,
    leafletMarkers: {},
    leafletRadarLayer: null,
    leafletFovPolygon: null,
    leafletAnchorMarker: null,
    leafletCanvasRenderer: null,
    leafletSatelliteLayer: null,
    leafletSvvLayer: null,
    leafletCustomRouteLayer: null,
    leafletAiLayer: null,
    isScMapSplitOpen: false,
    customRoute: {
      origin: null,
      waypoints: [],
      destination: null
    },
    aiSearch: {
      active: false,
      query: "",
      answer: "",
      results: [],
      trails: [],
      loadingOsm: false,
      reqId: 0
    },
    aiPoiByKey: {},
    rioDaLuzLimitTimer: null
  };

  function isAnyModalOrDrawerOpen() {
    const splitOpen = Boolean(document.getElementById("splitModalBackdrop")?.classList.contains("open"));
    const drawerOpen = Boolean(document.querySelector(".aux-drawer-modal.open"));
    const editorOpen = Boolean(document.getElementById("editorSidePanel")?.classList.contains("open"));
    const vrOpen = Boolean(document.getElementById("vrOverlayStage")?.classList.contains("open"));
    const limitEl = document.getElementById("rioDaLuzLimitAlert");
    const limitOpen = Boolean(limitEl && !limitEl.hidden);
    return splitOpen || drawerOpen || editorOpen || vrOpen || limitOpen;
  }

  function syncModalUiState() {
    const anyOpen = isAnyModalOrDrawerOpen();
    document.body.classList.toggle("any-modal-open", anyOpen);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "GEOSC_MODAL_OPEN", open: anyOpen }, "*");
      }
    } catch (_) {}
  }

  let gl = null;
  let shaderProgram = null;
  let panoTexture = null;
  let uYawLoc, uPitchLoc, uFovLoc, uAspectLoc;
  let currentTextureSource = null;
  let sceneLoadToken = 0;
  const imageCache = {};

  // Elementos da Interface
  let viewerCanvas, hotspotsContainer, labels3DContainer, topThumbsBar;
  let splitModal, modalLeftContent, modalRightContent;

  document.addEventListener("DOMContentLoaded", initApp);

  function initApp() {
    viewerCanvas = document.getElementById("panoCanvas");
    hotspotsContainer = document.getElementById("hotspotsContainer");
    labels3DContainer = document.getElementById("labels3DContainer");
    topThumbsBar = document.getElementById("topThumbsBar");
    splitModal = document.getElementById("splitModalBackdrop");
    modalLeftContent = document.getElementById("modalLeftMedia");
    modalRightContent = document.getElementById("modalRightEditorial");

    initWebGL();
    bindWebGLContextRecovery();
    buildTopThumbnails();
    buildCategoryFilterBar();
    bindViewerEvents();
    bindToolbarEvents();
    bindEditorEvents();

    const startId = window.TOUR_SC_DATA.defaultScene || Object.keys(window.TOUR_SC_DATA.scenes)[0];
    loadScene(startId, false);
    preloadAllSceneImages(startId);

    requestAnimationFrame(renderLoop);
  }

  /**
   * Pré-carrega de forma escalonada as demais fotos 360° em cache na memória
   * após a cena principal carregar, evitando travamentos ou telas brancas.
   */
  function preloadAllSceneImages(skipSceneId) {
    if (!window.TOUR_SC_DATA || !window.TOUR_SC_DATA.scenes) return;
    const others = Object.values(window.TOUR_SC_DATA.scenes).filter(sc => sc.id !== skipSceneId);
    others.forEach((sc, idx) => {
      setTimeout(() => {
        const b64 = (window.DRONE_PANOS_B64 && window.DRONE_PANOS_B64[sc.id])
          ? window.DRONE_PANOS_B64[sc.id]
          : null;
        const src = b64 || sc.customPanoramaUrl;
        if (src && !imageCache[sc.id]) {
          const img = new Image();
          if (!b64 && location.protocol !== "file:") {
            img.crossOrigin = "anonymous";
          }
          img.src = src;
          imageCache[sc.id] = img;
        }
      }, 400 + idx * 350);
    });
  }

  function bindWebGLContextRecovery() {
    if (!viewerCanvas) return;
    viewerCanvas.addEventListener("webglcontextlost", e => {
      e.preventDefault();
      console.warn("Contexto WebGL perdido temporariamente — restaurando automaticamente...");
    }, false);

    viewerCanvas.addEventListener("webglcontextrestored", () => {
      initWebGL();
      if (currentTextureSource) {
        uploadTextureSource(currentTextureSource);
      } else if (state.currentSceneId && window.TOUR_SC_DATA.scenes[state.currentSceneId]) {
        applySceneNow(window.TOUR_SC_DATA.scenes[state.currentSceneId]);
      }
    }, false);
  }

  // ===========================================================================
  // 1. INICIALIZAÇÃO DO MOTOR WEBGL (SHADER EQUIRETANGULAR ESFÉRICO ESTÁVEL)
  // ===========================================================================
  function initWebGL() {
    const ctxOpts = {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: true,
      preserveDrawingBuffer: true
    };
    gl = viewerCanvas.getContext("webgl", ctxOpts) || viewerCanvas.getContext("experimental-webgl", ctxOpts);
    if (!gl) {
      console.error("WebGL não disponível.");
      return;
    }

    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vNDC;
      void main() {
        vNDC = aPosition;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment Shader: converte cada pixel da tela em um raio 3D e amostra a esfera 360°
    const fsSource = `
      precision highp float;
      varying vec2 vNDC;
      uniform sampler2D uSampler;
      uniform float uYaw;
      uniform float uPitch;
      uniform float uTanHalfFov;
      uniform float uAspect;

      const float PI = 3.141592653589793;

      void main() {
        // Direção do raio no espaço da câmera
        vec3 rayCam = normalize(vec3(vNDC.x * uTanHalfFov, vNDC.y * (uTanHalfFov / uAspect), 1.0));

        // Rotação Pitch (eixo X)
        float cp = cos(uPitch);
        float sp = sin(uPitch);
        vec3 rayPitch = vec3(
          rayCam.x,
          rayCam.y * cp + rayCam.z * sp,
          -rayCam.y * sp + rayCam.z * cp
        );

        // Rotação Yaw (eixo Y)
        float cy = cos(uYaw);
        float sy = sin(uYaw);
        vec3 dir = vec3(
          rayPitch.x * cy + rayPitch.z * sy,
          rayPitch.y,
          -rayPitch.x * sy + rayPitch.z * cy
        );

        // Conversão Cartesiana (dx, dy, dz) -> Coordenadas Esféricas com proteção contra atan(0,0)
        float lon = (abs(dir.x) < 0.00001 && abs(dir.z) < 0.00001) ? 0.0 : atan(dir.x, dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));

        // Mapeamento Equiretangular UV [0..1]
        vec2 uv = vec2(fract(0.5 + lon / (2.0 * PI)), clamp(0.5 - lat / PI, 0.001, 0.999));
        gl_FragColor = texture2D(uSampler, uv);
      }
    `;

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vs);
    gl.attachShader(shaderProgram, fs);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(shaderProgram, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uYawLoc = gl.getUniformLocation(shaderProgram, "uYaw");
    uPitchLoc = gl.getUniformLocation(shaderProgram, "uPitch");
    uFovLoc = gl.getUniformLocation(shaderProgram, "uTanHalfFov");
    uAspectLoc = gl.getUniformLocation(shaderProgram, "uAspect");

    panoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, panoTexture);
    // Inicializa com 1 pixel escuro imediatamente para nunca exibir textura vazia/branca
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 28, 22, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Erro no Shader:", gl.getShaderInfoLog(s));
    }
    return s;
  }

  function uploadTextureSource(imageOrCanvas) {
    if (!gl || !panoTexture) return;

    let source = imageOrCanvas;
    let w = imageOrCanvas.width || imageOrCanvas.naturalWidth;
    let h = imageOrCanvas.height || imageOrCanvas.naturalHeight;

    // Proteção contra limite de textura da GPU (downscale seguro automático)
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    if (w > maxTex || h > maxTex) {
      const scale = Math.min(maxTex / w, maxTex / h);
      const tw = Math.floor(w * scale);
      const th = Math.floor(h * scale);
      const off = document.createElement("canvas");
      off.width = tw;
      off.height = th;
      const octx = off.getContext("2d");
      octx.drawImage(imageOrCanvas, 0, 0, tw, th);
      source = off;
      w = tw;
      h = th;
    }

    gl.bindTexture(gl.TEXTURE_2D, panoTexture);
    const isPOT = (v) => (v & (v - 1)) === 0;
    if (isPOT(w) && isPOT(h)) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      currentTextureSource = source;
      return true;
    } catch (err) {
      console.warn("WebGL texImage2D bloqueado para arquivo local (usando fallback seguro):", err);
      return false;
    }
  }

  // ===========================================================================
  // 2. CARREGAMENTO DE CENA 360° E RENDERIZAÇÃO DE HOTSPOTS / TEXTOS 3D
  // ===========================================================================
  function loadScene(sceneId, animateTransition = true) {
    const scene = window.TOUR_SC_DATA.scenes[sceneId];
    if (!scene) return;

    if (animateTransition && state.currentSceneId && state.currentSceneId !== sceneId) {
      triggerSceneTransition(scene);
      return;
    }

    applySceneNow(scene);
  }

  function triggerSceneTransition(targetScene, lookYaw, lookPitch) {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    const overlay = document.getElementById("sceneTransitionOverlay");
    const labelEl = document.getElementById("transitionTextLabel");

    if (typeof lookYaw === "number") state.targetYaw = lookYaw;
    if (typeof lookPitch === "number") state.targetPitch = lookPitch;
    state.targetHfov = 48; // Efeito de mergulho (zoom in) em direção ao ponto clicado!

    if (labelEl) {
      const fallbackTitle = (targetScene.placeMenuTitle || targetScene.title || "")
        .replace(/\s*[—–-]\s*Drone.*$/i, "")
        .replace(/\s*\(JDS.*?\)/gi, "")
        .trim();
      labelEl.textContent = targetScene.travelLabel || `Viajando para ${fallbackTitle}`;
    }
    if (overlay) overlay.classList.add("active");

    setTimeout(() => {
      applySceneNow(targetScene);
      state.hfov = 112;
      state.targetHfov = targetScene.initialView ? targetScene.initialView.hfov : 95;
      setTimeout(() => {
        if (overlay) overlay.classList.remove("active");
        state.isTransitioning = false;
      }, 380);
    }, 520);
  }

  function applySceneNow(scene) {
    state.currentSceneId = scene.id;
    const myToken = ++sceneLoadToken;

    // Define orientação inicial da câmera 360°
    const iv = scene.initialView || { pitch: -8, yaw: 0, hfov: 95 };
    state.yaw = state.targetYaw = iv.yaw;
    state.pitch = state.targetPitch = iv.pitch;
    state.hfov = state.targetHfov = iv.hfov || 95;

    // Carrega imagem 360° real do drone usando cache em memória (estabilidade instantânea sem piscar)
    const b64Source = (window.DRONE_PANOS_B64 && window.DRONE_PANOS_B64[scene.id])
      ? window.DRONE_PANOS_B64[scene.id]
      : null;
    const panoSrc = b64Source || scene.customPanoramaUrl;

    if (panoSrc) {
      let img = imageCache[scene.id];
      const isBrokenCached = img && img.complete && img.naturalWidth === 0 && img.width === 0;
      if (!img || img.src !== panoSrc || isBrokenCached) {
        img = new Image();
        if (!b64Source && location.protocol !== "file:") {
          img.crossOrigin = "anonymous";
        }
        img.src = panoSrc;
        imageCache[scene.id] = img;
      }

      const uploadWhenReady = () => {
        if (myToken !== sceneLoadToken) return;
        const ok = uploadTextureSource(img);
        if (!ok && b64Source && img.src !== b64Source) {
          img.src = b64Source;
        } else if (!ok) {
          const canvas = window.PanoramaGenerator.getEquirectangularCanvas(scene.proceduralPreset || scene.id);
          uploadTextureSource(canvas);
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        uploadWhenReady();
      } else {
        img.onload = uploadWhenReady;
        img.onerror = () => {
          if (myToken !== sceneLoadToken) return;
          if (b64Source && img.src !== b64Source) {
            img.src = b64Source;
          } else {
            const canvas = window.PanoramaGenerator.getEquirectangularCanvas(scene.proceduralPreset || scene.id);
            uploadTextureSource(canvas);
          }
        };
      }
    } else {
      const canvas = window.PanoramaGenerator.getEquirectangularCanvas(scene.proceduralPreset || scene.id);
      uploadTextureSource(canvas);
    }

    // Atualiza HUD de localização e barra de miniaturas
    updateSceneHUD(scene);
    renderSceneHotspotsDOM(scene);
    renderScene3DLabelsDOM(scene);
    highlightActiveThumbnail(scene.id);
    updateEditorSceneSelector();
    syncSatelliteMapToCurrentScene(scene);
  }

  function updateSceneHUD(scene) {
    const titleEl = document.getElementById("hudSceneTitle");
    const subEl = document.getElementById("hudSceneSubtitle");
    const ecoEl = document.getElementById("hudEcosystemText");
    if (titleEl) titleEl.textContent = scene.title;
    if (subEl) subEl.textContent = `${scene.municipality} • ${scene.region} • Alt: ${scene.altitude}`;
    if (ecoEl) ecoEl.textContent = scene.ecosystemSummary || "";
  }

  /**
   * Cria os elementos DOM dos Hotspots clicáveis da cena atual
   */
  function renderSceneHotspotsDOM(scene) {
    hotspotsContainer.innerHTML = "";
    if (!scene.hotspots) return;

    scene.hotspots.forEach(hs => {
      if (state.activeCategoryFilter !== "all" && hs.category !== state.activeCategoryFilter) {
        return;
      }

      const el = document.createElement("button");
      el.className = `hotspot-marker style-${hs.iconStyle || "red-circle"} type-${hs.type}`;
      el.dataset.id = hs.id;
      el.setAttribute("aria-label", hs.tooltip || hs.title || "Ponto interativo");

      // Conteúdo visual do marcador conforme o tipo (idêntico às Screenshots 1 e 4 do Geohereditas)
      let innerHTML = "";
      if (hs.type === "3d" || hs.iconStyle === "yellow-oval") {
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-oval-3d">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 2L3 7l9 5 9-5-9-5z"/>
              <path d="M3 17l9 5 9-5"/>
              <path d="M3 7v10"/>
              <path d="M21 7v10"/>
              <path d="M12 12v10"/>
            </svg>
            <strong class="hs-3d-tag">3D</strong>
          </span>
        `;
      } else if (hs.type === "streetview" || hs.iconStyle === "streetview-pill") {
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-oval-streetview">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="4.2" r="2.7"/>
              <path d="M15.6 8.2H8.4c-1.1 0-2 .9-2 2v4.3c0 .7.6 1.3 1.3 1.3h.8v5.2c0 .7.6 1.3 1.3 1.3h4.4c.7 0 1.3-.6 1.3-1.3v-5.2h.8c.7 0 1.3-.6 1.3-1.3v-4.3c0-1.1-.9-2-2-2z"/>
            </svg>
            <strong class="hs-sv-tag">RUA 360°</strong>
          </span>
        `;
      } else if (hs.type === "scene" || hs.iconStyle === "portal-thumb") {
        const targetScene = window.TOUR_SC_DATA.scenes[hs.targetSceneId];
        const thumbUrl = targetScene ? (targetScene.staticPhoto || targetScene.thumbPhoto) : "assets/fotos/lagoa_conceicao.jpg";
        innerHTML = `
          <span class="hs-pulse portal-pulse"></span>
          <span class="hs-portal-ring" style="background-image: url('${thumbUrl}')">
            <span class="hs-portal-arrow">360° ↗</span>
          </span>
        `;
      } else if (hs.iconStyle === "map-num") {
        // Círculo Roxo Numerado (1 a 13) idêntico ao Mapa Oficial do Rio da Luz!
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-map-num-badge">${hs.badgeText || "•"}</span>
        `;
      } else if (
        hs.iconStyle === "map-club" ||
        hs.iconStyle === "map-church" ||
        hs.iconStyle === "map-mountain"
      ) {
        // Ícones da Legenda do Mapa Oficial (Montanha, Igreja, Clube de Tiro)
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-map-legend-badge">${hs.badgeText || "★"}</span>
        `;
      } else if (hs.iconStyle === "white-circle") {
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-circle-white"><span class="hs-inner-dot"></span></span>
        `;
      } else {
        // Padrão: círculo bordô/vermelho com borda branca igual à Screenshot 1 e 4
        innerHTML = `
          <span class="hs-pulse"></span>
          <span class="hs-circle-red"></span>
        `;
      }

      // Tooltip flutuante ao passar o mouse
      const typeLabel =
        hs.type === "3d" ? "Modelo 3D Externo" :
        hs.type === "scene" ? "Ir para Foto 360°" : "Informação & Foto";

      innerHTML += hs.hideTooltipBadge
        ? `
        <span class="hotspot-tooltip">
          <strong>${hs.tooltip || hs.title}</strong>
        </span>
      `
        : `
        <span class="hotspot-tooltip">
          <small class="tt-badge">${typeLabel}</small>
          <strong>${hs.tooltip || hs.title}</strong>
        </span>
      `;

      el.innerHTML = innerHTML;

      el.addEventListener("click", e => {
        e.stopPropagation();
        handleHotspotClick(hs);
      });

      hotspotsContainer.appendChild(el);
      hs._domEl = el;
    });
  }

  /**
   * Cria os Rótulos Geográficos Flutuantes 3D ("Aa" - igual a "Planície Costeira" na Screenshot 4)
   */
  function renderScene3DLabelsDOM(scene) {
    labels3DContainer.innerHTML = "";
    labels3DContainer.style.display = state.show3DLabels ? "block" : "none";
    if (!scene.labels3D) return;

    scene.labels3D.forEach(lbl => {
      const el = document.createElement("div");
      el.className = "floating-3d-label";
      el.innerHTML = `<span>${lbl.text}</span>`;
      labels3DContainer.appendChild(el);
      lbl._domEl = el;
    });
  }

  // ===========================================================================
  // 3. AÇÃO AO CLICAR EM UM HOTSPOT (INFO POPUP, 3D, STREET VIEW OU OUTRA FOTO 360°)
  // ===========================================================================
  function buildStreetViewEmbedUrl(lat, lng, heading, pitch) {
    const h = Math.round(((Number(heading) || 0) % 360 + 360) % 360);
    const p = Math.round(Number(pitch) || 0);
    return `https://maps.google.com/maps?hl=pt-BR&layer=c&cbll=${lat},${lng}&cbp=12,${h},0,0,${p}&output=svembed`;
  }

  function buildStreetViewAppUrl(lat, lng, heading, pitch) {
    const h = Math.round(((Number(heading) || 0) % 360 + 360) % 360);
    const p = Math.round(Number(pitch) || 0);
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=${h}&pitch=${p}&fov=85`;
  }

  function handleHotspotClick(hs) {
    // Centraliza suavemente a câmera na direção do ponto clicado
    state.targetYaw = hs.yaw;
    state.targetPitch = hs.pitch;

    if (hs.type === "scene") {
      const targetScene = window.TOUR_SC_DATA.scenes[hs.targetSceneId];
      if (targetScene) {
        triggerSceneTransition(targetScene, hs.yaw, hs.pitch);
      }
      return;
    }

    if (hs.type === "3d") {
      openSplitModal3D(hs);
    } else {
      openSplitModalInfo(hs);
    }
  }

  /**
   * Abre o Pop-up Split-View de INFORMAÇÃO (Fotos e texto editorial)
   */
  function openSplitModalInfo(hs) {
    cleanupPrevious3D();

    let photoStageHTML = "";
    if (hs.showcaseCard) {
      const sc = hs.showcaseCard;
      photoStageHTML = `
        <div class="annotated-photo-wrapper">
          <div class="showcase-art-panel">
            <span class="showcase-art-badge">${sc.badge || "Patrimônio Cultural Tombado"}</span>
            <div class="showcase-art-mat">
              <img src="${hs.image || 'assets/fotos/riodaluz/casa_rux_aquarela.png'}" alt="${hs.title}" class="showcase-art-img ${sc.coverMain ? '' : 'art-contain'}" />
            </div>
            <div class="showcase-art-footer">
              <div class="showcase-art-caption-wrap">
                <span class="showcase-art-caption">${sc.caption || hs.title}</span>
                ${sc.address ? `<span class="showcase-art-address">${sc.address}</span>` : ""}
              </div>
              ${sc.realPhoto ? `
                <div class="showcase-real-card" title="Vista real no tour 360°">
                  <img src="${sc.realPhoto}" alt="Foto Real ${hs.title}" />
                  <span>${sc.realLabel || "Foto Real"}</span>
                </div>
              ` : ""}
            </div>
          </div>
          <div class="photo-caption-bar">
            <span>Coordenadas na Esfera 360°: Pitch ${hs.pitch.toFixed(1)}° | Yaw ${hs.yaw.toFixed(1)}°</span>
          </div>
        </div>
      `;
    } else {
      const annotationsHTML = (hs.imageAnnotations || []).map(ann => `
        <div class="geo-photo-annotation" style="left: ${ann.x}%; top: ${ann.y}%;">
          <div class="geo-ann-label">${ann.label}</div>
          <div class="geo-ann-arrow">↓</div>
        </div>
      `).join("");

      photoStageHTML = `
        <div class="annotated-photo-wrapper">
          <img src="${hs.image || 'assets/fotos/lagoa_conceicao.jpg'}" alt="${hs.title}" class="modal-main-photo ${hs.fitContain ? 'fit-contain' : ''}" />
          <div class="annotations-overlay">
            ${annotationsHTML}
          </div>
          <div class="photo-caption-bar">
            <span>Coordenadas na Esfera 360°: Pitch ${hs.pitch.toFixed(1)}° | Yaw ${hs.yaw.toFixed(1)}°</span>
          </div>
        </div>
      `;
    }

    modalLeftContent.innerHTML = photoStageHTML;
    renderRightEditorialCard(hs);
    splitModal.classList.add("open");
    syncModalUiState();
  }

  /**
   * Abre o Pop-up Split-View de MODELO 3D (Maquete .GLB Real ou Sketchfab Externo)
   */
  function openSplitModal3D(hs) {
    cleanupPrevious3D();

    const hasGLB = Boolean((hs.glbKey || hs.glbUrl) && window.GLBViewer);
    const embedUrl = hs.embedUrl || (hs.sketchfabUid
      ? `https://sketchfab.com/models/${hs.sketchfabUid}/embed?autostart=1&ui_infos=0`
      : "");

    if (hasGLB) {
      modalLeftContent.innerHTML = `
        <div class="modal-3d-wrapper">
          <div class="modal-3d-TopBar">
            <span class="btn-3d-mode active" style="cursor: default;">
              Vale do Rio da Luz
            </span>
          </div>

          <div id="localGLBContainer" class="local-3d-container"></div>
        </div>
      `;

      renderRightEditorialCard(hs);
      splitModal.classList.add("open");
      syncModalUiState();

      const glbContainer = document.getElementById("localGLBContainer");
      cleanupPrevious3D();
      state.cleanup3DModal = window.GLBViewer.mount(glbContainer, {
        glbKey: hs.glbKey,
        glbUrl: hs.glbUrl
      });
      return;
    }

    modalLeftContent.innerHTML = `
      <div class="modal-3d-wrapper">
        <div class="modal-3d-TopBar">
          <button type="button" class="btn-3d-mode active" id="btnModeSketchfab">
            Modelo 3D Externo (Sketchfab)
          </button>
          <button type="button" class="btn-3d-mode" id="btnModeLocal3D">
            Maquete 3D Interativa (Offline/Local)
          </button>
          ${hs.externalLink ? `
            <a href="${hs.externalLink}" target="_blank" rel="noopener noreferrer" class="btn-3d-external-link">
              Abrir no Site ↗
            </a>
          ` : ""}
        </div>

        <div id="sketchfabContainer" class="iframe-3d-container">
          <iframe
            title="${hs.title}"
            src="${embedUrl}"
            frameborder="0"
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowfullscreen
            mozallowfullscreen="true"
            webkitallowfullscreen="true">
          </iframe>
          <div class="sketchfab-badge-footer">
            <span>Hospedado externamente via <strong>Sketchfab 3D Embed</strong> • ${hs.author3D || "Acervo 3D SC"}</span>
          </div>
        </div>

        <div id="local3DContainer" class="local-3d-container" style="display: none;">
          <canvas id="interactive3DCanvas"></canvas>
        </div>
      </div>
    `;

    renderRightEditorialCard(hs);
    splitModal.classList.add("open");
    syncModalUiState();

    const btnSketchfab = document.getElementById("btnModeSketchfab");
    const btnLocal3D = document.getElementById("btnModeLocal3D");
    const sfContainer = document.getElementById("sketchfabContainer");
    const localContainer = document.getElementById("local3DContainer");

    if (btnSketchfab && btnLocal3D) {
      btnSketchfab.addEventListener("click", () => {
        btnSketchfab.classList.add("active");
        btnLocal3D.classList.remove("active");
        sfContainer.style.display = "flex";
        localContainer.style.display = "none";
        cleanupPrevious3D();
      });

      btnLocal3D.addEventListener("click", () => {
        btnLocal3D.classList.add("active");
        btnSketchfab.classList.remove("active");
        sfContainer.style.display = "none";
        localContainer.style.display = "flex";
        cleanupPrevious3D();
        const canvas3D = document.getElementById("interactive3DCanvas");
        state.cleanup3DModal = window.PanoramaGenerator.startInteractive3DTerrain(
          canvas3D,
          hs.fallback3DType || "island_lagoon",
          hs.title
        );
      });
    }
  }

  function renderRightEditorialCard(hs) {
    const paragraphsHTML = (hs.paragraphs || []).map(p => `<p class="editorial-body-p">${p}</p>`).join("");
    const didYouKnowHTML = hs.didYouKnow ? `
      <div class="did-you-know-card">
        <span class="dyk-yellow-tag">Você sabia?</span>
        <div class="dyk-paper-note">
          <p>${hs.didYouKnow}</p>
        </div>
      </div>
    ` : "";

    const rotaCtaHTML = hs.ctaOpenRotaLumiar ? `
      <button type="button" id="btnSplitOpenRotaLumiar" class="cta-rota-lumiar-btn">
        Abrir Mapa Interativo Rota Lumiar (Todos os 26 Pontos) ↗
      </button>
    ` : "";

    modalRightContent.innerHTML = `
      <div class="editorial-ornament-circle"></div>
      <button type="button" class="editorial-close-btn" id="btnCloseSplitModal" title="Fechar (ESC)">
        ×
      </button>
      <div class="editorial-scroll-area">
        <div class="editorial-green-line"></div>
        <h2 class="editorial-serif-title">${hs.title}</h2>
        <p class="editorial-green-lead">${hs.subtitleLead || ""}</p>
        <div class="editorial-paragraphs">
          ${paragraphsHTML}
        </div>
        ${rotaCtaHTML}
        ${didYouKnowHTML}
      </div>
    `;

    const closeBtn = document.getElementById("btnCloseSplitModal");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeSplitModal);
    }
    const rotaBtn = document.getElementById("btnSplitOpenRotaLumiar");
    if (rotaBtn) {
      rotaBtn.addEventListener("click", () => {
        closeSplitModal();
        buildRioDaLuzIllustratedMap();
        toggleDrawer("rdlIllustratedModal");
      });
    }
  }

  function cleanupPrevious3D() {
    if (typeof state.cleanup3DModal === "function") {
      state.cleanup3DModal();
      state.cleanup3DModal = null;
    }
  }

  function closeSplitModal() {
    cleanupPrevious3D();
    splitModal.classList.remove("open");
    modalLeftContent.innerHTML = "";
    syncModalUiState();
  }

  /**
   * Calcula tan(hfov/2) ajustada pela razão de aspecto para impedir que telas portrait
   * explodam o FOV vertical e estiquem a fotografia 360° ao girar/inclinar.
   */
  function getProjectionTanHalf(width, height) {
    const aspect = width / Math.max(1, height);
    const rawTanHalfX = Math.tan((state.hfov * DEG2RAD) * 0.5);
    if (aspect >= 0.95) return rawTanHalfX;
    // Em celulares retrato (aspect < 0.95), mantém FOV vertical entre 30° e 64°
    // (equivalente ao desktop 16:9), garantindo proporção natural sem esticar bordas ao mover.
    const clampedVfovDeg = Math.max(30, Math.min(64, state.hfov * 0.58));
    const tanHalfY = Math.tan((clampedVfovDeg * DEG2RAD) * 0.5);
    return tanHalfY * aspect;
  }

  // ===========================================================================
  // 4. LOOP DE RENDERIZAÇÃO 60 FPS E PROJEÇÃO MATEMÁTICA 3D -> 2D
  // ===========================================================================
  function syncCanvasResolution() {
    if (!viewerCanvas) return { cssW: 1, cssH: 1, pxW: 1, pxH: 1 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = viewerCanvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || viewerCanvas.clientWidth || window.innerWidth);
    const cssH = Math.max(1, rect.height || viewerCanvas.clientHeight || window.innerHeight);
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (viewerCanvas.width !== pxW || viewerCanvas.height !== pxH) {
      viewerCanvas.width = pxW;
      viewerCanvas.height = pxH;
      if (gl) gl.viewport(0, 0, pxW, pxH);
    }
    return { cssW, cssH, pxW, pxH };
  }

  function renderLoop() {
    // Rotação automática suave se ativada
    if (state.autoRotate && !state.isDragging && !splitModal.classList.contains("open")) {
      state.targetYaw = normalizeYaw(state.targetYaw + 0.08);
    }

    // Interpolação suave (Amortecimento / Damping da câmera)
    let dyaw = state.targetYaw - state.yaw;
    if (dyaw > 180) dyaw -= 360;
    if (dyaw < -180) dyaw += 360;
    state.yaw = normalizeYaw(state.yaw + dyaw * 0.14);

    state.targetPitch = Math.max(-85, Math.min(85, state.targetPitch));
    state.pitch += (state.targetPitch - state.pitch) * 0.14;

    state.targetHfov = Math.max(38, Math.min(115, state.targetHfov));
    state.hfov += (state.targetHfov - state.hfov) * 0.16;

    // Atualiza dimensões do Canvas WebGL em resolução física nativa (HiDPI) com proteção contra 0x0
    const { cssW, cssH, pxW, pxH } = syncCanvasResolution();

    // Desenha a esfera 360° via WebGL mantendo programa e textura vinculados
    if (gl && shaderProgram && !gl.isContextLost()) {
      const yawRad = state.yaw * DEG2RAD;
      const pitchRad = state.pitch * DEG2RAD;
      const tanHalfFov = getProjectionTanHalf(cssW, cssH);
      // Usa razão exata do framebuffer físico para pixels estritamente quadrados (zero distorção)
      const aspect = pxW / Math.max(1, pxH);

      gl.useProgram(shaderProgram);
      gl.bindTexture(gl.TEXTURE_2D, panoTexture);
      gl.uniform1f(uYawLoc, yawRad);
      gl.uniform1f(uPitchLoc, pitchRad);
      gl.uniform1f(uFovLoc, tanHalfFov);
      gl.uniform1f(uAspectLoc, aspect);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Projeta todos os Hotspots e Rótulos 3D na tela (coordenadas CSS)
    updateProjectedOverlays(cssW, cssH);
    updateLiveSatelliteRadar();

    // Atualiza bússola/coordenadas no rodapé se o Modo Criador estiver ativo
    const liveCoordsEl = document.getElementById("hudLiveCameraCoords");
    if (liveCoordsEl) {
      liveCoordsEl.textContent = `Pitch: ${state.pitch.toFixed(1)}° | Yaw: ${state.yaw.toFixed(1)}° | Zoom (FOV): ${Math.round(state.hfov)}°`;
    }

    requestAnimationFrame(renderLoop);
  }

  /**
   * MATEMÁTICA CENTRAL DO TOUR 360°:
   * Converte coordenadas esféricas (pitch, yaw) em coordenadas 2D de tela (x, y)
   */
  function sphericalToScreen(pitchDeg, yawDeg, width, height) {
    const pitch = pitchDeg * DEG2RAD;
    const yaw = yawDeg * DEG2RAD;

    // 1. Ponto 3D unitário na esfera do mundo
    const wx = Math.cos(pitch) * Math.sin(yaw);
    const wy = Math.sin(pitch);
    const wz = Math.cos(pitch) * Math.cos(yaw);

    // 2. Rotação inversa pelo Yaw da câmera (-state.yaw)
    const camYaw = state.yaw * DEG2RAD;
    const cy = Math.cos(-camYaw);
    const sy = Math.sin(-camYaw);
    const rx = wx * cy + wz * sy;
    const ry = wy;
    const rz = -wx * sy + wz * cy;

    // 3. Rotação inversa pelo Pitch da câmera (-state.pitch)
    const camPitch = state.pitch * DEG2RAD;
    const cp = Math.cos(-camPitch);
    const sp = Math.sin(-camPitch);
    const cx = rx;
    const cyCam = ry * cp + rz * sp;
    const cz = -ry * sp + rz * cp;

    // Se cz <= 0.05, o ponto está atrás da câmera (fora do campo de visão frontal)
    if (cz <= 0.05) {
      return { visible: false, x: -9999, y: -9999, depth: cz };
    }

    // 4. Projeção perspectiva usando a distância focal horizontal adaptativa
    const tanHalfFov = getProjectionTanHalf(width, height);
    const focalLength = (width * 0.5) / tanHalfFov;

    const screenX = width * 0.5 + (cx / cz) * focalLength;
    const screenY = height * 0.5 - (cyCam / cz) * focalLength;

    return {
      visible: screenX >= -120 && screenX <= width + 120 && screenY >= -120 && screenY <= height + 120,
      x: screenX,
      y: screenY,
      depth: cz
    };
  }

  /**
   * MATEMÁTICA INVERSA (Clique na Tela 2D -> Pitch e Yaw na Esfera 360°):
   * Usada pelo Modo Criador para permitir adicionar pontos clicáveis com 1 clique!
   */
  function screenToSpherical(clientX, clientY) {
    const rect = viewerCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const ndcX = ((clientX - rect.left) / width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / height) * 2;

    const tanHalfFov = getProjectionTanHalf(width, height);
    const aspect = width / Math.max(1, height);

    // Raio no espaço da câmera
    let rx = ndcX * tanHalfFov;
    let ry = ndcY * (tanHalfFov / aspect);
    let rz = 1.0;
    const len = Math.hypot(rx, ry, rz);
    rx /= len; ry /= len; rz /= len;

    // Rotação pelo Pitch da câmera
    const cp = Math.cos(state.pitch * DEG2RAD);
    const sp = Math.sin(state.pitch * DEG2RAD);
    const px = rx;
    const py = ry * cp + rz * sp;
    const pz = -ry * sp + rz * cp;

    // Rotação pelo Yaw da câmera
    const cy = Math.cos(state.yaw * DEG2RAD);
    const sy = Math.sin(state.yaw * DEG2RAD);
    const wx = px * cy + pz * sy;
    const wy = py;
    const wz = -px * sy + pz * cy;

    const pitchDeg = Math.asin(Math.max(-1, Math.min(1, wy))) * RAD2DEG;
    const yawDeg = Math.atan2(wx, wz) * RAD2DEG;

    return {
      pitch: Number(pitchDeg.toFixed(1)),
      yaw: Number(yawDeg.toFixed(1))
    };
  }

  function updateProjectedOverlays(w, h) {
    const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
    if (!scene) return;

    // Atualiza posição dos Hotspots
    if (scene.hotspots) {
      scene.hotspots.forEach(hs => {
        if (!hs._domEl) return;
        const proj = sphericalToScreen(hs.pitch, hs.yaw, w, h);
        if (!proj.visible) {
          hs._domEl.style.opacity = "0";
          hs._domEl.style.pointerEvents = "none";
        } else {
          hs._domEl.style.opacity = "1";
          hs._domEl.style.pointerEvents = "auto";
          hs._domEl.style.transform = `translate3d(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        }
      });
    }

    // Atualiza posição e perspectiva 3D dos Rótulos de Texto ("Aa")
    if (scene.labels3D && state.show3DLabels) {
      scene.labels3D.forEach(lbl => {
        if (!lbl._domEl) return;
        const proj = sphericalToScreen(lbl.pitch, lbl.yaw, w, h);
        if (!proj.visible) {
          lbl._domEl.style.opacity = "0";
        } else {
          const scale = (lbl.scale || 1.0) * (90 / state.hfov);
          const tilt = lbl.tilt || 12;
          lbl._domEl.style.opacity = "0.92";
          lbl._domEl.style.transform = `translate3d(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px, 0) translate(-50%, -50%) perspective(500px) rotateX(${tilt}deg) scale(${scale.toFixed(2)})`;
        }
      });
    }
  }

  function normalizeYaw(y) {
    let n = ((y + 180) % 360);
    if (n < 0) n += 360;
    return n - 180;
  }

  // ===========================================================================
  // 5. CONTROLES DE INTERAÇÃO (MOUSE, TOQUE, BARRA SUPERIOR E DOCK INFERIOR)
  // ===========================================================================
  function bindViewerEvents() {
    const viewport = document.getElementById("panoViewport");
    const activePointers = new Map();
    let pinchLastDist = 0;

    function computeFocalDegPerPx() {
      const rect = viewerCanvas.getBoundingClientRect();
      const w = Math.max(240, rect.width || viewport.clientWidth || window.innerWidth);
      const h = Math.max(240, rect.height || viewport.clientHeight || window.innerHeight);
      const tanHalf = getProjectionTanHalf(w, h);
      const focalPx = (w * 0.5) / Math.max(0.05, tanHalf);
      return (1 / focalPx) * (180 / Math.PI);
    }

    function getPinchDistance() {
      const pts = Array.from(activePointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }

    viewport.addEventListener("pointerdown", e => {
      if (e.target.closest(".hotspot-marker") || e.target.closest(".ui-layer")) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (viewport.setPointerCapture) {
        try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      }

      if (activePointers.size === 1) {
        state.isDragging = true;
        state.dragStartX = e.clientX;
        state.dragStartY = e.clientY;
        state.pointerDownX = e.clientX;
        state.pointerDownY = e.clientY;
        viewport.style.cursor = state.editorMode ? "crosshair" : "grabbing";
      } else if (activePointers.size === 2) {
        // Segundo dedo inicia pinça de zoom sem puxar ou saltar a câmera
        state.isDragging = false;
        pinchLastDist = getPinchDistance();
      }
    });

    window.addEventListener("pointermove", e => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size >= 2) {
        const curDist = getPinchDistance();
        if (pinchLastDist > 0 && curDist > 0) {
          const delta = curDist - pinchLastDist;
          state.targetHfov = Math.max(38, Math.min(115, state.targetHfov - delta * 0.18));
        }
        pinchLastDist = curDist;
        return;
      }

      if (!state.isDragging) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;

      // Rastreio 1:1 com a projeção esférica para que a foto 360° acompanhe o dedo sem esticar
      const speed = computeFocalDegPerPx();
      state.targetYaw = normalizeYaw(state.targetYaw - dx * speed);
      state.targetPitch = Math.max(-85, Math.min(85, state.targetPitch + dy * speed));
    });

    function handlePointerEnd(e) {
      if (!activePointers.has(e.pointerId)) return;
      const remainingBefore = activePointers.size;
      activePointers.delete(e.pointerId);
      pinchLastDist = 0;

      if (activePointers.size === 1) {
        const last = Array.from(activePointers.values())[0];
        state.dragStartX = last.x;
        state.dragStartY = last.y;
        state.isDragging = true;
        return;
      }

      if (!state.isDragging && remainingBefore > 1) return;
      if (!state.isDragging) return;
      state.isDragging = false;
      viewport.style.cursor = state.editorMode ? "crosshair" : "grab";

      // Verifica se foi um clique simples (sem arrasto) quando o Modo Criador está ativo
      const moveDist = Math.hypot(e.clientX - state.pointerDownX, e.clientY - state.pointerDownY);
      if (state.editorMode && moveDist < 6) {
        const coords = screenToSpherical(e.clientX, e.clientY);
        state.lastClickedCoords = coords;
        populateEditorCoordinates(coords.pitch, coords.yaw);
        showClickCrosshairFeedback(e.clientX, e.clientY, coords);
      }
    }

    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    // Impede explicitamente o Safari/iOS/WhatsApp de puxar ou ampliar a página durante arrasto 360°
    ["touchstart", "touchmove"].forEach(evtName => {
      viewport.addEventListener(evtName, e => {
        if (e.target.closest(".ui-layer") || e.target.closest(".hotspot-marker") || e.target.closest(".split-modal-backdrop")) return;
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncCanvasResolution);
      window.visualViewport.addEventListener("scroll", () => {
        try { window.scrollTo(0, 0); } catch (_) {}
        syncCanvasResolution();
      });
    }
    window.addEventListener("resize", syncCanvasResolution);
    window.addEventListener("orientationchange", () => setTimeout(syncCanvasResolution, 160));

    // Bloqueia zoom/rebote nativo do Safari iOS sobre o panorama 360°
    ["gesturestart", "gesturechange", "gestureend"].forEach(evtName => {
      viewport.addEventListener(evtName, e => e.preventDefault(), { passive: false });
    });

    viewport.addEventListener("wheel", e => {
      e.preventDefault();
      state.targetHfov = Math.max(38, Math.min(115, state.targetHfov + e.deltaY * 0.04));
    }, { passive: false });

    // Fechar modais com tecla ESC
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        if (state.isDraggingPegman || pegmanDragSession) {
          cancelActivePegmanDragSession();
          return;
        }
        if (state.isSatSvDropMode && !state.isSatStreetViewOpen) {
          setSatelliteStreetViewDropMode(false);
          return;
        }
        if (state.isSatStreetViewOpen) {
          toggleSatelliteStreetView(false);
          return;
        }
        closeSplitModal();
        closeAuxiliaryDrawers();
        setPlaceSelectorOpen(false);
      }
    });

    splitModal.addEventListener("click", e => {
      if (e.target === splitModal) closeSplitModal();
    });
  }

  /**
   * Abre ou fecha o seletor superior de lugares
   */
  function setPlaceSelectorOpen(open) {
    const shell = document.getElementById("placeSelectorShell");
    const btn = document.getElementById("btnTogglePlaceSelector");
    const hint = document.getElementById("placeSelectorToggleHint");
    if (!shell || !topThumbsBar || !btn) return;
    const isOpen = Boolean(open);
    shell.classList.toggle("open", isOpen);
    topThumbsBar.hidden = !isOpen;
    btn.setAttribute("aria-expanded", String(isOpen));
    if (hint) hint.textContent = isOpen ? "Fechar ▴" : "Abrir ▾";
  }

  /**
   * Constrói o Seletor Abre/Fecha de Lugares com apenas os 3 destinos principais e fotos estáticas claras
   */
  function buildTopThumbnails() {
    if (!topThumbsBar) return;
    topThumbsBar.innerHTML = "";
    const scenesList = Object.values(window.TOUR_SC_DATA.scenes)
      .filter(sc => sc.showInPlaceMenu !== false)
      .sort((a, b) => a.order - b.order);

    scenesList.forEach(sc => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "place-card-item";
      btn.dataset.sceneId = sc.id;
      const imgUrl = sc.staticPhoto || sc.thumbPhoto;
      const labelTitle = sc.placeMenuTitle || sc.shortTitle;
      const labelDesc = sc.placeMenuDesc || sc.municipality;
      btn.innerHTML = `
        <span class="place-card-media">
          <img src="${imgUrl}" alt="${labelTitle}" loading="eager" />
          <span class="place-card-badge">${sc.order}</span>
          <span class="place-card-current">Atual</span>
        </span>
        <span class="place-card-info">
          <strong class="place-card-title">${labelTitle}</strong>
          <small class="place-card-desc">${labelDesc}</small>
        </span>
      `;
      btn.addEventListener("click", () => {
        setPlaceSelectorOpen(false);
        loadScene(sc.id, true);
      });
      topThumbsBar.appendChild(btn);
    });

    const shell = document.getElementById("placeSelectorShell");
    const toggleBtn = document.getElementById("btnTogglePlaceSelector");
    if (shell && toggleBtn && !shell.dataset.bound) {
      shell.dataset.bound = "true";
      toggleBtn.addEventListener("click", e => {
        e.stopPropagation();
        setPlaceSelectorOpen(!shell.classList.contains("open"));
      });
      document.addEventListener("click", e => {
        if (shell.classList.contains("open") && !shell.contains(e.target)) {
          setPlaceSelectorOpen(false);
        }
      });
    }
    setPlaceSelectorOpen(false);
  }

  function highlightActiveThumbnail(sceneId) {
    document.querySelectorAll(".place-card-item").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sceneId === sceneId);
    });
    const currentLabel = document.getElementById("placeSelectorCurrentName");
    const sc = window.TOUR_SC_DATA.scenes[sceneId];
    if (currentLabel && sc) {
      currentLabel.textContent = sc.placeMenuTitle || sc.shortTitle || sc.title;
    }
  }

  /**
   * Constrói a barra de categorias no canto inferior esquerdo ("Serviços ecossistêmicos / Categorias aqui:")
   */
  function buildCategoryFilterBar() {
    const container = document.getElementById("categoryFilterButtons");
    if (!container) return;

    let html = `<button type="button" class="cat-chip active" data-cat="all">Todos os Pontos</button>`;
    Object.values(window.TOUR_SC_DATA.categories).forEach(cat => {
      html += `
        <button type="button" class="cat-chip" data-cat="${cat.id}" style="--cat-color: ${cat.color}">
          <span class="cat-dot" style="background:${cat.color}"></span>
          ${cat.label}
        </button>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll(".cat-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeCategoryFilter = btn.dataset.cat;
        container.querySelectorAll(".cat-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
        if (scene) renderSceneHotspotsDOM(scene);
      });
    });
  }

  /**
   * Eventos da Barra Inferior de Controles (Dock igual à Screenshot 1: i, Aa, Categorias, Grade, Mapa, Tela Cheia, Play, Criador)
   */
  function bindToolbarEvents() {
    // Botão "Aa" (Ligar/Desligar textos 3D flutuantes na foto 360°)
    const btnAa = document.getElementById("btnToggleAa");
    if (btnAa) {
      btnAa.addEventListener("click", () => {
        state.show3DLabels = !state.show3DLabels;
        btnAa.classList.toggle("active", state.show3DLabels);
        labels3DContainer.style.display = state.show3DLabels ? "block" : "none";
      });
    }

    // Botão "i" (Explicação da Lógica de Programação & Créditos)
    const btnInfoLogic = document.getElementById("btnOpenLogicGuide");
    if (btnInfoLogic) {
      btnInfoLogic.addEventListener("click", () => {
        toggleDrawer("logicGuideModal");
      });
    }

    // Botão Mapa Ilustrado do Rio da Luz (Pontos 1 a 26)
    const btnRdlMap = document.getElementById("btnOpenRioDaLuzMap");
    if (btnRdlMap) {
      btnRdlMap.addEventListener("click", () => {
        buildRioDaLuzIllustratedMap();
        toggleDrawer("rdlIllustratedModal");
      });
    }

    // Troca rápida direta entre aba Satélite (26 Pontos) <-> Mapa Cultural Rota Lumiar
    const switchRotaFn = () => {
      buildRioDaLuzIllustratedMap();
      openDrawer("rdlIllustratedModal");
    };
    const btnToRdl = document.getElementById("btnSwitchToRotaLumiar");
    if (btnToRdl) btnToRdl.addEventListener("click", switchRotaFn);
    const btnQuickRdl = document.getElementById("btnQuickOpenRotaLumiar");
    if (btnQuickRdl) btnQuickRdl.addEventListener("click", switchRotaFn);

    const btnToSat = document.getElementById("btnSwitchToSatellite");
    if (btnToSat) {
      btnToSat.addEventListener("click", () => {
        openScMapModal(false);
      });
    }

    // Botão Grade de Cenas
    const btnGrid = document.getElementById("btnOpenScenesGrid");
    if (btnGrid) {
      btnGrid.addEventListener("click", () => {
        buildScenesGridCards();
        toggleDrawer("scenesGridModal");
      });
    }

    // Ícone Google Maps (abre/fecha painel Satélite ao vivo em tela dividida com cone direcional)
    const btnMap = document.getElementById("btnOpenSCMap");
    if (btnMap) {
      btnMap.addEventListener("click", () => {
        const modal = document.getElementById("scMapModal");
        if (modal && modal.classList.contains("open")) {
          closeAuxiliaryDrawers();
        } else {
          openScMapModal(true);
        }
      });
    }

    const btnExpandSc = document.getElementById("btnToggleScMapExpand");
    if (btnExpandSc) {
      btnExpandSc.addEventListener("click", () => {
        const modal = document.getElementById("scMapModal");
        if (!modal) return;
        const nextSplit = !modal.classList.contains("split-mode");
        applyScMapDisplayMode(nextSplit);
      });
    }

    // Botão Modo Criador / Editor de Pontos 360°
    const btnEditor = document.getElementById("btnToggleEditor");
    if (btnEditor) {
      btnEditor.addEventListener("click", () => {
        state.editorMode = !state.editorMode;
        btnEditor.classList.toggle("active", state.editorMode);
        document.getElementById("editorSidePanel").classList.toggle("open", state.editorMode);
        document.getElementById("panoViewport").style.cursor = state.editorMode ? "crosshair" : "grab";
        syncModalUiState();
      });
    }

    // Botão Tela Cheia (nativo no Android/Desktop + fallback imersivo real no iPhone/Safari/WhatsApp)
    const btnFs = document.getElementById("btnFullscreen");
    if (btnFs) {
      const defaultFsIconHTML = btnFs.innerHTML;
      let toastTimer = null;
      const showFsToast = (msg) => {
        let el = document.getElementById("fsToastBanner");
        if (!el) {
          el = document.createElement("div");
          el.id = "fsToastBanner";
          el.className = "fs-toast-pill";
          document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = "block";
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
      };

      const isNativeFsActive = () => Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      const syncFsButton = () => {
        const active = isNativeFsActive() || document.body.classList.contains("pseudo-fullscreen");
        btnFs.classList.toggle("active", active);
        if (active) {
          btnFs.textContent = "Sair Tela Cheia";
        } else {
          btnFs.innerHTML = defaultFsIconHTML;
        }
        btnFs.setAttribute("title", active ? "Sair da Tela Cheia" : "Alternar Tela Cheia");
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: "GEOSC_PSEUDO_FULLSCREEN", active }, "*");
          }
        } catch (_) {}
        syncCanvasResolution();
      };

      const setPseudoFullscreen = (next) => {
        document.documentElement.classList.toggle("pseudo-fullscreen", next);
        document.body.classList.toggle("pseudo-fullscreen", next);
        if (next) {
          try { window.scrollTo(0, 1); } catch (_) {}
          showFsToast("Tela Cheia ativada");
        } else {
          showFsToast("Tela Cheia encerrada");
        }
        syncFsButton();
      };

      btnFs.addEventListener("click", () => {
        const currentlyActive = isNativeFsActive() || document.body.classList.contains("pseudo-fullscreen");
        const docEl = document.documentElement;
        const panoEl = document.getElementById("panoViewport");

        if (!currentlyActive) {
          setPseudoFullscreen(true);

          const req = docEl.requestFullscreen ||
            docEl.webkitRequestFullscreen ||
            docEl.mozRequestFullScreen ||
            docEl.msRequestFullscreen ||
            (panoEl && (panoEl.requestFullscreen || panoEl.webkitRequestFullscreen));
          if (typeof req === "function") {
            try {
              const target = (docEl.requestFullscreen || docEl.webkitRequestFullscreen) ? docEl : panoEl;
              const p = req.call(target, { navigationUI: "hide" });
              if (p && typeof p.catch === "function") {
                p.catch(() => {});
              }
            } catch (_) {}
          }
        } else {
          if (isNativeFsActive()) {
            const exit = document.exitFullscreen ||
              document.webkitExitFullscreen ||
              document.mozCancelFullScreen ||
              document.msExitFullscreen;
            if (typeof exit === "function") {
              try {
                const p = exit.call(document);
                if (p && typeof p.catch === "function") p.catch(() => {});
              } catch (_) {}
            }
          }
          setPseudoFullscreen(false);
        }
      });

      ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach(evt => {
        document.addEventListener(evt, () => {
          if (!isNativeFsActive() && document.body.classList.contains("pseudo-fullscreen")) {
            document.documentElement.classList.remove("pseudo-fullscreen");
            document.body.classList.remove("pseudo-fullscreen");
          }
          syncFsButton();
        });
      });
    }

    // Botão Play / Auto-Rotação
    const btnPlay = document.getElementById("btnAutoRotate");
    if (btnPlay) {
      btnPlay.addEventListener("click", () => {
        state.autoRotate = !state.autoRotate;
        btnPlay.classList.toggle("active", state.autoRotate);
      });
    }

    // Botões de fechar gavetas/modais auxiliares
    document.querySelectorAll("[data-close-drawer]").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-close-drawer");
        if (targetId === "scMapModal") {
          if (state.isSatStreetViewOpen) {
            toggleSatelliteStreetView(false);
          }
          document.body.classList.remove("satellite-split-open");
          state.isScMapSplitOpen = false;
          setSatelliteStreetViewDropMode(false);
          setSatelliteStreetViewCoverageVisible(false);
          hidePegmanDragOverlay();
        }
        const el = document.getElementById(targetId);
        if (el) {
          el.classList.remove("open", "split-mode", "sv-open");
        }
        syncModalUiState();
      });
    });
  }

  let scMapLayoutTimer = null;

  function applyScMapDisplayMode(splitMode, skipRefresh) {
    const modal = document.getElementById("scMapModal");
    const expandBtn = document.getElementById("btnToggleScMapExpand");
    if (!modal) return;
    modal.classList.toggle("split-mode", splitMode);
    document.body.classList.toggle("satellite-split-open", splitMode);
    state.isScMapSplitOpen = splitMode;
    if (expandBtn) {
      expandBtn.textContent = splitMode ? "Expandir Lista (26)" : "Modo Dividido (Ao Vivo)";
    }
    if (!skipRefresh && state.leafletMap) {
      if (scMapLayoutTimer) clearTimeout(scMapLayoutTimer);
      scMapLayoutTimer = setTimeout(() => {
        if (!state.leafletMap) return;
        state.leafletMap.stop();
        state.leafletMap.invalidateSize({ animate: false, pan: false });
        renderFilteredSatelliteMarkers(splitMode ? "pano360" : activeScMapFilter);
      }, 160);
    }
  }

  function openScMapModal(splitMode) {
    closeAuxiliaryDrawers();
    const modal = document.getElementById("scMapModal");
    if (!modal) return;
    modal.classList.add("open");
    if (splitMode) {
      activeScMapFilter = "pano360";
    }
    applyScMapDisplayMode(Boolean(splitMode), true);
    syncModalUiState();
    if (scMapLayoutTimer) clearTimeout(scMapLayoutTimer);
    scMapLayoutTimer = setTimeout(() => initOrUpdateLeafletMap(), 160);
  }

  function openDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    closeAuxiliaryDrawers();
    el.classList.add("open");
    syncModalUiState();
  }

  function toggleDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.contains("open");
    closeAuxiliaryDrawers();
    if (!isOpen) el.classList.add("open");
    syncModalUiState();
  }

  function closeAuxiliaryDrawers() {
    if (state.isSatStreetViewOpen) {
      toggleSatelliteStreetView(false);
    }
    ["logicGuideModal", "scenesGridModal", "scMapModal", "rdlIllustratedModal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("open", "split-mode", "sv-open");
    });
    document.body.classList.remove("satellite-split-open");
    state.isScMapSplitOpen = false;
    setSatelliteStreetViewDropMode(false);
    setSatelliteStreetViewCoverageVisible(false);
    hidePegmanDragOverlay();
    setPlaceSelectorOpen(false);
    syncModalUiState();
  }

  /**
   * Constrói o Mapa Cultural Turístico Interativo — Rota Lumiar (Pontos 1 a 26 com informações oficiais completas)
   */
  function buildRioDaLuzIllustratedMap() {
    const mapBox = document.getElementById("rdlInteractiveMapBox");
    const listBox = document.getElementById("rdlInteractiveListBox");
    const detailBox = document.getElementById("rdlPointDetailBox");
    const introLead = document.getElementById("rdlIntroLead");
    const creditsFooter = document.getElementById("rdlCreditsFooter");
    const filterBar = document.getElementById("rdlRegionFilterBar");
    const categoryBar = document.getElementById("rdlCategoryNavBar");
    const pdfToolbar = document.getElementById("rdlPdfToolbar");
    const btnDiorama = document.getElementById("btnRdlViewDiorama");
    const btnFront = document.getElementById("btnRdlViewFront");
    const btnBack = document.getElementById("btnRdlViewBack");
    const btnZoomIn = document.getElementById("btnRdlZoomIn");
    const btnZoomOut = document.getElementById("btnRdlZoomOut");
    const btnZoomReset = document.getElementById("btnRdlZoomReset");
    const btnExpandMap = document.getElementById("btnRdlExpandMap");
    const zoomLabel = document.getElementById("rdlZoomLevelLabel");
    if (!mapBox || !listBox) return;

    const rotaData = window.ROTA_LUMIAR_DATA;
    if (!rotaData || !rotaData.points) return;

    const categories = rotaData.categories || [
      { id: "atrativos", label: "Atrativos", shortTitle: "ATRATIVOS", color: "#1e293b" },
      { id: "compras", label: "Compras", shortTitle: "COMPRAS", color: "#6d28d9" },
      { id: "gastronomia", label: "Gastronomia", shortTitle: "GASTRONOMIA", color: "#d97706" },
      { id: "hospedagem", label: "Hospedagem & Clubes", shortTitle: "HOSPEDAGEM", color: "#dc2626" }
    ];
    const catById = {};
    categories.forEach(c => { catById[c.id] = c; });

    if (introLead) introLead.textContent = rotaData.introText || "";
    if (creditsFooter) creditsFooter.textContent = rotaData.credits || "";

    let currentRegion = "all";
    let currentCategory = "all";
    let selectedNum = null;
    let mapSide = "diorama";
    let zoomScale = 1;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let panMoved = false;
    let startClientX = 0;
    let startClientY = 0;
    let startPanX = 0;
    let startPanY = 0;
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 5;

    function getMapAspectRatio(stage) {
      const img = stage ? stage.querySelector("img") : null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        return img.naturalHeight / img.naturalWidth;
      }
      return 4525 / 3200;
    }

    function applyZoomTransform() {
      if (mapSide === "diorama") return;
      const stage = document.getElementById("rdlZoomStage");
      if (!stage) return;

      const boxW = mapBox.clientWidth;
      const ratio = getMapAspectRatio(stage);

      if (zoomScale <= 1.001 || !boxW) {
        zoomScale = 1;
        panX = 0;
        panY = 0;
        mapBox.style.height = "";
        stage.style.position = "relative";
        stage.style.left = "";
        stage.style.top = "";
        stage.style.width = "100%";
        stage.style.transform = "translate3d(0px, 0px, 0px)";
      } else {
        const boxH = Math.round(boxW * ratio);
        const stageW = boxW * zoomScale;
        const stageH = stageW * ratio;
        mapBox.style.height = `${boxH}px`;

        const minX = Math.min(0, boxW - stageW);
        const minY = Math.min(0, boxH - stageH);
        panX = Math.max(minX, Math.min(0, panX));
        panY = Math.max(minY, Math.min(0, panY));

        stage.style.position = "absolute";
        stage.style.left = "0px";
        stage.style.top = "0px";
        stage.style.width = `${stageW.toFixed(1)}px`;
        stage.style.transform = `translate3d(${panX.toFixed(1)}px, ${panY.toFixed(1)}px, 0)`;
      }

      mapBox.classList.toggle("is-zoomed", zoomScale > 1.01);
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoomScale * 100)}%`;
    }

    function setZoomAround(nextScale, focusClientX, focusClientY) {
      if (mapSide === "diorama") return;
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));
      const rect = mapBox.getBoundingClientRect();
      if (!rect.width) {
        zoomScale = clamped;
        applyZoomTransform();
        return;
      }
      const prevH = rect.height || Math.round(rect.width * getMapAspectRatio(document.getElementById("rdlZoomStage")));
      const fx = typeof focusClientX === "number" ? (focusClientX - rect.left) : (rect.width / 2);
      const fy = typeof focusClientY === "number" ? (focusClientY - rect.top) : (prevH / 2);
      const imgX = (fx - panX) / zoomScale;
      const imgY = (fy - panY) / zoomScale;
      zoomScale = clamped;
      panX = fx - imgX * zoomScale;
      panY = fy - imgY * zoomScale;
      applyZoomTransform();
    }

    function resetMapZoom() {
      zoomScale = 1;
      panX = 0;
      panY = 0;
      mapBox.style.height = "";
      applyZoomTransform();
    }

    function updateDioramaPinStates() {
      mapBox.querySelectorAll(".rdl-teardrop-pin").forEach(pin => {
        const num = Number(pin.dataset.pointNum);
        const pt = rotaData.points.find(p => p.num === num);
        const matchesCat = currentCategory === "all" || (pt && (pt.category || "atrativos") === currentCategory);
        const matchesReg = currentRegion === "all" || (pt && pt.regionKey === currentRegion);
        pin.classList.toggle("is-dimmed", !(matchesCat && matchesReg));
        pin.classList.toggle("active", num === selectedNum);
      });
    }

    function renderMapSide() {
      const vecData = window.ROTA_LUMIAR_VECTOR_MAP;
      const isDiorama = mapSide === "diorama" && Boolean(vecData);

      mapBox.classList.toggle("mode-diorama", isDiorama);
      mapBox.classList.toggle("mode-pdf", !isDiorama);
      mapBox.classList.toggle("zoomable", !isDiorama);
      if (pdfToolbar) {
        pdfToolbar.style.display = isDiorama ? "none" : "flex";
      }

      if (btnDiorama) btnDiorama.classList.toggle("active", isDiorama);
      if (btnFront) btnFront.classList.toggle("active", mapSide === "front");
      if (btnBack) btnBack.classList.toggle("active", mapSide === "back");

      if (isDiorama) {
        mapBox.style.height = "";
        mapBox.innerHTML = `<div class="rdl-diorama-wrap">${vecData.svgMarkup}</div>`;
        const wrap = mapBox.querySelector(".rdl-diorama-wrap");
        if (wrap) {
          rotaData.points.forEach(p => {
            const pos = (vecData.pinPositions && vecData.pinPositions[p.num]) || { x: p.x, y: p.y };
            const pin = document.createElement("button");
            pin.type = "button";
            const catClass = `cat-${p.category || "atrativos"}`;
            pin.className = `rdl-teardrop-pin ${catClass} ${p.sceneId ? "has-360" : ""} ${p.num === selectedNum ? "active" : ""}`;
            pin.style.left = `${pos.x}%`;
            pin.style.top = `${pos.y}%`;
            pin.dataset.pointNum = String(p.num);
            pin.setAttribute("aria-label", `${p.num}. ${p.name}`);
            pin.innerHTML = `
              <span class="rdl-pin-num">${p.num}</span>
              <span class="rdl-pin-tooltip">${p.num}. ${p.name}${p.sceneId ? " 360°" : ""}</span>
            `;
            pin.addEventListener("click", () => selectRotaPoint(p.num, false));
            wrap.appendChild(pin);
          });
        }
        updateDioramaPinStates();
        return;
      }

      const imgUrl = mapSide === "back"
        ? (rotaData.legendImage || "assets/fotos/mapa_rota_lumiar_info.jpg")
        : (rotaData.mapImage || "assets/fotos/mapa_rota_lumiar.jpg");

      mapBox.innerHTML = `<div id="rdlZoomStage" class="rdl-zoom-stage"><img src="${imgUrl}" alt="Mapa Cultural Turístico Rota Lumiar" draggable="false" /></div>`;
      const stage = document.getElementById("rdlZoomStage");
      const mapImg = stage ? stage.querySelector("img") : null;
      if (mapImg) {
        mapImg.addEventListener("load", applyZoomTransform);
      }

      if (mapSide === "front" && stage) {
        rotaData.points.forEach(p => {
          const pin = document.createElement("button");
          pin.type = "button";
          const catClass = `cat-${p.category || "atrativos"}`;
          pin.className = `rdl-map-pin-btn ${catClass} ${p.sceneId ? "has-360" : ""} ${p.num === selectedNum ? "active" : ""}`;
          pin.style.left = `${p.x}%`;
          pin.style.top = `${p.y}%`;
          pin.dataset.pointNum = String(p.num);
          pin.title = `${p.num}. ${p.name} (${p.region})`;
          pin.textContent = String(p.num);
          pin.addEventListener("click", () => {
            if (panMoved) return;
            selectRotaPoint(p.num, true);
          });
          stage.appendChild(pin);
        });
      }

      applyZoomTransform();
    }

    if (!mapBox.dataset.zoomBound) {
      mapBox.dataset.zoomBound = "true";

      mapBox.addEventListener("wheel", e => {
        if (mapSide === "diorama") return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.24 : 0.8;
        setZoomAround(zoomScale * factor, e.clientX, e.clientY);
      }, { passive: false });

      mapBox.addEventListener("dblclick", e => {
        if (mapSide === "diorama" || e.target.closest(".rdl-map-pin-btn")) return;
        const next = zoomScale > 1.3 ? 1 : 2.25;
        setZoomAround(next, e.clientX, e.clientY);
      });

      mapBox.addEventListener("mousedown", e => {
        if (mapSide === "diorama" || e.button !== 0 || zoomScale <= 1.01) {
          panMoved = false;
          return;
        }
        isPanning = true;
        panMoved = false;
        startClientX = e.clientX;
        startClientY = e.clientY;
        startPanX = panX;
        startPanY = panY;
        mapBox.classList.add("is-dragging");
        e.preventDefault();
      });

      window.addEventListener("mousemove", e => {
        if (!isPanning) return;
        const dx = e.clientX - startClientX;
        const dy = e.clientY - startClientY;
        if (Math.hypot(dx, dy) > 4) panMoved = true;
        panX = startPanX + dx;
        panY = startPanY + dy;
        applyZoomTransform();
      });

      window.addEventListener("mouseup", () => {
        if (!isPanning) return;
        isPanning = false;
        mapBox.classList.remove("is-dragging");
        setTimeout(() => { panMoved = false; }, 60);
      });
    }

    if (btnZoomIn && !btnZoomIn.dataset.bound) {
      btnZoomIn.dataset.bound = "true";
      btnZoomIn.addEventListener("click", () => setZoomAround(zoomScale * 1.35));
    }
    if (btnZoomOut && !btnZoomOut.dataset.bound) {
      btnZoomOut.dataset.bound = "true";
      btnZoomOut.addEventListener("click", () => setZoomAround(zoomScale / 1.35));
    }
    if (btnZoomReset && !btnZoomReset.dataset.bound) {
      btnZoomReset.dataset.bound = "true";
      btnZoomReset.addEventListener("click", resetMapZoom);
    }
    if (btnExpandMap && !btnExpandMap.dataset.bound) {
      btnExpandMap.dataset.bound = "true";
      btnExpandMap.addEventListener("click", () => {
        const isExpanded = mapBox.classList.toggle("is-wide-pdf");
        mapBox.style.maxWidth = isExpanded ? "100%" : "";
        btnExpandMap.classList.toggle("active", isExpanded);
        btnExpandMap.textContent = isExpanded ? "Normal" : "Expandir";
        setTimeout(applyZoomTransform, 180);
      });
    }

    function buildGoogleMapsHref(p) {
      if (typeof p.lat === "number" && typeof p.lng === "number") {
        return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
      }
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.googleQuery || p.endereco)}`;
    }

    function renderSelectedDetail(p) {
      if (!detailBox) return;
      if (!p) {
        detailBox.hidden = true;
        detailBox.innerHTML = "";
        return;
      }
      detailBox.hidden = false;
      const gmapsHref = buildGoogleMapsHref(p);
      const catInfo = catById[p.category] || categories[0];
      const contactLine = p.contatoUrl
        ? `<div><strong>Site / Facebook:</strong> <a href="${p.contatoUrl}" target="_blank" rel="noopener noreferrer">${p.contatoLabel || p.contatoUrl} ↗</a></div>`
        : "";
      const emailLine = p.email ? `<div><strong>E-mail:</strong> ${p.email}</div>` : "";
      const tourBtn = p.sceneId
        ? `<button type="button" class="rdl-action-btn rdl-action-360" data-open-scene="${p.sceneId}">Ver Panorama 360° Aqui</button>`
        : "";

      detailBox.innerHTML = `
        <button type="button" class="rdl-detail-close-btn" id="btnCloseRdlDetail" title="Fechar detalhes">×</button>
        <div class="rdl-detail-head">
          <span class="rdl-list-badge cat-${p.category || "atrativos"}">${p.num}</span>
          <div>
            <strong style="font-size:17px;color:#1e293b;display:block;font-family:var(--font-serif);">${p.num}. ${p.name}</strong>
            <div style="margin-top:3px;">
              <span class="rdl-detail-cat-pill" style="background:${catInfo.color};">${catInfo.label}</span>
              <span class="rdl-detail-region">${p.region}</span>
            </div>
          </div>
        </div>
        <p class="rdl-detail-desc">${p.description}</p>
        <div class="rdl-detail-meta">
          <div><strong>Atendimento:</strong> ${p.atendimento}</div>
          <div><strong>Endereço:</strong> ${p.endereco}</div>
          <div><strong>Tel.:</strong> ${p.telefone}</div>
          ${contactLine}
          ${emailLine}
        </div>
        <div class="rdl-detail-actions">
          <a href="${gmapsHref}" target="_blank" rel="noopener noreferrer" class="rdl-action-btn rdl-action-gmaps">
            Abrir no Google Maps ↗
          </a>
          ${tourBtn}
        </div>
      `;

      const closeDetailBtn = detailBox.querySelector("#btnCloseRdlDetail");
      if (closeDetailBtn) {
        closeDetailBtn.addEventListener("click", () => {
          selectedNum = null;
          renderSelectedDetail(null);
          updateDioramaPinStates();
          listBox.querySelectorAll("[data-card-num]").forEach(row => row.classList.remove("active"));
        });
      }
      const sceneBtn = detailBox.querySelector("[data-open-scene]");
      if (sceneBtn) {
        sceneBtn.addEventListener("click", () => {
          closeAuxiliaryDrawers();
          loadScene(sceneBtn.getAttribute("data-open-scene"), true);
        });
      }
    }

    function renderPointsCards() {
      const visibleCategories = currentCategory === "all"
        ? categories
        : categories.filter(c => c.id === currentCategory);

      listBox.innerHTML = visibleCategories.map(cat => {
        const colPts = rotaData.points.filter(p =>
          (p.category || "atrativos") === cat.id &&
          (currentRegion === "all" || p.regionKey === currentRegion)
        );
        return `
          <div class="rdl-cat-col">
            <div class="rdl-cat-col-header">
              <span class="rdl-cat-col-title">
                <span class="rdl-cat-dot" style="background:${cat.color};"></span>
                <span>${cat.shortTitle}</span>
              </span>
              <span class="rdl-cat-col-count">${colPts.length}</span>
            </div>
            ${colPts.map(p => `
              <button type="button" class="rdl-dir-row ${p.num === selectedNum ? "active" : ""}" data-card-num="${p.num}">
                <span class="rdl-dir-pin" style="background:${cat.color};">${p.num}</span>
                <span class="rdl-dir-text">
                  <strong class="rdl-dir-name">${p.name}${p.sceneId ? '<span class="rdl-dir-360-tag">360°</span>' : ""}</strong>
                  <span class="rdl-dir-hours">${p.atendimento}</span>
                </span>
              </button>
            `).join("")}
          </div>
        `;
      }).join("");

      listBox.querySelectorAll("[data-card-num]").forEach(row => {
        row.addEventListener("click", () => {
          selectRotaPoint(Number(row.getAttribute("data-card-num")), false);
          if (detailBox && !detailBox.hidden) {
            detailBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      });
    }

    function selectRotaPoint(num, scrollCard) {
      const point = rotaData.points.find(pt => pt.num === num);
      if (!point) return;
      selectedNum = point.num;
      renderSelectedDetail(point);
      updateDioramaPinStates();

      mapBox.querySelectorAll(".rdl-map-pin-btn").forEach(pin => {
        pin.classList.toggle("active", Number(pin.dataset.pointNum) === point.num);
      });
      listBox.querySelectorAll("[data-card-num]").forEach(row => {
        const isCurrent = Number(row.getAttribute("data-card-num")) === point.num;
        row.classList.toggle("active", isCurrent);
        if (isCurrent && scrollCard) {
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }

    if (btnDiorama && !btnDiorama.dataset.bound) {
      btnDiorama.dataset.bound = "true";
      btnDiorama.addEventListener("click", () => {
        mapSide = "diorama";
        resetMapZoom();
        renderMapSide();
      });
    }
    if (btnFront && !btnFront.dataset.bound) {
      btnFront.dataset.bound = "true";
      btnFront.addEventListener("click", () => {
        mapSide = "front";
        resetMapZoom();
        renderMapSide();
      });
    }
    if (btnBack && !btnBack.dataset.bound) {
      btnBack.dataset.bound = "true";
      btnBack.addEventListener("click", () => {
        mapSide = "back";
        resetMapZoom();
        renderMapSide();
      });
    }
    if (filterBar && !filterBar.dataset.bound) {
      filterBar.dataset.bound = "true";
      filterBar.querySelectorAll("[data-region]").forEach(chip => {
        chip.addEventListener("click", () => {
          currentRegion = chip.getAttribute("data-region") || "all";
          filterBar.querySelectorAll("[data-region]").forEach(c => c.classList.toggle("active", c === chip));
          renderPointsCards();
          updateDioramaPinStates();
        });
      });
    }
    if (categoryBar && !categoryBar.dataset.bound) {
      categoryBar.dataset.bound = "true";
      categoryBar.querySelectorAll("[data-cat]").forEach(tab => {
        tab.addEventListener("click", () => {
          currentCategory = tab.getAttribute("data-cat") || "all";
          categoryBar.querySelectorAll("[data-cat]").forEach(t => t.classList.toggle("active", t === tab));
          renderPointsCards();
          updateDioramaPinStates();
        });
      });
    }

    renderSelectedDetail(null);
    renderMapSide();
    renderPointsCards();
  }

  function focusAndOpenRioDaLuzPoint(hotspotId, sceneId) {
    closeAuxiliaryDrawers();
    const targetSceneId = sceneId || "rio_da_luz_geral";
    if (state.currentSceneId !== targetSceneId) {
      applySceneNow(window.TOUR_SC_DATA.scenes[targetSceneId]);
    }
    const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
    if (!scene || !scene.hotspots) return;

    // Procura o hotspot exato (ou o hotspot agrupado das igrejas/clubes)
    let hs = scene.hotspots.find(h => h.id === hotspotId);
    if (!hs && (hotspotId === "hs_rdl_ig_paulo" || hotspotId === "hs_rdl_ig_paz")) {
      hs = scene.hotspots.find(h => h.id === "hs_rdl_ig_paulo_paz");
    }
    if (!hs && hotspotId === "hs_rdl_soc_centenario") {
      hs = scene.hotspots.find(h => h.id === "hs_rdl_soc_alianca");
    }
    if (hs) {
      handleHotspotClick(hs);
    }
  }

  function buildScenesGridCards() {
    const grid = document.getElementById("scenesGridContainer");
    if (!grid) return;
    const scenesList = Object.values(window.TOUR_SC_DATA.scenes)
      .filter(sc => sc.showInPlaceMenu !== false)
      .sort((a, b) => a.order - b.order);
    grid.innerHTML = scenesList.map(sc => `
      <div class="scene-grid-card ${sc.id === state.currentSceneId ? 'current' : ''}" data-go-scene="${sc.id}">
        <div class="sgc-thumb" style="background-image: url('${sc.staticPhoto || sc.thumbPhoto}')">
          <span class="sgc-order">Lugar #${sc.order}</span>
          <span class="sgc-count">${(sc.hotspots || []).length} pontos clicáveis</span>
        </div>
        <div class="sgc-body">
          <h4>${sc.placeMenuTitle || sc.title}</h4>
          <p class="sgc-muni">${sc.municipality}</p>
          <p class="sgc-desc">${sc.placeMenuDesc || sc.ecosystemSummary}</p>
        </div>
      </div>
    `).join("");

    grid.querySelectorAll("[data-go-scene]").forEach(card => {
      card.addEventListener("click", () => {
        const targetId = card.getAttribute("data-go-scene");
        closeAuxiliaryDrawers();
        loadScene(targetId, true);
      });
    });
  }

  // ===========================================================================
  // 6. MAPA GOOGLE SATÉLITE GEORREFERENCIADO + CONE DE VISÃO AO VIVO (RADAR 360°)
  // ===========================================================================
  let activeScMapFilter = "pano360";
  let lastRadarKey = "";

  function getRotaPointsForMap(filterKey) {
    const pts = (window.ROTA_LUMIAR_DATA && Array.isArray(window.ROTA_LUMIAR_DATA.points))
      ? window.ROTA_LUMIAR_DATA.points.filter(p => typeof p.lat === "number" && typeof p.lng === "number")
      : [];
    if (filterKey === "rio_da_luz") return pts.filter(p => p.regionKey === "rio_da_luz");
    if (filterKey === "testo_alto") return pts.filter(p => p.regionKey === "testo_alto");
    if (filterKey === "pano360") return pts.filter(p => Boolean(p.sceneId));
    return pts;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRouteKey(keyOrNum) {
    if (keyOrNum === null || keyOrNum === undefined) return "";
    const s = String(keyOrNum).trim();
    if (!s) return "";
    if (s.startsWith("pt:") || s.startsWith("osm:")) return s;
    if (/^\d+$/.test(s)) return `pt:${Number(s)}`;
    return s;
  }

  function resolveRoutePoint(keyOrNum) {
    const key = normalizeRouteKey(keyOrNum);
    if (!key) return null;
    if (key.startsWith("osm:") && state.aiPoiByKey && state.aiPoiByKey[key]) {
      return state.aiPoiByKey[key];
    }
    const pts = (window.ROTA_LUMIAR_DATA && Array.isArray(window.ROTA_LUMIAR_DATA.points))
      ? window.ROTA_LUMIAR_DATA.points
      : [];
    const num = Number(key.replace(/^pt:/, ""));
    const pt = pts.find(p => p.num === num);
    if (!pt || typeof pt.lat !== "number" || typeof pt.lng !== "number") return null;
    return {
      key: `pt:${pt.num}`,
      num: pt.num,
      name: pt.name,
      region: pt.region,
      endereco: pt.endereco || pt.region,
      lat: pt.lat,
      lng: pt.lng,
      source: "Rota Lumiar"
    };
  }

  function getRouteSequenceItems() {
    const seq = [];
    const originItem = state.customRoute.origin ? resolveRoutePoint(state.customRoute.origin) : null;
    const stopItems = (state.customRoute.waypoints || []).map(resolveRoutePoint).filter(Boolean);
    const destItem = state.customRoute.destination ? resolveRoutePoint(state.customRoute.destination) : null;
    if (originItem) seq.push({ role: "origin", label: "O", item: originItem });
    stopItems.forEach((it, idx) => seq.push({ role: "stop", label: `P${idx + 1}`, idx, item: it }));
    if (destItem) seq.push({ role: "destination", label: "D", item: destItem });
    return seq;
  }

  function buildCustomGoogleMapsDirectionsUrl() {
    const originItem = state.customRoute.origin ? resolveRoutePoint(state.customRoute.origin) : null;
    let stopItems = (state.customRoute.waypoints || []).map(resolveRoutePoint).filter(Boolean);
    let destItem = state.customRoute.destination ? resolveRoutePoint(state.customRoute.destination) : null;

    if (!destItem && stopItems.length >= 1) {
      destItem = stopItems[stopItems.length - 1];
      stopItems = stopItems.slice(0, -1);
    }
    if (!destItem) return "";

    const params = ["api=1", "travelmode=driving"];
    if (originItem) {
      params.push(`origin=${originItem.lat.toFixed(6)},${originItem.lng.toFixed(6)}`);
    }
    if (stopItems.length > 0) {
      const wpStr = stopItems.map(it => `${it.lat.toFixed(6)},${it.lng.toFixed(6)}`).join("|");
      params.push(`waypoints=${encodeURIComponent(wpStr)}`);
    }
    params.push(`destination=${destItem.lat.toFixed(6)},${destItem.lng.toFixed(6)}`);
    return `https://www.google.com/maps/dir/?${params.join("&")}`;
  }

  function updateRouteQuickBadge() {
    const btn = document.getElementById("btnScMapQuickRoute");
    if (!btn) return;
    const count = (state.customRoute.origin ? 1 : 0)
      + state.customRoute.waypoints.length
      + (state.customRoute.destination ? 1 : 0);
    btn.textContent = `Minha Rota (${count})`;
    btn.classList.toggle("active", count > 0);
  }

  function getPointRouteRoleFlags(keyOrNum) {
    const key = normalizeRouteKey(keyOrNum);
    const wpIdx = state.customRoute.waypoints.indexOf(key);
    return {
      isOrigin: state.customRoute.origin === key,
      stopIndex: wpIdx,
      isStop: wpIdx !== -1,
      isDest: state.customRoute.destination === key
    };
  }

  function refreshAllRouteViews() {
    updateRouteQuickBadge();
    renderCustomRoutePanel();
    renderCustomRouteOnMap();

    const sidebar = document.getElementById("scMapPointsSidebar");
    if (sidebar) {
      sidebar.querySelectorAll("[data-route-role]").forEach(btn => {
        const key = normalizeRouteKey(btn.getAttribute("data-route-key"));
        const role = btn.getAttribute("data-route-role");
        const flags = getPointRouteRoleFlags(key);
        if (role === "origin") {
          btn.classList.toggle("is-active", flags.isOrigin);
          btn.textContent = flags.isOrigin ? "Origem ✓" : "Origem";
        } else if (role === "stop") {
          btn.classList.toggle("is-active", flags.isStop);
          btn.textContent = flags.isStop ? `Parada ${flags.stopIndex + 1}` : "+ Parada";
        } else if (role === "destination") {
          btn.classList.toggle("is-active", flags.isDest);
          btn.textContent = flags.isDest ? "Destino ✓" : "Destino";
        }
      });
    }

    if (state.leafletMarkers) {
      const pts = getRotaPointsForMap("all");
      Object.entries(state.leafletMarkers).forEach(([numStr, marker]) => {
        const pt = pts.find(p => p.num === Number(numStr));
        if (pt && marker && marker.getPopup && marker.getPopup()) {
          marker.setPopupContent(buildRotaPointGooglePopupHTML(pt));
        }
      });
    }
  }

  function setRoutePointRole(keyOrNum, role, focusRoutePanel) {
    const item = resolveRoutePoint(keyOrNum);
    if (!item) return false;
    const key = item.key;

    if (role === "origin") {
      if (state.customRoute.origin === key) {
        state.customRoute.origin = null;
      } else {
        state.customRoute.origin = key;
        state.customRoute.waypoints = state.customRoute.waypoints.filter(k => k !== key);
        if (state.customRoute.destination === key) state.customRoute.destination = null;
      }
    } else if (role === "destination") {
      if (state.customRoute.destination === key) {
        state.customRoute.destination = null;
      } else {
        state.customRoute.destination = key;
        state.customRoute.waypoints = state.customRoute.waypoints.filter(k => k !== key);
        if (state.customRoute.origin === key) state.customRoute.origin = null;
      }
    } else if (role === "stop") {
      const idx = state.customRoute.waypoints.indexOf(key);
      if (idx !== -1) {
        state.customRoute.waypoints.splice(idx, 1);
      } else {
        if (state.customRoute.origin === key) state.customRoute.origin = null;
        if (state.customRoute.destination === key) state.customRoute.destination = null;
        state.customRoute.waypoints.push(key);
      }
    }

    refreshAllRouteViews();
    if (focusRoutePanel) {
      const modal = document.getElementById("scMapModal");
      if (modal && modal.classList.contains("split-mode")) {
        applyScMapDisplayMode(false);
      }
      setTimeout(() => {
        const panel = document.getElementById("scMapRoutePanel");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
    return true;
  }

  function moveRouteWaypoint(index, delta) {
    const idx = Number(index);
    const nextIdx = idx + Number(delta);
    const list = state.customRoute.waypoints;
    if (idx < 0 || idx >= list.length || nextIdx < 0 || nextIdx >= list.length) return false;
    const tmp = list[idx];
    list[idx] = list[nextIdx];
    list[nextIdx] = tmp;
    refreshAllRouteViews();
    return true;
  }

  function removeRouteWaypoint(index) {
    const idx = Number(index);
    if (idx < 0 || idx >= state.customRoute.waypoints.length) return false;
    state.customRoute.waypoints.splice(idx, 1);
    refreshAllRouteViews();
    return true;
  }

  function clearCustomRoute() {
    state.customRoute.origin = null;
    state.customRoute.waypoints = [];
    state.customRoute.destination = null;
    refreshAllRouteViews();
    return true;
  }

  function applyItemsAsCustomRoute(itemKeys) {
    const validItems = (itemKeys || []).map(resolveRoutePoint).filter(Boolean);
    if (validItems.length === 0) return false;
    state.customRoute.origin = null;
    if (validItems.length === 1) {
      state.customRoute.waypoints = [];
      state.customRoute.destination = validItems[0].key;
    } else {
      state.customRoute.waypoints = validItems.slice(0, -1).map(it => it.key);
      state.customRoute.destination = validItems[validItems.length - 1].key;
    }
    refreshAllRouteViews();
    const seq = getRouteSequenceItems();
    if (state.leafletMap && typeof window.L !== "undefined" && seq.length >= 2) {
      const bounds = window.L.latLngBounds(seq.map(s => [s.item.lat, s.item.lng]));
      state.leafletMap.stop();
      state.leafletMap.fitBounds(bounds, { animate: false, padding: [50, 50], maxZoom: 15 });
    }
    const modal = document.getElementById("scMapModal");
    if (modal && modal.classList.contains("split-mode")) {
      applyScMapDisplayMode(false);
    }
    return true;
  }

  function renderCustomRouteOnMap() {
    if (!state.leafletMap || typeof window.L === "undefined") return;
    if (!state.leafletCustomRouteLayer) {
      state.leafletCustomRouteLayer = window.L.layerGroup().addTo(state.leafletMap);
    }
    state.leafletCustomRouteLayer.clearLayers();

    const seq = getRouteSequenceItems();
    if (seq.length === 0) return;

    if (seq.length >= 2) {
      const latlngs = seq.map(s => [s.item.lat, s.item.lng]);
      window.L.polyline(latlngs, {
        renderer: state.leafletCanvasRenderer || undefined,
        color: "#052e16",
        weight: 7,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
        smoothFactor: 1.5,
        interactive: false
      }).addTo(state.leafletCustomRouteLayer);

      window.L.polyline(latlngs, {
        renderer: state.leafletCanvasRenderer || undefined,
        color: "#22c55e",
        weight: 4.4,
        opacity: 0.96,
        dashArray: "10, 6",
        lineCap: "round",
        lineJoin: "round",
        smoothFactor: 1.5,
        interactive: false
      }).addTo(state.leafletCustomRouteLayer);
    }

    seq.forEach(step => {
      const cls = step.role === "origin"
        ? "is-origin"
        : (step.role === "destination" ? "is-dest" : "is-stop");
      const badgeIcon = window.L.divIcon({
        className: "gsat-route-badge-wrap",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        html: `<div class="gsat-route-badge ${cls}" title="${escapeHtml(step.item.name)}">${step.label}</div>`
      });
      window.L.marker([step.item.lat, step.item.lng], {
        icon: badgeIcon,
        zIndexOffset: 1500
      }).addTo(state.leafletCustomRouteLayer);
    });
  }

  function renderCustomRoutePanel() {
    const panel = document.getElementById("scMapRoutePanel");
    if (!panel) return;

    const basePts = getRotaPointsForMap("all");
    const extraAiItems = Object.values(state.aiPoiByKey || {});
    const allOptions = [
      ...basePts.map(pt => ({ key: `pt:${pt.num}`, label: `${pt.num}. ${pt.name} (${pt.region})` })),
      ...extraAiItems.map(it => ({ key: it.key, label: `${it.name} (Mapa IA)` }))
    ];

    const originItem = state.customRoute.origin ? resolveRoutePoint(state.customRoute.origin) : null;
    const stopItems = (state.customRoute.waypoints || []).map(resolveRoutePoint).filter(Boolean);
    const destItem = state.customRoute.destination ? resolveRoutePoint(state.customRoute.destination) : null;
    const mapsUrl = buildCustomGoogleMapsDirectionsUrl();
    const totalSelected = (originItem ? 1 : 0) + stopItems.length + (destItem ? 1 : 0);

    panel.innerHTML = `
      <div class="sc-route-header">
        <div class="sc-route-title-wrap">
          <span class="sc-route-title">Minha Rota no Maps</span>
          <span class="sc-route-count-badge">${totalSelected} ponto(s)</span>
        </div>
        ${totalSelected > 0 ? `<button type="button" id="btnClearCustomRoute" class="sc-route-clear-btn">Limpar</button>` : ""}
      </div>
      <p class="sc-route-subtitle">Escolha paradas na ordem desejada e o destino final para abrir o trajeto pronto no Google Maps.</p>

      <div class="sc-route-field">
        <label class="sc-route-label" for="scRouteOriginSelect">Origem (opcional)</label>
        <select id="scRouteOriginSelect" class="sc-route-select">
          <option value="">Minha localização atual (GPS no Google Maps)</option>
          ${allOptions.map(opt => `<option value="${escapeHtml(opt.key)}" ${state.customRoute.origin === opt.key ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}
        </select>
      </div>

      <div class="sc-route-field">
        <span class="sc-route-label">Paradas intermediárias (${stopItems.length})</span>
        <div id="scRouteStopsList" class="sc-route-stops-list">
          ${stopItems.length === 0
            ? `<div class="sc-route-empty">Nenhuma parada adicionada. Use "+ Parada" nos pontos abaixo.</div>`
            : stopItems.map((it, idx) => `
                <div class="sc-route-stop-item">
                  <span class="sc-route-badge-p">P${idx + 1}</span>
                  <span class="sc-route-stop-name" title="${escapeHtml(it.name)}">${escapeHtml(it.num ? `${it.num}. ${it.name}` : it.name)}</span>
                  <span class="sc-route-stop-ctrls">
                    <button type="button" class="sc-route-stop-ctrl" data-move-wp="${idx}" data-move-delta="-1" ${idx === 0 ? "disabled" : ""} title="Subir parada">↑</button>
                    <button type="button" class="sc-route-stop-ctrl" data-move-wp="${idx}" data-move-delta="1" ${idx === stopItems.length - 1 ? "disabled" : ""} title="Descer parada">↓</button>
                    <button type="button" class="sc-route-stop-ctrl" data-remove-wp="${idx}" title="Remover parada">×</button>
                  </span>
                </div>
              `).join("")
          }
        </div>
      </div>

      <div class="sc-route-field">
        <label class="sc-route-label" for="scRouteDestSelect">Destino final</label>
        <select id="scRouteDestSelect" class="sc-route-select">
          <option value="">Selecione o destino final...</option>
          ${allOptions.map(opt => `<option value="${escapeHtml(opt.key)}" ${state.customRoute.destination === opt.key ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}
        </select>
      </div>

      <div class="sc-route-footer">
        <a id="btnOpenCustomRouteMaps"
          href="${mapsUrl || "#"}"
          ${mapsUrl ? `target="_blank" rel="noopener noreferrer"` : ""}
          class="sc-route-gmaps-btn ${mapsUrl ? "" : "is-disabled"}">
          Abrir Rota no Google Maps
        </a>
        ${!destItem && stopItems.length > 0 ? `<div class="sc-route-subtitle">Sem destino explícito: a última parada será usada como destino no Maps.</div>` : ""}
      </div>
    `;

    const clearBtn = document.getElementById("btnClearCustomRoute");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => clearCustomRoute());
    }
    const originSel = document.getElementById("scRouteOriginSelect");
    if (originSel) {
      originSel.addEventListener("change", () => {
        const val = originSel.value || null;
        state.customRoute.origin = val;
        if (val) {
          state.customRoute.waypoints = state.customRoute.waypoints.filter(k => k !== val);
          if (state.customRoute.destination === val) state.customRoute.destination = null;
        }
        refreshAllRouteViews();
      });
    }
    const destSel = document.getElementById("scRouteDestSelect");
    if (destSel) {
      destSel.addEventListener("change", () => {
        const val = destSel.value || null;
        state.customRoute.destination = val;
        if (val) {
          state.customRoute.waypoints = state.customRoute.waypoints.filter(k => k !== val);
          if (state.customRoute.origin === val) state.customRoute.origin = null;
        }
        refreshAllRouteViews();
      });
    }
    panel.querySelectorAll("[data-move-wp]").forEach(btn => {
      btn.addEventListener("click", () => {
        moveRouteWaypoint(Number(btn.getAttribute("data-move-wp")), Number(btn.getAttribute("data-move-delta")));
      });
    });
    panel.querySelectorAll("[data-remove-wp]").forEach(btn => {
      btn.addEventListener("click", () => {
        removeRouteWaypoint(Number(btn.getAttribute("data-remove-wp")));
      });
    });
  }

  // ===========================================================================
  // BUSCA IA NO MAPA (SEMÂNTICA PT-BR + TRILHAS + OVERPASS OSM AO VIVO)
  // ===========================================================================
  const AI_STOPWORDS = new Set([
    "quero", "queria", "preciso", "gostaria", "busco", "buscar", "procurar", "procura",
    "encontrar", "onde", "tem", "algum", "alguma", "uma", "uns", "umas", "para", "pra",
    "com", "sem", "fazer", "ir", "ver", "aqui", "perto", "mapa", "regiao", "rota", "ponto",
    "pontos", "lugar", "lugares", "local", "locais", "tal", "coisa", "algo", "bom", "boa",
    "melhor", "no", "na", "nos", "nas", "em", "de", "do", "da", "dos", "das", "por", "um"
  ]);

  const AI_INTENT_CLUSTERS = {
    lunch_food: {
      label: "Almoço e gastronomia típica",
      keywords: [
        "almoco", "almocar", "almoçar", "jantar", "janta", "comer", "comida", "refeicao",
        "restaurante", "prato", "tipica", "alema", "caseira", "buffet", "marreco",
        "eisbein", "spatzle", "churrasco", "petisco", "porcao", "bier", "cervejaria",
        "lanche", "fome", "culinaria", "gastronomia"
      ],
      pointCategories: ["gastronomia"],
      textBoosts: ["restaurante", "gastronomia", "alema", "tipica", "refeicao", "almoco", "cervejaria", "bier", "truffa", "schroeder"]
    },
    cafe_bakery: {
      label: "Café colonial, cucas e compras artesanais",
      keywords: [
        "cafe", "colonial", "cuca", "torta", "bolo", "doce", "sobremesa", "chocolate",
        "nugali", "artesanal", "pao", "paes", "geleia", "queijo", "mel", "produto",
        "embutido", "compras", "confeitaria", "padaria", "sorvete"
      ],
      pointCategories: ["gastronomia", "compras"],
      textBoosts: ["cafe", "colonial", "cuca", "chocolate", "queijo", "mel", "artesanal", "geleia", "produto"]
    },
    trail_nature: {
      label: "Trilhas, caminhadas e natureza ao ar livre",
      keywords: [
        "trilha", "trilhas", "caminhada", "caminhar", "trekking", "hiking", "bike",
        "cicloturismo", "bicicleta", "pedal", "pedalar", "natureza", "mata", "floresta",
        "morro", "montanha", "mirante", "cachoeira", "rio", "parque", "passeio", "verde",
        "ar livre", "eco", "tifa", "jeep", "aventura"
      ],
      pointCategories: ["atrativos"],
      textBoosts: ["trilha", "natureza", "mirante", "montanha", "parque", "tifa", "passeio", "cachoeira", "jeep", "berghaus", "ciclo"]
    },
    lodging: {
      label: "Pousadas e hospedagem no vale",
      keywords: [
        "pousada", "pousadas", "hotel", "chale", "hospedagem", "dormir", "ficar",
        "pernoite", "hospedar", "acomodacao", "cabana"
      ],
      pointCategories: ["hospedagem"],
      textBoosts: ["pousada", "hospedagem", "chale", "suite", "dormir", "refugio"]
    },
    heritage_culture: {
      label: "Patrimônio cultural, enxaimel e pontos históricos",
      keywords: [
        "museu", "igreja", "patrimonio", "tombado", "enxaimel", "casa rux", "historia",
        "historico", "cultura", "clube", "sociedade", "tiro", "atrativo", "360", "drone"
      ],
      pointCategories: ["atrativos"],
      textBoosts: ["enxaimel", "tombado", "igreja", "museu", "casa rux", "sociedade", "histor"]
    }
  };

  function parseAiSearchQuery(rawQuery) {
    const cleanRaw = String(rawQuery || "").trim();
    const norm = normalizeGeoText(cleanRaw);
    const rawTokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
    const meaningfulTokens = rawTokens.filter(t => t.length >= 2 && !AI_STOPWORDS.has(t));

    const intents = {};
    Object.entries(AI_INTENT_CLUSTERS).forEach(([intentKey, cfg]) => {
      const hit = cfg.keywords.some(kw => norm.includes(normalizeGeoText(kw)));
      if (hit) intents[intentKey] = true;
    });

    let regionHint = null;
    if (norm.includes("rio da luz") || norm.includes("jaragua")) regionHint = "rio_da_luz";
    if (norm.includes("testo alto") || norm.includes("pomerode")) {
      regionHint = regionHint ? null : "testo_alto";
    }

    return {
      raw: cleanRaw,
      norm,
      tokens: meaningfulTokens,
      intents,
      regionHint
    };
  }

  function scoreLocalPointsForAi(parsed) {
    const pts = getRotaPointsForMap("all");
    const activeIntentKeys = Object.keys(parsed.intents);
    const scored = [];

    pts.forEach(pt => {
      const haystack = normalizeGeoText([
        pt.name,
        pt.category,
        pt.region,
        pt.description,
        pt.atendimento,
        pt.endereco
      ].join(" "));

      let score = 0;
      const reasons = [];

      activeIntentKeys.forEach(intentKey => {
        const cfg = AI_INTENT_CLUSTERS[intentKey];
        if (cfg.pointCategories.includes(pt.category)) {
          score += 5;
          reasons.push(cfg.label);
        }
        cfg.textBoosts.forEach(kw => {
          if (haystack.includes(kw)) score += 3.5;
        });
      });

      if (parsed.intents.lunch_food && pt.category === "gastronomia") {
        score += 4;
      }
      if (parsed.intents.trail_nature && normalizeGeoText(pt.name).includes("trilha")) {
        score += 12;
        reasons.push("Trilha dedicada no mapa");
      }

      parsed.tokens.forEach(tok => {
        if (normalizeGeoText(pt.name).includes(tok)) {
          score += 9;
          reasons.push(`Nome coincide com "${tok}"`);
        } else if (haystack.includes(tok)) {
          score += 4;
        }
      });

      if (parsed.regionHint && pt.regionKey === parsed.regionHint) {
        score += 5;
      }

      if (score >= 4) {
        scored.push({
          key: `pt:${pt.num}`,
          num: pt.num,
          name: pt.name,
          category: pt.category,
          region: pt.region,
          endereco: pt.endereco || pt.region,
          description: pt.description || "",
          atendimento: pt.atendimento || "",
          lat: pt.lat,
          lng: pt.lng,
          source: "Rota Lumiar",
          isOsm: false,
          score,
          reasons: Array.from(new Set(reasons))
        });
      }
    });

    scored.sort((a, b) => b.score - a.score || a.num - b.num);
    return scored.slice(0, 10);
  }

  function scoreLocalTrailsForAi(parsed) {
    const trails = [];
    const wantTrail = Boolean(parsed.intents.trail_nature) || parsed.tokens.some(t => ["trilha", "tifa", "estrada", "morro", "serra", "mirante"].includes(t));
    if (!wantTrail) return trails;

    const pts = getRotaPointsForMap("all");
    const trilhaPt = pts.find(p => normalizeGeoText(p.name).includes("trilha"));
    const trilhaNum = trilhaPt ? Number(trilhaPt.num) : 16;
    if (Array.isArray(window.ROTA_LUMIAR_ROAD_LEGS) && (!parsed.regionHint || parsed.regionHint === "testo_alto")) {
      const trilhaLegs = window.ROTA_LUMIAR_ROAD_LEGS.filter(l => Number(l.from) === trilhaNum || Number(l.to) === trilhaNum);
      trilhaLegs.forEach((leg, i) => {
        if (!Array.isArray(leg.coords) || leg.coords.length < 2) return;
        trails.push({
          id: `local_leg_${leg.from}_${leg.to}_${i}`,
          name: `Acesso ${trilhaPt ? trilhaPt.name : "Trilha da Natureza"} (Trecho ${leg.from} - ${leg.to})`,
          region: "Testo Alto — Pomerode",
          coords: leg.coords,
          source: "Rota Lumiar"
        });
      });
    }

    if (!parsed.regionHint || parsed.regionHint === "rio_da_luz") {
      const extras = getMergedExtraStreets();
      const matched = [];
      extras.forEach((st, idx) => {
        const normName = normalizeGeoText(st.name);
        const isUnpaved = isUnpavedTrailName(st.name);
        const isTifa = normName.includes("tifa") || normName.includes("trilha") || normName.includes("serra");
        const tokenHit = parsed.tokens.some(t => t.length >= 3 && normName.includes(t));
        if (isUnpaved || isTifa || tokenHit) {
          matched.push({
            id: `local_trail_${idx}`,
            name: st.name || "Trilha / Estrada Rural",
            region: trilhaPt ? "Vale do Rio da Luz (Estrada Rural / Tifa)" : "Vale do Rio da Luz",
            coords: st.coords,
            source: "Mapa Rio da Luz",
            priority: isUnpaved ? 2 : 1
          });
        }
      });
      matched.sort((a, b) => b.priority - a.priority);
      matched.slice(0, 7).forEach(m => trails.push(m));
    }

    return trails;
  }

  function queryOverpassForAi(parsed, reqId) {
    if (typeof window.fetch !== "function") return;
    const bbox = "-26.750,-49.245,-26.515,-49.120";
    const clauses = [];

    if (parsed.intents.lunch_food) {
      clauses.push(`nwr["amenity"~"restaurant|fast_food|food_court|biergarten"](${bbox});`);
    }
    if (parsed.intents.cafe_bakery) {
      clauses.push(`nwr["amenity"~"cafe|bakery|ice_cream"](${bbox});`);
      clauses.push(`nwr["shop"~"chocolate|confectionery|bakery|farm"](${bbox});`);
    }
    if (parsed.intents.lodging) {
      clauses.push(`nwr["tourism"~"guest_house|hotel|chalet|hostel|camp_site"](${bbox});`);
    }
    if (parsed.intents.heritage_culture) {
      clauses.push(`nwr["tourism"~"museum|attraction|artwork|viewpoint"](${bbox});`);
      clauses.push(`nwr["amenity"="place_of_worship"](${bbox});`);
    }

    let queryTrails = false;
    if (parsed.intents.trail_nature) {
      queryTrails = true;
      clauses.push(`nwr["tourism"~"viewpoint|picnic_site|park"](${bbox});`);
      clauses.push(`way["highway"~"path|track|footway|cycleway|bridleway"]["name"](${bbox});`);
      clauses.push(`way["highway"~"path|track"](${bbox});`);
    }

    if (clauses.length === 0 && parsed.tokens.length > 0) {
      const safeToken = parsed.tokens[0].replace(/[^a-z0-9]/g, "");
      if (safeToken.length >= 3) {
        clauses.push(`nwr["name"~"${safeToken}",i](${bbox});`);
      }
    }
    if (clauses.length === 0) return;

    const ql = `[out:json][timeout:4];(${clauses.join("")});${queryTrails ? "out geom 24;" : "out center 18;"}`;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 3800) : null;

    window.fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(ql)}`,
      signal: controller ? controller.signal : undefined
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (timer) clearTimeout(timer);
        if (!state.aiSearch.active || state.aiSearch.reqId !== reqId) return;
        state.aiSearch.loadingOsm = false;
        if (!data || !Array.isArray(data.elements)) {
          renderAiResultsBox();
          return;
        }

        const existingPts = getRotaPointsForMap("all");
        const osmResults = [];
        const osmTrails = [];
        const seenNames = new Set(state.aiSearch.results.map(r => normalizeGeoText(r.name)));

        data.elements.forEach(el => {
          const tags = el.tags || {};
          const isTrailWay = el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 2 && /^(path|track|footway|cycleway|bridleway)$/.test(tags.highway || "");
          if (isTrailWay) {
            const coords = el.geometry.map(g => [g.lat, g.lon]);
            const tName = tags.name || `Trilha / Caminho Rural (OSM #${el.id})`;
            osmTrails.push({
              id: `osm_way_${el.id}`,
              name: tName,
              region: tags.surface ? `OpenStreetMap (${tags.surface})` : "OpenStreetMap (Trilha/Caminho)",
              coords,
              source: "OSM Ao Vivo"
            });
            return;
          }

          const lat = typeof el.lat === "number" ? el.lat : (el.center && el.center.lat);
          const lng = typeof el.lon === "number" ? el.lon : (el.center && el.center.lon);
          if (typeof lat !== "number" || typeof lng !== "number" || !tags.name) return;

          const normName = normalizeGeoText(tags.name);
          if (seenNames.has(normName)) return;
          const dupExisting = existingPts.some(p => Math.hypot(p.lat - lat, p.lng - lng) < 0.0007);
          if (dupExisting) return;

          seenNames.add(normName);
          const poiKey = `osm:${el.type}_${el.id}`;
          const poiObj = {
            key: poiKey,
            num: null,
            name: tags.name,
            category: tags.amenity || tags.tourism || tags.shop || "local",
            region: tags["addr:suburb"] || tags["addr:city"] || "Rio da Luz / Testo Alto",
            endereco: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ") || "Mapa OpenStreetMap",
            description: tags.cuisine ? `Especialidade: ${tags.cuisine}` : (tags.description || "Local encontrado ao vivo no OpenStreetMap."),
            lat,
            lng,
            source: "OSM Ao Vivo",
            isOsm: true
          };
          state.aiPoiByKey[poiKey] = poiObj;
          osmResults.push(poiObj);
        });

        if (osmResults.length > 0) {
          state.aiSearch.results = [...state.aiSearch.results, ...osmResults.slice(0, 6)];
        }
        if (osmTrails.length > 0) {
          state.aiSearch.trails = [...state.aiSearch.trails, ...osmTrails.slice(0, 8)];
        }
        state.aiSearch.answer = buildAiSummaryText(parsed, state.aiSearch.results, state.aiSearch.trails, osmResults.length + osmTrails.length > 0);
        renderAiResultsBox();
        renderAiResultsOnMap(state.aiSearch.results.length + state.aiSearch.trails.length === 0 ? false : false);
        updateAiSplitBanner();
      })
      .catch(() => {
        if (timer) clearTimeout(timer);
        if (!state.aiSearch.active || state.aiSearch.reqId !== reqId) return;
        state.aiSearch.loadingOsm = false;
        renderAiResultsBox();
      });
  }

  function buildAiSummaryText(parsed, results, trails, hasOsm) {
    const intentLabels = Object.keys(parsed.intents).map(k => AI_INTENT_CLUSTERS[k].label);
    const topic = intentLabels.length > 0 ? intentLabels.join(" + ") : `busca "${parsed.raw}"`;
    const osmNote = hasOsm ? " (incluindo locais/trilhas ao vivo do OpenStreetMap)" : "";
    if (results.length === 0 && trails.length === 0) {
      return `Nenhum ponto exato foi encontrado para "${parsed.raw}". Experimente termos como "quero almoçar", "fazer trilha", "café colonial" ou "mirante".`;
    }
    return `IA no Mapa (${topic}): destaquei ${results.length} local(is)${trails.length > 0 ? ` e ${trails.length} trilha(s)` : ""} no Google Satélite${osmNote}.`;
  }

  function updateAiSplitBanner() {
    const banner = document.getElementById("scMapAiSplitBanner");
    const textEl = document.getElementById("scMapAiSplitBannerText");
    if (!banner || !textEl) return;
    if (!state.aiSearch.active) {
      banner.hidden = true;
      textEl.textContent = "";
      return;
    }
    banner.hidden = false;
    textEl.textContent = state.aiSearch.answer;
  }

  function focusAiResultOnMap(keyOrCoords) {
    if (!state.leafletMap || typeof window.L === "undefined") return;
    const item = resolveRoutePoint(keyOrCoords);
    if (!item) return;
    state.leafletMap.stop();
    state.leafletMap.setView([item.lat, item.lng], 16, { animate: false });
    if (item.num && state.leafletMarkers && state.leafletMarkers[item.num]) {
      setTimeout(() => state.leafletMarkers[item.num].openPopup(), 90);
    }
  }

  function renderAiResultsOnMap(fitToResults) {
    if (!state.leafletMap || typeof window.L === "undefined") return;
    if (!state.leafletAiLayer) {
      state.leafletAiLayer = window.L.layerGroup().addTo(state.leafletMap);
    }
    state.leafletAiLayer.clearLayers();
    if (!state.aiSearch.active) return;

    const boundsPts = [];

    (state.aiSearch.trails || []).forEach(tr => {
      if (!Array.isArray(tr.coords) || tr.coords.length < 2) return;
      tr.coords.forEach(c => boundsPts.push(c));

      window.L.polyline(tr.coords, {
        renderer: state.leafletCanvasRenderer || undefined,
        color: "#064e3b",
        weight: 7,
        opacity: 0.88,
        lineCap: "round",
        lineJoin: "round",
        smoothFactor: 1.5,
        interactive: false
      }).addTo(state.leafletAiLayer);

      const trailLine = window.L.polyline(tr.coords, {
        renderer: state.leafletCanvasRenderer || undefined,
        color: "#22d3ee",
        weight: 4.2,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
        smoothFactor: 1.5,
        interactive: true
      }).addTo(state.leafletAiLayer);

      trailLine.bindPopup(`
        <div style="min-width:190px;font-family:Inter,sans-serif;color:#0f172a;">
          <div style="font-size:10px;font-weight:800;color:#0369a1;text-transform:uppercase;">${escapeHtml(tr.source)}</div>
          <strong style="font-size:13px;display:block;margin:2px 0;">${escapeHtml(tr.name)}</strong>
          <div style="font-size:11px;color:#475569;">${escapeHtml(tr.region || "")}</div>
        </div>
      `);
    });

    (state.aiSearch.results || []).forEach((item, idx) => {
      boundsPts.push([item.lat, item.lng]);
      const aiIcon = window.L.divIcon({
        className: "gsat-ai-pin-wrap",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        html: `<div class="gsat-ai-pin" title="${escapeHtml(item.name)}">IA${idx + 1}</div>`
      });
      const marker = window.L.marker([item.lat, item.lng], {
        icon: aiIcon,
        zIndexOffset: 1200
      }).addTo(state.leafletAiLayer);

      const safeKey = escapeHtml(item.key);
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`;
      marker.bindPopup(`
        <div style="min-width:215px;font-family:Inter,sans-serif;color:#0f172a;">
          <div style="font-size:10px;font-weight:800;color:#0284c7;text-transform:uppercase;">Resultado IA #${idx + 1} • ${escapeHtml(item.source)}</div>
          <strong style="font-size:13.5px;display:block;margin:2px 0 4px 0;">${escapeHtml(item.num ? `${item.num}. ${item.name}` : item.name)}</strong>
          <div style="font-size:11px;color:#475569;margin-bottom:5px;">${escapeHtml(item.endereco || item.region)}</div>
          ${item.description ? `<p style="font-size:11px;color:#334155;margin:0 0 7px 0;line-height:1.35;">${escapeHtml(item.description)}</p>` : ""}
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button type="button" onclick="window.GeoSC360.setRoutePointRole('${safeKey}', 'stop')"
              style="padding:5px 8px;background:#ea580c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">+ Parada</button>
            <button type="button" onclick="window.GeoSC360.setRoutePointRole('${safeKey}', 'destination')"
              style="padding:5px 8px;background:#dc2626;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">Destino</button>
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
              style="padding:5px 8px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">Maps ↗</a>
          </div>
        </div>
      `);
    });

    if (fitToResults && boundsPts.length > 0) {
      const bounds = window.L.latLngBounds(boundsPts);
      state.leafletMap.stop();
      state.leafletMap.invalidateSize({ animate: false, pan: false });
      state.leafletMap.fitBounds(bounds, { animate: false, padding: [52, 52], maxZoom: 15 });
    }
  }

  function renderAiResultsBox() {
    const box = document.getElementById("scMapAiResultsBox");
    if (!box) return;
    if (!state.aiSearch.active) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    const { results, trails, answer, loadingOsm } = state.aiSearch;
    const routeKeys = results.slice(0, 5).map(r => r.key);

    box.innerHTML = `
      <div class="sc-ai-answer-header">
        <span class="sc-ai-answer-title">Busca IA no Mapa</span>
        <span class="sc-ai-answer-badge">${loadingOsm ? "Buscando OSM..." : `${results.length} locais`}</span>
      </div>
      <p class="sc-ai-answer-text">${escapeHtml(answer)}</p>
      ${trails.length > 0 ? `
        <div class="sc-ai-trail-list">
          ${trails.slice(0, 6).map(t => `<span class="sc-ai-trail-chip">${escapeHtml(t.name)}</span>`).join("")}
        </div>
      ` : ""}
      ${routeKeys.length > 0 ? `
        <div class="sc-ai-answer-actions">
          <button type="button" id="btnAiApplyAllRoute" class="sc-ai-apply-route-btn">Montar Rota com Resultados</button>
        </div>
      ` : ""}
      <div class="sc-ai-results-list">
        ${results.slice(0, 7).map((item, idx) => {
          const flags = getPointRouteRoleFlags(item.key);
          return `
            <div class="sc-ai-result-card">
              <div class="sc-ai-result-top">
                <span class="sc-ai-result-title">${idx + 1}. ${escapeHtml(item.num ? `${item.num}. ${item.name}` : item.name)}</span>
                <span class="sc-ai-source-tag ${item.isOsm ? "is-osm" : ""}">${escapeHtml(item.source)}</span>
              </div>
              <div class="sc-ai-result-meta">${escapeHtml(item.endereco || item.region)}</div>
              ${item.description ? `<p class="sc-ai-result-desc">${escapeHtml(item.description.slice(0, 120))}${item.description.length > 120 ? "..." : ""}</p>` : ""}
              <div class="sc-ai-result-actions">
                <button type="button" class="sc-pt-act-btn" data-ai-focus="${escapeHtml(item.key)}">Ver no Mapa</button>
                <button type="button" class="sc-pt-act-btn ${flags.isStop ? "is-active" : ""}" data-route-role="stop" data-route-key="${escapeHtml(item.key)}">${flags.isStop ? `Parada ${flags.stopIndex + 1}` : "+ Parada"}</button>
                <button type="button" class="sc-pt-act-btn is-dest ${flags.isDest ? "is-active" : ""}" data-route-role="destination" data-route-key="${escapeHtml(item.key)}">${flags.isDest ? "Destino ✓" : "Destino"}</button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    const applyBtn = document.getElementById("btnAiApplyAllRoute");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        applyItemsAsCustomRoute(routeKeys);
      });
    }
    box.querySelectorAll("[data-ai-focus]").forEach(btn => {
      btn.addEventListener("click", () => {
        focusAiResultOnMap(btn.getAttribute("data-ai-focus"));
      });
    });
    box.querySelectorAll("[data-route-role]").forEach(btn => {
      btn.addEventListener("click", () => {
        setRoutePointRole(btn.getAttribute("data-route-key"), btn.getAttribute("data-route-role"));
      });
    });
  }

  function runMapAiSearch(queryText) {
    const clean = String(queryText || "").trim();
    const input = document.getElementById("scMapAiSearchInput");
    if (input) input.value = clean;
    if (!clean) {
      clearMapAiSearch();
      return null;
    }

    const parsed = parseAiSearchQuery(clean);
    const localPts = scoreLocalPointsForAi(parsed);
    const localTrails = scoreLocalTrailsForAi(parsed);
    const reqId = (state.aiSearch.reqId || 0) + 1;

    state.aiSearch = {
      active: true,
      query: clean,
      answer: buildAiSummaryText(parsed, localPts, localTrails, false),
      results: localPts,
      trails: localTrails,
      loadingOsm: true,
      reqId
    };

    const clearBtn = document.getElementById("btnScMapAiClear");
    if (clearBtn) clearBtn.hidden = false;

    document.querySelectorAll("#scMapAiQuickChips [data-ai-query]").forEach(btn => {
      const q = normalizeGeoText(btn.getAttribute("data-ai-query"));
      btn.classList.toggle("active", q === parsed.norm);
    });

    if (activeScMapFilter === "pano360" && (localPts.some(p => p.num > 2) || localTrails.length > 0)) {
      state.skipNextMapFitBounds = true;
      renderFilteredSatelliteMarkers("all");
    }

    renderAiResultsBox();
    renderAiResultsOnMap(true);
    updateAiSplitBanner();
    queryOverpassForAi(parsed, reqId);
    return state.aiSearch;
  }

  function clearMapAiSearch() {
    state.aiSearch = {
      active: false,
      query: "",
      answer: "",
      results: [],
      trails: [],
      loadingOsm: false,
      reqId: (state.aiSearch.reqId || 0) + 1
    };
    const input = document.getElementById("scMapAiSearchInput");
    if (input) input.value = "";
    const clearBtn = document.getElementById("btnScMapAiClear");
    if (clearBtn) clearBtn.hidden = true;
    document.querySelectorAll("#scMapAiQuickChips .sc-ai-chip").forEach(btn => btn.classList.remove("active"));
    renderAiResultsBox();
    renderAiResultsOnMap(false);
    updateAiSplitBanner();
    return true;
  }

  function buildRotaPointGooglePopupHTML(pt) {
    const linkedScene = pt.sceneId && window.TOUR_SC_DATA && window.TOUR_SC_DATA.scenes
      ? window.TOUR_SC_DATA.scenes[pt.sceneId]
      : null;
    const lat = pt.lat;
    const lng = pt.lng;
    const gmapsUrl = (linkedScene && linkedScene.googleMapsUrl)
      || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    const gdirUrl = (linkedScene && linkedScene.googleDirectionsUrl)
      || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const photoUrl = linkedScene ? (linkedScene.staticPhoto || linkedScene.thumbPhoto) : "";
    const svAllowed = isPointStreetViewAvailable(pt);
    const key = `pt:${pt.num}`;
    const flags = getPointRouteRoleFlags(key);

    return `
      <div style="min-width:240px;max-width:278px;font-family:Inter,sans-serif;color:#0f172a;">
        ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(pt.name)}" style="width:100%;height:88px;object-fit:cover;border-radius:6px;margin-bottom:7px;display:block;" />` : ""}
        <div style="font-size:10.5px;font-weight:800;color:#15803d;text-transform:uppercase;margin-bottom:2px;">Ponto ${pt.num} • ${escapeHtml(pt.region)}</div>
        <strong style="font-size:14px;color:#0f172a;display:block;line-height:1.25;">${pt.num}. ${escapeHtml(pt.name)}</strong>
        ${pt.description ? `<p style="font-size:11.5px;color:#334155;margin:5px 0;line-height:1.35;">${escapeHtml(pt.description)}</p>` : ""}
        ${pt.endereco ? `<div style="font-size:11px;color:#475569;margin:2px 0;"><strong>Endereço:</strong> ${escapeHtml(pt.endereco)}</div>` : ""}
        ${pt.atendimento ? `<div style="font-size:11px;color:#475569;margin:2px 0;"><strong>Horário:</strong> ${escapeHtml(pt.atendimento)}</div>` : ""}
        ${pt.telefone ? `<div style="font-size:11px;color:#475569;margin:2px 0;"><strong>Tel.:</strong> ${escapeHtml(pt.telefone)}</div>` : ""}
        <div style="font-size:10.5px;color:#64748b;font-family:monospace;margin-top:3px;">GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        <div style="display:flex;gap:5px;margin-top:8px;">
          <button type="button" onclick="window.GeoSC360.setRoutePointRole('${key}', 'origin')"
            style="flex:1;padding:6px 6px;background:${flags.isOrigin ? "#2563eb" : "#334155"};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">
            ${flags.isOrigin ? "Origem ✓" : "Origem"}
          </button>
          <button type="button" onclick="window.GeoSC360.setRoutePointRole('${key}', 'stop')"
            style="flex:1;padding:6px 6px;background:${flags.isStop ? "#ea580c" : "#334155"};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">
            ${flags.isStop ? `Parada ${flags.stopIndex + 1}` : "+ Parada"}
          </button>
          <button type="button" onclick="window.GeoSC360.setRoutePointRole('${key}', 'destination')"
            style="flex:1;padding:6px 6px;background:${flags.isDest ? "#dc2626" : "#334155"};color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">
            ${flags.isDest ? "Destino ✓" : "Destino"}
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-top:7px;">
          ${svAllowed ? `
            <button type="button" onclick="window.GeoSC360.openPointInSatelliteStreetView(${pt.num})"
              style="width:100%;padding:7px 10px;background:#d97706;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11.5px;font-weight:800;">
              Street View (Rio da Luz)
            </button>
          ` : `<div style="font-size:11px;color:#64748b;font-weight:600;padding:3px 2px;">Street View não disponível.</div>`}
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
            style="display:block;text-align:center;padding:7px 10px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-size:11.5px;font-weight:800;">
            Ir para o Google Maps ↗
          </a>
          <a href="${gdirUrl}" target="_blank" rel="noopener noreferrer"
            style="display:block;text-align:center;padding:6px 10px;background:#0f766e;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">
            Traçar Rota Direta até Aqui ↗
          </a>
          ${pt.sceneId ? `
            <button type="button" onclick="window.GeoSC360.goToScene('${pt.sceneId}', true, true)"
              style="width:100%;padding:6px 10px;background:#15803d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11.5px;font-weight:800;">
              Ver Panorama 360° Aqui
            </button>
          ` : ""}
        </div>
      </div>
    `;
  }

  function renderMapSidebar(pts, selectedNum) {
    const sidebar = document.getElementById("scMapPointsSidebar");
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div id="scMapAiResultsBox" class="sc-ai-results-box" hidden></div>
      <div id="scMapRoutePanel" class="sc-route-panel"></div>
      <div class="sc-sidebar-header">Pontos no Satélite (${pts.length}) • Clique para focar</div>
      ${pts.map(pt => {
        const numClass = pt.sceneId ? "is-360" : `cat-${pt.category || "atrativos"}`;
        const activeClass = pt.num === selectedNum ? "active" : "";
        const key = `pt:${pt.num}`;
        const flags = getPointRouteRoleFlags(key);
        const svAllowed = isPointStreetViewAvailable(pt);
        return `
          <div class="sc-sidebar-card ${activeClass}" data-map-pt-num="${pt.num}">
            <button type="button" class="sc-sidebar-item ${activeClass}" data-focus-pt-num="${pt.num}">
              <span class="sc-sidebar-num ${numClass}">${pt.num}</span>
              <span class="sc-sidebar-info">
                <strong class="sc-sidebar-name">${escapeHtml(pt.name)}${pt.sceneId ? `<span class="sc-tag-360">360°</span>` : ""}</strong>
                <span class="sc-sidebar-sub">${escapeHtml(pt.endereco || pt.region)}</span>
              </span>
            </button>
            <div class="sc-sidebar-actions">
              <button type="button" class="sc-pt-act-btn is-origin ${flags.isOrigin ? "is-active" : ""}" data-route-role="origin" data-route-key="${key}">${flags.isOrigin ? "Origem ✓" : "Origem"}</button>
              <button type="button" class="sc-pt-act-btn ${flags.isStop ? "is-active" : ""}" data-route-role="stop" data-route-key="${key}">${flags.isStop ? `Parada ${flags.stopIndex + 1}` : "+ Parada"}</button>
              <button type="button" class="sc-pt-act-btn is-dest ${flags.isDest ? "is-active" : ""}" data-route-role="destination" data-route-key="${key}">${flags.isDest ? "Destino ✓" : "Destino"}</button>
              ${svAllowed
                ? `<button type="button" class="sc-pt-act-btn is-sv" data-sv-pt-num="${pt.num}">Street View</button>`
                : `<span class="sc-sv-unavailable-note">Street View não disponível.</span>`
              }
            </div>
          </div>
        `;
      }).join("")}
    `;

    renderAiResultsBox();
    renderCustomRoutePanel();

    sidebar.querySelectorAll("[data-focus-pt-num]").forEach(btn => {
      btn.addEventListener("click", () => {
        const num = Number(btn.getAttribute("data-focus-pt-num"));
        const pt = pts.find(p => p.num === num);
        if (!pt) return;
        sidebar.querySelectorAll(".sc-sidebar-card, .sc-sidebar-item").forEach(el => el.classList.remove("active"));
        btn.classList.add("active");
        const card = btn.closest(".sc-sidebar-card");
        if (card) card.classList.add("active");

        const marker = state.leafletMarkers && state.leafletMarkers[num];
        if (state.leafletMap && marker) {
          state.leafletMap.stop();
          state.leafletMap.setView([pt.lat, pt.lng], pt.sceneId ? 17 : 16, { animate: false });
          setTimeout(() => marker.openPopup(), 80);
        }
      });
    });

    sidebar.querySelectorAll("[data-route-role]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const key = btn.getAttribute("data-route-key");
        const role = btn.getAttribute("data-route-role");
        setRoutePointRole(key, role);
      });
    });

    sidebar.querySelectorAll("[data-sv-pt-num]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openPointInSatelliteStreetView(Number(btn.getAttribute("data-sv-pt-num")));
      });
    });
  }

  function computeVisionConeLatLngs(lat, lng, headingDeg, fovDeg, radiusMeters) {
    const earthRadius = 6378137;
    const latRad = lat * DEG2RAD;
    const cosLat = Math.max(0.2, Math.cos(latRad));
    const halfSpread = Math.max(18, Math.min(62, fovDeg * 0.5));
    const steps = 18;
    const vertices = [[lat, lng]];

    for (let i = 0; i <= steps; i++) {
      const angleDeg = (headingDeg - halfSpread) + ((halfSpread * 2) * i) / steps;
      const angleRad = angleDeg * DEG2RAD;
      const dLat = (radiusMeters * Math.cos(angleRad)) / earthRadius;
      const dLng = (radiusMeters * Math.sin(angleRad)) / (earthRadius * cosLat);
      vertices.push([
        lat + dLat * RAD2DEG,
        lng + dLng * RAD2DEG
      ]);
    }
    vertices.push([lat, lng]);
    return vertices;
  }

  function updateLiveSatelliteRadar(forceUpdate) {
    const modal = document.getElementById("scMapModal");
    if (!modal || !modal.classList.contains("open") || !state.leafletMap || typeof window.L === "undefined") {
      return;
    }

    const scene = window.TOUR_SC_DATA && window.TOUR_SC_DATA.scenes
      ? window.TOUR_SC_DATA.scenes[state.currentSceneId]
      : null;
    if (!scene || !scene.coordinates) return;

    const mapZoom = state.leafletMap.getZoom() || 15;
    const radarKey = `${scene.id}|${state.yaw.toFixed(1)}|${state.hfov.toFixed(1)}|${mapZoom}`;
    if (!forceUpdate && radarKey === lastRadarKey) return;
    lastRadarKey = radarKey;

    if (!state.leafletRadarLayer) {
      state.leafletRadarLayer = window.L.layerGroup().addTo(state.leafletMap);
    }

    const { lat, lng } = scene.coordinates;
    const headingDeg = (scene.headingOffsetDeg || 0) + state.yaw;
    const radiusMeters = Math.max(85, Math.min(5500, 220 * Math.pow(2, 16 - mapZoom)));
    const coneCoords = computeVisionConeLatLngs(lat, lng, headingDeg, state.hfov, radiusMeters);

    if (!state.leafletFovPolygon) {
      state.leafletFovPolygon = window.L.polygon(coneCoords, {
        renderer: state.leafletCanvasRenderer || undefined,
        color: "#fde047",
        weight: 1.6,
        opacity: 0.82,
        fillColor: "#ffffff",
        fillOpacity: 0.42,
        interactive: false
      }).addTo(state.leafletRadarLayer);
    } else {
      state.leafletFovPolygon.setLatLngs(coneCoords);
    }

    if (!state.leafletAnchorMarker) {
      const anchorIcon = window.L.divIcon({
        className: "gsat-pin-wrapper",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: `<div class="gsat-radar-anchor" title="Sua câmera 360° atual"></div>`
      });
      state.leafletAnchorMarker = window.L.marker([lat, lng], {
        icon: anchorIcon,
        interactive: false,
        zIndexOffset: 1000
      }).addTo(state.leafletRadarLayer);
    } else {
      state.leafletAnchorMarker.setLatLng([lat, lng]);
    }
  }

  function syncSatelliteMapToCurrentScene(scene) {
    lastRadarKey = "";
    const modal = document.getElementById("scMapModal");
    if (!modal || !modal.classList.contains("open") || !state.leafletMap || !scene || !scene.coordinates) {
      return;
    }
    state.leafletMap.panTo([scene.coordinates.lat, scene.coordinates.lng], { animate: false });
    updateLiveSatelliteRadar(true);
  }

  function renderFilteredSatelliteMarkers(filterKey) {
    activeScMapFilter = filterKey || "pano360";
    const allPts = getRotaPointsForMap("all");
    const focusPts = getRotaPointsForMap(activeScMapFilter);
    const mapPts = activeScMapFilter === "pano360" ? allPts : focusPts;
    renderMapSidebar(activeScMapFilter === "pano360" ? allPts : focusPts, null);

    document.querySelectorAll("#scMapQuickBar .sc-filter-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-map-filter") === activeScMapFilter);
    });

    if (!state.leafletMap || typeof window.L === "undefined") {
      const mapContainer = document.getElementById("leafletSCMap");
      if (mapContainer && typeof window.L === "undefined") {
        renderOfflineMapFallback(mapContainer, mapPts);
      }
      return;
    }

    if (state.leafletMarkersLayer) {
      state.leafletMarkersLayer.clearLayers();
    } else {
      state.leafletMarkersLayer = window.L.layerGroup().addTo(state.leafletMap);
    }
    state.leafletMarkers = {};

    const isSvBlueActive = Boolean(state.isSatSvCoverageVisible || state.isSatSvDropMode || state.isDraggingPegman);
    const outerRoadColor = isSvBlueActive ? "#0369a1" : "#0f172a";
    const outerRoadWeight = isSvBlueActive ? 7.2 : 5.6;
    const innerRoadColor = isSvBlueActive ? "#38bdf8" : "#f59e0b";
    const innerRoadWeight = isSvBlueActive ? 4.2 : 3.2;

    if (Array.isArray(window.ROTA_LUMIAR_ROAD_LEGS) && window.ROTA_LUMIAR_ROAD_LEGS.length > 0) {
      const visibleLegs = window.ROTA_LUMIAR_ROAD_LEGS.filter(leg => {
        if (isSvBlueActive) {
          if (leg.fromRegion !== "rio_da_luz" || leg.toRegion !== "rio_da_luz") return false;
          if (UNCOVERED_ROTA_POINT_NUMS.has(Number(leg.from)) || UNCOVERED_ROTA_POINT_NUMS.has(Number(leg.to))) {
            return false;
          }
          return true;
        }
        if (activeScMapFilter === "rio_da_luz") {
          return leg.fromRegion === "rio_da_luz" && leg.toRegion === "rio_da_luz";
        }
        if (activeScMapFilter === "testo_alto") {
          return leg.fromRegion === "testo_alto" && leg.toRegion === "testo_alto";
        }
        return true;
      });
      visibleLegs.forEach(leg => {
        if (!Array.isArray(leg.coords) || leg.coords.length < 2) return;
        window.L.polyline(leg.coords, {
          renderer: state.leafletCanvasRenderer || undefined,
          color: outerRoadColor,
          weight: outerRoadWeight,
          opacity: isSvBlueActive ? 0.92 : 0.78,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
          interactive: false
        }).addTo(state.leafletMarkersLayer);
        const innerLine = window.L.polyline(leg.coords, {
          renderer: state.leafletCanvasRenderer || undefined,
          color: innerRoadColor,
          weight: innerRoadWeight,
          opacity: 0.98,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
          interactive: isSvBlueActive
        }).addTo(state.leafletMarkersLayer);
        if (isSvBlueActive) {
          innerLine.on("click", ev => {
            if (ev && ev.latlng) {
              dropPegmanAtLatLng(ev.latlng.lat, ev.latlng.lng);
            }
          });
        }
      });
    } else if (mapPts.length >= 2) {
      window.L.polyline(mapPts.map(p => [p.lat, p.lng]), {
        renderer: state.leafletCanvasRenderer || undefined,
        color: innerRoadColor,
        weight: 3,
        opacity: 0.85,
        smoothFactor: 1.5
      }).addTo(state.leafletMarkersLayer);
    }

    if (isSvBlueActive) {
      const coveredStreets = getMergedExtraStreets().filter(st => {
        if (isUnpavedTrailName(st.name)) return false;
        return st.coords.some(c => isWithinRioDaLuzSvBounds(c[0], c[1]));
      });
      coveredStreets.forEach(st => {
        if (!Array.isArray(st.coords) || st.coords.length < 2) return;
        window.L.polyline(st.coords, {
          renderer: state.leafletCanvasRenderer || undefined,
          color: "#0369a1",
          weight: 7,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
          interactive: false
        }).addTo(state.leafletMarkersLayer);
        const extraLine = window.L.polyline(st.coords, {
          renderer: state.leafletCanvasRenderer || undefined,
          color: "#38bdf8",
          weight: 4.2,
          opacity: 0.96,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
          interactive: true
        }).addTo(state.leafletMarkersLayer);
        extraLine.on("click", ev => {
          if (ev && ev.latlng) {
            dropPegmanAtLatLng(ev.latlng.lat, ev.latlng.lng);
          }
        });
      });

      [SAT_SV_SPOTS.casa_rux_patio, SAT_SV_SPOTS.schroeder_patio, SAT_SV_SPOTS.estrada_vale, SAT_SV_SPOTS.estrada_rux].forEach(sp => {
        const dotIcon = window.L.divIcon({
          className: "gsat-sv-photosphere-wrap",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          html: `<div class="gsat-sv-photosphere-dot" title="Ponto 360° Street View: ${escapeHtml(sp.label)}"></div>`
        });
        const dotMarker = window.L.marker([sp.lat, sp.lng], {
          icon: dotIcon,
          zIndexOffset: 900
        }).addTo(state.leafletMarkersLayer);
        dotMarker.on("click", () => {
          dropPegmanAtLatLng(sp.lat, sp.lng);
        });
      });
    }

    mapPts.forEach(pt => {
      let icon;
      if (pt.sceneId) {
        const shortBadge = pt.num === 1 ? "1. Casa Rux 360°" : "2. Schroeder Platz 360°";
        icon = window.L.divIcon({
          className: "gsat-pin-wrapper",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          popupAnchor: [0, -38],
          html: `<div class="gsat-pin-badge" title="${pt.num}. ${escapeHtml(pt.name)}">${shortBadge}</div>`
        });
      } else {
        const catClass = `cat-${pt.category || "atrativos"}`;
        icon = window.L.divIcon({
          className: "gsat-pin-wrapper",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          popupAnchor: [0, -16],
          html: `<div class="gsat-num-pin ${catClass}" title="${pt.num}. ${escapeHtml(pt.name)}">${pt.num}</div>`
        });
      }

      const marker = window.L.marker([pt.lat, pt.lng], {
        icon,
        zIndexOffset: pt.sceneId ? 600 : 100 + (30 - pt.num)
      }).addTo(state.leafletMarkersLayer);

      marker.bindPopup(buildRotaPointGooglePopupHTML(pt), { maxWidth: 300 });
      marker.on("click", () => {
        const sidebarCard = document.querySelector(`#scMapPointsSidebar [data-map-pt-num="${pt.num}"]`);
        const sidebarItem = sidebarCard ? sidebarCard.querySelector(".sc-sidebar-item") : null;
        if (sidebarCard) {
          document.querySelectorAll("#scMapPointsSidebar .sc-sidebar-card, #scMapPointsSidebar .sc-sidebar-item").forEach(el => el.classList.remove("active"));
          sidebarCard.classList.add("active");
          if (sidebarItem) sidebarItem.classList.add("active");
          sidebarCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
      state.leafletMarkers[pt.num] = marker;
    });

    if (!state.skipNextMapFitBounds) {
      state.leafletMap.stop();
      state.leafletMap.invalidateSize({ animate: false, pan: false });
      if (activeScMapFilter === "pano360") {
        const curScene = window.TOUR_SC_DATA && window.TOUR_SC_DATA.scenes
          ? window.TOUR_SC_DATA.scenes[state.currentSceneId]
          : null;
        if (curScene && curScene.coordinates) {
          state.leafletMap.setView([curScene.coordinates.lat, curScene.coordinates.lng], 16, { animate: false });
        } else if (focusPts.length > 0) {
          state.leafletMap.fitBounds(window.L.latLngBounds(focusPts.map(p => [p.lat, p.lng])), {
            animate: false,
            padding: [50, 50],
            maxZoom: 16
          });
        }
      } else if (focusPts.length > 0) {
        const bounds = window.L.latLngBounds(focusPts.map(p => [p.lat, p.lng]));
        state.leafletMap.fitBounds(bounds, {
          animate: false,
          padding: [42, 42],
          maxZoom: 15
        });
      }
    }
    state.skipNextMapFitBounds = false;

    renderCustomRouteOnMap();
    if (state.aiSearch.active) {
      renderAiResultsOnMap(false);
    }
    updateRouteQuickBadge();
    updateAiSplitBanner();
    updateLiveSatelliteRadar(true);
  }

  function initOrUpdateLeafletMap() {
    const mapContainer = document.getElementById("leafletSCMap");
    if (!mapContainer) return;

    if (typeof window.L === "undefined") {
      renderOfflineMapFallback(mapContainer, getRotaPointsForMap(activeScMapFilter));
      renderMapSidebar(getRotaPointsForMap("all"), null);
      bindScMapQuickButtons();
      return;
    }

    if (!state.leafletMap) {
      state.leafletMap = window.L.map("leafletSCMap", {
        center: [-26.5385, -49.1465],
        zoom: 16,
        maxZoom: 20,
        preferCanvas: true,
        fadeAnimation: false,
        markerZoomAnimation: false
      });

      state.leafletCanvasRenderer = window.L.canvas({ padding: 0.5 });

      const emptyPng = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      let googleSatLoaded = 0;
      let googleSatFailed = 0;
      state.usingFallbackSatellite = false;

      state.leafletSatelliteLayer = window.L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}",
        {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 20,
          maxNativeZoom: 20,
          keepBuffer: 4,
          updateWhenIdle: false,
          updateWhenZooming: false,
          attribution: "Imagens © Google Satélite • Rota Lumiar (GeoSC 360°)"
        }
      ).addTo(state.leafletMap);

      state.leafletFallbackSatelliteLayer = window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 20,
          maxNativeZoom: 18,
          keepBuffer: 4,
          updateWhenIdle: false,
          updateWhenZooming: false,
          attribution: "Imagens © Esri Satélite • Rota Lumiar (GeoSC 360°)"
        }
      );

      function maybeSwitchToFallbackSatellite() {
        if (state.usingFallbackSatellite || googleSatLoaded > 0 || googleSatFailed < 2 || !state.leafletMap) return;
        state.usingFallbackSatellite = true;
        if (state.leafletMap.hasLayer(state.leafletSatelliteLayer)) {
          state.leafletMap.removeLayer(state.leafletSatelliteLayer);
        }
        if (!state.leafletMap.hasLayer(state.leafletFallbackSatelliteLayer)) {
          state.leafletFallbackSatelliteLayer.addTo(state.leafletMap);
          state.leafletFallbackSatelliteLayer.bringToBack();
        }
      }

      state.leafletSatelliteLayer.on("tileload", ev => {
        if (ev && ev.tile && ev.tile.naturalWidth >= 128) {
          googleSatLoaded++;
        } else {
          googleSatFailed++;
          maybeSwitchToFallbackSatellite();
        }
      });
      state.leafletSatelliteLayer.on("tileerror", () => {
        googleSatFailed++;
        maybeSwitchToFallbackSatellite();
      });

      state.leafletSvvLayer = window.L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=svv&hl=pt-BR&x={x}&y={y}&z={z}",
        {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 20,
          maxNativeZoom: 20,
          opacity: 0.75,
          zIndex: 450,
          errorTileUrl: emptyPng
        }
      );

      state.leafletCustomRouteLayer = window.L.layerGroup().addTo(state.leafletMap);
      state.leafletAiLayer = window.L.layerGroup().addTo(state.leafletMap);

      state.leafletMap.on("dragstart zoomstart", () => {
        state.isLeafletMapPanning = true;
        if (state.isSatSvDropMode && !state.isDraggingPegman) {
          hidePegmanDragOverlay();
        }
      });
      state.leafletMap.on("dragend zoomend", () => {
        state.isLeafletMapPanning = false;
        state.lastLeafletDragEndTime = Date.now();
        updateLiveSatelliteRadar(true);
      });
      state.leafletMap.on("click", e => {
        if (!e || !e.latlng) return;
        if (state.lastLeafletDragEndTime && (Date.now() - state.lastLeafletDragEndTime) < 180) {
          return;
        }
        if (state.isSatSvDropMode && !state.isSatStreetViewOpen) {
          dropPegmanAtLatLng(e.latlng.lat, e.latlng.lng);
        } else if (state.isSatStreetViewOpen) {
          const snapped = snapToSatelliteStreetViewSpot(e.latlng.lat, e.latlng.lng);
          if (!snapped.inCoverage) {
            triggerRioDaLuzCoverageLimitReturn(snapped);
            return;
          }
          setSatelliteStreetViewLocation(snapped.lat, snapped.lng, snapped.heading, snapped.pitch, snapped.label, snapped.spotId);
        }
      });
      bindScMapQuickButtons();
    }

    bindScMapQuickButtons();
    state.leafletMap.invalidateSize({ animate: false, pan: false });
    renderFilteredSatelliteMarkers(activeScMapFilter);
  }

  const SAT_SV_SPOTS = {
    estrada_vale: {
      id: "estrada_vale",
      label: "Estrada Rio da Luz (R. Eurico Duwe, 3672)",
      shortLabel: "R. Eurico Duwe — Bairro Rio da Luz",
      lat: -26.53915,
      lng: -49.14815,
      heading: 20,
      pitch: 2
    },
    casa_rux_patio: {
      id: "casa_rux_patio",
      label: "Casa Rux 1915 (Pátio 360° • Acervo GeoLab UDESC)",
      shortLabel: "Casa Rux 1915 (Pátio 360°)",
      lat: -26.53617,
      lng: -49.14234,
      heading: 190,
      pitch: 2
    },
    estrada_rux: {
      id: "estrada_rux",
      label: "Estrada Casa Rux (R. Erwin Rux, 663 / JGS-489)",
      shortLabel: "R. Erwin Rux, 663 — Casa Rux",
      lat: -26.5363,
      lng: -49.1430,
      heading: 95,
      pitch: 2
    },
    schroeder_patio: {
      id: "schroeder_patio",
      label: "Schroeder Platz (Pátio 360° • Acervo GeoLab UDESC)",
      shortLabel: "Schroeder Platz (Pátio 360°)",
      lat: -26.5384678,
      lng: -49.1486893,
      heading: 135,
      pitch: 2
    }
  };

  // Ruas e conexões adicionais do Bairro Rio da Luz e entorno imediato
  const RIO_DA_LUZ_EXTRA_STREETS = [
    {
      name: "R. Eurico Duwe (Acesso Norte • Bairro Rio da Luz)",
      region: "rio_da_luz",
      coords: [
        [-26.5215, -49.1412],
        [-26.5242, -49.1408],
        [-26.5268, -49.1403],
        [-26.5292, -49.1397],
        [-26.531624, -49.139106]
      ]
    },
    {
      name: "Rod. Pref. Wolfgang Weege (SC-110 • Acesso Rio da Luz / Rio Cerro)",
      region: "rio_da_luz",
      coords: [
        [-26.5220, -49.1368],
        [-26.5265, -49.1372],
        [-26.5302, -49.1375],
        [-26.53221, -49.137732],
        [-26.5355, -49.1380],
        [-26.5388, -49.1383],
        [-26.5425, -49.1386],
        [-26.5470, -49.1384],
        [-26.5520, -49.1379],
        [-26.5575, -49.1374]
      ]
    },
    {
      name: "R. Pastor Albert Schneider (Conexão Rio da Luz - SC-110)",
      region: "rio_da_luz",
      coords: [
        [-26.531624, -49.139106],
        [-26.5310, -49.1384],
        [-26.5302, -49.1375]
      ]
    },
    {
      name: "R. Erwin Rux (Ramal Sul • Bairro Rio da Luz)",
      region: "rio_da_luz",
      coords: [
        [-26.542834, -49.146112],
        [-26.5436, -49.1452],
        [-26.5448, -49.1441],
        [-26.5462, -49.1430]
      ]
    },
    {
      name: "R. Ricardo Fritzke (Tifa Fritzke • Bairro Rio da Luz)",
      region: "rio_da_luz",
      coords: [
        [-26.556505, -49.153304],
        [-26.5568, -49.1518],
        [-26.5572, -49.1501],
        [-26.5578, -49.1484]
      ]
    },
    {
      name: "R. Rio Cerro / Acesso Leste Rio da Luz",
      region: "rio_da_luz",
      coords: [
        [-26.5388, -49.1383],
        [-26.5390, -49.1355],
        [-26.5393, -49.1325]
      ]
    }
  ];

  const RIO_DA_LUZ_SV_BOUNDS = {
    minLat: -26.605,
    maxLat: -26.518,
    minLng: -49.215,
    maxLng: -49.131
  };
  const UNCOVERED_ROTA_POINT_NUMS = new Set([8, 11, 12, 14]);
  const UNPAVED_TRAIL_TOKENS = [
    "estrada hugo kohn",
    "estrada tifa blank",
    "estrada ademar laube",
    "estrada erico oto hornburg",
    "jgs 467",
    "osvaldo ehlert"
  ];

  function normalizeGeoText(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function isWithinRioDaLuzSvBounds(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    return (
      lat >= RIO_DA_LUZ_SV_BOUNDS.minLat &&
      lat <= RIO_DA_LUZ_SV_BOUNDS.maxLat &&
      lng >= RIO_DA_LUZ_SV_BOUNDS.minLng &&
      lng <= RIO_DA_LUZ_SV_BOUNDS.maxLng
    );
  }

  function isUnpavedTrailName(name) {
    const norm = normalizeGeoText(name);
    if (!norm) return false;
    return UNPAVED_TRAIL_TOKENS.some(tok => norm.includes(tok));
  }

  function isPointStreetViewAvailable(pt) {
    if (!pt || pt.regionKey !== "rio_da_luz") return false;
    if (UNCOVERED_ROTA_POINT_NUMS.has(Number(pt.num))) return false;
    return isWithinRioDaLuzSvBounds(pt.lat, pt.lng);
  }

  function getMergedExtraStreets() {
    const ext = Array.isArray(window.RIO_DA_LUZ_EXTRA_STREETS) ? window.RIO_DA_LUZ_EXTRA_STREETS : [];
    const seen = new Set();
    const out = [];
    [...ext, ...RIO_DA_LUZ_EXTRA_STREETS].forEach(st => {
      if (!st || !Array.isArray(st.coords) || st.coords.length < 2) return;
      const first = st.coords[0];
      const key = `${normalizeGeoText(st.name)}|${first[0].toFixed(4)},${first[1].toFixed(4)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(st);
    });
    return out;
  }

  function getUnpavedTrailSegments() {
    return getMergedExtraStreets().filter(st => isUnpavedTrailName(st.name));
  }

  function getLegStreetName(leg) {
    if (!leg) return "Estrada do Bairro Rio da Luz";
    const f = Number(leg.from);
    const t = Number(leg.to);
    if ((f === 1 && t === 2) || (f === 2 && t === 3)) return "R. Erwin Rux (JGS-489) / R. Eurico Duwe — Bairro Rio da Luz";
    if (f >= 3 && f <= 5) return "R. Eurico Duwe — Bairro Rio da Luz";
    if (f === 6 || f === 7) return "R. Ricardo Fritzke / R. Eurico Duwe — Bairro Rio da Luz";
    if (f === 8 || f === 9) return "R. Eurico Duwe — Bairro Rio da Luz";
    if (f === 10) return "Rod. Mun. JGS-503 — Bairro Rio da Luz";
    if (f >= 11 && f <= 13) return "R. Eurico Duwe (Rio da Luz Vitória) — Bairro Rio da Luz";
    if (f === 14) return "Estrada Rio da Luz - Testo Alto";
    return "Rua Testo Alto — Rota Lumiar";
  }

  function getAllStreetViewRoadSegments() {
    const list = [];
    getMergedExtraStreets().forEach(st => {
      if (isUnpavedTrailName(st.name)) return;
      const hasInBoundsCoord = st.coords.some(c => isWithinRioDaLuzSvBounds(c[0], c[1]));
      if (hasInBoundsCoord) {
        list.push(st);
      }
    });
    if (Array.isArray(window.ROTA_LUMIAR_ROAD_LEGS)) {
      window.ROTA_LUMIAR_ROAD_LEGS.forEach(leg => {
        if (!leg || !Array.isArray(leg.coords) || leg.coords.length < 2) return;
        const fromN = Number(leg.from);
        const toN = Number(leg.to);
        if (leg.fromRegion !== "rio_da_luz" || leg.toRegion !== "rio_da_luz") return;
        if (UNCOVERED_ROTA_POINT_NUMS.has(fromN) || UNCOVERED_ROTA_POINT_NUMS.has(toN)) return;
        list.push({
          name: getLegStreetName(leg),
          region: "rio_da_luz",
          coords: leg.coords
        });
      });
    }
    return list;
  }

  function findClosestRoadHit(rawLat, rawLng, roadList) {
    const cosLat = Math.max(0.2, Math.cos(rawLat * DEG2RAD));
    let bestLat = rawLat;
    let bestLng = rawLng;
    let bestHeading = 20;
    let bestDist = Infinity;
    let bestStreetName = "Rua do Bairro Rio da Luz";

    (roadList || []).forEach(road => {
      const coords = road.coords;
      if (!Array.isArray(coords) || coords.length < 2) return;
      for (let i = 0; i < coords.length - 1; i++) {
        const aLat = coords[i][0];
        const aLng = coords[i][1];
        const bLat = coords[i + 1][0];
        const bLng = coords[i + 1][1];

        const dx = (bLng - aLng) * cosLat;
        const dy = bLat - aLat;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq > 1e-12) {
          const px = (rawLng - aLng) * cosLat;
          const py = rawLat - aLat;
          t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
        }

        const projLat = aLat + t * (bLat - aLat);
        const projLng = aLng + t * (bLng - aLng);
        const dist = Math.hypot(rawLat - projLat, (rawLng - projLng) * cosLat);

        if (dist < bestDist) {
          bestDist = dist;
          bestLat = projLat;
          bestLng = projLng;
          bestStreetName = road.name || "Rua do Bairro Rio da Luz";
          if (lenSq > 1e-12) {
            bestHeading = ((Math.atan2(dx, dy) * RAD2DEG) % 360 + 360) % 360;
          }
        }
      }
    });

    return {
      lat: bestLat,
      lng: bestLng,
      heading: Math.round(bestHeading),
      dist: bestDist,
      streetName: bestStreetName
    };
  }

  function snapToSatelliteStreetViewSpot(rawLat, rawLng) {
    if (!isWithinRioDaLuzSvBounds(rawLat, rawLng)) {
      return {
        lat: Number(rawLat.toFixed(6)),
        lng: Number(rawLng.toFixed(6)),
        heading: 0,
        pitch: 2,
        label: "Fora dos limites cobertos do Rio da Luz",
        shortLabel: "Fora do Rio da Luz",
        spotId: "",
        isOverRoad: false,
        inCoverage: false,
        reason: "out_of_bounds",
        dist: Infinity
      };
    }

    const patioSpots = [
      SAT_SV_SPOTS.casa_rux_patio,
      SAT_SV_SPOTS.schroeder_patio
    ];
    for (const sp of patioSpots) {
      const d = Math.hypot(rawLat - sp.lat, rawLng - sp.lng);
      if (d < 0.00024) {
        return {
          lat: sp.lat,
          lng: sp.lng,
          heading: sp.heading,
          pitch: sp.pitch,
          label: sp.label,
          shortLabel: sp.shortLabel || sp.label,
          spotId: sp.id,
          isOverRoad: true,
          inCoverage: true,
          dist: d
        };
      }
    }

    const cosLat = Math.max(0.2, Math.cos(rawLat * DEG2RAD));
    const pts = (window.ROTA_LUMIAR_DATA && Array.isArray(window.ROTA_LUMIAR_DATA.points))
      ? window.ROTA_LUMIAR_DATA.points
      : [];

    let nearestRawPt = null;
    let nearestRawDist = Infinity;
    pts.forEach(pt => {
      if (typeof pt.lat !== "number" || typeof pt.lng !== "number") return;
      const d = Math.hypot(rawLat - pt.lat, (rawLng - pt.lng) * cosLat);
      if (d < nearestRawDist) {
        nearestRawDist = d;
        nearestRawPt = pt;
      }
    });

    if (nearestRawPt && nearestRawDist < 0.0006 && !isPointStreetViewAvailable(nearestRawPt)) {
      return {
        lat: Number(rawLat.toFixed(6)),
        lng: Number(rawLng.toFixed(6)),
        heading: 0,
        pitch: 2,
        label: `Street View não disponível (${nearestRawPt.num}. ${nearestRawPt.name})`,
        shortLabel: "Street View não disponível",
        spotId: "",
        isOverRoad: false,
        inCoverage: false,
        reason: "uncovered_point",
        point: nearestRawPt,
        dist: nearestRawDist
      };
    }

    const coveredHit = findClosestRoadHit(rawLat, rawLng, getAllStreetViewRoadSegments());
    const unpavedHit = findClosestRoadHit(rawLat, rawLng, getUnpavedTrailSegments());

    if (unpavedHit.dist < 0.00045 && unpavedHit.dist <= coveredHit.dist) {
      return {
        lat: Number(rawLat.toFixed(6)),
        lng: Number(rawLng.toFixed(6)),
        heading: unpavedHit.heading,
        pitch: 2,
        label: `Estrada rural sem cobertura Street View (${unpavedHit.streetName})`,
        shortLabel: "Estrada sem Street View",
        spotId: "",
        isOverRoad: false,
        inCoverage: false,
        reason: "unpaved_trail",
        streetName: unpavedHit.streetName,
        dist: unpavedHit.dist
      };
    }

    let bestStreetName = coveredHit.streetName;
    let nearestSnapPt = null;
    let nearestSnapPtDist = Infinity;
    pts.forEach(pt => {
      if (!isPointStreetViewAvailable(pt)) return;
      const d = Math.hypot(coveredHit.lat - pt.lat, (coveredHit.lng - pt.lng) * cosLat);
      if (d < nearestSnapPtDist) {
        nearestSnapPtDist = d;
        nearestSnapPt = pt;
      }
    });

    if (nearestSnapPt && nearestSnapPtDist < 0.00085) {
      const addr = nearestSnapPt.endereco || bestStreetName;
      bestStreetName = `${addr} (Próx. ${nearestSnapPt.num}. ${nearestSnapPt.name})`;
    }

    // Snap apenas dentro de vias pavimentadas cobertas do Bairro Rio da Luz (~130m)
    if (coveredHit.dist < 0.0012 && isWithinRioDaLuzSvBounds(coveredHit.lat, coveredHit.lng)) {
      return {
        lat: Number(coveredHit.lat.toFixed(6)),
        lng: Number(coveredHit.lng.toFixed(6)),
        heading: coveredHit.heading,
        pitch: 2,
        label: bestStreetName,
        shortLabel: bestStreetName,
        spotId: "",
        isOverRoad: coveredHit.dist < 0.00085,
        inCoverage: true,
        dist: coveredHit.dist
      };
    }

    return {
      lat: Number(rawLat.toFixed(6)),
      lng: Number(rawLng.toFixed(6)),
      heading: 0,
      pitch: 2,
      label: "Sem dados do Street View neste ponto",
      shortLabel: "Sem dados do Street View",
      spotId: "",
      isOverRoad: false,
      inCoverage: false,
      reason: "off_road",
      dist: coveredHit.dist
    };
  }

  function setSatelliteStreetViewCoverageVisible(visible) {
    const nextVis = Boolean(visible);
    const prevVis = Boolean(state.isSatSvCoverageVisible);
    state.isSatSvCoverageVisible = nextVis;

    if (state.leafletMap && typeof window.L !== "undefined") {
      if (state.leafletSvvLayer) {
        const hasSvv = state.leafletMap.hasLayer(state.leafletSvvLayer);
        if (nextVis && !hasSvv) {
          state.leafletSvvLayer.addTo(state.leafletMap);
        } else if (!nextVis && hasSvv) {
          state.leafletMap.removeLayer(state.leafletSvvLayer);
        }
      }
      if (!nextVis) {
        removeLeafletSvSnapRing();
      }
      if (nextVis !== prevVis) {
        state.skipNextMapFitBounds = true;
        renderFilteredSatelliteMarkers(activeScMapFilter);
      }
    }
  }

  function updateLeafletSvSnapRing(lat, lng, visible) {
    if (!state.leafletMap || typeof window.L === "undefined") return;
    if (!visible) {
      removeLeafletSvSnapRing();
      return;
    }
    if (!state.leafletSvSnapRing) {
      const ringIcon = window.L.divIcon({
        className: "gsat-sv-snap-ring-wrap",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<div class="gsat-sv-snap-ring"></div>`
      });
      state.leafletSvSnapRing = window.L.marker([lat, lng], {
        icon: ringIcon,
        interactive: false,
        zIndexOffset: 2400
      }).addTo(state.leafletMap);
    } else {
      state.leafletSvSnapRing.setLatLng([lat, lng]);
      if (!state.leafletMap.hasLayer(state.leafletSvSnapRing)) {
        state.leafletSvSnapRing.addTo(state.leafletMap);
      }
    }
  }

  function removeLeafletSvSnapRing() {
    if (state.leafletSvSnapRing && state.leafletMap && state.leafletMap.hasLayer(state.leafletSvSnapRing)) {
      state.leafletMap.removeLayer(state.leafletSvSnapRing);
    }
  }

  function setSatelliteStreetViewDropMode(active) {
    const nextActive = Boolean(active);
    state.isSatSvDropMode = nextActive;

    const banner = document.getElementById("satSvCoverageBanner");
    if (banner) banner.hidden = !nextActive;

    const mapEl = document.getElementById("leafletSCMap");
    if (mapEl) mapEl.classList.toggle("sv-drop-cursor", nextActive);

    ["btnSatFloatingPegman", "btnToggleSatStreetView"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle("sv-drop-mode", nextActive);
    });

    setSatelliteStreetViewCoverageVisible(nextActive || Boolean(state.isDraggingPegman));
    if (!nextActive && !state.isDraggingPegman) {
      hidePegmanDragOverlay();
    }
  }

  function executeRioDaLuzReturnNow() {
    if (state.rioDaLuzLimitTimer) {
      clearTimeout(state.rioDaLuzLimitTimer);
      state.rioDaLuzLimitTimer = null;
    }
    const alertEl = document.getElementById("rioDaLuzLimitAlert");
    if (alertEl) alertEl.hidden = true;
    const iframe = document.getElementById("satStreetViewIframe");
    if (iframe) iframe.setAttribute("src", "about:blank");
    closeAuxiliaryDrawers();
    closeSplitModal();
    if (typeof loadScene === "function") {
      loadScene("vale_tombado_04", false);
    }
    syncModalUiState();
  }

  function triggerRioDaLuzCoverageLimitReturn(context) {
    if (state.rioDaLuzLimitTimer) {
      clearTimeout(state.rioDaLuzLimitTimer);
      state.rioDaLuzLimitTimer = null;
    }
    state.isDraggingPegman = false;
    setSatelliteStreetViewDropMode(false);
    setSatelliteStreetViewCoverageVisible(false);
    hidePegmanDragOverlay();

    // Garante que o iframe preto do Street View nunca permaneca aberto fora de cobertura
    const modal = document.getElementById("scMapModal");
    const pane = document.getElementById("scMapStreetViewPane");
    const iframe = document.getElementById("satStreetViewIframe");
    if (iframe) iframe.setAttribute("src", "about:blank");
    if (state.isSatStreetViewOpen) {
      state.isSatStreetViewOpen = false;
      if (modal) modal.classList.remove("sv-open", "sv-maximized");
      if (pane) pane.hidden = true;
    }

    const alertEl = document.getElementById("rioDaLuzLimitAlert");
    const titleEl = document.getElementById("rdlLimitAlertTitle");
    const msgEl = document.getElementById("rdlLimitAlertMessage");

    const pt = context && context.point ? context.point : null;
    const reason = (context && context.reason) || "out_of_bounds";
    if (titleEl) {
      titleEl.textContent = "Não há dados do Street View disponíveis neste ponto";
    }
    if (msgEl) {
      if (pt) {
        msgEl.textContent = `O ponto ${pt.num}. ${pt.name} (${pt.region}) está fora da cobertura do Google Street View do Bairro Rio da Luz. Retornando para a primeira página...`;
      } else if (reason === "unpaved_trail") {
        const nm = (context && context.streetName) ? ` (${context.streetName})` : "";
        msgEl.textContent = `Esta estrada rural ou trilha sem pavimentação${nm} não possui dados no Google Street View. Retornando para a primeira página...`;
      } else if (reason === "off_road") {
        msgEl.textContent = "Este ponto fora da via pública não possui dados do Google Street View dentro da área coberta do Rio da Luz. Retornando para a primeira página...";
      } else {
        msgEl.textContent = "Não há dados do Street View disponíveis fora dos limites cobertos do Bairro Rio da Luz. Retornando para a primeira página...";
      }
    }

    if (alertEl) {
      alertEl.hidden = false;
    }
    syncModalUiState();

    state.rioDaLuzLimitTimer = setTimeout(() => {
      executeRioDaLuzReturnNow();
    }, 2800);
  }

  function updatePegmanDragOverlayAtClient(clientX, clientY, tiltDeg) {
    const overlay = document.getElementById("satPegmanDragOverlay");
    const bodyEl = document.getElementById("satPegmanDanglingBody");
    const greenCircle = document.getElementById("satPegmanGreenCircle");
    const pill = document.getElementById("satPegmanDragPill");
    if (!overlay) return;

    overlay.hidden = false;
    if (bodyEl && typeof tiltDeg === "number") {
      bodyEl.style.transform = `rotate(${tiltDeg.toFixed(1)}deg)`;
    }

    // O círculo verde fica exatamente embaixo dos pés do boneco (centro em clientX, clientY + 8)
    const targetX = clientX;
    const targetY = clientY + 8;
    const mapEl = document.getElementById("leafletSCMap");
    if (!mapEl || !state.leafletMap || typeof window.L === "undefined") {
      overlay.style.transform = `translate3d(${Math.round(clientX)}px, ${Math.round(clientY)}px, 0)`;
      return null;
    }

    const rect = mapEl.getBoundingClientRect();
    const isInsideMap = (
      targetX >= rect.left &&
      targetX <= rect.right &&
      targetY >= rect.top &&
      targetY <= rect.bottom
    );

    if (!isInsideMap) {
      overlay.style.transform = `translate3d(${Math.round(clientX)}px, ${Math.round(clientY)}px, 0)`;
      if (greenCircle) {
        greenCircle.classList.remove("is-over-road", "is-out-of-coverage");
        greenCircle.style.transform = "translate3d(0px, 0px, 0) scale(0.95)";
      }
      if (pill) {
        pill.classList.remove("is-out-of-coverage");
        pill.textContent = "Arraste o boneco amarelo até uma rua azul do Rio da Luz";
      }
      removeLeafletSvSnapRing();
      return null;
    }

    const containerPt = window.L.point(targetX - rect.left, targetY - rect.top);
    const latlng = state.leafletMap.containerPointToLatLng(containerPt);
    const snapped = snapToSatelliteStreetViewSpot(latlng.lat, latlng.lng);

    const snappedPt = state.leafletMap.latLngToContainerPoint([snapped.lat, snapped.lng]);
    const snappedClientX = rect.left + snappedPt.x;
    const snappedClientY = rect.top + snappedPt.y;
    const dxSnap = snappedClientX - targetX;
    const dySnap = snappedClientY - targetY;
    const pixelDist = Math.hypot(dxSnap, dySnap);

    // Atração magnética suave do conjunto (Boneco + Círculo Verde alinhado sob os pés) para o eixo da rua azul
    let magX = 0;
    let magY = 0;
    if (snapped.inCoverage && snapped.isOverRoad && pixelDist <= 36) {
      magX = Math.max(-12, Math.min(12, dxSnap * 0.65));
      magY = Math.max(-12, Math.min(12, dySnap * 0.65));
    }
    overlay.style.transform = `translate3d(${Math.round(clientX + magX)}px, ${Math.round(clientY + magY)}px, 0)`;

    const outOfCoverage = !snapped.inCoverage;
    if (greenCircle) {
      const sc = (snapped.inCoverage && snapped.isOverRoad) ? 1.12 : 0.96;
      greenCircle.classList.toggle("is-over-road", Boolean(snapped.inCoverage && snapped.isOverRoad));
      greenCircle.classList.toggle("is-out-of-coverage", outOfCoverage);
      greenCircle.style.transform = `translate3d(0px, 0px, 0) scale(${sc})`;
    }
    if (pill) {
      pill.classList.toggle("is-out-of-coverage", outOfCoverage);
      pill.textContent = outOfCoverage
        ? "Sem dados do Street View fora da área coberta do Rio da Luz"
        : `Solte na rua: ${snapped.shortLabel || snapped.label}`;
    }
    updateLeafletSvSnapRing(snapped.lat, snapped.lng, Boolean(snapped.inCoverage && snapped.isOverRoad));
    return snapped;
  }

  function hidePegmanDragOverlay() {
    const overlay = document.getElementById("satPegmanDragOverlay");
    if (overlay) overlay.hidden = true;
    const greenCircle = document.getElementById("satPegmanGreenCircle");
    if (greenCircle) greenCircle.classList.remove("is-over-road", "is-out-of-coverage");
    const pill = document.getElementById("satPegmanDragPill");
    if (pill) pill.classList.remove("is-out-of-coverage");
    removeLeafletSvSnapRing();
  }

  function dropPegmanAtLatLng(rawLat, rawLng) {
    const snapped = snapToSatelliteStreetViewSpot(rawLat, rawLng);
    state.isDraggingPegman = false;
    setSatelliteStreetViewDropMode(false);
    hidePegmanDragOverlay();
    if (!snapped.inCoverage) {
      triggerRioDaLuzCoverageLimitReturn(snapped);
      return snapped;
    }
    toggleSatelliteStreetView(true, {
      id: snapped.spotId || "",
      label: snapped.label,
      lat: snapped.lat,
      lng: snapped.lng,
      heading: snapped.heading,
      pitch: snapped.pitch
    });
    return snapped;
  }

  function ensureLeafletPegmanMarker(lat, lng) {
    if (!state.leafletMap || typeof window.L === "undefined") return;
    if (!state.leafletPegmanMarker) {
      const pegmanIcon = window.L.divIcon({
        className: "gsat-pegman-marker-wrap",
        iconSize: [44, 52],
        iconAnchor: [22, 46],
        html: `
          <div class="gsat-pegman-pin" title="Boneco Street View — Arraste para qualquer rua do Rio da Luz">
            <div class="gsat-pegman-pulse"></div>
            <div class="gsat-pegman-figure">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="4.2" r="3" fill="#FACC15" stroke="#78350F" stroke-width="1.4"/>
                <path d="M15.6 8.2H8.4c-1.1 0-2 .9-2 2v4.3c0 .7.6 1.3 1.3 1.3h.8v5.2c0 .7.6 1.3 1.3 1.3h4.4c.7 0 1.3-.6 1.3-1.3v-5.2h.8c.7 0 1.3-.6 1.3-1.3v-4.3c0-1.1-.9-2-2-2z" fill="#FACC15" stroke="#78350F" stroke-width="1.4"/>
              </svg>
            </div>
          </div>
        `
      });

      state.leafletPegmanMarker = window.L.marker([lat, lng], {
        icon: pegmanIcon,
        draggable: true,
        zIndexOffset: 2500
      }).addTo(state.leafletMap);

      state.leafletPegmanMarker.on("dragstart", () => {
        setSatelliteStreetViewCoverageVisible(true);
      });

      state.leafletPegmanMarker.on("dragend", () => {
        const pos = state.leafletPegmanMarker.getLatLng();
        if (!pos) return;
        dropPegmanAtLatLng(pos.lat, pos.lng);
      });
    } else {
      state.leafletPegmanMarker.setLatLng([lat, lng]);
      if (!state.leafletMap.hasLayer(state.leafletPegmanMarker)) {
        state.leafletPegmanMarker.addTo(state.leafletMap);
      }
    }
  }

  function setSatelliteStreetViewLocation(lat, lng, heading, pitch, label, spotId) {
    const iframe = document.getElementById("satStreetViewIframe");
    const appBtn = document.getElementById("btnSatSvOpenApp");
    const statusText = document.getElementById("satSvStatusText");
    const coordsText = document.getElementById("satSvCoordsText");

    const embedUrl = buildStreetViewEmbedUrl(lat, lng, heading, pitch);
    const appUrl = buildStreetViewAppUrl(lat, lng, heading, pitch);

    if (iframe && iframe.getAttribute("src") !== embedUrl) {
      iframe.setAttribute("src", embedUrl);
    }
    if (appBtn) {
      appBtn.setAttribute("href", appUrl);
    }
    if (statusText) {
      statusText.textContent = label || "Street View 360° • Clique em Street View novamente para voltar ao mapa e jogar em outra rua";
    }
    if (coordsText) {
      coordsText.textContent = `GPS: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    }

    document.querySelectorAll("#satSvSpotsBar [data-sat-sv-spot]").forEach(btn => {
      btn.classList.toggle("active", Boolean(spotId) && btn.getAttribute("data-sat-sv-spot") === spotId);
    });

    ensureLeafletPegmanMarker(lat, lng);
    if (state.leafletMap) {
      state.leafletMap.panTo([lat, lng], { animate: false });
    }
  }

  function toggleSatelliteStreetView(forceState, customSpot) {
    const modal = document.getElementById("scMapModal");
    const pane = document.getElementById("scMapStreetViewPane");
    if (!modal || !pane) return;

    const nextOpen = typeof forceState === "boolean" ? forceState : !Boolean(state.isSatStreetViewOpen);
    state.isSatStreetViewOpen = nextOpen;

    modal.classList.toggle("sv-open", nextOpen);
    pane.hidden = !nextOpen;
    if (!nextOpen) {
      modal.classList.remove("sv-maximized");
      hidePegmanDragOverlay();
      const iframe = document.getElementById("satStreetViewIframe");
      if (iframe) iframe.setAttribute("src", "about:blank");
      if (state.leafletPegmanMarker && state.leafletMap && state.leafletMap.hasLayer(state.leafletPegmanMarker)) {
        state.leafletMap.removeLayer(state.leafletPegmanMarker);
      }
    }

    ["btnSatFloatingPegman", "btnToggleSatStreetView", "btnSatSvToggleBack", "btnSatFloatingPegmanExit"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.toggle("active", nextOpen);
    });

    if (nextOpen) {
      let spot = customSpot;
      if (!spot) {
        if (state.currentSceneId === "casa_rux_05") spot = SAT_SV_SPOTS.casa_rux_patio;
        else if (state.currentSceneId === "casa_rux_cima_07") spot = SAT_SV_SPOTS.estrada_rux;
        else if (state.currentSceneId === "schroeder_platz_03") spot = SAT_SV_SPOTS.schroeder_patio;
        else spot = SAT_SV_SPOTS.estrada_vale;
      }
      setSatelliteStreetViewLocation(spot.lat, spot.lng, spot.heading, spot.pitch, spot.label, spot.id);
    }

    if (state.leafletMap) {
      setTimeout(() => {
        if (state.leafletMap) state.leafletMap.invalidateSize({ animate: false, pan: false });
      }, 150);
    }
    syncModalUiState();
  }

  function openPointInSatelliteStreetView(pointNum) {
    const pts = (window.ROTA_LUMIAR_DATA && Array.isArray(window.ROTA_LUMIAR_DATA.points))
      ? window.ROTA_LUMIAR_DATA.points
      : [];
    const pt = pts.find(p => p.num === Number(pointNum));
    if (!pt) {
      const modal = document.getElementById("scMapModal");
      if (!modal || !modal.classList.contains("open")) openScMapModal(true);
      setTimeout(() => toggleSatelliteStreetView(true), 180);
      return;
    }

    if (!isPointStreetViewAvailable(pt)) {
      triggerRioDaLuzCoverageLimitReturn({ reason: "uncovered_point", point: pt });
      return;
    }

    const snapped = snapToSatelliteStreetViewSpot(pt.lat, pt.lng);
    if (!snapped.inCoverage) {
      triggerRioDaLuzCoverageLimitReturn({ reason: snapped.reason || "uncovered_point", point: pt });
      return;
    }

    const modal = document.getElementById("scMapModal");
    if (!modal || !modal.classList.contains("open")) {
      openScMapModal(true);
    }

    setTimeout(() => {
      if (pt.num === 1) {
        toggleSatelliteStreetView(true, SAT_SV_SPOTS.casa_rux_patio);
      } else if (pt.num === 2) {
        toggleSatelliteStreetView(true, SAT_SV_SPOTS.schroeder_patio);
      } else {
        toggleSatelliteStreetView(true, {
          id: "",
          label: `${pt.num}. ${pt.name} (${pt.endereco || pt.region})`,
          lat: snapped.lat,
          lng: snapped.lng,
          heading: snapped.heading,
          pitch: 2
        });
      }
    }, 180);
  }

  let pegmanDragSession = null;
  let pegmanTiltResetTimer = null;

  function cancelActivePegmanDragSession() {
    pegmanDragSession = null;
    state.isDraggingPegman = false;
    if (pegmanTiltResetTimer) {
      clearTimeout(pegmanTiltResetTimer);
      pegmanTiltResetTimer = null;
    }
    const dockBtn = document.getElementById("btnSatFloatingPegman");
    if (dockBtn) dockBtn.classList.remove("pegman-picked-up");
    hidePegmanDragOverlay();
    if (!state.isSatSvDropMode) {
      setSatelliteStreetViewCoverageVisible(false);
    }
  }

  function isClientPointOverMapUiControl(clientX, clientY, targetEl) {
    const checkSelector = ".sat-sv-coverage-banner, .sat-pegman-dock-wrap, .leaflet-control, .leaflet-popup";
    if (targetEl && typeof targetEl.closest === "function" && targetEl.closest(checkSelector)) {
      return true;
    }
    if (typeof document.elementFromPoint === "function") {
      const elAtPt = document.elementFromPoint(clientX, clientY);
      if (elAtPt && typeof elAtPt.closest === "function" && elAtPt.closest(checkSelector)) {
        return true;
      }
    }
    return false;
  }

  function bindPegmanDragSource(btn) {
    if (!btn || btn.dataset.pegmanDragBound) return;
    btn.dataset.pegmanDragBound = "true";

    btn.addEventListener("mouseenter", () => {
      if (!state.isSatStreetViewOpen && !state.isDraggingPegman) {
        setSatelliteStreetViewCoverageVisible(true);
      }
    });

    btn.addEventListener("mouseleave", () => {
      if (!state.isSatStreetViewOpen && !state.isDraggingPegman && !state.isSatSvDropMode) {
        setSatelliteStreetViewCoverageVisible(false);
      }
    });

    btn.addEventListener("pointerdown", e => {
      if (state.isSatStreetViewOpen) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      state.isDraggingPegman = true;
      pegmanDragSession = {
        sourceBtn: btn,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        moved: false
      };

      const dockBtn = document.getElementById("btnSatFloatingPegman");
      if (dockBtn) dockBtn.classList.add("pegman-picked-up");

      setSatelliteStreetViewCoverageVisible(true);
      updatePegmanDragOverlayAtClient(e.clientX, e.clientY, 0);
    });

    btn.addEventListener("click", e => {
      if (state.suppressNextPegmanClick) {
        state.suppressNextPegmanClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (state.isSatStreetViewOpen) {
        toggleSatelliteStreetView(false);
      } else {
        setSatelliteStreetViewDropMode(!state.isSatSvDropMode);
      }
    });
  }

  function bindGlobalPegmanDragListeners() {
    if (state.globalPegmanListenersBound) return;
    state.globalPegmanListenersBound = true;

    window.addEventListener("pointermove", e => {
      if (pegmanDragSession) {
        const dist = Math.hypot(e.clientX - pegmanDragSession.startX, e.clientY - pegmanDragSession.startY);
        if (dist > 5) {
          pegmanDragSession.moved = true;
        }
        const dx = e.clientX - pegmanDragSession.lastX;
        pegmanDragSession.lastX = e.clientX;
        const tilt = Math.max(-24, Math.min(24, -dx * 1.45));

        updatePegmanDragOverlayAtClient(e.clientX, e.clientY, tilt);

        if (pegmanTiltResetTimer) clearTimeout(pegmanTiltResetTimer);
        pegmanTiltResetTimer = setTimeout(() => {
          const bodyEl = document.getElementById("satPegmanDanglingBody");
          if (bodyEl) bodyEl.style.transform = "rotate(0deg)";
        }, 90);
        return;
      }

      if (state.isSatSvDropMode && !state.isSatStreetViewOpen) {
        if (state.isLeafletMapPanning) {
          hidePegmanDragOverlay();
          return;
        }
        const mapEl = document.getElementById("leafletSCMap");
        if (!mapEl) return;
        const rect = mapEl.getBoundingClientRect();
        const inside = (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        );
        if (inside && !isClientPointOverMapUiControl(e.clientX, e.clientY, e.target)) {
          updatePegmanDragOverlayAtClient(e.clientX, e.clientY, 0);
        } else {
          hidePegmanDragOverlay();
        }
      }
    });

    window.addEventListener("pointercancel", () => {
      if (pegmanDragSession || state.isDraggingPegman) {
        cancelActivePegmanDragSession();
      }
    });

    window.addEventListener("blur", () => {
      if (pegmanDragSession || state.isDraggingPegman) {
        cancelActivePegmanDragSession();
      }
    });

    window.addEventListener("pointerup", e => {
      if (!pegmanDragSession) return;
      const session = pegmanDragSession;
      pegmanDragSession = null;
      state.isDraggingPegman = false;

      const dockBtn = document.getElementById("btnSatFloatingPegman");
      if (dockBtn) dockBtn.classList.remove("pegman-picked-up");

      state.suppressNextPegmanClick = true;
      setTimeout(() => {
        state.suppressNextPegmanClick = false;
      }, 140);

      if (session.moved) {
        const targetX = e.clientX;
        const targetY = e.clientY + 8;
        const mapEl = document.getElementById("leafletSCMap");
        const dockRect = dockBtn ? dockBtn.getBoundingClientRect() : null;
        const droppedOnDock = dockRect && (
          e.clientX >= dockRect.left - 6 &&
          e.clientX <= dockRect.right + 6 &&
          e.clientY >= dockRect.top - 6 &&
          e.clientY <= dockRect.bottom + 6
        );
        const droppedOnUiControl = isClientPointOverMapUiControl(e.clientX, e.clientY, e.target);

        if (mapEl && !droppedOnDock && !droppedOnUiControl && state.leafletMap && typeof window.L !== "undefined") {
          const rect = mapEl.getBoundingClientRect();
          if (targetX >= rect.left && targetX <= rect.right && targetY >= rect.top && targetY <= rect.bottom) {
            const containerPt = window.L.point(targetX - rect.left, targetY - rect.top);
            const latlng = state.leafletMap.containerPointToLatLng(containerPt);
            dropPegmanAtLatLng(latlng.lat, latlng.lng);
            return;
          }
        }

        hidePegmanDragOverlay();
        if (!state.isSatSvDropMode) {
          setSatelliteStreetViewCoverageVisible(false);
        }
      } else {
        hidePegmanDragOverlay();
        setSatelliteStreetViewDropMode(!state.isSatSvDropMode);
      }
    });
  }

  function bindScMapQuickButtons() {
    document.querySelectorAll("#scMapQuickBar .sc-filter-btn").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const filterKey = btn.getAttribute("data-map-filter") || "all";
        renderFilteredSatelliteMarkers(filterKey);
      });
    });

    const quickRouteBtn = document.getElementById("btnScMapQuickRoute");
    if (quickRouteBtn && !quickRouteBtn.dataset.bound) {
      quickRouteBtn.dataset.bound = "true";
      quickRouteBtn.addEventListener("click", () => {
        const modal = document.getElementById("scMapModal");
        if (modal && modal.classList.contains("split-mode")) {
          applyScMapDisplayMode(false);
        }
        setTimeout(() => {
          const panel = document.getElementById("scMapRoutePanel");
          if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      });
    }

    const aiForm = document.getElementById("formScMapAiSearch");
    if (aiForm && !aiForm.dataset.bound) {
      aiForm.dataset.bound = "true";
      aiForm.addEventListener("submit", e => {
        e.preventDefault();
        const input = document.getElementById("scMapAiSearchInput");
        const val = input ? input.value.trim() : "";
        if (val) {
          runMapAiSearch(val);
        } else {
          clearMapAiSearch();
        }
      });
    }

    const aiClearBtn = document.getElementById("btnScMapAiClear");
    if (aiClearBtn && !aiClearBtn.dataset.bound) {
      aiClearBtn.dataset.bound = "true";
      aiClearBtn.addEventListener("click", () => {
        clearMapAiSearch();
      });
    }

    document.querySelectorAll("#scMapAiQuickChips [data-ai-query]").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const q = btn.getAttribute("data-ai-query") || btn.textContent || "";
        runMapAiSearch(q);
      });
    });

    const aiOpenSidebarBtn = document.getElementById("btnScMapAiOpenSidebar");
    if (aiOpenSidebarBtn && !aiOpenSidebarBtn.dataset.bound) {
      aiOpenSidebarBtn.dataset.bound = "true";
      aiOpenSidebarBtn.addEventListener("click", () => {
        const modal = document.getElementById("scMapModal");
        if (modal && modal.classList.contains("split-mode")) {
          applyScMapDisplayMode(false);
        }
        setTimeout(() => {
          const box = document.getElementById("scMapAiResultsBox");
          if (box) box.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 120);
      });
    }

    const limitReturnNowBtn = document.getElementById("btnRdlLimitReturnNow");
    if (limitReturnNowBtn && !limitReturnNowBtn.dataset.bound) {
      limitReturnNowBtn.dataset.bound = "true";
      limitReturnNowBtn.addEventListener("click", () => {
        executeRioDaLuzReturnNow();
      });
    }

    bindGlobalPegmanDragListeners();

    ["btnSatFloatingPegman", "btnToggleSatStreetView"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) bindPegmanDragSource(btn);
    });

    ["btnSatSvToggleBack", "btnSatFloatingPegmanExit"].forEach(id => {
      const btn = document.getElementById(id);
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener("click", () => {
          toggleSatelliteStreetView(false);
        });
      }
    });

    const cancelCovBtn = document.getElementById("btnSatSvCoverageCancel");
    if (cancelCovBtn && !cancelCovBtn.dataset.bound) {
      cancelCovBtn.dataset.bound = "true";
      cancelCovBtn.addEventListener("click", e => {
        e.stopPropagation();
        setSatelliteStreetViewDropMode(false);
      });
    }

    document.querySelectorAll("#satSvSpotsBar [data-sat-sv-spot]").forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const key = btn.getAttribute("data-sat-sv-spot");
        const sp = SAT_SV_SPOTS[key];
        if (sp) {
          setSatelliteStreetViewLocation(sp.lat, sp.lng, sp.heading, sp.pitch, sp.label, sp.id);
        }
      });
    });
  }

  function renderOfflineMapFallback(container, pts) {
    const list = pts || getRotaPointsForMap(activeScMapFilter);
    container.innerHTML = `
      <div style="padding:18px;color:#fff;background:#10231c;height:100%;overflow:auto;">
        <h4 style="margin-bottom:10px;">Pontos Georreferenciados no Google — Rota Lumiar (${list.length} pontos):</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:10px;">
          ${list.map(pt => {
            const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${pt.lat},${pt.lng}`;
            const gdirUrl = `https://www.google.com/maps/dir/?api=1&destination=${pt.lat},${pt.lng}`;
            return `
              <div style="background:rgba(255,255,255,0.08);padding:11px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);">
                <strong>${pt.num}. ${pt.name}</strong>
                <div style="font-size:11.5px;color:#cbd5e1;margin:3px 0;">${pt.endereco || pt.region}</div>
                <div style="font-size:10.5px;color:#a7f3d0;margin-bottom:8px;">GPS: ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
                    style="padding:5px 9px;background:#1d4ed8;color:#fff;border-radius:5px;text-decoration:none;font-size:11px;font-weight:700;">
                    Google Maps ↗
                  </a>
                  <a href="${gdirUrl}" target="_blank" rel="noopener noreferrer"
                    style="padding:5px 9px;background:#0f766e;color:#fff;border-radius:5px;text-decoration:none;font-size:11px;font-weight:700;">
                    Rota ↗
                  </a>
                  ${pt.sceneId ? `
                    <button type="button" onclick="window.GeoSC360.goToScene('${pt.sceneId}')"
                      style="padding:5px 9px;background:#16a34a;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:700;">
                      Foto 360°
                    </button>
                  ` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // ===========================================================================
  // 7. MODO CRIADOR / EDITOR VISUAL 360° (REPLICAÇÃO EM QUALQUER COMPUTADOR)
  // ===========================================================================
  function bindEditorEvents() {
    const typeSelect = document.getElementById("edHotspotType");
    const groupInfo = document.getElementById("edGroupInfo");
    const group3D = document.getElementById("edGroup3D");
    const groupScene = document.getElementById("edGroupScene");

    if (typeSelect) {
      typeSelect.addEventListener("change", () => {
        const val = typeSelect.value;
        groupInfo.style.display = val === "info" ? "block" : "none";
        group3D.style.display = val === "3d" ? "block" : "none";
        groupScene.style.display = val === "scene" ? "block" : "none";
      });
    }

    // Upload de foto 360° própria do computador (.jpg / .png)
    const fileInput360 = document.getElementById("edUploadPanoInput");
    if (fileInput360) {
      fileInput360.addEventListener("change", e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const dataUrl = ev.target.result;
          const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
          if (scene) {
            scene.customPanoramaUrl = dataUrl;
            applySceneNow(scene);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Formulário de Adicionar Novo Hotspot na Cena Atual
    const formAdd = document.getElementById("formAddHotspot");
    if (formAdd) {
      formAdd.addEventListener("submit", e => {
        e.preventDefault();
        const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
        if (!scene) return;

        const pitch = parseFloat(document.getElementById("edPitch").value) || 0;
        const yaw = parseFloat(document.getElementById("edYaw").value) || 0;
        const type = document.getElementById("edHotspotType").value;
        const title = document.getElementById("edTitle").value.trim() || "Novo Ponto Turístico SC";

        const newHs = {
          id: "hs_custom_" + Date.now(),
          type,
          category: type === "3d" ? "modelo3d" : (type === "scene" ? "portal360" : "turismo"),
          iconStyle: type === "3d" ? "yellow-oval" : (type === "scene" ? "portal-thumb" : "red-circle"),
          pitch,
          yaw,
          tooltip: title,
          title
        };

        if (type === "info") {
          newHs.subtitleLead = document.getElementById("edSubtitleLead").value.trim() || "Ponto adicionado interativamente no Modo Criador 360°.";
          newHs.paragraphs = [
            document.getElementById("edParagraph").value.trim() || "Descrição detalhada do ponto turístico ou geológico em Santa Catarina."
          ];
          newHs.didYouKnow = document.getElementById("edDidYouKnow").value.trim() || "Este ponto foi mapeado diretamente usando coordenadas esféricas (Pitch/Yaw).";
          newHs.image = document.getElementById("edImageUrl").value.trim() || scene.thumbPhoto;
          newHs.imageAnnotations = [
            { label: title, x: 50, y: 45, arrowDir: "down" }
          ];
        } else if (type === "3d") {
          let rawUrl = document.getElementById("ed3DUrl").value.trim() || "https://sketchfab.com/models/24bae8a09c8d41f7b098fd98ac7e9b7e/embed?autostart=1";
          // Se o usuário colou o link normal do Sketchfab, converte automaticamente para /embed!
          const matchSf = rawUrl.match(/sketchfab\.com\/(?:3d-models\/[^/]+-|models\/)([a-f0-9]{32})/i);
          if (matchSf && !rawUrl.includes("/embed")) {
            rawUrl = `https://sketchfab.com/models/${matchSf[1]}/embed?autostart=1&ui_infos=0`;
          }
          newHs.embedUrl = rawUrl;
          newHs.subtitleLead = document.getElementById("ed3DLead").value.trim() || "Modelo tridimensional interativo incorporado via link externo.";
          newHs.paragraphs = [
            document.getElementById("ed3DDesc").value.trim() || "Utilize o mouse para rotacionar, dar zoom e inspecionar o modelo 3D em tempo real."
          ];
          newHs.didYouKnow = "Qualquer modelo do Sketchfab, Polycam ou Luma AI pode ser embutido passando a URL de embed!";
          newHs.fallback3DType = "sc_state";
        } else if (type === "scene") {
          newHs.targetSceneId = document.getElementById("edTargetScene").value;
        }

        scene.hotspots.push(newHs);
        state.activeCategoryFilter = "all";
        renderSceneHotspotsDOM(scene);
        updateExportJsonBox();
      });
    }

    // Botão Copiar / Baixar JSON
    const btnCopyJson = document.getElementById("btnCopyExportJson");
    if (btnCopyJson) {
      btnCopyJson.addEventListener("click", () => {
        updateExportJsonBox();
        const box = document.getElementById("edExportJsonTextarea");
        box.select();
        navigator.clipboard.writeText(box.value).catch(() => {});
        btnCopyJson.textContent = "JSON Copiado para a Área de Transferência!";
        setTimeout(() => { btnCopyJson.textContent = "Gerar & Copiar Código JSON da Cena"; }, 2500);
      });
    }
  }

  function populateEditorCoordinates(pitch, yaw) {
    const pInput = document.getElementById("edPitch");
    const yInput = document.getElementById("edYaw");
    if (pInput) pInput.value = pitch;
    if (yInput) yInput.value = yaw;
    updateExportJsonBox();
  }

  function updateEditorSceneSelector() {
    const sel = document.getElementById("edTargetScene");
    if (!sel) return;
    sel.innerHTML = Object.values(window.TOUR_SC_DATA.scenes)
      .filter(sc => sc.id !== state.currentSceneId)
      .map(sc => `<option value="${sc.id}">${sc.order}. ${sc.title}</option>`)
      .join("");
    updateExportJsonBox();
  }

  function updateExportJsonBox() {
    const box = document.getElementById("edExportJsonTextarea");
    const scene = window.TOUR_SC_DATA.scenes[state.currentSceneId];
    if (!box || !scene) return;
    const cleanHotspots = (scene.hotspots || []).map(h => {
      const copy = Object.assign({}, h);
      delete copy._domEl;
      return copy;
    });
    box.value = JSON.stringify(cleanHotspots, null, 2);
  }

  function showClickCrosshairFeedback(x, y, coords) {
    const marker = document.createElement("div");
    marker.className = "editor-click-ping";
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.innerHTML = `<span>Pitch: ${coords.pitch}° | Yaw: ${coords.yaw}°</span>`;
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 1400);
  }

  // Exposição global para chamadas de botões externos / Mapa
  window.GeoSC360 = {
    getState: function () {
      return {
        currentSceneId: state.currentSceneId,
        yaw: state.yaw,
        pitch: state.pitch,
        hfov: state.hfov
      };
    },
    goToScene: function (sceneId, animate = true, keepSplitMap = false) {
      if (!(keepSplitMap && state.isScMapSplitOpen)) {
        closeAuxiliaryDrawers();
      }
      loadScene(sceneId, animate);
    },
    openRotaLumiar: function () {
      buildRioDaLuzIllustratedMap();
      openDrawer("rdlIllustratedModal");
    },
    openScMap: function (splitMode = false) {
      openScMapModal(Boolean(splitMode));
    },
    syncModalUiState: function () {
      syncModalUiState();
    },
    setRoutePointRole: function (pointKey, role, focusRoutePanel = false) {
      return setRoutePointRole(pointKey, role, focusRoutePanel);
    },
    moveRouteWaypoint: function (index, delta) {
      return moveRouteWaypoint(index, delta);
    },
    removeRouteWaypoint: function (index) {
      return removeRouteWaypoint(index);
    },
    clearCustomRoute: function () {
      return clearCustomRoute();
    },
    applyItemsAsCustomRoute: function (itemKeys) {
      return applyItemsAsCustomRoute(itemKeys);
    },
    getCustomRouteState: function () {
      return {
        origin: state.customRoute.origin,
        waypoints: [...state.customRoute.waypoints],
        destination: state.customRoute.destination,
        mapsUrl: buildCustomGoogleMapsDirectionsUrl()
      };
    },
    runMapAiSearch: function (queryText) {
      return runMapAiSearch(queryText);
    },
    clearMapAiSearch: function () {
      return clearMapAiSearch();
    },
    openPointInSatelliteStreetView: function (num) {
      openPointInSatelliteStreetView(num);
    },
    toggleSatelliteStreetView: function (forceState, customSpot) {
      toggleSatelliteStreetView(forceState, customSpot);
    },
    setStreetViewDropMode: function (active) {
      setSatelliteStreetViewDropMode(active);
    },
    dropPegmanOnStreet: function (lat, lng) {
      return dropPegmanAtLatLng(lat, lng);
    },
    executeRioDaLuzReturnNow: function () {
      return executeRioDaLuzReturnNow();
    },
    previewPegmanDragAtLatLng: function (lat, lng, tiltDeg = -8) {
      if (!state.leafletMap || typeof window.L === "undefined") return null;
      const mapEl = document.getElementById("leafletSCMap");
      if (!mapEl) return null;
      setSatelliteStreetViewCoverageVisible(true);
      const dockBtn = document.getElementById("btnSatFloatingPegman");
      if (dockBtn) dockBtn.classList.add("pegman-picked-up");
      const rect = mapEl.getBoundingClientRect();
      let pt = state.leafletMap.latLngToContainerPoint([lat, lng]);
      if (pt.x < 24 || pt.x > rect.width - 24 || pt.y < 24 || pt.y > rect.height - 24) {
        state.leafletMap.panTo([lat, lng], { animate: false });
        pt = state.leafletMap.latLngToContainerPoint([lat, lng]);
      }
      const clientX = rect.left + pt.x;
      const clientY = rect.top + pt.y - 8;
      return updatePegmanDragOverlayAtClient(clientX, clientY, tiltDeg);
    },
    setView: function (pitch, yaw) {
      if (typeof pitch === "number" && !Number.isNaN(pitch)) {
        state.pitch = pitch;
        state.targetPitch = pitch;
      }
      if (typeof yaw === "number" && !Number.isNaN(yaw)) {
        state.yaw = yaw;
        state.targetYaw = yaw;
      }
    }
  };
})();

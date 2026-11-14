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
    show3DLabels: true,
    activeCategoryFilter: "all",
    editorMode: false,
    lastClickedCoords: { pitch: 0, yaw: 0 },
    isTransitioning: false,
    cleanup3DModal: null,
    leafletMap: null,
    leafletMarkers: {}
  };

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
        // Ícones da Legenda do Mapa Oficial (Montanha ⛰️, Igreja ⛪, Clube de Tiro ⚔️)
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
        hs.type === "3d" ? "🧊 Modelo 3D Externo" :
        hs.type === "scene" ? "🌐 Ir para Foto 360°" : "📖 Informação & Foto";

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
  // 3. AÇÃO AO CLICAR EM UM HOTSPOT (INFO POPUP, 3D SKETCHFAB OU OUTRA FOTO 360°)
  // ===========================================================================
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
   * Abre o Pop-up Split-View de INFORMAÇÃO (Idêntico à Screenshot 2 do Geohereditas)
   */
  function openSplitModalInfo(hs) {
    cleanupPrevious3D();

    if (hs.showcaseCard) {
      const sc = hs.showcaseCard;
      modalLeftContent.innerHTML = `
        <div class="annotated-photo-wrapper">
          <div class="showcase-art-panel">
            <span class="showcase-art-badge">🏛️ ${sc.badge || "Patrimônio Cultural Tombado"}</span>
            <div class="showcase-art-mat">
              <img src="${hs.image || 'assets/fotos/riodaluz/casa_rux_aquarela.png'}" alt="${hs.title}" class="showcase-art-img ${sc.coverMain ? '' : 'art-contain'}" />
            </div>
            <div class="showcase-art-footer">
              <div class="showcase-art-caption-wrap">
                <span class="showcase-art-caption">${sc.caption || hs.title}</span>
                ${sc.address ? `<span class="showcase-art-address">📌 ${sc.address}</span>` : ""}
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
            <span>📍 Coordenadas na Esfera 360°: Pitch ${hs.pitch.toFixed(1)}° | Yaw ${hs.yaw.toFixed(1)}°</span>
          </div>
        </div>
      `;
    } else {
      // Lado Esquerdo: Imagem anotada com setas indicando feições geológicas/turísticas
      const annotationsHTML = (hs.imageAnnotations || []).map(ann => `
        <div class="geo-photo-annotation" style="left: ${ann.x}%; top: ${ann.y}%;">
          <div class="geo-ann-label">${ann.label}</div>
          <div class="geo-ann-arrow">↓</div>
        </div>
      `).join("");

      modalLeftContent.innerHTML = `
        <div class="annotated-photo-wrapper">
          <img src="${hs.image || 'assets/fotos/lagoa_conceicao.jpg'}" alt="${hs.title}" class="modal-main-photo ${hs.fitContain ? 'fit-contain' : ''}" />
          <div class="annotations-overlay">
            ${annotationsHTML}
          </div>
          <div class="photo-caption-bar">
            <span>📍 Coordenadas na Esfera 360°: Pitch ${hs.pitch.toFixed(1)}° | Yaw ${hs.yaw.toFixed(1)}°</span>
          </div>
        </div>
      `;
    }

    // Lado Direito: Card Editorial Branco com botão verde [X], título serifado e caixa "Você sabia?"
    renderRightEditorialCard(hs);
    splitModal.classList.add("open");
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
              🏔️ Vale do Rio da Luz
            </span>
          </div>

          <div id="localGLBContainer" class="local-3d-container"></div>
        </div>
      `;

      renderRightEditorialCard(hs);
      splitModal.classList.add("open");

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
            🌐 Modelo 3D Externo (Sketchfab)
          </button>
          <button type="button" class="btn-3d-mode" id="btnModeLocal3D">
            🧊 Maquete 3D Interativa (Offline/Local)
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
            <span class="sf-cube-icon">🧊</span>
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
        🗺️ Abrir Mapa Interativo Rota Lumiar (Todos os 26 Pontos) ↗
      </button>
    ` : "";

    modalRightContent.innerHTML = `
      <div class="editorial-ornament-circle"></div>
      <button type="button" class="editorial-close-btn" id="btnCloseSplitModal" title="Fechar (ESC)">
        ✕
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
  }

  // ===========================================================================
  // 4. LOOP DE RENDERIZAÇÃO 60 FPS E PROJEÇÃO MATEMÁTICA 3D -> 2D
  // ===========================================================================
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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, viewerCanvas.clientWidth || window.innerWidth);
    const cssH = Math.max(1, viewerCanvas.clientHeight || window.innerHeight);
    const pxW = Math.max(1, Math.round(cssW * dpr));
    const pxH = Math.max(1, Math.round(cssH * dpr));
    if (viewerCanvas.width !== pxW || viewerCanvas.height !== pxH) {
      viewerCanvas.width = pxW;
      viewerCanvas.height = pxH;
      if (gl) gl.viewport(0, 0, pxW, pxH);
    }

    // Desenha a esfera 360° via WebGL mantendo programa e textura vinculados
    if (gl && shaderProgram && !gl.isContextLost()) {
      const yawRad = state.yaw * DEG2RAD;
      const pitchRad = state.pitch * DEG2RAD;
      const tanHalfFov = Math.tan((state.hfov * DEG2RAD) * 0.5);
      const aspect = cssW / Math.max(1, cssH);

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

    // 4. Projeção perspectiva usando a distância focal horizontal (hfov)
    const tanHalfFov = Math.tan((state.hfov * DEG2RAD) * 0.5);
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

    const tanHalfFov = Math.tan((state.hfov * DEG2RAD) * 0.5);
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

    viewport.addEventListener("pointerdown", e => {
      if (e.target.closest(".hotspot-marker") || e.target.closest(".ui-layer")) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.pointerDownX = e.clientX;
      state.pointerDownY = e.clientY;
      viewport.style.cursor = state.editorMode ? "crosshair" : "grabbing";
    });

    window.addEventListener("pointermove", e => {
      if (!state.isDragging) return;
      const dx = e.clientX - state.dragStartX;
      const dy = e.clientY - state.dragStartY;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;

      const speed = state.hfov / 420;
      state.targetYaw = normalizeYaw(state.targetYaw - dx * speed);
      state.targetPitch = Math.max(-85, Math.min(85, state.targetPitch + dy * speed));
    });

    window.addEventListener("pointerup", e => {
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
    });

    viewport.addEventListener("wheel", e => {
      e.preventDefault();
      state.targetHfov = Math.max(38, Math.min(115, state.targetHfov + e.deltaY * 0.04));
    }, { passive: false });

    // Fechar modais com tecla ESC
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") {
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
    const btnToRdl = document.getElementById("btnSwitchToRotaLumiar");
    if (btnToRdl) {
      btnToRdl.addEventListener("click", () => {
        buildRioDaLuzIllustratedMap();
        openDrawer("rdlIllustratedModal");
      });
    }
    const btnToSat = document.getElementById("btnSwitchToSatellite");
    if (btnToSat) {
      btnToSat.addEventListener("click", () => {
        openDrawer("scMapModal");
        setTimeout(() => initOrUpdateLeafletMap(), 120);
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

    // Widget / Botão Google Maps Satélite (26 Pontos + Rota Lumiar)
    const btnMap = document.getElementById("btnOpenSCMap");
    if (btnMap) {
      btnMap.addEventListener("click", () => {
        toggleDrawer("scMapModal");
        setTimeout(() => initOrUpdateLeafletMap(), 120);
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
      });
    }

    // Botão Tela Cheia
    const btnFs = document.getElementById("btnFullscreen");
    if (btnFs) {
      btnFs.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
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
        const el = document.getElementById(targetId);
        if (el) el.classList.remove("open");
      });
    });
  }

  function openDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    closeAuxiliaryDrawers();
    el.classList.add("open");
  }

  function toggleDrawer(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isOpen = el.classList.contains("open");
    closeAuxiliaryDrawers();
    if (!isOpen) el.classList.add("open");
  }

  function closeAuxiliaryDrawers() {
    ["logicGuideModal", "scenesGridModal", "scMapModal", "rdlIllustratedModal"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("open");
    });
    setPlaceSelectorOpen(false);
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
    const btnFront = document.getElementById("btnRdlViewFront");
    const btnBack = document.getElementById("btnRdlViewBack");
    const btnZoomIn = document.getElementById("btnRdlZoomIn");
    const btnZoomOut = document.getElementById("btnRdlZoomOut");
    const btnZoomReset = document.getElementById("btnRdlZoomReset");
    const btnExpandMap = document.getElementById("btnRdlExpandMap");
    const zoomLabel = document.getElementById("rdlZoomLevelLabel");
    const layoutEl = document.querySelector("#rdlIllustratedModal .rdl-illustrated-layout");
    if (!mapBox || !listBox) return;

    const rotaData = window.ROTA_LUMIAR_DATA;
    if (!rotaData || !rotaData.points) return;

    if (introLead) introLead.textContent = rotaData.introText || "";
    if (creditsFooter) creditsFooter.textContent = rotaData.credits || "";

    let currentRegion = "all";
    let selectedNum = 1;
    let mapSide = "front";
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
      applyZoomTransform();
    }

    function renderMapSide() {
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
          pin.className = `rdl-map-pin-btn ${p.sceneId ? "has-360" : ""} ${p.num === selectedNum ? "active" : ""}`;
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

      if (btnFront) btnFront.classList.toggle("active", mapSide === "front");
      if (btnBack) btnBack.classList.toggle("active", mapSide === "back");
      applyZoomTransform();
    }

    if (!mapBox.dataset.zoomBound) {
      mapBox.dataset.zoomBound = "true";

      mapBox.addEventListener("wheel", e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.24 : 0.8;
        setZoomAround(zoomScale * factor, e.clientX, e.clientY);
      }, { passive: false });

      mapBox.addEventListener("dblclick", e => {
        if (e.target.closest(".rdl-map-pin-btn")) return;
        const next = zoomScale > 1.3 ? 1 : 2.25;
        setZoomAround(next, e.clientX, e.clientY);
      });

      mapBox.addEventListener("mousedown", e => {
        if (e.button !== 0 || zoomScale <= 1.01) {
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
    if (btnExpandMap && !btnExpandMap.dataset.bound && layoutEl) {
      btnExpandMap.dataset.bound = "true";
      btnExpandMap.addEventListener("click", () => {
        const isExpanded = layoutEl.classList.toggle("expanded");
        btnExpandMap.classList.toggle("active", isExpanded);
        btnExpandMap.textContent = isExpanded ? "⊟ Normal" : "⛶ Expandir";
        setTimeout(applyZoomTransform, 220);
      });
    }

    function buildGoogleMapsHref(p) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.googleQuery || p.endereco)}`;
    }

    function renderSelectedDetail(p) {
      if (!detailBox || !p) return;
      const gmapsHref = buildGoogleMapsHref(p);
      const contactLine = p.contatoUrl
        ? `<div><strong>Site / Facebook:</strong> <a href="${p.contatoUrl}" target="_blank" rel="noopener noreferrer">${p.contatoLabel || p.contatoUrl} ↗</a></div>`
        : "";
      const emailLine = p.email ? `<div><strong>E-mail:</strong> ${p.email}</div>` : "";
      const tourBtn = p.sceneId
        ? `<button type="button" class="rdl-action-btn rdl-action-360" data-open-scene="${p.sceneId}">🌐 Ver Panorama 360° Aqui</button>`
        : "";

      detailBox.innerHTML = `
        <div class="rdl-detail-head">
          <span class="rdl-list-badge ${p.sceneId ? "has-360" : ""}">${p.num}</span>
          <div>
            <strong style="font-size:15px;color:#fff;display:block;">${p.num}. ${p.name}</strong>
            <span class="rdl-detail-region">${p.region}</span>
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
            🗺️ Abrir no Google Maps ↗
          </a>
          ${tourBtn}
        </div>
      `;

      const sceneBtn = detailBox.querySelector("[data-open-scene]");
      if (sceneBtn) {
        sceneBtn.addEventListener("click", () => {
          closeAuxiliaryDrawers();
          loadScene(sceneBtn.getAttribute("data-open-scene"), true);
        });
      }
    }

    function renderPointsCards() {
      const visiblePoints = rotaData.points.filter(
        p => currentRegion === "all" || p.regionKey === currentRegion
      );

      listBox.innerHTML = visiblePoints.map(p => {
        const gmapsHref = buildGoogleMapsHref(p);
        const linkPart = p.contatoUrl
          ? `<div><strong>Rede / Site:</strong> <a href="${p.contatoUrl}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc;">${p.contatoLabel || p.contatoUrl}</a></div>`
          : "";
        return `
          <article class="rdl-point-card ${p.num === selectedNum ? "active" : ""}" data-card-num="${p.num}">
            <div class="rdl-card-top">
              <span class="rdl-list-badge ${p.sceneId ? "has-360" : ""}">${p.num}</span>
              <div>
                <strong style="font-size:13px;display:block;color:#fff;">${p.name}</strong>
                <small style="color:#86efac;font-size:10.5px;">${p.region}</small>
              </div>
            </div>
            <p class="rdl-card-desc">${p.description}</p>
            <div class="rdl-card-meta">
              <div><strong>Atendimento:</strong> ${p.atendimento}</div>
              <div><strong>Endereço:</strong> ${p.endereco}</div>
              <div><strong>Tel.:</strong> ${p.telefone}</div>
              ${linkPart}
            </div>
            <div class="rdl-detail-actions" style="margin-top:4px;">
              <a href="${gmapsHref}" target="_blank" rel="noopener noreferrer" class="rdl-action-btn rdl-action-gmaps">
                Google Maps ↗
              </a>
              ${p.sceneId ? `<button type="button" class="rdl-action-btn rdl-action-360" data-card-scene="${p.sceneId}">Foto 360°</button>` : ""}
            </div>
          </article>
        `;
      }).join("");

      listBox.querySelectorAll("[data-card-num]").forEach(card => {
        card.addEventListener("click", e => {
          if (e.target.closest("a") || e.target.closest("[data-card-scene]")) return;
          selectRotaPoint(Number(card.getAttribute("data-card-num")), false);
        });
      });

      listBox.querySelectorAll("[data-card-scene]").forEach(btn => {
        btn.addEventListener("click", () => {
          closeAuxiliaryDrawers();
          loadScene(btn.getAttribute("data-card-scene"), true);
        });
      });
    }

    function selectRotaPoint(num, scrollCard) {
      const point = rotaData.points.find(pt => pt.num === num) || rotaData.points[0];
      if (!point) return;
      selectedNum = point.num;
      renderSelectedDetail(point);

      mapBox.querySelectorAll(".rdl-map-pin-btn").forEach(pin => {
        pin.classList.toggle("active", Number(pin.dataset.pointNum) === point.num);
      });
      listBox.querySelectorAll("[data-card-num]").forEach(card => {
        const isCurrent = Number(card.getAttribute("data-card-num")) === point.num;
        card.classList.toggle("active", isCurrent);
        if (isCurrent && scrollCard) {
          card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
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
        });
      });
    }

    renderMapSide();
    renderPointsCards();
    selectRotaPoint(selectedNum, false);
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
          <p class="sgc-muni">📍 ${sc.municipality}</p>
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
  // 6. MAPA GOOGLE SATÉLITE GEORREFERENCIADO (TODOS OS 26 PONTOS DA ROTA LUMIAR)
  // ===========================================================================
  let activeScMapFilter = "all";

  function getRotaPointsForMap(filterKey) {
    const pts = (window.ROTA_LUMIAR_DATA && Array.isArray(window.ROTA_LUMIAR_DATA.points))
      ? window.ROTA_LUMIAR_DATA.points.filter(p => typeof p.lat === "number" && typeof p.lng === "number")
      : [];
    if (filterKey === "rio_da_luz") return pts.filter(p => p.regionKey === "rio_da_luz");
    if (filterKey === "testo_alto") return pts.filter(p => p.regionKey === "testo_alto");
    if (filterKey === "pano360") return pts.filter(p => Boolean(p.sceneId));
    return pts;
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

    return `
      <div style="min-width:235px;max-width:270px;font-family:Inter,sans-serif;color:#0f172a;">
        ${photoUrl ? `<img src="${photoUrl}" alt="${pt.name}" style="width:100%;height:88px;object-fit:cover;border-radius:6px;margin-bottom:7px;display:block;" />` : ""}
        <div style="font-size:10.5px;font-weight:800;color:#15803d;text-transform:uppercase;margin-bottom:2px;">Ponto ${pt.num} • ${pt.region}</div>
        <strong style="font-size:14px;color:#0f172a;display:block;line-height:1.25;">${pt.num}. ${pt.name}</strong>
        ${pt.description ? `<p style="font-size:11.5px;color:#334155;margin:5px 0;line-height:1.35;">${pt.description}</p>` : ""}
        ${pt.endereco ? `<div style="font-size:11px;color:#475569;margin:2px 0;">📍 ${pt.endereco}</div>` : ""}
        ${pt.atendimento ? `<div style="font-size:11px;color:#475569;margin:2px 0;">🕒 ${pt.atendimento}</div>` : ""}
        ${pt.telefone ? `<div style="font-size:11px;color:#475569;margin:2px 0;">📞 ${pt.telefone}</div>` : ""}
        <div style="font-size:10.5px;color:#64748b;font-family:monospace;margin-top:3px;">GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-top:8px;">
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer"
            style="display:block;text-align:center;padding:7px 10px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none;font-size:11.5px;font-weight:800;">
            🗺️ Ir para o Google Maps ↗
          </a>
          <a href="${gdirUrl}" target="_blank" rel="noopener noreferrer"
            style="display:block;text-align:center;padding:6px 10px;background:#0f766e;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:700;">
            🚗 Traçar Rota até Aqui ↗
          </a>
          ${pt.sceneId ? `
            <button type="button" onclick="window.GeoSC360.goToScene('${pt.sceneId}')"
              style="width:100%;padding:6px 10px;background:#15803d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11.5px;font-weight:800;">
              🌐 Ver Panorama 360° Aqui
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
      <div class="sc-sidebar-header">Pontos no Satélite (${pts.length}) • Clique para focar</div>
      ${pts.map(pt => {
        const numClass = pt.sceneId ? "is-360" : (pt.regionKey === "testo_alto" ? "region-testo" : "");
        const activeClass = pt.num === selectedNum ? "active" : "";
        return `
          <button type="button" class="sc-sidebar-item ${activeClass}" data-map-pt-num="${pt.num}">
            <span class="sc-sidebar-num ${numClass}">${pt.num}</span>
            <span class="sc-sidebar-info">
              <strong class="sc-sidebar-name">${pt.name}${pt.sceneId ? " 📷 360°" : ""}</strong>
              <span class="sc-sidebar-sub">${pt.endereco || pt.region}</span>
            </span>
          </button>
        `;
      }).join("")}
    `;

    sidebar.querySelectorAll("[data-map-pt-num]").forEach(btn => {
      btn.addEventListener("click", () => {
        const num = Number(btn.getAttribute("data-map-pt-num"));
        const pt = pts.find(p => p.num === num);
        if (!pt) return;
        sidebar.querySelectorAll(".sc-sidebar-item").forEach(el => el.classList.remove("active"));
        btn.classList.add("active");

        const marker = state.leafletMarkers && state.leafletMarkers[num];
        if (state.leafletMap && marker) {
          state.leafletMap.flyTo([pt.lat, pt.lng], pt.sceneId ? 16.5 : 15.5, { duration: 0.65 });
          setTimeout(() => marker.openPopup(), 260);
        }
      });
    });
  }

  function renderFilteredSatelliteMarkers(filterKey) {
    activeScMapFilter = filterKey || "all";
    const pts = getRotaPointsForMap(activeScMapFilter);
    renderMapSidebar(pts, null);

    document.querySelectorAll("#scMapQuickBar .sc-filter-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-map-filter") === activeScMapFilter);
    });

    if (!state.leafletMap || typeof window.L === "undefined") {
      const mapContainer = document.getElementById("leafletSCMap");
      if (mapContainer && typeof window.L === "undefined") {
        renderOfflineMapFallback(mapContainer, pts);
      }
      return;
    }

    if (state.leafletMarkersLayer) {
      state.leafletMarkersLayer.clearLayers();
    } else {
      state.leafletMarkersLayer = window.L.layerGroup().addTo(state.leafletMap);
    }
    state.leafletMarkers = {};

    if (pts.length >= 2) {
      window.L.polyline(pts.map(p => [p.lat, p.lng]), {
        color: "#facc15",
        weight: 2.5,
        opacity: 0.72,
        dashArray: "6 6"
      }).addTo(state.leafletMarkersLayer);
    }

    pts.forEach(pt => {
      let icon;
      if (pt.sceneId) {
        const shortBadge = pt.num === 1 ? "🏠 1. Casa Rux 360°" : "🏡 2. Schroeder Platz 360°";
        icon = window.L.divIcon({
          className: "gsat-pin-wrapper",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          popupAnchor: [0, -38],
          html: `<div class="gsat-pin-badge" title="${pt.num}. ${pt.name}">${shortBadge}</div>`
        });
      } else {
        const regClass = pt.regionKey === "testo_alto" ? "region-testo" : "";
        icon = window.L.divIcon({
          className: "gsat-pin-wrapper",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          popupAnchor: [0, -16],
          html: `<div class="gsat-num-pin ${regClass}" title="${pt.num}. ${pt.name}">${pt.num}</div>`
        });
      }

      const marker = window.L.marker([pt.lat, pt.lng], {
        icon,
        zIndexOffset: pt.sceneId ? 600 : 100 + (30 - pt.num)
      }).addTo(state.leafletMarkersLayer);

      marker.bindPopup(buildRotaPointGooglePopupHTML(pt), { maxWidth: 290 });
      marker.on("click", () => {
        const sidebarBtn = document.querySelector(`#scMapPointsSidebar [data-map-pt-num="${pt.num}"]`);
        if (sidebarBtn) {
          document.querySelectorAll("#scMapPointsSidebar .sc-sidebar-item").forEach(el => el.classList.remove("active"));
          sidebarBtn.classList.add("active");
          sidebarBtn.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
      state.leafletMarkers[pt.num] = marker;
    });

    if (pts.length > 0) {
      const bounds = window.L.latLngBounds(pts.map(p => [p.lat, p.lng]));
      state.leafletMap.fitBounds(bounds, {
        padding: [42, 42],
        maxZoom: activeScMapFilter === "pano360" ? 16 : 14
      });
    }
  }

  function initOrUpdateLeafletMap() {
    const mapContainer = document.getElementById("leafletSCMap");
    if (!mapContainer) return;

    if (typeof window.L === "undefined") {
      renderOfflineMapFallback(mapContainer, getRotaPointsForMap(activeScMapFilter));
      renderMapSidebar(getRotaPointsForMap(activeScMapFilter), null);
      bindScMapQuickButtons();
      return;
    }

    if (!state.leafletMap) {
      state.leafletMap = window.L.map("leafletSCMap", {
        center: [-26.625, -49.172],
        zoom: 12,
        maxZoom: 21
      });

      const googleHybrid = window.L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=y&hl=pt-BR&x={x}&y={y}&z={z}",
        {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 21,
          attribution: "Imagens © Google Satélite • Rota Lumiar (GeoSC 360°)"
        }
      );
      const googleSatelliteOnly = window.L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=s&hl=pt-BR&x={x}&y={y}&z={z}",
        {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 21,
          attribution: "Imagens © Google Satélite"
        }
      );
      const googleStreets = window.L.tileLayer(
        "https://mt{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}",
        {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 21,
          attribution: "© Google Maps"
        }
      );

      googleHybrid.addTo(state.leafletMap);
      window.L.control.layers({
        "🛰️ Google Satélite (Híbrido)": googleHybrid,
        "🌍 Google Satélite Puro": googleSatelliteOnly,
        "🗺️ Google Mapa de Ruas": googleStreets
      }).addTo(state.leafletMap);

      bindScMapQuickButtons();
    }

    state.leafletMap.invalidateSize();
    renderFilteredSatelliteMarkers(activeScMapFilter);
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
  }

  function renderOfflineMapFallback(container, pts) {
    const list = pts || getRotaPointsForMap(activeScMapFilter);
    container.innerHTML = `
      <div style="padding:18px;color:#fff;background:#10231c;height:100%;overflow:auto;">
        <h4 style="margin-bottom:10px;">🛰️ Pontos Georreferenciados no Google — Rota Lumiar (${list.length} pontos):</h4>
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
        btnCopyJson.textContent = "✅ JSON Copiado para a Área de Transferência!";
        setTimeout(() => { btnCopyJson.textContent = "📋 Gerar & Copiar Código JSON da Cena"; }, 2500);
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
    goToScene: function (sceneId, animate = true) {
      closeAuxiliaryDrawers();
      loadScene(sceneId, animate);
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

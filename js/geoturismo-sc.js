/**
 * ============================================================================
 * GEOTURISMO SC — Mapa 3D interativo das 10 Regiões Turísticas de Santa Catarina
 * ============================================================================
 * - Relevo 3D + satélite (GLB base: 3dmap.app/geoheritage id=sc), embutido em
 *   js/sc-mapa3d-glb.js para funcionar via file:// sem servidor.
 * - Polígonos das regiões com SIMBOLOGIA VAZADA (apenas contorno, cor por região)
 *   desenhados numa textura-overlay que "veste" o mesmo relevo (mesmas UVs).
 * - Rótulos clicáveis -> voo de câmera até a região.
 * - Vale Europeu -> zoom na região -> voo até o Vale do Rio da Luz -> Foto 360°
 *   (abre o passeio virtual existente, rio_da_luz_360.html, num overlay).
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loadingEl = $("geoLoading");

  function fail(msg) {
    loadingEl.innerHTML = '<p style="max-width:420px;text-align:center;color:#b91c1c">' + msg + "</p>";
  }
  if (!window.THREE || !THREE.GLTFLoader || !THREE.OrbitControls) return fail("Não foi possível carregar o three.js (js/vendor).");
  if (!window.SC_GEOTURISMO || !window.SC_MAP_GLB_B64) return fail("Arquivos de dados do mapa não encontrados.");

  const DATA = window.SC_GEOTURISMO;
  const G = DATA.georef;

  // Relação UV <-> coordenada local da malha do GLB (ajustada por mínimos quadrados nos vértices do topo)
  const UV_FIT = { au: 0.408323, bu: 0.500671, av: 0.590974, bv: 0.499044 };
  const OVERLAY_W = 3072;
  const OVERLAY_H = Math.round((OVERLAY_W * 4244) / 6144);
  const OV_S = OVERLAY_W / 4096;

  // --------------------------------------------------------------------------
  // Renderizador, cena, câmera, controles e luzes
  // --------------------------------------------------------------------------
  const canvas = $("geoCanvas");
  const stage = $("geoStage");
  const labelsLayer = $("geoLabels");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    return fail("Seu navegador não suporta WebGL, necessário para o mapa 3D.");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.005, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.08;
  controls.maxDistance = 7;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.zoomSpeed = 0.9;
  controls.autoRotateSpeed = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.3));
  scene.add(new THREE.AmbientLight(0xffffff, 0.38));
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(-1.3, 3.4, -1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 10 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  // --------------------------------------------------------------------------
  // Textura-overlay (simbologia vazada das regiões)
  // --------------------------------------------------------------------------
  const ovCanvas = document.createElement("canvas");
  ovCanvas.width = OVERLAY_W;
  ovCanvas.height = OVERLAY_H;
  const ctx = ovCanvas.getContext("2d");
  const overlayTex = new THREE.CanvasTexture(ovCanvas);
  overlayTex.flipY = false; // mesma convenção das UVs glTF
  overlayTex.encoding = THREE.sRGBEncoding;
  overlayTex.premultiplyAlpha = true;
  overlayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const overlayMat = new THREE.MeshBasicMaterial({
    map: overlayTex,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  // --------------------------------------------------------------------------
  // Estado
  // --------------------------------------------------------------------------
  const state = {
    model: null,
    topMesh: null,
    regions: [],
    byId: {},
    hoverId: null,
    selectedId: null,
    lineK: 1,
    overlayDirty: true,
    tween: null,
    seqTimers: [],
    seqActive: false,
    running: true,
    overview: null,
    rioWorld: null,
    viewOffX: 0,
    viewOffTarget: 0,
    pointer: new THREE.Vector2(),
    pickPending: false,
    w: 1,
    h: 1,
  };
  const raycaster = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);

  // --------------------------------------------------------------------------
  // Utilitários geográficos
  // --------------------------------------------------------------------------
  function lonLatToUV(lon, lat) {
    return { u: G.A * lon + G.B, v: G.C * lat + G.D };
  }

  function uvToWorld(u, v, lift) {
    const x = (u - UV_FIT.bu) / UV_FIT.au;
    const y = (v - UV_FIT.bv) / UV_FIT.av;
    const p = new THREE.Vector3(x, y, 0.5).applyMatrix4(state.topMesh.matrixWorld);
    raycaster.set(new THREE.Vector3(p.x, 6, p.z), DOWN);
    const hit = raycaster.intersectObject(state.topMesh, false)[0];
    p.y = (hit ? hit.point.y : 0) + (lift || 0);
    return p;
  }

  function b64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // --------------------------------------------------------------------------
  // Carregamento do GLB
  // --------------------------------------------------------------------------
  const loader = new THREE.GLTFLoader();
  let glbBuffer;
  try {
    glbBuffer = b64ToArrayBuffer(window.SC_MAP_GLB_B64);
  } catch (e) {
    return fail("Falha ao decodificar o modelo 3D.");
  }
  loader.parse(glbBuffer, "", onModelLoaded, (err) => {
    console.error(err);
    fail("Falha ao carregar o modelo 3D de Santa Catarina.");
  });

  function onModelLoaded(gltf) {
    const model = gltf.scene;
    state.model = model;
    scene.add(model);

    let maxCount = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.geometry.computeVertexNormals();
      const m = o.material;
      m.flatShading = false;
      m.roughness = 1;
      m.metalness = 0;
      if (m.map) {
        m.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        m.map.needsUpdate = true;
      }
      m.needsUpdate = true;
      const c = o.geometry.attributes.position.count;
      if (c > maxCount) {
        maxCount = c;
        state.topMesh = o;
      }
    });
    model.updateMatrixWorld(true);

    // Overlay com a mesma geometria do topo do relevo
    const ov = new THREE.Mesh(state.topMesh.geometry, overlayMat);
    ov.renderOrder = 2;
    state.topMesh.add(ov);
    model.updateMatrixWorld(true);

    buildRegions();
    buildLegend();
    buildLabels();
    computeOverview();
    drawOverlay();

    // Voo de abertura: de cima para a vista oblíqua
    const ovw = state.overview;
    camera.position.copy(ovw.target).add(new THREE.Vector3(0, 8.5, 0.6));
    controls.target.copy(ovw.target);
    controls.update();
    flyTo(ovw.pos, ovw.target, 2600);

    loadingEl.classList.add("is-done");
    handleDeepLink();
  }

  // --------------------------------------------------------------------------
  // Regiões: Path2D (espaço da textura), centro, raio e posição do rótulo
  // --------------------------------------------------------------------------
  function buildRegions() {
    DATA.regions.forEach((r) => {
      const path = new Path2D();
      r.rings.forEach((ring) => {
        ring.forEach(([u, v], i) => {
          const x = u * OVERLAY_W;
          const y = v * OVERLAY_H;
          if (i === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        });
        path.closePath();
      });
      const [u0, v0, u1, v1] = r.bboxUV;
      const a = uvToWorld(u0, v0);
      const b = uvToWorld(u1, v1);
      const center = uvToWorld((u0 + u1) / 2, (v0 + v1) / 2);
      const radius = 0.5 * Math.hypot(a.x - b.x, (a.z - b.z) * 1.25);
      const reg = Object.assign({}, r, {
        path,
        center,
        radius,
        labelWorld: uvToWorld(r.labelUV[0], r.labelUV[1], 0.004),
      });
      state.regions.push(reg);
      state.byId[r.id] = reg;
    });
    const rl = DATA.rioDaLuz;
    const uv = lonLatToUV(rl.lon, rl.lat);
    state.rioWorld = uvToWorld(uv.u, uv.v, 0.002);
  }

  function drawOverlay() {
    const k = state.lineK * OV_S;
    ctx.clearRect(0, 0, OVERLAY_W, OVERLAY_H);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    state.regions.forEach((r) => {
      const sel = r.id === state.selectedId;
      const hov = r.id === state.hoverId;
      ctx.save();
      ctx.clip(r.path); // a borda fica só do lado de dentro -> cada região mantém sua cor
      if (sel || hov) {
        ctx.globalAlpha = sel ? (hov ? 0.14 : 0.07) : 0.18;
        ctx.fillStyle = r.color;
        ctx.fill(r.path);
      }
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = (sel ? 94 : 62) * k;
      ctx.stroke(r.path);
      ctx.globalAlpha = 1;
      ctx.lineWidth = (sel || hov ? 36 : 24) * k;
      ctx.stroke(r.path);
      ctx.restore();
    });
    // filete branco central (contraste sobre o satélite)
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 4.5 * k;
    state.regions.forEach((r) => ctx.stroke(r.path));

    // anel-alvo vazado sobre o Vale do Rio da Luz quando Vale Europeu está ativo
    if (state.selectedId === "vale_europeu") {
      const rl = DATA.rioDaLuz;
      const uv = lonLatToUV(rl.lon, rl.lat);
      const rx = uv.u * OVERLAY_W;
      const ry = uv.v * OVERLAY_H;
      const rad = Math.max(10, 42 * k);
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(3, 14 * k);
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = Math.max(2, 8 * k);
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    overlayTex.needsUpdate = true;
    state.overlayDirty = false;
  }

  function regionAtUV(uv) {
    const x = uv.x * OVERLAY_W;
    const y = uv.y * OVERLAY_H;
    for (const r of state.regions) if (ctx.isPointInPath(r.path, x, y)) return r;
    return null;
  }

  function pick() {
    if (!state.topMesh) return null;
    raycaster.setFromCamera(state.pointer, camera);
    const hit = raycaster.intersectObject(state.topMesh, false)[0];
    if (!hit || !hit.uv) return null;
    return regionAtUV(hit.uv);
  }

  // --------------------------------------------------------------------------
  // Legenda, rótulos e pino 360°
  // --------------------------------------------------------------------------
  const legendList = $("geoLegendList");
  const labelEls = {};
  const legendEls = {};
  let pinEl = null;

  function buildLegend() {
    state.regions.forEach((r) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.setProperty("--c", r.color);
      btn.innerHTML =
        '<span class="geo-swatch"></span><span>' + r.name + "</span>" +
        (r.id === "vale_europeu" ? '<span class="geo-legend-360">360°</span>' : "");
      btn.addEventListener("mouseenter", () => setHover(r.id));
      btn.addEventListener("mouseleave", () => setHover(null));
      btn.addEventListener("click", () => selectRegion(r.id));
      li.appendChild(btn);
      legendList.appendChild(li);
      legendEls[r.id] = btn;
    });
  }

  function buildLabels() {
    state.regions.forEach((r) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "geo-region-label";
      el.style.setProperty("--c", r.color);
      el.innerHTML =
        '<span class="txt">' + r.name +
        (r.id === "vale_europeu" ? ' <span class="lbl-360">360°</span>' : "") +
        '</span><span class="stem"></span><span class="dot"></span>';
      el.addEventListener("mouseenter", () => setHover(r.id));
      el.addEventListener("mouseleave", () => setHover(null));
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectRegion(r.id);
      });
      labelsLayer.appendChild(el);
      labelEls[r.id] = el;
    });

    pinEl = document.createElement("button");
    pinEl.type = "button";
    pinEl.className = "geo-pin360";
    pinEl.title = "Entrar na foto 360° do Vale do Rio da Luz";
    pinEl.innerHTML =
      '<span class="pin-card"><span class="pin-badge"><span>360°</span></span>' +
      "<span>" + DATA.rioDaLuz.name + "<small>Rota Lumiar · Foto 360° de drone</small></span></span>" +
      '<span class="pin-stem"></span><span class="pin-pulse"></span>';
    pinEl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      goToRioDaLuz(true);
    });
    labelsLayer.appendChild(pinEl);
  }

  const tmpV = new THREE.Vector3();
  function placeEl(el, world) {
    tmpV.copy(world).project(camera);
    const vis = tmpV.z < 1 && tmpV.z > -1 && Math.abs(tmpV.x) < 1.15 && Math.abs(tmpV.y) < 1.15;
    const x = (tmpV.x * 0.5 + 0.5) * state.w;
    const y = (-tmpV.y * 0.5 + 0.5) * state.h;
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) translate(-50%,-100%)";
    el.style.visibility = vis ? "visible" : "hidden";
    return { x, y };
  }

  function updateLabels() {
    state.regions.forEach((r) => placeEl(labelEls[r.id], r.labelWorld));
    if (pinEl && state.rioWorld) placeEl(pinEl, state.rioWorld);
  }

  function refreshClasses() {
    state.regions.forEach((r) => {
      const el = labelEls[r.id];
      const lg = legendEls[r.id];
      const sel = state.selectedId === r.id;
      const hov = state.hoverId === r.id;
      el.classList.toggle("is-active", sel);
      el.classList.toggle("is-hover", hov);
      el.classList.toggle("is-faded", !!state.selectedId && !sel && !hov);
      lg.classList.toggle("is-active", sel);
      lg.classList.toggle("is-hover", hov);
    });
    // no Vale Europeu o rótulo da região dá lugar ao pino 360°
    if (labelEls.vale_europeu) labelEls.vale_europeu.classList.toggle("is-hidden", state.selectedId === "vale_europeu" && state.lineK < 0.35);
    if (pinEl) pinEl.classList.toggle("is-visible", state.selectedId === "vale_europeu");
  }

  function setHover(id) {
    if (state.hoverId === id) return;
    state.hoverId = id;
    state.overlayDirty = true;
    stage.classList.toggle("is-pointer", !!id);
    refreshClasses();
  }

  // --------------------------------------------------------------------------
  // Câmera: enquadramentos e voos
  // --------------------------------------------------------------------------
  function viewFor(center, radius, polarDeg, azimuthRad) {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const effAspect = (state.w - state.viewOffTarget * 2) / state.h;
    const hfov = 2 * Math.atan(Math.tan(fov / 2) * Math.max(0.3, effAspect));
    const f = Math.min(fov, hfov);
    const dist = radius / Math.sin(f / 2);
    const pol = THREE.MathUtils.degToRad(polarDeg);
    const az = azimuthRad || 0;
    const dir = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
    return { pos: center.clone().add(dir.multiplyScalar(dist)), target: center.clone() };
  }

  function computeOverview() {
    const box = new THREE.Box3().setFromObject(state.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    center.y = 0.03;
    const pad = state.w < state.h ? 1.18 : 0.98;
    state.overviewParams = { center, radius: Math.max(size.x, size.z * 1.3) * 0.5 * pad };
    state.overview = viewFor(center, state.overviewParams.radius, 40, 0);
  }

  function flyTo(pos, target, dur, done) {
    const p0 = camera.position.clone();
    state.tween = {
      p0,
      t0: controls.target.clone(),
      p1: pos.clone(),
      t1: target.clone(),
      start: null,
      dur: dur || 1500,
      arc: Math.min(0.9, p0.distanceTo(pos) * 0.16),
      done,
    };
  }

  function stepTween(now) {
    const tw = state.tween;
    if (!tw) return;
    if (tw.start === null) tw.start = now;
    const t = Math.max(0, Math.min(1, (now - tw.start) / tw.dur));
    const e = easeInOut(t);
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    camera.position.y += Math.sin(Math.PI * e) * tw.arc;
    controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (t >= 1) {
      state.tween = null;
      if (tw.done) tw.done();
    }
  }

  // --------------------------------------------------------------------------
  // Card de informação
  // --------------------------------------------------------------------------
  const card = $("geoInfoCard");

  function showCard(r) {
    const is360 = r.id === "vale_europeu";
    card.style.setProperty("--c", r.color);
    card.innerHTML =
      '<div class="geo-card-bar"></div><div class="geo-card-body">' +
      '<button type="button" class="geo-card-close" title="Fechar e voltar à visão geral">✕</button>' +
      '<span class="kicker">Região turística</span><h2>' + r.name + "</h2>" +
      "<p>" + r.description + "</p>" +
      '<div class="chips">' + r.highlights.map((h) => '<span class="chip">' + h + "</span>").join("") + "</div>" +
      "<details><summary>" + r.municipios.length + " municípios</summary><p>" + r.municipios.join(", ") + "</p></details>" +
      (is360
        ? '<button type="button" class="geo-cta-360" data-go360>🌐 Ir ao Rio da Luz · Foto 360°</button>' +
          '<div class="geo-progress"><i></i></div>'
        : '<span class="geo-soon">📷 Fotos 360° desta região em breve</span>') +
      "</div>";
    card.hidden = false;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
    card.querySelector(".geo-card-close").addEventListener("click", goOverview);
    const cta = card.querySelector("[data-go360]");
    if (cta) cta.addEventListener("click", () => goToRioDaLuz(true));
    state.viewOffTarget = window.innerWidth > 820 ? 195 : 0;
  }

  function hideCard() {
    card.hidden = true;
    state.viewOffTarget = 0;
  }

  function setProgress(ms) {
    const bar = card.querySelector(".geo-progress");
    if (!bar) return;
    const i = bar.querySelector("i");
    if (!ms) {
      bar.classList.remove("is-on");
      i.style.transition = "none";
      i.style.width = "0";
      return;
    }
    bar.classList.add("is-on");
    i.style.transition = "none";
    i.style.width = "0";
    void i.offsetWidth;
    i.style.transition = "width " + ms + "ms linear";
    i.style.width = "100%";
  }

  // --------------------------------------------------------------------------
  // Toast
  // --------------------------------------------------------------------------
  const toastEl = $("geoToast");
  let toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), ms || 2200);
  }

  // --------------------------------------------------------------------------
  // Ações principais
  // --------------------------------------------------------------------------
  function later(fn, ms) {
    state.seqTimers.push(setTimeout(fn, ms));
  }

  function cancelSequence() {
    state.seqTimers.forEach(clearTimeout);
    state.seqTimers = [];
    if (state.seqActive) {
      state.seqActive = false;
      setProgress(0);
    }
  }

  function selectRegion(id, opts) {
    const r = state.byId[id];
    if (!r) return;
    opts = opts || {};
    cancelSequence();
    controls.autoRotate = false;
    $("btnGeoRotate").classList.remove("is-on");
    state.selectedId = id;
    state.overlayDirty = true;
    refreshClasses();
    showCard(r);
    hideHint();
    const v = viewFor(r.center, r.radius, 46, 0);
    if (id === "vale_europeu") {
      ensureIframe(); // pré-carrega o passeio 360° durante o voo
      flyTo(v.pos, v.target, 1700, () => {
        if (!opts.noSequence) goToRioDaLuz(false);
      });
    } else {
      flyTo(v.pos, v.target, 1600);
    }
  }

  /** Zoom do Vale Europeu até o Vale do Rio da Luz e entrada na foto 360°. */
  function goToRioDaLuz(fromClick) {
    if (state.selectedId !== "vale_europeu") {
      state.selectedId = "vale_europeu";
      state.overlayDirty = true;
      refreshClasses();
      showCard(state.byId.vale_europeu);
    }
    cancelSequence();
    state.seqActive = true;
    ensureIframe();
    const wait = fromClick ? 150 : 650;
    const flight = 2400;
    const pause = 700;
    setProgress(wait + flight + pause);
    toast("✈️ Voando até o Vale do Rio da Luz…", wait + flight);
    later(() => {
      const v = viewFor(state.rioWorld, 0.135, 43, 0.14);
      flyTo(v.pos, v.target, flight, () => {
        if (!state.seqActive) return;
        toast("🌐 Entrando na foto 360°…", pause + 600);
        later(() => {
          state.seqActive = false;
          setProgress(0);
          open360();
        }, pause);
      });
    }, wait);
  }

  function goOverview() {
    cancelSequence();
    state.selectedId = null;
    state.overlayDirty = true;
    refreshClasses();
    hideCard();
    const o = viewFor(state.overviewParams.center, state.overviewParams.radius, 40, 0);
    flyTo(o.pos, o.target, 1500);
  }

  // --------------------------------------------------------------------------
  // Overlay 360° (passeio virtual: rio_da_luz_360.html)
  // --------------------------------------------------------------------------
  const overlay = $("tour360Overlay");
  const backBtn = $("btnBackToMap");
  let iframe = null;

  function ensureIframe() {
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.title = "Foto 360° — Vale Tombado do Rio da Luz";
    iframe.allow = "fullscreen; gyroscope; accelerometer; xr-spatial-tracking";
    iframe.setAttribute("allowfullscreen", "");
    iframe.addEventListener("load", () => iframe.classList.add("is-ready"));
    iframe.src = DATA.rioDaLuz.tourUrl;
    overlay.insertBefore(iframe, backBtn);
    return iframe;
  }

  function open360() {
    cancelSequence();
    ensureIframe();
    const p = state.rioWorld ? placeEl(pinEl, state.rioWorld) : { x: state.w / 2, y: state.h / 2 };
    overlay.style.setProperty("--ox", p.x + "px");
    overlay.style.setProperty("--oy", p.y + "px");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    later(() => {
      if (overlay.classList.contains("is-open")) stopLoop();
    }, 1200);
    try {
      history.replaceState(null, "", "#rio-da-luz-360");
    } catch (e) { /* file:// em alguns navegadores */ }
  }

  function close360() {
    startLoop();
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) { /* noop */ }
    later(() => selectRegion("vale_europeu", { noSequence: true }), 350);
  }
  backBtn.addEventListener("click", close360);

  // --------------------------------------------------------------------------
  // Interação no canvas
  // --------------------------------------------------------------------------
  let downAt = null;
  function userInterrupt() {
    if (state.tween || state.seqActive) {
      state.tween = null;
      cancelSequence();
    }
    hideHint();
  }

  canvas.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    userInterrupt();
  });
  canvas.addEventListener("wheel", userInterrupt, { passive: true });
  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    state.pickPending = e.pointerType === "mouse";
  });
  canvas.addEventListener("pointerleave", () => setHover(null));
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const dt = performance.now() - downAt.t;
    downAt = null;
    if (moved > 6 || dt > 600) return;
    const rect = canvas.getBoundingClientRect();
    state.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const r = pick();
    if (r) selectRegion(r.id);
    else if (state.selectedId) goOverview();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (overlay.classList.contains("is-open")) close360();
    else if (state.selectedId) goOverview();
  });

  // Toolbar
  $("btnGeoOverview").addEventListener("click", goOverview);
  $("btnGeoRotate").addEventListener("click", (e) => {
    controls.autoRotate = !controls.autoRotate;
    e.currentTarget.classList.toggle("is-on", controls.autoRotate);
  });
  $("btnGeoFullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    else document.exitFullscreen && document.exitFullscreen();
  });

  const hintEl = $("geoHint");
  function hideHint() {
    hintEl.classList.add("is-hidden");
  }

  // Deep link: geoturismosc.html?regiao=vale_europeu  |  #rio-da-luz-360
  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    const reg = params.get("regiao");
    if (location.hash === "#rio-da-luz-360") {
      setTimeout(() => goToRioDaLuz(true), 2700);
    } else if (reg && state.byId[reg]) {
      setTimeout(() => selectRegion(reg, { noSequence: params.get("auto360") === "0" }), 2700);
    }
  }

  // --------------------------------------------------------------------------
  // Redimensionamento e loop de renderização
  // --------------------------------------------------------------------------
  function resize() {
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    renderer.setSize(state.w, state.h, false);
    camera.aspect = state.w / state.h;
    applyViewOffset();
    if (!card.hidden) state.viewOffTarget = state.w > 820 ? 195 : 0;
  }

  function applyViewOffset() {
    if (Math.abs(state.viewOffX) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(state.w, state.h, state.viewOffX, 0, state.w, state.h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  let lastLineCheck = 0;
  let prevFrameNow = null;
  function loop(now) {
    const dt = prevFrameNow === null ? 0.016 : Math.min(0.1, Math.max(0.001, (now - prevFrameNow) / 1000));
    prevFrameNow = now;
    stepTween(now);

    // deslocamento lateral suave quando o card está aberto (independente de FPS)
    const offDiff = state.viewOffTarget - state.viewOffX;
    if (Math.abs(offDiff) > 0.5) {
      state.viewOffX += offDiff * (1 - Math.exp(-8 * dt));
      applyViewOffset();
    } else if (state.viewOffX !== state.viewOffTarget) {
      state.viewOffX = state.viewOffTarget;
      applyViewOffset();
    }

    controls.update();

    // espessura das linhas acompanha o zoom (redesenho com limiar)
    if (now - lastLineCheck > 120) {
      lastLineCheck = now;
      const dist = camera.position.distanceTo(controls.target);
      const k = THREE.MathUtils.clamp(dist / 3.1, 0.05, 1.25);
      if (Math.abs(k - state.lineK) / state.lineK > 0.16) {
        state.lineK = k;
        state.overlayDirty = true;
        refreshClasses();
      }
    }

    if (state.pickPending && !state.tween) {
      state.pickPending = false;
      const r = pick();
      setHover(r ? r.id : null);
    }

    if (state.overlayDirty && state.topMesh) drawOverlay();
    renderer.render(scene, camera);
    if (state.topMesh) updateLabels();
  }

  function startLoop() {
    if (state.running) return;
    state.running = true;
    renderer.setAnimationLoop(loop);
  }
  function stopLoop() {
    state.running = false;
    renderer.setAnimationLoop(null);
  }
  renderer.setAnimationLoop(loop);

  // API para depuração / integração
  window.GeoturismoSC = { selectRegion, goOverview, goToRioDaLuz, open360, close360, state };
})();

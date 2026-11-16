/**
 * ============================================================================
 * GEOTURISMO SC — Mapa 3D interativo das 10 Regiões Turísticas de Santa Catarina
 * ============================================================================
 * - Relevo 3D + satélite 4K (GLB base: 3dmap.app/geoheritage id=sc).
 *   Carrega binário direto via HTTP/HTTPS (GitHub Pages) e usa Base64 via
 *   js/sc-mapa3d-glb.js quando aberto localmente via file:///.
 * - Simbologia vazada das 10 regiões renderizada em GPU via Shader SDF + ID
 *   (zero redesenho de canvas 2D e zero upload de textura durante zoom/hover).
 * - ShadowMap estático (renderizado 1 vez), renderização sob demanda (0% GPU
 *   em repouso) e grade espacial 2D para raycasting instantâneo.
 * - Vale Europeu -> zoom na região -> voo até o Vale do Rio da Luz -> Foto 360°
 *   (rio_da_luz_360.html) sem disputar GPU durante o voo.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const loadingEl = $("geoLoading");

  function fail(msg) {
    loadingEl.innerHTML = '<p style="max-width:420px;text-align:center;color:#b91c1c">' + msg + "</p>";
  }
  if (!window.THREE || !THREE.GLTFLoader || !THREE.OrbitControls) return fail("Não foi possível carregar o three.js (js/vendor).");
  if (!window.SC_GEOTURISMO || !window.SC_REGIOES_SDF) return fail("Arquivos de dados do mapa não encontrados.");

  const DATA = window.SC_GEOTURISMO;
  const SDF_DATA = window.SC_REGIOES_SDF;
  const G = DATA.georef;

  // Relação UV <-> coordenada local da malha do topo do GLB
  const UV_FIT = { au: 0.408323, bu: 0.500671, av: 0.590974, bv: 0.499044 };

  // --------------------------------------------------------------------------
  // Renderizador, cena, câmera, controles e luzes
  // --------------------------------------------------------------------------
  const canvas = $("geoCanvas");
  const stage = $("geoStage");
  const labelsLayer = $("geoLabels");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    return fail("Seu navegador não suporta WebGL, necessário para o mapa 3D.");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.005, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
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
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 10 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.005;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  // --------------------------------------------------------------------------
  // Shader GPU de Simbologia Vazada (ID + Distance Field)
  // --------------------------------------------------------------------------
  function hexToVec3(hex) {
    const n = parseInt(hex.slice(1), 16);
    return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  }

  function loadPngTexture(b64, nearest) {
    const tex = new THREE.Texture();
    tex.flipY = false;
    tex.generateMipmaps = false;
    tex.minFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    tex.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
      requestRender();
    };
    img.src = "data:image/png;base64," + b64;
    return tex;
  }

  const idTex = loadPngTexture(SDF_DATA.idPngB64, true);
  const sdfTex = loadPngTexture(SDF_DATA.sdfPngB64, false);
  const colorVecs = [new THREE.Vector3(1, 1, 1)];
  DATA.regions.forEach((r) => colorVecs.push(hexToVec3(r.color)));

  const rlInit = DATA.rioDaLuz;
  const rioInitUV = new THREE.Vector2(G.A * rlInit.lon + G.B, G.C * rlInit.lat + G.D);

  const overlayMat = new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    uniforms: {
      uIdTex: { value: idTex },
      uSdfTex: { value: sdfTex },
      uTexSize: { value: new THREE.Vector2(SDF_DATA.w, SDF_DATA.h) },
      uMaxDistPx: { value: SDF_DATA.maxDistPx },
      uSelectedId: { value: 0 },
      uHoverId: { value: 0 },
      uShowRioRing: { value: 0.0 },
      uRioUv: { value: rioInitUV },
      uColors: { value: colorVecs },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uIdTex;
      uniform sampler2D uSdfTex;
      uniform vec2 uTexSize;
      uniform float uMaxDistPx;
      uniform int uSelectedId;
      uniform int uHoverId;
      uniform float uShowRioRing;
      uniform vec2 uRioUv;
      uniform vec3 uColors[11];
      varying vec2 vUv;

      vec3 getRegionColor(int id) {
        if (id == 1) return uColors[1];
        if (id == 2) return uColors[2];
        if (id == 3) return uColors[3];
        if (id == 4) return uColors[4];
        if (id == 5) return uColors[5];
        if (id == 6) return uColors[6];
        if (id == 7) return uColors[7];
        if (id == 8) return uColors[8];
        if (id == 9) return uColors[9];
        if (id == 10) return uColors[10];
        return vec3(1.0);
      }

      void main() {
        int rid = int(floor(texture2D(uIdTex, vUv).r * 255.0 + 0.5));
        if (rid == 0) discard;

        vec3 col = getRegionColor(rid);
        float distTex = texture2D(uSdfTex, vUv).r * uMaxDistPx;
        vec2 dUv = fwidth(vUv * uTexSize);
        float texPerScreen = max(0.08, length(dUv) * 0.7071);
        float distScreen = distTex / texPerScreen;

        bool isSel = (rid == uSelectedId);
        bool isHov = (rid == uHoverId);

        float borderEnd = (isSel || isHov) ? 4.2 : 3.1;
        float glowEnd = (isSel || isHov) ? 8.5 : 6.4;
        float glowStrength = (isSel || isHov) ? 0.34 : 0.28;

        float borderAlpha = 1.0 - smoothstep(borderEnd - 1.1, borderEnd, distScreen);
        float glowAlpha = (1.0 - smoothstep(borderEnd - 0.4, glowEnd, distScreen)) * glowStrength;
        float fillAlpha = isSel ? (isHov ? 0.14 : 0.07) : (isHov ? 0.18 : 0.0);
        float whiteAlpha = 1.0 - smoothstep(0.55, 1.35, distScreen);

        float outAlpha = max(max(borderAlpha, glowAlpha), fillAlpha);
        vec3 outCol = col;
        outCol = mix(outCol, vec3(1.0), whiteAlpha * 0.95);
        outAlpha = max(outAlpha, whiteAlpha * 0.95);

        if (uShowRioRing > 0.5) {
          float rDistPx = length((vUv - uRioUv) * uTexSize) / texPerScreen;
          float rWhite = 1.0 - smoothstep(1.5, 3.0, abs(rDistPx - 14.0));
          float rPink = 1.0 - smoothstep(0.8, 2.0, abs(rDistPx - 14.0));
          outCol = mix(outCol, vec3(1.0), rWhite);
          outCol = mix(outCol, vec3(0.957, 0.247, 0.369), rPink);
          outAlpha = max(outAlpha, max(rWhite, rPink));
        }

        if (outAlpha < 0.004) discard;
        gl_FragColor = vec4(outCol, outAlpha);
      }
    `,
  });

  // --------------------------------------------------------------------------
  // Estado
  // --------------------------------------------------------------------------
  const state = {
    model: null,
    topMesh: null,
    triGrid: null,
    regions: [],
    byId: {},
    idxById: {},
    hoverId: null,
    selectedId: null,
    tween: null,
    seqTimers: [],
    seqActive: false,
    paused: false,
    rafId: 0,
    dirty: true,
    overview: null,
    overviewParams: null,
    rioWorld: null,
    viewOffX: 0,
    viewOffTarget: 0,
    pointer: new THREE.Vector2(),
    isDragging: false,
    lastPickAt: 0,
    pickPending: false,
    w: 1,
    h: 1,
  };
  const raycaster = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);

  // --------------------------------------------------------------------------
  // Grade espacial 2D da malha do topo (raycasting < 0.05 ms em 45k triângulos)
  // --------------------------------------------------------------------------
  function buildTriGrid(mesh) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position.array;
    const uvAttr = geom.attributes.uv ? geom.attributes.uv.array : null;
    const idxAttr = geom.index ? geom.index.array : null;
    const triCount = idxAttr ? (idxAttr.length / 3) | 0 : (geom.attributes.position.count / 3) | 0;

    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const minX = bb.min.x - 1e-4;
    const minY = bb.min.y - 1e-4;
    const maxX = bb.max.x + 1e-4;
    const maxY = bb.max.y + 1e-4;
    const cols = 40;
    const rows = 28;
    const cellW = (maxX - minX) / cols;
    const cellH = (maxY - minY) / rows;
    const cells = new Array(cols * rows);
    for (let i = 0; i < cells.length; i++) cells[i] = [];

    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr ? idxAttr[t * 3] : t * 3;
      const i1 = idxAttr ? idxAttr[t * 3 + 1] : t * 3 + 1;
      const i2 = idxAttr ? idxAttr[t * 3 + 2] : t * 3 + 2;
      const x0 = pos[i0 * 3], y0 = pos[i0 * 3 + 1];
      const x1 = pos[i1 * 3], y1 = pos[i1 * 3 + 1];
      const x2 = pos[i2 * 3], y2 = pos[i2 * 3 + 1];
      const c0 = Math.max(0, Math.min(cols - 1, ((Math.min(x0, x1, x2) - minX) / cellW) | 0));
      const c1 = Math.max(0, Math.min(cols - 1, ((Math.max(x0, x1, x2) - minX) / cellW) | 0));
      const r0 = Math.max(0, Math.min(rows - 1, ((Math.min(y0, y1, y2) - minY) / cellH) | 0));
      const r1 = Math.max(0, Math.min(rows - 1, ((Math.max(y0, y1, y2) - minY) / cellH) | 0));
      for (let r = r0; r <= r1; r++) {
        const rowOff = r * cols;
        for (let c = c0; c <= c1; c++) cells[rowOff + c].push(t);
      }
    }

    const invWorld = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    return {
      mesh, pos, uvAttr, idxAttr, bb, minX, minY, maxX, maxY, cols, rows, cellW, cellH, cells, invWorld,
      testedStamp: new Uint32Array(triCount),
      stamp: 1,
    };
  }

  const _rayLocal = new THREE.Ray();
  const _boxHitMin = new THREE.Vector3();
  const _boxHitMax = new THREE.Vector3();

  function raycastTopGrid(worldRay) {
    const g = state.triGrid;
    if (!g) return null;
    _rayLocal.copy(worldRay).applyMatrix4(g.invWorld);
    if (!_rayLocal.intersectsBox(g.bb)) return null;

    // Clipa o raio pelo intervalo Z (altura local) da malha para limitar células testadas
    const oz = _rayLocal.origin.z, dz = _rayLocal.direction.z;
    let tMin = 0, tMax = 1e6;
    if (Math.abs(dz) > 1e-7) {
      const ta = (g.bb.min.z - 0.02 - oz) / dz;
      const tb = (g.bb.max.z + 0.02 - oz) / dz;
      tMin = Math.max(0, Math.min(ta, tb));
      tMax = Math.max(tMin, Math.max(ta, tb));
    } else {
      tMax = 6;
    }
    _rayLocal.at(tMin, _boxHitMin);
    _rayLocal.at(tMax, _boxHitMax);

    const c0 = Math.max(0, Math.min(g.cols - 1, ((Math.min(_boxHitMin.x, _boxHitMax.x) - g.minX) / g.cellW) | 0));
    const c1 = Math.max(0, Math.min(g.cols - 1, ((Math.max(_boxHitMin.x, _boxHitMax.x) - g.minX) / g.cellW) | 0));
    const r0 = Math.max(0, Math.min(g.rows - 1, ((Math.min(_boxHitMin.y, _boxHitMax.y) - g.minY) / g.cellH) | 0));
    const r1 = Math.max(0, Math.min(g.rows - 1, ((Math.max(_boxHitMin.y, _boxHitMax.y) - g.minY) / g.cellH) | 0));

    const ox = _rayLocal.origin.x, oy = _rayLocal.origin.y;
    const dx = _rayLocal.direction.x, dy = _rayLocal.direction.y;
    const pos = g.pos, idx = g.idxAttr, uv = g.uvAttr;
    const stamp = ++g.stamp;
    let bestT = Infinity, bestU = 0, bestV = 0;

    for (let r = r0; r <= r1; r++) {
      const rowOff = r * g.cols;
      for (let c = c0; c <= c1; c++) {
        const list = g.cells[rowOff + c];
        for (let k = 0; k < list.length; k++) {
          const tri = list[k];
          if (g.testedStamp[tri] === stamp) continue;
          g.testedStamp[tri] = stamp;

          const i0 = idx ? idx[tri * 3] : tri * 3;
          const i1 = idx ? idx[tri * 3 + 1] : tri * 3 + 1;
          const i2 = idx ? idx[tri * 3 + 2] : tri * 3 + 2;

          const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
          const e1x = pos[i1 * 3] - ax, e1y = pos[i1 * 3 + 1] - ay, e1z = pos[i1 * 3 + 2] - az;
          const e2x = pos[i2 * 3] - ax, e2y = pos[i2 * 3 + 1] - ay, e2z = pos[i2 * 3 + 2] - az;

          const px = dy * e2z - dz * e2y;
          const py = dz * e2x - dx * e2z;
          const pz = dx * e2y - dy * e2x;
          const det = e1x * px + e1y * py + e1z * pz;
          if (det > -1e-8 && det < 1e-8) continue;
          const invDet = 1 / det;

          const tx = ox - ax, ty = oy - ay, tz = oz - az;
          const u = (tx * px + ty * py + tz * pz) * invDet;
          if (u < 0 || u > 1) continue;

          const qx = ty * e1z - tz * e1y;
          const qy = tz * e1x - tx * e1z;
          const qz = tx * e1y - ty * e1x;
          const v = (dx * qx + dy * qy + dz * qz) * invDet;
          if (v < 0 || u + v > 1) continue;

          const t = (e2x * qx + e2y * qy + e2z * qz) * invDet;
          if (t > 0 && t < bestT) {
            bestT = t;
            if (uv) {
              const w = 1 - u - v;
              bestU = w * uv[i0 * 2] + u * uv[i1 * 2] + v * uv[i2 * 2];
              bestV = w * uv[i0 * 2 + 1] + u * uv[i1 * 2 + 1] + v * uv[i2 * 2 + 1];
            }
          }
        }
      }
    }

    if (bestT === Infinity) return null;
    const hitPoint = new THREE.Vector3().copy(_rayLocal.origin).addScaledVector(_rayLocal.direction, bestT);
    hitPoint.applyMatrix4(g.mesh.matrixWorld);
    return { point: hitPoint, uv: { x: bestU, y: bestV } };
  }

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
    const hit = raycastTopGrid(raycaster.ray);
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
  // Carregamento do GLB (HTTP binário direto; fallback Base64 via file:///)
  // --------------------------------------------------------------------------
  const loader = new THREE.GLTFLoader();

  function loadB64Fallback() {
    if (window.SC_MAP_GLB_B64) {
      parseB64Glb();
      return;
    }
    const s = document.createElement("script");
    s.src = "js/sc-mapa3d-glb.js";
    s.onload = parseB64Glb;
    s.onerror = () => fail("Não foi possível carregar o modelo 3D de Santa Catarina.");
    document.body.appendChild(s);
  }

  function parseB64Glb() {
    try {
      const buf = b64ToArrayBuffer(window.SC_MAP_GLB_B64);
      loader.parse(buf, "", onModelLoaded, (err) => {
        console.error(err);
        fail("Falha ao carregar o modelo 3D de Santa Catarina.");
      });
    } catch (e) {
      fail("Falha ao decodificar o modelo 3D.");
    }
  }

  if (location.protocol === "file:") {
    loadB64Fallback();
  } else {
    loader.load("assets/modelos/sc_terreno.glb", onModelLoaded, undefined, loadB64Fallback);
  }

  function onModelLoaded(gltf) {
    const model = gltf.scene;
    state.model = model;
    scene.add(model);

    let maxCount = 0;
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
        m.map.anisotropy = maxAniso;
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
    state.triGrid = buildTriGrid(state.topMesh);

    // Overlay SDF em GPU com a mesma geometria do topo do relevo
    const ov = new THREE.Mesh(state.topMesh.geometry, overlayMat);
    ov.renderOrder = 2;
    state.topMesh.add(ov);
    model.updateMatrixWorld(true);

    // Renderiza a sombra solar estática uma única vez
    renderer.shadowMap.needsUpdate = true;

    buildRegions();
    buildLegend();
    buildLabels();
    computeOverview();

    // Voo de abertura: de cima para a vista oblíqua
    const ovw = state.overview;
    camera.position.copy(ovw.target).add(new THREE.Vector3(0, 8.5, 0.6));
    controls.target.copy(ovw.target);
    controls.update();
    flyTo(ovw.pos, ovw.target, 2200);

    loadingEl.classList.add("is-done");
    requestRender();
    handleDeepLink();
  }

  // --------------------------------------------------------------------------
  // Regiões: hit-test analítico (sem canvas 2D), centro, raio e rótulo
  // --------------------------------------------------------------------------
  function pointInRing(u, v, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function buildRegions() {
    DATA.regions.forEach((r, idx) => {
      const [u0, v0, u1, v1] = r.bboxUV;
      const a = uvToWorld(u0, v0);
      const b = uvToWorld(u1, v1);
      const center = uvToWorld((u0 + u1) / 2, (v0 + v1) / 2);
      const radius = 0.5 * Math.hypot(a.x - b.x, (a.z - b.z) * 1.25);
      const reg = Object.assign({}, r, {
        shaderIdx: idx + 1,
        uMin: Math.min(u0, u1),
        uMax: Math.max(u0, u1),
        vMin: Math.min(v0, v1),
        vMax: Math.max(v0, v1),
        center,
        radius,
        labelWorld: uvToWorld(r.labelUV[0], r.labelUV[1], 0.004),
      });
      state.regions.push(reg);
      state.byId[r.id] = reg;
      state.idxById[r.id] = idx + 1;
    });
    const rl = DATA.rioDaLuz;
    const uv = lonLatToUV(rl.lon, rl.lat);
    state.rioWorld = uvToWorld(uv.u, uv.v, 0.002);
  }

  function regionAtUV(uv) {
    const u = uv.x, v = uv.y;
    for (let i = 0; i < state.regions.length; i++) {
      const r = state.regions[i];
      if (u < r.uMin || u > r.uMax || v < r.vMin || v > r.vMax) continue;
      for (let k = 0; k < r.rings.length; k++) {
        if (pointInRing(u, v, r.rings[k])) return r;
      }
    }
    return null;
  }

  function pick() {
    if (!state.triGrid) return null;
    raycaster.setFromCamera(state.pointer, camera);
    const hit = raycastTopGrid(raycaster.ray);
    if (!hit) return null;
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
    for (let i = 0; i < state.regions.length; i++) {
      const r = state.regions[i];
      placeEl(labelEls[r.id], r.labelWorld);
    }
    if (pinEl && state.rioWorld) placeEl(pinEl, state.rioWorld);
  }

  function refreshClasses() {
    const closeVale = state.selectedId === "vale_europeu" && camera.position.distanceTo(controls.target) < 0.75;
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
    if (labelEls.vale_europeu) labelEls.vale_europeu.classList.toggle("is-hidden", closeVale);
    if (pinEl) pinEl.classList.toggle("is-visible", state.selectedId === "vale_europeu");
  }

  function setHover(id) {
    if (state.hoverId === id) return;
    state.hoverId = id;
    overlayMat.uniforms.uHoverId.value = id ? (state.idxById[id] || 0) : 0;
    stage.classList.toggle("is-pointer", !!id);
    refreshClasses();
    requestRender();
  }

  function setSelected(id) {
    state.selectedId = id;
    overlayMat.uniforms.uSelectedId.value = id ? (state.idxById[id] || 0) : 0;
    overlayMat.uniforms.uShowRioRing.value = id === "vale_europeu" ? 1.0 : 0.0;
    refreshClasses();
    requestRender();
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
    requestRender();
  }

  function stepTween(now) {
    const tw = state.tween;
    if (!tw) return false;
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
    return true;
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
    requestRender();
  }

  function hideCard() {
    card.hidden = true;
    state.viewOffTarget = 0;
    requestRender();
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
    setSelected(id);
    showCard(r);
    hideHint();
    const v = viewFor(r.center, r.radius, 46, 0);
    if (id === "vale_europeu") {
      flyTo(v.pos, v.target, 1600, () => {
        if (!opts.noSequence) goToRioDaLuz(false);
      });
    } else {
      flyTo(v.pos, v.target, 1500);
    }
  }

  /** Zoom do Vale Europeu até o Vale do Rio da Luz e entrada na foto 360°. */
  function goToRioDaLuz(fromClick) {
    if (state.selectedId !== "vale_europeu") {
      setSelected("vale_europeu");
      showCard(state.byId.vale_europeu);
    }
    cancelSequence();
    state.seqActive = true;
    const wait = fromClick ? 120 : 550;
    const flight = 2100;
    const pause = 600;
    setProgress(wait + flight + pause);
    toast("✈️ Voando até o Vale do Rio da Luz…", wait + flight);
    later(() => {
      const v = viewFor(state.rioWorld, 0.135, 43, 0.14);
      flyTo(v.pos, v.target, flight, () => {
        if (!state.seqActive) return;
        toast("🌐 Entrando na foto 360°…", pause + 500);
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
    setSelected(null);
    hideCard();
    const o = viewFor(state.overviewParams.center, state.overviewParams.radius, 40, 0);
    flyTo(o.pos, o.target, 1400);
  }

  // --------------------------------------------------------------------------
  // Overlay 360° (passeio virtual: rio_da_luz_360.html)
  // --------------------------------------------------------------------------
  const overlay = $("tour360Overlay");
  const backBtn = $("btnBackToMap");
  let iframe = null;
  let unloadTimer = null;

  function ensureIframe() {
    clearTimeout(unloadTimer);
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.title = "Foto 360° — Vale Tombado do Rio da Luz";
    iframe.allow = "fullscreen; gyroscope; accelerometer; xr-spatial-tracking";
    iframe.setAttribute("allowfullscreen", "");
    iframe.addEventListener("load", () => iframe && iframe.classList.add("is-ready"));
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
      if (overlay.classList.contains("is-open")) pauseLoop();
    }, 1150);
    try {
      history.replaceState(null, "", "#rio-da-luz-360");
    } catch (e) { /* file:// em alguns navegadores */ }
  }

  function close360() {
    resumeLoop();
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) { /* noop */ }
    // Libera o contexto WebGL do iframe após o fechamento da transição
    unloadTimer = setTimeout(() => {
      if (!overlay.classList.contains("is-open") && iframe) {
        iframe.src = "about:blank";
        iframe.remove();
        iframe = null;
      }
    }, 1200);
    later(() => selectRegion("vale_europeu", { noSequence: true }), 320);
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

  controls.addEventListener("change", requestRender);
  controls.addEventListener("start", () => { state.isDragging = true; });
  controls.addEventListener("end", () => { state.isDragging = false; requestRender(); });

  canvas.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    userInterrupt();
  });
  canvas.addEventListener("wheel", userInterrupt, { passive: true });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || state.isDragging || state.tween) return;
    const now = performance.now();
    if (now - state.lastPickAt < 45) return;
    state.lastPickAt = now;
    const rect = canvas.getBoundingClientRect();
    state.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    state.pickPending = true;
    requestRender();
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
    requestRender();
  });
  $("btnGeoFullscreen").addEventListener("click", () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    else document.exitFullscreen && document.exitFullscreen();
  });

  const hintEl = $("geoHint");
  function hideHint() {
    hintEl.classList.add("is-hidden");
  }

  // Deep link: ?regiao=vale_europeu | #rio-da-luz-360
  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    const reg = params.get("regiao");
    if (location.hash === "#rio-da-luz-360") {
      setTimeout(() => goToRioDaLuz(true), 2300);
    } else if (reg && state.byId[reg]) {
      setTimeout(() => selectRegion(reg, { noSequence: params.get("auto360") === "0" }), 2300);
    }
  }

  // --------------------------------------------------------------------------
  // Redimensionamento e renderização sob demanda (0% GPU quando em repouso)
  // --------------------------------------------------------------------------
  function resize() {
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    renderer.setSize(state.w, state.h, false);
    camera.aspect = state.w / state.h;
    applyViewOffset();
    if (!card.hidden) state.viewOffTarget = state.w > 820 ? 195 : 0;
    requestRender();
  }

  function applyViewOffset() {
    if (Math.abs(state.viewOffX) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(state.w, state.h, state.viewOffX, 0, state.w, state.h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  let prevFrameNow = null;
  let lastDistRefresh = 0;

  function tick(now) {
    state.rafId = 0;
    state.dirty = false;
    if (state.paused) return;

    const dt = prevFrameNow === null ? 0.016 : Math.min(0.1, Math.max(0.001, (now - prevFrameNow) / 1000));
    prevFrameNow = now;

    const tweening = stepTween(now);

    let offsetMoving = false;
    const offDiff = state.viewOffTarget - state.viewOffX;
    if (Math.abs(offDiff) > 0.5) {
      state.viewOffX += offDiff * (1 - Math.exp(-8 * dt));
      applyViewOffset();
      offsetMoving = true;
    } else if (state.viewOffX !== state.viewOffTarget) {
      state.viewOffX = state.viewOffTarget;
      applyViewOffset();
      offsetMoving = true;
    }

    const controlsMoved = controls.update();

    if (state.pickPending && !tweening) {
      state.pickPending = false;
      const r = pick();
      setHover(r ? r.id : null);
    }

    if (state.selectedId === "vale_europeu" && now - lastDistRefresh > 120) {
      lastDistRefresh = now;
      refreshClasses();
    }

    if (state.topMesh) {
      renderer.render(scene, camera);
      updateLabels();
    }

    if (tweening || offsetMoving || controlsMoved || controls.autoRotate || state.dirty) {
      scheduleTick();
    } else {
      prevFrameNow = null;
    }
  }

  function scheduleTick() {
    if (!state.rafId && !state.paused) {
      state.rafId = requestAnimationFrame(tick);
    }
  }

  function requestRender() {
    state.dirty = true;
    scheduleTick();
  }

  function pauseLoop() {
    state.paused = true;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function resumeLoop() {
    state.paused = false;
    prevFrameNow = null;
    requestRender();
  }

  resize();

  // API para depuração / integração
  window.GeoturismoSC = { selectRegion, goOverview, goToRioDaLuz, open360, close360, requestRender, state };
})();

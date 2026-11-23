/**
 * ============================================================================
 * GEOTURISMO SC — Mapa 3D interativo das 15 IGRs Oficiais de Santa Catarina
 * (Mapa do Turismo SC 2025 — SETUR-SC)
 * ============================================================================
 * - Relevo 3D + satélite 3K (GLB base: 3dmap.app/geoheritage id=sc).
 *   Carrega binário direto via HTTP/HTTPS (GitHub Pages) e usa Base64 via
 *   js/sc-mapa3d-glb.js quando aberto localmente via file:///.
 * - Simbologia vazada das 15 IGRs injetada direto no material do terreno
 *   via GPU Shader (onBeforeCompile + SDF + ID): contorno fino e limpo de cor
 *   única por região, sem borda dupla branca/vermelha e sem malha duplicada.
 * - Sombra estática pré-assada (sem shadowMap em tempo real), renderização sob
 *   demanda (0% GPU em repouso) e grade espacial 2D para raycasting instantâneo.
 * - Vale dos Encantos (Jaraguá do Sul) -> zoom -> Vale Tombado do Rio da Luz
 *   -> Foto 360° (rio_da_luz_360.html); Vale Europeu (Pomerode) também conecta.
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
  const UV_FIT = { au: 0.408323, bu: 0.500671, av: 0.590974, bv: 0.499044 };

  // --------------------------------------------------------------------------
  // Renderizador, cena, câmera, controles e luzes (sem shadowMap em tempo real)
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.005, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.095;
  controls.minDistance = 0.08;
  controls.maxDistance = 7;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(80);
  controls.zoomSpeed = 0.95;
  controls.autoRotateSpeed = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.42));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 0.46);
  sun.position.set(-1.3, 3.4, -1.5);
  scene.add(sun);

  // --------------------------------------------------------------------------
  // Texturas GPU compactas (ID + SDF + Paleta 16x1 + Sombra estática pré-assada)
  // --------------------------------------------------------------------------
  function loadPngTexture(b64, nearest, onReady) {
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
      if (onReady) onReady(tex);
      requestRender();
    };
    img.src = "data:image/png;base64," + b64;
    return tex;
  }

  const idTex = loadPngTexture(SDF_DATA.idPngB64, true);
  const sdfTex = loadPngTexture(SDF_DATA.sdfPngB64, false);

  // Paleta 16x1 RGBA (índice 1..15)
  const palData = new Uint8Array(16 * 4);
  DATA.regions.forEach((r, idx) => {
    const n = parseInt(r.color.slice(1), 16);
    const o = (idx + 1) * 4;
    palData[o] = (n >> 16) & 255;
    palData[o + 1] = (n >> 8) & 255;
    palData[o + 2] = n & 255;
    palData[o + 3] = 255;
  });
  const colorTex = new THREE.DataTexture(palData, 16, 1, THREE.RGBAFormat);
  colorTex.minFilter = THREE.NearestFilter;
  colorTex.magFilter = THREE.NearestFilter;
  colorTex.generateMipmaps = false;
  colorTex.needsUpdate = true;

  // Sombra estática pré-assada no plano do solo (custo GPU ~0)
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0613, 2.1151),
    new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      alphaMap: loadPngTexture(SDF_DATA.shadowPngB64, false),
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0.05, -0.002, 0.06);
  scene.add(shadowPlane);

  const dummyMaskTex = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1, THREE.RGBAFormat);
  dummyMaskTex.needsUpdate = true;

  const rlInit = DATA.rioDaLuz;
  const itInit = DATA.itajai3D || { lon: -48.75334, lat: -26.96899 };
  const borderUniforms = {
    uIdTex: { value: idTex },
    uSdfTex: { value: sdfTex },
    uColorTex: { value: colorTex },
    uTexSize: { value: new THREE.Vector2(SDF_DATA.w, SDF_DATA.h) },
    uMaxDistPx: { value: SDF_DATA.maxDistPx },
    uSelectedId: { value: 0 },
    uHoverId: { value: 0 },
    uShowRioRing: { value: 0.0 },
    uRioUv: { value: new THREE.Vector2(G.A * rlInit.lon + G.B, G.C * rlInit.lat + G.D) },
    uShowItajaiRing: { value: 0.0 },
    uItajaiUv: { value: new THREE.Vector2(G.A * itInit.lon + G.B, G.C * itInit.lat + G.D) },
    uItajaiFocus: { value: 0.0 },
    uItajaiMaskTex: { value: dummyMaskTex },
    uItajaiMaskBounds: { value: new THREE.Vector4(0.855, 0.630, 0.960, 0.765) },
  };

  function createTerrainMaterial(baseMat) {
    const mat = new THREE.MeshLambertMaterial({
      map: baseMat.map || null,
      color: 0xffffff,
    });
    mat.extensions = { derivatives: true };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, borderUniforms);
      shader.fragmentShader =
        `
        uniform sampler2D uIdTex;
        uniform sampler2D uSdfTex;
        uniform sampler2D uColorTex;
        uniform vec2 uTexSize;
        uniform float uMaxDistPx;
        uniform int uSelectedId;
        uniform int uHoverId;
        uniform float uShowRioRing;
        uniform vec2 uRioUv;
        uniform float uShowItajaiRing;
        uniform vec2 uItajaiUv;
        uniform float uItajaiFocus;
        uniform sampler2D uItajaiMaskTex;
        uniform vec4 uItajaiMaskBounds;
        ` +
        shader.fragmentShader.replace(
          "#include <output_fragment>",
          `
          #include <output_fragment>
          vec3 mFocusVal = vec3(0.0, 1.0, 0.0);
          bool inMaskRect = false;
          if (uItajaiFocus > 0.5) {
            vec2 mUv = (vUv - uItajaiMaskBounds.xy) / (uItajaiMaskBounds.zw - uItajaiMaskBounds.xy);
            inMaskRect = (mUv.x >= 0.0 && mUv.x <= 1.0 && mUv.y >= 0.0 && mUv.y <= 1.0);
            if (inMaskRect) {
              mFocusVal = texture2D(uItajaiMaskTex, mUv).rgb;
              if (mFocusVal.r > 0.55) {
                discard;
              }
            }
            // Focus + Context: suavizar e clarear SC ao redor para destacar Itajai 2x
            float luma = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb = mix(vec3(luma * 0.62 + 0.24), gl_FragColor.rgb, 0.28);
          }

          int rid = int(floor(texture2D(uIdTex, vUv).r * 255.0 + 0.5));
          if (rid > 0) {
            vec3 regSrgb = texture2D(uColorTex, vec2((float(rid) + 0.5) / 16.0, 0.5)).rgb;
            vec3 regLin = pow(regSrgb, vec3(2.2));
            float distTex = texture2D(uSdfTex, vUv).r * uMaxDistPx;
            vec2 dUv = fwidth(vUv * uTexSize);
            float texPerScreen = max(0.08, length(dUv) * 0.7071);
            float distScreen = distTex / texPerScreen;

            bool isSel = (rid == uSelectedId);
            bool isHov = (rid == uHoverId);

            // Simbologia vazada fina e limpa (suavizada no modo Focus+Context de Itajai)
            float borderEnd = (isSel || isHov) ? 2.3 : 1.65;
            float borderAlpha = 1.0 - smoothstep(borderEnd - 0.65, borderEnd, distScreen);
            float fillAlpha = isSel ? (isHov ? 0.14 : 0.07) : (isHov ? 0.16 : 0.0);
            if (uItajaiFocus > 0.5) {
              borderAlpha *= 0.26;
              fillAlpha *= 0.25;
            }

            float outAlpha = max(borderAlpha * 0.94, fillAlpha);
            if (outAlpha > 0.002) {
              gl_FragColor.rgb = mix(gl_FragColor.rgb, regLin, outAlpha);
            }
          }
          if (uItajaiFocus > 0.5 && inMaskRect) {
            // Sombra suave de contato + filete fino ao redor do recorte de Itajai
            float shadowF = 1.0 - smoothstep(0.0, 0.36, mFocusVal.g);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.09, 0.13, 0.20), shadowF * 0.40);
            float rimF = (1.0 - smoothstep(0.0, 0.075, mFocusVal.g)) * smoothstep(0.0, 0.015, mFocusVal.g);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.06, 0.48, 0.44), rimF * 0.72);
          }
          if (uShowRioRing > 0.5) {
            vec2 dUvR = fwidth(vUv * uTexSize);
            float tpsR = max(0.08, length(dUvR) * 0.7071);
            float rDistPx = length((vUv - uRioUv) * uTexSize) / tpsR;
            float ringA = 1.0 - smoothstep(0.9, 1.8, abs(rDistPx - 11.0));
            if (ringA > 0.002) {
              gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.91, 0.12, 0.35), ringA);
            }
          }
          if (uShowItajaiRing > 0.5) {
            vec2 dUvI = fwidth(vUv * uTexSize);
            float tpsI = max(0.08, length(dUvI) * 0.7071);
            float iDistPx = length((vUv - uItajaiUv) * uTexSize) / tpsI;
            float ringI = 1.0 - smoothstep(0.9, 1.8, abs(iDistPx - 11.5));
            if (ringI > 0.002) {
              gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.06, 0.46, 0.43), ringI);
            }
          }
          `
        );
    };
    mat.customProgramCacheKey = () => "geosc-setur15-sdf-v4";
    return mat;
  }

  // --------------------------------------------------------------------------
  // Estado (SC + modo municipal Itajaí sob demanda)
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
    itajaiWorld: null,
    itajaiRingsUV: null,
    itajaiBboxUV: null,
    viewOffX: 0,
    viewOffTarget: 0,
    pointer: new THREE.Vector2(),
    pointerClient: { x: 0, y: 0 },
    isDragging: false,
    lastPickAt: 0,
    pickPending: false,
    w: 1,
    h: 1,
  };

  const itajaiState = {
    active: false,
    loading: false,
    group: null,
    topMesh: null,
    triGrid: null,
    meta: null,
    bairros: [],
    byId: {},
    byIdx: {},
    selectedId: null,
    hoverId: null,
    showBorders: true,
    showLabels: true,
    overview: null,
    centerWorld: null,
    radiusWorld: 0.092,
    uniforms: null,
    idPixels: null,
    idW: 0,
    idH: 0,
    textures: [],
    savedScZ: null,
    labelEls: {},
    legendEls: {},
  };
  const raycaster = new THREE.Raycaster();
  const DOWN = new THREE.Vector3(0, -1, 0);

  // --------------------------------------------------------------------------
  // Grade espacial 2D da malha do topo (raycasting < 0.05 ms em 45k triângulos)
  // --------------------------------------------------------------------------
  function buildTriGrid(mesh, isYUp) {
    const geom = mesh.geometry;
    const pos = geom.attributes.position.array;
    const uvAttr = geom.attributes.uv ? geom.attributes.uv.array : null;
    const idxAttr = geom.index ? geom.index.array : null;
    const triCount = idxAttr ? (idxAttr.length / 3) | 0 : (geom.attributes.position.count / 3) | 0;
    const yAxisIdx = isYUp ? 2 : 1;

    geom.computeBoundingBox();
    const bb = geom.boundingBox.clone();
    const minX = bb.min.x - 1e-4;
    const minH = (isYUp ? bb.min.z : bb.min.y) - 1e-4;
    const maxX = bb.max.x + 1e-4;
    const maxH = (isYUp ? bb.max.z : bb.max.y) + 1e-4;
    const cols = 42;
    const rows = isYUp ? 48 : 28;
    const cellW = (maxX - minX) / cols;
    const cellH = (maxH - minH) / rows;
    const cells = new Array(cols * rows);
    for (let i = 0; i < cells.length; i++) cells[i] = [];

    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr ? idxAttr[t * 3] : t * 3;
      const i1 = idxAttr ? idxAttr[t * 3 + 1] : t * 3 + 1;
      const i2 = idxAttr ? idxAttr[t * 3 + 2] : t * 3 + 2;
      const x0 = pos[i0 * 3], h0 = pos[i0 * 3 + yAxisIdx];
      const x1 = pos[i1 * 3], h1 = pos[i1 * 3 + yAxisIdx];
      const x2 = pos[i2 * 3], h2 = pos[i2 * 3 + yAxisIdx];
      const c0 = Math.max(0, Math.min(cols - 1, ((Math.min(x0, x1, x2) - minX) / cellW) | 0));
      const c1 = Math.max(0, Math.min(cols - 1, ((Math.max(x0, x1, x2) - minX) / cellW) | 0));
      const r0 = Math.max(0, Math.min(rows - 1, ((Math.min(h0, h1, h2) - minH) / cellH) | 0));
      const r1 = Math.max(0, Math.min(rows - 1, ((Math.max(h0, h1, h2) - minH) / cellH) | 0));
      for (let r = r0; r <= r1; r++) {
        const rowOff = r * cols;
        for (let c = c0; c <= c1; c++) cells[rowOff + c].push(t);
      }
    }

    mesh.updateMatrixWorld(true);
    const invWorld = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    return {
      mesh, isYUp: Boolean(isYUp), pos, uvAttr, idxAttr, bb, minX, minH, maxX, maxH, cols, rows, cellW, cellH, cells, invWorld,
      testedStamp: new Uint32Array(triCount),
      stamp: 1,
    };
  }

  const _rayLocal = new THREE.Ray();
  const _boxHitMin = new THREE.Vector3();
  const _boxHitMax = new THREE.Vector3();

  function raycastGrid(g, worldRay) {
    if (!g) return null;
    _rayLocal.copy(worldRay).applyMatrix4(g.invWorld);
    if (!_rayLocal.intersectsBox(g.bb)) return null;

    const vMin = g.isYUp ? g.bb.min.y : g.bb.min.z;
    const vMax = g.isYUp ? g.bb.max.y : g.bb.max.z;
    const ov = g.isYUp ? _rayLocal.origin.y : _rayLocal.origin.z;
    const dv = g.isYUp ? _rayLocal.direction.y : _rayLocal.direction.z;
    let tMin = 0, tMax = 1e6;
    if (Math.abs(dv) > 1e-7) {
      const ta = (vMin - 0.02 - ov) / dv;
      const tb = (vMax + 0.02 - ov) / dv;
      tMin = Math.max(0, Math.min(ta, tb));
      tMax = Math.max(tMin, Math.max(ta, tb));
    } else {
      tMax = 6;
    }
    _rayLocal.at(tMin, _boxHitMin);
    _rayLocal.at(tMax, _boxHitMax);

    const hMinHit = g.isYUp ? Math.min(_boxHitMin.z, _boxHitMax.z) : Math.min(_boxHitMin.y, _boxHitMax.y);
    const hMaxHit = g.isYUp ? Math.max(_boxHitMin.z, _boxHitMax.z) : Math.max(_boxHitMin.y, _boxHitMax.y);
    const c0 = Math.max(0, Math.min(g.cols - 1, ((Math.min(_boxHitMin.x, _boxHitMax.x) - g.minX) / g.cellW) | 0));
    const c1 = Math.max(0, Math.min(g.cols - 1, ((Math.max(_boxHitMin.x, _boxHitMax.x) - g.minX) / g.cellW) | 0));
    const r0 = Math.max(0, Math.min(g.rows - 1, ((hMinHit - g.minH) / g.cellH) | 0));
    const r1 = Math.max(0, Math.min(g.rows - 1, ((hMaxHit - g.minH) / g.cellH) | 0));

    const ox = _rayLocal.origin.x, oy = _rayLocal.origin.y, oz = _rayLocal.origin.z;
    const dx = _rayLocal.direction.x, dy = _rayLocal.direction.y, dz = _rayLocal.direction.z;
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
    return { point: hitPoint, uv: { x: bestU, y: bestV }, distance: worldRay.origin.distanceTo(hitPoint) };
  }

  function raycastTopGrid(worldRay) {
    return raycastGrid(state.triGrid, worldRay);
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

    let topCandidate = null;
    let maxCount = 0;
    const meshes = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      meshes.push(o);
      o.geometry.computeVertexNormals();
      const c = o.geometry.attributes.position.count;
      if (c > maxCount) {
        maxCount = c;
        topCandidate = o;
      }
    });

    const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    meshes.forEach((o) => {
      const oldMat = o.material;
      if (oldMat && oldMat.map) {
        oldMat.map.anisotropy = maxAniso;
        oldMat.map.needsUpdate = true;
      }
      if (o === topCandidate) {
        o.material = createTerrainMaterial(oldMat);
      } else {
        o.material = new THREE.MeshLambertMaterial({
          map: oldMat && oldMat.map ? oldMat.map : null,
          color: 0xffffff,
        });
      }
    });

    state.topMesh = topCandidate;
    model.updateMatrixWorld(true);
    state.triGrid = buildTriGrid(state.topMesh, false);

    buildRegions();
    buildLegend();
    buildLabels();
    computeOverview();

    const ovw = state.overview;
    camera.position.copy(ovw.target).add(new THREE.Vector3(0, 7.5, 0.7));
    controls.target.copy(ovw.target);
    controls.update();
    flyTo(ovw.pos, ovw.target, 1400);

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
    if (DATA.itajai3D) {
      const it = DATA.itajai3D;
      const iuv = lonLatToUV(it.lon, it.lat);
      state.itajaiWorld = uvToWorld(iuv.u, iuv.v, 0.002);
      let uMin = 1, uMax = 0, vMin = 1, vMax = 0;
      state.itajaiRingsUV = (it.rings || []).map((ring) =>
        ring.map(([lon, lat]) => {
          const p = lonLatToUV(lon, lat);
          if (p.u < uMin) uMin = p.u;
          if (p.u > uMax) uMax = p.u;
          if (p.v < vMin) vMin = p.v;
          if (p.v > vMax) vMax = p.v;
          return [p.u, p.v];
        })
      );
      state.itajaiBboxUV = [uMin, vMin, uMax, vMax];
    }
  }

  function isPointInItajaiUV(uv) {
    if (!state.itajaiRingsUV || !state.itajaiBboxUV) return false;
    const [u0, v0, u1, v1] = state.itajaiBboxUV;
    if (uv.x < u0 || uv.x > u1 || uv.y < v0 || uv.y > v1) return false;
    for (let k = 0; k < state.itajaiRingsUV.length; k++) {
      if (pointInRing(uv.x, uv.y, state.itajaiRingsUV[k])) return true;
    }
    return false;
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
  const legendBox = $("geoLegendBox");
  const legendTitle = $("geoLegendTitle");
  const legendMinBtn = $("btnGeoLegendToggle");
  const legendSearchWrap = $("geoLegendSearchWrap");
  const legendSearch = $("geoLegendSearch");
  const legendList = $("geoLegendList");
  const headerKicker = $("geoHeaderKicker");
  const headerTitle = $("geoHeaderTitle");
  const creditsEl = $("geoCredits");
  const creditsDefaultHtml = creditsEl ? creditsEl.innerHTML : "";
  const hoverPill = $("geoHoverPill");
  const btnBackSC = $("btnGeoBackSC");
  const btnItajaiBorders = $("btnItajaiBorders");
  const btnItajaiLabels = $("btnItajaiLabels");
  const labelEls = {};
  const legendEls = {};
  let pinEl = null;
  let pinItajaiEl = null;

  function is360Region(id) {
    return id === "vale_dos_encantos";
  }

  function isItajaiRegion(id) {
    return id === "costa_verde_mar" && Boolean(DATA.itajai3D);
  }

  function has360Action(id) {
    return id === "vale_dos_encantos" || id === "vale_europeu";
  }

  function buildLegend() {
    legendList.innerHTML = "";
    state.regions.forEach((r) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.setProperty("--c", r.color);
      btn.innerHTML =
        '<span class="geo-swatch"></span><span>' + r.name + "</span>" +
        (is360Region(r.id) ? '<span class="geo-legend-360">360°</span>' : "") +
        (isItajaiRegion(r.id) ? '<span class="geo-legend-360" style="background:#0f766e">3D</span>' : "");
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
        (is360Region(r.id) ? ' <span class="lbl-360">360°</span>' : "") +
        (isItajaiRegion(r.id) ? ' <span class="lbl-360" style="background:#0f766e">3D</span>' : "") +
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

    if (DATA.itajai3D) {
      pinItajaiEl = document.createElement("button");
      pinItajaiEl.type = "button";
      pinItajaiEl.className = "geo-pin360 geo-pin3d";
      pinItajaiEl.title = "Abrir relevo 3D de Itajaí · 35 bairros sobre o estado";
      pinItajaiEl.innerHTML =
        '<span class="pin-card"><span class="pin-badge"><span>3D</span></span>' +
        "<span>" + DATA.itajai3D.name + "<small>Bairros 3D · MDT 2×</small></span></span>" +
        '<span class="pin-stem"></span><span class="pin-pulse"></span>';
      pinItajaiEl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        enterItajaiMode();
      });
      labelsLayer.appendChild(pinItajaiEl);
    }
  }

  const tmpV = new THREE.Vector3();
  function placeEl(el, world) {
    tmpV.copy(world).project(camera);
    const vis = tmpV.z < 1 && tmpV.z > -1 && Math.abs(tmpV.x) < 1.15 && Math.abs(tmpV.y) < 1.15;
    const x = (tmpV.x * 0.5 + 0.5) * state.w;
    const y = (-tmpV.y * 0.5 + 0.5) * state.h;
    el.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0) translate(-50%,-100%)";
    el.style.visibility = vis ? "visible" : "hidden";
    return { x, y, vis };
  }

  function updateItajaiLabels() {
    if (!itajaiState.showLabels) {
      Object.keys(itajaiState.labelEls).forEach((id) => itajaiState.labelEls[id].classList.add("is-culled"));
      return;
    }
    const dCam = itajaiState.centerWorld ? camera.position.distanceTo(itajaiState.centerWorld) : 0.25;
    // De longe exige mais respiro entre rótulos (mostra bairros principais); no zoom revela os bairros menores centrais
    const zoomSpan = THREE.MathUtils.clamp((dCam - 0.075) / 0.20, 0.0, 1.0);
    const gapScale = 1.0 + zoomSpan * 0.68;

    const placed = [];
    const ordered = itajaiState.bairros.slice().sort((a, b) => {
      const pa = a.id === itajaiState.selectedId ? -2 : (a.id === itajaiState.hoverId ? -1 : a._rank);
      const pb = b.id === itajaiState.selectedId ? -2 : (b.id === itajaiState.hoverId ? -1 : b._rank);
      return pa - pb;
    });
    ordered.forEach((b) => {
      const el = itajaiState.labelEls[b.id];
      if (!el || !b.worldPt) return;
      const p = placeEl(el, b.worldPt);
      if (!p.vis || p.x < -30 || p.x > state.w + 30 || p.y < 10 || p.y > state.h + 20) {
        el.classList.add("is-culled");
        return;
      }
      const isPrio = b.id === itajaiState.selectedId || b.id === itajaiState.hoverId;
      const bw = (b.nome.length * 6.0 + 24) * (isPrio ? 1.0 : gapScale);
      const bh = 22 * (isPrio ? 1.0 : gapScale);
      let overlaps = false;
      if (!isPrio) {
        for (let i = 0; i < placed.length; i++) {
          const q = placed[i];
          if (Math.abs(p.x - q.x) < (bw + q.w) * 0.48 && Math.abs(p.y - q.y) < (bh + q.h) * 0.55) {
            overlaps = true;
            break;
          }
        }
      }
      if (overlaps) {
        el.classList.add("is-culled");
      } else {
        el.classList.remove("is-culled");
        placed.push({ x: p.x, y: p.y, w: bw, h: bh });
      }
    });
  }

  function updateLabels() {
    if (itajaiState.active) {
      updateItajaiLabels();
      return;
    }
    for (let i = 0; i < state.regions.length; i++) {
      const r = state.regions[i];
      placeEl(labelEls[r.id], r.labelWorld);
    }
    if (pinEl && state.rioWorld) placeEl(pinEl, state.rioWorld);
    if (pinItajaiEl && state.itajaiWorld) placeEl(pinItajaiEl, state.itajaiWorld);
  }

  function refreshClasses() {
    const showPin = !itajaiState.active && has360Action(state.selectedId);
    const showItajaiPin = !itajaiState.active && isItajaiRegion(state.selectedId);
    state.regions.forEach((r) => {
      const el = labelEls[r.id];
      const lg = legendEls[r.id];
      const sel = state.selectedId === r.id;
      const hov = state.hoverId === r.id;
      el.classList.toggle("is-active", sel);
      el.classList.toggle("is-hover", hov);
      el.classList.toggle("is-faded", !!state.selectedId && !sel && !hov);
      el.classList.toggle("is-hidden", itajaiState.active);
      if (lg) {
        lg.classList.toggle("is-active", sel);
        lg.classList.toggle("is-hover", hov);
      }
    });
    if (labelEls.vale_dos_encantos) labelEls.vale_dos_encantos.classList.toggle("is-hidden", itajaiState.active || showPin);
    if (labelEls.costa_verde_mar) labelEls.costa_verde_mar.classList.toggle("is-hidden", itajaiState.active || showItajaiPin);
    if (pinEl) pinEl.classList.toggle("is-visible", showPin);
    if (pinItajaiEl) pinItajaiEl.classList.toggle("is-visible", showItajaiPin);
  }

  function setHover(id) {
    if (state.hoverId === id) return;
    state.hoverId = id;
    borderUniforms.uHoverId.value = id ? (state.idxById[id] || 0) : 0;
    stage.classList.toggle("is-pointer", !!id);
    refreshClasses();
    requestRender();
  }

  function setSelected(id) {
    state.selectedId = id;
    borderUniforms.uSelectedId.value = id ? (state.idxById[id] || 0) : 0;
    borderUniforms.uShowRioRing.value = has360Action(id) ? 1.0 : 0.0;
    borderUniforms.uShowItajaiRing.value = (!itajaiState.active && isItajaiRegion(id)) ? 1.0 : 0.0;
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
    const isPortrait = state.w < state.h;
    if (isPortrait) center.z += size.z * 0.25;
    const pad = isPortrait ? 1.15 : 0.98;
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
      dur: dur || 1200,
      arc: Math.min(0.75, p0.distanceTo(pos) * 0.14),
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
    const is360 = has360Action(r.id);
    const hasItajai = isItajaiRegion(r.id);
    const chipsHtml = r.highlights
      .map((h) =>
        hasItajai && h === "Itajaí"
          ? '<button type="button" class="chip chip-3d" data-go-itajai title="Abrir relevo 3D e 35 bairros de Itajaí sobre SC">📍 Itajaí · 3D</button>'
          : '<span class="chip">' + h + "</span>"
      )
      .join("");
    let actionHtml = '<span class="geo-soon">📷 Fotos 360° desta região em breve</span>';
    if (is360) {
      actionHtml =
        '<button type="button" class="geo-cta-360" data-go360>🌐 Ir ao Rio da Luz · Foto 360°</button>' +
        '<div class="geo-progress"><i></i></div>';
    } else if (hasItajai) {
      actionHtml =
        '<button type="button" class="geo-cta-360 geo-cta-3d" data-go-itajai>🏔️ Abrir Itajaí 3D sobre o mapa (35 bairros)</button>' +
        '<div class="geo-progress"><i></i></div>';
    }
    card.style.setProperty("--c", r.color);
    card.innerHTML =
      '<div class="geo-card-bar"></div><div class="geo-card-body">' +
      '<button type="button" class="geo-card-close" title="Fechar e voltar à visão geral">✕</button>' +
      '<span class="kicker">IGR · Mapa do Turismo SC 2025</span><h2>' + r.name + "</h2>" +
      "<p>" + r.description + "</p>" +
      '<div class="chips">' + chipsHtml + "</div>" +
      "<details><summary>" + r.municipios.length + " municípios</summary><p>" + r.municipios.join(", ") + "</p></details>" +
      actionHtml +
      "</div>";
    card.hidden = false;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
    card.querySelector(".geo-card-close").addEventListener("click", goOverview);
    const cta = card.querySelector("[data-go360]");
    if (cta) cta.addEventListener("click", () => goToRioDaLuz(true));
    card.querySelectorAll("[data-go-itajai]").forEach((el) => {
      el.addEventListener("click", () => enterItajaiMode());
    });
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
    const v = viewFor(r.center, Math.max(r.radius, 0.24), 46, 0);
    if (is360Region(id)) {
      flyTo(v.pos, v.target, 1150, () => {
        if (!opts.noSequence) goToRioDaLuz(false);
      });
    } else {
      flyTo(v.pos, v.target, 1150);
    }
  }

  /** Zoom até o Vale Tombado do Rio da Luz e entrada na foto 360°. */
  function goToRioDaLuz(fromClick) {
    if (!has360Action(state.selectedId)) {
      setSelected("vale_dos_encantos");
      showCard(state.byId.vale_dos_encantos);
    }
    cancelSequence();
    state.seqActive = true;
    const wait = fromClick ? 100 : 400;
    const flight = 1450;
    const pause = 450;
    setProgress(wait + flight + pause);
    toast("✈️ Voando até o Vale do Rio da Luz…", wait + flight);
    later(() => {
      const v = viewFor(state.rioWorld, 0.14, 43, 0.14);
      flyTo(v.pos, v.target, flight, () => {
        if (!state.seqActive) return;
        toast("🌐 Entrando na foto 360°…", pause + 400);
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
    if (itajaiState.active) {
      selectBairro(null, { focus: true });
      return;
    }
    setSelected(null);
    hideCard();
    const o = viewFor(state.overviewParams.center, state.overviewParams.radius, 40, 0);
    flyTo(o.pos, o.target, 1100);
  }

  // --------------------------------------------------------------------------
  // Itajaí 3D sobre Santa Catarina (carregado sob demanda ao clicar em Itajaí)
  // --------------------------------------------------------------------------
  function loadScriptOnce(src, readyCheck) {
    return new Promise((resolve, reject) => {
      if (readyCheck()) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => (readyCheck() ? resolve() : reject(new Error("Dados não inicializados: " + src)));
      s.onerror = () => reject(new Error("Falha ao carregar " + src));
      document.body.appendChild(s);
    });
  }

  function loadItajaiPngTex(b64, nearest, capturePixels) {
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
      if (capturePixels && window.ITAJAI_BAIRROS_SDF) {
        const w = window.ITAJAI_BAIRROS_SDF.w;
        const h = window.ITAJAI_BAIRROS_SDF.h;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        itajaiState.idPixels = ctx.getImageData(0, 0, w, h).data;
        itajaiState.idW = w;
        itajaiState.idH = h;
      }
      requestRender();
    };
    img.src = "data:image/png;base64," + b64;
    itajaiState.textures.push(tex);
    return tex;
  }

  function createItajaiMaterial(baseMat, IDATA, ISDF) {
    const iIdTex = loadItajaiPngTex(ISDF.idPngB64, true, true);
    const iSdfTex = loadItajaiPngTex(ISDF.sdfPngB64, false, false);

    const iPal = new Uint8Array(64 * 4);
    const tmpC = new THREE.Color();
    IDATA.bairros.forEach((b) => {
      tmpC.set(b.color);
      const o = b.idx * 4;
      iPal[o] = Math.round(tmpC.r * 255);
      iPal[o + 1] = Math.round(tmpC.g * 255);
      iPal[o + 2] = Math.round(tmpC.b * 255);
      iPal[o + 3] = 255;
    });
    const iColorTex = new THREE.DataTexture(iPal, 64, 1, THREE.RGBAFormat);
    iColorTex.minFilter = THREE.NearestFilter;
    iColorTex.magFilter = THREE.NearestFilter;
    iColorTex.generateMipmaps = false;
    iColorTex.needsUpdate = true;
    itajaiState.textures.push(iColorTex);

    itajaiState.uniforms = {
      uIdTex: { value: iIdTex },
      uSdfTex: { value: iSdfTex },
      uColorTex: { value: iColorTex },
      uTexSize: { value: new THREE.Vector2(ISDF.w, ISDF.h) },
      uMaxDistPx: { value: ISDF.maxDistPx },
      uSelectedId: { value: 0 },
      uHoverId: { value: 0 },
      uShowBorders: { value: itajaiState.showBorders ? 1.0 : 0.0 },
    };

    const mat = new THREE.MeshLambertMaterial({
      map: baseMat && baseMat.map ? baseMat.map : null,
      color: 0xffffff,
    });
    mat.extensions = { derivatives: true };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, itajaiState.uniforms);
      shader.fragmentShader =
        `
        uniform sampler2D uIdTex;
        uniform sampler2D uSdfTex;
        uniform sampler2D uColorTex;
        uniform vec2 uTexSize;
        uniform float uMaxDistPx;
        uniform int uSelectedId;
        uniform int uHoverId;
        uniform float uShowBorders;
        ` +
        shader.fragmentShader.replace(
          "#include <output_fragment>",
          `
          #include <output_fragment>
          int rid = int(floor(texture2D(uIdTex, vUv).r * 255.0 + 0.5));
          if (rid > 0) {
            vec3 regSrgb = texture2D(uColorTex, vec2((float(rid) + 0.5) / 64.0, 0.5)).rgb;
            vec3 regLin = pow(regSrgb, vec3(2.2));
            float distTex = texture2D(uSdfTex, vUv).r * uMaxDistPx;
            vec2 dUv = fwidth(vUv * uTexSize);
            float texPerScreen = max(0.08, length(dUv) * 0.7071);
            float distScreen = distTex / texPerScreen;

            bool isSel = (rid == uSelectedId);
            bool isHov = (rid == uHoverId);

            float borderEnd = (isSel || isHov) ? 2.4 : (uShowBorders > 0.5 ? 1.65 : 0.0);
            float borderAlpha = (borderEnd > 0.05) ? (1.0 - smoothstep(borderEnd - 0.65, borderEnd, distScreen)) : 0.0;
            float fillAlpha = isSel ? (isHov ? 0.14 : 0.07) : (isHov ? 0.16 : 0.0);

            float outAlpha = max(borderAlpha * (isSel || isHov ? 0.98 : 0.92), fillAlpha);
            if (outAlpha > 0.002) {
              gl_FragColor.rgb = mix(gl_FragColor.rgb, regLin, outAlpha);
            }
          }
          `
        );
    };
    mat.customProgramCacheKey = () => "geosc-itajai35-inscene-v1";
    return mat;
  }

  function distPointToSegSq(px, py, ax, ay, bx, by) {
    const abx = bx - ax, aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    if (lenSq < 1e-12) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
    const dx = px - (ax + t * abx), dy = py - (ay + t * aby);
    return dx * dx + dy * dy;
  }

  function distToItajaiOutlineUV(u, v) {
    if (isPointInItajaiUV({ x: u, y: v })) return 0.0;
    const rings = state.itajaiRingsUV || [];
    let bestSq = 1e9;
    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const dSq = distPointToSegSq(u, v, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
        if (dSq < bestSq) bestSq = dSq;
      }
    }
    return Math.sqrt(bestSq);
  }

  function recessScInsideItajai() {
    if (!state.topMesh || itajaiState.savedScZ || !state.itajaiBboxUV) return;
    const geom = state.topMesh.geometry;
    const pos = geom.attributes.position.array;
    const uvs = geom.attributes.uv ? geom.attributes.uv.array : null;
    if (!uvs) return;
    const [u0, v0, u1, v1] = state.itajaiBboxUV;
    const apronOut = 0.028;
    const flatMargin = 0.0045;
    const saved = [];
    const targetLocalZ = 0.0942; // world_y = 0.11775 (nível costeiro limpo, sem paredões)
    const count = geom.attributes.position.count;
    for (let i = 0; i < count; i++) {
      const u = uvs[i * 2], v = uvs[i * 2 + 1];
      if (u < u0 - apronOut || u > u1 + apronOut || v < v0 - apronOut || v > v1 + apronOut) continue;
      const d = distToItajaiOutlineUV(u, v);
      if (d >= apronOut) continue;
      let w = 1.0;
      if (d > flatMargin) {
        const t = (d - flatMargin) / (apronOut - flatMargin);
        w = 1.0 - (t * t * (3.0 - 2.0 * t));
      }
      const z = pos[i * 3 + 2];
      if (z > targetLocalZ) {
        saved.push({ idx: i, z });
        pos[i * 3 + 2] = z * (1.0 - w) + targetLocalZ * w;
      }
    }
    if (saved.length) {
      geom.attributes.position.needsUpdate = true;
      itajaiState.savedScZ = saved;
    }
  }

  function restoreScElevation() {
    if (!state.topMesh || !itajaiState.savedScZ) return;
    const posAttr = state.topMesh.geometry.attributes.position;
    const pos = posAttr.array;
    for (let i = 0; i < itajaiState.savedScZ.length; i++) {
      const item = itajaiState.savedScZ[i];
      pos[item.idx * 3 + 2] = item.z;
    }
    posAttr.needsUpdate = true;
    itajaiState.savedScZ = null;
  }

  function findBairroAtUV(u, v) {
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    if (itajaiState.idPixels && itajaiState.idW) {
      const px = Math.max(0, Math.min(itajaiState.idW - 1, Math.floor(u * itajaiState.idW)));
      const py = Math.max(0, Math.min(itajaiState.idH - 1, Math.floor(v * itajaiState.idH)));
      const idx = itajaiState.idPixels[(py * itajaiState.idW + px) * 4];
      if (idx > 0 && itajaiState.byIdx[idx]) return itajaiState.byIdx[idx];
    }
    for (let i = 0; i < itajaiState.bairros.length; i++) {
      const b = itajaiState.bairros[i];
      const bb = b.bboxUV;
      if (u < bb[0] || u > bb[2] || v < bb[1] || v > bb[3]) continue;
      for (let k = 0; k < b.rings.length; k++) {
        if (pointInRing(u, v, b.rings[k])) return b;
      }
    }
    return null;
  }

  function uvToItajaiWorld(u, v, lift) {
    const ws = (itajaiState.meta && itajaiState.meta.worldSize) || [1.728747, 2.0];
    const pTop = new THREE.Vector3((u - 0.5) * ws[0], 1.5, (v - 0.5) * ws[1]).applyMatrix4(itajaiState.topMesh.matrixWorld);
    const pBot = new THREE.Vector3((u - 0.5) * ws[0], -1.0, (v - 0.5) * ws[1]).applyMatrix4(itajaiState.topMesh.matrixWorld);
    const dir = pBot.clone().sub(pTop).normalize();
    const hit = raycastGrid(itajaiState.triGrid, new THREE.Ray(pTop, dir));
    const pt = hit ? hit.point : new THREE.Vector3(pTop.x, 0.125, pTop.z);
    pt.y += lift || 0;
    return pt;
  }

  function buildItajaiUI() {
    legendBox.classList.add("is-itajai");
    legendBox.classList.remove("is-collapsed");
    legendTitle.textContent = "Bairros de Itajaí · 35 Oficiais (MDT 2×)";
    if (legendMinBtn) { legendMinBtn.hidden = false; legendMinBtn.textContent = "▾"; }
    if (legendSearchWrap) legendSearchWrap.hidden = false;
    if (legendSearch) legendSearch.value = "";
    if (headerKicker) headerKicker.textContent = "Geoturismo SC · Costa Verde & Mar";
    if (headerTitle) headerTitle.textContent = "Itajaí — Bairros (Relevo 2×)";
    if (creditsEl) {
      creditsEl.innerHTML =
        'Relevo 2×: <strong>GeoItajaí MDT + Ortoimagem 2024</strong> · Limites: <strong>Geoportal Itajaí (35 bairros)</strong> · Base estadual: <a href="https://3dmap.app/geoheritage/ra/index.php?id=sc" target="_blank" rel="noopener">3dmap.app</a>';
    }
    if (btnBackSC) btnBackSC.hidden = false;
    if (btnItajaiBorders) { btnItajaiBorders.hidden = false; btnItajaiBorders.classList.toggle("is-on", itajaiState.showBorders); }
    if (btnItajaiLabels) { btnItajaiLabels.hidden = false; btnItajaiLabels.classList.toggle("is-on", itajaiState.showLabels); }

    // Ordenar para declutter: maiores bairros primeiro
    const byArea = itajaiState.bairros.slice().sort((a, b) => b.areaKm2 - a.areaKm2);
    byArea.forEach((b, rank) => { b._rank = rank; });

    legendList.innerHTML = "";
    itajaiState.legendEls = {};
    itajaiState.labelEls = {};

    itajaiState.bairros.forEach((b) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.style.setProperty("--c", b.color);
      const has360 = b.photo360 && b.photo360.ready;
      btn.innerHTML =
        '<span class="geo-swatch"></span><span>' + b.nome + "</span>" +
        (has360 ? '<span class="geo-legend-360">360°</span>' : "");
      btn.addEventListener("mouseenter", () => setBairroHover(b.id));
      btn.addEventListener("mouseleave", () => { if (itajaiState.hoverId === b.id) setBairroHover(null); });
      btn.addEventListener("click", () => selectBairro(b.id, { focus: true }));
      li.appendChild(btn);
      legendList.appendChild(li);
      itajaiState.legendEls[b.id] = btn;

      const lbl = document.createElement("button");
      lbl.type = "button";
      lbl.className = "geo-region-label geo-b-label";
      lbl.style.setProperty("--c", b.color);
      lbl.innerHTML =
        '<span class="txt">' + b.nome +
        (has360 ? ' <span class="lbl-360">360°</span>' : "") +
        '</span><span class="stem"></span><span class="dot"></span>';
      lbl.addEventListener("mouseenter", () => setBairroHover(b.id));
      lbl.addEventListener("mouseleave", () => { if (itajaiState.hoverId === b.id) setBairroHover(null); });
      lbl.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectBairro(b.id, { focus: true });
      });
      labelsLayer.appendChild(lbl);
      itajaiState.labelEls[b.id] = lbl;
    });
  }

  function showBairroCard(b) {
    if (!b) {
      hideCard();
      return;
    }
    const leiTxt = b.leiNumero
      ? "Lei Municipal nº " + b.leiNumero + (b.leiAno ? "/" + b.leiAno : "")
      : "Delimitação oficial · Geoportal Itajaí";
    const p360 = b.photo360 || {};
    let photoSlot = "";
    if (p360.ready && p360.url) {
      photoSlot = '<button type="button" class="geo-cta-360" data-open-b360>🌐 Abrir Foto 360° · ' + b.nome + "</button>";
    } else if (p360.planned) {
      photoSlot = '<span class="geo-soon">📷 ' + (p360.label || "Foto 360° prevista em breve") + "</span>";
    }

    card.style.setProperty("--c", b.color);
    card.innerHTML =
      '<div class="geo-card-bar"></div><div class="geo-card-body">' +
      '<button type="button" class="geo-card-close" title="Voltar à visão geral de Itajaí">✕</button>' +
      '<span class="kicker">BAIRRO Nº ' + String(b.numero || b.idx).padStart(2, "0") + " · " + b.tipo.toUpperCase() + "</span>" +
      "<h2>" + b.nome + "</h2>" +
      "<p>" + leiTxt + "</p>" +
      '<div class="geo-b-stats">' +
      '<div class="geo-b-stat"><div class="geo-b-stat-k">Área</div><div class="geo-b-stat-v">' + b.areaKm2.toFixed(2).replace(".", ",") + " km²</div></div>" +
      '<div class="geo-b-stat"><div class="geo-b-stat-k">Alt. Média</div><div class="geo-b-stat-v">' + Math.round(b.elevMean) + " m</div></div>" +
      '<div class="geo-b-stat"><div class="geo-b-stat-k">Alt. Máx.</div><div class="geo-b-stat-v">' + Math.round(b.elevMax) + " m</div></div>" +
      "</div>" +
      photoSlot +
      '<div class="geo-card-nav">' +
      '<button type="button" class="geo-mini-btn" data-b-prev>‹ Bairro anterior</button>' +
      '<button type="button" class="geo-mini-btn" data-b-next>Próximo bairro ›</button>' +
      "</div>" +
      "</div>";
    card.hidden = false;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";

    card.querySelector(".geo-card-close").addEventListener("click", () => selectBairro(null, { focus: true }));
    const iCurr = itajaiState.bairros.findIndex((x) => x.id === b.id);
    card.querySelector("[data-b-prev]").addEventListener("click", () => {
      selectBairro(itajaiState.bairros[(iCurr - 1 + itajaiState.bairros.length) % itajaiState.bairros.length].id, { focus: true });
    });
    card.querySelector("[data-b-next]").addEventListener("click", () => {
      selectBairro(itajaiState.bairros[(iCurr + 1) % itajaiState.bairros.length].id, { focus: true });
    });
    const b360 = card.querySelector("[data-open-b360]");
    if (b360 && p360.ready && p360.url) {
      b360.addEventListener("click", () => openOverlay(p360.url, "Foto 360° — " + b.nome));
    }
    state.viewOffTarget = window.innerWidth > 820 ? 195 : 0;
    requestRender();
  }

  function refreshItajaiClasses() {
    itajaiState.bairros.forEach((b) => {
      const sel = b.id === itajaiState.selectedId;
      const hov = b.id === itajaiState.hoverId;
      const lbl = itajaiState.labelEls[b.id];
      const lg = itajaiState.legendEls[b.id];
      if (lbl) {
        lbl.classList.toggle("is-active", sel);
        lbl.classList.toggle("is-hover", hov);
        lbl.classList.toggle("is-faded", Boolean(itajaiState.selectedId) && !sel && !hov);
      }
      if (lg) {
        lg.classList.toggle("is-active", sel);
        lg.classList.toggle("is-hover", hov);
      }
    });
  }

  function setBairroHover(id) {
    if (itajaiState.hoverId === id) return;
    itajaiState.hoverId = id;
    const b = id ? itajaiState.byId[id] : null;
    if (itajaiState.uniforms) itajaiState.uniforms.uHoverId.value = b ? b.idx : 0;
    stage.classList.toggle("is-pointer", Boolean(b));
    if (hoverPill) {
      if (b) {
        hoverPill.innerHTML = b.nome + "<small>" + b.areaKm2.toFixed(1).replace(".", ",") + " km²</small>";
        hoverPill.style.left = state.pointerClient.x + "px";
        hoverPill.style.top = state.pointerClient.y + "px";
        hoverPill.hidden = false;
      } else {
        hoverPill.hidden = true;
      }
    }
    refreshItajaiClasses();
    requestRender();
  }

  function selectBairro(id, opts) {
    const b = id ? itajaiState.byId[id] : null;
    itajaiState.selectedId = b ? b.id : null;
    if (itajaiState.uniforms) itajaiState.uniforms.uSelectedId.value = b ? b.idx : 0;
    refreshItajaiClasses();
    if (b) {
      showBairroCard(b);
      if (itajaiState.legendEls[b.id]) {
        itajaiState.legendEls[b.id].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      if (opts && opts.focus && b.worldPt) {
        const scSpanU = Math.max(b.bboxUV[2] - b.bboxUV[0], b.bboxUV[3] - b.bboxUV[1]);
        if (window.innerWidth <= 820 && legendBox) { legendBox.classList.add("is-collapsed"); if (legendMinBtn) legendMinBtn.textContent = "▸"; }
        const rad = THREE.MathUtils.clamp(scSpanU * 0.155, 0.032, 0.088);
        const v = viewFor(b.worldPt, rad, 45, -0.18);
        flyTo(v.pos, v.target, 780);
      }
    } else {
      hideCard();
      if (opts && opts.focus && itajaiState.centerWorld) {
        const v = viewFor(itajaiState.centerWorld, itajaiState.radiusWorld, 46, -0.22);
        flyTo(v.pos, v.target, 750);
      }
    }
    requestRender();
  }

  function pickBairro() {
    if (!itajaiState.triGrid) return null;
    raycaster.setFromCamera(state.pointer, camera);
    const hit = raycastGrid(itajaiState.triGrid, raycaster.ray);
    if (!hit) return null;
    return findBairroAtUV(hit.uv.x, hit.uv.y);
  }

  function loadItajaiModelBuffer() {
    return new Promise((resolve, reject) => {
      const mLoader = new THREE.GLTFLoader();
      const loadFromB64 = () => {
        loadScriptOnce("js/itajai-mapa3d-glb.js", () => Boolean(window.ITAJAI_MAP_GLB_B64))
          .then(() => mLoader.parse(b64ToArrayBuffer(window.ITAJAI_MAP_GLB_B64), "", resolve, reject))
          .catch(reject);
      };
      if (location.protocol === "file:") {
        loadFromB64();
      } else {
        mLoader.load("assets/modelos/itajai_terreno.glb", resolve, undefined, loadFromB64);
      }
    });
  }

  function enterItajaiMode() {
    if (itajaiState.active || itajaiState.loading) return;
    cancelSequence();
    controls.autoRotate = false;
    $("btnGeoRotate").classList.remove("is-on");
    hideHint();
    hideCard();

    if (state.selectedId !== "costa_verde_mar") {
      setSelected("costa_verde_mar");
    }

    itajaiState.loading = true;
    toast("🏔️ Carregando Itajaí 3D (2×) e 35 bairros sobre SC…", 3500);

    // Começa voo suave até Itajaí enquanto os assets baixam sob demanda
    const targetApproach = state.itajaiWorld || uvToWorld(0.908, 0.698, 0.002);
    const approachView = viewFor(targetApproach, 0.145, 44, -0.20);
    flyTo(approachView.pos, approachView.target, 950);

    Promise.all([
      loadScriptOnce("js/itajai-bairros-data.js", () => Boolean(window.ITAJAI_BAIRROS_DATA)),
      loadScriptOnce("js/itajai-bairros-sdf.js", () => Boolean(window.ITAJAI_BAIRROS_SDF)),
      loadItajaiModelBuffer(),
    ])
      .then(([, , gltf]) => {
        const IDATA = window.ITAJAI_BAIRROS_DATA;
        const ISDF = window.ITAJAI_BAIRROS_SDF;
        const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
        if (!root) throw new Error("GLB de Itajaí vazio");

        const pl = IDATA.meta.scPlacement;
        root.position.set(pl.centerX, pl.baseY, pl.centerZ);
        root.rotation.set(0, pl.rotYRad, 0);
        root.scale.set(pl.scaleX, pl.scaleY, pl.scaleZ);

        let topMesh = null;
        root.traverse((obj) => {
          if (!obj.isMesh) return;
          if (obj.geometry && obj.geometry.attributes && obj.geometry.attributes.uv && obj.material && obj.material.map) {
            obj.material.map.encoding = THREE.sRGBEncoding;
            obj.material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            obj.material = createItajaiMaterial(obj.material, IDATA, ISDF);
            topMesh = obj;
          } else {
            // Estender a base da saia para baixo do recorte estadual (sem vãos por qualquer ângulo)
            const sPos = obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position;
            if (sPos) {
              for (let vi = 0; vi < sPos.count; vi++) {
                if (sPos.getY(vi) < 0.002) sPos.setY(vi, -0.18);
              }
              sPos.needsUpdate = true;
              obj.geometry.computeBoundingBox();
              obj.geometry.computeBoundingSphere();
            }
            obj.material = new THREE.MeshLambertMaterial({ color: 0x64748b });
          }
        });

        scene.add(root);
        root.updateMatrixWorld(true);
        recessScInsideItajai();

        if (ISDF.scMaskPngB64 && ISDF.scMaskBounds) {
          const mb = ISDF.scMaskBounds;
          borderUniforms.uItajaiMaskBounds.value.set(mb[0], mb[1], mb[2], mb[3]);
          borderUniforms.uItajaiMaskTex.value = loadItajaiPngTex(ISDF.scMaskPngB64, false, false);
        }
        borderUniforms.uItajaiFocus.value = 1.0;

        itajaiState.group = root;
        itajaiState.topMesh = topMesh;
        itajaiState.meta = IDATA.meta;
        itajaiState.bairros = IDATA.bairros.slice();
        itajaiState.byId = {};
        itajaiState.byIdx = {};
        itajaiState.bairros.forEach((b) => {
          itajaiState.byId[b.id] = b;
          itajaiState.byIdx[b.idx] = b;
        });
        itajaiState.triGrid = topMesh ? buildTriGrid(topMesh, true) : null;
        itajaiState.bairros.forEach((b) => {
          b.worldPt = topMesh ? uvToItajaiWorld(b.labelUV[0], b.labelUV[1], 0.0025) : targetApproach.clone();
        });

        const box = new THREE.Box3().setFromObject(root);
        const ctr = box.getCenter(new THREE.Vector3());
        ctr.y = pl.baseY + 0.004;
        const ws = IDATA.meta.worldSize || [1.728747, 2.0];
        itajaiState.centerWorld = ctr;
        itajaiState.radiusWorld = Math.max(ws[0] * pl.scaleX, ws[1] * pl.scaleZ) * 0.54;

        itajaiState.active = true;
        itajaiState.loading = false;
        itajaiState.selectedId = null;
        itajaiState.hoverId = null;

        borderUniforms.uShowItajaiRing.value = 0.0;
        controls.minDistance = 0.022;
        controls.maxDistance = 0.85;

        buildItajaiUI();
        refreshClasses();

        const itView = viewFor(ctr, itajaiState.radiusWorld, 46, -0.22);
        flyTo(itView.pos, itView.target, 700, () => toast("🗺️ Itajaí 3D (2×) · Clique em um dos 35 bairros", 1600));
        requestRender();
      })
      .catch((err) => {
        console.error(err);
        itajaiState.loading = false;
        toast("❌ Não foi possível carregar Itajaí 3D.", 3000);
      });
  }

  function unloadItajaiResources() {
    if (itajaiState.group) {
      scene.remove(itajaiState.group);
      itajaiState.group.traverse((obj) => {
        if (!obj.isMesh) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
        }
      });
      itajaiState.group = null;
    }
    itajaiState.textures.forEach((t) => t && t.dispose && t.dispose());
    itajaiState.textures = [];
    Object.keys(itajaiState.labelEls).forEach((id) => {
      const el = itajaiState.labelEls[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    itajaiState.labelEls = {};
    itajaiState.legendEls = {};
    itajaiState.topMesh = null;
    itajaiState.triGrid = null;
    itajaiState.uniforms = null;
    itajaiState.idPixels = null;
    itajaiState.selectedId = null;
    itajaiState.hoverId = null;
  }

  function exitItajaiMode() {
    if (!itajaiState.active) return;
    cancelSequence();
    setBairroHover(null);
    hideCard();
    borderUniforms.uItajaiFocus.value = 0.0;
    borderUniforms.uItajaiMaskTex.value = dummyMaskTex;
    unloadItajaiResources();
    restoreScElevation();

    itajaiState.active = false;
    controls.minDistance = 0.08;
    controls.maxDistance = 7;

    legendBox.classList.remove("is-itajai", "is-collapsed");
    legendTitle.textContent = "Mapa do Turismo · 15 IGRs (SETUR-SC)";
    if (legendMinBtn) legendMinBtn.hidden = true;
    if (legendSearchWrap) legendSearchWrap.hidden = true;
    if (headerKicker) headerKicker.textContent = "Geoturismo SC";
    if (headerTitle) headerTitle.textContent = "Regiões Turísticas de Santa Catarina";
    if (creditsEl) creditsEl.innerHTML = creditsDefaultHtml;
    if (btnBackSC) btnBackSC.hidden = true;
    if (btnItajaiBorders) btnItajaiBorders.hidden = true;
    if (btnItajaiLabels) btnItajaiLabels.hidden = true;

    buildLegend();
    selectRegion("costa_verde_mar", { noSequence: true });
    requestRender();
  }

  if (legendSearch) {
    legendSearch.addEventListener("input", () => {
      if (!itajaiState.active) return;
      const q = (legendSearch.value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      itajaiState.bairros.forEach((b) => {
        const el = itajaiState.legendEls[b.id];
        if (!el) return;
        const norm = b.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        el.parentElement.style.display = !q || norm.includes(q) ? "" : "none";
      });
    });
  }
  if (legendMinBtn) {
    legendMinBtn.addEventListener("click", () => {
      const col = legendBox.classList.toggle("is-collapsed");
      legendMinBtn.textContent = col ? "▸" : "▾";
    });
  }
  if (btnBackSC) btnBackSC.addEventListener("click", exitItajaiMode);
  if (btnItajaiBorders) {
    btnItajaiBorders.addEventListener("click", () => {
      itajaiState.showBorders = !itajaiState.showBorders;
      if (itajaiState.uniforms) itajaiState.uniforms.uShowBorders.value = itajaiState.showBorders ? 1.0 : 0.0;
      btnItajaiBorders.classList.toggle("is-on", itajaiState.showBorders);
      requestRender();
    });
  }
  if (btnItajaiLabels) {
    btnItajaiLabels.addEventListener("click", () => {
      itajaiState.showLabels = !itajaiState.showLabels;
      btnItajaiLabels.classList.toggle("is-on", itajaiState.showLabels);
      requestRender();
    });
  }

  // --------------------------------------------------------------------------
  // Overlay 360° (passeio virtual existente e futuras fotos 360° de bairros)
  // --------------------------------------------------------------------------
  const overlay = $("tour360Overlay");
  const backBtn = $("btnBackToMap");
  let iframe = null;
  let unloadTimer = null;

  function ensureIframe(url, title) {
    clearTimeout(unloadTimer);
    const targetUrl = url || DATA.rioDaLuz.tourUrl;
    if (iframe) {
      if (iframe.getAttribute("data-src-url") === targetUrl) return iframe;
      iframe.src = "about:blank";
      iframe.remove();
      iframe = null;
    }
    iframe = document.createElement("iframe");
    iframe.setAttribute("data-src-url", targetUrl);
    iframe.title = title || "Foto 360° — Vale Tombado do Rio da Luz";
    iframe.allow = "fullscreen; gyroscope; accelerometer; xr-spatial-tracking";
    iframe.setAttribute("allowfullscreen", "");
    iframe.addEventListener("load", () => iframe && iframe.classList.add("is-ready"));
    iframe.src = targetUrl;
    overlay.insertBefore(iframe, backBtn);
    return iframe;
  }

  function openOverlay(url, title) {
    cancelSequence();
    ensureIframe(url, title);
    const p = !itajaiState.active && state.rioWorld ? placeEl(pinEl, state.rioWorld) : { x: state.w / 2, y: state.h / 2 };
    overlay.style.setProperty("--ox", p.x + "px");
    overlay.style.setProperty("--oy", p.y + "px");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    later(() => {
      if (overlay.classList.contains("is-open")) pauseLoop();
    }, 1150);
    if (!itajaiState.active) {
      try {
        history.replaceState(null, "", "#rio-da-luz-360");
      } catch (e) { /* file:// em alguns navegadores */ }
    }
  }

  function open360() {
    openOverlay(DATA.rioDaLuz.tourUrl, "Foto 360° — Vale Tombado do Rio da Luz");
  }

  function close360() {
    const returnId = state.selectedId || "vale_dos_encantos";
    resumeLoop();
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) { /* noop */ }
    unloadTimer = setTimeout(() => {
      if (!overlay.classList.contains("is-open") && iframe) {
        iframe.src = "about:blank";
        iframe.remove();
        iframe = null;
      }
    }, 1200);
    if (!itajaiState.active) {
      later(() => selectRegion(returnId, { noSequence: true }), 260);
    }
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
    state.pointerClient = { x: e.clientX, y: e.clientY };
    state.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    state.pickPending = true;
    requestRender();
  });
  canvas.addEventListener("pointerleave", () => {
    if (itajaiState.active) setBairroHover(null);
    else setHover(null);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const dt = performance.now() - downAt.t;
    downAt = null;
    if (moved > 6 || dt > 600) return;
    const rect = canvas.getBoundingClientRect();
    state.pointerClient = { x: e.clientX, y: e.clientY };
    state.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);

    if (itajaiState.active) {
      const b = pickBairro();
      if (b) selectBairro(b.id, { focus: true });
      else if (itajaiState.selectedId) selectBairro(null, { focus: true });
      return;
    }

    raycaster.setFromCamera(state.pointer, camera);
    const hit = state.triGrid ? raycastTopGrid(raycaster.ray) : null;
    if (hit && state.selectedId === "costa_verde_mar" && isPointInItajaiUV(hit.uv)) {
      enterItajaiMode();
      return;
    }
    const r = hit ? regionAtUV(hit.uv) : null;
    if (r) selectRegion(r.id);
    else if (state.selectedId) goOverview();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (overlay.classList.contains("is-open")) close360();
    else if (itajaiState.active && itajaiState.selectedId) selectBairro(null, { focus: true });
    else if (itajaiState.active) exitItajaiMode();
    else if (state.selectedId) goOverview();
  });

  // Toolbar + suporte a tela cheia móvel e integração VR/360° do iframe
  $("btnGeoOverview").addEventListener("click", goOverview);
  $("btnGeoRotate").addEventListener("click", (e) => {
    controls.autoRotate = !controls.autoRotate;
    e.currentTarget.classList.toggle("is-on", controls.autoRotate);
    requestRender();
  });
  $("btnGeoFullscreen").addEventListener("click", () => {
    const docEl = document.documentElement;
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      if (typeof req === "function") {
        try {
          const p = req.call(docEl, { navigationUI: "hide" });
          if (p && typeof p.catch === "function") p.catch(() => {});
        } catch (_) {}
      }
      document.body.classList.toggle("geo-pseudo-fs", !document.fullscreenElement);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (typeof exit === "function") {
        try { exit.call(document); } catch (_) {}
      }
      document.body.classList.remove("geo-pseudo-fs");
    }
  });

  window.addEventListener("message", (ev) => {
    if (ev && ev.data && ev.data.type === "GEOSC_PSEUDO_FULLSCREEN") {
      overlay.classList.toggle("is-child-fullscreen", Boolean(ev.data.active));
    }
  });

  const hintEl = $("geoHint");
  function hideHint() {
    hintEl.classList.add("is-hidden");
  }

  // Deep link: ?regiao=costa_verde_mar | ?municipio=itajai | #itajai-3d | #rio-da-luz-360
  function handleDeepLink() {
    const params = new URLSearchParams(location.search);
    const reg = params.get("regiao");
    const mun = params.get("municipio");
    if (location.hash === "#itajai-3d" || mun === "itajai") {
      setTimeout(() => enterItajaiMode(), 1500);
    } else if (location.hash === "#rio-da-luz-360") {
      setTimeout(() => goToRioDaLuz(true), 1500);
    } else if (reg && state.byId[reg]) {
      setTimeout(() => selectRegion(reg, { noSequence: params.get("auto360") === "0" }), 1500);
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
    if (state.model) computeOverview();
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
      state.viewOffX += offDiff * (1 - Math.exp(-9 * dt));
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
      if (itajaiState.active) {
        const b = pickBairro();
        setBairroHover(b ? b.id : null);
      } else {
        const r = pick();
        setHover(r ? r.id : null);
      }
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
  window.GeoturismoSC = { selectRegion, goOverview, goToRioDaLuz, enterItajaiMode, exitItajaiMode, selectBairro, open360, close360, requestRender, state, itajaiState };
})();

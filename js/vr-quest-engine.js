/**
 * ============================================================================
 * MOTOR DE REALIDADE VIRTUAL COMPLETA — META QUEST 3 / WEBXR + SIMULADOR ESTÉREO
 * ============================================================================
 * Permite entrar em Realidade Virtual imersiva ("immersive-vr") diretamente
 * pelo navegador do Meta Quest 3 (controles Touch Plus com laser 3D, rastreio
 * de mãos e mira por cabeça), mantendo TODOS os recursos criados visíveis e
 * clicáveis dentro do óculos:
 *   - Cenas Drone 360° em estéreo binocular + hotspots interativos (360°, Info, 3D)
 *   - Painéis editoriais flutuantes em 3D (com fotos históricas e "Você sabia?")
 *   - Maquete 3D real (.GLB) flutuando no espaço RV em 3D estereoscópico
 *   - Mapa Interativo da Rota Lumiar (26 pontos + filtros + salto 360°)
 *   - Mapa Satélite do Vale com pontos georreferenciados e navegação direta
 * ============================================================================
 */
(function () {
  "use strict";

  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  const vr = {
    active: false,
    isWebXR: false,
    stereoPreview: true,
    xrSession: null,
    xrRefSpace: null,
    gl: null,
    canvas: null,
    overlayEl: null,
    rafId: 0,

    // Orientação da câmera em modo Prévia/Simulador + alinhamento inicial da cena
    simYaw: 0,
    simPitch: 0,
    sceneWorldYawRad: 0,
    uiAnchorYawRad: 0,
    headYawRad: 0,
    headPitchRad: 0,
    lastHeadForward: [0, 0, -1],

    // Estado de conteúdo ativo dentro do óculos
    sceneId: null,
    openPanel: null, // null | "scenes" | "info" | "glb" | "rota" | "satellite"
    activeInfoHotspot: null,
    infoScrollLine: 0,
    rotaCategory: "all",
    rotaPage: 0,
    selectedRotaPoint: null,
    satFilter: "all",
    selectedSatPoint: null,
    toastText: "",
    toastUntil: 0,

    // Controle da maquete 3D (.GLB) embutida no espaço RV
    glbState: {
      loading: false,
      loaded: false,
      error: null,
      drawCalls: [],
      radius: 1,
      center: [0, 0, 0],
      yaw: 0.45,
      pitch: 0.45,
      scaleMul: 1.0,
      autoRotate: true
    },

    // Programas WebGL
    skyProg: null,
    quadProg: null,
    beamProg: null,
    glbProg: null,
    skyMesh: null,
    unitQuadMesh: null,
    beamBuf: null,

    // Caches de textura WebGL
    panoTextures: {},
    pendingPanos: {},
    photoCache: {},
    hotspotTexCache: {},
    dynamicPanels: {},

    // Interatividade de ponteiro / lasers Quest 3
    hoverId: null,
    pointerRaySim: null,
    isSimDragging: false,
    simDragStartX: 0,
    simDragStartY: 0,
    simDownX: 0,
    simDownY: 0,
    simHoverNdc: null,
    clickableMeshes: []
  };

  // =========================================================================
  // ÁLGEBRA LINEAR 3D (MATRIZES 4x4 E INTERSEÇÕES RAIO -> QUAD / ESFERA)
  // =========================================================================
  function mat4Identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
      out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  function mat4Perspective(fovYRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovYRad * 0.5);
    const nf = 1.0 / (near - far);
    return new Float32Array([
      f / Math.max(0.1, aspect), 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ]);
  }

  function mat4Translation(x, y, z) {
    const m = mat4Identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  }

  function mat4RotateY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  function mat4RotateX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  }

  function mat4Scale(sx, sy, sz) {
    const m = mat4Identity();
    m[0] = sx; m[5] = sy; m[10] = sz;
    return m;
  }

  function mat4FromPosTargetUp(pos, target, worldUp) {
    let zx = pos[0] - target[0];
    let zy = pos[1] - target[1];
    let zz = pos[2] - target[2];
    const zLen = Math.hypot(zx, zy, zz) || 1;
    zx /= zLen; zy /= zLen; zz /= zLen;

    let xx = worldUp[1] * zz - worldUp[2] * zy;
    let xy = worldUp[2] * zx - worldUp[0] * zz;
    let xz = worldUp[0] * zy - worldUp[1] * zx;
    const xLen = Math.hypot(xx, xy, xz) || 1;
    xx /= xLen; xy /= xLen; xz /= xLen;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
      xx, xy, xz, 0,
      yx, yy, yz, 0,
      zx, zy, zz, 0,
      pos[0], pos[1], pos[2], 1
    ]);
  }

  function mat4InvertRigidOrAffine(m) {
    const out = new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return mat4Identity();
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  }

  function transformVec4(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
      m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]
    ];
  }

  function dot3(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function norm3(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  // Converte coordenadas esféricas (pitchDeg, yawDeg) do engine360 para o espaço 3D local da cena
  function sphericalToLocalDir(pitchDeg, yawDeg) {
    const p = pitchDeg * DEG2RAD;
    const y = yawDeg * DEG2RAD;
    return [
      Math.cos(p) * Math.sin(y),
      Math.sin(p),
      -Math.cos(p) * Math.cos(y)
    ];
  }

  // Calcula interseção de um raio 3D contra um retângulo 3D orientado por modelMatrix (quad [-0.5..0.5])
  function intersectRayQuad(rayOrigin, rayDir, modelMatrix, width, height) {
    const inv = mat4InvertRigidOrAffine(modelMatrix);
    const oH = transformVec4(inv, [rayOrigin[0], rayOrigin[1], rayOrigin[2], 1]);
    const dH = transformVec4(inv, [rayDir[0], rayDir[1], rayDir[2], 0]);
    if (Math.abs(dH[2]) < 1e-5) return null;
    const t = -oH[2] / dH[2];
    if (t <= 0.12 || t > 35) return null;
    const hx = oH[0] + dH[0] * t;
    const hy = oH[1] + dH[1] * t;
    if (Math.abs(hx) > 0.5 || Math.abs(hy) > 0.5) return null;
    const u = hx + 0.5;
    const v = 0.5 - hy; // Topo do Canvas = 0, Base = 1
    const worldHit = [
      rayOrigin[0] + rayDir[0] * t,
      rayOrigin[1] + rayDir[1] * t,
      rayOrigin[2] + rayDir[2] * t
    ];
    return { dist: t, u, v, worldHit, px: u * width, py: v * height };
  }

  // =========================================================================
  // UTILITÁRIOS DE RENDERIZAÇÃO DE TEXTO & IMAGENS EM CANVAS 2D -> TEXTURA
  // =========================================================================
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxW) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = "";
    for (let i = 0; i < words.length; i++) {
      const probe = cur ? (cur + " " + words[i]) : words[i];
      if (ctx.measureText(probe).width > maxW && cur) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = probe;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function getLoadedPhoto(src, onReady) {
    if (!src) return null;
    const cached = vr.photoCache[src];
    if (cached) {
      if (cached.ready) return cached.img;
      if (onReady) cached.callbacks.push(onReady);
      return null;
    }
    const entry = { img: new Image(), ready: false, failed: false, callbacks: onReady ? [onReady] : [] };
    vr.photoCache[src] = entry;
    if (!src.startsWith("data:") && location.protocol !== "file:") {
      entry.img.crossOrigin = "anonymous";
    }
    entry.img.onload = () => {
      entry.ready = true;
      entry.callbacks.splice(0).forEach(cb => cb());
    };
    entry.img.onerror = () => { entry.failed = true; };
    entry.img.src = src;
    return null;
  }

  // =========================================================================
  // SHADERS WEBGL DA CENA RV (SKY ESFÉRICO, QUAD ESPACIAL, LASER, MAQUETE GLB)
  // =========================================================================
  function compileProgram(gl, vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error("VR VS Error:", gl.getShaderInfoLog(vs));
      return null;
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error("VR FS Error:", gl.getShaderInfoLog(fs));
      return null;
    }
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error("VR Program Link Error:", gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function createSkySphereMesh(gl) {
    const segs = 56;
    const rings = 28;
    const verts = [];
    const uvs = [];
    const idx = [];
    for (let r = 0; r <= rings; r++) {
      const v = r / rings;
      const pitch = (0.5 - v) * Math.PI; // +PI/2 no topo, -PI/2 em baixo
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const yaw = (u - 0.5) * Math.PI * 2.0; // [-PI..+PI] consistente com engine360
        const x = cp * Math.sin(yaw) * 48.0;
        const y = sp * 48.0;
        const z = -cp * Math.cos(yaw) * 48.0;
        verts.push(x, y, z);
        uvs.push(u, v);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segs; s++) {
        const a = r * (segs + 1) + s;
        const b = a + segs + 1;
        idx.push(a, b, a + 1);
        idx.push(b, b + 1, a + 1);
      }
    }
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

    return { posBuf, uvBuf, idxBuf, count: idx.length };
  }

  function createUnitQuadMesh(gl) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -0.5, 0.5, 0,
      -0.5, -0.5, 0,
      0.5, 0.5, 0,
      0.5, -0.5, 0
    ]), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 0,
      0, 1,
      1, 0,
      1, 1
    ]), gl.STATIC_DRAW);

    return { posBuf, uvBuf };
  }

  function initVRWebGL() {
    const gl = vr.canvas.getContext("webgl2", {
      alpha: false,
      depth: true,
      antialias: true,
      xrCompatible: true
    }) || vr.canvas.getContext("webgl", {
      alpha: false,
      depth: true,
      antialias: true,
      xrCompatible: true
    });
    if (!gl) return false;
    vr.gl = gl;

    // 1. Shader Sky Sphere + Textured Spatial Panels
    vr.skyProg = compileProgram(gl, `
      attribute vec3 aPos;
      attribute vec2 aUV;
      uniform mat4 uMVP;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = uMVP * vec4(aPos, 1.0);
      }
    `, `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uTex;
      uniform float uAlpha;
      uniform float uGlow;
      void main() {
        vec4 c = texture2D(uTex, vUV);
        c.rgb += vec3(uGlow * 0.16);
        gl_FragColor = vec4(c.rgb, c.a * uAlpha);
      }
    `);

    // 2. Shader Laser Beam & Mira 3D (ponto circular limpo sem quadrado)
    vr.beamProg = compileProgram(gl, `
      attribute vec3 aPos;
      uniform mat4 uMVP;
      void main() {
        gl_Position = uMVP * vec4(aPos, 1.0);
        gl_PointSize = 14.0;
      }
    `, `
      precision mediump float;
      uniform vec4 uColor;
      uniform float uIsPoint;
      void main() {
        if (uIsPoint > 0.5) {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.48) discard;
          float rim = smoothstep(0.32, 0.46, r);
          vec3 col = mix(vec3(1.0), uColor.rgb, rim);
          gl_FragColor = vec4(col, uColor.a * (1.0 - smoothstep(0.42, 0.5, r)));
        } else {
          gl_FragColor = uColor;
        }
      }
    `);

    // 3. Shader Maquete 3D (.GLB) em Estéreo Iluminado
    vr.glbProg = compileProgram(gl, `
      attribute vec3 aPos;
      attribute vec3 aNorm;
      attribute vec2 aUV;
      uniform mat4 uMVP;
      uniform mat4 uModel;
      varying vec3 vN;
      varying vec2 vUV;
      void main() {
        vN = normalize((uModel * vec4(aNorm, 0.0)).xyz);
        vUV = aUV;
        gl_Position = uMVP * vec4(aPos, 1.0);
      }
    `, `
      precision highp float;
      varying vec3 vN;
      varying vec2 vUV;
      uniform sampler2D uBaseTex;
      uniform float uHasTex;
      uniform vec4 uBaseColor;
      void main() {
        vec4 tex = uHasTex > 0.5 ? texture2D(uBaseTex, vUV) : vec4(1.0);
        vec3 base = tex.rgb * uBaseColor.rgb;
        vec3 N = normalize(gl_FrontFacing ? vN : -vN);
        vec3 L1 = normalize(vec3(0.45, 0.85, 0.55));
        vec3 L2 = normalize(vec3(-0.6, 0.35, -0.5));
        float d1 = max(dot(N, L1), 0.0);
        float d2 = max(dot(N, L2), 0.0);
        float hemi = 0.5 + 0.5 * N.y;
        vec3 col = base * (mix(0.32, 0.62, hemi) + 0.72 * d1 + 0.28 * d2);
        gl_FragColor = vec4(col, 1.0);
      }
    `);

    vr.skyMesh = createSkySphereMesh(gl);
    vr.unitQuadMesh = createUnitQuadMesh(gl);
    vr.beamBuf = gl.createBuffer();
    return true;
  }

  // =========================================================================
  // TEXTURAS DINÂMICAS DAS CENAS 360°, HOTSPOTS E PAINÉIS 3D DO META QUEST 3
  // =========================================================================
  function createTextureFromCanvas(canvas) {
    const gl = vr.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    return tex;
  }

  function updateTextureCanvas(tex, canvas) {
    const gl = vr.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  function ensureScenePanoTexture(sceneId) {
    if (!vr.gl || !window.TOUR_SC_DATA) return null;
    if (vr.panoTextures[sceneId]) return vr.panoTextures[sceneId];
    if (vr.pendingPanos[sceneId]) return vr.pendingPanos[sceneId];

    const scene = window.TOUR_SC_DATA.scenes[sceneId];
    if (!scene) return null;

    // Textura provisória imediata enquanto imagem carrega
    const temp = document.createElement("canvas");
    temp.width = 512; temp.height = 256;
    const tctx = temp.getContext("2d");
    const grd = tctx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, "#1d4ed8");
    grd.addColorStop(0.52, "#60a5fa");
    grd.addColorStop(0.55, "#15803d");
    grd.addColorStop(1, "#0f172a");
    tctx.fillStyle = grd;
    tctx.fillRect(0, 0, 512, 256);
    tctx.fillStyle = "#ffffff";
    tctx.font = "800 22px Inter, sans-serif";
    tctx.textAlign = "center";
    tctx.fillText(scene.placeMenuTitle || scene.title || "Carregando 360°...", 256, 128);

    const tex = createTextureFromCanvas(temp);
    vr.pendingPanos[sceneId] = tex;

    const uploadImg = (imgOrCanvas) => {
      if (!vr.gl) return;
      const maxTex = Math.min(4096, vr.gl.getParameter(vr.gl.MAX_TEXTURE_SIZE) || 4096);
      let w = imgOrCanvas.naturalWidth || imgOrCanvas.width;
      let h = imgOrCanvas.naturalHeight || imgOrCanvas.height;
      let src = imgOrCanvas;
      if (w > maxTex || h > maxTex) {
        const s = Math.min(maxTex / w, maxTex / h);
        const c = document.createElement("canvas");
        c.width = Math.floor(w * s);
        c.height = Math.floor(h * s);
        c.getContext("2d").drawImage(imgOrCanvas, 0, 0, c.width, c.height);
        src = c;
      }
      vr.gl.bindTexture(vr.gl.TEXTURE_2D, tex);
      vr.gl.texImage2D(vr.gl.TEXTURE_2D, 0, vr.gl.RGBA, vr.gl.RGBA, vr.gl.UNSIGNED_BYTE, src);
      vr.panoTextures[sceneId] = tex;
      delete vr.pendingPanos[sceneId];
    };

    const b64 = (window.DRONE_PANOS_B64 && window.DRONE_PANOS_B64[sceneId]) || null;
    const url = b64 || scene.customPanoramaUrl;
    if (url) {
      const img = new Image();
      if (!b64 && location.protocol !== "file:") img.crossOrigin = "anonymous";
      img.onload = () => uploadImg(img);
      img.onerror = () => {
        if (window.SC_PANO_GENERATOR && scene.generatorType) {
          uploadImg(window.SC_PANO_GENERATOR.createEquirectangularTexture(scene.generatorType));
        }
      };
      img.src = url;
    }
    return tex;
  }

  function getHotspotBadgeTexture(hs, isHover) {
    const key = `${hs.id}_${isHover ? 1 : 0}`;
    if (vr.hotspotTexCache[key]) return vr.hotspotTexCache[key];

    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 256);

    const cx = 256, cy = 148;

    // Etiqueta superior flutuante visível em destaque ao apontar no Meta Quest 3
    if (isHover || hs.type !== "scene") {
      const titleText = hs.type === "3d"
        ? "Maquete 3D Vale Rio da Luz"
        : (hs.tooltip || hs.title || "Explorar Ponto").replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").trim();
      ctx.font = "800 24px Inter, sans-serif";
      const tw = Math.min(468, ctx.measureText(titleText).width + 38);
      roundRect(ctx, cx - tw / 2, 16, tw, 44, 22);
      ctx.fillStyle = isHover ? "rgba(11, 93, 59, 0.96)" : "rgba(15, 23, 42, 0.86)";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isHover ? "#86efac" : "rgba(255,255,255,0.4)";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(titleText.slice(0, 34), cx, 39);
    }

    // Ícone central correspondente ao tipo do ponto
    if (hs.type === "scene") {
      const r = isHover ? 66 : 58;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.fillStyle = isHover ? "#facc15" : "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#0b5d3b";
      ctx.fill();

      const tScene = window.TOUR_SC_DATA.scenes[hs.targetSceneId];
      const thumbSrc = tScene && (tScene.thumbPhoto || tScene.staticPhoto);
      const loadedImg = thumbSrc ? getLoadedPhoto(thumbSrc, () => {
        delete vr.hotspotTexCache[key];
      }) : null;
      if (loadedImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(loadedImg, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();
      }

      // Faixa 360° na base do portal
      roundRect(ctx, cx - 34, cy + r - 18, 68, 24, 12);
      ctx.fillStyle = "#0284c7";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 15px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("360°", cx, cy + r - 6);
    } else if (hs.type === "3d") {
      roundRect(ctx, cx - 72, cy - 38, 144, 76, 38);
      ctx.fillStyle = isHover ? "#fbbf24" : "#f59e0b";
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = "900 32px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3D .GLB", cx, cy + 2);
    } else {
      const r = isHover ? 48 : 42;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isHover ? "#b91c1c" : "#8b1e1e";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 900 44px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", cx, cy + 2);
    }

    const entry = { tex: createTextureFromCanvas(c), canvas: c };
    vr.hotspotTexCache[key] = entry;
    return entry;
  }

  // =========================================================================
  // GERADOR GENÉRICO DE PAINÉIS INTERATIVOS EM CANVAS COM BOTÕES CLICÁVEIS
  // =========================================================================
  function getDynamicPanel(key, width, height, signature, drawFn) {
    let p = vr.dynamicPanels[key];
    if (!p) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      p = {
        canvas: c,
        ctx: c.getContext("2d"),
        tex: createTextureFromCanvas(c),
        signature: "",
        regions: []
      };
      vr.dynamicPanels[key] = p;
    }
    if (p.signature !== signature) {
      p.regions = [];
      p.ctx.clearRect(0, 0, width, height);
      drawFn(p.ctx, width, height, p.regions);
      updateTextureCanvas(p.tex, p.canvas);
      p.signature = signature;
    }
    return p;
  }

  function addHitButton(regions, id, x, y, w, h, action) {
    regions.push({ id, x, y, w, h, action });
  }

  function findRegionAt(regions, px, py) {
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r;
      }
    }
    return null;
  }

  // 1. PAINEL DOCK INFERIOR FLUTUANTE NO ÓCULOS QUEST 3
  function buildDockPanel() {
    const sc = window.TOUR_SC_DATA.scenes[vr.sceneId] || {};
    const sig = `${vr.sceneId}|${vr.openPanel}|${vr.hoverId}|${vr.stereoPreview}|${Math.floor(vr.toastUntil / 100)}`;
    return getDynamicPanel("vrDock", 1180, 220, sig, (ctx, W, H, regions) => {
      // Fundo vidro escuro
      roundRect(ctx, 16, 46, W - 32, H - 62, 34);
      ctx.fillStyle = "rgba(12, 20, 17, 0.90)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(134, 239, 172, 0.45)";
      ctx.stroke();

      // Barra superior com nome da cena atual
      const bannerText = (performance.now() < vr.toastUntil && vr.toastText)
        ? vr.toastText
        : `Vale do Rio da Luz (RV Quest 3) • ${sc.placeMenuTitle || sc.shortTitle || ""}`;
      roundRect(ctx, 210, 4, W - 420, 38, 19);
      ctx.fillStyle = performance.now() < vr.toastUntil ? "#0b5d3b" : "rgba(15, 23, 42, 0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bannerText.slice(0, 68), W * 0.5, 24);

      const btns = [
        { id: "dock_scenes", icon: "360°", label: "Cenas 360°", active: vr.openPanel === "scenes", act: { type: "togglePanel", panel: "scenes" } },
        { id: "dock_rota", icon: "ROTA", label: "Rota Lumiar (26)", active: vr.openPanel === "rota", act: { type: "togglePanel", panel: "rota" } },
        { id: "dock_sat", icon: "MAPA", label: "Google Satélite", active: vr.openPanel === "satellite", act: { type: "togglePanel", panel: "satellite" } },
        { id: "dock_glb", icon: "3D", label: "Maquete 3D GLB", active: vr.openPanel === "glb", act: { type: "openGLB" } },
        { id: "dock_recenter", icon: "↺", label: "Centralizar", active: false, act: { type: "recenter" } },
        { id: "dock_exit", icon: "×", label: "Sair do RV", danger: true, active: false, act: { type: "exitVR" } }
      ];

      const padX = 36;
      const gap = 14;
      const bw = (W - padX * 2 - gap * (btns.length - 1)) / btns.length;
      const by = 68;
      const bh = 114;

      btns.forEach((b, i) => {
        const bx = padX + i * (bw + gap);
        const hovered = vr.hoverId === b.id;
        roundRect(ctx, bx, by, bw, bh, 22);
        if (b.danger) {
          ctx.fillStyle = hovered ? "#dc2626" : "rgba(153, 27, 27, 0.85)";
        } else if (b.active) {
          ctx.fillStyle = hovered ? "#16a34a" : "#0b5d3b";
        } else {
          ctx.fillStyle = hovered ? "#1e3a32" : "rgba(255, 255, 255, 0.11)";
        }
        ctx.fill();
        ctx.lineWidth = hovered ? 3.5 : 2;
        ctx.strokeStyle = hovered ? "#facc15" : "rgba(255, 255, 255, 0.28)";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 24px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(b.icon, bx + bw * 0.5, by + 44);
        ctx.font = "700 17px Inter, sans-serif";
        ctx.fillText(b.label, bx + bw * 0.5, by + 88);

        addHitButton(regions, b.id, bx, by, bw, bh, b.act);
      });
    });
  }

  // 2. PAINEL DE CENAS 360° (TODOS OS 4 VOO DRONE 360° COM FOTOS)
  function buildScenesPanel() {
    const scenes = Object.values(window.TOUR_SC_DATA.scenes || {});
    const readyCount = scenes.filter(s => vr.photoCache[s.thumbPhoto || s.staticPhoto]?.ready).length;
    const sig = `${vr.sceneId}|${vr.hoverId}|${readyCount}`;
    return getDynamicPanel("vrScenes", 1120, 680, sig, (ctx, W, H, regions) => {
      roundRect(ctx, 10, 10, W - 20, H - 20, 28);
      ctx.fillStyle = "rgba(15, 23, 20, 0.94)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#16a34a";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 30px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Escolher Ponto Aéreo 360° — Rio da Luz", 40, 56);

      // Botão Fechar
      const closeHover = vr.hoverId === "sc_close";
      roundRect(ctx, W - 135, 32, 95, 48, 14);
      ctx.fillStyle = closeHover ? "#dc2626" : "#0b5d3b";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("× Fechar", W - 87, 56);
      addHitButton(regions, "sc_close", W - 135, 32, 95, 48, { type: "closePanel" });

      const cols = 2;
      const cardW = 500;
      const cardH = 262;
      scenes.slice(0, 4).forEach((sc, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = 44 + col * (cardW + 32);
        const cy = 104 + row * (cardH + 22);
        const bid = `sc_go_${sc.id}`;
        const hovered = vr.hoverId === bid;
        const isCurrent = vr.sceneId === sc.id;

        roundRect(ctx, cx, cy, cardW, cardH, 20);
        ctx.fillStyle = hovered ? "rgba(22, 163, 74, 0.25)" : "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.lineWidth = isCurrent || hovered ? 4 : 2;
        ctx.strokeStyle = isCurrent ? "#facc15" : (hovered ? "#86efac" : "rgba(255,255,255,0.25)");
        ctx.stroke();

        const imgSrc = sc.staticPhoto || sc.thumbPhoto;
        const img = getLoadedPhoto(imgSrc, () => {
          if (vr.dynamicPanels.vrScenes) vr.dynamicPanels.vrScenes.signature = "";
        });
        ctx.save();
        roundRect(ctx, cx + 12, cy + 12, cardW - 24, 166, 14);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, cx + 12, cy + 12, cardW - 24, 166);
        } else {
          ctx.fillStyle = "#14532d";
          ctx.fillRect(cx + 12, cy + 12, cardW - 24, 166);
        }
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.font = "800 22px Inter, sans-serif";
        ctx.fillText((sc.placeMenuTitle || sc.shortTitle || "").slice(0, 32), cx + 18, cy + 206);
        ctx.fillStyle = isCurrent ? "#fde047" : "#bbf7d0";
        ctx.font = "600 16px Inter, sans-serif";
        ctx.fillText(isCurrent ? "Cena atual dentro do óculos RV" : (sc.placeMenuDesc || "").slice(0, 48), cx + 18, cy + 236);

        addHitButton(regions, bid, cx, cy, cardW, cardH, { type: "goScene", sceneId: sc.id });
      });
    });
  }

  // 3. PAINEL EDITORIAL / INFO DE HOTSPOT DENTRO DO ÓCULOS QUEST 3
  function buildInfoPanel() {
    const hs = vr.activeInfoHotspot;
    if (!hs) return null;
    const imgSrc = hs.image || "assets/fotos/riodaluz/static_vale_tombado.jpg";
    const loadedReady = Boolean(vr.photoCache[imgSrc]?.ready);
    const sig = `${hs.id}|${vr.infoScrollLine}|${vr.hoverId}|${loadedReady}`;

    return getDynamicPanel("vrInfo", 1180, 760, sig, (ctx, W, H, regions) => {
      roundRect(ctx, 10, 10, W - 20, H - 20, 28);
      ctx.fillStyle = "#fafaf9";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#0b5d3b";
      ctx.stroke();

      // Coluna esquerda: Foto histórica + coordenadas / CTA Rota Lumiar
      const photo = getLoadedPhoto(imgSrc, () => {
        if (vr.dynamicPanels.vrInfo) vr.dynamicPanels.vrInfo.signature = "";
      });
      ctx.save();
      roundRect(ctx, 32, 32, 470, 560, 18);
      ctx.clip();
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(32, 32, 470, 560);
      if (photo) {
        const s = hs.fitContain
          ? Math.min(450 / photo.width, 540 / photo.height)
          : Math.max(470 / photo.width, 560 / photo.height);
        const dw = photo.width * s;
        const dh = photo.height * s;
        ctx.drawImage(photo, 32 + (470 - dw) * 0.5, 32 + (560 - dh) * 0.5, dw, dh);
      }
      ctx.restore();

      if (hs.ctaOpenRotaLumiar) {
        const rHov = vr.hoverId === "info_rota_btn";
        roundRect(ctx, 32, 616, 470, 74, 16);
        ctx.fillStyle = rHov ? "#15803d" : "#0b5d3b";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 22px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Abrir Rota Lumiar (26 Pontos)", 267, 653);
        addHitButton(regions, "info_rota_btn", 32, 616, 470, 74, { type: "openPanel", panel: "rota" });
      } else {
        ctx.fillStyle = "#475569";
        ctx.font = "700 17px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(hs.imageCaption || "Acervo Patrimonial Rio da Luz (IPHAN)", 34, 646);
      }

      // Botão Fechar
      const closeHov = vr.hoverId === "info_close";
      roundRect(ctx, W - 150, 32, 110, 52, 14);
      ctx.fillStyle = closeHov ? "#dc2626" : "#0b5d3b";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("× Fechar", W - 95, 58);
      addHitButton(regions, "info_close", W - 150, 32, 110, 52, { type: "closePanel" });

      // Coluna direita: Texto editorial
      const tx = 536;
      const maxTW = W - tx - 50;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 32px Georgia, serif";
      const tLines = wrapLines(ctx, hs.title || "", maxTW - 120).slice(0, 2);
      tLines.forEach((l, i) => ctx.fillText(l, tx, 34 + i * 38));

      let curY = 34 + tLines.length * 38 + 12;
      ctx.fillStyle = "#0b5d3b";
      ctx.font = "700 20px Inter, sans-serif";
      const subLines = wrapLines(ctx, hs.subtitleLead || "", maxTW).slice(0, 2);
      subLines.forEach((l, i) => ctx.fillText(l, tx, curY + i * 26));
      curY += subLines.length * 26 + 16;

      // Quebra todos os parágrafos
      const bodyLines = [];
      ctx.font = "400 20px Inter, sans-serif";
      (hs.paragraphs || []).forEach(p => {
        wrapLines(ctx, p, maxTW).forEach(l => bodyLines.push(l));
        bodyLines.push("");
      });
      const maxVisible = 10;
      const maxScroll = Math.max(0, bodyLines.length - maxVisible);
      vr.infoScrollLine = Math.min(vr.infoScrollLine, maxScroll);
      const shown = bodyLines.slice(vr.infoScrollLine, vr.infoScrollLine + maxVisible);
      ctx.fillStyle = "#1e293b";
      shown.forEach((l, idx) => {
        ctx.fillText(l, tx, curY + idx * 27);
      });

      if (maxScroll > 0) {
        const upHov = vr.hoverId === "info_up";
        const dnHov = vr.hoverId === "info_dn";
        roundRect(ctx, tx, 502, 140, 44, 10);
        ctx.fillStyle = upHov ? "#0b5d3b" : "#e2e8f0";
        ctx.fill();
        ctx.fillStyle = upHov ? "#fff" : "#0f172a";
        ctx.font = "700 18px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("▲ Subir", tx + 70, 524);
        addHitButton(regions, "info_up", tx, 502, 140, 44, { type: "scrollInfo", dir: -4 });

        roundRect(ctx, tx + 156, 502, 140, 44, 10);
        ctx.fillStyle = dnHov ? "#0b5d3b" : "#e2e8f0";
        ctx.fill();
        ctx.fillStyle = dnHov ? "#fff" : "#0f172a";
        ctx.fillText("▼ Ler mais", tx + 226, 524);
        addHitButton(regions, "info_dn", tx + 156, 502, 140, 44, { type: "scrollInfo", dir: 4 });
      }

      // Caixa Você Sabia?
      if (hs.didYouKnow) {
        roundRect(ctx, tx, 568, maxTW, 148, 14);
        ctx.fillStyle = "#f1f5f9";
        ctx.fill();
        ctx.fillStyle = "#0b5d3b";
        ctx.fillRect(tx, 568, 7, 148);
        roundRect(ctx, tx + 18, 578, 128, 28, 6);
        ctx.fillStyle = "#fde047";
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.font = "800 16px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Você sabia?", tx + 82, 592);

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "600 18px Inter, sans-serif";
        ctx.fillStyle = "#334155";
        wrapLines(ctx, hs.didYouKnow, maxTW - 36).slice(0, 4).forEach((l, i) => {
          ctx.fillText(l, tx + 20, 616 + i * 24);
        });
      }
    });
  }

  // 4. PAINEL DE CONTROLES DA MAQUETE 3D (.GLB) DENTRO DO ÓCULOS QUEST 3
  function buildGlbControlPanel() {
    const g = vr.glbState;
    const sig = `${g.loaded}|${g.autoRotate}|${g.scaleMul.toFixed(2)}|${vr.hoverId}`;
    return getDynamicPanel("vrGlbHud", 1180, 260, sig, (ctx, W, H, regions) => {
      roundRect(ctx, 12, 12, W - 24, H - 24, 26);
      ctx.fillStyle = "rgba(14, 23, 21, 0.94)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f59e0b";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "900 28px Inter, sans-serif";
      ctx.fillText("Maquete 3D do Vale do Rio da Luz (.GLB em Estéreo)", 38, 56);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "600 18px Inter, sans-serif";
      ctx.fillText(
        g.loaded
          ? "Em 2007 o IPHAN tombou o Rio da Luz — gire ou aproxime o relevo tridimensional acima!"
          : (g.error || "Carregando geometria e relevo embutidos (.GLB)..."),
        38,
        96
      );

      const btns = [
        { id: "glb_rot", lbl: g.autoRotate ? "↻ Auto: ON" : "↻ Auto: OFF", act: { type: "glbCmd", cmd: "toggleAuto" }, active: g.autoRotate },
        { id: "glb_left", lbl: "◀ Girar Esq", act: { type: "glbCmd", cmd: "yawL" } },
        { id: "glb_right", lbl: "▶ Girar Dir", act: { type: "glbCmd", cmd: "yawR" } },
        { id: "glb_up", lbl: "▲ Inclinar+", act: { type: "glbCmd", cmd: "pitchU" } },
        { id: "glb_dn", lbl: "▼ Inclinar-", act: { type: "glbCmd", cmd: "pitchD" } },
        { id: "glb_zin", lbl: "Zoom +", act: { type: "glbCmd", cmd: "zin" } },
        { id: "glb_zout", lbl: "Zoom -", act: { type: "glbCmd", cmd: "zout" } },
        { id: "glb_close", lbl: "× Fechar 3D", act: { type: "closePanel" }, danger: true }
      ];

      const bw = 128, bh = 86, gap = 12, startX = 36, by = 142;
      btns.forEach((b, i) => {
        const bx = startX + i * (bw + gap);
        const hov = vr.hoverId === b.id;
        roundRect(ctx, bx, by, bw, bh, 14);
        ctx.fillStyle = b.danger ? (hov ? "#dc2626" : "#991b1b") : (b.active ? "#0b5d3b" : (hov ? "#334155" : "#1e293b"));
        ctx.fill();
        ctx.lineWidth = hov ? 3 : 2;
        ctx.strokeStyle = hov ? "#facc15" : "rgba(255,255,255,0.28)";
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "800 18px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(b.lbl, bx + bw * 0.5, by + bh * 0.5);
        addHitButton(regions, b.id, bx, by, bw, bh, b.act);
      });
    });
  }

  // 5. PAINEL ROTA LUMIAR (26 PONTOS + CATEGORIAS + DETALHES + SALTO 360°)
  function buildRotaPanel() {
    const rData = window.ROTA_LUMIAR_DATA || { points: [], categories: [] };
    const filtered = vr.rotaCategory === "all"
      ? rData.points
      : rData.points.filter(p => p.category === vr.rotaCategory);
    const pageSize = 8;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (vr.rotaPage >= totalPages) vr.rotaPage = 0;

    const sig = `${vr.rotaCategory}|${vr.rotaPage}|${vr.selectedRotaPoint?.num || 0}|${vr.hoverId}`;
    return getDynamicPanel("vrRota", 1220, 760, sig, (ctx, W, H, regions) => {
      // Fundo creme + faixa verde enxaimel
      roundRect(ctx, 10, 10, W - 20, H - 20, 28);
      ctx.fillStyle = "#f4efe4";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#5f7d12";
      ctx.stroke();

      // Cabeçalho creme
      ctx.fillStyle = "#111827";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "900 30px Georgia, serif";
      ctx.fillText("Rota Lumiar — Rio da Luz & Testo Alto (26 Pontos)", 38, 56);

      // Fechar
      const closeHov = vr.hoverId === "rota_close";
      roundRect(ctx, W - 140, 30, 104, 48, 12);
      ctx.fillStyle = closeHov ? "#dc2626" : "#0b5d3b";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("× Fechar", W - 88, 54);
      addHitButton(regions, "rota_close", W - 140, 30, 104, 48, { type: "closePanel" });

      // Abas de categoria
      const tabs = [{ id: "all", label: "Todos (26)", color: "#365314" }].concat(rData.categories);
      let tx = 38;
      tabs.forEach(t => {
        const tid = `rota_tab_${t.id}`;
        const hov = vr.hoverId === tid;
        const active = vr.rotaCategory === t.id;
        const tw = 212;
        roundRect(ctx, tx, 94, tw, 48, 24);
        ctx.fillStyle = active ? t.color : (hov ? "#d9e8d8" : "#ffffff");
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = t.color;
        ctx.stroke();

        ctx.fillStyle = active ? "#ffffff" : "#1e293b";
        ctx.font = "800 18px Inter, sans-serif";
        ctx.fillText(t.label, tx + tw * 0.5, 118);
        addHitButton(regions, tid, tx, 94, tw, 48, { type: "rotaCat", cat: t.id });
        tx += tw + 14;
      });

      // Diretório verde oliva inferior com 8 pontos por página
      roundRect(ctx, 28, 160, 740, 568, 20);
      ctx.fillStyle = "#85a71e";
      ctx.fill();

      const slice = filtered.slice(vr.rotaPage * pageSize, (vr.rotaPage + 1) * pageSize);
      const catColor = {};
      rData.categories.forEach(c => { catColor[c.id] = c.color; });

      slice.forEach((pt, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const px = 44 + col * 356;
        const py = 180 + row * 116;
        const pid = `rota_pt_${pt.num}`;
        const hov = vr.hoverId === pid;
        const sel = vr.selectedRotaPoint && vr.selectedRotaPoint.num === pt.num;

        roundRect(ctx, px, py, 340, 102, 16);
        ctx.fillStyle = sel ? "#fef08a" : (hov ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.86)");
        ctx.fill();
        if (sel || hov) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#0b5d3b";
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(px + 28, py + 34, 18, 0, Math.PI * 2);
        ctx.fillStyle = catColor[pt.category] || "#1e293b";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 17px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(pt.num), px + 28, py + 35);

        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "left";
        ctx.font = "800 19px Inter, sans-serif";
        ctx.fillText(pt.name.slice(0, 26), px + 56, py + 35);

        ctx.fillStyle = "#334155";
        ctx.font = "600 15px Inter, sans-serif";
        ctx.fillText((pt.atendimento || pt.region || "").slice(0, 36), px + 18, py + 74);

        addHitButton(regions, pid, px, py, 340, 102, { type: "selectRotaPt", pt });
      });

      // Botões paginação
      const prevHov = vr.hoverId === "rota_prev";
      const nextHov = vr.hoverId === "rota_next";
      roundRect(ctx, 46, 654, 190, 52, 14);
      ctx.fillStyle = prevHov ? "#14532d" : "#365314";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("◀ Página Ant.", 141, 680);
      addHitButton(regions, "rota_prev", 46, 654, 190, 52, { type: "rotaPage", dir: -1, max: totalPages });

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.fillText(`Página ${vr.rotaPage + 1} / ${totalPages}`, 398, 680);

      roundRect(ctx, 560, 654, 190, 52, 14);
      ctx.fillStyle = nextHov ? "#14532d" : "#365314";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.fillText("Próx. Página ▶", 655, 680);
      addHitButton(regions, "rota_next", 560, 654, 190, 52, { type: "rotaPage", dir: 1, max: totalPages });

      // Coluna Direita: Detalhe do Ponto Selecionado + Salto 360°
      roundRect(ctx, 788, 160, 404, 568, 20);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#cbd5e1";
      ctx.stroke();

      const selPt = vr.selectedRotaPoint || slice[0] || rData.points[0];
      if (selPt) {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = catColor[selPt.category] || "#0b5d3b";
        roundRect(ctx, 812, 184, 160, 32, 16);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "800 15px Inter, sans-serif";
        ctx.fillText(`PONTO #${selPt.num}`, 832, 192);

        ctx.fillStyle = "#0f172a";
        ctx.font = "900 24px Georgia, serif";
        const nm = wrapLines(ctx, selPt.name, 356).slice(0, 2);
        nm.forEach((l, i) => ctx.fillText(l, 812, 232 + i * 30));

        let dy = 232 + nm.length * 30 + 12;
        ctx.fillStyle = "#334155";
        ctx.font = "400 18px Inter, sans-serif";
        wrapLines(ctx, selPt.description, 356).slice(0, 6).forEach((l, i) => {
          ctx.fillText(l, 812, dy + i * 24);
        });

        dy += 164;
        ctx.fillStyle = "#0f172a";
        ctx.font = "700 16px Inter, sans-serif";
        wrapLines(ctx, `End.: ${selPt.endereco || ""}`, 356).slice(0, 2).forEach((l, i) => {
          ctx.fillText(l, 812, dy + i * 22);
        });
        wrapLines(ctx, `Horário: ${selPt.atendimento || ""}`, 356).slice(0, 2).forEach((l, i) => {
          ctx.fillText(l, 812, dy + 52 + i * 22);
        });
        if (selPt.telefone) {
          ctx.fillText(`Tel.: ${selPt.telefone}`, 812, dy + 104);
        }

        if (selPt.sceneId) {
          const goHov = vr.hoverId === "rota_go_360";
          roundRect(ctx, 812, 634, 356, 70, 16);
          ctx.fillStyle = goHov ? "#16a34a" : "#0b5d3b";
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 20px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Voar para Cena Drone 360°", 990, 669);
          addHitButton(regions, "rota_go_360", 812, 634, 356, 70, { type: "goScene", sceneId: selPt.sceneId });
        }
      }
    });
  }

  // 6. PAINEL SATÉLITE DO VALE DO RIO DA LUZ DENTRO DO ÓCULOS QUEST 3
  function buildSatellitePanel() {
    const rData = window.ROTA_LUMIAR_DATA || { points: [], categories: [] };
    const scenes = Object.values(window.TOUR_SC_DATA.scenes || {});
    const sig = `${vr.sceneId}|${vr.selectedSatPoint?.label || ""}|${vr.hoverId}|${Math.round(vr.headYawRad * 10)}`;

    return getDynamicPanel("vrSat", 1180, 740, sig, (ctx, W, H, regions) => {
      roundRect(ctx, 10, 10, W - 20, H - 20, 28);
      ctx.fillStyle = "#0e1b17";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3b82f6";
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "900 28px Inter, sans-serif";
      ctx.fillText("Mapa do Vale Tombado & Pontos Clicáveis (RV Quest 3)", 36, 52);

      const closeHov = vr.hoverId === "sat_close";
      roundRect(ctx, W - 138, 28, 102, 46, 12);
      ctx.fillStyle = closeHov ? "#dc2626" : "#0b5d3b";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 20px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("× Fechar", W - 87, 51);
      addHitButton(regions, "sat_close", W - 138, 28, 102, 46, { type: "closePanel" });

      // Área cartográfica com enquadramento dinâmico de todos os 26 pontos + rotas
      const mapX = 32, mapY = 92, mapW = 730, mapH = 612;
      ctx.save();
      roundRect(ctx, mapX, mapY, mapW, mapH, 18);
      const satBg = ctx.createLinearGradient(mapX, mapY, mapX + mapW, mapY + mapH);
      satBg.addColorStop(0, "#1c3c29");
      satBg.addColorStop(0.5, "#112b1e");
      satBg.addColorStop(1, "#1e3d2b");
      ctx.fillStyle = satBg;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.stroke();
      ctx.clip();

      // Grade cartográfica sutil
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let gx = mapX + 70; gx < mapX + mapW; gx += 70) {
        ctx.beginPath(); ctx.moveTo(gx, mapY); ctx.lineTo(gx, mapY + mapH); ctx.stroke();
      }
      for (let gy = mapY + 70; gy < mapY + mapH; gy += 70) {
        ctx.beginPath(); ctx.moveTo(mapX, gy); ctx.lineTo(mapX + mapW, gy); ctx.stroke();
      }

      let bMinLat = Infinity, bMaxLat = -Infinity, bMinLng = Infinity, bMaxLng = -Infinity;
      const expandB = (lat, lng) => {
        if (!lat || !lng) return;
        bMinLat = Math.min(bMinLat, lat); bMaxLat = Math.max(bMaxLat, lat);
        bMinLng = Math.min(bMinLng, lng); bMaxLng = Math.max(bMaxLng, lng);
      };
      rData.points.forEach(pt => expandB(pt.lat, pt.lng));
      scenes.forEach(sc => sc.coordinates && expandB(sc.coordinates.lat, sc.coordinates.lng));
      if (!Number.isFinite(bMinLat)) { bMinLat = -26.75; bMaxLat = -26.52; bMinLng = -49.18; bMaxLng = -49.10; }
      const padLat = (bMaxLat - bMinLat) * 0.14 || 0.01;
      const padLng = (bMaxLng - bMinLng) * 0.14 || 0.01;
      const minLat = bMinLat - padLat, maxLat = bMaxLat + padLat;
      const minLng = bMinLng - padLng, maxLng = bMaxLng + padLng;

      const project = (lat, lng) => ({
        x: mapX + 34 + ((lng - minLng) / (maxLng - minLng)) * (mapW - 68),
        y: mapY + 34 + ((maxLat - lat) / (maxLat - minLat)) * (mapH - 68)
      });

      // Estradas reais Rota Lumiar se carregadas
      if (Array.isArray(window.ROTA_LUMIAR_ROAD_LEGS)) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(250, 204, 21, 0.85)";
        ctx.lineWidth = 4;
        window.ROTA_LUMIAR_ROAD_LEGS.forEach(leg => {
          const poly = leg && leg.coords;
          if (!Array.isArray(poly) || poly.length < 2) return;
          ctx.beginPath();
          poly.forEach((pt, i) => {
            const p = project(pt[0], pt[1]);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
        });
      }

      // Cone de visão ao vivo da câmera RV
      const curSc = window.TOUR_SC_DATA.scenes[vr.sceneId];
      if (curSc && curSc.coordinates) {
        const sp = project(curSc.coordinates.lat, curSc.coordinates.lng);
        const dirAngle = -Math.PI * 0.5 + vr.headYawRad;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.arc(sp.x, sp.y, 92, dirAngle - 0.45, dirAngle + 0.45);
        ctx.closePath();
        ctx.fillStyle = "rgba(56, 189, 248, 0.34)";
        ctx.fill();
      }

      // 26 Pinos Rota Lumiar
      rData.points.forEach(pt => {
        if (!pt.lat || !pt.lng) return;
        const p = project(pt.lat, pt.lng);
        const pid = `sat_rl_${pt.num}`;
        const hov = vr.hoverId === pid;
        ctx.beginPath();
        ctx.arc(p.x, p.y, hov ? 14 : 11, 0, Math.PI * 2);
        ctx.fillStyle = hov ? "#facc15" : "#ea580c";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 11px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(pt.num), p.x, p.y + 1);
        addHitButton(regions, pid, p.x - 16, p.y - 16, 32, 32, {
          type: "satSelect",
          info: { label: `#${pt.num} ${pt.name}`, desc: pt.description, addr: pt.endereco, sceneId: pt.sceneId }
        });
      });

      // 4 Pinos Principais Drone 360°
      scenes.forEach(sc => {
        if (!sc.coordinates) return;
        const p = project(sc.coordinates.lat, sc.coordinates.lng);
        const sid = `sat_sc_${sc.id}`;
        const hov = vr.hoverId === sid;
        const act = vr.sceneId === sc.id;
        roundRect(ctx, p.x - 24, p.y - 14, 48, 28, 14);
        ctx.fillStyle = act ? "#16a34a" : (hov ? "#38bdf8" : "#0284c7");
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 13px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("360°", p.x, p.y + 1);
        addHitButton(regions, sid, p.x - 28, p.y - 18, 56, 36, { type: "goScene", sceneId: sc.id });
      });

      // Rótulos regionais no mapa
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "800 14px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("RIO DA LUZ (Jaraguá do Sul)", mapX + 20, mapY + 28);
      ctx.textAlign = "right";
      ctx.fillText("TESTO ALTO (Pomerode)", mapX + mapW - 20, mapY + mapH - 22);
      ctx.restore();

      // Sidebar direita: Cenas rápidas + Ponto selecionado
      roundRect(ctx, 784, 92, 364, 612, 18);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "#86efac";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.fillText("Voar para Fotos Drone 360°", 806, 128);

      scenes.slice(0, 4).forEach((sc, i) => {
        const bx = 806, by = 158 + i * 68;
        const bid = `sat_btn_${sc.id}`;
        const hov = vr.hoverId === bid;
        roundRect(ctx, bx, by, 320, 54, 12);
        ctx.fillStyle = vr.sceneId === sc.id ? "#0b5d3b" : (hov ? "#0284c7" : "rgba(255,255,255,0.12)");
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 17px Inter, sans-serif";
        ctx.fillText((sc.placeMenuTitle || sc.shortTitle).slice(0, 28), bx + 16, by + 28);
        addHitButton(regions, bid, bx, by, 320, 54, { type: "goScene", sceneId: sc.id });
      });

      const info = vr.selectedSatPoint;
      ctx.fillStyle = "#facc15";
      ctx.font = "800 18px Inter, sans-serif";
      ctx.fillText(info ? info.label.slice(0, 28) : "Toque em um pino no mapa", 806, 462);

      if (info) {
        ctx.textBaseline = "top";
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "400 16px Inter, sans-serif";
        wrapLines(ctx, info.desc || "", 320).slice(0, 5).forEach((l, i) => {
          ctx.fillText(l, 806, 488 + i * 22);
        });
        if (info.sceneId) {
          const jHov = vr.hoverId === "sat_jump_sel";
          roundRect(ctx, 806, 622, 320, 58, 14);
          ctx.fillStyle = jHov ? "#16a34a" : "#0b5d3b";
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "800 18px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Abrir em 360° RV", 966, 651);
          addHitButton(regions, "sat_jump_sel", 806, 622, 320, 58, { type: "goScene", sceneId: info.sceneId });
        }
      }
    });
  }

  // =========================================================================
  // PARSER / RENDERIZADOR DO MODELO 3D (.GLB) DENTRO DO CONTEXTO WEBXR
  // =========================================================================
  function loadGLBIntoVR() {
    if (vr.glbState.loaded || vr.glbState.loading || !vr.gl) return;
    vr.glbState.loading = true;
    const key = "rio_da_luz_glb";
    const url = "assets/modelos/3D_RIO_DA_LUZ_logado.glb";

    const getBuf = () => {
      if (window.LOCAL_GLB_MODELS && window.LOCAL_GLB_MODELS[key]) {
        const uri = window.LOCAL_GLB_MODELS[key];
        const comma = uri.indexOf(",");
        const binStr = atob(uri.slice(comma + 1));
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return Promise.resolve(bytes.buffer);
      }
      return fetch(url).then(r => r.arrayBuffer());
    };

    getBuf().then(buf => {
      if (!vr.gl) return;
      const gl = vr.gl;
      const dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x46546C67) throw new Error("GLB inválido");
      let off = 12, gltf = null, bin = null;
      while (off < buf.byteLength) {
        const clen = dv.getUint32(off, true);
        const ctype = dv.getUint32(off + 4, true);
        const start = off + 8;
        if (ctype === 0x4E4F534A) gltf = JSON.parse(new TextDecoder("utf-8").decode(new Uint8Array(buf, start, clen)));
        else if (ctype === 0x004E4942) bin = buf.slice(start, start + clen);
        off = start + clen;
      }

      const compCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
      const getAcc = (idx) => {
        const acc = gltf.accessors[idx];
        const bv = gltf.bufferViews[acc.bufferView];
        const byteOff = (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const cnt = acc.count * (compCount[acc.type] || 1);
        const Arr = acc.componentType === 5126 ? Float32Array
          : (acc.componentType === 5125 ? Uint32Array
          : (acc.componentType === 5123 ? Uint16Array : Uint8Array));
        return { data: new Arr(bin, byteOff, cnt), componentType: acc.componentType };
      };

      const glTex = [];
      if (gltf.textures && gltf.images) {
        gltf.textures.forEach((td, ti) => {
          const t = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([140, 175, 130, 255]));
          glTex[ti] = t;
          const imgDef = gltf.images[td.source];
          if (imgDef && imgDef.bufferView !== undefined) {
            const bv = gltf.bufferViews[imgDef.bufferView];
            const blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: imgDef.mimeType || "image/png" });
            const u = URL.createObjectURL(blob);
            const im = new Image();
            im.onload = () => {
              if (!vr.gl) return;
              gl.bindTexture(gl.TEXTURE_2D, t);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
              URL.revokeObjectURL(u);
            };
            im.src = u;
          }
        });
      }

      const extU32 = gl.getExtension("OES_element_index_uint");
      const calls = [];
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];

      const visit = (nIdx, pMat) => {
        const node = gltf.nodes[nIdx];
        let local = mat4Identity();
        if (node.matrix) local = new Float32Array(node.matrix);
        else if (node.translation) local = mat4Translation(...node.translation);
        const wMat = mat4Multiply(pMat, local);

        if (node.mesh !== undefined) {
          gltf.meshes[node.mesh].primitives.forEach(prim => {
            if (!prim.attributes || prim.attributes.POSITION === undefined) return;
            const pos = getAcc(prim.attributes.POSITION).data;
            let idxObj = prim.indices !== undefined ? getAcc(prim.indices) : null;
            let idxArr = idxObj ? idxObj.data : null;
            let idxType = idxObj ? idxObj.componentType : gl.UNSIGNED_SHORT;
            if (idxType === 5125 && !extU32 && !(gl instanceof WebGL2RenderingContext)) {
              idxArr = new Uint16Array(idxArr);
              idxType = gl.UNSIGNED_SHORT;
            }
            const uv = prim.attributes.TEXCOORD_0 !== undefined ? getAcc(prim.attributes.TEXCOORD_0).data : new Float32Array((pos.length / 3) * 2);
            const norm = prim.attributes.NORMAL !== undefined ? getAcc(prim.attributes.NORMAL).data : (() => {
              const n = new Float32Array(pos.length);
              const tc = idxArr ? idxArr.length : pos.length / 3;
              for (let i = 0; i < tc; i += 3) {
                const i0 = (idxArr ? idxArr[i] : i) * 3;
                const i1 = (idxArr ? idxArr[i + 1] : i + 1) * 3;
                const i2 = (idxArr ? idxArr[i + 2] : i + 2) * 3;
                const ax = pos[i1] - pos[i0], ay = pos[i1 + 1] - pos[i0 + 1], az = pos[i1 + 2] - pos[i0 + 2];
                const bx = pos[i2] - pos[i0], by = pos[i2 + 1] - pos[i0 + 1], bz = pos[i2 + 2] - pos[i0 + 2];
                const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
                n[i0] += nx; n[i0 + 1] += ny; n[i0 + 2] += nz;
                n[i1] += nx; n[i1 + 1] += ny; n[i1 + 2] += nz;
                n[i2] += nx; n[i2 + 1] += ny; n[i2 + 2] += nz;
              }
              return n;
            })();

            for (let i = 0; i < pos.length; i += 3) {
              const p = transformVec4(wMat, [pos[i], pos[i + 1], pos[i + 2], 1]);
              min[0] = Math.min(min[0], p[0]); min[1] = Math.min(min[1], p[1]); min[2] = Math.min(min[2], p[2]);
              max[0] = Math.max(max[0], p[0]); max[1] = Math.max(max[1], p[1]); max[2] = Math.max(max[2], p[2]);
            }

            const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
            const nBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nBuf); gl.bufferData(gl.ARRAY_BUFFER, norm, gl.STATIC_DRAW);
            const uBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uBuf); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
            let iBuf = null;
            if (idxArr) {
              iBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxArr, gl.STATIC_DRAW);
            }

            const matDef = (prim.material !== undefined && gltf.materials) ? gltf.materials[prim.material] : {};
            const pbr = matDef.pbrMetallicRoughness || {};
            const texIdx = pbr.baseColorTexture ? pbr.baseColorTexture.index : undefined;

            calls.push({
              pBuf, nBuf, uBuf, iBuf, idxType,
              count: idxArr ? idxArr.length : pos.length / 3,
              wMat,
              tex: texIdx !== undefined ? glTex[texIdx] : null,
              baseColor: pbr.baseColorFactor || [1, 1, 1, 1]
            });
          });
        }
        (node.children || []).forEach(c => visit(c, wMat));
      };

      const sc = gltf.scenes[gltf.scene || 0];
      (sc.nodes || []).forEach(n => visit(n, mat4Identity()));

      vr.glbState.drawCalls = calls;
      vr.glbState.center = [(min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5];
      vr.glbState.radius = Math.max(1, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 0.5);
      vr.glbState.loaded = true;
      vr.glbState.loading = false;
    }).catch(e => {
      vr.glbState.error = String(e.message || e);
      vr.glbState.loading = false;
    });
  }

  // =========================================================================
  // RENDERIZAÇÃO COMPLETA POR OLHO (USADA PELO QUEST 3 ESTÉREO E PELO SIMULADOR)
  // =========================================================================
  function collectFrameClickables() {
    const list = [];
    const sc = window.TOUR_SC_DATA.scenes[vr.sceneId];
    if (!sc) return list;

    // 1. Hotspots espaciais sobre a esfera R=5.8m (com visibilidade permanente para clicar com o controle)
    const worldRot = mat4RotateY(vr.sceneWorldYawRad);
    (sc.hotspots || []).forEach(hs => {
      const localD = sphericalToLocalDir(hs.pitch, hs.yaw);
      const wD = transformVec4(worldRot, [localD[0] * 5.8, localD[1] * 5.8, localD[2] * 5.8, 1]);
      const pos = [wD[0], wD[1], wD[2]];
      const rotToCam = mat4FromPosTargetUp(pos, [0, 0, 0], [0, 1, 0]);
      const hovered = vr.hoverId === `hs_${hs.id}`;
      const sizeW = hovered ? 1.55 : 1.32;
      const sizeH = sizeW * 0.5;
      const model = mat4Multiply(rotToCam, mat4Scale(sizeW, sizeH, 1));
      const badge = getHotspotBadgeTexture(hs, hovered);

      list.push({
        id: `hs_${hs.id}`,
        kind: "hotspot",
        hs,
        tex: badge.tex,
        model,
        width: 512,
        height: 256,
        glow: hovered ? 1.0 : 0.0
      });
    });

    // 2. Painel flutuante ativo (Cenas / Info / Rota Lumiar / Satélite / Controles GLB)
    const anchorMat = mat4Multiply(mat4RotateY(vr.uiAnchorYawRad), mat4Identity());
    const placeAnchored = (dist, yOff, pitchTilt, wMeters, hMeters) => {
      const t = mat4Multiply(anchorMat, mat4Translation(0, yOff, -dist));
      return mat4Multiply(mat4Multiply(t, mat4RotateX(pitchTilt)), mat4Scale(wMeters, hMeters, 1));
    };

    if (vr.openPanel === "scenes") {
      const p = buildScenesPanel();
      list.push({ id: "panel_scenes", kind: "panel", panel: p, model: placeAnchored(2.35, 0.06, -0.02, 2.35, 1.42), width: 1120, height: 680 });
    } else if (vr.openPanel === "info") {
      const p = buildInfoPanel();
      if (p) list.push({ id: "panel_info", kind: "panel", panel: p, model: placeAnchored(2.35, 0.08, -0.02, 2.45, 1.58), width: 1180, height: 760 });
    } else if (vr.openPanel === "rota") {
      const p = buildRotaPanel();
      list.push({ id: "panel_rota", kind: "panel", panel: p, model: placeAnchored(2.35, 0.08, -0.02, 2.52, 1.56), width: 1220, height: 760 });
    } else if (vr.openPanel === "satellite") {
      const p = buildSatellitePanel();
      list.push({ id: "panel_sat", kind: "panel", panel: p, model: placeAnchored(2.35, 0.08, -0.02, 2.45, 1.54), width: 1180, height: 740 });
    } else if (vr.openPanel === "glb") {
      const p = buildGlbControlPanel();
      list.push({ id: "panel_glb_hud", kind: "panel", panel: p, model: placeAnchored(2.05, -0.45, -0.20, 2.02, 0.44), width: 1180, height: 260 });
    }

    // 3. Dock principal inferior sempre acessível em 3D (abaixo de qualquer painel aberto)
    const dock = buildDockPanel();
    list.push({
      id: "panel_dock",
      kind: "panel",
      panel: dock,
      model: placeAnchored(2.15, vr.openPanel ? -0.96 : -0.82, -0.34, 1.95, 0.36),
      width: 1180,
      height: 220
    });

    return list;
  }

  function renderEye(projMat, viewMat, rays, showReticle) {
    const gl = vr.gl;

    // 1. Esfera 360° (Depth off)
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);

    const panoTex = ensureScenePanoTexture(vr.sceneId);
    if (panoTex && vr.skyProg) {
      const skyModel = mat4RotateY(vr.sceneWorldYawRad);
      const vp = mat4Multiply(projMat, viewMat);
      const mvp = mat4Multiply(vp, skyModel);

      gl.useProgram(vr.skyProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, vr.skyMesh.posBuf);
      const lPos = gl.getAttribLocation(vr.skyProg, "aPos");
      gl.enableVertexAttribArray(lPos);
      gl.vertexAttribPointer(lPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, vr.skyMesh.uvBuf);
      const lUV = gl.getAttribLocation(vr.skyProg, "aUV");
      gl.enableVertexAttribArray(lUV);
      gl.vertexAttribPointer(lUV, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, panoTex);
      gl.uniform1i(gl.getUniformLocation(vr.skyProg, "uTex"), 0);
      gl.uniformMatrix4fv(gl.getUniformLocation(vr.skyProg, "uMVP"), false, mvp);
      gl.uniform1f(gl.getUniformLocation(vr.skyProg, "uAlpha"), 1.0);
      gl.uniform1f(gl.getUniformLocation(vr.skyProg, "uGlow"), 0.0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vr.skyMesh.idxBuf);
      gl.drawElements(gl.TRIANGLES, vr.skyMesh.count, gl.UNSIGNED_SHORT, 0);
    }

    // 2. Maquete 3D Real (.GLB) em estéreo verdadeiro com profundidade (quando aberta)
    const vp = mat4Multiply(projMat, viewMat);
    if (vr.openPanel === "glb" && vr.glbState.loaded && vr.glbProg) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(vr.glbProg);

      const g = vr.glbState;
      const targetScale = (0.94 * g.scaleMul) / Math.max(1, g.radius);
      let m = mat4TranslateOriginAndTransform(g.center, g.yaw, g.pitch, targetScale, vr.uiAnchorYawRad);

      const lPos = gl.getAttribLocation(vr.glbProg, "aPos");
      const lNorm = gl.getAttribLocation(vr.glbProg, "aNorm");
      const lUV = gl.getAttribLocation(vr.glbProg, "aUV");
      gl.uniform1i(gl.getUniformLocation(vr.glbProg, "uBaseTex"), 0);

      g.drawCalls.forEach(dc => {
        const dcModel = mat4Multiply(m, dc.wMat);
        const dcMvp = mat4Multiply(vp, dcModel);
        gl.uniformMatrix4fv(gl.getUniformLocation(vr.glbProg, "uModel"), false, dcModel);
        gl.uniformMatrix4fv(gl.getUniformLocation(vr.glbProg, "uMVP"), false, dcMvp);

        gl.bindBuffer(gl.ARRAY_BUFFER, dc.pBuf);
        gl.enableVertexAttribArray(lPos);
        gl.vertexAttribPointer(lPos, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, dc.nBuf);
        gl.enableVertexAttribArray(lNorm);
        gl.vertexAttribPointer(lNorm, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, dc.uBuf);
        gl.enableVertexAttribArray(lUV);
        gl.vertexAttribPointer(lUV, 2, gl.FLOAT, false, 0, 0);

        if (dc.tex) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dc.tex);
          gl.uniform1f(gl.getUniformLocation(vr.glbProg, "uHasTex"), 1.0);
        } else {
          gl.uniform1f(gl.getUniformLocation(vr.glbProg, "uHasTex"), 0.0);
        }
        gl.uniform4fv(gl.getUniformLocation(vr.glbProg, "uBaseColor"), dc.baseColor);

        if (dc.iBuf) {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, dc.iBuf);
          gl.drawElements(gl.TRIANGLES, dc.count, dc.idxType, 0);
        } else {
          gl.drawArrays(gl.TRIANGLES, 0, dc.count);
        }
      });
    }

    // 3. Quads UI e Hotspots (Transparentes com alpha blending)
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(vr.skyProg);
    const qPos = gl.getAttribLocation(vr.skyProg, "aPos");
    const qUV = gl.getAttribLocation(vr.skyProg, "aUV");
    gl.uniform1i(gl.getUniformLocation(vr.skyProg, "uTex"), 0);

    vr.clickableMeshes.forEach(item => {
      const mvp = mat4Multiply(vp, item.model);
      gl.bindBuffer(gl.ARRAY_BUFFER, vr.unitQuadMesh.posBuf);
      gl.enableVertexAttribArray(qPos);
      gl.vertexAttribPointer(qPos, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, vr.unitQuadMesh.uvBuf);
      gl.enableVertexAttribArray(qUV);
      gl.vertexAttribPointer(qUV, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, item.kind === "hotspot" ? item.tex : item.panel.tex);
      gl.uniformMatrix4fv(gl.getUniformLocation(vr.skyProg, "uMVP"), false, mvp);
      gl.uniform1f(gl.getUniformLocation(vr.skyProg, "uAlpha"), 1.0);
      gl.uniform1f(gl.getUniformLocation(vr.skyProg, "uGlow"), item.glow || 0.0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });

    // 4. Raios Laser dos controles Meta Quest 3 + Ponto de Impacto / Mira Central
    if (vr.beamProg) {
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(vr.beamProg);
      const bLoc = gl.getAttribLocation(vr.beamProg, "aPos");
      const uIsPt = gl.getUniformLocation(vr.beamProg, "uIsPoint");
      gl.uniformMatrix4fv(gl.getUniformLocation(vr.beamProg, "uMVP"), false, vp);

      rays.forEach(r => {
        if (!r.drawBeam) return;
        const end = r.hitPoint || [
          r.origin[0] + r.dir[0] * 6.0,
          r.origin[1] + r.dir[1] * 6.0,
          r.origin[2] + r.dir[2] * 6.0
        ];
        gl.bindBuffer(gl.ARRAY_BUFFER, vr.beamBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          r.origin[0], r.origin[1], r.origin[2],
          end[0], end[1], end[2]
        ]), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(bLoc);
        gl.vertexAttribPointer(bLoc, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(uIsPt, 0.0);
        gl.uniform4fv(gl.getUniformLocation(vr.beamProg, "uColor"), r.hasHit ? [0.98, 0.80, 0.08, 0.95] : [0.22, 0.74, 0.97, 0.85]);
        gl.drawArrays(gl.LINES, 0, 2);

        if (r.hasHit) {
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(end), gl.DYNAMIC_DRAW);
          gl.uniform1f(uIsPt, 1.0);
          gl.uniform4fv(gl.getUniformLocation(vr.beamProg, "uColor"), [0.98, 0.85, 0.1, 1.0]);
          gl.drawArrays(gl.POINTS, 0, 1);
        }
      });

      if (showReticle) {
        const f = vr.lastHeadForward;
        gl.bindBuffer(gl.ARRAY_BUFFER, vr.beamBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([f[0] * 2.0, f[1] * 2.0, f[2] * 2.0]), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(bLoc);
        gl.vertexAttribPointer(bLoc, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(uIsPt, 1.0);
        gl.uniform4fv(gl.getUniformLocation(vr.beamProg, "uColor"), vr.hoverId ? [0.98, 0.84, 0.08, 1.0] : [0.22, 0.74, 0.97, 0.9]);
        gl.drawArrays(gl.POINTS, 0, 1);
      }
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function mat4TranslateOriginAndTransform(center, yaw, pitch, scale, anchorYawRad) {
    const toOrigin = mat4Translation(-center[0], -center[1], -center[2]);
    const rot = mat4Multiply(mat4RotateX(pitch), mat4RotateY(yaw));
    const scl = mat4Scale(scale, scale, scale);
    const placeLocal = mat4Translation(0, 0.44, -2.35);
    const anchorRot = mat4RotateY(anchorYawRad);
    return mat4Multiply(anchorRot, mat4Multiply(placeLocal, mat4Multiply(scl, mat4Multiply(rot, toOrigin))));
  }

  // =========================================================================
  // RAYCASTING E EXECUÇÃO DE AÇÕES QUANDO CLICADO NO META QUEST 3 / PRÉVIA
  // =========================================================================
  function evaluateRayHit(origin, dir) {
    let best = null;
    vr.clickableMeshes.forEach(item => {
      const res = intersectRayQuad(origin, dir, item.model, item.width, item.height);
      if (res && (!best || res.dist < best.dist)) {
        best = { item, res };
      }
    });
    if (!best) return null;

    if (best.item.kind === "hotspot") {
      return {
        hoverId: `hs_${best.item.hs.id}`,
        hitPoint: best.res.worldHit,
        action: { type: "hotspot", hs: best.item.hs }
      };
    }

    const reg = findRegionAt(best.item.panel.regions, best.res.px, best.res.py);
    return {
      hoverId: reg ? reg.id : null,
      hitPoint: best.res.worldHit,
      action: reg ? reg.action : null
    };
  }

  function performVRAction(action) {
    if (!action) return;
    switch (action.type) {
      case "hotspot": {
        const hs = action.hs;
        if (hs.type === "scene" && hs.targetSceneId) {
          switchVRScene(hs.targetSceneId);
        } else if (hs.type === "info") {
          vr.activeInfoHotspot = hs;
          vr.infoScrollLine = 0;
          vr.openPanel = "info";
          recenterUI();
        } else if (hs.type === "3d") {
          vr.openPanel = "glb";
          loadGLBIntoVR();
          recenterUI();
        }
        break;
      }
      case "togglePanel":
        vr.openPanel = (vr.openPanel === action.panel) ? null : action.panel;
        recenterUI();
        break;
      case "openPanel":
        vr.openPanel = action.panel;
        recenterUI();
        break;
      case "closePanel":
        vr.openPanel = null;
        break;
      case "openGLB":
        vr.openPanel = (vr.openPanel === "glb") ? null : "glb";
        if (vr.openPanel === "glb") loadGLBIntoVR();
        recenterUI();
        break;
      case "goScene":
        switchVRScene(action.sceneId);
        break;
      case "recenter":
        recenterUI();
        break;
      case "exitVR":
        exitVR();
        break;
      case "scrollInfo":
        vr.infoScrollLine = Math.max(0, vr.infoScrollLine + action.dir);
        break;
      case "glbCmd": {
        const g = vr.glbState;
        if (action.cmd === "toggleAuto") g.autoRotate = !g.autoRotate;
        else if (action.cmd === "yawL") { g.autoRotate = false; g.yaw -= 0.32; }
        else if (action.cmd === "yawR") { g.autoRotate = false; g.yaw += 0.32; }
        else if (action.cmd === "pitchU") g.pitch = Math.min(1.25, g.pitch + 0.16);
        else if (action.cmd === "pitchD") g.pitch = Math.max(0.08, g.pitch - 0.16);
        else if (action.cmd === "zin") g.scaleMul = Math.min(2.1, g.scaleMul * 1.18);
        else if (action.cmd === "zout") g.scaleMul = Math.max(0.55, g.scaleMul * 0.85);
        break;
      }
      case "rotaCat":
        vr.rotaCategory = action.cat;
        vr.rotaPage = 0;
        break;
      case "rotaPage":
        vr.rotaPage = (vr.rotaPage + action.dir + action.max) % action.max;
        break;
      case "selectRotaPt":
        vr.selectedRotaPoint = action.pt;
        break;
      case "satSelect":
        vr.selectedSatPoint = action.info;
        break;
    }
  }

  function recenterUI() {
    vr.uiAnchorYawRad = vr.headYawRad;
  }

  function switchVRScene(sceneId) {
    const sc = window.TOUR_SC_DATA.scenes[sceneId];
    if (!sc) return;
    vr.sceneId = sceneId;
    vr.openPanel = null;
    const ivYaw = sc.initialView ? sc.initialView.yaw : 0;
    vr.sceneWorldYawRad = ivYaw * DEG2RAD;
    vr.uiAnchorYawRad = vr.headYawRad;
    vr.simYaw = 0;
    vr.simPitch = (sc.initialView ? sc.initialView.pitch : -8) * 0.4;
    vr.toastText = sc.travelLabel || `Viajando para ${sc.placeMenuTitle || sc.shortTitle}`;
    vr.toastUntil = performance.now() + 2600;
    ensureScenePanoTexture(sceneId);
    if (window.GeoSC360 && typeof window.GeoSC360.goToScene === "function") {
      window.GeoSC360.goToScene(sceneId, false, false);
    }
  }

  // =========================================================================
  // LOOPS DE RENDERIZAÇÃO: WEBXR HARDWARE QUEST 3 vs PRÉVIA ESTÉREO NAVEGADOR
  // =========================================================================
  function onXRFrame(time, frame) {
    if (!vr.active || !vr.xrSession) return;
    vr.xrSession.requestAnimationFrame(onXRFrame);

    const gl = vr.gl;
    const layer = vr.xrSession.renderState.baseLayer;
    const pose = frame.getViewerPose(vr.xrRefSpace);
    if (!pose || !layer) return;

    // Atualiza direção da cabeça
    const hMat = pose.transform.matrix;
    const fwd = norm3([-hMat[8], -hMat[9], -hMat[10]]);
    vr.lastHeadForward = fwd;
    vr.headYawRad = Math.atan2(-fwd[0], -fwd[2]);

    if (vr.openPanel === "glb" && vr.glbState.autoRotate) {
      vr.glbState.yaw += 0.006;
    }

    vr.clickableMeshes = collectFrameClickables();

    // Coleta raios dos controles Touch Plus / Mãos Quest 3
    const rays = [];
    let activeHover = null;
    for (const src of vr.xrSession.inputSources) {
      if (!src.targetRaySpace) continue;
      const rPose = frame.getPose(src.targetRaySpace, vr.xrRefSpace);
      if (!rPose) continue;
      const rm = rPose.transform.matrix;
      const origin = [rm[12], rm[13], rm[14]];
      const dir = norm3([-rm[8], -rm[9], -rm[10]]);
      const hit = evaluateRayHit(origin, dir);
      if (hit && hit.hoverId && !activeHover) activeHover = hit.hoverId;
      rays.push({
        inputSource: src,
        origin,
        dir,
        drawBeam: true,
        hasHit: Boolean(hit),
        hitPoint: hit ? hit.hitPoint : null,
        action: hit ? hit.action : null
      });
    }

    // Fallback mira de cabeça se nenhum controle apontar
    if (rays.length === 0) {
      const origin = [pose.transform.position.x, pose.transform.position.y, pose.transform.position.z];
      const hit = evaluateRayHit(origin, fwd);
      if (hit && hit.hoverId) activeHover = hit.hoverId;
      rays.push({ origin, dir: fwd, drawBeam: false, hasHit: Boolean(hit), action: hit ? hit.action : null });
    }
    vr.hoverId = activeHover;
    vr._latestXRRays = rays;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0.03, 0.06, 0.05, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for (const view of pose.views) {
      const vp = layer.getViewport(view);
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      renderEye(view.projectionMatrix, view.transform.inverse.matrix, rays, rays.length === 0 || !rays[0].drawBeam);
    }
  }

  function simRenderLoop() {
    if (!vr.active || vr.isWebXR) return;
    vr.rafId = requestAnimationFrame(simRenderLoop);

    const gl = vr.gl;
    const c = vr.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(200, c.clientWidth || window.innerWidth);
    const cssH = Math.max(200, c.clientHeight || window.innerHeight);
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);
    if (c.width !== pxW || c.height !== pxH) {
      c.width = pxW;
      c.height = pxH;
    }

    if (vr.openPanel === "glb" && vr.glbState.autoRotate) {
      vr.glbState.yaw += 0.008;
    }

    const yawR = vr.simYaw * DEG2RAD;
    const pitchR = Math.max(-85, Math.min(85, vr.simPitch)) * DEG2RAD;
    vr.headYawRad = yawR;
    vr.headPitchRad = pitchR;
    vr.lastHeadForward = norm3([
      -Math.cos(pitchR) * Math.sin(yawR),
      Math.sin(pitchR),
      -Math.cos(pitchR) * Math.cos(yawR)
    ]);

    vr.clickableMeshes = collectFrameClickables();

    const eyeCenterView = mat4Multiply(mat4RotateX(-pitchR), mat4RotateY(-yawR));
    const stereo = vr.stereoPreview;
    const halfW = stereo ? Math.floor(pxW * 0.5) : pxW;
    const aspect = halfW / Math.max(1, pxH);
    const projSingle = mat4Perspective(82 * DEG2RAD, aspect, 0.05, 100.0);

    // Raio de mira do mouse ou centro da visão estereoscópica
    let rayDir = vr.lastHeadForward;
    if (vr.simHoverNdc) {
      const invVP = mat4InvertRigidOrAffine(mat4Multiply(projSingle, eyeCenterView));
      const pNear = transformVec4(invVP, [vr.simHoverNdc.x, vr.simHoverNdc.y, -1, 1]);
      const pFar = transformVec4(invVP, [vr.simHoverNdc.x, vr.simHoverNdc.y, 1, 1]);
      const n3 = [pNear[0] / pNear[3], pNear[1] / pNear[3], pNear[2] / pNear[3]];
      const f3 = [pFar[0] / pFar[3], pFar[1] / pFar[3], pFar[2] / pFar[3]];
      rayDir = norm3([f3[0] - n3[0], f3[1] - n3[1], f3[2] - n3[2]]);
    }

    const hit = evaluateRayHit([0, 0, 0], rayDir);
    vr.hoverId = hit ? hit.hoverId : null;
    vr._latestSimHit = hit;

    const rays = [{
      origin: [0.18, -0.22, -0.15],
      dir: rayDir,
      drawBeam: Boolean(vr.simHoverNdc),
      hasHit: Boolean(hit),
      hitPoint: hit ? hit.hitPoint : null
    }];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0.02, 0.04, 0.03, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (stereo) {
      const ipdHalf = 0.032;
      gl.viewport(0, 0, halfW - 2, pxH);
      renderEye(projSingle, mat4Multiply(mat4Translation(ipdHalf, 0, 0), eyeCenterView), rays, true);
      gl.viewport(halfW + 2, 0, pxW - halfW - 2, pxH);
      renderEye(projSingle, mat4Multiply(mat4Translation(-ipdHalf, 0, 0), eyeCenterView), rays, true);
    } else {
      gl.viewport(0, 0, pxW, pxH);
      renderEye(projSingle, eyeCenterView, rays, true);
    }
  }

  // =========================================================================
  // ENTRADA / SAÍDA DO MODO RV E EVENTOS DO SIMULADOR / CONTROLES QUEST 3
  // =========================================================================
  async function enterVR() {
    if (vr.active) return;

    const overlay = document.getElementById("vrOverlayStage");
    const canvas = document.getElementById("vrWebGLCanvas");
    const simBanner = document.getElementById("vrSimBanner");
    if (!overlay || !canvas) return;

    vr.overlayEl = overlay;
    vr.canvas = canvas;
    overlay.style.display = "block";
    overlay.classList.add("open");
    document.body.classList.add("vr-active");
    if (window.GeoSC360 && typeof window.GeoSC360.syncModalUiState === "function") {
      window.GeoSC360.syncModalUiState();
    } else {
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: "GEOSC_MODAL_OPEN", open: true, active: true }, "*"); } catch (_) {}
    }

    if (!vr.gl && !initVRWebGL()) {
      alert("WebGL não disponível neste dispositivo para o modo Realidade Virtual.");
      exitVR();
      return;
    }

    const engState = window.GeoSC360 && window.GeoSC360.getState ? window.GeoSC360.getState() : null;
    vr.sceneId = (engState && engState.currentSceneId) || window.TOUR_SC_DATA.defaultScene || "vale_tombado_04";
    const sc = window.TOUR_SC_DATA.scenes[vr.sceneId];
    vr.sceneWorldYawRad = (sc && sc.initialView ? sc.initialView.yaw : 0) * DEG2RAD;
    vr.simYaw = 0;
    vr.simPitch = sc && sc.initialView ? (sc.initialView.pitch * 0.35) : -6;
    vr.uiAnchorYawRad = 0;
    vr.openPanel = null;
    vr.active = true;

    ensureScenePanoTexture(vr.sceneId);
    Object.keys(window.TOUR_SC_DATA.scenes || {}).forEach((sid, i) => {
      if (sid !== vr.sceneId) setTimeout(() => ensureScenePanoTexture(sid), 450 + i * 300);
    });

    // Tenta iniciar sessão WebXR nativa caso haja suporte de Hardware/Meta Quest 3
    if (navigator.xr && typeof navigator.xr.isSessionSupported === "function") {
      try {
        const supported = await navigator.xr.isSessionSupported("immersive-vr");
        if (supported) {
          await vr.gl.makeXRCompatible();
          const session = await navigator.xr.requestSession("immersive-vr", {
            optionalFeatures: ["local-floor", "hand-tracking"]
          });
          vr.xrSession = session;
          vr.isWebXR = true;
          if (simBanner) simBanner.style.display = "none";

          session.updateRenderState({
            baseLayer: new XRWebGLLayer(session, vr.gl)
          });

          try {
            vr.xrRefSpace = await session.requestReferenceSpace("local");
          } catch (_) {
            vr.xrRefSpace = await session.requestReferenceSpace("viewer");
          }

          // Gatilho / Pinch nos controles do Meta Quest 3
          session.addEventListener("select", evt => {
            const r = (vr._latestXRRays || []).find(item => item.inputSource === evt.inputSource) || (vr._latestXRRays || [])[0];
            if (r && r.action) performVRAction(r.action);
          });
          // Botão lateral Grip / Squeeze no Quest 3 traz o menu sempre para frente do rosto
          session.addEventListener("squeeze", () => recenterUI());
          session.addEventListener("end", () => {
            vr.xrSession = null;
            vr.isWebXR = false;
            exitVR();
          });

          session.requestAnimationFrame(onXRFrame);
          return;
        }
      } catch (err) {
        console.warn("WebXR hardware não detectado/cancelado, iniciando Prévia Estéreo RV:", err);
      }
    }

    // Fallback completo para navegador desktop ou celular sem headset conectado
    vr.isWebXR = false;
    if (simBanner) simBanner.style.display = "flex";
    vr.rafId = requestAnimationFrame(simRenderLoop);
  }

  function exitVR() {
    const wasActive = vr.active || document.body.classList.contains("vr-active");
    vr.active = false;
    if (vr.rafId) cancelAnimationFrame(vr.rafId);
    vr.rafId = 0;

    if (vr.xrSession) {
      const s = vr.xrSession;
      vr.xrSession = null;
      s.end().catch(() => {});
    }
    vr.isWebXR = false;
    document.body.classList.remove("vr-active");
    if (vr.overlayEl) {
      vr.overlayEl.classList.remove("open");
      vr.overlayEl.style.display = "none";
    }
    if (!wasActive) return;
    if (window.GeoSC360 && typeof window.GeoSC360.syncModalUiState === "function") {
      window.GeoSC360.syncModalUiState();
    } else {
      try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: "GEOSC_MODAL_OPEN", open: false, active: false }, "*"); } catch (_) {}
    }
  }

  function bindVROverlayEvents() {
    const btnEnter = document.getElementById("btnEnterVR");
    if (btnEnter) {
      btnEnter.addEventListener("click", enterVR);
      // Indica visualmente quando Meta Quest / WebXR estiver disponível
      if (navigator.xr && typeof navigator.xr.isSessionSupported === "function") {
        navigator.xr.isSessionSupported("immersive-vr").then(ok => {
          if (ok) btnEnter.classList.add("vr-ready");
        }).catch(() => {});
      }
    }

    const btnExit = document.getElementById("btnVrSimExit");
    if (btnExit) btnExit.addEventListener("click", exitVR);

    const btnMode = document.getElementById("btnVrSimToggleStereo");
    if (btnMode) {
      btnMode.addEventListener("click", () => {
        vr.stereoPreview = !vr.stereoPreview;
        btnMode.textContent = vr.stereoPreview ? "Lentes Estéreo (ON)" : "Tela Única (Mono)";
      });
    }

    const btnRec = document.getElementById("btnVrSimRecenter");
    if (btnRec) btnRec.addEventListener("click", recenterUI);

    const c = document.getElementById("vrWebGLCanvas");
    if (!c) return;

    const getCanvasLocalNdc = (clientX, clientY) => {
      const rect = c.getBoundingClientRect();
      let rx = (clientX - rect.left) / Math.max(1, rect.width);
      if (vr.stereoPreview) rx = rx < 0.5 ? rx * 2.0 : (rx - 0.5) * 2.0;
      const ry = (clientY - rect.top) / Math.max(1, rect.height);
      return { x: rx * 2.0 - 1.0, y: 1.0 - ry * 2.0 };
    };

    c.addEventListener("pointerdown", e => {
      vr.isSimDragging = true;
      vr.simDragStartX = e.clientX;
      vr.simDragStartY = e.clientY;
      vr.simDownX = e.clientX;
      vr.simDownY = e.clientY;
      vr.simHoverNdc = getCanvasLocalNdc(e.clientX, e.clientY);
    });

    c.addEventListener("pointermove", e => {
      vr.simHoverNdc = getCanvasLocalNdc(e.clientX, e.clientY);
      if (!vr.isSimDragging) return;
      const dx = e.clientX - vr.simDragStartX;
      const dy = e.clientY - vr.simDragStartY;
      vr.simDragStartX = e.clientX;
      vr.simDragStartY = e.clientY;
      vr.simYaw += dx * 0.22;
      vr.simPitch = Math.max(-85, Math.min(85, vr.simPitch + dy * 0.22));
    });

    c.addEventListener("pointerup", e => {
      if (!vr.isSimDragging) return;
      vr.isSimDragging = false;
      const move = Math.hypot(e.clientX - vr.simDownX, e.clientY - vr.simDownY);
      if (move < 8) {
        vr.simHoverNdc = getCanvasLocalNdc(e.clientX, e.clientY);
        if (vr._latestSimHit && vr._latestSimHit.action) {
          performVRAction(vr._latestSimHit.action);
        }
      }
    });

    window.addEventListener("keydown", e => {
      if (!vr.active) return;
      if (e.key === "Escape") exitVR();
      else if (e.key === " " || e.key === "Enter") {
        if (vr._latestSimHit && vr._latestSimHit.action) performVRAction(vr._latestSimHit.action);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindVROverlayEvents);

  window.GeoSCVR = {
    enter: enterVR,
    exit: exitVR,
    getVRState: () => vr,
    triggerAction: performVRAction
  };
})();

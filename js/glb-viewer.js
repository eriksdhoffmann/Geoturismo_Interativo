/**
 * ============================================================================
 * VISUALIZADOR NATIVO WEBGL DE MODELOS 3D (.GLB / glTF 2.0) — 100% OFFLINE/ONLINE
 * ============================================================================
 * Renderiza arquivos binários .glb diretamente em WebGL2 (com fallback WebGL1)
 * sem depender de servidor local ou internet — compatível com file:// no Chrome
 * (via Base64 em window.LOCAL_GLB_MODELS) e com GitHub Pages (via fetch URL).
 */
window.GLBViewer = (function () {
  // ---------------------------------------------------------------------------
  // Utilitários de Álgebra Linear (Matrizes 4x4 Column-Major padrão WebGL/glTF)
  // ---------------------------------------------------------------------------
  function mat4Identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return out;
  }

  function mat4FromTRS(t, r, s) {
    const x = r[0], y = r[1], z = r[2], w = r[3];
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s[0], sy = s[1], sz = s[2];
    return new Float32Array([
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      t[0], t[1], t[2], 1
    ]);
  }

  function normalMat3FromMat4(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2];
    const a10 = m[4], a11 = m[5], a12 = m[6];
    const a20 = m[8], a21 = m[9], a22 = m[10];
    const b01 = a22 * a11 - a12 * a21;
    const b11 = -a22 * a10 + a12 * a20;
    const b21 = a21 * a10 - a11 * a20;
    let det = a00 * b01 + a01 * b11 + a02 * b21;
    if (Math.abs(det) < 1e-12) {
      return new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    det = 1.0 / det;
    // Transposta da inversa em column-major:
    return new Float32Array([
      b01 * det, b11 * det, b21 * det,
      (-a22 * a01 + a02 * a21) * det, (a22 * a00 - a02 * a20) * det, (-a21 * a00 + a01 * a20) * det,
      (a12 * a01 - a02 * a11) * det, (-a12 * a00 + a02 * a10) * det, (a11 * a00 - a01 * a10) * det
    ]);
  }

  function mat4Perspective(fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    const nf = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function mat4LookAt(eye, target) {
    let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;

    // up = (0, 1, 0)
    let xx = zz, xy = 0, xz = -zx;
    len = Math.hypot(xx, xy, xz);
    if (len < 1e-5) {
      xx = 1; xy = 0; xz = 0;
    } else {
      xx /= len; xz /= len;
    }
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
      -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
      -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
      1
    ]);
  }

  // ---------------------------------------------------------------------------
  // Parser Binário de .GLB (glTF 2.0)
  // ---------------------------------------------------------------------------
  function decodeDataUriToBuffer(dataUri) {
    const commaIdx = dataUri.indexOf(",");
    const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function loadBufferSource(glbKey, glbUrl) {
    if (glbKey && window.LOCAL_GLB_MODELS && window.LOCAL_GLB_MODELS[glbKey]) {
      return Promise.resolve(decodeDataUriToBuffer(window.LOCAL_GLB_MODELS[glbKey]));
    }
    if (glbUrl) {
      return fetch(glbUrl).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ao carregar ${glbUrl}`);
        return r.arrayBuffer();
      });
    }
    return Promise.reject(new Error("Nenhuma fonte GLB informada."));
  }

  function readAccessor(gltf, binBuffer, accessorIdx) {
    const acc = gltf.accessors[accessorIdx];
    const bv = gltf.bufferViews[acc.bufferView];
    const compsPerElem = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type] || 1;
    const TypedArr = {
      5120: Int8Array,
      5121: Uint8Array,
      5122: Int16Array,
      5123: Uint16Array,
      5125: Uint32Array,
      5126: Float32Array
    }[acc.componentType];

    const bpe = TypedArr.BYTES_PER_ELEMENT;
    const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const elemSize = compsPerElem * bpe;
    const stride = bv.byteStride || elemSize;

    if (stride === elemSize && (byteOffset % bpe === 0)) {
      return new TypedArr(binBuffer, byteOffset, acc.count * compsPerElem);
    }

    // Desempacota com segurança quando há stride ou offset desalinhado
    const out = new TypedArr(acc.count * compsPerElem);
    const srcView = new DataView(binBuffer);
    for (let i = 0; i < acc.count; i++) {
      const base = byteOffset + i * stride;
      for (let c = 0; c < compsPerElem; c++) {
        const off = base + c * bpe;
        let val = 0;
        if (acc.componentType === 5126) val = srcView.getFloat32(off, true);
        else if (acc.componentType === 5125) val = srcView.getUint32(off, true);
        else if (acc.componentType === 5123) val = srcView.getUint16(off, true);
        else if (acc.componentType === 5121) val = srcView.getUint8(off);
        else if (acc.componentType === 5122) val = srcView.getInt16(off, true);
        else if (acc.componentType === 5120) val = srcView.getInt8(off);
        out[i * compsPerElem + c] = val;
      }
    }
    return out;
  }

  function computeVertexNormals(positions, indices) {
    const normals = new Float32Array(positions.length);
    const triCount = indices ? indices.length : positions.length / 3;
    for (let i = 0; i < triCount; i += 3) {
      const i0 = (indices ? indices[i] : i) * 3;
      const i1 = (indices ? indices[i + 1] : i + 1) * 3;
      const i2 = (indices ? indices[i + 2] : i + 2) * 3;

      const ax = positions[i1] - positions[i0];
      const ay = positions[i1 + 1] - positions[i0 + 1];
      const az = positions[i1 + 2] - positions[i0 + 2];
      const bx = positions[i2] - positions[i0];
      const by = positions[i2 + 1] - positions[i0 + 1];
      const bz = positions[i2 + 2] - positions[i0 + 2];

      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;

      normals[i0] += nx; normals[i0 + 1] += ny; normals[i0 + 2] += nz;
      normals[i1] += nx; normals[i1 + 1] += ny; normals[i1 + 2] += nz;
      normals[i2] += nx; normals[i2 + 1] += ny; normals[i2 + 2] += nz;
    }
    for (let i = 0; i < normals.length; i += 3) {
      const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
      if (len > 1e-8) {
        normals[i] /= len; normals[i + 1] /= len; normals[i + 2] /= len;
      } else {
        normals[i] = 0; normals[i + 1] = 1; normals[i + 2] = 0;
      }
    }
    return normals;
  }

  function parseGLB(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const magic = dv.getUint32(0, true);
    if (magic !== 0x46546C67) {
      throw new Error("Arquivo inválido: cabeçalho glTF/GLB não reconhecido.");
    }

    let offset = 12;
    let jsonChunk = null;
    let binBuffer = null;

    while (offset < arrayBuffer.byteLength) {
      const chunkLen = dv.getUint32(offset, true);
      const chunkType = dv.getUint32(offset + 4, true);
      const chunkStart = offset + 8;
      if (chunkType === 0x4E4F534A) { // JSON
        const jsonBytes = new Uint8Array(arrayBuffer, chunkStart, chunkLen);
        jsonChunk = JSON.parse(new TextDecoder("utf-8").decode(jsonBytes));
      } else if (chunkType === 0x004E4942) { // BIN
        binBuffer = arrayBuffer.slice(chunkStart, chunkStart + chunkLen);
      }
      offset = chunkStart + chunkLen;
    }

    if (!jsonChunk) throw new Error("Chunk JSON ausente no arquivo .glb.");
    return { gltf: jsonChunk, binBuffer };
  }

  // ---------------------------------------------------------------------------
  // Montagem do Visualizador 3D Interativo dentro do Container
  // ---------------------------------------------------------------------------
  function mount(containerEl, opts = {}) {
    if (!containerEl) return function () {};

    containerEl.innerHTML = `
      <div class="glb-stage">
        <canvas class="glb-canvas"></canvas>
        <div class="glb-loading-badge" id="glbLoadingStatus">Carregando Maquete 3D (.GLB)...</div>
        <div class="glb-controls-hud">
          <button type="button" class="glb-hud-btn active" id="glbBtnAutoRotate" title="Ativar/Pausar Giro Automático">
            ↻ Girar
          </button>
          <button type="button" class="glb-hud-btn" id="glbBtnResetView" title="Centralizar Enquadramento Inicial">
            🎯 Centralizar
          </button>
          <button type="button" class="glb-hud-btn" id="glbBtnZoomIn" title="Aproximar Zoom">+</button>
          <button type="button" class="glb-hud-btn" id="glbBtnZoomOut" title="Afastar Zoom">−</button>
        </div>
        <div class="glb-interaction-hint">
          Arraste para girar • Pinça ou roda para zoom
        </div>
      </div>
    `;

    const canvas = containerEl.querySelector(".glb-canvas");
    const statusEl = containerEl.querySelector("#glbLoadingStatus");
    const btnAuto = containerEl.querySelector("#glbBtnAutoRotate");
    const btnReset = containerEl.querySelector("#glbBtnResetView");
    const btnZoomIn = containerEl.querySelector("#glbBtnZoomIn");
    const btnZoomOut = containerEl.querySelector("#glbBtnZoomOut");

    let gl = canvas.getContext("webgl2", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    let isWebGL2 = Boolean(gl);
    if (!gl) {
      gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    }
    if (!gl) {
      statusEl.textContent = "WebGL não disponível neste navegador.";
      return function () {};
    }

    const extUint = isWebGL2 ? true : gl.getExtension("OES_element_index_uint");

    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aTexCoord;
      uniform mat4 uMVP;
      uniform mat4 uModel;
      uniform mat3 uNormalMatrix;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main() {
        gl_Position = uMVP * vec4(aPosition, 1.0);
        vNormal = normalize(uNormalMatrix * aNormal);
        vUV = aTexCoord;
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec3 vNormal;
      varying vec2 vUV;
      uniform sampler2D uBaseTex;
      uniform vec4 uBaseColor;
      uniform float uHasTex;
      void main() {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;

        // Iluminação solar natural em 3 pontos para destacar o relevo no desktop e no celular
        vec3 keyDir = normalize(vec3(0.50, 0.88, 0.42));
        vec3 rimDir = normalize(vec3(-0.6, 0.45, -0.65));
        float keyDiff = max(dot(n, keyDir), 0.0);
        float rimDiff = max(dot(n, rimDir), 0.0) * 0.28;
        float hemi = 0.5 + 0.5 * n.y;
        vec3 ambient = mix(vec3(0.28, 0.32, 0.35), vec3(0.56, 0.60, 0.62), hemi);
        float light = 0.74 * keyDiff + rimDiff;

        vec4 baseLin = uBaseColor;
        if (uHasTex > 0.5) {
          vec4 texSample = texture2D(uBaseTex, vUV);
          baseLin.rgb *= pow(texSample.rgb, vec3(2.2));
          baseLin.a *= texSample.a;
        }

        vec3 litLin = baseLin.rgb * (ambient + vec3(1.0, 0.98, 0.92) * light);
        // Tone mapping suave + codificação sRGB para exibição fiel
        vec3 srgb = pow(clamp(litLin, 0.0, 1.0), vec3(1.0 / 2.2));
        gl_FragColor = vec4(srgb, baseLin.a);
      }
    `;

    function compile(type, src) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("GLB Shader Error:", gl.getShaderInfoLog(sh));
      }
      return sh;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const locPos = gl.getAttribLocation(prog, "aPosition");
    const locNorm = gl.getAttribLocation(prog, "aNormal");
    const locUV = gl.getAttribLocation(prog, "aTexCoord");
    const locMVP = gl.getUniformLocation(prog, "uMVP");
    const locModel = gl.getUniformLocation(prog, "uModel");
    const locNormalMat = gl.getUniformLocation(prog, "uNormalMatrix");
    const locBaseColor = gl.getUniformLocation(prog, "uBaseColor");
    const locHasTex = gl.getUniformLocation(prog, "uHasTex");
    const locBaseTex = gl.getUniformLocation(prog, "uBaseTex");

    // Textura branca 1x1 para materiais sólidos sem mapa de textura
    const whiteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, whiteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

    const drawCalls = [];
    const createdTextures = [whiteTex];
    const createdBuffers = [];
    let destroyed = false;

    const cam = {
      yaw: 0.48,
      pitch: 0.56,
      dist: 12000,
      target: [0, 0, 0],
      targetYaw: 0.48,
      targetPitch: 0.56,
      targetDist: 12000,
      targetCenter: [0, 0, 0],
      defaultYaw: 0.48,
      defaultPitch: 0.56,
      defaultDist: 12000,
      defaultCenter: [0, 0, 0],
      radius: 5000,
      autoRotate: true
    };

    function computeAspectFraming(radius) {
      const curW = Math.max(100, canvas.clientWidth || containerEl.clientWidth || 560);
      const curH = Math.max(100, canvas.clientHeight || containerEl.clientHeight || 420);
      const aspectRatio = curW / curH;
      // Garante margem nas bordas esquerda/direita/topo considerando FOV vertical de 42°
      const fitMult = aspectRatio < 1.15
        ? Math.min(3.15, 2.38 / Math.max(0.75, aspectRatio))
        : 1.72;
      return {
        pitch: aspectRatio < 1.15 ? 0.66 : 0.56,
        dist: radius * fitMult
      };
    }

    function resetCamera() {
      const framing = computeAspectFraming(cam.radius || 1);
      cam.defaultPitch = framing.pitch;
      cam.defaultDist = framing.dist;
      cam.targetYaw = cam.defaultYaw;
      cam.targetPitch = cam.defaultPitch;
      cam.targetDist = cam.defaultDist;
      cam.targetCenter = cam.defaultCenter.slice();
    }

    // Carrega e prepara o modelo .glb
    loadBufferSource(opts.glbKey, opts.glbUrl).then(buf => {
      if (destroyed) return;
      const { gltf, binBuffer } = parseGLB(buf);

      // 1. Decodifica texturas embutidas no .glb
      const glTextures = [];
      if (gltf.textures && gltf.images) {
        gltf.textures.forEach((texDef, tIdx) => {
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([140, 175, 130, 255]));
          glTextures[tIdx] = tex;
          createdTextures.push(tex);

          const imgDef = gltf.images[texDef.source];
          if (imgDef && imgDef.bufferView !== undefined) {
            const bv = gltf.bufferViews[imgDef.bufferView];
            const slice = new Uint8Array(binBuffer, bv.byteOffset || 0, bv.byteLength);
            const blob = new Blob([slice], { type: imgDef.mimeType || "image/png" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              if (destroyed) return;
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
              if (isWebGL2) {
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
              } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              }
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            };
            img.src = url;
          }
        });
      }

      // 2. Constrói buffers das malhas (caches por mesh/primitive)
      const meshPrimitivesCache = [];
      (gltf.meshes || []).forEach((meshDef, mIdx) => {
        meshPrimitivesCache[mIdx] = (meshDef.primitives || []).map(prim => {
          const posAcc = prim.attributes.POSITION;
          const positions = readAccessor(gltf, binBuffer, posAcc);
          const indices = prim.indices !== undefined ? readAccessor(gltf, binBuffer, prim.indices) : null;
          const uvs = prim.attributes.TEXCOORD_0 !== undefined
            ? readAccessor(gltf, binBuffer, prim.attributes.TEXCOORD_0)
            : new Float32Array((positions.length / 3) * 2);
          const normals = prim.attributes.NORMAL !== undefined
            ? readAccessor(gltf, binBuffer, prim.attributes.NORMAL)
            : computeVertexNormals(positions, indices);

          const posBuf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
          gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

          const normBuf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
          gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

          const uvBuf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
          gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

          createdBuffers.push(posBuf, normBuf, uvBuf);

          let idxBuf = null;
          let idxType = gl.UNSIGNED_SHORT;
          let drawCount = positions.length / 3;

          if (indices) {
            idxBuf = gl.createBuffer();
            createdBuffers.push(idxBuf);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
            if (indices instanceof Uint32Array) {
              if (!extUint) {
                throw new Error("Navegador sem suporte a índices de 32 bits.");
              }
              idxType = gl.UNSIGNED_INT;
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            } else if (indices instanceof Uint16Array) {
              idxType = gl.UNSIGNED_SHORT;
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            } else {
              idxType = gl.UNSIGNED_BYTE;
              gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
            }
            drawCount = indices.length;
          }

          const matDef = (prim.material !== undefined && gltf.materials)
            ? gltf.materials[prim.material]
            : null;
          const pbr = (matDef && matDef.pbrMetallicRoughness) || {};
          const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
          const texInfo = pbr.baseColorTexture;
          const texture = texInfo ? glTextures[texInfo.index] : null;

          // Bounding box local da primitiva para enquadramento automático
          const accObj = gltf.accessors[posAcc];
          let min = accObj.min, max = accObj.max;
          if (!min || !max) {
            min = [Infinity, Infinity, Infinity];
            max = [-Infinity, -Infinity, -Infinity];
            for (let i = 0; i < positions.length; i += 3) {
              if (positions[i] < min[0]) min[0] = positions[i];
              if (positions[i + 1] < min[1]) min[1] = positions[i + 1];
              if (positions[i + 2] < min[2]) min[2] = positions[i + 2];
              if (positions[i] > max[0]) max[0] = positions[i];
              if (positions[i + 1] > max[1]) max[1] = positions[i + 1];
              if (positions[i + 2] > max[2]) max[2] = positions[i + 2];
            }
          }

          return {
            posBuf, normBuf, uvBuf, idxBuf, idxType, drawCount,
            baseColor: new Float32Array(baseColor),
            texture,
            hasTex: texture ? 1.0 : 0.0,
            localMin: min,
            localMax: max
          };
        });
      });

      // 3. Percorre grafo de nós da cena acumulando matrizes globais + BBox global
      const wMin = [Infinity, Infinity, Infinity];
      const wMax = [-Infinity, -Infinity, -Infinity];

      function expandWorldBBox(mat, min, max) {
        for (let ix = 0; ix < 2; ix++) {
          for (let iy = 0; iy < 2; iy++) {
            for (let iz = 0; iz < 2; iz++) {
              const x = ix ? max[0] : min[0];
              const y = iy ? max[1] : min[1];
              const z = iz ? max[2] : min[2];
              const wx = mat[0] * x + mat[4] * y + mat[8] * z + mat[12];
              const wy = mat[1] * x + mat[5] * y + mat[9] * z + mat[13];
              const wz = mat[2] * x + mat[6] * y + mat[10] * z + mat[14];
              if (wx < wMin[0]) wMin[0] = wx;
              if (wy < wMin[1]) wMin[1] = wy;
              if (wz < wMin[2]) wMin[2] = wz;
              if (wx > wMax[0]) wMax[0] = wx;
              if (wy > wMax[1]) wMax[1] = wy;
              if (wz > wMax[2]) wMax[2] = wz;
            }
          }
        }
      }

      function traverseNode(nodeIdx, parentMat) {
        const node = gltf.nodes[nodeIdx];
        if (!node) return;
        let localMat = mat4Identity();
        if (node.matrix) {
          localMat = new Float32Array(node.matrix);
        } else if (node.translation || node.rotation || node.scale) {
          localMat = mat4FromTRS(
            node.translation || [0, 0, 0],
            node.rotation || [0, 0, 0, 1],
            node.scale || [1, 1, 1]
          );
        }
        const worldMat = mat4Multiply(parentMat, localMat);

        if (node.mesh !== undefined && meshPrimitivesCache[node.mesh]) {
          const normMat = normalMat3FromMat4(worldMat);
          meshPrimitivesCache[node.mesh].forEach(prim => {
            expandWorldBBox(worldMat, prim.localMin, prim.localMax);
            drawCalls.push({ prim, modelMat: worldMat, normMat });
          });
        }
        if (node.children) {
          node.children.forEach(cIdx => traverseNode(cIdx, worldMat));
        }
      }

      const sceneDef = gltf.scenes[gltf.scene || 0];
      (sceneDef.nodes || []).forEach(nIdx => traverseNode(nIdx, mat4Identity()));

      // Calcula enquadramento perfeito automático ao redor do modelo
      const cx = (wMin[0] + wMax[0]) * 0.5;
      const cy = (wMin[1] + wMax[1]) * 0.5;
      const cz = (wMin[2] + wMax[2]) * 0.5;
      const radius = Math.max(1, Math.hypot(wMax[0] - wMin[0], wMax[1] - wMin[1], wMax[2] - wMin[2]) * 0.5);

      const framing = computeAspectFraming(radius);

      cam.radius = radius;
      cam.defaultCenter = [cx, cy, cz];
      cam.targetCenter = [cx, cy, cz];
      cam.target = [cx, cy, cz];
      cam.defaultPitch = framing.pitch;
      cam.pitch = cam.targetPitch = cam.defaultPitch;
      cam.defaultDist = framing.dist;
      cam.targetDist = cam.dist = cam.defaultDist;

      if (statusEl) {
        statusEl.style.display = "none";
      }
    }).catch(err => {
      console.error("Erro ao carregar modelo GLB:", err);
      if (statusEl) statusEl.textContent = "Erro ao ler arquivo .GLB";
    });

    // Controles de Mouse / Touch (Orbit + Pan + Zoom)
    let dragMode = null; // "orbit" | "pan"
    let lastX = 0, lastY = 0;

    const onDown = e => {
      e.preventDefault();
      if (e.button === 2 || e.shiftKey) {
        dragMode = "pan";
      } else {
        dragMode = "orbit";
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMove = e => {
      if (!dragMode) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragMode === "orbit") {
        cam.targetYaw -= dx * 0.0075;
        cam.targetPitch = Math.max(-1.45, Math.min(1.48, cam.targetPitch + dy * 0.0075));
      } else {
        const panScale = cam.dist * 0.0014;
        const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
        cam.targetCenter[0] -= (cosY * dx) * panScale;
        cam.targetCenter[2] -= (-sinY * dx) * panScale;
        cam.targetCenter[1] += dy * panScale;
      }
    };

    const onUp = () => { dragMode = null; };
    const onCtxMenu = e => e.preventDefault();
    const onWheel = e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      cam.targetDist = Math.max(cam.radius * 0.25, Math.min(cam.radius * 5.0, cam.targetDist * factor));
    };

    // Suporte Touch completo (1 dedo gira, 2 dedos pinça/zoom + move)
    let touchLastX = 0, touchLastY = 0;
    let lastPinchDist = 0;
    let lastPinchMidX = 0, lastPinchMidY = 0;
    const onTouchStart = e => {
      if (e.touches.length === 1) {
        dragMode = "orbit";
        touchLastX = e.touches[0].clientX;
        touchLastY = e.touches[0].clientY;
        lastPinchDist = 0;
      } else if (e.touches.length === 2) {
        dragMode = "pinch";
        const t0 = e.touches[0], t1 = e.touches[1];
        lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        lastPinchMidX = (t0.clientX + t1.clientX) * 0.5;
        lastPinchMidY = (t0.clientY + t1.clientY) * 0.5;
      }
    };
    const onTouchMove = e => {
      if (e.touches.length === 1 && dragMode === "orbit") {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchLastX;
        const dy = e.touches[0].clientY - touchLastY;
        touchLastX = e.touches[0].clientX;
        touchLastY = e.touches[0].clientY;
        cam.targetYaw -= dx * 0.008;
        cam.targetPitch = Math.max(-1.45, Math.min(1.48, cam.targetPitch + dy * 0.008));
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const midX = (t0.clientX + t1.clientX) * 0.5;
        const midY = (t0.clientY + t1.clientY) * 0.5;
        if (lastPinchDist > 5 && dist > 5) {
          const ratio = lastPinchDist / dist;
          cam.targetDist = Math.max(cam.radius * 0.25, Math.min(cam.radius * 5.0, cam.targetDist * ratio));
        }
        const mdx = midX - lastPinchMidX;
        const mdy = midY - lastPinchMidY;
        const panScale = cam.dist * 0.0014;
        const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
        cam.targetCenter[0] -= (cosY * mdx) * panScale;
        cam.targetCenter[2] -= (-sinY * mdx) * panScale;
        cam.targetCenter[1] += mdy * panScale;
        lastPinchDist = dist;
        lastPinchMidX = midX;
        lastPinchMidY = midY;
      }
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("contextmenu", onCtxMenu);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onUp);
    canvas.addEventListener("touchcancel", onUp);

    if (btnAuto) {
      btnAuto.addEventListener("click", () => {
        cam.autoRotate = !cam.autoRotate;
        btnAuto.classList.toggle("active", cam.autoRotate);
      });
    }
    if (btnReset) btnReset.addEventListener("click", resetCamera);
    if (btnZoomIn) btnZoomIn.addEventListener("click", () => {
      cam.targetDist = Math.max(cam.radius * 0.25, cam.targetDist * 0.82);
    });
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => {
      cam.targetDist = Math.min(cam.radius * 5.0, cam.targetDist * 1.22);
    });

    // Loop de Renderização 60 FPS
    let animId = 0;
    function frame() {
      if (destroyed) return;

      if (cam.autoRotate && !dragMode) {
        cam.targetYaw += 0.0035;
      }

      cam.yaw += (cam.targetYaw - cam.yaw) * 0.14;
      cam.pitch += (cam.targetPitch - cam.pitch) * 0.14;
      cam.dist += (cam.targetDist - cam.dist) * 0.16;
      cam.target[0] += (cam.targetCenter[0] - cam.target[0]) * 0.14;
      cam.target[1] += (cam.targetCenter[1] - cam.target[1]) * 0.14;
      cam.target[2] += (cam.targetCenter[2] - cam.target[2]) * 0.14;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(100, canvas.clientWidth || containerEl.clientWidth || 560);
      const cssH = Math.max(100, canvas.clientHeight || containerEl.clientHeight || 420);
      const pxW = Math.round(cssW * dpr);
      const pxH = Math.round(cssH * dpr);
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW;
        canvas.height = pxH;
      }

      gl.viewport(0, 0, pxW, pxH);
      gl.clearColor(0.11, 0.16, 0.22, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);

      if (drawCalls.length > 0) {
        const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
        const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
        const eye = [
          cam.target[0] + cam.dist * cp * sy,
          cam.target[1] + cam.dist * sp,
          cam.target[2] + cam.dist * cp * cy
        ];

        const viewMat = mat4LookAt(eye, cam.target);
        const projMat = mat4Perspective(42 * (Math.PI / 180), cssW / cssH, cam.radius * 0.01, cam.radius * 25.0);
        const vpMat = mat4Multiply(projMat, viewMat);

        gl.useProgram(prog);
        gl.uniform1i(locBaseTex, 0);

        for (let i = 0; i < drawCalls.length; i++) {
          const dc = drawCalls[i];
          const p = dc.prim;
          const mvp = mat4Multiply(vpMat, dc.modelMat);

          gl.uniformMatrix4fv(locMVP, false, mvp);
          gl.uniformMatrix4fv(locModel, false, dc.modelMat);
          gl.uniformMatrix3fv(locNormalMat, false, dc.normMat);
          gl.uniform4fv(locBaseColor, p.baseColor);
          gl.uniform1f(locHasTex, p.hasTex);

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, p.texture || whiteTex);

          gl.bindBuffer(gl.ARRAY_BUFFER, p.posBuf);
          gl.enableVertexAttribArray(locPos);
          gl.vertexAttribPointer(locPos, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, p.normBuf);
          gl.enableVertexAttribArray(locNorm);
          gl.vertexAttribPointer(locNorm, 3, gl.FLOAT, false, 0, 0);

          gl.bindBuffer(gl.ARRAY_BUFFER, p.uvBuf);
          gl.enableVertexAttribArray(locUV);
          gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 0, 0);

          if (p.idxBuf) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.idxBuf);
            gl.drawElements(gl.TRIANGLES, p.drawCount, p.idxType, 0);
          } else {
            gl.drawArrays(gl.TRIANGLES, 0, p.drawCount);
          }
        }
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return function cleanup() {
      destroyed = true;
      if (animId) cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("contextmenu", onCtxMenu);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onUp);
      createdBuffers.forEach(b => gl.deleteBuffer(b));
      createdTextures.forEach(t => gl.deleteTexture(t));
      gl.deleteProgram(prog);
    };
  }

  return { mount };
})();

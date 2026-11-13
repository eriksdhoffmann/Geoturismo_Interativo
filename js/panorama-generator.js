/**
 * ============================================================================
 * GERADOR DE PANORAMAS EQUIRETANGULARES 360° (2:1) & VISUALIZADOR 3D LOCAL
 * ============================================================================
 * Inclui os geradores esféricos 360° detalhados para:
 * - VALE DO RIO DA LUZ (Jaraguá do Sul / Pomerode - SC):
 *     1. rio_da_luz_geral (Visão Aérea 360° de todo o Vale do Rio da Luz com os 13 pontos, Igrejas, Clubes de Tiro e Pico Malwee)
 *     2. rio_da_luz_sul (Baixo Rio da Luz: Casa Rux [1], Schroeder Platz [2], Berghaus [3], Pesque-Pagues [4, 5], Salão Barg e Pico Malwee)
 *     3. rio_da_luz_centro (Médio Rio da Luz: Garten Fluss [6], Belo Vale [7], Cervejaria Maestro [8], CTG [9], Sociedades e Igrejas)
 *     4. rio_da_luz_norte_mirante (Alto Rio da Luz & Mirante do Vale [13]: Tradição do Vale [10], Sítio Harmonia [11], Cantinho [12] e Rota Enxaimel)
 * - CENAS DO TOUR INICIAL DE SANTA CATARINA (Florianópolis, Rio do Rastro, Urubici, Itaimbezinho, Garopaba, Balneário Camboriú)
 */

window.PanoramaGenerator = (function () {
  const cache = {};

  function hash(n) {
    const x = Math.sin(n) * 43758.5453123;
    return x - Math.floor(x);
  }

  function noise1D(x, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3.0 - 2.0 * f);
    return (1.0 - u) * hash(i + seed * 131.7) + u * hash(i + 1.0 + seed * 131.7);
  }

  function fbm(angleRad, freq, octaves, seed) {
    let val = 0;
    let amp = 0.5;
    let f = freq;
    for (let o = 0; o < octaves; o++) {
      const nx = Math.cos(angleRad) * f + o * 17.3;
      const nz = Math.sin(angleRad) * f + o * 31.7;
      const n = (noise1D(nx * 2.5 + nz * 2.5, seed + o * 10) - 0.5) * 2.0;
      val += n * amp;
      f *= 2.05;
      amp *= 0.5;
    }
    return val;
  }

  function angleDiff(yaw1, yaw2) {
    return ((yaw1 - yaw2 + 540) % 360) - 180;
  }

  function gauss(x, sigma) {
    return Math.exp(-(x * x) / (2 * sigma * sigma));
  }

  function yawPitchToXY(yaw, pitch, width, height) {
    return {
      x: ((yaw + 180) / 360) * width,
      y: ((90 - pitch) / 180) * height
    };
  }

  function getEquirectangularCanvas(presetName, width = 2560, height = 1280) {
    const cacheKey = `${presetName}_${width}x${height}`;
    if (cache[cacheKey]) return cache[cacheKey];

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const presets = {
      rio_da_luz_geral: {
        skyTop: "#134e8c",
        skyMid: "#4d92cf",
        skyHorizon: "#e8f4d9",
        sunYaw: 55,
        sunPitch: 26,
        sunColor: "#fffbe0",
        waterColorDeep: "#254d23",
        waterColorShallow: "#4f8a3b",
        baseMountainColor: [34, 82, 38],
        farMountainColor: [62, 112, 92],
        sandColor: "#c8b08a",
        seed: 801,
        isValley: true
      },
      rio_da_luz_sul: {
        skyTop: "#174b82",
        skyMid: "#528ec4",
        skyHorizon: "#f5e4bc",
        sunYaw: -35,
        sunPitch: 20,
        sunColor: "#fff5cc",
        waterColorDeep: "#234722",
        waterColorShallow: "#497d38",
        baseMountainColor: [38, 78, 36],
        farMountainColor: [68, 106, 88],
        sandColor: "#d1b48c",
        seed: 802,
        isValley: true
      },
      rio_da_luz_centro: {
        skyTop: "#15467a",
        skyMid: "#4785bd",
        skyHorizon: "#efe6c9",
        sunYaw: 20,
        sunPitch: 24,
        sunColor: "#fff8d6",
        waterColorDeep: "#1e4220",
        waterColorShallow: "#3f7533",
        baseMountainColor: [32, 74, 38],
        farMountainColor: [60, 102, 86],
        sandColor: "#c9ae82",
        seed: 803,
        isValley: true
      },
      rio_da_luz_norte_mirante: {
        skyTop: "#0e3b70",
        skyMid: "#3b7ab8",
        skyHorizon: "#f7d794",
        sunYaw: -65,
        sunPitch: 15,
        sunColor: "#ffefb0",
        waterColorDeep: "#1c3d22",
        waterColorShallow: "#386b34",
        baseMountainColor: [28, 70, 36],
        farMountainColor: [58, 98, 108],
        sandColor: "#bfa37a",
        seed: 804,
        isValley: true
      },
      florianopolis_lagoa: {
        skyTop: "#1a4b8c",
        skyMid: "#4d88c4",
        skyHorizon: "#f6d198",
        sunYaw: 35,
        sunPitch: 16,
        sunColor: "#fff4d2",
        waterColorDeep: "#0c3c58",
        waterColorShallow: "#1b7a8c",
        baseMountainColor: [32, 68, 52],
        farMountainColor: [68, 102, 122],
        sandColor: "#e8d2a6",
        seed: 101
      },
      florianopolis_ponte: {
        skyTop: "#162a54",
        skyMid: "#4b5d8e",
        skyHorizon: "#f29f67",
        sunYaw: -15,
        sunPitch: 8,
        sunColor: "#ffdf9e",
        waterColorDeep: "#0d253f",
        waterColorShallow: "#1f496e",
        baseMountainColor: [38, 54, 62],
        farMountainColor: [72, 82, 108],
        sandColor: "#c8b89e",
        seed: 202
      },
      serra_rio_do_rastro: {
        skyTop: "#103a6b",
        skyMid: "#3c78b5",
        skyHorizon: "#cbe2f6",
        sunYaw: 55,
        sunPitch: 24,
        sunColor: "#ffffff",
        waterColorDeep: "#1e4430",
        waterColorShallow: "#2b5c3f",
        baseMountainColor: [30, 66, 40],
        farMountainColor: [74, 116, 138],
        sandColor: "#78866b",
        seed: 303
      },
      urubici_morro_igreja: {
        skyTop: "#0e3263",
        skyMid: "#396ea8",
        skyHorizon: "#d8e8f8",
        sunYaw: 24,
        sunPitch: 18,
        sunColor: "#fff9e6",
        waterColorDeep: "#244d38",
        waterColorShallow: "#386b4c",
        baseMountainColor: [36, 72, 44],
        farMountainColor: [88, 122, 148],
        sandColor: "#8a9978",
        seed: 404
      },
      canion_itaimbezinho: {
        skyTop: "#133f75",
        skyMid: "#4782bd",
        skyHorizon: "#e2eef9",
        sunYaw: -20,
        sunPitch: 28,
        sunColor: "#fffbe8",
        waterColorDeep: "#163324",
        waterColorShallow: "#285238",
        baseMountainColor: [42, 64, 42],
        farMountainColor: [75, 105, 120],
        sandColor: "#6e655f",
        seed: 505
      },
      garopaba_baleia_franca: {
        skyTop: "#124e8a",
        skyMid: "#4390c8",
        skyHorizon: "#f2e2ba",
        sunYaw: 75,
        sunPitch: 20,
        sunColor: "#fff8db",
        waterColorDeep: "#083d5c",
        waterColorShallow: "#128294",
        baseMountainColor: [34, 74, 48],
        farMountainColor: [68, 108, 124],
        sandColor: "#efe0ba",
        seed: 606
      },
      balneario_camboriu: {
        skyTop: "#154580",
        skyMid: "#3f84c4",
        skyHorizon: "#f7c98b",
        sunYaw: -45,
        sunPitch: 14,
        sunColor: "#fff2c2",
        waterColorDeep: "#0b3b59",
        waterColorShallow: "#197c8e",
        baseMountainColor: [34, 68, 48],
        farMountainColor: [64, 98, 118],
        sandColor: "#ead6ad",
        seed: 707
      }
    };

    const p = presets[presetName] || presets.rio_da_luz_geral;
    const horizonY = height * 0.5;

    // 1. CÉU
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY + height * 0.05);
    skyGrad.addColorStop(0.0, p.skyTop);
    skyGrad.addColorStop(0.55, p.skyMid);
    skyGrad.addColorStop(0.95, p.skyHorizon);
    skyGrad.addColorStop(1.0, p.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, horizonY + height * 0.05);

    // 2. PLANÍCIE DE VALE OU MAR
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    groundGrad.addColorStop(0.0, p.skyHorizon);
    groundGrad.addColorStop(0.06, p.waterColorShallow);
    groundGrad.addColorStop(0.50, p.waterColorDeep);
    groundGrad.addColorStop(1.0, "#0d1f12");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // 3. SOL E NUVENS
    const sunX = ((p.sunYaw + 180) / 360) * width;
    const sunY = ((90 - p.sunPitch) / 180) * height;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, width * 0.22);
    sunGlow.addColorStop(0.0, "#ffffff");
    sunGlow.addColorStop(0.06, p.sunColor);
    sunGlow.addColorStop(0.28, "rgba(255, 235, 170, 0.35)");
    sunGlow.addColorStop(1.0, "rgba(255, 220, 150, 0.0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let i = 0; i < 45; i++) {
      const cyaw = (hash(i * 19.3 + p.seed) * 360) - 180;
      const cpitch = 14 + hash(i * 31.1 + p.seed) * 40;
      const cx = ((cyaw + 180) / 360) * width;
      const cy = ((90 - cpitch) / 180) * height;
      const rw = (45 + hash(i * 7.7) * 135) * (width / 2048);
      const rh = rw * 0.24;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rw);
      cloudGrad.addColorStop(0, "rgba(255,255,255,0.45)");
      cloudGrad.addColorStop(0.6, "rgba(255,250,242,0.16)");
      cloudGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. SERRAS AO FUNDO E MORROS DO VALE
    drawMountainLayer(ctx, width, height, {
      basePitch: 3.0,
      ampPitch: 9.5,
      freq: 3.0,
      seed: p.seed + 11,
      topColor: `rgba(${p.farMountainColor[0]}, ${p.farMountainColor[1]}, ${p.farMountainColor[2]}, 0.85)`,
      bottomColor: `rgba(${p.baseMountainColor[0]}, ${p.baseMountainColor[1]}, ${p.baseMountainColor[2]}, 0.95)`,
      presetName
    });

    drawMountainLayer(ctx, width, height, {
      basePitch: 0.8,
      ampPitch: 11.5,
      freq: 4.5,
      seed: p.seed + 29,
      topColor: `rgb(${p.baseMountainColor[0] + 18}, ${p.baseMountainColor[1] + 28}, ${p.baseMountainColor[2] + 14})`,
      bottomColor: `rgb(${Math.max(10, p.baseMountainColor[0] - 8)}, ${Math.max(24, p.baseMountainColor[1] - 8)}, ${Math.max(14, p.baseMountainColor[2] - 8)})`,
      presetName,
      isMainScarp: true
    });

    // 5. FEIÇÕES DO VALE DO RIO DA LUZ OU DEMAIS CENAS DE SC
    if (presetName.startsWith("rio_da_luz")) {
      drawRioDaLuzValleyFeatures(ctx, width, height, presetName, p);
    } else {
      drawSceneSpecificFeatures(ctx, width, height, presetName, p);
    }

    drawSurfaceDetails(ctx, width, height, presetName, p, sunX);

    const nadirGrad = ctx.createLinearGradient(0, height * 0.84, 0, height);
    nadirGrad.addColorStop(0, "rgba(15, 28, 18, 0)");
    nadirGrad.addColorStop(0.55, "rgba(18, 36, 22, 0.85)");
    nadirGrad.addColorStop(1, "#0b170e");
    ctx.fillStyle = nadirGrad;
    ctx.fillRect(0, height * 0.84, width, height * 0.16);

    drawNadirCompassBand(ctx, width, height);

    cache[cacheKey] = canvas;
    return canvas;
  }

  /**
   * Desenha o Vale do Rio da Luz em 360° (fiel ao mapa ilustrado "Bem-vindo ao Rio da Luz"):
   * - O vale verdejante cercado pelas serras da Mata Atlântica (Pico Malwee ao Sul, Serra de Pomerode ao Norte)
   * - O Rio da Luz serpenteando pelo fundo do vale e a Estrada Rio da Luz (SC-110 / Estrada Rural)
   * - As propriedades em estilo Enxaimel, pesque-pagues (lagoas azuis), igrejas e salões de tiro exatamente nos ângulos dos hotspots!
   */
  function drawRioDaLuzValleyFeatures(ctx, width, height, presetName, p) {
    ctx.save();

    // Pastagens e campos agrícolas verde-claros no fundo do vale (como a mancha verde do mapa!)
    for (let patch = -170; patch <= 170; patch += 25) {
      const py = -12 - (hash(patch * 3.1) * 18);
      const xy = yawPitchToXY(patch, py, width, height);
      const rw = (90 + hash(patch * 7.3) * 80) * (width / 2048);
      const rh = (32 + hash(patch * 5.1) * 35) * (height / 1024);
      const gCol = ctx.createRadialGradient(xy.x, xy.y, 4, xy.x, xy.y, rw);
      gCol.addColorStop(0, "rgba(116, 178, 75, 0.55)");
      gCol.addColorStop(1, "rgba(62, 118, 45, 0)");
      ctx.fillStyle = gCol;
      ctx.beginPath();
      ctx.ellipse(xy.x, xy.y, rw, rh, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // RIO DA LUZ serpenteando de Norte (Pomerode, yaw +75° / 0°) a Sul (Jaraguá do Sul, yaw -155°)
    ctx.strokeStyle = "#3898b8";
    ctx.lineWidth = 7 * (width / 2048);
    ctx.beginPath();
    for (let u = 0; u <= 360; u += 4) {
      const yaw = u - 180;
      const riverPitch = -18 + Math.sin((yaw * Math.PI) / 45) * 6.5 - Math.cos((yaw * Math.PI) / 90) * 4;
      const pt = yawPitchToXY(yaw, riverPitch, width, height);
      if (u === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Estrada Histórica do Rio da Luz acompanhando o vale (traço branco/ocre como no mapa!)
    ctx.strokeStyle = "#e8d7b4";
    ctx.lineWidth = 4.5 * (width / 2048);
    ctx.beginPath();
    for (let u = 0; u <= 360; u += 4) {
      const yaw = u - 180;
      const roadPitch = -16 + Math.sin((yaw * Math.PI) / 45 + 0.35) * 6.2 - Math.cos((yaw * Math.PI) / 90) * 3.8;
      const pt = yawPitchToXY(yaw, roadPitch, width, height);
      if (u === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Lagoas azuis dos Pesque-Pagues (Ponto 4: Alcir em yaw -112° e Ponto 5: Recanto dos Amigos em yaw -88°)
    const ponds = [
      { yaw: -112, pitch: -21 },
      { yaw: -88, pitch: -19 },
      { yaw: -22, pitch: -22 }
    ];
    ponds.forEach(pd => {
      const xy = yawPitchToXY(pd.yaw, pd.pitch, width, height);
      ctx.fillStyle = "#1d7ea6";
      ctx.strokeStyle = "#a3d9c9";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(xy.x, xy.y, 26 * (width / 2048), 11 * (height / 1024), 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Casinhas Enxaimel (Fachwerk) e Igrejas desenhadas nas coordenadas dos pontos do mapa!
    const buildings = [
      { yaw: -142, pitch: -20, type: "enxaimel", roof: "#8c2d19" }, // 1. Casa Rux
      { yaw: -128, pitch: -22, type: "chalet", roof: "#4a3222" },   // 2. Schroeder Platz
      { yaw: -135, pitch: -14, type: "enxaimel", roof: "#9e3b24" }, // 3. Berghaus
      { yaw: -118, pitch: -18, type: "club", roof: "#7a2e1d" },     // Salão Barg
      { yaw: -45, pitch: -16, type: "church", roof: "#b83b2a" },    // Comunidade Salvador
      { yaw: -22, pitch: -17, type: "enxaimel", roof: "#854d27" },  // 6. Garten Fluss
      { yaw: 5, pitch: -19, type: "chalet", roof: "#a8384b" },      // 7. Belo Vale
      { yaw: -4, pitch: -14, type: "enxaimel", roof: "#6e3b18" },   // 8. Cervejaria Maestro
      { yaw: 14, pitch: -15, type: "chalet", roof: "#785820" },     // 9. CTG Velha Querência
      { yaw: -8, pitch: -11, type: "church", roof: "#9c2f23" },     // Igreja Apóstolo Paulo
      { yaw: 34, pitch: -11, type: "church", roof: "#9c2f23" },     // Igreja Comunidade da Paz
      { yaw: 42, pitch: -9, type: "club", roof: "#7a2e1d" },        // Salão Vitória
      { yaw: 58, pitch: -14, type: "enxaimel", roof: "#8c4a27" },   // 10. Tradição do Vale
      { yaw: 74, pitch: -11, type: "chalet", roof: "#b82535" },     // 11. Pousada Sítio Harmonia (Chalé Vermelho!)
      { yaw: 92, pitch: -9, type: "enxaimel", roof: "#634224" }     // 12. Cantinho na Montanha
    ];

    const scale = width / 2048;
    buildings.forEach(b => {
      const xy = yawPitchToXY(b.yaw, b.pitch, width, height);
      const bw = 20 * scale;
      const bh = 13 * scale;

      // Parede branca/tijolo com treliça enxaimel
      ctx.fillStyle = b.roof === "#b82535" ? "#c93444" : "#f5ebd6";
      ctx.fillRect(xy.x - bw / 2, xy.y - bh, bw, bh);
      ctx.strokeStyle = "#4a2c11";
      ctx.lineWidth = 1.6 * scale;
      ctx.strokeRect(xy.x - bw / 2, xy.y - bh, bw, bh);

      // Telhado inclinado germânico
      ctx.fillStyle = b.roof;
      ctx.beginPath();
      ctx.moveTo(xy.x - bw * 0.65, xy.y - bh);
      ctx.lineTo(xy.x, xy.y - bh * 1.75);
      ctx.lineTo(xy.x + bw * 0.65, xy.y - bh);
      ctx.closePath();
      ctx.fill();

      // Se for igreja, desenha a torre com cruz no topo
      if (b.type === "church") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(xy.x - 3.5 * scale, xy.y - bh * 2.5, 7 * scale, bh * 1.5);
        ctx.fillStyle = b.roof;
        ctx.beginPath();
        ctx.moveTo(xy.x - 5 * scale, xy.y - bh * 2.5);
        ctx.lineTo(xy.x, xy.y - bh * 3.3);
        ctx.lineTo(xy.x + 5 * scale, xy.y - bh * 2.5);
        ctx.closePath();
        ctx.fill();
      }
    });

    ctx.restore();
  }

  function drawMountainLayer(ctx, width, height, opts) {
    ctx.save();
    ctx.beginPath();
    const steps = 720;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const yaw = u * 360 - 180;
      const rad = (yaw * Math.PI) / 180;
      let n = fbm(rad, opts.freq, 5, opts.seed);
      let pitch = opts.basePitch + Math.abs(n) * opts.ampPitch;

      if (opts.isMainScarp) {
        if (opts.presetName.startsWith("rio_da_luz")) {
          // Pico Malwee imponente em yaw = -150° (Sudeste/Sul) e Serra de Pomerode/Mirante do Vale em yaw = +102° (Norte)
          pitch += 13.5 * gauss(angleDiff(yaw, -150), 20); // Pico Malwee!
          pitch += 10.5 * gauss(angleDiff(yaw, -75), 35);  // Morro Boa Vista / Serra Oeste
          pitch += 12.0 * gauss(angleDiff(yaw, 102), 28);  // Serra do Mirante do Vale [13]
          pitch -= 3.5 * gauss(angleDiff(yaw, -165), 14);  // Abertura Sul para Jaraguá do Sul Centro
          pitch -= 3.0 * gauss(angleDiff(yaw, 65), 16);    // Passagem Norte para Pomerode Rota Enxaimel
        } else if (opts.presetName === "florianopolis_lagoa") {
          pitch += 7.5 * gauss(angleDiff(yaw, -62), 32);
          pitch += 5.5 * gauss(angleDiff(yaw, 110), 28);
          pitch -= 4.5 * gauss(angleDiff(yaw, 28), 24);
        } else if (opts.presetName === "florianopolis_ponte") {
          pitch += 9.5 * gauss(angleDiff(yaw, 115), 35);
          pitch += 5.0 * gauss(angleDiff(yaw, -145), 40);
          pitch -= 4.0 * gauss(angleDiff(yaw, -55), 25);
          pitch -= 4.0 * gauss(angleDiff(yaw, 65), 25);
        } else if (opts.presetName === "serra_rio_do_rastro") {
          pitch += 14.0 * gauss(angleDiff(yaw, -45), 48);
          pitch += 12.0 * gauss(angleDiff(yaw, -135), 55);
          pitch += 10.0 * gauss(angleDiff(yaw, 175), 50);
          pitch -= 6.5 * gauss(angleDiff(yaw, 55), 35);
        } else if (opts.presetName === "urubici_morro_igreja") {
          pitch += 11.0 * gauss(angleDiff(yaw, -45), 45);
          pitch += 8.5 * gauss(angleDiff(yaw, 24), 22);
        } else if (opts.presetName === "canion_itaimbezinho") {
          pitch += 13.0 * gauss(angleDiff(yaw, -45), 32);
          pitch += 13.0 * gauss(angleDiff(yaw, 48), 32);
          pitch -= 8.0 * gauss(angleDiff(yaw, 0), 14);
        } else if (opts.presetName === "garopaba_baleia_franca") {
          pitch += 8.0 * gauss(angleDiff(yaw, 52), 26);
          pitch += 7.0 * gauss(angleDiff(yaw, -95), 35);
          pitch -= 4.5 * gauss(angleDiff(yaw, 5), 28);
        } else if (opts.presetName === "balneario_camboriu") {
          pitch += 9.5 * gauss(angleDiff(yaw, 62), 25);
          pitch += 7.0 * gauss(angleDiff(yaw, -56), 22);
          pitch -= 4.5 * gauss(angleDiff(yaw, -15), 28);
        }
      }

      const x = u * width;
      const y = ((90 - pitch) / 180) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    const bottomY = height * 0.62;
    ctx.lineTo(width, bottomY);
    ctx.lineTo(0, bottomY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, height * 0.36, 0, bottomY);
    grad.addColorStop(0, opts.topColor);
    grad.addColorStop(1, opts.bottomColor);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function drawSceneSpecificFeatures(ctx, width, height, presetName, p) {
    ctx.save();
    if (presetName === "florianopolis_lagoa") {
      drawPolygonFeature(ctx, width, height, [[-25, -8], [15, -7], [85, -8], [105, -18], [65, -34], [10, -28], [-20, -18]], "#2d5a3c");
      drawPolygonFeature(ctx, width, height, [[32, -11], [78, -11], [86, -24], [48, -28], [26, -18]], "#edd6a4");
      drawPolygonFeature(ctx, width, height, [[-48, -9], [16, -9], [22, -18], [5, -32], [-38, -30], [-54, -16]], "#156d82");
      drawCityGrid(ctx, width, height, 8, -16, 28, 10, 160);
    } else if (presetName === "florianopolis_ponte") {
      drawPolygonFeature(ctx, width, height, [[-42, -5], [-14, -6], [-18, -26], [-55, -24]], "#334c3d");
      drawPolygonFeature(ctx, width, height, [[14, -6], [46, -5], [55, -24], [18, -26]], "#334c3d");
      drawCityGrid(ctx, width, height, -28, -10, 22, 8, 180);
      drawCityGrid(ctx, width, height, 28, -10, 24, 8, 180);
      const t1 = yawPitchToXY(-10, 8, width, height), t2 = yawPitchToXY(10, 8, width, height);
      const b1 = yawPitchToXY(-10, -14, width, height), b2 = yawPitchToXY(10, -14, width, height);
      const leftApproach = yawPitchToXY(-24, -7, width, height), rightApproach = yawPitchToXY(24, -7, width, height);
      const deckLeft = yawPitchToXY(-10, -6, width, height), deckRight = yawPitchToXY(10, -6, width, height);
      ctx.strokeStyle = "#e0b06c"; ctx.lineWidth = 5 * (width / 2048);
      ctx.beginPath(); ctx.moveTo(leftApproach.x, leftApproach.y); ctx.lineTo(deckLeft.x, deckLeft.y); ctx.lineTo(deckRight.x, deckRight.y); ctx.lineTo(rightApproach.x, rightApproach.y); ctx.stroke();
      ctx.strokeStyle = "#f4c986"; ctx.lineWidth = 6 * (width / 2048);
      ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(b1.x, b1.y); ctx.moveTo(t2.x, t2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    } else if (presetName === "serra_rio_do_rastro") {
      ctx.strokeStyle = "#f5d996"; ctx.lineWidth = 4.5 * (width / 2048);
      ctx.beginPath();
      for (let t = 0; t <= 14; t++) {
        const pt = yawPitchToXY(6 + (t % 2 === 0 ? -1 : 1) * (6 + t * 0.8), -9 - t * 2.5, width, height);
        if (t === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else if (presetName === "urubici_morro_igreja") {
      drawPolygonFeature(ctx, width, height, [[15, -2], [35, -3], [38, -19], [12, -18]], "#4a4644");
      const hole = yawPitchToXY(24, -10, width, height);
      ctx.fillStyle = p.skyHorizon; ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 18 * (width / 2048), 14 * (height / 1024), -0.15, 0, Math.PI * 2); ctx.fill();
    } else if (presetName === "canion_itaimbezinho") {
      drawPolygonFeature(ctx, width, height, [[-48, -2], [-8, -6], [-3, -44], [-58, -38]], "#4d4742");
      drawPolygonFeature(ctx, width, height, [[8, -6], [48, -2], [58, -38], [3, -44]], "#3f3a36");
      drawPolygonFeature(ctx, width, height, [[-9, -6], [9, -6], [4, -44], [-4, -44]], "#14261c");
    } else if (presetName === "garopaba_baleia_franca") {
      drawPolygonFeature(ctx, width, height, [[-82, -6], [-35, -7], [-30, -20], [-78, -22]], "#efe0b9");
      drawPolygonFeature(ctx, width, height, [[34, -4], [78, -3], [84, -18], [30, -16]], "#2c5439");
    } else if (presetName === "balneario_camboriu") {
      drawPolygonFeature(ctx, width, height, [[-42, -9], [42, -9], [46, -15], [-46, -15]], "#ebd7ae");
      drawPolygonFeature(ctx, width, height, [[-33, -10], [-23, -10], [-21, -13], [-35, -13]], "#244d32");
      for (let b = -35; b <= 35; b += 1.4) {
        const bHeightPitch = 2.5 + hash(b * 13.7) * 5.8;
        const topPt = yawPitchToXY(b, -10.5 + bHeightPitch, width, height);
        const botPt = yawPitchToXY(b, -10.5, width, height);
        ctx.fillStyle = hash(b * 7.1) > 0.4 ? "#d9e2ec" : "#9fb3c8";
        ctx.fillRect(topPt.x, topPt.y, (width / 360) * 1.1, botPt.y - topPt.y);
      }
    }
    ctx.restore();
  }

  function drawPolygonFeature(ctx, width, height, pointsYawPitch, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    pointsYawPitch.forEach((pt, idx) => {
      const xy = yawPitchToXY(pt[0], pt[1], width, height);
      if (idx === 0) ctx.moveTo(xy.x, xy.y);
      else ctx.lineTo(xy.x, xy.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  function drawCityGrid(ctx, width, height, centerYaw, centerPitch, spanYaw, spanPitch, count) {
    for (let i = 0; i < count; i++) {
      const yw = centerYaw + (hash(i * 11.3) - 0.5) * spanYaw * 2;
      const pt = centerPitch + (hash(i * 23.7) - 0.5) * spanPitch * 2;
      const xy = yawPitchToXY(yw, pt, width, height);
      ctx.fillStyle = i % 3 === 0 ? "#c85a3a" : (i % 2 === 0 ? "#e2d4c0" : "#ffd27d");
      ctx.fillRect(xy.x, xy.y, 3.5 * (width / 2048), 2.2 * (height / 1024));
    }
  }

  function drawSurfaceDetails(ctx, width, height, presetName, p, sunX) {
    ctx.save();
    const horizonY = height * 0.5;
    const reflGrad = ctx.createRadialGradient(sunX, horizonY + height * 0.12, 5, sunX, horizonY + height * 0.12, width * 0.16);
    reflGrad.addColorStop(0, "rgba(255, 240, 190, 0.28)");
    reflGrad.addColorStop(1, "rgba(255, 240, 190, 0)");
    ctx.fillStyle = reflGrad;
    ctx.fillRect(0, horizonY, width, height * 0.35);
    ctx.restore();
  }

  function drawNadirCompassBand(ctx, width, height) {
    ctx.save();
    const bandY = ((90 - (-78)) / 180) * height;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, bandY);
    ctx.lineTo(width, bandY);
    ctx.stroke();

    const dirs = [
      { yaw: 0, label: "CENTRO DO VALE (0°)" },
      { yaw: 90, label: "NORTE / POMERODE (+90°)" },
      { yaw: -90, label: "OESTE / BRAÇO RURAL (-90°)" },
      { yaw: 180, label: "SUL / JARAGUÁ DO SUL (180°)" },
      { yaw: -180, label: "SUL / JARAGUÁ DO SUL (-180°)" }
    ];
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = `bold ${Math.round(16 * (width / 2048))}px sans-serif`;
    ctx.textAlign = "center";
    dirs.forEach(d => {
      const x = ((d.yaw + 180) / 360) * width;
      ctx.fillText(d.label, x, bandY - 10);
    });
    ctx.restore();
  }

  function startInteractive3DTerrain(canvas, fallbackType, title) {
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    let rotZ = -0.65;
    let rotX = 0.58;
    let zoom = 1.0;
    let isDragging = false;
    let lastX = 0, lastY = 0;
    let animId = null;
    let selectedPin = 0;

    const pinsByType = {
      rio_da_luz_valley: [
        { num: "1", x: -0.28, y: 0.32, label: "Entrada Sul: Casa Rux [1], Schroeder Platz [2] & Pico Malwee" },
        { num: "2", x: -0.10, y: 0.14, label: "Baixo Vale: Berghaus [3], Salão Barg & Pesque-Pagues [4, 5]" },
        { num: "3", x: 0.02, y: -0.02, label: "Médio Vale: Garten Fluss [6], Belo Vale [7], Maestro [8] & CTG [9]" },
        { num: "4", x: 0.16, y: -0.18, label: "Alto Vale: Tradição do Vale [10], Sítio Harmonia [11] & Cantinho [12]" },
        { num: "5", x: 0.28, y: -0.34, label: "Topo Norte: Mirante do Vale [13] & Saída para Pomerode (Rota Enxaimel)" }
      ],
      island_lagoon: [
        { num: "1", x: 0.25, y: 0.1, label: "Campo de Dunas e Barreira Arenosa" },
        { num: "2", x: -0.05, y: 0.0, label: "Corpo Lagunar Central (Lagoa)" },
        { num: "3", x: -0.35, y: -0.15, label: "Maciço Cristalino Granítico (590 Ma)" },
        { num: "4", x: 0.18, y: -0.28, label: "Canal de Ligação com o Oceano" },
        { num: "5", x: -0.20, y: 0.30, label: "Planície Costeira Quaternária" }
      ],
      bridge_strait: [
        { num: "1", x: 0.0, y: 0.0, label: "Vão Central Pênsil (339,47m)" },
        { num: "2", x: -0.25, y: 0.0, label: "Cabeceira Continental (Estreito)" },
        { num: "3", x: 0.25, y: 0.0, label: "Cabeceira Insular (Centro Histórico)" },
        { num: "4", x: 0.0, y: -0.32, label: "Baía Norte de Florianópolis" },
        { num: "5", x: 0.0, y: 0.32, label: "Baía Sul de Florianópolis" }
      ],
      canyon_scarp: [
        { num: "1", x: -0.28, y: -0.2, label: "Planalto Serrano (1.421m - Basaltos)" },
        { num: "2", x: 0.02, y: 0.0, label: "Escarpa da Serra Geral & 284 Curvas" },
        { num: "3", x: 0.28, y: 0.22, label: "Arenitos Eólicos Botucatu (Aquífero Guarani)" },
        { num: "4", x: 0.35, y: -0.15, label: "Vale do Rio do Rastro / Depressão" }
      ],
      pedra_furada: [
        { num: "1", x: -0.22, y: -0.1, label: "Topo do Morro da Igreja (1.822m)" },
        { num: "2", x: 0.15, y: 0.05, label: "Janela Erosiva da Pedra Furada (30m)" },
        { num: "3", x: -0.10, y: 0.25, label: "Matas Nebulares e Campos de Altitude" },
        { num: "4", x: 0.32, y: -0.2, label: "Vertente Atlântica do Parque Nacional" }
      ],
      canyon_slot: [
        { num: "1", x: 0.0, y: 0.0, label: "Fenda Tectônica do Itaimbezinho (720m)" },
        { num: "2", x: -0.25, y: -0.12, label: "Cachoeira das Andorinhas (300m)" },
        { num: "3", x: 0.24, y: 0.10, label: "Cascata Véu de Noiva (500m)" },
        { num: "4", x: 0.05, y: 0.32, label: "Trilha do Rio do Boi (Praia Grande - SC)" }
      ],
      sc_state: [
        { num: "1", x: 0.38, y: 0.05, label: "Litoral Catarinense & Ilha de SC" },
        { num: "2", x: 0.14, y: 0.18, label: "Crista da Serra Geral (Urubici / Rio do Rastro)" },
        { num: "3", x: 0.22, y: -0.22, label: "Vale do Rio da Luz (Jaraguá do Sul) & Vale Europeu" },
        { num: "4", x: -0.32, y: 0.0, label: "Planalto Oeste & Bacia do Rio Uruguai" }
      ]
    };

    const pins = pinsByType[fallbackType] || pinsByType.rio_da_luz_valley;

    function heightAt(nx, ny) {
      if (fallbackType === "rio_da_luz_valley") {
        // Vale encaixado entre duas cristas montanhosas (Morro Boa Vista a Oeste e Pico Malwee/Serra a Leste)
        const distFromTalweg = Math.abs(nx + ny * 0.55 - Math.sin(ny * 5) * 0.06);
        const valleyWalls = (1.0 - Math.exp(-distFromTalweg * distFromTalweg * 18)) * 0.28;
        const northRise = (0.5 - ny) * 0.08;
        return Math.max(0.01, valleyWalls + northRise + Math.cos(nx * 12) * 0.015);
      } else if (fallbackType === "canyon_slot") {
        const slot = 1.0 - Math.exp(-(nx * nx * 28) / (0.2 + (ny + 0.5) * 0.6));
        return slot * 0.28 + Math.sin(nx * 9) * 0.02;
      } else if (fallbackType === "canyon_scarp" || fallbackType === "pedra_furada") {
        const scarp = 1 / (1 + Math.exp((nx * 6 + Math.sin(ny * 4) * 1.2)));
        return scarp * 0.32 + Math.cos(nx * 10 + ny * 8) * 0.025;
      } else if (fallbackType === "bridge_strait") {
        const land = Math.abs(nx) > 0.14 ? (Math.abs(nx) - 0.14) * 0.55 : -0.02;
        return Math.max(0, land + Math.sin(ny * 6) * 0.03);
      } else {
        const island1 = Math.exp(-((nx + 0.2) ** 2 * 9 + (ny + 0.05) ** 2 * 7)) * 0.30;
        const island2 = Math.exp(-((nx - 0.22) ** 2 * 14 + (ny - 0.15) ** 2 * 12)) * 0.18;
        const ridge = Math.exp(-((nx + 0.05) ** 2 * 18 + (ny - 0.2) ** 2 * 8)) * 0.22;
        return Math.max(0, island1 + island2 + ridge - 0.03);
      }
    }

    function project3D(x, y, z, w, h) {
      const cosZ = Math.cos(rotZ), sinZ = Math.sin(rotZ);
      const rx = x * cosZ - y * sinZ;
      const ry = x * sinZ + y * cosZ;
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const py = ry * cosX - z * sinX;
      const pz = ry * sinX + z * cosX + 2.2;
      const scale = (Math.min(w, h) * 0.95 * zoom) / pz;
      return { x: w * 0.5 + rx * scale, y: h * 0.52 + py * scale, z: pz };
    }

    function render() {
      const w = (canvas.width = canvas.clientWidth || 560);
      const h = (canvas.height = canvas.clientHeight || 420);

      const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, w * 0.7);
      bg.addColorStop(0, "#2b2e33");
      bg.addColorStop(1, "#121417");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const gridN = 34;
      const quads = [];
      for (let i = 0; i < gridN; i++) {
        for (let j = 0; j < gridN; j++) {
          const x0 = (i / gridN) - 0.5, x1 = ((i + 1) / gridN) - 0.5;
          const y0 = (j / gridN) - 0.5, y1 = ((j + 1) / gridN) - 0.5;
          const z00 = heightAt(x0, y0), z10 = heightAt(x1, y0);
          const z11 = heightAt(x1, y1), z01 = heightAt(x0, y1);
          const p00 = project3D(x0, y0, -z00, w, h), p10 = project3D(x1, y0, -z10, w, h);
          const p11 = project3D(x1, y1, -z11, w, h), p01 = project3D(x0, y1, -z01, w, h);
          const avgH = (z00 + z10 + z11 + z01) * 0.25;
          const avgZ = (p00.z + p10.z + p11.z + p01.z) * 0.25;
          const slope = (z10 - z00) * 18;

          let color;
          if (avgH <= 0.035) {
            color = `rgb(68, 148, 72)`; // Fundo verde claro do Vale do Rio da Luz
          } else if (avgH < 0.16) {
            const g = Math.max(45, Math.min(135, Math.round(88 + slope * 35)));
            color = `rgb(${Math.round(g * 0.42)}, ${g}, ${Math.round(g * 0.42)})`;
          } else {
            const g = Math.max(35, Math.min(115, Math.round(68 + slope * 30)));
            color = `rgb(${Math.round(g * 0.45)}, ${g}, ${Math.round(g * 0.50)})`;
          }
          quads.push({ p00, p10, p11, p01, avgZ, color });
        }
      }

      quads.sort((a, b) => b.avgZ - a.avgZ);
      quads.forEach(q => {
        ctx.fillStyle = q.color;
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(q.p00.x, q.p00.y); ctx.lineTo(q.p10.x, q.p10.y);
        ctx.lineTo(q.p11.x, q.p11.y); ctx.lineTo(q.p01.x, q.p01.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });

      pins.forEach((pin, idx) => {
        const pz = heightAt(pin.x, pin.y) + 0.04;
        const sc = project3D(pin.x, pin.y, -pz, w, h);
        pin._screenX = sc.x; pin._screenY = sc.y;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, idx === selectedPin ? 14 : 12, 0, Math.PI * 2);
        ctx.fillStyle = idx === selectedPin ? "#6d4c82" : "rgba(20, 24, 28, 0.85)";
        ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "#ffffff"; ctx.stroke();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(pin.num, sc.x, sc.y);
        ctx.restore();
      });

      if (pins[selectedPin]) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
        ctx.fillRect(14, h - 46, w - 28, 34);
        ctx.fillStyle = "#86efac";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Setor [${pins[selectedPin].num}]: ${pins[selectedPin].label}`, 24, h - 25);
      }
    }

    const onDown = e => {
      isDragging = true;
      const rect = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      lastX = cx; lastY = cy;
      pins.forEach((pin, idx) => {
        if (Math.hypot(cx - (pin._screenX || 0), cy - (pin._screenY || 0)) < 18) {
          selectedPin = idx; render();
        }
      });
    };
    const onMove = e => {
      if (!isDragging) return;
      const rect = canvas.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      rotZ += (cx - lastX) * 0.01;
      rotX = Math.max(0.2, Math.min(1.3, rotX + (cy - lastY) * 0.008));
      lastX = cx; lastY = cy; render();
    };
    const onUp = () => { isDragging = false; };
    const onWheel = e => {
      e.preventDefault();
      zoom = Math.max(0.65, Math.min(1.65, zoom - e.deltaY * 0.001));
      render();
    };

    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    render();

    return function cleanup() {
      if (animId) cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }

  return {
    getEquirectangularCanvas,
    startInteractive3DTerrain
  };
})();

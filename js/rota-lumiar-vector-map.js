/**
 * ============================================================================
 * MAPA ILUSTRADO VETORIAL — ROTA LUMIAR (RIO DA LUZ E TESTO ALTO • 1 A 26)
 * Ilustração horizontal panorâmica inspirada na estética Rota do Enxaimel.
 * ============================================================================
 */
window.ROTA_LUMIAR_VECTOR_MAP = {
  viewBoxWidth: 1200,
  viewBoxHeight: 380,
  pinPositions: {
    1:  { x: 11.5, y: 21.5 },
    2:  { x: 10.2, y: 46.5 },
    3:  { x: 20.8, y: 24.5 },
    4:  { x: 18.8, y: 49.0 },
    5:  { x: 24.8, y: 41.5 },
    6:  { x: 30.0, y: 45.0 },
    7:  { x: 29.5, y: 70.5 },
    8:  { x: 36.2, y: 48.0 },
    9:  { x: 39.2, y: 35.5 },
    10: { x: 43.0, y: 55.5 },
    11: { x: 47.6, y: 46.5 },
    12: { x: 38.2, y: 74.5 },
    13: { x: 43.8, y: 79.5 },
    14: { x: 31.2, y: 86.5 },
    15: { x: 61.5, y: 44.5 },
    16: { x: 64.5, y: 69.0 },
    17: { x: 68.8, y: 40.5 },
    18: { x: 74.5, y: 46.5 },
    19: { x: 80.5, y: 27.0 },
    20: { x: 86.4, y: 28.5 },
    21: { x: 81.2, y: 70.0 },
    22: { x: 88.0, y: 70.0 },
    23: { x: 85.2, y: 49.0 },
    24: { x: 90.4, y: 54.0 },
    25: { x: 94.0, y: 64.5 },
    26: { x: 96.2, y: 81.5 }
  },
  svgMarkup: `
    <svg class="rdl-diorama-svg" viewBox="0 0 1200 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa Ilustrado Rota Lumiar">
      <defs>
        <linearGradient id="rdlBgOlive" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#87aa21"/>
          <stop offset="100%" stop-color="#85a71e"/>
        </linearGradient>
        <filter id="rdlSoftShadow" x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#1b2b05" flood-opacity="0.28"/>
        </filter>
        <!-- Casa Enxaimel Padrão -->
        <g id="casaEnxaimel">
          <rect x="-15" y="-4" width="30" height="16" rx="1" fill="#f7f1e3" stroke="#5b3d24" stroke-width="1.3"/>
          <polygon points="-17,-4 0,-15 17,-4" fill="#9a3412" stroke="#5b3d24" stroke-width="1.2"/>
          <line x1="-15" y1="3" x2="15" y2="3" stroke="#5b3d24" stroke-width="1.3"/>
          <line x1="-6" y1="-4" x2="-6" y2="12" stroke="#5b3d24" stroke-width="1.3"/>
          <line x1="6" y1="-4" x2="6" y2="12" stroke="#5b3d24" stroke-width="1.3"/>
          <rect x="-2.5" y="4" width="5" height="8" fill="#7c2d12"/>
          <rect x="-12" y="-1" width="4" height="4" fill="#38bdf8" stroke="#5b3d24" stroke-width="0.7"/>
          <rect x="8" y="-1" width="4" height="4" fill="#38bdf8" stroke="#5b3d24" stroke-width="0.7"/>
        </g>
        <!-- Casinha Enxaimel Mini -->
        <g id="miniCasa">
          <rect x="-9" y="-2" width="18" height="10" fill="#f8f2e4" stroke="#5b3d24" stroke-width="1"/>
          <polygon points="-11,-2 0,-9 11,-2" fill="#8f2d14" stroke="#5b3d24" stroke-width="0.9"/>
          <line x1="-9" y1="3" x2="9" y2="3" stroke="#5b3d24" stroke-width="0.9"/>
          <line x1="0" y1="-2" x2="0" y2="8" stroke="#5b3d24" stroke-width="0.9"/>
        </g>
        <!-- Pinheiro / Árvore -->
        <g id="arvoreVerde">
          <rect x="-1.5" y="4" width="3" height="7" fill="#5b3d24"/>
          <polygon points="0,-14 -8,5 8,5" fill="#2e5e18"/>
          <polygon points="0,-19 -6,-3 6,-3" fill="#3b7420"/>
        </g>
      </defs>

      <!-- Fundo contínuo verde-oliva -->
      <rect width="1200" height="380" fill="url(#rdlBgOlive)"/>

      <!-- Cadeia de Morros ao Fundo (Serra do Mar / Pico Malwee / Serra do Vale) -->
      <path d="M210,120 Q275,28 345,120 Z" fill="#6f9217"/>
      <path d="M285,125 Q350,18 425,125 Z" fill="#5e7f12"/>
      <path d="M510,130 Q575,36 655,130 Z" fill="#6f9217"/>
      <path d="M565,130 Q625,52 695,130 Z" fill="#5a7911"/>
      <path d="M880,105 Q945,25 1015,105 Z" fill="#6d8f16"/>

      <!-- Áreas de Mata mais densa -->
      <ellipse cx="348" cy="112" rx="46" ry="12" fill="#46620c" opacity="0.55"/>
      <ellipse cx="605" cy="118" rx="42" ry="11" fill="#46620c" opacity="0.55"/>
      <ellipse cx="645" cy="295" rx="68" ry="22" fill="#709218" opacity="0.7"/>

      <!-- Árvores Decorativas -->
      <use href="#arvoreVerde" x="85" y="75"/>
      <use href="#arvoreVerde" x="195" y="65"/>
      <use href="#arvoreVerde" x="325" y="88"/>
      <use href="#arvoreVerde" x="368" y="96"/>
      <use href="#arvoreVerde" x="572" y="102"/>
      <use href="#arvoreVerde" x="625" y="95"/>
      <use href="#arvoreVerde" x="678" y="135"/>
      <use href="#arvoreVerde" x="765" y="128"/>
      <use href="#arvoreVerde" x="995" y="75"/>
      <use href="#arvoreVerde" x="1145" y="165"/>
      <use href="#arvoreVerde" x="458" y="340"/>

      <!-- Rios Serpenteantes (Rio da Luz à esquerda e Rio do Testo à direita) -->
      <path d="M88,18 C115,65 75,110 115,148 C155,186 245,165 305,205 C355,238 430,192 505,228 C550,248 560,295 575,355"
            fill="none" stroke="#36a7e0" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M740,55 C765,120 715,175 765,215 C815,255 895,215 955,245 C1015,275 1070,220 1125,272 C1150,296 1168,332 1175,368"
            fill="none" stroke="#36a7e0" stroke-width="6" stroke-linecap="round"/>

      <!-- Estradas Principais em Ocre Quente (#e3963e) -->
      <g fill="none" stroke="#c57924" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
        <!-- Via R. Erwin Rux (superior esquerda) -->
        <path d="M35,122 C85,102 155,95 250,115 C288,123 305,152 308,182"/>
        <!-- Via principal R. Eurico Duwe -> Estrada Rio da Luz -->
        <path d="M35,122 C75,160 115,195 195,196 C265,197 315,178 368,185 C430,193 485,208 572,198"/>
        <!-- Ramal Recanto dos Amigos (R. Ricardo Fritzke) -->
        <path d="M356,184 C362,225 358,258 352,292"/>
        <!-- Ramais Rio da Luz Vitória (JGS-503 / 489) -->
        <path d="M518,202 C502,248 475,272 458,298 C482,306 508,312 528,326"/>
        <!-- Passagem Rural Rio da Luz -> Testo Alto -->
        <path d="M572,198 C625,186 675,175 738,182"/>
        <!-- Corredor Testo Alto -->
        <path d="M738,182 C795,188 835,162 895,188 C955,215 1015,196 1085,218 C1130,235 1148,278 1162,332"/>
        <!-- Loop R. Carlos Belz -->
        <path d="M895,188 C928,132 958,118 1038,124 C1065,148 1062,188 1058,210"/>
        <!-- Loop R. Progresso -->
        <path d="M925,200 C950,255 980,285 1068,282 C1095,268 1105,245 1100,222"/>
      </g>

      <g fill="none" stroke="#e59a42" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M35,122 C85,102 155,95 250,115 C288,123 305,152 308,182"/>
        <path d="M35,122 C75,160 115,195 195,196 C265,197 315,178 368,185 C430,193 485,208 572,198"/>
        <path d="M356,184 C362,225 358,258 352,292"/>
        <path d="M518,202 C502,248 475,272 458,298 C482,306 508,312 528,326"/>
        <path d="M572,198 C625,186 675,175 738,182"/>
        <path d="M738,182 C795,188 835,162 895,188 C955,215 1015,196 1085,218 C1130,235 1148,278 1162,332"/>
        <path d="M895,188 C928,132 958,118 1038,124 C1065,148 1062,188 1058,210"/>
        <path d="M925,200 C950,255 980,285 1068,282 C1095,268 1105,245 1100,222"/>
      </g>

      <!-- Trilha Pontilhada 4x4 para o Mirante do Vale -->
      <path d="M458,298 Q415,322 374,344" fill="none" stroke="#fef08a" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>

      <!-- Pontes de Madeira sobre o Rio -->
      <rect x="297" y="182" width="16" height="6" rx="1" fill="#7c2d12" stroke="#fde68a" stroke-width="0.8"/>
      <rect x="752" y="176" width="16" height="6" rx="1" fill="#7c2d12" stroke="#fde68a" stroke-width="0.8"/>
      <rect x="1080" y="216" width="16" height="6" rx="1" fill="#7c2d12" stroke="#fde68a" stroke-width="0.8"/>

      <!-- Ilustrações Arquitetônicas & Temáticas Típicas (Estilo Storybook) -->
      <!-- Casa Rux 1915 -->
      <g filter="url(#rdlSoftShadow)">
        <use href="#casaEnxaimel" x="155" y="110" transform="scale(1.1)"/>
        <!-- Schroeder Platz (café / salão) -->
        <use href="#casaEnxaimel" x="148" y="210"/>
        <!-- Açude de pesca perto dos Pesque-Pague 6 e 7 -->
        <ellipse cx="328" cy="252" rx="18" ry="9" fill="#0284c7" stroke="#fef9c3" stroke-width="1"/>
        <!-- Capela branca do Vale -->
        <g transform="translate(598,176)">
          <rect x="-7" y="-2" width="14" height="14" fill="#ffffff" stroke="#64748b" stroke-width="0.9"/>
          <polygon points="-8,-2 0,-11 8,-2" fill="#b91c1c"/>
          <rect x="-2" y="-17" width="4" height="9" fill="#ffffff" stroke="#64748b" stroke-width="0.7"/>
          <polygon points="-3,-17 0,-23 3,-17" fill="#b91c1c"/>
        </g>
        <!-- Cachoeira Trilha da Natureza -->
        <g transform="translate(772,295)">
          <ellipse cx="0" cy="4" rx="13" ry="6" fill="#0ea5e9"/>
          <path d="M-5,-12 C-5,-5 -3,1 -3,4 L3,4 C3,1 5,-5 5,-12 Z" fill="#7dd3fc"/>
        </g>
        <!-- Casa Siewert -->
        <use href="#casaEnxaimel" x="720" y="148"/>
        <!-- Fábrica / Nugali Chocolates -->
        <g transform="translate(902,208)">
          <rect x="-14" y="-5" width="28" height="12" rx="1.5" fill="#6b3e26" stroke="#fde68a" stroke-width="0.9"/>
          <line x1="-7" y1="-5" x2="-7" y2="7" stroke="#4a2816" stroke-width="1"/>
          <line x1="0" y1="-5" x2="0" y2="7" stroke="#4a2816" stroke-width="1"/>
          <line x1="7" y1="-5" x2="7" y2="7" stroke="#4a2816" stroke-width="1"/>
        </g>
        <!-- Pousada Casa Wachholz -->
        <use href="#casaEnxaimel" x="1008" y="294"/>
        <!-- Pousada Hetterich -->
        <use href="#casaEnxaimel" x="1095" y="295"/>
        <!-- Delicaten Haus -->
        <use href="#casaEnxaimel" x="1115" y="198"/>
        <!-- Casinhas enxaimel decorativas ao longo do percurso -->
        <use href="#miniCasa" x="218" y="138"/>
        <use href="#miniCasa" x="275" y="195"/>
        <use href="#miniCasa" x="405" y="196"/>
        <use href="#miniCasa" x="488" y="218"/>
        <use href="#miniCasa" x="665" y="195"/>
        <use href="#miniCasa" x="805" y="195"/>
        <use href="#miniCasa" x="845" y="160"/>
        <use href="#miniCasa" x="980" y="148"/>
        <use href="#miniCasa" x="1142" y="242"/>
      </g>

      <!-- Rótulos Discretos das Vias e Regiões -->
      <g font-family="Inter, Segoe UI, sans-serif" font-weight="700" font-size="9.5" fill="#fdfce8" opacity="0.92">
        <text x="192" y="102" text-anchor="middle">R. Erwin Rux</text>
        <text x="200" y="212" text-anchor="middle">R. Eurico Duwe</text>
        <text x="380" y="255" text-anchor="middle" transform="rotate(-78 380 255)">R. Ricardo Fritzke</text>
        <text x="475" y="192" text-anchor="middle">Estrada Rio da Luz</text>
        <text x="415" y="348" font-size="8.5" fill="#fef08a">Trilha 4x4</text>
        <text x="645" y="152" text-anchor="middle" font-size="9.5" fill="#fef9c3">Divisa Jaraguá ↔ Pomerode</text>
        <text x="802" y="170" text-anchor="middle">Rua Testo Alto</text>
        <text x="995" y="114" text-anchor="middle">R. Carlos Belz</text>
        <text x="1028" y="268" text-anchor="middle">Rua Progresso</text>
      </g>

      <!-- Marcos das Cidades nas Extremidades -->
      <g font-family="Merriweather, Georgia, serif" font-weight="900" fill="#ffffff">
        <text x="24" y="42" font-size="13" opacity="0.95">Jaraguá do Sul</text>
        <text x="24" y="56" font-family="Inter, sans-serif" font-size="10" font-weight="700" fill="#fef08a">Setor Rio da Luz (1–14)</text>

        <text x="1174" y="346" text-anchor="end" font-size="13" opacity="0.95">Centro</text>
        <text x="1174" y="362" text-anchor="end" font-size="13" opacity="0.95">Pomerode</text>
      </g>
    </svg>
  `
};

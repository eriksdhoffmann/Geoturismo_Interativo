# 🧠 Guia Completo da Lógica de Programação 360° & Manual de Replicação Universal

Este documento explica **toda a lógica de engenharia de software e matemática** por trás do passeio virtual de referência (**Geohereditas IGc-USP** — `https://geohereditas.igc.usp.br/passeiovirtual_indice-panoramas-CRG/`) e mostra como essa mesma lógica foi construída de forma **100% aberta, portátil e replicável** para os pontos turísticos e geossítios de **Santa Catarina (GeoSC 360°)**.

---

## 1. Como o Site Original do Geohereditas (USP) Funciona por Dentro?

Ao inspecionar o código-fonte do link da USP, descobrimos sua arquitetura interna:
1. **Motor Base (`lib/tdvplayer.js` — 3DVista Player):** Renderiza fotos panorâmicas 360° usando **WebGL** (divididas em faces de cubo `r, l, u, d, f, b` ou projeção equiretangular `2:1`).
2. **Banco de Dados de Cenas e Ações (`script_general.js` + `locale/pt.txt`):**
   - Armazena uma lista de panoramas (ex.: *Planície de Caraguatatuba*, *Morro do Santo Antônio*, *Lagoa Azul*, *Trilha das Palmeiras*).
   - Em cada panorama, posiciona marcadores (**Hotspots**) presos a ângulos esféricos (`Pitch` e `Yaw`).
3. **As 3 Ações de Clique nos Hotspots (`HotspotPanoramaOverlay`):**
   - **Ação 1 — Pop-up de Informação Dividido (Foto + Texto):** Abre uma janela modal dividida ao meio (58% esquerda com foto anotada das feições geológicas; 42% direita com fundo branco editorial, botão verde `[X]`, título serifado, texto explicativo e quadro amarelo *"Você sabia?"*).
   - **Ação 2 — Pop-up com Modelo 3D Externo (`PopupWebFrameBehaviour`):** No lado esquerdo do modal, em vez de uma foto estática, carrega um **`<iframe>` apontando para um link externo do Sketchfab** (ex.: `https://sketchfab.com/models/<ID>/embed?autostart=1`). Isso permite girar, dar zoom e clicar nos pontos numerados do modelo 3D hospedado em outro servidor!
   - **Ação 3 — Transição entre Fotos 360° (Teleporte de Cena):** Ao clicar no ícone de portal/miniatura, a câmera dá um zoom suave na direção do ponto e carrega outra foto 360°.

---

## 2. A Lógica Matemática e de Programação (Passo a Passo)

Para criar isso em código puro (HTML5 + CSS3 + JavaScript/WebGL) sem depender de programas pagos, usamos **4 pilares matemáticos** implementados em [`js/engine360.js`](./js/engine360.js):

### Pilar A: Projeção Equiretangular $2:1$ na Esfera WebGL
Uma foto 360° (tirada por drone DJI, câmera Insta360, Ricoh Theta ou gerada por computador) é salva como um retângulo de proporção **$2:1$** (ex.: $4096 \times 2048$ pixels):
- O eixo horizontal ($X$) cobre **$360^\circ$ de giro horizontal (`Yaw` / Azimute $\lambda$)**, indo de $-180^\circ$ a $+180^\circ$.
- O eixo vertical ($Y$) cobre **$180^\circ$ de inclinação vertical (`Pitch` / Latitude $\phi$)**, indo de $+90^\circ$ (Céu/Zênite) a $-90^\circ$ (Chão/Nadir), sendo $0^\circ$ a linha do horizonte.

No **Fragment Shader WebGL**, colocamos a câmera no centro $(0,0,0)$ da esfera e, para cada pixel da tela, lançamos um raio 3D $\vec{d} = (d_x, d_y, d_z)$ rotacionado pelo `Pitch` e `Yaw` atuais do mouse:
$$\text{lon} = \text{atan2}(d_x, d_z), \quad \text{lat} = \arcsin(d_y)$$
$$u = 0.5 + \frac{\text{lon}}{2\pi}, \quad v = 0.5 - \frac{\text{lat}}{\pi}$$

### Pilar B: Ancoragem dos Pontos Clicáveis (Projeção Direta 3D $\to$ 2D)
Como fazer um botão HTML continuar "grudado" exatamente em cima da **Ponte Hercílio Luz** ou da **Pedra Furada** enquanto o usuário gira a foto 360°?

A cada quadro (60 vezes por segundo), executamos a função `sphericalToScreen(pitch, yaw)` em `js/engine360.js`:
1. Convertemos os ângulos `(pitch, yaw)` do hotspot em uma posição 3D $(w_x, w_y, w_z)$ na superfície da esfera de raio $1$:
   ```javascript
   const wx = Math.cos(pitchRad) * Math.sin(yawRad);
   const wy = Math.sin(pitchRad);
   const wz = Math.cos(pitchRad) * Math.cos(yawRad);
   ```
2. Aplicamos a rotação inversa da câmera (`-cameraYaw` e `-cameraPitch`) para descobrir onde esse ponto está em relação aos olhos do usuário `(cx, cyCam, cz)`.
3. **Teste de Visibilidade (`cz > 0.05`):** Se `cz <= 0.05`, o ponto está **atrás da cabeça do usuário** — então ocultamos o botão (`opacity: 0`).
4. **Projeção Perspectiva na Tela 2D:** Se estiver na frente da câmera, calculamos a distância focal `focalLength = (larguraTela / 2) / Math.tan(fov / 2)` e posicionamos o botão exatamente no pixel:
   ```javascript
   const screenX = (larguraTela / 2) + (cx / cz) * focalLength;
   const screenY = (alturaTela / 2) - (cyCam / cz) * focalLength;
   ```

### Pilar C: Rótulos 3D Flutuantes na Paisagem (Botão `Aa`)
Da mesma forma que os botões clicáveis, textos como *"Lagoa da Conceição"*, *"Rodovia SC-390 (284 Curvas)"* ou *"Planície Costeira"* usam `sphericalToScreen(pitch, yaw)` combinados com `perspective(500px) rotateX(tilt)` no CSS para parecerem deitados sobre o relevo!

### Pilar D: Raycasting Inverso (Clique na Tela 2D $\to$ `Pitch` e `Yaw`)
Para que você não precise adivinhar em qual ângulo está cada montanha ou praia quando colocar uma foto 360° nova, criamos a função `screenToSpherical(mouseX, mouseY)`:
- Quando o **Modo Criador (`🛠️ Criar Ponto / Trocar Foto`)** está ativo e você clica em qualquer lugar da foto 360°, fazemos o caminho matemático inverso do pixel 2D até o vetor 3D da esfera e preenchemos automaticamente o `Pitch` e o `Yaw` exatos!

---

## 3. Estrutura de Arquivos do Projeto (Como Editar ou Expandir)

```text
Geohereditas/
├── index.html                  # Interface completa (Viewport 360°, Top Bar, Dock, Modal Split-View e Estúdio Criador)
├── ABRIR_TOUR_SC.bat           # Inicializador com 1 duplo-clique para Windows
├── GUIA_LOGICA_E_REPLICACAO.md # Este manual completo + Super Prompt de Replicação
├── css/
│   └── style.css               # Design idêntico ao Geohereditas USP (Modal dividido, ícones, animações)
├── js/
│   ├── dados-sc.js             # BANCO DE DADOS: Todas as 7 cenas 360° de SC, hotspots, textos e links 3D
│   ├── panorama-generator.js   # Gerador de panoramas equiretangulares 2:1 + Maquete 3D Offline
│   └── engine360.js            # Motor WebGL 360°, cálculo de Pitch/Yaw, Modais, Mapa Leaflet e Modo Criador
└── assets/
    └── fotos/                  # Fotografias reais dos pontos turísticos de Santa Catarina para os pop-ups
```

### Como colocar uma Foto 360° real sua (de Drone ou Câmera 360):
1. **Pela Interface Visual (Sem mexer em código):**
   - Abra o sistema (`index.html`), clique no botão verde **"🛠️ Criar Ponto / Trocar Foto"** na barra inferior e selecione sua foto `.jpg` ou `.png` no campo *"📷 Testar sua própria Foto 360°"*.
2. **Definitivamente no Código (`js/dados-sc.js`):**
   - Coloque sua foto 360° (ex.: `minha_foto_360.jpg`) na pasta `assets/panoramas/` e, dentro de `js/dados-sc.js`, mude:
     ```javascript
     customPanoramaUrl: "assets/panoramas/minha_foto_360.jpg",
     ```

### Como colocar qualquer Modelo 3D Externo (Sketchfab, Polycam, Luma AI):
No Sketchfab (ou qualquer hospedagem 3D), copie o link do modelo (ex.: `https://sketchfab.com/models/9f9047dfb6194a01a64ec3124189480d/embed?autostart=1`) e cole no campo `embedUrl` de um hotspot com `type: "3d"` em `js/dados-sc.js` (ou cole direto pelo Modo Criador na tela!).

---

## 4. 🚀 SUPER PROMPT PARA REPLICAR COM MEU PODER EM QUALQUER OUTRO COMPUTADOR

Se você estiver em **qualquer outro computador** usando o **Antigravity** e quiser criar ou recriar um sistema idêntico a este do zero (para Santa Catarina ou para qualquer outro lugar), basta copiar e colar o prompt abaixo:

```markdown
Crie uma aplicação web 100% portátil e autocontida de Passeio Virtual Interativo em 360° (inspirada no Geohereditas IGc-USP) para representar os pontos turísticos e geossítios de Santa Catarina (ou da região desejada), que funcione tanto abrindo `index.html` diretamente no navegador (`file://` sem erros de CORS) quanto via servidor local, sem depender de Node.js ou Python.

A aplicação deve conter:
1. **Motor 360° WebGL Equiretangular Próprio (`js/engine360.js`)**:
   - Fragment shader WebGL que projeta texturas equiretangulares 2:1 (360° horizontal Yaw [-180°, 180°] x 180° vertical Pitch [-90°, 90°]) com controle suave de arrasto (inércia), zoom por roda do mouse (FOV 38° a 115°) e auto-rotação.
   - Função matemática `sphericalToScreen(pitch, yaw)` que projeta coordenadas esféricas 3D em coordenadas 2D de tela a 60 FPS, ocultando pontos atrás da câmera (`z_cam <= 0.05`).
   - Função inversa `screenToSpherical(mouseX, mouseY)` (Raycasting Inverso) para capturar o `(pitch, yaw)` exato onde o usuário clicar na foto 360°.
2. **3 Tipos de Hotspots Clicáveis Ancorados em `(pitch, yaw)`**:
   - `type: "info"`: Abre um Modal Split-View (Tela Dividida 58%/42%) com foto anotada com setas à esquerda e card editorial branco à direita (botão verde `[X]`, título serifado, subtítulo verde e nota amarela inclinada *"Você sabia?"*).
   - `type: "3d"`: Abre o Modal Split-View carregando à esquerda um modelo 3D externo via `<iframe src="https://sketchfab.com/models/.../embed?autostart=1">` + alternador para maquete 3D interativa local em Canvas/WebGL (fallback offline).
   - `type: "scene"`: Faz uma animação de voo/zoom na direção do ponto clicado e carrega outra foto 360° do grafo de cenas.
3. **Interface Completa Estilo Geohereditas**:
   - Barra superior central com miniaturas em formato de pílula arredondada de todas as fotos 360°.
   - Rótulos geográficos 3D flutuantes sobre a paisagem ativáveis pelo botão `Aa`.
   - Barra inferior com filtro de categorias/serviços ecossistêmicos, Mapa Interativo (Leaflet), Grade de Cenas e **Estúdio Criador 360°** (para subir fotos 360° próprias, clicar na tela para criar novos pontos e exportar o JSON).
4. **Gerador Equiretangular 2:1 Integrado (`js/panorama-generator.js`) + Dados Estruturados (`js/dados-sc.js`)**:
   - Para que todas as cenas 360° funcionem imediatamente com montanhas, pontes, cânions, dunas e orlas alinhadas aos hotspots, permitindo substituição por fotos `.jpg` reais a qualquer momento.
```

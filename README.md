# 🌐 Geoturismo Interativo 360° — Vale do Rio da Luz & Santa Catarina (`GeoSC 360°`)

Passeio Virtual Interativo em **360° (WebGL Esférico)** desenvolvido para divulgação científica, educação patrimonial, geodiversidade e turismo cultural em **Santa Catarina**, com destaque especial para a **Paisagem Cultural do Vale do Rio da Luz (Jaraguá do Sul ↔ Pomerode)**, tombada pelo **IPHAN**.

Inspirado na arquitetura de navegação 360° do projeto *Geohereditas (IGc-USP)*.

---

## ✨ Funcionalidades Principais

- **Motor Esférico 360° Próprio em WebGL (`js/engine360.js`)**:
  - Renderização de panoramas equiretangulares ($2:1$) a 60 FPS, com inércia suave de câmera, zoom óptico (`HFOV` de $38^\circ$ a $115^\circ$) e modo de auto-rotação (`▶`).
  - Zero dependências de backend (funciona abrindo o `index.html` diretamente no navegador ou via GitHub Pages).
- **3 Tipos de Hotspots Clicáveis Ancorados em Coordenadas Esféricas (`Pitch` e `Yaw`)**:
  1. **Pop-up Split-View de Informação (`type: "info"`)**: Tela dividida com imagem anotada e mapa localizador à esquerda + texto editorial, curiosidades históricas/geológicas e quadro *"Você sabia?"* à direita.
  2. **Pop-up Split-View com Modelo 3D Externo (`type: "3d"`)**: Carrega maquetes topográficas e arquitetônicas 3D hospedadas no **Sketchfab** via `<iframe>` (*Relevo de Jaraguá do Sul - IFSC*, *Estrutura Casa Enxaimel - Fachwerkhaus*, *Ilha de Florianópolis*, *Ponte Hercílio Luz*, *Serra do Rio do Rastro*, *Morro da Igreja* e *Cânion do Itaimbezinho*), além de contar com visualizador 3D topográfico offline integrado.
  3. **Transição de Voo entre Fotos 360° (`type: "scene"`)**: Mergulho suave de câmera para navegar entre diferentes panoramas 360°.
- **Mapa Ilustrado Interativo "Bem-vindo ao Rio da Luz" (`🗺️`)**:
  - Todos os **13 pontos numerados**, as **3 Igrejas históricas (`⛪`)**, os **4 Clubes de Tiro (`⚔️` *Schützenvereine*)** e o **Pico Malwee (`⛰️`)** são clicáveis tanto na esfera 360° quanto diretamente sobre o mapa ilustrado do Vale do Rio da Luz.
- **Rótulos Geográficos 3D Flutuantes (`Aa`)**:
  - Textos em perspectiva 3D ancorados sobre as feições da paisagem (montanhas, vales, lagoas, estradas e pontes).
- **Estúdio Criador 360° Integrado (`🛠️ Criar Ponto / Trocar Foto`)**:
  - Permite carregar qualquer foto 360° (`.jpg`/`.png`) do computador, clicar diretamente na paisagem 360° para capturar automaticamente o `Pitch` e `Yaw` por *Raycasting Inverso* e exportar o código JSON pronto.

---

## 🗺️ Roteiros Incluídos

### 1. Vale do Rio da Luz (Jaraguá do Sul ↔ Pomerode) — [`index.html`](./index.html)
Mapeamento completo segundo o mapa cultural do **Rio da Luz**:
- **Pontos Numerados (`1` a `13`)**:
  1. **Casa Rux (1915)** — Patrimônio Enxaimel tombado pelo IPHAN
  2. **Schroeder Platz** — Gastronomia e convivência
  3. **Berghaus** — Arquitetura tradicional de meia-encosta
  4. **Pesque-Pague do Alcir** — Águas serranas e lazer rural
  5. **Pesque-Pague Recanto dos Amigos** — Braço oeste do vale e palmeiras-imperiais
  6. **Garten Fluss** — *"Jardim do Rio"* no núcleo central
  7. **Belo Vale Sítio de Eventos** — Anfiteatro natural da Mata Atlântica
  8. **Cervejaria Maestro** — Cultura cervejeira artesanal no vale
  9. **CTG Velha Querência** — Tradição campeira e integração cultural
  10. **Tradição do Vale** — Casarão histórico e gastronomia colonial pomerana
  11. **Pousada Sítio Harmonia** — Hospedagem rural no Alto Rio da Luz
  12. **Cantinho na Montanha** — Refúgio nas encostas superiores
  13. **Mirante do Vale** — Vista panorâmica na divisa com Pomerode (Rota Enxaimel)
- **Legenda Cultural e Natural**:
  - **⛰️ Montanha**: *Pico Malwee* ($550\text{ m}$)
  - **⚔️ Clubes de Tiro (*Schützenvereine*)**: *Salão Barg* (Enxaimel tombado pelo IPHAN), *Sociedade Aliança*, *Sociedade Centenário* e *Salão Vitória*
  - **⛪ Igrejas Históricas**: *Comunidade Salvador*, *Igreja Apóstolo Paulo* e *Igreja Comunidade da Paz*

### 2. Tour Geral de Santa Catarina (Versão Inicial Salva) — [`tour_sc_inicial.html`](./tour_sc_inicial.html)
- **Florianópolis**: Lagoa da Conceição, Dunas da Joaquina e Ponte Hercílio Luz
- **Serra Catarinense**: Mirante da Serra do Rio do Rastro (SC-390) e Morro da Igreja ($1.822\text{ m}$) & Pedra Furada (Urubici)
- **Extremo Sul**: Cânion do Itaimbezinho — Geoparque Mundial da UNESCO (Praia Grande)
- **Litoral Sul e Norte**: Garopaba (APA da Baleia Franca & Dunas do Siriú) e Balneário Camboriú (Orla & Parque Unipraias)

---

## 🚀 Como Executar Localmente em Qualquer Computador

1. Clone este repositório ou baixe o arquivo `.zip`:
   ```bash
   git clone https://github.com/eriksdhoffmann/Geoturismo_Interativo.git
   ```
2. Abra o arquivo **`index.html`** diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari) ou execute **`ABRIR_TOUR_SC.bat`** no Windows.
3. Consulte o arquivo **[`GUIA_LOGICA_E_REPLICACAO.md`](./GUIA_LOGICA_E_REPLICACAO.md)** para a explicação matemática completa da projeção esférica 360° e instruções de personalização.

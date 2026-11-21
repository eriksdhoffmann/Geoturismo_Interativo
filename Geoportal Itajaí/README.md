# 🗺️ Geoportal Itajaí — Mapa Interativo Unificado (Padrão Geoportal Florianópolis)

Sistema WebGIS interativo desenvolvido no padrão visual e funcional do **Geoportal da Prefeitura de Florianópolis** (`geoportal.pmf.sc.gov.br/map`), integrando em **um único mapa interativo** todas as camadas, séries históricas de ortoimagens e pacotes de dados oficiais do **GeoItajaí** (`geo.itajai.sc.gov.br/downloads/`).

---

## ✨ Principais Funcionalidades

- **Interface Padrão Geoportal Florianópolis**:
  - Cabeçalho institucional com navegação integrada (**Início**, **Mapas Interativos**, **Download**, **Emissão de Documentos** e **Ajuda**).
  - **Controle de Camadas** lateral recolhível com busca instantânea por grupo/camada, controle de opacidade, aproximação automática, exportação em GeoJSON, link para download oficial e aba **Legenda Ativa**.
  - **Barra de Navegação Esquerda** (Projeção/CRS, Zoom por Retângulo, `+`/`−`, Pan, Visão Inicial de Itajaí, Voltar/Avançar Vista, Tela Cheia e GPS).
  - **Barra de Ferramentas Direita** (Camadas, Mapas Base & Comparador Temporal, Impressão PDF, Medição Geodésica de Distância e Área, Desenho & Exportação GeoJSON, Identificação Multi-Camada, Importação de Shapefile `.zip`/GeoJSON/KML e Consulta de Lote).
  - **Barra de Status Inferior** com coordenadas em tempo real em **SIRGAS 2000 / UTM 22S (EPSG:31982)**, **WGS84** e **DMS**, escala gráfica dinâmica e seletor de escala cartográfica (`1 : N`).

- **Série Histórica Oficial de Aerolevantamentos de Itajaí (1984–2024) + Cortina Comparativa**:
  - **Ortoimagem Aérea 2024 (Engemap)**, **Ortoimagem 2020**, **Restituição Aerofotogramétrica 2020**, **Ortoimagem 2013**, **Ortoimagem 2007** e **Restituição Histórica 1984** (zoom 10 a 20), além de **Google Satélite**, **Google Híbrido**, **Esri Satélite**, **OpenStreetMap** e **Carto Positron**.
  - Ferramenta **Cortina Comparativa (Antes × Depois)** para arrastar e comparar a evolução urbana de Itajaí entre quaisquer anos.

- **58 Camadas Oficiais do GeoItajaí Reunidas em 9 Grupos Temáticos**:
  1. **Cadastro**: Planta Cadastral (Lotes com Inscrição Imobiliária), Malha Cadastral Completa (64.598 lotes), Lotes Baldios e Patrimônio Municipal.
  2. **Plano Diretor Vigente (2024)**: Zoneamento Municipal 2024 (32 zonas com paleta oficial), ZPA 2, Perímetro Urbano/Rural 2024, Parcelamento do Solo, Lotes Caucionados, REURB, Influência Aeroporto/Aeródromos.
  3. **Plano Diretor 2012 (Revogado)**: Zoneamento 2012 (23 zonas) e Corredores de Comércio e Serviço.
  4. **Território, Sistema Viário e Relevo**: Bairros e Localidades 2025 (34 bairros), Sistema Viário Municipal (7.211 trechos), Curvas de Nível 5m, Cota 20m, Marcos Geodésicos e Sondagens.
  5. **Defesa Civil**: Áreas Atingidas pelas Inundações de **1983, 1984, 2001, 2008 e 2011**, Cotas de Enchente (**Set/2011, Jul/2013, Set/2013, Out/2015**), Mancha de Inundação, Suscetibilidade a Deslizamentos, Vias Inundadas (Jan/2026) e Alertas Waze em Tempo Real.
  6. **Ambiental e INIS**: Hidrografia Principal, Hidrografia IBGE 1:25.000, Nascentes, APP Hidrografia SDS, Vegetação Nativa, Parque Municipal do Atalaia + Zonas de Amortecimento, Compensação/Reserva Legal, Faixa de Areia das Praias e Ecopontos **Descarta.í** (6 categorias).
  7. **Semasa e Obras**: Rede de Água (5.675 trechos), Rede de Esgoto em Operação e Em Obras, Pontos de Hidratação, Rede de Drenagem Pluvial (3.241 trechos) e Macrodrenagem Nova Itajaí.
  8. **Mobilidade, Cultura e Turismo**: Sistema Cicloviário, Rotas/POIs de Cicloturismo, Rotas e Pontos de Ônibus, Patrimônio Histórico Tombado e Rota de Pedestres do Centro Histórico.
  9. **Equipamentos Públicos, Saúde e Educação**: Unidades de Saúde 2026, Zonas de Saúde 2025, Escolas Municipais (119), Áreas de Abrangência CRAS, Wi-Fi Livre e Abrigos Pet.

- **Central de Downloads Integrada**:
  - Reúne todos os **22 pacotes oficiais** de `https://geo.itajai.sc.gov.br/downloads/` com link direto para baixar o original (Shapefile/CAD/Raster) **e** botão **"Ver no Mapa"** para ativar a camada instantaneamente.
  - Suporte nativo a **arrastar e soltar** arquivos `.zip` (Shapefile), `.geojson` e `.kml` diretamente sobre o mapa.

---

## 🚀 Como Usar

- **Online (GitHub Pages)**: abra a pasta `Geoportal Itajaí/` publicada no GitHub Pages.
- **Localmente**: abra `index.html` diretamente no navegador moderno ou execute `ABRIR_GEOPORTAL_ITAJAI.bat`.

---

## 📡 Fontes Oficiais de Dados

- **GeoItajaí — Prefeitura Municipal de Itajaí**: `https://geo.itajai.sc.gov.br/` e `https://geo.itajai.sc.gov.br/downloads/`
- **ArcGIS Enterprise REST Services (Prefeitura de Itajaí)**: `https://arcgis.itajai.sc.gov.br/server/rest/services/Hosted/`
- **Mosaicos de Ortoimagens Oficiais (1984–2024)**: `https://arcgis.itajai.sc.gov.br/geoitajai/plantacadastral/tiles/`

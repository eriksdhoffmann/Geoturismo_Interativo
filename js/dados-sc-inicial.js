/**
 * ============================================================================
 * BANCO DE DADOS GEORREFERENCIADO 360° — SANTA CATARINA (GeoSC 360°)
 * Inspirado na arquitetura do Passeio Virtual Geohereditas (IGc-USP)
 * ============================================================================
 *
 * COMO FUNCIONA A LÓGICA DESTE ARQUIVO:
 * - Cada objeto dentro de `scenes` representa UMA FOTO 360° (Panorama Esférico).
 * - Coordenadas Esféricas dos pontos clicáveis (Hotspots) e textos 3D (labels3D):
 *     • yaw (Azimute Horizontal): de -180° (Oeste/Trás) a +180° (Leste/Trás), sendo 0° o centro frontal.
 *     • pitch (Inclinação Vertical): de -90° (Chão/Nadir) a +90° (Céu/Zênite), sendo 0° a linha do horizonte.
 * - Tipos de Hotspots (`type`):
 *     1. "info"  -> Abre o Pop-up dividido (Foto anotada à esquerda + Texto editorial e "Você sabia?" à direita)
 *     2. "3d"    -> Abre o Pop-up dividido com Modelo 3D Interativo (Iframe Sketchfab / WebGL externo à esquerda + Texto à direita)
 *     3. "scene" -> Teleporta o usuário para outra Foto 360° com animação de voo (zoom + transição suave)
 */

window.TOUR_SC_DATA = {
  tourTitle: "GeoSC 360° — Patrimônio Natural, Geodiversidade e Turismo de Santa Catarina",
  tourSubtitle: "Passeio Virtual Interativo em 360° pelos Geossítios e Paisagens Catarinenses",
  defaultScene: "florianopolis_lagoa",

  categories: {
    geodiversidade: {
      id: "geodiversidade",
      label: "Geodiversidade & Relevo",
      color: "#8b1e1e",
      badgeBg: "#fef2f2",
      description: "Formações rochosas, cânions, dunas, restingas e evolução geológica"
    },
    turismo: {
      id: "turismo",
      label: "Turismo & Mirantes",
      color: "#0f766e",
      badgeBg: "#f0fdfa",
      description: "Trilhas, mirantes panorâmicos, ecoturismo e infraestrutura"
    },
    cultura: {
      id: "cultura",
      label: "História & Cultura",
      color: "#b45309",
      badgeBg: "#fffbeb",
      description: "Patrimônio histórico, engenharia, colonização e arqueologia"
    },
    modelo3d: {
      id: "modelo3d",
      label: "Modelos 3D Interativos",
      color: "#1d4ed8",
      badgeBg: "#eff6ff",
      description: "Maquetes topográficas e modelos 3D hospedados externamente (Sketchfab)"
    },
    portal360: {
      id: "portal360",
      label: "Viajar para outra Foto 360°",
      color: "#d97706",
      badgeBg: "#fef3c7",
      description: "Conexões diretas para saltar entre os panoramas 360° de Santa Catarina"
    }
  },

  scenes: {
    // =========================================================================
    // CENA 1: FLORIANÓPOLIS — LAGOA DA CONCEIÇÃO & DUNAS DA JOAQUINA
    // =========================================================================
    florianopolis_lagoa: {
      id: "florianopolis_lagoa",
      order: 1,
      title: "Lagoa da Conceição & Dunas da Joaquina",
      shortTitle: "Lagoa da Conceição",
      municipality: "Florianópolis — Ilha de Santa Catarina",
      region: "Grande Florianópolis / Litoral Central",
      altitude: "310 m (Mirante do Morro da Lagoa)",
      coordinates: { lat: -27.5986, lng: -48.4589 },
      initialView: { pitch: -8, yaw: 10, hfov: 95 },
      customPanoramaUrl: null, // Permite substituir por foto 360 real (.jpg)
      proceduralPreset: "florianopolis_lagoa",
      thumbPhoto: "assets/fotos/lagoa_conceicao.jpg",
      ecosystemSummary: "Geodiversidade costeira: laguna estrangulada, campo de dunas eólicas quaternárias e maciços graníticos.",

      // Textos flutuantes 3D na paisagem (Botão "Aa" igual à imagem 4 do Geohereditas)
      labels3D: [
        { text: "Lagoa da Conceição", pitch: -14, yaw: -5, scale: 1.15, tilt: 18 },
        { text: "Campo de Dunas da Joaquina", pitch: -18, yaw: 58, scale: 1.0, tilt: 22 },
        { text: "Maciço Costeiro da Costa da Lagoa", pitch: 6, yaw: -62, scale: 0.95, tilt: -5 },
        { text: "Oceano Atlântico (Praia Mole / Galheta)", pitch: -6, yaw: 28, scale: 0.9, tilt: 10 },
        { text: "Canal da Barra da Lagoa", pitch: -11, yaw: -32, scale: 0.85, tilt: 14 }
      ],

      hotspots: [
        {
          id: "hs_fln_relevo_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -10,
          yaw: 12,
          tooltip: "Modelo 3D: Maquete do Relevo da Ilha de Florianópolis (IFSC)",
          title: "Ilha de Santa Catarina e Laguna Costeira",
          subtitleLead: "Você sabia que a Ilha de Santa Catarina foi formada pela união de antigas ilhas rochosas de granito conectadas por planícies de sedimentos marinhos e eólicos?",
          paragraphs: [
            "O relevo de Florianópolis apresenta duas unidades geológicas muito contrastantes: os maciços cristalinos (serras graníticas e riolíticas formadas há cerca de 590 milhões de anos, no Ciclo Brasiliano) e as planícies costeiras quaternárias (formadas nos últimos 120 mil anos pelas variações do nível do mar).",
            "A Lagoa da Conceição é uma clássica laguna costeira represada por uma barreira arenosa (restinga e campo de dunas), comunicando-se com o Oceano Atlântico através do Canal da Barra da Lagoa."
          ],
          didYouKnow: "Durante o Último Máximo Glacial (há 18 mil anos), o nível do mar em Santa Catarina estava cerca de 120 metros abaixo do atual, e toda a atual Baía Norte e Sul eram vales fluviais secos!",
          sketchfabUid: "73124a5fd954402a90f4c5d432337bb9",
          embedUrl: "https://sketchfab.com/models/73124a5fd954402a90f4c5d432337bb9/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/maquete-escolar-do-relevo-de-florianopolis-73124a5fd954402a90f4c5d432337bb9",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "island_lagoon"
        },
        {
          id: "hs_fln_dunas_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -16,
          yaw: 55,
          tooltip: "Geossítio: Dunas da Joaquina e Planície Costeira",
          title: "Planície Costeira e Dunas da Joaquina",
          subtitleLead: "O setor leste da Ilha de Santa Catarina abriga um dos mais expressivos sistemas de barreiras arenosas, restingas e dunas móveis do sul do Brasil.",
          paragraphs: [
            "As Dunas da Joaquina são alimentadas constantemente pelas areias marinhas da Praia do Campeche e da Joaquina, transportadas pelos fortes ventos do quadrante Sul (associados às frentes frias subantárticas) e retrabalhadas pelos ventos Nordeste.",
            "Além de sua importância paisagística e turística (berço do sandboard catarinense), o campo de dunas funciona como uma gigantesca esponja natural que filtra e armazena água doce da chuva no Aquífero Campeche-Ingleses."
          ],
          didYouKnow: "A vegetação de restinga fixa parte das dunas impedindo que a areia soterre a Lagoa da Conceição, prestando um serviço ecossistêmico essencial de regulação costeira.",
          image: "assets/fotos/lagoa_conceicao.jpg",
          imageAnnotations: [
            { label: "Maciço Granítico (Serra do Mar / Leste)", x: 24, y: 18, arrowDir: "down" },
            { label: "Corpo Lagunar da Conceição", x: 52, y: 56, arrowDir: "down" },
            { label: "Barreira Arenosa & Restinga", x: 78, y: 42, arrowDir: "down" }
          ]
        },
        {
          id: "hs_fln_costa_info",
          type: "info",
          category: "cultura",
          iconStyle: "white-circle",
          pitch: -2,
          yaw: -58,
          tooltip: "Patrimônio Cultural: Caminho da Costa da Lagoa e Engenhos",
          title: "Maciços Graníticos e Cultura Açoriana",
          subtitleLead: "Nas encostas íngremes a oeste da Lagoa da Conceição, o acesso ocorre apenas por trilha secular ou barco, preservando a herança açoriana do século XVIII.",
          paragraphs: [
            "Os morros que cercam a Lagoa da Conceição são sustentados pelo Granito Ilha, rocha magmática resistente ao intemperismo que forma encostas íngremes cobertas por Mata Atlântica Ombrófila Densa.",
            "Nessa interface entre a montanha florestada e as águas calmas da laguna desenvolveram-se comunidades tradicionais de pescadores e antigos engenhos de farinha de mandioca e cachaça, tombados como patrimônio cultural."
          ],
          didYouKnow: "Na Praia da Joaquina e no Santinho existem oficinas líticas (pedras de amolar) e inscrições rupestres feitas por povos sambaquieiros há mais de 4.000 anos!",
          image: "assets/fotos/lagoa_conceicao.jpg",
          imageAnnotations: [
            { label: "Encostas do Granito Ilha (Mata Atlântica)", x: 30, y: 26, arrowDir: "down" },
            { label: "Canal de Navegação Tradicional", x: 64, y: 65, arrowDir: "down" }
          ]
        },
        {
          id: "hs_fln_to_ponte",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: -135,
           targetSceneId: "florianopolis_ponte",
          tooltip: "Ir para Foto 360°: Ponte Hercílio Luz e Baía Norte (12 km a Oeste)",
          transitionLabel: "Voando para Ponte Hercílio Luz..."
        },
        {
          id: "hs_fln_to_garopaba",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -4,
          yaw: 138,
          targetSceneId: "garopaba_baleia_franca",
          tooltip: "Ir para Foto 360°: Garopaba e Costa das Baleias Francas (Litoral Sul)",
          transitionLabel: "Viajando pelo Litoral Sul até Garopaba..."
        }
      ]
    },

    // =========================================================================
    // CENA 2: FLORIANÓPOLIS — PONTE HERCÍLIO LUZ & ESTREITO INSULAR
    // =========================================================================
    florianopolis_ponte: {
      id: "florianopolis_ponte",
      order: 2,
      title: "Ponte Hercílio Luz & Estreito de Florianópolis",
      shortTitle: "Ponte Hercílio Luz",
      municipality: "Florianópolis — Centro Histórico / Estreito",
      region: "Grande Florianópolis",
      altitude: "120 m (Vista Aérea do Canal do Estreito)",
      coordinates: { lat: -27.5935, lng: -48.5653 },
      initialView: { pitch: -4, yaw: 0, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "florianopolis_ponte",
      thumbPhoto: "assets/fotos/hercilio_luz.jpg",
      ecosystemSummary: "Geomorfologia estuarina (Baías Norte e Sul), estrangulamento hidrodinâmico e patrimônio histórico da engenharia.",

      labels3D: [
        { text: "Ponte Hercílio Luz (1926)", pitch: -2, yaw: 0, scale: 1.2, tilt: 8 },
        { text: "Canal do Estreito (500m)", pitch: -22, yaw: 14, scale: 1.0, tilt: 25 },
        { text: "Baía Norte", pitch: -10, yaw: -55, scale: 1.1, tilt: 15 },
        { text: "Baía Sul", pitch: -12, yaw: 65, scale: 1.1, tilt: 15 },
        { text: "Morro da Cruz (Maciço Central)", pitch: 12, yaw: 115, scale: 0.95, tilt: -6 }
      ],

      hotspots: [
        {
          id: "hs_ponte_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: 2,
          yaw: -4,
          tooltip: "Modelo 3D: Estrutura da Ponte Hercílio Luz e Relevo de SC",
          title: "Engenharia da Ponte Hercílio Luz em 3D",
          subtitleLead: "Inaugurada em 13 de maio de 1926, a Ponte Hercílio Luz é a maior ponte pênsil sustentada por barras de olhal (eyebars) ainda existente no mundo!",
          paragraphs: [
            "Com 819,47 metros de comprimento total e um vão central pênsil de 339,47 metros, a estrutura foi construída estrategicamente no ponto de maior estreitamento geomorfológico entre a Ilha de Santa Catarina e o continente.",
            "Do ponto de vista geológico, suas fundações apoiam-se diretamente sobre afloramentos rochosos cristalinos que margeiam o canal profundo escavado pelas correntes de maré entre as Baías Norte e Sul."
          ],
          didYouKnow: "Apenas duas pontes no mundo utilizaram o sistema de barras de olhal incorporadas à treliça de irrigidamento: a Ponte de Florianópolis (1926) e a Silver Bridge nos EUA — tornando a Hercílio Luz um exemplar único no planeta!",
          sketchfabUid: "a42860fb610e4ffcaa6e6082f1c70226",
          embedUrl: "https://sketchfab.com/models/a42860fb610e4ffcaa6e6082f1c70226/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/iluminacao-cenica-da-ponte-hercilio-luz-a42860fb610e4ffcaa6e6082f1c70226",
          author3D: "Eliel Matheus / Acervo 3D SC (Sketchfab)",
          fallback3DType: "bridge_strait"
        },
        {
          id: "hs_ponte_estreito_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -18,
          yaw: 22,
          tooltip: "Geomorfologia: O Canal do Estreito e as Baías de Florianópolis",
          title: "Hidrodinâmica das Baías Norte e Sul",
          subtitleLead: "Por que a distância entre a Ilha e o Continente é de apenas 500 metros neste ponto, mas a profundidade do canal ultrapassa 28 metros?",
          paragraphs: [
            "O Canal do Estreito funciona como um 'gargalo' hidráulico entre a Baía Norte e a Baía Sul. Durante as marés enchentes e vazantes, o grande volume de água deslocado entre as duas baías é forçado a passar por essa seção estreita de rocha cristalina.",
            "Essa aceleração das correntes marinhas impede a deposição de areia e lama no fundo do canal, mantendo um sulco profundo de erosão natural (canal de maré) que separou definitivamente o centro urbano insular do bairro continental do Estreito."
          ],
          didYouKnow: "Nas margens protegidas das Baías Norte e Sul desenvolvem-se importantes manguezais (como o Manguezal do Itacorubi e de Ratones), os mais austrais da costa leste sul-americana!",
          image: "assets/fotos/hercilio_luz.jpg",
          imageAnnotations: [
            { label: "Vão Central Pênsil (339m)", x: 48, y: 32, arrowDir: "down" },
            { label: "Canal de Maré Profundo (Estreito)", x: 50, y: 74, arrowDir: "down" },
            { label: "Promontório Cristalino Insular", x: 82, y: 52, arrowDir: "down" }
          ]
        },
        {
          id: "hs_ponte_to_lagoa",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: 112,
          targetSceneId: "florianopolis_lagoa",
          tooltip: "Ir para Foto 360°: Lagoa da Conceição e Dunas da Joaquina",
          transitionLabel: "Sobrevoando o Morro da Cruz até a Lagoa da Conceição..."
        },
        {
          id: "hs_ponte_to_bc",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 0,
          yaw: -72,
          targetSceneId: "balneario_camboriu",
          tooltip: "Ir para Foto 360°: Balneário Camboriú e Litoral Norte (80 km ao Norte)",
          transitionLabel: "Viajando pela BR-101 Norte até Balneário Camboriú..."
        },
        {
          id: "hs_ponte_to_serra",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 8,
          yaw: -150,
          targetSceneId: "serra_rio_do_rastro",
          tooltip: "Ir para Foto 360°: Serra do Rio do Rastro (Planalto Serrano)",
          transitionLabel: "Subindo a Serra Catarinense até o Rio do Rastro..."
        }
      ]
    },

    // =========================================================================
    // CENA 3: SERRA DO RIO DO RASTRO — BOM JARDIM DA SERRA / LAURO MÜLLER
    // =========================================================================
    serra_rio_do_rastro: {
      id: "serra_rio_do_rastro",
      order: 3,
      title: "Mirante da Serra do Rio do Rastro (SC-390)",
      shortTitle: "Serra do Rio do Rastro",
      municipality: "Bom Jardim da Serra / Lauro Müller",
      region: "Serra Catarinense",
      altitude: "1.421 m (Mirante da Serra Geral)",
      coordinates: { lat: -28.3995, lng: -49.5467 },
      initialView: { pitch: -16, yaw: 0, hfov: 92 },
      customPanoramaUrl: null,
      proceduralPreset: "serra_rio_do_rastro",
      thumbPhoto: "assets/fotos/rio_do_rastro.jpg",
      ecosystemSummary: "Escarpa da Serra Geral: derrames vulcânicos da Formação Serra Geral sobre os arenitos eólicos do Aquífero Guarani (Formação Botucatu).",

      labels3D: [
        { text: "Rodovia SC-390 (284 Curvas)", pitch: -24, yaw: 4, scale: 1.15, tilt: 24 },
        { text: "Escarpa da Serra Geral (Basaltos)", pitch: -6, yaw: -42, scale: 1.05, tilt: 10 },
        { text: "Vale do Rio do Rastro (Lauro Müller)", pitch: -20, yaw: 48, scale: 0.95, tilt: 20 },
        { text: "Planalto dos Campos de Cima da Serra", pitch: 4, yaw: 175, scale: 1.0, tilt: -4 }
      ],

      hotspots: [
        {
          id: "hs_rastro_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -14,
          yaw: -12,
          tooltip: "Modelo 3D: Topografia da Serra do Rio do Rastro (Sketchfab)",
          title: "Escarpa da Serra Geral e Serra do Rio do Rastro",
          subtitleLead: "Você sabia que os paredões da Serra do Rio do Rastro registram um dos maiores eventos de vulcanismo continental da história do planeta Terra?",
          paragraphs: [
            "Há cerca de 133 milhões de anos (período Cretáceo), antes da abertura completa do Oceano Atlântico Sul, imensas fissuras na crosta terrestre expeliram sucessivos derrames de lava basáltica e riodacítica que cobriram um antigo deserto de dunas (Formação Botucatu).",
            "No modelo 3D interativo ao lado, é possível girar o bloco topográfico de Bom Jardim da Serra e observar o desnível abrupto de mais de 1.000 metros entre o Planalto Serrano e a depressão carbonífera de Lauro Müller."
          ],
          didYouKnow: "Ao descer a SC-390 pelas suas 284 curvas, você realiza uma verdadeira viagem no tempo geológico: começa no topo em rochas vulcânicas de 133 milhões de anos e chega à base em rochas sedimentares glaciais de 290 milhões de anos!",
          sketchfabUid: "9f9047dfb6194a01a64ec3124189480d",
          embedUrl: "https://sketchfab.com/models/9f9047dfb6194a01a64ec3124189480d/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/bom-jardim-da-serra-9f9047dfb6194a01a64ec3124189480d",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "canyon_scarp"
        },
        {
          id: "hs_rastro_curvas_info",
          type: "info",
          category: "turismo",
          iconStyle: "red-circle",
          pitch: -22,
          yaw: 12,
          tooltip: "Engenharia & Geoturismo: As 284 Curvas e a Coluna White",
          title: "Coluna White e a Estrada Monumental SC-390",
          subtitleLead: "Além de eleita uma das estradas mais espetaculares do mundo, a rodovia da Serra do Rio do Rastro é um museu geológico a céu aberto conhecido mundialmente como 'Coluna White'.",
          paragraphs: [
            "Em 1908, o geólogo norte-americano Israel Charles White estudou os afloramentos ao longo deste caminho para descrever a estratigrafia da Bacia do Paraná — onde encontrou os fósseis do réptil Mesosaurus brasiliensis, uma das provas fundamentais da Teoria da Deriva Continental de Alfred Wegener!",
            "Para vencer os trechos mais íngremes da escarpa, o pavimento da SC-390 foi construído em concreto armado com iluminação noturna e mirantes suspensos a 1.421 metros de altitude."
          ],
          didYouKnow: "Antigamente usada por tropeiros que subiam a serra conduzindo mulas entre o litoral de Laguna e os campos de Lages, a rota possui 18 pontos sinalizados que contam 300 milhões de anos da história da Terra!",
          image: "assets/fotos/rio_do_rastro.jpg",
          imageAnnotations: [
            { label: "Derrames Basálticos (Formação Serra Geral)", x: 25, y: 20, arrowDir: "down" },
            { label: "Traçado em 'Ziguezague' (SC-390)", x: 56, y: 58, arrowDir: "down" },
            { label: "Contato com Arenitos da Formação Botucatu", x: 75, y: 74, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rastro_relevo_sc_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "white-circle",
          pitch: 2,
          yaw: -55,
          tooltip: "Modelo 3D Geral: Relevo Completo do Estado de Santa Catarina (20x)",
          title: "Visão 3D do Relevo de Santa Catarina",
          subtitleLead: "Compreenda como a Serra Geral divide Santa Catarina entre a vertente Atlântica (leste) e a Bacia Hidrográfica do Rio Uruguai (oeste).",
          paragraphs: [
            "Este modelo digital de elevação produzido pelo IFSC mostra todo o território catarinense em 3D. Note como a borda leste do planalto (onde ficam a Serra do Rio do Rastro e Urubici) atinge as maiores altitudes do estado.",
            "A partir dessa crista elevada, o relevo inclina-se suavemente em direção ao Oeste Catarinense (Chapecó e São Miguel do Oeste), esculpido pelos vales encaixados dos rios Pelotas, Canoas e Uruguai."
          ],
          didYouKnow: "Mais de 70% do território de Santa Catarina encontra-se acima de 300 metros de altitude, fazendo do estado um dos relevos mais acidentados e diversos do Brasil.",
          sketchfabUid: "583daa590b5d48dbb3bf04764ca7a488",
          embedUrl: "https://sketchfab.com/models/583daa590b5d48dbb3bf04764ca7a488/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/relevo-de-santa-catarina-exagero-vertical-20x-583daa590b5d48dbb3bf04764ca7a488",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "sc_state"
        },
        {
          id: "hs_rastro_to_urubici",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 3,
          yaw: -95,
          targetSceneId: "urubici_morro_igreja",
          tooltip: "Ir para Foto 360°: Morro da Igreja e Pedra Furada em Urubici (35 km ao Norte)",
          transitionLabel: "Voando pela borda da Serra Geral até o Morro da Igreja (Urubici)..."
        },
        {
          id: "hs_rastro_to_itaimbezinho",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -4,
          yaw: 110,
          targetSceneId: "canion_itaimbezinho",
          tooltip: "Ir para Foto 360°: Cânion do Itaimbezinho — Geoparque UNESCO (Sul)",
          transitionLabel: "Seguindo pelos Aparados da Serra até o Cânion Itaimbezinho..."
        }
      ]
    },

    // =========================================================================
    // CENA 4: URUBICI — MORRO DA IGREJA (1.822m) & PEDRA FURADA
    // =========================================================================
    urubici_morro_igreja: {
      id: "urubici_morro_igreja",
      order: 4,
      title: "Morro da Igreja (1.822 m) & Pedra Furada",
      shortTitle: "Morro da Igreja",
      municipality: "Urubici / Orleans / Bom Jardim da Serra",
      region: "Serra Catarinense (Parque Nacional de São Joaquim)",
      altitude: "1.822 m (Ponto Habitado Mais Alto do Sul do Brasil)",
      coordinates: { lat: -28.1272, lng: -49.4794 },
      initialView: { pitch: -6, yaw: 15, hfov: 90 },
      customPanoramaUrl: null,
      proceduralPreset: "urubici_morro_igreja",
      thumbPhoto: "assets/fotos/morro_igreja.jpg",
      ecosystemSummary: "Campos de Altitude, Matas Nebulares de Araucária e janela de erosão diferencial em derrames basálticos.",

      labels3D: [
        { text: "Monumento Natural da Pedra Furada", pitch: -10, yaw: 24, scale: 1.2, tilt: 12 },
        { text: "Topo do Morro da Igreja (1.822m)", pitch: 6, yaw: -45, scale: 1.05, tilt: -5 },
        { text: "Vale do Rio Pelotas & Corvo Branco", pitch: -16, yaw: -115, scale: 0.95, tilt: 18 },
        { text: "Parque Nacional de São Joaquim", pitch: -8, yaw: 92, scale: 1.0, tilt: 10 }
      ],

      hotspots: [
        {
          id: "hs_urubici_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -8,
          yaw: 22,
          tooltip: "Modelo 3D de Alta Resolução: Morro da Igreja e Escarpa (Geodinâmica)",
          title: "Morro da Igreja e Pedra Furada em 3D",
          subtitleLead: "Com 1.822 metros de altitude, o Morro da Igreja detém o recorde oficial da menor temperatura já registrada no Brasil (-17,8 °C em junho de 1996)!",
          paragraphs: [
            "Localizado no coração do Parque Nacional de São Joaquim, o Morro da Igreja oferece uma visão privilegiada da linha de escarpa da Serra Geral e do famoso monumento natural da Pedra Furada.",
            "Explore o modelo fotogramétrico 3D ao lado para visualizar a geometria das camadas de rocha vulcânica horizontalmente empilhadas (patamares estruturais) que sustentam o topo da montanha."
          ],
          didYouKnow: "Em dias de atmosfera muito limpa no inverno, a partir do mirante do Morro da Igreja é possível avistar a olho nu a linha do Oceano Atlântico no litoral sul catarinense, a mais de 100 km de distância!",
          sketchfabUid: "c13b4652dccc45bc980a56f2e4c510b4",
          embedUrl: "https://sketchfab.com/models/c13b4652dccc45bc980a56f2e4c510b4/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/modelo-3d-morro-da-igreja-alta-resolucao-c13b4652dccc45bc980a56f2e4c510b4",
          author3D: "GEODINÂMICA - Geologia e Soluções Ambientais (Sketchfab)",
          fallback3DType: "pedra_furada"
        },
        {
          id: "hs_urubici_pedra_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -12,
          yaw: 38,
          tooltip: "Geomorfologia: Como surgiu a janela da Pedra Furada?",
          title: "A Origem Geológica da Pedra Furada",
          subtitleLead: "A Pedra Furada é uma impressionante escultura natural com uma abertura de 30 metros de circunferência esculpida na borda de um derrame vulcânico.",
          paragraphs: [
            "Sua formação deve-se ao processo de erosão diferencial. Quando os derrames de lava se resfriaram há 133 milhões de anos, o topo e a base de cada derrame acumularam muitas bolhas de gás (vesículas), tornando a rocha mais porosa e frágil do que o núcleo maciço do derrame superior.",
            "Ao longo de milhões de anos, a ação combinada da água da chuva, do vento forte, do congelamento/degelo (crioclastia no inverno) e das fraturas verticais removeu a zona mais frágil no interior do paredão, deixando o teto de rocha maciça em forma de ponte natural!"
          ],
          didYouKnow: "No solstício de inverno, o sol nasce exatamente alinhado através do furo da Pedra Furada quando observado a partir de pontos específicos da trilha do Morro da Igreja.",
          image: "assets/fotos/morro_igreja.jpg",
          imageAnnotations: [
            { label: "Teto de Basalto Maciço (Topo do Derrame)", x: 64, y: 28, arrowDir: "down" },
            { label: "Janela Erosiva da Pedra Furada (30m)", x: 66, y: 48, arrowDir: "down" },
            { label: "Matas Nebulares & Campos de Altitude", x: 32, y: 68, arrowDir: "down" }
          ]
        },
        {
          id: "hs_urubici_corvo_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "white-circle",
          pitch: -14,
          yaw: -110,
          tooltip: "Modelo 3D: Aerolevantamento Altos do Corvo Branco — Urubici",
          title: "Serra do Corvo Branco e Cânion do Espraiado",
          subtitleLead: "Nos arredores de Urubici encontra-se a Serra do Corvo Branco, famosa pela maior fenda em rocha arenítica aberta em estrada no Brasil (90 metros de altura).",
          paragraphs: [
            "Enquanto o topo da serra é formado por rochas vulcânicas escuras, na passagem da Serra do Corvo Branco afloram os paredões claros dos arenitos eólicos da Formação Botucatu — parte integrante do gigantesco Sistema Aquífero Guarani.",
            "Gire o modelo de aerolevantamento 3D ao lado para observar as feições de relevo escarpado de Urubici."
          ],
          didYouKnow: "Urubici também abriga paleotocas (túneis escavados por preguiças-gigantes pré-históricas extintas há 10 mil anos) e inscrições rupestres na Caverna Rio dos Bugres!",
          sketchfabUid: "b031633efb2e4e3aad42905021479c00",
          embedUrl: "https://sketchfab.com/models/b031633efb2e4e3aad42905021479c00/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/aerolevantamento-altos-corvo-branco-urubici-b031633efb2e4e3aad42905021479c00",
          author3D: "Prisma Engenharia (Sketchfab)",
          fallback3DType: "canyon_scarp"
        },
        {
          id: "hs_urubici_to_rastro",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -4,
          yaw: 155,
          targetSceneId: "serra_rio_do_rastro",
          tooltip: "Ir para Foto 360°: Mirante da Serra do Rio do Rastro",
          transitionLabel: "Voando para a Serra do Rio do Rastro..."
        },
        {
          id: "hs_urubici_to_fln",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: 75,
          targetSceneId: "florianopolis_lagoa",
          tooltip: "Ir para Foto 360°: Florianópolis — Lagoa da Conceição",
          transitionLabel: "Descendo a serra em direção a Florianópolis..."
        }
      ]
    },

    // =========================================================================
    // CENA 5: CÂNION DO ITAIMBEZINHO — GEOPARQUE CAMINHOS DOS CÂNIONS DO SUL
    // =========================================================================
    canion_itaimbezinho: {
      id: "canion_itaimbezinho",
      order: 5,
      title: "Cânion do Itaimbezinho — Geoparque UNESCO",
      shortTitle: "Cânion Itaimbezinho",
      municipality: "Praia Grande (SC) / Cambará do Sul (RS)",
      region: "Extremo Sul Catarinense — Geoparque Caminhos dos Cânions do Sul",
      altitude: "980 m (Borda Superior do Cânion / Trilha do Vértice)",
      coordinates: { lat: -29.1578, lng: -50.0792 },
      initialView: { pitch: -18, yaw: 0, hfov: 90 },
      customPanoramaUrl: null,
      proceduralPreset: "canion_itaimbezinho",
      thumbPhoto: "assets/fotos/itaimbezinho.jpg",
      ecosystemSummary: "Geoparque Mundial da UNESCO: cânion tectono-erosivo com paredões verticais de até 720m de profundidade.",

      labels3D: [
        { text: "Fenda Principal do Itaimbezinho (720m prof.)", pitch: -24, yaw: 0, scale: 1.2, tilt: 22 },
        { text: "Cachoeira das Andorinhas", pitch: -14, yaw: -38, scale: 1.0, tilt: 14 },
        { text: "Cascata Véu de Noiva", pitch: -16, yaw: 44, scale: 1.0, tilt: 16 },
        { text: "Trilha do Rio do Boi (Fundo do Cânion)", pitch: -34, yaw: 8, scale: 0.95, tilt: 30 },
        { text: "Planície Costeira de Praia Grande (SC)", pitch: -4, yaw: 118, scale: 0.95, tilt: 6 }
      ],

      hotspots: [
        {
          id: "hs_itaimbe_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -18,
          yaw: -4,
          tooltip: "Modelo 3D: Cânion do Itaimbezinho (BRGeo / IFSC)",
          title: "Cânion do Itaimbezinho em 3D",
          subtitleLead: "Reconhecido como parte do Geoparque Mundial da UNESCO Caminhos dos Cânions do Sul, o Itaimbezinho possui 5,8 km de extensão e paredões verticais de até 720 metros!",
          paragraphs: [
            "Na língua Tupi-Guarani, 'Itaimbezinho' deriva de Ita (pedra) + Aimbé (afiada/cortante). Essa fenda colossal não surgiu por acaso: os rios Perdizes e Preá aproveitaram antigas falhas e fraturas tectônicas nas rochas vulcânicas ácidas (Formação Palmas) e básicas (Formação Gramado) para entalhar profundamente a borda do planalto.",
            "Interaja com o modelo 3D ao lado para visualizar o formato em 'V' fechado da garganta do cânion e a transição abrupta entre o planalto e o vale do Rio do Boi, no município catarinense de Praia Grande."
          ],
          didYouKnow: "Enquanto o topo do cânion fica na divisa com o Rio Grande do Sul (Trilha do Vértice e do Cotovelo), o interior e a base do cânion (Trilha do Rio do Boi) são acessados pelo município de Praia Grande, em Santa Catarina, capital brasileira dos cânions e do balonismo!",
          sketchfabUid: "3c0f25bc147847ef81efdecd9adfc9d2",
          embedUrl: "https://sketchfab.com/models/3c0f25bc147847ef81efdecd9adfc9d2/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/canion-do-itaimbezinho-3c0f25bc147847ef81efdecd9adfc9d2",
          author3D: "BRGeo.org (Sketchfab)",
          fallback3DType: "canyon_slot"
        },
        {
          id: "hs_itaimbe_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -12,
          yaw: 36,
          tooltip: "Geodiversidade: Fraturas Tectônicas, Cachoeiras e Neblina (Viração)",
          title: "Paredões Vulcânicos e o Fenômeno da 'Viração'",
          subtitleLead: "Nos paredões verticais do Itaimbezinho, a disjunção colunar e o diaclasamento da rocha vulcânica criam degraus perfeitos onde a Araucária parece desafiar a gravidade.",
          paragraphs: [
            "As duas grandes quedas d'água do cânion — a Cachoeira das Andorinhas (300 m) e a Cascata Véu de Noiva (500 m) — precipitam-se diretamente da borda do planalto para o interior do abismo, alimentando o Rio do Boi lá no fundo.",
            "Um fenômeno microclimático marcante da região é a 'viração': quando o ar quente e úmido vindo do Oceano Atlântico (em Praia Grande/Torres) encontra os paredões frios de 1.000 metros de altitude, condensa-se em minutos, preenchendo o cânion com um mar de nuvens."
          ],
          didYouKnow: "O Geoparque Caminhos dos Cânions do Sul abrange quatro municípios catarinenses (Praia Grande, Jacinto Machado, Timbé do Sul e Morro Grande) e abriga mais de 30 cânions monumentais, como o Malacara, Índios Coroados e Fortaleza!",
          image: "assets/fotos/itaimbezinho.jpg",
          imageAnnotations: [
            { label: "Borda do Planalto (Mata com Araucárias)", x: 22, y: 24, arrowDir: "down" },
            { label: "Paredão Vertical de Riodacito (720m)", x: 68, y: 40, arrowDir: "down" },
            { label: "Fenda Tectônica & Fenômeno da Viração", x: 48, y: 72, arrowDir: "down" }
          ]
        },
        {
          id: "hs_itaimbe_to_rastro",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: -70,
          targetSceneId: "serra_rio_do_rastro",
          tooltip: "Ir para Foto 360°: Serra do Rio do Rastro (Norte da Serra Geral)",
          transitionLabel: "Subindo a escarpa rumo à Serra do Rio do Rastro..."
        },
        {
          id: "hs_itaimbe_to_garopaba",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -2,
          yaw: 115,
          targetSceneId: "garopaba_baleia_franca",
          tooltip: "Ir para Foto 360°: Garopaba e Litoral Sul Catarinense",
          transitionLabel: "Voando para a costa de Garopaba..."
        }
      ]
    },

    // =========================================================================
    // CENA 6: GAROPABA & IMBITUBA — COSTA DAS BALEIAS FRANCAS & DUNAS DO SIRIÚ
    // =========================================================================
    garopaba_baleia_franca: {
      id: "garopaba_baleia_franca",
      order: 6,
      title: "Garopaba, Dunas do Siriú & APA da Baleia Franca",
      shortTitle: "Garopaba & Siriú",
      municipality: "Garopaba / Imbituba",
      region: "Litoral Sul Catarinense (APA da Baleia Franca)",
      altitude: "180 m (Mirante do Morro da Silveira / Vigia)",
      coordinates: { lat: -28.0264, lng: -48.6128 },
      initialView: { pitch: -10, yaw: 0, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "garopaba_baleia_franca",
      thumbPhoto: "assets/fotos/garopaba.jpg",
      ecosystemSummary: "Enseadas em espiral logarítmica (zeta-bays), berçário reprodutivo da Baleia-franca-austral e campos de dunas do Siriú.",

      labels3D: [
        { text: "Enseada de Garopaba (APA da Baleia Franca)", pitch: -14, yaw: 5, scale: 1.15, tilt: 16 },
        { text: "Promontório Cristalino do Morro da Vigia", pitch: -8, yaw: 52, scale: 1.0, tilt: 10 },
        { text: "Campo de Dunas e Lagoa do Siriú", pitch: -10, yaw: -58, scale: 1.05, tilt: 14 },
        { text: "Praia da Ferrugem & Rosa (Sul)", pitch: -6, yaw: 118, scale: 0.95, tilt: 8 }
      ],

      hotspots: [
        {
          id: "hs_garopaba_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -12,
          yaw: 8,
          tooltip: "Modelo 3D: Maquete Topográfica de Garopaba (IFSC Garopaba)",
          title: "Geomorfologia Costeira de Garopaba em 3D",
          subtitleLead: "Por que as praias de Garopaba, Ferrugem e Praia do Rosa têm o formato perfeito de meia-lua que atrai TANTO os surfistas quanto as Baleias-Francas?",
          paragraphs: [
            "As praias deste trecho do litoral catarinense são exemplos clássicos do que a oceanografia geológica chama de 'praias de enseada em espiral' (headland-bay beaches). Promontórios rochosos de granito avançam mar adentro no lado sul de cada praia, funcionando como quebra-mares naturais contra as grandes ondulações de Sul/Sudeste.",
            "Na sombra hidrodinâmica atrás de cada costão rochoso (como na Enseada de Garopaba e na Ribanceira), formam-se águas calmas e protegidas — o refúgio ideal escolhido pelas fêmeas de Baleia-franca-austral (Eubalaena australis) entre julho e novembro para dar à luz e amamentar seus filhotes!"
          ],
          didYouKnow: "Explore no modelo 3D produzido pelo IFSC - Câmpus Garopaba os maciços costeiros que separam as bacias hidrográficas e as lagoas costeiras de Garopaba, Macacu e Siriú!",
          sketchfabUid: "2543b131db154a0cac1b186ec4ef5f22",
          embedUrl: "https://sketchfab.com/models/2543b131db154a0cac1b186ec4ef5f22/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/garopaba-santa-catarina-brasil-maquete-em-3d-2543b131db154a0cac1b186ec4ef5f22",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "island_lagoon"
        },
        {
          id: "hs_garopaba_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -10,
          yaw: -52,
          tooltip: "Geodiversidade & Arqueologia: Dunas do Siriú e Sambaquis",
          title: "Dunas do Siriú, Costões e Sambaquis",
          subtitleLead: "O litoral entre Garopaba, Imbituba e Laguna concentra os maiores sambaquis (montes de conchas pré-históricos) do planeta Terra!",
          paragraphs: [
            "Com dunas que chegam a 40 metros de altura às margens da Lagoa e do Rio Siriú, esta paisagem guarda testemunhos preciosos das flutuações do nível do mar nos últimos 6.000 anos.",
            "Quando o mar esteve até 3 metros acima do nível atual (Transgressão Holocênica), grandes lagunas ricas em moluscos e peixes permitiram que populações indígenas sambaquieiras erguessem monumentos funerários e habitacionais de conchas que chegam a 30 metros de altura (como o Sambaqui de Garopaba do Sul)."
          ],
          didYouKnow: "Nos costões rochosos de Garopaba também podem ser vistos 'diques de diabásio' — faixas de rocha vulcânica preta que cortam o granito rosado como verdadeiras cicatrizes da separação entre a América do Sul e a África!",
          image: "assets/fotos/garopaba.jpg",
          imageAnnotations: [
            { label: "Costão Granítico (Quebra-mar Natural)", x: 74, y: 36, arrowDir: "down" },
            { label: "Zona de Abrigo da Baleia-Franca", x: 46, y: 58, arrowDir: "down" },
            { label: "Planície Costeira & Centro Histórico", x: 24, y: 68, arrowDir: "down" }
          ]
        },
        {
          id: "hs_garopaba_to_fln",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: -85,
          targetSceneId: "florianopolis_lagoa",
          tooltip: "Ir para Foto 360°: Florianópolis — Lagoa da Conceição (Norte)",
          transitionLabel: "Subindo pelo litoral até a Ilha de Santa Catarina..."
        },
        {
          id: "hs_garopaba_to_canion",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: 155,
          targetSceneId: "canion_itaimbezinho",
          tooltip: "Ir para Foto 360°: Cânion do Itaimbezinho (Extremo Sul)",
          transitionLabel: "Viajando para os Cânions do Sul..."
        }
      ]
    },

    // =========================================================================
    // CENA 7: BALNEÁRIO CAMBORIÚ & VALE DO ITAJAÍ — PONTAL NORTE & UNIPRAIAS
    // =========================================================================
    balneario_camboriu: {
      id: "balneario_camboriu",
      order: 7,
      title: "Enseada de Balneário Camboriú & Parque Unipraias",
      shortTitle: "Balneário Camboriú",
      municipality: "Balneário Camboriú / Vale do Itajaí",
      region: "Litoral Centro-Norte / Costa Verde & Mar",
      altitude: "240 m (Mirante do Morro da Aguada / Pontal Norte)",
      coordinates: { lat: -26.9926, lng: -48.6348 },
      initialView: { pitch: -12, yaw: 0, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "balneario_camboriu",
      thumbPhoto: "assets/fotos/balneario_camboriu.jpg",
      ecosystemSummary: "Enseada costeira urbanizada, dinâmica sedimentar de engordamento de praia e remanescentes de Mata Atlântica no Morro da Aguada.",

      labels3D: [
        { text: "Orla Central & Enseada de Camboriú", pitch: -16, yaw: 0, scale: 1.15, tilt: 18 },
        { text: "Ilha das Cabras", pitch: -12, yaw: -28, scale: 1.0, tilt: 14 },
        { text: "Morro da Aguada (Parque Unipraias)", pitch: 4, yaw: 62, scale: 1.05, tilt: -4 },
        { text: "Foz do Rio Camboriú & Barra Sul", pitch: -18, yaw: 42, scale: 0.95, tilt: 18 },
        { text: "Pontal Norte & Roda-Gigante", pitch: -10, yaw: -56, scale: 0.95, tilt: 12 }
      ],

      hotspots: [
        {
          id: "hs_bc_orla_info",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -16,
          yaw: 6,
          tooltip: "Dinâmica Costeira: A Enseada de Camboriú e a Alimentação Artificial da Praia",
          title: "Geomorfologia Costeira e Engordamento da Faixa de Areia",
          subtitleLead: "A Praia Central de Balneário Camboriú é um laboratório vivo de engenharia costeira, hidrodinâmica de enseadas e interação entre urbanização vertical e processos marinhos.",
          paragraphs: [
            "Delimitada por dois promontórios rochosos cristalinos — o Pontal Norte (Morro do Careca) e a Barra Sul (Morro da Aguada) — a Enseada de Camboriú possui um arco praial de 6,8 km onde as ondas sofrem difração ao contornar os costões e a Ilha das Cabras.",
            "Em 2021, a praia passou por uma das maiores obras de recuperação costeira (engordamento hidráulico) da América Latina: mais de 2,2 milhões de metros cúbicos de areia de jazida marinha (a 15 km da costa) foram dragados para triplicar a largura da faixa de areia de 25 m para cerca de 70 m, amortecendo a energia das ressacas marinhas."
          ],
          didYouKnow: "As rochas metamórficas e graníticas que cercam Balneário Camboriú e o Vale do Itajaí pertencem ao Complexo Brusque e ao Cráton Luís Alves, que contém algumas das rochas mais antigas do Sul do Brasil (mais de 2 bilhões de anos)!",
          image: "assets/fotos/balneario_camboriu.jpg",
          imageAnnotations: [
            { label: "Arco Praial de 6,8 km (Faixa de Areia Ampliada)", x: 48, y: 58, arrowDir: "down" },
            { label: "Ilha das Cabras (Difração de Ondas)", x: 35, y: 36, arrowDir: "down" },
            { label: "Promontório do Pontal Norte / Morro do Careca", x: 76, y: 24, arrowDir: "down" }
          ]
        },
        {
          id: "hs_bc_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -10,
          yaw: -24,
          tooltip: "Modelo 3D: Relevo do Estado de Santa Catarina e Vale do Itajaí (IFSC)",
          title: "Do Litoral Norte ao Vale Europeu em 3D",
          subtitleLead: "Logo atrás dos morros litorâneos de Balneário Camboriú e Itajaí estende-se a Bacia Hidrográfica do Rio Itajaí-Açu, onde se localizam Blumenau, Pomerode e Brusque.",
          paragraphs: [
            "Observe no modelo tridimensional de Santa Catarina como o Vale do Itajaí forma um amplo anfiteatro natural escavado pela rede hidrográfica do Rio Itajaí-Açu entre a Serra do Mar ao norte e as serras do Leste Catarinense.",
            "Enquanto a faixa costeira de Balneário Camboriú, Bombinhas e Penha destaca-se pelo turismo balneário e costões rochosos, o interior do vale preserva a arquitetura enxaimel e o patrimônio geológico paleozoico e pré-cambriano."
          ],
          didYouKnow: "A Península de Bombinhas, vizinha ao sul de Balneário Camboriú, possui 39 praias em apenas 35 km² — a maior diversidade de praias por quilômetro quadrado do litoral brasileiro!",
          sketchfabUid: "24bae8a09c8d41f7b098fd98ac7e9b7e",
          embedUrl: "https://sketchfab.com/models/24bae8a09c8d41f7b098fd98ac7e9b7e/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/relevo-do-estado-de-santa-catarina-em-3d-24bae8a09c8d41f7b098fd98ac7e9b7e",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "sc_state"
        },
        {
          id: "hs_bc_unipraias_info",
          type: "info",
          category: "turismo",
          iconStyle: "white-circle",
          pitch: 2,
          yaw: 58,
          tooltip: "Conservação & Ecoturismo: Morro da Aguada e Praia de Laranjeiras",
          title: "Mata Atlântica Costeira e Enseada de Laranjeiras",
          subtitleLead: "Contrastando com a verticalização urbana, o maciço do Morro da Aguada preserva um importante corredor ecológico de Floresta Ombrófila Densa.",
          paragraphs: [
            "No outro lado do Morro da Aguada esconde-se a enseada de Laranjeiras, uma baía abrigada de águas calmas onde foi encontrado um importante sítio arqueológico sambaquieiro com cerca de 3.000 anos de idade.",
            "A cobertura florestal dos morros costeiros desempenha papel vital na estabilidade das encostas graníticas e na retenção das chuvas orográficas que atingem o litoral norte catarinense."
          ],
          didYouKnow: "O teleférico do Parque Unipraias é o único do mundo que interliga duas praias (Barra Sul e Laranjeiras) passando pelo topo de um morro de Mata Atlântica a 240 metros de altitude!",
          image: "assets/fotos/blumenau.jpg",
          imageAnnotations: [
            { label: "Dossel da Floresta Ombrófila Densa (Mata Atlântica)", x: 35, y: 28, arrowDir: "down" },
            { label: "Integração Litoral – Vale do Itajaí", x: 65, y: 62, arrowDir: "down" }
          ]
        },
        {
          id: "hs_bc_to_ponte",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -2,
          yaw: 135,
          targetSceneId: "florianopolis_ponte",
          tooltip: "Ir para Foto 360°: Florianópolis — Ponte Hercílio Luz (80 km ao Sul)",
          transitionLabel: "Voando pelo litoral sul até Florianópolis..."
        },
        {
          id: "hs_bc_to_urubici",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 6,
          yaw: -135,
          targetSceneId: "urubici_morro_igreja",
          tooltip: "Ir para Foto 360°: Morro da Igreja e Pedra Furada em Urubici",
          transitionLabel: "Rumo ao topo da Serra Catarinense em Urubici..."
        }
      ]
    }
  }
};

// ============================================================================
// BANCO DE DADOS DO TOUR 360° — TIMBÉ DO SUL (SC)
// Pontos aéreos 360° reais: Poço do Violão (Rio Rocinha) e Cachoeira da Cortina
// Integrado às Rotas dos 15 Municípios (js/canions-rotas-data.js)
// ============================================================================

window.TOUR_SC_DATA = {
  tourTitle: "Timbé do Sul 360° — Poço do Violão & Cachoeira da Cortina",
  tourShortName: "Timbé do Sul 360°",
  tourSubtitle: "Geoturismo Interativo · Caminho dos Cânions & Geoparque UNESCO",
  hasGLB: false,
  defaultScene: "poco_violao",
  categories: [
    { id: "all", label: "Todos" },
    { id: "geologia", label: "Geologia & Relevo" },
    { id: "natureza", label: "Águas & Cânions" },
    { id: "navegacao", label: "Viajar 360°" }
  ],
  scenes: {
    poco_violao: {
      id: "poco_violao",
      order: 1,
      title: "Poço do Violão — Timbé do Sul",
      shortTitle: "Poço do Violão",
      travelLabel: "Voando para o Poço do Violão (Timbé do Sul)...",
      municipality: "Timbé do Sul (SC)",
      region: "Caminho dos Cânions · Geoparque UNESCO",
      altitude: "Aprox. 65 m (Rio Rocinha)",
      coordinates: { lat: -28.8763335, lng: -49.8943515 },
      headingOffsetDeg: 350,
      address: "Estrada Geral da Rocinha • Timbé do Sul - SC",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-28.8763335,-49.8943515",
      googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-28.8763335,-49.8943515",
      initialView: { pitch: -16, yaw: 6, hfov: 100 },
      customPanoramaUrl: "assets/panoramas/timbe360/poco_violao.jpg",
      thumbPhoto: "assets/panoramas/timbe360/thumb_poco_violao.jpg",
      staticPhoto: "assets/fotos/timbe/static_poco_violao.jpg",
      placeMenuTitle: "1. Poço do Violão",
      placeMenuDesc: "Rio Rocinha & Garganta da Serra",
      showInPlaceMenu: true,
      ecosystemSummary:
        "No pé da escarpa da Serra Geral, o Rio Rocinha escava as rochas vulcânicas criando o Poço do Violão e prainhas de seixos rolados em meio à Mata Atlântica.",
      labels3D: [
        { text: "Rio Rocinha", pitch: -22, yaw: 6 },
        { text: "Contrafortes da Serra Geral", pitch: 8, yaw: -118 }
      ],
      hotspots: [
        {
          id: "hs_pv_to_cachoeira",
          type: "scene",
          targetSceneId: "cachoeira_cortina",
          category: "navegacao",
          pitch: 3,
          yaw: 6,
          lookPitch: -24,
          lookYaw: -72,
          iconStyle: "portal-thumb",
          tooltip: "Viajar para Cachoeira da Cortina (52 m)"
        },
        {
          id: "hs_pv_info_poco",
          type: "info",
          category: "natureza",
          pitch: -36,
          yaw: 10,
          iconStyle: "red-circle",
          tooltip: "Poço do Violão & Prainha de Seixos",
          title: "Poço do Violão — Escultura Fluvial no Rio Rocinha",
          subtitleLead:
            "Águas cristalinas encaixadas entre paredão rochoso e banco de seixos rolados na comunidade da Rocinha, em Timbé do Sul.",
          paragraphs: [
            "Ao descer das cabeceiras íngremes da Serra Geral e atingir o sopé da escarpa, o Rio Rocinha perde declividade abruptamente. Esse contraste de energia favorece a deposição de seixos basálticos arredondados na margem interna enquanto a correnteza escava o paredão rochoso, moldando um remanso fundo em forma de violão.",
            "Cercado por encostas preservadas de Mata Atlântica e propriedades rurais tradicionais da comunidade da Rocinha, o atrativo combina geodiversidade fluvial e lazer ecológico."
          ],
          didYouKnow:
            "O contorno em forma de violão fica ainda mais evidente em perspectiva aérea 360° sobre a ilha de pedra e a prainha de cascalho logo abaixo do drone!",
          image: "assets/fotos/timbe/static_poco_violao.jpg",
          imageCaption: "Vista aérea do Poço do Violão no curso do Rio Rocinha, Timbé do Sul - SC.",
          externalLink: "https://www.google.com/maps/search/?api=1&query=-28.8763335,-49.8943515",
          externalLinkLabel: "🗺️ Ver Poço do Violão no Google Maps ↗"
        },
        {
          id: "hs_pv_info_vale",
          type: "info",
          category: "geologia",
          pitch: -5,
          yaw: -135,
          iconStyle: "white-circle",
          tooltip: "Vale da Rocinha & Geoparque UNESCO",
          title: "Timbé do Sul no Geoparque Caminhos dos Cânions do Sul",
          subtitleLead:
            "Transição entre a planície agrícola da Rocinha e os grandiosos paredões da Serra Geral no extremo sul catarinense.",
          paragraphs: [
            "Timbé do Sul integra o Geoparque Mundial da UNESCO Caminhos dos Cânions do Sul, território reconhecido internacionalmente pelo patrimônio geológico, ecológico e cultural.",
            "O vale da Rocinha combina propriedades rurais familiares, lavouras de várzea e acesso a rotas históricas serranas rumo aos paredões basálticos de até 1.000 metros da Serra Geral."
          ],
          didYouKnow:
            "Seguindo vale acima pelo cânion florestado à sua frente (use o portal circular 360°), o voo leva diretamente até a Cachoeira da Cortina, um salto de 52 metros!",
          image: "assets/fotos/timbe/vale_rocinha_timbe.jpg",
          imageCaption: "Vale rural da Rocinha e encostas da Serra Geral em Timbé do Sul - SC.",
          externalLink: "https://www.google.com/maps/dir/?api=1&destination=-28.8763335,-49.8943515",
          externalLinkLabel: "🚗 Traçar rota até o Poço do Violão ↗"
        }
      ]
    },
    cachoeira_cortina: {
      id: "cachoeira_cortina",
      order: 2,
      title: "Cachoeira da Cortina — Timbé do Sul",
      shortTitle: "Cachoeira da Cortina",
      travelLabel: "Voando para a Cachoeira da Cortina (52 m)...",
      municipality: "Timbé do Sul (SC)",
      region: "Serra Geral • Rocinha / Serra Velha",
      altitude: "Aprox. 290 m (Escarpas da Serra)",
      coordinates: { lat: -28.829348, lng: -49.915734 },
      headingOffsetDeg: 90,
      address: "Localidade Serra Velha (via Bar do Nei) • Timbé do Sul - SC",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-28.829348,-49.915734",
      googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-28.829348,-49.915734",
      initialView: { pitch: -24, yaw: -72, hfov: 98 },
      customPanoramaUrl: "assets/panoramas/timbe360/cachoeira_cortina.jpg",
      thumbPhoto: "assets/panoramas/timbe360/thumb_cachoeira_cortina.jpg",
      staticPhoto: "assets/fotos/timbe/static_cachoeira_cortina.jpg",
      placeMenuTitle: "2. Cachoeira da Cortina",
      placeMenuDesc: "Queda de 52 m & Paredão Basáltico",
      showInPlaceMenu: true,
      ecosystemSummary:
        "Queda d'água de 52 metros que despenca em cortina livre diante de uma gruta escavada nos derrames vulcânicos da Formação Serra Geral.",
      labels3D: [
        { text: "Cachoeira da Cortina (52 m)", pitch: 4, yaw: -72 },
        { text: "Vale Atlântico • Rumo ao Poço do Violão", pitch: 6, yaw: 112 }
      ],
      hotspots: [
        {
          id: "hs_cc_to_violao",
          type: "scene",
          targetSceneId: "poco_violao",
          category: "navegacao",
          pitch: 2,
          yaw: 112,
          lookPitch: -16,
          lookYaw: 6,
          iconStyle: "portal-thumb",
          tooltip: "Voltar para o Poço do Violão (Rio Rocinha)"
        },
        {
          id: "hs_cc_info_queda",
          type: "info",
          category: "natureza",
          pitch: -28,
          yaw: -72,
          iconStyle: "red-circle",
          tooltip: "Cachoeira da Cortina — Salto de 52 m",
          title: "Cachoeira da Cortina — Monumento Natural da Serra Velha",
          subtitleLead:
            "Queda livre de 52 metros que forma uma cortina líquida diante de abrigo natural na encosta de Mata Atlântica.",
          paragraphs: [
            "Cercada por floresta ombrófila densa nas encostas entre Rocinha e Serra Velha, a Cachoeira da Cortina despenca de um degrau rochoso com recuo estrutural na base.",
            "Essa geometria faz com que o véu d'água caia avançado no ar até o poço cristalino, criando uma gruta natural sombreada atrás da queda."
          ],
          didYouKnow:
            "Seu nome deve-se exatamente ao efeito de cortina formado pela queda livre, permitindo admirar a água descendo em véu contínuo sobre a rocha vulcânica!",
          image: "assets/fotos/timbe/static_cachoeira_cortina.jpg",
          imageCaption: "Salto de 52 metros da Cachoeira da Cortina, em Timbé do Sul - SC.",
          externalLink: "https://www.google.com/maps/search/?api=1&query=-28.829348,-49.915734",
          externalLinkLabel: "🗺️ Ver Cachoeira da Cortina no Google Maps ↗"
        },
        {
          id: "hs_cc_info_geologia",
          type: "info",
          category: "geologia",
          pitch: -22,
          yaw: -34,
          iconStyle: "white-circle",
          tooltip: "Paredão Vulcânico da Formação Serra Geral",
          title: "Derrames Basálticos — Formação Serra Geral",
          subtitleLead:
            "Pacotes de rochas vulcânicas empilhadas há cerca de 133 milhões de anos esculpem os saltos e cânions da região.",
          paragraphs: [
            "A parede rochosa exposta ao lado da cachoeira revela o contato entre diferentes derrames de lava da Bacia do Paraná (Formação Serra Geral).",
            "Camadas vesiculares e fraturadas desgastam-se mais rapidamente sob a ação da umidade e da gravidade do que os núcleos basálticos compactos logo acima, formando tetos em balanço e nichos naturais."
          ],
          didYouKnow:
            "Essa mesma arquitetura geológica da escarpa é responsável por alguns dos maiores cânions do Brasil logo ao sul, no Parque Nacional dos Aparados da Serra e da Serra Geral.",
          image: "assets/fotos/timbe/geologia_serra_geral.jpg",
          imageCaption: "Detalhe do paredão vulcânico estratificado junto à Cachoeira da Cortina.",
          externalLink: "https://www.google.com/maps/dir/?api=1&destination=-28.829348,-49.915734",
          externalLinkLabel: "🚗 Traçar rota até a Serra Velha / Cortina ↗"
        }
      ]
    }
  }
};

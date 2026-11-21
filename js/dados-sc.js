/**
 * ============================================================================
 * VALE TOMBADO DO RIO DA LUZ — PASSEIO VIRTUAL COM DRONE 360° REAL
 * Branch: vale-tombado-rio-da-luz
 * Base Georreferenciada e Imagens Drone 360:
 *   - JDS_360_04: Vale Tombado (Foto Principal / Base de Navegação)
 *   - JDS_360_03: Casa do Schroeder Platz
 *   - JDS_360_05: Casa Rux (Patrimônio Histórico Enxaimel 1915)
 *   - JDS_360_07: Casa Rux de Cima (Voo de Topo / Vista Aérea)
 * ============================================================================
 */

window.TOUR_SC_DATA = {
  tourTitle: "Vale Tombado do Rio da Luz — Imagens Drone 360° Reais",
  tourSubtitle: "Paisagem Cultural Brasileira Tombada pelo IPHAN — Jaraguá do Sul / SC",
  defaultScene: "vale_tombado_04",

  categories: {
    portal360: {
      id: "portal360",
      label: "Navegar entre Fotos Drone 360°",
      color: "#0284c7",
      badgeBg: "#e0f2fe",
      description: "Portais para saltar entre as fotos aéreas do Vale Tombado, Casa Rux e Schroeder Platz"
    },
    patrimonio: {
      id: "patrimonio",
      label: "Patrimônio Histórico Enxaimel",
      color: "#8b1e1e",
      badgeBg: "#fef2f2",
      description: "Casas históricas, técnicas construtivas dos imigrantes e tombamento do IPHAN"
    },
    geodiversidade: {
      id: "geodiversidade",
      label: "Relevo, Vale & Mata Atlântica",
      color: "#15803d",
      badgeBg: "#dcfce7",
      description: "Geomorfologia do Vale do Rio da Luz, hidrografia e conservação ambiental"
    },
    modelo3d: {
      id: "modelo3d",
      label: "Modelos 3D Interativos",
      color: "#d97706",
      badgeBg: "#ffedd5",
      description: "Maquetes 3D do relevo e da estrutura de madeira Enxaimel (Sketchfab)"
    }
  },

  rioDaLuzMapImage: "assets/fotos/mapa_rota_lumiar.jpg",
  rioDaLuzMapPins: [],

  scenes: {
    // =========================================================================
    // CENA 1 (PRINCIPAL): VALE TOMBADO DO RIO DA LUZ — JDS_360_04
    // Base de navegação aérea para todas as outras fotos 360°!
    // =========================================================================
    vale_tombado_04: {
      id: "vale_tombado_04",
      order: 1,
      title: "Vale Tombado do Rio da Luz — Vista Aérea Principal (JDS_360_04)",
      shortTitle: "1. Vale Tombado (Principal)",
      travelLabel: "Viajando para o Vale do Rio da Luz",
      municipality: "Jaraguá do Sul — SC",
      region: "Paisagem Cultural do Rio da Luz (Tombamento Federal IPHAN)",
      altitude: "280 m (Voo Aéreo Panorâmico Central)",
      coordinates: { lat: -26.53915, lng: -49.14815 },
      headingOffsetDeg: 94,
      address: "Vale do Rio da Luz – Jaraguá do Sul - SC",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-26.53915,-49.14815",
      googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-26.53915,-49.14815",
      initialView: { pitch: -35, yaw: -80, hfov: 105 },
      customPanoramaUrl: "assets/panoramas/drone360/vale_tombado_principal.jpg",
      thumbPhoto: "assets/panoramas/drone360/thumb_vale_tombado.jpg",
      staticPhoto: "assets/fotos/riodaluz/static_vale_tombado.jpg",
      placeMenuTitle: "Vale Tombado do Rio da Luz",
      placeMenuDesc: "Vista panorâmica do vale agrícola, rio e montanhas",
      showInPlaceMenu: true,
      originalRawFile: "Imagem Drone 360/JDS_360_04.jpg",
      ecosystemSummary: "Foto Drone 360° central do Vale do Rio da Luz. Daqui você visualiza as montanhas da Serra do Mar, as várzeas agrícolas e navega diretamente para a Casa do Schroeder Platz e a Casa Rux!",

      labels3D: [
        { text: "Casa do Schroeder Platz", pitch: -44, yaw: -121, scale: 1.15, tilt: 18 },
        { text: "Casa Rux (Enxaimel 1915)", pitch: -1.5, yaw: -34, scale: 1.15, tilt: 10 },
        { text: "Rio da Luz (Corredor Ecológico)", pitch: -22, yaw: 8, scale: 1.1, tilt: 20 },
        { text: "Pico Malwee (550m)", pitch: 8, yaw: -145, scale: 1.1, tilt: -6 }
      ],

      hotspots: [
        // Portal para Schroeder Platz (JDS_360_02) - Posicionado exatamente na propriedade indicada
        {
          id: "hs_v04_to_schroeder",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -51,
          yaw: -121,
          targetSceneId: "schroeder_platz_03",
          tooltip: "Casa do Schroeder Platz",
          transitionLabel: "Descendo em direção à Casa do Schroeder Platz..."
        },

        // Portal único para Casa Rux 1915 (JDS_360_05) - Movido para o outro lado conforme seta
        {
          id: "hs_v04_to_rux",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -8,
          yaw: -34,
          targetSceneId: "casa_rux_05",
          tooltip: "Casa Rux (Enxaimel 1915)",
          transitionLabel: "Sobrevoando o vale até a Casa Rux (1915)..."
        },

        // Modelo 3D Oficial (.GLB) do Relevo do Vale do Rio da Luz (GeoLab)
        {
          id: "hs_v04_3d_relevo",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -2,
          yaw: 43,
          tooltip: "Vale Rio da Luz",
          hideTooltipBadge: true,
          title: "Maquete 3D do Vale do Rio da Luz (GeoLab)",
          subtitleLead: "Explore o modelo tridimensional real (.GLB) com relevo, encostas da Serra do Mar e uso do solo da paisagem cultural.",
          paragraphs: [
            "Esta maquete digital em 3D representa o Vale do Rio da Luz encaixado entre os maciços cristalinos e os contrafortes da Serra do Mar em Jaraguá do Sul.",
            "Gire, dê zoom e inspecione como a ocupação humana seguiu a dinâmica geomorfológica: as várzeas planas junto ao rio concentram agricultura e pastagens, enquanto as casas enxaimel se distribuem ao longo da estrada protegidas pelas encostas de Mata Atlântica."
          ],
          didYouKnow: "Em 2007, o IPHAN reconheceu o Conjunto Rural do Rio da Luz como a primeira Paisagem Cultural tombada do Brasil dentro do projeto Roteiros Nacionais de Imigração!",
          glbKey: "rio_da_luz_glb",
          glbUrl: "assets/modelos/3D_RIO_DA_LUZ_logado.glb",
          author3D: "Vale do Rio da Luz (GeoLab)",
          fallback3DType: "rio_da_luz_valley"
        },

        // Informação Histórica do Vale Tombado
        {
          id: "hs_v04_info_vale",
          type: "info",
          category: "patrimonio",
          iconStyle: "red-circle",
          pitch: -24,
          yaw: 5,
          tooltip: "Paisagem Cultural: O que torna o Rio da Luz tombado pelo IPHAN?",
          title: "O Conjunto Rural do Rio da Luz (IPHAN)",
          subtitleLead: "Uma harmonia secular entre a natureza da Mata Atlântica e a arquitetura dos imigrantes pomeranos.",
          paragraphs: [
            "Ao girar esta foto 360° feita por drone, repare como as propriedades rurais são compridas e estreitas, seguindo o padrão germânico 'Waldhufendorf'. Cada família recebia uma faixa de terra que começava no Rio da Luz, cruzava a estrada e subia até o topo da montanha.",
            "Essa distribuição garantiu que todos tivessem acesso à água para consumo e animais, terra plana fértil para plantio e madeira na encosta para a construção das casas enxaimel e lenha para os fogões."
          ],
          didYouKnow: "O Rio da Luz abriga a maior densidade de casas autênticas em técnica enxaimel por quilômetro quadrado de Santa Catarina!",
          image: "assets/fotos/mapa_rota_lumiar.jpg",
          fitContain: true,
          ctaOpenRotaLumiar: true,
          imageAnnotations: []
        }
      ]
    },

    // =========================================================================
    // CENA 2: CASA DO SCHROEDER PLATZ — JDS_360_02 (Mais próxima da fachada)
    // Ponto de Gastronomia, Convivência e Lazer no Baixo Rio da Luz
    // =========================================================================
    schroeder_platz_03: {
      id: "schroeder_platz_03",
      order: 2,
      title: "Casa do Schroeder Platz — Drone 360° (JDS_360_02)",
      shortTitle: "2. Casa Schroeder Platz (JDS 02)",
      travelLabel: "Viajando para Schroeder Platz",
      municipality: "Jaraguá do Sul — Bairro Rio da Luz",
      region: "Setor Sul do Vale / Ponto [2] do Mapa Oficial",
      altitude: "90 m (Vista Próxima em Frente à Casa do Schroeder Platz)",
      coordinates: { lat: -26.5384678, lng: -49.1486893 },
      headingOffsetDeg: 315,
      address: "R. Eurico Duwe, 1194 – Rio da Luz, Jaraguá do Sul - SC",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-26.5384678,-49.1486893",
      googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-26.5384678,-49.1486893",
      initialView: { pitch: 4, yaw: 8, hfov: 95 },
      customPanoramaUrl: "assets/panoramas/drone360/schroeder_platz.jpg",
      thumbPhoto: "assets/panoramas/drone360/thumb_schroeder_platz.jpg",
      staticPhoto: "assets/fotos/riodaluz/static_schroeder_platz.jpg",
      placeMenuTitle: "Casa do Schroeder Platz",
      placeMenuDesc: "Fachada histórica, praça e tradição germânica",
      showInPlaceMenu: true,
      originalRawFile: "Imagem Drone 360/JDS_360_02.jpg",
      ecosystemSummary: "Vista em 360 graus próxima à fachada da Casa do Schroeder Platz (JDS_360_02), ponto tradicional de gastronomia, convivência e cultura germânica.",

      labels3D: [
        { text: "Casa do Schroeder Platz", pitch: -10, yaw: 0, scale: 1.15, tilt: 12 },
        { text: "Vale Tombado ⬆", pitch: 34, yaw: 32, scale: 1.18, tilt: -10 },
        { text: "Direção Casa Rux ↗", pitch: 14, yaw: 95, scale: 1.05, tilt: 6 }
      ],

      hotspots: [
        // Retornar ao Vale Tombado Principal (JDS_360_04) - NO CÉU conforme solicitado
        {
          id: "hs_sch_to_vale",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 27,
          yaw: 32,
          targetSceneId: "vale_tombado_04",
          tooltip: "Vale Tombado",
          transitionLabel: "Subindo para a visão geral do Vale Tombado..."
        },

        // Ir direto para Casa Rux (JDS_360_05)
        {
          id: "hs_sch_to_rux",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -6,
          yaw: 95,
          targetSceneId: "casa_rux_05",
          tooltip: "Ir para Foto Drone 360°: Casa Rux (JDS_360_05)",
          transitionLabel: "Viajando até a Casa Rux..."
        },

        // Informação sobre Schroeder Platz
        {
          id: "hs_sch_info",
          type: "info",
          category: "patrimonio",
          iconStyle: "red-circle",
          pitch: -22,
          yaw: 12,
          tooltip: "Convivência Germânica: Schroeder Platz no Rio da Luz",
          title: "2. Schroeder Platz & Hospitalidade Rural",
          subtitleLead: "Ponto de encontro da cultura germânica, gastronomia típica e passeios ao ar livre.",
          paragraphs: [
            "Localizado no início do corredor cultural do Rio da Luz, o Schroeder Platz representa o renascimento dos jardins de convivência (Biergärten), onde moradores e turistas desfrutam de almoço típico, pratos coloniais, cucas artesanais e música germânica.",
            "Sua estrutura rústica acolhedora integra-se com a paisagem rural, sendo parada tradicional de cicloturistas e famílias que percorrem o vale rumo a Pomerode."
          ],
          didYouKnow: "O Vale do Rio da Luz é pavimentado de forma cênica, permitindo passeios tranquilos com velocidade reduzida para contemplação da paisagem tombada.",
          image: "assets/fotos/riodaluz/schroeder_platz_almoco.jpg",
          showcaseCard: {
            badge: "Gastronomia Colonial & Almoço Típico • Ponto [2]",
            address: "R. Eurico Duwe, 1194 • Rio da Luz, Jaraguá do Sul - SC",
            caption: "Almoço típico germânico no Schroeder Platz",
            realPhoto: "assets/fotos/riodaluz/static_schroeder_platz.jpg",
            realLabel: "Casa Schroeder",
            coverMain: true
          },
          imageAnnotations: []
        }
      ]
    },

    // =========================================================================
    // CENA 3: CASA RUX — JDS_360_05
    // Patrimônio Histórico Enxaimel de 1915 Tombado pelo IPHAN
    // =========================================================================
    casa_rux_05: {
      id: "casa_rux_05",
      order: 3,
      title: "Casa Rux — Patrimônio Histórico Enxaimel 1915 (JDS_360_05)",
      shortTitle: "3. Casa Rux (JDS 05)",
      travelLabel: "Viajando para a Casa Rux",
      municipality: "Jaraguá do Sul — Estrada Margem Direita do Rio da Luz",
      region: "Ponto [1] do Mapa Oficial / Núcleo Histórico IPHAN",
      altitude: "88 m (Plano Médio sobre o Pátio e Fachada Histórica)",
      coordinates: { lat: -26.53617, lng: -49.14234 },
      headingOffsetDeg: 10,
      address: "R. Erwin Rux, 663 – Rio da Luz, Jaraguá do Sul - SC",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=-26.53617,-49.14234",
      googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=-26.53617,-49.14234",
      initialView: { pitch: -14, yaw: 0, hfov: 95 },
      customPanoramaUrl: "assets/panoramas/drone360/casa_rux.jpg",
      thumbPhoto: "assets/panoramas/drone360/thumb_casa_rux.jpg",
      staticPhoto: "assets/fotos/riodaluz/static_casa_rux.jpg",
      placeMenuTitle: "Casa Rux (1915)",
      placeMenuDesc: "Patrimônio histórico em técnica Enxaimel tombado pelo IPHAN",
      showInPlaceMenu: true,
      originalRawFile: "Imagem Drone 360/JDS_360_05.jpg",
      ecosystemSummary: "Fotografia 360° em plano médio da centenária Casa Rux, construída em 1915 pela família de Erwin Rux com a legítima técnica Enxaimel alemã.",

      labels3D: [
        { text: "Casa Rux (Enxaimel de 1915)", pitch: -18, yaw: 0, scale: 1.2, tilt: 16 },
        { text: "Subir: Ver Casa Rux de Cima (JDS 07) ⬆", pitch: 39, yaw: 52, scale: 1.15, tilt: -10 },
        { text: "Vale Tombado ⬆", pitch: 28, yaw: -115, scale: 1.15, tilt: -8 },
        { text: "Casa do Schroeder Platz", pitch: 0, yaw: -128, scale: 1.08, tilt: 6 }
      ],

      hotspots: [
        // Subir para Casa Rux de Cima (JDS_360_07) - Mais em cima e para a direita no céu conforme seta
        {
          id: "hs_rux_to_cima",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 32,
          yaw: 52,
          targetSceneId: "casa_rux_cima_07",
          tooltip: "Subir Drone 360°: Ver Casa Rux de Cima (JDS_360_07)",
          transitionLabel: "Subindo o drone para a visão de topo da Casa Rux..."
        },

        // Retornar ao Vale Tombado Principal (JDS_360_04) - No Céu
        {
          id: "hs_rux_to_vale",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 22,
          yaw: -115,
          targetSceneId: "vale_tombado_04",
          tooltip: "Vale Tombado",
          transitionLabel: "Retornando à vista aérea do Vale Tombado..."
        },

        // Ir para Schroeder Platz (JDS_360_03)
        {
          id: "hs_rux_to_schroeder",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -6,
          yaw: -128,
          targetSceneId: "schroeder_platz_03",
          tooltip: "Ir para Foto Drone 360°: Schroeder Platz (JDS_360_03)",
          transitionLabel: "Indo até a Casa do Schroeder Platz..."
        },

        // Informação Histórica da Casa Rux
        {
          id: "hs_rux_info",
          type: "info",
          category: "patrimonio",
          iconStyle: "red-circle",
          pitch: -20,
          yaw: -15,
          tooltip: "História: 1. Casa Rux (Construída em 1915)",
          title: "1. Casa de Erwin Rux — Joia da Imigração Pomerana",
          subtitleLead: "Tombada pelo IPHAN e pela FCC, a Casa Rux é uma das edificações rurais mais emblemáticas do Brasil.",
          paragraphs: [
            "Construída em 1915 por imigrantes de origem alemã/pomerana, a Casa Rux destaca-se pelo equilíbrio de proporções, varanda frontal trabalhada e conservação do seu rancho com equipamentos agrícolas centenários.",
            "A propriedade funciona hoje como museu e espaço de turismo rural, mantendo viva a memória das famílias pioneiras do Vale do Rio da Luz."
          ],
          didYouKnow: "A família Rux mantinha pomar, criação de animais e engenho de farinha na própria propriedade, sendo auto-suficiente na vida colonial de 1915.",
          image: "assets/fotos/riodaluz/casa_rux_aquarela.png",
          showcaseCard: {
            badge: "Patrimônio Tombado IPHAN • Construção Enxaimel de 1915",
            address: "R. Erwin Rux, 663 • Rio da Luz, Jaraguá do Sul - SC",
            caption: "Aquarela oficial da Rota Lumiar — Ponto [1] Casa Rux",
            realPhoto: "assets/fotos/riodaluz/static_casa_rux.jpg"
          },
          imageAnnotations: []
        }
      ]
    },

    // =========================================================================
    // CENA 4: CASA RUX DE CIMA — JDS_360_07
    // Voo Aéreo Panorâmico de Topo da Propriedade Rux
    // =========================================================================
    casa_rux_cima_07: {
      id: "casa_rux_cima_07",
      order: 4,
      title: "Casa Rux de Cima — Voo Aéreo 360° (JDS_360_07)",
      shortTitle: "4. Casa Rux de Cima (JDS 07)",
      travelLabel: "Sobrevoando a Casa Rux",
      municipality: "Jaraguá do Sul — Estrada Rio da Luz",
      region: "Vista Aérea de Topo sobre a Propriedade Rux e as Encostas da Serra",
      altitude: "165 m (Drone sobrevoando diretamente o telhado da Casa Rux)",
      coordinates: { lat: -26.536267, lng: -49.142436 },
      headingOffsetDeg: 62,
      initialView: { pitch: -48, yaw: -95, hfov: 105 },
      customPanoramaUrl: "assets/panoramas/drone360/casa_rux_cima.jpg",
      thumbPhoto: "assets/panoramas/drone360/thumb_casa_rux_cima.jpg",
      showInPlaceMenu: false,
      originalRawFile: "Imagem Drone 360/JDS_360_07.jpg",
      ecosystemSummary: "Drone posicionado diretamente acima da Casa Rux, revelando a geometria dos telhados germânicos, os pomares, o rancho e a distribuição dos lotes coloniais até o pé da serra.",

      labels3D: [
        { text: "Descer para Casa Rux", pitch: -36, yaw: -126, scale: 1.18, tilt: 20 },
        { text: "Vale Tombado ⬆", pitch: 20, yaw: 161, scale: 1.12, tilt: -8 },
        { text: "Casa do Schroeder Platz", pitch: -2, yaw: -174, scale: 1.08, tilt: 12 },
        { text: "Mata Atlântica de Encosta preservada", pitch: 12, yaw: 85, scale: 1.05, tilt: -6 }
      ],

      hotspots: [
        // Descer para Casa Rux no solo (JDS_360_05) - Posicionado junto à Casa Enxaimel
        {
          id: "hs_cima_to_rux_solo",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -43,
          yaw: -126,
          targetSceneId: "casa_rux_05",
          tooltip: "Descer para Casa Rux",
          transitionLabel: "Descendo para a Casa Rux..."
        },

        // Retornar ao Vale Tombado Principal (JDS_360_04) - Deslocado à esquerda no céu conforme seta
        {
          id: "hs_cima_to_vale",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 14,
          yaw: 161,
          targetSceneId: "vale_tombado_04",
          tooltip: "Vale Tombado",
          transitionLabel: "Voltando à vista aérea panorâmica do Vale Tombado..."
        },

        // Ir para Schroeder Platz (JDS_360_02) - Posicionado na terra/vale embaixo conforme seta
        {
          id: "hs_cima_to_schroeder",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -8,
          yaw: -174,
          targetSceneId: "schroeder_platz_03",
          tooltip: "Casa do Schroeder Platz (JDS_360_02)",
          transitionLabel: "Viajando até a Casa do Schroeder Platz..."
        },

        // Informação Geográfica do Voo de Topo
        {
          id: "hs_cima_info_lote",
          type: "info",
          category: "geodiversidade",
          iconStyle: "red-circle",
          pitch: -28,
          yaw: 45,
          tooltip: "Geografia: A Geometria do Lote Colonial e da Mata Atlântica",
          title: "A Estrutura do Lote Rural 'Waldhufendorf' Visto do Alto",
          subtitleLead: "Observe de cima como a ocupação do solo respeitou perfeitamente a curva do terreno e a preservação das águas.",
          paragraphs: [
            "Deste ângulo aéreo vertical, é possível notar como a casa principal fica próxima à estrada, o rancho e o pátio de trabalho ficam imediatamente atrás, seguidos pela horta, pomar doméstico e pastagem limpa.",
            "Ao fundo, a encosta íngreme preserva a vegetação original da Mata Atlântica, cumprindo o papel de Área de Preservação Permanente (APP) e protegendo as nascentes que abastecem a bacia do Rio da Luz."
          ],
          didYouKnow: "A vista aérea do Rio da Luz é considerada uma das mais belas representações da imigração no Sul do Brasil, combinando o telhado vermelho das casas enxaimel com o verde intenso da serra!",
          image: "assets/fotos/riodaluz/p1_casa_rux.jpg",
          imageAnnotations: [
            { label: "Casa Principal e Pátio Rural", x: 30, y: 38, arrowDir: "down" },
            { label: "Encosta com Mata Atlântica Preservada", x: 74, y: 32, arrowDir: "down" }
          ]
        }
      ]
    }
  }
};

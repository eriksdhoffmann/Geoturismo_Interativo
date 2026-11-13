/**
 * ============================================================================
 * BANCO DE DADOS GEORREFERENCIADO 360° — VALE DO RIO DA LUZ & SANTA CATARINA
 * Baseado no Mapa Oficial "Bem-vindo ao Rio da Luz" (Jaraguá do Sul / Pomerode)
 * e integrado ao Tour Inicial de Santa Catarina (salvo também em tour_sc_inicial.html)
 * ============================================================================
 */

window.TOUR_SC_DATA = {
  tourTitle: "Passeio Virtual 360° — Vale do Rio da Luz (Jaraguá do Sul) & Santa Catarina",
  tourSubtitle: "Patrimônio Enxaimel (IPHAN), Pontos Turísticos 1 a 13, Igrejas, Clubes de Tiro e Geodiversidade",
  defaultScene: "rio_da_luz_geral",

  categories: {
    pontos_mapa: {
      id: "pontos_mapa",
      label: "Pontos Numerados (1 a 13)",
      color: "#6b4c8c",
      badgeBg: "#f3e8ff",
      description: "Os 13 atrativos turísticos, gastronômicos, pousadas e casas históricas do mapa do Rio da Luz"
    },
    clubes_tiro: {
      id: "clubes_tiro",
      label: "⚔️ Clubes de Tiro (Salões)",
      color: "#784b23",
      badgeBg: "#fef3c7",
      description: "Salão Barg, Sociedade Aliança, Sociedade Centenário e Salão Vitória (Tradição Schützenverein)"
    },
    igrejas: {
      id: "igrejas",
      label: "⛪ Igrejas Históricas",
      color: "#854d0e",
      badgeBg: "#fef9c3",
      description: "Comunidade Salvador, Igreja Apóstolo Paulo e Igreja Comunidade da Paz"
    },
    geodiversidade: {
      id: "geodiversidade",
      label: "⛰️ Montanha & Geodiversidade",
      color: "#15803d",
      badgeBg: "#dcfce7",
      description: "Pico Malwee, Mirante do Vale, Bacia do Rio da Luz e Geossítios de Santa Catarina"
    },
    modelo3d: {
      id: "modelo3d",
      label: "🧊 Modelos 3D Externos",
      color: "#d97706",
      badgeBg: "#ffedd5",
      description: "Maquete 3D de Jaraguá do Sul (IFSC) e Estrutura 3D da Arquitetura Enxaimel (Sketchfab)"
    },
    portal360: {
      id: "portal360",
      label: "🌐 Ir para Outra Foto 360°",
      color: "#0284c7",
      badgeBg: "#e0f2fe",
      description: "Portais para navegar entre os setores do Rio da Luz e o Tour Inicial de Santa Catarina"
    }
  },

  // ===========================================================================
  // MAPA INTERATIVO ILUSTRADO "BEM-VINDO AO RIO DA LUZ" (COORDENADAS X%, Y% NA IMAGEM)
  // Permite clicar diretamente em cima dos números 1 a 13, Igrejas, Clubes e Montanha!
  // ===========================================================================
  rioDaLuzMapImage: "assets/fotos/mapa_rio_da_luz.jpg",
  rioDaLuzMapPins: [
    { id: "hs_rdl_p1", label: "1", title: "1. Casa Rux (Enxaimel 1915)", x: 35.2, y: 77.0, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p2", label: "2", title: "2. Schroeder Platz", x: 41.0, y: 75.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p3", label: "3", title: "3. Berghaus", x: 37.5, y: 73.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p4", label: "4", title: "4. Pesque-Pague do Alcir", x: 47.0, y: 68.0, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p5", label: "5", title: "5. Pesque-Pague Recanto dos Amigos", x: 39.5, y: 66.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p6", label: "6", title: "6. Garten Fluss", x: 47.5, y: 56.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p7", label: "7", title: "7. Belo Vale Sítio de Eventos", x: 54.0, y: 55.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p8", label: "8", title: "8. Cervejaria Maestro", x: 51.2, y: 53.0, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p9", label: "9", title: "9. CTG Velha Querência", x: 54.2, y: 52.2, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p10", label: "10", title: "10. Tradição do Vale", x: 61.8, y: 44.0, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p11", label: "11", title: "11. Pousada Sítio Harmonia", x: 62.8, y: 34.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p12", label: "12", title: "12. Cantinho na Montanha", x: 66.5, y: 32.5, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_p13", label: "13", title: "13. Mirante do Vale", x: 65.0, y: 29.0, kind: "num", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_pico_malwee", label: "⛰️", title: "Montanha: Pico Malwee", x: 43.0, y: 83.2, kind: "mountain", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_salao_barg", label: "⚔️", title: "Clube de Tiro: Salão Barg", x: 44.5, y: 70.5, kind: "club", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_com_salvador", label: "⛪", title: "Igreja: Comunidade Salvador", x: 48.0, y: 62.0, kind: "church", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_soc_alianca", label: "⚔️", title: "Clube de Tiro: Sociedade Aliança", x: 44.5, y: 56.5, kind: "club", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_soc_centenario", label: "⚔️", title: "Clube de Tiro: Sociedade Centenário", x: 50.2, y: 55.5, kind: "club", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_ig_paulo", label: "⛪", title: "Igreja: Igreja Apóstolo Paulo", x: 51.0, y: 50.2, kind: "church", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_ig_paz", label: "⛪", title: "Igreja: Comunidade da Paz", x: 51.5, y: 43.8, kind: "church", sceneId: "rio_da_luz_geral" },
    { id: "hs_rdl_salao_vitoria", label: "⚔️", title: "Clube de Tiro: Salão Vitória", x: 53.8, y: 41.0, kind: "club", sceneId: "rio_da_luz_geral" }
  ],

  scenes: {
    // =========================================================================
    // CENA 1 (PRINCIPAL): VALE DO RIO DA LUZ COMPLETO — PANORAMA 360° GERAL
    // Contém TODOS os pontos do mapa "Bem-vindo ao Rio da Luz" explicados!
    // =========================================================================
    rio_da_luz_geral: {
      id: "rio_da_luz_geral",
      order: 1,
      group: "rio_da_luz",
      title: "Vale do Rio da Luz — Panorama 360° Completo (Pontos 1 a 13)",
      shortTitle: "Vale do Rio da Luz (Geral)",
      municipality: "Jaraguá do Sul (Conexão Pomerode - Rota Enxaimel)",
      region: "Vale do Itapocu / Vale Europeu — Patrimônio Tombado IPHAN",
      altitude: "360 m (Voo Panorâmico Central sobre o Vale do Rio da Luz)",
      coordinates: { lat: -26.5562, lng: -49.1385 },
      initialView: { pitch: -12, yaw: -15, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "rio_da_luz_geral",
      thumbPhoto: "assets/fotos/mapa_rio_da_luz.jpg",
      ecosystemSummary: "Primeira Paisagem Cultural brasileira tombada pelo IPHAN (2007): vale fluvial encaixado na Serra do Mar com arquitetura Enxaimel, sociedades de tiro e turismo rural.",

      // Rótulos Geográficos 3D flutuantes na paisagem (Botão "Aa")
      labels3D: [
        { text: "↖ Pomerode (Rota Enxaimel)", pitch: 2, yaw: 78, scale: 1.15, tilt: 6 },
        { text: "↙ Jaraguá do Sul (Centro)", pitch: -6, yaw: -162, scale: 1.15, tilt: 12 },
        { text: "Vale do Rio da Luz (Núcleo Histórico IPHAN)", pitch: -24, yaw: -12, scale: 1.2, tilt: 22 },
        { text: "⛰️ Pico Malwee (550m)", pitch: 10, yaw: -148, scale: 1.1, tilt: -5 },
        { text: "Alto Rio da Luz & Mirante do Vale [13]", pitch: 6, yaw: 98, scale: 1.05, tilt: 4 },
        { text: "Braço Oeste (Recanto dos Amigos [5])", pitch: -14, yaw: -88, scale: 0.95, tilt: 14 }
      ],

      hotspots: [
        // ---------------------------------------------------------------------
        // MODELOS 3D EXTERNOS DO VALE DO RIO DA LUZ / JARAGUÁ DO SUL / ENXAIMEL
        // ---------------------------------------------------------------------
        {
          id: "hs_rdl_3d_relevo",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -6,
          yaw: -32,
          tooltip: "🧊 Modelo 3D: Relevo de Jaraguá do Sul e Vale do Rio da Luz (IFSC)",
          title: "Geomorfologia 3D do Vale do Rio da Luz (Jaraguá do Sul)",
          subtitleLead: "Por que o Vale do Rio da Luz tem exatamente aquele formato alongado verde cercado de montanhas que vemos no mapa ilustrado?",
          paragraphs: [
            "No modelo topográfico 3D ao lado (produzido pelo IFSC - Câmpus Garopaba), você pode girar todo o relevo do município de Jaraguá do Sul. O Vale do Rio da Luz é um vale fluvial encaixado de direção Sul–Norte, esculpido pelo Rio da Luz entre as escarpas cristalinas da Serra do Mar e o maciço do Morro Boa Vista.",
            "Quando os imigrantes alemães (principalmente vindos da Pomerânia) chegaram ao vale a partir de 1895, organizaram o território no sistema 'Strassendorf' (aldeia-estrada) e 'Waldhufendorf' (lotes coloniais compridos que começam na margem do Rio da Luz, cruzam a estrada na várzea fértil e sobem até a crista da montanha com reserva florestal)."
          ],
          didYouKnow: "Em 2007, o Conjunto Rural de Rio da Luz foi tombado pelo IPHAN como Patrimônio Cultural do Brasil, tornando-se um marco nacional na proteção da paisagem cultural da imigração em Santa Catarina!",
          sketchfabUid: "a8786ad611d443e193a8b5af123588cd",
          embedUrl: "https://sketchfab.com/models/a8786ad611d443e193a8b5af123588cd/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/jaragua-do-sul-sc-a8786ad611d443e193a8b5af123588cd",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "rio_da_luz_valley"
        },
        {
          id: "hs_rdl_3d_enxaimel",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -14,
          yaw: -148,
          tooltip: "🧊 Modelo 3D: Como é construída uma Casa Enxaimel (Fachwerkhaus)",
          title: "Engenharia Construtiva Enxaimel (Fachwerk) em 3D",
          subtitleLead: "Você sabia que as casas históricas do Rio da Luz (como a Casa Rux e o Salão Barg) foram erguidas com vigas de madeira encaixadas sem usar um único prego de ferro?",
          paragraphs: [
            "A técnica construtiva 'Enxaimel' (do alemão Fachwerk) trazida pelos imigrantes consiste em uma gaiola estrutural tridimensional de peças de madeira de lei (como peroba, canela e araribá) unidas por encaixes do tipo macho-e-fêmea (espiga e mecha) travados com cavilhas (pinos de madeira).",
            "Interaja com o modelo 3D estrutural ao lado para observar as peças horizontais (baldrames e frechais), os esteios verticais e as mãos-francesas diagonais. Os vãos entre as madeiras eram posteriormente preenchidos com tijolos maciços cozidos artesanalmente nas olarias do próprio Vale do Rio da Luz!"
          ],
          didYouKnow: "Como toda a estrutura é presa por encaixes e pinos de madeira, uma casa Enxaimel inteira podia ser desmontada peça por peça (que eram numeradas com algarismos romanos talhados a formão) e remontada em outro terreno!",
          sketchfabUid: "4dfa4c7cd83b4a96bf8a9da13017f79c",
          embedUrl: "https://sketchfab.com/models/4dfa4c7cd83b4a96bf8a9da13017f79c/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/estrutura-casa-enxaimel-fachwerkhaus-4dfa4c7cd83b4a96bf8a9da13017f79c",
          author3D: "Jacksteel Engenharia (Sketchfab)",
          fallback3DType: "rio_da_luz_valley"
        },

        // ---------------------------------------------------------------------
        // OS 13 PONTOS NUMERADOS DO MAPA "BEM-VINDO AO RIO DA LUZ"
        // ---------------------------------------------------------------------
        {
          id: "hs_rdl_p1",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "1",
          pitch: -20,
          yaw: -142,
          tooltip: "Ponto [1] do Mapa: Casa Rux (Casa Histórica Enxaimel de 1915)",
          title: "1. Casa Rux — Patrimônio Enxaimel (1915)",
          subtitleLead: "Localizada na entrada sul do Vale do Rio da Luz (Margem Direita), a Casa de Erwin Rux é uma das joias mais autênticas da arquitetura Enxaimel no Brasil.",
          paragraphs: [
            "Construída em 1915 pela família de imigrantes alemães Rux, a edificação destaca-se pela simetria da sua fachada em técnica enxaimel com tijolos aparentes, varanda frontal entalhada e sótão ventilado com telhas tipo escama.",
            "Tombada em nível estadual (FCC) e federal (IPHAN), a propriedade passou por um cuidadoso restauro e preserva móveis originais, ferramentas agrícolas centenárias, rancho de engenho e jardins tradicionais, recebendo visitantes para vivências culturais e café colonial."
          ],
          didYouKnow: "Na tradição pomerana do Rio da Luz, o desenho das vigas diagonais na fachada enxaimel não servia apenas para segurar o peso do telhado: também indicava o capricho do carpinteiro e a prosperidade da família!",
          image: "assets/fotos/riodaluz/p1_casa_rux.jpg",
          imageAnnotations: [
            { label: "Treliça Estrutural Enxaimel (1915)", x: 28, y: 34, arrowDir: "down" },
            { label: "Ponto [1] na Entrada Sul do Mapa", x: 74, y: 66, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p2",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "2",
          pitch: -22,
          yaw: -126,
          tooltip: "Ponto [2] do Mapa: Schroeder Platz",
          title: "2. Schroeder Platz — Gastronomia e Convivência",
          subtitleLead: "Situado logo na chegada ao Vale do Rio da Luz pela margem leste, o Schroeder Platz celebra a hospitalidade germânica ao ar livre.",
          paragraphs: [
            "Inspirado nos tradicionais 'Biergärten' (jardins de cerveja) e praças comunitárias alemãs, o espaço reúne quiosques rústicos em madeira, gastronomia típica, música e chope artesanal em meio à arborização do baixo vale.",
            "Sua localização estratégica no início da rota turística faz dele um ponto de encontro para ciclistas, famílias e visitantes que iniciam o percurso entre Jaraguá do Sul e Pomerode."
          ],
          didYouKnow: "O Vale do Rio da Luz é uma das rotas de cicloturismo mais procuradas de Santa Catarina, ligando o centro urbano de Jaraguá do Sul ao Vale Europeu através de paisagens rurais históricas.",
          image: "assets/fotos/riodaluz/p2_schroeder_platz.jpg",
          imageAnnotations: [
            { label: "Quiosque e Jardim Gastronômico", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [2] no Mapa do Rio da Luz", x: 76, y: 64, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p3",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "3",
          pitch: -14,
          yaw: -134,
          tooltip: "Ponto [3] do Mapa: Berghaus",
          title: "3. Berghaus — A 'Casa da Montanha'",
          subtitleLead: "Em alemão, 'Berghaus' significa literalmente 'Casa da Montanha' — retratando a ocupação das colinas suaves da margem oeste do Rio da Luz.",
          paragraphs: [
            "Localizada acima da várzea principal, no acesso que leva ao braço oeste do vale, a Berghaus exemplifica como os colonos escolhiam patamares elevados (livres das cheias do rio) para erguer suas residências com vista panorâmica para o vale.",
            "Cercada por árvores nativas da Mata Atlântica e pomares domésticos, representa o charme bucólico e a tranquilidade das propriedades familiares do Rio da Luz."
          ],
          didYouKnow: "As casas do Rio da Luz eram sempre posicionadas considerando a insolação e a brisa do vale, com o pomar e a horta ao lado e o rancho de trabalho nos fundos.",
          image: "assets/fotos/riodaluz/p3_berghaus.jpg",
          imageAnnotations: [
            { label: "Implantação em Meia-Encosta (Colina)", x: 28, y: 40, arrowDir: "down" },
            { label: "Ponto [3] no Mapa do Rio da Luz", x: 75, y: 62, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p4",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "4",
          pitch: -21,
          yaw: -110,
          tooltip: "Ponto [4] do Mapa: Pesque-Pague do Alcir",
          title: "4. Pesque-Pague do Alcir — Águas da Serra e Lazer",
          subtitleLead: "Aproveitando a abundância de córregos cristalinos que descem da Serra do Mar leste, a piscicultura e o lazer rural tornaram-se marcas do Rio da Luz.",
          paragraphs: [
            "Localizado logo após o histórico Salão Barg na margem direita do vale, o Pesque-Pague do Alcir oferece lagoas de pesca esportiva, área de lazer sombreada e gastronomia à base de peixes frescos (como tilápia, carpa e pacu).",
            "Do ponto de vista ambiental e hidrológico, os açudes rurais do vale são alimentados por microbacias florestadas que mantêm água limpa e oxigenada durante todo o ano."
          ],
          didYouKnow: "A combinação de pequenas propriedades agrícolas familiares com o agroturismo (pesque-pagues, restaurantes rurais e pousadas) ajudou a manter os lotes originais do Rio da Luz preservados contra a especulação imobiliária.",
          image: "assets/fotos/riodaluz/p4_pesque_alcir.jpg",
          imageAnnotations: [
            { label: "Pórtico Rústico & Lagoas de Pesca", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [4] no Mapa do Rio da Luz", x: 78, y: 58, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p5",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "5",
          pitch: -18,
          yaw: -88,
          tooltip: "Ponto [5] do Mapa: Pesque-Pague Recanto dos Amigos",
          title: "5. Pesque-Pague Recanto dos Amigos",
          subtitleLead: "Situado no vale secundário a oeste (Estrada Rio da Luz II), o Recanto dos Amigos encanta pelas lagoas emolduradas por fileiras de palmeiras-imperiais.",
          paragraphs: [
            "Como mostra a aquarela original do mapa, o local combina amplos espelhos d'água para pesca esportiva com restaurante campestre e áreas verdes ideais para o descanso em família.",
            "Este setor oeste do bairro Rio da Luz destaca-se pelos vales tributários ainda mais silenciosos, cercados pelas encostas íngremes do Morro Boa Vista."
          ],
          didYouKnow: "As palmeiras-imperiais e o palmito-juçara presentes nos sítios do Rio da Luz não apenas embelezam a paisagem, mas também alimentam tucanos, jacus e dezenas de espécies de aves da Mata Atlântica!",
          image: "assets/fotos/riodaluz/p5_recanto_amigos.jpg",
          imageAnnotations: [
            { label: "Alameda de Palmeiras & Lagoas", x: 28, y: 36, arrowDir: "down" },
            { label: "Ponto [5] no Braço Oeste do Mapa", x: 75, y: 56, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p6",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "6",
          pitch: -17,
          yaw: -22,
          tooltip: "Ponto [6] do Mapa: Garten Fluss ('Jardim do Rio')",
          title: "6. Garten Fluss — O 'Jardim do Rio'",
          subtitleLead: "No coração central do vale, junto à Sociedade Aliança, o Garten Fluss une a arquitetura de madeira e vidro à paisagem ribeirinha do Rio da Luz.",
          paragraphs: [
            "Seu nome em alemão ('Garten' = Jardim + 'Fluss' = Rio) homenageia o próprio Rio da Luz, cujas águas correm ao lado da propriedade sobre leito de seixos rolados.",
            "O pavilhão principal apresenta telhado de duas águas com amplas janelas panorâmicas e estrutura aparente inspirada nos grandes galpões e salões comunitários germânicos, recebendo eventos culturais e gastronômicos."
          ],
          didYouKnow: "O nome 'Rio da Luz' remonta aos primeiros desbravadores e tropeiros do século XIX que, após dias caminhando sob a mata fechada e escura da serra, encontravam neste vale aberto a claridade do sol refletida nas águas do rio!",
          image: "assets/fotos/riodaluz/p6_garten_fluss.jpg",
          imageAnnotations: [
            { label: "Pavilhão em Madeira e Vidro", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [6] no Centro do Mapa", x: 78, y: 49, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p7",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "7",
          pitch: -19,
          yaw: 6,
          tooltip: "Ponto [7] do Mapa: Belo Vale Sítio de Eventos",
          title: "7. Belo Vale Sítio de Eventos",
          subtitleLead: "Localizado na margem leste do médio Rio da Luz, o Belo Vale aproveita o anfiteatro natural das montanhas para celebrações ao ar livre.",
          paragraphs: [
            "Com gramados amplos, lagos ornamentais e salão integrado à natureza, o espaço mostra a vocação contemporânea do Vale do Rio da Luz para o turismo de eventos e casamentos no campo.",
            "A preservação da moldura florestal nas encostas ao redor garante o microclima agradável e a beleza cênica que dá nome ao sítio."
          ],
          didYouKnow: "No Plano Diretor e nas diretrizes do IPHAN para o Rio da Luz, o uso turístico e de eventos em propriedades rurais é incentivado desde que respeite a escala das construções e preserve a visibilidade das montanhas.",
          image: "assets/fotos/riodaluz/p7_belo_vale.jpg",
          imageAnnotations: [
            { label: "Salão Campestre no Médio Vale", x: 30, y: 40, arrowDir: "down" },
            { label: "Ponto [7] no Mapa do Rio da Luz", x: 80, y: 48, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p8",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "8",
          pitch: -14,
          yaw: -4,
          tooltip: "Ponto [8] do Mapa: Cervejaria Maestro",
          title: "8. Cervejaria Maestro — Arte Cervejeira no Vale",
          subtitleLead: "A tradição das cervejas artesanais encontra na água pura da Serra do Mar e na herança germânica do Rio da Luz o seu cenário ideal.",
          paragraphs: [
            "Situada no núcleo central do vale, próxima à Igreja Apóstolo Paulo, a Cervejaria Maestro produz diversos estilos de cervejas artesanais que harmonizam a escola cervejeira alemã com ingredientes e criatividade locais.",
            "Assim como os antigos colonos produziam bebidas fermentadas artesanais (como o chope de colônia e o 'Spritzbier' de gengibre) para as festas de tiro, as microcervejarias atuais mantêm viva essa cultura gastronômica."
          ],
          didYouKnow: "A qualidade físico-química da água que brota das rochas graníticas e gnáissicas da Serra do Mar em Jaraguá do Sul possui baixíssima dureza mineral — característica excelente para a produção de cervejas estilo Pilsen e Lager!",
          image: "assets/fotos/riodaluz/p8_cervejaria_maestro.jpg",
          imageAnnotations: [
            { label: "Rótulos Artesanais Maestro", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [8] no Núcleo Central do Mapa", x: 79, y: 46, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p9",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "9",
          pitch: -15,
          yaw: 15,
          tooltip: "Ponto [9] do Mapa: CTG Velha Querência",
          title: "9. CTG Velha Querência — Integração Cultural",
          subtitleLead: "Sabia que no coração de um vale de colonização alemã também pulsa forte a tradição campeira e equestre no CTG Velha Querência?",
          paragraphs: [
            "Localizado lado a lado com o ponto 8 no médio Rio da Luz, o Centro de Tradições Gaúchas (CTG) Velha Querência promove cavalgadas, encontros campeiros, música tradicionalista e gastronomia de fogo de chão.",
            "Sua presença no mapa ilustrado mostra a riqueza multicultural de Jaraguá do Sul e de Santa Catarina, onde as tradições teuto-brasileiras (clubes de tiro e enxaimel) convivem em harmonia com a cultura tropeira e gaúcha."
          ],
          didYouKnow: "Os cavalos sempre fizeram parte da história do Rio da Luz: até meados do século XX, todo o transporte de leite, madeira e produtos agrícolas entre o vale, Jaraguá do Sul e Pomerode era feito em carroças puxadas por cavalos!",
          image: "assets/fotos/riodaluz/p9_ctg_velha_querencia.jpg",
          imageAnnotations: [
            { label: "Símbolo da Tradição Campeira e Equestre", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [9] no Mapa do Rio da Luz", x: 80, y: 45, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p10",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "10",
          pitch: -14,
          yaw: 58,
          tooltip: "Ponto [10] do Mapa: Tradição do Vale",
          title: "10. Tradição do Vale — Memória e Sabor Colonial",
          subtitleLead: "Subindo em direção ao Alto Rio da Luz, o espaço Tradição do Vale preserva a arquitetura de varanda ampla e a culinária típica das famílias coloniais.",
          paragraphs: [
            "Instalado em uma construção histórica de linhas tradicionais cercada por jardins e palmeiras, o local valoriza as receitas passadas de geração em geração: cucas alemãs (*Streuselkuchen*), pães caseiros, geleias de frutas do pomar, queijos, kochkäse e marreco recheado.",
            "Neste trecho do vale, a paisagem torna-se ainda mais bucólica, com pastagens bem cuidadas e casas enxaimel espalhadas ao longo do Rio da Luz Vitória."
          ],
          didYouKnow: "O 'Kochkäse' (queijo cozido de origem pomerana, feito a partir do coalho fermentado e manteiga) é considerado patrimônio imaterial alimentar das famílias da região entre Jaraguá do Sul e Pomerode!",
          image: "assets/fotos/riodaluz/p10_tradicao_do_vale.jpg",
          imageAnnotations: [
            { label: "Casarão Colonial com Varanda Histórica", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [10] no Alto-Médio Vale", x: 83, y: 39, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p11",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "11",
          pitch: -11,
          yaw: 74,
          tooltip: "Ponto [11] do Mapa: Pousada Sítio Harmonia",
          title: "11. Pousada Sítio Harmonia — Hospedagem no Alto Vale",
          subtitleLead: "Reconhecível pelo seu charmoso chalé vermelho de inspiração europeia, a Pousada Sítio Harmonia proporciona imersão na natureza do Alto Rio da Luz.",
          paragraphs: [
            "Situada na localidade de Rio da Luz Vitória (próximo à subida da serra para Pomerode), a pousada oferece hospedagem rural em meio a trilhas ecológicas, nascentes, lagoas e jardins floridos.",
            "Por estar em uma cota mais elevada do vale, desfruta de noites frescas mesmo no verão e do som constante das águas que formam as cabeceiras do Rio da Luz."
          ],
          didYouKnow: "O turismo de base comunitária e as pousadas familiares do Alto Rio da Luz permitem que o visitante durma dentro de uma Paisagem Cultural tombada pelo IPHAN, acordando com o canto das aves da Mata Atlântica.",
          image: "assets/fotos/riodaluz/p11_sitio_harmonia.jpg",
          imageAnnotations: [
            { label: "Chalé Histórico da Pousada Sítio Harmonia", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [11] no Alto Rio da Luz", x: 84, y: 32, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p12",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "12",
          pitch: -9,
          yaw: 92,
          tooltip: "Ponto [12] do Mapa: Cantinho na Montanha",
          title: "12. Cantinho na Montanha — Refúgio nas Encostas",
          subtitleLead: "Nas encostas superiores do extremo norte do vale, o Cantinho na Montanha exibe a arquitetura serrana integrada à floresta atlântica.",
          paragraphs: [
            "Com telhado de forte inclinação (típico das construções germânicas adaptadas a regiões de chuva e frio serrano) e detalhes em madeira e pedra, o espaço fica nas proximidades do topo da serra.",
            "Deste patamar elevado já se percebe a transição geomorfológica entre o fundo aluvial do vale e as cristas montanhosas que separam as bacias dos rios Itapocu (Jaraguá do Sul) e Testo (Pomerode)."
          ],
          didYouKnow: "Os telhados muito inclinados das casas antigas do Rio da Luz serviam para escoar rapidamente as intensas chuvas orográficas da Serra do Mar e criar um amplo sótão ('Söller') onde os colonos secavam grãos, sementes e embutidos!",
          image: "assets/fotos/riodaluz/p12_cantinho_montanha.jpg",
          imageAnnotations: [
            { label: "Chalé Serrano de Telhado Inclinado", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [12] na Encosta Norte do Mapa", x: 85, y: 30, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_p13",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "13",
          pitch: 4,
          yaw: 102,
          tooltip: "Ponto [13] do Mapa: Mirante do Vale (Divisa com Pomerode)",
          title: "13. Mirante do Vale — A Grande Vista Panorâmica",
          subtitleLead: "O ponto [13] coroa o extremo norte do mapa: um mirante natural no alto da serra de onde se descortina todo o tapete verde do Vale do Rio da Luz!",
          paragraphs: [
            "Localizado na subida que conecta o bairro Rio da Luz à famosa Rota do Enxaimel (Bairro Testo Alto, em Pomerode), o Mirante do Vale permite compreender de um só olhar toda a geografia da bacia hidrográfica.",
            "Daqui avistam-se os meandros do Rio da Luz lá embaixo, o mosaico de pastagens e matas secundárias, os telhados das casas históricas e, ao fundo sul, a silhueta piramidal do Pico Malwee."
          ],
          didYouKnow: "Ao cruzar o topo da serra após o ponto 13 em direção a Pomerode (Testo Alto), você conecta as duas maiores concentrações de casas Enxaimel tombadas pelo IPHAN fora da Europa: Rio da Luz (Jaraguá do Sul) e Testo Alto (Pomerode)!",
          image: "assets/fotos/riodaluz/p13_mirante_do_vale.jpg",
          imageAnnotations: [
            { label: "Deck Panorâmico & Paisagem do Vale", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [13] no Topo Norte do Mapa", x: 84, y: 28, arrowDir: "down" }
          ]
        },

        // ---------------------------------------------------------------------
        // MONTANHA, IGREJAS E CLUBES DE TIRO DA LEGENDA DO MAPA
        // ---------------------------------------------------------------------
        {
          id: "hs_rdl_pico_malwee",
          type: "info",
          category: "geodiversidade",
          iconStyle: "map-mountain",
          badgeText: "⛰️",
          pitch: 8,
          yaw: -150,
          tooltip: "⛰️ Montanha do Mapa: Pico Malwee (550m de altitude)",
          title: "⛰️ Pico Malwee — Guardião Geomorfológico do Vale",
          subtitleLead: "Destacado com o ícone de montanha na base sul do mapa, o Pico Malwee (cerca de 550 m de altitude) é um dos mirantes mais espetaculares do norte catarinense.",
          paragraphs: [
            "Sustentado por rochas cristalinas resistentes ao intemperismo (gnaisses e granitoides antigos), o Pico Malwee ergue-se abruptamente entre o Parque Malwee, o bairro Barra do Rio Cerro e a entrada do Vale do Rio da Luz.",
            "Seu cume conta com rampa oficial de voo livre (parapente e asa-delta) e mirante de contemplação, oferecendo visão de 360° da malha urbana de Jaraguá do Sul de um lado e do vale rural do Rio da Luz do outro."
          ],
          didYouKnow: "As rochas que formam a base do Pico Malwee e do Vale do Rio da Luz pertencem ao Cráton Luís Alves — um fragmento continental antiquíssimo com rochas formadas há mais de 2,1 bilhões de anos (Era Paleo-Proterozoica)!",
          image: "assets/fotos/riodaluz/m_pico_malwee.jpg",
          imageAnnotations: [
            { label: "Crista Cristalina do Pico Malwee (550m)", x: 30, y: 38, arrowDir: "down" },
            { label: "Ícone de Montanha [⛰️] na Base do Mapa", x: 76, y: 69, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_salao_barg",
          type: "info",
          category: "clubes_tiro",
          iconStyle: "map-club",
          badgeText: "⚔️",
          pitch: -18,
          yaw: -118,
          tooltip: "⚔️ Clube de Tiro do Mapa: Salão Barg (Tombado pelo IPHAN)",
          title: "⚔️ Salão Barg — Patrimônio Vivo do Tiro ao Alvo",
          subtitleLead: "Construído na década de 1940 em autêntica técnica Enxaimel, o Salão Barg é um dos mais raros salões comunitários e de atiradores preservados no Brasil!",
          paragraphs: [
            "Sede da Associação Recreativa e Cultural Rio da Luz, o Salão Barg (situado entre os pontos 2, 3 e 4 do mapa) é tombado pelo IPHAN. Sua arquitetura combina a fachada frontal em alvenaria histórica com as laterais e estrutura interna de baile em enxaimel aparente.",
            "Nos clubes de tiro (*Schützenvereine*) do Rio da Luz nasceram as tradicionais competições de Rei e Rainha do Tiro, as marchas de busca de majestades ao som de bandinhas alemãs e a origem da famosa **Schützenfest** (Festa dos Atiradores de Jaraguá do Sul)!"
          ],
          didYouKnow: "Em Jaraguá do Sul existem mais de 15 sociedades de tiro tradicionais — e quatro das mais históricas estão dentro do Vale do Rio da Luz: Salão Barg, Sociedade Aliança, Sociedade Centenário e Salão Vitória!",
          image: "assets/fotos/riodaluz/c_clubes_tiro.jpg",
          imageAnnotations: [
            { label: "Ícone de Clube de Tiro [⚔️] no Mapa", x: 30, y: 38, arrowDir: "down" },
            { label: "Salão Barg, Aliança, Centenário e Vitória", x: 76, y: 55, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_soc_alianca",
          type: "info",
          category: "clubes_tiro",
          iconStyle: "map-club",
          badgeText: "⚔️",
          pitch: -15,
          yaw: -32,
          tooltip: "⚔️ Clube de Tiro do Mapa: Sociedade Aliança",
          title: "⚔️ Sociedade Aliança & Sociedade Centenário",
          subtitleLead: "No coração do médio Rio da Luz (ao lado dos pontos 6, 7 e 8), a Sociedade Aliança e a Sociedade Centenário mantêm viva a cultura associativa dos colonos.",
          paragraphs: [
            "Quando os imigrantes pomeranos se estabeleceram no vale, as Sociedades de Atiradores (*Schützenvereine*) cumpriam um papel muito maior do que o esporte: funcionavam como centro comunitário, espaço de auxílio mútuo, salão de baile, escola inicial e ponto de preservação da música e da língua alemã.",
            "Na **Sociedade Aliança** (fundada em 1954 na margem esquerda/central) e na **Sociedade Centenário**, até hoje ocorrem os torneios de tiro seta/chumbinho, bolão de mesa e festas comunitárias."
          ],
          didYouKnow: "O ritual de 'Busca do Rei e da Rainha' no Rio da Luz é emocionante: os sócios marcham pela estrada do vale acompanhados pela banda de sopro até a casa do atirador que fez a maior pontuação no ano anterior para conduzi-lo ao salão!",
          image: "assets/fotos/riodaluz/c_clubes_tiro.jpg",
          imageAnnotations: [
            { label: "Sociedade Aliança & Sociedade Centenário", x: 30, y: 40, arrowDir: "down" },
            { label: "Núcleo Associativo no Centro do Mapa", x: 76, y: 49, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_salao_vitoria",
          type: "info",
          category: "clubes_tiro",
          iconStyle: "map-club",
          badgeText: "⚔️",
          pitch: -9,
          yaw: 44,
          tooltip: "⚔️ Clube de Tiro do Mapa: Salão Vitória (Alto Rio da Luz)",
          title: "⚔️ Salão Vitória — O Clube do Alto Vale",
          subtitleLead: "Localizado no setor norte do mapa (Rio da Luz Vitória, próximo à Igreja Comunidade da Paz e ao ponto 10), o Salão Vitória reúne as famílias do alto vale.",
          paragraphs: [
            "Como as distâncias no início do século XX eram percorridas a pé ou a cavalo, cada trecho do longo Vale do Rio da Luz fundou sua própria igreja e seu próprio salão de tiro — criando os núcleos do Baixo Rio da Luz (Salão Barg), Médio Rio da Luz (Aliança e Centenário) e Alto Rio da Luz (Salão Vitória).",
            "Essa distribuição geográfica em 'colar de núcleos' ao longo do rio pode ser vista perfeitamente no mapa ilustrado!"
          ],
          didYouKnow: "A localidade do alto vale chama-se 'Rio da Luz Vitória' justamente em referência à comunidade e ao tradicional Salão Vitória!",
          image: "assets/fotos/riodaluz/c_clubes_tiro.jpg",
          imageAnnotations: [
            { label: "Tradição dos Atiradores no Alto Vale", x: 30, y: 38, arrowDir: "down" },
            { label: "Salão Vitória no Setor Norte do Mapa", x: 78, y: 37, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_com_salvador",
          type: "info",
          category: "igrejas",
          iconStyle: "map-church",
          badgeText: "⛪",
          pitch: -16,
          yaw: -46,
          tooltip: "⛪ Igreja do Mapa: Comunidade Salvador (Rio da Luz)",
          title: "⛪ Comunidade Salvador — Fé e Arquitetura Histórica",
          subtitleLead: "Marcada com o ícone de igreja entre os pontos 4 e 6 do mapa, a Comunidade Evangélica Salvador é um marco histórico da colonização luterana no vale.",
          paragraphs: [
            "Os imigrantes pomeranos que colonizaram o Rio da Luz eram majoritariamente de fé Evangélica Luterana. Antes mesmo de possuírem templos de alvenaria, reuniam-se em construções de madeira que funcionavam simultaneamente como escola comunitária durante a semana e igreja aos domingos (*Schulkirche*).",
            "A arquitetura das igrejas do Rio da Luz destaca-se pelas torres sineiras esguias, janelas em arco ogival/neogótico simplificado e cemitérios históricos anexos com lápides escritas em língua alemã gótica (*Fraktur*)."
          ],
          didYouKnow: "Nos antigos cemitérios junto às igrejas do Rio da Luz estão sepultados os pioneiros nascidos na Pomerânia (antiga região do norte da Alemanha/Polônia) no século XIX, constituindo um acervo genealógico único!",
          image: "assets/fotos/riodaluz/i_igrejas_vale.jpg",
          imageAnnotations: [
            { label: "Ícone das Igrejas Históricas [⛪]", x: 30, y: 38, arrowDir: "down" },
            { label: "Comunidade Salvador no Mapa", x: 77, y: 53, arrowDir: "down" }
          ]
        },
        {
          id: "hs_rdl_ig_paulo_paz",
          type: "info",
          category: "igrejas",
          iconStyle: "map-church",
          badgeText: "⛪",
          pitch: -11,
          yaw: 26,
          tooltip: "⛪ Igrejas do Mapa: Igreja Apóstolo Paulo & Comunidade da Paz",
          title: "⛪ Igreja Apóstolo Paulo & Igreja Comunidade da Paz",
          subtitleLead: "No médio e alto vale destacam-se a Igreja Apóstolo Paulo (junto aos pontos 8 e 9) e a Igreja Comunidade da Paz (junto ao Salão Vitória).",
          paragraphs: [
            "A **Igreja Evangélica Luterana Apóstolo Paulo** (fundada na primeira metade do século XX no núcleo central do Rio da Luz) e a **Igreja Comunidade da Paz** (mais ao norte, em Rio da Luz Vitória) completam o trio de templos históricos representados no mapa.",
            "Observe no mapa como cada igreja forma um par inseparável com um clube de tiro próximo: uma tradição típica da paisagem cultural teuto-brasileira, onde a vida espiritual (igreja) e a vida social/festiva (salão de tiro) caminhavam lado a lado."
          ],
          didYouKnow: "Em datas festivas como a Festa da Colheita ('Erntedankfest'), os altares das igrejas do Rio da Luz são decorados pelas famílias locais com frutas, raízes, pães, flores e produtos colhidos nos sítios do próprio vale!",
          image: "assets/fotos/riodaluz/i_igrejas_vale.jpg",
          imageAnnotations: [
            { label: "Igreja Apóstolo Paulo & Comunidade da Paz", x: 30, y: 38, arrowDir: "down" },
            { label: "Eixo Espiritual do Médio e Alto Vale", x: 78, y: 42, arrowDir: "down" }
          ]
        },

        // ---------------------------------------------------------------------
        // PORTAIS 360° PARA NAVEGAR ENTRE OS SETORES DO RIO DA LUZ E O TOUR SC INICIAL
        // ---------------------------------------------------------------------
        {
          id: "hs_rdl_to_sul",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -6,
          yaw: -162,
          targetSceneId: "rio_da_luz_sul",
          tooltip: "🌐 Descer para Foto 360°: Baixo Rio da Luz & Entrada Jaraguá do Sul (Pontos 1 a 5)",
          transitionLabel: "Descendo ao Baixo Rio da Luz (Casa Rux, Salão Barg e Pico Malwee)..."
        },
        {
          id: "hs_rdl_to_norte",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 6,
          yaw: 78,
          targetSceneId: "rio_da_luz_norte_mirante",
          tooltip: "🌐 Subir para Foto 360°: Mirante do Vale [13] & Saída para Pomerode (Rota Enxaimel)",
          transitionLabel: "Subindo a serra até o Mirante do Vale [13] e divisa com Pomerode..."
        },
        {
          id: "hs_rdl_to_sc_inicial",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 8,
          yaw: 150,
          targetSceneId: "florianopolis_lagoa",
          tooltip: "🌎 Ir para o Tour Inicial de Santa Catarina (Florianópolis, Serra, Cânions e Litoral)",
          transitionLabel: "Viajando do Vale do Rio da Luz para o Tour Geral de Santa Catarina..."
        }
      ]
    },

    // =========================================================================
    // CENA 2: BAIXO RIO DA LUZ (ENTRADA SUL: PONTOS 1 A 5, SALÃO BARG & PICO MALWEE)
    // =========================================================================
    rio_da_luz_sul: {
      id: "rio_da_luz_sul",
      order: 2,
      group: "rio_da_luz",
      title: "Baixo Rio da Luz — Casa Rux [1], Salão Barg & Pico Malwee",
      shortTitle: "Rio da Luz Sul (1 a 5)",
      municipality: "Jaraguá do Sul — Entrada Sul do Vale do Rio da Luz",
      region: "Setor Sul do Mapa (Pontos 1, 2, 3, 4, 5, Salão Barg e Pico Malwee)",
      altitude: "85 m (Nível da Estrada Histórica do Rio da Luz)",
      coordinates: { lat: -26.5710, lng: -49.1398 },
      initialView: { pitch: -6, yaw: -135, hfov: 92 },
      customPanoramaUrl: null,
      proceduralPreset: "rio_da_luz_sul",
      thumbPhoto: "assets/fotos/riodaluz/p1_casa_rux.jpg",
      ecosystemSummary: "Porta de entrada sul do Vale do Rio da Luz: transição entre o centro de Jaraguá do Sul, o Pico Malwee e os primeiros lotes coloniais enxaimel.",

      labels3D: [
        { text: "1. Casa Rux (Enxaimel 1915)", pitch: -14, yaw: -142, scale: 1.15, tilt: 12 },
        { text: "2. Schroeder Platz", pitch: -16, yaw: -124, scale: 1.05, tilt: 14 },
        { text: "3. Berghaus", pitch: -10, yaw: -135, scale: 1.0, tilt: 8 },
        { text: "⚔️ Salão Barg (Clube de Tiro)", pitch: -14, yaw: -115, scale: 1.05, tilt: 12 },
        { text: "⛰️ Pico Malwee (550m)", pitch: 12, yaw: -150, scale: 1.2, tilt: -6 }
      ],

      hotspots: [
        {
          id: "hs_sul_p1",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "1",
          pitch: -18,
          yaw: -142,
          tooltip: "Ponto [1]: Casa Rux (1915 — Patrimônio IPHAN)",
          title: "1. Casa Rux — Detalhes da Arquitetura Enxaimel",
          subtitleLead: "Construída em 1915 por imigrantes alemães, a Casa Rux é o cartão-postal de boas-vindas ao Conjunto Rural do Rio da Luz.",
          paragraphs: [
            "Nesta vista aproximada do Baixo Rio da Luz, observe como a Casa Rux se implanta suavemente na paisagem verde da margem direita do rio, mantendo a relação original entre a casa principal, o jardim frontal, o rancho e a roça.",
            "Seus tijolos avermelhados assentados entre os barrotes de madeira de lei formam desenhos geométricos que identificam o estilo construtivo dos mestres carpinteiros pomeranos."
          ],
          didYouKnow: "A Casa Rux integra oficialmente o projeto 'Roteiros Nacionais de Imigração' do IPHAN, sendo um dos bens culturais mais fotografados do Vale do Itapocu.",
          image: "assets/fotos/riodaluz/p1_casa_rux.jpg",
          imageAnnotations: [
            { label: "Fachada Enxaimel de 1915", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [1] na Entrada do Vale", x: 74, y: 66, arrowDir: "down" }
          ]
        },
        {
          id: "hs_sul_p2_p3",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "2",
          pitch: -20,
          yaw: -126,
          tooltip: "Pontos [2] Schroeder Platz & [3] Berghaus",
          title: "2. Schroeder Platz & 3. Berghaus",
          subtitleLead: "Nos primeiros quilômetros da estrada do Rio da Luz, o visitante encontra o lazer gastronômico do Schroeder Platz [2] e a paisagem de colina da Berghaus [3].",
          paragraphs: [
            "Enquanto o **Schroeder Platz [2]** ocupa a margem direita próximo à base do Pico Malwee com estrutura voltada à convivência e gastronomia germânica, a **Berghaus [3]** situa-se na encosta oposta (margem esquerda), dominando a vista das pastagens do baixo vale.",
            "Esse contraste entre a várzea plana junto ao rio e as colinas florestadas define a identidade visual de todo o percurso."
          ],
          didYouKnow: "Ao pedalar ou dirigir por este trecho inicial, olhe para o alto à esquerda do rio (sentido sul-leste) para ver o paredão verde do Pico Malwee!",
          image: "assets/fotos/riodaluz/p2_schroeder_platz.jpg",
          imageAnnotations: [
            { label: "Schroeder Platz [2] & Berghaus [3]", x: 30, y: 38, arrowDir: "down" },
            { label: "Entrada Sul do Rio da Luz", x: 76, y: 64, arrowDir: "down" }
          ]
        },
        {
          id: "hs_sul_p4_p5",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "4",
          pitch: -19,
          yaw: -102,
          tooltip: "Pontos [4] Pesque-Pague do Alcir & [5] Recanto dos Amigos",
          title: "4. Pesque-Pague do Alcir & 5. Recanto dos Amigos",
          subtitleLead: "A riqueza hídrica das encostas do Baixo Rio da Luz abastece os tradicionais pesque-pagues das famílias locais.",
          paragraphs: [
            "No **Pesque-Pague do Alcir [4]** (logo adiante do Salão Barg) e no **Pesque-Pague Recanto dos Amigos [5]** (situado no braço oeste do vale), os visitantes encontram lagoas tranquilas, almoço colonial à base de peixes e contato direto com a vida rural.",
            "Esses empreendimentos familiares são fundamentais para a sustentabilidade econômica do bairro, mantendo as áreas verdes permeáveis e produtivas."
          ],
          didYouKnow: "O braço oeste onde fica o ponto [5] acompanha um dos principais afluentes do Rio da Luz, que nasce nas encostas úmidas do Morro Boa Vista.",
          image: "assets/fotos/riodaluz/p4_pesque_alcir.jpg",
          imageAnnotations: [
            { label: "Turismo de Pesca e Gastronomia Rural", x: 30, y: 38, arrowDir: "down" },
            { label: "Pontos [4] e [5] no Mapa", x: 76, y: 58, arrowDir: "down" }
          ]
        },
        {
          id: "hs_sul_back_geral",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -4,
          yaw: -15,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🌐 Subir para o Panorama 360° Geral do Vale do Rio da Luz (Todos os 13 Pontos)",
          transitionLabel: "Subindo ao Panorama 360° Geral do Vale do Rio da Luz..."
        }
      ]
    },

    // =========================================================================
    // CENA 3: ALTO RIO DA LUZ & MIRANTE DO VALE [13] (CONEXÃO POMERODE ROTA ENXAIMEL)
    // =========================================================================
    rio_da_luz_norte_mirante: {
      id: "rio_da_luz_norte_mirante",
      order: 3,
      group: "rio_da_luz",
      title: "Alto Rio da Luz & Mirante do Vale [13] — Divisa Pomerode",
      shortTitle: "Mirante do Vale (10 a 13)",
      municipality: "Jaraguá do Sul / Divisa com Pomerode (Rota Enxaimel)",
      region: "Setor Norte do Mapa (Pontos 10, 11, 12, 13, Salão Vitória e Igreja da Paz)",
      altitude: "440 m (Mirante do Vale no Topo da Serra)",
      coordinates: { lat: -26.5985, lng: -49.1520 },
      initialView: { pitch: -14, yaw: 75, hfov: 92 },
      customPanoramaUrl: null,
      proceduralPreset: "rio_da_luz_norte_mirante",
      thumbPhoto: "assets/fotos/riodaluz/p13_mirante_do_vale.jpg",
      ecosystemSummary: "Divisor de águas entre o Vale do Rio da Luz (Jaraguá do Sul) e o Vale do Rio do Testo (Pomerode): mirantes serranos, pousadas e mata atlântica de encosta.",

      labels3D: [
        { text: "13. Mirante do Vale", pitch: 2, yaw: 102, scale: 1.2, tilt: 4 },
        { text: "12. Cantinho na Montanha", pitch: -10, yaw: 92, scale: 1.05, tilt: 12 },
        { text: "11. Pousada Sítio Harmonia", pitch: -12, yaw: 72, scale: 1.05, tilt: 14 },
        { text: "10. Tradição do Vale", pitch: -16, yaw: 56, scale: 1.0, tilt: 16 },
        { text: "↖ Saída para Pomerode — Rota Enxaimel", pitch: 4, yaw: 64, scale: 1.15, tilt: 6 }
      ],

      hotspots: [
        {
          id: "hs_norte_p13",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "13",
          pitch: 2,
          yaw: 102,
          tooltip: "Ponto [13]: Mirante do Vale (Vista Panorâmica e Conexão Pomerode)",
          title: "13. Mirante do Vale — O Topo do Rio da Luz",
          subtitleLead: "Do alto do Mirante do Vale [13], contempla-se a imensidão verde da bacia do Rio da Luz antes de cruzar a serra rumo à Rota do Enxaimel em Pomerode!",
          paragraphs: [
            "Este ponto marca o ápice altimétrico da estrada do Rio da Luz. A paisagem combina araucárias, palmeiras, pastagens de encosta e o horizonte recortado pelas montanhas da Serra do Mar.",
            "Para os viajantes que vêm de Pomerode pela Rota do Enxaimel (Testo Alto), o Mirante do Vale [13] é o portal de boas-vindas ao território histórico de Jaraguá do Sul."
          ],
          didYouKnow: "O corredor cultural formado por Testo Alto (Pomerode) + Rio da Luz (Jaraguá do Sul) constitui um dos roteiros de patrimônio rural europeu mais autênticos de toda a América do Sul!",
          image: "assets/fotos/riodaluz/p13_mirante_do_vale.jpg",
          imageAnnotations: [
            { label: "Vista Panorâmica do Mirante do Vale", x: 30, y: 38, arrowDir: "down" },
            { label: "Ponto [13] e Conexão com Pomerode", x: 84, y: 28, arrowDir: "down" }
          ]
        },
        {
          id: "hs_norte_p11_p12",
          type: "info",
          category: "pontos_mapa",
          iconStyle: "map-num",
          badgeText: "11",
          pitch: -11,
          yaw: 74,
          tooltip: "Pontos [11] Pousada Sítio Harmonia & [12] Cantinho na Montanha",
          title: "11. Pousada Sítio Harmonia & 12. Cantinho na Montanha",
          subtitleLead: "No alto curso do rio, a Pousada Sítio Harmonia [11] e o Cantinho na Montanha [12] oferecem refúgio serrano em meio à natureza preservada.",
          paragraphs: [
            "O chalé vermelho da **Pousada Sítio Harmonia [11]** e a arquitetura aconchegante do **Cantinho na Montanha [12]** destacam-se na paisagem do Alto Rio da Luz (Rio da Luz Vitória).",
            "Mais abaixo na estrada encontram-se o espaço **Tradição do Vale [10]**, o **Salão Vitória** e a **Igreja Comunidade da Paz**."
          ],
          didYouKnow: "Muitas nascentes cristalinas que formam o Rio da Luz brotam exatamente nas matas acima dos pontos 11, 12 e 13!",
          image: "assets/fotos/riodaluz/p11_sitio_harmonia.jpg",
          imageAnnotations: [
            { label: "Pousada Sítio Harmonia [11] & Cantinho [12]", x: 30, y: 38, arrowDir: "down" },
            { label: "Alto Rio da Luz no Mapa", x: 84, y: 32, arrowDir: "down" }
          ]
        },
        {
          id: "hs_norte_back_geral",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: -12,
          yaw: -15,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🌐 Voltar ao Panorama 360° Geral do Vale do Rio da Luz (Todos os Pontos)",
          transitionLabel: "Voltando ao Panorama 360° Geral do Vale do Rio da Luz..."
        }
      ]
    },

    // =========================================================================
    // CENAS DO TOUR INICIAL DE SANTA CATARINA (PRESERVADAS E INTEGRADAS!)
    // =========================================================================
    florianopolis_lagoa: {
      id: "florianopolis_lagoa",
      order: 4,
      group: "sc_inicial",
      title: "[Tour SC Inicial] Florianópolis — Lagoa da Conceição & Dunas",
      shortTitle: "SC: Lagoa da Conceição",
      municipality: "Florianópolis — Ilha de Santa Catarina",
      region: "Tour Inicial Santa Catarina (Litoral Central)",
      altitude: "310 m (Mirante do Morro da Lagoa)",
      coordinates: { lat: -27.5986, lng: -48.4589 },
      initialView: { pitch: -8, yaw: 10, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "florianopolis_lagoa",
      thumbPhoto: "assets/fotos/lagoa_conceicao.jpg",
      ecosystemSummary: "Geodiversidade costeira: laguna estrangulada, campo de dunas eólicas quaternárias e maciços graníticos.",
      labels3D: [
        { text: "Lagoa da Conceição", pitch: -14, yaw: -5, scale: 1.15, tilt: 18 },
        { text: "Campo de Dunas da Joaquina", pitch: -18, yaw: 58, scale: 1.0, tilt: 22 },
        { text: "Maciço Costeiro da Costa da Lagoa", pitch: 6, yaw: -62, scale: 0.95, tilt: -5 }
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
            "O relevo de Florianópolis apresenta duas unidades geológicas muito contrastantes: os maciços cristalinos (serras graníticas formadas há cerca de 590 milhões de anos) e as planícies costeiras quaternárias.",
            "A Lagoa da Conceição é uma laguna costeira represada por uma barreira arenosa (restinga e campo de dunas)."
          ],
          didYouKnow: "Durante o Último Máximo Glacial (há 18 mil anos), o nível do mar em Santa Catarina estava cerca de 120 metros abaixo do atual!",
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
            "As Dunas da Joaquina são alimentadas pelas areias marinhas transportadas pelos ventos do quadrante Sul e Nordeste, funcionando também como recarga natural do Aquífero Campeche."
          ],
          didYouKnow: "A vegetação de restinga fixa parte das dunas impedindo que a areia soterre a Lagoa da Conceição.",
          image: "assets/fotos/lagoa_conceicao.jpg",
          imageAnnotations: [
            { label: "Corpo Lagunar da Conceição", x: 52, y: 56, arrowDir: "down" },
            { label: "Barreira Arenosa & Restinga", x: 78, y: 42, arrowDir: "down" }
          ]
        },
        {
          id: "hs_fln_back_riodaluz",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: -95,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🏡 Voltar para o Vale do Rio da Luz (Jaraguá do Sul — Mapa Completo)",
          transitionLabel: "Retornando ao Vale do Rio da Luz (Jaraguá do Sul)..."
        },
        {
          id: "hs_fln_to_ponte",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: -135,
          targetSceneId: "florianopolis_ponte",
          tooltip: "Ir para Foto 360°: Ponte Hercílio Luz",
          transitionLabel: "Voando para Ponte Hercílio Luz..."
        },
        {
          id: "hs_fln_to_serra",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 6,
          yaw: 140,
          targetSceneId: "serra_rio_do_rastro",
          tooltip: "Ir para Foto 360°: Serra do Rio do Rastro",
          transitionLabel: "Subindo para a Serra do Rio do Rastro..."
        }
      ]
    },

    florianopolis_ponte: {
      id: "florianopolis_ponte",
      order: 5,
      group: "sc_inicial",
      title: "[Tour SC Inicial] Ponte Hercílio Luz & Estreito",
      shortTitle: "SC: Ponte Hercílio Luz",
      municipality: "Florianópolis — Centro / Estreito",
      region: "Tour Inicial Santa Catarina",
      altitude: "120 m",
      coordinates: { lat: -27.5935, lng: -48.5653 },
      initialView: { pitch: -4, yaw: 0, hfov: 95 },
      customPanoramaUrl: null,
      proceduralPreset: "florianopolis_ponte",
      thumbPhoto: "assets/fotos/hercilio_luz.jpg",
      ecosystemSummary: "Geomorfologia estuarina (Baías Norte e Sul) e patrimônio histórico da engenharia catarinense.",
      labels3D: [
        { text: "Ponte Hercílio Luz (1926)", pitch: -2, yaw: 0, scale: 1.2, tilt: 8 },
        { text: "Canal do Estreito (500m)", pitch: -22, yaw: 14, scale: 1.0, tilt: 25 }
      ],
      hotspots: [
        {
          id: "hs_ponte_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: 2,
          yaw: -4,
          tooltip: "Modelo 3D: Estrutura da Ponte Hercílio Luz",
          title: "Engenharia da Ponte Hercílio Luz em 3D",
          subtitleLead: "Inaugurada em 1926, a Ponte Hercílio Luz é a maior ponte pênsil sustentada por barras de olhal ainda existente no mundo!",
          paragraphs: [
            "Com 819,47 metros de comprimento total, foi construída no ponto de maior estreitamento entre a Ilha de Santa Catarina e o continente."
          ],
          didYouKnow: "Suas fundações apoiam-se sobre afloramentos cristalinos que margeiam o canal profundo escavado pelas correntes de maré.",
          sketchfabUid: "a42860fb610e4ffcaa6e6082f1c70226",
          embedUrl: "https://sketchfab.com/models/a42860fb610e4ffcaa6e6082f1c70226/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/iluminacao-cenica-da-ponte-hercilio-luz-a42860fb610e4ffcaa6e6082f1c70226",
          author3D: "Eliel Matheus (Sketchfab)",
          fallback3DType: "bridge_strait"
        },
        {
          id: "hs_ponte_back_rdl",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: -65,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🏡 Voltar para o Vale do Rio da Luz (Jaraguá do Sul)",
          transitionLabel: "Voltando ao Vale do Rio da Luz..."
        }
      ]
    },

    serra_rio_do_rastro: {
      id: "serra_rio_do_rastro",
      order: 6,
      group: "sc_inicial",
      title: "[Tour SC Inicial] Serra do Rio do Rastro (SC-390)",
      shortTitle: "SC: Rio do Rastro",
      municipality: "Bom Jardim da Serra / Lauro Müller",
      region: "Tour Inicial Santa Catarina (Serra Catarinense)",
      altitude: "1.421 m",
      coordinates: { lat: -28.3995, lng: -49.5467 },
      initialView: { pitch: -16, yaw: 0, hfov: 92 },
      customPanoramaUrl: null,
      proceduralPreset: "serra_rio_do_rastro",
      thumbPhoto: "assets/fotos/rio_do_rastro.jpg",
      ecosystemSummary: "Escarpa da Serra Geral: derrames vulcânicos de 133 milhões de anos e as 284 curvas da SC-390.",
      labels3D: [
        { text: "Rodovia SC-390 (284 Curvas)", pitch: -24, yaw: 4, scale: 1.15, tilt: 24 },
        { text: "Escarpa da Serra Geral", pitch: -6, yaw: -42, scale: 1.05, tilt: 10 }
      ],
      hotspots: [
        {
          id: "hs_rastro_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -14,
          yaw: -12,
          tooltip: "Modelo 3D: Topografia da Serra do Rio do Rastro (IFSC)",
          title: "Escarpa da Serra Geral e Serra do Rio do Rastro",
          subtitleLead: "Os paredões da Serra do Rio do Rastro registram um dos maiores eventos de vulcanismo continental da história da Terra.",
          paragraphs: [
            "No modelo 3D ao lado, observe o desnível abrupto de mais de 1.000 metros entre o Planalto Serrano e o vale de Lauro Müller."
          ],
          didYouKnow: "Ao descer as 284 curvas da SC-390 (Coluna White), você atravessa 300 milhões de anos da história geológica da Bacia do Paraná!",
          sketchfabUid: "9f9047dfb6194a01a64ec3124189480d",
          embedUrl: "https://sketchfab.com/models/9f9047dfb6194a01a64ec3124189480d/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/bom-jardim-da-serra-9f9047dfb6194a01a64ec3124189480d",
          author3D: "IFSC - Câmpus Garopaba (Sketchfab)",
          fallback3DType: "canyon_scarp"
        },
        {
          id: "hs_rastro_back_rdl",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 4,
          yaw: 65,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🏡 Voltar para o Vale do Rio da Luz (Jaraguá do Sul)",
          transitionLabel: "Voltando ao Vale do Rio da Luz..."
        }
      ]
    },

    urubici_morro_igreja: {
      id: "urubici_morro_igreja",
      order: 7,
      group: "sc_inicial",
      title: "[Tour SC Inicial] Urubici — Morro da Igreja & Pedra Furada",
      shortTitle: "SC: Morro da Igreja",
      municipality: "Urubici — Serra Catarinense",
      region: "Tour Inicial Santa Catarina",
      altitude: "1.822 m",
      coordinates: { lat: -28.1272, lng: -49.4794 },
      initialView: { pitch: -6, yaw: 15, hfov: 90 },
      customPanoramaUrl: null,
      proceduralPreset: "urubici_morro_igreja",
      thumbPhoto: "assets/fotos/morro_igreja.jpg",
      ecosystemSummary: "Ponto habitado mais alto do Sul do Brasil (1.822m) e janela de erosão diferencial na Pedra Furada.",
      labels3D: [
        { text: "Monumento Natural da Pedra Furada", pitch: -10, yaw: 24, scale: 1.2, tilt: 12 }
      ],
      hotspots: [
        {
          id: "hs_urubici_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -8,
          yaw: 22,
          tooltip: "Modelo 3D: Morro da Igreja em Alta Resolução",
          title: "Morro da Igreja (1.822m) & Pedra Furada em 3D",
          subtitleLead: "Localizado no Parque Nacional de São Joaquim, o Morro da Igreja oferece vista privilegiada da Pedra Furada.",
          paragraphs: [
            "A janela de 30 metros da Pedra Furada formou-se por erosão diferencial entre camadas porosas e maciças de derrames basálticos."
          ],
          didYouKnow: "Em dias limpos de inverno, do topo do Morro da Igreja é possível avistar o Oceano Atlântico a mais de 100 km de distância!",
          sketchfabUid: "c13b4652dccc45bc980a56f2e4c510b4",
          embedUrl: "https://sketchfab.com/models/c13b4652dccc45bc980a56f2e4c510b4/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/modelo-3d-morro-da-igreja-alta-resolucao-c13b4652dccc45bc980a56f2e4c510b4",
          author3D: "GEODINÂMICA (Sketchfab)",
          fallback3DType: "pedra_furada"
        },
        {
          id: "hs_urubici_back_rdl",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: -45,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🏡 Voltar para o Vale do Rio da Luz (Jaraguá do Sul)",
          transitionLabel: "Voltando ao Vale do Rio da Luz..."
        }
      ]
    },

    canion_itaimbezinho: {
      id: "canion_itaimbezinho",
      order: 8,
      group: "sc_inicial",
      title: "[Tour SC Inicial] Praia Grande — Cânion do Itaimbezinho",
      shortTitle: "SC: Cânion Itaimbezinho",
      municipality: "Praia Grande (Geoparque Mundial da UNESCO)",
      region: "Tour Inicial Santa Catarina (Extremo Sul)",
      altitude: "980 m",
      coordinates: { lat: -29.1578, lng: -50.0792 },
      initialView: { pitch: -18, yaw: 0, hfov: 90 },
      customPanoramaUrl: null,
      proceduralPreset: "canion_itaimbezinho",
      thumbPhoto: "assets/fotos/itaimbezinho.jpg",
      ecosystemSummary: "Geoparque Caminhos dos Cânions do Sul: paredões verticais de até 720 metros de profundidade.",
      labels3D: [
        { text: "Fenda Principal do Itaimbezinho (720m)", pitch: -24, yaw: 0, scale: 1.2, tilt: 22 }
      ],
      hotspots: [
        {
          id: "hs_itaimbe_3d",
          type: "3d",
          category: "modelo3d",
          iconStyle: "yellow-oval",
          pitch: -18,
          yaw: -4,
          tooltip: "Modelo 3D: Cânion do Itaimbezinho (BRGeo)",
          title: "Cânion do Itaimbezinho em 3D",
          subtitleLead: "Parte do Geoparque Mundial da UNESCO Caminhos dos Cânions do Sul, com paredões verticais de até 720 metros!",
          paragraphs: [
            "O cânion foi escavado ao longo de fraturas tectônicas nas rochas vulcânicas da Formação Serra Geral, dando acesso à famosa Trilha do Rio do Boi em Praia Grande (SC)."
          ],
          didYouKnow: "Praia Grande (SC) é conhecida como a Capital Brasileira dos Cânions e do Balonismo!",
          sketchfabUid: "3c0f25bc147847ef81efdecd9adfc9d2",
          embedUrl: "https://sketchfab.com/models/3c0f25bc147847ef81efdecd9adfc9d2/embed?autostart=1&ui_infos=0",
          externalLink: "https://sketchfab.com/3d-models/canion-do-itaimbezinho-3c0f25bc147847ef81efdecd9adfc9d2",
          author3D: "BRGeo.org (Sketchfab)",
          fallback3DType: "canyon_slot"
        },
        {
          id: "hs_itaimbe_back_rdl",
          type: "scene",
          category: "portal360",
          iconStyle: "portal-thumb",
          pitch: 2,
          yaw: 55,
          targetSceneId: "rio_da_luz_geral",
          tooltip: "🏡 Voltar para o Vale do Rio da Luz (Jaraguá do Sul)",
          transitionLabel: "Voltando ao Vale do Rio da Luz..."
        }
      ]
    }
  }
};

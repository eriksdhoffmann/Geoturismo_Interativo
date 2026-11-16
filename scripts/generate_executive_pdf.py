import os
import base64
import subprocess

DOC_ROOT = os.path.abspath(r"C:\Users\Win11\Downloads\Geohereditas")
OUTPUT_DIR = os.path.join(DOC_ROOT, "SETUR_SC_Anexos")
os.makedirs(OUTPUT_DIR, exist_ok=True)

HTML_PATH = os.path.join(OUTPUT_DIR, "proposta_setur_sc.html")
PDF_PATH = os.path.join(OUTPUT_DIR, "Proposta_Tecnica_GeoSC360_SETUR_SC.pdf")

def img_to_b64(fname):
    p = os.path.join(OUTPUT_DIR, fname)
    if os.path.exists(p):
        with open(p, "rb") as f:
            return "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")
    return ""

b64_1 = img_to_b64("Demonstracao_1_Interface_Navegacao_Drone_360.png")
b64_2 = img_to_b64("Demonstracao_2_SplitView_Modelo_3D_Interativo.png")
b64_3 = img_to_b64("Demonstracao_3_Mapa_Interativo_Roteiro_Turistico.png")
b64_4 = img_to_b64("Demonstracao_4_Estudio_Gestor_Municipal_Input_Dados.png")

html_content = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Proposta Técnica — Soluções Tecnológicas para Gestão, Inteligência e Promoção do Turismo (SETUR-SC)</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Merriweather:ital,wght@0,300;0,700;1,300&display=swap');

  @page {{
    size: A4 portrait;
    margin: 15mm 15mm 18mm 15mm;
    @bottom-right {{
      content: counter(page);
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.55;
    font-size: 10pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  .page {{
    page-break-after: always;
    break-after: page;
    min-height: 260mm;
    position: relative;
    padding-bottom: 10mm;
  }}

  .page:last-child {{
    page-break-after: avoid;
    break-after: avoid;
  }}

  /* HEADER & FOOTER */
  .gov-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2.5px solid #0284c7;
    padding-bottom: 8px;
    margin-bottom: 20px;
  }}

  .gov-brand {{
    display: flex;
    flex-direction: column;
  }}

  .gov-state {{
    font-size: 11pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }}

  .gov-dept {{
    font-size: 8.5pt;
    font-weight: 600;
    color: #0284c7;
  }}

  .gov-tag {{
    background: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 8pt;
    font-weight: 700;
  }}

  .doc-footer {{
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
    font-size: 7.5pt;
    color: #64748b;
  }}

  /* COVER STYLING */
  .cover-container {{
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 255mm;
  }}

  .cover-top {{
    border-bottom: 4px solid #0284c7;
    padding-bottom: 25px;
  }}

  .cover-kicker {{
    display: inline-block;
    background: #0284c7;
    color: #ffffff;
    font-size: 8.5pt;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 14px;
  }}

  .cover-title {{
    font-size: 24pt;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.2;
    margin-bottom: 12px;
  }}

  .cover-subtitle {{
    font-size: 12.5pt;
    font-weight: 500;
    color: #475569;
    line-height: 1.4;
  }}

  .cover-meta-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 25px 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 16px;
  }}

  .meta-item strong {{
    display: block;
    font-size: 7.5pt;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 2px;
  }}

  .meta-item span {{
    font-size: 9.5pt;
    font-weight: 600;
    color: #0f172a;
  }}

  .cover-highlights {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }}

  .highlight-card {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-top: 3px solid #0284c7;
    border-radius: 8px;
    padding: 12px;
  }}

  .highlight-card h4 {{
    font-size: 9pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 4px;
  }}

  .highlight-card p {{
    font-size: 8pt;
    color: #475569;
    line-height: 1.35;
  }}

  .cover-summary-box {{
    background: #f0fdf4;
    border-left: 4px solid #16a34a;
    padding: 14px;
    border-radius: 0 8px 8px 0;
  }}

  .cover-summary-box h3 {{
    font-size: 10.5pt;
    color: #166534;
    font-weight: 800;
    margin-bottom: 4px;
  }}

  .cover-summary-box p {{
    font-size: 8.5pt;
    color: #14532d;
    line-height: 1.45;
  }}

  /* INNER PAGES */
  h2.section-heading {{
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    border-left: 4px solid #0284c7;
    padding-left: 10px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  .item-box {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  }}

  .item-box-header {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }}

  .item-num {{
    background: #0284c7;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 800;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }}

  .item-title {{
    font-size: 10.5pt;
    font-weight: 800;
    color: #0f172a;
  }}

  .item-body {{
    font-size: 9pt;
    color: #334155;
    line-height: 1.5;
    text-align: justify;
  }}

  .item-body p {{
    margin-bottom: 6px;
  }}

  .callout-box {{
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
    padding: 8px 12px;
    border-radius: 0 6px 6px 0;
    margin-top: 6px;
    font-size: 8.5pt;
    color: #1e40af;
  }}

  /* TABLES */
  table.custom-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 8.5pt;
  }}

  table.custom-table th {{
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 8px 10px;
    font-weight: 700;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}

  table.custom-table td {{
    padding: 8px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #334155;
    vertical-align: top;
  }}

  table.custom-table tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  /* DEMO IMAGES PRINTS */
  .prancha-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 10px;
  }}

  .prancha-card {{
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    background: #f8fafc;
  }}

  .prancha-img {{
    width: 100%;
    height: 155px;
    object-fit: cover;
    display: block;
    border-bottom: 1px solid #e2e8f0;
  }}

  .prancha-caption {{
    padding: 8px 10px;
  }}

  .prancha-title {{
    font-size: 8.5pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 2px;
  }}

  .prancha-desc {{
    font-size: 7.5pt;
    color: #475569;
    line-height: 1.35;
  }}

  /* SIGNATURE SECTION */
  .signature-section {{
    margin-top: 25px;
    border-top: 1px solid #cbd5e1;
    padding-top: 15px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }}

  .sig-block {{
    width: 48%;
  }}

  .sig-line {{
    border-bottom: 1px solid #475569;
    width: 220px;
    margin-bottom: 6px;
  }}

  .sig-name {{
    font-size: 9pt;
    font-weight: 800;
    color: #0f172a;
  }}

  .sig-role {{
    font-size: 8pt;
    color: #64748b;
  }}
</style>
</head>
<body>

  <!-- ======================================================================
       PÁGINA 1: CAPA & RESUMO ESTRATÉGICO
       ====================================================================== -->
  <div class="page">
    <div class="gov-header">
      <div class="gov-brand">
        <span class="gov-state">Estado de Santa Catarina</span>
        <span class="gov-dept">Secretaria de Estado do Turismo — SETUR-SC</span>
      </div>
      <span class="gov-tag">Levantamento Tecnológico 2026</span>
    </div>

    <div class="cover-container">
      <div class="cover-top">
        <span class="cover-kicker">Inteligência Territorial & Promoção Turística</span>
        <h1 class="cover-title">Plataforma GeoSC 360°</h1>
        <p class="cover-subtitle">
          Solução Tecnológica Aberta de Alta Performance para Gestão, Inteligência, Geoturismo e Promoção Imersiva dos Destinos Catarinenses
        </p>

        <div class="cover-meta-grid">
          <div class="meta-item">
            <strong>Destinatário Oficial:</strong>
            <span>Secretaria de Estado do Turismo (SETUR-SC)</span>
            <small style="color:#64748b; display:block;">A/C: Secretário do Turismo & Edgar (edgar@setur.sc.gov.br)</small>
          </div>
          <div class="meta-item">
            <strong>Origem / Proponente:</strong>
            <span>Prof. Chico & Equipe Técnica</span>
            <small style="color:#64748b; display:block;">Projeto Geohereditas / GeoSC 360°</small>
          </div>
          <div class="meta-item">
            <strong>Âmbito de Aplicação:</strong>
            <span>Santa Catarina (295 Municípios / 13 Regiões Turísticas)</span>
          </div>
          <div class="meta-item">
            <strong>Arquitetura & Base Tecnológica:</strong>
            <span>Motor WebGL Nativo 60 FPS • Modelos 3D (.GLB) • Código Aberto</span>
          </div>
        </div>

        <div class="cover-highlights">
          <div class="highlight-card">
            <h4>Imersão Aérea & Solo</h4>
            <p>Panoramas 360° capturados por drones com ancoragem matemática precisa de pontos de interesse.</p>
          </div>
          <div class="highlight-card">
            <h4>Maquetes 3D Interativas</h4>
            <p>Visualização tridimensional (.GLB) do relevo, encostas e patrimônio arquitetônico histórico.</p>
          </div>
          <div class="highlight-card">
            <h4>Gestão Municipal Descentralizada</h4>
            <p>Painel autônomo para municípios inserirem dados e fotos sem depender de programadores.</p>
          </div>
        </div>

        <div class="cover-summary-box">
          <h3>Resumo do Posicionamento Estratégico para Santa Catarina</h3>
          <p>
            O <strong>GeoSC 360°</strong> atende perfeitamente à demanda da SETUR-SC por uma ferramenta inovadora, acessível e de soberania pública. Diferente de plataformas comerciais de alto custo recorrente (como Matterport e 3DVista), a solução opera sobre infraestrutura web estática aberta, eliminando mensalidades por tráfego, garantindo compatibilidade universal com qualquer smartphone ou totem turístico e permitindo que o Estado e seus municípios construam um catálogo digital vivo e perene de seus atrativos.
          </p>
        </div>
      </div>

      <div class="doc-footer">
        <span>SETUR-SC • Levantamento de Soluções Tecnológicas para o Turismo</span>
        <span>Página 1</span>
      </div>
    </div>
  </div>

  <!-- ======================================================================
       PÁGINA 2: RESPOSTAS AOS ITENS 1, 2, 3 E 4
       ====================================================================== -->
  <div class="page">
    <div class="gov-header">
      <div class="gov-brand">
        <span class="gov-state">Estado de Santa Catarina</span>
        <span class="gov-dept">Secretaria de Estado do Turismo — SETUR-SC</span>
      </div>
      <span class="gov-tag">Respostas Técnicas (Itens 1 a 4)</span>
    </div>

    <h2 class="section-heading">
      Questionário de Avaliação Técnica
      <span style="font-size:8pt; font-weight:500; color:#64748b;">Conforme solicitação SETUR-SC</span>
    </h2>

    <!-- ITEM 1 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">1</span>
        <h3 class="item-title">O que é? Descrição da solução e principais funcionalidades</h3>
      </div>
      <div class="item-body">
        <p>
          O <strong>GeoSC 360°</strong> é uma plataforma web imersiva de inteligência territorial, promoção turística e educação patrimonial desenvolvida para o Estado de Santa Catarina. A solução integra passeios virtuais interativos em <strong>360° em altíssima definição (capturas aéreas por drone e terrestres)</strong> com um motor gráfico próprio em <strong>WebGL</strong>, visualização de <strong>modelos tridimensionais (maquetes 3D topográficas e arquitetônicas em formato .GLB e Sketchfab)</strong>, camadas cartográficas interativas (mapas georreferenciados Leaflet e ilustrados temáticos) e rótulos 3D de relevo ancorados na paisagem.
        </p>
        <div class="callout-box">
          <strong>Principais Funcionalidades:</strong> Navegação panorâmica fluida a 60 FPS com zoom óptico (HFOV 38° a 115°); pontos clicáveis (hotspots) esféricos com janelas modais <em>Split-View</em> (mídia anotada + texto técnico-editorial); visualizador 3D offline integrado; transições de voo entre cenas; e um Estúdio Criador autônomo para cadastro imediato de novos atrativos.
        </div>
      </div>
    </div>

    <!-- ITEM 2 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">2</span>
        <h3 class="item-title">Qual problema resolve? Necessidades e desafios do setor turístico atendidos</h3>
      </div>
      <div class="item-body">
        <p>
          A solução resolve a <strong>fragmentação na divulgação dos atrativos catarinenses</strong> e supera a barreira da <em>invisibilidade digital</em> enfrentada pelo turismo rural, de natureza, histórico e de interior. Enquanto a promoção convencional se limita a fotos estáticas bidimensionais ou folhetos em PDF pouco atraentes, o sistema proporciona uma pré-experiência imersiva que qualifica a tomada de decisão do turista, estimula o aumento da permanência média no destino e desconcentra o fluxo turístico do litoral para os vales, serra e oeste.
        </p>
        <p>
          Adicionalmente, atende à carência de dados georreferenciados interpretados: o visitante não apenas contempla o cenário, mas compreende a história da imigração, as características geomorfológicas da Mata Atlântica e a infraestrutura receptiva local (gastronomia, pousadas, cervejarias e artesanato), valorizando o <strong>Geoturismo</strong> como diferencial competitivo internacional.
        </p>
      </div>
    </div>

    <!-- ITEM 3 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">3</span>
        <h3 class="item-title">Como funciona? Metodologia e dinâmica de funcionamento do sistema</h3>
      </div>
      <div class="item-body">
        <p>
          A metodologia estrutura-se em um fluxo contínuo de 3 etapas integradas:
        </p>
        <p>
          <strong>1. Captação e Georreferenciamento de Dados Espaciais:</strong> Voo com drones fotogramétricos para geração de imagens panorâmicas equirretangulares (proporção 2:1) calibradas em coordenadas esféricas de azimute (<em>Yaw</em>: -180° a +180°) e elevação (<em>Pitch</em>: -90° a +90°).
        </p>
        <p>
          <strong>2. Curadoria Editorial e Modelagem 3D:</strong> Estruturação de metadados dos atrativos turísticos em fichas padronizadas, com textos validados por historiadores e geógrafos, fotografias de detalhe e maquetes 3D de relevo e patrimônio arquitetônico.
        </p>
        <p>
          <strong>3. Motor WebGL Ultraleve Multiplataforma:</strong> O sistema roda diretamente no navegador web de qualquer dispositivo (computador, smartphone, tablet ou totem de autoatendimento) sem exigir instalação de aplicativo ou plug-in. Utiliza <em>Raycasting</em> matemático para projetar os marcadores interativos em tempo real sobre a esfera virtual a 60 FPS com consumo mínimo de banda.
        </p>
      </div>
    </div>

    <!-- ITEM 4 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">4</span>
        <h3 class="item-title">Cases e experiências: Destinos, regiões e instituições com a solução implementada</h3>
      </div>
      <div class="item-body">
        <p>
          A solução tem sua base conceitual e tecnológica respaldada no <strong>Projeto Geohereditas do Instituto de Geociências da USP (IGc-USP)</strong>, referência nacional em inventariação e difusão científica do patrimônio natural e geológico. Em Santa Catarina, o sistema possui implementação piloto pioneira e de grande sucesso no <strong>Vale do Rio da Luz (Jaraguá do Sul ↔ Pomerode)</strong>, primeira Paisagem Cultural do Brasil tombada pelo IPHAN nos Roteiros Nacionais de Imigração.
        </p>
        <p>
          No piloto catarinense, foram catalogados e georreferenciados <strong>21 atrativos</strong> (englobando casarões históricos enxaimel, sociedades de tiro tradicionais, igrejas centenárias e o relevo da Serra do Mar), conectando a rota enxaimel à maquete 3D (.GLB) e ao mapa oficial ilustrado. O sistema conta ainda com protótipos de roteiros em <strong>Florianópolis</strong> (Lagoa e Ponte Hercílio Luz), <strong>Serra Catarinense</strong> (Serra do Rio do Rastro e Morro da Igreja/Pedra Furada) e no <strong>Geoparque Mundial da UNESCO Caminhos dos Cânions do Sul</strong> (Cânion do Itaimbezinho/Praia Grande), demonstrando prontidão para expansão em escala estadual.
        </p>
      </div>
    </div>

    <div class="doc-footer">
      <span>SETUR-SC • Levantamento de Soluções Tecnológicas para o Turismo</span>
      <span>Página 2</span>
    </div>
  </div>

  <!-- ======================================================================
       PÁGINA 3: RESPOSTAS AOS ITENS 5, 6 E COMPARATIVO DE CUSTOS
       ====================================================================== -->
  <div class="page">
    <div class="gov-header">
      <div class="gov-brand">
        <span class="gov-state">Estado de Santa Catarina</span>
        <span class="gov-dept">Secretaria de Estado do Turismo — SETUR-SC</span>
      </div>
      <span class="gov-tag">Respostas Técnicas (Itens 5 e 6)</span>
    </div>

    <!-- ITEM 5 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">5</span>
        <h3 class="item-title">Alimentação de dados (Input): Inserção pela SETUR-SC e gestores municipais</h3>
      </div>
      <div class="item-body">
        <p>
          <strong>Sim, a possibilidade é total, nativa e faz parte do design central da solução.</strong> A plataforma conta com o módulo integrado <strong>"Estúdio Criador / Gestor Municipal"</strong>, acessível diretamente na interface. Os técnicos da SETUR-SC e secretarias municipais de turismo podem carregar novos arquivos panorâmicos 360° (.jpg/.png de drone ou câmera 360°) e clicar sobre qualquer feição da paisagem: a função matemática de <em>Raycasting Inverso</em> calcula instantaneamente o <em>Pitch</em> e o <em>Yaw</em> exatos daquele ponto.
        </p>
        <p>
          Em seguida, o gestor preenche formulários visuais simples (título, história, fotos complementares, link de vídeo ou maquete 3D) e o sistema gera automaticamente os dados estruturados em JSON. Para a gestão estadual em larga escala, a plataforma pode ser conectada aos bancos de dados existentes da SETUR-SC via API REST ou camadas GeoJSON/PostGIS, permitindo auditoria centralizada e aprovação de novos pontos pelos técnicos estaduais antes de irem a público.
        </p>
      </div>
    </div>

    <!-- ITEM 6 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">6</span>
        <h3 class="item-title">Custos: Custo anual aproximado para disponibilizar e operar em toda Santa Catarina</h3>
      </div>
      <div class="item-body">
        <p>
          Por ser concebido sobre uma <strong>arquitetura de código aberto (Open Source) e tecnologia estática WebGL ultraleve</strong>, o GeoSC 360° rompe radicalmente com os modelos predatórios de plataformas privadas que cobram mensalidades por volume de acessos ou taxas de licenciamento por cena hospedada (como Matterport e softwares proprietários de passeios virtuais).
        </p>
        <p>
          O custo de <strong>hospedagem e tráfego em nuvem é residual ou zero</strong> quando hospedado na própria infraestrutura do Governo do Estado (CIASC / nuvem governamental) ou via CDNs de altíssima velocidade. O investimento operacional anual destina-se quase integralmente à governança, sustentação técnica, curadoria de dados e capacitação das equipes municipais:
        </p>

        <table class="custom-table">
          <thead>
            <tr>
              <th style="width:25%;">Componente Operacional</th>
              <th style="width:50%;">Descrição & Abrangência Estadual</th>
              <th style="width:25%;">Estimativa Anual</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>1. Infraestrutura & Nuvem</strong></td>
              <td>Hospedagem em nuvem estadual (CIASC) ou CDN global, SSL, CDN de mídia e distribuição de alta velocidade com tráfego ilimitado.</td>
              <td><strong style="color:#16a34a;">Custo Marginal</strong><br><small>(R$ 0 a R$ 6.000/ano)</small></td>
            </tr>
            <tr>
              <td><strong>2. Sustentação Técnica & Manutenção</strong></td>
              <td>Manutenção evolutiva do motor WebGL, suporte técnico contínuo à equipe da SETUR-SC, correção de compatibilidade e atualizações de segurança.</td>
              <td><strong>R$ 36.000 a R$ 60.000/ano</strong><br><small>(R$ 3.000 a R$ 5.000/mês)</small></td>
            </tr>
            <tr>
              <td><strong>3. Curadoria & Capacitação Municipal</strong></td>
              <td>Workshops online de capacitação para gestores dos 295 municípios, manuais operacionais e homologação de conteúdos turísticos inseridos.</td>
              <td><strong>R$ 24.000 a R$ 40.000/ano</strong><br><small>(Pacote estadual anual)</small></td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td><strong style="color:#15803d;">TOTAL ESTIMADO ANUAL</strong></td>
              <td><strong style="color:#15803d;">Operação, governança e disponibilidade contínua para todo o Estado de Santa Catarina</strong></td>
              <td><strong style="color:#15803d; font-size:10pt;">R$ 60.000 a R$ 100.000/ano</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="callout-box" style="background:#fefce8; border-color:#ca8a04; color:#854d0e;">
          <strong>Nota sobre Campanhas de Novas Fotos/Voos de Drone:</strong> As captações de novas imagens aéreas nos municípios podem ser realizadas gradualmente utilizando drones que os próprios municípios ou consórcios regionais já possuem, ou através de termos de cooperação com universidades públicas (UFSC, UDESC) e editais da FAPESC/SETUR.
        </div>
      </div>
    </div>

    <!-- COMPARATIVO ESTRATÉGICO -->
    <h3 style="font-size:10pt; font-weight:800; color:#0f172a; margin-top:12px; margin-bottom:6px;">Comparativo Estratégico de Soluções para o Setor Público</h3>
    <table class="custom-table" style="font-size:7.5pt;">
      <thead>
        <tr>
          <th>Critério de Avaliação</th>
          <th>GeoSC 360° (Nossa Solução)</th>
          <th>Matterport / 3DVista</th>
          <th>Google Street View</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Propriedade dos Dados</strong></td>
          <td><strong style="color:#16a34a;">100% Pública e do Estado de SC</strong></td>
          <td>Privada / Presa ao fornecedor</td>
          <td>Privada / Da Alphabet Inc.</td>
        </tr>
        <tr>
          <td><strong>Custo por Visualização / Cenas</strong></td>
          <td><strong style="color:#16a34a;">Zero (Tráfego Livre Ilimitado)</strong></td>
          <td>Cobrança por cena e por usuário</td>
          <td>Gratuito com anúncios / restrições</td>
        </tr>
        <tr>
          <td><strong>Modelos 3D (.GLB / Relevo)</strong></td>
          <td><strong style="color:#16a34a;">Integrado no próprio modal</strong></td>
          <td>Apenas nuvem de pontos interna</td>
          <td>Não possui suporte a 3D</td>
        </tr>
        <tr>
          <td><strong>Interpretação e Geoturismo</strong></td>
          <td><strong style="color:#16a34a;">Foco editorial em história e geologia</strong></td>
          <td>Genérico (focado em imobiliárias)</td>
          <td>Apenas nomes de ruas comerciais</td>
        </tr>
      </tbody>
    </table>

    <div class="doc-footer">
      <span>SETUR-SC • Levantamento de Soluções Tecnológicas para o Turismo</span>
      <span>Página 3</span>
    </div>
  </div>

  <!-- ======================================================================
       PÁGINA 4: ITEM 7 — DEMONSTRAÇÃO VISUAL & PRANCHAS GRÁFICAS
       ====================================================================== -->
  <div class="page">
    <div class="gov-header">
      <div class="gov-brand">
        <span class="gov-state">Estado de Santa Catarina</span>
        <span class="gov-dept">Secretaria de Estado do Turismo — SETUR-SC</span>
      </div>
      <span class="gov-tag">Demonstração Visual (Item 7)</span>
    </div>

    <h2 class="section-heading">
      Item 7: Demonstração Visual das Interfaces e Funcionalidades
      <span style="font-size:8pt; font-weight:500; color:#64748b;">Capturas Reais do Sistema</span>
    </h2>

    <p style="font-size:8.5pt; color:#475569; margin-bottom:10px;">
      Em atendimento à solicitação da SETUR-SC, apresentamos a seguir as 4 pranchas visuais representativas dos módulos operacionais da plataforma. As imagens e o vídeo de demonstração em alta definição seguem anexados digitalmente a este relatório.
    </p>

    <div class="prancha-grid">
      <!-- PRANCHA 1 -->
      <div class="prancha-card">
        <img src="{b64_1}" alt="Interface de Navegação Drone 360" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 1 — Navegação 360° em Alta Definição (Drone WebGL)</div>
          <div class="prancha-desc">
            Vista panorâmica aérea do Vale do Rio da Luz com HUD de telemetria, bússola de navegação, marcadores clicáveis pulsantes e rótulos 3D de relevo (Pico Malwee e atrativos culturais).
          </div>
        </div>
      </div>

      <!-- PRANCHA 2 -->
      <div class="prancha-card">
        <img src="{b64_2}" alt="Split-View com Modelo 3D" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 2 — Pop-up Split-View: Maquete 3D (.GLB) e Curadoria</div>
          <div class="prancha-desc">
            Modal dividido com modelo tridimensional real interativo de relevo à esquerda e card técnico-editorial com contexto histórico, tombamento IPHAN e curiosidade "Você sabia?" à direita.
          </div>
        </div>
      </div>

      <!-- PRANCHA 3 -->
      <div class="prancha-card">
        <img src="{b64_3}" alt="Mapa Interativo do Roteiro" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 3 — Mapa Interativo Oficial do Roteiro Turístico</div>
          <div class="prancha-desc">
            Cartografia ilustrada com todos os 21 pontos do roteiro catalogados (Igrejas, Clubes de Tiro, Casarões Enxaimel e Cervejarias). Clicar no ponto gira a foto 360° automaticamente até o atrativo.
          </div>
        </div>
      </div>

      <!-- PRANCHA 4 -->
      <div class="prancha-card">
        <img src="{b64_4}" alt="Estúdio de Entrada de Dados Municipal" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 4 — Estúdio Gestor Municipal (Alimentação de Dados)</div>
          <div class="prancha-desc">
            Painel lateral para upload de fotos 360° próprias e cálculo automático de Pitch/Yaw ao clicar na imagem, permitindo aos municípios alimentarem seus atrativos sem programar.
          </div>
        </div>
      </div>
    </div>

    <!-- VÍDEO E ANEXOS -->
    <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-top:14px;">
      <h4 style="font-size:9pt; font-weight:800; color:#0f172a; margin-bottom:4px;">🎬 Vídeo de Demonstração em MP4 (Anexo)</h4>
      <p style="font-size:8pt; color:#334155; line-height:1.4;">
        Acompanha esta proposta o arquivo de vídeo <strong><code>GeoSC_360_Demonstracao_SETUR.mp4</code></strong> (32 segundos, 720p HD, 4.6 MB), demonstrando a fluidez de navegação em 360°, a rotação das maquetes 3D em tempo real e a dinâmica do mapa oficial do destino.
      </p>
    </div>

    <!-- ASSINATURAS -->
    <div class="signature-section">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Prof. Chico & Coordenação Técnica</div>
        <div class="sig-role">Projeto GeoSC 360° • Geoturismo & Inteligência Territorial</div>
      </div>

      <div class="sig-block" style="text-align:right;">
        <div style="font-size:8pt; color:#64748b;">
          Florianópolis / Jaraguá do Sul — SC<br>
          Novembro de 2026
        </div>
      </div>
    </div>

    <div class="doc-footer">
      <span>SETUR-SC • Levantamento de Soluções Tecnológicas para o Turismo</span>
      <span>Página 4</span>
    </div>
  </div>

</body>
</html>
"""

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML generated at: {HTML_PATH} (Size: {os.path.getsize(HTML_PATH)/1024:.1f} KB)")

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
cmd = [
    chrome_path,
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--print-to-pdf=" + PDF_PATH,
    "--no-pdf-header-footer",
    HTML_PATH
]

print("Rendering PDF via headless Chrome...")
res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if os.path.exists(PDF_PATH):
    size_mb = os.path.getsize(PDF_PATH) / (1024 * 1024)
    print(f"PDF generated successfully! Path: {PDF_PATH} (Size: {size_mb:.2f} MB)")
else:
    print(f"PDF generation failed! Stderr: {res.stderr}")

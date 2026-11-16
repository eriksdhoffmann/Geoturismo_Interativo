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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  @page {{
    size: A4 portrait;
    margin: 12mm 15mm 12mm 15mm;
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
    line-height: 1.5;
    font-size: 9.5pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  .page {{
    page-break-after: always;
    break-after: page;
    height: 272mm;
    max-height: 272mm;
    position: relative;
    padding-bottom: 8mm;
    overflow: hidden;
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
    padding-bottom: 6px;
    margin-bottom: 14px;
  }}

  .gov-brand {{
    display: flex;
    flex-direction: column;
  }}

  .gov-state {{
    font-size: 10.5pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }}

  .gov-dept {{
    font-size: 8pt;
    font-weight: 600;
    color: #0284c7;
  }}

  .gov-tag {{
    background: #f0f9ff;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 7.5pt;
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
    padding-top: 5px;
    font-size: 7pt;
    color: #64748b;
  }}

  /* COVER STYLING */
  .cover-container {{
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 250mm;
  }}

  .cover-top {{
    padding-bottom: 10px;
  }}

  .cover-kicker {{
    display: inline-block;
    background: #0284c7;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
  }}

  .cover-title {{
    font-size: 22pt;
    font-weight: 900;
    color: #0f172a;
    line-height: 1.15;
    margin-bottom: 8px;
  }}

  .cover-subtitle {{
    font-size: 11pt;
    font-weight: 500;
    color: #475569;
    line-height: 1.35;
    margin-bottom: 14px;
  }}

  .cover-meta-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 14px 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
  }}

  .meta-item strong {{
    display: block;
    font-size: 7pt;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 1px;
  }}

  .meta-item span {{
    font-size: 9pt;
    font-weight: 700;
    color: #0f172a;
  }}

  .cover-highlights {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }}

  .highlight-card {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-top: 3px solid #0284c7;
    border-radius: 6px;
    padding: 10px;
  }}

  .highlight-card h4 {{
    font-size: 8.5pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 3px;
  }}

  .highlight-card p {{
    font-size: 7.5pt;
    color: #475569;
    line-height: 1.3;
  }}

  .cover-summary-box {{
    background: #f0fdf4;
    border-left: 4px solid #16a34a;
    padding: 12px;
    border-radius: 0 6px 6px 0;
  }}

  .cover-summary-box h3 {{
    font-size: 9.5pt;
    color: #166534;
    font-weight: 800;
    margin-bottom: 4px;
  }}

  .cover-summary-box p {{
    font-size: 8pt;
    color: #14532d;
    line-height: 1.4;
  }}

  /* INNER PAGES */
  h2.section-heading {{
    font-size: 13pt;
    font-weight: 800;
    color: #0f172a;
    border-left: 4px solid #0284c7;
    padding-left: 8px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}

  .item-box {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    padding: 10px 12px;
    margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  }}

  .item-box-header {{
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 5px;
  }}

  .item-num {{
    background: #0284c7;
    color: #ffffff;
    font-size: 8pt;
    font-weight: 800;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }}

  .item-title {{
    font-size: 10pt;
    font-weight: 800;
    color: #0f172a;
  }}

  .item-body {{
    font-size: 8.8pt;
    color: #334155;
    line-height: 1.45;
    text-align: justify;
  }}

  .item-body p {{
    margin-bottom: 4px;
  }}

  .item-body p:last-child {{
    margin-bottom: 0;
  }}

  .badge-geolab {{
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    display: inline-block;
  }}

  /* TABLES */
  table.custom-table {{
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 8pt;
  }}

  table.custom-table th {{
    background: #0f172a;
    color: #ffffff;
    text-align: left;
    padding: 6px 8px;
    font-weight: 700;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}

  table.custom-table td {{
    padding: 6px 8px;
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
    gap: 10px;
    margin-top: 8px;
  }}

  .prancha-card {{
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    overflow: hidden;
    background: #f8fafc;
  }}

  .prancha-img {{
    width: 100%;
    height: 145px;
    object-fit: cover;
    display: block;
    border-bottom: 1px solid #e2e8f0;
  }}

  .prancha-caption {{
    padding: 6px 8px;
  }}

  .prancha-title {{
    font-size: 8pt;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 2px;
  }}

  .prancha-desc {{
    font-size: 7.2pt;
    color: #475569;
    line-height: 1.3;
  }}

  /* SIGNATURE SECTION */
  .signature-section {{
    margin-top: 14px;
    border-top: 1px solid #cbd5e1;
    padding-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }}

  .sig-block {{
    width: 48%;
  }}

  .sig-line {{
    border-bottom: 1px solid #475569;
    width: 200px;
    margin-bottom: 4px;
  }}

  .sig-name {{
    font-size: 8.5pt;
    font-weight: 800;
    color: #0f172a;
  }}

  .sig-role {{
    font-size: 7.5pt;
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
          Solução Tecnológica Aberta de Gestão, Inteligência e Promoção Imersiva dos Destinos Turísticos Catarinenses
        </p>

        <div class="cover-meta-grid">
          <div class="meta-item">
            <strong>Destinatário Oficial:</strong>
            <span>Secretaria de Estado do Turismo (SETUR-SC)</span>
            <small style="color:#64748b; display:block;">A/C: Secretário de Turismo & Edgar (edgar@setur.sc.gov.br)</small>
          </div>
          <div class="meta-item">
            <strong>Liderança & Execução Técnica:</strong>
            <span>GeoLab & UDESC</span>
            <small style="color:#64748b; display:block;">Coordenação: Prof. Chico & Equipe Técnica GeoLab</small>
          </div>
          <div class="meta-item">
            <strong>Âmbito de Aplicação:</strong>
            <span>Polos e Regiões Turísticas de Santa Catarina</span>
          </div>
          <div class="meta-item">
            <strong>Ambiente & Repositório:</strong>
            <span>GitHub (Código Aberto, Transparência & Governança Pública)</span>
          </div>
        </div>

        <div class="cover-highlights">
          <div class="highlight-card">
            <h4>Protagonismo GeoLab</h4>
            <p>O GeoLab executa todo o trabalho técnico de campo, captação 360°, modelagem e implantação no local.</p>
          </div>
          <div class="highlight-card">
            <h4>Parceria UDESC & SETUR</h4>
            <p>Sustentação acadêmica e científica com governança pública e soberania total do Estado sobre os dados.</p>
          </div>
          <div class="highlight-card">
            <h4>Acesso Universal</h4>
            <p>Visualização instantânea em qualquer celular, tablet ou computador, sem necessidade de baixar aplicativo.</p>
          </div>
        </div>

        <div class="cover-summary-box">
          <h3>Resumo do Posicionamento Estratégico</h3>
          <p>
            O <strong>GeoSC 360°</strong> atende de forma direta e estruturada à consulta da SETUR-SC. Trata-se de uma solução integralmente conduzida pelo <strong>GeoLab</strong> em parceria com a <strong>UDESC</strong>, que une o trabalho de campo presencial nos destinos catarinenses à tecnologia de navegação imersiva e repositório colaborativo via <strong>GitHub</strong>. Diferente de ferramentas comerciais fechadas, garante autonomia pública ao Estado, valoriza o turismo cultural e de natureza e posiciona Santa Catarina na vanguarda da promoção turística digital.
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
       PÁGINA 2: RESPOSTAS DIRETAS AOS ITENS 1, 2, 3 E 4
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
      <span style="font-size:7.5pt; font-weight:500; color:#64748b;">Estrutura Direta conforme Solicitação SETUR-SC</span>
    </h2>

    <!-- ITEM 1 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">1</span>
        <h3 class="item-title">O que é? Descrição da solução e principais funcionalidades</h3>
      </div>
      <div class="item-body">
        <p>
          Desenvolvida pelo <strong>GeoLab</strong> em parceria com a <strong>UDESC</strong>, a plataforma <strong>GeoSC 360°</strong> é uma solução web imersiva de promoção e inteligência turística para Santa Catarina. A plataforma integra passeios virtuais interativos em 360° (aéreos por drone e terrestres), maquetes tridimensionais do relevo e do patrimônio arquitetônico, cartografia temática ilustrada e pontos interativos na paisagem. Funciona com navegação fluida em qualquer navegador (celular, tablet ou computador), sem necessidade de instalar aplicativos, exibindo fotos, textos explicativos e maquetes 3D ao clicar nos atrativos.
        </p>
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
          A solução resolve a <strong>fragmentação e a invisibilidade digital</strong> dos destinos turísticos catarinenses, especialmente do turismo rural, cultural e de interior. Supera a divulgação tradicional estática (fotos isoladas e PDFs) através de uma pré-experiência imersiva que atrai o turista e amplia sua permanência no destino. Além disso, organiza dados georreferenciados interpretados sobre história, natureza e serviços turísticos (gastronomia, hospedagem e patrimônio), fortalecendo o turismo de experiência e desconcentrando o fluxo turístico em Santa Catarina.
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
          O sistema opera em uma dinâmica em três etapas executadas pelo <strong>GeoLab</strong>:
        </p>
        <p>
          <strong>1. Trabalho de campo e captação espacial:</strong> A equipe técnica do GeoLab realiza voos de drone e fotografias terrestres em 360° de alta resolução em cada localidade turística.
        </p>
        <p>
          <strong>2. Curadoria editorial e modelagem tridimensional:</strong> O GeoLab faz o processamento dos dados, produz as maquetes 3D de relevo e patrimônio e estrutura as narrativas históricas e turísticas validadas de cada atrativo.
        </p>
        <p>
          <strong>3. Publicação em plataforma web aberta:</strong> O conteúdo é disponibilizado online para acesso instantâneo pelo público em qualquer dispositivo conectado à internet, com carregamento rápido e navegação interativa intuitiva.
        </p>
      </div>
    </div>

    <!-- ITEM 4 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">4</span>
        <h3 class="item-title">Cases e experiências: Destinos e regiões onde a solução já está implementada</h3>
      </div>
      <div class="item-body">
        <p>
          O principal case de sucesso implementado pelo <strong>GeoLab / UDESC</strong> é o passeio virtual do <strong>Vale do Rio da Luz (Jaraguá do Sul ↔ Pomerode)</strong>, primeira Paisagem Cultural do Brasil tombada pelo IPHAN nos Roteiros Nacionais de Imigração. No projeto, o GeoLab mapeou e integrou <strong>21 atrativos turísticos e culturais</strong> (casarões históricos da Rota Enxaimel, sociedades de tiro tradicionais, igrejas centenárias e o relevo da região), associando fotos 360°, maquetes tridimensionais e mapa ilustrado oficial, comprovando o impacto direto na divulgação qualificada e na valorização patrimonial do destino.
        </p>
      </div>
    </div>

    <div class="doc-footer">
      <span>SETUR-SC • Levantamento de Soluções Tecnológicas para o Turismo</span>
      <span>Página 2</span>
    </div>
  </div>

  <!-- ======================================================================
       PÁGINA 3: RESPOSTAS AOS ITENS 5 E 6 (GITHUB, UDESC & GEOLAB, R$ 1 MILHÃO)
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
        <h3 class="item-title">Alimentação de dados (Input): Inserção pela SETUR-SC, UDESC/GeoLab e GitHub</h3>
      </div>
      <div class="item-body">
        <p>
          <strong>Sim, com governança e colaboração total.</strong> A gestão e alimentação da plataforma são viabilizadas pela parceria institucional entre a <strong>UDESC</strong> e o <strong>GeoLab</strong>, que tem o protagonismo de liderar e executar todo o processo técnico, modelagem e curadoria dos dados.
        </p>
        <p>
          A solução adota o <strong>GitHub</strong> como ambiente oficial de repositório, versionamento e hospedagem de código aberto, assegurando total transparência, integridade e facilidade de atualização colaborativa. A SETUR-SC e os gestores municipais de turismo podem fornecer novos conteúdos, fotos e roteiros diretamente à equipe do GeoLab, que realiza o processamento técnico, validação e publicação das novas cenas no repositório GitHub, além de contar com a interface de cadastro simplificada da própria plataforma.
        </p>
      </div>
    </div>

    <!-- ITEM 6 -->
    <div class="item-box">
      <div class="item-box-header">
        <span class="item-num">6</span>
        <h3 class="item-title">Custos: Custo para disponibilizar e operar em Santa Catarina (R$ 1 Milhão para o GeoLab)</h3>
      </div>
      <div class="item-body">
        <p>
          O custo estimado é de <strong>R$ 1.000.000,00 (um milhão de reais) destinado ao GeoLab</strong>, sendo esse valor correspondente ao trabalho completo de ir a campo e implantar/instalar toda a estrutura técnica diretamente nos destinos e polos turísticos de Santa Catarina.
        </p>
        <p>
          Esse investimento de 1 milhão contempla integralmente o protagonismo operacional do <strong>GeoLab</strong> nas seguintes frentes de trabalho:
        </p>

        <table class="custom-table">
          <thead>
            <tr>
              <th style="width:30%;">Frente de Trabalho (GeoLab)</th>
              <th style="width:50%;">Atividades Realizadas no Local (Destinos de SC)</th>
              <th style="width:20%;">Alocação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>1. Deslocamento & Campo no Local</strong></td>
              <td>Ida presencial das equipes técnicas aos destinos turísticos de SC para levantamento in loco, planejamento de rotas e articulação regional.</td>
              <td>Equipe Técnica GeoLab</td>
            </tr>
            <tr>
              <td><strong>2. Implantação da Estrutura Técnica</strong></td>
              <td>Captação aerofotogramétrica com drones 360°, fotos terrestres em altíssima definição, mapeamento topográfico e georreferenciamento.</td>
              <td>Operação GeoLab</td>
            </tr>
            <tr>
              <td><strong>3. Modelagem 3D & Curadoria</strong></td>
              <td>Construção de maquetes tridimensionais do relevo e do patrimônio arquitetônico histórico, redação editorial e validação patrimonial.</td>
              <td>Laboratório GeoLab</td>
            </tr>
            <tr>
              <td><strong>4. Gestão no GitHub & Sustentação</strong></td>
              <td>Integração de todos os roteiros no repositório GitHub, suporte contínuo à SETUR-SC, atualização das cenas e hospedagem aberta ilimitada.</td>
              <td>Parceria UDESC / GeoLab</td>
            </tr>
            <tr style="background:#f0fdf4;">
              <td><strong style="color:#15803d;">VALOR TOTAL DO CONTRATO</strong></td>
              <td><strong style="color:#15803d;">Estruturação completa, trabalho de campo e implantação da solução no território de SC</strong></td>
              <td><strong style="color:#15803d; font-size:9.5pt;">R$ 1.000.000,00</strong></td>
            </tr>
          </tbody>
        </table>

        <p style="font-size:8pt; color:#475569; margin-top:4px;">
          * A infraestrutura web no GitHub e servidores abertos não gera cobranças por visualização nem custos de licenças proprietárias, concentrando 100% dos recursos no trabalho de campo e na implantação presencial da estrutura nos municípios.
        </p>
      </div>
    </div>

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
      <span style="font-size:7.5pt; font-weight:500; color:#64748b;">Capturas Reais Desenvolvidas pelo GeoLab</span>
    </h2>

    <p style="font-size:8pt; color:#475569; margin-bottom:8px;">
      Em atendimento à solicitação da SETUR-SC, apresentamos as 4 pranchas visuais representativas dos módulos operacionais da plataforma. As imagens em alta definição e o vídeo de demonstração seguem anexados digitalmente a este relatório.
    </p>

    <div class="prancha-grid">
      <!-- PRANCHA 1 -->
      <div class="prancha-card">
        <img src="{b64_1}" alt="Interface de Navegação Drone 360" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 1 — Navegação 360° por Drone (Trabalho de Campo GeoLab)</div>
          <div class="prancha-desc">
            Vista panorâmica aérea do Vale do Rio da Luz com bússola de navegação, pontos interativos e identificação dos atrativos culturais e naturais.
          </div>
        </div>
      </div>

      <!-- PRANCHA 2 -->
      <div class="prancha-card">
        <img src="{b64_2}" alt="Split-View com Modelo 3D" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 2 — Maquete 3D Interativa e Curadoria Histórica</div>
          <div class="prancha-desc">
            Janela interativa com maquete tridimensional do relevo à esquerda e card com contexto histórico, patrimônio e curiosidades à direita.
          </div>
        </div>
      </div>

      <!-- PRANCHA 3 -->
      <div class="prancha-card">
        <img src="{b64_3}" alt="Mapa Interativo do Roteiro" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 3 — Mapa Interativo Oficial do Roteiro Turístico</div>
          <div class="prancha-desc">
            Cartografia ilustrada com todos os 21 pontos do roteiro catalogados. Clicar no atrativo gira a foto 360° automaticamente até o local.
          </div>
        </div>
      </div>

      <!-- PRANCHA 4 -->
      <div class="prancha-card">
        <img src="{b64_4}" alt="Estúdio de Entrada de Dados Municipal" class="prancha-img">
        <div class="prancha-caption">
          <div class="prancha-title">Figura 4 — Estúdio de Alimentação e Integração com GitHub</div>
          <div class="prancha-desc">
            Painel de suporte para inclusão de novos pontos e integração direta com o repositório GitHub sob curadoria técnica do GeoLab.
          </div>
        </div>
      </div>
    </div>

    <!-- VÍDEO E ANEXOS -->
    <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; margin-top:10px;">
      <h4 style="font-size:8.5pt; font-weight:800; color:#0f172a; margin-bottom:2px;">🎬 Vídeo de Demonstração em MP4 (Anexo)</h4>
      <p style="font-size:7.5pt; color:#334155; line-height:1.35;">
        Acompanha esta proposta o vídeo <strong><code>GeoSC_360_Demonstracao_SETUR.mp4</code></strong> (32 segundos, 720p HD), demonstrando a fluidez de navegação em 360°, a interação com maquetes 3D em tempo real e a dinâmica do mapa oficial do destino.
      </p>
    </div>

    <!-- ASSINATURAS -->
    <div class="signature-section">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">Prof. Chico & Equipe GeoLab</div>
        <div class="sig-role">Laboratório GeoLab • Parceria UDESC & SETUR-SC</div>
      </div>

      <div class="sig-block" style="text-align:right;">
        <div style="font-size:7.5pt; color:#64748b;">
          Santa Catarina<br>
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

print("Rendering updated PDF via headless Chrome...")
res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if os.path.exists(PDF_PATH):
    size_mb = os.path.getsize(PDF_PATH) / (1024 * 1024)
    print(f"PDF generated successfully! Path: {PDF_PATH} (Size: {size_mb:.2f} MB)")
else:
    print(f"PDF generation failed! Stderr: {res.stderr}")

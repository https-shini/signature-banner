/**
 * @file config.js
 * @description Arquivo de configuração do Banner de Assinatura.
 *
 * Este é o ÚNICO arquivo que você precisa editar para personalizar o banner.
 * Altere os valores abaixo e abra o index.html no navegador para visualizar
 * as mudanças em tempo real.
 *
 * Estrutura do config:
 *  - defaults   → valores iniciais dos campos editáveis
 *  - colors     → paleta de cores padrão
 *  - export     → opções de exportação do PNG
 *  - brand      → tokens visuais de identidade (fontes, raios, etc.)
 *
 * Sintaxe especial nos textos:
 *  - Use **palavra** no campo "name" para destacar em negrito
 *  - Use <br> no campo "tagline" para quebrar a linha
 *  - Separe especializações com ponto-e-vírgula (;)
 */

const BANNER_CONFIG = {

  /**
   * CONTEÚDO — textos, links e contato exibidos no banner.
   * Estes valores populam o formulário ao carregar a página.
   */
  defaults: {
    eyebrow:  'SOFTWARE ENGINEER',
    name:     'Guilherme de Souza **Cruz**',
    role:     'Desenvolvedor de Software',
    specs:    'Full Stack Developer; AI & Automation; Freelancer',
    tagline:  'Projetando e desenvolvendo soluções digitais<br>que transformam desafios em oportunidades.',
    email:    'contato.guilhermescruz@gmail.com',
    site:     'bl4ck404.dev.br',
    cta1Text: 'Conheca Meu Trabalho',
    cta1Link: 'https://bl4ck404.dev.br',
    cta2Text: 'Vamos Conversar',
    cta2Link: 'https://devlinks-rocketseat-five.vercel.app',
    qrLabel:  'CENTRAL DE CONTATOS',
    qrUrl:    'https://devlinks-rocketseat-five.vercel.app',
  },

  /**
   * CORES — paleta padrão do banner.
   * Todos os valores aceitam qualquer cor CSS válida no formato hexadecimal (#rrggbb).
   * Estas cores também podem ser alteradas em tempo real pelo painel de edição.
   */
  colors: {
    background:       '#ffffff',   // superfície principal do banner
    textPrimary:      '#0f172a',   // títulos e texto de alta hierarquia
    textSecondary:    '#475569',   // subtítulos, roles e tagline
    accent:           '#e11d48',   // cor de marca (crimson) — botão primário, rail, glow
    border:           '#e6e8ee',   // cor das bordas e divisores
  },

  /**
   * EXPORTAÇÃO — configurações do PNG gerado.
   */
  export: {
    scale:    2,                                      // fator de escala (2 = 2400×640px)
    filename: 'banner-assinatura-guilherme-cruz.png', // nome do arquivo baixado
  },

  /**
   * BRAND TOKENS — constantes visuais da identidade.
   * Altere aqui para mudar o estilo global do banner sem tocar no CSS principal.
   *
   * Atenção: signal é a cor de acento secundário (indigo), usada no botão CTA 2.
   * Ela não está exposta no painel de cores, mas pode ser alterada aqui.
   */
  brand: {
    signal:          '#4f46e5',   // indigo — acento secundário (CTA 2, bordas)
    fontSans:        "'Inter', -apple-system, 'Segoe UI', sans-serif",
    fontSerif:       "'Fraunces', 'Tiempos Headline', Georgia, serif",
    fontMono:        "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
    bannerWidth:     1200,        // px — largura lógica do banner
    bannerHeight:    320,         // px — altura lógica do banner
    borderRadius:    16,          // px — arredondamento do card do banner
  },

};

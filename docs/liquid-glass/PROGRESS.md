# Liquid Glass — registro de execução

## Escopo e inspeção

Branch `feat/liquid-glass-redesign`, base `da1e2af4e5c62652ff012243e7ba20778aff0610`.
React 19, TypeScript estrito, Vite 7, Fastify/PostgreSQL/Sharp; CSS próprio, Lucide, dialog nativo. Sem alterações nos contratos do servidor, nos documentos exportados ou nos dados de produção.

`DESIGN.md` e `AGENTS.md` não encontrados no checkout. MagicPath não expõe ferramentas nesta sessão; exploração feita com três variações CSS no Chromium: Aurora (lilás/ciano), Obsidian (escura), Opal (tons quentes). Aurora preserva o destaque roxo e a leitura dos modelos; Obsidian exige uma paleta de texto completa e Opal afasta a identidade existente. Capturas em `evidence/before/direction-*.webp`.

Render: último deploy `live`, commit da base, previews desativados. Consulta dos últimos dez logs de build sem entradas de nível error/fatal. Supabase: esquema existente inspecionado em leitura; bucket `identity-studio` privado, limite 5 MB, PNG normalizado. A API de configuração de Auth retornou HTTP 403; conexão MCP e consulta SQL funcionam. Nenhuma escrita, criação de recurso, mudança de variável, merge ou deploy em produção.

## Linha de base

Build e TypeScript passaram; 13 testes de servidor, 4 testes do relay OAuth e 11 testes funcionais no navegador passaram. Auditoria inicial adicional: 24 telas (login, biblioteca, editor, exportação, identidade, mídia, modelos e configurações), em 1440, 834 e 390 px. Sem overflow horizontal ou exceções JavaScript.

Problemas confirmados antes da mudança:

- P1: configurações/sair inacessíveis no celular (único botão oculto).
- P2: alvos pequenos nos cartões, contraste da arte do hero e região de navegação sem foco quando controles ficam desabilitados. Evidência: `evidence/before/audit.json`.

## Arquitetura escolhida

Tokens semânticos em `client/src/design-system/tokens.css`; materiais em `materials.css`; componentes React em `index.tsx`. Aliases `--purple`, `--muted`, `--border`, `--ink` preservados. Escala de espaçamento 4/8 px, duas famílias locais, profundidades painel/chrome/overlay, reflexão em gradientes e bordas iluminadas. Sem WebGL, fontes externas ou novas dependências. Blur apenas no chrome e dialog; cartões usam luz refletida estática.

## Fase 1 — implementada, em validação

Tokens, materiais e superfícies sem wrappers adicionais. Marca Identify e footer compartilhado; navegação mobile revela configurações. Compilação passa. Próxima fase: consolidar headings/controles, corrigir achados da matriz visual e verificar teclado, preferências e fluxos.

## Fase 2 — integração

`GlassSurface`, `Button`, `BrandMark`, `StudioFooter`, `PageHeading` e `Tabs` compartilhados. Header/sidebar usam chrome; contas, editor, identidade, mídia e modelos usam painéis; dialog conserva foco nativo/Escape. Abas passam a ter roving tabindex, setas/Home/End e relações tab/tabpanel. Footer aplicado a todas as telas internas. Paleta de UI consolidada em tokens sem alterar a paleta dos documentos exportados. Sem dependências adicionadas.

Primeira matriz após integração encontrou alvos pequenos ainda sobrescritos pela regra mobile e overflow das métricas após aumentar a fonte. Corrigidos nas regras de origem: botões 44 px no celular, métricas `minmax(0, 1fr)` e texto com quebra. A arte decorativa no mobile foi removida para preservar hierarquia e contraste. Nova matriz em execução.

## Fase 3 — validação funcional e acessibilidade

13 testes de servidor, 4 de OAuth e 11 fluxos E2E passaram. Downloads e uploads reais locais; persistência após reload, versões, contexto, backup e importação preservados. Matriz adicional de 24 telas sem violações axe, sem overflow e sem exceções. `npm audit` retornou zero vulnerabilidades.

O teste ampliado de Tab no dialog identificou saída do foco para o chrome do navegador no fim da sequência nativa (P2 confirmado). O Modal agora envolve explicitamente o primeiro/último controle e restaura o foco ao disparador ao fechar. Mantém dialog nativo e sua inércia do conteúdo de fundo. Testes adicionais de Tab/Shift+Tab, Escape, preferências e falha de rede em andamento.

A inspeção com texto a 200% mostrou marca sobreposta e conteúdo da sidebar abaixo da área visível (P1 confirmado); barra lateral recebeu rolagem e filhos sem encolhimento, e a marca passou a ter hierarquia em duas linhas. A matriz foi ampliada a 320 px. Uma nova variante de seleção de navegação teve contraste insuficiente (P2 detectado pela matriz); texto ativo usa agora o token roxo mais escuro. Filtros são completamente removidos nas variantes opacas, não apenas reduzidos a blur zero.

## Fase 4 — concluída

Matriz final: 36 capturas em desktop/tablet/mobile/320 px e estados adicionais. Zero violações axe (WCAG 2/2.1/2.2 A/AA), overflow horizontal, exceções JavaScript ou solicitações externas. 16 verificações adicionais de interação/preferência passaram, incluindo Tab/Shift+Tab, Escape, foco restaurado, abas, configurações mobile/sair, rolagem da sidebar com texto a 200%, transparência reduzida, movimento reduzido, cores forçadas, fallback opaco e recuperação de 503.

Build final aprovado: JS principal 338,55 KB / 105,16 KB gzip; CSS 44,08 KB / 8,08 KB gzip. Biblioteca usa duas superfícies filtradas, sem filtro por cartão. Evidências WebP e JSON, documentação de tokens/componentes/limites e testes disponíveis no CI. Sem P0/P1 conhecidos em aberto no escopo testado. Não foram executados Safari/Firefox reais, leitura assistiva humana ou profiling de hardware móvel; limites descritos em VALIDATION.md.

Entrega preparada como PR em rascunho. Main e produção preservadas; nenhum merge, deploy ou upgrade autorizado/executado nesta tarefa.

## Revisão do CI

O primeiro CI do PR encontrou contraste insuficiente no início da animação de entrada do dialog: o fade de opacidade misturava texto e fundo. A análise local havia ocorrido após a transição. Correção: entrada apenas por deslocamento, com opacidade constante, preservando contraste também durante a animação. Auditoria não foi relaxada; testes afetados e CI repetidos.

Após a correção, 11 verificações E2E e a matriz ampliada de 40 capturas (incluindo quadros intermediários de animação em quatro larguras) passaram localmente. Zero violações, overflow, exceções e solicitações externas. Build final: CSS 44,06 KB / 8,07 KB gzip. Correção enviada ao PR para nova execução completa do CI.

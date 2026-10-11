# Liquid Glass — registro de execução

## Escopo e inspeção

Branch `feat/liquid-glass-redesign`, base `da1e2af4e5c62652ff012243e7ba20778aff0610`.
React 19, TypeScript estrito, Vite 7, Fastify/PostgreSQL/Sharp; CSS próprio, Lucide, dialog nativo. Sem alterações nos contratos do servidor, nos documentos exportados ou nos dados de produção.

`DESIGN.md` e `AGENTS.md` não encontrados no checkout. MagicPath não expõe ferramentas nesta sessão; exploração feita com três variações CSS no Chromium: Aurora (lilás/ciano), Obsidian (escura), Opal (tons quentes). Aurora preserva o destaque roxo e a leitura dos modelos; Obsidian exige uma paleta de texto completa e Opal afasta a identidade existente. Capturas em `evidence/before/direction-*.png`.

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

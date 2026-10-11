# Identify — sistema Aurora / Liquid Glass

Implementação integrada à aplicação existente. A direção Aurora preserva o roxo `#6551df`, a estrutura de navegação e os fluxos de identidade, ativos, mídia, modelos e backup. Luz lilás/ciano/rosa, reflexão diagonal, borda iluminada e três níveis de superfície constroem profundidade. A refração é uma **simulação CSS**, sem distorcer texto nem prometer uma simulação óptica física.

## Estrutura

| Fonte                                    | Responsabilidade                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `client/src/design-system/tokens.css`    | Paleta, tipografia, espaçamento, raios, materiais, sombras e movimento  |
| `client/src/design-system/materials.css` | Materiais compartilhados, profundidade e preferências de acessibilidade |
| `client/src/design-system/index.tsx`     | Primitivos React, sem wrappers extras                                   |
| `client/src/styles.css`                  | Layouts e estados de cada tela, consumindo tokens                       |
| `client/src/components/ui.tsx`           | Dialog, campos, estados vazios, carregamento e erros existentes         |

A ordem de importação é tokens → layouts → materiais. Os materiais usam `:where` para permitir variantes de layout; cores forçadas usam seletores explícitos para prevalecer sobre superfícies ilustrativas. Os seletores históricos `.surface`, `.button` e os aliases `--purple`, `--muted`, `--border`, `--ink` continuam compatíveis.

## Tokens

| Grupo       | Valores e uso                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cores       | `--color-ink` #242434, `--color-muted` #59516e, `--color-accent` #6551df, hover #503ac4, foco #4f37c2; cores semânticas para perigo, sucesso e controles |
| Ambiente    | `--light-orchid`, `--light-cyan`, `--light-rose`, `--ambient-background`, `--hero-background`                                                            |
| Tipografia  | Arial/Helvetica para interface; Georgia para o título editorial do hero. Duas famílias locais, sem downloads                                             |
| Escala      | xs 12, sm 14, md 16, lg 18, title 20, xl 24 px em rem; heading e display fluidos com `clamp`                                                             |
| Espaçamento | `--space-1/2/3/4/5/6/8/10/12/16`: 4/8/12/16/20/24/32/40/48/64 px                                                                                         |
| Raios       | sm 8, md 16, lg 24, xl 32 px; círculos conservam 50%                                                                                                     |
| Painel      | Branco a 88%, reflexão estática, borda e `--shadow-panel`; sem backdrop filter                                                                           |
| Chrome      | Branco a 84%, blur 16 px e saturação 120%, `--shadow-floating`; header e sidebar                                                                         |
| Overlay     | Branco a 96%, blur 16 px, `--shadow-overlay`; dialog e scrim separado                                                                                    |
| Movimento   | 120/180/280 ms; curva `cubic-bezier(.2,.8,.2,1)`; hover discreto e entrada única do dialog por deslocamento, sem fade de texto                           |

Dimensões de canvas, presets de exportação, recorte e posicionamento da arte continuam geométricas; não são convertidas em espaçamento da interface. A paleta e a tipografia dos documentos exportados continuam no modelo compartilhado e não foram redesenhadas.

## Componentes

| Componente                                         | Uso e contrato                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GlassSurface`                                     | Tags semânticas div/section/article/aside/header/footer; níveis panel/chrome/overlay. Encaminha atributos HTML sem adicionar elementos                             |
| `Button`                                           | primary/secondary/subtle, atributos nativos e disabled. Preserva o comportamento nativo de submit; novos botões fora de formulários devem declarar `type="button"` |
| `BrandMark`                                        | Símbolo decorativo com iluminação local; nome acessível vem do texto Identify                                                                                      |
| `PageHeading`                                      | Eyebrow, h1, descrição e ações, compartilhados entre biblioteca, identidade, mídia, modelos e configurações                                                        |
| `StudioFooter`                                     | Footer consistente em todas as telas internas                                                                                                                      |
| `Tabs`                                             | Ativação automática por setas, Home/End, roving tabindex, aria-selected/controls e relação com tabpanel                                                            |
| `Modal` existente                                  | Dialog nativo, fundo inerte, Escape, ciclo Tab/Shift+Tab e restauração de foco ao disparador conectado                                                             |
| `Field`, `Empty`, `Busy`, `ErrorNotice` existentes | Labels associados, hints, estados e roles preservados; consomem o mesmo vocabulário visual                                                                         |

Os cartões de ativos/modelos/mídia já são artigos semânticos. Não existem páginas editoriais independentes nem cadastro de contas/Supabase Auth no produto atual: conta refere-se à sessão por chave e configurações. Não foram inventadas rotas ou ações.

## Responsividade e acessibilidade

Sidebar passa a rolar quando seu conteúdo excede a altura. No celular, configurações e encerramento de sessão ficam acessíveis; navegação horizontal continua focável mesmo quando seus botões são desabilitados durante a edição. Botões de cartão têm 36 px no desktop e 44 px no celular. Texto auxiliar usa pelo menos 12 px; inputs conservam labels, bordas visíveis e foco sólido.

`prefers-reduced-motion` desativa transições/animações e deslocamentos. `prefers-reduced-transparency` torna os materiais opacos e remove os filtros. `@supports not (backdrop-filter…)` usa o mesmo fallback sólido. `data-transparency="reduced"` expõe a variante opaca para consumidores do sistema e testes, sem criar uma preferência de conta fictícia. `forced-colors` respeita Canvas/CanvasText.

Não há blur por cartão, animação contínua do fundo, fonte externa, WebGL ou dependência nova. Apenas sidebar/header têm filtros na biblioteca; dialog e seu scrim acrescentam filtros quando abertos. A arte do hero é ocultada nas larguras pequenas para evitar sobreposição e trabalho desnecessário.

## Exploração e evidências

MagicPath não estava disponível; foram comparadas três composições diretamente no Chromium:

| Direção                                             | Decisão                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [Aurora](evidence/before/direction-aurora.webp)     | Escolhida: vínculo com o roxo existente e luz fria expressiva                            |
| [Obsidian](evidence/before/direction-obsidian.webp) | Descartada: a exploração evidenciou a necessidade de uma paleta de texto escura completa |
| [Opal](evidence/before/direction-opal.webp)         | Descartada: tons quentes se afastam da identidade da marca                               |

As variações eram estudos CSS sobre a linha de base, não protótipos funcionais adicionais. `DESIGN.md` não estava presente; a documentação arquitetural existente orientou a organização, sem inventar conteúdo dessa referência.

| Tela               | Antes                                         | Depois                                        |
| ------------------ | --------------------------------------------- | --------------------------------------------- |
| Biblioteca desktop | [Antes](evidence/before/library-desktop.webp) | [Depois](evidence/after/library-desktop.webp) |
| Biblioteca celular | [Antes](evidence/before/library-mobile.webp)  | [Depois](evidence/after/library-mobile.webp)  |
| Editor tablet      | [Antes](evidence/before/editor-tablet.webp)   | [Depois](evidence/after/editor-tablet.webp)   |
| Identidade celular | [Antes](evidence/before/identity-mobile.webp) | [Depois](evidence/after/identity-mobile.webp) |
| Conta/login        | [Antes](evidence/before/login-desktop.webp)   | [Depois](evidence/after/login-desktop.webp)   |

As imagens usam fixtures locais fictícias, comprimidas em WebP. Auditorias e demais telas ficam nos mesmos diretórios. Consulte [VALIDATION.md](VALIDATION.md) para resultados e limites; [PROGRESS.md](PROGRESS.md) registra decisões e correções.

## Evolução e reprodução

Adicione cores e materiais nos tokens, componha `GlassSurface` com tags semânticas e mantenha ações reais em `Button`. Use `PageHeading` e `Tabs` para evitar repetir padrões. Antes de acrescentar backdrop filters, verifique o orçamento de superfícies e o comportamento opaco.

Com Node 24, PostgreSQL 17 local e Chromium disponíveis, os comandos utilizados são:

```bash
npm run build
npm test
node --test tests/cloud-oauth-relay.test.mjs
npm run test:e2e
npm run test:visual
npm audit --audit-level=moderate
npx prettier --check client/src tests/liquid-glass.mjs
```

`TEST_DATABASE_URL` aponta ao PostgreSQL isolado de testes; por padrão usa loopback na porta 54329. `CHROMIUM_PATH` seleciona o executável. A matriz cria um schema aleatório e MemoryStorage, serve exclusivamente em loopback e remove o schema ao terminar. Não usa credenciais de produção. `GLASS_EVIDENCE_DIR` pode apontar à pasta de evidências para atualizar capturas; por padrão grava em `test-results/liquid-glass`. O CI executa a matriz e publica os resultados como artefato.

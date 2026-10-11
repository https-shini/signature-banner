# Validação do redesign Aurora

## Ambiente e escopo

Execução local com Node 24, PostgreSQL 17 e Chromium headless; Fastify serve o bundle de produção em loopback. Dados fictícios, schema aleatório e storage isolado. Capturas não contêm dados nem credenciais de produção. A branch parte da main `da1e2af4e5c62652ff012243e7ba20778aff0610`; o commit solicitado `bc415677e409ce82f73d784185bc993ac888f34e` existe no histórico.

Este redesign não foi mesclado nem publicado em produção. Não houve alteração de variáveis da Render, configuração do Supabase, migração de banco ou criação de recursos. A Render permanece com previews desativados; não foi contratada uma preview paga.

## Verificações executadas

| Verificação                                    | Resultado                                                                                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                | TypeScript estrito e bundle Vite aprovados                                                                                                                                                                                  |
| `npm test`                                     | 13 testes aprovados; autenticação/validação, CRUD, concorrência, persistência, migrações, storage e renderização                                                                                                            |
| `node --test tests/cloud-oauth-relay.test.mjs` | 4 testes aprovados                                                                                                                                                                                                          |
| `npm run test:e2e`                             | 11 verificações aprovadas; criar/editar/salvar/recarregar, imagens, recorte, modelos, histórico, contextos, filtros, backup e downloads reais                                                                               |
| Exportações                                    | PNG, JPEG, WebP e SVG reais; assinatura HTML com links seguros                                                                                                                                                              |
| `npm run test:visual`                          | 40 capturas auditadas, sem violações axe, overflow horizontal ou exceções; 8 telas em 1440×1050, 834×1112, 390×844 e 320×812, mais estados de preferência/erro/texto ampliado e quadros intermediários da entrada do dialog |
| Teclado                                        | Tabs com setas/Home/End; Tab/Shift+Tab dentro do modal, Escape e retorno do foco; navegação e encerramento da sessão mobile                                                                                                 |
| Preferências                                   | Movimento reduzido, transparência reduzida emulada via CDP, materiais opacos e cores forçadas                                                                                                                               |
| Recuperação                                    | Resposta 503 local interceptada, alerta visível e recuperação após restaurar a API/recarregar                                                                                                                               |
| `npm audit --audit-level=moderate`             | Zero vulnerabilidades                                                                                                                                                                                                       |
| Prettier e `git diff --check`                  | Aprovados; não existe script ESLint no projeto                                                                                                                                                                              |

Auditoria automatizada usa axe com tags WCAG 2 A/AA, 2.1 AA e 2.2 AA. O JSON em [evidence/after/audit.json](evidence/after/audit.json) registra as telas, achados, overflow, verificações de interação e contagem de filtros. Capturas complementam a auditoria; ausência de violações automáticas não equivale a certificação integral WCAG.

## Correções confirmadas

| Severidade | Problema                                            | Evidência/correção                                                             |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1         | Configurações e saída da sessão ocultas no celular  | Navegação revelada e teste de saída executado em 390 px                        |
| P1         | Conteúdo da sidebar inacessível com texto ampliado  | Sidebar rolável, sem encolhimento de filhos; navegação testada a 200%          |
| P2         | Alvos pequenos dos botões de cartão                 | 36 px no desktop, 44 px no celular; regras mobile corrigidas na origem         |
| P2         | Contraste/arte sobreposta no hero mobile            | Arte ocultada nas larguras menores; texto de UI centralizado em cores legíveis |
| P2         | Navegação rolável sem foco quando desabilitada      | Região de navegação focável e nomeada                                          |
| P2         | Tab podia sair do dialog para o chrome do navegador | Ciclo explícito, teste Tab/Shift+Tab e restauração de foco                     |
| P2         | Overflow de métricas após aumento de fonte          | Colunas `minmax(0, 1fr)`, quebra de texto e largura mínima zero                |
| P2         | Contraste de seleção na nova variante de navegação  | Token de texto ativo escurecido e matriz repetida                              |

O primeiro CI também detectou contraste insuficiente durante o fade de entrada do dialog. O fade foi removido: a entrada conserva opacidade constante e usa apenas deslocamento. A matriz adicional audita um quadro intermediário da animação em cada viewport; a auditoria original foi mantida.

Sem P0/P1 conhecidos em aberto no escopo testado. Os achados acima foram reproduzidos e corrigidos, não presumidos. A linha de base de 24 telas fica em [evidence/before/audit.json](evidence/before/audit.json).

## Desempenho e limites

A biblioteca tem dois elementos com backdrop filter: header e sidebar. Cartões e demais painéis usam reflexos estáticos. O dialog e seu scrim acrescentam filtros apenas quando abertos; opacidade reduzida/fallback remove os filtros por completo. Não há fonte externa, nova dependência ou animação contínua do ambiente. As suítes de navegador também exigem zero solicitações externas e zero exceções JavaScript.

Os tempos de navegação no JSON são observações locais do Chromium sem throttling, **não** medição de LCP/INP ou promessa de desempenho em aparelhos reais. Não foi executado Lighthouse nem profiling de GPU em hardware móvel. O bundle principal JS passa de 336,96 KB / 104,17 KB gzip na base para aproximadamente 338,55 KB / 105,16 KB gzip; o acréscimo é inferior a 1 KB gzip. CSS final: 44,06 KB / 8,07 KB gzip. CSS de UI cresceu com o vocabulário semântico e os materiais; não foram incluídas bibliotecas visuais.

Não verificável nesta sessão: Safari/Firefox reais, navegador antigo sem backdrop-filter, leitor de tela humano e GPU de celular. O ramo de fallback está implementado com `@supports`; os valores opacos compartilhados foram exercitados no Chromium, sem alegar que isso simula outro motor. São limites de validação, não falhas confirmadas.

MagicPath não expôs ferramentas; foram realizados três estudos CSS locais. `DESIGN.md` não existe no checkout. Render/Supabase foram inspecionados apenas em leitura: último deploy live na base, dez logs de build sem entradas de nível error/fatal; bucket privado PNG/5 MB e esquema existente acessíveis por MCP. Consulta da API de configuração de Auth retornou HTTP 403; não foi necessária à implementação da interface.

## Entrega

Código integrado, documentação, matriz automatizada no CI e capturas antes/depois na branch de redesign. PR em rascunho para revisão; publicação permanece pendente de aprovação explícita, conforme o briefing.

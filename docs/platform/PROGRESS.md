# Evolução da plataforma — 11/10/2026

## Escopo confirmado

O usuário confirmou nesta execução: priorizar editor, modelos e assinatura; preparar o diagnóstico SaaS para a próxima fase. Não habilitar contas/workspaces nem migrar a produção para multi-tenancy nesta entrega. As propostas nos anexos foram confrontadas com o código real: o produto já tem backend, autenticação pessoal, banco, Storage, 15 presets e design system. Preservar essas capacidades, sem reconstruir uma aplicação estática.

## Baseline e problemas

Baseline: `main` em `617b798`, checkout limpo, 21 testes de API/domínio + 4 OAuth aprovados. Exportação Gmail 600×160 com dados fictícios registrada fora do checkout em `/workspace/identify-evolution-baseline`.

| Prioridade | Evidência confirmada                                                                 | Correção                                                             |
| ---------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| P1         | QR Byte usava bytes de caracteres truncados; URLs Unicode podiam perder conteúdo     | UTF-8 explícito e decoder independente sobre raster                  |
| P1         | Exportação com referência de imagem não resolvida usava monograma silenciosamente    | Recusa explícita na exportação gráfica; HTML continua texto/links    |
| P2         | Assinatura padrão escura/sans não correspondia à linguagem da referência             | Três modelos novos com composição clara e hierarquia serif/mono/sans |
| P2         | Edição só tinha versões persistidas, sem desfazer alterações locais                  | Histórico compartilhado em ativo, identidade e modelo                |
| P2         | Foto opaca cobria o anel de destaque                                                 | Moldura desenhada acima dos pixels da foto                           |
| P2         | Não havia ajustes reversíveis de cor e rotação da foto                               | Filtro SVG e rotação compartilhados pela prévia/exportação           |
| P2         | Interface não sinalizava contraste insuficiente, blocos fora do quadro ou QR pequeno | Avisos estimados compartilhados e explicação de seus limites         |
| P2         | README ainda descrevia apenas quatro presets e upload de 1600 px                     | Documentação alinhada à implementação                                |

## Decisões

Sem migration de banco. Campos novos têm defaults neutros no parser, preservando registros e JSON anteriores. Os novos modelos são adicionais; IDs/modelos antigos permanecem. Os controles usam tokens da interface existente; o material não recebe Liquid Glass.

A identidade continua sendo um snapshot por ativo: aplicação de alterações é explícita e recuperável pelo histórico. Não foi implementada herança dinâmica de campos. O modo de camadas livres, ajuste automático avançado de texto, edição direta no canvas e remoção de fundo não são recursos desta etapa.

Desfazer/refazer: até 100 snapshots em memória; edições contínuas do mesmo campo são agrupadas por até 650 ms. Salvar/restaurar uma versão reinicia o histórico local, mantendo revisões persistidas. Isso não desfaz exclusões no servidor.

O novo modelo mantém foto circular, destaque rosa, nome serifado, sobretítulo mono com `//`, competências e QR em cartão. Foto ausente reorganiza a posição inicial do texto quando ocultada pelo controle de layout. O alinhamento por sliders permanece disponível. A imagem de referência tem 750×200; o modelo usa 600×160, mesma proporção, exportação padrão 2×. Não se promete correspondência pixel a pixel: fontes de sistema, texto e foto podem variar.

`jsqr` é dependência exclusivamente de desenvolvimento, utilizada para decodificar os PNGs nos testes, não no bundle. A geração continua usando o gerador MIT existente.

## Qualidade e limites

Avisos de contraste consideram a cor base; não certificam texto sobre gradientes ou imagens. Limites de texto seguem a quebra do renderer, mas sobreposições são estimadas; não há inspeção universal de todas as camadas. Avisos não bloqueiam escolhas criativas; entradas inválidas e imagens ausentes impedem exportação gráfica. QR verifica resolução estimada e é decodificado nos testes; o envio real ao Gmail exige conferência no tamanho de exibição.

As fotos originais não são alteradas pelos ajustes. Upload/normalização acontecem no servidor e armazenamento privado; renderização dos ajustes e rasterização da exportação acontecem no navegador. Nenhuma imagem é enviada a serviço de edição externo.

## Integrações inspecionadas

GitHub: leitura Git autenticada e CLI disponíveis. Render e Supabase: chamadas oficiais autenticadas disponíveis no ambiente, consultadas em leitura; Render `identify` ativo em `main`, Supabase `Identify` `ACTIVE_HEALTHY`. As oito tabelas da aplicação têm RLS. A leitura da configuração Supabase Auth retornou 403 e não foi contornada. Ferramentas nativas MagicPath não estão expostas; implementação usa componentes existentes.

Resultados finais dos testes e publicação são registrados no relatório de entrega, distinguindo execução local e produção.

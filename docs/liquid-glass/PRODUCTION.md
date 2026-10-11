# Publicação do Liquid Glass

Validação executada em 11/10/2026 em **https://identify-efsf.onrender.com**. A interface Aurora foi integrada por merge no commit `642e6265733cf814948354314b40c5a136534fb4`, preservando o histórico, inclusive `bc415677e409ce82f73d784185bc993ac888f34e`. O PR [#6](https://github.com/https-shini/signature-banner/pull/6) foi integrado e sua branch removida; somente `main` permanece no GitHub.

## Verificações antes da publicação

Revisão dos componentes, tokens, CSS, contratos de API, configurações, CI e dependências. Backend, modelos compartilhados, migrations e lockfile permaneceram inalterados. Build TypeScript/Vite, 13 testes de API/domínio, 4 de OAuth, 11 fluxos E2E e 40 capturas da matriz visual passaram. Prettier e `git diff --check` aprovados; auditoria npm sem vulnerabilidades. CI da integração: [38125709760](https://github.com/https-shini/signature-banner/actions/runs/38125709760), aprovado com artefato `browser-validation`. Workflow legado de Pages também aprovado.

Render inspecionada por cliente oficial autenticado: serviço `identify`, branch `main`, deploy automático desativado, plano Free, health check `/healthz`, Node 24, build `npm ci --include=dev && npm run build`, início `npm start`. As variáveis privadas necessárias estavam presentes, sem alteração de valores. PostgreSQL usa TLS com validação de certificado. Supabase `Identify`, referência `cdjpvlolpxzcrvufmeou`, respondeu `ACTIVE_HEALTHY`; bucket `identity-studio` privado, PNG normalizado, limite 5 MB. Recursos existentes reutilizados; nenhum upgrade ou recurso adicional.

O deploy da interface `dep-db5kolcs728c7385pp80` foi confirmado como `live`, no commit da integração. Os três bundles JS/CSS servidos corresponderam byte a byte ao build revisado. Token de acesso, chave service-role e conexão PostgreSQL não constam nesses arquivos. Consulta de logs de build/aplicação filtrada por error/fatal durante essa publicação retornou zero entradas; isso não representa garantia sobre todo o histórico do serviço.

## Testes em produção

12 verificações passaram, zero falhas na execução final:

- HTTPS `/healthz` e consulta autenticada de disponibilidade PostgreSQL.
- Ausência/chave incorreta recusadas com 401; origem externa recusada com 403.
- Login real na interface com a chave pessoal existente.
- Criação de contexto isolado e salvamento de identidade reutilizável.
- Criação, edição e salvamento de banner, com histórico de versões.
- Downloads PNG, JPEG, WebP e SVG reais; raster decodificado em 1200×320.
- Upload PNG no Storage privado; acesso público recusado; seleção/zoom salvos e pixels da imagem confirmados na exportação PNG.
- Nova sessão independente recuperou identidade, banner e imagem persistidos.
- Editor e dialog de exportação em 1440, 834, 390 e 320 px: sem overflow horizontal nem violações axe WCAG 2/2.1/2.2 A/AA detectadas.
- Backup/importação aditiva de um único contexto de teste: nova identidade, imagem e histórico preservados.
- Zero exceções JavaScript durante os fluxos do navegador.
- Remoção somente dos contextos novos da validação; comparação completa das coleções confirmou preservação dos 2 contextos, 4 ativos, 2 imagens, 4 revisões e nenhum modelo anteriores. Bytes das imagens também comparados.

As primeiras tentativas do roteiro adicional corrigiram expectativas do próprio cliente de teste: a importação acrescenta ` · importado` ao nome, e DELETE sem corpo não deve enviar Content-Type JSON. O cliente da aplicação já respeitava esse comportamento. Um roteiro histórico também referenciava um banner ausente antes do deploy; a comparação foi substituída pela cópia privada dos dados atuais. Esses ajustes não exigiram alteração da aplicação, e a execução completa final passou.

## Evidências e limites

Resultados e capturas desta execução ficam em `/workspace/identify-glass-production-results/summary.json`, `bundles.json` e imagens PNG; não foram adicionados ao Git dados ou backups de produção. A matriz local reproduzível e suas capturas fictícias estão em [VALIDATION.md](VALIDATION.md) e `evidence/after/`. Componentes, tokens e decisões técnicas: [README.md](README.md).

Chromium real executou a interface; requisições HTTPS foram encaminhadas pelo transporte Node com validação TLS, pois o Chromium deste ambiente não reconhece a CA do proxy. Não foi desativada validação de certificados. Não foram executados Safari/Firefox, leitor de tela humano nem profiling em celular físico. Axe sem violações não equivale a certificação completa de acessibilidade. A Render Free pode hibernar; disponibilidade contínua não foi contratada nem prometida.

Os resultados descrevem o código e os fluxos observados nessa execução. Não constituem garantia de ausência de todos os erros futuros. Commits posteriores exclusivamente documentais exigem CI aprovado e confirmação do commit ativo na Render; o resumo final da tarefa registra o commit efetivamente publicado.

# Fase SaaS — implementação e validação isolada

## Baseline e plataformas

Branch principal `main`, commit inicial `5a1e3d1ae939005fe948650749245723c2275cad`. React/Vite, Fastify, PostgreSQL e Storage privado. Baseline: 28 testes passaram. A aplicação pessoal usa chave global; seus contextos não eram workspaces nem autorização.

APIs oficiais autenticadas de GitHub, Render e Supabase foram reutilizadas. Render: serviço existente ativo, main, autodeploy desativado. Supabase: ACTIVE_HEALTHY; consulta somente leitura confirmou schema 1, um perfil, três materiais e zero imagens. As exclusões legítimas anteriores foram preservadas. Nenhuma conta de teste, migração ou escrita SaaS em produção.

A configuração de Auth continua inacessível pela autorização disponível (HTTP 403). SMTP e redirects de produção não foram verificados. MagicPath e conectores nativos não estão expostos nesta sessão; nenhum código externo foi importado sem revisão.

## Implementado

- Auth individual: cadastro, login, logout, sessão persistente/refresh oficial, recuperação e redefinição. Callback PKCE explícito, uma troca por link; erro em link expirado/reutilizado. Chave pública validada no backend antes de divulgação; segredos não entram no bundle.
- Workspaces, membresia atômica do proprietário e projetos; criação/edição, contexto ativo, dashboard e materiais recentes. Só o proprietário é ativado; colaboração, convites e planos não são simulados.
- Migração 002 aditiva, registros antigos NULL e invisíveis, FKs compostas, RLS, privilégios de coluna, funções qualificadas com search_path fixo e EXECUTE restrito.
- Store compartilhado e editor preservados. Cada requisição verifica o JWT no Auth e opera como authenticated sem bypass em uma transação, com contexto local. Sem identidade residual no pool e sem chave global capaz de contornar SaaS.
- Bucket privado separado e prefixos por workspace; Storage acessado com JWT comum. Conteúdo normalizado, tipos/tamanhos limitados, compensação de uploads e limpeza física após commit. Imagens compartilhadas são protegidas contra exclusão enquanto referenciadas em outros projetos.
- Atribuição de legado revisável, dry-run, checksum e comparação ao backup, validação do proprietário e cópia de bytes. Não aplicada em produção. Original preservado; nenhuma restauração de exclusão legítima.
- UI Liquid Glass responsiva, AA verificada, movimento reduzido, guardas de rascunho e confirmação explícita da exclusão de identidade compartilhada em todos os projetos.

## Verificado localmente

- Build e tipagem estrita aprovados; 29 testes de API/domínio/configuração e quatro testes OAuth passaram.
- Oito grupos SaaS com duas contas reais: Auth, RLS, REST direto, Storage, manipulação de IDs/metadata/membresia, concorrência e pool, migração e e-mail/redefinição reais no ambiente isolado.
- Seis fluxos SaaS no Chromium: onboarding, workspaces/projetos, assinatura, upload, persistência, PNG 1200×320, rascunhos, contexto, segunda conta, conta/logout/login e callback PKCE, incluindo link consumido. Zero pageerrors; audits AA desktop/mobile sem violações.
- 16 fluxos existentes de navegador preservados; nenhuma requisição externa ou erro de console nessa experiência.
- Suíte visual: 40 capturas/audits, 16 verificações de navegação/preferências/recuperação; zero violações, overflow ou erros.
- npm audit: zero vulnerabilidades. Não há lint separado configurado; TypeScript estrito e verificações de formato/diff complementam os testes.

Evidências locais em `test-results/saas`, `test-results/liquid-glass` e logs da execução. A CI executa todas as suítes no push de main; seu resultado remoto e o commit correspondente são verificados e reportados no encerramento, não inferidos do build local.

## Ambiente reproduzível

A imagem PostgreSQL do stack completo via CLI falhou por espaço. Alternativa validada: PostgreSQL 17 Alpine, Auth GoTrue 2.196.0, Storage 1.74.0, PostgREST 14.17 e Mailpit 1.27.8 oficiais. Portas só loopback, credenciais aleatórias privadas em data/saas-local. Stack novo foi provisionado e testado sem correções SQL manuais. A prontidão de Auth/Storage e do schema REST é verificada por resposta real, sem ignorar health checks.

## Ativação pendente

Código preparado para revisão e evolução; SaaS não foi ativado em produção. Antes disso: SMTP/redirects verificáveis, backup restaurável, papel runtime restrito, revisão das policies existentes, migração explicitamente autorizada e definição do proprietário do legado. Não publicar com esses requisitos em aberto. Ver [MIGRATION.md](MIGRATION.md), [ARCHITECTURE.md](ARCHITECTURE.md) e [TESTING.md](TESTING.md).

A instrução direta de manter somente main prevalece sobre a sugestão dos anexos de branch dedicada/PR. Não foram criadas branches adicionais nem contratos pagos. O modo pessoal continua disponível para a infraestrutura atual; um banco migrado não aceita downgrade automático para schema 1.

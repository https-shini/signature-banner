# Fase SaaS — implementação e validação isolada

## Baseline e plataformas

Branch principal `main`, commit inicial `5a1e3d1ae939005fe948650749245723c2275cad`. React/Vite, Fastify, PostgreSQL e Storage privado. Baseline: 28 testes passaram. A aplicação pessoal usa chave global; seus contextos não eram workspaces nem autorização.

APIs oficiais autenticadas de GitHub, Render e Supabase foram reutilizadas. Render: serviço existente ativo, main, autodeploy desativado. Supabase: ACTIVE_HEALTHY; consulta somente leitura confirmou schema 1, um perfil, três materiais e zero imagens. As exclusões legítimas anteriores foram preservadas. As contas identificadas dos testes de e-mail foram removidas após validação; nenhuma migration ou associação de legado SaaS foi executada em produção.

O HTTP 403 foi diagnosticado: o OAuth do MCP não oferece `auth:read`/`auth:write`, exigidos para configuração Auth. Na ativação controlada, uma credencial administrativa disponibilizada pelo usuário em grupo protegido da Render permitiu GET/PATCH oficiais, ambos verificados. Site URL e redirects foram corrigidos para a origem de produção e os callbacks implementados, preservando confirmação obrigatória. MagicPath e conectores nativos continuam indisponíveis; APIs oficiais foram utilizadas.

O SMTP pessoal Gmail foi configurado com as seis variáveis protegidas, porta 587 e remetente `no-reply@gcruz.dev.br`, e confirmado por nova leitura da configuração Auth. Um cadastro de teste retornou HTTP 200; o destinatário autorizado confirmou entrega. Os cabeçalhos dessa mensagem mostram TLS 1.3, SPF pass para o envelope `gmail.com`, ausência de DKIM-Signature padrão e DMARC fail para o From `gcruz.dev.br`. X-Google-DKIM-Signature usa `1e100.net` e não autentica o domínio do From. SPF publicado inclui Google; DMARC publicado usa p=none, que permite monitoramento sem converter a falha em aprovação. Os logs Auth do intervalo mostram signup 200 e nenhuma entrada de erro SMTP. Isso comprova transporte/entrega, não alinhamento do domínio. O usuário mantém o SMTP pessoal e o remetente solicitado; a autenticação desse domínio continua pendente. O limite de dois e-mails por hora foi preservado. Não houve novo deploy nem teste de recuperação hospedada.

## Implementado

- Auth individual: cadastro, login, logout, sessão persistente/refresh oficial, recuperação e redefinição. Callback PKCE explícito, uma troca por link; erro em link expirado/reutilizado. Chave pública validada no backend antes de divulgação; segredos não entram no bundle.
- Workspaces, membresia atômica do proprietário e projetos; criação/edição, contexto ativo, dashboard e materiais recentes. Só o proprietário é ativado; colaboração, convites e planos não são simulados.
- Migração 002 aditiva, registros antigos NULL e invisíveis, FKs compostas, RLS, privilégios de coluna, funções qualificadas com search_path fixo e EXECUTE restrito.
- Store compartilhado e editor preservados. Cada requisição verifica o JWT no Auth e opera como authenticated sem bypass em uma transação, com contexto local. Sem identidade residual no pool e sem chave global capaz de contornar SaaS.
- Bucket privado separado e prefixos por workspace; Storage acessado com JWT comum. Conteúdo normalizado, tipos/tamanhos limitados, compensação de uploads e limpeza física após commit. Imagens compartilhadas são protegidas contra exclusão enquanto referenciadas em outros projetos.
- Atribuição de legado revisável, dry-run, checksum e comparação ao backup, validação do proprietário e cópia de bytes. Não aplicada em produção. Original preservado; nenhuma restauração de exclusão legítima.
- UI Liquid Glass responsiva, AA verificada, movimento reduzido, guardas de rascunho e confirmação explícita da exclusão de identidade compartilhada em todos os projetos.

## Verificado localmente

- Build e tipagem estrita aprovados; 30 testes de API/domínio/configuração/logging passaram após a correção necessária do registro de callbacks. Os quatro testes OAuth anteriores permanecem como baseline; a CI executa a suíte completa no commit novo.
- Oito grupos SaaS com duas contas reais: Auth, RLS, REST direto, Storage, manipulação de IDs/metadata/membresia, concorrência e pool, migração e e-mail/redefinição reais no ambiente isolado.
- Seis fluxos SaaS no Chromium: onboarding, workspaces/projetos, assinatura, upload, persistência, PNG 1200×320, rascunhos, contexto, segunda conta, conta/logout/login e callback PKCE, incluindo link consumido. Zero pageerrors; audits AA desktop/mobile sem violações.
- 16 fluxos existentes de navegador preservados; nenhuma requisição externa ou erro de console nessa experiência.
- Suíte visual: 40 capturas/audits, 16 verificações de navegação/preferências/recuperação; zero violações, overflow ou erros.
- npm audit: zero vulnerabilidades. Não há lint separado configurado; TypeScript estrito e verificações de formato/diff complementam os testes.
- O logger real foi testado em processo separado: antes da correção, registrava código e estado OAuth fictícios na URL; depois, preserva método, caminho e status sem query, Authorization ou Cookie. O handler 404 também evita a mensagem padrão que repetia a URL completa.

## Backup e ensaio da ativação

A conexão PostgreSQL direta deste ambiente foi recusada. A alternativa autorizada foi um snapshot atômico de dados e catálogo pela Management API em modo somente leitura. O backup SQL reconstruído preserva as oito tabelas, IDs, payloads, constraints, índices, proprietários e RLS; ACLs e configuração externa foram inventariados separadamente. Não se trata de um pg_dump completo do projeto Supabase.

Cinco verificações passaram no banco isolado: restauração exata, equivalência do backup da aplicação, migration 002 idempotente preservando o legado, dados não atribuídos invisíveis ao papel authenticated e retorno operacional à versão 1 mantendo o delta da versão 2 em outro schema. O inventário de Storage tinha zero objetos, portanto não havia bytes de imagens para copiar ou restaurar. Backups e credenciais estão em arquivos privados fora do repositório. Antes do cutover, atualizar e comparar o snapshot com o estado corrente.

A administração SQL possui CREATE/REFERENCES necessários. A criação de policies em storage.objects usa o grant específico da extensão oficial supautils, confirmado na configuração hospedada; não foi ampliada a membresia em papéis de sistema. Isso confirma o requisito de configuração, sem afirmar que a migration foi executada em produção.

Evidências locais em `test-results/saas`, `test-results/liquid-glass` e logs da execução. A CI executa todas as suítes no push de main; seu resultado remoto e o commit correspondente são verificados e reportados no encerramento, não inferidos do build local.

## Ambiente reproduzível

A imagem PostgreSQL do stack completo via CLI falhou por espaço. Alternativa validada: PostgreSQL 17 Alpine, Auth GoTrue 2.196.0, Storage 1.74.0, PostgREST 14.17 e Mailpit 1.27.8 oficiais. Portas só loopback, credenciais aleatórias privadas em data/saas-local. Stack novo foi provisionado e testado sem correções SQL manuais. A prontidão de Auth/Storage e do schema REST é verificada por resposta real, sem ignorar health checks.

## Ativação pendente

O mecanismo Auth hospedado foi verificado com sete chamadas funcionais/negativas: senha inválida, login, identidade da sessão, rotação do refresh token, logout, refresh após logout e JWT inválido. Todas passaram. A conta de teste foi previamente confirmada, não recebeu e-mail nessa execução e foi removida; o inventário voltou a zero usuários. Os dados atuais das oito tabelas continuam iguais ao backup restaurado no ensaio. Isso não ativa o frontend SaaS nem comprova confirmação/recuperação de produção. Ver [HOSTED-AUTH-VALIDATION.md](HOSTED-AUTH-VALIDATION.md).

SaaS não foi ativado em produção. O bloqueio atual é a autenticação do domínio do remetente: o SMTP funciona, mas a mensagem real falhou em DMARC. Corrigir o alinhamento no transporte/provedor, verificar novos cabeçalhos e validar confirmação/recuperação e capacidade antes de liberar usuários públicos. Backup e rollback foram ensaiados, mas papel runtime, migration, novo bucket e variáveis SaaS ainda não foram aplicados no projeto hospedado. A titularidade do legado não foi confirmada: é possível preservar os registros sem associação para ativar contas novas após os demais requisitos; nenhum cadastro recebe os dados antigos automaticamente. Não publicar com requisitos de Auth/segurança em aberto. Ver [MIGRATION.md](MIGRATION.md), [ARCHITECTURE.md](ARCHITECTURE.md) e [TESTING.md](TESTING.md).

A instrução direta de manter somente main prevalece sobre a sugestão dos anexos de branch dedicada/PR. Não foram criadas branches adicionais nem contratos pagos. O modo pessoal continua disponível para a infraestrutura atual; um banco migrado não aceita downgrade automático para schema 1.

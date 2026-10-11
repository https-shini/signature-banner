# Migração e ativação revisáveis

A migração `server/migrations/002_saas.sql` é aditiva. Não apagar/recriar as tabelas atuais. Antes de produção, obter backup PostgreSQL e cópia dos objetos privados, validar restauração isolada e guardar checksums/inventário em local privado. Não executar 002 no startup.

## Fundação

`provisionSaas` em `scripts/provision-saas.ts` aplica 002 em transação, com lock e versão; a chamada administrativa deve ser autorizada para o destino escolhido. Em teste, o runner limita o destino a loopback. Papel runtime: LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS; conceder apenas membresia no papel authenticated, USAGE no schema e SELECT em schema_migrations. Não tornar esse login dono das tabelas.

Confirmar que o bucket `identify-workspaces` não existe antes da primeira aplicação: o provisionamento falha por conflito em vez de adotar políticas desconhecidas. Ele é privado, PNG, limite 5 MB. O bucket pessoal não é alterado. Revisar policies preexistentes de storage.objects: políticas permissivas globais que alcancem qualquer bucket invalidam o isolamento e devem impedir a ativação até revisão.

No projeto hospedado, a aplicação acessa PostgreSQL diretamente; não é necessário expor identity_studio na Data API. Se o schema estiver exposto, os mesmos testes REST e permissões precisam passar. Na instalação isolada ele é exposto para testar ataques diretos. Usuários não possuem UPDATE dos vínculos/propriedade; criação via interface é atribuída pela transação verificada.

## Atribuição explícita de legado

`scripts/claim-legacy.ts` fornece `claimLegacy`: dry-run por padrão. O manifesto identifica userId, workspaceId, projectId, profileIds e SHA-256 do backup JSON. Validar o usuário cadastrado e a propriedade real do workspace/projeto; comparar payloads atuais ao backup e bytes de cada imagem. `apply=true` é uma ação administrativa explícita, jamais disparada por cadastro, login ou migração.

Copiar objetos para o prefixo do workspace, sem apagar os originais. Atualizar os vínculos em uma transação. Em falha, compensar as cópias; as originais permanecem disponíveis para recuperação. IDs, documentos, versões e metadados são preservados. Uma atribuição já feita é recusada. O script não restaura dados apagados legitimamente pelo usuário.

Dados não atribuídos continuam NULL e invisíveis para contas comuns. Não usar o primeiro cadastro como proprietário automático. Backups JSON versão 1 continuam importáveis no projeto ativo como novos IDs. O backup da interface SaaS inclui o projeto ativo e os kits/modelos/imagens do workspace, não exporta outros projetos nem membresia; para recuperação completa do SaaS usar dump + objetos Storage.

## Retorno ao modo pessoal

Antes de qualquer atribuição, o backup preserva a versão anterior. Depois de aplicar 002, a aplicação pessoal recusa schema de versão 2 deliberadamente. Não alternar AUTH_MODE em um banco migrado esperando downgrade automático. Recuperação operacional exige implantação anterior com o banco/objetos restaurados em destino isolado e roteamento revisado; nunca remover colunas/workspaces em produção para esconder erro. Após novos usuários terem dados, preservar/exportar esse delta antes de qualquer recuperação.

## Pendências externas reais

A API autenticada de configuração de Auth respondeu 403 nesta execução; não foi confirmado SMTP ou redirects de produção. Não ativar SaaS sem:

- SMTP adequado, remetente autorizado e confirmação/recuperação testadas, respeitando limites do provedor.
- Redirects exatos para origem publicada e `/auth/callback`, incluindo `/auth/callback?intent=recovery`, e política de confirmação revisada.
- `AUTH_MODE=saas`, URL e chave anon públicas verificadas, DATABASE_URL de login restrito, TLS/CA válidos e `STORAGE_DRIVER=supabase`; bucket padrão `identify-workspaces`.
- Backup verificável, migração explicitamente autorizada e decisão de proprietário do legado.
- CI e testes isolados aprovados; saúde e fluxos reais após ativação.

Não solicitar senhas/tokens no chat. Configuração e aprovação devem usar os mecanismos oficiais das plataformas. O relatório distingue implementação em main de ativação em produção.

# Ambiente e testes SaaS

Use o checkout existente; a tarefa na nuvem já é isolada. Não criar worktree. Node 24, Docker/Compose, Chromium e dependências do lockfile são pré-requisitos. O PostgreSQL pessoal de desenvolvimento usa 54329; o stack SaaS usa 54322 e portas próprias, somente em 127.0.0.1.

`npm run saas:local` gera credenciais locais aleatórias em `data/saas-local/stack.env` (0600), inicia PostgreSQL 17 Alpine, Auth GoTrue 2.196.0, Storage 1.74.0, PostgREST 14.17 e Mailpit 1.27.8. Imagens oficiais, sem desabilitar TLS ou checksums. O proxy local apenas roteia os serviços e permite CORS nas origens de teste 3000/3080; não gera sessões, não substitui Auth ou RLS. E-mails de teste são entregues no Mailpit, não a destinatários externos. Esses parâmetros de SMTP/autoconfirmação são locais, não configuração de produção.

`npm run test:saas` limita endpoints a loopback, provisiona o schema explicitamente, cadastra dois usuários reais e usa JWTs comuns para testar a API, REST e Storage. O papel da aplicação não é proprietário das tabelas nem bypass-RLS. A conexão administrativa prepara fixtures/migrações e verifica contagens; ela não comprova autorização.

`npm run build` e `CHROMIUM_PATH=/usr/bin/chromium npm run test:saas:browser` exercitam o frontend compilado em 3080. O runner abre cadastro, workspace, projeto, identidade, assinatura, upload, persistência, PNG, alternância, segunda conta, logout/login e recuperação por link real com PKCE; axe verifica WCAG AA, com capturas desktop/mobile. Artefatos em test-results/saas ficam ignorados pelo Git; não imprimir status.json ou stack.env.

As suítes existentes continuam necessárias: `npm test`, `node --test tests/cloud-oauth-relay.test.mjs`, `npm run test:e2e`, `npm run test:visual` e `npm audit --audit-level=moderate`. A CI executa ambas as experiências. Não substituir falhas por testes desativados nem usar service-role para demonstrar isolamento.

`node scripts/saas-local.mjs down` encerra apenas o stack próprio e seu gateway, preservando volumes. Não usar down -v, reset ou exclusão de volume em dados de usuário. Testes locais criam contas e workspaces de fixture somente nesse stack, nunca no Supabase hospedado. Para uma repetição do zero, use um destino isolado novo e suas credenciais próprias; não aplicar bootstrap de teste em produção.

# Desenvolvimento e testes

Use Node 24 e `npm ci`. A API exige PostgreSQL; não há banco em memória no runtime. A aplicação carrega `.env` apenas no backend. Variáveis não têm prefixo `VITE_`, evitando que segredos entrem no bundle.

## Banco local

`docker compose up -d postgres` inicia PostgreSQL 17 na porta loopback 54329 e mantém o volume `identity-postgres`. Se essa porta já estiver ocupada, reuse o banco adequado ou ajuste o Compose e `DATABASE_URL`; não encerre serviços desconhecidos. A configuração local sem senha não serve para produção. Destruir o volume apaga seus dados de desenvolvimento.

Copie `.env.example` para `.env` e execute `npm run dev` e `npm run dev:client` em sessões distintas. Para reproduzir o serviço de produção com banco local, use `npm run build` e `npm start`. O backend serve `dist/` se o build existir no momento da inicialização; reinicie a API após o primeiro build.

No modo pessoal, a migração inicial é executada no startup, em transação e com advisory lock. O primeiro startup importa o conteúdo real do antigo `config.js` para um perfil profissional e três ativos. Essa inicialização acontece uma vez; excluir os perfis não faz os dados reaparecerem ao reiniciar.

## Testes

- `npm run typecheck`: TypeScript estrito.
- `npm test`: testes de API e domínio contra PostgreSQL real, arquivos normalizados, backup, versões, conflitos, referências e renderer.
- `npm run build`: valida tipagem e compila o frontend.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`: navegador real, API própria e schema isolado; testa login, edição, imagens, downloads, backup, contextos, layout móvel e axe.
- `npm audit --audit-level=moderate`: auditoria de dependências.

Defina `TEST_DATABASE_URL` apontando **somente para um banco de desenvolvimento/testes**. Cada execução usa schemas aleatórios, eliminados em `finally`; não altera o schema da aplicação. A suíte de API usa um adaptador de objetos em memória para isolar a camada de Storage e imagens reais via Sharp. Os testes de navegador usam arquivos temporários. Eles não comprovam uma conexão com Supabase Storage: essa verificação requer credenciais e deve ocorrer separadamente.

O Chromium é um requisito de teste, não uma dependência da aplicação. Em máquinas sem navegador, `npx playwright-core install chromium` instala a versão correspondente ao pacote; informe o executável em `CHROMIUM_PATH`. A CI define os mesmos serviços e verificações.

## Fluxos e contratos

No modo pessoal, rotas privadas sob `/api` exigem `Authorization: Bearer <chave>` quando configurado. `/healthz` é público e faz uma consulta real ao PostgreSQL. Respostas privadas não são cacheadas. A API retorna 400 para dados inválidos, 401 para acesso inválido, 403 para origem cruzada, 404 para recursos ausentes e 409 para conflito de versão ou exclusão de imagem referenciada.

Rotas principais: `GET/POST /api/profiles`, `PUT/DELETE /api/profiles/:id`, `GET/POST /api/assets`, `PUT/DELETE /api/assets/:id`, `POST /api/assets/:id/duplicate`, `GET /api/assets/:id/revisions`, `POST /api/assets/:id/restore`, `/api/templates`, `/api/media`, `GET /api/backup`, `POST /api/import` e `POST /api/import/legacy`.

Exportar imagem usa o documento atual, inclusive alterações ainda não salvas. Exportar projeto JSON cria um snapshot portátil v1, com imagens necessárias ao projeto e ao kit. Backup completo preserva todo o histórico. Importar JSON cria novos contextos para preservar os atuais; não é um restore destrutivo.

## Repositório

`legacy/` preserva os arquivos anteriores e não entra no build. Não edite o vendor de QR sem manter sua licença. `data/`, `dist/`, `.env`, dependências e resultados de teste são ignorados pelo Git. Use `npx prettier --write client server shared/model.ts shared/render.ts tests docs` para formatar os módulos próprios; o vendor e o legado são excluídos.

Tarefas na nuvem já são isoladas. Utilize o checkout existente; não crie um Git worktree sem solicitação explícita.

## SaaS isolado

Consulte [docs/saas/TESTING.md](saas/TESTING.md) para o stack oficial reduzido, Auth/Storage reais e testes com duas contas. `AUTH_MODE=saas` usa JWT individual, workspaces e projetos; não aceita a chave global, não usa service-role no runtime e exige provisionamento explícito. [Migração e ativação](saas/MIGRATION.md) descrevem backup, vínculo do legado e requisitos de produção. `/api/auth/config` é público e divulga apenas modo, URL e chave pública validada.

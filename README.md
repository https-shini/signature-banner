# Identity Studio

Central pessoal de identidade visual: gerencie banners, assinaturas de e-mail e fotos de perfil com contextos separados, biblioteca de imagens, modelos, histórico e exportação. Evolução do Signature Banner, cujo código original permanece em [`legacy/`](legacy/).

## Arquitetura

- **Frontend:** React 19, TypeScript e Vite. Interface em português, responsiva e sem fontes, analytics ou CDNs externos.
- **API:** Fastify com contratos Zod compartilhados, validação de arquivos e autenticação por chave pessoal.
- **Persistência:** PostgreSQL. Produção usa Supabase; não usa SQLite nem o disco efêmero da Render para dados.
- **Imagens:** Supabase Storage privado em produção. Sharp normaliza uploads PNG/JPEG/WebP e remove metadados; os arquivos não ficam dentro do banco.
- **Renderização:** SVG compartilhado entre preview e exportação. Rasterização no navegador para PNG/JPEG/WebP; HTML seguro com links para assinaturas.
- **Deploy:** um Web Service gratuito na Render serve frontend e API na mesma origem, sem CORS ou URL de API embutida no bundle.

Leia o [diagnóstico e as decisões](docs/ARCHITECTURE.md), o [guia de desenvolvimento](docs/DEVELOPMENT.md) e o [guia de implantação](docs/DEPLOYMENT.md).

## Desenvolvimento

Requer Node **24**, npm e PostgreSQL **17**. Docker é uma opção para o banco local.

```bash
npm ci
docker compose up -d postgres
cp .env.example .env
npm run build
npm start
```

O servidor local escuta na porta 3000. Para atualização automática, use `npm run dev` para a API e `npm run dev:client` em outra sessão para o frontend (porta 5173). O Vite encaminha `/api` para a API local.

O Docker permite acesso sem senha **somente na interface loopback**, para desenvolvimento. Não o exponha na rede. Na nuvem, use as credenciais do Supabase no backend. `.env` e `data/` são ignorados pelo Git.

## Funcionalidades implementadas

- CRUD de contextos e ativos; duplicação, busca por nome/tags, favoritos, filtros e ordenação.
- Presets de LinkedIn (1584×396), assinatura (600×180), banner (1200×320) e avatar (800×800), com dimensões editáveis.
- Editor de conteúdo, paleta, fontes locais, composição, espaçamento, posição, QR Code e seleção de fotos/logos; zoom e deslocamento da foto.
- Identidade reutilizável: novos ativos herdam o kit; atualizar ativos existentes é uma ação explícita.
- Modelos prontos e personalizados; salvar, duplicar, renomear e criar ativos a partir de modelos.
- Cada salvamento gera uma revisão; restauração cria outra revisão e conflitos concorrentes retornam HTTP 409.
- Exportação PNG/JPEG/WebP/SVG com resolução, qualidade e proporção; assinatura HTML com contatos clicáveis.
- Backup JSON de contextos, imagens, modelos e revisões; restauração aditiva com novos IDs, validação de referências e transação PostgreSQL.
- Exportação de projeto e importação das configurações v3 do Signature Banner.

## Validação

Com o PostgreSQL local ativo:

```bash
npm run build
npm test
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
npm audit --audit-level=moderate
```

Os testes de API usam schemas exclusivos no PostgreSQL real, eliminados ao terminar. Os testes de navegador iniciam sua própria API, validam fluxos e downloads, verificam acessibilidade com axe e salvam evidências em `test-results/`. Nunca use credenciais de produção nos testes; configure `TEST_DATABASE_URL` para um banco dedicado.

## Limites

Esta versão é para uma pessoa com vários contextos; não é um serviço multiusuário. A chave pessoal é exigida em produção e fica na sessão do navegador após login. Credenciais de Supabase nunca são enviadas ao frontend. Use HTTPS e mantenha backups fora dos serviços hospedados.

Uploads: até 5 MB, 16 megapixels, imagens estáticas normalizadas para até 1600×1600. Exportações: até 8000 px por lado e 40 megapixels. Importação: até 24 MB. Para bibliotecas maiores, veja [backup e recuperação](docs/DEPLOYMENT.md#backup-e-recuperação).

O HTML da assinatura exporta texto e links com tabela e estilos inline; a composição gráfica completa, fotos e QR ficam nas imagens exportadas. A aplicação não instala assinaturas automaticamente no Gmail nem publica capas no LinkedIn. Textos longos podem receber reticências: confira o preview. Fontes próprias, camadas livres, integrações OAuth e colaboração ficam para etapas futuras.

## Implantação

O Blueprint [`render.yaml`](render.yaml), o adaptador de Supabase Storage e as migrations estão preparados. Publicação e validação no Supabase/Render dependem de acesso autenticado a essas contas. Esses arquivos não comprovam deploy ou configuração externa concluída. Veja o [registro de validação](docs/VALIDATION.md).

## Licença

MIT. O gerador de QR Code de Kazuhiko Arase foi reaproveitado com seus avisos e licença preservados em `shared/qrcode.js` e `LICENSE`.

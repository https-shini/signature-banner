# Render gratuita e Supabase

## Configuração preparada e acesso necessário

`render.yaml` define um único Web Service **plan: free**, com build `npm ci --include=dev && npm run build`, startup `npm start` e health check `/healthz`. Frontend e backend usam a mesma URL pública; os endpoints ficam sob `/api`. A porta vem de `PORT`, definida pela Render, e o processo escuta em `0.0.0.0`.

Antes de criar serviços, consulte os projetos e serviços existentes pelas integrações autorizadas, confira plano e cotas e reuse os recursos adequados. Não habilite plano pago, disco persistente pago, faturamento ou upgrade automático. O Blueprint não cria um banco Render: o PostgreSQL gratuito da Render expira; a persistência deste projeto pertence ao Supabase.

Nesta tarefa, os plugins de Render/Supabase não foram expostos como ferramentas e não havia suas variáveis de autenticação no processo. Consultas sem autenticação às APIs de gerenciamento receberam HTTP 401. Não foram criados serviços externos, executadas migrations no Supabase nem publicados URLs de produção. Arquivos de configuração não são evidência de publicação.

## Variáveis do backend

| Variável                                  | Finalidade                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `NODE_ENV=production`                     | Ativa exigências de segurança/persistência                                 |
| `HOST=0.0.0.0` e `PORT` da Render         | Escuta compatível com o serviço                                            |
| `DATABASE_URL`                            | Conexão PostgreSQL do Supabase; prefira Session Pooler compatível com IPv4 |
| `DATABASE_SSL=true`                       | TLS com verificação de certificado                                         |
| `SUPABASE_URL`                            | URL do projeto reutilizado                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`               | Credencial privilegiada de Storage, só no backend                          |
| `SUPABASE_STORAGE_BUCKET=identity-studio` | Nome do bucket privado                                                     |
| `STORAGE_DRIVER=supabase`                 | Impede persistência acidental em disco efêmero                             |
| `APP_ACCESS_TOKEN`                        | Chave pessoal aleatória de ao menos 32 caracteres; Blueprint gera o valor  |

Cadastre segredos nos mecanismos seguros do serviço, nunca em Git, logs, frontend ou mensagens. A chave pessoal é informada na tela de login e mantida em `sessionStorage`. Para uma conta multiusuário, será necessário Supabase Auth e autorização por proprietário; a versão atual é pessoal.

## PostgreSQL, migrations e Storage

A conexão SQL cria apenas o schema `identity_studio`. A migration `server/migrations/001_initial.sql` é versionada e executada com transação/advisory lock no startup. Revise a conexão para garantir que pertence ao projeto correto. Não há reset, remoção de schemas alheios ou alterações de tabelas existentes.

RLS fica habilitado em todas as tabelas. Não crie políticas de acesso anônimo, não exponha esse schema no Data API e mantenha a conexão privilegiada somente no servidor. Use uma conexão suportada pelo Supabase com verificação TLS; não desative a validação de certificados para contornar falhas.

O adaptador verifica o bucket configurado antes de criar um novo. O bucket precisa ser **privado**, aceitar apenas PNG normalizado e ter limite de 5 MB por objeto. Objetos são identificados por `<perfil>/<imagem>.png`; nenhuma URL pública é necessária. Ao reutilizar um projeto, confira a capacidade e os objetos existentes antes de escolher o bucket. A API autenticada lê os objetos pelo backend.

## Validação após publicar

1. Verifique que build e startup terminaram; leia logs sem exibir segredos.
2. Faça `GET /healthz` na URL pública e confira HTTP 200 e `status: ok`.
3. Confira que `/api/profiles` recusa acesso sem chave e aceita uma sessão válida.
4. Crie um contexto e ativo de verificação, salve alterações, feche o navegador e confira os dados em nova sessão.
5. Faça upload de uma imagem, associe-a ao ativo e decodifique arquivos exportados. Confira o objeto no bucket privado.
6. Reinicie o serviço Render e confirme que ativo, imagem e histórico permaneceram no Supabase.
7. Exporte e importe um backup em contexto novo. Remova somente os registros de verificação que você criou após validar sua recuperação.
8. Registre URL, serviço, projeto, limites e resultados. Uma URL que responde a um health check não comprova todos esses fluxos.

## Limites gratuitos verificados

Documentação oficial consultada em 11/10/2026: [Render Free](https://render.com/docs/free) e [Supabase Pricing](https://supabase.com/pricing).

- Render: suspensão após 15 minutos sem tráfego; 750 horas de instância gratuita por workspace/mês; filesystem efêmero em restart/redeploy/suspensão. Requisições após inatividade podem demorar enquanto a instância acorda.
- Supabase Free: 500 MB de banco, 1 GB de arquivos, 5 GB de egress, limite de dois projetos ativos e possibilidade de pausa após uma semana de inatividade.

O aplicativo não usa artifícios para impedir suspensão nem promete disponibilidade contínua. Consulte o painel antes de criar recursos: cotas são compartilhadas com outros projetos. Erros de capacidade devem ser reportados, sem upgrades automáticos. Reduza mídias e mantenha backups; arquivos usados por versões antigas são preservados intencionalmente.

## Backup e recuperação

O backup JSON inclui todos os contextos, ativos, imagens, modelos e versões. A restauração da interface valida referências e tipos, reatribui IDs e importa em novos contextos. Dados atuais são preservados. Arquivos via API têm limite de 24 MB; não use JSON como única estratégia para bibliotecas maiores.

Para bibliotecas maiores, use `pg_dump`/restauração PostgreSQL e uma cópia correspondente dos objetos do bucket por mecanismos autenticados. Um dump do banco não inclui Storage. Interrompa gravações durante uma cópia entre serviços e valide a integridade/restauração em um ambiente separado. Mantenha backups versionados fora da Render/Supabase; não sobrescreva o banco em uso nem exclua recursos externos sem avaliação e autorização específica.

A fila `storage_cleanup` registra remoções pendentes e tenta novamente na inicialização e a cada minuto. Falhas na comunicação entre banco e Storage podem deixar objetos órfãos; monitore logs e a fila sem remover objetos referenciados. O startup não apaga dados para contornar inconsistências.

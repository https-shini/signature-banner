# Diagnóstico SaaS — próxima fase

## Estado real confirmado

O Identify é uma aplicação pessoal com vários contextos, não um SaaS multiusuário. React/Vite fala com Fastify na mesma origem. A API valida uma chave global de alta entropia; o servidor acessa PostgreSQL e Storage privado. O cliente não recebe credenciais privilegiadas. O schema `identity_studio` tem RLS, sem políticas para usuários individuais; a conexão privilegiada do backend não fornece isolamento multi-tenant.

Perfis atuais não são workspaces e os contextos não representam autorização. Não há cadastro, recuperação de senha, membresia, `workspace_id` ou isolamento entre contas. As novas telas não simulam esses recursos.

## Estratégia proposta

1. Preparar Supabase de teste isolado com Auth e Storage reais; realizar backup e inventário dos dados legados sem atribuir propriedade arbitrária.
2. Validar access tokens com mecanismos oficiais do Supabase no servidor. Todas as rotas exigem identidade individual; abandonar a chave global apenas quando todas as operações legítimas estiverem cobertas.
3. Introduzir workspaces/membros/projetos e vínculos no domínio por migrações aditivas. Registros legados sem proprietário permanecem inacessíveis a contas comuns. Atribuição exige decisão explícita de propriedade.
4. Usar conexão de banco com papel não privilegiado e contexto de JWT estabelecido em transação, ou Data API sob JWT individual. Não aceitar um `user_id` fornecido pelo cliente como identidade. Revisar pooling e limpeza de contexto entre requisições.
5. Aplicar RLS por workspace nas entidades e autorização no servidor. Evitar recursão de membros, fixar `search_path` de funções definer, revogar execuções desnecessárias, usar views invoker. Só o proprietário é ativado inicialmente.
6. Policies de Storage específicas, bucket privado, prefixos por workspace e acesso verificado. Um caminho que contenha um UUID não é autorização. Migrar objetos existentes somente com inventário, vínculo e recuperação verificados.
7. Testar com dois usuários comuns reais: CRUD indireto, trocas de IDs, associação indevida, importação, revisões, backup e objetos privados. Não usar service-role para comprovar isolamento.
8. Só depois construir cadastro/login/recuperação, seleção de workspace e projetos; reexecutar os fluxos do editor. Preparar publicação revisável com plano de recuperação.

## Pendências reais

O usuário deixou esta fase para depois. Não foram implementadas nem aplicadas migrations SaaS, políticas multi-tenant, contas, convites ou cobrança. Não foram criados usuários de teste no projeto de produção.

A consulta autenticada a `/config/auth` retornou HTTP 403; SMTP, URLs de redirecionamento e opções de confirmação não foram verificados. Precisam de acesso oficial apropriado na fase SaaS. Banco local PostgreSQL está disponível, mas não representa Supabase Auth/Storage reais e não comprova seus fluxos. Disponibilizar ambiente isolado sem custos não aprovados antes de executar testes de Auth/Storage.

Produção, dados antigos e mecanismo de acesso pessoal permanecem preservados nesta etapa. A plataforma atual não deve ser aberta a contas de terceiros como se já oferecesse isolamento por usuário.

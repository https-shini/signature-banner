# Auth hospedado: validação anterior à ativação

Em 11/10/2026, o mecanismo de Auth do projeto Supabase existente foi testado diretamente pelas APIs oficiais. Login e sessão funcionaram. Isso não equivale à ativação do aplicativo SaaS na Render.

## Escopo e resultados reais

A conta temporária usou o endereço de teste autorizado. A ausência de conta anterior foi verificada antes da criação. A API administrativa foi usada somente para criar uma fixture previamente confirmada e removê-la ao final. Login, leitura de usuário, renovação e logout usaram a chave pública e os tokens comuns dessa conta. Nenhuma mensagem foi enviada nessa execução.

| Verificação                     | HTTP | Resultado                                  |
| ------------------------------- | ---- | ------------------------------------------ |
| Senha inválida                  | 400  | Rejeitada: `invalid_credentials`           |
| Login com senha válida          | 200  | Usuário e papel `authenticated` conferidos |
| Identidade da sessão em `/user` | 200  | Corresponde à conta temporária             |
| Renovação da sessão             | 200  | Refresh token rotacionado                  |
| Logout global                   | 204  | Chamada aceita                             |
| Renovação após logout           | 400  | Rejeitada: `refresh_token_not_found`       |
| JWT inválido em `/user`         | 403  | Rejeitado: `bad_jwt`, sem dados do usuário |

As primeiras seis verificações terminaram às 12:58:50 UTC / 09:58:50 de Brasília. A sétima foi conferida novamente às 13:02:32 UTC / 10:02:32 de Brasília: o primeiro harness pressupunha HTTP 401, mas o Auth retorna HTTP 403 para esse JWT inválido. A resposta efetiva já rejeitava a requisição; corrigiu-se a expectativa do harness e repetiu-se somente essa leitura. Nenhuma mudança no produto foi necessária.

Depois dos testes, o marcador exclusivo e o ID da fixture foram conferidos antes da exclusão. A ausência foi confirmada por HTTP 404 e o inventário Auth voltou a zero usuários. Não houve associação ou alteração de dados legados. Senha e arquivo temporário de sessão foram descartados.

O teste comprova a revogação do refresh token após logout. Não comprova revogação imediata de um access token já emitido, nem cadastro com confirmação, recuperação PKCE, callbacks pelo site ou isolamento dos dados SaaS hospedados.

## Infraestrutura e preservação

A leitura final, às 13:09 UTC / 10:09 de Brasília, confirmou:

- Serviço Render `live`, sem suspensão e com autodeploy desativado; `/healthz` HTTP 200.
- Commit publicado `5a1e3d1ae939005fe948650749245723c2275cad`, anterior à aplicação SaaS.
- Requisições anônimas aos perfis HTTP 401. O caminho `/api/auth/config` também respondeu 401 na versão publicada; não se interpretou essa resposta como configuração pública do SaaS.
- Schema 1, um perfil, três materiais e três revisões; bucket SaaS ainda ausente.
- Hash do backup conferido e dados atuais das oito tabelas iguais ao snapshot cuja restauração foi ensaiada. Backup e credenciais continuam fora do Git.

Consultas administrativas de inventário não são evidência de isolamento entre usuários. Nenhuma migration, criação de papel runtime, novo bucket, alteração de variáveis SaaS ou deploy foi realizada nesta validação.

## Bloqueio de e-mail e próximos passos

O SMTP pessoal já está configurado e entregou a mensagem anterior, conforme os cabeçalhos recebidos. O bloqueio é o alinhamento do domínio: From `gcruz.dev.br`, envelope `gmail.com`, nenhuma assinatura DKIM padrão alinhada e `dmarc=fail`. Não faltam as seis variáveis SMTP. O remetente `no-reply@gcruz.dev.br` foi preservado conforme a escolha do usuário.

A consulta MX apontou `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net` e `route3.mx.cloudflare.net`. Esses registros descrevem recepção/encaminhamento; não demonstram transporte de saída nem assinatura DKIM do remetente. As ferramentas disponíveis administram Supabase e Render, mas não o assinador Gmail ou um provedor autenticado de envio para esse domínio.

Para manter o remetente solicitado, é necessário um transporte que produza DKIM alinhado com `gcruz.dev.br` ou um envelope alinhado com SPF aprovado. Não alterar apenas o SPF nem enfraquecer DMARC para ocultar a falha. Não substituir o remetente, desabilitar confirmação ou contratar serviços pagos sem autorização.

Após disponibilizar essa capacidade, a sequência é:

1. Repetir envio real, conferir os cabeçalhos e revisar o limite atual de dois e-mails por hora conforme a capacidade do provedor.
2. Atualizar o backup no início do cutover e aplicar a migration aditiva com o runtime restrito e o bucket privado. Manter o legado sem proprietário até confirmação explícita.
3. Configurar o modo SaaS, publicar a `main` aprovada e validar confirmação/recuperação pelo callback real, sessões, workspaces, isolamento, Storage, persistência e PNG em produção. Liberação depende da aprovação dessas verificações.

Ver [MIGRATION.md](MIGRATION.md) para as condições de migração e retorno. Enquanto o requisito do remetente permanece aberto, login/cadastro públicos no novo aplicativo continuam **BLOQUEADOS**, embora os sete testes do mecanismo Auth hospedado tenham passado.

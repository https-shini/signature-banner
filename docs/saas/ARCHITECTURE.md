# Fase 2 — arquitetura de isolamento

O editor React, os documentos JSON versão 1, os modelos e o renderizador continuam compartilhados. `AUTH_MODE=personal` mantém a aplicação pessoal existente; `AUTH_MODE=saas` exige Auth individual e nunca aceita a chave global. A configuração pública divulga somente URL e chave anon. Nenhuma migração SaaS é executada no startup.

## Fronteiras de autorização

Fastify verifica cada access token pelo `auth.getUser` oficial, recusa contas anônimas e deriva o usuário da resposta verificada. Cabeçalhos de workspace/projeto indicam contexto, não autorização. Antes de chamar a camada existente, o servidor confirma que o contexto está visível sob RLS.

Cada requisição tem uma transação e contexto `AsyncLocalStorage`, com papel `authenticated` sem `SUPERUSER`/`BYPASSRLS`, `request.jwt.claims` e variáveis de contexto locais à transação. `COMMIT`/`ROLLBACK` precedem a resposta; conexões retornam ao pool sem identidade residual. O Store SaaS recusa operações fora do contexto. Health check é uma consulta fixa sem dados pessoais.

Workspaces têm um proprietário real em `auth.users`; um trigger insere sua membresia atomicamente. Só proprietários têm poderes nesta entrega. Membros são somente leitura para sessões comuns. Colunas de propriedade e vínculos não têm privilégios de UPDATE; não é possível transferir um registro entre usuários por REST.

Funções booleanas de autorização usam `search_path=pg_catalog` e referências qualificadas; a função definer consulta a propriedade persistida, nunca `user_metadata`. Execução pública é revogada. Nenhuma view ignora RLS.

Perfis/modelos/imagens pertencem ao workspace. Materiais e revisões pertencem a um projeto e workspace. FKs compostas impedem associação a perfis/projetos estrangeiros. Dados antigos conservam vínculos NULL e ficam invisíveis para contas comuns. Os payloads e backups versão 1 permanecem compatíveis; importação atribui os novos IDs ao contexto autorizado atual.

## Objetos privados e consistência

O bucket SaaS `identify-workspaces` é separado do bucket pessoal. PNG normalizado, até 5 MB; caminho `workspace/perfil/imagem.png`. O servidor acessa Storage com a chave anon e o JWT do próprio usuário, nunca service-role. Policies próprias bloqueiam acesso estrangeiro e caminhos sem proprietário autorizado.

Uploads são compensados se a transação falhar antes do commit. Se a confirmação de COMMIT se perder por falha de conexão, os objetos são preservados: não é seguro apagar algo que o banco pode ter confirmado. Essa ocorrência exige reconciliação administrativa do inventário de objetos/metadados. A exclusão física ocorre somente após commit, usando fila durável por workspace; erros deixam a fila para nova tentativa autenticada. Nunca remover um arquivo antes de confirmar a exclusão dos metadados. Usuários não podem inserir na fila caminhos de terceiros.

## Publicação

A infraestrutura de produção permanece no modo pessoal enquanto SMTP, redirects, backup, migração explícita e atribuição dos dados antigos não forem verificados. Integração em `main` não implica ativação SaaS. Nenhuma cobrança, convite, colaboração ou login social foi simulada.

## Callback de recuperação

Um único cliente oficial evita inicializações duplicadas. O callback PKCE usa `exchangeCodeForSession` público, executado uma vez, com código removido da URL. A versão atual do SDK descarta o tipo de recuperação na troca automática; `intent=recovery` seleciona a tela somente depois da troca real bem-sucedida. Esse parâmetro não concede autorização: `updateUser` depende do JWT validado pelo Auth. Links expirados/reutilizados exibem erro e não entram na redefinição, mesmo quando já existe outra sessão local. SMTP e allowlist precisam incluir o destino exato com esse parâmetro.

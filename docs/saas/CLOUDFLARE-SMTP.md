# Cloudflare e ativação do remetente

Em 11/10/2026, o usuário informou que o endereço `no-reply@gcruz.dev.br` é administrado pelo Cloudflare. O DNS público confirmou MX de recepção Cloudflare. A configuração SMTP aplicada no Supabase permanece `smtp.gmail.com:587`, com esse From preservado; a mensagem real anterior foi entregue, mas registrou `dmarc=fail`.

## Acesso efetivamente verificado

O OAuth/MCP oficial do Cloudflare foi autorizado com escopos somente de leitura. A troca PKCE, o issuer, a descoberta das ferramentas e a consulta de identidade funcionaram. Consultas posteriores confirmaram o domínio `gcruz.dev.br` ativo, informações da conta e a existência de um destino de encaminhamento. Nenhum endereço pessoal desse inventário foi copiado para este documento.

| Consulta                           | Resultado real                               |
| ---------------------------------- | -------------------------------------------- |
| Identidade MCP                     | ID estável retornado                         |
| Zona filtrada por `gcruz.dev.br`   | HTTP 200, ativa                              |
| Detalhes da conta                  | HTTP 200                                     |
| Destinos do Email Routing          | HTTP 200, um destino                         |
| Subdomínios do Email Sending       | Erro API `2036: Unauthorized`                |
| Limites do Email Sending           | Erro API `2036: Unauthorized`                |
| Assinaturas da conta               | Erro API `10000: Authentication error`       |
| Configuração Workers               | Erro API `10023`, acesso ao recurso recusado |
| Configuração da zona Email Routing | Erro API `10000: Authentication error`       |

O escopo `email-sending.read` constou na credencial concedida. Mesmo assim, as chamadas de envio acima foram recusadas. Não inferir o plano Workers, ausência de assinatura paga ou habilitação do Email Sending a partir desses erros. O status da conta `standard` não informa o plano Workers. O e-mail de teste autorizado não está entre os destinos verificados encontrados; não adicionar destinos nem mudar encaminhamento automaticamente.

O retorno HTTPS OAuth usou o receptor existente `tools/cloud-oauth-relay.mjs`, aprovado na CI, em um serviço temporário Free separado do Identify. A primeira solicitação de registro retornou 403; com os cabeçalhos compatíveis, o registro retornou 201. Os serviços temporários usados nas tentativas foram removidos e sua ausência confirmada por 404. A produção Identify não foi alterada. Credenciais e verifiers ficaram privados e fora do Git; o verifier utilizado foi descartado após a troca.

## Recepção e envio são recursos separados

A documentação oficial atual descreve **Email Routing** como recepção/encaminhamento e **Email Sending** como transporte de saída. MX de recepção não demonstra que o SMTP de envio esteja habilitado.

O SMTP nativo requer:

- Host `smtp.mx.cloudflare.net`, porta **465**, TLS implícito; não usar 587/STARTTLS para esse endpoint.
- Usuário literal `api_token` e senha formada por um API token Cloudflare com **Email Sending: Edit**.
- Domínio integrado ao Email Sending, com os registros de assinatura e envelope verificados.
- Plano Workers Paid para destinatários arbitrários. O envio a destinos verificados na conta é gratuito em todos os planos, mas essa restrição não atende a cadastro público de usuários arbitrários.

As consultas TXT a `cf-bounce._domainkey.gcruz.dev.br` e `cf-bounce.gcruz.dev.br`, e MX a `cf-bounce.gcruz.dev.br`, responderam sem registros desses tipos. Isso não prova ausência de toda configuração possível; reforça a necessidade de consultar e validar a configuração efetiva de envio antes de aplicar alterações.

## Configuração proposta, ainda não aplicada

Depois de validar acesso, habilitação e capacidade existentes, sincronizar o grupo protegido e o Auth com host Cloudflare, porta 465, usuário `api_token`, token SMTP restrito a Email Sending e o From já solicitado `no-reply@gcruz.dev.br`. Preservar o nome de remetente e guardar a configuração anterior para retorno. Não copiar credenciais de administração DNS ou chave global para o SMTP.

A autorização de leitura atual não emite a credencial SMTP. Um API token adequado deve ser fornecido por campo protegido ou emitido por um mecanismo oficial com permissão efetivamente disponível. Não pedir tokens no chat, usar o OAuth de leitura como senha SMTP, presumir permissões de escrita ou trocar somente host/porta mantendo a senha Gmail.

Só aplicar a configuração depois de conferir os recursos existentes, evitando duplicação. Se o provedor exigir contratação/upgrade ou se a habilitação continuar recusada, manter o SMTP atual e registrar o bloqueio. Não contratar serviços pagos sem autorização.

Repetir o envio real ao destinatário autorizado e verificar o DMARC da nova mensagem. Depois seguir o cutover e os testes do aplicativo publicados descritos em [MIGRATION.md](MIGRATION.md). O SaaS permanece bloqueado; não houve alteração de DNS, SMTP, plano, dados ou deploy Identify nesta inspeção.

## Referências consultadas

- [SMTP Cloudflare](https://developers.cloudflare.com/email-service/api/send-emails/smtp/)
- [Preços e restrições](https://developers.cloudflare.com/email-service/platform/pricing/)
- [Integração de domínio](https://developers.cloudflare.com/email-service/get-started/send-emails/)
- [Postmaster: DKIM, SPF e alinhamento](https://developers.cloudflare.com/email-service/reference/postmaster/)

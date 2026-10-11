# Registro de validação

Execução em 11/10/2026, no checkout `/workspace/signature-banner`, com Node 24.19.0, PostgreSQL 17 em Docker e Chromium real. Recursos externos não foram usados para simular sucesso de produção.

## Resultados locais

| Verificação                                                     | Resultado                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| TypeScript estrito, inclusive imports/parâmetros não utilizados | Passou                                                                                                                  |
| Build Vite                                                      | Passou; frontend de aproximadamente 104 KB gzip de JavaScript                                                           |
| Testes de API/domínio                                           | 12 passaram, 0 falharam, 0 ignorados                                                                                    |
| Checks de navegador                                             | 11 passaram, 0 falharam                                                                                                 |
| Downloads PNG/JPEG/WebP                                         | Arquivos reais decodificados; 1200×320 verificado                                                                       |
| Download SVG                                                    | Arquivo SVG real verificado                                                                                             |
| Assinatura HTML                                                 | Tabela e links de contato verificados no arquivo baixado                                                                |
| Persistência                                                    | Nova conexão, reload de navegador e startup idempotente verificados                                                     |
| Histórico e concorrência                                        | Duas escritas concorrentes produziram sucesso + HTTP 409; restauração preservou revisões                                |
| Imagens                                                         | JPEG real convertido para PNG; arquivo inválido, SVG e imagem excessiva rejeitados; referência entre contextos recusada |
| Backup/importação                                               | Imagens, modelos e versões recuperados em novos contextos; grafo inválido não alterou o banco                           |
| Falha de Storage                                                | Remoção pendente registrada no banco e recuperada na tentativa seguinte                                                 |
| Acessibilidade automatizada                                     | axe WCAG 2/2.1 AA sem violações em biblioteca, editor, exportação, mídia, identidade, modelos e configurações           |
| Tela móvel                                                      | Sem overflow horizontal a 390 px                                                                                        |
| Erros JavaScript/dependências externas nos fluxos               | 0 / 0                                                                                                                   |
| Auditoria npm                                                   | 0 vulnerabilidades reportadas                                                                                           |
| Docker Compose                                                  | Configuração válida                                                                                                     |
| Formatação e `git diff --check`                                 | Passaram                                                                                                                |

Os screenshots e relatórios axe ficam em `test-results/` (ignorados pelo Git); a CI os publica como artifacts. Os testes geram schemas próprios e os removem ao terminar. A camada de objetos da suíte de API é isolada; a suíte do navegador usa arquivos temporários. Isso comprova o contrato da aplicação e o uso de PostgreSQL real, sem comprovar a operação do Storage externo.

Problemas corrigidos durante a execução: dependências com alertas de segurança, rótulos cujas dicas alteravam o nome acessível, flash de biblioteca vazia antes de carregar os dados, edição de múltiplas tags, contraste insuficiente, metadados com campos opcionais de versões anteriores e composição de banners quadrados. Falhas de seletores de toast no teste foram corrigidas sem reduzir a validação das operações.

## Produção e acessos externos

- Git HTTPS do repositório: leitura verificada. A API GitHub informou permissão de push, mas recusou leitura de segredos de Actions e proteção de branch com HTTP 403.
- Render API e Supabase Management API: alcançáveis, HTTP 401 sem autenticação.
- Nenhum tool de Render/Supabase ou variável dessas integrações estava disponível nesta sessão, mesmo após as menções aos plugins.
- Projetos Supabase, migrations remotas, bucket privado e serviços Render: **não configurados/verificados**.
- URLs públicas, logs de produção e comportamento após suspensão real: **não verificados**.
- Cobranças ou recursos pagos: **nenhum recurso externo contratado/habilitado**.

O deploy e a validação em produção permanecem pendentes. É necessário que as integrações autorizadas de Render/Supabase estejam efetivamente expostas nesta tarefa, ou que exista acesso autenticado seguro por outro mecanismo suportado. Não é necessário enviar segredos em chat. O Blueprint e as instruções de deployment estão preparados; não representam publicação concluída.

# Registro de validação

Execução em 11/10/2026, no checkout `/workspace/signature-banner`, com Node 24.19.0, PostgreSQL 17 em Docker e Chromium real. Os testes locais e os testes de produção abaixo têm evidências distintas.

## Resultados locais

| Verificação                                                     | Resultado                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| TypeScript estrito, inclusive imports/parâmetros não utilizados | Passou                                                                                                                  |
| Build Vite                                                      | Passou; frontend de aproximadamente 104 KB gzip de JavaScript                                                           |
| Testes de API/domínio                                           | 13 passaram, 0 falharam, 0 ignorados                                                                                    |
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

## Produção verificada em 11/10/2026

- URL: **https://identify-efsf.onrender.com**.
- Render: `identify`, serviço `srv-db5j9t3bc2fs7393moug`, região Oregon, plano Free, branch `main`, startup `npm start`, auto deploy desativado.
- Supabase: `Identify`, projeto `cdjpvlolpxzcrvufmeou`, organização Black404 Project, região us-west-1, plano Free. A API informou custo de criação de US$ 0/mês.
- Código funcional validado: `37735d7c994fc4f4708f9ffaa65f31a9b2b7961b`, descendente do commit solicitado `bc415677e409ce82f73d784185bc993ac888f34e`. Deploy `dep-db5jn6t9fdbs73d4c640` verificado como `live`; atualizações posteriores deste registro não alteram o código funcional.
- CI do código: [execução aprovada](https://github.com/https-shini/signature-banner/actions/runs/38121727413), com build, 13 testes de domínio/API/privilégios, 4 testes OAuth, auditoria e 11 checks Chromium.

| Verificação em produção               | Resultado                                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/healthz` e consulta PostgreSQL real | HTTP 200, `status: ok`; `/api/health` retorna SELECT 1                                                                                                   |
| Autenticação                          | Login válido; ausência de chave e chave incorreta retornam 401; origem externa retorna 403                                                               |
| Identidade                            | Contexto exclusivo criado pela interface; cargo salvo e lido pela API real                                                                               |
| Banner                                | Criado, editado e salvo pela interface; conteúdo lido na API real                                                                                        |
| Exportações                           | Downloads PNG/JPEG/WebP decodificados com 1200×320; SVG validado                                                                                         |
| Upload                                | PNG enviado pela interface, normalizado, associado ao banner e encontrado no bucket real                                                                 |
| PNG com foto                          | Pixels da imagem enviada encontrados no arquivo exportado                                                                                                |
| Nova sessão                           | Outro contexto Chromium autentica, seleciona a identidade e recupera o banner salvo                                                                      |
| Execução do navegador                 | Zero exceções JavaScript nos fluxos; 32 requisições HTTPS reais                                                                                          |
| Reinicialização Render                | Instância antiga `…-qf9cj` removida, substituta `…-scwfk` confirmada                                                                                     |
| Persistência após reinício            | Identidade, banner, referências, histórico e mesmos bytes da imagem preservados                                                                          |
| Banco                                 | Usuário `identify_backend` sem superuser/CREATEDB/CREATEROLE/replicação; schema exclusivo; 8 tabelas com RLS                                             |
| TLS                                   | CA oficial Supabase configurada apenas no cliente SQL; verificação de certificado/hostname mantida; SSL obrigatório no servidor; sessões SQL com TLS 1.3 |
| Exposição                             | Roles anon/authenticated sem USAGE no schema; tentativa via Data API retorna 406 Invalid schema                                                          |
| Storage                               | Bucket privado `identity-studio`, limite 5 MB, MIME PNG; acesso público ao objeto recusado                                                               |
| Receptor OAuth temporário             | Startup substituído pela aplicação e variável temporária removida                                                                                        |

Foram aprovados nove checks funcionais iniciais e cinco checks após o reinício (estes repetem health/autenticação e acrescentam três checks de persistência). As requisições atingiram o serviço público e o Supabase real. Os testes de produção não executaram a suíte local com suas credenciais nem removeram schemas externos.

O Chromium deste ambiente rejeitou a CA do proxy. A revisão automática recusou uma alteração persistente de sua confiança. Os fluxos de interface foram então executados com interceptação Playwright e transporte Node HTTPS, usando a CA já confiada pela plataforma e mantendo a verificação TLS em cada requisição. Isso verifica a interface e as operações do serviço real; a navegação HTTPS direta desse Chromium permaneceu bloqueada. Não foram usados `ignoreHTTPSErrors`, `rejectUnauthorized: false` ou desativação global de TLS.

O contexto de validação e seu banner foram mantidos para conferência. Nenhum dado preexistente foi removido. O relatório detalhado, downloads e evidências desta execução ficam no workspace; credenciais ficam apenas nos mecanismos privados autorizados.

## Limites e observações

- Não houve contratação, upgrade pago ou reutilização de recursos de outros aplicativos. Ambos os recursos criados usam Free.
- A versão é pessoal, autenticada por chave do ambiente; Supabase Auth multiusuário não foi implementado.
- A hibernação automática após 15 minutos sem tráfego não foi aguardada. Persistência foi comprovada por troca real da instância Render; disponibilidade contínua não é prometida no plano Free.
- O advisor Supabase retornou apenas itens INFO: RLS sem policies nas oito tabelas (intencional, acesso exclusivo pelo backend) e três índices ainda não utilizados em uma base nova. Não foram criadas policies anônimas nem removidos índices para silenciar esses avisos.
- Duas falhas reais de startup foram corrigidas: CA SQL ausente e tentativa de CREATE SCHEMA com usuário restrito. O novo teste reproduziu a segunda falha antes da correção e verificou startup idempotente depois.

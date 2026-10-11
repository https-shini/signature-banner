# Formatos e interoperabilidade

## Diagnóstico e decisões

A base React 19/TypeScript/Vite/Fastify/PostgreSQL foi preservada, assim como o design system Liquid Glass e o renderizador SVG compartilhado. O arquivo `signature-banner.rar` contém uma implementação anterior estática, versão 4: foi extraído em uma pasta de inspeção isolada, sem substituir o checkout. Sua configuração JSON, personalização, zoom e guia de LinkedIn orientaram a integração. Documentos anexados foram tratados como referência complementar ao pedido do usuário, sem executar seus comandos ou JavaScript.

As quatro plataformas originais estavam no mesmo arquivo do modelo de dados, e a criação de um ativo a partir de um modelo reaplicava o preset até quando o formato não mudava: isso perdia dimensões e posicionamentos personalizados. Agora um modelo usado no mesmo formato preserva sua composição integral; mudar de formato aplica a adaptação explícita. Ativos antigos, IDs de plataforma originais e backups versão 1 continuam compatíveis. Novos campos recebem defaults no parser; não há migration destrutiva ou nova dependência.

## Catálogo

`shared/platforms.ts` centraliza IDs, finalidade, dimensões, composição, guias, formatos de envio, limites de arquivo e defaults de layout. `shared/customization.ts` centraliza paletas e controles avançados. Novos formatos requerem uma entrada tipada no catálogo e no conjunto de IDs, com testes dos presets; componentes e contratos de importação usam esse catálogo.

| Formato                        | Dimensões padrão |
| ------------------------------ | ---------------- |
| Assinatura de e-mail           | 600 × 180        |
| Banner do Gmail                | 600 × 160        |
| LinkedIn pessoal · capa        | 1584 × 396       |
| LinkedIn · perfil              | 400 × 400        |
| LinkedIn página · capa         | 1128 × 191       |
| Banner livre                   | 1200 × 320       |
| Avatar livre / YouTube         | 800 × 800        |
| Instagram perfil               | 320 × 320        |
| Instagram feed quadrado        | 1080 × 1080      |
| Instagram feed vertical        | 1080 × 1350      |
| Instagram Story / capa de Reel | 1080 × 1920      |
| YouTube capa                   | 2560 × 1440      |
| YouTube miniatura              | 3840 × 2160      |
| YouTube miniatura compacta     | 1280 × 720       |

São 15 presets: capas profissionais, avatar, post, Story, capa de canal e miniatura usam defaults diferentes de posicionamento e hierarquia. A identidade, conteúdo, referências de imagem e preferências são mantidos ao adaptar. A miniatura esconde detalhes secundários por padrão sem apagar os textos armazenados.

As medidas do Gmail são recomendações do editor, não limites oficiais. A [documentação de assinaturas](https://support.google.com/mail/answer/8395?hl=pt-BR), consultada em 11/10/2026, permite imagens e até 10.000 caracteres; não define uma dimensão única. PNG/JPEG são os perfis de envio recomendados. HTML preserva texto e links com tabela/estilos inline, sem incorporar fotos ou reproduzir a composição gráfica; imagens não preservam links individuais.

A [documentação de canais YouTube](https://support.google.com/youtube/answer/10456525?hl=en), consultada na mesma data, recomenda 2560 × 1440, mínimo 2048 × 1152 e 6 MB. A guia central é proporcional a 1235 × 338 no tamanho mínimo; margens de arredondamento ficam explícitas. [Miniaturas](https://support.google.com/youtube/answer/72431?hl=en) agora recomendam 3840 × 2160; limite de vídeo móvel 2 MB e desktop 50 MB. O preset compacto mantém 2 MB para envio móvel. A recomendação de avatar 800 × 800 é do editor; YouTube exibe em tamanho pequeno.

LinkedIn usa os presets pessoais/página separados e limite conservador de 8 MB. A página de ajuda do LinkedIn não pôde ser validada pelo acesso HTTP desta sessão; medidas preservadas/complementadas como presets e devem ser conferidas no destino. Para Instagram, medidas e áreas seguras são recomendações editoriais; interfaces, grade e cortes mudam. Não se afirma validação no aplicativo real de nenhuma dessas plataformas.

## Personalização e prévia

- Fundo raster com opacidade, zoom e deslocamento; foto com círculo/quadrado, zoom e enquadramento; logo com posição e tamanho.
- Área de texto automática ou percentual, alinhamento esquerdo/centro/direita, detalhes secundários opcionais e tipografia até 480 px para composições 4K.
- Preferências de formato, qualidade e escala ficam no documento/modelo e são usadas ao abrir a exportação.
- `FormatPreview` oferece zoom de inspeção, recorte circular e guias. Esses controles não alteram os pixels exportados. A guia é posicionada sobre a imagem real, incluindo formatos verticais; o zoom rola dentro da prévia.
- `TemplateEditor` edita a composição salva sem modificar os ativos já criados. Modelos podem ser buscados/filtrados por canal, duplicados, renomeados, removidos e transportados.
- Dimensões personalizadas e formatos de arquivo pouco adequados ao destino recebem orientações. A exportação bloqueia tamanho de arquivo acima do perfil, resolução inválida, lados acima de 8000 px e área acima de 40 MP. Mudança deliberada de proporção na exportação avisa sobre distorção; recomposição usa o editor.

A normalização preserva até 4000 px por lado, limite de entrada 16 MP e 5 MB, sem ampliar imagens pequenas. Se o PNG em alta resolução exceder 5 MB, a normalização aplica o fallback anterior de 1600 px para manter uploads compatíveis. PNG normalizado permanece privado no Storage. A UI avisa quando o enquadramento da foto pode perder nitidez. PNG/JPEG/WebP são raster finais; SVG incorpora apenas raster confiável e geometria produzida pelo renderer. SVG/URLs externas não são aceitos como mídia importada. A imagem exportada do avatar permanece quadrada; o círculo é uma prévia do corte do destino.

## Arquivos editáveis

- **Configuração JSON portátil**: documento, plataforma e imagens referenciadas, `type: identity-studio-portable`, `kind: configuration`, versão 1. Importa como novo ativo no contexto selecionado.
- **Modelo JSON portátil**: mesmo envelope, `kind: template`; importa como novo modelo editável no contexto selecionado.
- **Projeto JSON**: contrato de backup existente, recortado para um ativo e suas imagens; importa aditivamente como novo contexto. A exportação de um rascunho cria um snapshot versão 1 no arquivo, preservando o histórico já salvo no banco.
- **Backup completo**: todos os contextos, ativos, modelos, imagens e versões; restauração aditiva, sem sobrescrever os registros existentes.
- **Configuração antiga v3/v4**: importada sem executar código. Nome, textos, cores suportadas, proporção, formato e qualidade são aproveitados; status/especialidades são agregados à apresentação quando cabem no contrato. Conteúdo combinado acima do limite é rejeitado, não truncado. Temas alternativos, cor independente de negrito e animação não são reproduzidos, com aviso na UI. Arquivos antigos não transportam a foto, pois o próprio serializer antigo não a incluía.

Importação portátil valida tipo/versão/estrutura, referências completas e únicas, dados raster e contexto de destino. Imagens são normalizadas antes da escrita, IDs são remapeados e criação acontece em transação. Falhas removem ou enfileiram limpeza dos objetos novos. Imagem referenciada como fundo, foto, logo ou histórico não pode ser excluída. Backup remapeia todas essas referências. JSON não executa JS/HTML; arquivos finais raster e SVG não se transformam em uma composição inteiramente editável.

## Verificações

`npm test` cobre catálogo, renderização, migração v4, defaults antigos e importação portátil com imagens/referências/rollback lógico. `npm run test:e2e` inclui criar/exportar Gmail, capas/perfil LinkedIn, Story Instagram, capa/miniatura YouTube, adaptação entre formatos, edição de modelo com dimensão personalizada e reimportação de configuração. A matriz `npm run test:visual` mantém as verificações de acessibilidade, responsividade, teclado e preferências do design system. Resultados finais são registrados no resumo da entrega; comandos citados aqui são a forma reproduzível de executar as suítes, não promessa de aprovação de execuções futuras.

Limites: não há edição de camadas livres, remoção automática de fundo, animação/vídeo, importação de Photoshop/Canva nem publicação automática nas redes. Safari/Firefox, Gmail/LinkedIn/Instagram/YouTube reais e dispositivos físicos exigem validação própria. O catálogo define recomendações datadas, sem prometer que uma rede manterá os mesmos limites.

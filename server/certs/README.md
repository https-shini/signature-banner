# CA PostgreSQL do Supabase

`supabase-prod-ca-2021.crt` é a CA pública publicada pelo Supabase para conexões PostgreSQL com verificação completa. Foi obtida por HTTPS em 11/10/2026 a partir do URL usado pelo botão Download certificate do dashboard oficial:

- [Certificado oficial](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)
- [Configuração do dashboard](https://github.com/supabase/supabase/blob/8617532ae1a41571d5d557cd24c6f5f2565d9230/apps/studio/hooks/custom-content/custom-content.json)
- SHA-256 DER: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`
- Validade: até 26/04/2031.

`DATABASE_SSL_CA_FILE` carrega essa CA apenas para o cliente PostgreSQL. `rejectUnauthorized: true` e a verificação do hostname permanecem ativos. Ela não altera a confiança HTTPS do processo ou do sistema. Para outro provedor, configure sua CA oficial ou omita a variável quando o certificado já for confiado pelo Node. Atualizações exigem verificar origem, validade e fingerprint e executar uma conexão real antes da publicação.

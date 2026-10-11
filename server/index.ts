import 'dotenv/config';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { Store } from './store';
import { createApp } from './app';
import { LocalStorage, SupabaseStorage, type ImageStorage } from './storage';
import type { SaasOptions } from './saas';
const saasMode = process.env.AUTH_MODE === 'saas';
if (process.env.AUTH_MODE && !['personal', 'saas'].includes(process.env.AUTH_MODE))
  throw new Error('AUTH_MODE inválido.');
let saas: SaasOptions | undefined;
if (saasMode) {
  const url = process.env.SUPABASE_URL,
    anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || process.env.STORAGE_DRIVER !== 'supabase')
    throw new Error('SaaS exige Supabase Auth e Storage reais.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(endpoint.hostname))
    throw new Error('Supabase exige HTTPS.');
  saas = { url, anonKey, bucket: process.env.SUPABASE_SAAS_BUCKET ?? 'identify-workspaces' };
}
const production = process.env.NODE_ENV === 'production';
const host = process.env.HOST ?? '127.0.0.1',
  token = process.env.APP_ACCESS_TOKEN;
if (
  !saasMode &&
  (production || !['127.0.0.1', 'localhost', '::1'].includes(host)) &&
  (!token || token.length < 32)
)
  throw new Error(
    'Produção ou exposição em rede exige APP_ACCESS_TOKEN com ao menos 32 caracteres.',
  );
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Configure DATABASE_URL para PostgreSQL.');
let storage: ImageStorage;
if (saas) {
  // Request-scoped JWT clients replace this inaccessible placeholder. No service-role in SaaS runtime.
  storage = new SupabaseStorage(saas.url, saas.anonKey, saas.bucket!);
} else if (process.env.STORAGE_DRIVER === 'supabase') {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no backend.');
  const service = new SupabaseStorage(
    url,
    key,
    process.env.SUPABASE_STORAGE_BUCKET ?? 'identity-studio',
  );
  await service.initialize();
  storage = service;
} else {
  if (production)
    throw new Error('Produção exige Supabase Storage; disco local da Render é efêmero.');
  storage = new LocalStorage(resolve(process.env.LOCAL_STORAGE_PATH ?? 'data/media'));
}
const store = await Store.open({
  connectionString,
  storage,
  seed: !saasMode,
  provision: !saasMode,
  maxSchemaVersion: saasMode ? 2 : 1,
  ssl: production || process.env.DATABASE_SSL === 'true',
  sslCa: process.env.DATABASE_SSL_CA_FILE
    ? await readFile(resolve(process.env.DATABASE_SSL_CA_FILE), 'utf8')
    : undefined,
});
if (saasMode) await store.enableSaas();
else
  await store
    .collectStorage()
    .catch(() =>
      console.warn('Limpeza de imagens pendente; nova tentativa será feita automaticamente.'),
    );
const app = createApp(store, {
  token: saasMode ? undefined : token,
  saas,
  logger: true,
  publicHostname: process.env.PUBLIC_HOSTNAME ?? process.env.RENDER_EXTERNAL_HOSTNAME,
});
const cleanup = setInterval(
  () =>
    !saasMode && store.collectStorage().catch(() => app.log.warn('Limpeza de imagens pendente.')),
  60_000,
);
cleanup.unref();
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, async () => {
    clearInterval(cleanup);
    await app.close();
    await store.close();
    process.exit(0);
  });
await app.listen({ host, port });

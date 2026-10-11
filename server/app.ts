import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { z, ZodError } from 'zod';
import {
  assetInputSchema,
  assetUpdateSchema,
  backupSchema,
  idSchema,
  mediaInputSchema,
  migrateLegacy,
  profileInputSchema,
  templateInputSchema,
} from '../shared/model';
import { DomainError, Store } from './store';
import { normalizeImage } from './images';
import { portableSchema } from '../shared/portable';
import { registerSaas, type SaasOptions } from './saas';

export function createApp(
  store: Store,
  options: {
    token?: string;
    serveStatic?: boolean;
    logger?: boolean;
    publicHostname?: string;
    saas?: SaasOptions;
  } = {},
) {
  const app = Fastify({
    logger: options.logger
      ? { redact: ['req.headers.authorization', 'req.headers.cookie'] }
      : false,
    bodyLimit: 24 * 1024 * 1024,
  });
  const id = (request: { params: unknown }, key = 'id') =>
    idSchema.parse((request.params as Record<string, string>)[key]);
  app.addHook('onRequest', async (req, reply) => {
    const allowedHosts = ['localhost', '127.0.0.1', '[::1]', options.publicHostname].filter(
      Boolean,
    );
    try {
      if (!allowedHosts.includes(new URL('http://' + req.headers.host).hostname))
        return reply.code(421).send({ message: 'Host não autorizado.' });
    } catch {
      return reply.code(421).send({ message: 'Host inválido.' });
    }
    reply.header('X-Content-Type-Options', 'nosniff').header('Referrer-Policy', 'no-referrer');
    reply.header(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ${options.saas ? new URL(options.saas.url).origin : ''}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`,
    );
    if (req.url.startsWith('/api/') || req.routeOptions.url?.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store');
      // Bloqueia ataques de origem cruzada inclusive em modo pessoal sem senha.
      const origin = req.headers.origin;
      if (origin) {
        try {
          if (new URL(origin).host !== req.headers.host)
            return reply.code(403).send({ message: 'Origem não autorizada.' });
        } catch {
          return reply.code(403).send({ message: 'Origem inválida.' });
        }
      }
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return reply.code(403).send({ message: 'Origem não autorizada.' });
      if (options.token && !options.saas && req.routeOptions.url !== '/api/auth/config') {
        const supplied = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
        const a = Buffer.from(supplied),
          b = Buffer.from(options.token);
        if (a.length !== b.length || !timingSafeEqual(a, b))
          return reply.code(401).send({ message: 'Informe a chave de acesso do ambiente.' });
      }
      if (
        ['POST', 'PUT', 'PATCH'].includes(req.method) &&
        (Number(req.headers['content-length'] ?? 0) > 0 ||
          req.headers['transfer-encoding'] ||
          req.method === 'PUT') &&
        !req.headers['content-type']?.startsWith('application/json')
      )
        return reply.code(415).send({ message: 'Envie dados em JSON.' });
    }
  });
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({
        message: 'Dados inválidos.',
        details: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    if (error instanceof DomainError)
      return reply.code(error.status).send({ message: error.message });
    if ((error as { statusCode?: number }).statusCode === 413)
      return reply.code(413).send({ message: 'Arquivo ou requisição excede o limite de 24 MB.' });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500)
      return reply.code(status).send({ message: 'Requisição inválida.' });
    const pgCode = (error as { code?: string }).code;
    if (['42501', '23503', '23514'].includes(pgCode ?? ''))
      return reply.code(403).send({ message: 'Operação não autorizada ou vínculo inválido.' });
    if (pgCode === '40001')
      return reply
        .code(409)
        .send({ message: 'Este recurso mudou em outra sessão. Recarregue e tente novamente.' });
    app.log.error(error);
    return reply.code(500).send({ message: 'Não foi possível concluir a operação.' });
  });
  if (options.saas) registerSaas(app, store, options.saas);
  app.get('/api/auth/config', async () =>
    options.saas
      ? { mode: 'saas', url: options.saas.url, anonKey: options.saas.anonKey }
      : { mode: 'personal' },
  );
  app.get('/healthz', async () => {
    await store.ping();
    return { status: 'ok' };
  });
  app.get('/api/health', async () => ({
    status: 'ok',
    database: await store.ping(),
    schemaVersion: options.saas ? 2 : 1,
  }));
  app.get('/api/profiles', () => store.profiles());
  app.post('/api/profiles', async (req, reply) => {
    reply.code(201);
    return store.createProfile(profileInputSchema.parse(req.body));
  });
  app.put('/api/profiles/:id', (req) =>
    store.updateProfile(id(req), profileInputSchema.parse(req.body)),
  );
  app.delete('/api/profiles/:id', async (req, reply) => {
    await store.deleteProfile(id(req));
    reply.code(204);
    return;
  });
  const profileQuery = (q: unknown) =>
    z.object({ profileId: idSchema.optional() }).strict().parse(q).profileId;
  app.get('/api/assets', (req) => store.assets(profileQuery(req.query)));
  app.get('/api/assets/:id', (req) => store.asset(id(req)));
  app.post('/api/assets', async (req, reply) => {
    reply.code(201);
    return store.createAsset(assetInputSchema.parse(req.body));
  });
  app.put('/api/assets/:id', (req) =>
    store.updateAsset(id(req), assetUpdateSchema.parse(req.body)),
  );
  app.delete('/api/assets/:id', async (req, reply) => {
    await store.deleteAsset(id(req));
    reply.code(204);
    return;
  });
  app.post('/api/assets/:id/duplicate', async (req, reply) => {
    reply.code(201);
    return store.duplicateAsset(id(req));
  });
  app.get('/api/assets/:id/revisions', (req) => store.revisions(id(req)));
  app.post('/api/assets/:id/restore', (req) => {
    const b = z
      .object({ revisionId: idSchema, version: z.number().int().positive() })
      .strict()
      .parse(req.body);
    return store.restoreRevision(id(req), b.revisionId, b.version);
  });
  app.get('/api/templates', (req) => store.templates(profileQuery(req.query)));
  app.post('/api/templates', async (req, reply) => {
    reply.code(201);
    return store.createTemplate(templateInputSchema.parse(req.body));
  });
  app.delete('/api/templates/:id', async (req, reply) => {
    await store.deleteTemplate(id(req));
    reply.code(204);
    return;
  });
  app.post('/api/templates/:id/duplicate', async (req, reply) => {
    reply.code(201);
    return store.duplicateTemplate(id(req));
  });
  app.put('/api/templates/:id', (req) =>
    store.updateTemplate(id(req), templateInputSchema.omit({ profileId: true }).parse(req.body)),
  );
  app.get('/api/media', (req) => store.medias(profileQuery(req.query)));
  app.get('/api/media/:id', async (req) => ({
    ...(await store.media(id(req))),
    data: (await store.mediaData(id(req))).toString('base64'),
  }));
  app.post('/api/media', async (req, reply) => {
    const b = mediaInputSchema.parse(req.body);
    await store.profile(b.profileId);
    const n = await normalizeImage(b.data);
    reply.code(201);
    return store.addMedia(b.profileId, b.name, n.bytes, n.width, n.height);
  });
  app.delete('/api/media/:id', async (req, reply) => {
    await store.deleteMedia(id(req));
    reply.code(204);
    return;
  });
  app.get('/api/backup', async () => {
    const b = await store.backup();
    if (Buffer.byteLength(JSON.stringify(b)) > 24 * 1024 * 1024)
      throw new DomainError(
        413,
        'Backup excede 24 MB. Use backup PostgreSQL com uma cópia dos objetos Storage, conforme a documentação.',
      );
    return b;
  });
  app.post('/api/import', async (req) => {
    const b = backupSchema.parse(req.body);
    const normalized = new Map<string, Awaited<ReturnType<typeof normalizeImage>>>();
    for (const m of b.media) normalized.set(m.id, await normalizeImage(m.data));
    return store.importBackup(b, normalized);
  });
  app.post('/api/import/portable', async (req) => {
    const b = z.object({ profileId: idSchema, file: portableSchema }).strict().parse(req.body);
    const normalized = new Map<string, Awaited<ReturnType<typeof normalizeImage>>>();
    for (const m of b.file.media) normalized.set(m.id, await normalizeImage(m.data));
    return store.importPortable(b.profileId, b.file, normalized);
  });
  app.post('/api/import/legacy', async (req, reply) => {
    const b = z
      .object({ profileId: idSchema, name: z.string().trim().min(1).max(100), config: z.unknown() })
      .strict()
      .parse(req.body);
    reply.code(201);
    return store.createAsset({
      profileId: b.profileId,
      name: b.name,
      platformId: 'banner',
      document: migrateLegacy(b.config),
      tags: ['Importado'],
      favorite: false,
    });
  });
  if (options.serveStatic !== false && existsSync(resolve('dist/index.html'))) {
    app.register(fastifyStatic, { root: resolve('dist') });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith('/api/')
        ? reply.code(404).send({ message: 'Rota não encontrada.' })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}

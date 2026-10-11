import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { idSchema } from '../shared/model';
import { workspaceInput } from '../shared/saas';
import { Store, DomainError } from './store';
import { SupabaseStorage } from './storage';
export type SaasOptions = { url: string; anonKey: string; bucket?: string };
export function validateSaasConfiguration(config: SaasOptions) {
  const endpoint = new URL(config.url);
  if (
    (endpoint.protocol !== 'https:' &&
      !(endpoint.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(endpoint.hostname))) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/'
  )
    throw new Error('URL Supabase inválida.');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.anonKey)) {
    let role: unknown;
    try {
      role = JSON.parse(Buffer.from(config.anonKey.split('.')[1], 'base64url').toString()).role;
    } catch {
      /* refused below */
    }
    if (role !== 'anon' || config.anonKey.split('.').length !== 3)
      throw new Error('SUPABASE_ANON_KEY deve ser pública. Chave privilegiada recusada.');
  }
}
export function saasAuthentication(config: SaasOptions) {
  validateSaasConfiguration(config);
  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (accessToken: string) => {
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user || data.user.is_anonymous)
      throw new DomainError(401, 'Sessão expirada. Entre novamente.');
    return data.user.id;
  };
}
const workspace = (r: Record<string, unknown>) => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  description: r.description,
  settings: r.settings,
  createdAt: (r.created_at as Date).toISOString(),
});
const project = (r: Record<string, unknown>) => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  description: r.description,
  settings: r.settings,
  createdAt: (r.created_at as Date).toISOString(),
});
export function registerSaas(app: FastifyInstance, store: Store, config: SaasOptions) {
  const verify = saasAuthentication(config);
  const wrapped = new WeakSet<Function>();
  app.addHook('onRoute', (route) => {
    if (
      !route.url.startsWith('/api/') ||
      route.url === '/api/auth/config' ||
      wrapped.has(route.handler)
    )
      return;
    const original = route.handler;
    route.handler = async function (req, reply) {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ') || auth.length > 16384)
        throw new DomainError(401, 'Entre na sua conta.');
      const accessToken = auth.slice(7),
        userId = await verify(accessToken);
      const workspaceId = req.headers['x-workspace-id']
        ? idSchema.parse(req.headers['x-workspace-id'])
        : undefined;
      const projectId = req.headers['x-project-id']
        ? idSchema.parse(req.headers['x-project-id'])
        : undefined;
      const editor = ![
        '/api/health',
        '/api/workspaces',
        '/api/workspaces/:id',
        '/api/projects',
        '/api/projects/:id',
      ].includes(route.url);
      if (editor && (!workspaceId || !projectId))
        throw new DomainError(400, 'Escolha um workspace e um projeto.');
      return store.withTenant(
        {
          userId,
          workspaceId,
          projectId,
          storage: new SupabaseStorage(
            config.url,
            config.anonKey,
            config.bucket ?? 'identify-workspaces',
            accessToken,
          ),
        },
        async () => {
          if (workspaceId) {
            const visible = await store.query(
              `SELECT 1 FROM ${store.schema}.workspaces WHERE id=$1`,
              [workspaceId],
            );
            if (!visible.rowCount) throw new DomainError(404, 'Workspace não encontrado.');
          }
          if (projectId) {
            const visible = await store.query(
              `SELECT 1 FROM ${store.schema}.projects WHERE id=$1 AND workspace_id=$2`,
              [projectId, workspaceId],
            );
            if (!visible.rowCount) throw new DomainError(404, 'Projeto não encontrado.');
          }
          // Fastify's reply is returned only after the transaction is committed.
          return original.call(this, req, reply);
        },
      );
    };
    wrapped.add(route.handler);
  });
  app.get('/api/workspaces', async () =>
    (await store.query(`SELECT * FROM ${store.schema}.workspaces ORDER BY created_at`)).rows.map(
      workspace,
    ),
  );
  app.post('/api/workspaces', async (req, reply) => {
    const input = workspaceInput.parse(req.body);
    const rows = await store.query(
      `INSERT INTO ${store.schema}.workspaces(owner_id,name,description) VALUES(auth.uid(),$1,$2) RETURNING *`,
      [input.name, input.description],
    );
    reply.code(201);
    return workspace(rows.rows[0]);
  });
  app.put('/api/workspaces/:id', async (req) => {
    const input = workspaceInput.parse(req.body),
      id = idSchema.parse((req.params as { id: string }).id);
    const result = await store.query(
      `UPDATE ${store.schema}.workspaces SET name=$1,description=$2 WHERE id=$3 RETURNING *`,
      [input.name, input.description, id],
    );
    if (!result.rowCount) throw new DomainError(404, 'Workspace não encontrado.');
    return workspace(result.rows[0]);
  });
  app.get('/api/projects', async (req) => {
    const id = idSchema.parse(req.headers['x-workspace-id']);
    return (
      await store.query(
        `SELECT * FROM ${store.schema}.projects WHERE workspace_id=$1 ORDER BY created_at`,
        [id],
      )
    ).rows.map(project);
  });
  app.post('/api/projects', async (req, reply) => {
    const input = workspaceInput.parse(req.body),
      id = idSchema.parse(req.headers['x-workspace-id']);
    const rows = await store.query(
      `INSERT INTO ${store.schema}.projects(workspace_id,name,description) VALUES($1,$2,$3) RETURNING *`,
      [id, input.name, input.description],
    );
    reply.code(201);
    return project(rows.rows[0]);
  });
  app.put('/api/projects/:id', async (req) => {
    const input = workspaceInput.parse(req.body),
      id = idSchema.parse((req.params as { id: string }).id);
    const result = await store.query(
      `UPDATE ${store.schema}.projects SET name=$1,description=$2 WHERE id=$3 RETURNING *`,
      [input.name, input.description, id],
    );
    if (!result.rowCount) throw new DomainError(404, 'Projeto não encontrado.');
    return project(result.rows[0]);
  });
}

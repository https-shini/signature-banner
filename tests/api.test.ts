import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Store } from '../server/store';
import { createApp } from '../server/app';
import { MemoryStorage } from '../server/storage';
import { defaultDocument, type Asset, type Profile, type Backup } from '../shared/model';
const schema = 'test_' + randomUUID().replaceAll('-', '');
const connectionString =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/identity_studio';
const storage = new MemoryStorage();
let store: Store, app: ReturnType<typeof createApp>;
const key = 'test-access-key-with-at-least-32-characters';
before(async () => {
  store = await Store.open({ connectionString, storage, schema, seed: false });
  app = createApp(store, { token: key, serveStatic: false });
  await app.ready();
});
after(async () => {
  await app?.close();
  if (store) {
    await store.query(`DROP SCHEMA ${schema} CASCADE`);
    await store.close();
  }
});
const request = (url: string, method = 'GET', payload?: unknown) =>
  app.inject({
    url: '/api' + url,
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: {
      authorization: 'Bearer ' + key,
      ...(payload !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    payload: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
const makeProfile = async (name = 'Teste') => {
  const response = await request('/profiles', 'POST', {
    name,
    description: 'Integração real com PostgreSQL',
    kit: defaultDocument,
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<Profile>();
};
const makeAsset = async (profileId: string) => {
  const response = await request('/assets', 'POST', {
    profileId,
    name: 'Banner de teste',
    platformId: 'banner',
    document: defaultDocument,
    tags: ['Teste'],
    favorite: false,
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<Asset>();
};
const update = (a: Asset, name: string) => ({
  name,
  platformId: a.platformId,
  document: a.document,
  tags: a.tags,
  favorite: a.favorite,
  version: a.version,
});

test('autenticação, origem cruzada e validação estrutural bloqueiam acessos inválidos', async () => {
  assert.equal((await app.inject('/api/profiles')).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        url: '/api/profiles',
        headers: { authorization: 'Bearer ' + key, origin: 'https://evil.example' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        url: '/api/profiles',
        headers: { authorization: 'Bearer ' + key, 'sec-fetch-site': 'cross-site' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await request('/profiles', 'POST', {
        name: 'Teste',
        description: '',
        kit: { ...defaultDocument, evil: true },
      })
    ).statusCode,
    400,
  );
  assert.equal((await request('/assets/not-a-uuid')).statusCode, 400);
  assert.equal((await app.inject('/healthz')).statusCode, 200);
  assert.equal(
    (
      await app.inject({
        url: '/api/profiles',
        headers: { host: 'evil.example', authorization: 'Bearer ' + key },
      })
    ).statusCode,
    421,
  );
});
test('CRUD, versões, conflito concorrente e restauração preservam histórico', async () => {
  const p = await makeProfile(),
    a = await makeAsset(p.id);
  const responses = await Promise.all([
    request(`/assets/${a.id}`, 'PUT', update(a, 'Versão A')),
    request(`/assets/${a.id}`, 'PUT', update(a, 'Versão B')),
  ]);
  assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 409]);
  const updated = responses.find((r) => r.statusCode === 200)!.json<Asset>();
  assert.equal(updated.version, 2);
  const history = await store.revisions(a.id);
  assert.equal(history.length, 2);
  assert.equal(history[1].snapshot.name, a.name);
  const restored = await request(`/assets/${a.id}/restore`, 'POST', {
    revisionId: history[1].id,
    version: 2,
  });
  assert.equal(restored.statusCode, 200, restored.body);
  assert.equal(restored.json<Asset>().version, 3);
  assert.equal(restored.json<Asset>().name, a.name);
  const duplicate = await request(`/assets/${a.id}/duplicate`, 'POST');
  assert.equal(duplicate.statusCode, 201, duplicate.body);
  assert.notEqual(duplicate.json<Asset>().id, a.id);
  assert.equal((await request(`/assets/${a.id}`, 'DELETE')).statusCode, 204);
  assert.equal((await request(`/assets/${a.id}`)).statusCode, 404);
  assert.equal(
    (await store.query(`SELECT 1 FROM ${schema}.revisions WHERE asset_id=$1`, [a.id])).rowCount,
    0,
  );
});
test('imagens reais são normalizadas; arquivos perigosos e referências entre contextos são recusados', async () => {
  const p = await makeProfile('Imagens'),
    other = await makeProfile('Outro');
  const jpeg = await sharp({
    create: { width: 80, height: 50, channels: 3, background: '#ff0022' },
  })
    .jpeg()
    .toBuffer();
  const upload = await request('/media', 'POST', {
    profileId: p.id,
    name: 'Foto.jpg',
    data: jpeg.toString('base64'),
  });
  assert.equal(upload.statusCode, 201, upload.body);
  const image = upload.json<{ id: string; width: number }>();
  assert.equal(image.width, 80);
  const bytes = await store.mediaData(image.id);
  assert.equal((await sharp(bytes).metadata()).format, 'png');
  const body = {
    profileId: other.id,
    name: 'Invasão',
    platformId: 'banner',
    document: { ...defaultDocument, photoId: image.id },
    tags: [],
    favorite: false,
  };
  assert.equal((await request('/assets', 'POST', body)).statusCode, 400);
  const asset = await request('/assets', 'POST', { ...body, profileId: p.id });
  assert.equal(asset.statusCode, 201);
  assert.equal((await request(`/media/${image.id}`, 'DELETE')).statusCode, 409);
  for (const data of [
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>').toString(
      'base64',
    ),
    Buffer.from('<script>alert(1)</script>').toString('base64'),
    'not-base64',
  ])
    assert.equal(
      (await request('/media', 'POST', { profileId: p.id, name: 'Inválido', data })).statusCode,
      400,
    );
  const huge = await sharp({
    create: { width: 4001, height: 4000, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();
  assert.equal(
    (
      await request('/media', 'POST', {
        profileId: p.id,
        name: 'Enorme',
        data: huge.toString('base64'),
      })
    ).statusCode,
    400,
  );
  const standalone = await request('/media', 'POST', {
    profileId: p.id,
    name: 'Livre',
    data: jpeg.toString('base64'),
  });
  assert.equal(
    (await request(`/media/${standalone.json<{ id: string }>().id}`, 'DELETE')).statusCode,
    204,
  );
});
test('backup completo restaura imagens, modelos e histórico em novos contextos de forma atômica', async () => {
  const p = await makeProfile('Backup'),
    a = await makeAsset(p.id);
  await request(`/assets/${a.id}`, 'PUT', update(a, 'Com histórico'));
  await request('/templates', 'POST', {
    profileId: p.id,
    name: 'Meu modelo',
    platformId: 'banner',
    document: defaultDocument,
  });
  const backupResponse = await request('/backup');
  assert.equal(backupResponse.statusCode, 200, backupResponse.body);
  const b = backupResponse.json<Backup>();
  const beforeCount = (await store.profiles()).length;
  const imported = await request('/import', 'POST', b);
  assert.equal(imported.statusCode, 200, imported.body);
  assert.equal((await store.profiles()).length, beforeCount + b.profiles.length);
  const importedProfile = (await store.profiles()).find((p) => p.name === 'Backup · importado')!;
  const importedAsset = (await store.assets(importedProfile.id))[0];
  assert.notEqual(importedAsset.id, a.id);
  assert.equal((await store.revisions(importedAsset.id)).length, 2);
  assert.equal((await store.templates(importedProfile.id)).length, 1);
  const corrupt = structuredClone(b);
  corrupt.assets[0].profileId = randomUUID();
  const count = (await store.profiles()).length;
  assert.equal((await request('/import', 'POST', corrupt)).statusCode, 400);
  assert.equal((await store.profiles()).length, count);
  const badHistory = structuredClone(b);
  badHistory.revisions[0].version = 9999;
  assert.equal((await request('/import', 'POST', badHistory)).statusCode, 400);
});
test('migração v3 preserva conteúdo e bloqueia URLs executáveis e propriedades desconhecidas', async () => {
  const p = await makeProfile('Migração');
  const config = {
    _type: 'signature-banner-config',
    version: 3,
    content: {
      name: 'Ana **Cruz**',
      role: 'Engenheira',
      site: 'example.com',
      tagline: 'Uma linha<br>Outra linha',
    },
  };
  const migrated = await request('/import/legacy', 'POST', {
    profileId: p.id,
    name: 'Legado',
    config,
  });
  assert.equal(migrated.statusCode, 201, migrated.body);
  assert.equal(migrated.json<Asset>().document.content.name, 'Ana Cruz');
  assert.equal(migrated.json<Asset>().document.content.site, 'https://example.com');
  const dangerous = {
    ...defaultDocument,
    content: { ...defaultDocument.content, site: 'javascript:alert(1)' },
  };
  assert.equal(
    (
      await request('/assets', 'POST', {
        profileId: p.id,
        name: 'Unsafe',
        platformId: 'banner',
        document: dangerous,
        tags: [],
        favorite: false,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await request('/import/legacy', 'POST', {
        profileId: p.id,
        name: 'Legado',
        config: { ...config, __proto__: null, unexpected: true },
      })
    ).statusCode,
    400,
  );
});
test('migrations são idempotentes e registros persistem ao abrir uma nova conexão', async () => {
  const p = await makeProfile('Persistente'),
    a = await makeAsset(p.id);
  const reopened = await Store.open({ connectionString, storage, schema, seed: false });
  try {
    assert.equal((await reopened.asset(a.id)).name, a.name);
    const rls = await reopened.query(
      'SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname=$1 AND relname=$2',
      [schema, 'assets'],
    );
    assert.equal(rls.rows[0].relrowsecurity, true);
  } finally {
    await reopened.close();
  }
});
test('modelos podem ser duplicados e editados sem alterar a composição original', async () => {
  const p = await makeProfile('Modelos');
  const created = await request('/templates', 'POST', {
    profileId: p.id,
    name: 'Modelo original',
    platformId: 'banner',
    document: defaultDocument,
  });
  assert.equal(created.statusCode, 201);
  const t = created.json<{ id: string }>();
  const copy = await request(`/templates/${t.id}/duplicate`, 'POST');
  assert.equal(copy.statusCode, 201);
  const id = copy.json<{ id: string }>().id;
  const changed = await request(`/templates/${id}`, 'PUT', {
    name: 'Outro modelo',
    platformId: 'banner',
    document: { ...defaultDocument, content: { ...defaultDocument.content, name: 'Outra pessoa' } },
  });
  assert.equal(changed.statusCode, 200);
  assert.equal(
    (await store.templates(p.id)).find((m) => m.id === t.id)!.document.content.name,
    defaultDocument.content.name,
  );
});
test('exclusão de contextos remove referências e reexecutar startup não recria dados excluídos', async () => {
  const isolated = 'seed_' + randomUUID().replaceAll('-', '');
  let first = await Store.open({
    connectionString,
    storage: new MemoryStorage(),
    schema: isolated,
  });
  try {
    const profile = (await first.profiles())[0];
    assert.equal((await first.assets()).length, 3);
    await first.deleteProfile(profile.id);
    await first.close();
    first = await Store.open({ connectionString, storage: new MemoryStorage(), schema: isolated });
    assert.equal((await first.profiles()).length, 0);
    assert.equal((await first.assets()).length, 0);
  } finally {
    await first.query(`DROP SCHEMA ${isolated} CASCADE`);
    await first.close();
  }
});
test('falhas de limpeza no Storage ficam registradas e são recuperadas na próxima tentativa', async () => {
  class FlakyStorage extends MemoryStorage {
    fail = true;
    override async remove(paths: string[]) {
      if (this.fail) throw new Error('Storage indisponível');
      await super.remove(paths);
    }
  }
  const objects = new FlakyStorage(),
    isolated = 'cleanup_' + randomUUID().replaceAll('-', ''),
    s = await Store.open({ connectionString, storage: objects, schema: isolated, seed: false });
  try {
    const p = await s.createProfile({ name: 'Limpeza', description: '', kit: defaultDocument });
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } })
      .png()
      .toBuffer();
    const m = await s.addMedia(p.id, 'Foto', png, 4, 4);
    await s.deleteProfile(p.id);
    assert.equal((await s.query(`SELECT path FROM ${isolated}.storage_cleanup`)).rowCount, 1);
    objects.fail = false;
    await s.collectStorage();
    assert.equal((await s.query(`SELECT path FROM ${isolated}.storage_cleanup`)).rowCount, 0);
    await assert.rejects(objects.get(`${p.id}/${m.id}.png`));
  } finally {
    await s.query(`DROP SCHEMA ${isolated} CASCADE`);
    await s.close();
  }
});

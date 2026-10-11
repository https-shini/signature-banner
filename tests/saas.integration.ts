import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { Store } from '../server/store';
import { MemoryStorage, SupabaseStorage, LocalStorage } from '../server/storage';
import { createApp } from '../server/app';
import { provisionSaas } from '../scripts/provision-saas';
import { claimLegacy } from '../scripts/claim-legacy';
import { defaultDocument, type Asset, type Profile } from '../shared/model';
const config = JSON.parse(
  await readFile(process.env.SAAS_LOCAL_STATUS ?? 'data/saas-local/status.json', 'utf8'),
);
const url = config.API_URL,
  anonKey = config.ANON_KEY,
  connectionString = config.DB_URL;
if (new URL(url).hostname !== '127.0.0.1' || new URL(connectionString).hostname !== '127.0.0.1')
  throw new Error('Tests require isolated loopback Supabase.');
let admin: Store, store: Store, app: ReturnType<typeof createApp>;
let a: SupabaseClient, b: SupabaseClient, at: string, bt: string, userA: string;
let legacyId: string, legacyAssetId: string, legacyMediaId: string, legacyBackup: Buffer;
let wa: string,
  wb: string,
  pa: string,
  pb: string,
  profile: Profile,
  asset: Asset,
  media: string,
  template: string,
  path: string;
const suffix = randomUUID(),
  password = 'Isolated!' + randomUUID();
const request = async (
  jwt: string | undefined,
  endpoint: string,
  method = 'GET',
  body?: unknown,
  w?: string,
  p?: string,
) => {
  const r = await app.inject({
    url: '/api' + endpoint,
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
    headers: {
      ...(jwt ? { authorization: 'Bearer ' + jwt } : {}),
      ...(w ? { 'x-workspace-id': w } : {}),
      ...(p ? { 'x-project-id': p } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    payload: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const A = (endpoint: string, method = 'GET', body?: unknown) =>
  request(at, endpoint, method, body, wa, pa);
const B = (endpoint: string, method = 'GET', body?: unknown) =>
  request(bt, endpoint, method, body, wb, pb);
const rest = async (jwt: string | undefined, table: string, method = 'GET', body?: unknown) => {
  const r = await fetch(url + '/rest/v1/' + table, {
    method,
    headers: {
      apikey: anonKey,
      ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}),
      'Accept-Profile': 'identity_studio',
      'Content-Profile': 'identity_studio',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, text: await r.text() };
};
before(async () => {
  admin = await Store.open({
    connectionString,
    storage: new LocalStorage('data/saas-local/legacy-images'),
    seed: false,
    maxSchemaVersion: 2,
  });
  // This dedicated local project must be empty on first run. Retain a genuine legacy row for migration proof.
  const legacy = await admin.createProfile({
    name: 'Legacy isolated',
    description: 'Unowned',
    kit: defaultDocument,
  });
  legacyId = legacy.id;
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#004499' } })
    .png()
    .toBuffer();
  const lm = await admin.addMedia(legacy.id, 'Old photo', png, 40, 30);
  legacyMediaId = lm.id;
  const la = await admin.createAsset({
    profileId: legacy.id,
    name: 'Legacy banner',
    platformId: 'signature',
    document: { ...defaultDocument, photoId: lm.id },
    tags: [],
    favorite: false,
  });
  legacyAssetId = la.id;
  legacyBackup = Buffer.from(
    JSON.stringify({
      type: 'identity-studio-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: [legacy],
      assets: [la],
      templates: [],
      media: [{ ...lm, data: png.toString('base64') }],
      revisions: await admin.revisions(la.id),
    }),
  );
  await provisionSaas(admin);
  await admin.query("NOTIFY pgrst, 'reload schema'");

  await admin.query('GRANT USAGE ON SCHEMA identity_studio TO identify_saas');
  await admin.query('GRANT SELECT ON identity_studio.schema_migrations TO identify_saas');
  assert.equal(
    (
      await admin.query(
        `SELECT count(*)::int AS n FROM identity_studio.profiles WHERE workspace_id IS NULL AND id=$1`,
        [legacy.id],
      )
    ).rows[0].n,
    1,
  );
  const runtime = new URL(connectionString);
  runtime.username = 'identify_saas';
  store = await Store.open({
    connectionString: runtime.toString(),
    storage: new MemoryStorage(),
    seed: false,
    maxSchemaVersion: 2,
    provision: false,
  });
  await store.enableSaas();
  app = createApp(store, { saas: { url, anonKey }, serveStatic: false });
  await app.ready();
  a = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  b = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const aa = await a.auth.signUp({ email: 'a-' + suffix + '@example.test', password }),
    bb = await b.auth.signUp({ email: 'b-' + suffix + '@example.test', password });
  assert.ifError(aa.error);
  assert.ifError(bb.error);
  assert.ok(aa.data.session);
  assert.ok(bb.data.session);
  at = aa.data.session.access_token;
  bt = bb.data.session.access_token;
  userA = aa.data.user!.id;
  let restReady = false;
  for (let i = 0; i < 100; i++) {
    const response = await rest(at, 'workspaces?select=id&limit=1');
    if (response.status === 200) {
      restReady = true;
      break;
    }
    if (![404, 503].includes(response.status))
      throw new Error('REST readiness failed: ' + response.status);
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(restReady, 'PostgREST exposes the provisioned schema under a real user JWT');
});
after(async () => {
  await app?.close();
  await store?.close();
  await admin?.close();
});
test('real signup, invalid password, getUser, refresh and anonymous/global-key rejection', async () => {
  assert.equal((await a.auth.getUser()).data.user?.id, userA);
  const invalid = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(
    (
      await invalid.auth.signInWithPassword({
        email: 'a-' + suffix + '@example.test',
        password: 'wrong',
      })
    ).error,
  );
  assert.equal((await request(undefined, '/profiles')).statusCode, 401);
  const head = await app.inject({
    url: '/api/workspaces',
    method: 'HEAD',
    headers: { authorization: 'Bearer ' + at },
  });
  assert.equal(head.statusCode, 200);
  assert.equal(head.headers['cache-control'], 'no-store');
  assert.equal(head.body, '');
  assert.equal(
    (
      await app.inject({
        url: '/api/workspaces',
        headers: { authorization: 'Bearer ' + at, origin: 'https://evil.example' },
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await request('old-personal-key-with-32-characters', '/workspaces')).statusCode,
    401,
  );
  assert.equal((await request(at, '/profiles')).statusCode, 400);
  const refreshed = await a.auth.refreshSession();
  assert.ifError(refreshed.error);
  assert.ok(refreshed.data.session);
  at = refreshed.data.session.access_token;
});
test('atomic owner membership and legitimate workspace/project/profile/material/image operations', async () => {
  let r = await request(at, '/workspaces', 'POST', { name: 'Workspace A' });
  assert.equal(r.statusCode, 201, r.body);
  wa = r.json().id;
  r = await request(bt, '/workspaces', 'POST', { name: 'Workspace B' });
  assert.equal(r.statusCode, 201, r.body);
  wb = r.json().id;
  const members = await rest(at, 'members');
  assert.equal(members.status, 200, members.text);
  assert.equal(JSON.parse((await rest(at, 'members')).text)[0].role, 'owner');
  r = await request(at, '/projects', 'POST', { name: 'Projeto A' }, wa);
  assert.equal(r.statusCode, 201, r.body);
  pa = r.json().id;
  r = await request(bt, '/projects', 'POST', { name: 'Projeto B' }, wb);
  assert.equal(r.statusCode, 201, r.body);
  pb = r.json().id;
  r = await A('/profiles', 'POST', { name: 'Perfil A', description: '', kit: defaultDocument });
  assert.equal(r.statusCode, 201, r.body);
  profile = r.json();
  assert.equal((await A('/profiles')).json().length, 1, 'legacy hidden');
  r = await A('/assets', 'POST', {
    profileId: profile.id,
    name: 'Material A',
    platformId: 'signature',
    document: defaultDocument,
    tags: [],
    favorite: false,
  });
  assert.equal(r.statusCode, 201, r.body);
  asset = r.json();
  const png = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#ff1155' } })
    .png()
    .toBuffer();
  r = await A('/media', 'POST', {
    profileId: profile.id,
    name: 'Private photo',
    data: png.toString('base64'),
  });
  assert.equal(r.statusCode, 201, r.body);
  media = r.json().id;
  path = wa + '/' + profile.id + '/' + media + '.png';
  const ownerDownload = await a.storage.from('identify-workspaces').download(path);
  assert.ifError(ownerDownload.error);
  assert.equal(
    (await sharp(Buffer.from(await ownerDownload.data!.arrayBuffer())).metadata()).format,
    'png',
  );
  r = await A('/templates', 'POST', {
    profileId: profile.id,
    name: 'Template A',
    platformId: 'signature',
    document: defaultDocument,
  });
  assert.equal(r.statusCode, 201, r.body);
  template = r.json().id;
});
test('B cannot read/change/delete A records, forge context, create foreign data or escalate membership', async () => {
  assert.ifError(
    (await b.auth.updateUser({ data: { role: 'owner', workspace_id: wa, user_id: userA } })).error,
  );
  for (const endpoint of [
    '/assets/' + asset.id,
    '/media/' + media,
    '/assets/' + asset.id + '/revisions',
  ])
    assert.equal((await B(endpoint)).statusCode, 404, endpoint);
  for (const endpoint of [
    '/profiles/' + profile.id,
    '/assets/' + asset.id,
    '/templates/' + template,
    '/media/' + media,
  ])
    assert.equal((await B(endpoint, 'DELETE')).statusCode, 404, endpoint);
  assert.equal(
    (
      await B('/profiles/' + profile.id, 'PUT', {
        name: 'Stolen',
        description: '',
        kit: defaultDocument,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await B('/assets/' + asset.id, 'PUT', {
        name: 'Stolen',
        platformId: asset.platformId,
        document: asset.document,
        tags: [],
        favorite: false,
        version: 1,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await B('/templates/' + template, 'PUT', {
        name: 'Stolen',
        platformId: 'signature',
        document: defaultDocument,
      })
    ).statusCode,
    404,
  );
  assert.equal((await request(bt, '/profiles', 'GET', undefined, wa, pa)).statusCode, 404);
  assert.equal((await request(bt, '/projects', 'POST', { name: 'Intruder' }, wa)).statusCode, 404);
  assert.equal(
    (
      await B('/assets', 'POST', {
        profileId: profile.id,
        name: 'Intruder',
        platformId: 'signature',
        document: defaultDocument,
        tags: [],
        favorite: false,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (await request(bt, '/workspaces/' + wa, 'PUT', { name: 'Intruder' })).statusCode,
    404,
  );
  assert.equal(
    (await request(bt, '/projects/' + pa, 'PUT', { name: 'Intruder' }, wb)).statusCode,
    404,
  );
  for (const table of [
    'workspaces',
    'projects',
    'profiles',
    'assets',
    'templates',
    'media',
    'revisions',
  ]) {
    const id =
      table === 'workspaces'
        ? wa
        : table === 'projects'
          ? pa
          : table === 'profiles'
            ? profile.id
            : table === 'assets'
              ? asset.id
              : table === 'templates'
                ? template
                : table === 'media'
                  ? media
                  : undefined;
    const result = await rest(bt, table + (id ? '?id=eq.' + id : ''));
    assert.equal(result.status, 200, result.text);
    assert.deepEqual(JSON.parse(result.text), [], table);
    if (id) {
      const deleted = await rest(bt, table + '?id=eq.' + id, 'DELETE');
      assert.ok(deleted.status === 200 || deleted.status === 403);
      if (deleted.status === 200) assert.deepEqual(JSON.parse(deleted.text), []);
    }
  }
  assert.equal(
    (
      await rest(bt, 'members', 'POST', {
        workspace_id: wa,
        user_id: (await b.auth.getUser()).data.user!.id,
        role: 'owner',
      })
    ).status,
    403,
  );
  assert.equal(
    (await rest(bt, 'projects', 'POST', { workspace_id: wa, name: 'Injected' })).status,
    403,
  );
  assert.equal(
    (await rest(bt, 'profiles', 'POST', { id: randomUUID(), workspace_id: wa, payload: profile }))
      .status,
    403,
  );
  assert.equal(
    (await rest(bt, 'workspaces?id=eq.' + wb, 'PATCH', { owner_id: userA })).status,
    403,
  );
  assert.ok((await rest(undefined, 'profiles')).status >= 400);
  assert.equal((await A('/assets/' + asset.id)).statusCode, 200);
});
test('private Storage denies foreign URLs, paths, listings, uploads, deletes and anonymous access', async () => {
  const bucket = b.storage.from('identify-workspaces');
  assert.ok((await bucket.download(path)).error);
  assert.deepEqual((await bucket.list(wa + '/' + profile.id)).data, []);
  assert.ok(
    (
      await bucket.upload(wa + '/' + profile.id + '/' + randomUUID() + '.png', Buffer.from('bad'), {
        contentType: 'image/png',
      })
    ).error,
  );
  const removed = await bucket.remove([path]);
  assert.ifError(removed.error);
  assert.deepEqual(removed.data, []);
  for (const endpoint of [
    '/storage/v1/object/authenticated/identify-workspaces/' + path,
    '/storage/v1/object/public/identify-workspaces/' + path,
  ]) {
    const response = await fetch(url + endpoint, {
      headers: { apikey: anonKey, Authorization: 'Bearer ' + bt },
    });
    assert.ok(response.status >= 400);
  }
  const anonymous = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok((await anonymous.storage.from('identify-workspaces').download(path)).error);
  assert.ifError((await a.storage.from('identify-workspaces').download(path)).error);
});
test('project switching, persistence, revision, compatible backups and portable imports retain isolation', async () => {
  let r = await A('/assets/' + asset.id, 'PUT', {
    name: 'Saved A',
    platformId: asset.platformId,
    document: { ...asset.document, photoId: media },
    tags: [],
    favorite: false,
    version: 1,
  });
  assert.equal(r.statusCode, 200, r.body);
  asset = r.json();
  assert.equal((await A('/assets/' + asset.id + '/revisions')).json().length, 2);
  const backup = (await A('/backup')).json();
  assert.equal(backup.assets.length, 1);
  assert.equal(backup.media.length, 1);
  r = await A('/import', 'POST', backup);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().assets, 1);
  const p2 = (await request(at, '/projects', 'POST', { name: 'Projeto 2' }, wa)).json().id;
  assert.deepEqual((await request(at, '/assets', 'GET', undefined, wa, p2)).json(), []);
  assert.equal(
    (await request(at, '/assets/' + asset.id, 'GET', undefined, wa, p2)).statusCode,
    404,
  );
  assert.equal(
    (await request(at, '/media/' + media, 'DELETE', undefined, wa, p2)).statusCode,
    409,
    'shared image used by another project remains protected',
  );
  // SQL role used by requests is neither a superuser nor a bypass-RLS role; context is transaction-local.
  const pooled = await store.pool.query(
    "SELECT current_user, nullif(current_setting('request.jwt.claims',true),'') AS claims",
  );
  assert.equal(pooled.rows[0].current_user, 'identify_saas');
  assert.equal(pooled.rows[0].claims, null);
  assert.equal((await B('/backup')).json().assets.length, 0);
  assert.equal((await A('/media/' + media)).statusCode, 200);
});
test('parallel requests and pool reuse keep actor/context isolated', async () => {
  const results = await Promise.all(
    Array.from({ length: 16 }, (_, i) =>
      i % 2 ? B('/assets/' + asset.id) : A('/assets/' + asset.id),
    ),
  );
  results.forEach((r, i) => assert.equal(r.statusCode, i % 2 ? 404 : 200));
  const clients = await Promise.all(Array.from({ length: 4 }, () => store.pool.connect()));
  try {
    for (const client of clients) {
      const result = await client.query(
        "SELECT current_user, nullif(current_setting('request.jwt.claims',true),'') AS claims",
      );
      assert.equal(result.rows[0].current_user, 'identify_saas');
      assert.equal(result.rows[0].claims, null);
    }
  } finally {
    clients.forEach((c) => c.release());
  }
});
test('reviewable legacy claim preserves counts and bytes; wrong owner and changed backup are rejected', async () => {
  const secrets = await readFile('data/saas-local/stack.env', 'utf8');
  const serviceKey = secrets
    .split('\n')
    .find((l) => l.startsWith('SERVICE_KEY='))!
    .slice(12);
  const target = new SupabaseStorage(url, serviceKey, 'identify-workspaces');
  const manifest = {
    userId: userA,
    workspaceId: wa,
    projectId: pa,
    profileIds: [legacyId],
    backupSha256: createHash('sha256').update(legacyBackup).digest('hex'),
  };
  assert.equal((await A('/assets/' + legacyAssetId)).statusCode, 404);
  const before = (
    await admin.query(
      'SELECT (SELECT count(*) FROM identity_studio.profiles) AS profiles,(SELECT count(*) FROM identity_studio.assets) AS assets,(SELECT count(*) FROM identity_studio.media) AS media',
    )
  ).rows[0];
  const dry = await claimLegacy(admin, manifest, legacyBackup, admin.storage, target);
  assert.equal(dry.applied, false);
  assert.equal((await A('/assets/' + legacyAssetId)).statusCode, 404);
  await assert.rejects(() =>
    claimLegacy(admin, { ...manifest, workspaceId: wb }, legacyBackup, admin.storage, target, true),
  );
  await assert.rejects(() =>
    claimLegacy(
      admin,
      { ...manifest, backupSha256: '0'.repeat(64) },
      legacyBackup,
      admin.storage,
      target,
      true,
    ),
  );
  const result = await claimLegacy(admin, manifest, legacyBackup, admin.storage, target, true);
  assert.equal(result.applied, true);
  const after = (
    await admin.query(
      'SELECT (SELECT count(*) FROM identity_studio.profiles) AS profiles,(SELECT count(*) FROM identity_studio.assets) AS assets,(SELECT count(*) FROM identity_studio.media) AS media',
    )
  ).rows[0];
  assert.deepEqual(after, before);
  assert.equal((await A('/assets/' + legacyAssetId)).statusCode, 200);
  assert.equal((await B('/assets/' + legacyAssetId)).statusCode, 404);
  const own = await a.storage
    .from('identify-workspaces')
    .download(wa + '/' + legacyId + '/' + legacyMediaId + '.png');
  assert.ifError(own.error);
  assert.ok(
    (await admin.storage.get(legacyId + '/' + legacyMediaId + '.png')).equals(
      Buffer.from(await own.data!.arrayBuffer()),
    ),
  );
  await assert.rejects(() =>
    claimLegacy(admin, manifest, legacyBackup, admin.storage, target, true),
  );
});
test('actual recovery email, password reset, login with new password and logout', async () => {
  const recovery = await a.auth.resetPasswordForEmail('a-' + suffix + '@example.test', {
    redirectTo: 'http://127.0.0.1:3000/auth/callback',
  });
  assert.ifError(recovery.error);
  let message: any;
  for (let i = 0; i < 20; i++) {
    const inbox = await fetch('http://127.0.0.1:54324/api/v1/messages').then((r) => r.json());
    message = inbox.messages?.find((m: any) =>
      m.To?.some((x: any) => x.Address === 'a-' + suffix + '@example.test'),
    );
    if (message) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(message, 'real local recovery email delivered');
  const detail = await fetch('http://127.0.0.1:54324/api/v1/message/' + message.ID).then((r) =>
    r.json(),
  );
  const link = (detail.HTML as string)
    .match(/href="([^"]*\/auth\/v1\/verify[^"]+)"/)?.[1]
    ?.replaceAll('&amp;', '&');
  assert.ok(link);
  const u = new URL(link!),
    hash = u.searchParams.get('token');
  assert.ok(hash);
  const reset = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await reset.auth.verifyOtp({ token_hash: hash!, type: 'recovery' });
  assert.ifError(verified.error);
  const newPassword = 'Changed!' + randomUUID();
  assert.ifError((await reset.auth.updateUser({ password: newPassword })).error);
  assert.ok(
    (await a.auth.signInWithPassword({ email: 'a-' + suffix + '@example.test', password })).error,
  );
  const login = await a.auth.signInWithPassword({
    email: 'a-' + suffix + '@example.test',
    password: newPassword,
  });
  assert.ifError(login.error);
  at = login.data.session!.access_token;
  // Scoped deletion and durable image cleanup leave no test file behind.
  const own = (await A('/profiles')).json();
  for (const p of own) assert.equal((await A('/profiles/' + p.id, 'DELETE')).statusCode, 204);
  assert.ok((await a.storage.from('identify-workspaces').download(path)).error);
  const revokedToken = at;
  assert.ifError((await a.auth.signOut()).error);
  assert.equal((await request(revokedToken, '/workspaces')).statusCode, 401);
  assert.equal((await a.auth.getSession()).data.session, null);
  await mkdir('test-results/saas', { recursive: true });
  await writeFile(
    'test-results/saas/security.json',
    JSON.stringify(
      {
        environment: 'isolated-local-supabase',
        realUsers: 2,
        auth: true,
        rls: true,
        storage: true,
        recoveryEmail: true,
        legacyHidden: true,
      },
      null,
      2,
    ),
  );
});

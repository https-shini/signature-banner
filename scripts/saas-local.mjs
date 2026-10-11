import { randomBytes, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile, open, chmod, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
const root = resolve('data/saas-local');
await mkdir(root, { recursive: true, mode: 0o700 });
const envFile = resolve(root, 'stack.env'),
  statusFile = resolve(root, 'status.json');
try {
  await readFile(envFile);
} catch {
  const secret = randomBytes(32).toString('hex'),
    db = randomBytes(24).toString('hex');
  const jwt = (role) => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        role,
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400 * 365,
      }),
    ).toString('base64url');
    return (
      header +
      '.' +
      payload +
      '.' +
      createHmac('sha256', secret)
        .update(header + '.' + payload)
        .digest('base64url')
    );
  };
  const anon = jwt('anon'),
    service = jwt('service_role');
  await writeFile(
    envFile,
    `DB_PASSWORD=${db}\nJWT_SECRET=${secret}\nANON_KEY=${anon}\nSERVICE_KEY=${service}\n`,
    { mode: 0o600 },
  );
  await writeFile(
    statusFile,
    JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      ANON_KEY: anon,
      DB_URL: `postgresql://postgres:${db}@127.0.0.1:54322/postgres`,
    }),
    { mode: 0o600 },
  );
}
const cmd = process.argv[2] ?? 'up';
const project = process.env.SAAS_LOCAL_PROJECT ?? 'identify-saas-test';
if (!/^[a-z][a-z0-9-]{0,50}$/.test(project)) throw new Error('Nome do stack local inválido.');
const args = [
  'compose',
  '-p',
  project,
  '--env-file',
  envFile,
  '-f',
  'scripts/saas-local/compose.yml',
];
if (cmd === 'down') {
  try {
    const pid = Number(await readFile(resolve(root, 'gateway.pid'), 'utf8'));
    const command = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    if (command.includes('saas-local/gateway.mjs')) process.kill(pid);
  } catch {}
  await unlink(resolve(root, 'gateway.pid')).catch(() => {});
  execFileSync('docker', [...args, 'down'], { stdio: 'inherit' });
  process.exit(0);
}
if (cmd === 'up') {
  await chmod('scripts/saas-local/init.sql', 0o644);
  execFileSync('docker', [...args, 'up', '-d'], { stdio: 'inherit' });
  let running = false;
  try {
    const pid = Number(await readFile(resolve(root, 'gateway.pid'), 'utf8'));
    const command = await readFile(`/proc/${pid}/cmdline`, 'utf8');
    running = command.includes('saas-local/gateway.mjs');
  } catch {}
  if (!running) {
    const log = await open(resolve(root, 'gateway.log'), 'a', 0o600);
    const child = spawn(process.execPath, ['scripts/saas-local/gateway.mjs'], {
      detached: true,
      stdio: ['ignore', log.fd, log.fd],
    });
    child.unref();
    await writeFile(resolve(root, 'gateway.pid'), String(child.pid), { mode: 0o600 });
    await log.close();
  }
}
if (cmd === 'up') {
  for (const endpoint of ['/auth/v1/health', '/storage/v1/status']) {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      const response = await fetch('http://127.0.0.1:54321' + endpoint).catch(() => null);
      if (response?.ok) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw new Error('Local service did not become ready: ' + endpoint);
  }
}
console.log('Local status file:', statusFile, '(private; do not print its values)');

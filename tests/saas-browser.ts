import { chromium, type Page } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Store } from '../server/store';
import { MemoryStorage } from '../server/storage';
import { createApp } from '../server/app';
const config = JSON.parse(await readFile('data/saas-local/status.json', 'utf8'));
if (new URL(config.API_URL).hostname !== '127.0.0.1')
  throw new Error('Isolated local Supabase required.');
const db = new URL(config.DB_URL);
db.username = 'identify_saas';
const store = await Store.open({
  connectionString: db.toString(),
  storage: new MemoryStorage(),
  seed: false,
  maxSchemaVersion: 2,
  provision: false,
});
await store.enableSaas();
const app = createApp(store, { saas: { url: config.API_URL, anonKey: config.ANON_KEY } });
await app.listen({ host: '127.0.0.1', port: 3080 });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, XDG_CACHE_HOME: '/tmp/identity-browser-cache' },
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }),
  page = await context.newPage();
const errors: string[] = [],
  checks: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());
const email = 'browser-' + randomUUID() + '@example.test',
  password = 'Browser!' + randomUUID();
const check = async (name: string, fn: () => Promise<void>) => {
  await fn();
  checks.push(name);
  console.log('PASS ' + name);
};
async function audit(p: Page, name: string) {
  const result = await new AxeBuilder({ page: p })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await writeFile(
    'test-results/saas/axe-' + name + '.json',
    JSON.stringify(result.violations, null, 2),
  );
  assert.deepEqual(result.violations, [], name);
}
async function createProject(name: string) {
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Nome do projeto').fill(name);
  await d.getByRole('button', { name: 'Criar projeto', exact: true }).click();
  await d.waitFor({ state: 'hidden' });
}
try {
  await mkdir('test-results/saas', { recursive: true });
  await check('signup, real session and accessible onboarding', async () => {
    await page.goto('http://127.0.0.1:3080');
    await page.getByRole('heading', { name: 'Seu espaço de trabalho, protegido.' }).waitFor();
    await audit(page, 'login-desktop');
    await page.setViewportSize({ width: 320, height: 800 });
    await audit(page, 'login-mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'test-results/saas/login-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByLabel('Confirmar senha').fill(password);
    await page.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await page.getByRole('heading', { name: 'Tudo começa no seu workspace.' }).waitFor();
    await audit(page, 'onboarding');
  });
  await check('workspace/project CRUD and opening the existing editor', async () => {
    await page.getByRole('button', { name: 'Criar primeiro workspace' }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome do workspace').fill('Minha marca SaaS');
    await dialog.getByLabel('Descrição').fill('Marca profissional privada');
    await dialog.getByRole('button', { name: 'Criar workspace', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Criar primeiro projeto' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome do projeto').fill('Presença profissional');
    await dialog.getByRole('button', { name: 'Criar projeto', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await audit(page, 'dashboard');
    await page.screenshot({ path: 'test-results/saas/dashboard-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Editar projeto Presença profissional' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Descrição').fill('Gmail e LinkedIn');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Abrir projeto' }).click();
    await page.getByRole('heading', { name: 'Sua identidade começa aqui.' }).waitFor();
    await page.getByRole('button', { name: 'Criar contexto', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome do contexto').fill('Marca da Ana');
    await dialog.getByRole('button', { name: 'Criar contexto', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByLabel('Nome profissional', { exact: true }).fill('Ana Silva');
    await page.getByRole('button', { name: 'Salvar identidade' }).click();
    await page.getByRole('button', { name: 'Meus ativos' }).click();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
  });
  await check(
    'reference signature editing, actual upload, persistence and valid PNG export',
    async () => {
      await page.getByRole('button', { name: 'Criar ativo', exact: true }).first().click();
      let dialog = page.getByRole('dialog');
      await dialog.getByLabel('Nome do ativo').fill('Assinatura SaaS');
      await dialog.getByLabel('Plataforma e finalidade').selectOption('gmail-banner');
      await dialog.getByLabel('Ponto de partida').selectOption('system-signature-reference');
      await dialog.getByRole('button', { name: 'Criar ativo', exact: true }).click();
      await page.getByRole('heading', { name: 'Assinatura SaaS', exact: true }).waitFor();
      await page.getByLabel('Nome profissional', { exact: true }).fill('Ana no Gmail');
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await page.getByText('Salvo · v2', { exact: true }).waitFor();
      await audit(page, 'editor');
      await page.getByRole('button', { name: 'Voltar para ativos', exact: true }).click();
      await page.getByRole('button', { name: 'Biblioteca de mídia' }).click();
      const png = await sharp({
        create: { width: 100, height: 80, channels: 3, background: '#ff0055' },
      })
        .png()
        .toBuffer();
      await page
        .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
        .setInputFiles({ name: 'Foto SaaS.png', mimeType: 'image/png', buffer: png });
      await page.getByText('Foto SaaS.png', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: 'Meus ativos' }).click();
      await page.getByRole('button', { name: 'Editar Assinatura SaaS' }).click();
      await page.getByRole('tab', { name: 'Mídia', exact: true }).click();
      await page
        .getByLabel('Foto de perfil', { exact: true })
        .selectOption(
          (await page
            .getByLabel('Foto de perfil', { exact: true })
            .locator('option')
            .filter({ hasText: 'Foto SaaS.png' })
            .getAttribute('value'))!,
        );
      await page.getByRole('button', { name: 'Salvar alterações' }).click();
      await page.getByText('Salvo · v3', { exact: true }).waitFor();
      await page.reload();
      await page.getByRole('heading', { name: 'Tudo começa no seu workspace.' }).waitFor();
      await page.getByRole('button', { name: 'Abrir projeto' }).click();
      await page.getByRole('button', { name: 'Editar Assinatura SaaS' }).click();
      await page.getByRole('tab', { name: 'Mídia', exact: true }).click();
      assert.ok(await page.getByLabel('Foto de perfil', { exact: true }).inputValue());
      await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      dialog = page.getByRole('dialog');
      const downloaded = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Exportar PNG', exact: true }).click();
      const file = await downloaded;
      const metadata = await sharp(await readFile((await file.path())!)).metadata();
      assert.equal(metadata.format, 'png');
      assert.equal(metadata.width, 1200);
      assert.equal(metadata.height, 320);
      await file.saveAs('test-results/saas/signature.png');
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    },
  );
  await check('dirty guard, project/workspace switching and new-user isolation', async () => {
    await page.getByRole('tab', { name: 'Conteúdo', exact: true }).click();
    await page.getByLabel('Nome profissional', { exact: true }).fill('Unsaved draft');
    page.removeAllListeners('dialog');
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    assert.equal(
      await page.getByLabel('Nome profissional', { exact: true }).inputValue(),
      'Unsaved draft',
    );
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar edição', exact: true }).click();
    await page.getByRole('heading', { name: 'Assinatura SaaS', exact: true }).waitFor();
    assert.equal(
      await page.getByLabel('Nome profissional', { exact: true }).inputValue(),
      'Ana no Gmail',
    );
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await createProject('Outro projeto');
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: 'Outro projeto', exact: true }) })
      .getByRole('button', { name: 'Abrir projeto' })
      .click();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
    assert.equal(await page.locator('.asset-card').count(), 0);
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('button', { name: 'Novo workspace', exact: true }).click();
    const d = page.getByRole('dialog');
    await d.getByLabel('Nome do workspace').fill('Segunda marca');
    await d.getByRole('button', { name: 'Criar workspace', exact: true }).click();
    await d.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Criar primeiro projeto' }).waitFor();
    await page.getByLabel('Workspace ativo').selectOption({ label: 'Minha marca SaaS' });
    await page.getByRole('heading', { name: 'Presença profissional', exact: true }).waitFor();
    const ctx = await browser.newContext(),
      p = await ctx.newPage();
    await p.goto('http://127.0.0.1:3080');
    await p.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await p.getByLabel('E-mail', { exact: true }).fill('second-' + randomUUID() + '@example.test');
    await p.getByLabel('Senha', { exact: true }).fill(password);
    await p.getByLabel('Confirmar senha').fill(password);
    await p.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
    await p.getByRole('heading', { name: 'Um espaço que é seu.' }).waitFor();
    assert.equal(await p.getByText('Minha marca SaaS', { exact: true }).count(), 0);
    await ctx.close();
  });
  await check('mobile dashboard, account, reduced motion, logout and invalid login', async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await audit(page, 'dashboard-mobile');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: 'test-results/saas/dashboard-mobile.png', fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
    await audit(page, 'account-mobile');
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('heading', { name: 'Seu espaço de trabalho, protegido.' }).waitFor();
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Senha', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
    await page.getByRole('alert').getByText('E-mail ou senha incorretos.').waitFor();
    await page.getByLabel('Senha', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
    await page.getByRole('heading', { name: 'Tudo começa no seu workspace.' }).waitFor();
  });
  await check('browser recovery link, PKCE return and password reset', async () => {
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await page.getByRole('button', { name: 'Recuperar senha', exact: true }).click();
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await page
      .getByRole('status')
      .getByText(/Se houver uma conta/)
      .waitFor();
    let mail: any;
    for (let i = 0; i < 30; i++) {
      const inbox = await fetch('http://127.0.0.1:54324/api/v1/messages').then((r) => r.json());
      mail = inbox.messages?.find((m: any) => m.To?.some((x: any) => x.Address === email));
      if (mail) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(mail);
    const detail = await fetch('http://127.0.0.1:54324/api/v1/message/' + mail.ID).then((r) =>
      r.json(),
    );
    const link = detail.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]+)"/)?.[1]?.replaceAll(
      '&amp;',
      '&',
    );
    assert.ok(link);
    await page.goto(link);
    await page.getByRole('heading', { name: 'Crie uma nova senha.' }).waitFor();
    await audit(page, 'reset-password');
    const next = 'Reset!' + randomUUID();
    await page.getByLabel('Nova senha', { exact: true }).fill(next);
    await page.getByLabel('Confirmar senha').fill(next);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await page.getByRole('heading', { name: 'Tudo começa no seu workspace.' }).waitFor();
    // A consumed recovery link cannot establish a second recovery session.
    await page.goto(link);
    await page.getByRole('heading', { name: 'Seu espaço de trabalho, protegido.' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Crie uma nova senha.' }).count(), 0);
  });
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/saas/browser.json',
    JSON.stringify({ checks, errors, realAuth: true, realStorage: true, localOnly: true }, null, 2),
  );
} catch (error) {
  console.log(
    'Failure page:',
    new URL(page.url()).pathname,
    await page.locator('h1').allTextContents(),
  );
  await page.screenshot({ path: 'test-results/saas/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await app.close();
  await store.close();
}

import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Store } from '../server/store.ts';
import { MemoryStorage } from '../server/storage.ts';
import { createApp } from '../server/app.ts';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
const stage = 'after';
const out = resolve(process.env.GLASS_EVIDENCE_DIR ?? 'test-results/liquid-glass');
await mkdir(out, { recursive: true });
const schema = 'glass_' + randomUUID().replaceAll('-', '');
const store = await Store.open({
  connectionString:
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/identity_studio',
  schema,
  storage: new MemoryStorage(),
});
const profile = (await store.profiles())[0];
const kit = structuredClone(profile.kit);
kit.content = {
  ...kit.content,
  name: 'Ana Martins',
  role: 'Designer de marcas',
  email: 'ana@example.com',
  site: 'https://example.com',
  qrUrl: 'https://example.com',
  tagline: 'Ideias que ganham presença.',
  eyebrow: 'DESIGN & IDENTIDADE',
};
await store.updateProfile(profile.id, {
  name: 'Estúdio Aurora',
  description: 'Contexto exclusivo de testes locais',
  kit,
});
for (const a of await store.assets())
  await store.updateAsset(a.id, {
    name: a.name,
    platformId: a.platformId,
    document: { ...a.document, content: kit.content },
    tags: a.tags,
    favorite: a.favorite,
    version: a.version,
  });
await store.createTemplate({
  profileId: profile.id,
  name: 'Presença Aurora',
  platformId: 'banner',
  document: kit,
});
await store.addMedia(
  profile.id,
  'Paleta Aurora.png',
  await sharp({ create: { width: 240, height: 200, channels: 3, background: '#9e8cff' } })
    .png()
    .toBuffer(),
  240,
  200,
);
const token = 'local-visual-fixture-key-with-32-characters';
const app = createApp(store, { token });
const address = await app.listen({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [],
  audit = [],
  overflow = [],
  checks = [],
  performance = [],
  external = [];
try {
  for (const [device, width, height] of [
    ['desktop', 1440, 1050],
    ['tablet', 834, 1112],
    ['mobile', 390, 844],
    ['compact', 320, 812],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith(address)) external.push(r.url());
    });
    await page.goto(address);
    await page.getByRole('heading', { name: 'Seu espaço, protegido.' }).waitFor();
    async function capture(name) {
      await sharp(await page.screenshot({ fullPage: true }))
        .webp({ quality: 90 })
        .toFile(out + '/' + name + '-' + device + '.webp');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      audit.push({
        name,
        device,
        violations: results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
      overflow.push({
        name,
        device,
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      });
    }
    await capture('login');
    await page.getByLabel('Chave de acesso').fill(token);
    await page.getByRole('button', { name: 'Entrar no Studio' }).click();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
    await capture('library');
    performance.push({
      device,
      ...(await page.evaluate(() => ({
        navigationMs: Math.round(globalThis.performance.getEntriesByType('navigation')[0].duration),
        blurSurfaces: [...document.querySelectorAll('*')].filter((e) => {
          const css = getComputedStyle(e);
          return css.backdropFilter !== 'none' && css.display !== 'none';
        }).length,
      }))),
    });
    await page.getByRole('button', { name: 'Editar Banner · Apresentação', exact: true }).click();
    await page.getByRole('heading', { name: 'Banner · Apresentação', exact: true }).waitFor();
    await capture('editor');
    const firstTab = page.getByRole('tab', { name: 'Conteúdo', exact: true });
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(
      await page.getByRole('tab', { name: 'Aparência', exact: true }).getAttribute('aria-selected'),
      'true',
    );
    await page.keyboard.press('End');
    assert.equal(
      await page.getByRole('tab', { name: 'Histórico', exact: true }).getAttribute('aria-selected'),
      'true',
    );
    await page.keyboard.press('Home');
    assert.equal(await firstTab.getAttribute('aria-selected'), 'true');
    assert.equal(await firstTab.evaluate((e) => e === document.activeElement), true);
    checks.push('tabs-keyboard-' + device);
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    await capture('export');
    for (let n = 0; n < 16; n++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await page.getByRole('dialog').evaluate((e) => e.contains(document.activeElement)),
        true,
      );
    }
    for (let n = 0; n < 16; n++) {
      await page.keyboard.press('Shift+Tab');
      assert.equal(
        await page.getByRole('dialog').evaluate((e) => e.contains(document.activeElement)),
        true,
      );
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(
      await page
        .getByRole('button', { name: 'Exportar', exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    checks.push('modal-focus-trap-escape-restore-' + device);
    await page.getByRole('button', { name: 'Voltar para ativos' }).click();
    for (const [button, heading, name] of [
      ['Minha identidade', 'Minha identidade', 'identity'],
      ['Biblioteca de mídia', 'Biblioteca de mídia.', 'media'],
      ['Modelos', 'Modelos.', 'templates'],
    ]) {
      await page
        .getByRole('button', { name: button, exact: button !== 'Minha identidade' })
        .first()
        .click();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      await capture(name);
    }
    await page.getByRole('button', { name: 'Configurações e backup', exact: true }).click();
    await page.getByRole('heading', { name: 'Configurações e backup', exact: true }).waitFor();
    await page.setViewportSize({ width, height });
    await capture('settings');

    if (device === 'mobile') {
      await page.getByRole('button', { name: 'Encerrar sessão', exact: true }).click();
      await page.getByRole('heading', { name: 'Seu espaço, protegido.' }).waitFor();
      checks.push('mobile-settings-logout');
    }
    if (device === 'desktop') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Meus ativos', exact: false }).first().click();
      await page.getByRole('button', { name: 'Criar ativo', exact: true }).first().click();
      assert.equal(
        await page.getByRole('dialog').evaluate((e) => getComputedStyle(e).animationName),
        'none',
      );
      await capture('reduced-motion');
      await page.keyboard.press('Escape');
      checks.push('reduced-motion');
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
      assert.equal(
        await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches),
        true,
      );
      assert.equal(
        await page
          .locator('.sidebar')
          .evaluate((e) => getComputedStyle(e).backdropFilter === 'none'),
        true,
      );
      assert.equal(
        await page
          .locator('.asset-card')
          .first()
          .evaluate((e) => getComputedStyle(e).backgroundColor),
        'rgb(255, 255, 255)',
      );
      await capture('reduced-transparency');
      checks.push('reduced-transparency');
      await cdp.send('Emulation.setEmulatedMedia', { features: [] });
      // Exercise the shared fallback values; this does not simulate an older rendering engine.
      await page.evaluate(() => (document.documentElement.dataset.transparency = 'reduced'));
      assert.equal(
        await page
          .locator('.sidebar')
          .evaluate((e) => getComputedStyle(e).backdropFilter === 'none'),
        true,
      );
      await page.evaluate(() => delete document.documentElement.dataset.transparency);
      checks.push('opaque-material-fallback');
      await page.emulateMedia({ forcedColors: 'active' });
      assert.equal(
        await page.locator('.sidebar').evaluate((e) => getComputedStyle(e).backdropFilter),
        'none',
      );
      checks.push('forced-colors');
      await page.emulateMedia({ forcedColors: 'none' });
      await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
      await capture('text-200');
      const brand = await page.locator('.brand').boundingBox(),
        chrome = await page.locator('.sidebar').boundingBox();
      assert.ok(brand.x + brand.width <= chrome.x + chrome.width);
      await page.getByRole('button', { name: 'Configurações e backup', exact: true }).click();
      await page.getByRole('heading', { name: 'Configurações e backup', exact: true }).waitFor();
      checks.push('text-200-sidebar-scroll');
      await page.getByRole('button', { name: 'Meus ativos', exact: false }).first().click();
      await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
      checks.push('text-200');
      await page.route('**/api/assets?*', (r) =>
        r.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Falha de rede simulada no teste local.' }),
        }),
      );
      await page.reload();
      await page.getByRole('alert').first().waitFor();
      await capture('network-error');
      await page.unroute('**/api/assets?*');
      await page.reload();
      await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
      checks.push('network-error-recovery');
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + '/audit.json',
    JSON.stringify({ stage, errors, external, checks, performance, audit, overflow }, null, 2),
  );
  assert.deepEqual(external, []);
  assert.deepEqual(
    audit.filter((x) => x.violations.length),
    [],
  );
  assert.deepEqual(
    overflow.filter((x) => x.overflow),
    [],
  );
  assert.ok(performance.every((x) => x.blurSurfaces <= 2));
  console.log(
    JSON.stringify(
      {
        stage,
        captures: audit.length,
        checks,
        performance,
        violations: [],
        overflow: [],
        errors,
        external,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await app.close();
  await store.query('DROP SCHEMA ' + schema + ' CASCADE');
  await store.close();
}

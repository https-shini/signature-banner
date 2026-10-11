import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { Store } from '../server/store';
import { LocalStorage } from '../server/storage';
import { createApp } from '../server/app';
const schema = 'browser_' + randomUUID().replaceAll('-', '');
const token = 'browser-test-access-with-at-least-32-characters';
const store = await Store.open({
  connectionString:
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/identity_studio',
  schema,
  storage: new LocalStorage('/tmp/' + schema),
});
const app = createApp(store, { token });
const address = await app.listen({ host: '127.0.0.1', port: 0 });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  env: { ...process.env, XDG_CACHE_HOME: '/tmp/identity-browser-cache' },
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } }),
  page = await context.newPage();
const errors: string[] = [],
  external: string[] = [],
  checks: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', async (response) => {
  if (response.status() >= 400 && response.url().includes('/api/'))
    console.log(
      'API failure',
      response.status(),
      new URL(response.url()).pathname,
      await response.text(),
    );
});
page.on('request', (request) => {
  if (/^https?:/.test(request.url()) && !request.url().startsWith(address))
    external.push(request.url());
});
page.on('dialog', async (dialog) =>
  dialog.accept(dialog.type() === 'prompt' ? 'Modelo do navegador' : undefined),
);
async function audit(name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await import('node:fs/promises').then((fs) =>
    fs.writeFile('test-results/axe-' + name + '.json', JSON.stringify(result.violations, null, 2)),
  );
  assert.deepEqual(result.violations, [], 'Acessibilidade: ' + name);
}
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  checks.push(name);
  console.log('PASS ' + name);
}
try {
  await mkdir('test-results', { recursive: true });
  await check('login e biblioteca conectada à API', async () => {
    await page.goto(address);
    await page.getByRole('heading', { name: 'Seu espaço, protegido.' }).waitFor();
    await page.getByLabel('Chave de acesso').fill(token);
    await page.getByRole('button', { name: 'Entrar no Studio' }).click();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
    assert.equal(await page.locator('.asset-card').count(), 3);
    await audit('library');
    await page.screenshot({ path: 'test-results/library-desktop.png', fullPage: true });
  });
  await check('criação, edição ao vivo, tags e persistência após recarregar', async () => {
    await page.getByRole('button', { name: 'Criar ativo', exact: true }).first().click();
    await page.getByLabel('Nome do ativo', { exact: true }).fill('Projeto E2E');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Criar ativo', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Projeto E2E', exact: true }).waitFor();
    await page.getByLabel('Nome profissional', { exact: true }).fill('Ana Martins');
    await page.getByLabel('Tags', { exact: true }).fill('Marca, Portfólio');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByText('Salvo · v2', { exact: true }).waitFor();
    const asset = (await store.assets()).find((a) => a.name === 'Projeto E2E')!;
    assert.equal(asset.document.content.name, 'Ana Martins');
    assert.deepEqual(asset.tags, ['Marca', 'Portfólio']);
    await audit('editor');
    await page.reload();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
    await page.getByRole('button', { name: 'Editar Projeto E2E' }).click();
    assert.equal(await page.getByLabel('Nome profissional').inputValue(), 'Ana Martins');
  });
  await check('paletas, biblioteca de modelos e histórico restaurável', async () => {
    await page.getByRole('tab', { name: 'Aparência', exact: true }).click();
    await page.getByRole('button', { name: 'Paleta Papel' }).click();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByText('Salvo · v3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salvar como modelo' }).click();
    await page.getByText('Modelo salvo para reutilizar neste contexto.').waitFor();
    await page.getByRole('tab', { name: 'Histórico', exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar versão 2', exact: true }).click();
    await page.getByText('Salvo · v4', { exact: true }).waitFor();
    assert.equal((await store.templates()).length, 1);
  });
  await check('downloads PNG, JPEG, WebP e SVG geram arquivos reais', async () => {
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await audit('export');
    for (const format of ['png', 'jpeg', 'webp', 'svg']) {
      await dialog.getByLabel('Formato', { exact: true }).selectOption(format);
      const downloaded = page.waitForEvent('download');
      await dialog
        .getByRole('button', { name: 'Exportar ' + format.toUpperCase(), exact: true })
        .click();
      const file = await downloaded;
      const path = await file.path();
      assert.ok(path);
      const bytes = await readFile(path);
      if (format === 'svg') assert.ok(bytes.toString().includes('<svg'));
      else {
        const metadata = await sharp(bytes).metadata();
        assert.equal(metadata.format, format);
        assert.equal(metadata.width, 1200);
        assert.equal(metadata.height, 320);
      }
    }
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  });
  await check('exportação HTML de assinatura mantém contatos clicáveis', async () => {
    await page.getByRole('button', { name: 'Voltar para ativos' }).click();
    await page.getByRole('button', { name: 'Exportar Assinatura · Gmail', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Formato', { exact: true }).selectOption('html');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Exportar HTML', exact: true }).click();
    const file = await downloaded;
    const html = await readFile((await file.path())!, 'utf8');
    assert.ok(html.includes('href="mailto:'));
    assert.ok(html.includes('<table'));
    await dialog.getByRole('button', { name: 'Fechar' }).click();
  });
  await check('upload de foto, seleção e recorte na composição', async () => {
    await page.getByRole('button', { name: 'Biblioteca de mídia', exact: true }).click();
    const buffer = await sharp({
      create: { width: 240, height: 200, channels: 3, background: '#d67657' },
    })
      .png()
      .toBuffer();
    await page
      .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
      .setInputFiles({ name: 'Foto E2E.png', mimeType: 'image/png', buffer });
    await page.getByRole('heading', { name: 'Foto E2E.png', exact: true }).waitFor();
    await audit('media');
    await page.getByRole('button', { name: 'Meus ativos', exact: false }).click();
    await page.getByRole('button', { name: 'Editar Projeto E2E' }).click();
    await page.getByRole('tab', { name: 'Mídia', exact: true }).click();
    const image = (await store.medias())[0];
    await page.getByLabel('Foto de perfil', { exact: true }).selectOption(image.id);
    const slider = page.getByRole('slider', { name: /Zoom da foto/ });
    await slider.focus();
    for (let step = 0; step < 10; step++) await slider.press('ArrowRight');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await page.getByText('Salvo · v5', { exact: true }).waitFor();
    assert.equal(
      (await store.assets()).find((a) => a.name === 'Projeto E2E')!.document.layout.photoZoom,
      1.5,
    );
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const dialog = page.getByRole('dialog'),
      downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Exportar PNG', exact: true }).click();
    const file = await downloaded;
    assert.ok((await sharp(await readFile((await file.path())!)).metadata()).width);
    await dialog.getByRole('button', { name: 'Fechar' }).click();
    await page.getByRole('button', { name: 'Voltar para ativos' }).click();
  });
  await check('busca, filtro, duplicação e exclusão de ativos', async () => {
    await page.getByLabel('Buscar ativos').fill('Projeto E2E');
    assert.equal(await page.locator('.asset-card').count(), 1);
    await page.getByRole('button', { name: 'Duplicar Projeto E2E', exact: true }).click();
    await page.getByRole('button', { name: 'Editar Projeto E2E · cópia', exact: true }).waitFor();
    assert.equal(await page.locator('.asset-card').count(), 2);
    await page.getByRole('button', { name: 'Excluir Projeto E2E · cópia', exact: true }).click();
    await page.getByText('Ativo excluído.').waitFor();
    assert.equal(await page.locator('.asset-card').count(), 1);
    await page.getByLabel('Buscar ativos').fill('');
  });
  await check('backup portátil e importação aditiva validam imagens e versões', async () => {
    await page.getByRole('button', { name: 'Configurações e backup', exact: true }).click();
    await audit('settings');
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar backup completo' }).click();
    const file = await downloaded;
    const backup = await readFile((await file.path())!);
    const parsed = JSON.parse(backup.toString());
    assert.equal(parsed.type, 'identity-studio-backup');
    assert.equal(parsed.media.length, 1);
    const originalProfiles = (await store.profiles()).length;
    await page
      .locator('input[type=file][accept=".json,application/json"]')
      .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await page.getByText(/contexto\(s\) e .*ativo\(s\) importados/).waitFor();
    assert.equal((await store.profiles()).length, originalProfiles * 2);
  });
  await check('contextos independentes e identidade reutilizável', async () => {
    await page.getByRole('button', { name: 'Novo contexto', exact: true }).click();
    await page.getByLabel('Nome do contexto', { exact: true }).fill('Marca independente');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Criar contexto', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Minha identidade', exact: true }).waitFor();
    assert.equal(await page.getByLabel('Nome profissional').inputValue(), 'Marca independente');
    await audit('identity');
    assert.equal(
      (
        await store.assets(
          (await store.profiles()).find((p) => p.name === 'Marca independente')!.id,
        )
      ).length,
      0,
    );
    await page.getByLabel('Cargo', { exact: true }).fill('Consultora');
    await page.getByRole('button', { name: 'Salvar identidade', exact: true }).click();
    await page.getByText('Identidade atualizada.').waitFor();
    await page.getByRole('button', { name: 'Meus ativos', exact: false }).click();
    await page.getByRole('heading', { name: 'Minha biblioteca.' }).waitFor();
    assert.equal(await page.locator('.asset-card').count(), 0);
  });
  await page.getByRole('button', { name: 'Modelos', exact: true }).click();
  await page.getByRole('heading', { name: 'Modelos.' }).waitFor();
  await audit('templates');
  await page.getByRole('button', { name: 'Meus ativos', exact: false }).click();
  await check('layout móvel sem overflow horizontal', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/library-mobile.png', fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    await page.setViewportSize({ width: 1440, height: 1050 });
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(
      'test-results/accessibility.json',
      JSON.stringify(accessibility.violations, null, 2),
    ),
  );
  console.log(
    'Accessibility violations:',
    accessibility.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  );
  assert.deepEqual(accessibility.violations, [], 'Acessibilidade WCAG AA');
  checks.push('acessibilidade WCAG AA');
  await page
    .getByLabel('Contexto ativo', { exact: true })
    .selectOption(
      (await store.profiles()).find((p) => p.name === 'Perfil principal')?.id ??
        (await store.profiles())[0].id,
    );
  const { platforms: catalogue } = await import('../shared/model');
  await check(
    'formatos Gmail, LinkedIn, Instagram e YouTube criam composições e exportam PNG nas dimensões corretas',
    async () => {
      for (const id of [
        'gmail-banner',
        'linkedin',
        'linkedin-avatar',
        'instagram-story',
        'youtube-banner',
        'youtube-thumbnail',
      ] as const) {
        const preset = catalogue.find((p) => p.id === id)!;
        await page.getByRole('button', { name: 'Criar ativo', exact: true }).first().click();
        await page.getByLabel('Nome do ativo', { exact: true }).fill('Formato ' + id);
        await page.getByLabel('Plataforma e finalidade').selectOption(id);
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Criar ativo', exact: true })
          .click();
        await page.getByRole('heading', { name: 'Formato ' + id, exact: true }).waitFor();
        if (['linkedin-avatar', 'instagram-story', 'youtube-banner'].includes(id)) {
          const profileId = await page.getByLabel('Contexto ativo', { exact: true }).inputValue();
          const media = (await store.medias(profileId))[0];
          if (media) {
            await page.getByRole('tab', { name: 'Mídia', exact: true }).click();
            await page
              .getByLabel(id === 'linkedin-avatar' ? 'Foto de perfil' : 'Imagem de fundo', {
                exact: true,
              })
              .selectOption(media.id);
            await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
            await page.getByText('Salvo · v2', { exact: true }).waitFor();
          }
        }
        if (preset.safeArea) {
          await page.getByLabel('Área segura', { exact: true }).check();
          assert.equal(await page.locator('.safe-area-guide').count(), 1);
        }
        if (preset.circular) {
          await page.getByLabel('Recorte circular', { exact: true }).check();
          assert.equal(await page.locator('.format-preview-frame.circular').count(), 1);
        }
        await page.getByLabel('Zoom da prévia').selectOption('2');
        await page.getByRole('button', { name: 'Exportar', exact: true }).click();
        const downloaded = page.waitForEvent('download');
        await page
          .getByRole('dialog')
          .getByRole('button', { name: 'Exportar PNG', exact: true })
          .click();
        const file = await downloaded;
        const m = await sharp(await readFile((await file.path())!)).metadata();
        assert.equal(m.width, preset.width);
        assert.equal(m.height, preset.height);
        await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
        await page.getByRole('button', { name: 'Voltar para ativos' }).click();
      }
    },
  );
  await check('adaptação entre formatos preserva conteúdo e registra uma nova versão', async () => {
    await page.getByRole('button', { name: 'Editar Formato gmail-banner', exact: true }).click();
    const name = await page.getByLabel('Nome profissional', { exact: true }).inputValue();
    await page.getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.getByLabel('Adaptar para outro formato').selectOption('instagram-portrait');
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
    await page.getByText('Salvo · v2', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Conteúdo', exact: true }).click();
    assert.equal(await page.getByLabel('Nome profissional', { exact: true }).inputValue(), name);
    await page.getByRole('button', { name: 'Salvar como modelo' }).click();
    await page.getByRole('button', { name: 'Voltar para ativos' }).click();
  });
  await check(
    'modelos editam composição e preferências e reabrem sem perda do layout',
    async () => {
      await page.getByRole('button', { name: 'Modelos', exact: true }).click();
      await page.getByLabel('Buscar modelos').fill('Modelo do navegador');
      const card = page
        .locator('.template-card')
        .filter({ has: page.getByRole('heading', { name: 'Modelo do navegador', exact: true }) })
        .last();
      await card.getByRole('button', { name: 'Editar modelo', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('tab', { name: 'Layout', exact: true }).click();
      await dialog.getByLabel('Largura do projeto', { exact: true }).fill('1000');
      await dialog.getByLabel('Altura do projeto', { exact: true }).fill('1200');
      await dialog.getByText('Preferências de exportação', { exact: true }).click();
      await dialog.getByLabel('Formato preferido').selectOption('jpeg');
      await dialog.getByRole('button', { name: 'Salvar modelo', exact: true }).click();
      await dialog.getByText('Modelo atualizado.', { exact: true }).waitFor();
      await audit('template-editor');
      await page.setViewportSize({ width: 390, height: 844 });
      await audit('template-editor-mobile');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await page.setViewportSize({ width: 1440, height: 1050 });
      await dialog.getByRole('button', { name: 'Fechar editor', exact: true }).click();
      await card.getByRole('button', { name: 'Usar modelo', exact: true }).click();
      await page.getByLabel('Nome do ativo', { exact: true }).fill('Modelo sem perda');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Criar ativo', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Modelo sem perda', exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Layout', exact: true }).click();
      assert.equal(
        await page.getByLabel('Largura do projeto', { exact: true }).inputValue(),
        '1000',
      );
      assert.equal(
        await page.getByLabel('Altura do projeto', { exact: true }).inputValue(),
        '1200',
      );
      await page.getByRole('button', { name: 'Exportar', exact: true }).click();
      assert.equal(
        await page.getByRole('dialog').getByLabel('Formato', { exact: true }).inputValue(),
        'jpeg',
      );
      const downloaded = page.waitForEvent('download');
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Exportar configurações JSON', exact: true })
        .click();
      const file = await downloaded;
      const portable = JSON.parse(await readFile((await file.path())!, 'utf8'));
      assert.equal(portable.kind, 'configuration');
      assert.equal(portable.document.width, 1000);
      assert.equal(portable.document.exportPreferences.format, 'jpeg');
      await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
      await page.getByRole('button', { name: 'Voltar para ativos' }).click();
      await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({
        name: 'config.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(portable)),
      });
      await page.getByRole('heading', { name: 'Modelo sem perda', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar para ativos' }).click();
    },
  );
  assert.deepEqual(errors, [], 'Exceções de navegador');
  assert.deepEqual(external, [], 'Dependências externas não esperadas');
  console.log(
    JSON.stringify(
      { passed: checks.length, failed: 0, checks, consoleErrors: 0, externalRequests: 0 },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    'Browser failure context:',
    await page
      .locator('.global-error')
      .innerText()
      .catch(() => ''),
  );
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await app.close();
  await store.query(`DROP SCHEMA ${schema} CASCADE`);
  await store.close();
}

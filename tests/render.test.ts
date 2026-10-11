import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultDocument,
  documentSchema,
  exportSchema,
  migrateLegacy,
  platforms,
  forPlatform,
} from '../shared/model';
import { renderEmail, renderSvg } from '../shared/render';
test('renderer escapa conteúdo, respeita presets e produz um QR com margem silenciosa', () => {
  const d = structuredClone(defaultDocument);
  d.content.name = '<img src=x onerror=alert(1)> & "x"';
  const svg = renderSvg(d);
  assert.ok(svg.includes('&lt;img'));
  assert.ok(!svg.includes('<img'));
  assert.ok(svg.includes('viewBox="0 0 1200 320"'));
  assert.ok(svg.includes('fill="#111827"'));
  for (const p of platforms) {
    const doc = forPlatform(defaultDocument, p.id);
    assert.equal(doc.width, p.width);
    assert.equal(doc.height, p.height);
    assert.doesNotThrow(() => renderSvg(doc));
  }
  const square = { ...d, width: 600, height: 600 };
  assert.ok(renderSvg(square).includes('&lt;img'), 'Um banner quadrado deve manter seu texto.');
});
test('HTML de assinatura contém links seguros e estilos inline sem executar marcação importada', () => {
  const d = structuredClone(defaultDocument);
  d.content.name = '<script>alert(1)</script>';
  d.content.company = '" onclick="evil()';
  const html = renderEmail(d);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('href="mailto:'));
  assert.ok(html.includes('<table'));
  assert.ok(!html.includes('<style'));
});
test('limites rejeitam dimensões inválidas e excedentes de memória em vez de corrigir silenciosamente', () => {
  assert.equal(
    exportSchema.safeParse({ format: 'png', width: 8000, height: 8000, quality: 1 }).success,
    false,
  );
  assert.equal(documentSchema.safeParse({ ...defaultDocument, width: 0 }).success, false);
  assert.equal(
    exportSchema.safeParse({ format: 'webp', width: 2400, height: 640, quality: 0.92 }).success,
    true,
  );
  assert.throws(() =>
    migrateLegacy({ _type: 'signature-banner-config', version: 99, content: { name: 'Teste' } }),
  );
});

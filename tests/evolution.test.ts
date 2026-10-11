import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { randomUUID } from 'node:crypto';
import {
  documentSchema,
  defaultDocument,
  referenceSignature,
  systemTemplates,
} from '../shared/model';
import { renderSvg, exportImage } from '../shared/render';
import { assessQuality, contrast } from '../shared/quality';
import { initialHistory, editHistory, undoHistory, redoHistory } from '../shared/edit-history';

test('old documents gain neutral photo adjustments and empty specialties without modifying input', () => {
  const old = structuredClone(defaultDocument) as unknown as Record<string, unknown>;
  delete (old.content as Record<string, unknown>).specialties;
  for (const key of ['photoRotation', 'photoBrightness', 'photoContrast', 'photoSaturation'])
    delete (old.layout as Record<string, unknown>)[key];
  const d = documentSchema.parse(old);
  assert.equal(d.content.specialties, '');
  assert.equal(d.layout.photoRotation, 0);
  assert.equal(d.layout.photoBrightness, 1);
  assert.ok(!('specialties' in (old.content as object)));
});
test('reference signatures retain three regions, curated font hierarchy and separate variants', async () => {
  const models = systemTemplates.filter((t) => t.document.layout.style === 'reference');
  assert.equal(models.length, 3);
  assert.equal(new Set(models.map((t) => t.document.content.eyebrow)).size, 3);
  const svg = renderSvg(referenceSignature);
  for (const part of [
    'linearGradient',
    'Georgia',
    'Courier New',
    'Arial',
    '// SOFTWARE DEVELOPER',
    'Desenvolvimento',
  ])
    assert.ok(svg.includes(part), part);
  const metadata = await sharp(Buffer.from(svg)).metadata();
  assert.equal(metadata.width, 600);
  assert.equal(metadata.height, 160);
});
test('independent decoder reads QR from final raster, including unicode and after hiding photo', async () => {
  for (const target of [
    'https://example.com',
    'https://example.com/portfolio?source=email',
    'https://example.com/café?texto=Olá',
    'https://example.com/contato?nome=Ana%20Martins',
  ]) {
    for (const showAvatar of [true, false]) {
      const d = {
        ...referenceSignature,
        content: { ...referenceSignature.content, name: 'Ana Martins', qrUrl: target },
        layout: { ...referenceSignature.layout, showAvatar },
      };
      const { data, info } = await sharp(Buffer.from(renderSvg(d)))
        .resize(1200, 320)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, target);
    }
  }
});
test('quality feedback detects unreadable palette, clipped text, clipped blocks and undersized QR', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21);
  const d = structuredClone(referenceSignature);
  d.colors.primary = '#ffffff';
  d.content.name = 'Um nome profissional muito longo '.repeat(3).slice(0, 100);
  d.layout.fontSize = 50;
  d.layout.qrX = 90;
  d.layout.qrSize = 10;
  const ids = assessQuality(d).map((i) => i.id);
  assert.ok(ids.includes('contrast-primary'));
  assert.ok(ids.includes('clipped-nome'));
  assert.ok(ids.includes('qr-resolution'));
  d.layout.qrSize = 80;
  assert.ok(assessQuality(d).some((i) => i.id === 'bounds-QR Code'));
  assert.ok(assessQuality({ ...d, width: 0 }).some((i) => i.id === 'invalid'));
  const hidden = {
    ...referenceSignature,
    layout: { ...referenceSignature.layout, showDetails: false },
  };
  assert.ok(!assessQuality(hidden).some((i) => i.id === 'contrast-secondary'));
});
test('photo transformations change actual exported pixels without changing source image and remain clipped', async () => {
  const id = randomUUID(),
    data = await sharp({ create: { width: 100, height: 100, channels: 3, background: '#6080a0' } })
      .png()
      .toBuffer();
  const resolver = () => 'data:image/png;base64,' + data.toString('base64');
  const plain = { ...referenceSignature, photoId: id };
  const changed = {
    ...plain,
    layout: { ...plain.layout, photoBrightness: 1.3, photoSaturation: 0, photoRotation: 30 },
  };
  const a = await sharp(Buffer.from(renderSvg(plain, resolver)))
      .raw()
      .toBuffer(),
    b = await sharp(Buffer.from(renderSvg(changed, resolver)))
      .raw()
      .toBuffer();
  assert.notDeepEqual(a, b);
  assert.equal(plain.layout.photoBrightness, 1);
  assert.ok(renderSvg(changed, resolver).includes('rotate(30'));
});
test('undo and redo preserve complete documents, invalidate future on new edits and bound memory', () => {
  const a = structuredClone(referenceSignature),
    b = { ...a, content: { ...a.content, name: 'Ana' } };
  let s = editHistory(initialHistory(a), b);
  assert.deepEqual(undoHistory(s).present, a);
  assert.deepEqual(redoHistory(undoHistory(s)).present, b);
  s = editHistory(undoHistory(s), { ...b, width: 800 });
  assert.equal(s.future.length, 0);
  for (let i = 0; i < 130; i++) s = editHistory(s, { ...s.present, width: 900 + i });
  assert.equal(s.past.length, 100);
  const group = editHistory(s, { ...s.present, width: 1300 }, true);
  assert.equal(group.past.length, 100);
  assert.notEqual(undoHistory(group).present.width, 1300);
});
test('export refuses missing referenced media rather than silently exporting a monogram', async () => {
  const d = { ...referenceSignature, photoId: randomUUID() };
  await assert.rejects(
    exportImage(d, { format: 'svg', width: 600, height: 160, quality: 1 }, () => undefined),
    /imagem do projeto/,
  );
});

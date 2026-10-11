import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import {
  defaultDocument,
  documentSchema,
  forPlatform,
  migrateLegacy,
  platforms,
} from '../shared/model';
import { getPlatform, platformWarnings } from '../shared/platforms';
import { portableFile, portableSchema } from '../shared/portable';
import { renderSvg } from '../shared/render';

test('catalogue has unique valid formats and distinct compositions, not only dimensions', async () => {
  assert.equal(new Set(platforms.map((p) => p.id)).size, platforms.length);
  for (const p of platforms) {
    const d = documentSchema.parse(forPlatform(defaultDocument, p.id));
    assert.equal(d.composition, p.composition);
    const image = await sharp(Buffer.from(renderSvg(d))).metadata();
    assert.equal(image.width, p.width);
    assert.equal(image.height, p.height);
  }
  assert.equal(forPlatform(defaultDocument, 'linkedin-avatar').layout.avatarSize, 90);
  assert.equal(forPlatform(defaultDocument, 'youtube-thumbnail').layout.showDetails, false);
  assert.ok(getPlatform('youtube-banner').safeArea);
});
test('backward-compatible defaults and adaptation preserve identity, images and preferences', () => {
  const old = structuredClone(defaultDocument) as unknown as Record<string, unknown>;
  delete old.exportPreferences;
  delete old.backgroundImageId;
  const layout = { ...(old.layout as Record<string, unknown>) };
  for (const k of [
    'textWidth',
    'showDetails',
    'photoShape',
    'backgroundOpacity',
    'backgroundZoom',
    'backgroundOffsetX',
    'backgroundOffsetY',
    'logoX',
    'logoY',
    'logoSize',
  ])
    delete layout[k];
  old.layout = layout;
  const parsed = documentSchema.parse(old);
  assert.equal(parsed.backgroundImageId, null);
  assert.equal(parsed.layout.photoZoom, 1);
  assert.equal(parsed.exportPreferences.format, 'png');
  const doc = {
    ...parsed,
    backgroundImageId: randomUUID(),
    exportPreferences: { format: 'jpeg' as const, quality: 0.8, scale: 2 },
  };
  const before = structuredClone(doc);
  const adapted = forPlatform(doc, 'instagram-story');
  assert.deepEqual(adapted.content, doc.content);
  assert.equal(adapted.backgroundImageId, doc.backgroundImageId);
  assert.deepEqual(adapted.exportPreferences, doc.exportPreferences);
  assert.deepEqual(doc, before);
  assert.ok(
    platformWarnings('linkedin-avatar', { ...adapted, width: 300, height: 300 }, 'svg').length >= 2,
  );
});
test('portable models validate version, incorporated images and strip database metadata', () => {
  const imageId = randomUUID(),
    doc = { ...defaultDocument, photoId: imageId, backgroundImageId: imageId };
  const source = {
    id: randomUUID(),
    profileId: randomUUID(),
    createdAt: new Date().toISOString(),
    name: 'Modelo portátil',
    platformId: 'gmail-banner' as const,
    document: doc,
  };
  const file = portableFile(source, 'template', [
    { id: imageId, name: 'Imagem', mime: 'image/png', width: 1, height: 1, data: 'YWJjZA==' },
  ]);
  assert.equal(file.media.length, 1);
  assert.ok(!('profileId' in file));
  assert.ok(!('id' in file));
  assert.ok(portableSchema.safeParse(file).success);
  assert.ok(!portableSchema.safeParse({ ...file, version: 9 }).success);
  assert.ok(!portableSchema.safeParse({ ...file, media: [] }).success);
  assert.ok(!portableSchema.safeParse({ ...file, media: [...file.media, ...file.media] }).success);
  assert.ok(
    !portableSchema.safeParse({ ...file, media: [{ ...file.media[0], data: '' }] }).success,
  );
});
test('renderer supports background, square crop, right alignment and rejects external or SVG images', () => {
  const id = randomUUID(),
    d = {
      ...defaultDocument,
      backgroundImageId: id,
      photoId: id,
      layout: {
        ...defaultDocument.layout,
        photoShape: 'square' as const,
        align: 'right' as const,
        textWidth: 40,
      },
    };
  const svg = renderSvg(d, () => 'data:image/png;base64,YWJjZA==');
  assert.ok(svg.includes('opacity="1"'));
  assert.ok(svg.includes('text-anchor="end"'));
  assert.ok(svg.includes('<clipPath id="photo"><rect'));
  assert.throws(() => renderSvg(d, () => 'https://example.com/photo.png'));
  assert.throws(() => renderSvg(d, () => 'data:image/svg+xml;base64,YWJjZA=='));
});
test('uploaded archive v4 config imports supported content, dimensions and quality without executing scripts', () => {
  const d = migrateLegacy({
    _type: 'signature-banner-config',
    version: 4,
    content: {
      name: 'Ana **Silva**',
      status: 'Disponível',
      specs: 'TypeScript; React',
      tagline: 'Design<br>Software',
    },
    layout: { showStatus: true, showQR: false, cursor: true },
    export: { format: 'jpeg', width: 1584, height: 396, quality: 0.8 },
  });
  assert.equal(d.content.name, 'Ana Silva');
  assert.ok(d.content.tagline.includes('TypeScript; React'));
  assert.ok(d.content.tagline.includes('Disponível'));
  assert.equal(d.width, 1584);
  assert.equal(d.height, 396);
  assert.equal(d.exportPreferences.format, 'jpeg');
  assert.equal(d.exportPreferences.quality, 0.8);
});

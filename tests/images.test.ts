import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { normalizeImage } from '../server/images';
test('large photographic JPEGs remain uploadable within the PNG storage budget', async () => {
  const jpeg = await sharp(randomBytes(2400 * 1200 * 3), {
    raw: { width: 2400, height: 1200, channels: 3 },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  assert.ok(jpeg.length < 5 * 1024 * 1024);
  const normalized = await normalizeImage(jpeg.toString('base64'));
  assert.equal(normalized.width, 1600);
  assert.equal(normalized.height, 800);
  assert.ok(normalized.bytes.length <= 5 * 1024 * 1024);
  assert.equal((await sharp(normalized.bytes).metadata()).format, 'png');
});

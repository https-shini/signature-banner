import sharp from 'sharp';
import { DomainError } from './store';
export async function normalizeImage(data: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0)
    throw new DomainError(400, 'Imagem base64 inválida.');
  const source = Buffer.from(data, 'base64');
  if (source.length > 5 * 1024 * 1024)
    throw new DomainError(413, 'Imagens devem ter no máximo 5 MB.');
  try {
    const pipeline = sharp(source, {
      limitInputPixels: 16_000_000,
      animated: false,
      failOn: 'warning',
    });
    const metadata = await pipeline.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
      throw new Error('unsupported');
    const { data: bytes, info } = await pipeline
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (bytes.length > 5 * 1024 * 1024)
      throw new DomainError(413, 'Imagem normalizada excede 5 MB.');
    return { bytes, width: info.width, height: info.height };
  } catch (e) {
    if (e instanceof DomainError) throw e;
    throw new DomainError(
      400,
      'Arquivo inválido. Use uma imagem PNG, JPEG ou WebP estática de até 16 megapixels.',
    );
  }
}

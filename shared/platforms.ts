import type { AssetDocument } from './model';

export const platformIds = [
  'signature',
  'linkedin',
  'banner',
  'avatar',
  'gmail-banner',
  'linkedin-avatar',
  'linkedin-company',
  'instagram-square',
  'instagram-portrait',
  'instagram-story',
  'instagram-avatar',
  'youtube-banner',
  'youtube-thumbnail',
  'youtube-thumbnail-compact',
  'youtube-avatar',
] as const;
export type PlatformId = (typeof platformIds)[number];
export type SafeArea = { x: number; y: number; width: number; height: number; label: string };
export type Platform = {
  id: PlatformId;
  name: string;
  channel: string;
  kind: 'signature' | 'banner' | 'avatar';
  width: number;
  height: number;
  composition: AssetDocument['composition'];
  hint: string;
  safeArea?: SafeArea;
  circular?: boolean;
  maxBytes?: number;
  uploadFormats: readonly string[];
  layout: Partial<AssetDocument['layout']>;
};
const raster = ['png', 'jpeg'];
const cover = { textX: 28, textY: 22, fontSize: 44, showAvatar: false, showQr: false };
const portrait = {
  textX: 10,
  textY: 50,
  fontSize: 72,
  showAvatar: true,
  avatarX: 30,
  avatarY: 10,
  avatarSize: 40,
  showQr: false,
};
const avatar = { showAvatar: true, showQr: false, avatarX: 5, avatarY: 5, avatarSize: 90 };
export const platforms: readonly Platform[] = [
  {
    id: 'signature',
    name: 'Assinatura de e-mail',
    channel: 'Gmail',
    kind: 'signature',
    width: 600,
    height: 180,
    composition: 'banner',
    uploadFormats: raster,
    layout: { fontSize: 22 },
    hint: '600 × 180 px recomendado para composição compacta. HTML mantém texto e links; o Gmail pode redimensionar imagens.',
  },
  {
    id: 'linkedin',
    name: 'Capa do LinkedIn',
    channel: 'LinkedIn',
    kind: 'banner',
    width: 1584,
    height: 396,
    composition: 'banner',
    uploadFormats: raster,
    maxBytes: 8 * 1024 * 1024,
    layout: cover,
    safeArea: {
      x: 25,
      y: 12,
      width: 68,
      height: 74,
      label: 'Guia conservador: evite a foto e os cortes laterais',
    },
    hint: '1584 × 396 px · PNG/JPEG · até 8 MB. A posição da foto varia; as guias são orientativas.',
  },
  {
    id: 'banner',
    name: 'Banner profissional',
    channel: 'Livre',
    kind: 'banner',
    width: 1200,
    height: 320,
    composition: 'banner',
    uploadFormats: ['png', 'jpeg', 'webp', 'svg'],
    layout: { fontSize: 36 },
    hint: '1200 × 320 px · dimensões personalizáveis.',
  },
  {
    id: 'avatar',
    name: 'Foto de perfil',
    channel: 'Multiplataforma',
    kind: 'avatar',
    width: 800,
    height: 800,
    composition: 'avatar',
    uploadFormats: raster,
    circular: true,
    layout: avatar,
    hint: '800 × 800 px · confira o recorte circular; o arquivo exportado continua quadrado.',
  },
  {
    id: 'gmail-banner',
    name: 'Banner do Gmail',
    channel: 'Gmail',
    kind: 'banner',
    width: 600,
    height: 160,
    composition: 'banner',
    uploadFormats: raster,
    layout: { fontSize: 22, textX: 24, textY: 15, showQr: false },
    hint: '600 × 160 px é uma recomendação do editor, não um limite oficial. PNG/JPEG; confira a leitura no Gmail. Imagens não têm links individuais.',
  },
  {
    id: 'linkedin-avatar',
    name: 'Foto de perfil do LinkedIn',
    channel: 'LinkedIn',
    kind: 'avatar',
    width: 400,
    height: 400,
    composition: 'avatar',
    uploadFormats: raster,
    circular: true,
    maxBytes: 8 * 1024 * 1024,
    layout: avatar,
    hint: '400 × 400 px · PNG/JPEG · até 8 MB. Centralize o rosto e confira o corte circular.',
  },
  {
    id: 'linkedin-company',
    name: 'Capa de página do LinkedIn',
    channel: 'LinkedIn',
    kind: 'banner',
    width: 1128,
    height: 191,
    composition: 'banner',
    uploadFormats: raster,
    maxBytes: 8 * 1024 * 1024,
    layout: { ...cover, fontSize: 30 },
    safeArea: { x: 20, y: 12, width: 72, height: 76, label: 'Guia conservador para páginas' },
    hint: '1128 × 191 px · composição para página. Confira o corte na página de destino.',
  },
  {
    id: 'instagram-square',
    name: 'Instagram · publicação quadrada',
    channel: 'Instagram',
    kind: 'banner',
    width: 1080,
    height: 1080,
    composition: 'post',
    uploadFormats: raster,
    layout: portrait,
    safeArea: { x: 8, y: 8, width: 84, height: 84, label: 'Margem editorial' },
    hint: '1080 × 1080 px · 1:1. Use PNG/JPEG; mantenha texto afastado das bordas.',
  },
  {
    id: 'instagram-portrait',
    name: 'Instagram · publicação vertical',
    channel: 'Instagram',
    kind: 'banner',
    width: 1080,
    height: 1350,
    composition: 'post',
    uploadFormats: raster,
    layout: portrait,
    safeArea: { x: 8, y: 8, width: 84, height: 84, label: 'Margem editorial' },
    hint: '1080 × 1350 px · 4:5. A grade e a exibição podem recortar a composição.',
  },
  {
    id: 'instagram-story',
    name: 'Instagram · Story / capa de Reel',
    channel: 'Instagram',
    kind: 'banner',
    width: 1080,
    height: 1920,
    composition: 'story',
    uploadFormats: raster,
    layout: { ...portrait, textY: 46, avatarY: 17 },
    safeArea: {
      x: 8,
      y: 14,
      width: 84,
      height: 70,
      label: 'Evite os controles superiores e inferiores',
    },
    hint: '1080 × 1920 px · 9:16. Guia editorial; controles e cortes variam. Exporta imagem estática, não vídeo.',
  },
  {
    id: 'instagram-avatar',
    name: 'Instagram · foto de perfil',
    channel: 'Instagram',
    kind: 'avatar',
    width: 320,
    height: 320,
    composition: 'avatar',
    uploadFormats: raster,
    circular: true,
    layout: avatar,
    hint: '320 × 320 px recomendado · confira o recorte circular.',
  },
  {
    id: 'youtube-banner',
    name: 'YouTube · capa de canal',
    channel: 'YouTube',
    kind: 'banner',
    width: 2560,
    height: 1440,
    composition: 'channel-cover',
    uploadFormats: raster,
    maxBytes: 6 * 1024 * 1024,
    layout: { textX: 22, textY: 40, fontSize: 76, showAvatar: false, showQr: false },
    safeArea: {
      x: 19.82,
      y: 35.33,
      width: 60.35,
      height: 29.34,
      label: 'Texto/logos visíveis no centro em celulares',
    },
    hint: '2560 × 1440 px recomendado · mínimo 2048 × 1152. Área central proporcional a 1235 × 338 no tamanho mínimo; confirme no YouTube.',
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube · miniatura',
    channel: 'YouTube',
    kind: 'banner',
    width: 3840,
    height: 2160,
    composition: 'thumbnail',
    uploadFormats: raster,
    maxBytes: 50 * 1024 * 1024,
    layout: {
      fontSize: 300,
      textX: 8,
      textY: 18,
      showAvatar: true,
      avatarX: 65,
      avatarY: 15,
      avatarSize: 60,
      showQr: false,
      textWidth: 52,
      showDetails: false,
    },
    safeArea: {
      x: 5,
      y: 5,
      width: 90,
      height: 85,
      label: 'Reserve o canto inferior direito para a duração',
    },
    hint: '3840 × 2160 px recomendado atualmente pelo YouTube · desktop até 50 MB. No celular o limite é 2 MB: prefira o formato compacto ou reduza qualidade. Títulos curtos facilitam a leitura.',
  },
  {
    id: 'youtube-thumbnail-compact',
    name: 'YouTube · miniatura compacta',
    channel: 'YouTube',
    kind: 'banner',
    width: 1280,
    height: 720,
    composition: 'thumbnail',
    uploadFormats: raster,
    maxBytes: 2 * 1024 * 1024,
    layout: {
      fontSize: 100,
      textX: 8,
      textY: 18,
      showAvatar: true,
      avatarX: 65,
      avatarY: 15,
      avatarSize: 60,
      showQr: false,
      textWidth: 52,
      showDetails: false,
    },
    safeArea: {
      x: 5,
      y: 5,
      width: 90,
      height: 85,
      label: 'Reserve o canto inferior direito para a duração',
    },
    hint: '1280 × 720 px compacto · 16:9 · PNG/JPEG · perfil de envio móvel de até 2 MB. A recomendação atual de resolução máxima é 3840 × 2160.',
  },
  {
    id: 'youtube-avatar',
    name: 'YouTube · foto do canal',
    channel: 'YouTube',
    kind: 'avatar',
    width: 800,
    height: 800,
    composition: 'avatar',
    uploadFormats: raster,
    circular: true,
    layout: avatar,
    hint: '800 × 800 px recomendado · exibido em tamanho pequeno; confira o círculo.',
  },
];
export const getPlatform = (id: PlatformId) => platforms.find((p) => p.id === id)!;
export function adaptDocument(document: AssetDocument, id: PlatformId): AssetDocument {
  const p = getPlatform(id),
    d = structuredClone(document);
  d.width = p.width;
  d.height = p.height;
  d.composition = p.composition;
  d.layout = { ...d.layout, textWidth: 0, showDetails: true, ...p.layout };
  return d;
}
export function platformWarnings(id: PlatformId, d: AssetDocument, format?: string): string[] {
  const p = getPlatform(id),
    warnings: string[] = [];
  if (d.width !== p.width || d.height !== p.height)
    warnings.push(`Dimensão personalizada: o preset recomenda ${p.width} × ${p.height} px.`);
  if (format && !p.uploadFormats.includes(format) && format !== 'html')
    warnings.push(
      `${format.toUpperCase()} é uma exportação de edição/web; prefira ${p.uploadFormats.map((f) => f.toUpperCase()).join(' ou ')} para enviar à plataforma.`,
    );
  if (d.composition === 'avatar' && !d.layout.showAvatar)
    warnings.push(
      'A foto está oculta; este avatar exportará somente o fundo e os elementos gráficos.',
    );
  if (id === 'youtube-banner' && (d.width < 2048 || d.height < 1152))
    warnings.push('A capa está abaixo da dimensão mínima documentada pelo YouTube.');
  return warnings;
}

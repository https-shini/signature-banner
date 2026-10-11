import { z } from 'zod';

export const idSchema = z.uuid();
const text = (max = 200) => z.string().max(max);
export const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor hexadecimal de seis dígitos.');
export const url = z.union([
  z.literal(''),
  z
    .url()
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), 'Use um endereço HTTP ou HTTPS.'),
]);
export const colorsSchema = z
  .object({ background: hex, primary: hex, secondary: hex, accent: hex })
  .strict();
export const contentSchema = z
  .object({
    name: text(100),
    role: text(150),
    company: text(100),
    eyebrow: text(100),
    tagline: text(400),
    email: z.union([z.literal(''), z.email().max(150)]),
    site: url,
    qrUrl: url,
  })
  .strict();
export const layoutSchema = z
  .object({
    style: z.enum(['studio', 'minimal', 'split']),
    font: z.enum(['sans', 'serif', 'mono']),
    fontSize: z.number().int().min(12).max(120),
    textX: z.number().min(0).max(95),
    textY: z.number().min(0).max(95),
    spacing: z.number().min(1).max(2),
    align: z.enum(['left', 'center']),
    showAvatar: z.boolean(),
    avatarX: z.number().min(0).max(90),
    avatarY: z.number().min(0).max(90),
    avatarSize: z.number().min(5).max(80),
    photoZoom: z.number().min(1).max(4).default(1),
    photoOffsetX: z.number().min(-50).max(50).default(0),
    photoOffsetY: z.number().min(-50).max(50).default(0),
    showQr: z.boolean(),
    qrX: z.number().min(0).max(90),
    qrY: z.number().min(0).max(90),
    qrSize: z.number().min(10).max(80),
  })
  .strict();
export const documentSchema = z
  .object({
    composition: z.enum(['banner', 'avatar']).default('banner'),
    width: z.number().int().min(64).max(4000),
    height: z.number().int().min(64).max(4000),
    content: contentSchema,
    colors: colorsSchema,
    layout: layoutSchema,
    photoId: idSchema.nullable(),
    logoId: idSchema.nullable(),
  })
  .strict();
export const profileInputSchema = z
  .object({ name: z.string().trim().min(1).max(80), description: text(200), kit: documentSchema })
  .strict();
export const platforms = [
  {
    id: 'signature',
    name: 'Assinatura de e-mail',
    channel: 'Gmail',
    kind: 'signature',
    width: 600,
    height: 180,
    hint: 'HTML com links ou imagem. O Gmail pode redimensionar imagens; teste no seu cliente.',
  },
  {
    id: 'linkedin',
    name: 'Capa do LinkedIn',
    channel: 'LinkedIn',
    kind: 'banner',
    width: 1584,
    height: 396,
    hint: '1584 × 396 px · PNG/JPEG · até 8 MB. Evite conteúdo essencial no canto inferior esquerdo.',
  },
  {
    id: 'banner',
    name: 'Banner profissional',
    channel: 'Livre',
    kind: 'banner',
    width: 1200,
    height: 320,
    hint: '1200 × 320 px · dimensões personalizáveis.',
  },
  {
    id: 'avatar',
    name: 'Foto de perfil',
    channel: 'Multiplataforma',
    kind: 'avatar',
    width: 800,
    height: 800,
    hint: '800 × 800 px · composição quadrada para recorte circular.',
  },
] as const;
export const platformIdSchema = z.enum(['signature', 'linkedin', 'banner', 'avatar']);
export const kindSchema = z.enum(['signature', 'banner', 'avatar']);
export const assetInputSchema = z
  .object({
    profileId: idSchema,
    name: z.string().trim().min(1).max(100),
    platformId: platformIdSchema,
    document: documentSchema,
    tags: z.array(z.string().trim().min(1).max(30)).max(12),
    favorite: z.boolean(),
  })
  .strict();
export const assetUpdateSchema = assetInputSchema
  .omit({ profileId: true })
  .extend({ version: z.number().int().positive() })
  .strict();
export const templateInputSchema = z
  .object({
    profileId: idSchema,
    name: z.string().trim().min(1).max(100),
    platformId: platformIdSchema,
    document: documentSchema,
  })
  .strict();
export const mediaInputSchema = z
  .object({
    profileId: idSchema,
    name: z.string().trim().min(1).max(100),
    data: z.string().min(1).max(7_000_000),
  })
  .strict();
export const exportSchema = z
  .object({
    format: z.enum(['png', 'jpeg', 'webp', 'svg', 'html']),
    width: z.number().int().min(64).max(8000),
    height: z.number().int().min(64).max(8000),
    quality: z.number().min(0.3).max(1),
  })
  .strict()
  .refine((v) => v.width * v.height <= 40_000_000, 'A resolução deve ser menor que 40 megapixels.');
export type AssetDocument = z.infer<typeof documentSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type Profile = ProfileInput & { id: string; createdAt: string; updatedAt: string };
export type AssetInput = z.infer<typeof assetInputSchema>;
export type Asset = AssetInput & {
  id: string;
  kind: z.infer<typeof kindSchema>;
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type Template = z.infer<typeof templateInputSchema> & { id: string; createdAt: string };
export type Media = {
  id: string;
  profileId: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  createdAt: string;
};
export type Revision = {
  id: string;
  assetId: string;
  version: number;
  snapshot: Asset;
  createdAt: string;
};
export type ExportOptions = z.infer<typeof exportSchema>;
export const profileSchema = profileInputSchema
  .extend({ id: idSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() })
  .strict();
export const assetSchema = assetInputSchema
  .extend({
    id: idSchema,
    kind: kindSchema,
    version: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const templateSchema = templateInputSchema
  .extend({ id: idSchema, createdAt: z.iso.datetime() })
  .strict();
export const mediaSchema = z
  .object({
    id: idSchema,
    profileId: idSchema,
    name: text(100),
    mime: z.literal('image/png'),
    width: z.number().int().positive().max(4000),
    height: z.number().int().positive().max(4000),
    createdAt: z.iso.datetime(),
    data: z.string().max(7_000_000),
  })
  .strict();
export const revisionSchema = z
  .object({
    id: idSchema,
    assetId: idSchema,
    version: z.number().int().positive(),
    snapshot: assetSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export const backupSchema = z
  .object({
    type: z.literal('identity-studio-backup'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    profiles: z.array(profileSchema).max(100),
    assets: z.array(assetSchema).max(1000),
    templates: z.array(templateSchema).max(500),
    media: z.array(mediaSchema).max(100),
    revisions: z.array(revisionSchema).max(10000),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;

export const defaultDocument: AssetDocument = {
  composition: 'banner',
  width: 1200,
  height: 320,
  content: {
    name: 'Guilherme de Souza Cruz',
    role: 'Desenvolvedor de Software',
    company: '',
    eyebrow: 'SOFTWARE DEVELOPER',
    tagline: 'Desenvolvendo soluções digitais que transformam desafios em oportunidades.',
    email: 'contato.guilhermescruz@gmail.com',
    site: 'https://bl4ck404.dev.br',
    qrUrl: 'https://devlinks-rocketseat-five.vercel.app',
  },
  colors: { background: '#101727', primary: '#f8fafc', secondary: '#a8b1c4', accent: '#8b79f6' },
  layout: {
    style: 'studio',
    font: 'sans',
    fontSize: 36,
    textX: 24,
    textY: 19,
    spacing: 1.35,
    align: 'left',
    showAvatar: true,
    avatarX: 5,
    avatarY: 26,
    avatarSize: 46,
    photoZoom: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    showQr: true,
    qrX: 83,
    qrY: 24,
    qrSize: 49,
  },
  photoId: null,
  logoId: null,
};
export function forPlatform(
  kit: AssetDocument,
  platformId: z.infer<typeof platformIdSchema>,
): AssetDocument {
  const platform = platforms.find((p) => p.id === platformId)!;
  const d = structuredClone(kit);
  d.width = platform.width;
  d.height = platform.height;
  d.composition = platform.kind === 'avatar' ? 'avatar' : 'banner';
  d.layout.fontSize = platformId === 'signature' ? 22 : platformId === 'linkedin' ? 44 : 36;
  if (platformId === 'avatar') {
    d.layout = {
      ...d.layout,
      showAvatar: true,
      showQr: false,
      avatarX: 15,
      avatarY: 15,
      avatarSize: 70,
    };
  }
  return d;
}
export const systemTemplates = [
  {
    id: 'system-studio',
    name: 'Studio',
    subtitle: 'Presença marcante. Detalhes sutis.',
    platformId: 'banner' as const,
    document: defaultDocument,
  },
  {
    id: 'system-paper',
    name: 'Essencial',
    subtitle: 'O essencial, com clareza.',
    platformId: 'signature' as const,
    document: {
      ...forPlatform(defaultDocument, 'signature'),
      colors: {
        background: '#ffffff',
        primary: '#182235',
        secondary: '#64748b',
        accent: '#604ae8',
      },
      layout: {
        ...forPlatform(defaultDocument, 'signature').layout,
        style: 'minimal' as const,
        showQr: false,
      },
    },
  },
  {
    id: 'system-linkedin',
    name: 'Horizonte',
    subtitle: 'Uma nova perspectiva profissional.',
    platformId: 'linkedin' as const,
    document: {
      ...forPlatform(defaultDocument, 'linkedin'),
      colors: {
        background: '#123b36',
        primary: '#f0fdfa',
        secondary: '#acd4c8',
        accent: '#8fdfba',
      },
      layout: { ...defaultDocument.layout, style: 'split' as const, fontSize: 44 },
    },
  },
  {
    id: 'system-avatar',
    name: 'Retrato',
    subtitle: 'Uma identidade que é sua.',
    platformId: 'avatar' as const,
    document: forPlatform(defaultDocument, 'avatar'),
  },
];

// Migração de dados, sem executar o JavaScript ou HTML do projeto anterior.
const legacySchema = z
  .object({
    _type: z.literal('signature-banner-config'),
    version: z.literal(3),
    content: z
      .object({
        eyebrow: text(100).optional(),
        name: text(100),
        role: text(150).optional(),
        empresa: text(100).optional(),
        specs: text(400).optional(),
        tagline: text(400).optional(),
        email: text(150).optional(),
        site: text(500).optional(),
        qrUrl: text(500).optional(),
      })
      .strict(),
    theme: z
      .object({
        mode: z.enum(['light', 'dark', 'auto']).optional(),
        tokens: z
          .record(z.string(), z.object({ light: z.string(), dark: z.string() }).strict())
          .optional(),
        palettes: z.record(z.string(), z.unknown()).optional(),
        palette: z.string().nullable().optional(),
      })
      .strict()
      .optional(),
    layout: z
      .object({ showQR: z.boolean().optional(), cursor: z.boolean().optional() })
      .strict()
      .optional(),
    export: z
      .object({
        format: z.enum(['png', 'jpeg', 'webp']).optional(),
        size: text().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        preserveAspect: z.boolean().optional(),
        quality: z.number().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export function migrateLegacy(value: unknown): AssetDocument {
  const old = legacySchema.parse(value),
    d = structuredClone(defaultDocument);
  const c = old.content;
  d.content = {
    ...d.content,
    name: c.name.replace(/\*\*/g, ''),
    role: c.role ?? '',
    company: c.empresa ?? '',
    eyebrow: c.eyebrow ?? '',
    tagline: (c.tagline ?? '').replace(/<br\s*\/?\s*>/gi, '\n'),
    email: c.email ?? '',
    site: c.site ? (/^https?:\/\//i.test(c.site) ? c.site : `https://${c.site}`) : '',
    qrUrl: c.qrUrl ?? '',
  };
  const mode = old.theme?.mode === 'light' ? 'light' : 'dark';
  const names = {
    background: 'background',
    textPrimary: 'primary',
    textSecondary: 'secondary',
    accent: 'accent',
  } as const;
  for (const [from, to] of Object.entries(names)) {
    let color = old.theme?.tokens?.[from]?.[mode];
    if (color && /^#[\da-f]{3}$/i.test(color))
      color =
        '#' +
        color
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('');
    if (color) d.colors[to] = color;
  }
  d.layout.showQr = old.layout?.showQR ?? true;
  return documentSchema.parse(d);
}

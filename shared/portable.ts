import { z } from 'zod';
import { documentSchema, platformIdSchema, mediaSchema, type AssetDocument } from './model';
export const imageReferences = (document: AssetDocument) => [
  ...new Set(
    [document.photoId, document.logoId, document.backgroundImageId].filter(
      (id): id is string => !!id,
    ),
  ),
];
export const portableSchema = z
  .object({
    type: z.literal('identity-studio-portable'),
    version: z.literal(1),
    kind: z.enum(['template', 'configuration']),
    name: z.string().trim().min(1).max(100),
    platformId: platformIdSchema,
    document: documentSchema,
    media: z
      .array(
        mediaSchema.omit({ profileId: true, createdAt: true }).extend({
          data: z
            .string()
            .min(1)
            .max(7_000_000)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        }),
      )
      .max(3),
  })
  .strict()
  .superRefine((v, ctx) => {
    const ids = v.media.map((m) => m.id),
      refs = imageReferences(v.document);
    if (
      new Set(ids).size !== ids.length ||
      refs.some((id) => !ids.includes(id)) ||
      ids.some((id) => !refs.includes(id))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['media'],
        message: 'As imagens incorporadas devem corresponder às referências, sem duplicações.',
      });
  });
export type Portable = z.infer<typeof portableSchema>;
export function portableFile(
  source: { name: string; platformId: Portable['platformId']; document: AssetDocument },
  kind: Portable['kind'],
  media: Portable['media'],
): Portable {
  const refs = imageReferences(source.document);
  return portableSchema.parse({
    type: 'identity-studio-portable',
    version: 1,
    kind,
    name: source.name,
    platformId: source.platformId,
    document: source.document,
    media: media.filter((m) => refs.includes(m.id)),
  });
}

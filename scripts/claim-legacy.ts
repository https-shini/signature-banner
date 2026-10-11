/** Administrative, explicit, reviewable import of unowned records; no automatic production claim. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { idSchema, backupSchema } from '../shared/model';
import { Store } from '../server/store';
import type { ImageStorage } from '../server/storage';
export const claimManifest = z
  .object({
    userId: idSchema,
    workspaceId: idSchema,
    projectId: idSchema,
    profileIds: z.array(idSchema).min(1),
    backupSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export async function claimLegacy(
  store: Store,
  manifestValue: unknown,
  backupBytes: Buffer,
  source: ImageStorage,
  target: ImageStorage,
  apply = false,
) {
  const manifest = claimManifest.parse(manifestValue);
  if (new Set(manifest.profileIds).size !== manifest.profileIds.length)
    throw new Error('Perfis repetidos.');
  if (createHash('sha256').update(backupBytes).digest('hex') !== manifest.backupSha256)
    throw new Error('Checksum do backup divergente.');
  const backup = backupSchema.parse(JSON.parse(backupBytes.toString('utf8')));
  const uploaded: string[] = [];
  const summary = await store
    .transaction(async (tx) => {
      const owner = await tx.query(
        `SELECT 1 FROM ${store.schema}.workspaces w JOIN ${store.schema}.projects p ON p.workspace_id=w.id WHERE w.id=$1 AND w.owner_id=$2 AND p.id=$3 FOR UPDATE OF w,p`,
        [manifest.workspaceId, manifest.userId, manifest.projectId],
      );
      if (!owner.rowCount) throw new Error('Proprietário ou projeto divergente.');
      const profiles = await tx.query(
        `SELECT * FROM ${store.schema}.profiles WHERE id=ANY($1::uuid[]) FOR UPDATE`,
        [manifest.profileIds],
      );
      if (
        profiles.rowCount !== manifest.profileIds.length ||
        profiles.rows.some((r) => r.workspace_id !== null)
      )
        throw new Error('Perfil ausente ou já atribuído.');
      const rows: Record<string, any[]> = { profiles: profiles.rows };
      for (const table of ['assets', 'templates', 'media'])
        rows[table] = (
          await tx.query(
            `SELECT * FROM ${store.schema}.${table} WHERE profile_id=ANY($1::uuid[]) FOR UPDATE`,
            [manifest.profileIds],
          )
        ).rows;
      rows.revisions = (
        await tx.query(
          `SELECT r.* FROM ${store.schema}.revisions r JOIN ${store.schema}.assets a ON a.id=r.asset_id WHERE a.profile_id=ANY($1::uuid[]) FOR UPDATE OF r`,
          [manifest.profileIds],
        )
      ).rows;
      const snapshots: Record<string, { id: string }[]> = {
        profiles: backup.profiles,
        assets: backup.assets,
        templates: backup.templates,
        media: backup.media.map(({ data, ...m }) => m),
        revisions: backup.revisions,
      };
      // Compare normalized JSON; property ordering is not evidence of divergence.
      const canonical = (v: any): string =>
        JSON.stringify(v, (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value,
        );
      for (const [table, records] of Object.entries(rows))
        for (const record of records) {
          const old = snapshots[table].find((r) => r.id === record.id);
          if (!old || canonical(old) !== canonical(record.payload))
            throw new Error('Dados mudaram desde o backup: ' + table);
        }
      if (apply) {
        for (const m of rows.media) {
          const from = m.profile_id + '/' + m.id + '.png',
            to = manifest.workspaceId + '/' + from;
          const bytes = await source.get(from),
            saved = backup.media.find((x) => x.id === m.id)!;
          if (!bytes.equals(Buffer.from(saved.data, 'base64')))
            throw new Error('Imagem diverge do backup.');
          await target.put(to, bytes);
          uploaded.push(to);
        }
        await tx.query(
          `UPDATE ${store.schema}.profiles SET workspace_id=$1 WHERE id=ANY($2::uuid[])`,
          [manifest.workspaceId, manifest.profileIds],
        );
        for (const table of ['assets', 'templates', 'media'])
          await tx.query(
            `UPDATE ${store.schema}.${table} SET workspace_id=$1${table === 'assets' ? ',project_id=$3' : ''} WHERE profile_id=ANY($2::uuid[])`,
            table === 'assets'
              ? [manifest.workspaceId, manifest.profileIds, manifest.projectId]
              : [manifest.workspaceId, manifest.profileIds],
          );
        await tx.query(
          `UPDATE ${store.schema}.revisions r SET workspace_id=$1,project_id=$3 FROM ${store.schema}.assets a WHERE a.id=r.asset_id AND a.profile_id=ANY($2::uuid[])`,
          [manifest.workspaceId, manifest.profileIds, manifest.projectId],
        );
      }
      return {
        applied: apply,
        ...Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
      };
    })
    .catch(async (error) => {
      await target.remove(uploaded).catch(() => undefined);
      throw error;
    });
  return summary;
}
// File IO is provided separately so callers explicitly select their reviewed manifest/backup.
export async function readClaimFiles(manifestPath: string, backupPath: string) {
  return {
    manifest: JSON.parse(await readFile(manifestPath, 'utf8')),
    backup: await readFile(backupPath),
  };
}

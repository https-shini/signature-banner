import { Pool, type PoolClient } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  assetInputSchema,
  assetSchema,
  profileSchema,
  templateSchema,
  mediaSchema,
  revisionSchema,
  backupSchema,
  defaultDocument,
  forPlatform,
  platforms,
  type Asset,
  type AssetInput,
  type AssetDocument,
  type Backup,
  type Media,
  type Profile,
  type ProfileInput,
  type Revision,
  type Template,
} from '../shared/model';
import type { ImageStorage } from './storage';
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new DomainError(status, message);
};
type Table = 'profiles' | 'assets' | 'templates' | 'media' | 'revisions';
const validators = {
  profiles: profileSchema,
  assets: assetSchema,
  templates: templateSchema,
  media: mediaSchema.omit({ data: true }),
  revisions: revisionSchema,
};
export class Store {
  private constructor(
    readonly pool: Pool,
    readonly storage: ImageStorage,
    readonly schema: string,
    private client?: PoolClient,
  ) {}
  static async open({
    connectionString,
    storage,
    schema = 'identity_studio',
    ssl = false,
    sslCa,
    seed = true,
  }: {
    connectionString: string;
    storage: ImageStorage;
    schema?: string;
    ssl?: boolean;
    sslCa?: string;
    seed?: boolean;
  }) {
    if (!/^[a-z][a-z0-9_]{0,50}$/.test(schema)) throw new Error('Schema inválido.');
    const connection = new URL(connectionString);
    connection.searchParams.delete('sslmode');
    const pool = new Pool({
      connectionString: connection.toString(),
      ssl: ssl ? { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) } : false,
      max: 4,
      connectionTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
    const s = new Store(pool, storage, schema);
    try {
      await s.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [schema]);
        await tx.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
        await tx.query(
          `CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations(version integer PRIMARY KEY)`,
        );
        await tx.query(`ALTER TABLE ${schema}.schema_migrations ENABLE ROW LEVEL SECURITY`);
        const existing = await tx.query(
          `SELECT version FROM ${schema}.schema_migrations ORDER BY version DESC LIMIT 1`,
        );
        if ((existing.rows[0]?.version ?? 0) > 1)
          throw new Error('Banco de dados mais recente que esta aplicação.');
        if (!existing.rows.length) {
          const sql = await readFile(
            new URL('./migrations/001_initial.sql', import.meta.url),
            'utf8',
          );
          await tx.query(sql.replaceAll('__SCHEMA__', schema));
          await tx.query(`INSERT INTO ${schema}.schema_migrations VALUES (1)`);
        }
        if (
          seed &&
          !(await tx.query(`SELECT value FROM ${schema}.metadata WHERE key='seeded'`)).rows.length
        ) {
          const p = await tx.createProfile({
            name: 'Profissional',
            description: 'Minha identidade profissional',
            kit: defaultDocument,
          });
          for (const [platformId, name, tags] of [
            ['linkedin', 'Capa · LinkedIn', ['Pessoal', 'Carreira']],
            ['signature', 'Assinatura · Gmail', ['Contato']],
            ['banner', 'Banner · Apresentação', ['Portfólio']],
          ] as const)
            await tx.createAsset({
              profileId: p.id,
              name,
              platformId,
              document: forPlatform(p.kit, platformId),
              tags: [...tags],
              favorite: platformId === 'linkedin',
            });
          await tx.query(`INSERT INTO ${schema}.metadata VALUES ('seeded','1')`);
        }
      });
      return s;
    } catch (e) {
      await pool.end();
      throw e;
    }
  }
  query(sql: string, params: unknown[] = []) {
    return (this.client ?? this.pool).query(sql, params);
  }
  async close() {
    if (!this.client) await this.pool.end();
  }
  async transaction<T>(fn: (tx: Store) => Promise<T>): Promise<T> {
    if (this.client) return fn(this);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(new Store(this.pool, this.storage, this.schema, client));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  private async all<T>(table: Table): Promise<T[]> {
    return (await this.query(`SELECT payload FROM ${this.schema}.${table}`)).rows.map(
      (r) => validators[table].parse(r.payload) as T,
    );
  }
  private async one<T>(table: Table, id: string, lock = false): Promise<T> {
    const row = (
      await this.query(
        `SELECT payload FROM ${this.schema}.${table} WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
    return row
      ? (validators[table].parse(row.payload) as T)
      : fail(404, 'Registro não encontrado.');
  }
  async profiles() {
    return (await this.all<Profile>('profiles')).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  profile(id: string) {
    return this.one<Profile>('profiles', id);
  }
  async createProfile(input: ProfileInput) {
    if (input.kit.photoId || input.kit.logoId)
      fail(400, 'Um novo perfil deve começar sem imagens de outro contexto.');
    const now = new Date().toISOString(),
      p: Profile = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    await this.query(`INSERT INTO ${this.schema}.profiles VALUES ($1,$2)`, [p.id, p]);
    return p;
  }
  async updateProfile(id: string, input: ProfileInput) {
    return this.transaction(async (tx) => {
      const old = await tx.one<Profile>('profiles', id, true);
      await tx.validateImages(id, input.kit);
      const p = { ...old, ...input, updatedAt: new Date().toISOString() };
      await tx.query(`UPDATE ${this.schema}.profiles SET payload=$1 WHERE id=$2`, [p, id]);
      return p;
    });
  }
  async deleteProfile(id: string) {
    const paths = await this.transaction(async (tx) => {
      await tx.one<Profile>('profiles', id, true);
      const images = await tx.medias(id);
      const paths = images.map((m) => tx.imagePath(m));
      for (const path of paths)
        await tx.query(
          `INSERT INTO ${this.schema}.storage_cleanup VALUES ($1) ON CONFLICT DO NOTHING`,
          [path],
        );
      await tx.query(`DELETE FROM ${this.schema}.profiles WHERE id=$1`, [id]);
      return paths;
    });
    await this.collectStorage().catch(() => undefined);
    return paths.length;
  }
  private async validateImages(profileId: string, d: AssetDocument) {
    await this.profile(profileId);
    for (const id of [d.photoId, d.logoId])
      if (id && (await this.one<Media>('media', id, true)).profileId !== profileId)
        fail(400, 'A imagem pertence a outro perfil.');
  }
  async assets(profileId?: string) {
    return (await this.all<Asset>('assets'))
      .filter((a) => !profileId || a.profileId === profileId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  asset(id: string) {
    return this.one<Asset>('assets', id);
  }
  private async revision(a: Asset) {
    const r: Revision = {
      id: randomUUID(),
      assetId: a.id,
      version: a.version,
      snapshot: a,
      createdAt: a.updatedAt,
    };
    await this.query(`INSERT INTO ${this.schema}.revisions VALUES ($1,$2,$3,$4)`, [
      r.id,
      a.id,
      a.version,
      r,
    ]);
  }
  async createAsset(value: AssetInput) {
    const input = assetInputSchema.parse(value);
    return this.transaction(async (tx) => {
      await tx.validateImages(input.profileId, input.document);
      const now = new Date().toISOString(),
        a: Asset = {
          ...input,
          id: randomUUID(),
          kind: platforms.find((p) => p.id === input.platformId)!.kind,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
      await tx.query(`INSERT INTO ${this.schema}.assets VALUES ($1,$2,$3)`, [a.id, a.profileId, a]);
      await tx.revision(a);
      return a;
    });
  }
  async updateAsset(id: string, input: Omit<AssetInput, 'profileId'> & { version: number }) {
    return this.transaction(async (tx) => {
      const old = await tx.one<Asset>('assets', id, true);
      if (old.version !== input.version)
        fail(
          409,
          'Este ativo mudou em outra sessão. Recarregue antes de salvar. Suas edições continuam no editor.',
        );
      await tx.validateImages(old.profileId, input.document);
      const a: Asset = {
        ...old,
        ...input,
        kind: platforms.find((p) => p.id === input.platformId)!.kind,
        version: old.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await tx.query(`UPDATE ${this.schema}.assets SET payload=$1 WHERE id=$2`, [a, id]);
      await tx.revision(a);
      return a;
    });
  }
  async deleteAsset(id: string) {
    await this.asset(id);
    await this.query(`DELETE FROM ${this.schema}.assets WHERE id=$1`, [id]);
  }
  async duplicateAsset(id: string) {
    const a = await this.asset(id);
    return this.createAsset({
      profileId: a.profileId,
      name: a.name.slice(0, 85) + ' · cópia',
      platformId: a.platformId,
      document: a.document,
      tags: a.tags,
      favorite: false,
    });
  }
  async revisions(id: string) {
    await this.asset(id);
    return (
      await this.query(
        `SELECT payload FROM ${this.schema}.revisions WHERE asset_id=$1 ORDER BY version DESC`,
        [id],
      )
    ).rows.map((r) => revisionSchema.parse(r.payload));
  }
  async restoreRevision(id: string, revisionId: string, version: number) {
    const r = await this.one<Revision>('revisions', revisionId);
    if (r.assetId !== id) fail(400, 'A versão pertence a outro ativo.');
    const a = r.snapshot;
    return this.updateAsset(id, {
      name: a.name,
      platformId: a.platformId,
      document: a.document,
      tags: a.tags,
      favorite: a.favorite,
      version,
    });
  }
  async templates(profileId?: string) {
    return (await this.all<Template>('templates'))
      .filter((t) => !profileId || t.profileId === profileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async createTemplate(input: Omit<Template, 'id' | 'createdAt'>) {
    return this.transaction(async (tx) => {
      await tx.validateImages(input.profileId, input.document);
      const t: Template = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      await tx.query(`INSERT INTO ${this.schema}.templates VALUES ($1,$2,$3)`, [
        t.id,
        t.profileId,
        t,
      ]);
      return t;
    });
  }
  async duplicateTemplate(id: string) {
    const t = await this.one<Template>('templates', id);
    return this.createTemplate({
      profileId: t.profileId,
      name: t.name.slice(0, 85) + ' · cópia',
      platformId: t.platformId,
      document: t.document,
    });
  }
  async updateTemplate(id: string, input: Omit<Template, 'id' | 'createdAt' | 'profileId'>) {
    return this.transaction(async (tx) => {
      const old = await tx.one<Template>('templates', id, true);
      await tx.validateImages(old.profileId, input.document);
      const t = { ...old, ...input };
      await tx.query(`UPDATE ${this.schema}.templates SET payload=$1 WHERE id=$2`, [t, id]);
      return t;
    });
  }
  async deleteTemplate(id: string) {
    await this.one('templates', id);
    await this.query(`DELETE FROM ${this.schema}.templates WHERE id=$1`, [id]);
  }
  async medias(profileId?: string) {
    return (await this.all<Media>('media')).filter((m) => !profileId || m.profileId === profileId);
  }
  media(id: string) {
    return this.one<Media>('media', id);
  }
  private imagePath(m: Media) {
    return `${m.profileId}/${m.id}.png`;
  }
  async mediaData(id: string) {
    return this.storage.get(this.imagePath(await this.media(id)));
  }
  async addMedia(profileId: string, name: string, bytes: Buffer, width: number, height: number) {
    await this.profile(profileId);
    const m: Media = {
        id: randomUUID(),
        profileId,
        name,
        mime: 'image/png',
        width,
        height,
        createdAt: new Date().toISOString(),
      },
      path = this.imagePath(m);
    await this.storage.put(path, bytes);
    try {
      await this.query(`INSERT INTO ${this.schema}.media VALUES ($1,$2,$3)`, [
        m.id,
        m.profileId,
        m,
      ]);
      return m;
    } catch (e) {
      await this.cleanupPaths([path]);
      throw e;
    }
  }
  private async cleanupPaths(paths: string[]) {
    for (const path of paths)
      await this.query(
        `INSERT INTO ${this.schema}.storage_cleanup VALUES ($1) ON CONFLICT DO NOTHING`,
        [path],
      );
    await this.collectStorage().catch(() => undefined);
  }
  async collectStorage() {
    const paths = (
      await this.query(`SELECT path FROM ${this.schema}.storage_cleanup LIMIT 100`)
    ).rows.map((r) => r.path as string);
    if (!paths.length) return;
    await this.storage.remove(paths);
    await this.query(`DELETE FROM ${this.schema}.storage_cleanup WHERE path=ANY($1::text[])`, [
      paths,
    ]);
  }
  async deleteMedia(id: string) {
    await this.transaction(async (tx) => {
      const m = await tx.one<Media>('media', id, true),
        uses = (d: AssetDocument) => d.photoId === id || d.logoId === id;
      if (
        uses((await tx.profile(m.profileId)).kit) ||
        (await tx.assets(m.profileId)).some((a) => uses(a.document)) ||
        (await tx.templates(m.profileId)).some((t) => uses(t.document)) ||
        (await tx.all<Revision>('revisions')).some((r) => uses(r.snapshot.document))
      )
        fail(409, 'Imagem usada pela identidade, por ativos, modelos ou histórico.');
      await tx.query(
        `INSERT INTO ${this.schema}.storage_cleanup VALUES ($1) ON CONFLICT DO NOTHING`,
        [tx.imagePath(m)],
      );
      await tx.query(`DELETE FROM ${this.schema}.media WHERE id=$1`, [id]);
    });
    await this.collectStorage().catch(() => undefined);
  }
  async backup(): Promise<Backup> {
    return this.transaction(async (tx) => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const profiles = await tx.profiles(),
        assets = await tx.assets(),
        templates = await tx.templates(),
        revisions = await tx.all<Revision>('revisions'),
        medias = await tx.medias();
      const media = [];
      for (const m of medias)
        media.push({ ...m, data: (await tx.mediaData(m.id)).toString('base64') });
      return backupSchema.parse({
        type: 'identity-studio-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        profiles,
        assets,
        templates,
        revisions,
        media,
      });
    });
  }
  async importBackup(
    value: Backup,
    normalized: Map<string, { bytes: Buffer; width: number; height: number }>,
  ) {
    const b = backupSchema.parse(value),
      unique = (items: { id: string }[]) => {
        if (new Set(items.map((i) => i.id)).size !== items.length)
          fail(400, 'IDs duplicados no backup.');
      };
    [b.profiles, b.assets, b.media, b.templates, b.revisions].forEach(unique);
    const profiles = new Map(b.profiles.map((p) => [p.id, randomUUID()])),
      assets = new Map(b.assets.map((a) => [a.id, randomUUID()])),
      media = new Map(b.media.map((m) => [m.id, randomUUID()])),
      owners = new Map(b.media.map((m) => [m.id, m.profileId]));
    const mapDoc = (profileId: string, d: AssetDocument) => {
      if (!profiles.has(profileId)) fail(400, 'Perfil ausente no backup.');
      for (const id of [d.photoId, d.logoId])
        if (id && owners.get(id) !== profileId)
          fail(400, 'Referência de imagem inválida no backup.');
      return {
        ...d,
        photoId: d.photoId ? media.get(d.photoId)! : null,
        logoId: d.logoId ? media.get(d.logoId)! : null,
      };
    };
    const mapAsset = (a: Asset): Asset => {
      if (!assets.has(a.id)) fail(400, 'Ativo ausente no backup.');
      if (platforms.find((p) => p.id === a.platformId)!.kind !== a.kind)
        fail(400, 'Tipo incompatível com a plataforma.');
      return {
        ...a,
        id: assets.get(a.id)!,
        profileId: profiles.get(a.profileId)!,
        document: mapDoc(a.profileId, a.document),
      };
    };
    const mappedProfiles = b.profiles.map((p) => ({
        ...p,
        id: profiles.get(p.id)!,
        name: p.name.slice(0, 65) + ' · importado',
        kit: mapDoc(p.id, p.kit),
      })),
      mappedAssets = b.assets.map(mapAsset),
      mappedTemplates = b.templates.map((t) => ({
        ...t,
        id: randomUUID(),
        profileId: profiles.get(t.profileId)!,
        document: mapDoc(t.profileId, t.document),
      }));
    const mappedMedia = b.media.map((m) => {
      if (!profiles.has(m.profileId) || !normalized.has(m.id)) fail(400, 'Biblioteca inválida.');
      const n = normalized.get(m.id)!;
      const { data, ...metadata } = m;
      return {
        metadata: {
          ...metadata,
          id: media.get(m.id)!,
          profileId: profiles.get(m.profileId)!,
          width: n.width,
          height: n.height,
        },
        bytes: n.bytes,
      };
    });
    const keys = new Set<string>();
    const mappedRevisions = b.revisions.map((r) => {
      const current = b.assets.find((a) => a.id === r.assetId),
        key = r.assetId + ':' + r.version;
      if (
        !current ||
        r.snapshot.id !== r.assetId ||
        r.snapshot.profileId !== current.profileId ||
        r.version !== r.snapshot.version ||
        r.version > current.version ||
        keys.has(key)
      )
        fail(400, 'Histórico inconsistente no backup.');
      keys.add(key);
      return {
        ...r,
        id: randomUUID(),
        assetId: assets.get(r.assetId)!,
        snapshot: mapAsset(r.snapshot),
      };
    });
    for (const a of b.assets)
      if (
        !b.revisions.some(
          (r) =>
            r.assetId === a.id &&
            r.version === a.version &&
            JSON.stringify(r.snapshot) === JSON.stringify(a),
        )
      )
        fail(400, 'A versão atual não corresponde ao histórico.');
    const uploaded: string[] = [];
    try {
      for (const m of mappedMedia) {
        const path = this.imagePath(m.metadata);
        await this.storage.put(path, m.bytes);
        uploaded.push(path);
      }
      return await this.transaction(async (tx) => {
        for (const p of mappedProfiles)
          await tx.query(`INSERT INTO ${this.schema}.profiles VALUES ($1,$2)`, [p.id, p]);
        for (const m of mappedMedia)
          await tx.query(`INSERT INTO ${this.schema}.media VALUES ($1,$2,$3)`, [
            m.metadata.id,
            m.metadata.profileId,
            m.metadata,
          ]);
        for (const a of mappedAssets)
          await tx.query(`INSERT INTO ${this.schema}.assets VALUES ($1,$2,$3)`, [
            a.id,
            a.profileId,
            a,
          ]);
        for (const t of mappedTemplates)
          await tx.query(`INSERT INTO ${this.schema}.templates VALUES ($1,$2,$3)`, [
            t.id,
            t.profileId,
            t,
          ]);
        for (const r of mappedRevisions)
          await tx.query(`INSERT INTO ${this.schema}.revisions VALUES ($1,$2,$3,$4)`, [
            r.id,
            r.assetId,
            r.version,
            r,
          ]);
        return {
          profiles: mappedProfiles.length,
          assets: mappedAssets.length,
          media: mappedMedia.length,
        };
      });
    } catch (e) {
      await this.cleanupPaths(uploaded);
      throw e;
    }
  }
}

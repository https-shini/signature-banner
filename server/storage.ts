import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
export interface ImageStorage {
  put(path: string, bytes: Buffer): Promise<void>;
  get(path: string): Promise<Buffer>;
  remove(paths: string[]): Promise<void>;
}
export class SupabaseStorage implements ImageStorage {
  private client;
  constructor(
    url: string,
    key: string,
    private bucket: string,
  ) {
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async initialize() {
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (data) {
      if (data.public) throw new Error('O bucket de imagens deve ser privado.');
      return;
    }
    const code = String(
      (error as { statusCode?: string; status?: number } | null)?.statusCode ??
        (error as { status?: number } | null)?.status,
    );
    if (error && !['404', '400'].includes(code))
      throw new Error('Não foi possível verificar o bucket Supabase.');
    const result = await this.client.storage.createBucket(this.bucket, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: ['image/png'],
    });
    if (result.error)
      throw new Error(
        'Não foi possível criar o bucket privado Supabase. Verifique acesso e cotas gratuitas.',
      );
  }
  async put(path: string, bytes: Buffer) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, bytes, { contentType: 'image/png', upsert: false });
    if (error) throw new Error('Não foi possível armazenar a imagem no Supabase.');
  }
  async get(path: string) {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error || !data) throw new Error('Não foi possível carregar uma imagem da biblioteca.');
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(paths: string[]) {
    if (!paths.length) return;
    const { error } = await this.client.storage.from(this.bucket).remove(paths);
    if (error) throw new Error('Limpeza de imagens pendente no Supabase.');
  }
}
// Desenvolvimento local somente. Produção exige Supabase Storage.
export class LocalStorage implements ImageStorage {
  constructor(private root: string) {}
  private location(path: string) {
    if (!/^[\da-f-]+\/[\da-f-]+\.png$/.test(path)) throw new Error('Caminho de imagem inválido.');
    return resolve(this.root, path);
  }
  async put(path: string, bytes: Buffer) {
    const file = this.location(path);
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  }
  async get(path: string) {
    return readFile(this.location(path));
  }
  async remove(paths: string[]) {
    for (const path of paths)
      await unlink(this.location(path)).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
  }
}
export class MemoryStorage implements ImageStorage {
  private data = new Map<string, Buffer>();
  async put(path: string, bytes: Buffer) {
    if (this.data.has(path)) throw new Error('Objeto já existe.');
    this.data.set(path, Buffer.from(bytes));
  }
  async get(path: string) {
    const data = this.data.get(path);
    if (!data) throw new Error('Objeto não encontrado.');
    return Buffer.from(data);
  }
  async remove(paths: string[]) {
    for (const path of paths) this.data.delete(path);
  }
}

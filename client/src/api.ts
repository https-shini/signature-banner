export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const token = {
  get: () => sessionStorage.getItem('identity-access') ?? '',
  set: (value: string) => sessionStorage.setItem('identity-access', value),
  clear: () => sessionStorage.removeItem('identity-access'),
};
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const auth = token.get();
  const response = await fetch('/api' + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: 'Bearer ' + auth } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Falha na comunicação com o servidor.' }));
    throw new ApiError(response.status, [error.message, ...(error.details ?? [])].join('\n'));
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const filename = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-')
    .slice(0, 80) || 'identidade';
export async function fileBase64(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Selecione PNG, JPEG ou WebP.');
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

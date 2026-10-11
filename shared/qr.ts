import qrCode from './qrcode.js';
qrCode.stringToBytes = (value: string) => Array.from(new TextEncoder().encode(value));
type Matrix = { count: number; isDark: (row: number, column: number) => boolean };
const cache = new Map<string, Matrix>();
export function encodeQr(value: string): Matrix {
  const found = cache.get(value);
  if (found) return found;
  const qr = qrCode(0, 'M');
  qr.addData(value, 'Byte');
  qr.make();
  const result = {
    count: qr.getModuleCount(),
    isDark: (row: number, column: number) => qr.isDark(row, column),
  };
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  cache.set(value, result);
  return result;
}

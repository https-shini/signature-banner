import qrCode from './qrcode.js';
import { documentSchema, exportSchema, type AssetDocument, type ExportOptions } from './model';

export const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export type ImageResolver = (id: string) => string | undefined;
export const fontFamilies = {
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'Courier New, monospace',
};
function lines(value: string, maxChars: number, limit: number) {
  const output: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        output.push(line);
        line = '';
      }
      line = (line + ' ' + word).trim();
    }
    output.push(line);
  }
  const clipped = output.slice(0, limit);
  return clipped.map((line, i) =>
    line.length > maxChars || (output.length > limit && i === limit - 1)
      ? line.slice(0, maxChars - 1) + '…'
      : line,
  );
}
export function renderSvg(value: AssetDocument, image: ImageResolver = () => undefined): string {
  const d = documentSchema.parse(value),
    { width: w, height: h, colors: c, layout: l, content: t } = d;
  const font = fontFamilies[l.font],
    x = (w * l.textX) / 100,
    y = (h * l.textY) / 100;
  const avatarSize = (Math.min(w, h) * l.avatarSize) / 100,
    ax = (w * l.avatarX) / 100,
    ay = (h * l.avatarY) / 100;
  const initials = t.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((s, i, a) => (i === 0 || i === a.length - 1 ? s[0] : ''))
    .join('')
    .slice(0, 2)
    .toUpperCase();
  let elements = `<rect width="${w}" height="${h}" fill="${c.background}"/>`;
  if (l.style === 'studio')
    elements += `<defs><radialGradient id="glow"><stop stop-color="${c.accent}" stop-opacity=".23"/><stop offset="1" stop-color="${c.accent}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w * 0.87}" cy="${h * 0.3}" rx="${w * 0.4}" ry="${h * 1.7}" fill="url(#glow)"/><rect x="0" y="0" width="${Math.max(4, w * 0.005)}" height="${h}" fill="${c.accent}"/>`;
  if (l.style === 'split')
    elements += `<path d="M ${w * 0.65} 0 H ${w} V ${h} H ${w * 0.5} Z" fill="${c.accent}" opacity=".13"/><circle cx="${w * 0.86}" cy="${h * 0.5}" r="${h * 0.9}" fill="none" stroke="${c.accent}" stroke-opacity=".22"/>`;
  const photo = d.photoId ? image(d.photoId) : undefined;
  if (l.showAvatar) {
    elements += `<defs><clipPath id="photo"><circle cx="${ax + avatarSize / 2}" cy="${ay + avatarSize / 2}" r="${avatarSize / 2}"/></clipPath></defs><circle cx="${ax + avatarSize / 2}" cy="${ay + avatarSize / 2}" r="${avatarSize / 2}" fill="${c.accent}" fill-opacity=".15" stroke="${c.accent}" stroke-width="2"/>`;
    if (photo) {
      const size = avatarSize * l.photoZoom,
        px = ax - (size - avatarSize) / 2 + (avatarSize * l.photoOffsetX) / 100,
        py = ay - (size - avatarSize) / 2 + (avatarSize * l.photoOffsetY) / 100;
      elements += `<image href="${escape(photo)}" x="${px}" y="${py}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" clip-path="url(#photo)"/>`;
    } else
      elements += `<text x="${ax + avatarSize / 2}" y="${ay + avatarSize * 0.61}" text-anchor="middle" font-size="${avatarSize * 0.34}" font-weight="700" fill="${c.accent}">${escape(initials)}</text>`;
  }
  if (d.composition !== 'avatar') {
    const available = Math.max(
      50,
      w - x - (l.showQr ? (Math.min(w, h) * l.qrSize) / 100 + w * 0.05 : w * 0.05),
    );
    const anchor = l.align === 'center' ? 'middle' : 'start';
    const tx = l.align === 'center' ? x + available / 2 : x;
    const text = (value: string, dy: number, size: number, color: string, weight = 400) =>
      `<text x="${tx}" y="${y + dy}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${color}">${escape(value)}</text>`;
    const fs = l.fontSize,
      space = fs * l.spacing;
    elements += text(t.eyebrow, 0, fs * 0.32, c.accent, 700);
    const names = lines(t.name, Math.max(4, Math.floor(available / (fs * 0.59))), 2);
    names.forEach((line, i) => {
      elements += text(line, space * (i + 0.95), fs, c.primary, 700);
    });
    let offset = space * (names.length + 0.75);
    const role = [t.role, t.company].filter(Boolean).join(' · ');
    lines(role, Math.max(8, Math.floor(available / (fs * 0.3))), 1).forEach((line) => {
      elements += text(line, offset, fs * 0.5, c.primary, 500);
    });
    offset += space * 0.6;
    for (const line of lines(t.tagline, Math.max(8, Math.floor(available / (fs * 0.23))), 2)) {
      elements += text(line, offset, fs * 0.4, c.secondary);
      offset += space * 0.46;
    }
    offset += space * 0.3;
    const contact = [t.email, t.site.replace(/^https?:\/\//, '').replace(/\/$/, '')]
      .filter(Boolean)
      .join('  ·  ');
    lines(contact, Math.max(8, Math.floor(available / (fs * 0.21))), 1).forEach((line) => {
      elements += text(line, offset, fs * 0.35, c.secondary);
    });
  }
  if (l.showQr && t.qrUrl) {
    const qr = qrCode(0, 'M');
    qr.addData(t.qrUrl, 'Byte');
    qr.make();
    const n = qr.getModuleCount(),
      size = (Math.min(w, h) * l.qrSize) / 100,
      cell = size / (n + 8),
      qx = (w * l.qrX) / 100,
      qy = (h * l.qrY) / 100;
    elements += `<rect x="${qx}" y="${qy}" width="${size}" height="${size}" rx="${size * 0.07}" fill="#ffffff"/>`;
    let path = '';
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++)
        if (qr.isDark(r, col))
          path += `M${qx + (col + 4) * cell},${qy + (r + 4) * cell}h${cell}v${cell}h-${cell}z`;
    elements += `<path d="${path}" fill="#111827"/>`;
  }
  const logo = d.logoId ? image(d.logoId) : undefined;
  if (logo)
    elements += `<image href="${escape(logo)}" x="${w * 0.88}" y="${h * 0.8}" width="${w * 0.08}" height="${h * 0.14}" preserveAspectRatio="xMidYMid meet"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(t.name)}" style="font-family:${font}">${elements}</svg>`;
}
export function renderEmail(value: AssetDocument): string {
  const d = documentSchema.parse(value),
    { content: t, colors: c } = d;
  const link = (href: string, label: string) =>
    href
      ? `<a href="${escape(href)}" style="color:${c.accent};text-decoration:none">${escape(label)}</a>`
      : '';
  // Table + estilos inline para compatibilidade. Sem scripts, CSS externo ou imagens data URI.
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Assinatura de ${escape(t.name)}</title></head><body><table role="presentation" cellpadding="0" cellspacing="0" width="${d.width}" style="max-width:100%;font-family:${fontFamilies[d.layout.font]};background:${c.background};color:${c.primary};border-left:4px solid ${c.accent}"><tr><td style="padding:18px 24px"><strong style="font-size:20px">${escape(t.name)}</strong><br><span style="font-size:13px">${escape([t.role, t.company].filter(Boolean).join(' · '))}</span><p style="font-size:12px;color:${c.secondary}">${escape(t.tagline).replace(/\n/g, '<br>')}</p><span style="font-size:12px">${link(t.email ? 'mailto:' + t.email : '', t.email)}${t.email && t.site ? ' &nbsp;·&nbsp; ' : ''}${link(t.site, t.site.replace(/^https?:\/\//, ''))}</span></td></tr></table></body></html>`;
}
export async function exportImage(
  d: AssetDocument,
  options: ExportOptions,
  image: ImageResolver,
): Promise<Blob> {
  const o = exportSchema.parse(options);
  if (o.format === 'html') return new Blob([renderEmail(d)], { type: 'text/html' });
  const svg = renderSvg(d, image);
  if (o.format === 'svg')
    return new Blob(
      [
        svg.replace(
          `width="${d.width}" height="${d.height}"`,
          `width="${o.width}" height="${o.height}"`,
        ),
      ],
      { type: 'image/svg+xml' },
    );
  const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = source;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = o.width;
    canvas.height = o.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível neste navegador.');
    ctx.fillStyle = d.colors.background;
    ctx.fillRect(0, 0, o.width, o.height);
    ctx.drawImage(img, 0, 0, o.width, o.height);
    const mime = 'image/' + o.format;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, o.quality),
    );
    if (!blob || blob.type !== mime) throw new Error('Formato não suportado pelo navegador.');
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}

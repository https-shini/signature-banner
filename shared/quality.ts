import { documentSchema, type AssetDocument } from './model';
import { lines } from './render';
import { encodeQr } from './qr';
export type QualityIssue = { id: string; message: string };
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function assessQuality(value: AssetDocument, scale = 1): QualityIssue[] {
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success)
    return [
      { id: 'invalid', message: 'Revise dimensões, cores e campos inválidos antes de exportar.' },
    ];
  const d = parsed.data,
    { layout: l, content: t, width: w, height: h } = d;
  const issues: QualityIssue[] = [];
  const add = (id: string, message: string) => issues.push({ id, message });
  const qrVisible = l.showQr && !!t.qrUrl;
  const qrSize = (Math.min(w, h) * l.qrSize) / 100;
  if (d.composition !== 'avatar') {
    for (const [key, label] of [
      ['primary', 'nome'],
      ...(l.showDetails ? [['secondary', 'textos secundários']] : []),
      ...(t.eyebrow ? [['accent', 'sobretítulo']] : []),
    ] as [keyof typeof d.colors, string][]) {
      const ratio = contrast(d.colors[key], d.colors.background);
      if (ratio < 4.5)
        add(
          'contrast-' + key,
          `Contraste de ${label}: ${ratio.toFixed(1)}:1 contra a cor de fundo. Ajuste a paleta para pelo menos 4,5:1.`,
        );
    }
    if (d.backgroundImageId)
      add(
        'background',
        'O fundo contém uma imagem: confira o contraste visual em toda a área do texto; o cálculo considera apenas a cor base.',
      );
    const x = (w * l.textX) / 100;
    const available = Math.max(
      1,
      l.textWidth
        ? Math.min(w - x, (w * l.textWidth) / 100)
        : w - x - (qrVisible ? qrSize + w * 0.05 : w * 0.05),
    );
    const fs = l.fontSize,
      space = fs * l.spacing;
    const names = lines(
      t.name,
      Math.max(4, Math.floor(available / (fs * (l.style === 'reference' ? 0.48 : 0.59)))),
      2,
    );
    const role = [t.role, t.company].filter(Boolean).join(' · ');
    const tagline = lines(t.tagline, Math.max(8, Math.floor(available / (fs * 0.23))), 2);
    const contact = [t.email, t.site.replace(/^https?:\/\//, '').replace(/\/$/, '')]
      .filter(Boolean)
      .join('  ·  ');
    const candidates = [
      ['nome', names],
      ...(l.showDetails
        ? [
            ['cargo', lines(role, Math.max(8, Math.floor(available / (fs * 0.3))), 1)],
            ['apresentação', tagline],
            ['contatos', lines(contact, Math.max(8, Math.floor(available / (fs * 0.21))), 1)],
            [
              'competências',
              lines(t.specialties, Math.max(8, Math.floor(available / (fs * 0.23))), 1),
            ],
          ]
        : []),
    ] as [string, string[]][];
    for (const [label, rows] of candidates)
      if (rows.some((row) => row.endsWith('…')))
        add(
          'clipped-' + label,
          `O campo ${label} recebe reticências na composição. Reduza o texto, a fonte ou amplie a área de texto.`,
        );
    const bottom =
      (h * l.textY) / 100 +
      (l.showDetails
        ? space *
          (names.length + 0.75 + 0.6 + (t.specialties ? 0.58 : 0) + tagline.length * 0.46 + 0.3)
        : space * (names.length - 0.05));
    if (bottom > h - h * 0.03 || (h * l.textY) / 100 - fs * 0.32 < 0)
      add(
        'text-bounds',
        'O bloco de texto pode ultrapassar a borda vertical. Ajuste posição, fonte ou espaçamento.',
      );
    if (available < fs * 4)
      add(
        'text-width',
        'A área de texto é muito estreita para esta tipografia. Aumente a largura disponível.',
      );
    if (
      qrVisible &&
      x + available > (w * l.qrX) / 100 &&
      (h * l.textY) / 100 < (h * l.qrY) / 100 + qrSize &&
      bottom > (h * l.qrY) / 100
    )
      add(
        'text-qr',
        'A área de texto encontra o QR Code. Separe os blocos ou reduza a área de texto.',
      );
  }
  for (const [visible, x, y, size, label] of [
    [l.showAvatar, l.avatarX, l.avatarY, (Math.min(w, h) * l.avatarSize) / 100, 'foto'],
    [qrVisible, l.qrX, l.qrY, qrSize, 'QR Code'],
  ] as [boolean, number, number, number, string][]) {
    if (visible && ((w * x) / 100 + size > w || (h * y) / 100 + size > h))
      add(
        'bounds-' + label,
        `O bloco de ${label} ultrapassa o projeto. Ajuste seu tamanho ou posição.`,
      );
  }
  if (qrVisible) {
    const qr = encodeQr(t.qrUrl);
    const pixels = (qrSize * scale) / (qr.count + 8);
    if (pixels < 2)
      add(
        'qr-resolution',
        `O QR tem ${pixels.toFixed(1)} px por módulo na saída. Amplie o QR ou a escala para pelo menos 2 px e teste a leitura no tamanho de exibição.`,
      );
  }
  return issues;
}

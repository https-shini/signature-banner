import type { AssetDocument } from './model';
export const palettes = [
  ['Violeta', '#101727', '#f8fafc', '#a8b1c4', '#8b79f6'],
  ['Papel', '#ffffff', '#182235', '#64748b', '#604ae8'],
  ['Floresta', '#123b36', '#f0fdfa', '#acd4c8', '#8fdfba'],
  ['Crimson', '#17121a', '#fff1f2', '#baa8b3', '#fb7185'],
  ['Areia', '#f2eadf', '#372b20', '#78644f', '#ad6039'],
] as const;
type NumericLayoutKey = {
  [K in keyof AssetDocument['layout']]: AssetDocument['layout'][K] extends number ? K : never;
}[keyof AssetDocument['layout']];
export type RangeControl = {
  key: NumericLayoutKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
};
export const advancedLayoutControls: RangeControl[] = [
  { key: 'textWidth', label: 'Área de texto (0 = automática)', min: 0, max: 100, unit: '%' },
  { key: 'logoX', label: 'Logo · posição horizontal', min: 0, max: 95, unit: '%' },
  { key: 'logoY', label: 'Logo · posição vertical', min: 0, max: 95, unit: '%' },
  { key: 'logoSize', label: 'Logo · tamanho', min: 2, max: 80, unit: '%' },
];
export const backgroundControls: RangeControl[] = [
  { key: 'backgroundOpacity', label: 'Opacidade do fundo', min: 0, max: 1, step: 0.05 },
  { key: 'backgroundZoom', label: 'Zoom do fundo', min: 1, max: 4, step: 0.05 },
  { key: 'backgroundOffsetX', label: 'Fundo · ajuste horizontal', min: -50, max: 50, unit: '%' },
  { key: 'backgroundOffsetY', label: 'Fundo · ajuste vertical', min: -50, max: 50, unit: '%' },
];

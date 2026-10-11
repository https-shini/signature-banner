import type { AssetDocument, Media } from '../../../shared/model';
import { Field } from './ui';
import {
  palettes,
  advancedLayoutControls,
  backgroundControls,
} from '../../../shared/customization';
export function DocumentFields({
  tab,
  document: d,
  onChange,
  media,
}: {
  tab: string;
  document: AssetDocument;
  onChange: (d: AssetDocument) => void;
  media: Media[];
}) {
  const content = (key: keyof AssetDocument['content'], value: string) =>
    onChange({ ...d, content: { ...d.content, [key]: value } });
  const layout = (key: keyof AssetDocument['layout'], value: unknown) =>
    onChange({ ...d, layout: { ...d.layout, [key]: value } });
  const ranges = (controls: typeof advancedLayoutControls) =>
    controls.map((c) => (
      <Field key={c.key} label={`${c.label} · ${d.layout[c.key]}${c.unit ?? ''}`}>
        <input
          type="range"
          min={c.min}
          max={c.max}
          step={c.step ?? 1}
          value={d.layout[c.key]}
          onChange={(e) => layout(c.key, Number(e.target.value))}
        />
      </Field>
    ));
  if (tab === 'content')
    return (
      <div className="form-stack">
        <Field label="Nome profissional">
          <input
            value={d.content.name}
            maxLength={100}
            onChange={(e) => content('name', e.target.value)}
          />
        </Field>
        <Field label="Título ou especialidade">
          <input
            value={d.content.eyebrow}
            maxLength={100}
            onChange={(e) => content('eyebrow', e.target.value)}
          />
        </Field>
        <Field label="Cargo">
          <input
            value={d.content.role}
            maxLength={150}
            onChange={(e) => content('role', e.target.value)}
          />
        </Field>
        <Field label="Empresa ou marca">
          <input
            value={d.content.company}
            maxLength={100}
            placeholder="Opcional"
            onChange={(e) => content('company', e.target.value)}
          />
        </Field>
        <Field label="Apresentação">
          <textarea
            value={d.content.tagline}
            maxLength={400}
            rows={3}
            onChange={(e) => content('tagline', e.target.value)}
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={d.content.email}
            maxLength={150}
            onChange={(e) => content('email', e.target.value)}
          />
        </Field>
        <Field label="Site" hint="Inclua https:// no endereço.">
          <input
            type="url"
            value={d.content.site}
            maxLength={500}
            placeholder="https://seusite.com"
            onChange={(e) => content('site', e.target.value)}
          />
        </Field>
        <Field label="Link do QR Code">
          <input
            type="url"
            value={d.content.qrUrl}
            maxLength={500}
            onChange={(e) => content('qrUrl', e.target.value)}
          />
        </Field>
      </div>
    );
  if (tab === 'appearance')
    return (
      <div className="form-stack">
        <div>
          <p className="field-heading">Paletas prontas</p>
          <div className="palette-options">
            {palettes.map(([name, background, primary, secondary, accent]) => (
              <button
                key={name}
                title={name}
                aria-label={`Paleta ${name}`}
                className="palette-button"
                style={{ background, color: primary, borderColor: accent }}
                onClick={() =>
                  onChange({ ...d, colors: { background, primary, secondary, accent } })
                }
              >
                <span style={{ background: accent }} />
                {name}
              </button>
            ))}
          </div>
        </div>
        {Object.entries({
          background: 'Plano de fundo',
          primary: 'Texto principal',
          secondary: 'Texto secundário',
          accent: 'Cor de destaque',
        }).map(([key, label]) => (
          <Field label={label} key={key}>
            <div className="color-control">
              <input
                type="color"
                aria-label={`Selecionar ${label}`}
                value={d.colors[key as keyof typeof d.colors]}
                onChange={(e) => onChange({ ...d, colors: { ...d.colors, [key]: e.target.value } })}
              />
              <input
                aria-label={`Hex ${label}`}
                value={d.colors[key as keyof typeof d.colors]}
                maxLength={7}
                onChange={(e) => onChange({ ...d, colors: { ...d.colors, [key]: e.target.value } })}
              />
            </div>
          </Field>
        ))}
        <Field label="Tipografia">
          <select value={d.layout.font} onChange={(e) => layout('font', e.target.value)}>
            <option value="sans">Sans · Arial / Helvetica</option>
            <option value="serif">Serif · Georgia</option>
            <option value="mono">Mono · Courier</option>
          </select>
        </Field>
        <Field label={`Tamanho do nome · ${d.layout.fontSize} px`}>
          <input
            type="range"
            min="12"
            max="480"
            value={d.layout.fontSize}
            onChange={(e) => layout('fontSize', Number(e.target.value))}
          />
        </Field>
        <Field label="Composição">
          <select value={d.layout.style} onChange={(e) => layout('style', e.target.value)}>
            <option value="studio">Studio · brilho sutil</option>
            <option value="minimal">Essencial · fundo sólido</option>
            <option value="split">Horizonte · formas geométricas</option>
          </select>
        </Field>
      </div>
    );
  if (tab === 'layout')
    return (
      <div className="form-stack">
        <div className="two-fields">
          <Field label="Largura do projeto">
            <input
              type="number"
              min="64"
              max="4000"
              value={d.width || ''}
              onChange={(e) => onChange({ ...d, width: Number(e.target.value) })}
            />
          </Field>
          <Field label="Altura do projeto">
            <input
              type="number"
              min="64"
              max="4000"
              value={d.height || ''}
              onChange={(e) => onChange({ ...d, height: Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="Alinhamento do texto">
          <select value={d.layout.align} onChange={(e) => layout('align', e.target.value)}>
            <option value="left">À esquerda</option>
            <option value="center">Centralizado</option>
            <option value="right">À direita</option>
          </select>
        </Field>
        {[
          ['textX', 'Posição horizontal do texto', 0, 95],
          ['textY', 'Posição vertical do texto', 0, 95],
          ['spacing', 'Espaçamento de linhas', 1, 2],
        ].map(([key, label, min, max]) => (
          <Field
            key={key}
            label={`${label} · ${d.layout[key as 'textX']} ${key === 'spacing' ? '×' : '%'}`}
          >
            <input
              type="range"
              min={min}
              max={max}
              step={key === 'spacing' ? 0.05 : 1}
              value={d.layout[key as 'textX']}
              onChange={(e) => layout(key as 'textX', Number(e.target.value))}
            />
          </Field>
        ))}
        <label className="check-field">
          <input
            type="checkbox"
            checked={d.layout.showAvatar}
            onChange={(e) => layout('showAvatar', e.target.checked)}
          />{' '}
          Mostrar foto ou monograma
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={d.layout.showQr}
            onChange={(e) => layout('showQr', e.target.checked)}
          />{' '}
          Mostrar QR Code
        </label>
        {[
          ['avatarX', 'Foto · posição horizontal', 0, 90],
          ['avatarY', 'Foto · posição vertical', 0, 90],
          ['avatarSize', 'Foto · tamanho', 5, 100],
          ['qrX', 'QR · posição horizontal', 0, 90],
          ['qrY', 'QR · posição vertical', 0, 90],
          ['qrSize', 'QR · tamanho', 10, 80],
        ].map(([key, label, min, max]) => (
          <Field key={key} label={`${label} · ${d.layout[key as 'avatarX']}%`}>
            <input
              type="range"
              min={min}
              max={max}
              value={d.layout[key as 'avatarX']}
              onChange={(e) => layout(key as 'avatarX', Number(e.target.value))}
            />
          </Field>
        ))}
        <label className="check-field">
          <input
            type="checkbox"
            checked={d.layout.showDetails}
            onChange={(e) => layout('showDetails', e.target.checked)}
          />{' '}
          Mostrar cargo, apresentação e contatos
        </label>
        <details className="advanced-fields">
          <summary>Composição avançada e logotipo</summary>
          {ranges(advancedLayoutControls)}
        </details>
        <details className="advanced-fields">
          <summary>Preferências de exportação</summary>
          <Field label="Formato preferido">
            <select
              value={d.exportPreferences.format}
              onChange={(e) =>
                onChange({
                  ...d,
                  exportPreferences: {
                    ...d.exportPreferences,
                    format: e.target.value as AssetDocument['exportPreferences']['format'],
                  },
                })
              }
            >
              {['png', 'jpeg', 'webp', 'svg'].map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Escala preferida">
            <select
              value={d.exportPreferences.scale}
              onChange={(e) =>
                onChange({
                  ...d,
                  exportPreferences: { ...d.exportPreferences, scale: Number(e.target.value) },
                })
              }
            >
              {[1, 2, 3].map((scale) => (
                <option key={scale} value={scale}>
                  {scale}×
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Qualidade preferida · ${Math.round(d.exportPreferences.quality * 100)}%`}>
            <input
              type="range"
              min=".3"
              max="1"
              step=".01"
              value={d.exportPreferences.quality}
              onChange={(e) =>
                onChange({
                  ...d,
                  exportPreferences: { ...d.exportPreferences, quality: Number(e.target.value) },
                })
              }
            />
          </Field>
        </details>
        <p className="muted small">
          Posições são percentuais da tela. O tamanho de foto e QR usa o menor lado. Textos longos
          são quebrados e podem receber reticências; confira o preview.
        </p>
      </div>
    );
  return (
    <div className="form-stack">
      <p className="muted">
        Use fotos e logos da biblioteca deste perfil. As imagens são incorporadas ao arquivo
        exportado.
      </p>
      {(['photoId', 'logoId', 'backgroundImageId'] as const).map((key) => (
        <Field
          key={key}
          label={
            key === 'photoId' ? 'Foto de perfil' : key === 'logoId' ? 'Logotipo' : 'Imagem de fundo'
          }
        >
          <select
            value={d[key] ?? ''}
            onChange={(e) => onChange({ ...d, [key]: e.target.value || null })}
          >
            <option value="">
              {key === 'photoId'
                ? 'Usar monograma'
                : key === 'logoId'
                  ? 'Sem logotipo'
                  : 'Usar cor de fundo'}
            </option>
            {media.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name} · {m.width}×{m.height}
              </option>
            ))}
          </select>
        </Field>
      ))}
      <Field label="Recorte da foto">
        <select value={d.layout.photoShape} onChange={(e) => layout('photoShape', e.target.value)}>
          <option value="circle">Circular</option>
          <option value="square">Quadrado</option>
        </select>
      </Field>
      {d.backgroundImageId && (
        <details className="advanced-fields" open>
          <summary>Enquadramento do fundo</summary>
          {ranges(backgroundControls)}
        </details>
      )}
      {d.photoId &&
        media.find(
          (m) =>
            m.id === d.photoId &&
            Math.min(m.width, m.height) <
              ((Math.min(d.width, d.height) * d.layout.avatarSize) / 100) * d.layout.photoZoom,
        ) && (
          <p className="platform-hint">
            A imagem pode perder nitidez neste tamanho e zoom. Prefira uma foto com maior resolução.
          </p>
        )}
      {d.photoId && (
        <>
          {[
            ['photoZoom', 'Zoom da foto', 1, 4],
            ['photoOffsetX', 'Foto · ajuste horizontal', -50, 50],
            ['photoOffsetY', 'Foto · ajuste vertical', -50, 50],
          ].map(([key, label, min, max]) => (
            <Field key={key} label={`${label} · ${d.layout[key as 'photoZoom']}`}>
              <input
                type="range"
                min={min}
                max={max}
                step={key === 'photoZoom' ? 0.05 : 1}
                value={d.layout[key as 'photoZoom']}
                onChange={(e) => layout(key as 'photoZoom', Number(e.target.value))}
              />
            </Field>
          ))}
        </>
      )}
      {media.length === 0 && (
        <p className="platform-hint">Adicione imagens em Biblioteca de mídia para usá-las aqui.</p>
      )}
    </div>
  );
}

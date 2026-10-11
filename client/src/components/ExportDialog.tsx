import { Button } from '../design-system';
import { useState } from 'react';
import { Download, Check, LockKeyhole } from 'lucide-react';
import { exportSchema, platforms, type Asset, type ExportOptions } from '../../../shared/model';
import { exportImage } from '../../../shared/render';
import { download, filename } from '../api';
import { Modal, Field, ErrorNotice } from './ui';
import { Preview } from './Preview';
export function ExportDialog({
  asset,
  images,
  onClose,
  onJson,
}: {
  asset: Asset;
  images: Record<string, string>;
  onClose: () => void;
  onJson: (asset: Asset) => Promise<void>;
}) {
  const [format, setFormat] = useState<ExportOptions['format']>('png'),
    [width, setWidth] = useState(asset.document.width),
    [height, setHeight] = useState(asset.document.height),
    [quality, setQuality] = useState(0.92),
    [preserve, setPreserve] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  const result = exportSchema.safeParse({ format, width, height, quality });
  const platform = platforms.find((p) => p.id === asset.platformId)!;
  function changeWidth(w: number) {
    setWidth(w);
    if (preserve) setHeight(Math.round((w * asset.document.height) / asset.document.width));
    setDone(false);
  }
  async function run() {
    setBusy(true);
    setError('');
    setDone(false);
    try {
      const options = exportSchema.parse({ format, width, height, quality });
      const blob = await exportImage(asset.document, options, (id) => images[id]);
      if (
        asset.platformId === 'linkedin' &&
        ['png', 'jpeg', 'webp'].includes(format) &&
        blob.size > 8 * 1024 * 1024
      )
        throw new Error(
          'O arquivo excede 8 MB. Reduza a resolução ou a qualidade para o LinkedIn.',
        );
      download(blob, `${filename(asset.name)}.${format === 'jpeg' ? 'jpg' : format}`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Seu próximo ponto de contato" onClose={() => !busy && onClose()} wide>
      <div className="export-grid">
        <div className="export-preview checker">
          <Preview document={asset.document} images={images} />
          <span>{asset.name}</span>
        </div>
        <div className="export-controls">
          <p className="eyebrow">EXPORTAR ATIVO</p>
          <h3>Pronto para o mundo.</h3>
          <p className="muted">Escolha o formato certo para a sua próxima apresentação.</p>
          <Field label="Formato">
            <select
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as ExportOptions['format']);
                setDone(false);
              }}
            >
              <option value="png">PNG · máxima nitidez</option>
              <option value="jpeg">JPEG · arquivo leve</option>
              <option value="webp">WebP · para a web</option>
              <option value="svg">SVG · vetorial</option>
              {asset.kind === 'signature' && (
                <option value="html">HTML · assinatura com links</option>
              )}
            </select>
          </Field>
          {format !== 'html' && (
            <>
              <Field label="Resolução">
                <select
                  aria-label="Escala de exportação"
                  defaultValue="1"
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setWidth(asset.document.width * Number(e.target.value));
                      setHeight(asset.document.height * Number(e.target.value));
                    }
                  }}
                >
                  <option value="1">Original · 1×</option>
                  <option value="2">Alta resolução · 2×</option>
                  <option value="3">Extra alta · 3×</option>
                  <option value="custom">Personalizada</option>
                </select>
              </Field>
              <div className="two-fields">
                <Field label="Largura (px)">
                  <input
                    type="number"
                    min="64"
                    max="8000"
                    value={width || ''}
                    onChange={(e) => changeWidth(Number(e.target.value))}
                  />
                </Field>
                <Field label="Altura (px)">
                  <input
                    type="number"
                    min="64"
                    max="8000"
                    value={height || ''}
                    disabled={preserve}
                    onChange={(e) => setHeight(Number(e.target.value))}
                  />
                </Field>
              </div>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={preserve}
                  onChange={(e) => {
                    setPreserve(e.target.checked);
                    if (e.target.checked)
                      setHeight(Math.round((width * asset.document.height) / asset.document.width));
                  }}
                />
                <LockKeyhole size={14} /> Preservar proporção
              </label>
              {['jpeg', 'webp'].includes(format) && (
                <Field label={`Qualidade · ${Math.round(quality * 100)}%`}>
                  <input
                    type="range"
                    min=".3"
                    max="1"
                    step=".01"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                </Field>
              )}
            </>
          )}
          <p className="platform-hint">
            {format === 'html'
              ? 'HTML com tabela e estilos inline. Abra o arquivo, copie a assinatura renderizada e cole no Gmail. A versão HTML preserva texto e links; fotos e composição gráfica ficam na exportação de imagem.'
              : platform.hint}
          </p>
          {!result.success && <ErrorNotice message={result.error.issues[0].message} />}
          {error && <ErrorNotice message={error} />}
          <Button
            variant="primary"
            className="full"
            disabled={busy || !result.success}
            onClick={run}
          >
            {done ? <Check size={17} /> : <Download size={17} />}{' '}
            {busy
              ? 'Preparando…'
              : done
                ? 'Exportado · baixar novamente'
                : 'Exportar ' + format.toUpperCase()}
          </Button>
          <Button
            variant="subtle"
            className="full"
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true);
                await onJson(asset);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Exportar projeto em JSON
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import type { AssetDocument } from '../../../shared/model';
import { getPlatform, type PlatformId } from '../../../shared/platforms';
import { Preview } from './Preview';
export function FormatPreview({
  document,
  images,
  platformId,
}: {
  document: AssetDocument;
  images: Record<string, string>;
  platformId: PlatformId;
}) {
  const [guides, setGuides] = useState(false),
    [zoom, setZoom] = useState(1),
    [circular, setCircular] = useState(false);
  const platform = getPlatform(platformId);
  return (
    <>
      <div className="format-preview-tools" aria-label="Opções de pré-visualização">
        {platform.safeArea && (
          <label className="check-field">
            <input type="checkbox" checked={guides} onChange={(e) => setGuides(e.target.checked)} />{' '}
            Área segura
          </label>
        )}
        {platform.circular && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={circular}
              onChange={(e) => setCircular(e.target.checked)}
            />{' '}
            Recorte circular
          </label>
        )}
        <label>
          Zoom da prévia{' '}
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom da prévia"
          >
            <option value="1">Ajustar</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </label>
      </div>
      <div className="format-preview-scroll">
        <div
          className={'format-preview-frame ' + (circular ? 'circular' : '')}
          style={{
            width: `${zoom * 100}%`,
            maxWidth:
              document.width > 0 && document.height > 0
                ? `${(document.width / document.height) * 480 * zoom}px`
                : undefined,
          }}
        >
          <Preview document={document} images={images} />
          {guides && platform.safeArea && (
            <div
              className="safe-area-guide"
              aria-hidden="true"
              style={{
                left: platform.safeArea.x + '%',
                top: platform.safeArea.y + '%',
                width: platform.safeArea.width + '%',
                height: platform.safeArea.height + '%',
              }}
            />
          )}
        </div>
      </div>
      {guides && platform.safeArea && (
        <p className="muted small">{platform.safeArea.label}. As guias não entram na exportação.</p>
      )}
    </>
  );
}

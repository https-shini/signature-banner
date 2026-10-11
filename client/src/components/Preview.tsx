import { useMemo } from 'react';
import { renderSvg } from '../../../shared/render';
import type { AssetDocument } from '../../../shared/model';
export function Preview({
  document,
  images,
  className = '',
  label,
}: {
  document: AssetDocument;
  images: Record<string, string>;
  className?: string;
  label?: string;
}) {
  const result = useMemo(() => {
    try {
      return { svg: renderSvg(document, (id) => images[id]) };
    } catch {
      return { svg: null };
    }
  }, [document, images]);
  if (!result.svg)
    return (
      <div className={'preview invalid-preview ' + className}>
        Revise os campos para visualizar.
      </div>
    );
  return (
    <img
      className={'preview ' + className}
      src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(result.svg)}
      alt={label ?? `Prévia de ${document.content.name}`}
      draggable={false}
    />
  );
}

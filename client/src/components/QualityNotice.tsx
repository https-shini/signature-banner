import { assessQuality } from '../../../shared/quality';
import type { AssetDocument } from '../../../shared/model';
export function QualityNotice({
  document,
  scale = 1,
}: {
  document: AssetDocument;
  scale?: number;
}) {
  const issues = assessQuality(document, scale);
  if (!issues.length) return null;
  return (
    <details className="quality-notice">
      <summary>
        Conferir qualidade · {issues.length} {issues.length === 1 ? 'orientação' : 'orientações'}
      </summary>
      <ul>
        {issues.map((i) => (
          <li key={i.id}>{i.message}</li>
        ))}
      </ul>
      <p className="muted small">
        Estimativas de layout e contraste da cor base. Confira a prévia e o arquivo final.
      </p>
    </details>
  );
}

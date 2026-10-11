import { Image, Plus, Trash2, Upload } from 'lucide-react';
import type { Media } from '../../../shared/model';
import { Empty } from './ui';
export function MediaLibrary({
  media,
  images,
  busy,
  onUpload,
  onDelete,
}: {
  media: Media[];
  images: Record<string, string>;
  busy: boolean;
  onUpload: () => void;
  onDelete: (m: Media) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RECURSOS QUE CONECTAM</p>
          <h1>
            Biblioteca de mídia<span className="heading-dot">.</span>
          </h1>
          <p className="muted">Fotos e logotipos para criar com consistência neste contexto.</p>
        </div>
        <button className="button primary" disabled={busy} onClick={onUpload}>
          <Upload size={17} />
          Adicionar imagem
        </button>
      </div>
      <div className="upload-banner">
        <Image size={25} />
        <div>
          <strong>Seu repertório visual, em um só lugar.</strong>
          <p>
            PNG, JPEG ou WebP · até 5 MB e 16 megapixels. As imagens são normalizadas e ficam
            disponíveis nos seus editores.
          </p>
        </div>
      </div>
      {media.length === 0 ? (
        <Empty
          title="Dê um rosto à sua identidade."
          description="Adicione sua foto de perfil ou um logotipo para usar nos seus ativos."
          action={
            <button className="button secondary" disabled={busy} onClick={onUpload}>
              <Plus size={16} />
              Adicionar primeira imagem
            </button>
          }
        />
      ) : (
        <div className="media-grid">
          {media.map((m) => (
            <article className="media-card surface" key={m.id}>
              <div className="checker">
                <img src={images[m.id]} alt={m.name} />
              </div>
              <div>
                <h3>{m.name}</h3>
                <small>
                  {m.width} × {m.height} · PNG
                </small>
                <button
                  className="icon-button"
                  aria-label={`Excluir imagem ${m.name}`}
                  disabled={busy}
                  onClick={() => onDelete(m)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

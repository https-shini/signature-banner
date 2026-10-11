import { Button, PageHeading, GlassSurface } from '../design-system';
import { ArrowUpRight, Copy, Settings2, Trash2 } from 'lucide-react';
import { systemTemplates, type Profile, type Template } from '../../../shared/model';
import { Empty } from './ui';
import { Preview } from './Preview';
export type TemplateChoice = Template | (typeof systemTemplates)[number];
export function TemplateLibrary({
  profile,
  images,
  templates,
  busy,
  onUse,
  onDuplicate,
  onRename,
  onDelete,
}: {
  profile: Profile;
  images: Record<string, string>;
  templates: Template[];
  busy: boolean;
  onUse: (t: TemplateChoice) => void;
  onDuplicate: (t: Template) => void;
  onRename: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow={<>UM BOM PONTO DE PARTIDA</>}
        title={
          <>
            Modelos<span className="heading-dot">.</span>
          </>
        }
        description={<>Comece com uma composição pronta. Termine com algo só seu.</>}
        actions={<span className="pill">{systemTemplates.length + templates.length} modelos</span>}
      />
      <h2 className="subheading">
        Selecionados para você <span className="pill">Studio</span>
      </h2>
      <div className="template-grid">
        {systemTemplates.map((t) => (
          <GlassSurface as="article" level="panel" className="template-card surface" key={t.id}>
            <div className={'template-preview ' + (t.platformId === 'avatar' ? 'square' : '')}>
              <Preview
                document={{
                  ...t.document,
                  content: profile.kit.content,
                  photoId: profile.kit.photoId,
                  logoId: profile.kit.logoId,
                }}
                images={images}
              />
            </div>
            <div>
              <h3>{t.name}</h3>
              <p>{t.subtitle}</p>
              <Button variant="secondary" className="full" onClick={() => onUse(t)}>
                Usar modelo <ArrowUpRight size={16} />
              </Button>
            </div>
          </GlassSurface>
        ))}
      </div>
      <h2 className="subheading">
        Meus modelos <span className="pill">{templates.length}</span>
      </h2>
      {templates.length === 0 ? (
        <Empty
          title="Seu jeito de criar, salvo."
          description="No editor, escolha “Salvar como modelo” para reutilizar uma composição neste contexto."
        />
      ) : (
        <div className="template-grid">
          {templates.map((t) => (
            <GlassSurface as="article" level="panel" className="template-card surface" key={t.id}>
              <div className="template-preview">
                <Preview document={t.document} images={images} />
              </div>
              <div>
                <h3>{t.name}</h3>
                <div className="row">
                  <Button variant="secondary" onClick={() => onUse(t)}>
                    Usar modelo
                  </Button>
                  <button
                    className="icon-button"
                    aria-label={`Duplicar modelo ${t.name}`}
                    disabled={busy}
                    onClick={() => onDuplicate(t)}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Renomear modelo ${t.name}`}
                    disabled={busy}
                    onClick={() => onRename(t)}
                  >
                    <Settings2 size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Excluir modelo ${t.name}`}
                    disabled={busy}
                    onClick={() => onDelete(t)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </GlassSurface>
          ))}
        </div>
      )}
    </>
  );
}

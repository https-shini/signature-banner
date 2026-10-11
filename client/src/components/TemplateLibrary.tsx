import { useState } from 'react';
import { platforms } from '../../../shared/platforms';
import { Field } from './ui';
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
  onImport,
  onEdit,
  onExport,
  onUse,
  onDuplicate,
  onRename,
  onDelete,
}: {
  profile: Profile;
  images: Record<string, string>;
  templates: Template[];
  busy: boolean;
  onImport: () => void;
  onEdit: (t: Template) => void;
  onExport: (t: Template) => void;
  onUse: (t: TemplateChoice) => void;
  onDuplicate: (t: Template) => void;
  onRename: (t: Template) => void;
  onDelete: (t: Template) => void;
}) {
  const [channel, setChannel] = useState('all'),
    [search, setSearch] = useState('');
  const matches = (t: TemplateChoice) =>
    (channel === 'all' || platforms.find((p) => p.id === t.platformId)?.channel === channel) &&
    t.name.toLocaleLowerCase().includes(search.toLocaleLowerCase());
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
        actions={
          <div className="row">
            <span className="pill">{systemTemplates.length + templates.length} modelos</span>
            <Button variant="secondary" disabled={busy} onClick={onImport}>
              Importar modelo JSON
            </Button>
          </div>
        }
      />
      <div className="two-fields">
        <Field label="Buscar modelos">
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field label="Filtrar modelos por plataforma">
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">Todas as plataformas</option>
            {[...new Set(platforms.map((p) => p.channel))].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <h2 className="subheading">
        Selecionados para você <span className="pill">Studio</span>
      </h2>
      <div className="template-grid">
        {systemTemplates.filter(matches).map((t) => (
          <GlassSurface as="article" level="panel" className="template-card surface" key={t.id}>
            <div
              className={
                'template-preview ' + (t.document.composition === 'avatar' ? 'square' : '')
              }
            >
              <Preview
                document={{
                  ...t.document,
                  content: {
                    ...profile.kit.content,
                    ...(t.document.layout.style === 'reference'
                      ? {
                          eyebrow: t.document.content.eyebrow,
                          specialties:
                            profile.kit.content.specialties || t.document.content.specialties,
                        }
                      : {}),
                  },
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
      {templates.filter(matches).length === 0 ? (
        <Empty
          title={
            templates.length ? 'Nenhum modelo corresponde à busca.' : 'Seu jeito de criar, salvo.'
          }
          description="No editor, escolha “Salvar como modelo” para reutilizar uma composição neste contexto."
        />
      ) : (
        <div className="template-grid">
          {templates.filter(matches).map((t) => (
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
                  <Button variant="secondary" disabled={busy} onClick={() => onEdit(t)}>
                    Editar modelo
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => onExport(t)}>
                    Modelo JSON
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

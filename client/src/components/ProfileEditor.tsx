import { useEditHistory } from '../hooks/useEditHistory';
import { EditHistoryControls } from './EditHistoryControls';
import { Button, Tabs, PageHeading, GlassSurface } from '../design-system';
import { useEffect, useState } from 'react';
import { Save, Check, Trash2 } from 'lucide-react';
import { profileInputSchema, type Media, type Profile } from '../../../shared/model';
import { api } from '../api';
import { DocumentFields } from './DocumentFields';
import { Preview } from './Preview';
import { ErrorNotice, Field } from './ui';
export function ProfileEditor({
  profile,
  images,
  media,
  onSaved,
  onDelete,
  onDirtyChange,
  workspaceShared = false,
}: {
  workspaceShared?: boolean;
  profile: Profile;
  images: Record<string, string>;
  media: Media[];
  onSaved: (p: Profile) => void;
  onDelete: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const edit = useEditHistory(profile);
  const { draft, setDraft } = edit;
  const [saved, setSaved] = useState(profile),
    [tab, setTab] = useState('content'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  return (
    <div className="identity-page">
      <PageHeading
        eyebrow={<>A BASE DE TUDO</>}
        title={<>Minha identidade</>}
        description={<>Um ponto de partida consistente para todos os seus canais.</>}
        actions={
          <Button
            variant="primary"
            disabled={busy || !dirty}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const input = profileInputSchema.parse({
                  name: draft.name,
                  description: draft.description,
                  kit: draft.kit,
                });
                const p = await api<Profile>(`/profiles/${profile.id}`, 'PUT', input);
                edit.reset(p);
                setSaved(p);
                onSaved(p);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {dirty ? <Save size={16} /> : <Check size={16} />}Salvar identidade
          </Button>
        }
      />
      <EditHistoryControls history={edit} busy={busy} />
      {error && <ErrorNotice message={error} />}
      <div className="identity-layout">
        <GlassSurface as="section" level="panel" className="surface identity-preview">
          <p className="eyebrow">SUA IDENTIDADE PROFISSIONAL</p>
          <Preview document={draft.kit} images={images} />
          <div className="identity-note">
            <h3>Consistência começa aqui.</h3>
            <p>
              Seus novos ativos herdam estas informações. Para atualizar um ativo existente, abra o
              editor e escolha “Aplicar identidade”. Cada contexto mantém sua própria biblioteca.
            </p>
          </div>
          <div className="two-fields">
            <Field label="Nome do contexto">
              <input
                value={draft.name}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Descrição">
              <input
                value={draft.description}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
          </div>
          <button
            className="button danger subtle"
            disabled={busy}
            onClick={() => {
              if (
                (!dirty || window.confirm('Descartar alterações não salvas?')) &&
                window.confirm(
                  workspaceShared
                    ? `Excluir a identidade “${profile.name}” e seus materiais, modelos, imagens e histórico em TODOS os projetos deste workspace? A exclusão é permanente. Exporte os materiais afetados antes.`
                    : `Excluir o contexto “${profile.name}”, seus ativos, modelos, fotos e histórico? Esta ação não pode ser desfeita. Exporte um backup antes.`,
                )
              )
                onDelete();
            }}
          >
            <Trash2 size={15} />
            Excluir este contexto
          </button>
        </GlassSurface>
        <GlassSurface as="section" level="panel" className="surface identity-settings">
          <Tabs
            label="Identidade visual"
            items={[
              ['content', 'Informações'],
              ['appearance', 'Cores e fontes'],
              ['media', 'Fotos e logo'],
            ]}
            value={tab}
            onChange={setTab}
            panelId="identity-fields"
          />
          <div
            className="editor-fields"
            role="tabpanel"
            id="identity-fields"
            aria-labelledby={`identity-fields-tab-${tab}`}
          >
            <DocumentFields
              tab={tab}
              document={draft.kit}
              onChange={(kit, coalesce) => setDraft({ ...draft, kit }, coalesce)}
              media={media}
            />
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

import { QualityNotice } from './QualityNotice';
import { useEditHistory } from '../hooks/useEditHistory';
import { EditHistoryControls } from './EditHistoryControls';
import { useEffect, useState } from 'react';
import { Button, Tabs } from '../design-system';
import { platforms, templateInputSchema, type Media, type Template } from '../../../shared/model';
import { adaptDocument } from '../../../shared/platforms';
import { api } from '../api';
import { DocumentFields } from './DocumentFields';
import { FormatPreview } from './FormatPreview';
import { ErrorNotice, Field, Modal } from './ui';
export function TemplateEditor({
  template,
  media,
  images,
  onClose,
  onSaved,
  onDirtyChange,
}: {
  template: Template;
  media: Media[];
  images: Record<string, string>;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: (t: Template) => void;
}) {
  const edit = useEditHistory(template);
  const { draft, setDraft } = edit;
  const [saved, setSaved] = useState(template),
    [tab, setTab] = useState('content'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty]);
  const close = () => {
    if (!busy && (!dirty || window.confirm('Descartar as alterações não salvas deste modelo?')))
      onClose();
  };
  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload = templateInputSchema
        .omit({ profileId: true })
        .parse({ name: draft.name, platformId: draft.platformId, document: draft.document });
      const t = await api<Template>('/templates/' + draft.id, 'PUT', payload);
      edit.reset(t);
      setSaved(t);
      onSaved(t);
      setNotice(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Editar modelo" onClose={close} wide>
      <p className="muted">Editar este modelo não altera os ativos já criados a partir dele.</p>
      <EditHistoryControls history={edit} busy={busy} />
      <div className="template-edit-grid">
        <section>
          <FormatPreview document={draft.document} images={images} platformId={draft.platformId} />
          <QualityNotice document={draft.document} />
        </section>
        <section>
          <Field label="Nome do modelo">
            <input
              value={draft.name}
              maxLength={100}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Formato do modelo">
            <select
              value={draft.platformId}
              onChange={(e) => {
                const id = e.target.value as Template['platformId'];
                if (
                  window.confirm(
                    'Adaptar o layout para o novo formato, mantendo conteúdo e imagens?',
                  )
                )
                  setDraft({
                    ...draft,
                    platformId: id,
                    document: adaptDocument(draft.document, id),
                  });
              }}
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Tabs
            label="Personalização do modelo"
            items={[
              ['content', 'Conteúdo'],
              ['appearance', 'Aparência'],
              ['layout', 'Layout'],
              ['media', 'Mídia'],
            ]}
            value={tab}
            onChange={setTab}
            panelId="template-fields"
          />
          <div role="tabpanel" id="template-fields" aria-labelledby={`template-fields-tab-${tab}`}>
            <DocumentFields
              tab={tab}
              document={draft.document}
              media={media}
              onChange={(document, coalesce) => setDraft({ ...draft, document }, coalesce)}
            />
          </div>
        </section>
      </div>
      {notice && !dirty && <p role="status">Modelo atualizado.</p>}
      {error && <ErrorNotice message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" disabled={busy} onClick={close}>
          Fechar editor
        </Button>
        <Button variant="primary" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Salvando…' : 'Salvar modelo'}
        </Button>
      </div>
    </Modal>
  );
}

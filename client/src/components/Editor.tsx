import { QualityNotice } from './QualityNotice';
import { useEditHistory } from '../hooks/useEditHistory';
import { EditHistoryControls } from './EditHistoryControls';
import { Button, Tabs, GlassSurface } from '../design-system';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, Save, History, RotateCcw, BookmarkPlus } from 'lucide-react';
import {
  assetUpdateSchema,
  platforms,
  type Asset,
  type Media,
  type Profile,
  type Revision,
} from '../../../shared/model';
import { api } from '../api';
import { Field, ErrorNotice, Empty } from './ui';
import { DocumentFields } from './DocumentFields';
import { FormatPreview } from './FormatPreview';
import { adaptDocument, platformWarnings } from '../../../shared/platforms';
export function Editor({
  asset,
  profile,
  images,
  media,
  onBack,
  onSaved,
  onDirtyChange,
  onExport,
  onTemplate,
}: {
  asset: Asset;
  profile: Profile;
  images: Record<string, string>;
  media: Media[];
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved: (a: Asset) => void;
  onExport: (a: Asset) => void;
  onTemplate: (a: Asset) => Promise<void>;
}) {
  const edit = useEditHistory(asset);
  const { draft, setDraft } = edit;
  const [saved, setSaved] = useState(asset),
    [tab, setTab] = useState('content'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [history, setHistory] = useState<Revision[]>([]),
    [tagText, setTagText] = useState(asset.tags.join(', '));
  useEffect(() => {
    const parsed = [
      ...new Set(
        tagText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (JSON.stringify(parsed) !== JSON.stringify(draft.tags)) setTagText(draft.tags.join(', '));
  }, [draft.tags, tagText]);
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
  useEffect(() => {
    if (tab === 'history')
      api<Revision[]>(`/assets/${asset.id}/revisions`)
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [tab, asset.id, saved.version]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const payload = assetUpdateSchema.parse({
        name: draft.name,
        platformId: draft.platformId,
        document: draft.document,
        tags: draft.tags,
        favorite: draft.favorite,
        version: saved.version,
      });
      const a = await api<Asset>(`/assets/${asset.id}`, 'PUT', payload);
      edit.reset(a);
      setSaved(a);
      setTagText(a.tags.join(', '));
      onSaved(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restore(r: Revision) {
    if (
      !window.confirm(
        `Restaurar a versão ${r.version}? Isso cria uma nova versão.${dirty ? ' As edições não salvas serão descartadas.' : ''}`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const a = await api<Asset>(`/assets/${asset.id}/restore`, 'POST', {
        revisionId: r.id,
        version: saved.version,
      });
      edit.reset(a);
      setSaved(a);
      setTagText(a.tags.join(', '));
      onSaved(a);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const back = () => {
    if (!dirty || window.confirm('Você tem alterações não salvas. Deseja descartá-las?')) onBack();
  };
  const platform = platforms.find((p) => p.id === draft.platformId)!;
  return (
    <div className="editor-page">
      <header className="editor-heading">
        <div className="editor-title">
          <button className="icon-button" aria-label="Voltar para ativos" onClick={back}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <span className="eyebrow">
              {profile.name} / {platform.channel}
            </span>
            <h1>{draft.name}</h1>
          </div>
        </div>
        <div className="row">
          <EditHistoryControls history={edit} busy={busy} />
          <span className={'save-status ' + (dirty ? 'unsaved' : '')}>
            <span />
            {dirty ? 'Alterações não salvas' : `Salvo · v${saved.version}`}
          </span>
          <Button variant="secondary" disabled={busy} onClick={() => onExport(draft)}>
            <Download size={16} />
            Exportar
          </Button>
          <Button variant="primary" disabled={busy || !dirty} onClick={save}>
            {dirty ? <Save size={16} /> : <Check size={16} />}{' '}
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </header>
      {error && <ErrorNotice message={error} />}
      <div className="editor-layout">
        <section className="editor-canvas">
          <div className="canvas-toolbar">
            <span>PREVIEW AO VIVO</span>
            <span>
              {draft.document.width} × {draft.document.height} px
            </span>
          </div>
          <div className="canvas-stage checker format-stage">
            <FormatPreview
              document={draft.document}
              images={images}
              platformId={draft.platformId}
            />
          </div>
          {platformWarnings(draft.platformId, draft.document).map((note) => (
            <p className="platform-hint" key={note}>
              {note}
            </p>
          ))}
          <QualityNotice document={draft.document} />
          <div className="canvas-caption">
            <span className="channel-badge">{platform.channel}</span>
            <p>{platform.hint}</p>
          </div>
          <div className="editor-reuse">
            <div>
              <h3>Uma identidade. Muitas possibilidades.</h3>
              <p>
                Aplique sua identidade atual ou transforme esta composição em um modelo
                reutilizável.
              </p>
            </div>
            <div className="row">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      'Aplicar conteúdo, cores, tipografia e imagens da identidade? A composição e as dimensões serão preservadas.',
                    )
                  )
                    setDraft({
                      ...draft,
                      document: {
                        ...draft.document,
                        content: structuredClone(profile.kit.content),
                        colors: structuredClone(profile.kit.colors),
                        photoId: profile.kit.photoId,
                        logoId: profile.kit.logoId,
                        layout: { ...draft.document.layout, font: profile.kit.layout.font },
                      },
                    });
                }}
              >
                Aplicar identidade
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await onTemplate(draft);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <BookmarkPlus size={16} />
                Salvar como modelo
              </Button>
            </div>
          </div>
        </section>
        <GlassSurface as="aside" className="editor-panel">
          <Tabs
            label="Configurações do ativo"
            items={[
              ['content', 'Conteúdo'],
              ['appearance', 'Aparência'],
              ['layout', 'Layout'],
              ['media', 'Mídia'],
              ['history', 'Histórico'],
            ]}
            value={tab}
            onChange={setTab}
            panelId="asset-fields"
          />
          <div
            className="editor-fields"
            role="tabpanel"
            id="asset-fields"
            aria-labelledby={`asset-fields-tab-${tab}`}
          >
            {tab === 'layout' && (
              <Field
                label="Adaptar para outro formato"
                hint="Mantém conteúdo, cores e imagens; aplica dimensões e composição do destino."
              >
                <select
                  value={draft.platformId}
                  onChange={(e) => {
                    const id = e.target.value as Asset['platformId'];
                    if (
                      window.confirm(
                        'Adaptar esta composição? O layout será ajustado; conteúdo e imagens serão preservados. Salve para registrar uma nova versão.',
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
                      {p.name} · {p.width}×{p.height}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {tab === 'content' && (
              <>
                <Field label="Nome do ativo">
                  <input
                    value={draft.name}
                    maxLength={100}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </Field>
                <Field label="Tags" hint="Separe por vírgulas. Até 12 tags.">
                  <input
                    value={tagText}
                    onChange={(e) => {
                      setTagText(e.target.value);
                      setDraft({
                        ...draft,
                        tags: [
                          ...new Set(
                            e.target.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          ),
                        ],
                      });
                    }}
                  />
                </Field>
                <hr />
              </>
            )}
            {tab === 'history' ? (
              <div>
                <p className="muted small">
                  Cada salvamento é uma versão. Restaurar preserva as versões anteriores.
                </p>
                {history.length === 0 ? (
                  <Empty title="Carregando histórico" description="Suas versões aparecerão aqui." />
                ) : (
                  history.map((r) => (
                    <div className="revision" key={r.id}>
                      <History size={18} />
                      <div>
                        <strong>Versão {r.version}</strong>
                        <small>{new Date(r.createdAt).toLocaleString('pt-BR')}</small>
                      </div>
                      <button
                        className="icon-button"
                        title="Restaurar versão"
                        aria-label={`Restaurar versão ${r.version}`}
                        disabled={busy || r.version === saved.version}
                        onClick={() => restore(r)}
                      >
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <DocumentFields
                tab={tab}
                document={draft.document}
                onChange={(document, coalesce) => setDraft({ ...draft, document }, coalesce)}
                media={media}
              />
            )}
          </div>
        </GlassSurface>
      </div>
    </div>
  );
}

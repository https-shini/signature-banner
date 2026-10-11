import { Button } from '../design-system';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  forPlatform,
  platforms,
  systemTemplates,
  type Asset,
  type AssetDocument,
  type Profile,
  type Template,
} from '../../../shared/model';
import { Modal, Field, ErrorNotice } from './ui';
export function NewAsset({
  profile,
  templates,
  onClose,
  onCreate,
  initialTemplate,
}: {
  profile: Profile;
  templates: Template[];
  onClose: () => void;
  onCreate: (input: {
    name: string;
    platformId: Asset['platformId'];
    document: AssetDocument;
  }) => Promise<void>;
  initialTemplate?: Template | (typeof systemTemplates)[number];
}) {
  const [name, setName] = useState(''),
    [platformId, setPlatformId] = useState<Asset['platformId']>(
      initialTemplate?.platformId ?? 'banner',
    ),
    [templateId, setTemplateId] = useState(initialTemplate?.id ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const all = [...systemTemplates, ...templates];
  return (
    <Modal title="Criar um novo ativo" onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const template = all.find((t) => t.id === templateId);
            let document = forPlatform(profile.kit, platformId);
            if (template) {
              document = forPlatform(template.document, platformId);
              if (template.id.startsWith('system-'))
                document = {
                  ...document,
                  content: structuredClone(profile.kit.content),
                  photoId: profile.kit.photoId,
                  logoId: profile.kit.logoId,
                };
            }
            await onCreate({ name, platformId, document });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">
          Uma nova expressão da sua identidade <strong>{profile.name}</strong>.
        </p>
        <Field label="Nome do ativo">
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Capa para meu LinkedIn"
          />
        </Field>
        <Field label="Plataforma e finalidade">
          <select
            value={platformId}
            onChange={(e) => setPlatformId(e.target.value as Asset['platformId'])}
          >
            {platforms.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name} · {p.width}×{p.height}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ponto de partida">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Minha identidade visual</option>
            {all.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id.startsWith('system-') ? ' · Studio' : ' · Meu modelo'}
              </option>
            ))}
          </select>
        </Field>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            <Plus size={17} />
            {busy ? 'Criando…' : 'Criar ativo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function NewProfile({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal title="Um novo contexto" onClose={() => !busy && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onCreate(name, description);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="muted">
          Separe sua identidade pessoal, profissional ou de uma marca. Cada contexto tem seus
          próprios recursos e configurações.
        </p>
        <Field label="Nome do contexto">
          <input
            required
            autoFocus
            maxLength={80}
            placeholder="Ex.: Minha marca"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Descrição">
          <input
            maxLength={200}
            placeholder="Opcional"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <Button variant="secondary" type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={busy || !name.trim()}>
            {busy ? 'Criando…' : 'Criar contexto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

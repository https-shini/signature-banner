import { Button, PageHeading, GlassSurface, BrandMark, StudioFooter } from './design-system';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Bookmark,
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  Grid2X2,
  Image,
  Layers,
  LayoutTemplate,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import {
  defaultDocument,
  platforms,
  systemTemplates,
  type Asset,
  type Backup,
  type Media,
  type Profile,
  type Template,
} from '../../shared/model';
import { portableFile, portableSchema, type Portable } from '../../shared/portable';
import { api, ApiError, download, fileBase64, filename, token } from './api';
import { Busy, Empty, ErrorNotice, Field } from './components/ui';
import { Preview } from './components/Preview';
import { Editor } from './components/Editor';
import { ExportDialog } from './components/ExportDialog';
import { ProfileEditor } from './components/ProfileEditor';
import { TemplateEditor } from './components/TemplateEditor';
import { TemplateLibrary } from './components/TemplateLibrary';
import { MediaLibrary } from './components/MediaLibrary';
import { NewAsset, NewProfile } from './components/CreationDialogs';

type View = 'assets' | 'templates' | 'media' | 'identity' | 'settings';
const initialProfile = () => sessionStorage.getItem('identity-profile') ?? '';
export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [profileId, setProfileId] = useState(initialProfile),
    [assets, setAssets] = useState<Asset[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [media, setMedia] = useState<Media[]>([]),
    [images, setImages] = useState<Record<string, string>>({});
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [view, setViewState] = useState<View>('assets'),
    [identityDirty, setIdentityDirty] = useState(false),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('recent'),
    [favorites, setFavorites] = useState(false),
    [selected, setSelected] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true),
    [initialized, setInitialized] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [newAsset, setNewAsset] = useState(false),
    [newProfile, setNewProfile] = useState(false),
    [exporting, setExporting] = useState<Asset | null>(null),
    [templateChoice, setTemplateChoice] = useState<
      Template | (typeof systemTemplates)[number] | undefined
    >(),
    [login, setLogin] = useState(false),
    [loginToken, setLoginToken] = useState(''),
    [authEpoch, setAuthEpoch] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null),
    generation = useRef(0);
  const profile = profiles.find((p) => p.id === profileId);
  const canLeaveIdentity = () =>
    !identityDirty ||
    window.confirm('Sua identidade tem alterações não salvas. Deseja descartá-las?');
  function setView(next: View) {
    if (next !== view && !canLeaveIdentity()) return;
    setIdentityDirty(false);
    setViewState(next);
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Profile[]>('/profiles')
      .then((p) => {
        if (cancelled) return;
        setProfiles(p);
        setProfileId((current) => (p.some((p) => p.id === current) ? current : (p[0]?.id ?? '')));
        setLogin(false);
        setInitialized(true);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          setLogin(true);
          setError(token.get() ? 'Chave inválida ou expirada.' : '');
        } else setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authEpoch]);
  async function refresh(id = profileId) {
    if (!id) {
      setAssets([]);
      setTemplates([]);
      setMedia([]);
      setImages({});
      return;
    }
    const g = ++generation.current;
    const [a, t, m] = await Promise.all([
      api<Asset[]>(`/assets?profileId=${id}`),
      api<Template[]>(`/templates?profileId=${id}`),
      api<Media[]>(`/media?profileId=${id}`),
    ]);
    const loaded = await Promise.all(
      m.map(async (item) => {
        const image = await api<Media & { data: string }>(`/media/${item.id}`);
        return [item.id, `data:${image.mime};base64,${image.data}`] as const;
      }),
    );
    if (g !== generation.current) return;
    setAssets(a);
    setTemplates(t);
    setMedia(m);
    setImages(Object.fromEntries(loaded));
  }
  useEffect(() => {
    if (!initialized) return;
    let active = true;
    setLoading(true);
    setAssets([]);
    setTemplates([]);
    setMedia([]);
    setImages({});
    sessionStorage.setItem('identity-profile', profileId);
    refresh(profileId)
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [profileId, authEpoch, initialized]);
  useEffect(() => {
    if (notice) {
      const timeout = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(timeout);
    }
  }, [notice]);
  async function perform(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function changed(a: Asset) {
    setAssets((current) => current.map((old) => (old.id === a.id ? a : old)));
    setSelected(a);
  }
  async function projectJson(asset: Asset) {
    const b = await api<Backup>('/backup'),
      p = b.profiles.find((p) => p.id === asset.profileId)!;
    const now = new Date().toISOString(),
      a = { ...asset, version: 1, updatedAt: now };
    const scoped: Backup = {
      ...b,
      profiles: [p],
      assets: [a],
      templates: [],
      media: b.media.filter((m) =>
        [
          p.kit.photoId,
          p.kit.logoId,
          p.kit.backgroundImageId,
          a.document.photoId,
          a.document.logoId,
          a.document.backgroundImageId,
        ].includes(m.id),
      ),
      revisions: [
        { id: crypto.randomUUID(), assetId: a.id, version: 1, snapshot: a, createdAt: now },
      ],
    };
    download(
      new Blob([JSON.stringify(scoped)], { type: 'application/json' }),
      filename(a.name) + '.json',
    );
    setNotice('Projeto exportado com as imagens e configurações.');
  }
  function portableJson(
    source: { name: string; platformId: Asset['platformId']; document: Asset['document'] },
    kind: Portable['kind'],
  ) {
    const file = portableFile(
      source,
      kind,
      media.map((m) => ({
        id: m.id,
        name: m.name,
        mime: 'image/png' as const,
        width: m.width,
        height: m.height,
        data: (images[m.id] ?? '').replace(/^data:image\/png;base64,/, ''),
      })),
    );
    download(
      new Blob([JSON.stringify(file)], { type: 'application/json' }),
      filename(source.name) + '.' + kind + '.json',
    );
    setNotice(
      kind === 'template'
        ? 'Modelo exportado com as imagens.'
        : 'Configuração editável exportada com as imagens.',
    );
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    await perform(async () => {
      if (file.size > 24 * 1024 * 1024)
        throw new Error(
          'O JSON deve ter até 24 MB. Para arquivos maiores, use o backup PostgreSQL descrito na documentação.',
        );
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error(
          'Arquivo JSON inválido. Exporte um projeto, modelo ou configuração compatível.',
        );
      }
      if (data?.type === 'identity-studio-portable') {
        if (!profile) throw new Error('Crie um contexto antes de importar.');
        const file = portableSchema.parse(data);
        const result = await api<{ kind: 'asset' | 'template'; record: Asset | Template }>(
          '/import/portable',
          'POST',
          { profileId: profile.id, file },
        );
        await refresh();
        if (result.kind === 'asset') setSelected(result.record as Asset);
        else setView('templates');
        setNotice('Arquivo editável importado com novas referências de imagem neste contexto.');
      } else if (data?._type === 'signature-banner-config') {
        if (!profile) throw new Error('Crie um contexto para importar a configuração antiga.');
        const a = await api<Asset>('/import/legacy', 'POST', {
          profileId: profile.id,
          name: 'Banner importado',
          config: data,
        });
        await refresh();
        setSelected(a);
        setNotice(
          'Configuração antiga importada. Status e especialidades foram adaptados ao texto; animação, temas alternativos e cor exclusiva do negrito não são transferidos. Confira o layout.',
        );
      } else {
        if (
          !window.confirm(
            'Importar este backup como novos contextos? Seus dados atuais serão preservados.',
          )
        )
          return;
        const result = await api<{ profiles: number; assets: number }>('/import', 'POST', data);
        const p = await api<Profile[]>('/profiles');
        setProfiles(p);
        setProfileId(p[0]?.id ?? '');
        await refresh(p[0]?.id ?? '');
        setNotice(`${result.profiles} contexto(s) e ${result.assets} ativo(s) importados.`);
      }
    });
  }
  async function backup() {
    const data = await api<Backup>('/backup');
    download(
      new Blob([JSON.stringify(data)], { type: 'application/json' }),
      `identity-studio-${new Date().toISOString().slice(0, 10)}.json`,
    );
    setNotice('Backup completo exportado. Guarde-o em um lugar seguro.');
  }
  const visible = assets
    .filter(
      (a) =>
        (filter === 'all' || a.kind === filter) &&
        (!favorites || a.favorite) &&
        `${a.name} ${a.tags.join(' ')} ${a.document.content.name}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'pt-BR')
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const nav = [
    { id: 'assets' as const, label: 'Meus ativos', icon: Grid2X2 },
    { id: 'identity' as const, label: 'Minha identidade', icon: UserRound },
    { id: 'media' as const, label: 'Biblioteca de mídia', icon: Image },
    { id: 'templates' as const, label: 'Modelos', icon: LayoutTemplate },
  ];
  if (login)
    return (
      <main className="login-page">
        <GlassSurface as="div" level="panel" className="surface login-card">
          <BrandMark />
          <h1>Seu espaço, protegido.</h1>
          <p className="muted">
            Informe a chave de acesso configurada para este ambiente. Ela será mantida apenas nesta
            sessão do navegador.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              token.set(loginToken);
              setError('');
              setAuthEpoch((v) => v + 1);
            }}
          >
            <Field label="Chave de acesso">
              <input
                autoFocus
                required
                type="password"
                autoComplete="current-password"
                value={loginToken}
                onChange={(e) => setLoginToken(e.target.value)}
              />
            </Field>
            {error && <ErrorNotice message={error} />}
            <Button variant="primary" className="full">
              Entrar no Studio
            </Button>
          </form>
        </GlassSurface>
      </main>
    );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <GlassSurface as="aside" level="chrome" className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (!selected) setView('assets');
          }}
        >
          <BrandMark />
          <span>
            Identify<span className="brand-studio">studio</span>
          </span>
        </a>
        <div className="workspace-select">
          <span className="workspace-avatar">{profile?.name.slice(0, 1) ?? '+'}</span>
          <div>
            <small>SEU CONTEXTO</small>
            <select
              aria-label="Contexto ativo"
              disabled={!!selected || busy}
              value={profileId}
              onChange={(e) => {
                if (!canLeaveIdentity()) return;
                setIdentityDirty(false);
                setProfileId(e.target.value);
                setError('');
                setSearch('');
              }}
            >
              {profiles.length === 0 && <option value="">Nenhum contexto</option>}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={15} />
        </div>
        <p className="nav-heading">SEU ESPAÇO</p>
        <nav tabIndex={0} aria-label="Navegação do espaço">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={'nav-item ' + (view === id ? 'active' : '')}
              aria-current={view === id ? 'page' : undefined}
              disabled={!!selected}
              onClick={() => {
                setView(id);
                setError('');
              }}
            >
              <Icon size={19} />
              {label}
              {id === 'assets' && <span className="nav-count">{assets.length}</span>}
            </button>
          ))}
        </nav>
        <button
          className="nav-item"
          disabled={!!selected || busy}
          onClick={() => setNewProfile(true)}
        >
          <Plus size={19} />
          Novo contexto
        </button>
        <div className="sidebar-bottom">
          <div className="studio-note">
            <Sparkles size={20} />
            <h3>Sua marca, em harmonia.</h3>
            <p>
              Crie uma vez.
              <br />
              Faça sua presença ir além.
            </p>
            <button onClick={() => !selected && setView('identity')} disabled={!!selected}>
              Conhecer minha identidade <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={'nav-item ' + (view === 'settings' ? 'active' : '')}
            disabled={!!selected}
            onClick={() => setView('settings')}
          >
            <Settings2 size={19} />
            Configurações e backup
          </button>
          <div className="account">
            <div className="account-avatar">
              {profile?.kit.content.name
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('') ?? 'IS'}
            </div>
            <div>
              <strong>{profile?.kit.content.name || 'Meu espaço'}</strong>
              <small>Workspace pessoal</small>
            </div>
            <span className="status-dot" title="Identidade pessoal" />
          </div>
        </div>
      </GlassSurface>
      <div className="main-shell">
        <GlassSurface as="header" level="chrome" className="topbar">
          <div className="breadcrumb">
            <span>Meu workspace</span>
            <span>/</span>
            <strong>
              {selected ? 'Editor' : (nav.find((n) => n.id === view)?.label ?? 'Configurações')}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={14} />
              Espaço pessoal
            </span>
            <span className="top-avatar">{profile?.name.slice(0, 1) ?? 'I'}</span>
          </div>
        </GlassSurface>
        <main id="main-content" className={'main-content ' + (selected ? 'editing' : '')}>
          {error && (
            <div className="global-error">
              <ErrorNotice message={error} />
              <button
                className="icon-button"
                aria-label="Fechar mensagem de erro"
                onClick={() => setError('')}
              >
                <X size={17} />
              </button>
            </div>
          )}
          {loading ? (
            <Busy />
          ) : selected && profile ? (
            <Editor
              key={selected.id}
              asset={selected}
              profile={profile}
              images={images}
              media={media}
              onBack={() => setSelected(null)}
              onSaved={changed}
              onExport={setExporting}
              onTemplate={async (a) => {
                const name = window.prompt('Nome do modelo', a.name);
                if (!name?.trim()) return;
                await api('/templates', 'POST', {
                  profileId: profile.id,
                  name,
                  platformId: a.platformId,
                  document: a.document,
                });
                await refresh();
                setNotice('Modelo salvo para reutilizar neste contexto.');
              }}
            />
          ) : !profile && view !== 'settings' ? (
            <Empty
              title="Sua identidade começa aqui."
              description="Crie seu primeiro contexto para reunir seus ativos visuais."
              action={
                <Button variant="primary" onClick={() => setNewProfile(true)}>
                  <Plus size={17} />
                  Criar contexto
                </Button>
              }
            />
          ) : view === 'assets' ? (
            <>
              <PageHeading
                eyebrow={<>CRIAR. ORGANIZAR. CONECTAR.</>}
                title={
                  <>
                    Minha biblioteca<span className="heading-dot">.</span>
                  </>
                }
                description={<>Sua identidade, pronta para cada novo ponto de contato.</>}
                actions={
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => {
                      setTemplateChoice(undefined);
                      setNewAsset(true);
                    }}
                  >
                    <Plus size={18} />
                    Criar ativo
                  </Button>
                }
              />
              <section className="hero">
                <div>
                  <span className="hero-label">
                    <Sparkles size={14} />
                    UMA IDENTIDADE. INFINITAS POSSIBILIDADES.
                  </span>
                  <h2>
                    Você, em todos
                    <br />
                    os lugares certos.
                  </h2>
                  <p>
                    Transforme sua identidade em uma presença consistente.
                    <br />
                    Do primeiro contato à próxima oportunidade.
                  </p>
                  <button className="hero-link" onClick={() => setView('templates')}>
                    Explorar modelos <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="mini-card mini-dark">
                    <span className="mini-avatar">{profile!.kit.content.name[0]}</span>
                    <div>
                      <b>{profile!.kit.content.name.split(' ').slice(0, 2).join(' ')}</b>
                      <small>{profile!.kit.content.role}</small>
                      <i />
                      <i />
                    </div>
                    <span className="mini-qr">▦</span>
                  </div>
                  <div className="mini-card mini-light">
                    <span>in</span>
                    <div>
                      <b>Sua próxima conexão.</b>
                      <small>Uma presença que é sua.</small>
                    </div>
                    <ArrowUpRight size={20} />
                  </div>
                  <div className="sparkle s1">✦</div>
                  <div className="sparkle s2">✧</div>
                  <div className="floating-label">
                    <span className="status-dot" /> Feito para conectar
                  </div>
                </div>
              </section>
              <div className="metrics">
                <div>
                  <span className="metric-icon purple">
                    <Layers size={19} />
                  </span>
                  <div>
                    <strong>{assets.length}</strong>
                    <span>ativos neste contexto</span>
                  </div>
                </div>
                <div>
                  <span className="metric-icon peach">
                    <Star size={19} />
                  </span>
                  <div>
                    <strong>{assets.filter((a) => a.favorite).length}</strong>
                    <span>ativos favoritos</span>
                  </div>
                </div>
                <div>
                  <span className="metric-icon green">
                    <Bookmark size={19} />
                  </span>
                  <div>
                    <strong>{templates.length}</strong>
                    <span>modelos personalizados</span>
                  </div>
                </div>
                <button onClick={() => setNewProfile(true)}>
                  <span className="metric-icon blue">
                    <FolderOpen size={19} />
                  </span>
                  <div>
                    <strong>{profiles.length}</strong>
                    <span>
                      {profiles.length === 1 ? 'contexto de identidade' : 'contextos de identidade'}
                    </span>
                  </div>
                  <Plus size={16} />
                </button>
              </div>
              <section className="asset-section">
                <div className="section-heading">
                  <h2>
                    Seus ativos <span>{visible.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={15} />
                    Importar projeto
                  </button>
                </div>
                <div className="asset-toolbar">
                  <div className="filter-tabs" aria-label="Categorias">
                    {[
                      ['all', 'Todos'],
                      ['banner', 'Banners'],
                      ['signature', 'Assinaturas'],
                      ['avatar', 'Fotos de perfil'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={filter === value}
                        className={filter === value ? 'active' : ''}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-search">
                    <Search size={16} />
                    <input
                      aria-label="Buscar ativos"
                      placeholder="Buscar ativos…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    aria-label="Mostrar favoritos"
                    aria-pressed={favorites}
                    className={'icon-button favorite-filter ' + (favorites ? 'is-favorite' : '')}
                    onClick={() => setFavorites(!favorites)}
                  >
                    <Star size={18} />
                  </button>
                  <select
                    aria-label="Ordenar ativos"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="name">Nome · A–Z</option>
                  </select>
                </div>
                <div className="asset-grid">
                  {visible.map((a) => {
                    const p = platforms.find((p) => p.id === a.platformId)!;
                    return (
                      <GlassSurface as="article" level="panel" className="asset-card" key={a.id}>
                        <button
                          className={'card-preview ' + (a.kind === 'avatar' ? 'card-avatar' : '')}
                          onClick={() => setSelected(a)}
                          aria-label={`Editar ${a.name}`}
                        >
                          <Preview document={a.document} images={images} />
                          <span className="preview-open">
                            Abrir no editor <ArrowUpRight size={14} />
                          </span>
                        </button>
                        <div className="card-body">
                          <div className="card-title-row">
                            <h3>
                              <button onClick={() => setSelected(a)}>{a.name}</button>
                            </h3>
                            <button
                              className={
                                'icon-button star-button ' + (a.favorite ? 'is-favorite' : '')
                              }
                              aria-label={`${a.favorite ? 'Desfavoritar' : 'Favoritar'} ${a.name}`}
                              disabled={busy}
                              onClick={() =>
                                perform(async () => {
                                  const updated = await api<Asset>(`/assets/${a.id}`, 'PUT', {
                                    name: a.name,
                                    platformId: a.platformId,
                                    document: a.document,
                                    tags: a.tags,
                                    favorite: !a.favorite,
                                    version: a.version,
                                  });
                                  setAssets((current) =>
                                    current.map((old) => (old.id === a.id ? updated : old)),
                                  );
                                })
                              }
                            >
                              <Star size={16} fill={a.favorite ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                          <div className="card-meta">
                            <span className={'platform-symbol ' + a.platformId}>
                              {a.platformId === 'linkedin'
                                ? 'in'
                                : a.platformId === 'signature'
                                  ? '@'
                                  : a.platformId === 'avatar'
                                    ? '◉'
                                    : '↗'}
                            </span>
                            <span>{p.channel}</span>
                            <span className="meta-dot">·</span>
                            <span>
                              {a.document.width} × {a.document.height}
                            </span>
                          </div>
                          <div className="card-tags">
                            {a.tags.slice(0, 3).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <div className="card-footer">
                            <span>
                              v{a.version} ·{' '}
                              {new Date(a.updatedAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <div>
                              <button
                                className="icon-button"
                                aria-label={`Duplicar ${a.name}`}
                                title="Duplicar"
                                disabled={busy}
                                onClick={() =>
                                  perform(async () => {
                                    const copied = await api<Asset>(
                                      `/assets/${a.id}/duplicate`,
                                      'POST',
                                    );
                                    setAssets((current) => [copied, ...current]);
                                    setNotice('Ativo duplicado.');
                                  })
                                }
                              >
                                <Copy size={15} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Exportar ${a.name}`}
                                title="Exportar"
                                onClick={() => setExporting(a)}
                              >
                                <Download size={15} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Excluir ${a.name}`}
                                title="Excluir"
                                disabled={busy}
                                onClick={() => {
                                  if (window.confirm(`Excluir “${a.name}” e todo o seu histórico?`))
                                    perform(async () => {
                                      await api(`/assets/${a.id}`, 'DELETE');
                                      setAssets((current) =>
                                        current.filter((old) => old.id !== a.id),
                                      );
                                      setNotice('Ativo excluído.');
                                    });
                                }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </GlassSurface>
                    );
                  })}
                  <button
                    className="new-asset-card"
                    onClick={() => {
                      setTemplateChoice(undefined);
                      setNewAsset(true);
                    }}
                  >
                    <span>
                      <Plus size={25} />
                    </span>
                    <strong>Uma nova possibilidade</strong>
                    <p>
                      Crie um ativo para o seu
                      <br />
                      próximo ponto de contato.
                    </p>
                    <small>
                      Criar ativo <ArrowUpRight size={14} />
                    </small>
                  </button>
                </div>
                {visible.length === 0 && (
                  <Empty
                    title={
                      search || favorites
                        ? 'Nenhum ativo encontrado.'
                        : 'Seu próximo ativo começa aqui.'
                    }
                    description="Crie um ativo ou ajuste os filtros para encontrar o que procura."
                  />
                )}
              </section>
            </>
          ) : view === 'identity' ? (
            <ProfileEditor
              onDirtyChange={setIdentityDirty}
              key={profile!.id}
              profile={profile!}
              images={images}
              media={media}
              onSaved={(p) => {
                setProfiles((current) => current.map((old) => (old.id === p.id ? p : old)));
                setNotice('Identidade atualizada.');
              }}
              onDelete={() =>
                perform(async () => {
                  await api(`/profiles/${profile!.id}`, 'DELETE');
                  const p = await api<Profile[]>('/profiles');
                  setProfiles(p);
                  setProfileId(p[0]?.id ?? '');
                  setNotice('Contexto excluído.');
                })
              }
            />
          ) : view === 'templates' ? (
            <TemplateLibrary
              profile={profile!}
              images={images}
              templates={templates}
              busy={busy}
              onExport={(t) => perform(async () => portableJson(t, 'template'))}
              onEdit={setEditingTemplate}
              onImport={() => importRef.current?.click()}
              onUse={(t) => {
                setTemplateChoice(t);
                setNewAsset(true);
              }}
              onDuplicate={(t) =>
                perform(async () => {
                  await api(`/templates/${t.id}/duplicate`, 'POST');
                  await refresh();
                  setNotice('Modelo duplicado.');
                })
              }
              onRename={(t) => {
                const name = window.prompt('Nome do modelo', t.name);
                if (name?.trim())
                  perform(async () => {
                    await api(`/templates/${t.id}`, 'PUT', {
                      name,
                      platformId: t.platformId,
                      document: t.document,
                    });
                    await refresh();
                  });
              }}
              onDelete={(t) => {
                if (window.confirm(`Excluir o modelo “${t.name}”?`))
                  perform(async () => {
                    await api(`/templates/${t.id}`, 'DELETE');
                    await refresh();
                  });
              }}
            />
          ) : view === 'media' ? (
            <MediaLibrary
              media={media}
              images={images}
              busy={busy}
              onUpload={() => uploadRef.current?.click()}
              onDelete={(m) => {
                if (
                  window.confirm(
                    `Excluir a imagem “${m.name}”? Imagens usadas por ativos ou histórico são protegidas.`,
                  )
                )
                  perform(async () => {
                    await api(`/media/${m.id}`, 'DELETE');
                    await refresh();
                  });
              }}
            />
          ) : (
            <>
              <PageHeading
                eyebrow={<>SEU ESPAÇO, SEUS DADOS</>}
                title={<>Configurações e backup</>}
                description={<>Mantenha sua identidade segura e leve seus projetos com você.</>}
              />
              <div className="settings-grid">
                <GlassSurface as="section" level="panel" className="surface settings-card">
                  <span className="metric-icon purple">
                    <Download size={23} />
                  </span>
                  <h2>Uma cópia de tudo.</h2>
                  <p>
                    Exporte todos os contextos, ativos, imagens, modelos e versões em um único
                    arquivo JSON. Guarde uma cópia antes de excluir dados.
                  </p>
                  <Button variant="primary" disabled={busy} onClick={() => perform(backup)}>
                    <ArrowDownToLine size={17} />
                    Exportar backup completo
                  </Button>
                </GlassSurface>
                <GlassSurface as="section" level="panel" className="surface settings-card">
                  <span className="metric-icon green">
                    <Upload size={23} />
                  </span>
                  <h2>Continue de onde parou.</h2>
                  <p>
                    Importe um backup ou projeto como novos contextos, preservando os atuais.
                    Configurações v3 do antigo Signature Banner são importadas no contexto ativo.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => importRef.current?.click()}
                  >
                    <Upload size={17} />
                    Importar JSON
                  </Button>
                </GlassSurface>
                <GlassSurface as="section" level="panel" className="surface settings-card">
                  <span className="metric-icon blue">
                    <FolderOpen size={23} />
                  </span>
                  <h2>Um espaço para cada identidade.</h2>
                  <p>
                    Separe marcas, projetos e contextos profissionais. Fotos e modelos
                    personalizados ficam vinculados ao contexto em que foram criados.
                  </p>
                  <Button variant="secondary" disabled={busy} onClick={() => setNewProfile(true)}>
                    <Plus size={17} />
                    Criar novo contexto
                  </Button>
                </GlassSurface>
                <GlassSurface as="section" level="panel" className="surface settings-card">
                  <span className="metric-icon peach">
                    <ShieldCheck size={23} />
                  </span>
                  <h2>Privacidade por padrão.</h2>
                  <p>
                    Seus dados ficam no servidor deste ambiente. Não há analytics nem fontes
                    externas. A biblioteca aceita imagens estáticas e rejeita SVGs enviados.
                  </p>
                  {token.get() && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        token.clear();
                        setLoginToken('');
                        setLogin(true);
                      }}
                    >
                      Encerrar sessão
                    </Button>
                  )}
                  <small>
                    Backups JSON de até 24 MB. Para bibliotecas maiores, use o backup PostgreSQL da
                    documentação.
                  </small>
                </GlassSurface>
              </div>
            </>
          )}
          <StudioFooter />
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
        </div>
      )}
      {newAsset && profile && (
        <NewAsset
          profile={profile}
          templates={templates}
          initialTemplate={templateChoice}
          onClose={() => setNewAsset(false)}
          onCreate={async (input) => {
            const a = await api<Asset>('/assets', 'POST', {
              ...input,
              profileId: profile.id,
              tags: [],
              favorite: false,
            });
            setAssets((current) => [a, ...current]);
            setSelected(a);
            setNewAsset(false);
            setView('assets');
            setNotice('Novo ativo criado. Faça dele algo seu.');
          }}
        />
      )}
      {newProfile && (
        <NewProfile
          onClose={() => setNewProfile(false)}
          onCreate={async (name, description) => {
            if (!canLeaveIdentity())
              throw new Error('Salve sua identidade antes de criar um novo contexto.');
            setIdentityDirty(false);
            const kit = structuredClone(defaultDocument);
            kit.content = {
              name,
              role: '',
              company: '',
              eyebrow: '',
              tagline: '',
              email: '',
              site: '',
              qrUrl: '',
            };
            const p = await api<Profile>('/profiles', 'POST', { name, description, kit });
            setProfiles((current) => [p, ...current]);
            setProfileId(p.id);
            setView('identity');
            setNewProfile(false);
            setNotice('Novo contexto criado.');
          }}
        />
      )}
      {editingTemplate && (
        <TemplateEditor
          key={editingTemplate.id}
          template={editingTemplate}
          media={media}
          images={images}
          onClose={() => setEditingTemplate(null)}
          onSaved={(t) => {
            setTemplates((current) => current.map((old) => (old.id === t.id ? t : old)));
            setNotice('Modelo atualizado.');
          }}
        />
      )}
      {exporting && (
        <ExportDialog
          key={exporting.id}
          asset={exporting}
          images={images}
          onClose={() => setExporting(null)}
          onJson={projectJson}
          onConfiguration={(a) => portableJson(a, 'configuration')}
        />
      )}
      <input
        hidden
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && profile)
            perform(async () => {
              const data = await fileBase64(file);
              await api('/media', 'POST', {
                profileId: profile.id,
                name: file.name.slice(0, 100),
                data,
              });
              await refresh();
              setNotice('Imagem adicionada à biblioteca.');
            });
        }}
      />
      <input
        hidden
        ref={importRef}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          importFile(file);
        }}
      />
    </div>
  );
}

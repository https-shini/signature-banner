import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import type { AuthConfiguration, Project, Workspace } from '../../../shared/saas';
import App from '../App';
import type { Asset } from '../../../shared/model';
import { api, configureSession, setApiContext } from '../api';
import { BrandMark, Button, GlassSurface, PageHeading, StudioFooter } from '../design-system';
import { Busy, Empty, ErrorNotice, Field, Modal } from '../components/ui';
import './saas.css';
import { authClient, recoveryPending, finishRecovery, initializeAccess } from './auth-client';
function message(error: { message: string }) {
  if (/invalid login credentials/i.test(error.message)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(error.message)) return 'Confirme seu e-mail para entrar.';
  if (/rate limit|too many/i.test(error.message))
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  return 'Não foi possível concluir. Verifique seus dados e tente novamente.';
}
export default function WorkspaceApplication({
  config,
}: {
  config: Extract<AuthConfiguration, { mode: 'saas' }>;
}) {
  const [client] = useState(() => authClient(config));
  const [authError, setAuthError] = useState('');
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [reset, setReset] = useState(false),
    [expired, setExpired] = useState(false);
  const signOut = useCallback(() => {
    setApiContext();
    void client.auth.signOut({ scope: 'local' }).finally(() => {
      setSession(null);
      setReset(false);
    });
  }, [client]);
  useEffect(() => {
    let active = true,
      initialized = false,
      callbackRejected = false;
    configureSession(
      async () => {
        const { data, error } = await client.auth.getSession();
        if (error) return undefined;
        return data.session?.access_token;
      },
      () => {
        setExpired(true);
        signOut();
      },
    );
    const { data } = client.auth.onAuthStateChange((event, current) => {
      if (!active || !initialized || (callbackRejected && event === 'INITIAL_SESSION')) return;
      setSession(current);
      setReady(true);
      if (event === 'PASSWORD_RECOVERY' || recoveryPending(client)) setReset(true);
    });
    initializeAccess(client).then(async ({ error }) => {
      if (!active) return;
      if (error) {
        setAuthError('O link de acesso é inválido ou expirou. Solicite um novo link.');
        callbackRejected = true;
        initialized = true;
        setExpired(true);
        setReset(false);
        setSession(null);
        setReady(true);
        return;
      }
      const result = await client.auth.getSession();
      if (!active) return;
      initialized = true;
      if (result.error) setExpired(true);
      setSession(result.data.session);
      setReset(recoveryPending(client));
      setReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, signOut]);
  if (!ready)
    return (
      <main className="login-page">
        <Busy />
      </main>
    );
  if (!session || reset || authError)
    return (
      <AccessScreen
        client={client}
        reset={reset && !!session && !authError}
        callbackError={authError}
        expired={expired}
        onCompleted={() => {
          setAuthError('');
          finishRecovery(client);
          setReset(false);
          setExpired(false);
        }}
        onCancel={signOut}
      />
    );
  return (
    <WorkspaceHome key={session.user.id} session={session} client={client} onSignOut={signOut} />
  );
}
function AccessScreen({
  client,
  reset,
  expired,
  callbackError,
  onCompleted,
  onCancel,
}: {
  client: SupabaseClient;
  reset: boolean;
  expired: boolean;
  callbackError?: string;
  onCompleted: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const heading = reset
    ? 'Crie uma nova senha.'
    : mode === 'signup'
      ? 'Seu próximo projeto começa aqui.'
      : mode === 'recovery'
        ? 'Recupere seu acesso.'
        : 'Seu espaço de trabalho, protegido.';
  const action = reset
    ? 'Salvar nova senha'
    : mode === 'signup'
      ? 'Criar minha conta'
      : mode === 'recovery'
        ? 'Enviar link de recuperação'
        : 'Entrar na plataforma';
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if ((reset || mode === 'signup') && password !== confirmation) {
      setError('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    try {
      if (reset) {
        const r = await client.auth.updateUser({ password });
        if (r.error) throw r.error;
        onCompleted();
      } else if (mode === 'signup') {
        const r = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: location.origin + '/auth/callback' },
        });
        if (r.error) throw r.error;
        if (!r.data.session) setNotice('Confira seu e-mail para confirmar sua conta e entrar.');
        else onCompleted();
      } else if (mode === 'recovery') {
        const r = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: location.origin + '/auth/callback?intent=recovery',
        });
        if (r.error) throw r.error;
        setNotice('Se houver uma conta com este e-mail, você receberá um link de recuperação.');
      } else {
        const r = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (r.error) throw r.error;
        onCompleted();
      }
    } catch (e) {
      setError(message(e as Error));
    } finally {
      setBusy(false);
    }
  }
  function change(next: typeof mode) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setError('');
    setNotice('');
  }
  return (
    <main className="login-page saas-access">
      <GlassSurface as="section" level="panel" className="surface login-card saas-access-card">
        <BrandMark />
        <p className="saas-eyebrow">IDENTIFY · SEU ESTÚDIO CRIATIVO</p>
        <h1>{heading}</h1>
        <p className="muted">
          {reset
            ? 'Escolha uma senha com pelo menos 12 caracteres.'
            : mode === 'recovery'
              ? 'Enviaremos um link para redefinir sua senha com segurança.'
              : 'Acesse sua conta para gerenciar seus projetos, ambientes e identidades visuais em um único lugar.'}
        </p>
        {expired && mode === 'login' && (
          <p role="status">Sua sessão expirou. Entre novamente para continuar.</p>
        )}
        {callbackError && <ErrorNotice message={callbackError} />}
        <form
          onSubmit={submit}
          aria-label={
            reset
              ? 'Redefinir senha'
              : mode === 'signup'
                ? 'Cadastro'
                : mode === 'recovery'
                  ? 'Recuperação de senha'
                  : 'Login'
          }
        >
          {!reset && (
            <Field label="E-mail">
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </Field>
          )}
          {(reset || mode !== 'recovery') && (
            <Field
              label={reset ? 'Nova senha' : 'Senha'}
              hint={reset || mode === 'signup' ? 'Use pelo menos 12 caracteres.' : undefined}
            >
              <input
                type="password"
                minLength={reset || mode === 'signup' ? 12 : 1}
                maxLength={128}
                required
                autoComplete={reset || mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
            </Field>
          )}
          {(reset || mode === 'signup') && (
            <Field label="Confirmar senha">
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={busy}
              />
            </Field>
          )}
          {error && <ErrorNotice message={error} />}{' '}
          {notice && (
            <p className="saas-status" role="status">
              {notice}
            </p>
          )}
          <Button variant="primary" className="full" disabled={busy}>
            {busy ? 'Aguarde…' : action}
            <ArrowRight size={17} />
          </Button>
        </form>
        <nav className="saas-auth-actions" aria-label="Opções de acesso">
          {reset ? (
            <Button variant="subtle" disabled={busy} onClick={onCancel}>
              Encerrar sessão
            </Button>
          ) : (
            <>
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() => change(mode === 'login' ? 'signup' : 'login')}
              >
                {mode === 'login' ? 'Criar conta' : 'Voltar para o login'}
              </Button>
              {mode !== 'recovery' && (
                <Button variant="subtle" disabled={busy} onClick={() => change('recovery')}>
                  Recuperar senha
                </Button>
              )}
            </>
          )}
        </nav>
        <p className="saas-security-note">
          <ShieldCheck size={16} />
          Materiais privados, acesso individual.
        </p>
      </GlassSurface>
    </main>
  );
}
function WorkspaceHome({
  session,
  client,
  onSignOut,
}: {
  session: Session;
  client: SupabaseClient;
  onSignOut: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [workspaceId, setWorkspaceId] = useState(''),
    [projectId, setProjectId] = useState(''),
    [loading, setLoading] = useState(true),
    [projectsLoading, setProjectsLoading] = useState(false),
    [error, setError] = useState(''),
    [studio, setStudio] = useState(false),
    [account, setAccount] = useState(false);
  const [editing, setEditing] = useState<{
      kind: 'workspace' | 'project';
      item?: Workspace | Project;
    } | null>(null),
    [refresh, setRefresh] = useState(0);
  const [recent, setRecent] = useState<Asset[]>([]),
    [recentLoading, setRecentLoading] = useState(false),
    [initialAsset, setInitialAsset] = useState<Asset>();
  const dirty = useRef(false),
    generation = useRef(0);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const leave = () =>
    !dirty.current ||
    window.confirm('Há alterações não salvas. Deseja descartá-las antes de trocar de espaço?');
  const dashboard = () => {
    if (leave()) {
      setStudio(false);
      dirty.current = false;
    }
  };
  const workspace = workspaces.find((w) => w.id === workspaceId),
    project = projects.find((p) => p.id === projectId);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<Workspace[]>('/workspaces')
      .then((items) => {
        if (!active) return;
        setWorkspaces(items);
        setWorkspaceId((current) =>
          items.some((w) => w.id === current)
            ? current
            : (items.find(
                (w) => w.id === localStorage.getItem('identify-workspace:' + session.user.id),
              )?.id ??
              items[0]?.id ??
              ''),
        );
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.user.id, refresh]);
  useEffect(() => {
    const version = ++generation.current;
    setProjects([]);
    setProjectId('');
    setApiContext(workspaceId || undefined);
    setProjectsLoading(!!workspaceId);
    if (!workspaceId) return;
    localStorage.setItem('identify-workspace:' + session.user.id, workspaceId);
    api<Project[]>('/projects')
      .then((items) => {
        if (version !== generation.current) return;
        setProjects(items);
        const selected =
          items.find((p) => p.id === localStorage.getItem('identify-project:' + workspaceId))?.id ??
          items[0]?.id ??
          '';
        setApiContext(workspaceId, selected || undefined);
        setProjectId(selected);
      })
      .catch((e) => {
        if (version === generation.current) setError(e.message);
      })
      .finally(() => {
        if (version === generation.current) setProjectsLoading(false);
      });
    return () => {
      generation.current++;
    };
  }, [workspaceId, session.user.id, refresh]);
  useEffect(() => {
    let active = true;
    setRecent([]);
    if (studio || !project || project.workspaceId !== workspaceId) {
      setRecentLoading(false);
      return;
    }
    setRecentLoading(true);
    api<Asset[]>('/assets')
      .then((items) => {
        if (active) setRecent(items.slice(0, 4));
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setRecentLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, studio, projects]);
  async function openRecent(id: string) {
    setError('');
    try {
      const asset = await api<Asset>('/assets/' + id);
      setInitialAsset(asset);
      setStudio(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function selectWorkspace(id: string) {
    if (!leave()) return;
    setStudio(false);
    dirty.current = false;
    setApiContext(id);
    setWorkspaceId(id);
    setError('');
  }
  function selectProject(id: string) {
    if (!leave()) return;
    dirty.current = false;
    setInitialAsset(undefined);
    setApiContext(workspaceId, id);
    setProjectId(id);
    localStorage.setItem('identify-project:' + workspaceId, id);
    setError('');
  }
  async function saved(name: string, description: string) {
    if (!editing) return;
    const endpoint = editing.kind === 'workspace' ? '/workspaces' : '/projects';
    const result = await api<Workspace | Project>(
      endpoint + (editing.item ? '/' + editing.item.id : ''),
      editing.item ? 'PUT' : 'POST',
      { name, description },
    );
    if (editing.kind === 'workspace') {
      setWorkspaces((items) =>
        editing.item
          ? items.map((w) => (w.id === result.id ? (result as Workspace) : w))
          : [...items, result as Workspace],
      );
      if (!editing.item) selectWorkspace(result.id);
    } else {
      setProjects((items) =>
        editing.item
          ? items.map((p) => (p.id === result.id ? (result as Project) : p))
          : [...items, result as Project],
      );
      if (!editing.item) selectProject(result.id);
    }
    setEditing(null);
  }
  const openEditing = (kind: 'workspace' | 'project', item?: Workspace | Project) => {
    if (leave()) {
      setStudio(false);
      dirty.current = false;
      setEditing({ kind, item });
    }
  };
  return (
    <div className="saas-shell">
      <GlassSurface as="header" level="chrome" className="saas-context-bar">
        <Button variant="subtle" onClick={dashboard} aria-label="Dashboard">
          <BrandMark />
          <span>Identify</span>
        </Button>
        <div className="saas-context-selectors">
          <Field label="Workspace ativo">
            <select
              value={workspaceId}
              disabled={loading || !workspaces.length}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {!workspaces.length && <option value="">Crie seu workspace</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Projeto ativo">
            <select
              value={projectId}
              disabled={projectsLoading || !projects.length}
              onChange={(e) => selectProject(e.target.value)}
            >
              {!projects.length && <option value="">Crie seu projeto</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="saas-context-actions">
          <Button
            variant="subtle"
            onClick={() => {
              if (leave()) setAccount(true);
            }}
          >
            <Settings2 size={17} />
            Minha conta
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              if (leave()) onSignOut();
            }}
          >
            <LogOut size={17} />
            Sair
          </Button>
        </div>
      </GlassSurface>
      {studio && workspace && project ? (
        <App
          key={workspaceId + ':' + projectId}
          initialAsset={initialAsset}
          accountEmail={session.user.email}
          onSignOut={onSignOut}
          onDashboard={dashboard}
          onDirtyChange={onDirty}
        />
      ) : (
        <main className="saas-dashboard" id="workspace-dashboard">
          <PageHeading
            eyebrow="SEU ESPAÇO CRIATIVO"
            title="Tudo começa no seu workspace."
            description="Organize suas identidades e projetos. Crie assinaturas, banners e fotos com as mesmas ferramentas."
          />
          {error && (
            <>
              <ErrorNotice message={error} />
              <Button
                onClick={() => {
                  setApiContext();
                  setRefresh((n) => n + 1);
                }}
              >
                Tentar novamente
              </Button>
            </>
          )}
          {loading ? (
            <Busy />
          ) : (
            <>
              <section aria-labelledby="workspaces-title">
                <div className="section-heading">
                  <h2 id="workspaces-title">Seus workspaces</h2>
                  <Button variant="secondary" onClick={() => openEditing('workspace')}>
                    <Plus size={17} />
                    Novo workspace
                  </Button>
                </div>
                {!workspaces.length ? (
                  <Empty
                    title="Um espaço que é seu."
                    description="Crie seu primeiro workspace; em seguida, organize um projeto e preencha sua identidade."
                    action={
                      <Button variant="primary" onClick={() => openEditing('workspace')}>
                        Criar primeiro workspace
                      </Button>
                    }
                  />
                ) : (
                  <div className="saas-grid">
                    {workspaces.map((w) => (
                      <GlassSurface
                        as="article"
                        level="panel"
                        className={
                          'surface saas-card ' + (w.id === workspaceId ? 'saas-selected' : '')
                        }
                        key={w.id}
                      >
                        <FolderOpen size={25} />
                        <h3>{w.name}</h3>
                        <p>{w.description || 'Sua identidade, seus projetos e seus materiais.'}</p>
                        <small>Proprietário</small>
                        <div className="saas-card-actions">
                          <Button
                            variant={w.id === workspaceId ? 'subtle' : 'primary'}
                            onClick={() => selectWorkspace(w.id)}
                            aria-pressed={w.id === workspaceId}
                          >
                            {w.id === workspaceId ? 'Workspace ativo' : 'Selecionar workspace'}
                          </Button>
                          <Button
                            variant="subtle"
                            onClick={() => openEditing('workspace', w)}
                            aria-label={'Editar workspace ' + w.name}
                          >
                            Editar
                          </Button>
                        </div>
                      </GlassSurface>
                    ))}
                  </div>
                )}
              </section>
              {workspace && (
                <section aria-labelledby="projects-title">
                  <div className="section-heading">
                    <h2 id="projects-title">Projetos · {workspace.name}</h2>
                    <Button variant="secondary" onClick={() => openEditing('project')}>
                      <Plus size={17} />
                      Novo projeto
                    </Button>
                  </div>
                  {projectsLoading ? (
                    <Busy />
                  ) : !projects.length ? (
                    <Empty
                      title="Dê forma à sua próxima ideia."
                      description="Crie um projeto para reunir materiais. As identidades e a biblioteca de imagens são compartilhadas dentro deste workspace."
                      action={
                        <Button variant="primary" onClick={() => openEditing('project')}>
                          Criar primeiro projeto
                        </Button>
                      }
                    />
                  ) : (
                    <div className="saas-grid">
                      {projects.map((p) => (
                        <GlassSurface
                          as="article"
                          level="panel"
                          className="surface saas-card"
                          key={p.id}
                        >
                          <LayoutDashboard size={25} />
                          <h3>{p.name}</h3>
                          <p>
                            {p.description ||
                              'Assinaturas, capas e fotos, reunidas no mesmo projeto.'}
                          </p>
                          <div className="saas-card-actions">
                            <Button
                              variant="primary"
                              onClick={() => {
                                selectProject(p.id);
                                setStudio(true);
                              }}
                            >
                              Abrir projeto
                              <ArrowRight size={17} />
                            </Button>
                            <Button
                              variant="subtle"
                              onClick={() => openEditing('project', p)}
                              aria-label={'Editar projeto ' + p.name}
                            >
                              Editar
                            </Button>
                          </div>
                        </GlassSurface>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {project && (
            <section aria-labelledby="recent-materials-title">
              <div className="section-heading">
                <h2 id="recent-materials-title">Continue de onde parou · {project.name}</h2>
              </div>
              {recentLoading ? (
                <Busy />
              ) : recent.length ? (
                <div className="saas-grid">
                  {recent.map((asset) => (
                    <GlassSurface
                      key={asset.id}
                      as="article"
                      level="panel"
                      className="surface saas-card"
                    >
                      <h3>{asset.name}</h3>
                      <p>
                        Versão {asset.version} ·{' '}
                        {new Date(asset.updatedAt).toLocaleDateString('pt-BR')}
                      </p>
                      <Button variant="secondary" onClick={() => void openRecent(asset.id)}>
                        Continuar edição
                        <ArrowRight size={17} />
                      </Button>
                    </GlassSurface>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Seu projeto ainda não tem materiais. Abra o projeto e escolha uma ferramenta para
                  começar.
                </p>
              )}
            </section>
          )}
          <StudioFooter />
        </main>
      )}
      {editing && (
        <ResourceDialog
          kind={editing.kind}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSave={saved}
        />
      )}
      {account && (
        <AccountDialog
          client={client}
          email={session.user.email ?? ''}
          onClose={() => setAccount(false)}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
}
function ResourceDialog({
  kind,
  item,
  onClose,
  onSave,
}: {
  kind: 'workspace' | 'project';
  item?: Workspace | Project;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? ''),
    [description, setDescription] = useState(item?.description ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title={(item ? 'Editar ' : 'Novo ') + (kind === 'project' ? 'projeto' : 'workspace')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          try {
            await onSave(name, description);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label={kind === 'workspace' ? 'Nome do workspace' : 'Nome do projeto'}>
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label="Descrição">
          <textarea
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </Field>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <Button type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={busy}>
            {busy
              ? 'Salvando…'
              : item
                ? 'Salvar alterações'
                : 'Criar ' + (kind === 'project' ? 'projeto' : 'workspace')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function AccountDialog({
  client,
  email,
  onClose,
  onSignOut,
}: {
  client: SupabaseClient;
  email: string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  return (
    <Modal
      title="Minha conta"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">{email}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setError('');
          setNotice('');
          if (password !== confirmation) {
            setError('As senhas precisam ser iguais.');
            return;
          }
          setBusy(true);
          try {
            const r = await client.auth.updateUser({ password });
            if (r.error) throw r.error;
            setPassword('');
            setConfirmation('');
            setNotice('Senha atualizada.');
          } catch (e) {
            setError(message(e as Error));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nova senha" hint="Pelo menos 12 caracteres.">
          <input
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label="Confirmar senha">
          <input
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
          />
        </Field>
        {error && <ErrorNotice message={error} />} {notice && <p role="status">{notice}</p>}
        <div className="modal-actions">
          <Button type="button" onClick={onSignOut} disabled={busy}>
            Encerrar sessão
          </Button>
          <Button variant="primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Atualizar senha'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

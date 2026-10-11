import { lazy, Suspense, useEffect, useState } from 'react';
import type { AuthConfiguration } from '../../../shared/saas';
import App from '../App';
import { Busy, ErrorNotice } from '../components/ui';
import { Button, GlassSurface } from '../design-system';
const WorkspaceApplication = lazy(() => import('./WorkspaceApplication'));
export function ApplicationRoot() {
  const [config, setConfig] = useState<AuthConfiguration>(),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/config', { signal: controller.signal, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Não foi possível verificar o acesso deste ambiente.');
        const value = await r.json();
        if (!['personal', 'saas'].includes(value.mode))
          throw new Error('Configuração de acesso inválida.');
        setConfig(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  if (error)
    return (
      <main className="login-page">
        <GlassSurface level="panel" as="div" className="surface login-card">
          <h1>Não foi possível conectar.</h1>
          <ErrorNotice message={error} />
          <Button
            onClick={() => {
              setError('');
              setAttempt((x) => x + 1);
            }}
          >
            Tentar novamente
          </Button>
        </GlassSurface>
      </main>
    );
  if (!config)
    return (
      <main className="login-page">
        <Busy />
      </main>
    );
  if (config.mode === 'personal') return <App />;
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <Busy />
        </main>
      }
    >
      <WorkspaceApplication config={config} />
    </Suspense>
  );
}

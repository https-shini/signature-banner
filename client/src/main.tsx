import { Button, GlassSurface } from './design-system';
import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApplicationRoot } from './saas/ApplicationRoot';
import './design-system/tokens.css';
import './styles.css';
import './design-system/materials.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="login-page">
        <GlassSurface as="div" level="panel" className="surface login-card">
          <h1>Não foi possível abrir o Studio.</h1>
          <p>Recarregue a página para tentar novamente. Os dados salvos permanecem no servidor.</p>
          <Button variant="primary" onClick={() => location.reload()}>
            Recarregar
          </Button>
        </GlassSurface>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ApplicationRoot />
    </ErrorBoundary>
  </StrictMode>,
);

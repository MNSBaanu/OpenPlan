import { Component, StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import OP from './core';
import App from './App';
import Landing from './views/Landing';
import DialogHost from './components/Dialogs';
import { Toast } from './components/Chrome';
import { useStore } from './store';
import { handleLaunchFiles } from './lib/actions';
import './styles.css';

const W = window as any;

function Root() {
  const [inApp, setInApp] = useState(location.hash === '#app');
  const theme = useStore(s => s.theme);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => {
    const onHash = () => { setInApp(location.hash === '#app'); W.goatcounter?.count?.(); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return <>
    {inApp ? <App /> : <Landing />}
    <DialogHost />
    <Toast />
  </>;
}

// Shows recovery options instead of a blank page when rendering fails.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    const resetView = () => { try { localStorage.removeItem('openplan.ui'); } catch { /* storage unavailable */ } location.reload(); };
    const backup = () => {
      let text = '';
      try { text = localStorage.getItem('openplan.project') || ''; } catch { /* storage unavailable */ }
      if (text) OP.util.download('openplan-backup.openplan', text, 'application/x-openplan');
    };
    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p>OpenPlan hit an error: {this.state.error.message}</p>
        <p>Your project is still saved in this browser. Download a backup copy, then reset the view settings and reload.</p>
        <div className="crash-actions">
          <button className="btn" onClick={backup}>Download project backup</button>
          <button className="btn primary" onClick={resetView}>Reset view settings</button>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>
);
handleLaunchFiles();

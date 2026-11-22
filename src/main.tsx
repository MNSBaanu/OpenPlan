import { Component, StrictMode, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import OP from './core';
import DialogHost from './components/Dialogs';
import { Toast } from './components/Toast';
import { useStore, S, ask } from './store';
import { handleLaunchFiles } from './lib/actions';
import { openCollabLink, resumeSession } from './collab/boot';
import { SHARE_PREFIX, decodePlan } from './lib/share';
import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-sans-3/wght-italic.css';
import './styles.css';

const THEME_COLORS = { light: '#faf8f3', dark: '#171612' } as const;

const W = window as any;

// Opens a plan carried in a share link, after asking, and removes the plan data from the address bar.
async function openSharedPlan() {
  if (!location.hash.startsWith(SHARE_PREFIX)) return;
  const data = location.hash.slice(SHARE_PREFIX.length);
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const p = await decodePlan(data);
    ask('Open a copy of the shared plan “' + p.name + '”? Your current plan can be restored from File › Open › Restore Previous Project.', () => {
      S().replaceProject(p, 'Shared plan opened');
      location.hash = 'app';
    }, 'Open plan');
  } catch {
    S().toast('This share link is incomplete or damaged. Ask for the link again, or for the .openplan file.', true);
  }
}
// After a new version is deployed, an open tab may ask for a file that no longer exists.
// Reload once to pick up the new version instead of showing the error screen.
function loadChunk<T>(load: () => Promise<T>) {
  return () => load().then(mod => {
    try { sessionStorage.removeItem('openplan.chunk-reload'); } catch { /* storage unavailable */ }
    return mod;
  }, err => {
    let tried = true;
    try { tried = !!sessionStorage.getItem('openplan.chunk-reload'); sessionStorage.setItem('openplan.chunk-reload', '1'); } catch { /* storage unavailable */ }
    if (tried) throw err;
    location.reload();
    return new Promise<T>(() => { /* wait for the reload */ });
  });
}
const importApp = () => import('./App');
const App = lazy(loadChunk(importApp));
const Landing = lazy(loadChunk(() => import('./views/Landing')));

function Root() {
  const [inApp, setInApp] = useState(location.hash === '#app');
  const theme = useStore(s => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);
  useEffect(() => {
    const onHash = () => { openSharedPlan(); openCollabLink(); setInApp(location.hash === '#app'); W.goatcounter?.count?.(); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Fetch the planner in the background so "Open the app" is instant.
  useEffect(() => { if (!inApp) { const t = setTimeout(() => { importApp().catch(() => { /* retried when the app is opened */ }); }, 1500); return () => clearTimeout(t); } }, [inApp]);
  return <>
    <Suspense fallback={null}>{inApp ? <App /> : <Landing />}</Suspense>
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
openSharedPlan();
openCollabLink();
resumeSession();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ }); });
}

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
handleLaunchFiles();

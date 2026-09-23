import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Landing from './views/Landing';
import DialogHost from './components/Dialogs';
import { Toast } from './components/Chrome';
import { useStore } from './store';
import { handleLaunchFiles } from './lib/actions';
import './styles.css';

const GOATCOUNTER = import.meta.env.VITE_GOATCOUNTER;
const W = window as any;
if (GOATCOUNTER) {
  W.goatcounter = { path: () => (location.hash === '#app' ? '/app' : '/') };
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.dataset.goatcounter = 'https://' + GOATCOUNTER + '.goatcounter.com/count';
  document.head.appendChild(s);
}

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

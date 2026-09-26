import { useEffect } from 'react';
import { useStore } from '../store';

export function Toast() {
  const msg = useStore(s => s.toastMsg);
  const setUI = useStore(s => s.setUI);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setUI({ toastMsg: null }), msg.err ? 4200 : 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return <div className={'toast' + (msg ? ' show' : '') + (msg && msg.err ? ' err' : '')} role="status" aria-live="polite">{msg ? msg.text : ''}</div>;
}

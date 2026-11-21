import { COLLAB_URL, ID_PATTERN, SESSION_KEY } from './config';
import { S, ask } from '../store';

// Live sessions load their code (Yjs and the connection) only when they are used.

export function resumeSession() {
  if (!COLLAB_URL) return;
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (saved && ID_PATTERN.test(saved.room) && typeof saved.key === 'string') import('./session').then(m => m.joinSession(saved.room, saved.key, 'rejoin'));
  } catch { /* storage unavailable */ }
}

// An invite link looks like #collab=ROOM.KEY. The key stays in the address bar only; it is never sent to a server.
export function openCollabLink() {
  if (!location.hash.startsWith('#collab=')) return;
  const [room, key] = location.hash.slice('#collab='.length).split('.');
  history.replaceState(null, '', location.pathname + location.search);
  if (!COLLAB_URL) { S().toast('Live sessions are not available on this site.', true); return; }
  if (!ID_PATTERN.test(room || '') || !key) { S().toast('This invite link is incomplete or damaged. Ask for it again.', true); return; }
  ask('Join this live session? Your current plan is kept: you can bring it back from File › Open › Restore Previous Project.', async () => {
    const m = await import('./session');
    await m.joinSession(room, key, 'join');
    location.hash = 'app';
  }, 'Join session', 'Join live session');
}

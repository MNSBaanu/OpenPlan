// The address of the live-session relay (see collab-server/). Without it, live sessions are hidden.
// Set VITE_COLLAB_URL when building, for example wss://openplan-collab.your-name.workers.dev
export const COLLAB_URL = String(import.meta.env.VITE_COLLAB_URL || '').trim().replace(/\/+$/, '');
export const SESSION_KEY = 'openplan.collab';
export const ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export type CollabStatus = 'off' | 'connecting' | 'live' | 'offline';
export interface CollabInfo { status: CollabStatus; peers: number; link: string }
export const COLLAB_OFF: CollabInfo = { status: 'off', peers: 0, link: '' };

export type CollabStatus = 'off' | 'connecting' | 'live' | 'offline';
import type { Person } from './presence';
export interface CollabInfo { status: CollabStatus; peers: number; link: string; people: Person[]; me: Person | null }
export const COLLAB_OFF: CollabInfo = { status: 'off', peers: 0, link: '', people: [], me: null };

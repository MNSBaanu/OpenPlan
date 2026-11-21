// End-to-end encryption for live sessions. The key lives in the invite link after "#", which browsers
// never send to a server, so the relay only ever sees scrambled bytes.

export function toB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function randomId(bytes = 16): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const newKeyText = () => randomId(32);

export async function importKey(text: string): Promise<CryptoKey> {
  const raw = fromB64(text);
  if (raw.length !== 32) throw new Error('Bad session key');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// Output is base64url of: 12-byte random IV followed by the ciphertext.
export async function seal(key: CryptoKey, data: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return toB64(out);
}

export async function open(key: CryptoKey, text: string): Promise<Uint8Array> {
  const all = fromB64(text);
  if (all.length < 29) throw new Error('Message too short');
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) as BufferSource }, key, all.subarray(12) as BufferSource));
}

import OP from '../core';
import type { Project } from '../types';

// A share link carries the whole plan, compressed, after "#plan=". It never reaches a server:
// the part of a URL after "#" is not sent with requests.
export const SHARE_PREFIX = '#plan=';

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export async function encodePlan(p: Project) {
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(p)), new CompressionStream('deflate-raw')));
}

export async function decodePlan(data: string): Promise<Project> {
  const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
  return OP.io.fromJSON(new TextDecoder().decode(bytes));
}

export async function shareUrl(p: Project) {
  return location.origin + location.pathname + SHARE_PREFIX + await encodePlan(p);
}

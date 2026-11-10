import { createHash } from 'node:crypto';

// BYTEA contains only this opaque reference; object bytes live in a private bucket.
const prefix = 'ANIVAYA_OBJECT_V1:';
export const objectReference = (schema: string, value: Uint8Array) => Buffer.from(prefix + `${schema}/${createHash('sha256').update(value).digest('hex')}`);
export const objectKey = (value: Uint8Array) => {
  const text = Buffer.from(value).toString('utf8');
  return /^ANIVAYA_OBJECT_V1:[a-z0-9_]+\/[a-f0-9]{64}$/.test(text) ? text.slice(prefix.length) : null;
};
export function objectStorage() {
  const base = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'anivaya-private';
  if (!base || !secret) throw new Error('Supabase private storage configuration is missing.');
  const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
  const request = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${base}/storage/v1/${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Private storage request failed (${response.status}).`);
    return response;
  };
  return {
    async verify() {
      const info = await (await request(`bucket/${encodeURIComponent(bucket)}`)).json() as { public?: boolean };
      if (info.public !== false) throw new Error('Anivaya storage bucket must be private.');
    },
    async put(schema: string, value: Uint8Array) {
      const bytes = Buffer.from(value);
      const reference = objectReference(schema, value);
      const key = objectKey(reference)!;
      await request(`object/${bucket}/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }, body: bytes });
      return reference;
    },
    async get(key: string) {
      return Buffer.from(await (await request(`object/authenticated/${bucket}/${key}`)).arrayBuffer());
    },
    async remove(keys: string[]) {
      if (keys.length) await request(`object/${bucket}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: keys }) });
    },
  };
}

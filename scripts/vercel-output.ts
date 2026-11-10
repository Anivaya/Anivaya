import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function vercelConfig(apiUrl: string, proxySecret: string) {
  const api = new URL(apiUrl);
  if (api.protocol !== 'https:' || !api.hostname.endsWith('.onrender.com') || api.pathname !== '/' || api.port || api.username || api.password || api.search || api.hash)
    throw new Error('RENDER_API_URL must be your HTTPS onrender.com origin.');
  if (!/^[a-f0-9]{64}$/i.test(proxySecret)) throw new Error('API_PROXY_SECRET must match the 64-character secret on Render.');
  return {
    version: 3,
    routes: [
      { src: '/api/internal/(.*)', status: 404 },
      { src: '/api/(.*)', dest: `${api.origin}/api/$1`, headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' }, transforms: [
        { type: 'request.headers', op: 'set', target: { key: 'x-anivaya-proxy' }, args: proxySecret },
      ] },
      { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" }, continue: true },
      { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
    ],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = vercelConfig(process.env.RENDER_API_URL || '', process.env.API_PROXY_SECRET || '');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = resolve(root, '.vercel/output');
  mkdirSync(output, { recursive: true });
  cpSync(resolve(root, 'front/dist'), resolve(output, 'static'), { recursive: true });
  // This is platform routing metadata, never a file in the public static directory.
  writeFileSync(resolve(output, 'config.json'), JSON.stringify(config, null, 2));
  console.log('Vercel static output and private API proxy prepared.');
}

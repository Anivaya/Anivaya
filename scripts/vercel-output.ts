import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function vercelConfig(apiUrl: string, proxySecret: string, preview = false) {
  const api = new URL(apiUrl);
  if (api.protocol !== 'https:' || !api.hostname.endsWith('.onrender.com') || api.pathname !== '/' || api.port || api.username || api.password || api.search || api.hash)
    throw new Error('RENDER_API_URL must be your HTTPS onrender.com origin.');
  if (!/^[a-f0-9]{64}$/i.test(proxySecret)) throw new Error('API_PROXY_SECRET must match the 64-character secret on Render.');
  return deploymentConfig(`${api.origin}/api/$1`, preview, proxySecret);
}

function deploymentConfig(destination: string, preview: boolean, proxySecret?: string) {
  // Only authenticated document responses may be embedded by our own frontend.
  const filePath = 'api/(?:(?:documents|received-shares)/[^/]+/file|admin/pros/[^/]+/documents/[^/]+/file)';
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  const csp = "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";
  return {
    version: 3,
    routes: [
      ...(preview ? [{ src: '/(.*)', headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' }, continue: true }] : []),
      { src: '/api/internal/(.*)', status: 404 },
      { src: `/${filePath}$`, headers: { ...securityHeaders, 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': `${csp}; frame-ancestors 'self'` }, continue: true },
      { src: `/(?!${filePath}$)(.*)`, headers: { ...securityHeaders, 'X-Frame-Options': 'DENY', 'Content-Security-Policy': `${csp}; frame-ancestors 'none'` }, continue: true },
      { src: '/api/(.*)', dest: destination, headers: { 'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' }, transforms: proxySecret ? [
        { type: 'request.headers', op: 'set', target: { key: 'x-anivaya-proxy' }, args: proxySecret },
      ] : undefined },
      { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
    ],
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const isolated = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_GIT_COMMIT_REF === 'release/public-site-cleanup';
  const preview = isolated || process.env.VITE_TESTING_PREVIEW === '1';
  const config = isolated ? deploymentConfig('/review-api?__path=$1', true)
    : vercelConfig(process.env.RENDER_API_URL || '', process.env.API_PROXY_SECRET || '', preview);
  const root = fileURLToPath(new URL('..', import.meta.url));
  const output = resolve(root, '.vercel/output');
  mkdirSync(output, { recursive: true });
  if (isolated) {
    const { buildReviewFunction } = await import('./vercel-review.ts');
    buildReviewFunction(root, output);
  }
  cpSync(resolve(root, 'front/dist'), resolve(output, 'static'), { recursive: true });
  if (preview) writeFileSync(resolve(output, 'static/robots.txt'), 'User-agent: *\nDisallow: /\n');
  // This is platform routing metadata, never a file in the public static directory.
  writeFileSync(resolve(output, 'config.json'), JSON.stringify(config, null, 2));
  console.log('Vercel static output and private API proxy prepared.');
}

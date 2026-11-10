import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function secretMatches(value: unknown, secret: string | undefined) {
  if (typeof value !== 'string' || !secret) return false;
  const a = Buffer.from(value), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const trustedVercelProxy = (req: IncomingMessage) =>
  secretMatches(req.headers['x-anivaya-proxy'], process.env.API_PROXY_SECRET);

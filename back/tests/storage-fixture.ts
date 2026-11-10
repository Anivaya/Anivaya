// Isolated HTTP double for the Supabase Storage contract; never deployed.
import { createServer } from 'node:http';
import { parentPort } from 'node:worker_threads';
const objects = new Map<string, Buffer>();
const server = createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer local-storage-fixture') { res.writeHead(401).end(); return; }
  const path = req.url || '';
  if (path === '/storage/v1/bucket/anivaya-private') { res.setHeader('Content-Type','application/json'); res.end('{"public":false}'); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const key = path.replace('/storage/v1/object/authenticated/anivaya-private/', '').replace('/storage/v1/object/anivaya-private/', '');
  if (req.method === 'POST') { objects.set(key, Buffer.concat(chunks)); res.end('{}'); }
  else if (req.method === 'DELETE') {
    for (const k of JSON.parse(Buffer.concat(chunks).toString()).prefixes) objects.delete(k);
    res.end('[]');
  } else if (objects.has(key)) res.end(objects.get(key));
  else res.writeHead(404).end('{}');
});
server.listen(0, '127.0.0.1', () => parentPort!.postMessage((server.address() as {port:number}).port));

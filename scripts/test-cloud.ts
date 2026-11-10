import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { testEnvironment } from './test-environment.ts';
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database.');
const fixture = new Worker(new URL('../back/tests/storage-fixture.ts', import.meta.url));
try {
  const [port] = await once(fixture, 'message');
  for (const args of [['--test', '--test-name-pattern=Production:', 'back/tests/production.test.ts'], ['--test', 'back/tests/cloud.integration.ts'], ['--test', 'back/tests/preview-demo.test.ts']]) {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit', env: { ...testEnvironment(), DATABASE_URL: process.env.TEST_DATABASE_URL, DATABASE_SSL: 'disable', DATABASE_SCHEMA: 'check_' + Date.now(), SUPABASE_URL: `http://127.0.0.1:${port}`, SUPABASE_SERVICE_ROLE_KEY: 'local-storage-fixture', SUPABASE_STORAGE_BUCKET: 'anivaya-private' },
    });
    const [code] = await once(child, 'exit');
    if (code !== 0) { process.exitCode = code || 1; break; }
  }
} finally { await fixture.terminate(); }

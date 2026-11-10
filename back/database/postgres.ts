import { Worker, MessageChannel, receiveMessageOnPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import type { Database } from './types.ts';

/** One bounded I/O worker preserves the synchronous repository/transaction API.
 * No local replica or write-behind cache: success means PostgreSQL committed.
 * Intended for the current single-instance, small-traffic application. */
let bridge: ReturnType<typeof createBridge> | undefined;
function createBridge() {
  const { port1, port2 } = new MessageChannel();
  const worker = new Worker(new URL('./postgres-worker.ts', import.meta.url), { workerData: { port: port2 }, transferList: [port2] });
  worker.unref();
  port1.unref();
  let broken = false;
  worker.on('error', () => { broken = true; });
  return {
    call(operation: string, schema: string, sql = '', params: unknown[] = []): any {
      if (broken) throw new Error('PostgreSQL worker unavailable; restart the service.');
      const signal = new Int32Array(new SharedArrayBuffer(4));
      port1.postMessage({ operation, schema, sql, params, signal });
      if (Atomics.wait(signal, 0, 0, 45_000) === 'timed-out') {
        broken = true;
        void worker.terminate();
        // Never reuse a connection after an indeterminate write/commit.
        throw new Error('PostgreSQL operation timed out; restart the service before retrying.');
      }
      const reply = receiveMessageOnPort(port1)?.message;
      if (!reply) throw new Error('Missing PostgreSQL worker response.');
      if (reply.error) throw Object.assign(new Error(reply.error.message), { code: reply.error.code });
      return reply.value;
    },
  };
}
export function databaseSchema(workspace?: string) {
  const prefix = process.env.DATABASE_SCHEMA || 'anivaya';
  if (!/^[a-z][a-z0-9_]{0,24}$/.test(prefix)) throw new Error('Invalid DATABASE_SCHEMA.');
  return workspace ? `${prefix}_u_${createHash('sha256').update(workspace).digest('hex').slice(0,32)}` : prefix;
}
export function postgresCall(operation: string, schema: string, sql = '', params: unknown[] = []) {
  return (bridge ??= createBridge()).call(operation, schema, sql, params);
}
export function openPostgres(workspace?: string): Database {
  const schema = databaseSchema(workspace);
  postgresCall('open', schema);
  let closed = false;
  const call = (operation: string, sql = '', params: unknown[] = []) => {
    if (closed) throw new Error('Database connection is closed.');
    return postgresCall(operation, schema, sql, params);
  };
  return {
    exec(sql: string) { call('exec', sql); },
    prepare(sql: string) {
      return {
        get(...params: unknown[]) { return call('query', sql, params).rows[0]; },
        all(...params: unknown[]) { return call('query', sql, params).rows; },
        run(...params: unknown[]) { const result = call('query', sql, params); return { changes: result.count, lastInsertRowid: 0 }; },
      };
    },
    close() { if (!closed) { call('close'); closed = true; } },
  } as unknown as Database;
}
export function dropPostgresWorkspace(workspace: string) {
  postgresCall('drop', databaseSchema(workspace));
}

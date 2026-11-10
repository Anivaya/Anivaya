import { workerData } from 'node:worker_threads';
import type { MessagePort } from 'node:worker_threads';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { PoolClient } from 'pg';
import { postgresSql } from './postgres-sql.ts';
import { objectKey, objectReference, objectStorage } from './object-storage.ts';

const port = workerData.port as MessagePort;
pg.types.setTypeParser(20, value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds safe range.');
  return n;
});
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000,
  statement_timeout: 20_000, idle_in_transaction_session_timeout: 30_000,
  ssl: process.env.DATABASE_SSL === 'disable' ? false : {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_PATH ? { ca: readFileSync(process.env.DATABASE_CA_PATH, 'utf8') } : {}),
  },
});
pool.on('error', () => console.error('PostgreSQL idle connection lost.'));
const transactions = new Map<string, PoolClient>();
const initialized = new Set<string>();
let storage: ReturnType<typeof objectStorage> | undefined;
async function files() {
  if (!storage) { const candidate = objectStorage(); await candidate.verify(); storage = candidate; }
  return storage;
}
async function scoped(client: PoolClient, schema: string) {
  await client.query("SELECT set_config('search_path',$1,true)", [schema + ',pg_catalog']);
}
async function open(schema: string) {
  if (initialized.has(schema)) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['init:' + schema]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`REVOKE ALL ON SCHEMA "${schema}" FROM PUBLIC`);
    await scoped(client, schema);
    await client.query(`CREATE OR REPLACE FUNCTION json_valid(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT value::jsonb IS NOT NULL $$;
      CREATE OR REPLACE FUNCTION json_extract(value text,path text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT value::jsonb #>> string_to_array(substr(path,3),'.') $$;
      CREATE OR REPLACE FUNCTION json_set(value text,VARIADIC pairs text[]) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$ DECLARE result jsonb := value::jsonb; i integer; BEGIN FOR i IN 1..array_length(pairs,1) BY 2 LOOP result := jsonb_set(result,string_to_array(replace(substr(pairs[i],3),'[0]','.0'),'.'),to_jsonb(pairs[i+1]),true); END LOOP; RETURN result::text; END $$;
      CREATE TABLE IF NOT EXISTS _objects(key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());`);
    await client.query('COMMIT');
    initialized.add(schema);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  await files();
}
async function query(client: PoolClient, schema: string, source: string, params: unknown[]) {
  const sql = postgresSql(source);
  if (!sql.trim()) return { rows: [], count: 0 };
  const values = [];
  for (const value of params) {
    if (value instanceof Uint8Array) {
      const reference = objectReference(schema, value);
      // Separate committed registry survives rollback, allowing later orphan cleanup.
      await pool.query(`INSERT INTO "${schema}"._objects(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET created_at=now()`, [objectKey(reference)]);
      await (await files()).put(schema, value);
      values.push(reference);
    } else values.push(value instanceof Uint8Array ? Buffer.from(value) : value);
  }
  const result = await client.query(sql, values.length ? values : undefined);
  const results = Array.isArray(result) ? result : [result];
  // The schema is not exposed through PostgREST; RLS adds defence in depth.
  if (/CREATE TABLE/i.test(source)) {
    const tables = await client.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema]);
    for (const { tablename } of tables.rows) await client.query(`ALTER TABLE "${schema}"."${tablename}" ENABLE ROW LEVEL SECURITY`);
  }
  const last = results.at(-1);
  const rows = last?.rows || [];
  for (const row of rows) {
    delete row._rowid;
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Uint8Array) {
        const reference = objectKey(value);
        if (reference) row[key] = await (await files()).get(reference);
      }
    }
  }
  return { rows, count: last?.rowCount ?? 0 };
}
async function execute(operation: string, schema: string, sql: string, params: unknown[]) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid schema.');
  if (operation === 'open') return open(schema);
  if (operation === 'close') {
    const existing = transactions.get(schema);
    if (existing) { transactions.delete(schema); try { await existing.query('ROLLBACK'); } finally { existing.release(); } }
    return;
  }
  if (operation === 'drop') {
    if (!/_u_[a-f0-9]{32}$/.test(schema)) throw new Error('Only account schemas can be removed.');
    // Deletion retries are safe; object registry is retained until bytes are removed.
    const exists = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
    if (!exists.rowCount) return;
    const objects = await pool.query(`SELECT key FROM "${schema}"._objects`);
    for (let i = 0; i < objects.rows.length; i += 100) await (await files()).remove(objects.rows.slice(i, i + 100).map(r => r.key));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    initialized.delete(schema);
    return;
  }
  if (operation === 'gc') {
    const referenced = new Set<string>();
    const columns = await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 AND data_type='bytea'", [schema]);
    for (const { table_name, column_name } of columns.rows) {
      const values = await pool.query(`SELECT DISTINCT "${column_name}" AS value FROM "${schema}"."${table_name}" WHERE "${column_name}" IS NOT NULL`);
      for (const { value } of values.rows) { const key = objectKey(value); if (key) referenced.add(key); }
    }
    // Caller must stop API writes; an age grace period also protects recent uploads.
    const candidates = await pool.query(`SELECT key FROM "${schema}"._objects WHERE created_at < now() - interval '24 hours'`);
    const keys = candidates.rows.map(r => r.key as string).filter(key => !referenced.has(key));
    for (let i = 0; i < keys.length; i += 100) {
      const batch = keys.slice(i, i + 100);
      await (await files()).remove(batch);
      await pool.query(`DELETE FROM "${schema}"._objects WHERE key=ANY($1::text[])`, [batch]);
    }
    return keys.length;
  }
  if (/^BEGIN(?: IMMEDIATE)?\s*;?$/i.test(sql.trim())) {
    if (transactions.has(schema)) throw new Error('Nested transaction is not supported.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await scoped(client, schema);
      if (/IMMEDIATE/i.test(sql)) await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [schema]);
      transactions.set(schema, client);
    } catch (error) { client.release(true); throw error; }
    return;
  }
  const existing = transactions.get(schema);
  if (/^(COMMIT|ROLLBACK)\s*;?$/i.test(sql.trim())) {
    if (!existing) throw new Error('No transaction is active.');
    transactions.delete(schema);
    try { await existing.query(sql); } finally { existing.release(); }
    return;
  }
  if (existing) return query(existing, schema, sql, params);
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await scoped(client, schema);
    const result = await query(client, schema, sql, params);
    await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
port.on('message', async ({ operation, schema, sql, params, signal }) => {
  try { port.postMessage({ value: await execute(operation, schema, sql, params) }); }
  catch (error) {
    // PostgreSQL detail/SQL/parameters may contain account data; never propagate them.
    const e = error as { code?: string; message?: string };
    port.postMessage({ error: { code: e.code, message: e.code ? `PostgreSQL operation failed (${e.code}).` : e.message || 'Storage operation failed.' } });
  } finally { Atomics.store(signal, 0, 1); Atomics.notify(signal, 0); }
});

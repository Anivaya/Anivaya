import assert from 'node:assert/strict';
import { openDatabase } from '../database/connection.ts';
import { authentication } from '../api/auth.ts';
import { createRepository } from '../api/repository.ts';
import type { IncomingMessage } from 'node:http';
const db = openDatabase();
const auth = authentication(db);
try {
  await auth.ready;
  const account = auth.current({headers:{cookie:process.env.TEST_COOKIE}} as IncomingMessage);
  assert.equal(account?.id,process.env.TEST_ACCOUNT);
  assert.match(Buffer.from(createRepository(auth.workspace(account!)).file(process.env.TEST_DOCUMENT!).content).toString(),/Cloud private document/);
  console.log('Cloud process restart passed.');
} finally { auth.close(); db.close(); }

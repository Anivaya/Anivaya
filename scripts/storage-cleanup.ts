import { openDatabase } from '../back/database/connection.ts';
import { databaseSchema, postgresCall } from '../back/database/postgres.ts';
if (!process.env.DATABASE_URL || !process.argv.includes('--offline')) throw new Error('Stop API writes, then run with DATABASE_URL and --offline.');
const db = openDatabase();
try {
  const accounts = db.prepare('SELECT workspace FROM accounts').all<{workspace:string}>();
  let count = 0;
  for (const schema of [databaseSchema(), ...accounts.map(a => databaseSchema(a.workspace))]) count += postgresCall('gc', schema);
  console.log(`Removed ${count} unreferenced objects older than 24 hours.`);
} finally { db.close(); }

import { readdir, readFile } from 'node:fs/promises';
import { pool } from '../server/db.js';
// A transaction must stay on one checked-out connection from BEGIN through COMMIT.
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Serialize migration runners for this database; PostgreSQL releases this lock
  // automatically when the transaction commits or rolls back.
  await client.query('SELECT pg_advisory_xact_lock(3121201)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  // Resolve relative to this script, then apply numbered SQL files in name order.
  // Applied files are skipped; future changes belong in a new migration file.
  const directory = new URL('../database/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
    const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (rowCount) continue;
    await client.query(await readFile(new URL(name, directory), 'utf8'));
    // Record success in the same transaction as the schema change.
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    console.log(`Applied ${name}`);
  }
  await client.query('COMMIT');
  console.log('Migrations complete');
} catch (error) {
  // A failed migration leaves neither partial schema changes nor history entries.
  await client.query('ROLLBACK');
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }

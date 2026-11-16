import 'dotenv/config';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

// Options let regression tests use isolated roles/databases and a temporary directory.
// The command-line entry point always uses the application's standard names.
export async function setupDatabase({ adminConfig, directory=process.cwd(), roleName='dashboard_app', databaseName='social_dashboard' }) {
  const admin = new pg.Client({ ...adminConfig, database: 'postgres', connectionTimeoutMillis: 5000 });
  const roleSQL = pg.escapeIdentifier(roleName);
  const databaseSQL = pg.escapeIdentifier(databaseName);
  const envPath = join(directory, '.env');
  let connectionURL;
  let configText;
  try {
    await admin.connect();
    const { rows: [database] } = await admin.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1', [databaseName]);
    if (database && database.owner !== roleName) {
      throw new Error(`Database ${databaseName} belongs to ${database.owner}. An administrator must review ownership before running ALTER DATABASE ${databaseSQL} OWNER TO ${roleSQL}; no ownership was changed.`);
    }
    const { rowCount: roleExists } = await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [roleName]);
    if (!roleExists) {
      const password = randomBytes(24).toString('hex');
      const url = new URL('postgresql://localhost');
      url.hostname = adminConfig.host || 'localhost';
      url.port = String(adminConfig.port || 5432);
      url.username = roleName;
      url.password = password;
      url.pathname = '/' + databaseName;
      connectionURL = url.toString();
      configText = `PORT=3001\nDATABASE_URL=${connectionURL}\nFRONTEND_ORIGIN=http://localhost:5173\nDEMO_PASSWORD=DemoDashboard312!\n`;
      // Persist credentials BEFORE PostgreSQL changes. A later CREATE DATABASE or
      // .env failure can be retried without losing the role's generated password.
      const recoveryName = `.env.database-created.${randomUUID()}`;
      await writeFile(join(directory, recoveryName), configText, { flag: 'wx', mode: 0o600 });
      console.log(`Private recovery configuration saved in ${recoveryName}`);
      await admin.query(`CREATE ROLE ${roleSQL} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${pg.escapeLiteral(password)}`);
    } else {
      // Prefer .env, then try saved bootstrap configurations. Never reset an
      // existing role's password automatically: another app may already use it.
      const candidates = ['.env', ...(await readdir(directory)).filter(name => name.startsWith('.env.database-created')).sort()];
      for (const name of candidates) {
        let candidate;
        let text;
        try {
          text = await readFile(join(directory, name), 'utf8');
          candidate = new URL(dotenv.parse(text).DATABASE_URL);
        } catch { continue; }
        if (decodeURIComponent(candidate.username) !== roleName || decodeURIComponent(candidate.pathname.slice(1)) !== databaseName || candidate.hostname !== (adminConfig.host || 'localhost') || (candidate.port || '5432') !== String(adminConfig.port || 5432)) continue;
        const probeURL = new URL(candidate);
        probeURL.pathname = '/postgres';
        const probe = new pg.Client({ connectionString: probeURL.toString(), connectionTimeoutMillis: 5000 });
        try {
          await probe.connect();
          connectionURL = candidate.toString(); configText = text;
          break;
        } catch { /* A stale recovery file must not prevent trying another one. */ }
        finally { await probe.end(); }
      }
      if (!connectionURL) throw new Error(`Existing role ${roleName} has no usable local configuration. Supply its current password in .env; if lost, reset it explicitly as postgres using the psql password command for ${roleName}, then update .env. No password was changed.`);
    }
    // CREATE DATABASE cannot run inside a transaction. The recovery configuration
    // above remains available if database creation fails after role creation.
    if (!database) await admin.query(`CREATE DATABASE ${databaseSQL} OWNER ${roleSQL}`);
    try { await writeFile(envPath, configText, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = dotenv.parse(await readFile(envPath, 'utf8')).DATABASE_URL;
      if (existing !== connectionURL) throw new Error('Existing .env was preserved but points to a different connection. Reconcile DATABASE_URL using the saved .env.database-created.* file and retry.');
    }
    const app = new pg.Client({ connectionString: connectionURL, connectionTimeoutMillis: 5000 });
    try {
      await app.connect();
      const { rows: [access] } = await app.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create");
      if (!access.can_create) throw new Error('Application role cannot create tables in public; an administrator must review schema permissions.');
    } finally { await app.end(); }
    console.log('Application connection verified. Run npm run db:migrate and npm run db:seed.');
  } finally { await admin.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    let password = process.env.POSTGRES_ADMIN_PASSWORD;
    if (!password) {
      try { password = dotenv.parse(await readFile('.postgres-admin.env')).POSTGRES_ADMIN_PASSWORD; }
      catch { throw new Error('Set POSTGRES_ADMIN_PASSWORD to your local postgres administrator password'); }
    }
    await setupDatabase({ adminConfig: { host: process.env.PGHOST || 'localhost', port: Number(process.env.PGPORT || 5432), user: 'postgres', password } });
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  }
}

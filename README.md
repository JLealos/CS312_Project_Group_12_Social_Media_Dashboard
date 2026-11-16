# Group 12 Social Media Dashboard - Phase 1 backend

React / Express / PostgreSQL group project. Jack Lealos maintains the backend; Nathanial Jarrett's React screens are still to be added. All platform activity and metrics are **sample data**, not connected social accounts. Scheduled records save a planned time only; nothing is published.

## Windows quick start

Prerequisites: Node.js 20+ with npm, Windows PowerShell, WinGet, PostgreSQL 17. Run commands from this repository root. No global Node packages are needed.

```powershell
npm ci
Get-Service *postgres* -ErrorAction SilentlyContinue
Get-Command psql -ErrorAction SilentlyContinue
```

If PostgreSQL is absent, use the supplied installer script. It uses the official EDB package through WinGet, installs the server and command-line tools, and creates a Windows service. Windows may show an administrator/UAC prompt. A random administrator password is stored in the ignored local `.postgres-admin.env`; keep that file private. Installation can take a few minutes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-postgres.ps1
Get-Service postgresql-x64-17
& 'C:\Program Files\PostgreSQL\17\bin\pg_isready.exe' -h localhost -p 5432
```

If an existing service is stopped, run `Start-Service postgresql-x64-17` in an administrator PowerShell. Adapt the service name/path for other installed versions. The script does not change an existing installation's password. PostgreSQL's official Windows installer is also available at https://www.postgresql.org/download/windows/.

Create a dedicated non-superuser role `dashboard_app` and database `social_dashboard`:

```powershell
npm run db:setup
npm run db:migrate
npm run db:seed
npm start
```

`db:setup` uses the administrator credential file, creates missing role/database objects, and verifies an application connection and schema privileges before reporting success. Express connects as `dashboard_app`, never `postgres`. Before creating a role, setup writes a uniquely named ignored `.env.database-created.<id>` recovery file; if database creation fails, a retry can recover its password. Existing roles never have their passwords reset automatically. Existing `.env` is preserved; if it points elsewhere, reconcile it using the recovery file and rerun setup. PGHOST/PGPORT select the bootstrap host/port and are reflected in generated configuration. The default is localhost:5432.

For PostgreSQL installed separately, supply your existing administrator password through a masked prompt, then run setup:

```powershell
$dashboardCredential = Get-Credential -UserName postgres -Message 'Local PostgreSQL administrator password'
$env:POSTGRES_ADMIN_PASSWORD = $dashboardCredential.GetNetworkCredential().Password
npm run db:setup
Remove-Item Env:\POSTGRES_ADMIN_PASSWORD
```

If the role already existed, setup tries saved recovery configurations when `.env` is missing. If no usable configuration exists, copy `.env.example` to `.env` and set its actual password. URL-encode special password characters in DATABASE_URL. Do not commit local configuration. The generated application password contains only hexadecimal characters.

API: http://localhost:3001/api/health. Demo login: `demo@example.com` / `DemoDashboard312!` (local seeded demonstration only). Set DEMO_PASSWORD before the first seed to choose another demo password; repeating seeds intentionally does not reset existing passwords. The demo email is reserved and cannot be registered through the API. Seeds verify the existing demo password and stop without changing data if DEMO_PASSWORD does not match. New registrations have no accounts until later account-integration work.

`npm run dev` restarts Express on code changes. `npm test` starts its own server on port 3107, tests the real configured PostgreSQL database, and removes its verification user/draft/session. Use a local development database, not production. `TEST_PORT` overrides the test server port. Tests rerun the seed, so deleted sample drafts may be recreated. Run migrations and seeds first; tests expect the documented sample counts.

`npm run test:setup` separately tests bootstrap recovery using temporary databases/roles and requires the local PostgreSQL administrator credentials. It removes only its isolated fixtures, never the application database.

## Database behavior

Versioned SQL is in `database/migrations`; a transaction and PostgreSQL advisory lock prevent partial or concurrent migration application. `schema_migrations` records applied files. Add a new migration instead of editing one already applied. Seeds run in a transaction, use stable unique keys, and preserve saved/edited drafts and existing passwords. No reset/delete command is run by setup or seed.

Tables: users, hashed sessions, accounts, activity, scheduled_posts, metric_snapshots. Composite foreign keys prevent posts from referencing another user's accounts. Timestamps use PostgreSQL `timestamptz`; API timestamps use ISO timestamps with timezone; metric snapshot_date is a timezone-independent YYYY-MM-DD string. Seed: 1 demo user, 3 accounts, 12 activity items, 3 drafts, 21 daily metric snapshots (November 9-15, 2026). Application-created drafts have `is_sample: false`; seeded records have `is_sample: true`. The entire app still operates in demonstration mode.

## How the backend fits together

The setup commands have different responsibilities and should run in this order:

1. `db:setup` connects as the local PostgreSQL administrator and creates the application role/database if missing. It does not create application tables. The administrator credential is not used by Express.
2. `db:migrate` connects using DATABASE_URL and applies unapplied numbered SQL files. Its history table and schema changes commit together. A failed migration rolls the transaction back; fix the failure before retrying.
3. `db:seed` inserts the fictional demonstration records. Stable keys prevent duplicate sample rows, and existing passwords and draft edits remain intact. It does not download platform data.
4. `start` checks database access and the migration-history table, then listens on port 3001. A successful startup check is not a check that every possible migration is current; run migrations explicitly when updating the project.

`server/db.js` owns the shared PostgreSQL pool. `server/app.js` defines HTTP routes, validation, session authentication, and error responses. `server/passwords.js` hashes passwords and session tokens. `server/index.js` starts the listener and handles shutdown. SQL schema files live under `database/migrations`; database setup and seed commands live under `scripts`.

For an authenticated request, Express reads the bearer token, hashes it, and looks up an unexpired session in PostgreSQL. The session supplies the user ID. Queries restrict records to that owner; the browser cannot choose a different owner by submitting a user_id. Password hashes and session-token hashes are never part of public user responses.

Creating a draft validates its account, text, status, and optional time before inserting a scheduled_posts row. PATCH locks the saved row in a transaction, merges submitted fields, validates the resulting record, and writes it back. Concurrent edits to different fields both survive; concurrent edits to the same field take effect in lock-acquisition order. Every successful write is committed by PostgreSQL before the response returns. A later GET reads the database again, which is why the record survives an Express restart and can be loaded after a browser refresh. The React screen still needs to make that GET when it mounts.

There are two separate time rules: a plain draft may have no time, while a scheduled record must have a future scheduled_at when it is created or its schedule/status is explicitly changed. Content-only edits to an overdue scheduled record remain allowed. Input timestamps need an explicit timezone; responses use ISO timestamps. No process watches for due records or sends them to social platforms.

## Frontend handoff and evidence

See [API contract](docs/API.md), [verification and report notes](docs/PHASE1.md), and [integration plan](docs/INTEGRATION_PLAN.md). The backend defaults to allowing browser requests from `http://localhost:5173`; set FRONTEND_ORIGIN for a different React origin and restart Express.

## Troubleshooting

- `psql` not recognized: use `& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' ...`; opening a new terminal or adding that bin directory to your user PATH is optional.
- `ECONNREFUSED` / startup database failure: check `Get-Service *postgres*`, run pg_isready above, check the port and DATABASE_URL, then start the service as administrator. Express checks the database at startup.
- Password authentication failure: confirm the role/password in `.env`. Do not substitute the administrator password for the application role's password. To reset an existing role, open psql as postgres and use `\password dashboard_app`, then update `.env` locally.
- Missing tables: run `npm run db:migrate`, followed by `npm run db:seed` against the same DATABASE_URL used by Express.
- Port conflict: `Get-NetTCPConnection -LocalPort 5432 -State Listen` (database) or `-LocalPort 3001` (API). Preserve existing services; choose another port and update configuration if necessary. Installer script targets 5432; use the graphical installer to choose another database port.
- WinGet source agreement prompt: installer specifies the `winget` source to avoid unrelated Microsoft Store prompts. If WinGet is unavailable, use the official graphical installer, then the existing-installation steps above.
- Installer interrupted: inspect service and `C:\Program Files\PostgreSQL` before retrying. The installer checks WinGet and port 5432 before creating credentials. If no service exists, retrying reuses the saved generated password in `.postgres-admin.env`; malformed credential files require manual inspection. It never replaces a password on an existing service.
- 401 response: log in and send `Authorization: Bearer <token>`; sessions expire after eight hours. Logout invalidates that session.
- Browser CORS failure: FRONTEND_ORIGIN must exactly match the React page origin (including port); restart Express. localhost and 127.0.0.1 are different origins.
- Test port conflict: `$env:TEST_PORT='3108'; npm test`. Failed tests may leave verification records; inspect before manually removing any.

No credentials, node_modules, or generated builds belong in Git. For submission, the assignment requests a public repository named `Project_Group_12_Social_Media_Dashboard`; the existing local folder name is left intact.

## Working with the React app

Keep the backend package.json at the repository root. Create Nathanial's Vite React project inside `client/` with its own package.json and lockfile; do not scaffold over the root backend. Run `npm ci` and `npm start` at the root, then install/start React from a second terminal inside `client`. Add `VITE_API_URL=http://localhost:3001/api` to the client's local environment if using that configuration convention; React must actually read it with import.meta.env.VITE_API_URL. No client folder is created by the backend work.

Each teammate should run their own PostgreSQL instance and .env. Cloning Git shares code and seed scripts, not database rows or credentials. Neither React nor its VITE_ variables should contain DATABASE_URL or administrator passwords. Current Express binds loopback, so another computer cannot access this API without a separate shared-environment setup.

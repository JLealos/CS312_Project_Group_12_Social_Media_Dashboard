# Phase 1 contribution and verification notes

These are factual contribution notes, not a completed team submission. Inspection and verification were performed November 15, 2026 (America/Phoenix). No commit was created. The repository initially contained only .git and had no commits, so no teammate code was changed. Work outside this repository has not been inspected.

## Project and assignment scope

Group 12: Nathanial Jarrett (nqj3@nau.edu), frontend; Jack Lealos (jdl545@nau.edu), backend. The project uses React, Express, and PostgreSQL for accounts, a unified activity feed, scheduling, analytics, and a central dashboard.

Use the proposal's per-member P1.1-P1.6 task numbering in the report. Phase 1 deliverables include the React interface, Express API, PostgreSQL schema, an authenticated seeded dashboard, and a documented integration plan. Persistent draft CRUD was brought forward from Phase 2; live publication was not.

The report requires task status, new/modified tasks, at least four actual challenges with implemented solutions, and screenshots of developed webpages. The video must be 7-10 minutes with both members visible and participating. Plan around the November 16, 2026 Canvas deadline supplied for this assignment, which takes precedence over the proposal's November 17 date. Check the Canvas submission page for final submission details.

## Task status from this repository

| Proposal owner/task | Details | Status / evidence |
| --- | --- | --- |
| Nathanial P1.1 | React shell and routes | Backlog in this repository; no React code supplied |
| Nathanial P1.2 | Reusable cards/forms/responsive layout | Backlog in this repository |
| Nathanial P1.3 | Sign-in/out screens and protected navigation | Backlog; backend auth contract available |
| Nathanial P1.4 | Feed/analytics and composer/calendar screens | Backlog; sample API data available |
| Nathanial P1.5 | Connect overview/accounts/feed to Express | Backlog; API contract ready |
| Nathanial P1.6 | Screenshots/frontend challenges/video | Backlog; team must capture actual completed screens |
| Jack P1.1 | Express connection and health query | Completed; real PostgreSQL health response verified |
| Jack P1.2 | Schema and repeatable seeds | Completed; migrations/seeds rerun and data checked |
| Jack P1.3 | Registration/login/hashing/owner restriction | Completed for local demo; tests cover auth and isolation |
| Jack P1.4 | Evaluate platform access and integration choice | Completed as a documentation evaluation; X selected as a conditional technical target with official-source auth/metrics/cost findings and scope limits; live access remains unverified |
| Jack P1.5 | Authenticated reads and input/error handling | Completed; account/feed/metric/dashboard reads and draft CRUD |
| Jack P1.6 | Setup, ignore rules, backend documentation/video | Setup and factual notes completed; video participation remains pending |

| New/modified work | Owner | Status |
| --- | --- | --- |
| Modified: bring persistent draft CRUD into Phase 1 | Jack | Completed; no publishing worker |
| New: Windows PostgreSQL installer/bootstrap scripts | Jack | Completed and used locally |
| New: real-database API and restart verification | Jack | Completed |

Do not mark the whole team dashboard deliverable complete until React screens are integrated and demonstrated. Do not claim a live social account, publication, screenshots, GitHub publication, or video has been completed.

## Actual challenges and implemented solutions

1. **Empty starting repository and no frontend contract.** There were no files, commits, or React request shapes to integrate with. Implemented a small JavaScript backend structure and documented exact endpoint shapes, sample labels, auth behavior, CORS, and a React fetch example. React integration still needs Nathanial's work.
2. **PostgreSQL missing from this Windows environment.** No installation/service/listener was found in the checked locations. Installed PostgreSQL 17.12 with WinGet, verified its Windows service and pg_isready, created a dedicated non-superuser role/database, and generated an ignored local .env. Kept administrator credentials separate from the application connection.
3. **Repeatable setup without losing drafts.** A destructive seed would undermine persistence. Implemented transactional versioned migrations, stable seed keys, unique constraints, and non-destructive conflict handling. Tests reran migrations/seeds, confirmed sample counts remained stable, and confirmed an edited application-created draft remained saved.
4. **Windows test command compatibility.** The first test invocation used tests/*.test.js; Node 20 on this PowerShell setup treated it as a literal path and ran no tests. Changed the npm command to the explicit test file; the full database-backed suite then passed.
5. **Owner and scheduling consistency.** Saved posts must reference the authenticated user's account and preserve timezone intent. Added composite owner/account foreign keys, per-user queries, validation for timestamp timezone/calendar/future scheduling, and partial-update handling for PostgreSQL Date values. Tests reject cross-user access, invalid dates, and unsupported publication status.

These are backend contribution challenges supported by this work. The team should add any frontend challenges that actually occurred rather than inventing them for the report.

## Verification actually run

Environment: Windows PowerShell, Node 20.18.0, npm 10.1.0, PostgreSQL 17.12; service postgresql-x64-17 running on localhost:5432.

- npm install: completed; 82 dependencies installed; npm reported zero vulnerabilities at installation time.
- PostgreSQL installation: WinGet verified installer hash and reported successful installation; pg_isready reported accepting connections.
- npm run db:setup: created dashboard_app and social_dashboard, generated local .env; repeated setup preserved the existing role and database.
- npm run db:migrate and npm run db:seed: completed twice consecutively, then rerun inside the API test.
- npm test after review fixes: **9 passed, 0 failed** (one parent integration test plus eight subtests) against real PostgreSQL and real child Express processes.
- npm run test:setup: **5 passed, 0 failed** (one parent plus four subtests). Used temporary database/role fixtures to verify credential recovery after CREATE DATABASE failure, preservation of existing configuration files, repeated setup, rejection of incorrect database ownership, and preservation of an existing role password when configuration is missing. Fixtures were removed.
- Checked health/database query, application role privilege flags, 3 sample accounts, 12 sample activities, filtered activity, 21 sample metrics, dashboard count, and CORS preflight.
- Added occupied-port startup failure, cross-timezone YYYY-MM-DD dates, overlapping partial PATCH requests, overdue content edits, expired-session rejection, null-character/array-ID rejection, and 413 body-limit checks.
- Checked valid draft create/read/update/delete and direct SQL presence/absence; invalid content, missing fields, extra fields, malformed JSON, invalid calendar date/timezone, invalid IDs/status, and unavailable account.
- Checked registration, duplicate email, incorrect password, required token, ownership isolation for reads/edits/deletes/creation, logout revocation, and an empty account list for a new user.
- Stopped/restarted the Express child process and read the same edited scheduled draft using the same persisted session token. Test records and session were cleaned up.
- Checked .env, .postgres-admin.env, and node_modules are ignored, while package-lock.json remains eligible for source control.
- Ran npm start on port 3001 and read the successful health response; SQL confirmed current_user dashboard_app, PostgreSQL 17.12, and expected final sample counts. The verification Express process was stopped afterward; PostgreSQL remains running.

Limitations: No React screen/browser-refresh workflow was available to test. Backend re-fetch and restart persistence passed; a visual browser demo remains pending. No PostgreSQL service restart/reboot persistence test, production load/security audit, real provider/OAuth/publishing test, or second teammate-machine installation was performed. WinGet installation and the wrapper script's already-installed branch were verified here; a clean installation on a second teammate machine remains untested. Demo auth has no email verification, password reset, persistent login throttling, or automatic expired-session cleanup. Express binds loopback for local development. Current list reads are unpaginated and appropriate for the small sample dataset. Draft updates serialize through row locks; edits to the same field take effect in lock-acquisition order. Deleting a seeded draft and rerunning the seed restores that missing sample record by design; ordinary saved drafts are unaffected.

## Suggested Jack video segment

State the contribution: Express/PostgreSQL backend, seeded schema, auth/ownership, persistent draft CRUD, Windows setup and verification. Show /api/health, log in, read accounts/activity, save and edit a draft, restart Express and re-read it, then delete it. Show the migration, non-destructive seed, validation/owner checks, and passing npm test. Explain the actual Windows database setup and test-command challenge. State that platforms and metrics are sample data and no posts publish.

The overall team video must be 7-10 minutes with both members' cameras on throughout, demonstrate actual webpages, and cover completed/pending/modified tasks. The team still needs to fill the report template, capture webpage screenshots (not code screenshots), export PDF, record/upload the video with instructor access, and submit public GitHub and video URLs in the latest Canvas submission comments. Repository visibility and naming changes, report submission, and video upload remain team tasks.

## Review fixes and remaining checks

Review found setup credential-loss paths, misleading listen errors, overlapping PATCH overwrites, timezone-dependent SQL DATE serialization, and installer retry limitations. These were corrected. Setup saves a unique private recovery configuration before creating a role and never resets an existing role's password automatically. It verifies application connectivity/schema privileges and rejects an unexpected database owner. Express reports listen errors with a nonzero exit. PATCH locks before reading; metric dates remain YYYY-MM-DD. Installer prerequisites are checked before credentials are created, and interrupted attempts reuse the saved generated password.

Documentation now separates malformed login requests (400) from credential mismatches (401), maps frontend widgets to supported fields, reserves client/ for React, and documents sample date ranges. The demo email is reserved, and reseeding with a mismatched demo password fails without altering data. Platform evaluation is documented with official sources in INTEGRATION_PLAN.md; live account access and spending approval are still unverified.

Updated installer syntax and its already-installed branch are checked on Windows. Failure/retry behavior has not been validated by interrupting a real installation or installing on a second clean computer. The review fixes did not restart PostgreSQL, add React screens, publish a repository, or create a commit.

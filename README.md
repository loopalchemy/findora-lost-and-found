# University Lost & Found

**Project:** Design and Development of a Centralized Web-Based University Lost-and-Found Management Platform
**Candidate:** Jane Mark · **Registration:** 25/03612
**Institution:** KCA University · **Programme:** Bachelor’s Degree in Software Development
**Supervisor:** Dr Joy Kirop

This academic project provides a responsive React/Vite frontend and a Node.js/Express API backed by a MySQL 8 schema. Its approved scope is to help KCA University students and staff report Lost/Found items, browse and filter reports, view item details and advisory potential matches, submit claims for human review, track statuses, and let administrators review reports and claims, manage categories, view registered users and basic statistics. It is a project prototype, not an official university service.

## Current implementation and limits

The frontend uses a credentialed API client and asynchronous application context; it no longer uses `localStorage` as the authoritative source for accounts, reports, claims, categories or session state. Backend routes use MySQL queries, bcrypt password hashing, JWT session cookies, CSRF protection, input validation and server-side role/ownership checks. The SQL bootstrap and integrity migration are included.

The code and flows have been verified against an **isolated in-memory test pool**, not by writing to the user's MySQL database. A MySQL 8.0.45 connection to `university_lost_found` was reported as verified earlier in project development; it was not reconnected or used for writes during this integration run. Treat the live schema, migration application and full database-backed workflows as requiring a reviewed, disposable database check before any deployment.

Potential matches are rule-based, transparent and advisory. They compare eligible opposite-type approved/recovered reports using normalized category, location wording and dates within a 14-day window. They are not AI, proof of ownership, or an automatic claim/recovery decision. Physical GPS tracking, facial/image recognition, advanced AI, payments, real-time messaging, mobile apps, notifications, multiple-university deployment and university-system integrations are outside the approved first-release scope.

## Requirements

- Node.js 22.12 or later (the project was built with Node.js 22.23.4)
- npm 10 or later (built with npm 10.9.2)
- MySQL 8.x for the live backend path
- Visual Studio Code or another editor

No external API key is required.

## Open and run in Visual Studio Code

1. Download and extract `university-lost-and-found-source.zip`, then open the extracted `university-lost-and-found` folder in Visual Studio Code.
2. Install frontend dependencies from the project root: `npm install`.
3. In `backend/`, copy `.env.example` to `.env`. Replace the local database placeholders and set a long, randomly generated `JWT_SECRET` (for example, generate one locally with `openssl rand -hex 64`). Never commit or share `.env`.
4. Prepare a **dedicated, reviewed development database** before connecting the API. For a new, empty project database only, inspect `backend/database/schema.sql` and then execute it with a MySQL account authorized for that database. The script creates the four tables and inserts any missing starter categories. It does not drop tables, but `CREATE TABLE IF NOT EXISTS` is not a substitute for inspecting an existing schema.
5. For an existing `university_lost_found` database, back it up and inspect `SHOW CREATE TABLE` and current data first. Read `backend/database/migrations/001_safe_integrity.sql` in full and run its read-only preflight queries; resolve duplicates/orphans manually. Do **not** run migrations against a shared or production database as part of testing. No migration is run automatically by the server.
6. Create the first administrator through a private interactive terminal after reviewing the target database: `npm --prefix backend install`, then `npm --prefix backend run admin:create`. The script accepts passwords interactively (not as command-line arguments), requires `DB_NAME=university_lost_found`, verifies the connected database, takes a first-admin lock, hashes the password, and refuses to replace an existing account. Create Staff accounts with `npm --prefix backend run account:create-staff` only after an administrator exists. Public registration always assigns the `student` role.
7. Start the API in one terminal: `npm run dev:backend` from the project root. Its default port is `5000`.
8. Start the frontend in a second terminal: `npm run dev`. Open the Vite URL (normally `http://localhost:3000`). Vite proxies `/api` and `/uploads` to `http://127.0.0.1:5000`. If the API uses a different local address, set `BACKEND_PROXY_TARGET` in a local environment file read by Vite. Do not expose database or signing secrets to Vite/browser variables.

For a production frontend bundle, run `npm run build`; the generated static files are in `dist/`. The production API must be deployed separately with secure environment configuration, HTTPS cookies, a reviewed database, safe image storage/retention, backups and operational controls. Public deployment has not been performed.

## Schema and status model

The implemented SQL scripts define `users`, `categories`, `items` and `claims`, with primary/foreign keys and uniqueness constraints. The user role enum is `student`, `staff`, `admin`; item type is `lost` or `found`; item status is `Pending review`, `Approved`, `Rejected` or `Recovered`; claim status is `pending`, `approved` or `rejected`. Category removal is rejected while reports reference that category. Review decisions on claims and report recovery status remain separate.

The schema file is the project's implemented SQL design; it is not evidence that these DDL statements were applied to the current university database. The migration is intentionally guarded and must be reviewed against the actual target before use. No real database writes were performed in this handoff.

## Authentication and security model

The API stores bcrypt hashes, issues a signed JWT in an HttpOnly cookie, and uses a CSRF companion cookie/header for state-changing requests. Role checks and ownership checks run on the server; client route gates are only a usability aid. Cookies are configured through backend environment variables for local HTTP versus HTTPS Preview/production. The security controls have been exercised by automated tests and the isolated browser workflow, but they have not undergone an independent security audit or a live-MySQL production review.

Do not use the in-memory browser-test accounts on a real deployment. Test-only `.test` accounts are created by `backend/tests/mock-server.js`; they are not seed users in `schema.sql` and do not exist in the university database. Staff/admin identities are provisioned through the interactive scripts, not public registration.

## Tests and verification

From the project root:

```bash
npm test                 # Frontend matching utility tests
npm run test:backend     # Backend API and security tests; in-memory database pool
npm run build            # Production frontend build
```

The current run passed: **3/3 frontend tests**, **8/8 backend tests**, and the Vite production build. Browser smoke checks against the isolated mock API covered a new student registration/session, combined keyword/type browsing, a Lost report submitted as Pending review, claim submission and duplicate protection/status, administrator sign-in, report approval, claim approval, and a separate report recovery transition. These actions used only in-memory synthetic data. They do not prove MySQL persistence or a production database connection.

## Main project structure

- `src/pages/` — public browsing, reports, details, auth, user activity and administrator screens.
- `src/components/` — shared navigation, cards, badges and form/display elements.
- `src/context/AppContext.jsx` — asynchronous API-backed session and application state/actions.
- `src/services/apiClient.js` — credentialed fetch wrapper, CSRF token and error normalization.
- `src/utils/matching.js` — transparent 14-day rule-based advisory comparisons.
- `src/styles/global.css` and `public/assets/` — visual system and bundled assets.
- `backend/app.js` — Express routes, security middleware and workflow rules.
- `backend/src/` — JWT/CSRF auth, validation and upload helpers.
- `backend/database/schema.sql` and `backend/database/migrations/` — SQL bootstrap and guarded integrity migration.
- `backend/tests/` — API/security tests and test-only in-memory pool/server.
- `public/manus-routes.json` — complete website route manifest.

## Troubleshooting

- If sign-in or data loading fails, verify the API is listening on port 5000, `backend/.env` points to the intended development database, and MySQL is available. Check the API terminal for configuration errors; never paste passwords or `JWT_SECRET` into support messages.
- If the frontend cannot reach the API, check the Vite proxy target and restart Vite after changing it.
- If an administrator bootstrap attempt stops, read the message, verify `DB_NAME` and the connected database, and do not relax the safeguards or run the command against an uncertain/shared database.
- Uploaded images are size/type checked and written under the configured local upload directory. This local disk setup is not durable object storage; production retention and backup policy remain to be designed.

## Project boundaries and next verification
Production frontend configuration updated.
Before describing the application as fully database-integrated, verify this source against an isolated, disposable MySQL 8 database: inspect the exact schema, create a test account, exercise allowed/denied API actions, confirm row persistence and status changes, and document cleanup. Do not use the shared/production university database for this test. Also run broader responsive/browser accessibility review, image upload success/failure cases, backup/restore exercises and an independent security review before any real-user deployment.

# Implementation Plan — University Lost & Found integration

## Approved purpose and scope

Continue the existing project, **Design and Development of a Centralized Web-Based University Lost-and-Found Management Platform**, by connecting its existing React/Vite interface to the user's supplied Express/MySQL backend. The proposal remains authoritative: students and staff report lost/found items, browse/search reports, inspect details, receive advisory rule-based potential-match suggestions, submit ownership claims, track statuses and monitor recovery. Administrators review reports/claims, manage categories, view users/statistics and mark eligible reports recovered. Do not add facial or image recognition, GPS tracking, advanced AI, payments, real-time messaging, unrelated administration or production deployment.

The uploaded frontend source archive matches the managed project source. The second archive contains backend `server.js`, `db.js`, its package manifest/lockfile and an `.env`; source files were staged without executing, exposing or copying real environment values. The supplied backend includes `/`, `/api/ping`, `/api/db-test`, report list/create/status and claim list/create/status routes, but its public routes originally trusted request-supplied IDs, had no authentication/authorization, exposed pending data and had no passing test script. Preserve useful paths and intent while securing them. Keep `/api/ping` public and `/api/db-test` available only to an authenticated administrator.

## Existing design to preserve

Retain the current editorial academic SaaS identity rather than redesigning: warm ivory canvas, navy/charcoal text, muted teal actions, sage highlights, white surfaces, subtle borders, restrained shadows, existing wordmark and recovery mark, photo-led item cards, responsive header/mobile navigation/footer, spacing and typography. Keep the discovery-first homepage, existing React pages and routes, and the current responsive layout. Limit visual changes to account forms, authenticated identity/navigation, loading/error states and copy necessary to remove demo-only assumptions. Preserve semantic HTML, accessible labels/focus, image alternatives and reduced-motion support.

## Architecture and trust boundaries

- **Frontend:** preserve root React 18, JavaScript, Vite, React Router, CSS and Lucide. Replace browser-simulated account/domain state with one credentialed `apiClient.js` and an API-backed `AppContext.jsx`. Use normalized DTOs (`id`, `ownerId`, `type`, `title`, date strings, display statuses). Restore identity from `/api/auth/me`, not localStorage. Public visitors receive only Approved/Recovered reports; student/staff receive public data plus their own private reports and claims; administrators may access the admin queues, all necessary records and SQL-derived statistics. Role gates in React are for navigation only; backend middleware is the security boundary. Remove fake demo-role login, demo reset and fake successful submit behavior. No localStorage authority for users, sessions, reports, claims, categories or statistics; temporary match-review display state may remain non-authoritative in memory.
- **Local wiring:** keep the existing Vite runtime/preview port 3000 and configure a development-only proxy from `/api` and `/uploads` to `http://127.0.0.1:5000`. Run Vite and Express in separate terminals. The proxy is for local academic demonstration and is not production hosting.
- **Backend organization:** place the supplied backend under `backend/`; separate an injectable Express app from the listener, preserve the existing API resource paths, use a MySQL pool and add auth, reports, claims, categories, users and statistics services/handlers. Keep `/api/ping`; retain `/api/db-test` with admin-only access; keep the root health message. Return consistent JSON errors without stacks, passwords or credentials.
- **Authentication/security:** use bcryptjs password hashing; signed short-lived HS256 JWT in an HttpOnly cookie; a double-submit CSRF token for unsafe requests; explicit cookie attributes configurable for local HTTP vs public-HTTPS preview; exact allowed-origin CORS and unsafe-Origin checks; login/register rate limiting; role from the database after token verification; backend admin guards and ownership checks; parameterized SQL; strict input/date/status validation; allowed state transitions; no IDs or roles trusted from request body. Public registration creates Student only. Admin/Staff roles are provisioned through a controlled terminal CLI, never the public UI.
- **Reports/claims:** keep existing GET/POST/PATCH resource endpoints and add item detail, current user's reports/claims, authenticated CRUD-safe category/user/admin operations. Limit public item fields; never expose claimant names/explanations outside authorized user/admin views. Claims require a different user's Approved Found item, a valid explanation, and one claimant/item pair. Report recovery is an independent admin decision. A claim decision must never change report status.
- **Matching:** preserve the existing transparent rule-based Lost↔Found comparison, including the proposal's category/location/date factors and configured window. Keep suggestions advisory, show reasons and never use them to approve ownership or recover an item.
- **Images:** preserve JPG/PNG/WebP input and 350 KB client cap. Upload multipart, verify file signatures as well as advertised MIME/size, assign unpredictable filenames and serve from backend local `uploads/`; persist only a relative image path. Never put images or credentials in the source ZIP. Local uploads are a development limitation, not production durable storage.
- **Database:** target the provided `university_lost_found` MySQL 8 database and exact table/column names supplied by the project. Create a fresh-install `schema.sql`; make a separate guarded/idempotent safe-integrity migration that does not delete records or disable foreign keys. Run database checks read-only. Inspect `SHOW CREATE TABLE` only if the configured endpoint is accessible. The current isolated sandbox has not been authorized as a disposable instance of the user's existing MySQL; do not mutate it or seed sample reports/users. If live schema cannot be checked, deliver the SQL and mark live DB integration unverified.
- **Credential recovery:** supply an interactive CLI that accepts no passwords as command-line arguments, hashes entered passwords, checks that it is connected to `university_lost_found`, and updates only a selected existing account's `password_hash` while keeping role/IDs/reports/claims intact; support first-admin creation only when no admin exists.

## Testing and delivery

- Add isolated backend tests with a mocked pool for session registration/login/logout, password hashing, role/ownership denials, spoofed IDs/roles, public visibility, validation, report/claim persistence contract, duplicate/self-claim rejection, state transitions, category safety, statistics authorization and upload rejection. Never write fake data to a shared/unknown MySQL instance. Add frontend coverage for matching/validation as needed.
- Run frontend tests/build, backend automated tests, static/API checks and archive integrity. If no disposable MySQL is available, make no live write tests; mark real schema/data persistence workflows not verified and give exact local test instructions.
- Create a self-contained source ZIP containing frontend/backend source, package manifests and lockfiles, assets, SQL, `.env.example` and setup guide; exclude real `.env`, credentials, `node_modules`, build output and uploaded files. Do not deploy publicly or publish to GitHub. Any private Manus checkpoint is separate, and publication remains off.

## Planned project structure

- Root `src/`, `public/`, `index.html`, `vite.config.js`, root `package.json` and lockfile: preserved React/Vite app, current brand/assets, route manifest and development API/upload proxy.
- `src/context/AppContext.jsx`: API session bootstrap, account/role state, refreshed MySQL-backed data and shared async actions.
- `src/services/apiClient.js`, `src/utils/matching.js`, existing page validation and `backend/src/validation.js`: credentialed HTTP/CSRF, input validation and transparent rule-based suggestions. Remove the obsolete localStorage domain service/seed data from runtime.
- `src/pages/` and `src/components/`: preserved public browse/report/detail/how-it-works, personal activity and administrator pages, updated for API responses and loading/errors.
- `backend/app.js`, `backend/server.js`, `backend/db.js`: testable API composition, listener and MySQL pool.
- `backend/src/auth.js`, `validation.js`, `uploads.js`: sessions/authorization, strict validation and safe image processing.
- `backend/database/schema.sql`, `backend/database/migrations/`: fresh setup plus safe non-destructive constraints.
- `backend/scripts/check-db.js`, `create-admin.js`, and credential-reset tool: read-only schema inspection and controlled account setup/recovery.
- `backend/uploads/`: runtime image folder, ignored except for `.gitkeep`.
- `backend/tests/`: isolated API/security tests with mocked MySQL pool.
- Root `README.md`, root and backend `.env.example`: clear two-terminal setup, migration/test instructions and limits; environment examples contain placeholders only.

## Current design identity

- **Design movement:** restrained editorial academic SaaS, retained from the existing approved prototype.
- **Core principles:** clear public discovery; calm trustworthy process; readable status distinctions; supportive recovery without exposing private claim information.
- **Color philosophy:** warm ivory for an approachable campus noticeboard; navy for authority and legibility; muted teal for action; sage as a subtle recovery cue.
- **Layout paradigm:** left-to-right editorial content and compact photo-led collections; detail and admin pages retain asymmetric panels and readable lists rather than a generic full-screen admin grid.
- **Signature elements:** recovery mark/wordmark; Lost vs Found pills; visible status badges with text plus color.
- **Interaction philosophy:** public browse first; authenticate only when taking private actions; confirm consequential admin changes; explain potential matches as clues, never proof.
- **Animation:** preserve restrained existing motion, avoid attention-seeking transitions and respect reduced-motion preferences.
- **Typography:** retain current readable sans-serif hierarchy and font usage; display headings remain concise, body copy comfortable and labels unambiguous.
- **Brand essence:** a practical campus service that helps students and staff return lost belongings to their owners; calm, useful, trustworthy.
- **Brand voice:** warm and direct, with privacy-aware guidance. Examples: “A helpful clue, not a verdict.” “Share enough detail to help someone recognize it.”
- **Wordmark and logo:** preserve the existing University Lost & Found wordmark and original recovery-themed icon; do not fabricate an official KCA University mark.
- **Signature brand color:** muted teal, retained from the existing product actions.

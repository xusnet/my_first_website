# Threat model

## What this project does and where untrusted input enters

A personal technical blog with a built-in CMS admin panel. Two very different
exposure surfaces:

**Public, unauthenticated surface** — every visitor reaches these:
- Article list / article detail, category pages, tag pages, the "about" page.
  Article bodies are Markdown, stored by an authenticated admin and rendered to
  HTML in the browser.
- `GET /api/*` read endpoints for the above resources.
- Login endpoint `POST /api/auth/login`.

**Authenticated CMS surface** — reachable after login, `/admin` in the SPA:
- Article / category / tag CRUD (Markdown editor with live preview).
- User, role and permission management; role→permission assignment.
- Site settings, user settings (including password change).
- Audit log viewer and `GET /api/audit/verify` (hash-chain integrity check).

All of the following must be treated as **untrusted**:
- Every HTTP request body, query string, path segment and header.
- Markdown article bodies. They are authored by a privileged admin, but they are
  rendered to every public visitor, so a stored-XSS payload here reaches
  anonymous users. Treat "admin can post arbitrary Markdown" as **not** a reason
  to trust the rendered output.
- The `slug` used to address articles and categories.
- JWT access and refresh tokens (attacker-controllable strings).
- Login identifiers: `username` / `email`.

Trust boundaries worth noting:
- Public visitor → read-only API.
- Authenticated admin → write API. Role permissions gate each admin capability;
  a user with `post:write` must not reach `user:delete`.
- The flagged first-login state (`must_change_password`) is a **server-enforced**
  boundary, not merely a frontend redirect: until the password is changed the
  server should only accept password-change / self-read / logout requests.

## Components that matter most / least

**Highest priority**
- `server/src/middleware/auth.ts` — JWT verification and the
  `requirePasswordChanged` gate.
- `server/src/middleware/rbac.ts` — permission checks. Any path that reaches a
  handler without an RBAC check is a privilege-escalation finding.
- `server/src/routes/**` — SQL construction against MariaDB via the `mariadb`
  driver. The codebase uses the driver's `namedPlaceholders`; string-concatenated
  SQL is a bug.
- `server/src/utils/password.ts` — password hashing (bcryptjs) and the password
  policy.
- `server/src/utils/crypto.ts` — JWT signing/verification, refresh-token
  handling.
- `server/src/utils/audit.ts` — the hash-chained audit log. The integrity
  guarantee is the point: a way to alter or re-order log entries without
  `GET /api/audit/verify` noticing is a finding.
- Markdown → HTML rendering on the client. Any path that lets stored Markdown
  execute script in a visitor's browser is **high**.

**Lower priority, still in scope**
- The Vite/React frontend build, routing, and client-side state.
- `client/` styling and layout — cosmetic issues are out of scope.
- `server/src/cache/` — Redis-backed caching and rate limiting.

**Out of scope**
- `deploy/docker-compose.yml` and `.env` handling — these are deployment
  scaffolding, committed separately from runtime code.
- Denial of service by sheer request volume is handled at the reverse proxy;
  application-level rate limiting is in scope, but "this endpoint has no
  dedicated limiter" is only interesting if it protects an expensive or
  brute-forceable operation.
- Missing security headers that must be injected by the reverse proxy
  (HSTS, for instance) — the app is expected to run behind one.

## How to exercise it

The image brings MariaDB and Redis up, creates the `clarkgong` database and runs the
schema migration. This is wired to two entry points on purpose: the image's own
`ENTRYPOINT` (used by a plain `docker run <image>`) and a shell startup file
(`/etc/profile.d/oss-env.sh`, sourced from `/root/.bashrc`), because the scanner's
tool layer ends with `ENTRYPOINT []` and only leaves `CMD ["bash"]` behind. If you
ever land in a shell where the services are not running, execute
`/usr/local/bin/oss-entrypoint true` or `. /etc/profile.d/oss-env.sh`; the startup is
idempotent and logs to `/tmp/oss-env.log`.

```
# backend, development mode (hot reload, tsx)
cd /src/server && npm run dev          # listens on :3001

# backend, production mode — note that production REQUIRES the secrets below,
# the process refuses to start without them
cd /src/server && NODE_ENV=production \
  JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... \
  AUDIT_PEPPER=... ADMIN_INITIAL_PASSWORD=... npm start

# seed an admin user and sample content
cd /src/server && npm run db:seed

# frontend build + preview
cd /src/client && npm run build && npm run preview
```

Useful invariants to attack:
- Log in as the seeded admin, change the password, then replay the old access
  token. It must be rejected.
- Call an admin endpoint with a token whose user lacks the permission. It must be
  `403`, not `200`.
- Send a Markdown article containing `<img onerror>`, `<script>`, and
  `[x](javascript:alert(1))`. Then open it as an anonymous visitor.
- `GET /api/audit/verify` must return `{"valid":true}`; try to make it lie.

## How you rate severity

- **Critical** — unauthenticated RCE, unauthenticated access to admin data,
  authentication bypass, or token forgery (a way to mint a valid JWT without the
  secret).
- **High** — authenticated privilege escalation (reaching a permission the role
  does not grant), stored XSS that executes for anonymous visitors, SQL injection
  reachable by any authenticated user, or a way to defeat
  `must_change_password`.
- **Medium** — reflected XSS, CSRF on a state-changing admin endpoint, IDOR that
  leaks another user's non-public data, rate-limit bypass that makes credential
  brute-forcing practical.
- **Low** — information disclosure without direct impact (verbose errors,
  version banners), missing cache headers on authenticated responses.
- **Informational** — hardening suggestions.

Prefer a reproduction over a description. For authentication and RBAC findings,
show the exact request and the response that should have been rejected.

## Anything to leave alone

- Do not report the frontend `dev` script, sourcemaps, or unminified bundles as
  information disclosure — they are build artifacts of a public repo.
- Do not report dependency-version advisories that `npm audit` already surfaces
  unless you can demonstrate the vulnerable path is actually reachable.
- Do not report the absence of `Content-Security-Policy` as a standalone issue;
  report it only if you have a concrete injection that CSP would have stopped.
- The seeded admin credentials and the development fallbacks for secrets are
  intentional and documented; the finding we care about is a *production* path
  that silently accepts a fallback secret, not the existence of the fallback.
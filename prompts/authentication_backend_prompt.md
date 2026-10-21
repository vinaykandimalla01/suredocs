# SureDocs — Phase 1: Production-Oriented Authentication Backend and Functional Login

## 1. Your role and objective

Act as a senior backend engineer, application security engineer, and full-stack developer experienced in building secure enterprise document-management systems.

Your task is to inspect my existing SureDocs project, understand its current frontend, backend, database, Docker configuration, and routing, and then implement a complete, working authentication system for the existing login page.

Do not blindly generate a new project. Work inside my existing project, reuse what is already implemented, and modify existing files carefully.

**Do not stop after inspecting the project or presenting a plan.** After your initial inspection, provide a concise summary of the existing structure and implementation approach, then proceed with the implementation, testing, and debugging.

Do not claim that the application is secure or fully functional unless you have implemented and tested the relevant behavior. Report any remaining limitations honestly.

---

## 2. Project context and existing environment

The project is named **SureDocs**. It is an enterprise document-management and sharing application intended to allow authorized administrators and employees to manage and access confidential documents.

My project root is currently:

`D:\suredocs`

The project uses or is intended to use the following technologies:

- Frontend: React, JavaScript, and Tailwind CSS.
- Backend: Python and FastAPI.
- ORM: SQLAlchemy 2.x.
- Database: PostgreSQL 18 running in Docker.
- Database administration UI: pgAdmin running in Docker.
- PostgreSQL driver: Psycopg 3.
- Database migrations: Alembic.
- Password hashing: `pwdlib[argon2]`.
- Testing: pytest.
- Local Python environment: `D:\suredocs\backend\.venv`.

The relevant installed backend packages include FastAPI, Uvicorn, SQLAlchemy, Psycopg, Alembic, `pwdlib[argon2]`, and pytest. Inspect the actual installed packages and dependency files before installing anything else.

PostgreSQL is running through Docker Compose. The intended database name is `suredocs`, and the backend database account is `suredocs_app`.

I have a local secrets directory:

```text
D:\suredocs\secrets\
```

The relevant database password file is:

```text
D:\suredocs\secrets\suredocs_app_password.txt
```

The Docker configuration and actual database role may differ from these assumptions, so inspect the existing files and verify the actual configuration before changing anything.

**Important environment rules:**

1. Use the existing `secrets/` directory for local secrets. Do not create or require a `.env` file for local secret storage.
2. Never hardcode database passwords, administrator credentials, session secrets, or other secrets in source code.
3. Never commit the `secrets/` directory to GitHub.
4. Do not delete Docker volumes, reset PostgreSQL, drop databases, or destroy existing project files.
5. Do not assume that the database is empty without checking. If it is empty, initialize its schema through Alembic migrations.
6. When FastAPI runs directly on Windows, PostgreSQL is expected to be accessible through the published localhost port. When the backend runs inside Docker, use the appropriate Docker service hostname instead.
7. Preserve the existing frontend implementation and visual design. Authentication should be integrated into the current login page rather than replacing it with an unrelated design.

---

## 3. First, inspect the complete existing project

Before implementing anything, inspect the current repository and identify:

- The frontend framework, entry point, page structure, routing library, and current login page.
- All existing login form controls, buttons, input fields, icons, and event handlers.
- Existing frontend API clients, HTTP request configuration, and authentication state handling.
- The backend entry point, routers, Pydantic schemas, database connection module, SQLAlchemy models, and dependency injection.
- The contents of `docker-compose.yml`, `.gitignore`, `requirements.txt`, and any existing Alembic configuration.
- The `tests/` folder and existing tests.
- The existing PostgreSQL connection configuration and the current status of its tables.
- Existing authentication, session, permission, or authorization code, if any.

Use the actual project structure to determine what should be reused, modified, created, or removed.

Do not duplicate files or create a second implementation of functionality that already exists.

If there is a conflict between the desired design and the existing implementation, explain it briefly and choose the safest, least disruptive solution.

Do not make unnecessary changes to unrelated frontend components or application features.

---

## 4. What we are building

Implement the first functional version of SureDocs authentication.

When someone opens the application URL, they must encounter the login page unless they already have a valid authenticated session.

The login page must accept:

- Work email address.
- Password.

The email address replaces a separate username attribute. The frontend may currently call the field “Username”; inspect the existing page and use a clear “Work email” or “Email address” label while preserving its layout and design.

The database must contain both administrator and employee accounts.

After successful authentication:

- An `ADMIN` user should be directed to the existing administrator interface.
- An `EMPLOYEE` user should be directed to the existing employee interface.
- If those interfaces or routes already exist, integrate authentication into them without redesigning them.
- If the required routes do not exist, establish the minimum routing structure needed without inventing or implementing the rest of the application prematurely.

The backend must determine the user's role from trusted database records. A role supplied by the frontend, URL, browser storage, or request body must never determine the user's privileges.

The database is currently expected to have no application tables. Create the required schema through the existing or newly configured Alembic migration system, not through ad hoc manual table creation in pgAdmin.

---

## 5. Authentication technology and security decisions

Implement the following approach unless the existing application already has a demonstrably appropriate equivalent.

### 5.1 Password hashing

Use **Argon2id** through the installed `pwdlib[argon2]` library.

Requirements:

- Hash passwords before storing them.
- Verify submitted passwords using the password-hashing library's verification function.
- Use a unique salt generated by the password-hashing library.
- Use a properly configured Argon2id work factor, meeting current OWASP minimum guidance and benchmarking it against the local and expected production environment.
- Store the complete encoded Argon2id hash in `password_hash`.
- Never store plaintext passwords.
- Never encrypt passwords as a substitute for password hashing.
- Never use plain SHA-256, MD5, or another fast hash as the password-storage algorithm.
- Never log passwords or return hashes in API responses.
- Support long passphrases and password-manager pasting. Do not silently truncate passwords.
- Validate password length safely and consistently.

Do not introduce a second password-hashing framework unnecessarily.

### 5.2 Authentication session strategy

Use **opaque, high-entropy, server-side sessions**, stored in PostgreSQL, instead of placing long-lived JWTs or session credentials in `localStorage`.

The expected process is:

1. Generate a cryptographically secure, unpredictable session token after successful authentication.
2. Store only a cryptographic hash of the token in the `user_sessions` table.
3. Return the raw token only through an appropriately configured browser cookie.
4. On subsequent requests, read the session cookie, hash its token, and look up the matching session in PostgreSQL.
5. Verify that the session exists, is not revoked, and has not expired.
6. Verify that the associated account is still active.
7. Retrieve the user's current role from the database.
8. Reject unauthorized requests even if the browser previously authenticated successfully.

Configure cookies appropriately:

- `HttpOnly` to prevent JavaScript access to the session cookie.
- `Secure` for production HTTPS deployments.
- An appropriate `SameSite` policy.
- A restrictive cookie path and scope.
- Explicit session expiration.
- Session regeneration after authentication to prevent session fixation.

Local HTTP development may require `Secure=false` on localhost only. Production must use HTTPS and secure cookies. Do not weaken production settings to make local development work.

Use CSRF protection appropriate to cookie-based authentication, including origin validation and a proper CSRF token mechanism for state-changing requests. Configure CORS with explicitly permitted frontend origins and credentials rather than permitting every origin.

Support immediate session revocation on logout and session invalidation when accounts are disabled. Use sensible idle and absolute session lifetimes, and document the choices.

### 5.3 Authentication abuse protection

Implement protections against brute-force attempts, credential guessing, and account enumeration.

Requirements:

- Apply rate limiting to login attempts using appropriate account and client-request context.
- Use a bounded failed-login policy and temporary throttling or lockout with recovery, without enabling permanent attacker-induced lockouts.
- Ensure attempts against nonexistent email addresses are also subject to protections.
- Use generic authentication failure responses that do not reveal whether an account exists, has the wrong password, is locked, or is disabled.
- Avoid unnecessarily different responses or processing behavior that makes account enumeration easier.
- Update relevant account security state atomically using database transactions where necessary.
- Log security events without logging passwords, raw session tokens, or other secrets.
- Never treat frontend validation as a substitute for backend validation.

Choose a suitable implementation for the current architecture. Do not rely exclusively on process-local rate-limit counters if they would cease to work when the application restarts or runs multiple instances.

---

## 6. Database schema and metadata

Create the following tables using SQLAlchemy models and Alembic migrations.

### 6.1 `users` table

This table stores user identity, credentials, role, account lifecycle, and authentication-related metadata.

| Column | Type | Constraints and purpose |
|---|---|---|
| `id` | UUID | Primary key; generated uniquely by the database. |
| `full_name` | VARCHAR(150) | Required display name. |
| `email` | VARCHAR(320) | Required login identifier. Enforce uniqueness without regard to case. |
| `password_hash` | TEXT | Encoded Argon2id hash; nullable only when an account is pending activation and has not yet set a password. |
| `role` | VARCHAR(20) or an equivalent constrained type | Only `ADMIN` and `EMPLOYEE` are permitted initially. |
| `account_status` | VARCHAR(20) or an equivalent constrained type | Support `PENDING`, `ACTIVE`, `SUSPENDED`, and `DISABLED`. |
| `email_verified_at` | TIMESTAMPTZ | Nullable timestamp recording email verification. |
| `last_login_at` | TIMESTAMPTZ | Nullable timestamp updated after successful authentication. |
| `created_at` | TIMESTAMPTZ | Required creation timestamp. |
| `updated_at` | TIMESTAMPTZ | Required update timestamp. |
| `password_changed_at` | TIMESTAMPTZ | Nullable timestamp of the most recent password change. |
| `created_by` | UUID | Nullable self-referencing foreign key to `users.id`; null for the bootstrapped initial administrator. |
| `failed_login_attempts` | INTEGER | Nonnegative security counter, defaulting to zero. |
| `locked_until` | TIMESTAMPTZ | Nullable timestamp used by the temporary account-throttling policy. |
| `must_change_password` | BOOLEAN | Required flag, defaulting to false; supports future administrative password-reset policies. |

Database constraints and indexing:

- A primary key on `id`.
- A unique case-insensitive email index, for example a unique index on `lower(email)`.
- A constraint allowing only the two defined initial roles.
- A constraint permitting only the four defined account statuses.
- A constraint preventing an account from being `ACTIVE` when `password_hash` is null.
- A nonnegative constraint on `failed_login_attempts`.
- A self-referencing foreign key for `created_by`, with safe deletion behavior.

Normalize emails consistently in the backend before insertion and lookup. Treat email as the account identifier; do not add a separate `username` column.

Keep all timestamps timezone-aware and store them consistently, preferably in UTC.

Do not rely only on application-level validation for uniqueness or allowed role values. Enforce important invariants in the database too.

### 6.2 `user_sessions` table

Create a separate table for active and historical login sessions.

Suggested fields:

- `id`: UUID primary key.
- `user_id`: foreign key to `users.id`.
- `session_token_hash`: unique hash of the random session token; never store the raw cookie token.
- `created_at`: timestamp.
- `expires_at`: timestamp.
- `last_seen_at`: nullable timestamp.
- `revoked_at`: nullable timestamp.
- `ip_address`: optional client address if appropriate for the deployment and privacy requirements.
- `user_agent`: optional, length-limited client metadata.

Index the identifiers needed for efficient session lookup and revocation.

Ensure that expired or revoked sessions cannot authenticate a request.

### 6.3 `auth_events` table

Create an authentication-event log that supports security investigation.

Record relevant events such as:

- Successful login.
- Failed login.
- Logout.
- Account throttling or temporary lockout.
- Session revocation.
- Authentication rejection due to an inactive account.

Suggested fields:

- `id`: UUID primary key.
- `user_id`: nullable foreign key to `users.id`.
- `event_type`: constrained event name.
- `occurred_at`: timestamp.
- `ip_address`: optional client address.
- `user_agent`: optional, length-limited client metadata.
- `details`: optional JSON metadata containing only sanitized, non-secret information.

Do not write passwords, raw session tokens, database credentials, or secret values to logs.

Avoid unnecessarily storing raw email addresses from failed attempts against unknown users. If correlation is needed, use appropriately protected identifiers and explain the privacy trade-off.

Use suitable indexes for querying events by user, event type, and timestamp.

If a separate table is genuinely needed for rate limiting or login attempts, explain why and avoid duplicating the same information unnecessarily.

---

## 7. Database initialization and Alembic migrations

The PostgreSQL database currently may not have any application tables.

Inspect the current Alembic state before proceeding. If Alembic is not initialized, configure it correctly. If it already exists, reuse and repair the existing configuration rather than creating duplicate migration systems.

Requirements:

1. Configure SQLAlchemy using the existing `app/db/session.py` or the equivalent file already present.
2. Load the local database password from `D:\suredocs\secrets\suredocs_app_password.txt` without logging or displaying it.
3. Build database URLs safely, including handling special characters in passwords.
4. Use the `suredocs_app` account for ordinary application database access and migrations when its current grants support the operation.
5. Use the correct database hostname for the execution context: localhost for a backend running on Windows and the Docker service hostname if the backend runs inside Compose.
6. Configure Alembic to import all relevant SQLAlchemy model metadata.
7. Generate a migration that creates the required tables, constraints, indexes, and foreign keys.
8. Inspect the autogenerated migration before applying it.
9. Apply the migration with Alembic and verify the resulting schema.
10. Never use `Base.metadata.create_all()` as a replacement for the migration system.
11. Do not execute destructive database resets, delete volumes, or drop existing objects as part of initialization.

If privileges are missing, report the exact issue and use the least-privileged safe correction. Do not automatically grant superuser privileges to the application account.

---

## 8. Bootstrap the initial administrator securely

The application database is expected to be empty, so there may be no administrator who can log in yet.

Implement a secure, local-only administrator-bootstrap command, such as:

`python -m app.cli create-admin`

Adapt the command to the existing project structure.

Requirements:

- Require an explicit command executed by a developer or administrator with local database access.
- Ask interactively for the administrator's full name, email, and password.
- Read the password without displaying it in the terminal.
- Validate and confirm the password according to the configured policy.
- Hash it using Argon2id.
- Create an `ADMIN` account with `ACTIVE` status.
- Mark the email as verified only because the account is being created through this trusted bootstrap procedure.
- Allow `created_by` to be null for this initial administrator.
- Refuse to create a duplicate account.
- Refuse to create additional bootstrap administrators once an administrator exists, unless a separately designed and explicitly authorized administrative workflow is used.
- Never hardcode a default email/password pair.
- Never implement a public endpoint that allows an unauthenticated visitor to register as an administrator.
- Never print or log the supplied password.

Provide exact instructions for running the bootstrap command after applying the migrations.

The employee invitation and account-activation workflow will be a later feature. Do not invent temporary passwords or email-delivery success in this phase.

---

## 9. Backend API endpoints

Implement and document at least the following endpoints, adapting route prefixes to the existing application conventions.

### `POST /api/auth/login`

Accept a JSON request containing:

- `email`
- `password`

Processing sequence:

1. Validate the request structure and input sizes.
2. Normalize and validate the email according to the chosen application policy.
3. Apply login throttling.
4. Look up the corresponding user using a safe SQLAlchemy query.
5. Verify the supplied password using Argon2id.
6. Check that the account is active and that any required activation or verification conditions have been met.
7. Reject locked or otherwise ineligible accounts.
8. Increment or reset the relevant failed-login counters transactionally.
9. Record a sanitized authentication event.
10. On success, generate and store a new server-side session.
11. Update `last_login_at`.
12. Set the correctly configured session cookie.
13. Return only a safe user representation containing the user's ID, full name, email, and role.

Never return `password_hash`, session-token hashes, security counters, or internal credential details to the frontend.

Use consistent failure responses so the caller cannot distinguish an unknown email from an incorrect password or an ineligible account.

### `GET /api/auth/me`

Return the currently authenticated user's safe profile and current role using the server-validated session.

Reject the request if:

- No session cookie is present.
- The session token is invalid.
- The session has expired.
- The session has been revoked.
- The associated account is suspended or disabled.
- The account no longer meets the application's authentication requirements.

Do not trust a role or user ID provided by the browser to identify the authenticated user.

### `POST /api/auth/logout`

Requirements:

- Require a valid session, or handle repeated logout safely.
- Revoke the current session in PostgreSQL.
- Expire the browser session cookie with matching cookie attributes.
- Return an appropriate success response.
- Ensure the revoked session no longer authorizes protected requests.

### `GET /api/health`

Provide a minimal health endpoint for local diagnostics. Do not disclose database credentials, secrets, detailed internal configuration, or unnecessary infrastructure information.

Add additional endpoints only when required by the existing architecture. Do not create unrelated document-management APIs in this phase.

---

## 10. Protect every frontend route and backend operation

This is a critical requirement.

A frontend route guard is useful for navigation and user experience, but it is not a security boundary.

Implement both frontend navigation protection and backend authorization.

### Frontend behavior

- When an unauthenticated visitor opens the application's root URL, display the login page.
- When an unauthenticated visitor opens an administrator or employee URL directly, redirects to a protected route, refreshes an old URL, or pastes a previously copied URL into the address bar, do not display protected content as an authenticated user.
- Call the backend's current-user endpoint to validate the session before rendering protected routes.
- Preserve an attempted internal destination if helpful, but validate it carefully.
- After successful login, route the user to the correct interface based on the authenticated user's role.
- Do not permit an arbitrary external redirect URL.
- On page refresh, restore the login state only after the backend validates the cookie.
- If session validation fails, clear client-side authentication state and return to the login page.
- Do not trust a role stored in local storage, session storage, URL parameters, React state alone, or a request body.
- Do not store the session token in local storage or session storage.
- Do not treat hiding a button or page as sufficient authorization.

### Backend behavior

- Protect every authenticated API route using reusable authentication dependencies or equivalent middleware.
- Obtain the user identity from the validated session record.
- Check the user's current account status on protected requests.
- Enforce administrator-only and employee-specific permissions server-side.
- Return appropriate `401 Unauthorized` or `403 Forbidden` responses.
- Reject requests with forged user IDs or roles.
- Do not assume that visiting the login page once makes future requests authenticated.
- Ensure deactivating an account or revoking a session prevents further protected access.

For future development, make the authorization mechanism reusable across document upload, viewing, downloading, sharing, permission revocation, and administrative routes.

---

## 11. Preserve and connect the existing login UI

Inspect the existing login interface before making any changes.

Do not redesign the page. Preserve its current layout, Tailwind CSS styling, typography, colors, assets, responsive behavior, and visual identity.

Connect the actual UI controls to the working backend.

At minimum:

- The email input accepts and validates a work email.
- The password input validates required input without exposing the password.
- The password visibility toggle, if present, works correctly.
- The login button submits the actual authentication request.
- Enter-key submission works.
- The login button shows an appropriate loading state during submission.
- Repeated submissions are prevented while a request is in progress.
- Authentication errors appear in the existing design without exposing internal information.
- Successful login obtains the authenticated user from the backend and navigates according to the stored role.
- A page refresh correctly restores or rejects the session.
- Network and server errors are handled gracefully.
- Existing form controls and keyboard accessibility are retained.

Use the project's existing HTTP client and routing conventions if they are appropriate. Do not add duplicate Axios/fetch clients or conflicting router systems unnecessarily.

Configure credentials correctly for cookie-based authentication. Apply explicit CORS settings for the actual local frontend origin and production configuration when appropriate.

If the login page displays additional controls such as password recovery, social login, or SSO, inspect them individually. Do not make a button pretend to succeed when its backend feature or required provider configuration does not exist. Clearly identify any control that requires a separate implementation or an external service that has not yet been configured.

Do not implement the entire document-sharing frontend in this phase; focus on the authentication experience and the routes that must be protected.

---

## 12. Automated tests and security verification

Use pytest and the project's existing testing conventions. Add tests for the authentication logic, database behavior, sessions, and frontend integration to the extent supported by the current project.

Do not run destructive tests against the development database. Use an isolated test database or appropriately isolated test setup. Document the test database configuration, and never drop or reset the existing development database to make tests pass.

Test at least the following cases:

### Credential verification

1. Correct email and password for an active employee.
2. Correct email and password for an administrator.
3. Incorrect password.
4. Email address that does not exist.
5. Invalid email input.
6. Empty email or password.
7. Case and whitespace normalization of the email identifier.
8. Duplicate email creation with different letter casing.
9. Missing password hash for an otherwise active account.

### Account eligibility

10. Pending account cannot log in.
11. Suspended account cannot log in.
12. Disabled account cannot log in.
13. Locked or throttled account cannot bypass the configured protection.
14. Updating an account's status prevents further authenticated access.

### Session lifecycle

15. Successful login creates a server-side session and sets the appropriate cookie.
16. Session validation succeeds for a valid session.
17. Missing, invalid, expired, and revoked sessions are rejected.
18. Logout revokes the session and clears the cookie.
19. A logged-out user cannot regain access by reusing an old cookie.
20. An unauthorized user cannot access administrator-only API operations.
21. Tampering with client-side role data cannot elevate privileges.
22. A database role/status change is respected on subsequent protected requests.
23. CSRF and origin protections behave as configured.

### Login abuse and information disclosure

24. Rate limiting and the failed-login policy operate correctly.
25. Login errors do not disclose whether an account exists.
26. Logs and API responses do not expose passwords, stored password hashes, raw session tokens, or secrets.
27. Database inputs are safely parameterized.
28. No public administrator-registration endpoint exists.

Also test the React login form, session restoration, logout, and direct navigation to protected routes using the testing framework already installed in the frontend, if available.

If the project has no frontend test framework, explain what is missing and add only what is necessary for meaningful coverage.

Do not claim that a test passes unless you actually ran it and observed the result.

---

## 13. Dependencies, source control, and production readiness

Inspect the existing dependency files and installed packages before modifying them.

- Keep the current virtual environment.
- Add only necessary dependencies.
- Keep runtime requirements and development/test requirements organized according to the existing project conventions.
- Do not introduce unnecessary authentication frameworks.
- Never use a placeholder implementation for a security-critical function.
- Never disable authentication, CORS, CSRF, or session checks merely to make the integration work.
- Never create hardcoded administrator accounts or default production passwords.
- Never expose local secrets to the frontend.
- Keep `secrets/`, virtual environments, cache files, and other sensitive local artifacts out of Git.
- Do not overwrite the current login page or unrelated modules wholesale.

Use configuration suitable for local development while ensuring production settings require HTTPS, secure cookies, real secret-management configuration, and explicit permitted frontend origins.

Document any deployment-specific differences that must be configured before production use.

---

## 14. Required implementation workflow

Complete the work in this order:

1. Inspect the repository, current UI, existing routes, database connection, Docker Compose configuration, dependency files, migrations, and tests.
2. Summarize the current architecture and identify any blockers.
3. Design and create the SQLAlchemy models for `users`, `user_sessions`, and `auth_events`, plus any additional supporting table genuinely needed.
4. Configure Alembic and create the database migration.
5. Apply the migration safely to the existing `suredocs` database.
6. Implement secure password hashing, login verification, session creation and validation, logout, login abuse protection, audit events, and the initial-administrator bootstrap command.
7. Implement authentication dependencies and role-based API protection.
8. Connect the existing React login page and protected routes to the new backend.
9. Run database connectivity checks, migrations, automated backend tests, and frontend tests available in the project.
10. Debug failures rather than ignoring them.
11. Review the implementation for credential exposure, unauthorized route access, privilege escalation, insecure session handling, and other obvious security defects.
12. Report the files created or modified, the commands used, the tests that actually passed or failed, how to create the initial administrator, and how to run the application locally.

If a necessary change cannot be completed because a package, configuration, credential, email provider, or external service is unavailable, explain the exact blocker and implement the remaining independent work safely.

Never delete database volumes, reset the database, or destroy existing user data during debugging.

---

## 15. Final acceptance criteria

This phase is complete only when the following behavior has been implemented and verified:

- The existing SureDocs login page is connected to a real FastAPI backend.
- The required database tables have been created through Alembic migrations.
- The database stores Argon2id password hashes, not plaintext passwords.
- An administrator can be created through the controlled bootstrap process.
- Valid active users can authenticate using their work email and password.
- Authentication resolves the correct user and role from PostgreSQL.
- Administrators and employees are routed to their correct existing interfaces.
- Unauthenticated users cannot access protected API operations.
- Direct navigation to protected frontend URLs does not bypass authentication.
- Session expiry, revocation, logout, and inactive-account rejection work correctly.
- The authentication system does not trust client-supplied roles.
- Appropriate rate limiting, error handling, CSRF protection, and security logging are in place.
- The login page's relevant controls work without redesigning the existing UI.
- Database connection, migration, authentication, and authorization tests have been run, and their actual results are reported.
- No secrets or hardcoded credentials have been committed or exposed.

At the end, provide a clear technical summary of what was implemented and identify the next development phase. Do not start implementing document upload, document sharing, email invitations, or unrelated application buttons until the authentication phase is implemented and its tests have been reviewed.


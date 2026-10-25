# SureDocs

SureDocs is a secure document-sharing platform with a FastAPI backend, SQLAlchemy data model, PostgreSQL database, and React frontend.

## Local setup

1. Install Python dependencies in the backend virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Install frontend dependencies:
   ```bash
   cd ..
   npm install
   ```
3. Copy the environment template and fill in local values:
   ```bash
   cp .env.example .env
   ```
4. Start Docker Compose services (PostgreSQL and ClamAV):
   ```bash
   docker compose up -d
   ```
   To start only ClamAV:
   ```bash
   docker compose up -d clamav
   ```
   Verify scanner health and status:
   ```bash
   docker compose ps clamav
   docker inspect --format='{{json .State.Health}}' suredocs-clamav-1
   ```
   Inspect ClamAV daemon and freshclam logs:
   ```bash
   docker compose logs -f clamav
   ```
5. Ensure the database is running and the `suredocs_app` password file exists under `secrets/`.
6. Apply migrations:
   ```bash
   cd backend
   . .venv/bin/activate
   alembic upgrade head
   ```
7. Bootstrap the initial admin account if needed:
   ```bash
   python -m app.cli create-admin
   ```

## Neon PostgreSQL and Object Storage

The backend can use Neon's pooled PostgreSQL connection for application queries and
Neon's S3-compatible private Object Storage without changing the existing SQLAlchemy
or `boto3` data-access layers.

After linking and deploying the Neon branch, pull its variables into the ignored
`.env.local` file:

```bash
neon env pull --file .env.local --service postgres --service object-storage
```

Local backend startup loads `.env.local`. `DATABASE_URL` is used for normal database
traffic; Alembic uses the direct `DATABASE_URL_UNPOOLED` connection. The storage
credentials, endpoint, and region use Neon's AWS-compatible environment variables.
The app uses the private `assets` bucket when a Neon S3 endpoint is configured.

Run `alembic upgrade head` from `backend/` to apply the schema. This creates or updates
the schema only; it does not copy users, documents, audit events, or S3 objects from
the local development services. A new Neon database therefore needs an explicitly
approved data migration and initial account setup before users can sign in.

For a Vercel deployment, add the Neon variables to the backend project's environment
settings rather than committing `.env.local`. Also configure a stable `SESSION_SECRET`,
`SUREDOCS_CORS_ORIGINS` with the verified frontend origin, and
`SUREDOCS_SECURE_COOKIES=true`. Keep both Neon credentials and AWS-compatible storage
credentials in the backend environment only.

## Temporary bulk import utility

The bulk-import script is intentionally separate from the normal document upload flow. It is meant for the existing local documents library under the project root and is not run automatically on app startup.

```bash
cd /path/to/suredocs
python scripts/bulk_import_documents.py --owner-email admin@example.com
```

Optional flags:

- `--documents-root` to point at a custom local folder
- `--manifest` to use a custom CSV manifest
- `--dry-run` to preview imports without writing to S3 or the database

The script:

- discovers supported files recursively under `documents/`
- reads metadata from `documents/manifest.csv` when available
- validates that a real active user owns imported records
- uploads files to the configured private S3 bucket
- stores metadata and S3 references in the SQLAlchemy document tables
- avoids duplicate imports by checking the file checksum and owner
- logs uploaded, failed, and skipped files and prints a final summary

## Run the application

```bash
cd backend
. .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
npm run dev
```

Then open `http://localhost:5173`.

## Verify upload and antivirus scanning behavior

- Run the automated test suite covering ClamAV integration, quarantine, fail-closed handling, and EICAR detection:
  ```bash
  cd backend
  . .venv/bin/activate
  pytest tests/test_clamav_e2e.py -v
  ```
- Upload a clean document from the web UI and confirm it passes scanning and is promoted to trusted storage.
- Upload an EICAR test string (`eicar.txt`) and confirm the upload is blocked with `Upload blocked: the file failed the security scan.` and quarantined.
- Re-run the bulk import script to verify it skips already imported documents instead of creating duplicates.

## Notes

- AWS credentials must come from the standard AWS credential chain or environment configuration; do not hardcode secret values in code.
- Database credentials are expected to live under `backend/secrets/` or environment variables, not in the repository.
- The bulk import script does not automatically run during normal startup.

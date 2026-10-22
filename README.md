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
4. Ensure the database is running and the `suredocs_app` password file exists under `secrets/`.
5. Apply migrations:
   ```bash
   cd backend
   . .venv/bin/activate
   alembic upgrade head
   ```
6. Bootstrap the initial admin account if needed:
   ```bash
   python -m app.cli create-admin
   ```

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

## Verify upload behavior

- Upload a document from the web UI and confirm it appears in the real document list.
- Confirm the file is stored in the configured private bucket and the database record references the correct bucket/object key.
- Re-run the bulk import script to verify it skips already imported documents instead of creating duplicates.

## Notes

- AWS credentials must come from the standard AWS credential chain or environment configuration; do not hardcode secret values in code.
- Database credentials are expected to live under `backend/secrets/` or environment variables, not in the repository.
- The bulk import script does not automatically run during normal startup.

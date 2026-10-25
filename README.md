# SureDocs

SureDocs is a secure document-management workspace for organizations. Employees can upload, organize, and access documents according to explicit permissions; administrators can manage users, access controls, security scans, and audit activity.

## Demo accounts

Use these credentials only for the provisioned SureDocs demo environment. Do not reuse these passwords for personal or production accounts.

| Role | Login ID | Password |
| --- | --- | --- |
| Demo Admin | `admin@suredocs.test` | `SdTest-pO%LBVMdbZzpaS8VR01V!n` |
| Demo Employee | `sanjay.kumar.0021@suredocs.test` | `SdTest-QYVuH%RlcoaPwy@5OMw@jy` |

The local seeding command below creates separate local-only demo accounts and generates their passwords in ignored files under `secrets/`; those accounts are distinct from the demo accounts listed above.

## Technology stack

<p>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white"></a>
  <a href="https://vite.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white"></a>
  <a href="https://www.python.org/"><img alt="Python" src="https://img.shields.io/badge/Python-3.11%2B-3776ab?logo=python&logoColor=white"></a>
  <a href="https://fastapi.tiangolo.com/"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white"></a>
  <a href="https://www.postgresql.org/"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-18-4169e1?logo=postgresql&logoColor=white"></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white"></a>
  <a href="https://www.clamav.net/"><img alt="ClamAV" src="https://img.shields.io/badge/ClamAV-Antivirus-d71920"></a>
  <a href="https://aws.amazon.com/s3/"><img alt="Amazon S3 compatible storage" src="https://img.shields.io/badge/Object%20storage-S3%20compatible-569a31?logo=amazons3&logoColor=white"></a>
</p>

| Area | Technology |
| --- | --- |
| Web application | React 19, Vite 8, Tailwind CSS |
| API | Python, FastAPI, Pydantic |
| Persistence | PostgreSQL, SQLAlchemy, Alembic |
| Document storage | Private S3-compatible object storage (AWS SDK / Boto3) |
| Upload security | ClamAV malware scanning |
| Local services | Docker Compose |

## What the application does

- Provides role-aware admin and employee workspaces.
- Supports document upload, metadata, versions, previews, and access-controlled downloads.
- Lets document owners grant, change, expire, or revoke view, download, and edit permissions.
- Supports employee access requests and owner decisions.
- Records document and authentication activity for audit and security monitoring.
- Scans uploaded content with ClamAV; uploads are not made available when a clean scan verdict cannot be confirmed.

## Application workflow

1. A user signs in. The API verifies the account and creates an HTTP-only session cookie.
2. The employee workspace lets the user find documents, upload a new document, or request access to another owner's document.
3. The API validates the file and its metadata, records a pending version, stores the upload in private quarantine storage, and sends the content to ClamAV.
4. A clean file is promoted from quarantine to trusted private object storage. Document metadata, version and scan state, and relevant audit events are stored in PostgreSQL.
5. If a scan detects malware or cannot return a trustworthy verdict, the upload is not made available as a clean document; infected versions are marked quarantined and scanner failures remain pending.
6. Owners manage grants directly or review access requests. Each document read or download is authorized against the current grant and recorded as appropriate.
7. Administrators manage accounts, review audit activity, and monitor document scans and security events.

### Architecture diagram

```mermaid
flowchart LR
    User[Admin or employee] --> Browser[React app in the browser]
    Browser -->|HTTPS / JSON API and session cookie| API[FastAPI application]
    Browser -. local development /api proxy .-> API
    API --> Auth[Authentication and authorization]
    API --> DB[(PostgreSQL\nSQLAlchemy + Alembic)]
    API --> Scan[ClamAV scanner]
    API --> Store[(Private S3-compatible\nobject storage)]
    API --> Audit[Audit and activity records]
    Audit --> DB
    Auth --> DB
```

### Document upload and access data flow

```mermaid
flowchart TD
    A[User selects a document] --> B[Browser sends authenticated upload]
    B --> C[FastAPI checks session, permission, file type, size, and content]
    C -->|Invalid or unauthorized| X[Reject request]
    C -->|Valid| D[Save pending document metadata and version]
    D --> E[Store upload in private quarantine storage]
    E --> F[ClamAV scans file bytes]
    F -->|Infected or scanner unavailable| Y[Keep unavailable and record scan outcome]
    F -->|Clean verdict| G[Promote to trusted private object storage]
    G --> H[Finalize version, checksum, and audit state in PostgreSQL]
    H --> I[Owner grants access or employee requests it]
    I --> J[API records the decision and updates permission state]
    J --> K[Authorized user requests view or download]
    K --> L[API checks current permission and reads the private object]
    L --> M[Return document content and record activity]
```

## Local setup (Windows PowerShell)

### Prerequisites

- Git
- Node.js 20.19+ or 22.12+
- Python 3.11+
- Docker Desktop with Docker Compose
- An S3-compatible bucket and credentials for actual document uploads

From the repository root, create local-only secrets and copy the environment template:

```powershell
New-Item -ItemType Directory -Force .\secrets | Out-Null
@('postgres_password.txt', 'pgadmin_password.txt', 'suredocs_app_password.txt') |
  ForEach-Object {
    $path = Join-Path .\secrets $_
    if (-not (Test-Path $path)) {
      $secret = python -c "import secrets; print(secrets.token_urlsafe(32))"
      Set-Content -NoNewline -Encoding ascii -Path $path -Value $secret
    }
  }
Copy-Item .\.env.example .\.env
```

Start PostgreSQL and ClamAV:

```powershell
docker compose up -d db clamav
docker compose ps
```

For a new local database, create the application role using the generated password file. This runs SQL inside the database container; it does not print the password:

```powershell
$appPassword = (Get-Content .\secrets\suredocs_app_password.txt -Raw).Trim()
$sql = @"
CREATE ROLE suredocs_app LOGIN PASSWORD '$appPassword';
ALTER DATABASE suredocs OWNER TO suredocs_app;
"@
$sql | docker compose exec -T db psql -U suredocs_admin -d suredocs
```

Install Python dependencies, apply migrations, and optionally create local demo users:

```powershell
Set-Location .\backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
alembic upgrade head
python -m app.cli seed-demo-users --confirm-development
```

If PowerShell blocks virtual-environment activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again. The local demo-user command only runs against the explicitly identified local development database. It creates `admin.demo@example.com` and `employee.demo@example.com`; their generated passwords are kept in `secrets/demo_admin_password.txt` and `secrets/demo_employee_password.txt`. Those accounts are separate from the demo IDs listed above.

Before uploading documents, configure credentials for the S3-compatible bucket through the standard AWS credential chain (for example, `aws configure`) or environment variables. The backend reads `SUREDOCS_S3_BUCKET` and `SUREDOCS_AWS_REGION` from `.env`; for a custom S3-compatible endpoint, also set `AWS_ENDPOINT_URL_S3`. Do not put storage credentials in source control.

Start the API in the activated backend terminal:

```powershell
uvicorn app.main:app --reload --port 8000
```

In a second terminal at the repository root, install and start the frontend:

```powershell
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The local Vite setup proxies API requests to `http://127.0.0.1:8000`. FastAPI's interactive API reference is available at [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs).

## Configuration and deployment notes

- `.env.example` documents the local backend settings. The app database password is read from `secrets/suredocs_app_password.txt` unless `DB_PASSWORD` is set.
- `.env`, `.env.local`, and `secrets/` are local-only. Never commit environment files, credentials, or generated demo passwords.
- For Neon, pull the PostgreSQL and Object Storage settings into the ignored `.env.local` file with `neon env pull --file .env.local --service postgres --service object-storage`. The backend uses `DATABASE_URL` for application traffic and `DATABASE_URL_UNPOOLED` for Alembic migrations. Migrations create/update the schema; they do not migrate users, documents, audit events, or stored objects.
- For cross-site production frontends, set the backend's exact `SUREDOCS_CORS_ORIGINS`, a stable `SESSION_SECRET`, `SUREDOCS_SECURE_COOKIES=true`, and `SUREDOCS_COOKIE_SAMESITE=none`. Keep database and object-storage credentials in backend deployment settings only.
- The optional bulk import tool is not run at startup. Preview before importing with `python scripts/bulk_import_documents.py --owner-email admin@example.com --dry-run`; see the script's `--help` output for the manifest and documents-root options.

## Checks

From the repository root:

```powershell
npm run lint
npm run build
```

From `backend/` with the virtual environment active:

```powershell
pytest
pytest tests/test_clamav_e2e.py -v
```

The end-to-end ClamAV tests require the scanner service and validate clean, infected, and unavailable-scanner behavior.


# SureDocs

SureDocs is a React, JavaScript, Vite, and Tailwind CSS application.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The sign-in screen is at `/`, and the administrator dashboard preview is at `/admin`.

## Administrator dashboard preview

The dashboard includes mock account and document metrics, activity trends, recent audit events, and example platform health indicators. The chart can be switched between line, bar, and table formats and filtered to today or the last 10, 30, or 90 days.

User management includes a searchable, sortable mock account list; status and role filters; pagination; user detail and activity views; and a create/invite form. Mock account records are stored in this browser so dashboard and user totals stay in sync. Account status changes and invitations are preview-only. No email is delivered, and generated temporary passwords are not persisted or sent.

The document registry at `/admin/documents` includes mock document metrics, search and metadata filters, pagination, and a details view with permissions, audit activity, and history tabs. Document metadata does not expose or download file contents. Permissions, audit logs, and security monitoring remain navigation placeholders for later implementation. The dashboard and document registry are not connected to a backend, and `/admin` is not protected by authentication or role-based access control. Do not use the mock data as production information.

## Checks

```sh
npm run lint
npm run build
```

# Prompt — Integrate Amazon S3 with the SureDocs Backend and Implement Document Authorization

## 1. Objective

Inspect the existing SureDocs codebase and integrate Amazon S3 as the document storage layer. Connect S3 with the existing backend and PostgreSQL database so the application can store actual document files, maintain their metadata, and securely retrieve documents when authorized users request access.

Implement backend authorization checks that verify the authenticated user's permission to access a specific document before retrieving the corresponding object from S3.

**Important:** Extend the existing application rather than rebuilding it. Preserve the current authentication system, database schema, API conventions, and authorization architecture wherever possible.

## 2. Inspect the Existing Project

Before making changes, inspect:

- The existing backend framework and project structure.
- Current authentication and session-management implementation.
- PostgreSQL database connection and document metadata models.
- Existing document upload and retrieval endpoints.
- Existing document-level permission models and authorization services.
- Current AWS configuration and S3 client dependencies.
- Existing audit logging and error-handling mechanisms.
- Environment-variable configuration and development setup.

Identify the appropriate integration points and reuse existing services and models.

Do not create duplicate database tables, APIs, or permission systems unnecessarily.

## 3. Amazon S3 Integration

Configure Amazon S3 as the storage location for actual document files.

Requirements:

- Use the existing or designated private S3 bucket.
- Configure AWS access through environment variables, an IAM role, or the project's established credential provider.
- Never hardcode AWS access keys or secret keys in source code.
- Never expose AWS credentials to the frontend.
- Keep the S3 bucket private.
- Use a consistent object-key strategy for identifying stored files.
- Associate each document's S3 object key with its corresponding PostgreSQL metadata record.
- Handle missing objects, permission errors, network failures, and unsuccessful uploads.
- Avoid exposing internal bucket names, object keys, or infrastructure details unnecessarily in user-facing responses.

Use the existing AWS SDK and dependencies where possible.

## 4. Document Metadata in PostgreSQL

Store document metadata in the existing database, while storing the actual file contents in S3.

Reuse the existing schema. Where the corresponding fields already exist, ensure the application can identify:

- Document ID.
- Original filename.
- File type or MIME type.
- File size.
- Document owner or uploader.
- Document category and description, when supported.
- Upload and modification timestamps.
- S3 object key.
- Document status.
- Relevant ownership and permission relationships.

The backend must determine trusted ownership and storage information. Do not trust client-supplied owner IDs, arbitrary object keys, or privileged metadata.

Keep database records and S3 objects consistent during successful operations and failures.

## 5. Document Upload

Implement or extend the existing upload endpoint to:

1. Authenticate the requester.
2. Validate the uploaded file and enforce configured size and file-type restrictions.
3. Determine the document owner from the authenticated identity and applicable application rules.
4. Generate or assign a safe, unique S3 object key.
5. Upload the actual file to S3.
6. Store the associated metadata in PostgreSQL.
7. Return the document metadata required by the frontend.
8. Handle failures without leaving inconsistent database records or orphaned S3 objects.

Do not make documents publicly accessible as a shortcut.

Use the application's existing permission rules to determine who can upload and manage documents.

## 6. Backend Document Authorization

Implement or reuse the backend authorization service to protect document access.

For every document-view or download request:

1. Authenticate the requester through the existing authentication system.
2. Retrieve the trusted document metadata from PostgreSQL.
3. Evaluate the requester's current permission for the specific document.
4. Apply the existing role, ownership, sharing, and document-access rules.
5. Deny requests when the requester lacks the required permission.
6. Only after authorization succeeds, retrieve the corresponding object from S3.
7. Return the file through a secure response mechanism appropriate to the existing architecture.

Do not rely on frontend checks alone.

Do not trust a client-supplied role, owner ID, S3 object key, or permission flag.

Do not retrieve protected document contents before the authorization check.

Use appropriate HTTP responses, including an authorization-denial response such as HTTP 403 when the application's resource-disclosure policy permits it.

Keep viewing, downloading, editing, deleting, and permission-management capabilities distinct where the existing permission model supports them.

## 7. Secure Document Retrieval

Use the existing S3 client and backend service to retrieve authorized documents.

Requirements:

- Retrieve files using the trusted object key associated with the authorized database record.
- Return the correct content type and appropriate response headers.
- Support secure streaming or another existing protected delivery mechanism.
- Avoid loading unnecessarily large files entirely into memory.
- Do not expose permanent public URLs or unrestricted S3 access.
- If presigned URLs are necessary, generate them only after authorization and use an appropriately short expiration period.
- Ensure subsequent requests are subject to the applicable authorization rules.
- Handle missing S3 objects and retrieval failures safely.

The implementation should support the existing document-download functionality and provide a foundation for in-app document viewing.

## 8. Audit Logging

Reuse the existing audit-log service and schema.

Record appropriate events for:

- Successful document access.
- Unauthorized document-access attempts.
- Upload success and failure.
- Download attempts and outcomes where supported.
- Missing S3 objects and relevant storage failures.
- Document deletion and permission changes where supported.

Use the authenticated actor, document identifier, event type, outcome, timestamp, and sanitized error category where available.

Do not record document contents, passwords, AWS credentials, session secrets, or access tokens.

Do not treat an authorization success as proof that file retrieval succeeded.

Ensure denied requests cannot obtain document contents even if audit logging encounters an error.

## 9. Error Handling and Consistency

Handle the following cases:

- Invalid upload requests.
- Unsupported file types.
- File-size violations.
- S3 upload failures.
- PostgreSQL persistence failures.
- Missing document metadata.
- Missing S3 objects.
- Unauthorized document access.
- Expired authentication.
- Network and storage failures.

Use clear error responses and avoid exposing stack traces or sensitive infrastructure details.

Where an upload or deletion fails partway through, implement appropriate cleanup or reconciliation using the existing architecture. Do not silently leave inconsistent records.

## 10. Testing Requirements

Add or extend automated tests using the project's existing testing framework.

Verify:

- Authorized users can upload and retrieve documents.
- S3 object keys match the correct PostgreSQL records.
- Unauthorized users cannot retrieve document contents.
- Modified client-supplied roles do not bypass authorization.
- Revoked permissions are enforced on subsequent requests.
- View permission does not automatically grant download permission.
- Missing S3 objects are handled correctly.
- S3 failures produce appropriate errors.
- Audit events distinguish successful access, denied requests, and technical failures.
- Existing authentication and authorization tests continue to pass.

Use mocked S3 clients or an appropriate isolated test environment where necessary. Do not require production AWS credentials for ordinary unit tests.

Do not claim tests pass unless they have actually been executed.

## 11. Implementation Constraints

- Preserve the existing authentication implementation.
- Preserve the current database and migration strategy.
- Reuse existing APIs and services where appropriate.
- Do not weaken authorization checks.
- Do not make the S3 bucket public.
- Do not expose AWS secrets to the browser.
- Avoid unrelated UI or backend modifications.
- Keep changes focused and maintainable.
- Document any required environment variables and setup steps.

## 12. Final Report

After implementation, report:

1. Files created or modified.
2. How the S3 client is configured.
3. How files and metadata are stored.
4. How the backend verifies document permissions.
5. How authorized files are retrieved from S3.
6. How failures and audit events are handled.
7. Tests executed and their actual results.
8. Any incomplete functionality or remaining security limitations.

**Final instruction:** Integrate Amazon S3 with the existing SureDocs backend to store actual document files and implement server-side document authorization before retrieval. Preserve the current authentication system and database architecture, and verify that unauthorized requests cannot retrieve protected document contents.
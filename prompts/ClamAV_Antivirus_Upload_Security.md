# SureDocs — Integrate ClamAV Antivirus Scanning into Document Uploads

## 1. Objective

Implement production-oriented antivirus scanning using **ClamAV** for every document uploaded to the SureDocs platform.

SureDocs allows administrators and employees to upload documents. Before an uploaded file becomes available for viewing, downloading, sharing, or further processing, the backend must scan it for malware.

The goal is to prevent infected or suspicious files from entering the trusted document repository.

**Important: Do not simply add an antivirus icon or a frontend validation message. Implement actual server-side ClamAV scanning and integrate it into the existing document upload workflow.**

First inspect the current application architecture, backend endpoints, PostgreSQL schema, S3 integration, authentication, authorization, and upload components. Extend the existing implementation without creating a separate or parallel document-management system.

## 2. Run ClamAV in Docker

Integrate ClamAV into the existing Docker Compose environment.

Use an appropriate maintained ClamAV image and configure the following:

- `clamd`: ClamAV scanning daemon.
- `freshclam`: signature database updates, using the image's supported update mechanism.
- A persistent or appropriately managed signature database volume, if required by the selected image.
- Health checks to determine whether the scanner is ready.
- Resource limits suitable for the development environment.
- Private internal Docker networking for communication between FastAPI and ClamAV.

Use the appropriate configuration for the selected ClamAV image. Avoid running conflicting signature-update processes if the image already manages updates.

Requirements:
- Do not expose the ClamAV daemon's port publicly.
- Make it accessible only to the backend and other explicitly authorized internal services.
- Wait for scanner readiness before processing uploads.
- Handle scanner unavailability, signature-update failures, and timeouts safely.
- Never assume that ClamAV is operational merely because its container is running.
- Do not disable malware signature checks to make uploads succeed.

Update the existing `docker-compose.yml` instead of creating an unnecessary separate environment.

Document the required Docker commands to start the scanner, verify its health, and inspect its logs.

## 3. Integrate ClamAV with the Existing Upload Endpoint

Identify the existing document upload API and integrate ClamAV into that endpoint.

For example, if the project uses FastAPI, preserve the existing route and request contract wherever possible.

The upload flow must be:

1. Authenticate the requesting user.
2. Verify the user's account status and authorization to upload.
3. Validate the uploaded file's size, permitted file types, and other applicable upload restrictions.
4. Generate a server-controlled document identifier and safe internal filename.
5. Stream the uploaded file into a controlled temporary or quarantine location.
6. Calculate a cryptographic file hash, such as SHA-256, for integrity tracking.
7. Submit the file to ClamAV for scanning.
8. Wait for a valid scan result or handle the scan asynchronously if the existing architecture requires it.
9. If the file is clean, proceed with normal document storage and metadata processing.
10. If the file is infected, prevent it from entering the trusted document repository.
11. Record the appropriate security event.
12. Return a safe response to the frontend that represents the upload and scanning outcome.

Reuse the existing S3 upload utilities, database models, API response conventions, and authorization dependencies wherever possible.

Do not bypass the existing permission checks during the integration.

## 4. Required Scan Outcomes

Handle each scanner result explicitly.

### A. Clean file

When ClamAV reports that a file is clean:

- Allow the upload to continue.
- Store the file in the existing private S3 document bucket or approved final storage location.
- Create or finalize the appropriate PostgreSQL document metadata.
- Record the scan status as `CLEAN`.
- Record the scan completion timestamp, scanner version where available, and file hash.
- Allow normal document access according to existing document-level permissions.
- Record a successful upload and scan event in the audit trail.

A clean result means that ClamAV did not detect malware; it must not be presented as a guarantee that the file is completely safe.

### B. Infected file

When ClamAV detects malware:

- Block the upload from reaching trusted storage.
- Do not make the file available for viewing, downloading, sharing, or editing.
- Do not grant permissions to an infected file.
- Record the result as `INFECTED`.
- Record the detection name returned by ClamAV, when appropriate, in restricted security metadata.
- Add a security audit event for the blocked upload.
- Return a clear and safe message, such as:

  `Upload blocked: the file failed the security scan.`

Do not disclose unnecessary internal scanner details to ordinary users.

Remove temporary files securely after processing, unless the security team has an explicitly authorized and controlled quarantine-retention policy.

### C. Scanner unavailable or scan error

If ClamAV is unavailable, not ready, times out, or returns an invalid or inconclusive result:

- Do not treat the file as clean.
- Do not publish it to the trusted document repository.
- Mark the scan or upload as `SCAN_FAILED` or `PENDING_SCAN`, as appropriate.
- Preserve enough metadata to support safe retries and operational troubleshooting.
- Return a safe response indicating that the file could not be processed securely.
- Record the failure for administrators or security monitoring.

**Fail closed: an upload must not become accessible until the required scan has completed successfully and returned an acceptable clean result.**

## 5. Amazon S3 Integration

Keep the existing private S3 bucket and document-storage design.

Implement a quarantine-first workflow.

Preferred flow:

1. Upload the initial file to a private quarantine location, such as a dedicated quarantine bucket or a restricted quarantine prefix.
2. Scan the quarantined file with ClamAV.
3. For a clean file, copy or promote it to the application's trusted document location.
4. Verify that the promotion succeeded.
5. Finalize the database metadata and mark the file as clean and available.
6. Remove the temporary quarantine object according to the retention policy.

For an infected file, keep it out of the trusted document location. Remove it from temporary storage or retain it in restricted quarantine only when an approved security-retention process requires that.

Additional requirements:

- Never make the quarantine location publicly accessible.
- Never generate download URLs for files that have not passed scanning.
- Prevent normal document APIs from reading unscanned or infected objects.
- Use least-privilege IAM permissions for quarantine and trusted storage operations.
- Use server-generated S3 object keys rather than trusting user-supplied filenames.
- Handle partial uploads, promotion failures, retries, and database failures consistently.
- Do not mark a document as available before both the required scan and final-storage operation succeed.

Preserve existing S3 encryption and access-control settings.

## 6. PostgreSQL Metadata and Scan Status

Inspect the existing document schema before making any database changes.

Extend the existing document metadata model or add an appropriate related scan-record model using Alembic migrations.

Store the necessary scan information, such as:

- Document ID or upload ID.
- Scan status.
- Original filename, where already supported.
- SHA-256 file hash.
- Scan started timestamp.
- Scan completed timestamp.
- Scanner name and version.
- Detection name, when an infection is detected.
- Safe failure reason or diagnostic reference.
- Scan retry count, if retries are supported.

Use appropriate status values, such as:

- `PENDING_SCAN`
- `SCANNING`
- `CLEAN`
- `INFECTED`
- `SCAN_FAILED`

Adapt these values to the existing application's status conventions instead of introducing unnecessary duplicate fields.

Use database transactions and consistent state transitions wherever possible.

Do not store raw document contents, passwords, AWS credentials, or other sensitive data in scan metadata.

Do not overwrite existing document records unnecessarily or break current database relationships.

## 7. Frontend Upload Experience

Integrate the scan results into the existing SureDocs upload interface without redesigning it.

**Preserve the exact existing colors, fonts, font sizes, spacing, card dimensions, buttons, borders, and overall visual style.**

Use the current upload modal or upload page.

Display the following states using existing UI components and design tokens:

**Uploading**
- Show the existing upload progress indicator, if available.

**Security scanning**
- Display a status such as `Scanning for malware...`.
- Prevent the user from assuming the file is available before scanning completes.

**Upload successful**
- Show the existing success notification or a compatible message, such as `Document uploaded and security scan passed.`

**Infected file**
- Show an error such as `Upload blocked: the file failed the security scan.`
- Do not create a normal, accessible document entry.

**Scanner unavailable**
- Display a suitable message, such as `Security scanning is temporarily unavailable. Please try again later.`

**Pending scan**
- If asynchronous scanning is implemented, display the document as pending and prevent document access until the scan is complete.

If the upload API uses background scanning, provide a status endpoint or reuse the application's existing status-polling mechanism so the UI can track completion.

Do not invent a new color palette. Reuse the existing SureDocs notification and status-badge styles.

## 8. Access Control and Security Enforcement

Scanning must be enforced in the backend, not just the frontend.

Update the relevant document endpoints so that unscanned, infected, or failed-scan files cannot be accessed through alternative routes.

Apply the checks to:

- View and preview.
- Download.
- Sharing and permission grants.
- Signed URL generation.
- Document replacement and version uploads.
- Any other API that returns file contents or provides access to an S3 object.

Enforce the scan-state check alongside existing document ownership, user identity, and document-level permission checks.

Do not treat an administrator role as permission to bypass malware scanning.

A security administrator may inspect scan status and restricted security metadata according to the existing authorization policy, but must not accidentally expose an infected file through a standard document endpoint.

## 9. File Validation and Resource Protection

ClamAV is one layer of file security, not the only control.

Also ensure that:

- The upload size is bounded.
- Allowed file extensions and MIME types are validated.
- File content is checked against the expected file type where applicable.
- Archives and nested archive processing respect appropriate resource limits.
- Temporary-file creation and cleanup are safe.
- Filenames cannot introduce path traversal.
- Scanning and uploading have appropriate timeouts.
- Large files are handled using a suitable streaming or bounded-temporary-storage design.
- Concurrent uploads cannot exhaust memory, disk space, or scanner capacity.
- Scanner errors are distinguished from confirmed clean results.

Do not load arbitrarily large files into memory all at once.

Do not trust the file extension or browser-provided MIME type as proof that the file is safe.

## 10. Audit Trail and Security Monitoring

Integrate scan activity into the existing SureDocs audit and security-monitoring design.

Record appropriate events, such as:

- Upload initiated.
- Malware scan started.
- Malware scan passed.
- Upload blocked because of malware detection.
- Scan failed because the scanner was unavailable or returned an error.
- Clean file promoted into trusted storage.

Record the actor, document or upload ID, timestamp, outcome, and relevant diagnostic information.

Avoid recording passwords, AWS credentials, raw reset tokens, or unnecessary document contents.

Keep frontend mock analytics data separate from actual backend audit records. Do not create fake audit events to simulate successful scans.

## 11. Retries and Recovery

Implement a controlled retry strategy for transient scanner errors.

Requirements:

- Do not retry confirmed infected files automatically as though they were clean.
- Apply retry limits and appropriate backoff.
- Keep the file quarantined while a scan is pending or being retried.
- Ensure that retries do not create duplicate document records.
- Ensure that failed S3 promotions or database updates can be recovered safely.
- Make the workflow idempotent where practical.
- Provide an authorized operational method to inspect and retry failed scans.

For deployments using background workers, ensure the worker can retrieve quarantined files, scan them, and safely finalize the upload.

## 12. Configuration and Environment Variables

Add only the required configuration to the project's environment-based configuration system.

Examples may include:

- ClamAV daemon hostname or service name.
- ClamAV daemon port or socket configuration.
- Scan timeout.
- Upload size limits.
- Quarantine bucket or prefix.
- Maximum permitted retries.

Use the Docker Compose service name for internal communication, not `localhost` from within the backend container.

Do not hardcode AWS access keys or other credentials.

Update `.env.example` with placeholder configuration only. Keep actual secrets out of Git.

## 13. Required Automated Tests

Implement tests using the project's existing test framework.

Include the following cases:

1. A clean test file is scanned and becomes available only after successful promotion.
2. An infected test file is blocked.
3. An unscanned file cannot be viewed or downloaded.
4. A file with `SCAN_FAILED` status remains inaccessible.
5. A scanner timeout blocks publication of the file.
6. A scanner connection failure blocks publication of the file.
7. A file with a misleading extension cannot bypass file validation.
8. A large file is handled within configured resource limits.
9. An S3 promotion failure does not mark the document as available.
10. A database failure does not leave a partially finalized accessible document.
11. Repeated upload requests or retries do not create duplicate document records.
12. Existing authentication and document-permission rules remain enforced.
13. Administrators and employees both undergo scanning when permitted to upload.
14. The frontend displays the correct pending, success, infected, and failure states.
15. Existing document upload, download, and permission workflows continue to work.

Use the standard **EICAR antivirus test file** to validate detection in a controlled test environment. EICAR is a benign antivirus test pattern, not live malware. Confirm that ClamAV detects it and that SureDocs blocks publication of the file.

Never use real malware samples for routine development testing.

## 14. Implementation Deliverables

Make the changes directly in the existing repository.

Provide:

- Updated Docker Compose configuration for ClamAV.
- Backend scanner service or utility.
- Integration with the existing upload endpoint.
- Appropriate PostgreSQL model changes and Alembic migrations, if necessary.
- S3 quarantine and clean-file promotion logic.
- Backend authorization checks based on scan status.
- Frontend scan-status handling within the existing UI.
- Required environment-variable documentation.
- Automated tests for clean, infected, failed, and unavailable-scanner scenarios.
- Updated project setup documentation with commands to start and verify the services.

Do not merely generate a standalone sample scanner or provide pseudocode. Integrate ClamAV into the actual SureDocs document-upload workflow.

## Final Acceptance Criteria

The feature is complete only when:

- ClamAV runs in the existing Docker environment.
- Every document upload passes through server-side scanning.
- Clean files enter trusted storage only after a successful scan.
- Infected files never become available through normal document APIs.
- Unavailable scanners and inconclusive results never result in implicit approval.
- Scan status is stored and enforced consistently.
- S3, PostgreSQL, the upload API, and the frontend work together.
- Existing SureDocs styling and document permissions remain unchanged.
- The EICAR test confirms that an infected-test-pattern upload is blocked.
- Existing application features continue working.

**Final instruction: Security takes priority over upload convenience. Never bypass ClamAV, treat an error as a clean result, or make a document accessible while its scan is pending. Preserve SureDocs's existing UI and architecture, make the smallest necessary changes, and verify the implementation end to end.**
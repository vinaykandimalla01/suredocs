## T-01 — Privilege Escalation Through Client-Supplied Roles

**Threat:** An authenticated user attempts to gain administrator privileges by modifying client-supplied role information in an API request.

**Attack scenario:** An employee intercepts or modifies an API request and changes their role from `employee` to `admin`. If the backend trusts the role supplied by the client, the employee could gain unauthorized administrative privileges.

**Potential impact:** Unauthorized access to administrative functionality and potential compromise of user accounts or other protected resources.

**Existing mitigation:** According to the Phase 1 implementation, SureDocs performs role authorization using the role stored in the database rather than trusting client-supplied role information. The backend also checks the user's current database role so that role changes can affect subsequent authorization decisions.

**Automated test evidence:** The Phase 1 implementation report identifies the following tests in `backend/tests/test_auth.py`:

- `TestRoleAuthorization::test_role_from_database_not_client`
- `TestRoleAuthorization::test_database_role_change_reflected`

The implementation report records both tests as passing.

**Current status:** Implemented — Phase 1 authentication role checks, according to the implementation report.

**Remaining limitation:** These tests establish evidence for the reported authentication role checks. They do not independently prove that every future document-management endpoint enforces document-level permissions. Document access must separately verify the authenticated user's current authorization for the specific document being requested.

**Further verification:** Attempt to access an administrator-only endpoint as an employee while supplying a modified administrator role. The request must remain unauthorized. Verify that removing the relevant server-side role check causes the corresponding test to fail.



# T-02 — Privilege Escalation Through Client-Supplied Roles and Unauthorized Document Access

**Threat:** An authenticated user attempts to gain unauthorized privileges or access confidential documents by manipulating client-supplied role information or requesting documents without the required permissions.

**Attack scenario:** An employee modifies a frontend request to claim the `admin` role or attempts to access a document belonging to another user. If the backend trusts client-supplied role information or fails to validate document-level permissions, the attacker could gain unauthorized administrative access or retrieve confidential document contents stored in Amazon S3.

**Potential impact:** Unauthorized access to administrative functionality, exposure of confidential documents, violations of document confidentiality, and potential compromise of organizational information.

**Existing mitigation:** SureDocs implements database-driven role authorization, using the role stored in the database rather than trusting client-supplied role information. The authentication implementation also checks the current database role so that role changes can affect subsequent authorization decisions.

Additionally, SureDocs integrates Amazon S3 for storing actual document files and PostgreSQL for storing document metadata. Backend document-authorization checks have been implemented to verify the authenticated user's applicable permissions before allowing access to a specific document. The backend is intended to retrieve the corresponding S3 object only after authorization succeeds.

**Automated test evidence:** The Phase 1 authentication implementation report identifies the following tests in `backend/tests/test_auth.py`:

- `TestRoleAuthorization::test_role_from_database_not_client`
- `TestRoleAuthorization::test_database_role_change_reflected`

Both tests were reported as passing. The authentication backend test suite was also reported to pass all 41 tests.

These tests provide evidence for the authentication role checks. Separate document-access integration tests are required to establish that unauthorized requests cannot retrieve S3 object contents.

**Current status:** Partially implemented — database-driven role authorization and backend document-level authorization have been implemented. End-to-end enforcement of document permissions with S3 retrieval must be verified through integration testing.

**Remaining limitation:** Authentication role authorization and document-level authorization protect different resources. Passing the authentication tests does not prove that every document-view, download, or other document-management endpoint correctly checks the user's current permissions. The implementation must also ensure that revoked permissions are enforced and that the frontend cannot bypass backend authorization.

**Further verification:**

1. Attempt to access an administrator-only endpoint as an employee while supplying a modified `admin` role. The backend must deny access.
2. Attempt to view a document without the required permission. The backend must deny the request without returning document contents from S3.
3. Confirm that an authorized user can retrieve and view the actual document.
4. Revoke a user's document permission and verify that subsequent requests are denied.
5. Verify that viewing permission does not automatically grant download permission.
6. Inspect audit records for successful access, denied attempts, and relevant retrieval failures.
7. Run the existing authentication tests and new document-authorization integration tests, recording their actual results.

The threat should be considered adequately mitigated only after both role-based authorization and document-level access enforcement have been verified.



## T-03 — PostgreSQL Transaction Lock Causing Reconciliation Failure

**Threat:** A long-running or abandoned PostgreSQL transaction holds a database lock, preventing SureDocs from committing document ownership and permission reconciliation changes.

**Attack scenario:** A SureDocs operation leaves a PostgreSQL transaction idle in the `idle in transaction` state for more than six minutes while holding a lock on a user row. A subsequent reconciliation operation requires that row to satisfy a document ownership foreign-key constraint and becomes blocked from completing its transaction.

**Potential impact:** Failed reconciliation, delayed document-sharing updates, database resource contention, and inconsistent application state if recovery procedures are implemented incorrectly. Premature termination of unrelated database sessions could interrupt other operations.

**Existing mitigation:** The investigation identified PostgreSQL diagnostic queries using `pg_stat_activity` and `pg_blocking_pids()` to identify blocking sessions, transaction age, session state, and the associated query. The recovery procedure prioritizes identifying the exact blocker and distinguishing abandoned SureDocs transactions from unrelated active sessions before taking corrective action.

**Automated test evidence:** No automated test results have been provided confirming the lock-recovery behavior. Verification should include tests for transaction rollback, foreign-key integrity, reconciliation retries, and duplicate prevention.

**Current status:** Under investigation — the reconciliation dry run passed, but the actual transaction was blocked by an existing PostgreSQL transaction. Successful lock release and reconciliation commit have not yet been confirmed.

**Remaining limitation:** Diagnostic queries identify blocking relationships but do not, by themselves, establish whether a transaction is safe to terminate. The recovery process must verify session ownership and ensure that uncommitted changes are handled appropriately. The reconciliation must also remain safe to retry without duplicating permission grants or changing unrelated ownership records.

**Further verification:** Identify the blocking session and determine whether it belongs to an abandoned SureDocs operation. Release the lock through a controlled rollback or authorized session termination only when safe. Retry the reconciliation and verify that the transaction commits successfully, document ownership foreign keys remain valid, and permission counts match the expected distribution. Confirm that no unrelated sessions were terminated and no duplicate or partially applied changes remain.


## T-04 — Malware Upload Due to Antivirus Scanning Bypass or Failure

**Threat:** A user uploads a malicious or infected document that enters SureDocs trusted storage or becomes accessible without successfully passing ClamAV antivirus scanning.

**Attack scenario:** An authenticated user uploads a document containing malware. The upload workflow fails to invoke ClamAV, treats a scanner timeout or error as a clean result, or makes the document accessible before scanning completes. Alternatively, an attacker attempts to access an unscanned file through a direct document API or a generated S3 download URL. If scan status is not enforced consistently across upload, download, sharing, and document replacement operations, the malicious file may bypass the intended security controls.

**Potential impact:** Malware could be distributed to other users through document sharing, downloaded to organizational devices, or used to exploit vulnerable applications that process the file. This could compromise user systems, expose confidential information, disrupt operations, and undermine the integrity of the document repository. Inconsistent S3 storage and PostgreSQL metadata updates could also leave files in an incorrect or unintended access state.

**Existing mitigation:** The planned ClamAV integration specifies server-side malware scanning before a document becomes available, with a quarantine-first workflow for uploaded files. Files reported as clean may proceed to trusted S3 storage, while infected files must be blocked. Scanner failures, timeouts, and inconclusive results must fail closed rather than being treated as clean. The design also requires scan-status enforcement across document viewing, downloading, sharing, signed URL generation, and document replacement, while preserving existing authentication and document-level authorization checks.

**Automated test evidence:** No automated test results have been provided confirming that ClamAV scanning and access restrictions are working end to end. Verification should include clean-file uploads, detection of the EICAR antivirus test file, scanner unavailability, scan timeouts, and attempts to access unscanned or infected documents through all relevant APIs.

**Current status:** Under implementation and verification — ClamAV integration has been specified, but successful integration and security-test results have not yet been confirmed.

**Remaining limitation:** ClamAV detection alone does not guarantee that a file is completely safe. Security also depends on current malware signatures, correct scanner configuration, upload validation, resource limits, and consistent enforcement of scan status. A clean scan must not be treated as authorization to access a document; existing identity and permission checks must still apply. Quarantine handling and S3 promotion must also prevent files from becoming accessible before scanning succeeds.

**Further verification:** Confirm that every document-upload path invokes ClamAV and that scanner readiness is checked before scanning begins. Upload a clean test file and verify that it becomes available only after a successful scan and storage promotion. Upload the EICAR test file and confirm that it is detected, blocked, and never published to trusted storage. Simulate scanner timeouts, connection failures, and inconclusive results and verify that these conditions never result in automatic approval. Attempt to view, download, share, replace, and generate signed URLs for unscanned or infected files, confirming that each operation is blocked. Verify that PostgreSQL scan metadata, S3 object state, temporary-file cleanup, and audit records remain consistent after successful uploads, blocked uploads, and failures.
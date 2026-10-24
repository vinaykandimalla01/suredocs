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
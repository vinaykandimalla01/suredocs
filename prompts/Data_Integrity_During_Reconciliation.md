# Task: Diagnose and Permanently Resolve PostgreSQL Transaction Lock in SureDocs

## 1. Problem Description

My SureDocs application has encountered a PostgreSQL transaction-lock issue during document ownership and permission reconciliation.

The reconciliation dry run passed, but the actual database transaction could not commit because another PostgreSQL transaction had remained in the `idle in transaction` state for more than six minutes while holding a lock on a user row required by a document ownership foreign-key relationship.

The reconciliation operation rolled back, and the ownership and permission counts were reported as unchanged.

I want you to investigate and resolve this issue in my existing SureDocs project. Do not assume that the database lock has already been released or that the reconciliation has succeeded.

## 2. Existing Environment

My project directory is:

`D:\suredocs`

My Docker Compose configuration uses:

- PostgreSQL image: `postgres:18.6-bookworm`
- PostgreSQL service name: `db`
- Database name: `suredocs`
- Database username: `suredocs_admin`
- PostgreSQL port: `5432`
- PostgreSQL data volume: `suredocs_postgres18_data`
- pgAdmin service for database management

Use the existing Docker Compose configuration and environment. Read the existing configuration and application code before making changes.

Connect to PostgreSQL through the existing Docker Compose service:

`docker compose exec db psql -U suredocs_admin -d suredocs`

Do not request or print database passwords, AWS secrets, or other sensitive credentials.

## 3. Phase One: Diagnose the Active PostgreSQL Transactions

Before modifying anything, inspect PostgreSQL's current transaction and locking state.

Use `pg_stat_activity`, `pg_locks`, and `pg_blocking_pids()` to identify:

- Transactions that are currently blocking other sessions.
- Sessions in the `idle in transaction` state.
- Transactions that have remained open for an unusually long period.
- The process ID (PID) of each confirmed blocking session.
- The database user and application name associated with the session.
- The session's client address, transaction age, and last executed query.
- The transaction or application operation that opened the connection.
- The specific user row or database resource involved in the lock, where identifiable.

Use the following diagnostic query:

```sql
SELECT
    pid,
    datname,
    usename,
    application_name,
    client_addr,
    state,
    xact_start,
    now() - xact_start AS transaction_age,
    state_change,
    wait_event_type,
    wait_event,
    LEFT(query, 300) AS last_query
FROM pg_stat_activity
WHERE datname = 'suredocs'
  AND xact_start IS NOT NULL
ORDER BY xact_start;
```

Identify blocking relationships using:

```sql
SELECT
    blocked.pid AS blocked_pid,
    blocker.pid AS blocker_pid,
    blocker.usename AS blocker_user,
    blocker.application_name AS blocker_app,
    blocker.state AS blocker_state,
    now() - blocker.xact_start AS blocker_transaction_age,
    blocker.wait_event_type,
    blocker.wait_event,
    LEFT(blocker.query, 300) AS blocker_query
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocker
    ON blocker.pid = ANY(pg_blocking_pids(blocked.pid));
```

Do not rely exclusively on the transaction's age. Determine whether the session is actually blocking the reconciliation and whether it belongs to the SureDocs application.

If the current blocker has already disappeared, investigate the application logs and database diagnostics to determine the probable cause without inventing evidence.

## 4. Phase Two: Safely Release the Confirmed Blocking Transaction

Determine the safest action for the specific blocking session.

Follow these rules:

1. If the transaction is still active and belongs to another legitimate operation, do not interrupt it.
2. If the transaction belongs to an abandoned SureDocs operation and the original connection is available, use the application's normal cleanup process or explicitly roll back the transaction through its original connection.
3. If the transaction is confirmed to be abandoned, its owner and impact are understood, and the original connection cannot be recovered, terminate only that specific backend session when necessary and authorized.
4. Understand that terminating a PostgreSQL session rolls back its uncommitted transaction. Evaluate the consequences before doing so.
5. Do not terminate sessions based on guessed PIDs.
6. Do not terminate unrelated database sessions.
7. Do not restart PostgreSQL simply to bypass the lock.
8. Do not drop, recreate, or reset the database or its Docker volume.
9. If the blocking process cannot be identified confidently, stop before taking destructive action and report the exact uncertainty.

After the corrective action, query PostgreSQL again and verify that the blocking relationship has been released.

Do not claim success merely because the command executed without reporting an error.

## 5. Phase Three: Find and Fix the Underlying Application Bug

Releasing the immediate lock is not sufficient. Inspect the backend code responsible for document ownership and permission reconciliation.

Determine whether the problem was caused by:

- A database transaction that was opened but never committed or rolled back.
- A database connection that was left idle while a transaction remained open.
- An exception that bypassed transaction cleanup.
- A transaction that remained open while the application performed slow operations or waited for external services.
- Incorrect session lifecycle management in SQLAlchemy or the database driver.
- An unnecessarily broad transaction scope.
- An application operation that failed to close or release its database session.
- Another process holding a user-row or foreign-key-related lock for an extended period.

Inspect the relevant database session, transaction, repository, service, and reconciliation code.

If the application uses SQLAlchemy, verify that session and transaction management follow the project's existing synchronous or asynchronous architecture.

Use appropriate transaction context managers, ensure exceptions trigger rollback, and guarantee that sessions and connections are released when operations finish.

Do not introduce incompatible database patterns or rewrite unrelated backend functionality.

Correct the actual root cause you can establish from the code and diagnostic evidence. If the available evidence does not establish a cause, document the remaining uncertainty rather than inventing one.

## 6. Phase Four: Make Reconciliation Safe to Retry

Review the document ownership and permission reconciliation operation.

It must:

- Preserve all valid existing document ownership relationships.
- Preserve valid existing permission grants.
- Avoid duplicate ownership or document-recipient relationships.
- Avoid creating duplicate active permission grants when a retry occurs.
- Respect all existing foreign-key and uniqueness constraints.
- Use appropriately scoped database transactions.
- Roll back failed database changes completely.
- Avoid holding transactions open while waiting for unrelated network operations.
- Support dry-run execution without changing persistent data.
- Provide clear error messages and useful diagnostic logging without exposing confidential information.
- Process large datasets in appropriate batches where necessary.

Do not alter document ownership or permission records merely to make a foreign-key error disappear.

Do not bypass constraints, disable foreign-key checks, or weaken database integrity rules.

If a schema or migration change is genuinely necessary, explain the reason and implement the smallest safe change using the project's existing migration system.

## 7. Phase Five: Retry the Reconciliation

Once the lock has been released and the underlying issue has been addressed:

1. Run the reconciliation in dry-run mode.
2. Review the proposed changes and expected ownership and permission counts.
3. Confirm that the changes are consistent with the existing application rules.
4. Execute the real reconciliation.
5. Verify that its database transaction commits successfully.
6. Check PostgreSQL activity again to ensure that the operation has not left another transaction open unnecessarily.

If another lock prevents the operation from completing, diagnose it again rather than repeatedly retrying the same blocked transaction.

Do not assume that a successful dry run proves the real transaction will commit.

## 8. Phase Six: Verify Database Integrity

After reconciliation, use read-only SQL queries to compare the actual database state with the expected results.

Verify:

- Document ownership foreign keys remain valid.
- Every document retains the correct owner.
- Existing valid sharing relationships are preserved.
- Permission counts match the reconciliation's expected results.
- No duplicate active permission grants were introduced.
- No partial or unintended changes remain from failed attempts.
- Database transactions are being committed or rolled back correctly.
- No unexplained long-running or abandoned transactions remain.
- Existing users, documents, and S3 object references have not been deleted or modified unintentionally.

The project is configured to use 1,000 users and 15,000 documents. Check the actual database counts before and after the operation and report any discrepancy. Do not assume these totals are correct without querying the database.

If any validation fails, stop and report the discrepancy before attempting additional data modifications.

## 9. Phase Seven: Test the Fix

Add or update tests using the project's existing testing framework where appropriate.

Cover:

- Successful reconciliation with no conflicting transaction.
- Safe rollback when reconciliation fails.
- Recovery from an abandoned application transaction.
- Retry behavior without duplicate permission records.
- Foreign-key integrity during reconciliation.
- Correct handling of concurrent operations.
- Cleanup of database sessions after success and failure.

If a live database concurrency test is necessary, isolate it from production data and use a dedicated test database or transaction-safe test fixtures.

Do not claim a test passed unless it was actually executed and its result was observed.

## 10. Final Report Required

When finished, provide a factual implementation report with these sections:

1. **Root Cause:** What caused the lock, supported by the available diagnostic evidence.
2. **Blocking Session:** The identified session and the reason it could safely be resolved.
3. **Immediate Recovery:** Whether the blocking transaction was released and how.
4. **Permanent Fix:** The files and code paths changed to prevent recurrence.
5. **Reconciliation Result:** Whether the real operation committed successfully.
6. **Database Validation:** Actual before-and-after counts and integrity-check results.
7. **Automated Tests:** Tests executed, their results, and any tests that remain unverified.
8. **Remaining Risks:** Any unresolved concerns or required manual actions.
9. **Changed Files:** The exact files modified and the purpose of each change.
10. **Commit:** The actual Git commit ID, if a commit was created.

Clearly distinguish completed fixes from proposed fixes and unverified behavior.

## Final Acceptance Criteria

The task is complete only when the confirmed blocking transaction has been safely resolved, the actual reconciliation has committed successfully, document ownership and permission integrity have been verified, and the root-cause fix has been validated as far as the available test environment permits.

Preserve all existing SureDocs functionality and real database data. Never sacrifice data integrity just to make the operation succeed.
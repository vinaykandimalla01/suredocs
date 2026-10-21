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

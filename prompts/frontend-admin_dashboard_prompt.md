# Build the SureDocs Administrator Dashboard — Frontend Implementation

## 1. Your Role and Objective

Act as a **senior frontend engineer, enterprise UI/UX designer, and security-focused software architect with 20+ years of professional experience** building enterprise SaaS applications, document management platforms, and administrative dashboards.

Your task is to implement the administrator frontend for **SureDocs**, a secure document-sharing platform built around the TrustVault security concept.

Do not simply provide recommendations, wireframes, or sample snippets. Inspect the existing project, understand its structure, and implement a complete, functional frontend experience that follows the requirements below.

Prioritize professional visual design, correct interaction behavior, maintainable architecture, accessibility, and future integration with a real backend.

## 2. Project Context: SureDocs

Companies regularly share confidential documents, including employee salary letters, customer contracts, engineering drawings, financial records, and audit reports.

Traditional document-sharing systems can expose sensitive information through excessive permissions, improperly retained access, and insufficient audit trails.

SureDocs is designed to address these problems by ensuring that:

- Documents are accessible only to explicitly authorized users.
- Document owners can grant and revoke access.
- Administrators can manage user accounts and monitor document activity.
- Document access attempts, permission changes, and other important actions can be audited.
- Unauthorized access attempts can be investigated using recorded activity.

Security is a fundamental requirement of the product. This application is not merely a CRUD interface; its frontend must communicate the state of a security-focused document management platform clearly and consistently.

## 3. Current Development Scope

For this phase, implement the **administrator interface, with the Dashboard as the primary completed page**.

The backend, authentication service, database, document storage service, and authorization APIs have not yet been implemented.

Consequently:

- Use realistic, centralized mock data throughout the dashboard.
- Do not attempt to connect to a nonexistent backend.
- Do not invent API endpoints or pretend that backend operations have succeeded.
- Structure the frontend so that mock-data services can later be replaced with actual API services without rewriting the UI.
- Keep data definitions, formatting utilities, reusable components, and page components separated.
- Implement real client-side interactions wherever the specification requires them.
- Clearly identify mock or simulated operational data wherever necessary.

Use **SureDocs** as the visible product name throughout the interface. Do not inconsistently alternate between SureDocs and TrustVault.

## 4. Required Technology Stack

Use the following frontend technologies:

- **React** for UI components and state management.
- **JavaScript**, not TypeScript.
- **Tailwind CSS** for styling.
- React Router for page navigation, if routing is required and is not already configured.
- Recharts or an existing equivalent chart library for data visualization.
- Lucide React or the project's existing icon library for consistent interface icons.

Before introducing dependencies, inspect the existing `package.json` and project structure. Reuse installed libraries wherever possible.

If the repository is empty, establish an appropriate React application with Vite and configure Tailwind CSS correctly.

Do not introduce an unnecessary UI framework or replace working project configuration without a clear reason.

## 5. Application Navigation and Role Context

The intended application workflow is:

1. A user opens SureDocs and enters their credentials on the login page.
2. The authentication backend validates their credentials.
3. The backend determines the authenticated user's role.
4. An administrator is directed to the administrator dashboard.
5. Document owners and viewers are directed to their respective interfaces.

The authentication and role-verification backend are outside the scope of this phase. Do not implement a fake authentication system or claim that client-side checks provide real security.

For now, build the administrator application shell with the following six sidebar destinations:

1. Dashboard
2. User Management
3. Documents
4. Permissions
5. Audit Logs
6. Security Monitoring

The sidebar must make the currently selected section visually clear, support navigation, and remain consistent across the administrator interface.

Complete the Dashboard first. Create only the lightweight placeholder or mock-data views necessary to support the navigation and dashboard-card interactions specified below. Do not fully implement the other five modules yet.

## 6. Administrator Dashboard: Overall Layout

Create a polished, modern enterprise administrator dashboard suitable for a security-sensitive document management product.

Use the provided reference screenshots as the visual reference for the card layout, chart area, recent audit events, and platform health sections. Follow their layout and interaction patterns wherever specified.

Do not reproduce irrelevant styling differences between screenshots, and do not give the bar chart a separate black background. All chart types must maintain a consistent dashboard background and visual identity.

The dashboard layout must follow this order:

1. Page heading and supporting information.
2. Four primary KPI cards arranged in one row on desktop.
3. A lower analytics area with the Storage and Denied Requests cards on the left and the activity-trends visualization alongside them on the right.
4. Recent Audit Events.
5. Platform Health.

Make the layout responsive. On smaller screens, reorganize the columns and KPI cards naturally without horizontal overflow or clipped content.

## 7. Dashboard Header

Include a clear page title, such as **Dashboard**, with a short description explaining that administrators can monitor users, documents, security activity, and platform status.

Provide a professional administrator identity area in the header if consistent with the supplied reference design. Use mock profile information.

Keep the overall layout clean and organized. Avoid unnecessary decorative elements, excessive gradients, oversized typography, and clutter.

## 8. Six Dashboard KPI Cards

Create exactly six KPI cards with the following meanings, metrics, and interactions.

### Card 1: Total Registered Users

**Definition:** The total number of user accounts registered on SureDocs.

For now, calculate and display the total using centralized mock user records.

Later, this metric must be obtained from the backend and reflect the actual number of registered user accounts.

Display an appropriate label, total count, and relevant visual indicator. Use realistic supporting information only when it can be derived from the mock data.

**Interaction:** Clicking this card navigates to User Management and displays all registered users, regardless of whether their accounts are active or disabled.

### Card 2: Total Documents

**Definition:** The total number of documents uploaded and registered in the SureDocs platform.

For now, use realistic mock document records and derive the metric from the mock dataset.

Later, the value must reflect the actual total returned by the backend.

**Interaction:** Clicking this card navigates to the Documents section and displays the available document records.

### Card 3: Active Users

**Definition:** The total number of registered user accounts that are not disabled.

**Important:** Active users does not mean users who are currently online. It means accounts that remain enabled and eligible to use the platform, subject to their permissions.

For the mock data, derive this value from the account status of the user records.

**Interaction:** Clicking this card navigates to User Management and automatically applies the Active status filter. Only active accounts should be displayed.

### Card 4: Disabled Accounts

**Definition:** The total number of accounts disabled by the administrator or otherwise recorded as disabled by the account-management system.

Calculate this value from the mock user dataset.

**Interaction:** Clicking this card navigates to User Management and automatically applies the Disabled status filter. Only disabled accounts should be displayed.

### Card 5: Storage Used

**Definition:** The aggregate storage occupied by the documents stored in the platform.

For now, use mock storage values. Display the total in an appropriate human-readable unit, such as MB, GB, or TB.

Where the mock dataset includes individual document sizes, derive the total from those sizes. Otherwise, use a clearly defined mock storage summary.

In the production application, the metric will be supplied by the backend or document-storage service. It should represent document-file storage usage rather than simply the size of the database records describing those files.

**Interaction:** Clicking this card may navigate to Documents or open a storage details view. Keep the interaction consistent with the rest of the dashboard.

### Card 6: Denied Requests

**Definition:** The number of document-access requests that were denied because the requesting user lacked the required authorization or otherwise failed the relevant access policy.

Do not confuse this metric with failed login attempts. Authentication failures and document-access denials are different security events.

For now, populate the metric using mock security-event data. In the production application, it must reflect actual backend-recorded denials for a clearly defined reporting period.

Display a relevant security indicator without making the card excessively alarming.

**Interaction:** Clicking this card navigates to Security Monitoring or opens a denied-request activity view, preferably with the corresponding event filter applied.

### KPI Card Requirements

All six cards must:

- Use consistent spacing, typography, alignment, and component structure.
- Display labels and counts clearly.
- Use meaningful icons that correspond to each metric.
- Provide a subtle hover state and a clear pointer cursor when clickable.
- Support keyboard navigation and an accessible focus state.
- Use consistent number formatting.
- Avoid arbitrary percentage changes or trend indicators that are not supported by the underlying mock data.

The first four cards must occupy the top row on a desktop layout. Place Storage and Denied Requests below them, as specified above.

## 9. Activity Trends and Analytics Visualization

Place an analytics visualization beside the lower Storage and Denied Requests cards.

The chart must represent trends in:

- Successful actions.
- Denied document-access requests.

For successful activity, use appropriate mock audit events such as successful document views, downloads, uploads, or other legitimate operations. Do not label every successful action as a successful login.

For denied activity, use mock events representing access attempts that the authorization system refused.

### Chart Type Selector

Provide a functional dropdown or selector with exactly these three options:

1. Line Chart
2. Bar Chart
3. Table

The default selection must be **Line Chart**.

When the administrator selects Bar Chart, replace the line chart with a bar chart.

When the administrator selects Table, replace the graphical visualization with a properly formatted table showing the same underlying data.

Switching representations must not reset the selected date range or change the underlying dataset.

Use the same dashboard background, consistent typography, and coherent visual treatment across all three representations. Do not give the bar chart a separate black background.

The visualization must include:

- A clear title.
- A legend that distinguishes successful actions from denied requests.
- Readable date labels.
- Appropriate tooltips or table values.
- Responsive sizing.
- Empty-state handling if no records exist for a selected period.

### Time-Range Selector

Include a functional date-range selector with these options:

- Today
- Last 10 Days
- Last 30 Days
- Last 90 Days

Use **Last 30 Days** as the initial selection unless the supplied reference image clearly indicates another default.

Whenever the administrator changes the range, update the visualization or table to reflect the selected period.

Build the mock activity dataset with sufficient historical records to support all four time ranges. Calculate chart values from the dataset instead of hardcoding unrelated values into each chart.

Use a consistent date convention, and ensure that the selected period and displayed dates agree.

## 10. Recent Audit Events

Below the analytics area, add a section titled **Recent Audit Events**, following the supplied reference screenshot.

This section should provide a quick view of recent security-relevant platform activity.

Populate it with realistic mock audit records, including examples such as:

- A user uploaded a document.
- A user downloaded an authorized document.
- An administrator disabled an account.
- A document owner granted access to another employee.
- An administrator or document owner revoked access.
- A user attempted to access a document without the required permission.

Where suitable, each record should contain:

- Actor or user.
- Action performed.
- Target document, account, or resource.
- Timestamp.
- Outcome, such as Success or Denied.
- An appropriate status indicator.

Use consistent formatting and readable timestamps.

Prioritize recent and security-relevant activities. Show a reasonable number of recent entries without overcrowding the dashboard.

Provide a functional View All action that navigates to the Audit Logs section. The detailed audit-log module will be implemented in a later phase.

Do not claim that these mock entries are genuine production audit evidence.

## 11. Platform Health

Below Recent Audit Events, implement a section titled **Platform Health**, following the provided reference screenshot.

Use the two health indicators or panels shown in the supplied reference image. Preserve their intended structure and presentation as closely as practical.

If the reference details are not available, use two clearly distinguished operational health indicators appropriate for SureDocs, such as:

- Application/API Service.
- Document Storage Service.

Because the backend has not been implemented, populate these indicators using explicitly simulated statuses, with appropriate labels and short supporting descriptions.

Make the simulated nature of these indicators clear in the underlying implementation. Do not imply that the application has actually contacted a server, database, or storage service.

Structure the health components so their status values can later be populated from actual health-check endpoints.

## 12. Sidebar Design and Behavior

Build a reusable administrator sidebar containing:

- SureDocs logo or wordmark.
- Dashboard.
- User Management.
- Documents.
- Permissions.
- Audit Logs.
- Security Monitoring.

Use consistent icons and labels.

The sidebar must:

- Highlight the active destination.
- Navigate correctly between the available sections.
- Remain visually consistent across pages.
- Avoid shifting or overlapping dashboard content.
- Collapse or adapt appropriately on smaller screens.
- Include a clear mechanism to open or close it on mobile.

If the supplied screenshots contain additional sidebar elements, preserve those relevant to the administrator design without expanding the scope unnecessarily.

Do not build full pages for modules scheduled for later implementation. However, clicking a navigation item must produce an intentional, coherent result rather than a broken link.

## 13. Mock Data and Future Backend Integration

Create a centralized mock-data layer rather than defining unrelated hardcoded values throughout the components.

Include suitable mock datasets for:

- Users and account statuses.
- Documents and their sizes.
- Audit events and action outcomes.
- Successful and denied activity over time.
- Storage usage.
- Simulated platform-health statuses.

Use realistic relationships between the records. For example, audit events should reference plausible users and documents, and dashboard counts should agree with the relevant mock datasets.

Where feasible, derive dashboard metrics through reusable selector or aggregation functions.

Keep the implementation ready for future services, such as:

- `userService`
- `documentService`
- `analyticsService`
- `auditService`
- `healthService`

These are architectural examples, not mandatory API endpoints. Do not introduce unnecessary abstraction or pretend the services are connected to a backend.

The key requirement is that replacing mock data with API responses later should not require rebuilding the dashboard components.

## 14. Supporting Navigation Views

Although the Dashboard is the primary scope, implement sufficient supporting views to make the specified navigation functional.

For User Management, provide a lightweight mock-data table that can show all users or filter them by Active and Disabled status.

For Documents, provide a lightweight mock-data table containing the available document records.

For Permissions, Audit Logs, and Security Monitoring, create professional placeholder views that use the same administrator layout. Where an interaction explicitly points to a relevant view, carry the appropriate filter or context into that view when practical.

Do not implement the complete management workflows for those modules in this phase.

Do not build the login page as part of this task unless the current project already requires it for routing. Concentrate on the administrator interface and the dashboard experience.

## 15. Visual Design Quality

The interface must look like a professionally designed, production-oriented enterprise SaaS admin console rather than a tutorial project or a generic collection of cards.

Use the supplied screenshots as the primary visual reference wherever available.

Pay close attention to:

- Information hierarchy.
- Alignment and spacing.
- Typography and label readability.
- Card proportions and consistent padding.
- Navigation clarity.
- Chart legibility.
- Status and severity indicators.
- Clear hover and focus states.
- Responsive behavior.
- Consistent treatment of tables and interactive controls.

Choose a cohesive visual system appropriate for a security-focused document-sharing platform.

Avoid excessive decorative gradients, unnecessary animations, oversized icons, inconsistent shadows, emoji used as interface icons, and excessive empty space.

Do not make up additional dashboard metrics merely to fill the layout.

If a reference image conflicts with a functional requirement in this prompt, preserve the functional requirement while maintaining the closest practical visual match.

## 16. Code Quality and Maintainability

Write clean, understandable, reusable React code.

Organize the project into logical areas, such as:

- Application layout and routing.
- Sidebar and header components.
- KPI cards.
- Analytics and chart components.
- Recent audit events.
- Platform health.
- Supporting module pages.
- Mock datasets and data-processing utilities.

Keep components appropriately sized and give them clear responsibilities.

Use state management appropriate to this interface. Use component-level state and derived values where sufficient rather than introducing unnecessary global state libraries.

Avoid duplicated markup, hardcoded metric values scattered through the UI, broken imports, placeholder buttons with no behavior, and unnecessary dependencies.

Ensure all navigation elements, chart selectors, date selectors, status filters, and specified clickable cards behave as intended.

## 17. Acceptance Criteria

Consider this implementation complete only when all of the following conditions are met:

1. The React application starts successfully using the project's documented development command.
2. The administrator layout includes all six required sidebar destinations.
3. The Dashboard contains exactly six KPI cards with the specified meanings.
4. The first four cards appear in the top row on desktop.
5. Storage and Denied Requests appear below the first row, alongside the activity-trends visualization.
6. KPI counts are generated from consistent mock data wherever applicable.
7. Clicking Total Registered Users opens User Management with all user records.
8. Clicking Active Users opens User Management with the Active filter applied.
9. Clicking Disabled Accounts opens User Management with the Disabled filter applied.
10. Clicking Total Documents opens Documents and displays the document records.
11. The chart initially displays the Line Chart representation.
12. The chart selector switches correctly between Line Chart, Bar Chart, and Table.
13. The date-range selector changes the displayed data for Today, Last 10 Days, Last 30 Days, and Last 90 Days.
14. The line, bar, and table representations use consistent data and retain the selected time range.
15. Recent Audit Events displays realistic, consistently formatted mock entries.
16. View All in Recent Audit Events navigates to Audit Logs.
17. Platform Health displays two appropriate indicators, using simulated data without claiming a real health check occurred.
18. The interface works at desktop, tablet, and mobile screen sizes.
19. Navigation, buttons, selectors, and filters do not contain broken or misleading interactions.
20. There are no obvious console errors, missing assets, broken imports, or layout-overflow issues.
21. The implementation contains no fake backend integration or claims that frontend-only controls enforce document authorization.
22. The mock-data layer and component structure are suitable for later backend integration.

## 18. Implementation Instructions

Follow this implementation sequence:

**Step 1:** Inspect the existing repository, identify the framework configuration, installed dependencies, and available reference images.

**Step 2:** Establish or improve the application layout, routing, and sidebar.

**Step 3:** Implement the Dashboard and six KPI cards.

**Step 4:** Add centralized mock data and implement the card-navigation behavior.

**Step 5:** Build the interactive analytics area, including all three chart representations and all four time-range options.

**Step 6:** Implement Recent Audit Events, Platform Health, and the supporting navigation views.

**Step 7:** Refine the responsive layout, visual hierarchy, accessibility, and interaction states.

**Step 8:** Run the available checks, start the application, and resolve any implementation errors.

Do not stop after creating the initial layout or presenting a plan. Continue through implementation and validation.

If any design detail is unclear, use the supplied screenshots and the requirements in this prompt to make a reasonable, consistent decision instead of blocking progress with unnecessary questions.

## 19. Final Deliverables

After completing the implementation, provide:

1. The actual code changes in the project.
2. A concise summary of the implemented features.
3. The main files created or modified.
4. The command required to run the application.
5. Any tests or validation checks performed and their results.
6. A brief list of features intentionally deferred to the backend or later development phases.

**Final priority:** Deliver a polished and functional SureDocs administrator dashboard, with a consistent application shell, accurate mock-data-driven metrics, interactive analytics, and maintainable frontend architecture. The result must be ready for a future backend integration without misrepresenting frontend behavior as real security enforcement.
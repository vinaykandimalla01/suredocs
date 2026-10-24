const referenceDate = new Date('2026-10-24T12:00:00.000Z')

export const documentUsers = [
  { id: 'USR-001', name: 'Maya Chen', email: 'maya.chen@suredocs.example', initials: 'MC', role: 'Owner' },
  { id: 'USR-002', name: 'Alex Morgan', email: 'alex.morgan@suredocs.example', initials: 'AM', role: 'Employee' },
  { id: 'USR-003', name: 'Priya Sharma', email: 'priya.sharma@suredocs.example', initials: 'PS', role: 'Administrator' },
  { id: 'USR-004', name: 'Rahul Kumar', email: 'rahul.kumar@suredocs.example', initials: 'RK', role: 'Employee' },
  { id: 'USR-005', name: 'Ananya Rao', email: 'ananya.rao@suredocs.example', initials: 'AR', role: 'Employee' },
  { id: 'USR-006', name: 'Daniel Brooks', email: 'daniel.brooks@suredocs.example', initials: 'DB', role: 'Employee' },
  { id: 'USR-007', name: 'Sofia Patel', email: 'sofia.patel@suredocs.example', initials: 'SP', role: 'Employee' },
  { id: 'USR-008', name: 'Noah Williams', email: 'noah.williams@suredocs.example', initials: 'NW', role: 'Employee' },
  { id: 'USR-009', name: 'Grace Kim', email: 'grace.kim@suredocs.example', initials: 'GK', role: 'Employee' },
  { id: 'USR-010', name: 'Ethan Nguyen', email: 'ethan.nguyen@suredocs.example', initials: 'EN', role: 'Employee' },
  { id: 'USR-011', name: 'Aisha Singh', email: 'aisha.singh@suredocs.example', initials: 'AS', role: 'Employee' },
  { id: 'USR-012', name: 'Lucas Garcia', email: 'lucas.garcia@suredocs.example', initials: 'LG', role: 'Employee' },
]

const documentSeeds = [
  ['DOC-2026-001', 'Quarterly Financial Report', 0, 'Finance', 'PDF', 2488320, '2026-10-22', '2026-10-23', 'Active', true, ['Q3', 'Board'], 'Consolidated financial results and variance notes for the third quarter.'],
  ['DOC-2026-002', 'Product Roadmap 2025', 1, 'Engineering', 'PPTX', 5824512, '2026-10-21', '2026-10-22', 'Active', true, ['Product', 'Planning'], 'Product milestones and release sequencing for the annual planning cycle.'],
  ['DOC-2026-003', 'Employee Handbook', 2, 'HR', 'DOCX', 1538048, '2026-10-20', '2026-10-21', 'Active', true, ['People', 'Policy'], 'Current workplace policies, benefits, and employee guidance.'],
  ['DOC-2026-004', 'System Architecture', 3, 'Engineering', 'PDF', 4194304, '2026-10-19', '2026-10-20', 'Active', true, ['Platform', 'Infrastructure'], 'Architecture overview for the SureDocs production platform.'],
  ['DOC-2026-005', 'Client Agreement - ABC Corp', 4, 'Legal', 'PDF', 1048576, '2026-10-18', '2026-10-19', 'Active', false, ['Customer', 'Contract'], 'Executed service agreement and commercial schedule for ABC Corp.'],
  ['DOC-2026-006', 'Marketing Campaign Assets', 5, 'Marketing', 'ZIP', 12582912, '2026-10-17', '2026-10-18', 'Active', false, ['Campaign', 'Brand'], 'Approved campaign artwork, copy, and launch materials.'],
  ['DOC-2026-007', 'Security Guidelines', 6, 'Security', 'PDF', 786432, '2026-10-16', '2026-10-17', 'Active', false, ['Security', 'Internal'], 'Security practices for staff handling company information.'],
  ['DOC-2026-008', 'Team Meeting Notes', 7, 'General', 'TXT', 348160, '2026-10-15', '2026-10-16', 'Active', true, ['Operations', 'Weekly'], 'Decisions and follow-up owners from the operations team meeting.'],
  ['DOC-2026-009', 'Design System', 8, 'Design', 'PDF', 7340032, '2026-10-14', '2026-10-15', 'Active', false, ['UI', 'Components'], 'Interface foundations, reusable components, and accessibility guidance.'],
  ['DOC-2026-010', 'Sales Data Analysis', 9, 'Finance', 'XLSX', 1966080, '2026-10-13', '2026-10-14', 'Active', false, ['Sales', 'Forecast'], 'Regional sales performance and pipeline analysis for Q4.'],
  ['DOC-2026-011', 'Vendor Due Diligence - Northstar', 10, 'Legal', 'DOCX', 1376256, '2026-09-09', '2026-10-07', 'Active', false, ['Vendor', 'Review'], 'Due diligence findings for the Northstar Analytics renewal.'],
  ['DOC-2026-012', 'APAC Operating Budget FY2026', 11, 'Finance', 'XLSX', 2359296, '2026-03-18', '2026-10-11', 'Active', true, ['APAC', 'Budget'], 'Approved operating budget with regional department allocations.'],
  ['DOC-2026-013', 'Incident Response Playbook', 2, 'Security', 'PDF', 1572864, '2026-02-06', '2026-10-09', 'Active', false, ['Incident', 'Runbook'], 'Escalation procedures and response roles for security incidents.'],
  ['DOC-2026-014', 'Customer Research Synthesis', 4, 'Marketing', 'PPTX', 4980736, '2026-08-30', '2026-10-04', 'Active', false, ['Research', 'Customer'], 'Research themes and recommendations from recent customer interviews.'],
  ['DOC-2026-015', 'Cloud Migration Runbook', 3, 'Engineering', 'DOCX', 2088960, '2026-04-17', '2026-10-12', 'Active', true, ['Cloud', 'Migration'], 'Migration sequence, ownership, and rollback guidance for cloud services.'],
  ['DOC-2026-016', 'Leave and Benefits Guide', 0, 'HR', 'PDF', 921600, '2026-01-22', '2026-10-06', 'Active', false, ['Benefits', 'People'], 'Employee leave entitlements and benefits administration guide.'],
  ['DOC-2026-017', 'Brand Photography Library', 5, 'Design', 'ZIP', 18743296, '2026-07-03', '2026-10-08', 'Active', false, ['Brand', 'Assets'], 'Licensed photography approved for current corporate communications.'],
  ['DOC-2026-018', 'Data Processing Addendum - Bluebird', 10, 'Legal', 'PDF', 1310720, '2026-08-02', '2026-10-02', 'Active', true, ['Privacy', 'Customer'], 'Data processing terms and security commitments for Bluebird.'],
  ['DOC-2026-019', 'Q4 Release Readiness Checklist', 1, 'Engineering', 'XLSX', 851968, '2026-10-08', '2026-10-22', 'Active', false, ['Release', 'Checklist'], 'Launch readiness owners and checks for the fourth-quarter release.'],
  ['DOC-2026-020', 'Internal Communications Calendar', 7, 'General', 'XLSX', 655360, '2026-09-30', '2026-10-14', 'Active', true, ['Communications', 'Calendar'], 'Planned company announcements and internal events.'],
  ['DOC-2026-021', 'Office Access Review', 6, 'Security', 'CSV', 458752, '2026-07-15', '2026-09-25', 'Archived', false, ['Access', 'Audit'], 'Completed review of physical office access assignments.'],
  ['DOC-2026-022', 'Hiring Plan - Product & Design', 2, 'HR', 'XLSX', 1105920, '2026-09-05', '2026-10-10', 'Active', true, ['Hiring', 'Planning'], 'Approved headcount plan for product and design teams.'],
  ['DOC-2026-023', 'Annual Risk Register', 3, 'General', 'XLSX', 1703936, '2026-01-11', '2026-10-15', 'Active', false, ['Risk', 'Governance'], 'Cross-functional operational, legal, and technology risk register.'],
  ['DOC-2026-024', 'Social Media Brand Kit', 8, 'Marketing', 'PDF', 3014656, '2026-05-26', '2026-09-28', 'Active', false, ['Social', 'Brand'], 'Approved templates and brand rules for social media publishing.'],
  ['DOC-2026-025', 'API Integration Standards', 9, 'Engineering', 'DOCX', 1245184, '2026-02-13', '2026-10-05', 'Active', true, ['API', 'Engineering'], 'Internal API design, versioning, and integration standards.'],
  ['DOC-2026-026', 'Records Retention Schedule', 10, 'Legal', 'PDF', 1048576, '2026-03-04', '2026-09-17', 'Active', false, ['Records', 'Compliance'], 'Retention periods and disposition requirements by record class.'],
  ['DOC-2026-027', 'Customer Support Escalation Matrix', 11, 'General', 'XLSX', 589824, '2026-08-17', '2026-10-16', 'Active', false, ['Support', 'Operations'], 'Support escalation owners, response targets, and communication paths.'],
  ['DOC-2026-028', 'Workspace Accessibility Review', 8, 'Design', 'PDF', 1835008, '2026-04-09', '2026-10-03', 'Active', true, ['Accessibility', 'Audit'], 'Accessibility findings and planned remediation across core workflows.'],
  ['DOC-2026-029', 'Supplier Invoice Reconciliation', 0, 'Finance', 'CSV', 720896, '2026-10-06', '2026-10-19', 'Active', false, ['AP', 'Quarterly'], 'Quarterly supplier invoice checks and outstanding reconciliation items.'],
  ['DOC-2026-030', 'Security Awareness Training', 6, 'Security', 'PPTX', 3670016, '2026-01-19', '2026-08-19', 'Archived', true, ['Training', 'Security'], 'Training deck and completion guidance for annual security awareness.'],
  ['DOC-2026-031', 'Annual Report Infographic Source', 8, 'Design', 'PNG', 1482752, '2026-08-28', '2026-10-01', 'Active', false, ['Annual report', 'Infographic'], 'Approved high-resolution infographic artwork for the annual report.'],
]

export const mockDocuments = documentSeeds.map((seed) => {
  const [id, name, ownerIndex, category, fileType, fileSizeBytes, uploadDate, lastModified, status, isOwned, tags, description] = seed
  const owner = documentUsers[ownerIndex]
  const isShared = !isOwned

  return {
    id,
    documentId: id,
    name,
    ownerId: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    category,
    fileType,
    mimeType: ({ PDF: 'application/pdf', DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', CSV: 'text/csv', TXT: 'text/plain', PNG: 'image/png', ZIP: 'application/zip' })[fileType],
    fileSizeBytes,
    fileSizeLabel: `${(fileSizeBytes / (1024 * 1024)).toFixed(fileSizeBytes < 1024 * 1024 ? 2 : 1)} MB`,
    uploadDate: `${uploadDate}T09:30:00.000Z`,
    lastModified: `${lastModified}T14:15:00.000Z`,
    status,
    tags,
    description,
    isOwned,
    isShared,
  }
})

const permissionStatuses = [
  ['Active', 'Pending', 'Expired', 'Revoked'],
  ['Active', 'Active', 'Active', 'Active', 'Pending'],
  ['Active', 'Pending', 'Active'],
  ['Active', 'Expired'],
]
const accessLevels = ['Read', 'Edit', 'Download']

export const initialDocumentPermissions = mockDocuments.flatMap((document, documentIndex) =>
  permissionStatuses[documentIndex % permissionStatuses.length].map((status, permissionIndex) => {
    const user = documentUsers[(documentIndex + permissionIndex + 1) % documentUsers.length]
    const granted = new Date(Date.UTC(2026, 8, 1 + ((documentIndex * 3 + permissionIndex * 5) % 50), 10, 30))
    const expires = new Date(granted.getTime() + (permissionIndex + 1) * 45 * 86400000)
    return {
      id: `PERM-${documentIndex + 1}-${permissionIndex + 1}`,
      documentId: document.id,
      userId: user.id,
      accessLevel: accessLevels[(documentIndex + permissionIndex) % accessLevels.length],
      grantedBy: document.ownerId,
      grantedAt: granted.toISOString(),
      expiresAt: status === 'Expired' ? new Date(Date.UTC(2026, 9, 20, 10)).toISOString() : status === 'Active' && permissionIndex === 0 ? null : expires.toISOString(),
      status,
    }
  }),
)

const auditActions = [
  { action: 'Document uploaded', eventType: 'modification', result: 'Recorded', details: 'Document metadata was added to the registry.' },
  { action: 'Document viewed', eventType: 'access', result: 'Allowed', details: 'Document preview was opened by an authorized user.' },
  { action: 'Permission granted', eventType: 'permission', result: 'Recorded', details: 'Read access was granted to a team member.' },
  { action: 'Metadata updated', eventType: 'modification', result: 'Recorded', details: 'Document description and review date were updated.' },
  { action: 'Access attempt', eventType: 'access', result: 'Denied', details: 'The request did not match an active permission.' },
  { action: 'Permission revoked', eventType: 'permission', result: 'Recorded', details: 'A previous document grant was revoked.' },
]

export const mockAuditEvents = mockDocuments.flatMap((document, documentIndex) =>
  auditActions.map((event, eventIndex) => {
    const actor = documentUsers[(documentIndex + eventIndex + 2) % documentUsers.length]
    const occurredAt = new Date(referenceDate.getTime() - (documentIndex * 2 + eventIndex * 3 + 2) * 86400000 - (eventIndex * 17 + 10) * 60000)
    return {
      id: `AUD-${documentIndex + 1}-${eventIndex + 1}`,
      documentId: document.id,
      actorUserId: actor.id,
      action: event.action,
      timestamp: occurredAt.toISOString(),
      result: event.result,
      ipAddress: `10.24.${(documentIndex % 20) + 1}.${(eventIndex + 11) * 7}`,
      details: event.details,
      eventType: event.eventType,
    }
  }),
)

export const documentCategoryMetrics = [
  { name: 'Finance', count: 212, owned: 73, shared: 139, color: '#4f8df7' },
  { name: 'HR', count: 156, owned: 53, shared: 103, color: '#40b98b' },
  { name: 'Engineering', count: 189, owned: 61, shared: 128, color: '#7c69e8' },
  { name: 'Legal', count: 98, owned: 31, shared: 67, color: '#f0a34d' },
  { name: 'Marketing', count: 141, owned: 45, shared: 96, color: '#e878a0' },
  { name: 'Design', count: 87, owned: 28, shared: 59, color: '#42a8c7' },
  { name: 'Security', count: 64, owned: 21, shared: 43, color: '#e26a6a' },
  { name: 'General', count: 337, owned: 100, shared: 237, color: '#a5b1c2' },
]

export const documentFileTypeMetrics = [
  { name: 'PDF', count: 412, owned: 132, shared: 280, color: '#e46767' },
  { name: 'DOCX', count: 286, owned: 92, shared: 194, color: '#4585e8' },
  { name: 'PPTX', count: 158, owned: 51, shared: 107, color: '#ef9a53' },
  { name: 'XLSX', count: 126, owned: 40, shared: 86, color: '#41a778' },
  { name: 'TXT', count: 96, owned: 30, shared: 66, color: '#9aa7b8' },
  { name: 'ZIP', count: 72, owned: 22, shared: 50, color: '#936de2' },
  { name: 'PNG', count: 48, owned: 15, shared: 33, color: '#50a8bd' },
  { name: 'Other', count: 86, owned: 30, shared: 56, color: '#a5b1c2' },
]

const categoryTotals = documentCategoryMetrics.reduce((totals, entry) => ({
  total: totals.total + entry.count,
  owned: totals.owned + entry.owned,
  shared: totals.shared + entry.shared,
}), { total: 0, owned: 0, shared: 0 })

export const organizationDocumentMetrics = {
  total: categoryTotals.total,
  owned: categoryTotals.owned,
  shared: categoryTotals.shared,
  storageBytes: 24.8 * 1024 ** 3,
  uniqueOwners: 286,
  activeOwned: 398,
  uniqueSharedOwners: 324,
  sharedWithUsers: 648,
  ownedStorageBytes: 8.7 * 1024 ** 3,
  sharedStorageBytes: 12.4 * 1024 ** 3,
  categories: documentCategoryMetrics,
  fileTypes: documentFileTypeMetrics,
}

export const categoryCounts = documentCategoryMetrics.map(({ name, count }) => ({ name, count }))

export const trendSeries = Array.from({ length: 30 }, (_, index) => {
  const date = new Date(referenceDate.getTime() - (29 - index) * 86400000)
  const ownedNoise = index === 0 || index === 29 ? 0 : [0, 1, -1, 2, 1][index % 5]
  const sharedNoise = index === 0 || index === 29 ? 0 : [0, 2, -1, 1, 3, 0][index % 6]
  const owned = 365 + Math.round((index * 47) / 29) + ownedNoise
  const shared = 789 + Math.round((index * 83) / 29) + sharedNoise
  return {
    date: date.toISOString().slice(0, 10),
    label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
    documents: owned + shared,
    owned,
    shared,
  }
})

export const monthlyTrendSeries = [
  ['Nov 2025', 1018, 328, 690], ['Dec 2025', 1042, 335, 707], ['Jan 2026', 1071, 343, 728],
  ['Feb 2026', 1093, 351, 742], ['Mar 2026', 1124, 360, 764], ['Apr 2026', 1150, 368, 782],
  ['May 2026', 1176, 376, 800], ['Jun 2026', 1192, 382, 810], ['Jul 2026', 1214, 389, 825],
  ['Aug 2026', 1231, 395, 836], ['Sep 2026', 1252, 403, 849], ['Oct 2026', 1284, 412, 872],
].map(([label, documents, owned, shared]) => ({ label, documents, owned, shared }))

export const aggregateDataNote = 'Summary cards and charts use the fixed 1,284-document organization snapshot. The registry below is a stable, curated 31-record sample for realistic frontend interactions.'

export function getPermissionsForDocument(permissions, documentId) {
  return permissions.filter((permission) => permission.documentId === documentId)
}

export function getEventsForDocument(events, documentId) {
  return events.filter((event) => event.documentId === documentId).sort((first, second) => second.timestamp.localeCompare(first.timestamp))
}

export function summarizePermissions(permissions) {
  return ['Active', 'Pending', 'Expired', 'Revoked'].map((status) => ({
    status,
    count: permissions.filter((permission) => permission.status === status).length,
  }))
}

export function bytesLabel(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

const auditSeed = [
  ['2026-10-22T10:14:00', 'Uploaded', 'Project_Proposal.pdf', 'File uploaded (2.4 MB)', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-21T16:32:00', 'Downloaded', 'Q3_Report.xlsx', 'File downloaded (1.8 MB)', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-20T11:11:00', 'Edited', 'Design_Guidelines.docx', 'Metadata updated', '192.168.1.89', 'Success', 'MacBook Pro'],
  ['2026-10-19T14:45:00', 'Viewed', 'Marketing_Plan.pptx', 'Viewed document', '192.168.1.120', 'Success', 'Windows PC'],
  ['2026-10-19T19:45:00', 'Deleted', 'Old_Draft.pdf', 'Document deleted', '192.168.1.120', 'Denied', 'Windows PC'],
  ['2026-10-18T09:20:00', 'Shared', 'Product_Requirements.pdf', 'Shared with Priya Mehta', '192.168.1.45', 'Success', 'iPhone 14'],
  ['2026-10-17T12:12:00', 'Login', '—', 'User logged in', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-17T14:08:00', 'Failed Login', '—', 'Invalid password', '203.0.113.45', 'Denied', 'Unknown'],
  ['2026-10-16T15:22:00', 'Uploaded', 'Architecture.png', 'File uploaded (980 KB)', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-15T12:08:00', 'Downloaded', 'Employee_Handbook.pdf', 'File downloaded (4.6 MB)', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-14T10:35:00', 'Edited', 'Meeting_Notes.txt', 'Document details updated', '192.168.1.89', 'Success', 'MacBook Pro'],
  ['2026-10-13T08:14:00', 'Failed Login', '—', 'Invalid password', '203.0.113.45', 'Denied', 'Unknown'],
  ['2026-10-12T16:55:00', 'Viewed', 'Source_Files.zip', 'Viewed document details', '192.168.1.24', 'Success', 'Windows PC'],
  ['2026-10-11T11:41:00', 'Shared', 'Q3_Report.xlsx', 'Access granted to Priya Mehta', '192.168.1.45', 'Success', 'iPhone 14'],
  ['2026-10-10T09:04:00', 'Deleted', 'Temp_Export.csv', 'Delete permission required', '192.168.1.24', 'Denied', 'Windows PC'],
  ['2026-10-09T13:26:00', 'Login', '—', 'User logged in', '192.168.1.89', 'Success', 'MacBook Pro'],
]
export const profileFixture = {
  phone: '+91 98765 43210',
  employeeId: 'EMP-001',
  jobTitle: 'Software Engineer',
  manager: 'Priya Mehta',
  userId: 'USR-001',
  joined: 'Jan 12, 2024',
  lastLogin: 'Oct 22, 2026, 10:24 AM',
  lastActivity: 'Oct 22, 2026, 11:02 AM',
}

export function buildUserProfile(user) {
  const sequence = Number(user.id.match(/\d+/)?.[0] ?? 1)
  const roleTitle = user.role === 'Admin' ? 'Platform Administrator' : user.role === 'Manager' ? 'Department Manager' : `${user.department} Specialist`
  return {
    ...profileFixture,
    ...user,
    userId: `USR-${String(sequence).padStart(3, '0')}`,
    employeeId: `EMP-${String(sequence).padStart(3, '0')}`,
    phone: sequence === 1 ? profileFixture.phone : `+91 98765 ${String(43209 + sequence).padStart(5, '0')}`,
    jobTitle: sequence === 1 ? profileFixture.jobTitle : roleTitle,
  }
}

export const overviewMetrics = [
  { label: 'Documents Uploaded', value: 45, trend: '+12%', tone: 'blue', icon: 'upload' },
  { label: 'Documents Downloaded', value: 128, trend: '+8%', tone: 'green', icon: 'download' },
  { label: 'Documents Shared', value: 32, trend: '+14%', tone: 'purple', icon: 'share' },
  { label: 'Documents Edited', value: 18, trend: '+6%', tone: 'orange', icon: 'edit' },
]

export const permissionOverview = [
  { label: 'Assigned Role', value: 'Admin', icon: 'badge' },
  { label: 'Permission Source', value: 'Role Defaults', icon: 'layers' },
  { label: 'Access Scope', value: 'Engineering Dept.', icon: 'building' },
  { label: 'Last Updated', value: 'Jan 12, 2024', detail: 'by Priya Mehta', icon: 'calendar' },
]

export const documentPermissions = [
  { id: 'upload-documents', name: 'Upload documents', description: 'Upload new documents', granted: true },
  { id: 'view-documents', name: 'View documents', description: 'Open and read documents', granted: true },
  { id: 'download-documents', name: 'Download documents', description: 'Download accessible files', granted: true },
  { id: 'edit-metadata', name: 'Edit metadata', description: 'Update document details', granted: true },
  { id: 'replace-content', name: 'Replace file content', description: 'Replace existing file', granted: false },
  { id: 'delete-documents', name: 'Delete documents', description: 'Delete documents', granted: false },
  { id: 'share-documents', name: 'Share documents', description: 'Grant or revoke access', granted: true },
]

export const platformPermissions = [
  { id: 'manage-users', name: 'Manage users', description: 'Create, edit, disable users', granted: true },
  { id: 'invite-users', name: 'Invite users', description: 'Send user invitations', granted: true },
  { id: 'change-roles', name: 'Change user roles', description: 'Modify user roles', granted: true },
  { id: 'view-audit', name: 'View audit logs', description: 'View system audit logs', granted: true },
  { id: 'view-health', name: 'View platform health', description: 'Access platform health', granted: true },
  { id: 'manage-settings', name: 'Manage settings', description: 'Change system settings', granted: false },
  { id: 'manage-storage', name: 'Manage storage', description: 'Manage storage settings', granted: false },
]

export const permissionHistory = [
  { id: 'ph-1', date: 'Jan 12, 2024', action: 'Role Assigned', by: 'Priya Mehta', details: 'Set as Admin' },
  { id: 'ph-2', date: 'Aug 05, 2024', action: 'Permission Updated', by: 'Amit Kumar', details: 'Enabled document sharing' },
  { id: 'ph-3', date: 'Mar 21, 2025', action: 'Permission Updated', by: 'Sneha Reddy', details: 'Disabled storage management' },
  { id: 'ph-4', date: 'Jun 12, 2026', action: 'User Invited', by: 'Priya Mehta', details: 'Invitation sent' },
  { id: 'ph-5', date: 'Jun 12, 2026', action: 'User Activated', by: 'Rahul Sharma', details: 'Invitation accepted' },
]

export const resources = [
  { id: 'engineering', title: 'Engineering', badge: 'Primary Department', description: 'Access to all documents in Engineering department.', documents: 18, owners: ['Rahul Sharma', 'Priya Mehta', 'Dev Malhotra'] },
  { id: 'shared', title: 'Shared with User', badge: '', description: 'Documents shared by other users.', documents: 24, owners: ['Priya Mehta', 'Amit Kumar', 'Sneha Reddy'] },
]

const documents = [
  ['Project_Proposal.pdf', 'PDF', 'Rahul Sharma', 'Owned', '2.4 MB', 'Edited', 'Oct 22, 2026, 10:14 AM', '2026-10-22', 'blue'],
  ['Q3_Report.xlsx', 'XLSX', 'Rahul Sharma', 'Owned', '1.8 MB', 'Downloaded', 'Oct 21, 2026, 04:32 PM', '2026-10-21', 'green'],
  ['Design_Guidelines.docx', 'DOCX', 'Sneha Reddy', 'Shared with user', '3.1 MB', 'Viewed', 'Oct 20, 2026, 11:11 AM', '2026-10-20', 'blue'],
  ['Marketing_Plan.pptx', 'PPTX', 'Rahul Sharma', 'Owned', '5.2 MB', 'Edited', 'Oct 19, 2026, 02:45 PM', '2026-10-19', 'orange'],
  ['Meeting_Notes.txt', 'TXT', 'Amit Kumar', 'Shared with user', '120 KB', 'Viewed', 'Oct 18, 2026, 09:20 AM', '2026-10-18', 'slate'],
  ['Employee_Handbook.pdf', 'PDF', 'HR Team', 'Department', '4.6 MB', 'Downloaded', 'Oct 17, 2026, 03:12 PM', '2026-10-17', 'red'],
  ['Architecture.png', 'PNG', 'Rahul Sharma', 'Owned', '1.2 MB', 'Viewed', 'Oct 16, 2026, 01:08 PM', '2026-10-16', 'blue'],
  ['Source_Files.zip', 'ZIP', 'Rahul Sharma', 'Owned', '12.4 MB', 'Downloaded', 'Oct 15, 2026, 06:54 PM', '2026-10-15', 'amber'],
  ['Product_Roadmap.docx', 'DOCX', 'Priya Mehta', 'Shared with user', '840 KB', 'Edited', 'Oct 14, 2026, 12:03 PM', '2026-10-14', 'blue'],
  ['Onboarding_Checklist.xlsx', 'XLSX', 'Rahul Sharma', 'Owned', '460 KB', 'Edited', 'Oct 13, 2026, 09:44 AM', '2026-10-13', 'green'],
  ['Security_Review.pdf', 'PDF', 'Amit Kumar', 'Shared with user', '2.1 MB', 'Viewed', 'Oct 12, 2026, 03:29 PM', '2026-10-12', 'red'],
  ['Sprint_Retrospective.txt', 'TXT', 'Rahul Sharma', 'Owned', '94 KB', 'Edited', 'Oct 11, 2026, 04:16 PM', '2026-10-11', 'slate'],
  ['API_Reference.pdf', 'PDF', 'Dev Malhotra', 'Shared with user', '5.8 MB', 'Downloaded', 'Oct 10, 2026, 10:55 AM', '2026-10-10', 'red'],
  ['Team_Photo.png', 'PNG', 'Rahul Sharma', 'Owned', '3.4 MB', 'Viewed', 'Oct 09, 2026, 02:26 PM', '2026-10-09', 'blue'],
  ['Budget_2026.xlsx', 'XLSX', 'Finance Team', 'Department', '720 KB', 'Viewed', 'Oct 08, 2026, 11:37 AM', '2026-10-08', 'green'],
  ['Release_Plan.pptx', 'PPTX', 'Rahul Sharma', 'Owned', '6.7 MB', 'Shared', 'Oct 07, 2026, 05:08 PM', '2026-10-07', 'orange'],
]

export const profileDocuments = [
  ...documents.map(([name, type, owner, access, size, action, activity, date, tone], index) => ({
    id: `doc-${index + 1}`, name, type, owner, access, size, action, activity, date, tone,
  })),
  ...Array.from({ length: 45 - documents.length }, (_, index) => {
    const sequence = documents.length + index + 1
    const access = index < 9 ? 'Owned' : index < 18 ? 'Shared with user' : 'Department'
    const type = ['PDF', 'XLSX', 'DOCX', 'PPTX', 'TXT', 'PNG', 'ZIP'][index % 7]
    const tone = { PDF: 'red', XLSX: 'green', DOCX: 'blue', PPTX: 'orange', TXT: 'slate', PNG: 'blue', ZIP: 'amber' }[type]
    const day = 22 - (sequence % 30)
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10)
    const owners = access === 'Owned' ? ['Rahul Sharma'] : access === 'Shared with user' ? ['Priya Mehta', 'Amit Kumar', 'Sneha Reddy'] : ['HR Team', 'Finance Team', 'Legal Team']
    const owner = owners[index % owners.length]
    const name = ['Security_Policy', 'Product_Roadmap', 'Quarterly_Review', 'Team_Guidelines', 'Meeting_Summary'][index % 5] + '_' + String(sequence).padStart(2, '0') + '.' + type.toLowerCase()
    const action = ['Viewed', 'Downloaded', 'Edited', 'Shared'][index % 4]
    const time = ['10:14 AM', '04:32 PM', '11:11 AM', '02:45 PM'][index % 4]
    const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    return { id: `doc-${sequence}`, name, type, owner, access, size: ['840 KB', '1.2 MB', '2.4 MB', '460 KB'][index % 4], action, activity: displayDate + ', ' + time, date, tone }
  }),
]
export const activityMetrics = [
  { label: 'Total Actions', value: 128, trend: '+12%', tone: 'blue', icon: 'document' },
  { label: 'Uploads', value: 28, trend: '+27%', tone: 'green', icon: 'upload' },
  { label: 'Downloads', value: 32, trend: '+14%', tone: 'purple', icon: 'download' },
  { label: 'Edits', value: 18, trend: '+6%', tone: 'orange', icon: 'edit' },
  { label: 'Deletions', value: 3, trend: '+25%', tone: 'red', icon: 'trash' },
]

export const activityDistribution = [
  { name: 'Uploads', value: 28, color: '#2878f0' },
  { name: 'Downloads', value: 32, color: '#16a36a' },
  { name: 'Edits', value: 18, color: '#f59e0b' },
  { name: 'Deletions', value: 3, color: '#f04452' },
  { name: 'Views', value: 47, color: '#8b5cf6' },
]

export const recentActivity = auditSeed.slice(0, 8).map(([timestamp, action, document, details, ip, status, device], index) => ({
  id: `activity-${index + 1}`,
  timestamp,
  action,
  document,
  details,
  ip,
  status,
  device,
}))
export const initialSessions = [
  { id: 'session-windows', device: 'Windows PC', location: 'Hyderabad, India', ip: '192.168.1.24', browser: 'Chrome 130 / Windows 11', lastActive: 'Oct 22, 2026, 10:24 AM' },
  { id: 'session-iphone', device: 'iPhone 14', location: 'Hyderabad, India', ip: '192.168.1.45', browser: 'Safari 17 / iOS 17', lastActive: 'Oct 21, 2026, 08:12 PM' },
]

export const failedLogins = [
  { id: 'failed-1', timestamp: 'Oct 19, 2026, 07:45 PM', ip: '192.168.1.120', location: 'Hyderabad, India', reason: 'Incorrect password' },
  { id: 'failed-2', timestamp: 'Oct 19, 2026, 07:42 PM', ip: '192.168.1.120', location: 'Hyderabad, India', reason: 'Incorrect password' },
  { id: 'failed-3', timestamp: 'Oct 18, 2026, 06:11 PM', ip: '203.0.113.45', location: 'Unknown', reason: 'Incorrect password' },
]

export const loginHistory = [
  { id: 'login-1', timestamp: 'Oct 22, 2026, 10:24 AM', location: '192.168.1.24', device: 'Windows PC', status: 'Success' },
  { id: 'login-2', timestamp: 'Oct 21, 2026, 08:12 PM', location: '192.168.1.45', device: 'iPhone 14', status: 'Success' },
  { id: 'login-3', timestamp: 'Oct 20, 2026, 11:03 AM', location: '192.168.1.89', device: 'MacBook Pro', status: 'Success' },
  { id: 'login-4', timestamp: 'Oct 19, 2026, 07:45 PM', location: '192.168.1.120', device: 'Windows PC', status: 'Failed' },
  { id: 'login-5', timestamp: 'Oct 18, 2026, 06:11 PM', location: '203.0.113.45', device: 'Unknown', status: 'Failed' },
]

export const securityEvents = [
  { id: 'security-1', timestamp: 'Aug 05, 2026, 10:15 AM', event: 'Password changed', details: 'Password changed successfully', status: 'Success' },
  { id: 'security-3', timestamp: 'Jan 12, 2024, 09:18 AM', event: 'Account created', details: 'User account created by Priya Mehta', status: 'Success' },
  { id: 'security-4', timestamp: 'Jan 12, 2024, 09:18 AM', event: 'Invitation sent', details: 'Invitation email sent to rahul.sharma@suredocs.com', status: 'Success' },
]

export const auditMetrics = [
  { label: 'Total Events', value: 128, trend: '+12%', tone: 'blue', icon: 'document' },
  { label: 'Successful Actions', value: 112, trend: '+15%', tone: 'green', icon: 'check' },
  { label: 'Denied Actions', value: 10, trend: '+33%', tone: 'red', icon: 'blocked' },
  { label: 'Security Events', value: 6, trend: '+100%', tone: 'purple', icon: 'shield' },
]

export const auditActionDistribution = [
  { name: 'Upload', value: 28, color: '#2878f0' },
  { name: 'Download', value: 32, color: '#16a36a' },
  { name: 'View', value: 40, color: '#f59e0b' },
  { name: 'Edit', value: 12, color: '#8b5cf6' },
  { name: 'Delete', value: 3, color: '#f04452' },
  { name: 'Share', value: 8, color: '#a855f7' },
  { name: 'Other', value: 5, color: '#64748b' },
]

export const auditRecords = Array.from({ length: 128 }, (_, index) => {
  const seed = auditSeed[index % auditSeed.length]
  const [seedTimestamp, action, resource, details, ip, status, device] = seed
  const timestamp = index < auditSeed.length
    ? seedTimestamp
    : (() => {
      const date = new Date(Date.UTC(2026, 9, 22 - (index % 30), 9 + (index % 10), (index * 7) % 60))
      return date.toISOString().slice(0, 19)
    })()
  const eventStatus = index < auditSeed.length ? status : [20, 36, 52, 68, 84, 100].includes(index) ? 'Denied' : 'Success'
  return {
    id: `audit-${String(index + 1).padStart(3, '0')}`,
    eventId: `EVT-2026-${String(128 - index).padStart(4, '0')}`,
    timestamp,
    user: 'Rahul Sharma',
    action,
    resource,
    details,
    ip,
    status: eventStatus,
    device,
    reason: eventStatus === 'Denied' ? details : '',
  }
})
export function buildTrendData(range = 'Last 30 days', aggregation = 'Daily', audit = false) {
  const points = range === 'Last 7 days' ? 7 : range === 'Last 90 days' ? 90 : 30
  const bucket = aggregation === 'Weekly' ? 7 : aggregation === 'Monthly' ? 30 : 1
  const count = Math.max(1, Math.ceil(points / bucket))
  const anchor = new Date('2026-10-22T12:00:00')
  return Array.from({ length: count }, (_, index) => {
    const daysAgo = (count - index - 1) * bucket
    const date = new Date(anchor)
    date.setDate(anchor.getDate() - daysAgo)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const phase = index + Math.max(1, Math.floor(points / bucket))
    if (audit) {
      return { date: label, success: 20 + ((phase * 7) % 19), denied: 2 + ((phase * 3) % 5) }
    }
    return {
      date: label,
      uploads: 4 + ((phase * 5) % 17),
      downloads: 6 + ((phase * 7) % 19),
      edits: 2 + ((phase * 3) % 9),
      deletions: phase % 5 === 0 ? 4 : 1 + (phase % 3),
    }
  })
}

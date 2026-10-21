import { useEffect, useMemo, useState } from 'react'

const employeeNavigation = [
  { label: 'Dashboard', href: '/employee', icon: 'home' },
  { label: 'My Documents', href: '/employee/documents', icon: 'file' },
  { label: 'Shared with Me', href: '/employee/shared', icon: 'folder' },
  { label: 'Upload Document', href: '/employee/upload', icon: 'upload' },
  { label: 'Document Activity', href: '/employee/activity', icon: 'activity' },
  { label: 'Access Requests', href: '/employee/requests', icon: 'inbox', badge: '3' },
]

const employeeBottomNavigation = [
  { label: 'Profile & Settings', href: '/employee/profile', icon: 'settings' },
  { label: 'Sign Out', href: '/', icon: 'signout' },
]

const employeeDocuments = [
  { name: 'Project_Requirements.pdf', owner: 'You', modified: '27 May 2025', access: 'Owner', type: 'PDF', tone: 'bg-rose-600', size: '2.4 MB', classification: 'Confidential', sharedWith: '3 people', status: 'Shared', description: 'Project requirements and business specifications for Q2.', tags: ['Project', 'Requirements', 'Q2'] },
  { name: 'Employee_Handbook.docx', owner: 'You', modified: '26 May 2025', access: 'Owner', type: 'DOC', tone: 'bg-blue-600', size: '1.8 MB', classification: 'Internal', sharedWith: '5 people', status: 'Shared', description: 'Employee handbook and workplace policies.', tags: ['HR', 'Policy'] },
  { name: 'Financial_Report_Q1.xlsx', owner: 'You', modified: '25 May 2025', access: 'Owner', type: 'XLS', tone: 'bg-emerald-600', size: '3.2 MB', classification: 'Confidential', sharedWith: '2 people', status: 'Shared', description: 'Quarterly financial report for internal review.', tags: ['Finance', 'Q1'] },
  { name: 'Market_Analysis.pdf', owner: 'Marketing', modified: '23 May 2025', access: 'Viewer', type: 'PDF', tone: 'bg-rose-600', size: '1.6 MB', classification: 'Internal', sharedWith: '—', status: 'Private', description: 'Market analysis and quarterly research.', tags: ['Marketing', 'Research'] },
  { name: 'Product_Design.png', owner: 'You', modified: '20 May 2025', access: 'Owner', type: 'IMG', tone: 'bg-violet-600', size: '4.1 MB', classification: 'Internal', sharedWith: '1 person', status: 'Shared', description: 'Product design concept and review image.', tags: ['Design', 'Product'] },
  { name: 'Confidential_Draft.pdf', owner: 'You', modified: '18 May 2025', access: 'Owner', type: 'PDF', tone: 'bg-rose-600', size: '2.8 MB', classification: 'Restricted', sharedWith: '—', status: 'Private', description: 'Confidential draft for leadership review.', tags: ['Restricted', 'Draft'] },
  { name: 'Team_Plan.docx', owner: 'You', modified: '16 May 2025', access: 'Owner', type: 'DOC', tone: 'bg-blue-600', size: '1.2 MB', classification: 'Internal', sharedWith: '4 people', status: 'Shared', description: 'Team goals, milestones, and planning notes.', tags: ['Team', 'Planning'] },
  { name: 'Budget_Proposal.xlsx', owner: 'You', modified: '14 May 2025', access: 'Owner', type: 'XLS', tone: 'bg-emerald-600', size: '2.1 MB', classification: 'Internal', sharedWith: '—', status: 'Private', description: 'Proposed project budget for the next quarter.', tags: ['Budget', 'Proposal'] },
  { name: 'Client_Contract.pdf', owner: 'You', modified: '10 May 2025', access: 'Owner', type: 'PDF', tone: 'bg-rose-600', size: '1.9 MB', classification: 'Confidential', sharedWith: '2 people', status: 'Shared', description: 'Signed client service agreement.', tags: ['Client', 'Legal'] },
  { name: 'Product_Roadmap.pptx', owner: 'You', modified: '08 May 2025', access: 'Owner', type: 'PPT', tone: 'bg-orange-500', size: '3.5 MB', classification: 'Internal', sharedWith: '6 people', status: 'Shared', description: 'Product roadmap and upcoming release milestones.', tags: ['Product', 'Roadmap'] },
]

const sharedDocuments = [
  { name: 'Employee_Policy.pdf', owner: 'HR Team', department: 'Human Resources', modified: '27 May 2025', permission: 'View', expires: '—', size: '2.4 MB', classification: 'Confidential', type: 'PDF', tone: 'bg-rose-600', description: 'Company policies and guidelines for all employees.', tags: ['HR', 'Policy', 'Internal'] },
  { name: 'Team_Guidelines.docx', owner: 'Amit Kumar', department: 'Engineering', modified: '26 May 2025', permission: 'View', expires: '—', size: '1.8 MB', classification: 'Internal', type: 'DOC', tone: 'bg-blue-600', description: 'Guidelines for engineering team collaboration.', tags: ['Team', 'Guidelines'] },
  { name: 'Q2_Budget.xlsx', owner: 'Priya Singh', department: 'Finance', modified: '25 May 2025', permission: 'Download', expires: '30 May 2025', size: '3.2 MB', classification: 'Confidential', type: 'XLS', tone: 'bg-emerald-600', description: 'Department budget summary for Q2.', tags: ['Finance', 'Q2'] },
  { name: 'Project_Plan.pdf', owner: 'Rahul Tomar', department: 'Product', modified: '23 May 2025', permission: 'View', expires: '—', size: '1.6 MB', classification: 'Internal', type: 'PDF', tone: 'bg-rose-600', description: 'Project plan, milestones, and deliverables.', tags: ['Project', 'Plan'] },
  { name: 'Design_Mockup.png', owner: 'Sneha Kapoor', department: 'Design', modified: '20 May 2025', permission: 'View', expires: '—', size: '4.1 MB', classification: 'Internal', type: 'IMG', tone: 'bg-violet-600', description: 'Latest product interface design mockup.', tags: ['Design', 'Product'] },
  { name: 'Client_Contract.pdf', owner: 'Anita Mehta', department: 'Legal', modified: '18 May 2025', permission: 'Download', expires: '28 May 2025', size: '2.8 MB', classification: 'Confidential', type: 'PDF', tone: 'bg-rose-600', description: 'Client contract for legal review.', tags: ['Legal', 'Client'] },
  { name: 'Security_Guidelines.docx', owner: 'IT Team', department: 'Information Security', modified: '16 May 2025', permission: 'View', expires: '—', size: '1.2 MB', classification: 'Internal', type: 'DOC', tone: 'bg-blue-600', description: 'Information security policies and guidelines.', tags: ['Security', 'Policy'] },
  { name: 'Monthly_Report.xlsx', owner: 'Rohit Kulkarni', department: 'Operations', modified: '14 May 2025', permission: 'View', expires: '—', size: '2.1 MB', classification: 'Internal', type: 'XLS', tone: 'bg-emerald-600', description: 'Monthly operational performance report.', tags: ['Operations', 'Report'] },
  { name: 'Confidential_Strategy.pdf', owner: 'Suresh Nair', department: 'Management', modified: '10 May 2025', permission: 'View', expires: '05 Jun 2025', size: '1.9 MB', classification: 'Restricted', type: 'PDF', tone: 'bg-rose-600', description: 'Confidential company strategy document.', tags: ['Strategy', 'Restricted'] },
  { name: 'Product_Roadmap.pptx', owner: 'Amit Kumar', department: 'Engineering', modified: '08 May 2025', permission: 'Download', expires: '—', size: '3.5 MB', classification: 'Internal', type: 'PPT', tone: 'bg-orange-500', description: 'Product roadmap and upcoming release milestones.', tags: ['Product', 'Roadmap'] },
]

const activityRecords = [
  { time: '27 May 2025 10:24 AM', action: 'Document viewed', document: 'Employee_Policy.pdf', type: 'PDF (2.4 MB)', actor: 'Amit Kumar', department: 'Engineering', outcome: 'Success', icon: 'eye', ip: '192.168.1.45' },
  { time: '26 May 2025 03:15 PM', action: 'Document downloaded', document: 'Team_Plan.docx', type: 'DOCX (1.8 MB)', actor: 'Priya Singh', department: 'Finance', outcome: 'Success', icon: 'download', ip: '192.168.1.33' },
  { time: '25 May 2025 01:40 PM', action: 'Access granted', document: 'Project_Requirements.pdf', type: 'PDF (2.4 MB)', actor: 'You', department: 'Owner', outcome: 'Success', icon: 'share', ip: '192.168.1.45' },
  { time: '24 May 2025 02:30 PM', action: 'Permission changed', document: 'Financial_Report.xlsx', type: 'XLSX (3.2 MB)', actor: 'Rahul Tomar', department: 'Product', outcome: 'Success', icon: 'edit', ip: '192.168.1.56' },
  { time: '23 May 2025 09:05 AM', action: 'New access request', document: 'Market_Analysis.pdf', type: 'PDF (1.6 MB)', actor: 'Suresh Nair', department: 'Management', outcome: 'Pending', icon: 'users', ip: '192.168.1.75' },
  { time: '23 May 2025 04:12 PM', action: 'Access denied', document: 'Confidential_Draft.pdf', type: 'PDF (2.8 MB)', actor: 'Anita Mehta', department: 'Legal', outcome: 'Denied', icon: 'denied', ip: '192.168.1.88' },
  { time: '20 May 2025 10:18 AM', action: 'Document uploaded', document: 'Product_Design.png', type: 'PNG (4.1 MB)', actor: 'You', department: 'Owner', outcome: 'Success', icon: 'bell', ip: '192.168.1.45' },
  { time: '18 May 2025 02:30 PM', action: 'Access revoked', document: 'Old_Report.pdf', type: 'PDF (1.9 MB)', actor: 'You', department: 'Owner', outcome: 'Success', icon: 'share', ip: '192.168.1.45' },
  { time: '16 May 2025 01:15 PM', action: 'Document viewed', document: 'Security_Guidelines.docx', type: 'DOCX (1.2 MB)', actor: 'Rohit Kulkarni', department: 'Operations', outcome: 'Success', icon: 'eye', ip: '192.168.1.91' },
  { time: '14 May 2025 11:50 AM', action: 'Document downloaded', document: 'Budget_Proposal.xlsx', type: 'XLSX (2.1 MB)', actor: 'Amit Kumar', department: 'Engineering', outcome: 'Success', icon: 'download', ip: '192.168.1.33' },
]

const requestExamples = [
  { id: 'REQ-2025-001', requester: 'Amit Kumar', department: 'Engineering', document: 'Project_Requirements.pdf', size: '2.4 MB', permission: 'Download', reason: 'Need to download for Q2 analysis.', requested: '27 May 2025 10:24 AM', status: 'Pending', expires: '30 Jun 2025', attachment: 'Q2_Analysis_Plan.pdf (120 KB)' },
  { id: 'REQ-2025-002', requester: 'Priya Singh', department: 'Finance', document: 'Financial_Report_Q1.xlsx', size: '3.2 MB', permission: 'View', reason: 'Need access to review budget details.', requested: '26 May 2025 03:15 PM', status: 'Pending', expires: '—', attachment: '' },
  { id: 'REQ-2025-003', requester: 'Suresh Nair', department: 'Management', document: 'Team_Guidelines.docx', size: '1.8 MB', permission: 'View', reason: 'Please share the latest team guidelines.', requested: '25 May 2025 01:40 PM', status: 'Approved', expires: '—', attachment: '' },
  { id: 'REQ-2025-004', requester: 'Rahul Tomar', department: 'Product', document: 'Design_Mockup.png', size: '4.1 MB', permission: 'View', reason: 'Need to review product design.', requested: '23 May 2025 11:20 AM', status: 'Rejected', expires: '—', attachment: '' },
  { id: 'REQ-2025-005', requester: 'Anita Mehta', department: 'Legal', document: 'Confidential_Draft.pdf', size: '2.8 MB', permission: 'View', reason: 'Need the draft for legal review.', requested: '18 May 2025 09:05 AM', status: 'Approved', expires: '30 Jun 2025', attachment: '' },
  { id: 'REQ-2025-006', requester: 'Rohit Kulkarni', department: 'Operations', document: 'Budget_Proposal.xlsx', size: '2.1 MB', permission: 'View', reason: 'Please share this document for planning.', requested: '16 May 2025 02:30 PM', status: 'Approved', expires: '—', attachment: '' },
  { id: 'REQ-2025-007', requester: 'Amit Kumar', department: 'Engineering', document: 'Product_Roadmap.pptx', size: '3.5 MB', permission: 'Download', reason: 'Need a copy for the upcoming client meeting.', requested: '14 May 2025 10:16 AM', status: 'Pending', expires: '30 Jun 2025', attachment: '' },
  { id: 'REQ-2025-008', requester: 'Sneha Kapoor', department: 'Design', document: 'Product_Design.png', size: '4.1 MB', permission: 'View', reason: 'Need to review latest design assets.', requested: '12 May 2025 04:10 PM', status: 'Approved', expires: '—', attachment: '' },
  { id: 'REQ-2025-009', requester: 'You (Vinay Sharma)', department: 'Engineering', document: 'Security_Guidelines.docx', size: '1.2 MB', permission: 'View', reason: 'I need the security guidelines for my current project.', requested: '11 May 2025 09:30 AM', status: 'Pending', expires: '—', attachment: '', isMine: true },
  { id: 'REQ-2025-010', requester: 'You (Vinay Sharma)', department: 'Engineering', document: 'Team_Guidelines.docx', size: '1.8 MB', permission: 'View', reason: 'I need to review the latest team guidelines.', requested: '09 May 2025 01:45 PM', status: 'Approved', expires: '—', attachment: '', isMine: true },
  { id: 'REQ-2025-011', requester: 'You (Vinay Sharma)', department: 'Engineering', document: 'Confidential_Draft.pdf', size: '2.8 MB', permission: 'View', reason: 'I need the draft for a project review.', requested: '08 May 2025 11:15 AM', status: 'Rejected', expires: '—', attachment: '', isMine: true },
]

const additionalOwnedDocuments = [
  'Sales_Overview.pdf', 'Product_Brief.docx', 'Operations_Guide.pdf', 'Hiring_Plan.xlsx',
  'Customer_Research.pdf', 'Design_Review.png', 'Quarterly_Update.pptx', 'Vendor_Notes.docx',
  'Team_Objectives.pdf', 'Training_Materials.pptx', 'Travel_Budget.xlsx', 'Release_Checklist.docx',
  'Support_Playbook.pdf', 'Annual_Plan.pptx',
].map((name, index) => {
  const extension = name.split('.').pop()
  const type = extension === 'xlsx' ? 'XLS' : extension === 'docx' ? 'DOC' : extension === 'pptx' ? 'PPT' : extension === 'png' ? 'IMG' : 'PDF'
  return {
    name,
    owner: 'You',
    modified: `${String(6 + (index % 20)).padStart(2, '0')} May 2025`,
    access: 'Owner',
    type,
    tone: type === 'XLS' ? 'bg-emerald-600' : type === 'DOC' ? 'bg-blue-600' : type === 'PPT' ? 'bg-orange-500' : type === 'IMG' ? 'bg-violet-600' : 'bg-rose-600',
    size: `${(1.1 + (index % 5) * 0.6).toFixed(1)} MB`,
    classification: index % 4 === 0 ? 'Confidential' : 'Internal',
    sharedWith: index % 2 ? '—' : '2 people',
    status: index % 2 ? 'Private' : 'Shared',
    description: 'SureDocs employee document for internal collaboration.',
    tags: ['Internal', 'Project'],
  }
})
const ownedDocumentRecords = [...employeeDocuments, ...additionalOwnedDocuments]
const additionalSharedDocuments = [
  { ...sharedDocuments[0], name: 'Office_Policies.pdf', owner: 'HR Team', modified: '06 May 2025', permission: 'View', expires: '—' },
  { ...sharedDocuments[1], name: 'Engineering_Roadmap.pptx', owner: 'Amit Kumar', modified: '04 May 2025', permission: 'Download', expires: '—', type: 'PPT', tone: 'bg-orange-500', size: '3.5 MB' },
]
const sharedDocumentRecords = [...sharedDocuments, ...additionalSharedDocuments]
const allActivityRecords = Array.from({ length: 48 }, (_, index) => {
  const event = activityRecords[index % activityRecords.length]
  if (index < activityRecords.length) return event
  const day = 13 + ((index - activityRecords.length) % 14)
  return { ...event, time: `${String(day).padStart(2, '0')} May 2025 10:${String(index % 60).padStart(2, '0')}:00 AM` }
})

const employeeActivities = [
  { icon: 'eye', tone: 'bg-blue-50 text-blue-700', title: 'Document viewed', detail: 'You viewed Employee_Policy.pdf', time: 'Just now' },
  { icon: 'share', tone: 'bg-emerald-50 text-emerald-700', title: 'Access granted', detail: 'You shared Project_Requirements.pdf with Amit Kumar', time: '2 hours ago' },
  { icon: 'download', tone: 'bg-emerald-50 text-emerald-700', title: 'Document downloaded', detail: 'Amit Kumar downloaded Team_Plan.docx', time: '5 hours ago' },
  { icon: 'edit', tone: 'bg-amber-50 text-amber-700', title: 'Permission changed', detail: 'Access to Financial_Report.xlsx was updated', time: 'Yesterday' },
  { icon: 'denied', tone: 'bg-rose-50 text-rose-700', title: 'Access denied', detail: 'A blocked access attempt to Confidential_Draft.pdf', time: 'Yesterday' },
  { icon: 'bell', tone: 'bg-amber-50 text-amber-700', title: 'New access request', detail: 'Priya Mehta requested download access to Market_Analysis.pdf', time: '2 days ago' },
]

const employeeNotifications = [
  { icon: 'users', tone: 'bg-indigo-50 text-indigo-700', title: 'New sharing invitation', detail: 'HR Team shared Employee_Handbook.pdf with you', time: '1 hour ago' },
  { icon: 'clock', tone: 'bg-amber-50 text-amber-700', title: 'Access request pending', detail: 'Priya Mehta requested download access to Market_Analysis.pdf', time: '3 hours ago' },
  { icon: 'security', tone: 'bg-emerald-50 text-emerald-700', title: 'Permission revoked', detail: 'Your access to Old_Report.pdf has been revoked', time: '1 day ago' },
  { icon: 'info', tone: 'bg-sky-50 text-sky-700', title: 'Access expiring soon', detail: 'Your access to Project_Plan.pdf will expire in 3 days', time: '2 days ago' },
]

function EmployeeIcon({ name, className = 'h-4 w-4' }) {
  const content = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M4 15v5h16v-5" /></>,
    activity: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
    inbox: <><path d="M4 4h16l1 11h-6l-3 4-3-4H3z" /><path d="M4 4 2 20h20L20 4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4L7.1 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 2Z" transform="translate(-1 -1)" /></>,
    signout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.4" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    edit: <><path d="m16 4 4 4L9 19l-5 1 1-5z" /><path d="m14 6 4 4" /></>,
    denied: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    security: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="10" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    cloud: <><path d="M20 16.2A4.5 4.5 0 0 0 18.5 7a6 6 0 0 0-11.7 1.5A4 4 0 0 0 7 16.5h13Z" /><path d="M12 19v-7m-3 3 3-3 3 3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    trash: <><path d="M3 6h18m-2 0-.9 14H5.9L5 6m3 0V4h8v2m-7 4v6m4-6v6" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></>,
    filter: <><path d="M4 5h16l-6.5 7.5v5l-3 1v-6L4 5Z" /></>,
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {content[name]}
    </svg>
  )
}

function EmployeeBrand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white">
        <EmployeeIcon className="h-5 w-5" name="security" />
      </span>
      <span>
        <span className="block text-[17px] font-bold leading-5 tracking-tight text-white">SureDocs</span>
        <span className="block text-[8px] text-slate-300">Secure Document Sharing</span>
      </span>
    </div>
  )
}

function EmployeeSidebar({ pathname }) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-[#0c2b34] text-slate-200 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[180px]">
      <EmployeeBrand />
      <nav aria-label="Employee navigation" className="flex gap-1 overflow-x-auto px-2 pb-3 lg:flex-col lg:overflow-visible">
        {employeeNavigation.map((item) => {
          const active = item.href === '/employee'
            ? pathname === '/employee' || pathname === '/employee/dashboard'
            : pathname.startsWith(item.href)
          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${
                active ? 'bg-[#105b59] text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
              href={item.href}
              key={item.href}
            >
              <EmployeeIcon className="h-4 w-4" name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.badge && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">{item.badge}</span>}
            </a>
          )
        })}
      </nav>
      <nav aria-label="Account navigation" className="mt-2 flex gap-1 border-t border-white/10 px-2 pt-3 lg:mt-auto lg:flex-col lg:pb-4">
        {employeeBottomNavigation.map((item) => {
          const active = item.href !== '/' && pathname.startsWith(item.href)
          return (
            <a className={`flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-[10px] font-medium hover:bg-white/10 hover:text-white ${active ? 'bg-[#105b59] text-white' : 'text-slate-200'}`} href={item.href} key={item.href}>
              <EmployeeIcon className="h-4 w-4" name={item.icon} />
              {item.label}
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

function EmployeeTopBar({ notificationsOpen, setNotificationsOpen, unreadCount, search, onSearchChange }) {
  const searchProps = search === undefined ? {} : { onChange: onSearchChange, value: search }

  return (
    <header className="flex min-h-[48px] items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-5">
      <label className="relative hidden w-full max-w-[380px] sm:block">
        <span className="sr-only">Search documents</span>
        <EmployeeIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" name="search" />
        <input className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-[9px] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" placeholder="Search documents, owners, or keywords..." type="search" {...searchProps} />
      </label>
      <div className="ml-auto flex items-center gap-3">
        <div className="relative">
          <button aria-expanded={notificationsOpen} aria-label={`Notifications, ${unreadCount} unread`} className="relative rounded-md p-1.5 text-[#125b63] hover:bg-slate-100" onClick={() => setNotificationsOpen((open) => !open)} type="button">
            <EmployeeIcon className="h-4 w-4" name="bell" />
            {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[7px] font-bold text-white">{unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-9 z-20 w-[min(320px,calc(100vw-24px))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-800">Notifications</h2>
                <span className="text-[9px] text-slate-500">{unreadCount} unread</span>
              </div>
              <ul className="mt-2 space-y-2">
                {employeeNotifications.slice(0, 3).map((notification) => (
                  <li className="border-t border-slate-100 pt-2" key={notification.title}>
                    <p className="text-[9px] font-semibold text-slate-700">{notification.title}</p>
                    <p className="mt-0.5 text-[8px] text-slate-500">{notification.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0e8290] text-[9px] font-semibold text-white">VS</span>
          <span className="hidden sm:block">
            <span className="block text-[9px] font-semibold text-slate-800">Vinay Sharma</span>
            <span className="block text-[8px] text-slate-500">Employee</span>
          </span>
          <span aria-hidden="true" className="hidden text-slate-500 sm:block">⌄</span>
        </div>
      </div>
    </header>
  )
}

function QuickLink({ href, icon, title, detail, primary = false }) {
  return (
    <a className={`group flex min-h-[54px] items-center gap-3 rounded-lg border px-3 py-2 transition hover:-translate-y-0.5 hover:shadow-sm ${primary ? 'border-[#07847d] bg-[#07847d] text-white hover:bg-[#08756f]' : 'border-slate-200 bg-white text-slate-800 hover:border-teal-200'}`} href={href}>
      <EmployeeIcon className={`h-6 w-6 shrink-0 ${primary ? 'text-white' : 'text-[#176777]'}`} name={icon} />
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-semibold">{title}</span>
        <span className={`mt-0.5 block truncate text-[8px] ${primary ? 'text-teal-50' : 'text-slate-500'}`}>{detail}</span>
      </span>
    </a>
  )
}

function EmployeeDocumentIcon({ document }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${document.tone} text-[6px] font-bold text-white`}>
      {document.type}
    </span>
  )
}

function PanelHeading({ title, href, linkText = 'View All' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-semibold text-slate-800">{title}</h2>
      <a className="whitespace-nowrap text-[8px] font-semibold text-blue-600 hover:text-blue-800" href={href}>{linkText}</a>
    </div>
  )
}

function EmployeeDashboardContent() {
  const [search, setSearch] = useState('')
  const [notifications, setNotifications] = useState(employeeNotifications)
  const [unreadCount, setUnreadCount] = useState(5)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const filteredDocuments = useMemo(() => employeeDocuments.filter((document) =>
    `${document.name} ${document.owner} ${document.access}`.toLowerCase().includes(search.toLowerCase()),
  ), [search])

  const quickLinks = [
    { href: '/employee/upload', icon: 'upload', title: 'Upload Document', detail: 'Add a new document', primary: true },
    { href: '/employee/documents', icon: 'folder', title: 'My Documents', detail: 'View and manage your files' },
    { href: '/employee/shared', icon: 'users', title: 'Shared with Me', detail: 'Access documents shared with you' },
    { href: '/employee/permissions', icon: 'share', title: 'Sharing & Permissions', detail: 'Manage access to your documents' },
  ]
  const metricCards = [
    { icon: 'file', value: '24', label: 'My Documents', detail: 'Owned by you', tone: 'bg-teal-50 text-emerald-700', badge: 'bg-emerald-100' },
    { icon: 'folder', value: '12', label: 'Shared with Me', detail: 'Available to access', tone: 'bg-blue-50 text-blue-700', badge: 'bg-blue-100' },
    { icon: 'users', value: '8', label: 'Documents I Share', detail: 'Owned and shared by you', tone: 'bg-violet-50 text-violet-700', badge: 'bg-violet-100' },
    { icon: 'clock', value: '3', label: 'Pending Requests', detail: 'Requiring your attention', tone: 'bg-amber-50 text-amber-700', badge: 'bg-amber-100' },
  ]

  function markNotificationsRead() {
    setNotifications([])
    setUnreadCount(0)
    setNotificationsOpen(false)
  }

  return (
    <>
      <EmployeeTopBar
        notificationsOpen={notificationsOpen}
        onSearchChange={(event) => setSearch(event.target.value)}
        search={search}
        setNotificationsOpen={setNotificationsOpen}
        unreadCount={unreadCount}
      />
      <main className="mx-auto max-w-[1600px] space-y-3 px-4 pb-5 pt-4 sm:px-5 lg:px-5">
        <section className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Good morning, Vinay!</h1>
            <p className="mt-0.5 text-[10px] text-slate-600">Your secure workspace for documents, sharing and access activity.</p>
          </div>
          <div className="text-left text-[8px] text-slate-500 sm:text-right">
            <p className="font-semibold text-slate-600">Tuesday, 27 May 2025</p>
            <p className="mt-0.5">Stay productive and secure with SureDocs.</p>
          </div>
        </section>

        <section aria-label="Employee quick links" className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => <QuickLink {...link} key={link.title} />)}
        </section>

        <section aria-label="Document summary" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {metricCards.map((card) => (
            <a className={`flex min-h-[76px] items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 ${card.tone}`} href={card.label === 'Shared with Me' ? '/employee/shared' : card.label === 'Pending Requests' ? '/employee/requests' : '/employee/documents'} key={card.label}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.badge}`}>
                <EmployeeIcon className="h-5 w-5" name={card.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-[21px] font-bold leading-6 text-slate-900">{card.value}</span>
                <span className="block truncate text-[10px] font-semibold text-slate-800">{card.label}</span>
                <span className="mt-0.5 block truncate text-[8px] text-slate-500">{card.detail}</span>
              </span>
            </a>
          ))}
        </section>

        <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[1.05fr_0.9fr]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <PanelHeading href="/employee/documents" title="Recent Documents" />
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[400px] border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr className="text-[8px] font-semibold text-slate-500">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Last Modified</th>
                    <th className="px-2 py-2">Access</th>
                    <th className="w-8 px-2 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60" key={document.name}>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <EmployeeDocumentIcon document={document} />
                          <span className="whitespace-nowrap text-[8px] font-medium text-slate-700">{document.name}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-[8px] text-slate-500">{document.owner}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-[8px] text-slate-500">{document.modified}</td>
                      <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[7px] font-semibold ${document.access === 'Owner' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-700'}`}>{document.access}</span></td>
                      <td className="px-2 py-2 text-center"><button aria-label={`More actions for ${document.name}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" type="button"><EmployeeIcon className="h-3.5 w-3.5" name="more" /></button></td>
                    </tr>
                  ))}
                  {filteredDocuments.length === 0 && <tr><td className="px-2 py-6 text-center text-[9px] text-slate-500" colSpan={5}>No documents match your search.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <PanelHeading href="/employee/activity" title="Recent Activity" />
            <ul className="mt-1 divide-y divide-slate-100">
              {employeeActivities.map((activity) => (
                <li className="flex items-center gap-2 py-1.5" key={activity.title}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${activity.tone}`}><EmployeeIcon className="h-3.5 w-3.5" name={activity.icon} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[8px] font-semibold text-slate-800">{activity.title}</span>
                    <span className="mt-0.5 block truncate text-[7px] text-slate-500">{activity.detail}</span>
                  </span>
                  <span className="whitespace-nowrap text-[7px] text-slate-500">{activity.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[1.05fr_0.9fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <PanelHeading href="/employee/notifications" title="Notifications" />
              <button className="text-[7px] font-medium text-blue-600 hover:text-blue-800" onClick={markNotificationsRead} type="button">Mark all read</button>
            </div>
            <ul className="mt-1 divide-y divide-slate-100">
              {notifications.map((notification) => (
                <li className="flex items-center gap-2 py-1.5" key={notification.title}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${notification.tone}`}><EmployeeIcon className="h-3.5 w-3.5" name={notification.icon} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 text-[8px] font-semibold text-slate-800">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />{notification.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[7px] text-slate-500">{notification.detail}</span>
                  </span>
                  <span className="whitespace-nowrap text-[7px] text-slate-500">{notification.time}</span>
                </li>
              ))}
              {notifications.length === 0 && <li className="py-4 text-center text-[8px] text-slate-500">You&apos;re all caught up.</li>}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <PanelHeading href="/employee/profile" linkText="View Details" title="Access Summary" />
            <div className="mt-2 flex items-center gap-3 rounded-md bg-emerald-50 px-3 py-2.5">
              <EmployeeIcon className="h-7 w-7 shrink-0 text-emerald-700" name="security" />
              <span>
                <span className="block text-[9px] font-semibold text-emerald-800">Your account is active</span>
                <span className="mt-0.5 block text-[7px] text-slate-600">All security settings are up to date.</span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[
                { icon: 'clock', value: '2', detail: 'Documents expiring soon', tone: 'bg-amber-50 text-amber-700' },
                { icon: 'users', value: '1', detail: 'Pending approval (as owner)', tone: 'bg-indigo-50 text-indigo-700' },
                { icon: 'file', value: '0', detail: 'Your pending requests', tone: 'bg-sky-50 text-sky-700' },
              ].map((item) => (
                <div className="flex min-h-[52px] items-start gap-1.5 rounded-md border border-slate-100 p-2" key={item.detail}>
                  <EmployeeIcon className={`h-4 w-4 shrink-0 ${item.tone.split(' ')[1]}`} name={item.icon} />
                  <span>
                    <span className="block text-[12px] font-semibold leading-3 text-slate-800">{item.value}</span>
                    <span className="mt-1 block text-[7px] leading-3 text-slate-500">{item.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  )
}

function EmployeePageHeader({ title, description, icon, action }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <EmployeeIcon className="h-4 w-4" name={icon} />
        </span>
        <div>
          <h1 className="text-[19px] font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-0.5 text-[9px] text-slate-500">{description}</p>
        </div>
      </div>
      {action}
    </header>
  )
}

function EmployeeMetric({ value, title, detail, icon, color }) {
  const colors = {
    teal: 'bg-teal-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    green: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <article className={`flex min-h-[68px] items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 ${colors[color]}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70">
        <EmployeeIcon className="h-5 w-5" name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-[19px] font-bold leading-5 text-slate-900">{value}</span>
        <span className="block truncate text-[9px] font-semibold text-slate-800">{title}</span>
        <span className="mt-0.5 block truncate text-[7px] text-slate-500">{detail}</span>
      </span>
    </article>
  )
}

function EmployeeSearch({ label, placeholder, value, onChange }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <EmployeeIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" name="search" />
      <input
        className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[9px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  )
}

function EmployeeFilter({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`block min-w-[105px] ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-700 outline-none focus:border-teal-500"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  )
}

function EmployeeBadge({ children, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
    violet: 'bg-violet-100 text-violet-700',
    slate: 'bg-slate-100 text-slate-600',
  }
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[7px] font-semibold ${tones[tone]}`}>{children}</span>
}

function EmployeePagination({ count, page, pageSize, onPageChange, label = 'documents' }) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const start = count ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, count)
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
      <p className="text-[8px] text-slate-500">Showing {start} to {end} of {count} {label}</p>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" className="rounded border border-slate-200 p-1 text-slate-600 disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button"><EmployeeIcon className="h-3 w-3 rotate-180" name="arrow" /></button>
        {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => {
          const number = index + Math.max(1, Math.min(page - 1, pageCount - 2))
          return <button aria-current={page === number ? 'page' : undefined} className={`h-6 min-w-6 rounded px-1.5 text-[8px] font-semibold ${page === number ? 'bg-[#087c77] text-white' : 'border border-slate-200 text-slate-600'}`} key={number} onClick={() => onPageChange(number)} type="button">{number}</button>
        })}
        <button aria-label="Next page" className="rounded border border-slate-200 p-1 text-slate-600 disabled:opacity-40" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} type="button"><EmployeeIcon className="h-3 w-3" name="arrow" /></button>
      </div>
    </footer>
  )
}

function EmployeeDocumentsPage({ shared = false }) {
  const docs = shared ? sharedDocumentRecords : ownedDocumentRecords
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [classification, setClassification] = useState('all')
  const [status, setStatus] = useState('all')
  const [expiry, setExpiry] = useState('all')
  const [dateOrder, setDateOrder] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedName, setSelectedName] = useState(docs[0].name)
  const [tab, setTab] = useState('Details')
  const [notice, setNotice] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tagsByDocument, setTagsByDocument] = useState({})
  const pageSize = 10

  const filtered = docs.filter((document) => {
    const content = `${document.name} ${document.owner} ${document.classification} ${document.tags.join(' ')}`.toLowerCase()
    const documentStatus = shared ? document.permission : document.status
    return (!search || content.includes(search.toLowerCase())) &&
      (type === 'all' || document.type === type) &&
      (shared
        ? classification === 'all' || document.owner === classification
        : classification === 'all' || document.classification === classification) &&
      (status === 'all' || documentStatus === status) &&
      (!shared || expiry === 'all' ||
        (expiry === 'soon'
          ? document.expires !== '—' &&
            new Date(document.expires) >= new Date('2025-05-27') &&
            new Date(document.expires) <= new Date('2025-06-03')
          : document.expires === '—'))
  }).sort((first, second) => dateOrder === 'newest'
    ? new Date(second.modified) - new Date(first.modified)
    : new Date(first.modified) - new Date(second.modified))
  const selected = selectedName
    ? filtered.find((document) => document.name === selectedName) ?? filtered[0]
    : undefined
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function resetFilters() {
    setSearch('')
    setType('all')
    setClassification('all')
    setStatus('all')
    setExpiry('all')
    setDateOrder('newest')
    setPage(1)
  }

  function announceAction(action) {
    setNotice(`${action} is a preview only. Document storage is not connected.`)
  }

  function addTag() {
    if (!tagInput.trim() || !selected) return
    setTagsByDocument((current) => ({
      ...current,
      [selected.name]: [...(current[selected.name] ?? selected.tags), tagInput.trim()],
    }))
    setTagInput('')
  }

  const metrics = shared
    ? [
        { value: '12', title: 'Shared Documents', detail: 'Available to you', icon: 'folder', color: 'blue' },
        { value: '9', title: 'View Access', detail: 'You can view', icon: 'eye', color: 'green' },
        { value: '5', title: 'Download Access', detail: 'You can download', icon: 'download', color: 'violet' },
        { value: '2', title: 'Expiring Soon', detail: 'Access expires within 7 days', icon: 'clock', color: 'amber' },
      ]
    : [
        { value: '24', title: 'Total Documents', detail: 'Owned by you', icon: 'file', color: 'teal' },
        { value: '8', title: 'Shared Documents', detail: 'Shared with others', icon: 'users', color: 'violet' },
        { value: '2', title: 'Expiring Soon', detail: 'Access expires within 7 days', icon: 'clock', color: 'amber' },
        { value: '1.2 GB', title: 'Storage Used', detail: 'of 10 GB allocated', icon: 'download', color: 'blue' },
      ]

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-5">
      <EmployeePageHeader
        action={!shared && <a className="inline-flex h-8 items-center gap-2 rounded-md bg-[#087c77] px-3 text-[9px] font-semibold text-white hover:bg-[#066c68]" href="/employee/upload"><EmployeeIcon className="h-3.5 w-3.5" name="plus" />Upload Document</a>}
        description={shared ? 'Documents shared with you by other team members. Access, view and download based on your permissions.' : 'Manage the documents you own. Upload, organize, share and track access.'}
        icon={shared ? 'users' : 'file'}
        title={shared ? 'Shared with Me' : 'My Documents'}
      />

      <section aria-label={shared ? 'Shared document summary' : 'My document summary'} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => <EmployeeMetric {...metric} key={metric.title} />)}
      </section>

      <div className={`grid grid-cols-1 items-start gap-2 ${selected ? 'lg:grid-cols-[minmax(0,1fr)_280px]' : ''}`}>
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-2.5">
            <EmployeeSearch label={shared ? 'Search shared documents' : 'Search your documents'} onChange={(value) => { setSearch(value); setPage(1) }} placeholder={shared ? 'Search shared documents...' : 'Search your documents...'} value={search} />
            <EmployeeFilter label="File type" onChange={(value) => { setType(value); setPage(1) }} options={[{ value: 'all', label: 'File Type' }, ...[...new Set(docs.map((document) => document.type))].map((value) => ({ value, label: value }))]} value={type} />
            {shared
              ? <EmployeeFilter label="Owner" onChange={(value) => { setClassification(value); setPage(1) }} options={[{ value: 'all', label: 'Owner' }, ...[...new Set(docs.map((document) => document.owner))].map((value) => ({ value, label: value }))]} value={classification} />
              : <EmployeeFilter label="Classification" onChange={(value) => { setClassification(value); setPage(1) }} options={[{ value: 'all', label: 'Classification' }, ...['Confidential', 'Internal', 'Restricted'].map((value) => ({ value, label: value }))]} value={classification} />}
            <EmployeeFilter label={shared ? 'Permission' : 'Sharing status'} onChange={(value) => { setStatus(value); setPage(1) }} options={shared ? [{ value: 'all', label: 'Permission' }, { value: 'View', label: 'View' }, { value: 'Download', label: 'Download' }] : [{ value: 'all', label: 'Sharing Status' }, { value: 'Shared', label: 'Shared' }, { value: 'Private', label: 'Private' }]} value={status} />
            {!shared && <EmployeeFilter label="Date modified" onChange={setDateOrder} options={[{ value: 'newest', label: 'Date Modified ↓' }, { value: 'oldest', label: 'Date Modified ↑' }]} value={dateOrder} />}
            {shared && <EmployeeFilter label="Expiry date" onChange={(value) => { setExpiry(value); setPage(1) }} options={[{ value: 'all', label: 'Expiry Date' }, { value: 'none', label: 'No expiry' }, { value: 'soon', label: 'Expiring soon' }]} value={expiry} />}
            <button className="ml-auto h-8 rounded-md border border-slate-200 px-3 text-[8px] font-semibold text-blue-600 hover:bg-blue-50" onClick={resetFilters} type="button">Reset</button>
          </div>

          {notice && <p aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-3 py-2 text-[8px] text-blue-800">{notice}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[610px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="text-[8px] font-semibold text-slate-500">
                  <th className="w-8 px-2 py-2"><input aria-label="Select all documents" type="checkbox" /></th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">{shared ? 'Owner' : 'Classification'}</th>
                  <th className="px-2 py-2">{shared ? 'Shared On' : 'Last Modified'} ↓</th>
                  <th className="px-2 py-2">{shared ? 'Permission' : 'Shared With'}</th>
                  <th className="px-2 py-2">{shared ? 'Expires On' : 'Status'}</th>
                  <th className="w-9 px-2 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((document) => (
                  <tr aria-selected={selected?.name === document.name} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/60 ${selected?.name === document.name ? 'bg-blue-50/70' : ''}`} key={document.name} onClick={() => { setSelectedName(document.name); setTab('Details'); setNotice('') }}>
                    <td className="px-2 py-2"><input aria-label={`Select ${document.name}`} checked={selected?.name === document.name} onChange={() => setSelectedName(document.name)} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>
                    <td className="px-2 py-2">
                      <span className="flex min-w-[140px] items-center gap-2">
                        <EmployeeDocumentIcon document={document} />
                        <span className="min-w-0"><span className="block truncate text-[8px] font-medium text-slate-700">{document.name}</span><span className="block text-[7px] text-slate-500">{document.size}</span></span>
                      </span>
                    </td>
                    <td className="px-2 py-2">{shared ? <span><span className="block text-[8px] text-slate-700">{document.owner}</span><span className="block text-[7px] text-slate-500">{document.department}</span></span> : <EmployeeBadge tone={document.classification === 'Confidential' ? 'red' : document.classification === 'Restricted' ? 'violet' : 'blue'}>{document.classification}</EmployeeBadge>}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-[8px] text-slate-600">{document.modified}<span className="block text-[7px] text-slate-400">10:24 AM</span></td>
                    <td className="px-2 py-2">{shared ? <EmployeeBadge tone={document.permission === 'Download' ? 'green' : 'blue'}>{document.permission}</EmployeeBadge> : <span className="text-[8px] text-slate-600">{document.sharedWith}</span>}</td>
                    <td className="px-2 py-2">{shared ? <span className={`whitespace-nowrap text-[8px] ${document.expires !== '—' ? 'font-semibold text-orange-600' : 'text-slate-500'}`}>{document.expires}</span> : <EmployeeBadge tone={document.status === 'Shared' ? 'green' : 'slate'}>{document.status}</EmployeeBadge>}</td>
                    <td className="px-2 py-2 text-center"><button aria-label={`More actions for ${document.name}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); setSelectedName(document.name) }} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="more" /></button></td>
                  </tr>
                ))}
                {visible.length === 0 && <tr><td className="px-3 py-8 text-center text-[9px] text-slate-500" colSpan={7}>No documents match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <EmployeePagination count={filtered.length} label="documents" onPageChange={setPage} page={page} pageSize={pageSize} />
        </section>

        {selected && (
          <aside aria-label={`${shared ? 'Shared document' : 'Document'} details`} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-2 border-b border-slate-100 p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <EmployeeDocumentIcon document={selected} />
                <span className="min-w-0"><span className="block truncate text-[9px] font-semibold text-slate-800">{selected.name}</span><span className="block text-[7px] text-slate-500">{selected.size} · {selected.type} · {shared ? `Shared by ${selected.owner}` : 'Uploaded by you'}</span><span className="block text-[7px] text-slate-500">{selected.modified}, 10:24 AM</span></span>
              </div>
              <button aria-label="Close document details" className="rounded p-0.5 text-slate-400 hover:bg-slate-100" onClick={() => setSelectedName('')} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="close" /></button>
            </header>
            <div className="grid grid-cols-2 gap-1.5 p-2.5">
              <button className="inline-flex h-7 items-center justify-center gap-1 rounded bg-[#087c77] text-[8px] font-semibold text-white" onClick={() => announceAction('Open')} type="button"><EmployeeIcon className="h-3 w-3" name="eye" />Open</button>
              <button className="inline-flex h-7 items-center justify-center gap-1 rounded border border-slate-200 text-[8px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={shared && selected.permission !== 'Download'} onClick={() => announceAction('Download')} type="button"><EmployeeIcon className="h-3 w-3" name="download" />Download</button>
            </div>
            {notice && <p className="px-2.5 pb-2 text-[7px] text-blue-700">{notice}</p>}
            <div className="flex border-y border-slate-100">
              {(shared ? ['Details', 'Permissions', 'Activity'] : ['Details', 'Permissions', 'Activity', 'Versions']).map((item) => (
                <button aria-selected={tab === item} className={`flex-1 border-b-2 px-1 py-2 text-[7px] font-medium ${tab === item ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`} key={item} onClick={() => setTab(item)} role="tab" type="button">{item}</button>
              ))}
            </div>
            <div className="p-2.5">
              {tab === 'Details' ? (
                <>
                  <h3 className="mb-2 text-[9px] font-semibold text-slate-800">Document Information</h3>
                  <dl className="space-y-1.5 text-[7px]">
                    {[
                      ['Owner', shared ? `${selected.owner} (${selected.department})` : 'You (Vinay Sharma)'],
                      ['Classification', selected.classification],
                      ['File Type', `${selected.type} (${selected.size})`],
                      [shared ? 'Shared On' : 'Created', `${selected.modified}, 10:24 AM`],
                      ...(!shared ? [['Last Modified', `${selected.modified}, 10:24 AM`]] : [['Expires On', selected.expires]]),
                      ['Description', selected.description],
                    ].map(([label, value]) => <div className="grid grid-cols-[66px_minmax(0,1fr)] gap-1" key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-700">{label === 'Classification' ? <EmployeeBadge tone={value === 'Confidential' ? 'red' : value === 'Restricted' ? 'violet' : 'blue'}>{value}</EmployeeBadge> : value}</dd></div>)}
                  </dl>
                  {shared && (
                    <section className="mt-3 border-t border-slate-100 pt-2">
                      <h3 className="text-[9px] font-semibold text-slate-800">Your Permission</h3>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700"><EmployeeIcon className="h-3.5 w-3.5" name={selected.permission === 'Download' ? 'download' : 'eye'} /></span>
                        <span><span className="block text-[8px] font-semibold text-slate-700">{selected.permission} Access</span><span className="block text-[7px] text-slate-500">{selected.permission === 'Download' ? 'You can view and download this document' : 'You can view this document'}</span></span>
                      </div>
                      {selected.permission !== 'Download' && <p className="mt-2 rounded bg-blue-50 p-2 text-[7px] leading-3 text-blue-800">You do not have download permission. Contact the owner if you need to download this document.</p>}
                    </section>
                  )}
                </>
              ) : tab === 'Permissions' ? (
                <section>
                  <h3 className="text-[9px] font-semibold text-slate-800">Sharing Status</h3>
                  <p className="mt-1 text-[8px] text-slate-600">{shared ? `Shared by ${selected.owner}` : `Shared with ${selected.sharedWith}`}</p>
                  {!shared && <button className="mt-2 rounded border border-blue-200 px-2 py-1 text-[7px] font-semibold text-blue-700" onClick={() => announceAction('Manage access')} type="button">Manage Access</button>}
                </section>
              ) : tab === 'Activity' ? (
                <ul className="space-y-2">{employeeActivities.slice(0, 3).map((activity) => <li className="border-b border-slate-100 pb-2" key={activity.title}><p className="text-[8px] font-semibold text-slate-700">{activity.title}</p><p className="text-[7px] text-slate-500">{activity.time} · {activity.detail}</p></li>)}</ul>
              ) : <p className="text-[8px] text-slate-500">Version history is illustrative and will be connected to document storage later.</p>}
              <section className="mt-3 border-t border-slate-100 pt-2">
                <h3 className="mb-1.5 text-[9px] font-semibold text-slate-800">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {(tagsByDocument[selected.name] ?? selected.tags).map((tag) => <EmployeeBadge key={tag} tone="blue">{tag}</EmployeeBadge>)}
                  {!shared && (
                    <div className="inline-flex gap-1">
                      <input aria-label="New document tag" className="w-16 rounded border border-slate-200 px-1 text-[7px]" onChange={(event) => setTagInput(event.target.value)} placeholder="Tag" value={tagInput} />
                      <button aria-label="Add tag" className="rounded border border-slate-200 px-1 text-[7px]" onClick={addTag} type="button"><EmployeeIcon className="h-3 w-3" name="plus" /></button>
                    </div>
                  )}
                </div>
              </section>
              {!shared && <section className="mt-3 border-t border-slate-100 pt-2"><h3 className="text-[9px] font-semibold text-slate-800">Sharing Status</h3><p className="mt-1 text-[8px] text-slate-600">Shared with {selected.sharedWith}</p><button className="mt-2 rounded border border-blue-200 px-2 py-1 text-[7px] font-semibold text-blue-700" onClick={() => announceAction('Manage access')} type="button">Manage Access</button></section>}
            </div>
          </aside>
        )}
      </div>
      <p className="text-[7px] text-slate-400">Document information is mock data. Preview and downloads are not connected to file storage.</p>
    </main>
  )
}

function UploadDocumentPage() {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [classification, setClassification] = useState('Confidential')
  const [tags, setTags] = useState(['Project', 'Requirements'])
  const [tagInput, setTagInput] = useState('')
  const [sharing, setSharing] = useState('share')
  const [recipients, setRecipients] = useState([
    { name: 'Amit Kumar', email: 'amit.kumar@company.com', type: 'User', permission: 'View', expires: '2025-06-30' },
    { name: 'HR Team', email: '5 members', type: 'Group', permission: 'View + Download', expires: '2025-06-30' },
    { name: 'Priya Singh', email: 'priya.singh@company.com', type: 'User', permission: 'View', expires: '' },
  ])
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientPermission, setRecipientPermission] = useState('View')
  const [notice, setNotice] = useState('')
  const fileInputId = 'employee-upload-file'

  function selectFile(selectedFile) {
    if (!selectedFile) return
    const extension = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!extension || !['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg'].includes(extension)) {
      setNotice('Choose a supported document, spreadsheet, presentation, or image file.')
      return
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      setNotice('Choose a file smaller than 50 MB.')
      return
    }
    setFile(selectedFile)
    setName(selectedFile.name)
    setNotice('')
  }

  function addTag() {
    const value = tagInput.trim()
    if (value && !tags.includes(value)) setTags((current) => [...current, value])
    setTagInput('')
  }

  function addRecipient() {
    const value = recipientQuery.trim()
    if (!value) return
    const email = value.includes('@') ? value : `${value.toLowerCase().replaceAll(' ', '.')}@company.com`
    setRecipients((current) => current.some((recipient) => recipient.email === email)
      ? current
      : [...current, { name: value.includes('@') ? value.split('@')[0] : value, email, type: 'User', permission: recipientPermission, expires: '' }])
    setRecipientQuery('')
  }

  function submitUpload(event) {
    event.preventDefault()
    if (!file || !name.trim()) {
      setNotice('Choose a file and provide a document name before uploading.')
      return
    }
    setNotice(`${name} is ready to upload. File storage is not connected in this preview.`)
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-5">
      <EmployeePageHeader
        action={<a className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-700 hover:text-blue-900" href="/employee/documents"><EmployeeIcon className="h-3 w-3 rotate-180" name="arrow" />Back</a>}
        description="Add a new document to your secure workspace. Set classification, add details and choose who can access it."
        icon="upload"
        title="Upload Document"
      />
      <form className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_270px]" onSubmit={submitUpload}>
        <div className="space-y-2">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <h2 className="flex items-center gap-2 text-[10px] font-semibold text-slate-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[8px] text-white">1</span>Upload File</h2>
              <span className="text-right text-[7px] text-slate-500">Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG (Max 50 MB)</span>
            </header>
            <label
              className="mx-3 my-2 flex min-h-[100px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-blue-300 bg-blue-50/30 text-center hover:bg-blue-50"
              htmlFor={fileInputId}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]) }}
            >
              <EmployeeIcon className="h-7 w-7 text-blue-500" name="cloud" />
              <span className="mt-1 text-[9px] font-semibold text-slate-700">{file?.name ?? 'Drag and drop your file here'}</span>
              <span className="mt-0.5 text-[8px] text-slate-500">or click to browse</span>
              <span className="mt-1 rounded border border-blue-300 bg-white px-3 py-1 text-[8px] font-medium text-blue-700">Choose File</span>
              <input accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg" className="sr-only" id={fileInputId} onChange={(event) => selectFile(event.target.files?.[0])} type="file" />
            </label>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-[10px] font-semibold text-slate-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[8px] text-white">2</span>Document Details</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-[8px] font-medium text-slate-600">Document Name <span className="text-rose-600">*</span>
                <input className="mt-1 h-7 w-full rounded border border-slate-200 px-2 text-[8px] text-slate-700 outline-none focus:border-teal-500" onChange={(event) => setName(event.target.value)} value={name} />
              </label>
              <label className="block text-[8px] font-medium text-slate-600">Description (Optional)
                <textarea className="mt-1 h-7 w-full resize-y rounded border border-slate-200 px-2 py-1 text-[8px] text-slate-700 outline-none focus:border-teal-500" onChange={(event) => setDescription(event.target.value)} value={description} />
              </label>
              <label className="block text-[8px] font-medium text-slate-600">Classification <span className="text-rose-600">*</span>
                <select className="mt-1 h-7 w-full rounded border border-slate-200 px-2 text-[8px]" onChange={(event) => setClassification(event.target.value)} value={classification}>
                  <option>Confidential</option><option>Internal</option><option>Restricted</option>
                </select>
                <span className="mt-1 block text-[7px] font-normal text-slate-500">{classification === 'Confidential' ? 'Sensitive company information. Restricted access.' : classification === 'Restricted' ? 'Highly sensitive. Share only with authorized people.' : 'For internal company use.'}</span>
              </label>
              <div className="text-[8px] font-medium text-slate-600">Tags (Optional)
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {tags.map((tag) => <button aria-label={`Remove tag ${tag}`} className="rounded-full bg-blue-50 px-2 py-1 text-[7px] text-blue-700" key={tag} onClick={() => setTags((current) => current.filter((item) => item !== tag))} type="button">{tag} ×</button>)}
                  <div className="inline-flex gap-1">
                    <input aria-label="New tag" className="w-16 rounded border border-slate-200 px-1 py-1 text-[7px]" onChange={(event) => setTagInput(event.target.value)} placeholder="Add tag" value={tagInput} />
                    <button aria-label="Add tag" className="rounded border border-slate-200 px-1.5 text-[7px]" onClick={addTag} type="button"><EmployeeIcon className="h-3 w-3" name="plus" /></button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <header className="flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-[10px] font-semibold text-slate-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[8px] text-white">3</span>Sharing &amp; Permissions</h2>
              <span className="text-[7px] text-slate-500">You can keep it private or share with specific people or groups.</span>
            </header>
            <div className="mt-2 flex flex-wrap gap-4 text-[8px]">
              <label className="flex items-center gap-1.5"><input checked={sharing === 'private'} onChange={() => setSharing('private')} type="radio" value="private" />Keep Private <span className="text-slate-500">Only you can access this document</span></label>
              <label className="flex items-center gap-1.5"><input checked={sharing === 'share'} onChange={() => setSharing('share')} type="radio" value="share" />Share with People or Groups</label>
            </div>
            {sharing === 'share' && (
              <>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_auto]">
                  <label className="relative">
                    <span className="sr-only">Search people or groups to add</span>
                    <EmployeeIcon className="absolute left-2 top-2 h-3 w-3 text-slate-400" name="search" />
                    <input className="h-7 w-full rounded border border-slate-200 pl-7 pr-2 text-[8px]" onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Search by name, email or group..." value={recipientQuery} />
                  </label>
                  <label className="text-[7px] text-slate-600">Permission
                    <select aria-label="New recipient permission" className="mt-0.5 h-6 w-full rounded border border-slate-200 px-1 text-[8px]" onChange={(event) => setRecipientPermission(event.target.value)} value={recipientPermission}><option>View</option><option>View + Download</option></select>
                  </label>
                  <button className="self-end rounded bg-[#087c77] px-3 py-1.5 text-[8px] font-semibold text-white" onClick={addRecipient} type="button">Add</button>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[450px] text-left text-[8px]">
                    <thead className="bg-slate-50 text-slate-500"><tr><th className="p-1.5">Name</th><th className="p-1.5">Type</th><th className="p-1.5">Permission</th><th className="p-1.5">Expires On</th><th className="p-1.5">Actions</th></tr></thead>
                    <tbody>{recipients.map((recipient) => <tr className="border-t border-slate-100" key={recipient.email}><td className="p-1.5"><span className="font-medium text-slate-700">{recipient.name}</span><span className="block text-[7px] text-slate-500">{recipient.email}</span></td><td className="p-1.5 text-slate-500">{recipient.type}</td><td className="p-1.5"><select aria-label={`${recipient.name} permission`} className="rounded border border-slate-200 p-1 text-[7px]" onChange={(event) => setRecipients((current) => current.map((item) => item.email === recipient.email ? { ...item, permission: event.target.value } : item))} value={recipient.permission}><option>View</option><option>Download</option><option>View + Download</option></select></td><td className="p-1.5"><input aria-label={`${recipient.name} expiration`} className="w-24 rounded border border-slate-200 p-1 text-[7px]" onChange={(event) => setRecipients((current) => current.map((item) => item.email === recipient.email ? { ...item, expires: event.target.value } : item))} type="date" value={recipient.expires} /></td><td className="p-1.5"><button aria-label={`Remove ${recipient.name}`} className="text-slate-500 hover:text-rose-600" onClick={() => setRecipients((current) => current.filter((item) => item.email !== recipient.email))} type="button"><EmployeeIcon className="h-3 w-3" name="trash" /></button></td></tr>)}</tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          {notice && <p aria-live="polite" className="rounded-md bg-blue-50 px-3 py-2 text-[8px] text-blue-800">{notice}</p>}
        </div>

        <aside className="space-y-2">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-[10px] font-semibold text-slate-800">File Preview</h2>
            {file ? (
              <div className="mt-3 flex items-center gap-2"><EmployeeDocumentIcon document={{ type: file.name.split('.').pop()?.slice(0, 3).toUpperCase(), tone: 'bg-rose-600' }} /><div><p className="text-[8px] font-semibold text-slate-700">{file.name}</p><p className="text-[7px] text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p></div></div>
            ) : <p className="mt-3 text-[8px] text-slate-500">Select a file to preview its details.</p>}
            <div className="mt-3 border-t border-slate-100 pt-2">
              <h3 className="text-[9px] font-semibold text-slate-800">Document Information</h3>
              <dl className="mt-2 space-y-1 text-[7px]">{[['Name', name || '—'], ['Description', description || '—'], ['Classification', classification], ['File Type', file?.name.split('.').pop()?.toUpperCase() ?? '—'], ['File Size', file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '—'], ['Created By', 'You (Vinay Sharma)'], ['Created On', '27 May 2025, 10:24 AM']].map(([label, value]) => <div className="grid grid-cols-[64px_1fr] gap-1" key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-700">{value}</dd></div>)}</dl>
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="text-[9px] font-semibold text-slate-800">Sharing Summary</h2>
            <div className="mt-2 flex items-center gap-2 rounded bg-blue-50 p-2"><EmployeeIcon className="h-5 w-5 text-blue-700" name="users" /><span><span className="block text-[8px] font-semibold text-slate-700">{sharing === 'private' ? 'Private document' : `${recipients.length} People/Groups`}</span><span className="block text-[7px] text-slate-500">View Access: {recipients.filter((item) => item.permission.includes('View')).length} | Download Access: {recipients.filter((item) => item.permission.includes('Download')).length}</span></span></div>
            <div className="mt-2 flex items-center gap-2 rounded bg-amber-50 p-2"><EmployeeIcon className="h-4 w-4 text-amber-700" name="calendar" /><span><span className="block text-[8px] font-semibold text-slate-700">1 Expiry Date</span><span className="block text-[7px] text-slate-500">Earliest: 30 Jun 2025</span></span></div>
          </section>
          <section className="rounded-lg bg-emerald-50 p-3 text-[8px] text-emerald-800">
            <h2 className="font-semibold">Security Tips</h2>
            <ul className="mt-2 space-y-1"><li>✓ Use appropriate classification</li><li>✓ Share only with required people</li><li>✓ Set expiry dates for temporary access</li><li>✓ Review permissions regularly</li></ul>
          </section>
          <div className="flex gap-2">
            <a className="flex-1 rounded-md border border-slate-200 bg-white py-2 text-center text-[8px] font-semibold text-slate-600" href="/employee/documents">Cancel</a>
            <button className="flex-1 rounded-md bg-[#087c77] py-2 text-[8px] font-semibold text-white hover:bg-[#066c68]" type="submit">Upload Document</button>
          </div>
        </aside>
      </form>
    </main>
  )
}

function EmployeeActivityPage() {
  const [search, setSearch] = useState('')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [selected, setSelected] = useState(activityRecords[0])
  const [tab, setTab] = useState('Details')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const filtered = allActivityRecords.filter((activity) => (
    (!search || `${activity.document} ${activity.actor} ${activity.action}`.toLowerCase().includes(search.toLowerCase())) &&
    (documentFilter === 'all' || activity.document === documentFilter) &&
    (actionFilter === 'all' || activity.action === actionFilter) &&
    (outcomeFilter === 'all' || activity.outcome === outcomeFilter)
  ))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function updateFilter(setFilter, value) {
    setFilter(value)
    setPage(1)
  }

  function exportActivity() {
    const rows = [['Timestamp', 'Action', 'Document', 'Actor', 'Outcome'], ...filtered.map((event) => [event.time, event.action, event.document, event.actor, event.outcome])]
    const csv = rows.map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'suredocs-document-activity-mock.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-5">
      <EmployeePageHeader action={<button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[8px] font-semibold text-blue-700" onClick={exportActivity} type="button"><EmployeeIcon className="h-3 w-3" name="download" />Export Activity</button>} description="Track all activity related to your documents. View uploads, access, sharing, permission changes and more." icon="activity" title="Document Activity" />
      <section aria-label="Document activity summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {[
          { value: '48', title: 'Total Events', detail: 'Last 30 days', icon: 'folder', color: 'blue' },
          { value: '24', title: 'Document Views', detail: 'Your documents', icon: 'eye', color: 'green' },
          { value: '8', title: 'Downloads', detail: 'Your documents', icon: 'download', color: 'violet' },
          { value: '12', title: 'Sharing Actions', detail: 'Grants, updates, revokes', icon: 'share', color: 'amber' },
          { value: '4', title: 'Denied Attempts', detail: 'Blocked access', icon: 'denied', color: 'rose' },
        ].map((metric) => <EmployeeMetric {...metric} key={metric.title} />)}
      </section>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <EmployeeSearch label="Search document activity" onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search by document name, user, action..." value={search} />
        <EmployeeFilter label="Activity document" onChange={(value) => updateFilter(setDocumentFilter, value)} options={[{ value: 'all', label: 'All Documents' }, ...[...new Set(allActivityRecords.map((event) => event.document))].map((value) => ({ value, label: value }))]} value={documentFilter} />
        <EmployeeFilter label="Activity action" onChange={(value) => updateFilter(setActionFilter, value)} options={[{ value: 'all', label: 'All Actions' }, ...[...new Set(allActivityRecords.map((event) => event.action))].map((value) => ({ value, label: value }))]} value={actionFilter} />
        <EmployeeFilter label="Activity outcome" onChange={(value) => updateFilter(setOutcomeFilter, value)} options={[{ value: 'all', label: 'All Outcomes' }, ...['Success', 'Pending', 'Denied'].map((value) => ({ value, label: value }))]} value={outcomeFilter} />
        <label className="relative min-w-[170px]"><span className="sr-only">Activity date range</span><EmployeeIcon className="absolute left-2 top-2 h-3 w-3 text-slate-500" name="calendar" /><input aria-label="Activity date range" className="h-8 w-full rounded-md border border-slate-200 pl-6 pr-1 text-[8px] text-slate-600" defaultValue="01 May 2025 - 31 May 2025" /></label>
      </div>
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-slate-50 text-[8px] font-semibold text-slate-500"><tr><th className="px-2 py-2">Timestamp ↓</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Document</th><th className="px-2 py-2">Actor</th><th className="px-2 py-2">Outcome</th><th className="px-2 py-2">Details</th></tr></thead>
              <tbody>
                {visible.map((event) => <tr aria-selected={selected?.time === event.time} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 ${selected?.time === event.time ? 'bg-blue-50/40' : ''}`} key={event.time} onClick={() => { setSelected(event); setTab('Details') }}>
                  <td className="whitespace-nowrap px-2 py-2 text-[7px] text-slate-600">{event.time}</td>
                  <td className="px-2 py-2"><span className="flex min-w-[100px] items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-700"><EmployeeIcon className="h-3 w-3" name={event.icon} /></span><span className="text-[8px] font-semibold text-slate-700">{event.action}</span></span></td>
                  <td className="px-2 py-2"><span className="block text-[8px] text-slate-700">{event.document}</span><span className="block text-[7px] text-slate-500">{event.type}</span></td>
                  <td className="px-2 py-2"><span className="text-[8px] text-slate-700">{event.actor}</span><span className="block text-[7px] text-slate-500">({event.department})</span></td>
                  <td className="px-2 py-2"><EmployeeBadge tone={event.outcome === 'Success' ? 'green' : event.outcome === 'Denied' ? 'red' : 'amber'}>{event.outcome}</EmployeeBadge></td>
                  <td className="px-2 py-2"><button aria-label={`View activity details: ${event.action}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelected(event) }} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="more" /></button></td>
                </tr>)}
                {filtered.length === 0 && <tr><td className="py-8 text-center text-[9px] text-slate-500" colSpan={6}>No activity matches these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <EmployeePagination count={filtered.length} label="activities" onPageChange={setPage} page={page} pageSize={pageSize} />
        </section>
        {selected && <aside aria-label="Activity details" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 p-2.5"><h2 className="text-[9px] font-semibold text-slate-800">Activity Details</h2><button aria-label="Close activity details" className="text-slate-400" onClick={() => setSelected(null)} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="close" /></button></header>
          <div className="p-2.5">
            <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-700"><EmployeeIcon className="h-4 w-4" name={selected.icon} /></span><span className="min-w-0 flex-1"><span className="block text-[8px] font-semibold text-slate-800">{selected.action}</span><span className="block text-[7px] text-slate-500">{selected.time}</span></span><EmployeeBadge tone={selected.outcome === 'Success' ? 'green' : selected.outcome === 'Denied' ? 'red' : 'amber'}>{selected.outcome}</EmployeeBadge></div>
            <div className="mt-2 flex border-b border-slate-200">{['Details', 'User Info', 'Document Info', 'Security'].map((item) => <button aria-selected={tab === item} className={`flex-1 border-b-2 px-1 py-2 text-[7px] ${tab === item ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`} key={item} onClick={() => setTab(item)} role="tab" type="button">{item}</button>)}</div>
            <dl className="mt-2 space-y-2 text-[7px]">
              {(tab === 'Details'
                ? [['Action', selected.action], ['Outcome', selected.outcome], ['Timestamp', selected.time], ['Document', selected.document], ['File Type', selected.type.split(' ')[0]], ['File Size', selected.type.match(/\((.+)\)/)?.[1] ?? '—'], ['Actor', selected.actor], ['Role', `Employee (${selected.department})`], ['IP Address', selected.ip], ['Device', 'Windows Chrome'], ['Location', 'Hyderabad, India'], ['Request ID', `req_01HZY8K3D7F9A2`], ['Additional Info', 'Viewed in browser (no download)']]
                : tab === 'User Info'
                  ? [['Name', selected.actor], ['Department', selected.department], ['Role', 'Employee'], ['IP Address', selected.ip], ['Location', 'Hyderabad, India']]
                  : tab === 'Document Info'
                    ? [['Document', selected.document], ['File Type', selected.type], ['Owner', selected.actor === 'You' ? 'You (Vinay Sharma)' : 'Document owner'], ['Access', 'Authorized']]
                    : [['Security Status', selected.outcome], ['Device', 'Windows Chrome'], ['IP Address', selected.ip], ['Request ID', 'req_01HZY8K3D7F9A2']]
              ).map(([label, value]) => <div className="grid grid-cols-[65px_1fr] gap-1" key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-700">{value}</dd></div>)}
            </dl>
          </div>
        </aside>}
      </div>
      <p className="text-[7px] text-slate-400">Activity entries are illustrative mock data. Exported activity is a mock CSV preview.</p>
    </main>
  )
}

function EmployeeRequestsPage() {
  const [requests, setRequests] = useState(requestExamples)
  const [tab, setTab] = useState('approve')
  const [selectedId, setSelectedId] = useState(requestExamples[0].id)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [documentFilter, setDocumentFilter] = useState('all')
  const [permissionFilter, setPermissionFilter] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)

  const selectedRequest = requests.find((request) => request.id === selectedId)
  const myRequests = requests.filter((request) => request.isMine)
  const baseRequests = tab === 'approve' ? requests.filter((request) => !request.isMine) : myRequests
  const filtered = baseRequests.filter((request) => (
    (!search || `${request.requester} ${request.document} ${request.reason} ${request.id}`.toLowerCase().includes(search.toLowerCase())) &&
    (typeFilter === 'all' || request.status === typeFilter) &&
    (documentFilter === 'all' || request.document === documentFilter) &&
    (permissionFilter === 'all' || request.permission === permissionFilter) &&
    (dateRange === 'all' ||
      (new Date('2025-05-27T23:59:59') - new Date(request.requested)) / 86400000 <= Number(dateRange))
  ))
  const pending = requests.filter((request) => request.status === 'Pending' && !request.isMine)
  const recent = requests.filter((request) => request.status !== 'Pending' && !request.isMine)
  const pageSize = 5
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function updateRequest(id, status) {
    setRequests((current) => current.map((request) => request.id === id ? { ...request, status } : request))
    setNotice(`Request ${id} marked ${status.toLowerCase()}. This is a mock preview.`)
  }

  function resetFilters() {
    setSearch('')
    setTypeFilter('all')
    setDocumentFilter('all')
    setPermissionFilter('all')
    setDateRange('all')
    setPage(1)
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-5">
      <EmployeePageHeader description="View and manage access requests for your documents or requests you have submitted." icon="users" title="Access Requests" />
      <div className="flex gap-4 border-b border-slate-200">
        {[{ id: 'approve', label: 'Requests to Approve', count: pending.length }, { id: 'mine', label: 'My Requests', count: myRequests.length }].map((item) => <button aria-selected={tab === item.id} className={`flex items-center gap-2 border-b-2 px-3 py-2 text-[9px] font-semibold ${tab === item.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`} key={item.id} onClick={() => { setTab(item.id); setPage(1); setSelectedId(item.id === 'mine' ? myRequests[0]?.id ?? '' : pending[0]?.id ?? '') }} role="tab" type="button">{item.label}<span className={`rounded-full px-1.5 py-0.5 text-[7px] ${item.id === 'approve' ? 'bg-rose-500 text-white' : 'bg-blue-100 text-blue-700'}`}>{item.count}</span></button>)}
      </div>
      <section aria-label="Access request summary" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          { value: String(pending.length), title: 'Pending Approval', detail: 'Require your action', icon: 'inbox', color: 'blue' },
          { value: String(requests.filter((request) => request.status === 'Approved').length), title: 'Approved', detail: 'Last 30 days', icon: 'check', color: 'green' },
          { value: String(requests.filter((request) => request.status === 'Rejected').length), title: 'Rejected', detail: 'Last 30 days', icon: 'denied', color: 'rose' },
          { value: String(myRequests.filter((request) => request.status === 'Pending').length), title: 'My Pending Requests', detail: 'Waiting for response', icon: 'clock', color: 'amber' },
        ].map((metric) => <EmployeeMetric {...metric} key={metric.title} />)}
      </section>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <EmployeeSearch label="Search access requests" onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search by document name, requester or reason..." value={search} />
        <EmployeeFilter label="Request type" onChange={(value) => { setTypeFilter(value); setPage(1) }} options={[{ value: 'all', label: 'Request Type' }, ...['Pending', 'Approved', 'Rejected'].map((value) => ({ value, label: value }))]} value={typeFilter} />
        <EmployeeFilter label="Request document" onChange={(value) => { setDocumentFilter(value); setPage(1) }} options={[{ value: 'all', label: 'Document' }, ...[...new Set(requests.map((request) => request.document))].map((value) => ({ value, label: value }))]} value={documentFilter} />
        <EmployeeFilter label="Requested permission" onChange={(value) => { setPermissionFilter(value); setPage(1) }} options={[{ value: 'all', label: 'Requested Permission' }, ...['View', 'Download'].map((value) => ({ value, label: value }))]} value={permissionFilter} />
        <EmployeeFilter label="Request date range" onChange={(value) => { setDateRange(value); setPage(1) }} options={[{ value: 'all', label: 'Date Range' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} value={dateRange} />
        <button className="ml-auto h-8 rounded-md border border-slate-200 px-3 text-[8px] font-semibold text-blue-600" onClick={resetFilters} type="button">Reset</button>
      </div>
      {notice && <p aria-live="polite" className="rounded-md bg-blue-50 px-3 py-2 text-[8px] text-blue-800">{notice}</p>}

      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-2">
          {tab === 'approve' && (
            <RequestTable
              empty="No pending requests."
              onSelect={setSelectedId}
              onUpdate={updateRequest}
              requests={visible.filter((request) => request.status === 'Pending')}
              selectedId={selectedId}
              title={`Pending Requests (${pending.length})`}
            />
          )}
          <RequestTable
            empty={tab === 'mine' ? 'You have no submitted requests.' : 'No recent requests.'}
            onSelect={setSelectedId}
            onUpdate={updateRequest}
            requests={tab === 'mine' ? visible : visible.filter((request) => request.status !== 'Pending')}
            selectedId={selectedId}
            title={tab === 'mine' ? 'My Requests' : `Recent Requests (${recent.length})`}
          />
          <EmployeePagination count={filtered.length} label="requests" onPageChange={setPage} page={page} pageSize={pageSize} />
        </div>
        {selectedRequest && <aside aria-label="Request details" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 p-2.5"><h2 className="text-[9px] font-semibold text-slate-800">Request Details</h2><div className="flex items-center gap-2"><EmployeeBadge tone={selectedRequest.status === 'Pending' ? 'amber' : selectedRequest.status === 'Approved' ? 'green' : 'red'}>{selectedRequest.status}</EmployeeBadge><button aria-label="Close request details" className="text-slate-400" onClick={() => setSelectedId('')} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="close" /></button></div></header>
          <div className="p-2.5">
            <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[8px] font-semibold text-indigo-700">{selectedRequest.requester.split(' ').map((word) => word[0]).join('')}</span><span><span className="block text-[8px] font-semibold text-slate-800">{selectedRequest.requester}</span><span className="block text-[7px] text-slate-500">{selectedRequest.department}</span><span className="block text-[7px] text-slate-500">{selectedRequest.requester.toLowerCase().replaceAll(' ', '.')}@company.com</span></span></div>
            <section className="mt-2 flex items-center justify-between rounded-md border border-slate-100 p-2"><span className="flex items-center gap-2"><EmployeeDocumentIcon document={employeeDocuments.find((doc) => doc.name === selectedRequest.document) ?? sharedDocuments.find((doc) => doc.name === selectedRequest.document) ?? { type: 'PDF', tone: 'bg-rose-600' }} /><span><span className="block text-[8px] font-semibold text-slate-700">{selectedRequest.document}</span><span className="block text-[7px] text-slate-500">{selectedRequest.size}</span></span></span><button className="rounded border border-slate-200 px-2 py-1 text-[7px] font-medium text-blue-700" onClick={() => setNotice('Document preview is not connected in this mock interface.')} type="button">Open</button></section>
            <dl className="mt-2 space-y-1.5 text-[7px]">{[['Requested Permission', selectedRequest.permission], ['Requested On', selectedRequest.requested], ['Reason', selectedRequest.reason]].map(([label, value]) => <div className="grid grid-cols-[78px_1fr] gap-1" key={label}><dt className="text-slate-500">{label}</dt><dd className="text-slate-700">{label === 'Requested Permission' ? <EmployeeBadge tone={value === 'Download' ? 'amber' : 'blue'}>{value}</EmployeeBadge> : value}</dd></div>)}</dl>
            {tab === 'mine' ? (
              <section className="mt-3 border-t border-slate-100 pt-2"><h3 className="text-[8px] font-semibold text-slate-700">Request Status</h3><p className="mt-1 text-[7px] leading-3 text-slate-500">{selectedRequest.status === 'Pending' ? 'Your request is waiting for the document owner to respond.' : `Your request was ${selectedRequest.status.toLowerCase()}.`}</p><button className="mt-2 rounded border border-slate-200 px-2 py-1 text-[7px] text-slate-600" onClick={() => setNotice('Request cancellation is a preview only.')} type="button">Cancel Request</button></section>
            ) : selectedRequest.status === 'Pending' ? (
              <>
                <section className="mt-2 border-t border-slate-100 pt-2"><h3 className="text-[8px] font-semibold text-slate-700">Additional Information</h3><dl className="mt-1 space-y-1 text-[7px]"><div className="grid grid-cols-[70px_1fr]"><dt className="text-slate-500">Department</dt><dd>{selectedRequest.department}</dd></div><div className="grid grid-cols-[70px_1fr]"><dt className="text-slate-500">Role</dt><dd>Employee</dd></div><div className="grid grid-cols-[70px_1fr]"><dt className="text-slate-500">Access Needed Until</dt><dd><input aria-label="Access needed until" className="rounded border border-slate-200 p-1 text-[7px]" defaultValue={selectedRequest.expires} type="date" /></dd></div>{selectedRequest.attachment && <div className="grid grid-cols-[70px_1fr]"><dt className="text-slate-500">Attachments</dt><dd className="text-blue-700">{selectedRequest.attachment}</dd></div>}</dl></section>
                <section className="mt-3 border-t border-slate-100 pt-2"><h3 className="text-[8px] font-semibold text-slate-700">Your Action</h3><div className="mt-2 flex flex-wrap gap-1"><button className="flex-1 rounded bg-[#087c77] px-2 py-1.5 text-[7px] font-semibold text-white" onClick={() => updateRequest(selectedRequest.id, 'Approved')} type="button">✓ Approve</button><button className="flex-1 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[7px] font-semibold text-rose-700" onClick={() => updateRequest(selectedRequest.id, 'Rejected')} type="button">× Reject</button><button className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-[7px] font-semibold text-slate-600" onClick={() => setNotice(`Asked ${selectedRequest.requester} for more information (mock).`)} type="button">Ask for More Info</button></div></section>
              </>
            ) : <p className="mt-3 border-t border-slate-100 pt-2 text-[7px] text-slate-500">This request has already been {selectedRequest.status.toLowerCase()}.</p>}
          </div>
        </aside>}
      </div>
      <p className="text-[7px] text-slate-400">Requests, decisions and notifications use mock data. No real document permissions are changed.</p>
    </main>
  )
}

function RequestTable({ title, requests, selectedId, onSelect, onUpdate, empty }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className={`border-b border-slate-100 px-2.5 py-2 ${title.startsWith('Pending') ? 'bg-amber-50/70' : 'bg-white'}`}><h2 className="text-[9px] font-semibold text-slate-800">{title}</h2></header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[550px] text-left text-[7px]">
          <thead className="bg-slate-50 text-slate-500"><tr>{(title.startsWith('Pending') ? ['Requester', 'Document', 'Requested Permission', 'Reason', 'Requested On', 'Actions'] : ['Requester', 'Document', 'Requested Permission', 'Status', 'Requested On', 'Responded On', 'Actions']).map((heading) => <th className="px-2 py-2" key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {requests.map((request) => <tr aria-selected={selectedId === request.id} className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 ${selectedId === request.id ? 'bg-blue-50/60' : ''}`} key={request.id} onClick={() => onSelect(request.id)}>
              <td className="px-2 py-2"><span className="flex items-center gap-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[6px] font-semibold text-indigo-700">{request.requester.split(' ').map((word) => word[0]).join('')}</span><span><span className="block whitespace-nowrap text-[8px] font-medium text-slate-700">{request.requester}</span><span className="block text-[7px] text-slate-500">{request.department}</span></span></span></td>
              <td className="px-2 py-2"><span className="flex items-center gap-1 whitespace-nowrap"><EmployeeDocumentIcon document={employeeDocuments.find((doc) => doc.name === request.document) ?? sharedDocuments.find((doc) => doc.name === request.document) ?? { type: 'PDF', tone: 'bg-rose-600' }} /><span><span className="block text-[7px] text-slate-700">{request.document}</span><span className="block text-[6px] text-slate-500">{request.size}</span></span></span></td>
              <td className="px-2 py-2"><EmployeeBadge tone={request.permission === 'Download' ? 'amber' : 'blue'}>{request.permission}</EmployeeBadge></td>
              {title.startsWith('Pending')
                ? <td className="max-w-[95px] px-2 py-2 text-[7px] text-slate-600">{request.reason}</td>
                : <td className="px-2 py-2"><EmployeeBadge tone={request.status === 'Approved' ? 'green' : request.status === 'Rejected' ? 'red' : 'amber'}>{request.status}</EmployeeBadge></td>}
              <td className="whitespace-nowrap px-2 py-2 text-[7px] text-slate-600">{request.requested}</td>
              {!title.startsWith('Pending') && <td className="whitespace-nowrap px-2 py-2 text-[7px] text-slate-600">{request.status === 'Pending' ? '—' : '25 May 2025 03:02 PM'}</td>}
              <td className="px-2 py-2">{request.status === 'Pending' ? <span className="flex gap-1"><button className="rounded bg-[#087c77] px-2 py-1 text-[7px] font-semibold text-white" onClick={(event) => { event.stopPropagation(); onUpdate(request.id, 'Approved') }} type="button">Approve</button><button className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[7px] font-semibold text-rose-700" onClick={(event) => { event.stopPropagation(); onUpdate(request.id, 'Rejected') }} type="button">Reject</button></span> : <button className="rounded border border-blue-200 px-2 py-1 text-[7px] font-semibold text-blue-700" onClick={(event) => { event.stopPropagation(); onSelect(request.id) }} type="button">View</button>}</td>
            </tr>)}
            {requests.length === 0 && <tr><td className="py-6 text-center text-[8px] text-slate-500" colSpan={7}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function EmployeeSectionPlaceholder({ pathname }) {
  const section = [...employeeNavigation, ...employeeBottomNavigation]
    .find((item) => item.href === pathname)
  const title = section?.label ?? 'Employee workspace'

  return (
    <>
      <EmployeeTopBar notificationsOpen={false} onSearchChange={() => {}} search="" setNotificationsOpen={() => {}} unreadCount={5} />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">Your secure SureDocs employee workspace.</p>
        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800">{title} workspace</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">This employee section is not implemented yet. Use the dashboard to view your current documents, recent activity, notifications, and access summary.</p>
          <a className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900" href="/employee">Back to dashboard <EmployeeIcon className="h-3.5 w-3.5" name="arrow" /></a>
        </section>
      </main>
    </>
  )
}

export default function EmployeeDashboard() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/employee'
  const isDashboard = pathname === '/employee' || pathname === '/employee/dashboard'
  const workspace = {
    '/employee/documents': <EmployeeDocumentsPage />,
    '/employee/shared': <EmployeeDocumentsPage shared />,
    '/employee/upload': <UploadDocumentPage />,
    '/employee/activity': <EmployeeActivityPage />,
    '/employee/requests': <EmployeeRequestsPage />,
  }[pathname]

  useEffect(() => {
    document.title = `${isDashboard ? 'Employee dashboard' : employeeNavigation.concat(employeeBottomNavigation).find((item) => item.href === pathname)?.label ?? 'Employee workspace'} | SureDocs`
  }, [isDashboard, pathname])

  return (
    <div className="min-h-screen bg-[#f4f7fa] text-slate-900 lg:pl-[180px]">
      <EmployeeSidebar pathname={pathname} />
      <div className="min-h-screen">
        {isDashboard
          ? <EmployeeDashboardContent />
          : workspace ?? <EmployeeSectionPlaceholder pathname={pathname} />}
      </div>
    </div>
  )
}

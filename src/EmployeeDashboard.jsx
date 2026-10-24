import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from './api.js'
import DocumentsWorkspace from './DocumentsWorkspace.jsx'
import EmployeeAccessRequestsPage from './EmployeeAccessRequestsPage.jsx'
import ProfileSettingsWorkspace from './ProfileSettingsWorkspace.jsx'
import UserAvatar from './UserAvatar.jsx'
import './EmployeeDashboard.css'

const employeeNavigation = [
  { label: 'Dashboard', href: '/employee', icon: 'home' },
  { label: 'My Documents', href: '/employee/documents', icon: 'file' },
  { label: 'Shared with Me', href: '/employee/shared', icon: 'users' },
  { label: 'Upload Document', href: '/employee/upload', icon: 'upload' },
  { label: 'Document Activity', href: '/employee/activity', icon: 'activity' },
  { label: 'Access Requests', href: '/employee/requests', icon: 'inbox' },
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

const employeeActivities = [
  { icon: 'eye', tone: 'bg-blue-50 text-blue-700', title: 'Document viewed', detail: 'You viewed Employee_Policy.pdf', time: 'Just now' },
  { icon: 'share', tone: 'bg-emerald-50 text-emerald-700', title: 'Access granted', detail: 'You shared Project_Requirements.pdf with Amit Kumar', time: '2 hours ago' },
  { icon: 'download', tone: 'bg-emerald-50 text-emerald-700', title: 'Document downloaded', detail: 'Amit Kumar downloaded Team_Plan.docx', time: '5 hours ago' },
  { icon: 'edit', tone: 'bg-amber-50 text-amber-700', title: 'Permission changed', detail: 'Access to Financial_Report.xlsx was updated', time: 'Yesterday' },
  { icon: 'denied', tone: 'bg-rose-50 text-rose-700', title: 'Access denied', detail: 'A blocked access attempt to Confidential_Draft.pdf', time: 'Yesterday' },
  { icon: 'bell', tone: 'bg-amber-50 text-amber-700', title: 'New access request', detail: 'Priya Mehta requested download access to Market_Analysis.pdf', time: '2 days ago' },
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
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  }

  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {content[name]}
    </svg>
  )
}

function EmployeeBrand() {
  return (
    <div className="employee-brand">
      <span className="employee-brand-mark">
        <EmployeeIcon className="h-5 w-5" name="security" />
      </span>
      <span>
        <span className="employee-brand-name">SureDocs</span>
        <span className="employee-brand-caption">Secure Document Sharing</span>
      </span>
    </div>
  )
}

function EmployeeSidebar({ pathname, open, onClose, pendingRequestCount }) {
  const isStorage = pathname === '/employee/storage' || pathname === '/employee/profile/storage'
  const isConnected = pathname === '/employee/connected' || pathname === '/employee/profile/connected' || pathname === '/employee/profile/connected-accounts'
  const isProfile = pathname.startsWith('/employee/profile') && !isStorage && !isConnected

  const mainNav = isStorage
    ? [
        { label: 'Dashboard', href: '/employee', icon: 'home' },
        { label: 'My Documents', href: '/employee/documents', icon: 'file' },
        { label: 'Shared with Me', href: '/employee/shared', icon: 'users' },
        { label: 'Upload Document', href: '/employee/upload', icon: 'upload' },
        { label: 'Document Activity', href: '/employee/activity', icon: 'activity' },
        { label: 'Storage', href: '/employee/storage', icon: 'clock', badge: 2 },
      ]
    : employeeNavigation

  const bottomNav = isConnected
    ? [
        { label: 'Connected Accounts', href: '/employee/connected', icon: 'link' },
        { label: 'Sign Out', href: '/', icon: 'signout' },
      ]
    : employeeBottomNavigation

  return (
    <aside aria-label="Employee sidebar" className={`employee-sidebar ${open ? 'employee-sidebar--open' : ''}`}>
      <EmployeeBrand />
      <nav aria-label="Employee navigation" className="employee-nav">
        {mainNav.map((item) => {
          const active = item.href === '/employee'
            ? pathname === '/employee' || pathname === '/employee/dashboard'
            : isStorage && item.href === '/employee/storage'
              ? true
              : pathname.startsWith(item.href)
          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={`employee-nav-link ${active ? 'employee-nav-link--active' : ''}`}
              href={item.href}
              key={item.href}
              onClick={onClose}
            >
              <EmployeeIcon className="employee-nav-icon" name={item.icon} />
              <span className="employee-nav-label">{item.label}</span>
              {item.href === '/employee/requests' && pendingRequestCount > 0 && <span className="employee-nav-badge">{pendingRequestCount > 99 ? '99+' : pendingRequestCount}</span>}
            </a>
          )
        })}
      </nav>
      <nav aria-label="Account navigation" className="employee-nav employee-nav--account">
        {bottomNav.map((item) => {
          const active = isConnected && item.href === '/employee/connected'
            ? true
            : isProfile && item.href === '/employee/profile'
              ? true
              : item.href !== '/' && pathname.startsWith(item.href)
          return (
            <a className={`employee-nav-link ${active ? 'employee-nav-link--active' : ''}`} href={item.href} key={item.href} onClick={onClose}>
              <EmployeeIcon className="employee-nav-icon" name={item.icon} />
              <span className="employee-nav-label">{item.label}</span>
            </a>
          )
        })}
      </nav>
    </aside>
  )
}

function notificationHref(notification) {
  if (notification.notification_type === 'ACCESS_REQUEST') return '/employee/requests'
  if (notification.document_id) return `/employee/shared?documentId=${encodeURIComponent(notification.document_id)}`
  return '/employee/notifications'
}

function EmployeeNotificationList({ items, status, error, onMarkRead, compact = false }) {
  if (status === 'loading' && items.length === 0) {
    return <p className="employee-notification-empty" role="status">Loading notifications…</p>
  }
  if (status === 'error' && items.length === 0) {
    return <p className="employee-notification-empty" role="alert">{error || 'Notifications could not be loaded.'}</p>
  }
  if (items.length === 0) {
    return <p className="employee-notification-empty" role="status">No notifications yet.</p>
  }

  return (
    <ul className={`employee-notification-list${compact ? ' employee-notification-list--compact' : ''}`}>
      {items.map((item) => (
        <li className={`employee-notification-item${item.read_at ? '' : ' is-unread'}`} key={item.id}>
          <a className="employee-notification-link" href={notificationHref(item)}>
            <span className="employee-notification-title">{item.title}</span>
            <span className="employee-notification-message">{item.message}</span>
            <time dateTime={item.created_at}>{formatRelativeTime(item.created_at)}</time>
          </a>
          {!item.read_at && onMarkRead && (
            <button aria-label={`Mark ${item.title} as read`} className="employee-notification-mark-read" onClick={() => onMarkRead(item.id)} type="button">Mark read</button>
          )}
        </li>
      ))}
    </ul>
  )
}

function EmployeeTopBar({
  user,
  notificationsOpen,
  setNotificationsOpen,
  search,
  onSearchChange,
  notifications = [],
  unreadCount = 0,
  notificationStatus = 'loading',
  notificationError = '',
  notificationActionError = '',
  onMarkRead,
  onMarkAllRead,
  onRefreshNotifications,
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const searchProps = search === undefined ? {} : { onChange: onSearchChange, value: search }
  const displayName = user?.full_name || user?.email || 'Employee'
  const displayRole = user?.role === 'ADMIN'
    ? 'Platform Administrator'
    : user?.role === 'MANAGER'
      ? 'Manager'
      : user?.job_title || user?.department || 'Employee'

  return (
    <header className="employee-topbar">
      <button aria-label="Open navigation" className="employee-menu-toggle" onClick={() => window.dispatchEvent(new Event('suredocs:toggle-employee-nav'))} type="button">
        <EmployeeIcon className="h-5 w-5" name="menu" />
      </button>
      <label className={`employee-search ${search === undefined ? 'employee-search--hidden' : ''}`}>
        <span className="sr-only">Search documents</span>
        <EmployeeIcon className="employee-search-icon" name="search" />
        <input placeholder="Search documents, owners, or keywords..." type="search" {...searchProps} />
      </label>
      <div className="employee-topbar-actions">
        <div className="employee-popover-anchor">
          <button aria-expanded={notificationsOpen} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} className="employee-topbar-icon-button" onClick={() => {
            const opening = !notificationsOpen
            setNotificationsOpen(opening)
            if (opening) onRefreshNotifications?.()
          }} type="button">
            <EmployeeIcon className="h-5 w-5" name="bell" />
            {unreadCount > 0 && <span aria-hidden="true" className="employee-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {notificationsOpen && (
            <div className="employee-popover">
              <div className="employee-popover-heading">
                <strong>Notifications</strong>
                {unreadCount > 0 && <button disabled={notificationStatus === 'loading'} onClick={onMarkAllRead} type="button">Mark all read</button>}
              </div>
              <p className="employee-popover-unread-count">{unreadCount} unread</p>
              {notificationActionError && <p className="employee-notification-error" role="alert">{notificationActionError}</p>}
              <EmployeeNotificationList compact error={notificationError} items={notifications.slice(0, 4)} onMarkRead={onMarkRead} status={notificationStatus} />
              <a className="employee-popover-view-all" href="/employee/notifications">View all notifications</a>
            </div>
          )}
        </div>
        <span aria-hidden="true" className="employee-topbar-divider" />
        <div className="employee-profile-menu">
          <button aria-expanded={profileOpen} className="employee-profile-trigger" onClick={() => setProfileOpen((open) => !open)} type="button">
            <UserAvatar className="employee-topbar-avatar" email={user?.email} fullName={displayName} />
            <span className="employee-profile-copy">
              <span className="employee-profile-name">{displayName}</span>
              <span className="employee-profile-role">{displayRole}</span>
            </span>
            <EmployeeIcon className="employee-profile-chevron" name="chevron" />
          </button>
          {profileOpen && (
            <div className="employee-profile-popover">
              <a href="/employee/profile" onClick={() => setProfileOpen(false)}>Profile &amp; Settings</a>
              <a href="/" onClick={() => setProfileOpen(false)}>Sign Out</a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function QuickLink({ href, icon, title, detail, primary = false }) {
  return (
    <a className={`employee-quick-link ${primary ? 'employee-quick-link--primary' : ''}`} href={href}>
      <EmployeeIcon className="employee-quick-link-icon" name={icon} />
      <span className="employee-quick-link-copy">
        <span className="employee-quick-link-title">{title}</span>
        <span className="employee-quick-link-detail">{detail}</span>
      </span>
    </a>
  )
}

function EmployeeDocumentIcon({ document }) {
  return <span className={`employee-document-icon employee-document-icon--${document.type.toLowerCase()}`}>{document.type}</span>
}

function PanelHeading({ title, href, linkText = 'View all', action }) {
  return (
    <div className="employee-panel-heading">
      <h2>{title}</h2>
      {action || (href && <a href={href}>{linkText}</a>)}
    </div>
  )
}

function formatRelativeTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 172800) return 'Yesterday'
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function formatDocumentDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })}`
  }
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

function activityLabel(actionType) {
  const labels = {
    DOCUMENT_VIEWED: 'Document viewed',
    DOCUMENT_DOWNLOADED: 'Document downloaded',
    ACCESS_GRANTED: 'Access granted',
    PERMISSION_UPDATED: 'Permission changed',
    PERMISSION_REVOKED: 'Permission revoked',
    ACCESS_DENIED: 'Access denied',
    DOCUMENT_CREATED: 'Document uploaded',
    DOCUMENT_UPDATED: 'Document updated',
    DOCUMENT_DELETED: 'Document deleted',
  }
  return labels[actionType] || actionType.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function activityIcon(actionType) {
  if (actionType.includes('DENIED') || actionType.includes('REVOKED')) return 'denied'
  if (actionType.includes('DOWNLOAD')) return 'download'
  if (actionType.includes('ACCESS_GRANTED')) return 'share'
  if (actionType.includes('PERMISSION')) return 'edit'
  if (actionType.includes('VIEWED')) return 'eye'
  if (actionType.includes('CREATED')) return 'upload'
  return 'file'
}

function activityTone(actionType) {
  if (actionType.includes('DENIED') || actionType.includes('REVOKED')) return 'is-error'
  if (actionType.includes('ACCESS_GRANTED')) return 'is-success'
  if (actionType.includes('PERMISSION')) return 'is-warning'
  return 'is-info'
}

async function getDistinctSharedDocumentCount(documents, signal) {
  if (documents.length > 40) return null
  const results = new Array(documents.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < documents.length) {
      const index = nextIndex++
      try {
        results[index] = await apiGet(`/api/documents/${documents[index].id}/permissions`, { signal })
      } catch (error) {
        if (error.name === 'AbortError') throw error
        results[index] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, documents.length) }, worker))
  if (results.some((result) => result === null)) return null
  return results.filter((result) => result.items.some((permission) => permission.is_effective)).length
}

async function fetchOwnedAuditEvents(documents, signal) {
  const scopedDocuments = documents.slice(0, 40)
  const results = new Array(scopedDocuments.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < scopedDocuments.length) {
      const index = nextIndex++
      try {
        const response = await apiGet(`/api/documents/${scopedDocuments[index].id}/audit`, { signal })
        results[index] = response.items.map((event) => ({ ...event, document: scopedDocuments[index] }))
      } catch (error) {
        if (error.name === 'AbortError') throw error
        results[index] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, scopedDocuments.length) }, worker))
  const events = results.flatMap((result) => result || [])
  events.sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at))
  return {
    events,
    partial: documents.length > scopedDocuments.length || results.some((result) => result === null),
    failed: results.filter((result) => result === null).length,
  }
}

function EmployeeDashboardContent({ user, notificationProps, notificationsOpen, setNotificationsOpen, pendingRequestCounts }) {
  const [search, setSearch] = useState('')
  const [myDocuments, setMyDocuments] = useState([])
  const [sharedDocuments, setSharedDocuments] = useState([])
  const [documentSummary, setDocumentSummary] = useState(null)
  const [sharedOwnedCount, setSharedOwnedCount] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [documentError, setDocumentError] = useState('')
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [activity, setActivity] = useState([])
  const [activityState, setActivityState] = useState('loading')
  const [openActionId, setOpenActionId] = useState('')
  const [profileError, setProfileError] = useState(false)
  const accessibleDocuments = useMemo(() => [...myDocuments, ...sharedDocuments]
    .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at)), [myDocuments, sharedDocuments])
  const filteredDocuments = useMemo(() => accessibleDocuments.filter((document) =>
    `${document.title} ${document.original_filename ?? ''} ${document.owner_name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  ), [accessibleDocuments, search])
  const firstName = user?.full_name?.trim().split(/\s+/)[0] || 'there'
  const [renderedAt] = useState(() => new Date())
  const hour = renderedAt.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = renderedAt.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const quickLinks = [
    { href: '/employee/upload', icon: 'upload', title: 'Upload Document', detail: 'Add a new document', primary: true },
    { href: '/employee/documents', icon: 'folder', title: 'My Documents', detail: 'View and manage your files' },
    { href: '/employee/shared', icon: 'users', title: 'Shared with Me', detail: 'Access documents shared with you' },
    { href: '/employee/documents', icon: 'share', title: 'Sharing & Permissions', detail: 'Manage access to your documents' },
  ]

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function loadDashboard() {
      const [ownedResult, sharedResult, summaryResult, profileResult] = await Promise.allSettled([
        apiGet('/api/documents/my', { signal: controller.signal }),
        apiGet('/api/documents/shared', { signal: controller.signal }),
        apiGet('/api/documents/summary', { signal: controller.signal }),
        apiGet('/api/users/me/profile', { signal: controller.signal }),
      ])
      if (!active) return
      const owned = ownedResult.status === 'fulfilled' ? ownedResult.value.items : []
      const shared = sharedResult.status === 'fulfilled' ? sharedResult.value.items : []
      setMyDocuments(owned)
      setSharedDocuments(shared)
      setDocumentSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null)
      setProfile(profileResult.status === 'fulfilled' ? profileResult.value : null)
      setProfileError(profileResult.status === 'rejected')
      setProfileLoading(false)
      setDocumentsLoading(false)
      if (ownedResult.status === 'rejected' || sharedResult.status === 'rejected') {
        setDocumentError(ownedResult.status === 'rejected' ? ownedResult.reason.message : sharedResult.reason.message)
      }
      if (ownedResult.status === 'fulfilled') {
        const sharedCount = await getDistinctSharedDocumentCount(owned, controller.signal)
        if (active) setSharedOwnedCount(sharedCount)
      }
      if (ownedResult.status === 'rejected') {
        if (active) setActivityState('unavailable')
        return
      }
      if (owned.length === 0) {
        if (active) setActivityState('empty')
        return
      }
      const auditResults = await Promise.allSettled(owned.slice(0, 8).map((document) =>
        apiGet(`/api/documents/${document.id}/audit`, { signal: controller.signal }),
      ))
      if (!active) return
      const events = auditResults.flatMap((result, index) => result.status === 'fulfilled'
        ? result.value.items.map((event) => ({ ...event, document: owned[index] }))
        : [])
      events.sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at))
      setActivity(events.slice(0, 6))
      setActivityState(events.length ? 'ready' : auditResults.some((result) => result.status === 'fulfilled') ? 'empty' : 'unavailable')
    }
    loadDashboard().catch((error) => {
      if (active && error.name !== 'AbortError') setActivityState('unavailable')
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  const metricCards = [
    { icon: 'file', value: documentSummary ? documentSummary.owned_documents : '—', label: 'My Documents', detail: 'Owned by you', tone: 'is-lavender', href: '/employee/documents' },
    { icon: 'folder', value: documentSummary ? documentSummary.shared_with_me : '—', label: 'Shared with Me', detail: 'Available to access', tone: 'is-blue', href: '/employee/shared' },
    { icon: 'users', value: sharedOwnedCount ?? '—', label: 'Documents I Share', detail: sharedOwnedCount === null ? 'Share total unavailable' : 'Owned and shared by you', tone: 'is-violet', href: '/employee/documents' },
    { icon: 'clock', value: pendingRequestCounts.loading ? '…' : pendingRequestCounts.owned ?? '—', label: 'Pending Requests', detail: 'Awaiting your review', tone: 'is-amber', href: '/employee/requests' },
  ]
  const accountStatus = profile?.account_status?.toLowerCase() || ''
  const accountStatusLabel = accountStatus ? accountStatus[0].toUpperCase() + accountStatus.slice(1) : 'Unavailable'

  return (
    <div className="employee-dashboard-page">
      <EmployeeTopBar
        {...notificationProps}
        user={user}
        notificationsOpen={notificationsOpen}
        onSearchChange={(event) => setSearch(event.target.value)}
        search={search}
        setNotificationsOpen={setNotificationsOpen}
      />
      <main className="employee-dashboard-main">
        <section className="employee-welcome">
          <div>
            <h1>{greeting}, {firstName}!</h1>
            <p>Your secure workspace for documents, sharing and access activity.</p>
          </div>
          <time dateTime={renderedAt.toISOString()}>{todayLabel}</time>
        </section>

        <section aria-label="Employee quick links" className="employee-quick-links">
          {quickLinks.map((link) => <QuickLink {...link} key={link.title} />)}
        </section>

        <section aria-label="Document summary" className="employee-metrics">
          {metricCards.map((card) => {
            const content = <>
              <span className="employee-metric-icon"><EmployeeIcon name={card.icon} /></span>
              <span className="employee-metric-copy">
                <span className="employee-metric-value">{documentsLoading ? '…' : card.value}</span>
                <span className="employee-metric-label">{card.label}</span>
                <span className="employee-metric-detail">{card.detail}</span>
              </span>
            </>
            return card.href
              ? <a className={`employee-metric-card ${card.tone}`} href={card.href} key={card.label}>{content}</a>
              : <div className={`employee-metric-card ${card.tone}`} key={card.label}>{content}</div>
          })}
        </section>
        {documentError && <p className="employee-dashboard-error" role="alert">Documents could not be loaded: {documentError}</p>}

        <div className="employee-dashboard-panels employee-dashboard-panels--primary">
          <section className="employee-panel employee-documents-panel">
            <PanelHeading href="/employee/documents" title="Recent Documents" />
            <div className="employee-table-wrap">
              <table className="employee-documents-table">
                <thead><tr><th>Name</th><th>Owner</th><th>Last Modified</th><th>Access</th><th className="employee-actions-cell">Actions</th></tr></thead>
                <tbody>
                  {filteredDocuments.slice(0, 4).map((document) => {
                    const filename = document.original_filename || document.title
                    const type = filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
                    const target = `${document.is_owner ? '/employee/documents' : '/employee/shared'}?documentId=${encodeURIComponent(document.id)}`
                    return (
                      <tr key={document.id}>
                        <td><a className="employee-document-name" href={target}><EmployeeDocumentIcon document={{ type }} />{document.title}</a></td>
                        <td>{document.is_owner ? 'You' : document.owner_name}</td>
                        <td>{formatDocumentDate(document.updated_at)}</td>
                        <td><span className={`employee-access-pill ${document.is_owner ? 'is-owner' : 'is-shared'}`}>{document.is_owner ? 'Owner' : 'Shared'}</span></td>
                        <td className="employee-actions-cell">
                          <div className="employee-document-action">
                            <button aria-expanded={openActionId === document.id} aria-label={`Actions for ${document.title}`} className="employee-more-button" onClick={() => setOpenActionId((current) => current === document.id ? '' : document.id)} type="button"><EmployeeIcon className="h-4 w-4" name="more" /></button>
                            {openActionId === document.id && <div className="employee-document-menu"><a href={target}>Open document library</a></div>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!documentsLoading && filteredDocuments.length === 0 && <tr><td className="employee-table-empty" colSpan={5}>{search ? 'No accessible documents match your search.' : documentError ? 'Document list unavailable.' : 'No documents yet.'}</td></tr>}
                  {documentsLoading && <tr><td className="employee-table-empty" colSpan={5}>Loading your documents…</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="employee-panel employee-activity-panel">
            <PanelHeading href="/employee/activity" title="Recent Activity" />
            {activityState === 'ready' ? (
              <ul className="employee-activity-list">
                {activity.map((event) => {
                  const label = activityLabel(event.action_type)
                  const actor = event.actor_user_id === user?.id ? 'You' : event.actor_name || 'A user'
                  return <li key={event.id}>
                    <a className="employee-activity-row" href={`/employee/activity?eventId=${encodeURIComponent(event.id)}`}>
                      <span className={`employee-activity-icon ${activityTone(event.action_type)}`}><EmployeeIcon name={activityIcon(event.action_type)} /></span>
                      <span className="employee-activity-copy"><strong>{label}</strong><span>{actor} · {event.document.title}</span></span>
                      <time>{formatRelativeTime(event.occurred_at)}</time>
                    </a>
                  </li>
                })}
              </ul>
            ) : <div className="employee-panel-empty" role="status">{activityState === 'loading' ? 'Loading activity…' : activityState === 'empty' ? 'No activity is recorded for your documents yet.' : 'Activity data is unavailable.'}</div>}
          </section>
        </div>

        <div className="employee-dashboard-panels employee-dashboard-panels--secondary">
          <section className="employee-panel employee-notifications-panel">
            <PanelHeading
              href="/employee/notifications"
              title="Notifications"
              action={<div className="employee-notification-actions"><a href="/employee/notifications">View all</a><span aria-hidden="true" /><button disabled={notificationProps.unreadCount === 0 || notificationProps.notificationStatus === 'loading'} onClick={notificationProps.onMarkAllRead} type="button">Mark all read</button></div>}
            />
            {notificationProps.notificationActionError && <p className="employee-notification-error" role="alert">{notificationProps.notificationActionError}</p>}
            <EmployeeNotificationList error={notificationProps.notificationError} items={notificationProps.notifications.slice(0, 4)} onMarkRead={notificationProps.onMarkRead} status={notificationProps.notificationStatus} />
          </section>

          <section className="employee-panel employee-access-panel">
            <PanelHeading href="/employee/profile" linkText="View details" title="Access Summary" />
            <div className="employee-account-status">
              <EmployeeIcon className="employee-account-shield" name="security" />
              <span><strong>{profileLoading ? 'Loading account status…' : profileError ? 'Account status unavailable' : `Your account is ${accountStatus || 'unavailable'}`}</strong><span>{profile ? `Account status: ${accountStatusLabel}` : profileLoading ? 'Loading your SureDocs profile.' : 'Account details could not be loaded.'}</span></span>
            </div>
            <div className="employee-access-metrics">
              {[
                { icon: 'clock', value: '—', detail: 'Documents expiring soon', tone: 'is-amber' },
                { icon: 'users', value: pendingRequestCounts.loading ? '…' : pendingRequestCounts.owned ?? '—', detail: 'Pending approval (as owner)', tone: 'is-violet' },
                { icon: 'file', value: pendingRequestCounts.loading ? '…' : pendingRequestCounts.mine ?? '—', detail: 'Your pending requests', tone: 'is-blue' },
              ].map((item) => <div className="employee-access-metric" key={item.detail}>
                <EmployeeIcon className={item.tone} name={item.icon} />
                <span><strong>{item.value}</strong><span>{item.detail}</span></span>
              </div>)}
            </div>
            <p className="employee-access-note">{pendingRequestCounts.error ? 'Some pending request totals could not be loaded.' : 'Pending request totals are loaded from your access request records.'} Document expiry totals are not configured.</p>
          </section>
        </div>
      </main>
    </div>
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

function EmployeeDocumentsPage({ shared = false, user }) {
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
                      ['Owner', shared ? `${selected.owner} (${selected.department})` : (user?.full_name ? `You (${user.full_name})` : 'You')],
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

function UploadDocumentPage({ user }) {
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
              <dl className="mt-2 space-y-1 text-[7px]">{[['Name', name || '—'], ['Description', description || '—'], ['Classification', classification], ['File Type', file?.name.split('.').pop()?.toUpperCase() ?? '—'], ['File Size', file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '—'], ['Created By', user?.full_name ? `You (${user.full_name})` : 'You'], ['Created On', '27 May 2025, 10:24 AM']].map(([label, value]) => <div className="grid grid-cols-[64px_1fr] gap-1" key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-700">{value}</dd></div>)}</dl>
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

function EmployeeActivityPage({ user, notificationProps, notificationsOpen, setNotificationsOpen }) {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [events, setEvents] = useState([])
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('eventId') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    const controller = new AbortController()
    async function loadActivity() {
      try {
        const documents = await apiGet('/api/documents/my', { signal: controller.signal })
        const audit = await fetchOwnedAuditEvents(documents.items, controller.signal)
        setEvents(audit.events)
        if (audit.failed > 0 && audit.failed === documents.items.length) {
          setError('Audit records could not be loaded for your documents.')
        } else if (audit.partial) {
          setError('Some older document activity could not be retrieved. Only audit records the current account is authorized to view are included.')
        }
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadActivity()
    return () => controller.abort()
  }, [])

  const selected = events.find((event) => event.id === selectedId) || null
  const filtered = events.filter((event) => (
    (!search || `${event.document.title} ${event.actor_name ?? ''} ${activityLabel(event.action_type)}`.toLowerCase().includes(search.toLowerCase())) &&
    (actionFilter === 'all' || event.action_type === actionFilter) &&
    (outcomeFilter === 'all' || event.result === outcomeFilter)
  ))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  function updateFilter(setFilter, value) {
    setFilter(value)
    setPage(1)
  }

  function exportActivity() {
    const rows = [['Timestamp', 'Action', 'Document', 'Actor', 'Outcome'], ...filtered.map((event) => [event.occurred_at, activityLabel(event.action_type), event.document.title, event.actor_name ?? 'Unavailable', event.result])]
    const csv = rows.map((row) => row.map((item) => `"${String(item).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'suredocs-document-activity.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
    <EmployeeTopBar {...notificationProps} notificationsOpen={notificationsOpen} onSearchChange={(event) => { setSearch(event.target.value); setPage(1) }} search={search} setNotificationsOpen={setNotificationsOpen} user={user} />
    <main className="mx-auto max-w-[1600px] space-y-3 px-4 py-4 sm:px-5">
      <EmployeePageHeader action={<button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[10px] font-semibold text-indigo-700" disabled={!filtered.length} onClick={exportActivity} type="button"><EmployeeIcon className="h-3 w-3" name="download" />Export Activity</button>} description="Audit records for documents you own. Records are limited to events your account is authorized to review." icon="activity" title="Document Activity" />
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
        <EmployeeSearch label="Search document activity" onChange={(value) => { setSearch(value); setPage(1) }} placeholder="Search document, actor, action..." value={search} />
        <EmployeeFilter label="Activity action" onChange={(value) => updateFilter(setActionFilter, value)} options={[{ value: 'all', label: 'All Actions' }, ...[...new Set(events.map((event) => event.action_type))].map((value) => ({ value, label: activityLabel(value) }))]} value={actionFilter} />
        <EmployeeFilter label="Activity outcome" onChange={(value) => updateFilter(setOutcomeFilter, value)} options={[{ value: 'all', label: 'All Outcomes' }, ...[...new Set(events.map((event) => event.result))].map((value) => ({ value, label: value }))]} value={outcomeFilter} />
      </div>
      {error && <p className="rounded-md bg-amber-50 px-3 py-2 text-[10px] text-amber-900" role="status">{error}</p>}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500"><tr><th className="px-2 py-2">Timestamp</th><th className="px-2 py-2">Action</th><th className="px-2 py-2">Document</th><th className="px-2 py-2">Actor</th><th className="px-2 py-2">Outcome</th><th className="px-2 py-2">Details</th></tr></thead>
              <tbody>
                {visible.map((event) => <tr aria-selected={selectedId === event.id} className={`cursor-pointer border-t border-slate-100 hover:bg-indigo-50/50 ${selectedId === event.id ? 'bg-indigo-50/50' : ''}`} key={event.id} onClick={() => setSelectedId(event.id)}>
                  <td className="whitespace-nowrap px-2 py-2 text-[10px] text-slate-600">{new Date(event.occurred_at).toLocaleString()}</td>
                  <td className="px-2 py-2"><span className="flex min-w-[130px] items-center gap-1.5"><span className={`flex h-6 w-6 items-center justify-center rounded-full ${activityTone(event.action_type)} bg-opacity-20`}><EmployeeIcon className="h-3.5 w-3.5" name={activityIcon(event.action_type)} /></span><span className="text-[10px] font-semibold text-slate-700">{activityLabel(event.action_type)}</span></span></td>
                  <td className="px-2 py-2 text-[10px] text-slate-700">{event.document.title}</td>
                  <td className="px-2 py-2 text-[10px] text-slate-700">{event.actor_name || 'Unavailable'}</td>
                  <td className="px-2 py-2"><EmployeeBadge tone={event.result === 'SUCCESS' ? 'green' : 'red'}>{event.result}</EmployeeBadge></td>
                  <td className="px-2 py-2"><button aria-label={`View activity details: ${activityLabel(event.action_type)}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedId(event.id) }} type="button"><EmployeeIcon className="h-3.5 w-3.5" name="more" /></button></td>
                </tr>)}
                {!loading && filtered.length === 0 && <tr><td className="py-8 text-center text-[10px] text-slate-500" colSpan={6}>{events.length ? 'No activity matches these filters.' : error ? 'Activity data is unavailable.' : 'No audit events have been recorded for your documents.'}</td></tr>}
                {loading && <tr><td className="py-8 text-center text-[10px] text-slate-500" colSpan={6}>Loading authorized activity…</td></tr>}
              </tbody>
            </table>
          </div>
          <EmployeePagination count={filtered.length} label="activities" onPageChange={setPage} page={page} pageSize={pageSize} />
        </section>
        {selected && <aside aria-label="Activity details" className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 p-3"><h2 className="text-[12px] font-semibold text-slate-800">Activity Details</h2><button aria-label="Close activity details" className="text-slate-400" onClick={() => setSelectedId('')} type="button"><EmployeeIcon className="h-4 w-4" name="close" /></button></header>
          <div className="p-3">
            <div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${activityTone(selected.action_type)} bg-opacity-20`}><EmployeeIcon className="h-4 w-4" name={activityIcon(selected.action_type)} /></span><span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-slate-800">{activityLabel(selected.action_type)}</span><span className="block text-[10px] text-slate-500">{new Date(selected.occurred_at).toLocaleString()}</span></span><EmployeeBadge tone={selected.result === 'SUCCESS' ? 'green' : 'red'}>{selected.result}</EmployeeBadge></div>
            <dl className="mt-4 space-y-3 text-[10px]">{[
              ['Event ID', selected.id],
              ['Action', activityLabel(selected.action_type)],
              ['Outcome', selected.result],
              ['Timestamp', new Date(selected.occurred_at).toLocaleString()],
              ['Document', selected.document.title],
              ['Actor', selected.actor_name || 'Unavailable'],
              ['IP address', selected.ip_address || 'Unavailable'],
              ['Request ID', selected.request_id || 'Unavailable'],
            ].map(([label, value]) => <div className="grid grid-cols-[74px_1fr] gap-2" key={label}><dt className="text-slate-500">{label}</dt><dd className="break-words text-slate-700">{value}</dd></div>)}</dl>
          </div>
        </aside>}
      </div>
    </main>
    </>
  )
}

function EmployeeRequestsPage({ user, notificationsOpen, onSearchChange, search, setNotificationsOpen, notificationProps }) {
  return (
    <>
      <EmployeeTopBar
        {...notificationProps}
        notificationsOpen={notificationsOpen}
        onSearchChange={onSearchChange}
        search={search}
        setNotificationsOpen={setNotificationsOpen}
        user={user}
      />
      <EmployeeAccessRequestsPage />
    </>
  )
}

function EmployeeNotificationsPage({ user, notificationProps, notificationsOpen, setNotificationsOpen }) {
  return (
    <>
      <EmployeeTopBar {...notificationProps} user={user} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} />
      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <EmployeePageHeader
          action={<button className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-[10px] font-semibold text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400" disabled={notificationProps.unreadCount === 0 || notificationProps.notificationStatus === 'loading'} onClick={notificationProps.onMarkAllRead} type="button">Mark all read</button>}
          description="Notifications for your SureDocs account."
          icon="bell"
          title="Notifications"
        />
        <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{notificationProps.unreadCount} unread</p>
            {notificationProps.notificationActionError && <p className="text-xs text-rose-700" role="alert">{notificationProps.notificationActionError}</p>}
          </div>
          <EmployeeNotificationList error={notificationProps.notificationError} items={notificationProps.notifications} onMarkRead={notificationProps.onMarkRead} status={notificationProps.notificationStatus} />
        </section>
      </main>
    </>
  )
}

function EmployeeSectionPlaceholder({ user, pathname, notificationProps, notificationsOpen, setNotificationsOpen }) {
  const section = [...employeeNavigation, ...employeeBottomNavigation]
    .find((item) => item.href === pathname)
  const title = section?.label ?? 'Employee workspace'

  return (
    <>
      <EmployeeTopBar {...notificationProps} user={user} notificationsOpen={notificationsOpen} onSearchChange={() => {}} search="" setNotificationsOpen={setNotificationsOpen} />
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

export default function EmployeeDashboard({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname.replace(/\/$/, '') || '/employee')
  const [notificationRefresh, setNotificationRefresh] = useState(0)
  const [notificationState, setNotificationState] = useState({ items: [], unreadCount: 0, status: 'loading', error: '', actionError: '' })
  const [pendingRequestCounts, setPendingRequestCounts] = useState({ owned: null, mine: null, loading: true, error: false })

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    apiGet('/api/users/me/notifications?page=1&page_size=8', { signal: controller.signal })
      .then((response) => {
        if (!active) return
        setNotificationState({
          items: Array.isArray(response.items) ? response.items : [],
          unreadCount: Number(response.unread_count) || 0,
          status: 'ready',
          error: '',
          actionError: '',
        })
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError') {
          setNotificationState((current) => ({ ...current, status: 'error', error: error.message || 'Notifications could not be loaded.' }))
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [notificationRefresh, user?.id])

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    Promise.allSettled([
      apiGet('/api/access-requests?scope=owned&status=PENDING&page=1&page_size=1', { signal: controller.signal }),
      apiGet('/api/access-requests?scope=mine&status=PENDING&page=1&page_size=1', { signal: controller.signal }),
    ]).then(([owned, mine]) => {
      if (!active) return
      setPendingRequestCounts({
        owned: owned.status === 'fulfilled' ? Number(owned.value.total) || 0 : null,
        mine: mine.status === 'fulfilled' ? Number(mine.value.total) || 0 : null,
        loading: false,
        error: owned.status === 'rejected' || mine.status === 'rejected',
      })
    })
    return () => {
      active = false
      controller.abort()
    }
  }, [user?.id])

  function refreshNotifications() {
    setNotificationRefresh((current) => current + 1)
  }

  async function markNotificationRead(notificationId) {
    try {
      const updated = await apiPatch(`/api/users/me/notifications/${encodeURIComponent(notificationId)}/read`, {})
      setNotificationState((current) => {
        const existing = current.items.find((item) => item.id === notificationId)
        if (!existing) return { ...current, actionError: '' }
        const wasUnread = !existing.read_at
        return {
          ...current,
          items: current.items.map((item) => item.id === notificationId ? { ...item, read_at: updated.read_at } : item),
          unreadCount: Math.max(0, current.unreadCount - (wasUnread ? 1 : 0)),
          actionError: '',
        }
      })
    } catch (error) {
      setNotificationState((current) => ({ ...current, actionError: error.message || 'This notification could not be marked read.' }))
    }
  }

  async function markAllNotificationsRead() {
    try {
      await apiPost('/api/users/me/notifications/read-all', {})
      const readAt = new Date().toISOString()
      setNotificationState((current) => ({
        ...current,
        items: current.items.map((item) => item.read_at ? item : { ...item, read_at: readAt }),
        unreadCount: 0,
        actionError: '',
      }))
    } catch (error) {
      setNotificationState((current) => ({ ...current, actionError: error.message || 'Notifications could not be marked read.' }))
    }
  }

  const notificationProps = {
    notifications: notificationState.items,
    unreadCount: notificationState.unreadCount,
    notificationStatus: notificationState.status,
    notificationError: notificationState.error,
    notificationActionError: notificationState.actionError,
    onMarkRead: markNotificationRead,
    onMarkAllRead: markAllNotificationsRead,
    onRefreshNotifications: refreshNotifications,
  }

  useEffect(() => {
    function handleLocationChange() {
      setCurrentPath(window.location.pathname.replace(/\/$/, '') || '/employee')
    }
    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  const initialDocumentId = new URLSearchParams(window.location.search).get('documentId')
  const isDashboard = currentPath === '/employee' || currentPath === '/employee/dashboard'
  const isDocumentsRoute = ['/employee/documents', '/employee/shared', '/employee/upload'].includes(currentPath)
  const isAccessRequestsRoute = currentPath === '/employee/requests'

  let profileSection = null
  if (currentPath === '/employee/profile' || currentPath === '/employee/profile/account') {
    profileSection = 'account'
  } else if (currentPath === '/employee/profile/security') {
    profileSection = 'security'
  } else if (currentPath === '/employee/profile/notifications') {
    profileSection = 'notifications'
  } else if (currentPath === '/employee/profile/preferences') {
    profileSection = 'preferences'
  } else if (currentPath === '/employee/profile/storage' || currentPath === '/employee/storage') {
    profileSection = 'storage'
  } else if (currentPath === '/employee/profile/connected' || currentPath === '/employee/connected' || currentPath === '/employee/profile/connected-accounts') {
    profileSection = 'connected'
  }
  const isProfileRoute = Boolean(profileSection)

  const workspace = isProfileRoute ? (
    <ProfileSettingsWorkspace initialTab={profileSection} user={user} />
  ) : {
    '/employee/documents': <DocumentsWorkspace initialDocumentId={initialDocumentId} mode="owned" onSearchChange={setWorkspaceSearch} search={workspaceSearch} user={user} />,
    '/employee/shared': <DocumentsWorkspace initialDocumentId={initialDocumentId} mode="shared" onSearchChange={setWorkspaceSearch} search={workspaceSearch} user={user} />,
    '/employee/upload': <DocumentsWorkspace mode="owned" startInUpload user={user} />,
    '/employee/activity': <EmployeeActivityPage notificationProps={notificationProps} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} user={user} />,
    '/employee/requests': <EmployeeRequestsPage
      notificationProps={notificationProps}
      notificationsOpen={notificationsOpen}
      onSearchChange={(event) => setWorkspaceSearch(event.target.value)}
      search={workspaceSearch}
      setNotificationsOpen={setNotificationsOpen}
      user={user}
    />,
    '/employee/notifications': <EmployeeNotificationsPage notificationProps={notificationProps} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} user={user} />,
  }[currentPath]

  useEffect(() => {
    const titleMap = {
      account: 'Account Information | SureDocs',
      security: 'Security Settings | SureDocs',
      notifications: 'Notification Preferences | SureDocs',
      preferences: 'Preferences | SureDocs',
      storage: 'Storage Usage | SureDocs',
      connected: 'Connected Accounts | SureDocs',
    }
    if (profileSection) {
      document.title = titleMap[profileSection] || 'Profile & Settings | SureDocs'
    } else {
      document.title = `${isDashboard ? 'Employee dashboard' : employeeNavigation.concat(employeeBottomNavigation).find((item) => item.href === currentPath)?.label ?? 'Employee workspace'} | SureDocs`
    }
  }, [currentPath, isDashboard, profileSection])

  useEffect(() => {
    const toggle = () => setSidebarOpen((open) => !open)
    const close = () => setSidebarOpen(false)
    window.addEventListener('suredocs:toggle-employee-nav', toggle)
    window.addEventListener('suredocs:close-employee-nav', close)
    return () => {
      window.removeEventListener('suredocs:toggle-employee-nav', toggle)
      window.removeEventListener('suredocs:close-employee-nav', close)
    }
  }, [])

  return (
    <div className={`employee-shell${isDocumentsRoute ? ' employee-shell--documents' : ''}${currentPath === '/employee/upload' ? ' employee-shell--upload' : ''}${isAccessRequestsRoute ? ' employee-shell--access-requests' : ''}${isProfileRoute ? ' employee-shell--profile' : ''} ${sidebarOpen ? 'employee-shell--nav-open' : ''}`}>
      <EmployeeSidebar pathname={currentPath} onClose={() => setSidebarOpen(false)} open={sidebarOpen} pendingRequestCount={pendingRequestCounts.owned} />
      {sidebarOpen && <button aria-label="Close navigation" className="employee-sidebar-backdrop" onClick={() => setSidebarOpen(false)} type="button" />}
      <div className="employee-shell-content">
        {isDashboard
          ? <EmployeeDashboardContent notificationProps={notificationProps} notificationsOpen={notificationsOpen} pendingRequestCounts={pendingRequestCounts} setNotificationsOpen={setNotificationsOpen} user={user} />
          : (isDocumentsRoute || isProfileRoute)
            ? <>
              <EmployeeTopBar
                {...notificationProps}
                notificationsOpen={notificationsOpen}
                onSearchChange={(event) => setWorkspaceSearch(event.target.value)}
                search={workspaceSearch}
                setNotificationsOpen={setNotificationsOpen}
                user={user}
              />
              {workspace ?? <EmployeeSectionPlaceholder notificationProps={notificationProps} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} user={user} pathname={currentPath} />}
            </>
            : workspace ?? <EmployeeSectionPlaceholder notificationProps={notificationProps} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} user={user} pathname={currentPath} />}
      </div>
    </div>
  )
}

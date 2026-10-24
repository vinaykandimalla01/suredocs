import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from './api.js'
import AdminPermissionDocumentModal from './AdminPermissionDocumentModal.jsx'
import AdminDashboardHome from './AdminDashboardHome.jsx'
import AdminAuditLogs from './AdminAuditLogs.jsx'
import AdminSecurityMonitoring from './AdminSecurityMonitoring.jsx'
import AdminDocumentsWorkspace from './AdminDocumentsWorkspace.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'
import UserAvatar from './UserAvatar.jsx'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
  { label: 'Users', href: '/admin/users', icon: 'users' },
  { label: 'Documents', href: '/admin/documents', icon: 'documents' },
  { label: 'Permissions', href: '/admin/permissions', icon: 'permissions' },
  { label: 'Audit Logs', href: '/admin/audit', icon: 'audit' },
  { label: 'Reports', href: '/admin/reports', icon: 'reports' },
  { label: 'Settings', href: '/admin/settings', icon: 'settings' },
]

const userFirstNames = [
  'Avery', 'Jordan', 'Morgan', 'Taylor', 'Riley', 'Casey', 'Quinn', 'Cameron',
  'Drew', 'Reese', 'Parker', 'Jamie', 'Rowan', 'Skyler', 'Emerson', 'Finley',
]
const userLastNames = [
  'Chen', 'Patel', 'Williams', 'Garcia', 'Kim', 'Singh', 'Brown', 'Nguyen',
]
const userDepartments = [
  'HR Department', 'IT Department', 'Finance', 'Auditing', 'Security',
  'Administration',
]
const departments = [
  'HR Department',
  'IT Department',
  'Finance',
  'Auditing',
  'Security',
  'Administration',
]

function makeMockUsers() {
  return Array.from({ length: 124 }, (_, index) => {
    const firstName = userFirstNames[index % userFirstNames.length]
    const lastName = userLastNames[Math.floor(index / userFirstNames.length)]
    const identifier = String(index + 1).padStart(3, '0')
    const emailName = `${firstName}.${lastName}.${identifier}`.toLowerCase()

    return {
      id: `SD-${identifier}`,
      name: `${firstName} ${lastName}`,
      email: `${emailName}@suredocs.example`,
      role: index < 6 ? 'Administrator' : 'Employee',
      department: userDepartments[index % userDepartments.length],
      joined: new Date(Date.UTC(2025, (index * 5) % 12, (index * 7) % 27 + 1))
        .toISOString()
        .slice(0, 10),
      lastLogin: new Date(Date.UTC(2026, 9, 19 - (index % 20), 14, 32 - (index % 60)))
        .toISOString(),
      status: index % 9 === 0 ? 'Disabled' : 'Active',
    }
  })
}

const usersStorageKey = 'suredocs-admin-mock-users'

function loadMockUsers() {
  const savedUsers = window.localStorage.getItem(usersStorageKey)
  if (!savedUsers) return makeMockUsers()

  const users = JSON.parse(savedUsers)
  if (!Array.isArray(users)) {
    throw new Error('Saved mock user data is invalid. Clear the SureDocs mock user data to continue.')
  }

  return users
}

const inviteRoles = ['Administrator', 'Employee']
const initialRecentActivities = [
  {
    title: 'Successful sign-in',
    detail: 'Priya Mehta · Interactive sign-in completed',
    time: 'Today, 10:03',
    icon: 'activity',
  },
  {
    title: 'Account disabled',
    detail: 'Daniel Brooks · Account access disabled by administrator',
    time: 'Yesterday, 15:24',
    icon: 'security',
  },
  {
    title: 'Permission revoked',
    detail: 'Alex Morgan · Document access grant revoked',
    time: 'Yesterday, 12:10',
    icon: 'permissions',
  },
]

const documentOwners = ['Maya Chen', 'Alex Morgan', 'Priya Sharma', 'Rahul Kumar', 'Ananya Rao']
const documentNames = [
  'Salary Revision Letter',
  'Master Service Agreement',
  'Quarterly Audit Evidence',
  'Project Proposal',
  'Vendor Contract',
  'Employee Handbook',
  'Security Review',
  'Finance Forecast',
  'Client Statement',
  'Policy Update',
]
const documentCategories = ['HR', 'Legal', 'Finance', 'Projects', 'Legal', 'HR', 'Security', 'Finance']
const documentTypes = [
  { label: 'PDF', size: '245 KB', extension: 'PDF' },
  { label: 'DOCX', size: '1.2 MB', extension: 'DOCX' },
  { label: 'XLSX', size: '856 KB', extension: 'XLSX' },
  { label: 'PPTX', size: '2.4 MB', extension: 'PPTX' },
  { label: 'PDF', size: '1.1 MB', extension: 'PDF' },
]
const documentReferenceTime = new Date('2026-10-20T23:59:59').getTime()

function makeMockDocuments() {
  return Array.from({ length: 1248 }, (_, index) => {
    const sampleIndex = index % documentNames.length
    const type = documentTypes[index % documentTypes.length]
    const day = 12 - (index % 12)
    const hour = 10 + (index % 8)
    const minute = index === 0 ? 24 : (index * 7) % 60
    const uploadedAt = new Date(Date.UTC(2026, 9, day, hour, minute))
    const modifiedAt =
      index === 0
        ? new Date(Date.UTC(2026, 9, 14, 14, 17))
        : new Date(uploadedAt.getTime() + ((index % 8) + 1) * 86400000)
    const deleted = index % 24 === 4
    const id = `TV-DOC-${String(index + 1).padStart(3, '0')}`

    return {
      id,
      name: documentNames[sampleIndex],
      owner: documentOwners[index % documentOwners.length],
      category: documentCategories[index % documentCategories.length],
      description:
        sampleIndex === 0
          ? 'Official salary revision letter for Q4 2026.'
          : `${documentCategories[index % documentCategories.length]} document for internal review and secure sharing.`,
      fileType: type.label,
      fileSize: type.size,
      uploadedAt: uploadedAt.toISOString(),
      modifiedAt: modifiedAt.toISOString(),
      status: deleted ? 'Deleted' : 'Active',
      activeGrants: deleted
        ? 0
        : [1, 3, 4, 2, 0][index] ?? (index * 7) % 6,
      revokedGrants: deleted ? (index % 3) + 1 : (index * 3) % 3,
      iconColor: ['#e53935', '#2582e8', '#18a36b', '#7838df', '#e53935'][index % 5],
    }
  })
}

const initialDocumentActivity = [
  { title: 'Document accessed', user: 'John Smith', time: 'Oct 12, 2026 11:02 AM', result: 'Allowed' },
  { title: 'Permission granted', user: 'Maya Chen', time: 'Oct 12, 2026 10:48 AM', result: 'Recorded' },
  { title: 'Document uploaded', user: 'Maya Chen', time: 'Oct 12, 2026 10:24 AM', result: 'Recorded' },
]

const passwordAlphabet =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*-_'

function generateTemporaryPassword(existingPasswords = []) {
  const usedPasswords = new Set(existingPasswords)
  let password

  do {
    const randomValues = new Uint32Array(16)
    window.crypto.getRandomValues(randomValues)
    password = Array.from(
      randomValues,
      (value) => passwordAlphabet[value % passwordAlphabet.length],
    ).join('')
  } while (usedPasswords.has(password))

  return password
}

function createUsername(firstName, lastName) {
  const normalize = (value) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')

  const first = normalize(firstName)
  const last = normalize(lastName)
  return first && last ? `${first}.${last}` : first || last
}

function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    documents: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    permissions: <><circle cx="8" cy="15" r="4" /><path d="m10.85 12.15 7.8-7.8a2.12 2.12 0 0 1 3 3l-2 2-2-2-2 2 2 2-4 4" /></>,
    audit: <><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /><path d="M5 3 2 6m17-3 3 3" /></>,
    security: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
    storage: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></>,
    activity: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="10" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    filter: <><path d="M4 5h16l-6.5 7.5v5l-3 1v-6L4 5Z" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.7-6.4L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    grant: <><circle cx="8" cy="15" r="4" /><path d="m10.85 12.15 7.8-7.8a2.12 2.12 0 0 1 3 3l-2 2-2-2-2 2 2 2-4 4" /></>,
    revoked: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    pdf: <><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h5M7 16h2a1.5 1.5 0 0 0 0-3H7v5m6 0v-5h1a2.5 2.5 0 0 1 0 5h-1m5-5h3m-3 2h2" /></>,
    fileSpreadsheet: <><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h5M8 12h8m-8 3h8m-8 3h8m-5-6v6" /></>,
    filePresentation: <><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h5M8 17l2-3 2 2 2-4 2 5" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    success: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="10" /></>,
    failure: <><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6m0-6 6 6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    warning: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01" /></>,
    reports: <><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}

function BrandMark() {
  return (
    <div className="sidebar-brand">
      <svg aria-hidden="true" viewBox="0 0 24 26"><path d="M12 1 22 5v7c0 6.2-4.3 10.5-10 13C6.3 22.5 2 18.2 2 12V5l10-4Z" fill="currentColor"/><path d="m7.3 12.8 3.1 3.1 6.5-6.6" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
      <span>SureDocs</span>
    </div>
  )
}

function Sidebar({ pathname, user, mobileOpen, onClose }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const displayName = user?.full_name || 'Administrator'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const displayRole = user?.job_title || (user?.role === 'ADMIN' ? 'Administrator' : 'Employee')

  return (
    <aside className={`admin-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <BrandMark />
      <nav aria-label="Administrator navigation" className="admin-sidebar-nav">
        {navItems.map((item) => {
          const selected =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

          return (
            <a
              aria-current={selected ? 'page' : undefined}
              className={`admin-sidebar-link${selected ? ' selected' : ''}`}
              href={item.href}
              onClick={onClose}
              key={item.href}
            >
              <Icon className="sidebar-link-icon" name={item.icon} />
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="sidebar-profile-wrap">
        <button aria-expanded={profileOpen} className="sidebar-profile-button" onClick={() => setProfileOpen((value) => !value)} type="button">
          <span className="sidebar-avatar">{initials || 'A'}</span>
          <span className="sidebar-profile-copy"><b>{displayName}</b><small>{displayRole}</small></span>
          <Icon className="sidebar-profile-chevron" name="chevron" />
        </button>
        {profileOpen && <div className="sidebar-profile-menu"><span>{displayName}</span><small>{user?.email || displayRole}</small><a href="/">Sign out</a></div>}
      </div>
    </aside>
  )
}

function TopBar({ user, onMenuClick, userManagement = false, securityMonitoring = false, securitySearch = '', onSecuritySearch }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)
  const displayName = user?.full_name || 'Administrator'
  const displayRole = user?.job_title || (user?.role === 'ADMIN' ? 'Administrator' : 'Employee')

  useEffect(() => {
    if (!profileOpen) return undefined
    function closeProfile(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', closeProfile)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeProfile)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileOpen])

  return (
    <header className="admin-topbar">
      <button aria-label="Open navigation menu" className="admin-topbar-menu" onClick={onMenuClick} type="button"><Icon className="h-4 w-4" name="menu" /></button>
      <div className="admin-topbar-spacer" />
      <div className="admin-topbar-actions">
        {securityMonitoring && <label className="admin-security-search"><Icon className="h-3.5 w-3.5" name="search" /><span className="sr-only">Search security events</span><input aria-label="Search security events" onChange={(event) => onSecuritySearch(event.target.value)} placeholder="Search logs, users, documents..." type="search" value={securitySearch} /></label>}
        {securityMonitoring && <button aria-label="Notifications" className="admin-topbar-bell" type="button"><Icon className="h-4 w-4" name="bell" /><span /></button>}
        {userManagement || securityMonitoring ? (
          <div className="admin-user-profile" ref={profileRef}>
            <button aria-expanded={profileOpen} aria-label="Admin profile menu" className="admin-user-profile-button" onClick={() => setProfileOpen((value) => !value)} type="button">
              <UserAvatar className="admin-profile-avatar" email={user?.email} fullName={user?.full_name} />
              <span>Admin</span>
              <Icon name="chevron" />
            </button>
            {profileOpen && <div className="admin-user-profile-menu"><b>{displayName}</b><small>{user?.email || displayRole}</small><a href="/">Sign out</a></div>}
          </div>
        ) : <>
          <button aria-label="Notifications" className="admin-topbar-bell" type="button"><Icon className="h-4 w-4" name="bell" /><span /></button>
          <div className="admin-topbar-user">
            <UserAvatar className="h-8 w-8 bg-slate-900 text-[10px] font-semibold text-white" email={user?.email} fullName={user?.full_name} />
            <div><p>{displayName}</p><small>{displayRole}</small></div>
            <a aria-label="Sign out" className="admin-topbar-signout" href="/" title="Sign out">Sign out</a>
          </div>
        </>}
      </div>
    </header>
  )
}

function DashboardContent({ onMenuClick }) {
  return <AdminDashboardHome onMenuClick={onMenuClick} />
}

const sectionDetails = {
  '/admin/users': {
    title: 'User Management',
    description: 'Manage users, roles and access to the platform.',
    filters: { all: 'All registered users', active: 'Active accounts', disabled: 'Disabled accounts' },
  },
  '/admin/documents': {
    title: 'Documents',
    description: 'Browse documents shared across the SureDocs platform.',
  },
  '/admin/storage': {
    title: 'Storage',
    description: 'Review platform storage usage and capacity.',
  },
  '/admin/permissions': {
    title: 'Permissions',
    description: 'Manage document access rules and sharing permissions.',
  },
  '/admin/audit': {
    title: 'Audit logs',
    description: 'Review recorded actions and access decisions.',
  },
  '/admin/security': {
    title: 'Security monitoring',
    description: 'Monitor account security and denied access activity.',
  },
  '/admin/reports': {
    title: 'Reports',
    description: 'Reporting is not available in this dashboard preview.',
  },
  '/admin/settings': {
    title: 'Settings',
    description: 'Dashboard settings are not available in this preview.',
  },
}

export function CreateUserModal({ onClose, onCreate, passwords }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    department: '',
    username: '',
  })
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [password, setPassword] = useState(() => generateTemporaryPassword(passwords))
  const [requirePasswordChange, setRequirePasswordChange] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function updateName(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (!usernameEdited) {
        next.username = createUsername(
          field === 'firstName' ? value : next.firstName,
          field === 'lastName' ? value : next.lastName,
        )
      }
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    const normalizedUsername = form.username.trim()

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() ||
      !form.role || !form.department || !normalizedUsername || !password) {
      setError('Complete every field before creating the invitation.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid work email address.')
      return
    }

    const creationError = onCreate({
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      username: normalizedUsername,
      password,
      requirePasswordChange,
    })
    if (creationError) setError(creationError)
  }

  const inputClass =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
  const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="create-user-title"
        aria-modal="true"
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-[700px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <Icon className="h-5 w-5" name="users" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900" id="create-user-title">
                Create / Invite User
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Add a new account or prepare an email invitation.
              </p>
            </div>
          </div>
          <button
            aria-label="Close invitation form"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="text-2xl leading-5">×</span>
          </button>
        </div>

        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>First name</span>
              <input
                autoFocus
                autoComplete="given-name"
                className={inputClass}
                onChange={(event) => updateName('firstName', event.target.value)}
                placeholder="Enter first name"
                required
                value={form.firstName}
              />
            </label>
            <label>
              <span className={labelClass}>Last name</span>
              <input
                autoComplete="family-name"
                className={inputClass}
                onChange={(event) => updateName('lastName', event.target.value)}
                placeholder="Enter last name"
                required
                value={form.lastName}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Work email</span>
            <input
              autoComplete="email"
              className={inputClass}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@company.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Role</span>
              <select
                className={inputClass}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                required
                value={form.role}
              >
                <option disabled value="">Select a role</option>
                {inviteRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Department</span>
              <select
                className={inputClass}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                required
                value={form.department}
              >
                <option disabled value="">Select a department</option>
                {departments.map((department) => <option key={department}>{department}</option>)}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Username</span>
              <input
                autoComplete="username"
                className={inputClass}
                onChange={(event) => {
                  setUsernameEdited(true)
                  setForm((current) => ({ ...current, username: event.target.value }))
                }}
                placeholder="Generated from first and last name"
                required
                value={form.username}
              />
            </label>
            <div>
              <span className={labelClass}>Temporary password</span>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 pl-3">
                <input
                  aria-label="Generated temporary password"
                  className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-700 outline-none"
                  readOnly
                  value={password}
                />
                <button
                  aria-label="Generate a new password"
                  className="mr-1 rounded-md p-2 text-slate-500 hover:bg-white hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  onClick={() => {
                    setPassword(generateTemporaryPassword([...passwords, password]))
                    setError('')
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path d="M20 7v5h-5M4 17v-5h5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Generated automatically; editing is disabled.</p>
            </div>
          </div>

          <fieldset>
            <legend className={`${labelClass} mb-2`}>Invitation</legend>
            <label className="flex cursor-default items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-3">
              <input
                checked
                className="mt-0.5 accent-blue-600"
                readOnly
                type="radio"
              />
              <span>
                <span className="block text-xs font-semibold text-slate-800">Send email invitation</span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  Invitation is selected. Email delivery will be available when the backend is connected.
                </span>
              </span>
            </label>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              checked={requirePasswordChange}
              className="mt-0.5 h-4 w-4 rounded accent-blue-600"
              onChange={(event) => setRequirePasswordChange(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-xs font-semibold text-slate-700">Require password change on first sign-in</span>
              <span className="mt-1 block text-[10px] text-slate-500">User must set a new password when they first sign in.</span>
            </span>
          </label>

          {error && <p className="text-xs text-red-700" role="alert">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              type="submit"
            >
              <Icon className="h-4 w-4" name="arrow" />
              Create / Invite User
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function UserDetailsModal({ user, onClose, onToggleStatus }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const initials = user.name.split(' ').map((part) => part[0]).join('')
  const events = [
    {
      title: user.status === 'Active' ? 'Successful sign-in' : 'Account disabled',
      detail: user.status === 'Active' ? 'Interactive sign-in completed' : 'Account access disabled by administrator',
      time: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'No sign-in recorded',
      icon: user.status === 'Active' ? 'check' : 'security',
    },
    {
      title: 'Account created',
      detail: `Added to ${user.department}`,
      time: new Date(`${user.joined}T00:00:00Z`).toLocaleDateString(),
      icon: 'users',
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="user-details-title"
        aria-modal="true"
        className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-[800px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900" id="user-details-title">User details</h2>
          <button
            aria-label="Close user details"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="text-2xl leading-5">×</span>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-slate-100 pb-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-xl font-semibold text-blue-700">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{user.name}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : user.status === 'Disabled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                {user.status}
              </span>
            </div>
            <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
            <span className="mt-2 inline-flex rounded-md bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-800">{user.role}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Account overview</h3>
            <dl className="space-y-3 text-xs">
              {[
                ['User ID', user.id],
                ['Full name', user.name],
                ['Email address', user.email],
                ['Username', user.username ?? user.email.split('@')[0]],
                ['Role', user.role],
                ['Department', user.department],
                ['Account status', user.status],
                ['Created at', user.joined],
                ['Last login', user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'],
              ].map(([label, value]) => (
                <div className="grid grid-cols-[115px_1fr] gap-2" key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="break-words font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent account activity</h3>
            <div className="space-y-4">
              {events.map((event) => (
                <div className="flex gap-3" key={event.title}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <Icon className="h-4 w-4" name={event.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{event.title}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{event.detail}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{event.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
              Mock activity only · security event history is not connected.
            </p>
          </section>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-4 ${user.status === 'Disabled' ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-200' : 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200'}`}
            onClick={() => {
              onToggleStatus(user.id)
              onClose()
            }}
            type="button"
          >
            {user.status === 'Active'
              ? 'Disable account'
              : user.status === 'Invited'
                ? 'Cancel invitation'
                : 'Enable account'}
          </button>
        </div>
      </section>
    </div>
  )
}

function UserManagement({ initialFilter, createOpen, setCreateOpen }) {
  const [users, setUsers] = useState(loadMockUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All roles')
  const [statusFilter, setStatusFilter] = useState(initialFilter)
  const [sortBy, setSortBy] = useState('created-desc')
  const [page, setPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [activities, setActivities] = useState(initialRecentActivities)
  const [generatedPasswords, setGeneratedPasswords] = useState([])
  const pageSize = 10
  const activeCount = users.filter((user) => user.status === 'Active').length
  const disabledCount = users.filter((user) => user.status === 'Disabled').length
  const invitedCount = users.filter((user) => user.status === 'Invited').length
  const administratorCount = users.filter((user) => user.role === 'Administrator').length
  const tabOptions = [
    { value: 'all', label: 'All users', count: users.length },
    { value: 'active', label: 'Active', count: activeCount },
    { value: 'disabled', label: 'Disabled', count: disabledCount },
    { value: 'invited', label: 'Invited', count: invitedCount },
  ]
  const normalizedSearch = search.trim().toLowerCase()
  const filteredUsers = users.filter((user) => {
    const matchesRole = roleFilter === 'All roles' || user.role === roleFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.status === 'Active') ||
      (statusFilter === 'disabled' && user.status === 'Disabled') ||
      (statusFilter === 'invited' && user.status === 'Invited')
    const matchesSearch =
      !normalizedSearch ||
      [user.id, user.name, user.email, user.department, user.role]
        .some((value) => value.toLowerCase().includes(normalizedSearch))

    return matchesStatus && matchesRole && matchesSearch
  })
  const sortedUsers = [...filteredUsers].sort((first, second) => {
    if (sortBy === 'name-asc') return first.name.localeCompare(second.name)
    if (sortBy === 'created-asc') return first.joined.localeCompare(second.joined)
    if (sortBy === 'last-login-desc') {
      return (second.lastLogin ?? '').localeCompare(first.lastLogin ?? '')
    }
    return second.joined.localeCompare(first.joined)
  })
  const pageCount = Math.max(1, Math.ceil(sortedUsers.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visibleUsers = sortedUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const temporaryPasswords = [...generatedPasswords]

  useEffect(() => {
    window.localStorage.setItem(usersStorageKey, JSON.stringify(users))
  }, [users])

  useEffect(() => {
    function syncStatusFilter() {
      setStatusFilter(new URLSearchParams(window.location.search).get('filter') ?? 'all')
      setPage(1)
    }

    window.addEventListener('popstate', syncStatusFilter)
    return () => window.removeEventListener('popstate', syncStatusFilter)
  }, [])

  const filterHref = (filter) =>
    filter === 'all' ? '/admin/users?filter=all' : `/admin/users?filter=${filter}`

  function toggleStatus(userId) {
    const user = users.find((record) => record.id === userId)
    if (!user) return

    const nextStatus =
      user.status === 'Active'
        ? 'Disabled'
        : user.status === 'Disabled'
          ? user.lastLogin
            ? 'Active'
            : 'Invited'
          : 'Disabled'
    setUsers((currentUsers) =>
      currentUsers.map((record) =>
        record.id === userId ? { ...record, status: nextStatus } : record,
      ),
    )
    setSelectedUser((current) =>
      current?.id === userId ? { ...current, status: nextStatus } : current,
    )
    setActivities((current) => [
      {
        title: `Account ${nextStatus.toLowerCase()}`,
        detail: `${user.name} · Account status changed by administrator`,
        time: 'Just now',
        icon: 'security',
      },
      ...current,
    ])
    setNotice(`${user.name}'s account is now ${nextStatus.toLowerCase()}. This change is stored only in this browser's mock data.`)
  }

  function createUser(invitation) {
    const duplicateEmail = users.some(
      (user) => user.email.toLowerCase() === invitation.email.toLowerCase(),
    )
    const duplicateUsername = users.some(
      (user) => user.username?.toLowerCase() === invitation.username.toLowerCase(),
    )

    if (duplicateEmail) return 'An account with this work email already exists.'
    if (duplicateUsername) return 'This username is already in use.'

    const createdAt = new Date().toISOString()
    const user = {
      id: `SD-${window.crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      name: `${invitation.firstName} ${invitation.lastName}`,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      email: invitation.email,
      username: invitation.username,
      role: invitation.role,
      department: invitation.department,
      joined: createdAt.slice(0, 10),
      lastLogin: null,
      status: 'Invited',
      requirePasswordChange: invitation.requirePasswordChange,
    }

    setUsers((current) => [user, ...current])
    setGeneratedPasswords((current) => [...current, invitation.password])
    setActivities((current) => [
      {
        title: 'User invitation prepared',
        detail: `${user.name} · Email delivery is unavailable in this preview`,
        time: 'Just now',
        icon: 'users',
      },
      ...current,
    ])
    setNotice(`Created ${user.name} as an invited account. No email was sent because email delivery is not connected.`)
    setStatusFilter('all')
    setSearch('')
    setRoleFilter('All roles')
    setPage(1)
    setCreateOpen(false)
    return ''
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-blue-700">Total users</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-emerald-700">Active users</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-rose-700">Disabled users</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{disabledCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-violet-700">Administrators</p>
          <p className="mt-2 text-2xl font-semibold text-violet-700">{administratorCount}</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 pt-3 sm:px-5">
          <nav aria-label="Filter users by account status" className="flex gap-5">
            {tabOptions.map((tab) => (
              <a
                aria-current={statusFilter === tab.value ? 'page' : undefined}
                className={`border-b-2 px-0.5 pb-3 text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                href={filterHref(tab.value)}
                onClick={(event) => {
                  event.preventDefault()
                  window.history.pushState({}, '', filterHref(tab.value))
                  setStatusFilter(tab.value)
                  setPage(1)
                }}
                key={tab.value}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] text-slate-400">{tab.count}</span>
              </a>
            ))}
          </nav>
          <p className="pb-3 text-[10px] text-slate-400">Mock account records · email delivery not connected</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4 sm:px-5">
          <label className="relative block w-full sm:max-w-[340px]">
            <span className="sr-only">Search users</span>
            <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name, email, role or ID"
              type="search"
              value={search}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Role
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setRoleFilter(event.target.value)
                setPage(1)
              }}
              value={roleFilter}
            >
              <option>All roles</option>
              <option>Administrator</option>
              <option>Employee</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Status
            <select
              aria-label="Filter by status"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="invited">Invited</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Sort
            <select
              aria-label="Sort users"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setSortBy(event.target.value)
                setPage(1)
              }}
              value={sortBy}
            >
              <option value="created-desc">Newest created</option>
              <option value="created-asc">Oldest created</option>
              <option value="name-asc">Name A–Z</option>
              <option value="last-login-desc">Recent login</option>
            </select>
          </label>
          <button
            className="ml-auto h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => {
              setSearch('')
              setRoleFilter('All roles')
              setStatusFilter('all')
              setSortBy('created-desc')
              setPage(1)
              window.history.pushState({}, '', '/admin/users?filter=all')
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>

        {notice && (
          <p aria-live="polite" className="border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-800 sm:px-5" role="status">
            {notice}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                <th className="w-[190px] px-5 py-3">User</th>
                <th className="w-[230px] px-4 py-3">Email</th>
                <th className="w-[120px] px-4 py-3">Role</th>
                <th className="w-[110px] px-4 py-3">Status</th>
                <th className="w-[160px] px-4 py-3">Created at</th>
                <th className="w-[170px] px-4 py-3">Last login</th>
                <th className="w-[160px] px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr className="border-t border-slate-100 hover:bg-slate-50/70" key={user.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700">
                        {user.name.split(' ').map((part) => part[0]).join('')}
                      </span>
                      <span className="min-w-0">
                        <button
                          className="block whitespace-nowrap text-left text-xs font-semibold text-slate-800 hover:text-blue-700 focus-visible:outline-none focus-visible:underline"
                          onClick={() => setSelectedUser(user)}
                          type="button"
                        >
                          {user.name}
                        </button>
                        <span className="mt-0.5 block text-[10px] text-slate-500">{user.id}</span>
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{user.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        user.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800'
                          : user.status === 'Disabled'
                            ? 'bg-rose-50 text-rose-800'
                            : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'Active' ? 'bg-emerald-500' : user.status === 'Disabled' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      {user.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {new Intl.DateTimeFormat('en', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(`${user.joined}T00:00:00Z`))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <button
                      className="mr-2 rounded-md px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => setSelectedUser(user)}
                      type="button"
                    >
                      View details
                    </button>
                    <button
                      className={`rounded-md px-2 py-1.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                        user.status !== 'Disabled'
                          ? 'text-rose-700 hover:bg-rose-50'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                      onClick={() => toggleStatus(user.id)}
                      type="button"
                    >
                      {user.status === 'Disabled' ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
              {visibleUsers.length === 0 && (
                <tr>
                  <td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={7}>
                    No users match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
          <p aria-live="polite" className="text-[11px] text-slate-500">
            {sortedUsers.length === 0
              ? 'No matching accounts'
              : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, sortedUsers.length)} of ${sortedUsers.length} accounts`}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <span className="px-1 text-[11px] text-slate-500">
              Page {currentPage} of {pageCount}
            </span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage >= pageCount}
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent account activity</h2>
            <p className="mt-1 text-xs text-slate-500">A preview of relevant account and security events.</p>
          </div>
          <Icon className="h-5 w-5 text-slate-400" name="activity" />
        </div>
        <div className="divide-y divide-slate-100">
          {activities.slice(0, 4).map((activity, index) => (
            <div className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0" key={`${activity.title}-${activity.time}-${index}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="h-5 w-5" name={activity.icon} />
              </span>
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-slate-800">{activity.title}</p>
                <p className="mt-1 text-xs text-slate-500">{activity.detail}</p>
              </div>
              <p className="ml-auto text-xs text-slate-500">{activity.time}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
          Illustrative account activity only · not connected to an audit service.
        </p>
      </section>
      <p className="text-[10px] leading-5 text-slate-400">
        Preview only: mock account changes stay in this browser and are not sent to a backend. Email invitations are not delivered.
      </p>
      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          onCreate={createUser}
          passwords={temporaryPasswords}
        />
      )}
      {selectedUser && (
        <UserDetailsModal
          onClose={() => setSelectedUser(null)}
          onToggleStatus={toggleStatus}
          user={selectedUser}
        />
      )}
    </div>
  )
}

function formatDocumentDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  }).format(new Date(value))
}

function DocumentFileIcon({ document, className = 'h-8 w-8' }) {
  return (
    <svg aria-hidden="true" className={`shrink-0 ${className}`} viewBox="0 0 28 32">
      <path
        d="M4 1.5h13l7 7V28a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 4 28V4a2.5 2.5 0 0 1 2.5-2.5Z"
        fill={document.iconColor}
      />
      <path d="M17 1.5v6a1 1 0 0 0 1 1h6" fill="white" fillOpacity=".35" />
      <text
        fill="white"
        fontFamily="Arial, sans-serif"
        fontSize={document.fileType.length > 3 ? '5.2' : '6.2'}
        fontWeight="700"
        textAnchor="middle"
        x="14"
        y="21"
      >
        {document.fileType}
      </text>
    </svg>
  )
}

function DocumentMetric({ label, value, icon, tone }) {
  return (
    <div className="flex min-h-[70px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-5 w-5" name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-semibold leading-tight text-slate-900">{value}</p>
      </div>
    </div>
  )
}

function PermissionRows({ document }) {
  const permissionUsers = [
    { name: 'John Smith', email: 'john.smith@company.com', level: 'Read', by: document.owner },
    { name: 'Priya Sharma', email: 'priya.sharma@company.com', level: 'Read / download', by: document.owner },
    { name: 'Alex Morgan', email: 'alex.morgan@company.com', level: 'Read', by: 'Administrator' },
  ].slice(0, Math.min(document.activeGrants, 3))

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 min-[500px]:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" name="users" />
          </span>
          <div>
            <p className="text-[10px] text-slate-500">Total Active Grants</p>
            <p className="text-base font-semibold text-slate-900">{document.activeGrants}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Icon className="h-4 w-4" name="revoked" />
          </span>
          <div>
            <p className="text-[10px] text-slate-500">Total Revoked Grants</p>
            <p className="text-base font-semibold text-slate-900">{document.revokedGrants}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead className="bg-slate-50">
            <tr className="text-[10px] font-semibold text-slate-600">
              <th className="px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Permission level</th>
              <th className="px-3 py-2.5">Granted by</th>
              <th className="px-3 py-2.5">Granted at</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {permissionUsers.length > 0 ? permissionUsers.map((user, index) => (
              <tr className="border-t border-slate-100" key={user.email}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[9px] font-semibold text-white">
                      {user.name.split(' ').map((part) => part[0]).join('')}
                    </span>
                    <span>
                      <span className="block text-[10px] font-semibold text-slate-800">{user.name}</span>
                      <span className="block text-[9px] text-slate-500">{user.email}</span>
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-[9px] font-medium text-blue-700">{user.level}</span>
                </td>
                <td className="px-3 py-3 text-[10px] text-slate-600">{user.by}</td>
                <td className="px-3 py-3 text-[10px] text-slate-500">{formatDocumentDate(document.uploadedAt, true)}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-semibold text-emerald-800">{index === 2 ? 'Revoked' : 'Active'}</span>
                </td>
              </tr>
            )) : (
              <tr>
                <td className="px-3 py-8 text-center text-xs text-slate-500" colSpan={5}>
                  No active permission grants for this document.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 p-3">
        <h3 className="text-[11px] font-semibold text-slate-800">Additional Permission Information</h3>
        <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-slate-500">
          <li>• Only authorized users can be granted or have their permissions revoked.</li>
          <li>• Changing a user&apos;s role does not automatically grant access to confidential documents.</li>
          <li>• View-only access to permission information does not provide administrative rights to modify permissions.</li>
        </ul>
      </div>
    </div>
  )
}

function DocumentDetails({ document, onClose }) {
  const [tab, setTab] = useState('permissions')
  const tabs = [
    { id: 'permissions', label: 'Permissions', icon: 'users' },
    { id: 'activity', label: 'Audit Activity', icon: 'clock' },
    { id: 'history', label: 'History', icon: 'history' },
  ]
  const metadata = [
    ['Owner', document.owner],
    ['Category', document.category],
    ['Description', document.description],
    ['File Type', document.fileType],
    ['File Size', `${document.fileSize} (${document.fileType === 'PDF' ? '250,880' : '1,258,291'} bytes)`],
    ['Upload Date', formatDocumentDate(document.uploadedAt, true)],
    ['Last Modified', formatDocumentDate(document.modifiedAt, true)],
    ['Status', document.status],
    ['Active Permission Grants', String(document.activeGrants)],
  ]

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <button
            aria-label="Back to document registry"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="text-xl leading-none">‹</span>
          </button>
          <h2 className="text-base font-semibold text-slate-800">Document Details</h2>
        </div>
        <button
          aria-label="Close document details"
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          onClick={onClose}
          type="button"
        >
          <Icon className="h-4 w-4" name="close" />
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(330px,0.72fr)_minmax(0,1.28fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
            <DocumentFileIcon className="h-10 w-10" document={document} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{document.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${document.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  {document.status}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Document ID: {document.id}</p>
            </div>
          </div>

          <h3 className="mb-2 mt-3 text-[11px] font-semibold text-slate-800">Document Metadata</h3>
          <dl className="space-y-2">
            {metadata.map(([label, value]) => (
              <div className="grid grid-cols-[105px_1fr] gap-2 text-[10px] leading-4" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className={`break-words ${label === 'Status' && value === 'Active' ? 'font-semibold text-emerald-700' : 'text-slate-700'}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-[10px] leading-4 text-slate-600">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" name="info" />
            <p>This is a metadata view only. File contents cannot be previewed or downloaded from the administrator interface.</p>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
          <div aria-label="Document details sections" className="flex gap-2 border-b border-slate-200">
            {tabs.map((item) => (
              <button
                aria-selected={tab === item.id}
                className={`inline-flex items-center gap-2 border-b-2 px-2.5 py-2.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  tab === item.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                <Icon className="h-3.5 w-3.5" name={item.icon} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-3" role="tabpanel">
            {tab === 'permissions' ? (
              <>
                <h3 className="text-xs font-semibold text-slate-800">Permissions</h3>
                <p className="mt-1 text-[10px] text-slate-500">People who have been granted access to this document.</p>
                <div className="mt-3">
                  <PermissionRows document={document} />
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xs font-semibold text-slate-800">
                  {tab === 'activity' ? 'Audit Activity' : 'Document History'}
                </h3>
                <p className="mt-1 text-[10px] text-slate-500">
                  {tab === 'activity'
                    ? 'Recorded access and permission events for this document.'
                    : 'Changes and lifecycle events recorded for this document.'}
                </p>
                <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {initialDocumentActivity.map((event) => (
                    <div className="flex items-start gap-3 p-3" key={`${event.title}-${event.time}`}>
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${event.result === 'Allowed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        <Icon className="h-3.5 w-3.5" name={event.result === 'Allowed' ? 'check' : 'history'} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-slate-800">{event.title}</p>
                        <p className="mt-1 text-[9px] text-slate-500">{event.user} · {document.name}</p>
                      </div>
                      <p className="text-right text-[9px] text-slate-400">{event.time}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <p className="mt-3 border-t border-slate-100 pt-2 text-[9px] text-slate-400">
            Mock document metadata and activity · not connected to a backend.
          </p>
        </section>
      </div>
    </div>
  )
}

function DocumentRegistry({ initialDocumentId, onOpenDocument, onCloseDocument }) {
  const [documents] = useState(makeMockDocuments)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('All Owners')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [dateFilter, setDateFilter] = useState('All Dates')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [page, setPage] = useState(1)
  const pageSize = 5
  const selectedDocument = documents.find((document) => document.id === initialDocumentId)
  const matchingDocuments = documents.filter((document) => {
    const searchMatches =
      !search.trim() ||
      [document.name, document.id, document.owner, document.category]
        .some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))
    const ownerMatches = ownerFilter === 'All Owners' || document.owner === ownerFilter
    const categoryMatches =
      categoryFilter === 'All Categories' || document.category === categoryFilter
    const statusMatches =
      statusFilter === 'All Statuses' || document.status === statusFilter
    const dateMatches =
      dateFilter === 'All Dates' ||
      documentReferenceTime - new Date(document.uploadedAt).getTime() <=
        Number(dateFilter) * 24 * 60 * 60 * 1000

    return searchMatches && ownerMatches && categoryMatches && statusMatches && dateMatches
  })
  const visibleDocuments = matchingDocuments.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(matchingDocuments.length / pageSize))
  const activeGrants = '2,840'

  if (selectedDocument) {
    return <DocumentDetails document={selectedDocument} onClose={onCloseDocument} />
  }

  return (
    <div className="space-y-3">
      <header className="mb-1">
        <h2 className="text-xl font-semibold tracking-tight text-[#132c4f]">Document Registry</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Organization-wide document inventory. Search, filter, and view document metadata, permissions, and activity.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <DocumentMetric label="Total Documents" value="1,248" icon="documents" tone="bg-blue-50 text-blue-600" />
        <DocumentMetric label="Active Documents" value="1,196" icon="check" tone="bg-emerald-50 text-emerald-600" />
        <DocumentMetric label="Deleted Records" value="52" icon="revoked" tone="bg-rose-50 text-rose-600" />
        <DocumentMetric label="Active Grants" value={activeGrants} icon="users" tone="bg-violet-50 text-violet-600" />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <label className="relative block min-w-[190px] flex-1">
            <span className="sr-only">Search by document name or ID</span>
            <Icon className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" name="search" />
            <input
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[10px] outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search by document name or ID..."
              type="search"
              value={search}
            />
          </label>
          {[
            {
              label: 'Owner',
              value: ownerFilter,
              options: ['All Owners', ...documentOwners],
              change: (value) => {
                setOwnerFilter(value)
                setPage(1)
              },
            },
            {
              label: 'Category',
              value: categoryFilter,
              options: ['All Categories', ...new Set(documentCategories)],
              change: (value) => {
                setCategoryFilter(value)
                setPage(1)
              },
            },
            {
              label: 'Upload Date',
              value: dateFilter,
              options: ['All Dates', 'Last 7 days', 'Last 30 days', 'Last 90 days'],
              values: ['All Dates', '7', '30', '90'],
              change: (value) => {
                setDateFilter(value)
                setPage(1)
              },
            },
            {
              label: 'Status',
              value: statusFilter,
              options: ['All Statuses', 'Active', 'Deleted'],
              change: (value) => {
                setStatusFilter(value)
                setPage(1)
              },
            },
          ].map((filter) => (
            <label className="flex items-center gap-1 text-[9px] text-slate-500" key={filter.label}>
              <span className="hidden sm:inline">{filter.label}</span>
              <select
                aria-label={filter.label}
                className="h-8 max-w-[132px] rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => filter.change(event.target.value)}
                value={filter.value}
              >
                {filter.options.map((option, index) => (
                  <option
                    key={option}
                    value={filter.values ? filter.values[index] : option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            className="ml-auto h-8 rounded-md border border-slate-200 px-3 text-[10px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => {
              setSearch('')
              setOwnerFilter('All Owners')
              setCategoryFilter('All Categories')
              setDateFilter('All Dates')
              setStatusFilter('All Statuses')
              setPage(1)
            }}
            type="button"
          >
            Clear Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] table-fixed border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[9px] font-semibold text-slate-600">
                <th className="w-8 px-2 py-2.5">
                  <span className="sr-only">Select</span>
                  <input aria-label="Select all visible documents" type="checkbox" />
                </th>
                <th className="w-[145px] px-2 py-2.5">Document Name</th>
                <th className="w-[80px] px-2 py-2.5">Document ID</th>
                <th className="w-[90px] px-2 py-2.5">Owner</th>
                <th className="w-[58px] px-2 py-2.5">Category</th>
                <th className="w-[98px] px-1 py-2.5">Upload Date</th>
                <th className="w-[98px] px-1 py-2.5">Last Modified</th>
                <th className="w-[78px] px-1 py-2.5">File Type &amp; Size</th>
                <th className="w-[58px] px-1 py-2.5">Status</th>
                <th className="w-[66px] px-1 py-2.5 text-center">Active Grants</th>
                <th className="w-[50px] px-2 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((document) => (
                <tr
                  className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/50 focus-within:bg-blue-50/50"
                  key={document.id}
                  onClick={() => onOpenDocument(document.id)}
                >
                  <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                    <input aria-label={`Select ${document.name}`} type="checkbox" />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      className="flex items-center gap-2 text-left focus-visible:outline-none focus-visible:underline"
                      onClick={() => onOpenDocument(document.id)}
                      type="button"
                    >
                      <DocumentFileIcon className="h-7 w-7 rounded-sm" document={document} />
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap text-[10px] font-semibold text-slate-800">{document.name}</span>
                        <span className="mt-0.5 block text-[8px] text-slate-400">{document.id}</span>
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-[8px] text-slate-500">{document.id}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">
                    <span className="flex items-center gap-1 text-[8px] text-slate-600">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[6px] font-semibold text-white">
                        {document.owner.split(' ').map((part) => part[0]).join('')}
                      </span>
                      {document.owner}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-[8px] text-slate-600">{document.category}</td>
                  <td className="whitespace-nowrap px-1 py-2.5 text-[8px] text-slate-600">
                    {formatDocumentDate(document.uploadedAt, true)}
                  </td>
                  <td className="whitespace-nowrap px-1 py-2.5 text-[8px] text-slate-600">
                    {formatDocumentDate(document.modifiedAt, true)}
                  </td>
                  <td className="whitespace-nowrap px-1 py-2.5 text-[8px] text-slate-600">
                    {document.fileType} · {document.fileSize}
                  </td>
                  <td className="px-1 py-2.5">
                    <span className={`rounded-full px-2 py-1 text-[8px] font-semibold ${document.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {document.status}
                    </span>
                  </td>
                  <td className="px-1 py-2.5 text-center text-[8px] text-slate-700">{document.activeGrants}</td>
                  <td className="px-2 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <button
                      aria-label={`View details for ${document.name}`}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => onOpenDocument(document.id)}
                      type="button"
                    >
                      <Icon className="h-4 w-4" name="more" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleDocuments.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-xs text-slate-500" colSpan={11}>
                    No documents match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-2.5">
          <p className="text-[9px] text-slate-500">
            {matchingDocuments.length
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matchingDocuments.length)} of ${matchingDocuments.length.toLocaleString()} documents`
              : 'No matching documents'}
          </p>
          <div className="flex items-center gap-1">
            <button
              aria-label="Previous page"
              className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              ‹
            </button>
            <span className="rounded bg-blue-600 px-2.5 py-1 text-[9px] font-semibold text-white">{page}</span>
            <span className="px-1 text-[9px] text-slate-500">of {totalPages}</span>
            <button
              aria-label="Next page"
              className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              type="button"
            >
              ›
            </button>
          </div>
        </div>
      </section>
      <p className="text-[9px] text-slate-400">
        Illustrative document registry · mock data only, not connected to document storage.
      </p>
    </div>
  )
}

function permissionDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : {}),
    timeZone: 'UTC',
  }).format(new Date(value)) + (includeTime ? ' UTC' : '')
}

function PersonBadge({ name, color = 'bg-slate-500' }) {
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2)
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color} text-[8px] font-semibold text-white`}>
      {initials}
    </span>
  )
}

function PermissionFileIcon({ name }) {
  const fileType = /financial|quarterly/i.test(name)
    ? 'spreadsheet'
    : /plan|deck|design/i.test(name)
      ? 'presentation'
      : 'pdf'
  const color = fileType === 'spreadsheet'
    ? 'bg-emerald-600'
    : fileType === 'presentation'
      ? 'bg-blue-500'
      : 'bg-red-600'
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${color} text-white`}>
      <Icon className="h-3.5 w-3.5" name={fileType === 'spreadsheet' ? 'fileSpreadsheet' : fileType === 'presentation' ? 'filePresentation' : 'pdf'} />
    </span>
  )
}

function PermissionStatus({ status }) {
  const style = status === 'Active'
    ? 'bg-emerald-100 text-emerald-800'
    : status === 'Revoked'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-amber-100 text-amber-800'
  return <span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-semibold ${style}`}>{status}</span>
}

function PermissionsManagement({ initialPermissionId, onOpenPermission, onClosePermission }) {
  const emptyFilters = {
    search: '',
    owner: 'all',
    user: 'all',
    type: 'all',
    status: 'all',
    grantFrom: '',
    expiresFrom: '',
  }
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState({})
  const [owners, setOwners] = useState([])
  const [users, setUsers] = useState([])
  const [loadedRequestKey, setLoadedRequestKey] = useState('')
  const [requestFailure, setRequestFailure] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const requestKey = [page, pageSize, JSON.stringify(filters), reloadKey].join('|')

  useEffect(() => {
    const controller = new AbortController()
    const currentRequestKey = [page, pageSize, JSON.stringify(filters), reloadKey].join('|')
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.search.trim()) params.set('search', filters.search.trim())
    if (filters.owner !== 'all') params.set('owner_id', filters.owner)
    if (filters.user !== 'all') params.set('user_id', filters.user)
    if (filters.type !== 'all') params.set('permission_type', filters.type)
    if (filters.status !== 'all') params.set('permission_status', filters.status)
    if (filters.grantFrom) params.set('grant_from', filters.grantFrom)
    if (filters.expiresFrom) params.set('expires_from', filters.expiresFrom)
    apiGet('/api/admin/permissions/records?' + params.toString(), { signal: controller.signal })
      .then((response) => {
        setRecords(response.items || [])
        setTotal(response.total || 0)
        setSummary(response.summary || {})
        setOwners(response.owners || [])
        setUsers(response.users || [])
        setRequestFailure(null)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setRequestFailure({ key: currentRequestKey, message: error.message || 'Unable to load permission records.' })
      })
      .finally(() => { if (!controller.signal.aborted) setLoadedRequestKey(currentRequestKey) })
    return () => controller.abort()
  }, [filters, page, pageSize, reloadKey])

  const loading = loadedRequestKey !== requestKey
  const loadError = requestFailure?.key === requestKey ? requestFailure.message : ''
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  function updateFilter(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }))
  }
  function applyFilters(event) {
    event.preventDefault()
    setFilters({ ...draftFilters })
    setPage(1)
  }
  function clearFilters() {
    setDraftFilters({ ...emptyFilters })
    setFilters({ ...emptyFilters })
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Permissions Overview</h1>
        <p className="mt-1 text-xs text-slate-500">View who has access to each document, the permission type, and the current status.</p>
      </div>
      <section aria-label="Permission summary" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Active Grants', value: summary.active_grants, detail: 'Currently valid permissions', icon: 'grant', style: 'border-emerald-100 bg-emerald-50/70 text-emerald-700', bubble: 'bg-emerald-100' },
          { label: 'Read-only Permissions', value: summary.read_permissions, detail: 'Active read access without download', icon: 'documents', style: 'border-blue-100 bg-blue-50/70 text-blue-700', bubble: 'bg-blue-100' },
          { label: 'Download Permissions', value: summary.download_permissions, detail: 'Active grants with download access', icon: 'activity', style: 'border-violet-100 bg-violet-50/70 text-violet-700', bubble: 'bg-violet-100' },
          { label: 'Revoked Grants', value: summary.revoked_grants, detail: 'Historical revoked permission records', icon: 'revoked', style: 'border-rose-100 bg-rose-50/70 text-rose-700', bubble: 'bg-rose-100' },
        ].map((metric) => (
          <article className={'flex min-h-[88px] items-center gap-3 rounded-lg border p-3 ' + metric.style} key={metric.label}>
            <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full ' + metric.bubble}><Icon className="h-5 w-5" name={metric.icon} /></span>
            <div className="min-w-0"><p className="text-[10px] font-semibold">{metric.label}</p><p className="mt-1 text-[23px] font-semibold leading-none tracking-tight text-slate-900">{Number(metric.value || 0).toLocaleString()}</p><p className="mt-1 text-[9px] text-slate-500">{metric.detail}</p></div>
          </article>
        ))}
      </section>

      <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" onSubmit={applyFilters}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search permission records</span><Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" /><input className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[10px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search by document, owner, or user..." type="search" value={draftFilters.search} /></label>
          <button className="h-9 rounded-md bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700" type="submit">Apply Filters</button>
          <button className="h-9 rounded-md border border-slate-200 bg-white px-4 text-[10px] font-medium text-slate-600 hover:bg-slate-50" onClick={clearFilters} type="button">Clear Filters</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 min-[720px]:grid-cols-3 xl:grid-cols-6">
          {[
            { name: 'owner', label: 'Document Owner', options: owners, placeholder: 'All Owners' },
            { name: 'user', label: 'User with Access', options: users, placeholder: 'All Users' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}><span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span><select aria-label={filter.label} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700" onChange={(event) => updateFilter(filter.name, event.target.value)} value={draftFilters[filter.name]}><option value="all">{filter.placeholder}</option>{filter.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          ))}
          {[
            { name: 'type', label: 'Permission Type', options: ['Read', 'Read + Download'], placeholder: 'All Types' },
            { name: 'status', label: 'Permission Status', options: ['Active', 'Revoked', 'Expired'], placeholder: 'All Statuses' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}><span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span><select aria-label={filter.label} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700" onChange={(event) => updateFilter(filter.name, event.target.value)} value={draftFilters[filter.name]}><option value="all">{filter.placeholder}</option>{filter.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          ))}
          {[
            { name: 'grantFrom', label: 'Grant Date' },
            { name: 'expiresFrom', label: 'Expiration Date' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}><span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span><input aria-label={filter.label} className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-700" onChange={(event) => updateFilter(filter.name, event.target.value)} type="date" value={draftFilters[filter.name]} /></label>
          ))}
        </div>
      </form>

      {loadError && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800" role="alert"><span>{loadError}</span><button className="rounded-md bg-white px-3 py-1.5 font-semibold ring-1 ring-rose-200 hover:bg-rose-100" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div>}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5"><div><h2 className="text-sm font-semibold text-slate-800">Permission Records</h2><p aria-live="polite" className="mt-0.5 text-[9px] text-slate-500">{loading ? 'Loading permission records?' : 'Showing ' + (total ? ((page - 1) * pageSize + 1) + '?' + Math.min(page * pageSize, total) : '0') + ' of ' + total.toLocaleString() + ' permission grants'}</p></div>
          <label className="flex items-center gap-2 text-[9px] text-slate-500"><span className="sr-only">Records per page</span><select aria-label="Permission records per page" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-600" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} value={pageSize}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}</select></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] border-collapse text-left"><thead className="bg-slate-50"><tr className="text-[9px] font-semibold text-slate-600"><th className="px-2 py-2">Document</th><th className="px-2 py-2">Document Owner</th><th className="px-2 py-2">User with Access</th><th className="px-2 py-2">Permission</th><th className="px-2 py-2">Granted By</th><th className="px-2 py-2">Granted At</th><th className="px-2 py-2">Expires At</th><th className="px-2 py-2">Status</th><th className="w-10 px-2 py-2 text-center">Actions</th></tr></thead>
          <tbody>
            {!loading && records.map((record) => (
              <tr className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/40 focus-visible:bg-blue-50/50 focus-visible:outline-none" key={record.id} onClick={() => onOpenPermission(record.document_id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenPermission(record.document_id) } }} tabIndex={0}>
                <td className="px-2 py-2"><div className="flex min-w-[120px] items-center gap-2"><PermissionFileIcon name={record.document_filename || record.document_title} /><span className="min-w-0"><span className="block truncate text-[9px] font-medium text-slate-700">{record.document_title}</span><span className="block truncate text-[8px] text-slate-500">{record.document_id}</span></span></div></td>
                <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge name={record.owner_name} />{record.owner_name}</span></td>
                <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge color="bg-blue-600" name={record.user_name} />{record.user_name}</span><span className="ml-7 block text-[8px] text-slate-500">{record.user_email}</span></td>
                <td className="px-2 py-2"><span className={'rounded-md px-2 py-1 text-[9px] font-semibold ' + (record.can_download ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700')}>{record.permission_type}</span></td>
                <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge name={record.granted_by_name} />{record.granted_by_name}</span></td>
                <td className="whitespace-nowrap px-2 py-2 text-[9px] text-slate-600">{permissionDate(record.granted_at, true)}</td><td className="whitespace-nowrap px-2 py-2 text-[9px] text-slate-600">{permissionDate(record.expires_at)}</td><td className="px-2 py-2"><PermissionStatus status={record.status} /></td>
                <td className="px-2 py-2 text-center"><button aria-label={'View document permission details for ' + record.document_title} className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={(event) => { event.stopPropagation(); onOpenPermission(record.document_id) }} type="button"><Icon className="h-4 w-4" name="more" /></button></td>
              </tr>
            ))}
            {!loading && records.length === 0 && <tr><td className="px-3 py-10 text-center text-xs text-slate-500" colSpan={9}>{loadError ? 'Permission records are unavailable.' : 'No permission records match these filters.'}</td></tr>}
            {loading && <tr><td className="px-3 py-10 text-center text-xs text-slate-500" colSpan={9}>Loading permission records?</td></tr>}
          </tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2"><p className="text-[9px] text-slate-500">{loading ? '' : total ? 'Showing ' + ((page - 1) * pageSize + 1) + '?' + Math.min(page * pageSize, total) + ' of ' + total.toLocaleString() + ' permission grants' : 'No matching permission grants'}</p>
          <div className="flex items-center gap-1"><button aria-label="Previous page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">?</button><span className="rounded bg-blue-600 px-2.5 py-1 text-[9px] font-semibold text-white">{page}</span><span className="px-1 text-[9px] text-slate-500">of {pageCount}</span><button aria-label="Next page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={loading || page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">?</button></div>
        </div>
      </section>
      {initialPermissionId && <AdminPermissionDocumentModal documentId={initialPermissionId} onClose={onClosePermission} />}
    </div>
  )
}

function AuditLogs({ initialEventId, onOpenEvent, onCloseEvent }) {
  return <AdminAuditLogs initialEventId={initialEventId} onCloseEvent={onCloseEvent} onOpenEvent={onOpenEvent} />
}
function SecurityMonitoring({ search }) {
  return <AdminSecurityMonitoring search={search} />
}

function SectionPlaceholder({ pathname }) {
  const section =
    sectionDetails[Object.keys(sectionDetails).find((path) => pathname.startsWith(path))]
  const filter = new URLSearchParams(window.location.search).get('filter')
  const description = section.filters
    ? section.filters[filter] ?? section.description
    : section.description

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon name={navItems.find((item) => pathname.startsWith(item.href) && item.href !== '/admin')?.icon ?? 'dashboard'} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">{section.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <p className="mt-5 max-w-2xl rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
        This page is a placeholder. No additional reporting or settings actions are available yet.
      </p>
      {pathname.startsWith('/admin/reports') && (
        <a className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900" href="/admin/security">
          Open Security Monitoring <Icon className="h-4 w-4" name="arrow" />
        </a>
      )}
      <a className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900" href="/admin">
        Back to dashboard <Icon className="h-4 w-4" name="arrow" />
      </a>
    </section>
  )
}

export default function AdminDashboard({ user }) {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/admin'
  const isDashboard = pathname === '/admin' || pathname === '/admin/index.html'
  const isUserManagement = pathname.startsWith('/admin/users')
  const isDocuments = pathname.startsWith('/admin/documents')
  const isPermissions = pathname.startsWith('/admin/permissions')
  const isAudit = pathname.startsWith('/admin/audit')
  const isSecurity = pathname.startsWith('/admin/security')
  const [createOpen, setCreateOpen] = useState(false)
  const [createdNotice, setCreatedNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [securitySearch, setSecuritySearch] = useState('')

  async function handleCreateUser(invitation) {
    try {
      const payload = {
        first_name: invitation.firstName,
        last_name: invitation.lastName,
        email: invitation.email,
        role: invitation.role === 'Administrator' ? 'ADMIN' : 'EMPLOYEE',
        department: invitation.department,
        username: invitation.username,
        password: invitation.password,
        require_password_change: invitation.requirePasswordChange,
      }
      await apiPost('/api/admin/users', payload)
      setCreatedNotice(`Created ${invitation.firstName} ${invitation.lastName} as an invited account.`)
      setCreateOpen(false)
      setRefreshKey((k) => k + 1)
      return ''
    } catch (requestError) {
      return requestError.message || 'Failed to create user.'
    }
  }
  const [selectedDocumentId, setSelectedDocumentId] = useState(() => {
    const match = window.location.pathname.match(/^\/admin\/documents\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : null
  })
  const [selectedPermissionId, setSelectedPermissionId] = useState(() => {
    const match = window.location.pathname.match(/^\/admin\/permissions\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : null
  })
  const [selectedAuditEventId, setSelectedAuditEventId] = useState(() => {
    const match = window.location.pathname.match(/^\/admin\/audit\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : null
  })
  const title = isDashboard
    ? 'Administrator Dashboard'
    : sectionDetails[Object.keys(sectionDetails).find((path) => pathname.startsWith(path))]?.title ??
      'Administrator dashboard'

  useEffect(() => {
    const pageTitle = isDocuments && selectedDocumentId
      ? 'Document Details'
      : isPermissions && selectedPermissionId
        ? 'Permission Details'
        : isAudit && selectedAuditEventId
          ? 'Event Details'
        : title
    document.title = `${pageTitle} | SureDocs`
  }, [isDocuments, isPermissions, isAudit, selectedDocumentId, selectedPermissionId, selectedAuditEventId, title])

  useEffect(() => {
    function syncDetailRoutes() {
      const documentMatch = window.location.pathname.match(/^\/admin\/documents\/([^/]+)$/)
      const permissionMatch = window.location.pathname.match(/^\/admin\/permissions\/([^/]+)$/)
      const auditMatch = window.location.pathname.match(/^\/admin\/audit\/([^/]+)$/)
      setSelectedDocumentId(documentMatch ? decodeURIComponent(documentMatch[1]) : null)
      setSelectedPermissionId(permissionMatch ? decodeURIComponent(permissionMatch[1]) : null)
      setSelectedAuditEventId(auditMatch ? decodeURIComponent(auditMatch[1]) : null)
    }

    window.addEventListener('popstate', syncDetailRoutes)
    return () => window.removeEventListener('popstate', syncDetailRoutes)
  }, [setSelectedAuditEventId, setSelectedDocumentId, setSelectedPermissionId])

  const openDocument = useCallback((documentId) => {
    window.history.pushState({}, '', `/admin/documents/${encodeURIComponent(documentId)}${window.location.search}`)
    setSelectedDocumentId(documentId)
    window.scrollTo({ top: 0 })
  }, [setSelectedDocumentId])

  const closeDocument = useCallback(() => {
    window.history.pushState({}, '', `/admin/documents${window.location.search}`)
    setSelectedDocumentId(null)
    window.scrollTo({ top: 0 })
  }, [setSelectedDocumentId])

  function openPermission(permissionId) {
    window.history.pushState({}, '', `/admin/permissions/${encodeURIComponent(permissionId)}`)
    setSelectedPermissionId(permissionId)
  }

  function closePermission() {
    window.history.pushState({}, '', '/admin/permissions')
    setSelectedPermissionId(null)
  }

  function openAuditEvent(eventId) {
    window.history.pushState({}, '', `/admin/audit/${encodeURIComponent(eventId)}`)
    setSelectedAuditEventId(eventId)
  }

  function closeAuditEvent() {
    window.history.pushState({}, '', '/admin/audit')
    setSelectedAuditEventId(null)
  }

  return (
    <div className={`admin-app${isDashboard ? ' admin-app-home' : ''}${isUserManagement ? ' admin-app-user-management' : ''}${isSecurity ? ' admin-app-security' : ''}`}>
      {mobileNavOpen && <button aria-label="Close navigation menu" className="admin-mobile-scrim" onClick={() => setMobileNavOpen(false)} type="button" />}
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} pathname={pathname} user={user} />
      <div className="admin-page-column">
        {!isDashboard && <TopBar onMenuClick={() => setMobileNavOpen(true)} user={user} userManagement={isUserManagement} securityMonitoring={isSecurity} securitySearch={securitySearch} onSecuritySearch={setSecuritySearch} />}
        <main className={`${isDashboard ? 'admin-dashboard-main' : 'admin-content'}${isUserManagement ? ' admin-user-page' : ''}`}>
          {!isDashboard && !isDocuments && !isPermissions && !isAudit && !isSecurity && <div className={`mb-5 flex flex-wrap items-end justify-between gap-3${isUserManagement ? ' admin-user-heading' : ''}`}>
            <div>
              {!isUserManagement && (
                <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-blue-700">
                  SureDocs management console
                </p>
              )}
              <h1 className={`${isUserManagement ? 'text-2xl sm:text-[26px]' : 'mt-1 text-[22px]'} font-semibold tracking-tight text-slate-900`}>
                {isUserManagement ? 'User Management' : title}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {isDashboard
                  ? 'Overview of users, documents, permissions, and security activity.'
                  : isUserManagement
                    ? 'Manage users, roles and access to the platform.'
                    : 'Administrator workspace'}
              </p>
            </div>
            {isUserManagement && (
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200${isUserManagement ? ' admin-create-invite-button' : ''}`}
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                {isUserManagement ? 'Create / Invite' : 'Create / Invite User'}
              </button>
            )}
          </div>}
          {createdNotice && (
            <div className={`mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800${isUserManagement ? ' admin-user-notice' : ''}`} role="status">
              <span>{createdNotice}</span>
              <button
                aria-label="Dismiss notice"
                className="font-bold text-emerald-700 hover:text-emerald-900"
                onClick={() => setCreatedNotice('')}
                type="button"
              >
                ×
              </button>
            </div>
          )}
          {isDashboard ? (
            <DashboardContent onMenuClick={() => setMobileNavOpen(true)} />
          ) : isUserManagement ? (
            <AdminUsersPage
              initialFilter={
                new URLSearchParams(window.location.search).get('filter') ?? 'all'
              }
              refreshKey={refreshKey}
            />
          ) : isDocuments ? (
            <AdminDocumentsWorkspace
              initialDocumentId={selectedDocumentId}
              onCloseDocument={closeDocument}
              onOpenDocument={openDocument}
            />
          ) : isPermissions ? (
            <PermissionsManagement
              initialPermissionId={selectedPermissionId}
              onClosePermission={closePermission}
              onOpenPermission={openPermission}
            />
          ) : isAudit ? (
            <AuditLogs
              initialEventId={selectedAuditEventId}
              onCloseEvent={closeAuditEvent}
              onOpenEvent={openAuditEvent}
            />
          ) : isSecurity ? (
            <SecurityMonitoring search={securitySearch} />
          ) : (
            <SectionPlaceholder pathname={pathname} />
          )}
          {createOpen && (
            <CreateUserModal
              onClose={() => setCreateOpen(false)}
              onCreate={handleCreateUser}
              passwords={[]}
            />
          )}
        </main>
      </div>
    </div>
  )
}

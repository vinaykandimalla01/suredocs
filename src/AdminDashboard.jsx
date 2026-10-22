import { useEffect, useState } from 'react'
import { apiGet, apiPost } from './api.js'
import DocumentsWorkspace from './DocumentsWorkspace.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'
import UserAvatar from './UserAvatar.jsx'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
  { label: 'User management', href: '/admin/users', icon: 'users' },
  { label: 'Documents', href: '/admin/documents', icon: 'documents' },
  { label: 'Permissions', href: '/admin/permissions', icon: 'permissions' },
  { label: 'Audit logs', href: '/admin/audit', icon: 'audit' },
  { label: 'Security monitoring', href: '/admin/security', icon: 'security' },
]

const auditEvents = [
  { event: 'Document download', actor: 'User 086', result: 'Allowed', time: '09:51' },
  { event: 'Permission revoked', actor: 'User 021', result: 'Recorded', time: '10:15' },
  { event: 'Document access', actor: 'User 104', result: 'Denied', time: '10:42' },
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

const rangeOptions = [
  { value: 'today', label: 'Today', count: 12 },
  { value: '10', label: 'Last 10 days', count: 10 },
  { value: '30', label: 'Last 30 days', count: 30 },
  { value: '90', label: 'Last 90 days', count: 90 },
]

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
    <div className="flex items-center gap-3 px-5 py-6">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
        S
      </span>
      <span className="text-lg font-bold tracking-tight text-white">SureDocs</span>
    </div>
  )
}

function Sidebar({ pathname }) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-[#10192c] text-slate-300 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[248px]">
      <BrandMark />
      <p className="px-5 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Management console
      </p>
      <nav aria-label="Administrator navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
        {navItems.map((item) => {
          const selected =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)

          return (
            <a
              aria-current={selected ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                selected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon className="h-[17px] w-[17px]" name={item.icon} />
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="mt-auto border-t border-slate-800 px-3 py-3">
        <a
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          href="/"
        >
          <Icon className="h-[17px] w-[17px]" name="security" />
          Sign out
        </a>
      </div>
    </aside>
  )
}

function TopBar({ user }) {
  const displayName = user?.full_name || 'Administrator'
  const displayRole = user?.job_title || (user?.role === 'ADMIN' ? 'Administrator' : 'Employee')

  return (
    <header className="flex h-[68px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
      <div className="relative hidden w-full max-w-[330px] sm:block">
        <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
        <input
          aria-label="Search dashboard"
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="Search"
          type="search"
        />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <button
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          type="button"
        >
          <Icon className="h-5 w-5" name="bell" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>
        <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
          <UserAvatar
            className="h-9 w-9 bg-slate-900 text-xs font-semibold text-white"
            email={user?.email}
            fullName={user?.full_name}
          />
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-800">{displayName}</p>
            <p className="text-[11px] text-slate-500">{displayRole}</p>
          </div>
          <a
            aria-label="Sign out"
            className="ml-2 rounded p-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            href="/"
            title="Sign out"
          >
            Sign out
          </a>
        </div>
      </div>
    </header>
  )
}

function MetricCard({ label, value, detail, icon, tone, href }) {
  const contents = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-[18px] w-[18px]" name={icon} />
        </span>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{detail}</p>
    </>
  )

  const className =
    'block rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'

  return href ? (
    <a className={className} href={href}>
      {contents}
    </a>
  ) : (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {contents}
    </div>
  )
}

function makeTrendData(range) {
  const count = rangeOptions.find((option) => option.value === range)?.count ?? 30

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.82) * 18 + Math.cos(index * 0.31) * 12
    const today = range === 'today'

    return {
      label: today
        ? `${String(index + 8).padStart(2, '0')}:00`
        : `${count - index}d ago`,
      success: Math.max(38, Math.round(92 + wave + ((index * 13) % 24))),
      denied: Math.max(2, Math.round(5 + Math.sin(index * 1.17) * 3 + ((index * 7) % 5))),
    }
  })
}

function TrendChart({ data, chartType }) {
  const width = 800
  const height = 300
  const left = 44
  const right = 12
  const top = 15
  const bottom = 42
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxValue = Math.ceil(Math.max(...data.map((point) => point.success)) / 50) * 50
  const xFor = (index) =>
    left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth)
  const yFor = (value) => top + plotHeight - (value / maxValue) * plotHeight
  const successPath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.success)}`)
    .join(' ')
  const deniedPath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(point.denied)}`)
    .join(' ')
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((step) => Math.round(maxValue * step))
  const labelIndexes = Array.from(new Set([0, Math.round((data.length - 1) / 2), data.length - 1]))

  if (chartType === 'table') {
    return (
      <div className="max-h-[320px] overflow-auto">
        <table className="w-full min-w-[390px] border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Successful actions</th>
              <th className="px-4 py-3">Denied requests</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr className="border-t border-slate-100" key={point.label}>
                <td className="px-4 py-3 text-slate-700">{point.label}</td>
                <td className="px-4 py-3 font-medium text-blue-700">{point.success}</td>
                <td className="px-4 py-3 font-medium text-amber-700">{point.denied}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        aria-label={`${chartType === 'line' ? 'Line' : 'Bar'} chart showing successful actions and denied requests`}
        className="h-[270px] min-w-[540px] w-full"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {gridValues.map((value) => {
          const y = yFor(value)
          return (
            <g key={value}>
              <line
                stroke="#e8edf4"
                strokeDasharray="3 5"
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
              />
              <text
                fill="#8491a2"
                fontSize="10"
                textAnchor="end"
                x={left - 9}
                y={y + 3}
              >
                {value}
              </text>
            </g>
          )
        })}
        {chartType === 'line' ? (
          <>
            <path d={successPath} fill="none" stroke="#398b71" strokeLinejoin="round" strokeWidth="2.5" />
            <path d={deniedPath} fill="none" stroke="#3478c8" strokeLinejoin="round" strokeWidth="2.5" />
            {data.map((point, index) => (
              <g key={point.label}>
                <circle cx={xFor(index)} cy={yFor(point.success)} fill="#398b71" r="2.3" />
                <circle cx={xFor(index)} cy={yFor(point.denied)} fill="#3478c8" r="2.3" />
              </g>
            ))}
          </>
        ) : (
          data.map((point, index) => {
            const groupWidth = plotWidth / data.length
            const barWidth = Math.min(18, groupWidth * 0.32)
            const successHeight = (point.success / maxValue) * plotHeight
            const deniedHeight = (point.denied / maxValue) * plotHeight

            return (
              <g key={point.label}>
                <rect
                  fill="#398b71"
                  height={successHeight}
                  rx="3"
                  width={barWidth}
                  x={xFor(index) - barWidth - 1}
                  y={top + plotHeight - successHeight}
                >
                  <title>{`${point.label}: ${point.success} successful actions`}</title>
                </rect>
                <rect
                  fill="#3478c8"
                  height={Math.max(deniedHeight, 2)}
                  rx="3"
                  width={barWidth}
                  x={xFor(index) + 1}
                  y={top + plotHeight - Math.max(deniedHeight, 2)}
                >
                  <title>{`${point.label}: ${point.denied} denied requests`}</title>
                </rect>
              </g>
            )
          })
        )}
        {labelIndexes.map((index) => (
          <text
            fill="#8491a2"
            fontSize="10"
            key={index}
            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
            x={xFor(index)}
            y={height - 12}
          >
            {data[index].label}
          </text>
        ))}
      </svg>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600">
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#398b71]" />
        Successful actions
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#3478c8]" />
        Denied requests
      </span>
    </div>
  )
}

function ActivityPanel() {
  const [chartType, setChartType] = useState('line')
  const [range, setRange] = useState('30')
  const data = makeTrendData(range)

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Document activity</h2>
          <p className="mt-1 text-xs text-slate-500">
            Successful actions and denied document requests
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="trend-range">Trend time frame</label>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            id="trend-range"
            onChange={(event) => setRange(event.target.value)}
            value={range}
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="chart-type">Chart format</label>
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            id="chart-type"
            onChange={(event) => setChartType(event.target.value)}
            value={chartType}
          >
            <option value="line">Line chart</option>
            <option value="bar">Bar chart</option>
            <option value="table">Table</option>
          </select>
        </div>
      </div>
      <div className="mt-3">
        {chartType === 'table' ? (
          <p className="mb-2 text-xs text-slate-500">Illustrative mock counts by day</p>
        ) : (
          <TrendChart chartType={chartType} data={data} />
        )}
        {chartType === 'table' && <TrendChart chartType={chartType} data={data} />}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <Legend />
        <p className="mt-2 text-[10px] text-slate-400">
          Illustrative data for dashboard preview · not connected to a backend
        </p>
      </div>
    </section>
  )
}

function AuditEvents() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Recent audit events</h2>
        <a className="text-xs font-medium text-blue-700 hover:text-blue-900" href="/admin/audit">
          Audit trail <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] text-slate-500">
              <th className="pb-2 font-medium">Event / Actor</th>
              <th className="pb-2 font-medium">Result</th>
              <th className="pb-2 text-right font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((item) => (
              <tr className="border-b border-slate-100 last:border-0" key={item.event}>
                <td className="py-3 pr-4">
                  <p className="text-xs font-semibold text-slate-800">{item.event}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{item.actor}</p>
                </td>
                <td className="py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      item.result === 'Allowed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.result === 'Denied'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.result}
                  </span>
                </td>
                <td className="py-3 text-right text-[11px] text-slate-500">{item.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PlatformHealth() {
  const services = [
    {
      title: 'Audit event processing',
      detail: 'Latest successful event recorded',
      icon: 'check',
    },
    {
      title: 'Document storage service',
      detail: 'Storage service health check',
      icon: 'storage',
    },
  ]

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Platform health</h2>
      {services.map((service) => (
        <div
          className="flex items-center gap-3 border-t border-slate-100 py-3 first:border-0"
          key={service.title}
        >
          <span className="text-emerald-700">
            <Icon className="h-5 w-5" name={service.icon} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800">{service.title}</p>
            <p className="mt-1 text-[11px] text-slate-500">{service.detail}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
            Healthy
          </span>
        </div>
      ))}
      <p className="mt-1 text-[10px] text-slate-400">Example status only · backend health checks are not connected</p>
    </section>
  )
}

function DashboardContent() {
  const [summary, setSummary] = useState(null)
  const [documentSummary, setDocumentSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      apiGet('/api/admin/users/summary', { signal: controller.signal }),
      apiGet('/api/documents/summary', { signal: controller.signal }),
    ])
      .then(([users, documents]) => {
        setSummary(users)
        setDocumentSummary(documents)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
    return () => controller.abort()
  }, [])

  return (
    <>
      {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">{error}</p>}
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Accounts in the platform"
          href="/admin/users?filter=all"
          icon="users"
          label="Total registered users"
          tone="bg-blue-50 text-blue-700"
          value={summary ? String(summary.total_users) : '—'}
        />
        <MetricCard
          detail="Files shared across SureDocs"
          href="/admin/documents"
          icon="documents"
          label="Total documents"
          tone="bg-violet-50 text-violet-700"
          value={documentSummary ? String(documentSummary.organization_documents) : '—'}
        />
        <MetricCard
          detail="Accounts currently active"
          href="/admin/users?filter=active"
          icon="check"
          label="Active accounts"
          tone="bg-emerald-50 text-emerald-700"
          value={summary ? String(summary.active_users) : '—'}
        />
        <MetricCard
          detail="Suspended by an administrator"
          href="/admin/users?filter=disabled"
          icon="security"
          label="Disabled accounts"
          tone="bg-rose-50 text-rose-700"
          value={summary ? String(summary.disabled_users) : '—'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,5fr)]">
        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            detail="Currently active document records"
            href="/admin/documents"
            icon="documents"
            label="Active documents"
            tone="bg-sky-50 text-sky-700"
            value={documentSummary ? String(documentSummary.active_documents) : '—'}
          />
          <MetricCard
            detail="Unauthorized access attempts denied"
            icon="security"
            label="Denied requests"
            tone="bg-amber-50 text-amber-700"
            value="17"
          />
        </div>
        <ActivityPanel />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <AuditEvents />
        <PlatformHealth />
      </div>
    </>
  )
}

const sectionDetails = {
  '/admin/users': {
    title: 'User management',
    description: 'Review user accounts, roles, profile details, and access status.',
    filters: { all: 'All registered users', active: 'Active accounts', disabled: 'Disabled accounts' },
  },
  '/admin/documents': {
    title: 'Documents',
    description: 'Browse documents shared across the SureDocs platform.',
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

const permissionExamples = [
  {
    document: 'Salary Letter — October',
    documentId: 'DOC-1042',
    owner: 'Priya Sharma',
    user: 'Rahul Kumar',
    type: 'Read',
    grantedBy: 'Priya Sharma',
    grantedAt: '2026-10-18T10:30:00Z',
    expiresAt: '2026-10-25T10:30:00Z',
    status: 'Active',
    reason: 'Access required for salary processing',
  },
  {
    document: 'Master Service Agreement',
    documentId: 'DOC-1088',
    owner: 'Alex Morgan',
    user: 'Anil Rao',
    type: 'Edit',
    grantedBy: 'Alex Morgan',
    grantedAt: '2026-10-17T14:20:00Z',
    expiresAt: '2026-11-17T14:20:00Z',
    status: 'Active',
    reason: 'Review and update agreement terms',
  },
  {
    document: 'Quarterly Audit Evidence',
    documentId: 'DOC-1120',
    owner: 'Priya Sharma',
    user: 'Neha Singh',
    type: 'Read',
    grantedBy: 'Priya Sharma',
    grantedAt: '2026-10-16T09:15:00Z',
    expiresAt: '',
    status: 'Active',
    reason: 'Quarterly compliance audit',
  },
  {
    document: 'Client NDA',
    documentId: 'DOC-1189',
    owner: 'Rahul Verma',
    user: 'Vikas Jain',
    type: 'Edit',
    grantedBy: 'Rahul Verma',
    grantedAt: '2026-10-15T11:40:00Z',
    expiresAt: '2026-10-30T11:40:00Z',
    status: 'Active',
    reason: 'Legal review requested',
  },
  {
    document: 'Product Design Drawing',
    documentId: 'DOC-1201',
    owner: 'Amit Sharma',
    user: 'Karan Patel',
    type: 'Read',
    grantedBy: 'Amit Sharma',
    grantedAt: '2026-10-14T16:25:00Z',
    expiresAt: '2026-11-14T16:25:00Z',
    status: 'Active',
    reason: 'Project reference',
  },
  {
    document: 'Internal Plan',
    documentId: 'DOC-1210',
    owner: 'Neha Kapoor',
    user: 'Meera Singh',
    type: 'Read',
    grantedBy: 'Neha Kapoor',
    grantedAt: '2026-10-12T13:10:00Z',
    expiresAt: '2026-10-19T13:10:00Z',
    status: 'Revoked',
    reason: 'Temporary review access',
  },
  {
    document: 'Financials_2026',
    documentId: 'DOC-1234',
    owner: 'Rahul Verma',
    user: 'Rahul Kumar',
    type: 'Edit',
    grantedBy: 'Rahul Verma',
    grantedAt: '2026-10-11T09:05:00Z',
    expiresAt: '2026-10-20T09:05:00Z',
    status: 'Expired',
    reason: 'Finance team collaboration',
  },
  {
    document: 'Strategy Deck',
    documentId: 'DOC-1266',
    owner: 'Alex Morgan',
    user: 'Anil Rao',
    type: 'Read',
    grantedBy: 'Alex Morgan',
    grantedAt: '2026-10-11T11:22:00Z',
    expiresAt: '',
    status: 'Active',
    reason: 'Leadership review',
  },
  {
    document: 'Employee Handbook',
    documentId: 'DOC-1301',
    owner: 'Priya Sharma',
    user: 'Vikas Jain',
    type: 'Read',
    grantedBy: 'Priya Sharma',
    grantedAt: '2026-10-09T10:10:00Z',
    expiresAt: '',
    status: 'Active',
    reason: 'Employee policy reference',
  },
  {
    document: 'Vendor Security Review',
    documentId: 'DOC-1338',
    owner: 'Maya Chen',
    user: 'Neha Singh',
    type: 'Edit',
    grantedBy: 'Maya Chen',
    grantedAt: '2026-10-08T15:45:00Z',
    expiresAt: '2026-10-28T15:45:00Z',
    status: 'Active',
    reason: 'Security assessment collaboration',
  },
]

const permissionPeople = [
  'Priya Sharma', 'Rahul Kumar', 'Alex Morgan', 'Anil Rao', 'Neha Singh',
  'Rahul Verma', 'Vikas Jain', 'Amit Sharma', 'Karan Patel', 'Neha Kapoor',
  'Meera Singh', 'Maya Chen',
]

function makeMockPermissions() {
  return Array.from({ length: 2840 }, (_, index) => {
    const example = permissionExamples[index % permissionExamples.length]
    const sequence = Math.floor(index / permissionExamples.length)
    const grantedAt = new Date(
      new Date(example.grantedAt).getTime() - sequence * 86400000,
    )
    const grantedBy = permissionPeople[(index + 2) % permissionPeople.length]
    const status = index > 9 && index % 19 === 0
      ? 'Revoked'
      : index > 9 && index % 13 === 0
        ? 'Expired'
        : example.status
    const id = `PERM-${String(index + 5561).padStart(4, '0')}`

    return {
      ...example,
      id,
      grantedBy,
      grantedAt: grantedAt.toISOString(),
      status,
    }
  })
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

function PermissionDetails({ record, onClose }) {
  const [tab, setTab] = useState('details')
  const details = [
    ['Permission ID', record.id],
    ['Document Name', record.document],
    ['Document ID', record.documentId],
    ['Document Owner', record.owner],
    ['User with Access', record.user],
    ['Permission Type', record.type],
    ['Granted By', record.grantedBy],
    ['Granted At', permissionDate(record.grantedAt, true)],
    ['Expires At', permissionDate(record.expiresAt)],
    ['Current Status', record.status],
    ['Reason for Grant', record.reason],
    ['Last Updated', permissionDate(record.grantedAt, true)],
  ]

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/25"
      onClick={onClose}
      role="presentation"
    >
      <aside
        aria-label="Permission details"
        aria-modal="true"
        className="flex h-full w-full max-w-[390px] flex-col border-l border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Permission Details</h2>
          <button aria-label="Close permission details" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button">
            <Icon className="h-4 w-4" name="close" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="flex items-center gap-3 border-b border-slate-100 py-3">
            <PermissionFileIcon name={record.document} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-semibold text-slate-800">{record.document}</h3>
                <PermissionStatus status={record.status} />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">{record.documentId} <span className="px-1">|</span> Permission ID: {record.id}</p>
            </div>
          </div>
          <div aria-label="Permission detail tabs" className="flex border-b border-slate-200">
            {[
              { id: 'details', label: 'Details' },
              { id: 'history', label: 'Permission History' },
            ].map((item) => (
              <button
                aria-selected={tab === item.id}
                className={`border-b-2 px-3 py-2.5 text-[10px] font-medium ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'details' ? (
            <dl className="space-y-2.5 py-3">
              {details.map(([label, value]) => (
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-[10px] leading-4" key={label}>
                  <dt className="text-slate-500">{label}</dt>
                  <dd className={`break-words ${label === 'Current Status' && value === 'Active' ? 'font-semibold text-emerald-700' : 'text-slate-700'}`}>
                    {label === 'Document Owner' || label === 'User with Access' || label === 'Granted By' ? (
                      <span className="flex items-start gap-2">
                        <PersonBadge color={label === 'User with Access' ? 'bg-blue-600' : 'bg-indigo-500'} name={value} />
                        <span>{value}<span className="block text-slate-500">{value.toLowerCase().replaceAll(' ', '.')}@company.com</span></span>
                      </span>
                    ) : label === 'Permission Type' ? (
                      <span className="rounded-md bg-blue-100 px-2 py-1 font-medium text-blue-700">{value}</span>
                    ) : label === 'Current Status' ? <PermissionStatus status={value} /> : value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-3 py-4">
              <h3 className="text-[11px] font-semibold text-slate-800">Permission History</h3>
              {[
                { title: `Permission ${record.status.toLowerCase()}`, by: record.grantedBy, date: permissionDate(record.grantedAt, true) },
                { title: 'Permission granted', by: record.grantedBy, date: permissionDate(record.grantedAt, true) },
              ].map((event, index) => (
                <div className="flex gap-2.5" key={`${event.title}-${index}`}>
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${index ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="text-[10px] font-medium text-slate-700">{event.title}</p>
                    <p className="text-[9px] text-slate-500">{event.by} · {event.date}</p>
                  </div>
                </div>
              ))}
              <p className="rounded-md bg-slate-50 p-2.5 text-[9px] leading-4 text-slate-500">Illustrative permission history for this mock record.</p>
            </div>
          )}
          <div className="mt-2 flex gap-2 rounded-md border border-blue-100 bg-blue-50/70 p-3 text-[9px] leading-4 text-slate-600">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" name="security" />
            <p>You do not have permission to preview or download this document. This is a permission record view only.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

function PermissionsManagement({ initialPermissionId, onOpenPermission, onClosePermission }) {
  const [records] = useState(makeMockPermissions)
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    owner: 'all',
    user: 'all',
    type: 'all',
    status: 'all',
    grantFrom: '',
    expiresFrom: '',
  })
  const [filters, setFilters] = useState(draftFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const selectedRecord = records.find((record) => record.id === initialPermissionId)

  const matchingRecords = records.filter((record) => {
    const query = filters.search.trim().toLowerCase()
    const searchableText = `${record.document} ${record.documentId} ${record.user} ${record.owner} ${record.id}`.toLowerCase()
    return (!query || searchableText.includes(query)) &&
      (filters.owner === 'all' || record.owner === filters.owner) &&
      (filters.user === 'all' || record.user === filters.user) &&
      (filters.type === 'all' || record.type === filters.type) &&
      (filters.status === 'all' || record.status === filters.status) &&
      (!filters.grantFrom || record.grantedAt.slice(0, 10) >= filters.grantFrom) &&
      (!filters.expiresFrom || !record.expiresAt || record.expiresAt.slice(0, 10) >= filters.expiresFrom)
  })
  const pageCount = Math.max(1, Math.ceil(matchingRecords.length / pageSize))
  const visibleRecords = matchingRecords.slice((page - 1) * pageSize, page * pageSize)

  function updateFilter(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setFilters(draftFilters)
    setPage(1)
  }

  function clearFilters() {
    const emptyFilters = {
      search: '',
      owner: 'all',
      user: 'all',
      type: 'all',
      status: 'all',
      grantFrom: '',
      expiresFrom: '',
    }
    setDraftFilters(emptyFilters)
    setFilters(emptyFilters)
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
          { label: 'Active Grants', value: '2,840', detail: 'Currently valid permissions', icon: 'grant', style: 'border-emerald-100 bg-emerald-50/70 text-emerald-700', bubble: 'bg-emerald-100' },
          { label: 'Read Permissions', value: '2,120', detail: 'Active read access grants', icon: 'documents', style: 'border-blue-100 bg-blue-50/70 text-blue-700', bubble: 'bg-blue-100' },
          { label: 'Edit Permissions', value: '720', detail: 'Active edit access grants', icon: 'activity', style: 'border-violet-100 bg-violet-50/70 text-violet-700', bubble: 'bg-violet-100' },
          { label: 'Revoked Grants', value: '156', detail: 'Historical permission records', icon: 'revoked', style: 'border-rose-100 bg-rose-50/70 text-rose-700', bubble: 'bg-rose-100' },
        ].map((metric) => (
          <article className={`flex min-h-[88px] items-center gap-3 rounded-lg border p-3 ${metric.style}`} key={metric.label}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${metric.bubble}`}>
              <Icon className="h-5 w-5" name={metric.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold">{metric.label}</p>
              <p className="mt-1 text-[23px] font-semibold leading-none tracking-tight text-slate-900">{metric.value}</p>
              <p className="mt-1 text-[9px] text-slate-500">{metric.detail}</p>
            </div>
          </article>
        ))}
      </section>

      <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" onSubmit={applyFilters}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search permission records</span>
            <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
            <input
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[10px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search by document name, document ID, or username..."
              type="search"
              value={draftFilters.search}
            />
          </label>
          <button className="h-9 rounded-md bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" type="submit">
            Apply Filters
          </button>
          <button className="h-9 rounded-md border border-slate-200 bg-white px-4 text-[10px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={clearFilters} type="button">
            Clear Filters
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 min-[720px]:grid-cols-3 xl:grid-cols-6">
          {[
            { name: 'owner', label: 'Document Owner', value: draftFilters.owner, options: [...new Set(records.map((record) => record.owner))], placeholder: 'All Owners' },
            { name: 'user', label: 'User with Access', value: draftFilters.user, options: [...new Set(records.map((record) => record.user))], placeholder: 'All Users' },
            { name: 'type', label: 'Permission Type', value: draftFilters.type, options: ['Read', 'Edit'], placeholder: 'All Types' },
            { name: 'status', label: 'Permission Status', value: draftFilters.status, options: ['Active', 'Revoked', 'Expired'], placeholder: 'All Statuses' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}>
              <span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span>
              <select
                aria-label={filter.label}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => updateFilter(filter.name, event.target.value)}
                value={filter.value}
              >
                <option value="all">{filter.placeholder}</option>
                {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          {[
            { name: 'grantFrom', label: 'Grant Date' },
            { name: 'expiresFrom', label: 'Expiration Date' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}>
              <span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span>
              <span className="relative block">
                <Icon className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" name="calendar" />
                <input
                  aria-label={filter.label}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-1 text-[9px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => updateFilter(filter.name, event.target.value)}
                  type="date"
                  value={draftFilters[filter.name]}
                />
              </span>
            </label>
          ))}
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Permission Records</h2>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Showing {matchingRecords.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matchingRecords.length)}` : '0'} of {matchingRecords.length.toLocaleString()} permission grants
            </p>
          </div>
          <label className="flex items-center gap-2 text-[9px] text-slate-500">
            <span className="sr-only">Records per page</span>
            <select
              aria-label="Permission records per page"
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none focus:border-blue-400"
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
              value={pageSize}
            >
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[9px] font-semibold text-slate-600">
                <th className="px-2 py-2">Document</th>
                <th className="px-2 py-2">Document Owner</th>
                <th className="px-2 py-2">User with Access</th>
                <th className="px-2 py-2">Permission</th>
                <th className="px-2 py-2">Granted By</th>
                <th className="px-2 py-2">Granted At</th>
                <th className="px-2 py-2">Expires At</th>
                <th className="px-2 py-2">Status</th>
                <th className="w-10 px-2 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr
                  className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/40"
                  key={record.id}
                  onClick={() => onOpenPermission(record.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpenPermission(record.id)
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-2 py-2">
                    <div className="flex min-w-[120px] items-center gap-2">
                      <PermissionFileIcon name={record.document} />
                      <span className="min-w-0">
                        <span className="block truncate text-[9px] font-medium text-slate-700">{record.document}</span>
                        <span className="block text-[8px] text-slate-500">{record.documentId}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge name={record.owner} />{record.owner}</span></td>
                  <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge color="bg-blue-600" name={record.user} />{record.user}</span></td>
                  <td className="px-2 py-2"><span className={`rounded-md px-2 py-1 text-[9px] font-semibold ${record.type === 'Read' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{record.type}</span></td>
                  <td className="px-2 py-2"><span className="flex items-center gap-1.5 whitespace-nowrap text-[9px] text-slate-600"><PersonBadge name={record.grantedBy} />{record.grantedBy}</span></td>
                  <td className="whitespace-nowrap px-2 py-2 text-[9px] text-slate-600">{permissionDate(record.grantedAt, true)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-[9px] text-slate-600">{permissionDate(record.expiresAt)}</td>
                  <td className="px-2 py-2"><PermissionStatus status={record.status} /></td>
                  <td className="px-2 py-2 text-center">
                    <button
                      aria-label={`View permission details for ${record.document}`}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={(event) => { event.stopPropagation(); onOpenPermission(record.id) }}
                      type="button"
                    >
                      <Icon className="h-4 w-4" name="more" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleRecords.length === 0 && (
                <tr><td className="px-3 py-10 text-center text-xs text-slate-500" colSpan={9}>No permission records match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
          <p className="text-[9px] text-slate-500">
            {matchingRecords.length ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matchingRecords.length)} of ${matchingRecords.length.toLocaleString()} permission grants` : 'No matching permission grants'}
          </p>
          <div className="flex items-center gap-1">
            <button aria-label="Previous page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
            <span className="rounded bg-blue-600 px-2.5 py-1 text-[9px] font-semibold text-white">{page}</span>
            <span className="px-1 text-[9px] text-slate-500">of {pageCount}</span>
            <button aria-label="Next page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">›</button>
          </div>
        </div>
      </section>
      <p className="text-[9px] text-slate-400">Illustrative permission records · mock data only, not connected to document access controls.</p>
      {selectedRecord && <PermissionDetails onClose={onClosePermission} record={selectedRecord} />}
    </div>
  )
}

const auditExamples = [
  {
    timestamp: '2026-10-20T09:42:16Z',
    actor: 'Rahul Kumar',
    actorId: 'USER-305',
    actorRole: 'Employee',
    category: 'Document',
    action: 'Downloaded document',
    resourceType: 'Document',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter.pdf',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Document download completed.',
  },
  {
    timestamp: '2026-10-20T09:39:02Z',
    actor: 'Anil Rao',
    actorId: 'USER-412',
    actorRole: 'Viewer',
    category: 'Document',
    action: 'Viewed document',
    resourceType: 'Document',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter.pdf',
    outcome: 'Denied',
    severity: 'Warning',
    reason: 'INSUFFICIENT_PERMISSION — User does not have access to this document.',
  },
  {
    timestamp: '2026-10-20T09:35:18Z',
    actor: 'Neha Singh',
    actorId: 'USER-518',
    actorRole: 'Employee',
    category: 'Authentication',
    action: 'Login failed',
    resourceType: '—',
    documentId: '',
    documentName: '',
    outcome: 'Failure',
    severity: 'Warning',
    reason: 'Invalid credentials.',
  },
  {
    timestamp: '2026-10-20T09:32:45Z',
    actor: 'Priya Sharma',
    actorId: 'USER-204',
    actorRole: 'Administrator',
    category: 'Permission',
    action: 'Revoked access',
    resourceType: 'Document',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter.pdf',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Access no longer required.',
  },
  {
    timestamp: '2026-10-20T09:30:11Z',
    actor: 'Rahul Verma',
    actorId: 'USER-301',
    actorRole: 'Administrator',
    category: 'User Management',
    action: 'Changed user role',
    resourceType: 'User',
    targetUser: 'Anil Rao',
    targetUserId: 'USER-412',
    documentId: '',
    documentName: '',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Role updated by administrator.',
  },
  {
    timestamp: '2026-10-20T09:18:07Z',
    actor: 'Amit Sharma',
    actorId: 'USER-220',
    actorRole: 'Administrator',
    category: 'Session',
    action: 'Session revoked',
    resourceType: 'Session',
    resourceId: 'SESSION-8842',
    documentId: '',
    documentName: '',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Session revoked by administrator.',
  },
  {
    timestamp: '2026-10-20T09:12:33Z',
    actor: 'Vikas Jain',
    actorId: 'USER-330',
    actorRole: 'Employee',
    category: 'Document',
    action: 'Uploaded document',
    resourceType: 'Document',
    documentId: 'DOC-1088',
    documentName: 'Q3 Report.xlsx',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Document upload completed.',
  },
  {
    timestamp: '2026-10-20T09:05:27Z',
    actor: 'Meera Kapoor',
    actorId: 'USER-516',
    actorRole: 'Employee',
    category: 'Document',
    action: 'Deleted document',
    resourceType: 'Document',
    documentId: 'DOC-1007',
    documentName: 'Old Plan.docx',
    outcome: 'Success',
    severity: 'Warning',
    reason: 'Document deleted by owner.',
  },
  {
    timestamp: '2026-10-20T08:59:14Z',
    actor: 'Priya Sharma',
    actorId: 'USER-204',
    actorRole: 'Administrator',
    category: 'Permission',
    action: 'Granted access',
    resourceType: 'Document',
    documentId: 'DOC-1120',
    documentName: 'Audit Evidence.pdf',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Access granted for audit review.',
  },
  {
    timestamp: '2026-10-20T08:41:09Z',
    actor: 'System',
    actorId: 'auth-service',
    actorRole: 'System',
    category: 'Authentication',
    action: 'Login success',
    resourceType: '—',
    documentId: '',
    documentName: '',
    outcome: 'Success',
    severity: 'Info',
    reason: 'Authentication completed successfully.',
  },
]

function makeMockAuditEvents() {
  return Array.from({ length: 12480 }, (_, index) => {
    const example = auditExamples[index % auditExamples.length]
    let timestamp
    if (index < auditExamples.length) {
      timestamp = example.timestamp
    } else if (index < 510) {
      timestamp = new Date(
        Date.UTC(2026, 9, 20, 8, 40, 59) - (index - 10) * 1000,
      ).toISOString()
    } else {
      const dailyOffset = index - 510
      const dayOffset = Math.floor(dailyOffset / 1710)
      const slot = dailyOffset % 1710
      timestamp = new Date(
        Date.UTC(2026, 9, 19 - dayOffset, 23, 59, 59) - slot * 50000,
      ).toISOString()
    }
    const event = {
      ...example,
      id: `EVT-${String(12480 - index).padStart(7, '0')}`,
      timestamp,
      outcome: index > 9 && index % 37 === 0
        ? 'Denied'
        : index > 9 && index % 53 === 0
          ? 'Failure'
          : example.outcome,
      severity: index > 9 && index % 211 === 0 ? 'Critical' : example.severity,
      requestId: `req-${(0x7f9d3a21 - index * 7919).toString(16).slice(0, 8)}-4b6e-8c1d`,
      correlationId: `corr-${(0x2e8b53c9 - index * 1877).toString(16).slice(0, 8)}-9a71-42de`,
      ipAddress: index === 1 ? '203.0.113.25' : `203.0.113.${(index % 200) + 1}`,
      userAgent: 'Chrome 118.0 (Windows 10)',
      actorEmail: example.actor === 'System'
        ? 'auth-service@suredocs.example'
        : `${example.actor.toLowerCase().replaceAll(' ', '.')}@company.com`,
      documentOwner: example.documentId ? 'Priya Sharma' : '',
      documentOwnerId: example.documentId ? 'USER-204' : '',
      documentCategory: example.documentId ? 'HR' : '',
      fileType: example.documentName?.split('.').pop()?.toUpperCase() ?? '',
      fileSize: example.documentId ? '245 KB' : '',
      documentStatus: example.documentId ? 'Active' : '',
      raw: {},
    }
    event.raw = {
      eventId: event.id,
      timestamp: event.timestamp,
      actor: { name: event.actor, id: event.actorId, role: event.actorRole, email: event.actorEmail },
      event: { category: event.category, action: event.action, outcome: event.outcome, severity: event.severity },
      resource: {
        type: event.resourceType,
        id: event.documentId || event.resourceId || null,
        name: event.documentName || null,
      },
      request: {
        id: event.requestId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
      reason: event.reason,
    }
    return event
  })
}

function auditDateTime(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(value)) + ' UTC'
}

function auditShortTime(value) {
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('en', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
    time: new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }).format(date) + ' UTC',
  }
}

function AuditEventDetails({ event, onClose }) {
  const [tab, setTab] = useState('overview')
  const details = [
    ['Event ID', event.id],
    ['Timestamp', auditDateTime(event.timestamp)],
    ['Actor', `${event.actor} (${event.actorId})`],
    ['Actor Role', event.actorRole],
    ['Event Category', `${event.category} Activity`],
    ['Action', event.action],
    ['Resource Type', event.resourceType],
    ...(event.documentId ? [['Document ID', event.documentId], ['Document Name', event.documentName]] : []),
    ['Outcome', event.outcome],
    ['Reason', event.reason],
    ['Request ID', event.requestId],
    ['Correlation ID', event.correlationId],
    ['IP Address', event.ipAddress],
    ['User Agent', event.userAgent],
  ]

  useEffect(() => {
    function onKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/25" onClick={onClose} role="presentation">
      <aside
        aria-label="Event details"
        aria-modal="true"
        className="flex h-full w-full max-w-[390px] flex-col border-l border-slate-200 bg-white shadow-2xl"
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Event Details</h2>
          <button aria-label="Close event details" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button">
            <Icon className="h-4 w-4" name="close" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <div className="flex items-start gap-2.5 border-b border-slate-100 py-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${event.outcome === 'Denied' ? 'bg-rose-100 text-rose-600' : event.outcome === 'Failure' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              <Icon className="h-4 w-4" name={event.outcome === 'Denied' ? 'revoked' : event.outcome === 'Failure' ? 'warning' : 'activity'} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="text-[11px] font-semibold text-slate-800">{event.action}</h3>
                <span className={`rounded-md px-2 py-0.5 text-[9px] font-semibold ${event.outcome === 'Success' ? 'bg-emerald-100 text-emerald-800' : event.outcome === 'Denied' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{event.outcome}</span>
              </div>
              <p className="mt-1 text-[9px] text-slate-500">{event.id} <span className="px-1">|</span> {auditDateTime(event.timestamp)}</p>
            </div>
          </div>
          <div aria-label="Event detail tabs" className="flex border-b border-slate-200">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'raw', label: 'Raw Data' },
            ].map((item) => (
              <button
                aria-selected={tab === item.id}
                className={`border-b-2 px-4 py-2.5 text-[10px] font-medium ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'overview' ? (
            <div className="space-y-3 py-3">
              <dl className="space-y-1.5">
                {details.map(([label, value]) => (
                  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-[9px] leading-[14px]" key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className={`break-words ${label === 'Outcome' ? event.outcome === 'Success' ? 'font-semibold text-emerald-700' : event.outcome === 'Denied' ? 'font-semibold text-rose-700' : 'font-semibold text-amber-700' : 'text-slate-700'}`}>
                      {label === 'Actor' ? (
                        <span className="flex items-start gap-1.5">
                          <PersonBadge color="bg-blue-600" name={event.actor} />
                          <span>{event.actor} ({event.actorId})<span className="block text-[8px] text-slate-500">{event.actorEmail}</span></span>
                        </span>
                      ) : label === 'Outcome' ? <PermissionStatus status={value === 'Success' ? 'Active' : value} /> : value}
                    </dd>
                  </div>
                ))}
              </dl>
              {event.documentId && (
                <section className="rounded-md border border-slate-200 p-2.5">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                    <Icon className="h-3.5 w-3.5" name="documents" />
                    Related Document Information
                  </h3>
                  <div className="mt-2 flex items-center gap-2">
                    <PermissionFileIcon name={event.documentName} />
                    <div><p className="text-[9px] font-semibold text-slate-700">{event.documentId}</p><p className="text-[8px] text-slate-500">{event.documentName}</p></div>
                  </div>
                  <dl className="mt-2 grid grid-cols-[70px_1fr] gap-y-1 text-[8px]">
                    <dt className="text-slate-500">Owner</dt><dd className="text-slate-700">{event.documentOwner} ({event.documentOwnerId})</dd>
                    <dt className="text-slate-500">Category</dt><dd className="text-slate-700">{event.documentCategory}</dd>
                    <dt className="text-slate-500">File Type</dt><dd className="text-slate-700">{event.fileType}</dd>
                    <dt className="text-slate-500">File Size</dt><dd className="text-slate-700">{event.fileSize}</dd>
                    <dt className="text-slate-500">Status</dt><dd><PermissionStatus status={event.documentStatus} /></dd>
                  </dl>
                </section>
              )}
              {event.outcome === 'Denied' && (
                <section className="rounded-md border border-slate-200 p-2.5">
                  <h3 className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                    <Icon className="h-3.5 w-3.5" name="warning" />
                    Reason for Denial
                  </h3>
                  <p className="mt-2 rounded bg-blue-50 px-2.5 py-2 text-[8px] leading-4 text-slate-600">The user does not have an active permission grant for this document.</p>
                </section>
              )}
            </div>
          ) : (
            <div className="py-3">
              <h3 className="mb-2 text-[10px] font-semibold text-slate-700">Raw Event Data</h3>
              <pre className="overflow-x-auto rounded-md bg-slate-950 p-3 text-[8px] leading-4 text-emerald-100">{JSON.stringify(event.raw, null, 2)}</pre>
              <p className="mt-2 text-[8px] text-slate-500">Illustrative event payload. Raw data is mock content.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function AuditLogs({ initialEventId, onOpenEvent, onCloseEvent }) {
  const [events] = useState(makeMockAuditEvents)
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    actor: 'all',
    category: 'all',
    action: 'all',
    outcome: 'all',
    resource: 'all',
    severity: 'all',
    from: '2026-10-13',
    to: '2026-10-20',
  })
  const [filters, setFilters] = useState(draftFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [expanded, setExpanded] = useState(true)
  const selectedEvent = events.find((event) => event.id === initialEventId)
  const filteredEvents = events.filter((event) => {
    const query = filters.search.trim().toLowerCase()
    const content = `${event.id} ${event.actor} ${event.documentName} ${event.documentId} ${event.requestId} ${event.action}`.toLowerCase()
    const date = event.timestamp.slice(0, 10)
    return (!query || content.includes(query)) &&
      (filters.actor === 'all' || event.actor === filters.actor) &&
      (filters.category === 'all' || event.category === filters.category) &&
      (filters.action === 'all' || event.action === filters.action) &&
      (filters.outcome === 'all' || event.outcome === filters.outcome) &&
      (filters.resource === 'all' || event.resourceType === filters.resource) &&
      (filters.severity === 'all' || event.severity === filters.severity) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to)
  })
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const visibleEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize)

  function updateFilter(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setFilters(draftFilters)
    setPage(1)
  }

  function clearFilters() {
    const cleared = {
      search: '',
      actor: 'all',
      category: 'all',
      action: 'all',
      outcome: 'all',
      resource: 'all',
      severity: 'all',
      from: '',
      to: '',
    }
    setDraftFilters(cleared)
    setFilters(cleared)
    setPage(1)
  }

  function exportAuditLogs() {
    const columns = ['Timestamp', 'Event ID', 'Actor', 'Actor ID', 'Category', 'Action', 'Resource', 'Outcome', 'Severity', 'Request ID']
    const rows = filteredEvents.map((event) => [
      event.timestamp, event.id, event.actor, event.actorId, event.category, event.action,
      event.documentId ? `${event.documentId} ${event.documentName}` : event.resourceType,
      event.outcome, event.severity, event.requestId,
    ])
    const csv = [columns, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = 'suredocs-audit-logs-mock.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }

  const selects = [
    { name: 'actor', label: 'Actor', placeholder: 'All Users', options: [...new Set(events.map((event) => event.actor))] },
    { name: 'category', label: 'Event Category', placeholder: 'All Categories', options: [...new Set(events.map((event) => event.category))] },
    { name: 'action', label: 'Action', placeholder: 'All Actions', options: [...new Set(events.map((event) => event.action))] },
    { name: 'outcome', label: 'Outcome', placeholder: 'All Outcomes', options: ['Success', 'Denied', 'Failure'] },
    { name: 'resource', label: 'Resource', placeholder: 'All Resources', options: ['Document', 'User', 'Session', '—'] },
    { name: 'severity', label: 'Severity', placeholder: 'All Severities', options: ['Info', 'Warning', 'Critical'] },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Audit Trail</h1>
          <p className="mt-1 text-xs text-slate-500">Track and investigate security-related activities across SureDocs.</p>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-200 bg-white px-3 text-[10px] font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={exportAuditLogs} type="button">
          <Icon className="h-3.5 w-3.5" name="download" />
          Export Audit Logs
        </button>
      </div>

      <section aria-label="Audit summary" className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Events', value: '12,480', detail: 'Recorded audit events', trend: '↑ 8%', icon: 'documents', style: 'border-blue-100 bg-blue-50/70 text-blue-700', bubble: 'bg-blue-100' },
          { label: 'Successful Actions', value: '11,930', detail: 'Operations completed', trend: '↑ 6%', icon: 'success', style: 'border-emerald-100 bg-emerald-50/70 text-emerald-700', bubble: 'bg-emerald-100' },
          { label: 'Denied Attempts', value: '320', detail: 'Requests blocked', trend: '↑ 12%', icon: 'failure', style: 'border-rose-100 bg-rose-50/70 text-rose-700', bubble: 'bg-rose-100' },
          { label: 'Security Events', value: '230', detail: 'Authentication & session events', trend: '↑ 15%', icon: 'security', style: 'border-violet-100 bg-violet-50/70 text-violet-700', bubble: 'bg-violet-100' },
        ].map((metric) => (
          <article className={`flex min-h-[84px] items-center gap-3 rounded-lg border p-3 ${metric.style}`} key={metric.label}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${metric.bubble}`}>
              <Icon className="h-5 w-5" name={metric.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold">{metric.label}</p>
              <div className="mt-1 flex items-end justify-between gap-1">
                <p className="text-[22px] font-semibold leading-none tracking-tight text-slate-900">{metric.value}</p>
                <span className="whitespace-nowrap text-[9px] font-semibold text-emerald-600">{metric.trend}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                <p className="truncate text-[8px] text-slate-500">{metric.detail}</p>
                <span className="whitespace-nowrap text-[8px] text-slate-500">vs last month</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" onSubmit={applyFilters}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search audit events</span>
            <Icon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" name="search" />
            <input
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[10px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => updateFilter('search', event.target.value)}
              placeholder="Search by event ID, user, document name/ID, or request ID..."
              type="search"
              value={draftFilters.search}
            />
          </label>
          <button className="h-9 rounded-md bg-blue-600 px-4 text-[10px] font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" type="submit">Apply Filters</button>
          <button className="h-9 rounded-md border border-slate-200 bg-white px-4 text-[10px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={clearFilters} type="button">Clear Filters</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 min-[700px]:grid-cols-4 xl:grid-cols-7">
          {selects.map((filter) => (
            <label className="block min-w-0" key={filter.name}>
              <span className="mb-1 block truncate text-[9px] font-medium text-slate-600">{filter.label}</span>
              <select
                aria-label={filter.label}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => updateFilter(filter.name, event.target.value)}
                value={draftFilters[filter.name]}
              >
                <option value="all">{filter.placeholder}</option>
                {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          <label className="block min-w-0">
            <span className="mb-1 block truncate text-[9px] font-medium text-slate-600">Date Range</span>
            <span className="flex h-8 items-center gap-1 rounded-md border border-slate-200 px-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" name="calendar" />
              <input aria-label="Audit start date" className="min-w-0 flex-1 text-[8px] text-slate-700 outline-none" onChange={(event) => updateFilter('from', event.target.value)} type="date" value={draftFilters.from} />
              <span className="text-[8px] text-slate-400">–</span>
              <input aria-label="Audit end date" className="min-w-0 flex-1 text-[8px] text-slate-700 outline-none" onChange={(event) => updateFilter('to', event.target.value)} type="date" value={draftFilters.to} />
            </span>
          </label>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <button aria-expanded={expanded} className="flex min-w-0 items-center justify-between gap-3 text-left" onClick={() => setExpanded((value) => !value)} type="button">
            <span>
              <span className="block text-sm font-semibold text-slate-800">Audit Events</span>
              <span className="mt-0.5 block text-[9px] text-slate-500">Showing {filteredEvents.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredEvents.length)}` : '0'} of {filteredEvents.length.toLocaleString()} events (latest first)</span>
            </span>
            <Icon className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} name="chevron" />
          </button>
          <label className="flex items-center gap-2 text-[9px] text-slate-500">
            <span className="sr-only">Audit records per page</span>
            <select aria-label="Audit records per page" className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none focus:border-blue-400" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} value={pageSize}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
            </select>
          </label>
        </header>
        {expanded && <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="text-[9px] font-semibold text-slate-600">
                  <th className="w-8 px-2 py-2"><input aria-label="Select all visible audit events" type="checkbox" /></th>
                  <th className="px-2 py-2">Timestamp <span aria-hidden="true">↕</span></th>
                  <th className="px-2 py-2">Event ID</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Resource</th>
                  <th className="px-2 py-2">Outcome</th>
                  <th className="px-2 py-2">Severity</th>
                  <th className="px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvents.map((event) => {
                  const time = auditShortTime(event.timestamp)
                  const categoryTone = event.category === 'Document'
                    ? 'bg-blue-100 text-blue-700'
                    : event.category === 'Permission'
                      ? 'bg-emerald-100 text-emerald-700'
                      : event.category === 'Authentication' || event.category === 'Session'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-amber-100 text-amber-700'
                  return (
                    <tr
                      className="cursor-pointer border-t border-slate-100 hover:bg-blue-50/50"
                      key={event.id}
                      onClick={() => onOpenEvent(event.id)}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault()
                          onOpenEvent(event.id)
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="px-2 py-2"><input aria-label={`Select event ${event.id}`} onClick={(clickEvent) => clickEvent.stopPropagation()} type="checkbox" /></td>
                      <td className="whitespace-nowrap px-2 py-2 text-[8px] text-slate-600"><span className="block">{time.date}</span><span className="block">{time.time}</span></td>
                      <td className="whitespace-nowrap px-2 py-2 text-[8px] text-slate-600">{event.id}</td>
                      <td className="px-2 py-2">
                        <span className="flex min-w-[92px] items-center gap-1.5">
                          <PersonBadge color={event.actor === 'System' ? 'bg-slate-500' : ['bg-blue-600', 'bg-violet-600', 'bg-slate-500'][event.actorId.charCodeAt(event.actorId.length - 1) % 3]} name={event.actor} />
                          <span className="min-w-0">
                            <span className="block truncate text-[9px] font-medium text-slate-700">{event.actor}</span>
                            <span className="block text-[8px] text-slate-500">{event.actorId}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2"><span className={`whitespace-nowrap rounded-md px-2 py-1 text-[8px] font-semibold ${categoryTone}`}>{event.category}</span></td>
                      <td className="whitespace-nowrap px-2 py-2 text-[9px] text-slate-700">{event.action}</td>
                      <td className="px-2 py-2">
                        {event.documentId ? (
                          <span className="flex min-w-[95px] items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" name="documents" />
                            <span className="min-w-0"><span className="block text-[8px] text-slate-700">{event.documentId}</span><span className="block truncate text-[8px] text-slate-500">{event.documentName}</span></span>
                          </span>
                        ) : event.resourceId ? <span className="text-[8px] text-slate-600">{event.resourceId}</span> : <span className="text-[9px] text-slate-400">—</span>}
                      </td>
                      <td className="px-2 py-2"><span className={`rounded-md px-2 py-1 text-[8px] font-semibold ${event.outcome === 'Success' ? 'bg-emerald-100 text-emerald-700' : event.outcome === 'Denied' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{event.outcome}</span></td>
                      <td className="px-2 py-2"><span className={`rounded-md px-2 py-1 text-[8px] font-semibold ${event.severity === 'Info' ? 'bg-blue-100 text-blue-700' : event.severity === 'Critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{event.severity}</span></td>
                      <td className="px-2 py-2 text-center">
                        <button aria-label={`View details for event ${event.id}`} className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpenEvent(event.id) }} type="button">
                          <Icon className="h-4 w-4" name="more" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {visibleEvents.length === 0 && <tr><td className="px-3 py-10 text-center text-xs text-slate-500" colSpan={10}>No audit events match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
            <p className="text-[9px] text-slate-500">{filteredEvents.length ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredEvents.length)} of ${filteredEvents.length.toLocaleString()} events` : 'No matching events'}</p>
            <div className="flex items-center gap-1">
              <button aria-label="Previous page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
              {[...new Set([1, page - 1, page, page + 1, pageCount])].filter((number) => number > 0 && number <= pageCount).sort((a, b) => a - b).map((number) => (
                <button aria-current={page === number ? 'page' : undefined} className={`rounded px-2.5 py-1 text-[9px] font-semibold ${page === number ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`} key={number} onClick={() => setPage(number)} type="button">{number}</button>
              ))}
              <button aria-label="Next page" className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-600 disabled:opacity-40" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">›</button>
            </div>
          </div>
        </>}
      </section>
      <p className="text-[9px] text-slate-400">Illustrative audit log entries · mock data only, not connected to authentication or audit storage.</p>
      {selectedEvent && <AuditEventDetails event={selectedEvent} onClose={onCloseEvent} />}
    </div>
  )
}

const securityExamples = [
  {
    id: 'INC-2026-001',
    time: '2026-10-20T14:32:10Z',
    type: 'Repeated Unauthorized Access',
    icon: 'revoked',
    description: 'Multiple denied document access attempts (12 in 5 min)',
    user: 'Rahul Kumar',
    userId: 'USER-305',
    severity: 'High',
    status: 'Open',
    sourceIp: '203.0.113.25',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter — October',
    attempts: 12,
    reason: 'INSUFFICIENT_PERMISSION',
  },
  {
    id: 'INC-2026-002',
    time: '2026-10-20T13:22:00Z',
    type: 'Unusual Download Volume',
    icon: 'download',
    description: 'Large download volume of sensitive documents (22 files)',
    user: 'Anil Rao',
    userId: 'USER-412',
    severity: 'High',
    status: 'Under Investigation',
    sourceIp: '198.51.100.42',
    documentId: 'DOC-1088',
    documentName: 'Q3 Report.xlsx',
    attempts: 22,
    reason: 'Download volume exceeds normal user activity.',
  },
  {
    id: 'INC-2026-003',
    time: '2026-10-20T09:48:18Z',
    type: 'Failed Login Attempts',
    icon: 'warning',
    description: '10 failed login attempts from same IP address',
    user: 'Neha Singh',
    userId: 'USER-518',
    severity: 'Medium',
    status: 'Open',
    sourceIp: '203.0.113.25',
    documentId: '',
    documentName: '',
    attempts: 10,
    reason: 'Repeated authentication failures from one network address.',
  },
  {
    id: 'INC-2026-004',
    time: '2026-10-19T17:20:00Z',
    type: 'Sensitive Permission Change',
    icon: 'permissions',
    description: 'Edit permission granted to sensitive document',
    user: 'Priya Sharma',
    userId: 'USER-204',
    severity: 'Medium',
    status: 'Under Investigation',
    sourceIp: '192.0.2.44',
    documentId: 'DOC-1120',
    documentName: 'Audit Evidence.pdf',
    attempts: 1,
    reason: 'Sensitive document permission change requires review.',
  },
  {
    id: 'INC-2026-005',
    time: '2026-10-18T16:10:00Z',
    type: 'Access to Disabled Account',
    icon: 'security',
    description: 'Login attempt on disabled account',
    user: 'Neha Kapoor',
    userId: 'USER-518',
    severity: 'Medium',
    status: 'Resolved',
    sourceIp: '198.51.100.17',
    documentId: '',
    documentName: '',
    attempts: 1,
    reason: 'Login denied because the account is disabled.',
  },
  {
    id: 'INC-2026-006',
    time: '2026-10-18T13:55:00Z',
    type: 'Unusual Download Volume',
    icon: 'download',
    description: 'Large download volume of sensitive documents (22 files)',
    user: 'Vikas Jain',
    userId: 'USER-330',
    severity: 'High',
    status: 'Open',
    sourceIp: '203.0.113.51',
    documentId: 'DOC-1088',
    documentName: 'Q3 Report.xlsx',
    attempts: 22,
    reason: 'Download volume exceeded the usual daily threshold.',
  },
  {
    id: 'INC-2026-007',
    time: '2026-10-17T11:40:28Z',
    type: 'Repeated Unauthorized Access',
    icon: 'revoked',
    description: 'Multiple denied access attempts (8 in 10 min)',
    user: 'Amit Sharma',
    userId: 'USER-220',
    severity: 'Medium',
    status: 'Resolved',
    sourceIp: '192.0.2.80',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter — October',
    attempts: 8,
    reason: 'User lacked an active grant for this document.',
  },
  {
    id: 'INC-2026-008',
    time: '2026-10-16T09:18:02Z',
    type: 'Failed Login Attempts',
    icon: 'warning',
    description: '5 failed login attempts',
    user: 'Karan Patel',
    userId: 'USER-514',
    severity: 'Low',
    status: 'Resolved',
    sourceIp: '203.0.113.89',
    documentId: '',
    documentName: '',
    attempts: 5,
    reason: 'User successfully authenticated after password reset.',
  },
  {
    id: 'INC-2026-009',
    time: '2026-10-15T14:37:00Z',
    type: 'Sensitive Permission Change',
    icon: 'permissions',
    description: 'Permission revoked for sensitive document',
    user: 'Alex Morgan',
    userId: 'USER-102',
    severity: 'Medium',
    status: 'Resolved',
    sourceIp: '192.0.2.15',
    documentId: 'DOC-1120',
    documentName: 'Audit Evidence.pdf',
    attempts: 1,
    reason: 'Permission change verified by the document owner.',
  },
  {
    id: 'INC-2026-010',
    time: '2026-10-14T10:25:00Z',
    type: 'Unusual Download Volume',
    icon: 'download',
    description: 'High download volume outside usual hours',
    user: 'Rahul Verma',
    userId: 'USER-301',
    severity: 'Medium',
    status: 'Resolved',
    sourceIp: '198.51.100.21',
    documentId: 'DOC-1088',
    documentName: 'Q3 Report.xlsx',
    attempts: 14,
    reason: 'Activity was confirmed as an approved quarterly review.',
  },
  {
    id: 'INC-2026-011',
    time: '2026-10-14T09:14:00Z',
    type: 'Sensitive Permission Change',
    icon: 'permissions',
    description: 'Edit permission granted to a sensitive document',
    user: 'Alex Morgan',
    userId: 'USER-102',
    severity: 'Medium',
    status: 'Resolved',
    sourceIp: '192.0.2.15',
    documentId: 'DOC-1120',
    documentName: 'Audit Evidence.pdf',
    attempts: 1,
    reason: 'Permission change verified by the document owner.',
  },
  {
    id: 'INC-2026-012',
    time: '2026-10-13T16:05:00Z',
    type: 'Repeated Unauthorized Access',
    icon: 'revoked',
    description: 'Multiple denied document access attempts (6 in 10 min)',
    user: 'Rahul Kumar',
    userId: 'USER-305',
    severity: 'Low',
    status: 'Resolved',
    sourceIp: '203.0.113.25',
    documentId: 'DOC-1042',
    documentName: 'Salary Letter — October',
    attempts: 6,
    reason: 'User access was reviewed and confirmed to be blocked.',
  },
]

const securityColors = {
  red: '#ef4444',
  blue: '#2563eb',
  violet: '#8b5cf6',
  green: '#16a34a',
}

function SecurityTrendChart() {
  const series = [
    { name: 'Failed Logins', color: securityColors.red, values: [24, 42, 40, 67, 58, 62, 68, 75] },
    { name: 'Unauthorized Access', color: securityColors.blue, values: [14, 31, 25, 38, 29, 36, 39, 48] },
    { name: 'Unusual Downloads', color: securityColors.violet, values: [7, 18, 14, 25, 22, 24, 28, 35] },
    { name: 'Permission Changes', color: securityColors.green, values: [4, 13, 9, 17, 12, 19, 21, 27] },
  ]
  const x = (index) => 28 + index * 40
  const y = (value) => 104 - value * 1.12

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-[11px] font-semibold text-slate-800">Security Events Trend</h2>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {series.map((item) => (
          <span className="inline-flex items-center gap-1 text-[8px] text-slate-500" key={item.name}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
      <svg aria-label="Security events trend over the last eight days" className="mt-2 h-[130px] w-full" role="img" viewBox="0 0 330 130">
        {[20, 40, 60, 80].map((value) => (
          <g key={value}>
            <line stroke="#e2e8f0" strokeDasharray="2 3" x1="25" x2="320" y1={y(value)} y2={y(value)} />
            <text fill="#94a3b8" fontSize="7" textAnchor="end" x="20" y={y(value) + 3}>{value}</text>
          </g>
        ))}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
          return (
            <g key={item.name}>
              <polyline fill="none" points={points} stroke={item.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
              {item.values.map((value, index) => (
                <circle cx={x(index)} cy={y(value)} fill={item.color} key={`${item.name}-${index}`} r="2" />
              ))}
            </g>
          )
        })}
        {['Oct 13', 'Oct 14', 'Oct 15', 'Oct 16', 'Oct 17', 'Oct 18', 'Oct 19', 'Oct 20'].map((label, index) => (
          <text fill="#64748b" fontSize="7" textAnchor="middle" x={x(index)} y="123" key={label}>{label}</text>
        ))}
      </svg>
    </div>
  )
}

function SecurityTypeChart() {
  const types = [
    { label: 'Failed Login Attempts', value: 148, color: '#ef4444' },
    { label: 'Unauthorized Access', value: 82, color: '#2563eb' },
    { label: 'Unusual Downloads', value: 6, color: '#8b5cf6' },
    { label: 'Sensitive Permission Changes', value: 9, color: '#16a34a' },
    { label: 'Other', value: 12, color: '#94a3b8' },
  ]
  const total = types.reduce((sum, item) => sum + item.value, 0)
  let current = 0
  const conicStops = types.map((item) => {
    const start = current
    current += (item.value / total) * 100
    return `${item.color} ${start}% ${current}%`
  }).join(', ')

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="text-[11px] font-semibold text-slate-800">Events by Type</h2>
      <div className="mt-2 flex items-center justify-center gap-3">
        <div
          aria-label={`${total} security incidents by type`}
          className="relative flex h-[108px] w-[108px] shrink-0 items-center justify-center rounded-full"
          role="img"
          style={{ background: `conic-gradient(${conicStops})` }}
        >
          <div className="flex h-[70px] w-[70px] flex-col items-center justify-center rounded-full bg-white">
            <span className="text-[17px] font-semibold text-slate-800">{total}</span>
            <span className="text-[8px] text-slate-500">Total</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {types.map((item) => (
            <li className="flex items-center gap-1 text-[8px] text-slate-600" key={item.label}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="whitespace-nowrap text-slate-500">{item.value} ({Math.round(item.value / total * 100)}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function SecurityIncidentStatus({ status }) {
  const style = status === 'Open'
    ? 'bg-rose-100 text-rose-700'
    : status === 'Under Investigation'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-emerald-100 text-emerald-700'
  return <span className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[8px] font-semibold ${style}`}>{status}</span>
}

function SecuritySeverity({ severity }) {
  const style = severity === 'High'
    ? 'bg-rose-100 text-rose-700'
    : severity === 'Medium'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-blue-100 text-blue-700'
  return <span className={`inline-flex rounded-md px-2 py-1 text-[8px] font-semibold ${style}`}>{severity}</span>
}

function SecurityMonitoring() {
  const [incidents, setIncidents] = useState(securityExamples)
  const [selectedId, setSelectedId] = useState(securityExamples[0].id)
  const [tab, setTab] = useState('overview')
  const [draftFilters, setDraftFilters] = useState({
    search: '',
    type: 'all',
    status: 'all',
    severity: 'all',
    from: '2026-10-13',
    to: '2026-10-20',
  })
  const [filters, setFilters] = useState(draftFilters)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [range, setRange] = useState('7d')
  const [showAllUsers, setShowAllUsers] = useState(false)
  const selectedIncident = incidents.find((incident) => incident.id === selectedId)

  const matchingIncidents = incidents.filter((incident) => {
    const content = `${incident.id} ${incident.type} ${incident.description} ${incident.user} ${incident.userId} ${incident.documentId}`.toLowerCase()
    const date = incident.time.slice(0, 10)
    return (!filters.search || content.includes(filters.search.trim().toLowerCase())) &&
      (filters.type === 'all' || incident.type === filters.type) &&
      (filters.status === 'all' || incident.status === filters.status) &&
      (filters.severity === 'all' || incident.severity === filters.severity) &&
      (!filters.from || date >= filters.from) &&
      (!filters.to || date <= filters.to)
  })
  const pageCount = Math.max(1, Math.ceil(matchingIncidents.length / pageSize))
  const visibleIncidents = matchingIncidents.slice((page - 1) * pageSize, page * pageSize)

  function applyStatus(status) {
    if (!selectedIncident) return
    setIncidents((current) => current.map((incident) => (
      incident.id === selectedIncident.id ? { ...incident, status } : incident
    )))
  }

  function applyFilters(event) {
    event.preventDefault()
    setFilters(draftFilters)
    setPage(1)
  }

  function clearFilters() {
    const cleared = { search: '', type: 'all', status: 'all', severity: 'all', from: '', to: '' }
    setDraftFilters(cleared)
    setFilters(cleared)
    setRange('all')
    setPage(1)
  }

  function updateRange(value) {
    setRange(value)
    updateIncidentDateRange(value)
  }

  function updateIncidentDateRange(value) {
    const dates = value === '7d'
      ? { from: '2026-10-13', to: '2026-10-20' }
      : value === '30d'
        ? { from: '2026-09-20', to: '2026-10-20' }
        : { from: '', to: '' }
    setDraftFilters((current) => ({ ...current, ...dates }))
    setFilters((current) => ({ ...current, ...dates }))
    setPage(1)
  }

  function selectUser(name) {
    setDraftFilters((current) => ({ ...current, search: name }))
    setFilters((current) => ({ ...current, search: name }))
    setPage(1)
  }

  const topUsers = [
    { name: 'Rahul Kumar', id: 'USER-305', count: 28, color: 'bg-blue-600' },
    { name: 'Anil Rao', id: 'USER-412', count: 16, color: 'bg-violet-600' },
    { name: 'Neha Singh', id: 'USER-518', count: 12, color: 'bg-blue-600' },
    { name: 'Vikas Jain', id: 'USER-330', count: 9, color: 'bg-violet-600' },
    { name: 'Amit Sharma', id: 'USER-220', count: 7, color: 'bg-slate-500' },
  ]
  const displayedUsers = showAllUsers ? [...topUsers, { name: 'Karan Patel', id: 'USER-514', count: 5, color: 'bg-blue-600' }] : topUsers

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Security Monitoring</h1>
          <p className="mt-0.5 text-[10px] text-slate-500">Detect and investigate potentially suspicious activity across SureDocs.</p>
        </div>
        <label className="flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-600 shadow-sm">
          <Icon className="h-3 w-3" name="calendar" />
          <span className="sr-only">Security monitoring date range</span>
          <select aria-label="Security monitoring date range" className="max-w-[160px] bg-transparent outline-none" onChange={(event) => updateRange(event.target.value)} value={range}>
            <option value="7d">Oct 13, 2026 – Oct 20, 2026</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All available dates</option>
          </select>
        </label>
      </div>

      <section aria-label="Security incident metrics" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Security Incidents', value: '12', trend: '↑ 33%', sub: 'vs last week', icon: 'warning', color: 'text-rose-600', bubble: 'bg-rose-100' },
          { label: 'Failed Login Attempts', value: '148', trend: '↑ 20%', sub: 'vs last week', icon: 'user', color: 'text-amber-600', bubble: 'bg-amber-100' },
          { label: 'Unauthorized Access Attempts', value: '82', trend: '↑ 45%', sub: 'vs last week', icon: 'security', color: 'text-blue-600', bubble: 'bg-blue-100' },
          { label: 'Unusual Downloads', value: '6', trend: '↑ 200%', sub: 'vs last week', icon: 'download', color: 'text-violet-600', bubble: 'bg-violet-100' },
          { label: 'Sensitive Permission Changes', value: '9', trend: '↓ 50%', sub: 'vs last week', icon: 'permissions', color: 'text-emerald-600', bubble: 'bg-emerald-100' },
          { label: 'Incidents Resolved', value: '8', trend: '→ 0%', sub: 'this week', icon: 'check', color: 'text-slate-600', bubble: 'bg-slate-100' },
        ].map((metric) => (
          <article className="flex min-h-[70px] min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm" key={metric.label}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${metric.bubble} ${metric.color}`}>
              <Icon className="h-4 w-4" name={metric.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[8px] font-semibold ${metric.color}`}>{metric.label}</p>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span className="text-[18px] font-semibold leading-none text-slate-800">{metric.value}</span>
                <span className={`whitespace-nowrap text-[7px] font-semibold ${metric.trend.startsWith('↓') ? 'text-emerald-600' : metric.trend.startsWith('→') ? 'text-slate-500' : 'text-rose-600'}`}>{metric.trend}</span>
              </div>
              <p className="mt-0.5 text-[7px] text-slate-500">{metric.sub}</p>
            </div>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[1.25fr_1fr_0.9fr]">
        <SecurityTrendChart />
        <SecurityTypeChart />
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold text-slate-800">Top Users by Suspicious Activity</h2>
            <button className="text-[8px] font-medium text-blue-700 hover:text-blue-900" onClick={() => setShowAllUsers((current) => !current)} type="button">
              {showAllUsers ? 'Show less' : 'View All'}
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {displayedUsers.map((user) => (
              <button className="flex w-full items-center gap-1.5 text-left" key={user.id} onClick={() => selectUser(user.name)} type="button">
                <PersonBadge color={user.color} name={user.name} />
                <span className="min-w-0 flex-1 truncate text-[8px] font-medium text-slate-700">{user.name}</span>
                <span className="text-[7px] text-slate-400">{user.id}</span>
                <span className="whitespace-nowrap text-[8px] font-semibold text-rose-600">{user.count} events</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm" onSubmit={applyFilters}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search security incidents</span>
            <Icon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" name="search" />
            <input
              className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[9px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search by user, document, event ID, or description..."
              type="search"
              value={draftFilters.search}
            />
          </label>
          <button className="h-8 rounded-md bg-blue-600 px-3 text-[9px] font-semibold text-white hover:bg-blue-700" type="submit">Apply Filters</button>
          <button className="h-8 rounded-md border border-slate-200 px-3 text-[9px] font-medium text-slate-600 hover:bg-slate-50" onClick={clearFilters} type="button">Clear</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
          {[
            { name: 'type', label: 'Event Type', options: [...new Set(incidents.map((incident) => incident.type))], placeholder: 'All Types' },
            { name: 'status', label: 'Status', options: ['Open', 'Under Investigation', 'Resolved'], placeholder: 'All Statuses' },
            { name: 'severity', label: 'Severity', options: ['High', 'Medium', 'Low'], placeholder: 'All Severities' },
          ].map((filter) => (
            <label className="block min-w-0" key={filter.name}>
              <span className="mb-1 block text-[8px] font-medium text-slate-600">{filter.label}</span>
              <select aria-label={filter.label} className="h-7 w-full rounded-md border border-slate-200 bg-white px-2 text-[9px] text-slate-700 outline-none focus:border-blue-400" onChange={(event) => setDraftFilters((current) => ({ ...current, [filter.name]: event.target.value }))} value={draftFilters[filter.name]}>
                <option value="all">{filter.placeholder}</option>
                {filter.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          <label className="block min-w-0">
            <span className="mb-1 block text-[8px] font-medium text-slate-600">Date Range</span>
            <span className="relative block">
              <Icon className="pointer-events-none absolute left-2 top-2 h-3 w-3 text-slate-500" name="calendar" />
              <select aria-label="Incident date range" className="h-7 w-full rounded-md border border-slate-200 bg-white pl-6 pr-1 text-[8px] text-slate-700 outline-none focus:border-blue-400" onChange={(event) => updateIncidentDateRange(event.target.value)} value={range}>
                <option value="7d">Oct 13, 2026 – Oct 20, 2026</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All available dates</option>
              </select>
            </span>
          </label>
        </div>
      </form>

      <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-[minmax(0,1.8fr)_minmax(290px,0.9fr)]">
        <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-100 px-2.5 py-2">
            <div>
              <h2 className="text-[11px] font-semibold text-slate-800">Security Incidents</h2>
              <p className="text-[8px] text-slate-500">Showing {matchingIncidents.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matchingIncidents.length)}` : '0'} of {matchingIncidents.length} security incidents</p>
            </div>
            <button aria-label="Toggle incident list" className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setPage((current) => current)} type="button">
              <Icon className="h-3 w-3 rotate-180" name="chevron" />
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead className="bg-slate-50">
                <tr className="text-[8px] font-semibold text-slate-600">
                  <th className="w-7 px-1.5 py-2"><input aria-label="Select all incidents" type="checkbox" /></th>
                  <th className="px-1.5 py-2">Time (UTC)</th>
                  <th className="px-1.5 py-2">Type</th>
                  <th className="px-1.5 py-2">Description</th>
                  <th className="px-1.5 py-2">Affected User / Resource</th>
                  <th className="px-1.5 py-2">Severity</th>
                  <th className="px-1.5 py-2">Status</th>
                  <th className="px-1.5 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleIncidents.map((incident) => {
                  const timestamp = new Date(incident.time)
                  return (
                    <tr
                      aria-selected={selectedId === incident.id}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-blue-50/60 ${selectedId === incident.id ? 'bg-blue-50/40' : ''}`}
                      key={incident.id}
                      onClick={() => { setSelectedId(incident.id); setTab('overview') }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedId(incident.id)
                        }
                      }}
                      tabIndex={0}
                    >
                      <td className="px-1.5 py-1.5"><input aria-label={`Select incident ${incident.id}`} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>
                      <td className="whitespace-nowrap px-1.5 py-1.5 text-[7px] text-slate-600">
                        <span className="block">{new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(timestamp)}</span>
                        <span className="block">{new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(timestamp)} UTC</span>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <span className="flex min-w-[108px] items-center gap-1 text-[7px] text-slate-700">
                          <Icon className={`h-3 w-3 shrink-0 ${incident.severity === 'High' ? 'text-violet-600' : incident.type.includes('Failed') ? 'text-amber-500' : 'text-emerald-600'}`} name={incident.icon} />
                          {incident.type}
                        </span>
                      </td>
                      <td className="max-w-[130px] px-1.5 py-1.5 text-[7px] leading-3 text-slate-600">{incident.description}</td>
                      <td className="px-1.5 py-1.5">
                        <span className="flex min-w-[90px] items-center gap-1">
                          <PersonBadge color="bg-slate-500" name={incident.user} />
                          <span className="min-w-0"><span className="block truncate text-[7px] text-slate-700">{incident.user}</span><span className="block text-[7px] text-slate-400">{incident.userId}</span></span>
                        </span>
                      </td>
                      <td className="px-1.5 py-1.5"><SecuritySeverity severity={incident.severity} /></td>
                      <td className="px-1.5 py-1.5"><SecurityIncidentStatus status={incident.status} /></td>
                      <td className="px-1.5 py-1.5 text-center">
                        <button aria-label={`View incident ${incident.id}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); setSelectedId(incident.id) }} type="button"><Icon className="h-3.5 w-3.5" name="more" /></button>
                      </td>
                    </tr>
                  )
                })}
                {visibleIncidents.length === 0 && <tr><td className="px-3 py-8 text-center text-[9px] text-slate-500" colSpan={8}>No security incidents match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-2.5 py-2">
            <span className="text-[8px] text-slate-500">{matchingIncidents.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matchingIncidents.length)} of ${matchingIncidents.length}` : '0 results'}</span>
            <div className="flex items-center gap-1">
              <button aria-label="Previous incidents page" className="rounded border border-slate-200 px-1.5 py-0.5 text-[8px] disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">‹</button>
              <span className="rounded bg-blue-600 px-2 py-0.5 text-[8px] font-semibold text-white">{page}</span>
              <button aria-label="Next incidents page" className="rounded border border-slate-200 px-1.5 py-0.5 text-[8px] disabled:opacity-40" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">›</button>
            </div>
          </footer>
        </section>

        {selectedIncident && (
          <aside aria-label="Incident details" className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-rose-50/60 px-2.5 py-2">
              <h2 className="text-[10px] font-semibold text-slate-800">Incident Details</h2>
              <div className="flex items-center gap-1.5">
                <SecurityIncidentStatus status={selectedIncident.status} />
                <button aria-label="Close incident details" className="rounded p-0.5 text-slate-500 hover:bg-white" onClick={() => setSelectedId('')} type="button"><Icon className="h-3 w-3" name="close" /></button>
              </div>
            </header>
            <div className="p-2.5">
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600"><Icon className="h-3.5 w-3.5" name={selectedIncident.icon} /></span>
                <div className="min-w-0">
                  <h3 className="text-[9px] font-semibold text-slate-800">{selectedIncident.type}</h3>
                  <p className="mt-0.5 text-[7px] leading-3 text-slate-500">{selectedIncident.description}</p>
                  <p className="mt-0.5 text-[7px] text-slate-500">Incident ID: {selectedIncident.id}</p>
                </div>
              </div>
              <div aria-label="Incident detail tabs" className="mt-2 flex overflow-x-auto border-b border-slate-200">
                {[
                  { id: 'overview', label: 'Overview' },
                  { id: 'related', label: 'Related Audit Events' },
                  { id: 'investigation', label: 'Investigation' },
                  { id: 'timeline', label: 'Timeline' },
                ].map((item) => (
                  <button aria-selected={tab === item.id} className={`whitespace-nowrap border-b-2 px-2 py-2 text-[7px] font-medium ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`} key={item.id} onClick={() => setTab(item.id)} role="tab" type="button">{item.label}</button>
                ))}
              </div>
              {tab === 'overview' && (
                <>
                  <dl className="mt-2 space-y-1.5">
                    {[
                      ['Incident Type', selectedIncident.type],
                      ['Severity', selectedIncident.severity],
                      ['Status', selectedIncident.status],
                      ['Detected At', auditDateTime(selectedIncident.time)],
                      ['Affected User', `${selectedIncident.user} (${selectedIncident.userId})`],
                      ['Source IP Address', selectedIncident.sourceIp],
                      ...(selectedIncident.documentId ? [['Document', `${selectedIncident.documentId} — ${selectedIncident.documentName}`]] : []),
                      ['Description', selectedIncident.description],
                      ['Reason', selectedIncident.reason],
                      ['Related Events', `${selectedIncident.attempts} events`],
                      ['First Attempt', auditDateTime(selectedIncident.time)],
                      ['Last Attempt', auditDateTime(selectedIncident.time)],
                    ].map(([label, value]) => (
                      <div className="grid grid-cols-[74px_minmax(0,1fr)] gap-1 text-[7px] leading-3" key={label}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className={`break-words ${label === 'Severity' ? 'font-semibold' : ''} ${label === 'Severity' && value === 'High' ? 'text-rose-700' : label === 'Severity' && value === 'Medium' ? 'text-amber-700' : 'text-slate-700'}`}>
                          {label === 'Severity' ? <SecuritySeverity severity={value} /> : label === 'Status' ? <SecurityIncidentStatus status={value} /> : label === 'Affected User' ? <span className="flex items-center gap-1"><PersonBadge color="bg-blue-600" name={selectedIncident.user} />{value}</span> : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {selectedIncident.documentId && (
                    <section className="mt-2 rounded-md border border-slate-200 p-2">
                      <h3 className="text-[8px] font-semibold text-slate-700">Related Document</h3>
                      <p className="mt-1 text-[7px] text-slate-600">{selectedIncident.documentId} · {selectedIncident.documentName}</p>
                      <p className="text-[7px] text-slate-500">Owner: Priya Sharma · Category: HR</p>
                    </section>
                  )}
                </>
              )}
              {tab === 'related' && (
                <div className="mt-2 space-y-2">
                  <h3 className="text-[8px] font-semibold text-slate-700">Related Audit Events ({selectedIncident.attempts})</h3>
                  {[0, 1, 2].map((item) => (
                    <div className="flex items-start gap-1.5 rounded border border-slate-100 p-1.5" key={item}>
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                      <span><span className="block text-[7px] text-slate-700">{selectedIncident.type} — {selectedIncident.user}</span><span className="block text-[7px] text-slate-500">{auditDateTime(new Date(new Date(selectedIncident.time).getTime() + item * 60000).toISOString())}</span></span>
                    </div>
                  ))}
                  <p className="text-[7px] text-slate-500">Showing a sample of the related mock audit events.</p>
                </div>
              )}
              {tab === 'investigation' && (
                <div className="mt-2">
                  <h3 className="text-[8px] font-semibold text-slate-700">Investigation Notes</h3>
                  <textarea aria-label="Investigation notes" className="mt-1 h-16 w-full resize-y rounded border border-slate-200 p-2 text-[8px] outline-none focus:border-blue-400" placeholder="Add investigation notes..." />
                  <p className="mt-1 text-[7px] text-slate-500">Notes are temporary in this mock preview.</p>
                </div>
              )}
              {tab === 'timeline' && (
                <div className="mt-2 space-y-2">
                  <h3 className="text-[8px] font-semibold text-slate-700">Incident Timeline</h3>
                  {[
                    ['Incident detected', selectedIncident.time],
                    ['Alert reviewed', new Date(new Date(selectedIncident.time).getTime() + 5 * 60000).toISOString()],
                    ...(selectedIncident.status === 'Resolved' ? [['Incident resolved', new Date(new Date(selectedIncident.time).getTime() + 18 * 60000).toISOString()]] : []),
                  ].map(([label, time]) => (
                    <div className="flex gap-1.5" key={label}>
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                      <p className="text-[7px] text-slate-700">{label}<span className="block text-slate-500">{auditDateTime(time)}</span></p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                {selectedIncident.status !== 'Under Investigation' && selectedIncident.status !== 'Resolved' && (
                  <button className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-[7px] font-semibold text-slate-700 hover:bg-slate-50" onClick={() => applyStatus('Under Investigation')} type="button">Mark as Under Investigation</button>
                )}
                {selectedIncident.status !== 'Resolved' && (
                  <button className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-[7px] font-semibold text-white hover:bg-blue-700" onClick={() => applyStatus('Resolved')} type="button">Mark as Resolved</button>
                )}
                {selectedIncident.status === 'Resolved' && (
                  <button className="flex-1 rounded border border-blue-200 px-2 py-1.5 text-[7px] font-semibold text-blue-700 hover:bg-blue-50" onClick={() => applyStatus('Open')} type="button">Reopen Incident</button>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
      <p className="text-[8px] text-slate-400">Security incidents and trends are illustrative mock data and are not connected to live monitoring or security controls.</p>
    </div>
  )
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
        This section is ready for the next implementation step. The dashboard currently uses
        illustrative mock data and is not connected to user or document records.
      </p>
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
    ? 'Administrator dashboard'
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
  }, [])

  function openDocument(documentId) {
    window.history.pushState({}, '', `/admin/documents/${encodeURIComponent(documentId)}`)
    setSelectedDocumentId(documentId)
    window.scrollTo({ top: 0 })
  }

  function closeDocument() {
    window.history.pushState({}, '', '/admin/documents')
    setSelectedDocumentId(null)
    window.scrollTo({ top: 0 })
  }

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
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 lg:pl-[248px]">
      <Sidebar pathname={pathname} />
      <div className="min-h-screen">
        <TopBar user={user} />
        <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          {!isDocuments && !isPermissions && !isAudit && !isSecurity && <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              {!isUserManagement && (
                <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-blue-700">
                  SureDocs management console
                </p>
              )}
              <h1 className={`${isUserManagement ? 'text-2xl sm:text-[26px]' : 'mt-1 text-[22px]'} font-semibold tracking-tight text-slate-900`}>
                {title}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {isDashboard
                  ? 'Overview of users, documents, permissions, and security activity.'
                  : isUserManagement
                    ? 'Manage user accounts, roles, and account status.'
                    : 'Administrator workspace'}
              </p>
            </div>
            {isUserManagement && (
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                <span aria-hidden="true" className="text-lg leading-none">+</span>
                Create / Invite User
              </button>
            )}
          </div>}
          {createdNotice && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800" role="status">
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
            <DashboardContent />
          ) : isUserManagement ? (
            <AdminUsersPage
              initialFilter={
                new URLSearchParams(window.location.search).get('filter') ?? 'all'
              }
              refreshKey={refreshKey}
            />
          ) : isDocuments ? (
            <DocumentsWorkspace
              mode="registry"
              user={user}
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
            <SecurityMonitoring />
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

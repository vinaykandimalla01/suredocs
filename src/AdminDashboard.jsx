import { useEffect, useState } from 'react'

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
      <div className="mt-auto hidden border-t border-slate-800 px-5 py-4 text-xs text-slate-500 lg:block">
        Administrator preview · mock data
      </div>
    </aside>
  )
}

function TopBar() {
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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            AD
          </span>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-slate-800">Administrator</p>
            <p className="text-[11px] text-slate-500">Admin preview</p>
          </div>
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
  const users = loadMockUsers()
  const activeUsers = users.filter((user) => user.status === 'Active').length
  const disabledUsers = users.filter((user) => user.status === 'Disabled').length

  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Accounts in the platform"
          href="/admin/users?filter=all"
          icon="users"
          label="Total registered users"
          tone="bg-blue-50 text-blue-700"
          value={String(users.length)}
        />
        <MetricCard
          detail="Files shared across SureDocs"
          href="/admin/documents"
          icon="documents"
          label="Total documents"
          tone="bg-violet-50 text-violet-700"
          value="482"
        />
        <MetricCard
          detail="Enabled users who have signed in"
          href="/admin/users?filter=active"
          icon="check"
          label="Active accounts"
          tone="bg-emerald-50 text-emerald-700"
          value={String(activeUsers)}
        />
        <MetricCard
          detail="Suspended by an administrator"
          href="/admin/users?filter=disabled"
          icon="security"
          label="Disabled accounts"
          tone="bg-rose-50 text-rose-700"
          value={String(disabledUsers)}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,5fr)]">
        <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            detail="Approximate document storage used"
            icon="storage"
            label="Storage used"
            tone="bg-sky-50 text-sky-700"
            value="23 GB"
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
    description: 'Review registered accounts and their access status.',
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

function CreateUserModal({ onClose, onCreate, passwords }) {
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

export default function AdminDashboard() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/admin'
  const isDashboard = pathname === '/admin' || pathname === '/admin/index.html'
  const isUserManagement = pathname.startsWith('/admin/users')
  const isDocuments = pathname.startsWith('/admin/documents')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState(() => {
    const match = window.location.pathname.match(/^\/admin\/documents\/([^/]+)$/)
    return match ? decodeURIComponent(match[1]) : null
  })
  const title = isDashboard
    ? 'Administrator dashboard'
    : sectionDetails[Object.keys(sectionDetails).find((path) => pathname.startsWith(path))]?.title ??
      'Administrator dashboard'

  useEffect(() => {
    document.title = `${isDocuments && selectedDocumentId ? 'Document Details' : title} | SureDocs`
  }, [isDocuments, selectedDocumentId, title])

  useEffect(() => {
    function syncDocumentRoute() {
      const match = window.location.pathname.match(/^\/admin\/documents\/([^/]+)$/)
      setSelectedDocumentId(match ? decodeURIComponent(match[1]) : null)
    }

    window.addEventListener('popstate', syncDocumentRoute)
    return () => window.removeEventListener('popstate', syncDocumentRoute)
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

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900 lg:pl-[248px]">
      <Sidebar pathname={pathname} />
      <div className="min-h-screen">
        <TopBar />
        <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          {!isDocuments && <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
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
                    : 'Administrator workspace · mock preview'}
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
            {isDashboard && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Mock data · backend not connected
              </div>
            )}
          </div>}
          {isDashboard ? (
            <DashboardContent />
          ) : isUserManagement ? (
            <UserManagement
              createOpen={createOpen}
              initialFilter={
                new URLSearchParams(window.location.search).get('filter') ?? 'all'
              }
              setCreateOpen={setCreateOpen}
            />
          ) : isDocuments ? (
            <DocumentRegistry
              initialDocumentId={selectedDocumentId}
              onCloseDocument={closeDocument}
              onOpenDocument={openDocument}
            />
          ) : (
            <SectionPlaceholder pathname={pathname} />
          )}
        </main>
      </div>
    </div>
  )
}

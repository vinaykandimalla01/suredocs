import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import UserAvatar from './UserAvatar.jsx'
import {
  activityDistribution, activityMetrics, auditActionDistribution, auditMetrics, auditRecords,
  buildTrendData, documentPermissions, failedLogins, initialSecuritySettings, initialSessions,
  loginHistory, overviewMetrics, permissionHistory, permissionOverview, platformPermissions,
  buildUserProfile, profileDocuments, profileFixture, recentActivity, resources, securityEvents, securityOverview,
} from './userProfileMockData.js'
import './UserProfileModal.css'

const tabs = ['Overview', 'Permissions', 'Documents', 'Activity', 'Security', 'Audit Logs']
const pageSize = 8

function Icon({ name, size = 14 }) {
  const paths = {
    close: <path d="m18 6-12 12M6 6l12 12" />,
    more: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    download: <><path d="M12 4v12m0 0 5-5m-5 5-5-5" /><path d="M4 19h16" /></>,
    share: <><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></>,
    edit: <><path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
    document: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    blocked: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    filter: <path d="M4 5h16l-6.2 7.2v5L10 19v-6.8L4 5Z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    down: <path d="m7 10 5 5 5-5" />,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    badge: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    device: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    refresh: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0 1 4" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.document}</svg>
}

function Button({ children, onClick, secondary = false, danger = false, className = '', type = 'button', disabled = false, ...props }) {
  return <button className={`profile-button${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}${className ? ` ${className}` : ''}`} disabled={disabled} onClick={onClick} type={type} {...props}>{children}</button>
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`profile-badge ${tone}`}>{children}</span>
}

function Card({ title, subtitle, action, className = '', children, id }) {
  return <section className={`profile-card${className ? ` ${className}` : ''}`} id={id}>
    {(title || action) && <header className="profile-card-heading"><div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>{action}</header>}
    {children}
  </section>
}

function SectionTitle({ icon = 'document', title, subtitle, action }) {
  return <div className="profile-section-title"><span className="profile-section-icon"><Icon name={icon} size={17} /></span><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action && <div className="profile-section-action">{action}</div>}</div>
}

function MetricCard({ item }) {
  return <article className={`profile-metric ${item.tone}`}><span className="profile-metric-icon"><Icon name={item.icon} size={18} /></span><div className="profile-metric-copy"><span>{item.label}</span><strong>{item.value}</strong></div><Badge tone={item.tone}>{item.trend}</Badge><i aria-hidden="true" className="profile-metric-spark" /></article>
}

function MetricGrid({ items, columns }) {
  return <div className={`profile-metrics columns-${columns ?? items.length}`}>{items.map((item) => <MetricCard item={item} key={item.label} />)}</div>
}

function Table({ columns, rows, empty = 'No matching records.', className = '' }) {
  return <div className={`profile-table-scroll ${className}`}><table className="profile-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${index}`}>{cell}</td>)}</tr>) : <tr><td className="profile-empty" colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>
}

function Select({ label, value, onChange, options, className = '' }) {
  return <label className={`profile-select ${className}`}><span className="sr-only">{label}</span><select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><Icon name="down" size={11} /></label>
}

function LocalDialog({ title, children, onClose, footer, narrow = false, alert = false }) {
  return <div className="profile-local-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section aria-labelledby="profile-local-title" aria-modal="true" className={`profile-local-dialog${narrow ? ' narrow' : ''}${alert ? ' alert' : ''}`} role="dialog">
      <header><h3 id="profile-local-title">{title}</h3><button aria-label="Close dialog" className="profile-icon-button" onClick={onClose} type="button"><Icon name="close" /></button></header>
      <div className="profile-local-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  </div>
}

function StatDonut({ data, total, centerLabel = 'Total', legend = 'horizontal', compact = false }) {
  return <div className={`profile-donut-layout ${legend} ${compact ? 'compact' : ''}`}>
    <div className="profile-donut-plot"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius="67%" outerRadius="93%" paddingAngle={2} stroke="none">{data.map((item) => <Cell fill={item.color} key={item.name} />)}</Pie><Tooltip formatter={(value, name) => [`${value} (${Math.round((Number(value) / total) * 100)}%)`, name]} contentStyle={{ border: '1px solid #e5eaf1', borderRadius: 8, fontSize: 10, boxShadow: '0 5px 18px #17233f1a' }} /></PieChart></ResponsiveContainer><div className="profile-donut-center"><strong>{total}</strong><span>{centerLabel}</span></div></div>
    <div className="profile-donut-legend">{data.map((item) => <div key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value}</b><small>{Math.round((item.value / total) * 100)}%</small></div>)}</div>
  </div>
}

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="profile-chart-tooltip"><b>{label}</b>{payload.map((item) => <span key={item.dataKey}><i style={{ background: item.color }} />{item.name}: <strong>{item.value}</strong></span>)}</div>
}

function TrendChart({ data, audit = false }) {
  const series = audit
    ? [{ key: 'success', name: 'Success', color: '#16a36a' }, { key: 'denied', name: 'Denied', color: '#f04452' }]
    : [{ key: 'uploads', name: 'Uploads', color: '#2878f0' }, { key: 'downloads', name: 'Downloads', color: '#16a36a' }, { key: 'edits', name: 'Edits', color: '#f59e0b' }, { key: 'deletions', name: 'Deletions', color: '#f04452' }]
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 9, right: 7, left: -20, bottom: 0 }}>
    <defs>{series.map((item) => <linearGradient id={`fill-${item.key}`} key={item.key} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity={0.18} /><stop offset="100%" stopColor={item.color} stopOpacity={0.015} /></linearGradient>)}</defs>
    <CartesianGrid stroke="#edf1f6" strokeDasharray="2 3" vertical={false} />
    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8491a6', fontSize: 8 }} minTickGap={18} />
    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8491a6', fontSize: 8 }} width={27} />
    <Tooltip content={<LineTooltip />} />
    {series.map((item) => <Area key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={1.8} fill={`url(#fill-${item.key})`} dot={{ r: 2, strokeWidth: 1, fill: '#fff' }} activeDot={{ r: 3.5 }} />)}
  </AreaChart></ResponsiveContainer>
}

function KeyValue({ label, children }) { return <div className="profile-kv"><span>{label}</span><strong>{children}</strong></div> }

function formatTimestamp(value) {
  if (!value?.includes('T')) return value
  return new Date(value).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function ProfileOverview({ profile, onProfileUpdate, permissions, onRoleClick, onTabChange }) {
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(profile)
  const recentRows = recentActivity.slice(0, 4).map((item) => ({ id: item.id, cells: [<b className="profile-doc-name" key="name">{item.document}</b>, <Badge key="action" tone={item.action === 'Deleted' ? 'red' : 'blue'}>{item.action}</Badge>, formatTimestamp(item.timestamp)] }))
  return <div className="profile-tab-content">
    <MetricGrid items={overviewMetrics} columns={4} />
    <div className="profile-overview-grid">
      <Card title="Personal Information" action={<Button secondary onClick={() => { setForm(profile); setEditOpen(true) }}><Icon name="edit" size={12} /> Edit</Button>}>
        <div className="profile-information-grid">
          <KeyValue label="Full Name">{profile.name}</KeyValue><KeyValue label="Email Address">{profile.email}</KeyValue>
          <KeyValue label="Phone Number">{profile.phone}</KeyValue><KeyValue label="Employee ID">{profile.employeeId}</KeyValue>
          <KeyValue label="Job Title">{profile.jobTitle}</KeyValue><KeyValue label="Department">{profile.department}</KeyValue>
          <KeyValue label="Reporting Manager">{profile.manager}</KeyValue>
        </div>
      </Card>
      <Card title="Account Information">
        <div className="profile-information-grid account-grid"><KeyValue label="Account Status"><Badge tone={profile.status === 'Active' ? 'green' : profile.status === 'Pending' ? 'orange' : 'red'}>{profile.status}</Badge></KeyValue><KeyValue label="Role">{profile.role}</KeyValue><KeyValue label="Account Created">{profileFixture.joined}</KeyValue><KeyValue label="Invitation Sent">{profileFixture.joined}</KeyValue><KeyValue label="Invitation Accepted">{profile.status === 'Pending' ? 'Pending' : profileFixture.joined}</KeyValue><KeyValue label="Last Login">{profileFixture.lastLogin}</KeyValue><KeyValue label="Last Activity">{profileFixture.lastActivity}</KeyValue></div>
      </Card>
      <Card className="overview-permissions-card" title="Role & Permissions" action={<Button secondary onClick={onRoleClick}>Change Role</Button>}>
        <div className="overview-permission-list">{permissions.slice(0, 8).map((permission) => <span key={permission.id} className={permission.granted ? 'granted' : 'restricted'}><i>{permission.granted ? '✓' : '×'}</i>{permission.name}</span>)}</div>
      </Card>
      <Card className="overview-recent-card" title="Recent Document Activity" action={<button className="profile-link-button" onClick={() => onTabChange('Activity')} type="button">View All <Icon name="arrow" size={11} /></button>}>
        <Table columns={['Document Name', 'Action', 'Timestamp']} rows={recentRows} />
      </Card>
    </div>
    {editOpen && <LocalDialog title="Edit personal information" onClose={() => setEditOpen(false)} footer={<><Button secondary onClick={() => setEditOpen(false)}>Cancel</Button><Button form="profile-personal-form" type="submit">Save changes</Button></>}>
      <form className="profile-form-grid" id="profile-personal-form" onSubmit={(event) => { event.preventDefault(); onProfileUpdate(form); setEditOpen(false) }}>{[['name', 'Full Name'], ['email', 'Email Address'], ['phone', 'Phone Number'], ['employeeId', 'Employee ID'], ['jobTitle', 'Job Title'], ['department', 'Department'], ['manager', 'Reporting Manager']].map(([key, label]) => <label key={key}>{label}<input required type={key === 'email' ? 'email' : 'text'} value={form[key] ?? ''} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</form>
    </LocalDialog>}
  </div>
}

function PermissionGrid({ title, rows, onToggle }) {
  return <Card title={title} className="permission-table-card"><div className="permission-row permission-head"><span>Permission</span><span>Description</span><span>Status</span></div>{rows.map((permission) => <div className="permission-row" key={permission.id}><span><i className={`permission-icon ${permission.granted ? 'yes' : 'no'}`}>{permission.granted ? '✓' : '×'}</i>{permission.name}</span><small>{permission.description}</small><button aria-label={`${permission.granted ? 'Revoke' : 'Grant'} ${permission.name}`} className="permission-toggle-cell" onClick={() => onToggle(permission)} type="button"><Badge tone={permission.granted ? 'green' : 'red'}>{permission.granted ? 'Granted' : 'Restricted'}</Badge></button></div>)}</Card>
}

function PermissionsTab({ permissions, setPermissions, role, department, onNotice }) {
  const [expanded, setExpanded] = useState(null)
  const [pendingPermission, setPendingPermission] = useState(null)
  const statsPermissions = permissions.filter((item) => !['view-health', 'manage-storage'].includes(item.id))
  const counts = [
    { name: 'Granted', value: statsPermissions.filter((item) => item.granted).length, color: '#16a36a' },
    { name: 'Restricted', value: statsPermissions.filter((item) => !item.granted).length, color: '#f04452' },
    { name: 'Custom', value: 0, color: '#2878f0' },
  ]
  const toggle = (permission) => setPendingPermission(permission)
  const confirmPermission = () => {
    const target = pendingPermission
    setPermissions((current) => current.map((item) => item.id === target.id ? { ...item, granted: !target.granted } : item))
    onNotice(`${target.name} ${target.granted ? 'restricted' : 'granted'} in this local profile.`)
    setPendingPermission(null)
  }
  return <div className="profile-tab-content">
    <div className="permissions-top-grid"><Card title="Permission Overview" subtitle="Summary of this user's role, access scope and permissions."><div className="permission-overview-grid">{permissionOverview.map((item, index) => <div key={item.label}><span className="profile-soft-icon"><Icon name={item.icon} size={14} /></span><small>{item.label}</small><b>{index === 0 ? role : item.label === 'Access Scope' ? `${department} Dept.` : item.value}</b>{item.detail && <small>{item.detail}</small>}</div>)}</div></Card><Card title="Permission Stats"><StatDonut data={counts} total={counts.reduce((sum, item) => sum + item.value, 0)} compact /></Card></div>
    <div className="permissions-tables-grid"><PermissionGrid title="Document Permissions" rows={permissions.filter((item) => documentPermissions.some((doc) => doc.id === item.id))} onToggle={toggle} /><PermissionGrid title="Platform Permissions" rows={permissions.filter((item) => platformPermissions.some((platform) => platform.id === item.id))} onToggle={toggle} /></div>
    <div className="permissions-bottom-grid"><Card title="Resource & Department Access" subtitle="Documents and resources this user can access."><div className="resource-list">{resources.map((resource) => <div className="resource-item" key={resource.id}><button aria-expanded={expanded === resource.id} onClick={() => setExpanded(expanded === resource.id ? null : resource.id)} type="button"><span className="profile-soft-icon"><Icon name={resource.id === 'engineering' ? 'building' : 'share'} /></span><span><b>{resource.title}</b><small>{resource.documents} documents · {resource.description}</small></span><Icon name="chevron" /></button>{expanded === resource.id && <div className="resource-expanded"><span>Accessible owners</span>{resource.owners.map((owner) => <Badge key={owner} tone="blue">{owner}</Badge>)}</div>}</div>)}</div></Card><Card title="Permission Change History" action={<button className="profile-link-button" onClick={() => onNotice('Showing the latest local permission history.')} type="button">View All</button>}><Table columns={['Date', 'Action', 'Changed By', 'Details']} rows={permissionHistory.map((row) => ({ id: row.id, cells: [row.date, row.action, row.by, row.details] }))} /></Card></div>
    {pendingPermission && <LocalDialog alert title="Confirm permission change" onClose={() => setPendingPermission(null)} footer={<><Button secondary onClick={() => setPendingPermission(null)}>Cancel</Button><Button danger={pendingPermission.granted} onClick={confirmPermission}>{pendingPermission.granted ? 'Restrict permission' : 'Grant permission'}</Button></>}><p className="profile-dialog-copy">{pendingPermission.granted ? 'Restrict' : 'Grant'} <b>{pendingPermission.name}</b> for this user? This change is saved only in this local profile view.</p></LocalDialog>}
  </div>
}

function DocumentsTab({ userName, onNotice }) {
  const [activeScope, setActiveScope] = useState('All Documents')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState('Last 30 days')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [accessFilter, setAccessFilter] = useState('All access')
  const [actionFilter, setActionFilter] = useState('All actions')
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const [page, setPage] = useState(1)
  const docs = useMemo(() => profileDocuments.map((doc) => doc.owner === 'Rahul Sharma' ? { ...doc, owner: userName } : doc), [userName])
  const filtered = useMemo(() => docs.filter((doc) => {
    const query = search.trim().toLowerCase()
    const matchesQuery = !query || `${doc.name} ${doc.owner} ${doc.type} ${doc.action}`.toLowerCase().includes(query)
    const matchesScope = activeScope === 'All Documents' || (activeScope === 'Owned by User' ? doc.owner === userName : doc.access === 'Shared with user')
    const matchesType = typeFilter === 'All types' || doc.type === typeFilter
    const matchesAccess = accessFilter === 'All access' || doc.access === accessFilter
    const cutoff = range === 'Last 30 days' ? 30 : range === 'Last 90 days' ? 90 : Infinity
    const docAge = Math.floor((new Date('2026-10-22') - new Date(`${doc.date}T12:00:00`)) / 86400000)
    return matchesQuery && matchesScope && matchesType && matchesAccess && (actionFilter === 'All actions' || doc.action === actionFilter) && docAge <= cutoff
  }), [docs, search, activeScope, userName, typeFilter, accessFilter, actionFilter, range])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)
  const rows = visible.map((doc) => ({ id: doc.id, cells: [<span className="profile-file-name" key="file"><i className={`file-type ${doc.tone}`}>{doc.type.slice(0, 3)}</i><span><b>{doc.name}</b><small>/{doc.type === 'PDF' ? 'Projects' : doc.type === 'XLSX' ? 'Reports' : 'Documents'}</small></span></span>, <Badge key="type" tone={doc.tone}>{doc.type}</Badge>, <span className="profile-owner" key="owner"><UserAvatar className="profile-owner-avatar" email={doc.owner.toLowerCase().replace(' ', '.') + '@suredocs.com'} fullName={doc.owner} />{doc.owner}<small>{doc.owner === userName ? '(You)' : ''}</small></span>, <Badge key="access" tone={doc.access === 'Owned' ? 'blue' : doc.access === 'Department' ? 'green' : 'purple'}>{doc.access}</Badge>, doc.size, <span className="profile-activity-cell" key="activity"><Icon name={doc.action === 'Downloaded' ? 'download' : doc.action === 'Edited' ? 'edit' : 'eye'} size={12} /><span>{doc.action}<small>{doc.activity}</small></span></span>, <div className="profile-row-menu" key="actions"><button aria-label={`Actions for ${doc.name}`} onClick={() => setMenuId(menuId === doc.id ? null : doc.id)} type="button"><Icon name="more" /></button>{menuId === doc.id && <div role="menu">{['View Details', 'Download', 'Edit Metadata', 'Share'].map((action) => <button key={action} onClick={() => { setMenuId(null); onNotice(`${action} selected for ${doc.name}; this is a local demo.`) }} role="menuitem" type="button">{action}</button>)}</div>}</div>] }))
  return <div className="profile-tab-content documents-tab">
    <SectionTitle icon="document" title="Documents" subtitle="All documents owned by, shared with, or accessed by this user." action={<Select label="Document date range" value={range} onChange={(value) => { setRange(value); setPage(1) }} options={['Last 30 days', 'Last 90 days', 'All time']} />} />
    <MetricGrid columns={6} items={[{ label: 'Total Documents', value: 45, trend: '+12%', tone: 'purple', icon: 'document' }, { label: 'Owned Documents', value: 18, trend: '—', tone: 'green', icon: 'document' }, { label: 'Shared with User', value: 14, trend: '—', tone: 'blue', icon: 'users' }, { label: 'Downloaded', value: 28, trend: '+27%', tone: 'orange', icon: 'download' }, { label: 'Edited', value: 12, trend: '+8%', tone: 'red', icon: 'edit' }, { label: 'Deleted', value: 3, trend: '+50%', tone: 'red', icon: 'trash' }]} />
    <div className="document-filter-row"><div className="document-scope-tabs">{[['All Documents', 45], ['Owned by User', 18], ['Shared with User', 14]].map(([label, count]) => <button aria-pressed={activeScope === label} className={activeScope === label ? 'selected' : ''} key={label} onClick={() => { setActiveScope(label); setPage(1) }} type="button">{label}<Badge tone="blue">{count}</Badge></button>)}</div><label className="profile-search-field"><Icon name="search" size={13} /><input aria-label="Search documents" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search documents..." value={search} /></label><div className="profile-filter-wrap"><Button secondary onClick={() => setFilterOpen(!filterOpen)}><Icon name="filter" size={12} /> Filter</Button>{filterOpen && <div className="profile-filter-popover"><b>Document filters</b><Select label="Document type" value={typeFilter} onChange={(value) => { setTypeFilter(value); setPage(1) }} options={['All types', 'PDF', 'XLSX', 'DOCX', 'PPTX', 'TXT', 'PNG', 'ZIP']} /><Select label="Access status" value={accessFilter} onChange={(value) => { setAccessFilter(value); setPage(1) }} options={['All access', 'Owned', 'Shared with user', 'Department']} /><Select label="Last action" value={actionFilter} onChange={(value) => { setActionFilter(value); setPage(1) }} options={['All actions', 'Edited', 'Downloaded', 'Viewed', 'Shared']} /><Button secondary onClick={() => { setTypeFilter('All types'); setAccessFilter('All access'); setActionFilter('All actions') }}>Reset</Button></div>}</div></div>
    <Card className="documents-table-card"><Table columns={['Name', 'Type', 'Owner', 'Access', 'Size', 'Last Activity', 'Actions']} rows={rows} empty="No documents match these filters." /><footer className="profile-table-footer"><span>Showing {filtered.length ? (current - 1) * pageSize + 1 : 0}–{Math.min(current * pageSize, filtered.length)} of {filtered.length} documents</span><Pagination current={current} pages={pages} onChange={setPage} /></footer></Card>
  </div>
}

function Pagination({ current, pages, onChange }) {
  return <nav aria-label="Table pages" className="profile-pagination"><button aria-label="Previous page" disabled={current <= 1} onClick={() => onChange(Math.max(1, current - 1))} type="button">‹</button>{Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((page) => <button aria-current={current === page ? 'page' : undefined} className={current === page ? 'selected' : ''} key={page} onClick={() => onChange(page)} type="button">{page}</button>)}{pages > 5 && <span>…</span>}<button aria-label="Next page" disabled={current >= pages} onClick={() => onChange(Math.min(pages, current + 1))} type="button">›</button></nav>
}

function ActivityTab({ onTabChange }) {
  const [range, setRange] = useState('Last 30 days')
  const [aggregation, setAggregation] = useState('Daily')
  const data = useMemo(() => buildTrendData(range, aggregation), [range, aggregation])
  const activityRows = recentActivity.map((item) => ({ id: item.id, cells: [formatTimestamp(item.timestamp), <Badge key="action" tone={item.action === 'Failed Login' ? 'red' : 'blue'}>{item.action}</Badge>, item.document, item.details, item.ip, <Badge key="status" tone={item.status === 'Success' ? 'green' : 'red'}>{item.status}</Badge>] }))
  return <div className="profile-tab-content">
    <SectionTitle icon="clock" title="Activity Overview" subtitle="Summary of this user's document and platform activity." action={<Select label="Activity date range" value={range} onChange={setRange} options={['Last 7 days', 'Last 30 days', 'Last 90 days']} />} />
    <MetricGrid columns={5} items={activityMetrics} />
    <div className="activity-chart-grid"><Card title="Activity Trends" subtitle="Document operations performed by this user over time." action={<Select label="Chart aggregation" value={aggregation} onChange={setAggregation} options={['Daily', 'Weekly', 'Monthly']} />}><div className="profile-line-chart"><TrendChart data={data} /></div><ChartLegend items={[['Uploads', '#2878f0'], ['Downloads', '#16a36a'], ['Edits', '#f59e0b'], ['Deletions', '#f04452']]} /></Card><Card title="Action Distribution" subtitle="Breakdown of document actions."><StatDonut data={activityDistribution} total={128} centerLabel="Actions" /></Card></div>
    <Card title="Recent Activity" subtitle="Latest actions performed by this user." action={<button className="profile-link-button" onClick={() => onTabChange('Audit Logs')} type="button">View All</button>}><Table columns={['Date & Time', 'Action', 'Document', 'Details', 'IP Address', 'Status']} rows={activityRows} /></Card>
  </div>
}

function ChartLegend({ items }) { return <div className="profile-chart-legend">{items.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div> }

function SecurityTab({ sessions, setSessions, settings, setSettings, onNotice, accountStatus, userEmail }) {
  const [dialog, setDialog] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const activeCards = [...securityOverview.map((item) => item.label === 'Account Status' ? { ...item, value: accountStatus } : item), { label: 'Active Sessions', value: sessions.length, tone: 'blue', icon: 'device' }]
  const rows = sessions.map((session) => ({ id: session.id, cells: [session.device, <span key="loc">{session.location}<small className="table-subline">{session.ip}</small></span>, session.browser, session.lastActive, <Button className="table-action-button" danger onClick={() => setSelectedSession(session)} key="revoke">Revoke</Button>] }))
  const historyRows = loginHistory.map((item) => ({ id: item.id, cells: [item.timestamp, item.location, item.device, <Badge key="status" tone={item.status === 'Success' ? 'green' : 'red'}>{item.status}</Badge>] }))
  const failedRows = failedLogins.map((item) => ({ id: item.id, cells: [item.timestamp, item.ip, item.location, item.reason] }))
  const securityRows = securityEvents.map((item) => ({ id: item.id, cells: [item.timestamp, item.event, item.details.replace('rahul.sharma@suredocs.com', userEmail), <Badge key="status" tone="green">{item.status}</Badge>] }))
  const runSetting = (key) => setDialog({ type: 'setting', key })
  const confirmDialog = () => {
    if (dialog?.type === 'setting') {
      const key = dialog.key
      setSettings((current) => ({ ...current, [key]: key === 'passwordStrong' ? true : !current[key] }))
      onNotice(`${({ twoFactor: '2FA', passwordStrong: 'Password reset', locked: 'Account lock', sso: 'Single Sign-On' })[key]} updated locally.`)
    } else if (dialog?.type === 'revoke-all') {
      setSessions([])
      onNotice('All profile sessions were revoked locally.')
    }
    setDialog(null)
  }
  const settingRows = [
    ['twoFactor', 'Two-Factor Authentication (2FA)', settings.twoFactor ? 'Enabled' : 'Disabled', 'Adds an extra layer of security', settings.twoFactor ? 'Manage' : 'Enable'],
    ['passwordStrong', 'Password Status', settings.passwordStrong ? 'Strong' : 'Reset required', 'Last changed Aug 05, 2026', 'Reset'],
    ['locked', 'Account Lockout', settings.locked ? 'Locked' : 'Not Locked', 'Account sign-in access', settings.locked ? 'Unlock Account' : 'Lock Account'],
    ['sso', 'Single Sign-On (SSO)', settings.sso ? 'Enabled' : 'Not Enabled', 'Organization sign-in method', settings.sso ? 'Configure' : 'Configure'],
  ]
  return <div className="profile-tab-content">
    <SectionTitle icon="shield" title="Security Overview" subtitle="Current security status and key information." action={<Button secondary onClick={() => document.getElementById('profile-active-sessions')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>View Active Sessions</Button>} />
    <MetricGrid columns={4} items={activeCards.map((item) => ({ ...item, trend: item.label === 'Active Sessions' ? 'View' : '', icon: item.icon }))} />
    <div className="security-grid"><Card title="Authentication & Security Settings" subtitle="Security configurations for this user."><div className="security-setting-list">{settingRows.map(([key, title, value, detail, action]) => <div className="security-setting-row" key={key}><span className={`security-setting-icon ${key}`}><Icon name={key === 'twoFactor' ? 'shield' : key === 'passwordStrong' ? 'lock' : key === 'locked' ? 'blocked' : 'eye'} /></span><span><b>{title}</b><small>{detail}</small></span><Badge tone={key === 'locked' ? (settings.locked ? 'red' : 'slate') : key === 'sso' ? (settings.sso ? 'green' : 'slate') : 'green'}>{value}</Badge><Button secondary onClick={() => runSetting(key)}>{action}</Button></div>)}</div></Card><Card id="profile-active-sessions" title="Active Sessions" action={<Button secondary onClick={() => setDialog({ type: 'revoke-all' })}>Revoke All</Button>}><Table columns={['Device', 'Location / IP', 'Browser / OS', 'Last Active', 'Action']} rows={rows} empty="There are no active sessions." /></Card></div>
    <div className="security-grid"><Card title="Failed Login Attempts" subtitle="Recent failed login attempts for this user." action={<button className="profile-link-button" onClick={() => onNotice('Showing all local failed login attempts.')} type="button">View All</button>}><Table columns={['Date & Time', 'IP Address', 'Location', 'Reason']} rows={failedRows} /></Card><Card title="Recent Login History" action={<button className="profile-link-button" onClick={() => onNotice('Showing all local login history.')} type="button">View All</button>}><Table columns={['Date & Time', 'Location / IP', 'Device', 'Status']} rows={historyRows} /></Card></div>
    <Card title="Security Events" subtitle="Important security-related events for this user." action={<button className="profile-link-button" onClick={() => onNotice('Showing all local security events.')} type="button">View All</button>}><Table columns={['Date & Time', 'Event', 'Details', 'Status']} rows={securityRows} /></Card>
    {dialog && <LocalDialog alert title={dialog.type === 'revoke-all' ? 'Revoke all active sessions?' : `Confirm ${settingRows.find(([key]) => key === dialog.key)?.[1]}`} onClose={() => setDialog(null)} footer={<><Button secondary onClick={() => setDialog(null)}>Cancel</Button><Button danger={dialog.type === 'revoke-all' || dialog.key === 'locked'} onClick={confirmDialog}>Confirm local change</Button></>}><p className="profile-dialog-copy">This action changes only the local mock state shown in this profile.</p></LocalDialog>}
    {selectedSession && <LocalDialog alert title="Revoke this session?" onClose={() => setSelectedSession(null)} footer={<><Button secondary onClick={() => setSelectedSession(null)}>Cancel</Button><Button danger onClick={() => { setSessions((current) => current.filter((session) => session.id !== selectedSession.id)); onNotice(`${selectedSession.device} session revoked locally.`); setSelectedSession(null) }}>Revoke session</Button></>}><p className="profile-dialog-copy">End the local demo session for <b>{selectedSession.device}</b>?</p></LocalDialog>}
  </div>
}

function AuditTab({ onNotice, userName }) {
  const [range, setRange] = useState('Last 30 days')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All Actions')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [resourceFilter, setResourceFilter] = useState('All Resources')
  const [ipFilter, setIpFilter] = useState('All IP Addresses')
  const [page, setPage] = useState(1)
  const [menuId, setMenuId] = useState(null)
  const [detail, setDetail] = useState(null)
  const trend = useMemo(() => buildTrendData(range, 'Daily', true), [range])
  const unique = (key) => [...new Set(auditRecords.map((record) => record[key]))]
  const filtered = useMemo(() => auditRecords.filter((record) => {
    const query = search.trim().toLowerCase()
    return (!query || `${record.action} ${record.resource} ${record.details} ${record.ip} ${record.device}`.toLowerCase().includes(query)) && (actionFilter === 'All Actions' || record.action === actionFilter) && (statusFilter === 'All Status' || record.status === statusFilter) && (resourceFilter === 'All Resources' || record.resource === resourceFilter) && (ipFilter === 'All IP Addresses' || record.ip === ipFilter)
  }), [search, actionFilter, statusFilter, resourceFilter, ipFilter])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)
  const reset = () => { setSearch(''); setActionFilter('All Actions'); setStatusFilter('All Status'); setResourceFilter('All Resources'); setIpFilter('All IP Addresses'); setPage(1); onNotice('Audit log filters reset.') }
  const rangeOptions = ['Last 7 days', 'Last 30 days', 'Last 90 days']
  return <div className="profile-tab-content audit-tab">
    <SectionTitle icon="document" title="Audit Logs" subtitle="All activities performed by this user on the platform." action={<Select label="Audit date range" value={range} onChange={setRange} options={rangeOptions} />} />
    <MetricGrid columns={4} items={auditMetrics} />
    <div className="audit-chart-grid"><Card title="Activity by Action Type" subtitle="Distribution of actions performed by this user."><StatDonut data={auditActionDistribution} total={128} compact /></Card><Card title="Success vs Denied Trend" subtitle="Daily document operations."><div className="profile-line-chart audit-line-chart"><TrendChart data={trend} audit /></div><ChartLegend items={[['Success', '#16a36a'], ['Denied', '#f04452']]} /></Card></div>
    <div className="audit-filter-row"><label className="profile-search-field"><Icon name="search" size={13} /><input aria-label="Search actions and documents" onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search actions, documents..." value={search} /></label><Select label="Filter by action" value={actionFilter} onChange={(value) => { setActionFilter(value); setPage(1) }} options={['All Actions', ...unique('action')]} /><Select label="Filter by status" value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1) }} options={['All Status', 'Success', 'Denied']} /><Select label="Filter by resource" value={resourceFilter} onChange={(value) => { setResourceFilter(value); setPage(1) }} options={['All Resources', ...unique('resource')]} /><Select label="Filter by IP address" value={ipFilter} onChange={(value) => { setIpFilter(value); setPage(1) }} options={['All IP Addresses', ...unique('ip')]} /><Button secondary onClick={reset}>Reset</Button></div>
    <Card className="audit-table-card"><div className="audit-table-click-hint">Select a row to view event details.</div><div className="profile-table-scroll"><table className="profile-table audit-table"><thead><tr>{['Timestamp', 'Action', 'Resource / Document', 'Details', 'IP Address', 'Status', 'Device', 'Actions'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{visible.length ? visible.map((item) => <tr className="clickable-audit-row" key={item.id} onClick={() => setDetail(item)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setDetail(item) }}><td>{formatTimestamp(item.timestamp)}</td><td>{item.action}</td><td>{item.resource}</td><td>{item.details}</td><td>{item.ip}</td><td><Badge tone={item.status === 'Success' ? 'green' : 'red'}>{item.status}</Badge></td><td>{item.device}</td><td><div className="profile-row-menu"><button aria-label={`Actions for ${item.eventId}`} onClick={(event) => { event.stopPropagation(); setMenuId(menuId === item.id ? null : item.id) }} type="button"><Icon name="more" /></button>{menuId === item.id && <div role="menu"><button onClick={(event) => { event.stopPropagation(); setDetail(item); setMenuId(null) }} role="menuitem" type="button">View Details</button></div>}</div></td></tr>) : <tr><td className="profile-empty" colSpan={8}>No audit records match these filters.</td></tr>}</tbody></table></div><footer className="profile-table-footer"><span>Showing {filtered.length ? (current - 1) * pageSize + 1 : 0}–{Math.min(current * pageSize, filtered.length)} of {filtered.length} audit logs</span><Pagination current={current} pages={pages} onChange={setPage} /></footer></Card>
    {detail && <LocalDialog title="Audit event details" onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>}><dl className="audit-detail-grid">{[['Event ID', detail.eventId], ['Timestamp', formatTimestamp(detail.timestamp)], ['User', userName], ['Action', detail.action], ['Resource', detail.resource], ['Details', detail.details], ['IP Address', detail.ip], ['Device', detail.device], ['Status', detail.status], ...(detail.reason ? [['Reason', detail.reason]] : [])].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></LocalDialog>}
  </div>
}

function UserProfileModal({ user, onClose, onUserUpdate }) {
  const [tab, setTab] = useState('Overview')
  const [profile, setProfile] = useState(() => buildUserProfile(user))
  const [permissions, setPermissions] = useState(() => [...documentPermissions, ...platformPermissions].map((item) => ({ ...item })))
  const [securitySettings, setSecuritySettings] = useState(initialSecuritySettings)
  const [sessions, setSessions] = useState(initialSessions)
  const [headerMenu, setHeaderMenu] = useState(false)
  const [roleDialog, setRoleDialog] = useState(false)
  const [newRole, setNewRole] = useState(user.role)
  const [notice, setNotice] = useState('')
  const dialogRef = useRef(null)
  const openerRef = useRef(document.activeElement)

  useEffect(() => {
    const opener = openerRef.current
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        const nestedClose = document.querySelector('.profile-local-dialog .profile-icon-button')
        if (nestedClose) nestedClose.click()
        else onClose()
        return
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')].filter((node) => node.offsetParent !== null)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => { document.body.style.overflow = bodyOverflow; document.removeEventListener('keydown', handleKeyDown, true); opener?.focus?.() }
  }, [onClose])

  function updateProfile(changes) {
    setProfile((current) => ({ ...current, ...changes }))
    onUserUpdate?.(changes)
    setNotice('Profile information updated locally.')
  }
  function switchTab(key) { setTab(key) }
  function tabKeyDown(event) {
    const current = tabs.indexOf(tab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
      setTab(tabs[next])
      document.getElementById(`profile-tab-${next}`)?.focus()
    }
  }
  const openRole = () => { setNewRole(profile.role); setRoleDialog(true); setHeaderMenu(false) }
  const commitRole = () => { updateProfile({ role: newRole }); setRoleDialog(false) }
  const handleBackdrop = (event) => { if (event.target === event.currentTarget) onClose() }
  return <div className="user-profile-backdrop" onMouseDown={handleBackdrop}>
    <section aria-label={`${profile.name} profile details`} aria-modal="true" className="user-profile-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="user-profile-header">
        <div className="profile-identity"><UserAvatar className="profile-main-avatar" email={profile.email} fullName={profile.name} /><div className="profile-main-copy"><div className="profile-name-line"><h2>{profile.name}</h2><Badge tone={profile.status === 'Active' ? 'green' : profile.status === 'Pending' ? 'orange' : 'red'}><i />{profile.status}</Badge></div><a href={`mailto:${profile.email}`}>{profile.email}</a><div className="profile-header-badges"><Badge tone="blue">{profile.role}</Badge><Badge tone="slate">{profile.department}</Badge></div><p className="profile-meta-line">User ID: {profile.userId}<i /> Joined {profileFixture.joined}<i /> Last login: {profileFixture.lastLogin}</p></div></div>
        <div className="profile-header-actions"><div className="profile-header-menu-wrap"><button aria-expanded={headerMenu} aria-label="Profile actions" className="profile-icon-button" onClick={() => setHeaderMenu(!headerMenu)} type="button"><Icon name="more" /></button>{headerMenu && <div className="profile-header-menu"><button onClick={() => { setHeaderMenu(false); setTab('Overview') }}>Edit profile</button><button onClick={openRole}>Change role</button><button onClick={() => { navigator.clipboard?.writeText(profile.userId).catch(() => {}); setNotice('User ID copied to clipboard.'); setHeaderMenu(false) }}>Copy user ID</button></div>}</div><button aria-label="Close profile" className="profile-close-button" onClick={onClose} type="button"><Icon name="close" size={15} /></button></div>
      </header>
      <div aria-label="Profile sections" className="user-profile-tabs" onKeyDown={tabKeyDown} role="tablist">{tabs.map((label, index) => <button aria-controls="profile-tabpanel" aria-selected={tab === label} className={tab === label ? 'selected' : ''} id={`profile-tab-${index}`} key={label} onClick={() => setTab(label)} role="tab" tabIndex={tab === label ? 0 : -1} type="button"><Icon name={['users', 'shield', 'document', 'clock', 'lock', 'document'][index]} size={12} /><span>{label}</span></button>)}</div>
      <div aria-labelledby={`profile-tab-${tabs.indexOf(tab)}`} className="user-profile-content" id="profile-tabpanel" role="tabpanel" tabIndex={0}>
        {tab === 'Overview' && <ProfileOverview profile={profile} onProfileUpdate={updateProfile} permissions={permissions} onRoleClick={openRole} onTabChange={switchTab} />}
        {tab === 'Permissions' && <PermissionsTab permissions={permissions} setPermissions={setPermissions} role={profile.role} department={profile.department} onNotice={setNotice} />}
        {tab === 'Documents' && <DocumentsTab userName={profile.name} onNotice={setNotice} />}
        {tab === 'Activity' && <ActivityTab onTabChange={switchTab} />}
        {tab === 'Security' && <SecurityTab accountStatus={profile.status} userEmail={profile.email} sessions={sessions} setSessions={setSessions} settings={securitySettings} setSettings={setSecuritySettings} onNotice={setNotice} />}
        {tab === 'Audit Logs' && <AuditTab userName={profile.name} onNotice={setNotice} />}
      </div>
      {notice && <div className="profile-toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')} type="button"><Icon name="close" size={12} /></button></div>}
      {roleDialog && <LocalDialog title="Change user role" onClose={() => setRoleDialog(false)} footer={<><Button secondary onClick={() => setRoleDialog(false)}>Cancel</Button><Button onClick={commitRole}>Save role</Button></>}><p className="profile-dialog-copy">Choose a role for <b>{profile.name}</b>. This update affects only the local profile mock data.</p><label className="profile-field-label">Role<select aria-label="Role" onChange={(event) => setNewRole(event.target.value)} value={newRole}><option>Admin</option><option>Manager</option><option>Employee</option></select></label></LocalDialog>}
    </section>
  </div>
}

export default UserProfileModal

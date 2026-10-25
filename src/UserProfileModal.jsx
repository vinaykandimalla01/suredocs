import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiGet, apiPatch } from './api.js'
import UserAvatar from './UserAvatar.jsx'
import './UserProfileModal.css'

const tabs = ['Overview', 'Permissions', 'Documents', 'Activity', 'Security', 'Audit Logs']
const roleValues = { Admin: 'ADMIN', Manager: 'MANAGER', Employee: 'EMPLOYEE' }

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
    check: <path d="m5 12 4 4L19 6" />,
    blocked: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.document}</svg>
}

function Badge({ children, tone = 'slate' }) {
  return <span className={`profile-badge ${tone}`}>{children}</span>
}

function Card({ title, subtitle, action, className = '', children }) {
  return <section className={`profile-card${className ? ` ${className}` : ''}`}>
    {(title || action) && <header className="profile-card-heading"><div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>{action}</header>}
    {children}
  </section>
}

function SectionTitle({ icon = 'document', title, subtitle }) {
  return <div className="profile-section-title"><span className="profile-section-icon"><Icon name={icon} size={17} /></span><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div></div>
}

function MetricGrid({ items, columns }) {
  return <div className={`profile-metrics columns-${columns ?? items.length}`}>{items.map((item) => (
    <article className={`profile-metric ${item.tone}`} key={item.label}>
      <span className="profile-metric-icon"><Icon name={item.icon} size={18} /></span>
      <div className="profile-metric-copy"><span>{item.label}</span><strong>{item.value ?? '—'}</strong></div>
      {item.trend && <Badge tone={item.tone}>{item.trend}</Badge>}
    </article>
  ))}</div>
}

function Table({ columns, rows, empty = 'No matching records.', className = '' }) {
  return <div className={`profile-table-scroll ${className}`}><table className="profile-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={`${row.id}-${index}`}>{cell}</td>)}</tr>) : <tr><td className="profile-empty" colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div>
}

function LocalDialog({ title, children, onClose, footer }) {
  return <div className="profile-local-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section aria-labelledby="profile-local-title" aria-modal="true" className="profile-local-dialog narrow" role="dialog">
      <header><h3 id="profile-local-title">{title}</h3><button aria-label="Close dialog" className="profile-icon-button" onClick={onClose} type="button"><Icon name="close" /></button></header>
      <div className="profile-local-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  </div>
}

function KeyValue({ label, children }) {
  return <div className="profile-kv"><span>{label}</span><strong>{children}</strong></div>
}

function displayDate(value) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString()
}

function prettyAction(action) {
  return (action || 'Unknown').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatSize(size) {
  if (size == null) return '—'
  if (size >= 1024 ** 3) return `${(size / 1024 ** 3).toFixed(1)} GB`
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

function LiveProfileTab({ tab, data, onTabChange }) {
  const { user, summary, documents, permissions, events, sessions, security } = data
  const documentRows = documents.map((item) => ({
    id: item.id,
    cells: [
      <span className="profile-file-name" key="name"><i className="file-type blue">{(item.file_extension || 'FILE').slice(0, 3).toUpperCase()}</i><span><b>{item.filename || item.title}</b><small>{item.title}</small></span></span>,
      item.owner_name,
      <Badge key="access" tone={item.access === 'Owned' ? 'blue' : 'purple'}>{item.access}</Badge>,
      formatSize(item.size_bytes),
      <span key="storage">{item.version_status || 'No current version'}{item.storage_reference_configured ? ' · S3 reference recorded' : ' · Storage reference missing'}</span>,
      displayDate(item.updated_at),
    ],
  }))
  const permissionRows = permissions.map((item) => ({
    id: item.id,
    cells: [
      <span key="document"><b>{item.document_filename || item.document_title}</b><small className="table-subline">{item.document_title}</small></span>,
      item.direction === 'received' ? item.owner_name : item.user_name,
      [item.can_view && 'Read', item.can_download && 'Download', item.can_edit && 'Edit'].filter(Boolean).join(' + ') || 'No permissions',
      displayDate(item.granted_at),
      item.expires_at ? displayDate(item.expires_at) : 'No expiry',
      <Badge key="status" tone={item.status === 'Active' ? 'green' : item.status === 'Revoked' ? 'red' : 'slate'}>{item.status}</Badge>,
    ],
  }))
  const eventRows = events.map((item) => ({
    id: item.source + item.id,
    cells: [
      displayDate(item.timestamp),
      <Badge key="action" tone={item.result === 'SUCCESS' ? 'blue' : 'red'}>{prettyAction(item.action)}</Badge>,
      item.document || '—',
      item.ip_address || '—',
      <Badge key="result" tone={item.result === 'SUCCESS' ? 'green' : 'red'}>{prettyAction(item.result)}</Badge>,
    ],
  }))
  const metrics = [
    { label: 'Documents Uploaded', value: summary.documents_uploaded, tone: 'blue', icon: 'upload' },
    { label: 'Documents Downloaded', value: summary.documents_downloaded, tone: 'green', icon: 'download' },
    { label: 'Documents Shared', value: summary.documents_shared, tone: 'purple', icon: 'share' },
    { label: 'Documents Edited', value: summary.documents_edited, tone: 'orange', icon: 'edit' },
  ]

  if (tab === 'Overview') return <div className="profile-tab-content">
    <h3 className="profile-subsection-label">Database-backed account metrics</h3>
    <MetricGrid items={metrics} columns={4} />
    <div className="profile-overview-grid">
      <Card title="Personal Information"><div className="profile-information-grid">
        <KeyValue label="Full Name">{user.full_name}</KeyValue><KeyValue label="Email Address">{user.email}</KeyValue>
        <KeyValue label="Employee ID">{user.employee_code || 'Not recorded'}</KeyValue><KeyValue label="Job Title">{user.job_title || 'Not recorded'}</KeyValue>
        <KeyValue label="Department">{user.department || 'Not recorded'}</KeyValue><KeyValue label="Phone Number">{user.phone || 'Not recorded'}</KeyValue>
        <KeyValue label="Invited By">{user.created_by || 'Not recorded'}</KeyValue>
      </div></Card>
      <Card title="Account Information"><div className="profile-information-grid account-grid">
        <KeyValue label="Account Status"><Badge tone={user.account_status === 'ACTIVE' ? 'green' : user.account_status === 'PENDING' ? 'orange' : 'red'}>{prettyAction(user.account_status)}</Badge></KeyValue>
        <KeyValue label="Role">{prettyAction(user.role)}</KeyValue><KeyValue label="Account Created">{displayDate(user.created_at)}</KeyValue>
        <KeyValue label="Email Verified">{displayDate(user.email_verified_at)}</KeyValue><KeyValue label="Last Login">{displayDate(user.last_login_at)}</KeyValue>
        <KeyValue label="Last Activity">{events.length ? displayDate(events[0].timestamp) : 'No recorded activity'}</KeyValue>
      </div></Card>
      <Card title="Document & Permission Summary"><div className="overview-permission-list">
        <span className="granted"><i>✓</i>{summary.owned_documents} owned documents</span>
        <span className="granted"><i>✓</i>{summary.shared_documents} documents shared with user</span>
        <span className="granted"><i>✓</i>{summary.active_permissions} active document grants</span>
        <span className="restricted"><i>×</i>{summary.revoked_permissions} revoked grants</span>
      </div></Card>
      <Card className="overview-recent-card" title="Recent Recorded Activity" action={<button className="profile-link-button" onClick={() => onTabChange('Activity')} type="button">View All <Icon name="arrow" size={11} /></button>}>
        <Table columns={['Timestamp', 'Action', 'Document', 'Result']} rows={events.slice(0, 5).map((item) => ({ id: item.source + item.id, cells: [displayDate(item.timestamp), prettyAction(item.action), item.document || '—', prettyAction(item.result)] }))} empty="No activity is recorded for this user." />
      </Card>
    </div>
  </div>

  if (tab === 'Permissions') return <div className="profile-tab-content">
    <SectionTitle icon="shield" title="Document Permissions" subtitle="Persisted document grants involving this user. Platform roles are enforced by application policy; per-capability platform grants are not stored as user rows." />
    <MetricGrid columns={4} items={[
      { label: 'Owned Documents', value: summary.owned_documents, tone: 'blue', icon: 'document' },
      { label: 'Shared with User', value: summary.shared_documents, tone: 'green', icon: 'users' },
      { label: 'Active Grants', value: summary.active_permissions, tone: 'purple', icon: 'share' },
      { label: 'Revoked Grants', value: summary.revoked_permissions, tone: 'red', icon: 'blocked' },
    ]} />
    <Card title="Current and Historical Grants" subtitle={`Showing up to ${data.permissions_limit} recent permission records.`}>
      <Table columns={['Document', 'Other User', 'Access', 'Granted', 'Expires', 'Status']} rows={permissionRows} empty="No document permission rows are recorded for this user." />
    </Card>
  </div>

  if (tab === 'Documents') return <div className="profile-tab-content documents-tab">
    <SectionTitle icon="document" title="Documents" subtitle={`Showing ${documents.length} of ${data.documents_total} accessible document records.`} />
    <MetricGrid columns={4} items={[
      { label: 'Documents Listed', value: data.documents_total, tone: 'purple', icon: 'document' },
      { label: 'Owned Documents', value: summary.owned_documents, tone: 'green', icon: 'document' },
      { label: 'Shared with User', value: summary.shared_documents, tone: 'blue', icon: 'users' },
      { label: 'Deleted Events', value: summary.documents_deleted, tone: 'red', icon: 'trash' },
    ]} />
    <Card className="documents-table-card" title="Database document metadata">
      <Table columns={['Name', 'Owner', 'Access', 'Size', 'Storage Status', 'Updated']} rows={documentRows} empty="No accessible document records were found." />
    </Card>
    {documents.length < data.documents_total && <p className="profile-muted-note">The profile API limits this view to the 100 most recently updated records.</p>}
  </div>

  if (tab === 'Activity') return <div className="profile-tab-content">
    <SectionTitle icon="clock" title="Recorded Activity" subtitle="Document audit and authentication events from the database." />
    <MetricGrid columns={5} items={[...metrics, { label: 'Deleted Documents', value: summary.documents_deleted, tone: 'red', icon: 'trash' }]} />
    <Card title="Recent Activity" subtitle="Most recent 100 associated events; secret and storage locator fields are redacted.">
      <Table columns={['Date & Time', 'Action', 'Document', 'IP Address', 'Result']} rows={eventRows} empty="No recorded activity is available." />
    </Card>
  </div>

  if (tab === 'Security') {
    const authEvents = events.filter((item) => item.source === 'authentication')
    const sessionRows = sessions.map((item) => ({
      id: item.id,
      cells: [item.device, item.ip_address || 'Not recorded', item.user_agent || 'Not recorded', displayDate(item.last_active), <Badge key="status" tone={item.status === 'Active' ? 'green' : 'slate'}>{item.status}</Badge>],
    }))
    return <div className="profile-tab-content security-tab">
      <SectionTitle icon="shield" title="Security Overview" subtitle="Authentication and session facts persisted for this account." />
      <MetricGrid columns={4} items={[
        { label: 'Account Status', value: prettyAction(user.account_status), tone: user.account_status === 'ACTIVE' ? 'green' : 'red', icon: 'shield' },
        { label: 'Two-Factor Authentication', value: security.two_factor_enabled ? 'Enabled' : 'Disabled', tone: security.two_factor_enabled ? 'green' : 'orange', icon: 'lock' },
        { label: 'Active Sessions', value: summary.active_sessions, tone: 'blue', icon: 'device' },
        { label: 'Failed Login Attempts', value: summary.failed_login_attempts, tone: 'red', icon: 'blocked' },
      ]} />
      <div className="security-grid">
        <Card title="Persisted Security Settings"><div className="profile-information-grid">
          <KeyValue label="Two-Factor Authentication">{security.two_factor_enabled ? 'Enabled' : 'Disabled'}</KeyValue>
          <KeyValue label="Account Lock">{security.locked_until ? `Locked until ${displayDate(security.locked_until)}` : 'Not currently locked'}</KeyValue>
          <KeyValue label="Email Verification">{security.email_verified_at ? displayDate(security.email_verified_at) : 'Not verified'}</KeyValue>
          <KeyValue label="Password Changed">{displayDate(security.password_changed_at)}</KeyValue>
        </div></Card>
        <Card title="Recorded Sessions" subtitle="Session token hashes are never returned to this view.">
          <Table columns={['Device', 'IP Address', 'Browser / OS', 'Last Active', 'Status']} rows={sessionRows} empty="No sessions are recorded." />
        </Card>
      </div>
      <Card title="Authentication Events"><Table columns={['Date & Time', 'Event', 'IP Address', 'Result']} rows={authEvents.map((item) => ({ id: item.id, cells: [displayDate(item.timestamp), prettyAction(item.action), item.ip_address || '—', prettyAction(item.result)] }))} empty="No authentication events are recorded." /></Card>
    </div>
  }

  return <div className="profile-tab-content audit-tab">
    <SectionTitle icon="document" title="Audit Logs" subtitle="Recent persisted document and authentication events associated with this user." />
    <MetricGrid columns={4} items={[
      { label: 'Events Loaded', value: events.length, tone: 'blue', icon: 'document' },
      { label: 'Successful Events', value: events.filter((item) => item.result === 'SUCCESS').length, tone: 'green', icon: 'check' },
      { label: 'Denied Events', value: events.filter((item) => item.result === 'DENIED').length, tone: 'red', icon: 'blocked' },
      { label: 'Failed Events', value: events.filter((item) => item.result === 'FAILED').length, tone: 'purple', icon: 'shield' },
    ]} />
    <Card title="Audit Event Records" subtitle="Most recent 100 records; secret and S3 locator fields are redacted.">
      <Table columns={['Timestamp', 'Source', 'Action', 'Resource / Document', 'Details', 'IP Address', 'Result']} rows={events.map((item) => ({ id: item.source + item.id, cells: [displayDate(item.timestamp), item.source, prettyAction(item.action), item.document || '—', JSON.stringify(item.details || {}), item.ip_address || '—', prettyAction(item.result)] }))} empty="No audit records match this user." />
    </Card>
  </div>
}

function UserProfileModal({ user, onClose, onUserUpdate }) {
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [headerMenu, setHeaderMenu] = useState(false)
  const [roleDialog, setRoleDialog] = useState(false)
  const [newRole, setNewRole] = useState(user.role)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  const openerRef = useRef(document.activeElement)
  const profile = data?.user

  const loadProfile = useCallback(async (signal) => {
    try {
      const result = await apiGet(`/api/admin/users/${encodeURIComponent(user.id)}/profile`, { signal })
      if (!signal?.aborted) setData(result)
    } catch (requestError) {
      if (requestError.name !== 'AbortError' && !signal?.aborted) setError(requestError.message || 'User profile data could not be loaded.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) loadProfile(controller.signal)
    })
    return () => controller.abort()
  }, [loadProfile])

  useEffect(() => {
    const opener = openerRef.current
    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
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

  function tabKeyDown(event) {
    const current = tabs.indexOf(tab)
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
      setTab(tabs[next])
      document.getElementById(`profile-tab-${next}`)?.focus()
    }
  }

  async function commitRole() {
    setSaving(true)
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await apiPatch(`/api/admin/users/${encodeURIComponent(user.id)}`, { role: roleValues[newRole] })
      await loadProfile()
      onUserUpdate?.()
      setRoleDialog(false)
      setNotice('Role updated successfully.')
    } catch (requestError) {
      setNotice(requestError.message || 'The role could not be updated.')
      setLoading(false)
    } finally {
      setSaving(false)
    }
  }

  const fullName = profile?.full_name || user.name
  const email = profile?.email || user.email
  const status = profile?.account_status || user.status
  const role = profile?.role || user.role
  return createPortal(<div className="user-profile-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section aria-label={`${fullName} profile details`} aria-modal="true" className={`user-profile-modal tab-${tab.toLowerCase().replaceAll(' ', '-')}`} ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="user-profile-header">
        <div className="profile-identity"><UserAvatar className="profile-main-avatar" email={email} fullName={fullName} /><div className="profile-main-copy">
          <div className="profile-name-line"><h2>{fullName}</h2><Badge tone={status === 'ACTIVE' || status === 'Active' ? 'green' : status === 'PENDING' || status === 'Pending' ? 'orange' : 'red'}><i />{prettyAction(status)}</Badge></div>
          <a href={`mailto:${email}`}>{email}</a><div className="profile-header-badges"><Badge tone="blue">{prettyAction(role)}</Badge><Badge tone="slate">{profile?.department || user.department || 'No department'}</Badge></div>
          <p className="profile-meta-line">User ID: {user.id}<i /> Joined {displayDate(profile?.created_at || user.joined)}<i /> Last login: {displayDate(profile?.last_login_at || user.lastLogin)}</p>
        </div></div>
        <div className="profile-header-actions"><div className="profile-header-menu-wrap">
          <button aria-expanded={headerMenu} aria-label="Profile actions" className="profile-icon-button" onClick={() => setHeaderMenu(!headerMenu)} type="button"><Icon name="more" /></button>
          {headerMenu && <div className="profile-header-menu">
            <button onClick={() => { navigator.clipboard?.writeText(user.id).catch(() => {}); setNotice('User ID copied to clipboard.'); setHeaderMenu(false) }} type="button">Copy user ID</button>
            <button onClick={() => { setNewRole(role === 'ADMIN' || role === 'Admin' ? 'Admin' : role === 'MANAGER' || role === 'Manager' ? 'Manager' : 'Employee'); setRoleDialog(true); setHeaderMenu(false) }} type="button">Change role</button>
          </div>}
        </div><button aria-label="Close profile" className="profile-close-button" onClick={onClose} type="button"><Icon name="close" size={15} /></button></div>
      </header>
      <div aria-label="Profile sections" className="user-profile-tabs" onKeyDown={tabKeyDown} role="tablist">{tabs.map((label, index) => <button aria-controls="profile-tabpanel" aria-selected={tab === label} className={tab === label ? 'selected' : ''} id={`profile-tab-${index}`} key={label} onClick={() => setTab(label)} role="tab" tabIndex={tab === label ? 0 : -1} type="button"><Icon name={['users', 'shield', 'document', 'clock', 'lock', 'document'][index]} size={12} /><span>{label}</span></button>)}</div>
      <div aria-labelledby={`profile-tab-${tabs.indexOf(tab)}`} className="user-profile-content" id="profile-tabpanel" role="tabpanel" tabIndex={0}>
        {loading && <p role="status">Loading user data…</p>}
        {error && <p role="alert">{error} <button className="profile-link-button" onClick={() => { setLoading(true); setError(''); loadProfile() }} type="button">Retry</button></p>}
        {!loading && !error && data && <LiveProfileTab data={data} onTabChange={setTab} tab={tab} />}
      </div>
      {notice && <div className="profile-toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')} type="button"><Icon name="close" size={12} /></button></div>}
      {roleDialog && <LocalDialog title="Change user role" onClose={() => setRoleDialog(false)} footer={<><button className="profile-button secondary" disabled={saving} onClick={() => setRoleDialog(false)} type="button">Cancel</button><button className="profile-button" disabled={saving} onClick={commitRole} type="button">{saving ? 'Saving…' : 'Save role'}</button></>}>
        <p className="profile-dialog-copy">Choose a role for <b>{fullName}</b>. The change is saved to the SureDocs database and checked against administrator safety rules.</p>
        <label className="profile-field-label">Role<select aria-label="Role" onChange={(event) => setNewRole(event.target.value)} value={newRole === 'ADMIN' ? 'Admin' : newRole === 'MANAGER' ? 'Manager' : newRole === 'EMPLOYEE' ? 'Employee' : newRole}><option>Admin</option><option>Manager</option><option>Employee</option></select></label>
      </LocalDialog>}
    </section>
  </div>, document.body)
}

export default UserProfileModal

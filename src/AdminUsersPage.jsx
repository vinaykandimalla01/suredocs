import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiGet, apiPatch } from './api.js'
import UserAvatar from './UserAvatar.jsx'
const UserProfileModal = lazy(() => import('./UserProfileModal.jsx'))
import './AdminUsersPage.css'

const pageSize = 8
const validStatuses = ['all', 'active', 'disabled', 'pending', 'suspended']

function displayUser(item) {
  const roles = { ADMIN: 'Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' }
  const statuses = { ACTIVE: 'Active', PENDING: 'Pending', DISABLED: 'Disabled', SUSPENDED: 'Suspended' }
  return {
    id: item.id,
    name: item.full_name,
    email: item.email,
    role: roles[item.role] || item.role,
    department: item.department || '—',
    jobTitle: item.job_title || '',
    status: statuses[item.account_status] || item.account_status,
    joined: item.created_at,
    lastLogin: item.last_login_at,
  }
}

function userApiStatus(status) {
  return { Active: 'ACTIVE', Pending: 'PENDING', Disabled: 'DISABLED', Suspended: 'SUSPENDED' }[status]
}

function userApiRole(role) {
  return { Admin: 'ADMIN', Manager: 'MANAGER', Employee: 'EMPLOYEE' }[role]
}

function Icon({ name, className = '' }) {
  const paths = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    active: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    disabled: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
    pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    filter: <path d="M4 5h16l-6.2 7.2v5L10 19v-6.8L4 5Z" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    previous: <path d="m15 18-6-6 6-6" />,
    next: <path d="m9 18 6-6-6-6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
  }

  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name]}</svg>
}

function FlowingWave() {
  return (
    <div aria-hidden="true" className="user-management-wave">
      <svg className="user-management-wave-svg" preserveAspectRatio="none" viewBox="0 0 1440 220">
        <defs>
          <linearGradient id="user-wave-blue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e6f0ff"><animate attributeName="stop-color" dur="22s" repeatCount="indefinite" values="#e6f0ff;#edf6ff;#ddecff;#e6f0ff" /></stop>
            <stop offset="58%" stopColor="#dceaff"><animate attributeName="stop-color" dur="22s" repeatCount="indefinite" values="#dceaff;#e8f5ff;#d9eaff;#dceaff" /></stop>
            <stop offset="100%" stopColor="#f2f8ff"><animate attributeName="stop-color" dur="22s" repeatCount="indefinite" values="#f2f8ff;#e7f2ff;#f4faff;#f2f8ff" /></stop>
          </linearGradient>
          <linearGradient id="user-wave-sky" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#c9e1ff"><animate attributeName="stop-color" dur="27s" repeatCount="indefinite" values="#c9e1ff;#d8efff;#c7ddff;#c9e1ff" /></stop>
            <stop offset="100%" stopColor="#e8f3ff"><animate attributeName="stop-color" dur="27s" repeatCount="indefinite" values="#e8f3ff;#dcecff;#eaf7ff;#e8f3ff" /></stop>
          </linearGradient>
          <linearGradient id="user-wave-ice" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f0f7ff"><animate attributeName="stop-color" dur="19s" repeatCount="indefinite" values="#f0f7ff;#e5f5ff;#eff3ff;#f0f7ff" /></stop>
            <stop offset="100%" stopColor="#dceaff"><animate attributeName="stop-color" dur="19s" repeatCount="indefinite" values="#dceaff;#eef5ff;#dcefff;#dceaff" /></stop>
          </linearGradient>
        </defs>
        <path className="user-wave-layer user-wave-layer-back" d="M0 96 C180 24 245 190 420 124 C610 48 690 184 880 114 C1065 46 1145 166 1305 84 C1360 56 1405 59 1440 78 L1440 220 L0 220 Z" fill="url(#user-wave-ice)">
          <animate attributeName="d" dur="31s" repeatCount="indefinite" values="M0 96 C180 24 245 190 420 124 C610 48 690 184 880 114 C1065 46 1145 166 1305 84 C1360 56 1405 59 1440 78 L1440 220 L0 220 Z;M0 76 C170 144 252 26 420 96 C605 168 696 30 880 92 C1052 156 1157 29 1305 96 C1364 118 1406 111 1440 86 L1440 220 L0 220 Z;M0 112 C172 40 255 174 420 110 C598 42 696 188 880 126 C1050 63 1159 183 1305 108 C1367 80 1404 68 1440 96 L1440 220 L0 220 Z;M0 96 C180 24 245 190 420 124 C610 48 690 184 880 114 C1065 46 1145 166 1305 84 C1360 56 1405 59 1440 78 L1440 220 L0 220 Z" />
        </path>
        <path className="user-wave-layer user-wave-layer-middle" d="M0 116 C165 180 270 42 444 104 C610 164 733 48 912 101 C1083 153 1194 40 1340 105 C1380 122 1410 121 1440 106 L1440 220 L0 220 Z" fill="url(#user-wave-blue)">
          <animate attributeName="d" dur="25s" repeatCount="indefinite" values="M0 116 C165 180 270 42 444 104 C610 164 733 48 912 101 C1083 153 1194 40 1340 105 C1380 122 1410 121 1440 106 L1440 220 L0 220 Z;M0 104 C180 43 276 178 444 116 C625 49 727 169 912 111 C1076 48 1198 164 1340 94 C1382 76 1410 82 1440 103 L1440 220 L0 220 Z;M0 126 C166 166 276 56 444 122 C610 188 728 38 912 96 C1080 160 1185 58 1340 118 C1386 136 1413 126 1440 115 L1440 220 L0 220 Z;M0 116 C165 180 270 42 444 104 C610 164 733 48 912 101 C1083 153 1194 40 1340 105 C1380 122 1410 121 1440 106 L1440 220 L0 220 Z" />
        </path>
        <path className="user-wave-layer user-wave-layer-front" d="M0 132 C178 70 260 188 438 126 C620 63 716 180 896 122 C1067 68 1175 177 1330 123 C1380 106 1410 109 1440 124 L1440 220 L0 220 Z" fill="url(#user-wave-sky)">
          <animate attributeName="d" dur="29s" repeatCount="indefinite" values="M0 132 C178 70 260 188 438 126 C620 63 716 180 896 122 C1067 68 1175 177 1330 123 C1380 106 1410 109 1440 124 L1440 220 L0 220 Z;M0 116 C174 184 260 65 438 116 C622 171 718 56 896 111 C1064 174 1174 54 1330 108 C1384 127 1412 125 1440 112 L1440 220 L0 220 Z;M0 142 C180 78 260 170 438 132 C616 96 720 188 896 129 C1071 72 1178 176 1330 133 C1380 118 1412 116 1440 130 L1440 220 L0 220 Z;M0 132 C178 70 260 188 438 126 C620 63 716 180 896 122 C1067 68 1175 177 1330 123 C1380 106 1410 109 1440 124 L1440 220 L0 220 Z" />
        </path>
      </svg>
    </div>
  )
}

function Trend({ tone }) {
  if (tone === 'active') {
    return <span aria-hidden="true" className="user-summary-bars"><i /><i /><i /><i /><i /><i /></span>
  }
  return (
    <svg aria-hidden="true" className="user-summary-line" viewBox="0 0 100 34" preserveAspectRatio="none">
      <path className="user-summary-line-area" d="M0 27 C15 24 19 21 28 24 S47 29 59 19 S77 15 86 12 S95 14 100 7 V34 H0Z" />
      <path className="user-summary-line-stroke" d="M0 27 C15 24 19 21 28 24 S47 29 59 19 S77 15 86 12 S95 14 100 7" />
    </svg>
  )
}

function SummaryCard({ label, value, detail, tone, icon }) {
  return (
    <article className={'user-summary-card ' + tone}>
      <span className="user-summary-icon"><Icon name={icon} /></span>
      <div className="user-summary-copy">
        <span className="user-summary-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <span aria-hidden="true" className="user-summary-arrow"><Icon name="chevron" /></span>
      <Trend tone={tone} />
    </article>
  )
}

function UserActionDialog({ user, mode, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user.name,
    role: user.role,
    department: user.department,
    jobTitle: user.jobTitle || '',
    status: user.status,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message || 'The user could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="user-action-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-labelledby="user-action-title" aria-modal="true" className="user-action-dialog" role="dialog">
        <div className="user-action-dialog-heading">
          <div>
            <h2 id="user-action-title">{mode === 'view' ? 'User profile' : mode === 'role' ? 'Change role' : 'Edit user'}</h2>
            <p>{user.name} <span>·</span> {user.email}</p>
          </div>
          <button aria-label="Close dialog" className="user-action-close" onClick={onClose} type="button"><Icon name="close" /></button>
        </div>
        {mode === 'view' ? (
          <dl className="user-profile-details">
            {[
              ['Role', user.role],
              ['Department', user.department],
              ['Account status', user.status],
              ['Email', user.email],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
        ) : (
          <form className="user-edit-form" onSubmit={submit}>
            {mode === 'edit' && <>
              <label>Full name<input onChange={(event) => update('name', event.target.value)} required value={form.name} /></label>
              <label>Department<input onChange={(event) => update('department', event.target.value)} required value={form.department} /></label>
              <label>Job title<input onChange={(event) => update('jobTitle', event.target.value)} value={form.jobTitle} /></label>
              <label>Account status<select onChange={(event) => update('status', event.target.value)} value={form.status}><option>Active</option><option>Pending</option><option>Disabled</option><option>Suspended</option></select></label>
            </>}
            <label>Role<select onChange={(event) => update('role', event.target.value)} value={form.role}><option>Admin</option><option>Manager</option><option>Employee</option></select></label>
            {error && <p role="alert">{error}</p>}
            <div className="user-action-dialog-footer">
              <button className="user-button-secondary" onClick={onClose} type="button">Cancel</button>
              <button className="user-button-primary" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        )}
        {mode === 'view' && <div className="user-action-dialog-footer"><button className="user-button-secondary" onClick={onClose} type="button">Close</button></div>}
      </section>
    </div>
  )
}

export default function AdminUsersPage({ initialFilter = 'all' }) {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(validStatuses.includes(initialFilter) ? initialFilter : 'all')
  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [actionDialog, setActionDialog] = useState(null)
  const [profileUser, setProfileUser] = useState(null)
  const [notice, setNotice] = useState('')
  const menuRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    const delay = window.setTimeout(() => {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize), sort_by: 'created-desc' })
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter !== 'all') {
        const status = { active: 'ACTIVE', disabled: 'DISABLED', pending: 'PENDING', suspended: 'SUSPENDED' }[statusFilter]
        if (status) params.set('status', status)
      }
      Promise.all([
        apiGet(`/api/admin/users?${params.toString()}`, { signal: controller.signal }),
        apiGet('/api/admin/users/summary', { signal: controller.signal }),
      ]).then(([pageData, summaryData]) => {
        setUsers(pageData.items.map(displayUser))
        setTotalUsers(pageData.total)
        setPageCount(Math.max(1, pageData.pages))
        setSummary(summaryData)
      }).catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setUsers([])
          setTotalUsers(0)
          setSummary(null)
          setError(requestError.message || 'Users could not be loaded.')
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    }, search ? 250 : 0)
    return () => {
      window.clearTimeout(delay)
      controller.abort()
    }
  }, [page, refreshKey, search, statusFilter])

  useEffect(() => {
    function refreshUsers() {
      setRefreshKey((value) => value + 1)
    }
    window.addEventListener('suredocs:admin-users-updated', refreshUsers)
    return () => window.removeEventListener('suredocs:admin-users-updated', refreshUsers)
  }, [])

  useEffect(() => {
    if (!openMenuId) return undefined
    function closeMenu(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpenMenuId(null)
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [openMenuId])

  const currentPage = Math.min(page, pageCount)
  const visibleUsers = users
  const start = totalUsers ? (currentPage - 1) * pageSize + 1 : 0
  const end = Math.min(currentPage * pageSize, totalUsers)

  function changeSearch(value) {
    setSearch(value)
    setPage(1)
  }

  function changeStatus(value) {
    setStatusFilter(value)
    setPage(1)
  }

  async function runAction(user, action) {
    setOpenMenuId(null)
    if (action === 'view') {
      setProfileUser(user)
      return
    }
    if (action === 'toggle') {
      const accountStatus = user.status === 'Disabled' ? 'ACTIVE' : 'DISABLED'
      try {
        await apiPatch(`/api/admin/users/${encodeURIComponent(user.id)}`, { account_status: accountStatus })
        setNotice(`${user.name}'s account is now ${accountStatus.toLowerCase()}.`)
        setRefreshKey((value) => value + 1)
      } catch (requestError) {
        setNotice(requestError.message || 'The account status could not be changed.')
      }
      return
    }
    setActionDialog({ user, mode: action })
  }

  async function saveUser(changes) {
    const selected = actionDialog.user
    const body = actionDialog.mode === 'role'
      ? { role: userApiRole(changes.role) }
      : {
          full_name: changes.name.trim(),
          department: changes.department.trim() || null,
          job_title: changes.jobTitle.trim() || null,
          role: userApiRole(changes.role),
          account_status: userApiStatus(changes.status),
        }
    await apiPatch(`/api/admin/users/${encodeURIComponent(selected.id)}`, body)
    setNotice(`${changes.name || selected.name} was updated.`)
    setActionDialog(null)
    setRefreshKey((value) => value + 1)
  }

  const closeProfile = useCallback(() => setProfileUser(null), [])

  function openProfileFromRow(event, user) {
    if (event.target.closest('button, a, input, select')) return
    setProfileUser(user)
  }

  return (
    <section aria-label="User management" className="user-management-page">
      <FlowingWave />
      <div className="user-summary-grid">
        <SummaryCard detail="All registered users" icon="users" label="Total Users" tone="total" value={summary?.total_users ?? '—'} />
        <SummaryCard detail="Currently active" icon="active" label="Active Users" tone="active" value={summary?.active_users ?? '—'} />
        <SummaryCard detail="Deactivated accounts" icon="disabled" label="Disabled Users" tone="disabled" value={summary?.disabled_users ?? '—'} />
        <SummaryCard detail="Awaiting activation" icon="pending" label="Pending Users" tone="pending" value={summary?.pending_users ?? '—'} />
      </div>

      <div className="user-management-controls">
        <label className="user-search-box">
          <Icon className="user-control-icon" name="search" />
          <span className="sr-only">Search users by name, email, or department</span>
          <input onChange={(event) => changeSearch(event.target.value)} placeholder="Search users by name, email, department..." type="search" value={search} />
        </label>
        <label className="user-status-filter">
          <Icon className="user-control-icon" name="filter" />
          <span className="sr-only">Filter users by status</span>
          <span aria-hidden="true" className="user-filter-caption">Filter by status</span>
          <select onChange={(event) => changeStatus(event.target.value)} value={statusFilter}>
            <option value="all">All Users</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <Icon className="user-filter-chevron" name="chevron" />
        </label>
      </div>

      {error && <p className="user-action-notice" role="alert">{error}</p>}
      {notice && <div className="user-action-notice" role="status"><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')} type="button"><Icon name="close" /></button></div>}

      <div className="user-table-shell">
        <div className="user-table-scroll">
          <table className="user-management-table">
            <colgroup><col className="user-col-name" /><col className="user-col-email" /><col className="user-col-role" /><col className="user-col-department" /><col className="user-col-status" /><col className="user-col-actions" /></colgroup>
            <thead><tr>{['User', 'Email', 'Role', 'Department', 'Account Status', 'Actions'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
            <tbody>
              {!loading && visibleUsers.map((user) => (
                <tr aria-label={`View profile for ${user.name}`} key={user.id} onClick={(event) => openProfileFromRow(event, user)} onKeyDown={(event) => { if (event.target !== event.currentTarget && event.target.closest('button, a, input, select')) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setProfileUser(user) } }} tabIndex={0}>
                  <td><span className="user-table-person"><UserAvatar className={'user-management-avatar ' + user.avatarTone} email={user.email} fullName={user.name} imageSrc={user.avatarSrc} /><span>{user.name}</span></span></td>
                  <td className="user-table-email" title={user.email}>{user.email}</td>
                  <td><span className={'user-role-badge ' + user.role.toLowerCase()}>{user.role}</span></td>
                  <td className="user-table-department">{user.department}</td>
                  <td><span className={'user-status-badge ' + user.status.toLowerCase()}><i />{user.status}</span></td>
                  <td className="user-actions-cell">
                    <div className="user-actions-wrap" ref={openMenuId === user.id ? menuRef : null}>
                      <button aria-expanded={openMenuId === user.id} aria-label={'Actions for ' + user.name} className="user-actions-button" onClick={(event) => { event.stopPropagation(); setOpenMenuId((current) => current === user.id ? null : user.id) }} type="button">⋮</button>
                      {openMenuId === user.id && <div className="user-actions-menu" role="menu">
                        <button onClick={() => runAction(user, 'view')} role="menuitem" type="button">View Profile</button>
                        <button onClick={() => runAction(user, 'edit')} role="menuitem" type="button">Edit User</button>
                        <button onClick={() => runAction(user, 'role')} role="menuitem" type="button">Change Role</button>
                        <button className={user.status === 'Disabled' ? 'enable-action' : 'disable-action'} onClick={() => runAction(user, 'toggle')} role="menuitem" type="button">{user.status === 'Disabled' ? 'Enable Account' : 'Disable Account'}</button>
                      </div>}
                    </div>
                  </td>
                </tr>
              ))}
              {loading && <tr><td className="user-empty-state" colSpan={6}>Loading users…</td></tr>}
              {!loading && visibleUsers.length === 0 && <tr><td className="user-empty-state" colSpan={6}>No users match your search or status filter.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="user-table-footer">
          <p>Showing {start}–{end} of {totalUsers} users</p>
          <nav aria-label="User pages" className="user-pagination">
            <button aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><Icon name="previous" /></button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => Math.max(1, Math.min(currentPage - 2, pageCount - 4)) + index).map((pageNumber) => <button aria-current={currentPage === pageNumber ? 'page' : undefined} className={currentPage === pageNumber ? 'current-page' : ''} key={pageNumber} onClick={() => setPage(pageNumber)} type="button">{pageNumber}</button>)}
            <button aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button"><Icon name="next" /></button>
          </nav>
        </footer>
      </div>

      {actionDialog && createPortal(<UserActionDialog mode={actionDialog.mode} onClose={() => setActionDialog(null)} onSave={saveUser} user={users.find((user) => user.id === actionDialog.user.id) ?? actionDialog.user} />, document.body)}
      {profileUser && <Suspense fallback={createPortal(<div className="user-profile-loading-backdrop" role="status">Opening user profile…</div>, document.body)}><UserProfileModal key={profileUser.id} user={users.find((user) => user.id === profileUser.id) ?? profileUser} onClose={closeProfile} onUserUpdate={() => setRefreshKey((value) => value + 1)} /></Suspense>}
    </section>
  )
}

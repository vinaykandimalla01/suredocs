import { useEffect, useState } from 'react'
import { apiGet } from './api.js'
import UserAvatar from './UserAvatar.jsx'

const pageSize = 10
const statusLabels = {
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
}

function formatDate(value) {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function UserDetailsDialog({ userId, onClose }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/api/admin/users/${encodeURIComponent(userId)}`, { signal: controller.signal })
      .then(setUser)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby="user-details-title"
        aria-modal="true"
        className="my-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900" id="user-details-title">
            User details
          </h2>
          <button
            aria-label="Close user details"
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        {error ? (
          <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>
        ) : !user ? (
          <p className="mt-5 text-sm text-slate-500" role="status">Loading user details…</p>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-4 border-b border-slate-100 pb-5">
              <UserAvatar className="h-14 w-14 text-lg" email={user.email} fullName={user.full_name} />
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900">{user.full_name}</h3>
                <p className="break-all text-sm text-slate-500">{user.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {user.role} · {statusLabels[user.account_status] ?? user.account_status}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ['User ID', user.id],
                ['Employee code', user.employee_code || '—'],
                ['Department', user.department || '—'],
                ['Job title', user.job_title || '—'],
                ['Email verified', formatDate(user.email_verified_at)],
                ['Created', formatDate(user.created_at)],
                ['Updated', formatDate(user.updated_at)],
                ['Last login', formatDate(user.last_login_at)],
                ['Password changed', formatDate(user.password_changed_at)],
                [
                  'Created by',
                  user.created_by
                    ? `${user.created_by.full_name} (${user.created_by.email})`
                    : '—',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>
    </div>
  )
}

export default function AdminUsersPage({ initialFilter = 'all', refreshKey = 0 }) {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState(['all', 'active', 'disabled', 'pending'].includes(initialFilter) ? initialFilter : 'all')
  const [department, setDepartment] = useState('')
  const [sortBy, setSortBy] = useState('created-desc')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loadedUrl, setLoadedUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    function syncStatusFilter() {
      const filter = new URLSearchParams(window.location.search).get('filter') ?? 'all'
      setStatus(['all', 'active', 'disabled', 'pending'].includes(filter) ? filter : 'all')
      setPage(1)
    }
    window.addEventListener('popstate', syncStatusFilter)
    return () => window.removeEventListener('popstate', syncStatusFilter)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    apiGet('/api/admin/users/summary', { signal: controller.signal })
      .then(setSummary)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
    return () => controller.abort()
  }, [refreshKey])

  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
  })
  if (debouncedSearch) params.set('search', debouncedSearch)
  if (role) params.set('role', role)
  if (status !== 'all') params.set('status', status.toUpperCase())
  if (department.trim()) params.set('department', department.trim())
  const listUrl = `/api/admin/users?${params}`
  const loading = loadedUrl !== listUrl

  useEffect(() => {
    const controller = new AbortController()
    apiGet(listUrl, { signal: controller.signal })
      .then((result) => {
        setUsers(result.items)
        setTotal(result.total)
        setPages(result.pages)
        setLoadedUrl(listUrl)
        setError('')
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setUsers([])
          setTotal(0)
          setPages(0)
          setError(requestError.message)
          setLoadedUrl(listUrl)
        }
      })
    return () => controller.abort()
  }, [listUrl, refreshKey])

  function changeStatusFilter(value) {
    setStatus(value)
    setPage(1)
    const url = value === 'all' ? '/admin/users?filter=all' : `/admin/users?filter=${value}`
    window.history.pushState({}, '', url)
  }

  const tabs = [
    ['all', 'All users', summary?.total_users],
    ['active', 'Active', summary?.active_users],
    ['disabled', 'Disabled', summary?.disabled_users],
    ['pending', 'Pending', summary?.pending_users],
  ]

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          ['Total users', summary?.total_users, 'text-blue-700'],
          ['Active users', summary?.active_users, 'text-emerald-700'],
          ['Disabled users', summary?.disabled_users, 'text-rose-700'],
          ['Administrators', summary?.administrator_users, 'text-violet-700'],
        ].map(([label, value, tone]) => (
          <div className="rounded-xl border border-slate-200 bg-white p-4" key={label}>
            <p className={`text-xs font-medium ${tone}`}>{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <nav aria-label="Filter users by account status" className="flex gap-5 overflow-x-auto border-b border-slate-200 px-4 pt-3">
          {tabs.map(([value, label, count]) => (
            <button
              aria-pressed={status === value}
              className={`whitespace-nowrap border-b-2 px-0.5 pb-3 text-xs font-medium ${
                status === value ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'
              }`}
              key={value}
              onClick={() => changeStatusFilter(value)}
              type="button"
            >
              {label}<span className="ml-1.5 text-slate-400">{count ?? '—'}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
          <label className="min-w-[220px] flex-1">
            <span className="sr-only">Search name or email</span>
            <input
              className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name or email"
              type="search"
              value={search}
            />
          </label>
          <label className="text-xs text-slate-500">
            <span className="sr-only">Filter by role</span>
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"
              onChange={(event) => {
                setRole(event.target.value)
                setPage(1)
              }}
              value={role}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            <span className="sr-only">Filter by department</span>
            <input
              className="h-9 w-40 rounded-lg border border-slate-200 px-3 text-xs text-slate-700"
              onChange={(event) => {
                setDepartment(event.target.value)
                setPage(1)
              }}
              placeholder="Department"
              value={department}
            />
          </label>
          <label className="text-xs text-slate-500">
            <span className="sr-only">Sort users</span>
            <select
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700"
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
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => {
              setSearch('')
              setRole('')
              setDepartment('')
              setSortBy('created-desc')
              changeStatusFilter('all')
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>

        {error && <p className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</p>}
        {loading && <p className="px-4 py-3 text-sm text-slate-500" role="status">Loading accounts…</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {['User', 'Email', 'Employee code', 'Role', 'Department', 'Job title', 'Status', 'Created', 'Last login', ''].map((heading, index) => (
                  <th className="px-3 py-3 first:pl-5" key={`${heading}-${index}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && users.map((user) => (
                <tr className="border-t border-slate-100 hover:bg-slate-50/70" key={user.id}>
                  <td className="whitespace-nowrap px-3 py-3 pl-5">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar email={user.email} fullName={user.full_name} />
                      <span className="text-xs font-semibold text-slate-800">{user.full_name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{user.email}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{user.employee_code || '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{user.role}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{user.department || '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{user.job_title || '—'}</td>
                  <td className="px-3 py-3 text-xs text-slate-600">{statusLabels[user.account_status] ?? user.account_status}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDate(user.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDate(user.last_login_at)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <button
                      className="rounded-md px-2 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                      onClick={() => setSelectedUserId(user.id)}
                      type="button"
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr><td className="px-5 py-12 text-center text-sm text-slate-500" colSpan={10}>No matching accounts.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[11px] text-slate-500">{total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} accounts` : 'No matching accounts'}</p>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] disabled:opacity-40"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous
            </button>
            <span className="text-[11px] text-slate-500">Page {page} of {Math.max(1, pages)}</span>
            <button
              className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] disabled:opacity-40"
              disabled={page >= pages || loading}
              onClick={() => setPage((current) => Math.min(pages, current + 1))}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedUserId && (
        <UserDetailsDialog onClose={() => setSelectedUserId(null)} userId={selectedUserId} />
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPost } from './api.js'
import './EmployeeAccessRequestsPage.css'

const avatarColors = ['#2468f4', '#9060ee', '#f20b8a', '#762be0', '#06a7ce']

function RequestIcon({ name, className = '' }) {
  const paths = {
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    deny: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    sort: <><path d="m8 9 4-4 4 4m0 6-4 4-4-4" /></>,
    eye: <><path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4" /><path d="M4 16v4h16v-4" /></>,
    edit: <><path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /></>,
    previous: <path d="m14.5 18-6-6 6-6" />,
    next: <path d="m9.5 18 6-6-6-6" />,
  }
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">{paths[name]}</svg>
}

function FileBadge({ type }) {
  return <span className={`ear-file ear-file--${type.toLowerCase()}`}>{type === 'XLSX' ? 'XLSX' : type}</span>
}

function MetricCard({ type, number, title, detail }) {
  return <article className={`ear-metric ear-metric--${type}`}>
    <span className="ear-metric-icon"><RequestIcon name={{ pending: 'clock', approved: 'users', denied: 'deny' }[type]} /></span>
    <span className="ear-metric-copy"><strong>{number}</strong><b>{title}</b><small>{detail}</small></span>
  </article>
}

function dateParts(value) {
  const date = new Date(value)
  return [date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })]
}

function Requester({ request, index }) {
  const initials = request.requester.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <span className="ear-requester"><span className="ear-avatar" style={{ backgroundColor: avatarColors[index % avatarColors.length] }}>{initials}</span><span className="ear-two-line"><b>{request.requester}</b><small>{request.department}</small></span></span>
}

function DocumentCell({ request }) {
  return <span className="ear-document"><FileBadge type={request.fileType} /><span className="ear-two-line"><b title={request.document}>{request.document}</b><small>{request.category}</small></span></span>
}

function AccessBadge({ permission }) {
  const icon = permission.includes('Edit') ? 'edit' : permission.includes('Download') ? 'download' : 'eye'
  const tone = permission.includes('Edit') ? 'edit' : permission.includes('Download') ? 'download' : 'read'
  return <span className={`ear-access ear-access--${tone}`}><RequestIcon name={icon} />{permission}</span>
}

function normalizeRequest(item) {
  const requested = item.requested_permissions || {}
  const extension = (item.original_filename || '').split('.').pop()?.toUpperCase()
  const permission = requested.can_edit
    ? requested.can_download ? 'View + Download + Edit' : 'View + Edit'
    : requested.can_download ? 'View & Download' : 'View'
  return {
    id: item.id,
    date: item.requested_at,
    requester: item.requester_name,
    requesterEmail: item.requester_email,
    requesterId: item.requester_user_id,
    department: item.requester_department || '—',
    document: item.original_filename || item.document_title,
    documentId: item.document_id,
    category: item.document_category || '—',
    fileType: ['PDF', 'DOCX', 'XLSX', 'PPTX'].includes(extension) ? extension : 'Other',
    permission,
    reason: item.reason,
    status: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
    isReviewer: item.is_reviewer,
    decisionReason: item.decision_reason,
  }
}


export default function EmployeeAccessRequestsPage() {
  const [requests, setRequests] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [documentFilter, setDocumentFilter] = useState('All Documents')
  const [requesterFilter, setRequesterFilter] = useState('All Requesters')
  const [dateFilter, setDateFilter] = useState('Last 30 Days')
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [openMenu, setOpenMenu] = useState('')
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState('')
  const pageSize = 8

  async function loadRequests({ silent = false } = {}) {
    if (!silent) setLoading(true)
    try {
      let currentPage = 1
      let allItems = []
      let total = 0
      do {
        const response = await apiGet('/api/access-requests?scope=owned&page=' + currentPage + '&page_size=100')
        allItems = [...allItems, ...response.items]
        total = response.total
        if (!response.items.length && allItems.length < total) {
          throw new Error('Access requests could not be loaded completely.')
        }
        currentPage += 1
      } while (allItems.length < total)
      setRequests(allItems.map(normalizeRequest))
      setLoadError('')
      try {
        setSummary(await apiGet('/api/access-requests/summary'))
        setSummaryError('')
      } catch (error) {
        setSummary(null)
        setSummaryError(error.message || 'Access summary could not be loaded.')
      }
    } catch (error) {
      setLoadError(error.message || 'Access requests could not be loaded.')
      if (!silent) setRequests([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const documentOptions = useMemo(
    () => [...new Map(requests.map((request) => [request.documentId, request.document])).entries()],
    [requests]
  )
  const requesterOptions = useMemo(
    () => [...new Map(requests.map((request) => [request.requesterId, request.requester])).entries()],
    [requests]
  )

  const visibleRequests = useMemo(() => {
    const search = query.trim().toLowerCase()
    const dateWindow = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90 }[dateFilter]
    const cutoff = dateWindow ? Date.now() - dateWindow * 24 * 60 * 60 * 1000 : 0
    return requests.filter((request) => {
      const matchesSearch = !search || [request.document, request.requester, request.requesterEmail, request.department, request.status, request.reason].join(' ').toLowerCase().includes(search)
      const matchesStatus = statusFilter === 'All Status' || request.status === statusFilter
      const matchesDocument = documentFilter === 'All Documents' || request.documentId === documentFilter
      const matchesRequester = requesterFilter === 'All Requesters' || request.requesterId === requesterFilter
      const matchesDate = !dateWindow || new Date(request.date).getTime() >= cutoff
      return matchesSearch && matchesStatus && matchesDocument && matchesRequester && matchesDate
    }).sort((first, second) => {
      const firstValue = sort.key === 'date' ? new Date(first.date).getTime() : String(first[sort.key] || '').toLowerCase()
      const secondValue = sort.key === 'date' ? new Date(second.date).getTime() : String(second[sort.key] || '').toLowerCase()
      const order = firstValue > secondValue ? 1 : firstValue < secondValue ? -1 : 0
      return sort.direction === 'asc' ? order : -order
    })
  }, [dateFilter, documentFilter, query, requesterFilter, requests, sort, statusFilter])

  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRequests = visibleRequests.slice((safePage - 1) * pageSize, safePage * pageSize)
  const firstRow = visibleRequests.length ? (safePage - 1) * pageSize + 1 : 0
  const allPageSelected = pageRequests.length > 0 && pageRequests.every((request) => selected.includes(request.id))
  const metricValue = (value) => loading ? '…' : summaryError || loadError || value == null ? '—' : String(value)

  function resetPage() {
    setPage(1)
    setSelected([])
  }

  function changeSort(key) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'date' ? 'desc' : 'asc' })
  }

  async function decide(request, action) {
    setActionId(request.id)
    setNotice('')
    try {
      const updated = await apiPost('/api/access-requests/' + encodeURIComponent(request.id) + '/' + action, {})
      setRequests((current) => current.map((item) => item.id === request.id ? normalizeRequest(updated) : item))
      window.dispatchEvent(new Event('suredocs:access-requests-updated'))
      setNotice(action === 'approve' ? 'Access request approved.' : 'Access request declined.')
      await loadRequests({ silent: true })
    } catch (error) {
      await loadRequests({ silent: true })
      setNotice(error.message || 'The access request could not be updated.')
    } finally {
      setActionId('')
    }
  }

  async function cancelRequest(request) {
    setActionId(request.id)
    setNotice('')
    try {
      const updated = await apiDelete('/api/access-requests/' + encodeURIComponent(request.id))
      setRequests((current) => current.map((item) => item.id === request.id ? normalizeRequest(updated) : item))
      window.dispatchEvent(new Event('suredocs:access-requests-updated'))
      setNotice('Access request cancelled.')
      await loadRequests({ silent: true })
    } catch (error) {
      await loadRequests({ silent: true })
      setNotice(error.message || 'The access request could not be cancelled.')
    } finally {
      setActionId('')
    }
  }

  function headerCell(label, key, className = '') {
    return <th className={className} key={key} scope="col"><button aria-label={'Sort by ' + label} aria-sort={sort.key === key ? sort.direction : 'none'} onClick={() => changeSort(key)} type="button">{label}<RequestIcon name="sort" /></button></th>
  }

  return <main className="employee-access-requests-page">
    <header className="ear-heading">
      <nav aria-label="Breadcrumb"><a href="/employee">Dashboard</a><span>›</span><span>Access Requests</span></nav>
      <div className="ear-heading-line"><div><h1>Access Requests</h1><p>Review and manage requests for document access.</p></div><span className="ear-source-note">Live document access requests</span></div>
    </header>

    {notice && <p className="ear-notice" role="status">{notice}</p>}
    {loadError && <p className="ear-load-error" role="alert">{loadError}</p>}

    <section aria-label="Access request summary" className="ear-metrics">
      <MetricCard detail="Awaiting your response" number={metricValue(summary?.pending_requests)} title="Pending Requests" type="pending" />
      <MetricCard detail="Distinct active recipients on your documents" number={metricValue(summary?.users_with_access)} title="Users with Access" type="approved" />
      <MetricCard detail="Declined access" number={metricValue(summary?.denied_requests)} title="Denied Requests" type="denied" />
    </section>

    <section aria-label="Search and filter access requests" className="ear-toolbar">
      <label className="ear-search"><RequestIcon name="search" /><span className="sr-only">Search requests by document, requester, or reason</span><input onChange={(event) => { setQuery(event.target.value); resetPage() }} placeholder="Search requests by document, requester, or reason..." value={query} /></label>
      <label className="ear-filter"><span className="sr-only">Status</span><select onChange={(event) => { setStatusFilter(event.target.value); resetPage() }} value={statusFilter}><option>All Status</option><option>Pending</option><option>Approved</option><option>Denied</option><option>Cancelled</option><option>Expired</option></select><RequestIcon name="chevron" /></label>
      <label className="ear-filter ear-filter--documents"><span className="sr-only">Document</span><select onChange={(event) => { setDocumentFilter(event.target.value); resetPage() }} value={documentFilter}><option>All Documents</option>{documentOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select><RequestIcon name="chevron" /></label>
      <label className="ear-filter ear-filter--requesters"><span className="sr-only">Requester</span><select onChange={(event) => { setRequesterFilter(event.target.value); resetPage() }} value={requesterFilter}><option>All Requesters</option>{requesterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><RequestIcon name="chevron" /></label>
      <label className="ear-filter ear-filter--dates"><span className="sr-only">Date range</span><select onChange={(event) => { setDateFilter(event.target.value); resetPage() }} value={dateFilter}><option>Last 7 Days</option><option>Last 30 Days</option><option>Last 90 Days</option><option>All Time</option></select><RequestIcon name="chevron" /><RequestIcon className="ear-calendar" name="calendar" /></label>
    </section>

    <section aria-label="Access requests" className="ear-table-card">
      <div className="ear-table-scroll"><table>
        <colgroup><col className="ear-col-select" /><col className="ear-col-date" /><col className="ear-col-requester" /><col className="ear-col-document" /><col className="ear-col-access" /><col className="ear-col-reason" /><col className="ear-col-status" /><col className="ear-col-actions" /></colgroup>
        <thead><tr>
          <th className="ear-select-cell"><input aria-label="Select all requests on this page" checked={allPageSelected} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, ...pageRequests.map((request) => request.id)])] : current.filter((id) => !pageRequests.some((request) => request.id === id)))} type="checkbox" /></th>
          {headerCell('Date & Time', 'date')}{headerCell('Requester', 'requester')}{headerCell('Document', 'document')}{headerCell('Requested Access', 'permission')}{headerCell('Reason', 'reason')}{headerCell('Status', 'status')}
          <th className="ear-actions-heading" scope="col">Actions</th>
        </tr></thead>
        <tbody>
          {pageRequests.map((request, index) => {
            const [date, time] = dateParts(request.date)
            return <tr key={request.id}>
              <td className="ear-select-cell"><input aria-label={'Select ' + request.requester + "'s request for " + request.document} checked={selected.includes(request.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, request.id] : current.filter((id) => id !== request.id))} type="checkbox" /></td>
              <td><span className="ear-date"><span>{date}</span><span>{time}</span></span></td>
              <td><Requester index={index} request={request} /></td>
              <td><DocumentCell request={request} /></td>
              <td><AccessBadge permission={request.permission} /></td>
              <td><span className="ear-reason" title={request.reason}>{request.reason}</span></td>
              <td><span className={'ear-status ear-status--' + request.status.toLowerCase()}>{['Pending', 'Approved', 'Denied'].includes(request.status) && <RequestIcon name={{ Pending: 'clock', Approved: 'check', Denied: 'deny' }[request.status]} />}{request.status}</span></td>
              <td className="ear-row-actions">{request.status === 'Pending'
                ? request.isReviewer
                  ? <><button aria-label={`Approve ${request.requester}'s request`} className="ear-accept" disabled={actionId === request.id} onClick={() => decide(request, 'approve')} title="Approve request" type="button">{actionId === request.id ? '…' : <RequestIcon name="check" />}</button><button aria-label={`Deny ${request.requester}'s request`} className="ear-decline" disabled={actionId === request.id} onClick={() => decide(request, 'deny')} title="Deny request" type="button">{actionId === request.id ? '…' : <RequestIcon name="deny" />}</button></>
                  : <button aria-label={`Cancel ${request.requester}'s request`} className="ear-decline" disabled={actionId === request.id} onClick={() => cancelRequest(request)} title="Cancel request" type="button">{actionId === request.id ? '…' : <RequestIcon name="deny" />}</button>
                : <div className="ear-menu-anchor"><button aria-expanded={openMenu === request.id} aria-label={'Actions for ' + request.id} className="ear-more" onClick={() => setOpenMenu((current) => current === request.id ? '' : request.id)} type="button"><RequestIcon name="more" /></button>{openMenu === request.id && <div className="ear-row-menu" role="menu"><strong>{request.id}</strong><span>{request.requester} · {request.status}</span><span>{request.reason}</span>{request.decisionReason && <span>{request.decisionReason}</span>}</div>}</div>}</td>
            </tr>
          })}
          {!loading && pageRequests.length === 0 && <tr><td className="ear-empty" colSpan="8">{loadError || 'No requests match the selected search and filters.'}</td></tr>}
          {loading && <tr><td className="ear-empty" colSpan="8">Loading requests…</td></tr>}
        </tbody>
      </table></div>
      <footer className="ear-table-footer"><span>Showing {firstRow}–{Math.min(safePage * pageSize, visibleRequests.length)} of {visibleRequests.length} requests</span><nav aria-label="Request pages" className="ear-pagination"><button aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><RequestIcon name="previous" /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button aria-current={number === safePage ? 'page' : undefined} className={number === safePage ? 'is-active' : ''} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}<button aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button"><RequestIcon name="next" /></button></nav></footer>
    </section>
  </main>
}

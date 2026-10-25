import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiGet, apiGetFile, apiPost } from './api.js'
import './EmployeeActivitySection.css'

const actionOptions = [
  'DOCUMENT_VIEWED', 'DOCUMENT_DOWNLOADED', 'DOCUMENT_METADATA_UPDATED', 'PERMISSION_GRANTED',
  'PERMISSION_REVOKED', 'ACCESS_DENIED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERSION_CREATED',
  'DOCUMENT_DELETED', 'DOCUMENT_RESTORED', 'DOCUMENT_SCAN_COMPLETED', 'UPLOAD_REJECTED',
  'ACCESS_REQUEST_SUBMITTED', 'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_DENIED',
  'ACCESS_REQUEST_CANCELLED',
]
const flagReasons = [
  ['SUSPICIOUS_ACCESS', 'Suspicious document access'],
  ['UNEXPECTED_DOWNLOAD', 'Unexpected download'],
  ['UNAUTHORIZED_ATTEMPT', 'Unauthorized access attempt'],
  ['PERMISSION_CHANGE', 'Unexpected permission change'],
  ['UNRECOGNIZED_ACTOR', 'Unrecognized actor'],
  ['OTHER', 'Other'],
]

function eventTime(value, includeZone = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    ...(includeZone ? { timeZoneName: 'short' } : {}),
  }).format(date)
}

function fileSize(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(Number(bytes))) return ''
  const size = Number(bytes)
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function initials(name) {
  return (name || 'Unavailable').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '—'
}

function newUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function outcomeTone(outcome) {
  if (outcome === 'SUCCESS') return 'green'
  if (outcome === 'DENIED') return 'red'
  return 'amber'
}

function DefinitionList({ items }) {
  return <dl className="activity-definition-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Unavailable'}</dd></div>)}</dl>
}

export default function EmployeeActivitySection({
  user,
  notificationProps,
  notificationsOpen,
  setNotificationsOpen,
  EmployeeTopBar,
  EmployeeIcon,
  EmployeeSearch,
  EmployeeFilter,
  EmployeeBadge,
  activityLabel,
  activityIcon,
  activityTone,
}) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [outcome, setOutcome] = useState('')
  const [dateRange, setDateRange] = useState('30d')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportingEventId, setExportingEventId] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [menu, setMenu] = useState(null)
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('eventId') || '')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [detailsError, setDetailsError] = useState('')
  const [actorEvent, setActorEvent] = useState(null)
  const [actorLoading, setActorLoading] = useState(false)
  const [flagEvent, setFlagEvent] = useState(null)
  const [flagReason, setFlagReason] = useState('SUSPICIOUS_ACCESS')
  const [flagDescription, setFlagDescription] = useState('')
  const [flagSubmissionId, setFlagSubmissionId] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)
  const [flagError, setFlagError] = useState('')
  const flagSubmittingRef = useRef(false)
  const [toast, setToast] = useState(null)

  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (action) params.set('action', action)
    if (outcome) params.set('outcome', outcome)
    params.set('date_range', dateRange)
    if (dateRange === 'custom' && startDate && endDate) {
      params.set('start_at', new Date(`${startDate}T00:00:00`).toISOString())
      params.set('end_at', new Date(`${endDate}T23:59:59.999`).toISOString())
    }
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return params
  }, [action, dateRange, endDate, outcome, page, pageSize, search, sort, startDate])

  useEffect(() => {
    if (dateRange === 'custom' && (!startDate || !endDate)) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiGet(`/api/documents/activity?${queryParams.toString()}`, { signal: controller.signal })
        if (!controller.signal.aborted) setData({ key: queryParams.toString(), response })
      } catch (requestError) {
        if (requestError.name !== 'AbortError' && !controller.signal.aborted) {
          setData(null)
          setError(requestError.message || 'Document activity could not be loaded.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search.trim() ? 180 : 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [dateRange, endDate, queryParams, reloadKey, search, startDate])

  useEffect(() => {
    if (!selectedId) return undefined
    const controller = new AbortController()
    apiGet(`/api/documents/activity/events/${encodeURIComponent(selectedId)}`, { signal: controller.signal })
      .then((event) => { if (!controller.signal.aborted) setSelectedEvent(event) })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError' && !controller.signal.aborted) setDetailsError(requestError.message || 'Activity details are unavailable.')
      })
    return () => controller.abort()
  }, [selectedId])

  useEffect(() => {
    if (!menu) return undefined
    const closeOutside = (event) => { if (!event.target.closest?.('[data-activity-menu]')) setMenu(null) }
    const closeEscape = (event) => { if (event.key === 'Escape') setMenu(null) }
    const closeOnLayoutChange = () => setMenu(null)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    window.addEventListener('scroll', closeOnLayoutChange, true)
    window.addEventListener('resize', closeOnLayoutChange)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeEscape)
      window.removeEventListener('scroll', closeOnLayoutChange, true)
      window.removeEventListener('resize', closeOnLayoutChange)
    }
  }, [menu])

  useEffect(() => {
    if (!selectedId && !actorEvent && !flagEvent) return undefined
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        closeDetails()
        setActorEvent(null)
        setFlagEvent(null)
      }
    }
    document.addEventListener('keydown', closeEscape)
    return () => document.removeEventListener('keydown', closeEscape)
  }, [actorEvent, flagEvent, selectedId])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  function updateFilter(setter, value) {
    setter(value)
    setPage(1)
    setError('')
  }

  function updateDateRange(value) {
    setDateRange(value)
    setPage(1)
    setError('')
    if (value === 'custom') {
      setData(null)
      setLoading(false)
      setStartDate('')
      setEndDate('')
    }
  }

  function openMenu(event, record) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const width = 232
    const height = 276
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width))
    const top = bounds.bottom + height > window.innerHeight - 8
      ? Math.max(8, bounds.top - height)
      : Math.max(8, bounds.bottom + 4)
    setMenu({ record, left, top })
  }

  async function exportActivity() {
    if (exporting) return
    setExporting(true)
    setToast({ tone: 'info', text: 'Preparing the filtered activity export…' })
    try {
      const params = new URLSearchParams(queryParams)
      params.delete('page')
      params.delete('page_size')
      const file = await apiGetFile(`/api/documents/activity/export.csv?${params.toString()}`)
      downloadBlob(file.blob, 'suredocs-document-activity.csv')
      setToast({ tone: 'success', text: 'Exported all events matching the current filters.' })
    } catch (requestError) {
      setToast({ tone: 'error', text: requestError.message || 'Activity export failed.' })
    } finally {
      setExporting(false)
    }
  }

  async function copyEventId(record) {
    setMenu(null)
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(record.id)
      else {
        const input = document.createElement('textarea')
        input.value = record.id
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        const copied = document.execCommand('copy')
        input.remove()
        if (!copied) throw new Error('Clipboard access is unavailable. Copy the event ID from Activity Details.')
      }
      setToast({ tone: 'success', text: 'Event ID copied.' })
    } catch (requestError) {
      setToast({ tone: 'error', text: requestError.message || 'Could not copy the event ID.' })
    }
  }

  async function exportEventDetails(record) {
    setMenu(null)
    if (exportingEventId) return
    setExportingEventId(record.id)
    setToast({ tone: 'info', text: 'Preparing event details…' })
    try {
      const file = await apiGetFile(`/api/documents/activity/events/${encodeURIComponent(record.id)}/export.json`)
      downloadBlob(file.blob, `activity-event-${record.id}.json`)
      setToast({ tone: 'success', text: 'Activity event details exported.' })
    } catch (requestError) {
      setToast({ tone: 'error', text: requestError.message || 'Event export failed.' })
    } finally {
      setExportingEventId('')
    }
  }

  async function openActor(record) {
    setMenu(null)
    setActorEvent(null)
    setActorLoading(true)
    try {
      setActorEvent(await apiGet(`/api/documents/activity/events/${encodeURIComponent(record.id)}`))
    } catch (requestError) {
      setToast({ tone: 'error', text: requestError.message || 'Actor information is unavailable.' })
    } finally {
      setActorLoading(false)
    }
  }

  function openFlag(record) {
    setMenu(null)
    setFlagEvent(record)
    setFlagReason('SUSPICIOUS_ACCESS')
    setFlagDescription('')
    setFlagSubmissionId(newUuid())
    setFlagError('')
  }

  async function submitFlag(event) {
    event.preventDefault()
    if (!flagEvent || flagSubmittingRef.current) return
    flagSubmittingRef.current = true
    setFlagSubmitting(true)
    setFlagError('')
    try {
      await apiPost(`/api/documents/activity/events/${encodeURIComponent(flagEvent.id)}/flags`, {
        submission_id: flagSubmissionId,
        reason_code: flagReason,
        description: flagDescription.trim() || null,
      })
      setFlagEvent(null)
      setToast({ tone: 'success', text: 'The event was submitted for security review.' })
    } catch (requestError) {
      setFlagError(requestError.message || 'The security review report could not be saved.')
    } finally {
      flagSubmittingRef.current = false
      setFlagSubmitting(false)
    }
  }

  function closeDetails() {
    setSelectedId('')
    setSelectedEvent(null)
    setDetailsError('')
    const url = new URL(window.location.href)
    if (url.searchParams.has('eventId')) {
      url.searchParams.delete('eventId')
      window.history.replaceState(null, '', url)
    }
  }

  function openDetails(eventId) {
    setSelectedEvent(null)
    setDetailsError('')
    setSelectedId(eventId)
  }

  const currentQuery = queryParams.toString()
  const activeData = data?.key === currentQuery ? data.response : null
  const customRangeIncomplete = dateRange === 'custom' && (!startDate || !endDate)
  const requestLoading = loading || (!activeData && !error && !customRangeIncomplete)
  const pageCount = Math.max(1, Math.ceil((activeData?.total ?? 0) / pageSize))
  const records = activeData?.items || []
  const menuRecord = menu?.record
  const canViewDocument = (record) => record.document.status === 'ACTIVE' && record.document.current_version_status === 'AVAILABLE'
  const detailsLoading = Boolean(selectedId && !selectedEvent && !detailsError)

  return <>
    <EmployeeTopBar
      {...notificationProps}
      notificationsOpen={notificationsOpen}
        onSearchChange={(event) => { setSearch(event.target.value); setPage(1); setError('') }}
      search={search}
      setNotificationsOpen={setNotificationsOpen}
      user={user}
    />
    <main className="employee-activity-page">
      <div className="activity-breadcrumb"><a href="/employee">Dashboard</a><span>›</span><strong>Document Activity</strong></div>
      <header className="activity-page-heading">
        <div><h1>Document Activity</h1><p>Review audit events for documents you own and actions your account can access.</p></div>
        <button className="activity-export-button" disabled={requestLoading || exporting || !activeData?.total} onClick={exportActivity} type="button"><EmployeeIcon name="download" />{exporting ? 'Exporting…' : 'Export Activity'}</button>
      </header>

      <section aria-label="Activity summary" className="activity-metrics">
        <article className="activity-metric activity-metric-total"><span className="activity-metric-icon"><EmployeeIcon name="file" /></span><span><small>Total Events</small><strong>{activeData ? Number(activeData.total).toLocaleString() : '—'}</strong><em>Audit records matching filters</em></span></article>
        <article className="activity-metric activity-metric-success"><span className="activity-metric-icon"><EmployeeIcon name="check" /></span><span><small>Successful</small><strong>{activeData ? Number(activeData.successful).toLocaleString() : '—'}</strong><em>Completed successfully</em></span></article>
        <article className="activity-metric activity-metric-denied"><span className="activity-metric-icon"><EmployeeIcon name="denied" /></span><span><small>Denied</small><strong>{activeData ? Number(activeData.denied).toLocaleString() : '—'}</strong><em>Access denied</em></span></article>
      </section>
      <p className="activity-metric-note">Metrics reflect all matching events. Export Activity downloads every matching event across all pages.</p>

      <section aria-label="Search and filter activity" className="activity-filter-bar">
        <EmployeeSearch label="Search document activity" onChange={(value) => { setSearch(value); setPage(1); setError('') }} placeholder="Search documents, actors, actions, or event ID..." value={search} />
        <EmployeeFilter label="Activity action" onChange={(value) => updateFilter(setAction, value)} options={[{ value: '', label: 'All Actions' }, ...actionOptions.map((value) => ({ value, label: activityLabel(value) }))]} value={action} />
        <EmployeeFilter label="Activity outcome" onChange={(value) => updateFilter(setOutcome, value)} options={[{ value: '', label: 'All Outcomes' }, { value: 'SUCCESS', label: 'Success' }, { value: 'DENIED', label: 'Denied' }, { value: 'FAILED', label: 'Failed' }]} value={outcome} />
          <EmployeeFilter label="Activity date range" onChange={updateDateRange} options={[{ value: '24h', label: 'Last 24 Hours' }, { value: '7d', label: 'Last 7 Days' }, { value: '30d', label: 'Last 30 Days' }, { value: '90d', label: 'Last 90 Days' }, { value: 'custom', label: 'Custom Date Range' }]} value={dateRange} />
          {dateRange === 'custom' && <><label className="activity-custom-date"><span className="sr-only">Start date</span><input aria-label="Start date" onChange={(event) => { setStartDate(event.target.value); setPage(1) }} type="date" value={startDate} /></label><label className="activity-custom-date"><span className="sr-only">End date</span><input aria-label="End date" min={startDate || undefined} onChange={(event) => { setEndDate(event.target.value); setPage(1) }} type="date" value={endDate} /></label></>}
      </section>
      {error && <div className="activity-error" role="alert"><span>{error}</span><button onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div>}

      <section aria-label="Document activity events" aria-busy={requestLoading} className="activity-table-card">
        <div className="activity-table-wrap"><table className="activity-table">
          <thead><tr>
            <th aria-sort={sort === 'newest' ? 'descending' : 'ascending'}><button className="activity-sort-button" onClick={() => { setSort((value) => value === 'newest' ? 'oldest' : 'newest'); setError('') }} type="button">Timestamp <span>{sort === 'newest' ? '↓' : '↑'}</span></button></th>
            <th>Action</th><th>Document</th><th>Actor</th><th>Outcome</th><th>Details</th>
          </tr></thead>
          <tbody>
            {records.map((event) => {
              const extension = event.document.file_extension?.toUpperCase() || 'FILE'
              const actorName = event.actor.name || 'System or unavailable account'
              return <tr key={event.id}>
                <td className="activity-time-cell"><time dateTime={event.occurred_at}>{eventTime(event.occurred_at)}</time></td>
                <td><span className="activity-action-cell"><span className={`activity-action-icon ${activityTone(event.action_type)}`}><EmployeeIcon name={activityIcon(event.action_type)} /></span><strong>{activityLabel(event.action_type)}</strong></span></td>
                <td><span className="activity-document-cell"><span className={`activity-file-icon activity-file-${extension.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>{extension.slice(0, 4)}</span><span><strong title={event.document.title}>{event.document.title}</strong><small>{extension}{event.document.size_bytes !== null ? ` · ${fileSize(event.document.size_bytes)}` : ''}</small></span></span></td>
                <td><span className="activity-actor-cell"><span>{initials(actorName)}</span><strong title={event.actor.email || actorName}>{actorName}</strong></span></td>
                <td><EmployeeBadge tone={outcomeTone(event.result)}>{event.result === 'SUCCESS' ? 'Success' : event.result === 'DENIED' ? 'Denied' : 'Failed'}</EmployeeBadge></td>
                <td><button aria-label={`Open actions for ${activityLabel(event.action_type)} event`} aria-expanded={menuRecord?.id === event.id} className="activity-more-button" data-activity-menu onClick={(clickEvent) => openMenu(clickEvent, event)} type="button"><EmployeeIcon name="more" /></button></td>
              </tr>
            })}
            {!requestLoading && !error && records.length === 0 && <tr><td className="activity-empty-cell" colSpan={6}>{customRangeIncomplete ? 'Choose both dates to view activity in a custom range.' : activeData?.total ? 'No activity appears on this page.' : search || action || outcome ? 'No activity matches these filters.' : 'No audit events have been recorded for your documents in this date range.'}</td></tr>}
            {requestLoading && <tr><td className="activity-empty-cell" colSpan={6}>Loading authorized activity…</td></tr>}
            {!requestLoading && error && <tr><td className="activity-empty-cell" colSpan={6}>Activity records are unavailable.</td></tr>}
          </tbody>
        </table></div>
        <footer className="activity-table-footer">
          <span>{activeData?.total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, activeData.total)} of ${Number(activeData.total).toLocaleString()} activities` : 'No matching activities'}</span>
          <div className="activity-pagination-tools">
            <label><span className="sr-only">Activities per page</span><select aria-label="Activities per page" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} value={pageSize}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option></select></label>
              <nav aria-label="Activity pages" className="activity-pagination">
                <button aria-label="Previous page" disabled={page <= 1 || requestLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button>
                <span>Page {page} of {pageCount}</span>
                <button aria-label="Next page" disabled={page >= pageCount || requestLoading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">›</button>
              </nav>
          </div>
        </footer>
      </section>
    </main>

    {menu && createPortal(<div className="activity-context-menu" data-activity-menu role="menu" style={{ left: menu.left, top: menu.top }}>
      <button onClick={() => { setMenu(null); openDetails(menu.record.id) }} role="menuitem" type="button"><EmployeeIcon name="file" /><span><strong>View Activity Details</strong><small>Open full event information</small></span></button>
      <button disabled={!canViewDocument(menu.record)} onClick={() => { const id = menu.record.document.id; setMenu(null); window.location.assign(`/employee/documents?documentId=${encodeURIComponent(id)}`) }} role="menuitem" title={!canViewDocument(menu.record) ? 'This document is no longer available.' : 'Open through the authorized document workspace.'} type="button"><EmployeeIcon name="eye" /><span><strong>View Document</strong><small>{canViewDocument(menu.record) ? 'Open in My Documents' : 'Document unavailable'}</small></span></button>
      <button onClick={() => openActor(menu.record)} role="menuitem" type="button"><EmployeeIcon name="users" /><span><strong>View Actor</strong><small>See authorized actor details</small></span></button>
      <div className="activity-menu-separator" />
      <button onClick={() => copyEventId(menu.record)} role="menuitem" type="button"><EmployeeIcon name="link" /><span><strong>Copy Event ID</strong><small>Copy the immutable event ID</small></span></button>
      <button onClick={() => exportEventDetails(menu.record)} role="menuitem" type="button"><EmployeeIcon name="download" /><span><strong>Export Event Details</strong><small>Download authorized JSON</small></span></button>
      <div className="activity-menu-separator" />
      <button onClick={() => openFlag(menu.record)} role="menuitem" type="button"><EmployeeIcon name="shield" /><span><strong>Flag for Security Review</strong><small>Submit an event report</small></span></button>
    </div>, document.body)}

    {selectedId && <div className="activity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetails() }}>
      <section aria-labelledby="activity-detail-title" aria-modal="true" className="activity-detail-modal" role="dialog">
        <header className="activity-modal-header"><div><h2 id="activity-detail-title">Activity Details</h2><p>Detailed information about this document activity record.</p></div><button aria-label="Close activity details" onClick={closeDetails} type="button"><EmployeeIcon name="close" /></button></header>
        {detailsLoading && <div className="activity-modal-state" role="status">Loading authorized event details…</div>}
        {detailsError && <div className="activity-modal-state is-error" role="alert">{detailsError}</div>}
        {selectedEvent && <div className="activity-modal-content">
          <div className="activity-detail-summary"><span className={`activity-action-icon ${activityTone(selectedEvent.action_type)}`}><EmployeeIcon name={activityIcon(selectedEvent.action_type)} /></span><span><strong>{activityLabel(selectedEvent.action_type)}</strong><small>{eventTime(selectedEvent.occurred_at, true)}</small></span><EmployeeBadge tone={outcomeTone(selectedEvent.result)}>{selectedEvent.result === 'SUCCESS' ? 'Success' : selectedEvent.result === 'DENIED' ? 'Denied' : 'Failed'}</EmployeeBadge></div>
          <section className="activity-detail-section"><h3><EmployeeIcon name="file" />Document Information</h3><DefinitionList items={[
            ['Document', selectedEvent.document.title], ['Document ID', selectedEvent.document.id], ['Owner', selectedEvent.document.owner.name],
            ['File type', selectedEvent.document.file_extension?.toUpperCase()], ['File size', fileSize(selectedEvent.document.size_bytes)],
            ['Category', selectedEvent.document.category], ['Version', selectedEvent.document.current_version_number ? `Version ${selectedEvent.document.current_version_number}` : null],
            ['Document state', selectedEvent.document.status],
          ]} /></section>
          <section className="activity-detail-section"><h3><EmployeeIcon name="users" />Actor Information</h3><DefinitionList items={[
            ['Actor', selectedEvent.actor?.name || 'System or unavailable account'], ['Email', selectedEvent.actor?.email], ['User ID', selectedEvent.actor?.id],
            ['Current role', selectedEvent.actor?.role], ['Account status', selectedEvent.actor?.account_status],
            ['Target user', selectedEvent.target?.name], ['Target email', selectedEvent.target?.email],
          ]} /></section>
          <section className="activity-detail-section"><h3><EmployeeIcon name="activity" />Activity Information</h3><DefinitionList items={[
            ['Action', activityLabel(selectedEvent.action_type)], ['Outcome', selectedEvent.result], ['Timestamp', eventTime(selectedEvent.occurred_at, true)],
            ['Event ID', selectedEvent.id], ['Request ID', selectedEvent.request_id], ['IP address', selectedEvent.ip_address], ['Browser / device', selectedEvent.user_agent],
          ]} /></section>
          {Object.keys(selectedEvent.details || {}).length > 0 && <section className="activity-detail-section activity-detail-metadata"><h3><EmployeeIcon name="info" />Sanitized Details</h3><pre>{JSON.stringify(selectedEvent.details, null, 2)}</pre></section>}
        </div>}
        <footer className="activity-modal-footer"><button onClick={closeDetails} type="button">Close</button></footer>
      </section>
    </div>}

    {actorEvent && <div className="activity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActorEvent(null) }}>
      <section aria-labelledby="activity-actor-title" aria-modal="true" className="activity-actor-modal" role="dialog">
        <header className="activity-modal-header"><div><h2 id="activity-actor-title">Actor Information</h2><p>Identity recorded for this activity event.</p></div><button aria-label="Close actor information" onClick={() => setActorEvent(null)} type="button"><EmployeeIcon name="close" /></button></header>
        <div className="activity-actor-profile"><span>{initials(actorEvent.actor?.name)}</span><div><strong>{actorEvent.actor?.name || 'System or unavailable account'}</strong><small>{actorEvent.actor?.email || actorEvent.actor?.role || 'No user account was associated with this event.'}</small></div></div>
        <DefinitionList items={[
          ['User ID', actorEvent.actor?.id], ['Current role', actorEvent.actor?.role], ['Account status', actorEvent.actor?.account_status],
          ['Event', activityLabel(actorEvent.action_type)], ['Document', actorEvent.document?.title],
          ['Relationship', actorEvent.document?.owner?.id === actorEvent.actor?.id ? 'Document owner' : actorEvent.actor?.id ? 'Actor on an owner-accessible document' : 'System or service event'],
        ]} />
        <footer className="activity-modal-footer"><button onClick={() => setActorEvent(null)} type="button">Close</button></footer>
      </section>
    </div>}
    {actorLoading && <div className="activity-toast" role="status">Loading authorized actor information…</div>}

    {flagEvent && <div className="activity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !flagSubmitting) setFlagEvent(null) }}>
      <form aria-labelledby="activity-flag-title" aria-modal="true" className="activity-flag-modal" onSubmit={submitFlag} role="dialog">
        <header className="activity-modal-header"><div><h2 id="activity-flag-title">Flag for Security Review</h2><p>Submit this event to the SureDocs security review queue.</p></div><button aria-label="Close security review form" disabled={flagSubmitting} onClick={() => setFlagEvent(null)} type="button"><EmployeeIcon name="close" /></button></header>
        <div className="activity-flag-event"><strong>{activityLabel(flagEvent.action_type)}</strong><span>{flagEvent.document.title} · {flagEvent.actor.name || 'System or unavailable account'}</span><small>Event {flagEvent.id} · {eventTime(flagEvent.occurred_at, true)}</small></div>
        <label className="activity-form-field">Reason<select onChange={(event) => setFlagReason(event.target.value)} value={flagReason}>{flagReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="activity-form-field">Description <span>(optional)</span><textarea maxLength={2000} onChange={(event) => setFlagDescription(event.target.value)} placeholder="Add context that will help the reviewer." rows={4} value={flagDescription} /></label>
        <p className="activity-character-count">{flagDescription.length}/2000 characters</p>
        {flagError && <p className="activity-form-error" role="alert">{flagError}</p>}
        <footer className="activity-modal-footer"><button disabled={flagSubmitting} onClick={() => setFlagEvent(null)} type="button">Cancel</button><button className="activity-submit-flag" disabled={flagSubmitting} type="submit">{flagSubmitting ? 'Submitting…' : 'Submit Flag'}</button></footer>
      </form>
    </div>}
    {toast && <div className={`activity-toast is-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.text}</div>}
  </>
}

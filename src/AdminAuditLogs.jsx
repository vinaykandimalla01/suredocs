import { lazy, Suspense, useEffect, useState } from 'react'
import { apiGet, apiGetFile } from './api.js'
import './AdminAuditLogs.css'

const AdminAuditActivityChart = lazy(() => import('./AdminAuditActivityChart.jsx'))

function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function defaultDateRange() {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: localDateValue(from), to: localDateValue(today) }
}

function dateKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function displayDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(new Date(value))
}

function displayTime(value) {
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function fileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return ''
  const size = Number(bytes)
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`
}

function ActionIcon({ event, className = '' }) {
  const type = event.actionType || ''
  const denied = event.outcome === 'Denied' || event.outcome === 'Failed'
  const color = denied
    ? 'red'
    : type.includes('PERMISSION_GRANTED')
      ? 'green'
      : type.includes('PERMISSION_REVOKED')
        ? 'red'
        : type.includes('ACCOUNT_LOCKED') || type.includes('INACTIVE')
          ? 'orange'
          : 'blue'
  const path = type.includes('VIEWED')
    ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
    : type.includes('DOWNLOADED')
      ? <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>
      : type.includes('UPLOADED')
        ? <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M5 17v3h14v-3" /></>
        : type.includes('PERMISSION')
          ? <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1m3-11v6m-3-3h6" /></>
          : type.includes('DELETED')
            ? <><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>
            : type.includes('METADATA')
              ? <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>
              : type.includes('LOGIN') || type.includes('AUTH') || type.includes('ACCOUNT')
                ? <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>
                : type.includes('EXPIRED') || type.includes('LOCKED')
                  ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
                  : <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>
  return <span className={`audit-action-icon is-${color} ${className}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg></span>
}

function StatusPill({ outcome }) {
  const tone = outcome === 'Success' ? 'success' : outcome === 'Denied' ? 'denied' : 'failed'
  return <span className={`audit-status is-${tone}`}>{outcome || 'Unknown'}</span>
}

function Trend({ current, previous }) {
  if (previous === 0) {
    return <span className="audit-trend">{current === 0 ? 'No change' : 'New activity'}</span>
  }
  const change = Math.round(((current - previous) / previous) * 100)
  const positive = change >= 0
  return <span className={`audit-trend ${positive ? 'is-up' : 'is-down'}`}>{positive ? '↑' : '↓'} {Math.abs(change)}% from last period</span>
}

function sparklinePaths(values) {
  if (!values.length) return { line: '', area: '' }
  const numeric = values.map((value) => Number(value) || 0)
  const max = Math.max(1, ...numeric)
  const points = numeric.map((value, index) => {
    const x = numeric.length === 1 ? 40 : (index / (numeric.length - 1)) * 80
    const y = 26 - (value / max) * 22
    return [x, y]
  })
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ')
  return { line, area: `${line} L80 30 L0 30 Z` }
}

function queryString(filters, { sort, page, pageSize, activityDays } = {}) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.action) params.set('action', filters.action)
  if (filters.actorId) params.set('actor_id', filters.actorId)
  if (filters.documentId) params.set('document_id', filters.documentId)
  if (filters.result) params.set('result', filters.result)
  if (filters.search) params.set('search', filters.search)
  if (sort) params.set('sort', sort)
  if (page) params.set('page', String(page))
  if (pageSize) params.set('page_size', String(pageSize))
  if (activityDays) params.set('activity_days', String(activityDays))
  return params.toString()
}

function paginationItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const values = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...values].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b)
  const result = []
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) result.push(`ellipsis-${value}`)
    result.push(value)
  })
  return result
}

function AuditEventDetails({ eventId, onClose }) {
  const [result, setResult] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/api/admin/audit/events/${encodeURIComponent(eventId)}`, { signal: controller.signal })
      .then((event) => setResult({ eventId, event }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setResult({ eventId, error: requestError.message || 'Could not load event details.' })
      })
    return () => controller.abort()
  }, [eventId])

  useEffect(() => {
    function onKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const loading = result?.eventId !== eventId
  const event = result?.eventId === eventId ? result.event : null
  const error = result?.eventId === eventId ? result.error : ''
  const timeline = event?.timeline || []
  const payload = event ? {
    event_id: event.id,
    occurred_at: event.timestamp,
    action: event.actionType,
    result: event.outcome,
    actor: event.actor,
    target_user: event.targetUser,
    document: event.document,
    request: { request_id: event.requestId, ip_address: event.ipAddress, user_agent: event.userAgent },
    details: event.details,
  } : null

  return (
    <div className="audit-modal-backdrop" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}>
      <section aria-labelledby="audit-modal-title" aria-modal="true" className="audit-modal" role="dialog">
        <header className="audit-modal-header">
          <div><h2 id="audit-modal-title">Event Details</h2><p>Detailed information about this audit event</p></div>
          <button aria-label="Close event details" className="audit-icon-button" onClick={onClose} type="button">×</button>
        </header>
        {loading ? <div className="audit-modal-state">Loading event details…</div> : error ? <div className="audit-modal-error" role="alert">{error}</div> : event && (
          <div className="audit-modal-body">
            <div className="audit-detail-column">
              <section className={`audit-detail-highlight is-${event.outcome === 'Success' ? 'success' : 'denied'}`}>
                <ActionIcon event={event} />
                <div className="audit-detail-highlight-copy"><div><strong>{event.action}</strong><StatusPill outcome={event.outcome} /></div><p>{event.description}</p><small>{displayDate(event.timestamp)} · {displayTime(event.timestamp)}</small></div>
              </section>
              <section className="audit-detail-card">
                <h3><span className="audit-detail-glyph">♙</span>User Information</h3>
                <div className="audit-detail-user"><span className="audit-user-initials">{(event.actor?.name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{event.actor?.name || 'Unknown user'}</strong><small>{event.actor?.role || 'Unknown role'}</small></div></div>
                <dl><dt>Email</dt><dd>{event.actor?.email || 'Not recorded'}</dd><dt>User ID</dt><dd>{event.actor?.id || 'Not recorded'}</dd><dt>Target User</dt><dd>{event.targetUser?.name || '—'}</dd></dl>
              </section>
              {event.document && <section className="audit-detail-card">
                <h3><span className="audit-detail-glyph">▤</span>Document Information</h3>
                <div className="audit-document-title"><span className="audit-file-icon">▤</span><strong>{event.document.name || 'Document unavailable'}</strong></div>
                <dl><dt>Document ID</dt><dd>{event.document.id}</dd><dt>File Type</dt><dd>{event.document.fileType || '—'}</dd><dt>File Size</dt><dd>{fileSize(event.document.fileSizeBytes) || '—'}</dd><dt>Owner</dt><dd>{event.document.owner || '—'}</dd><dt>Category</dt><dd>{event.document.category || '—'}</dd><dt>Status</dt><dd>{event.document.status || 'Unavailable'}</dd></dl>
              </section>}
              <section className="audit-detail-card">
                <h3><span className="audit-detail-glyph">◷</span>Event Information</h3>
                <dl><dt>Event ID</dt><dd>{event.id}</dd><dt>Action</dt><dd>{event.action}</dd><dt>Reason</dt><dd>{event.reason || event.description}</dd><dt>Timestamp</dt><dd>{displayDate(event.timestamp)} {displayTime(event.timestamp)}</dd></dl>
              </section>
              <section className="audit-detail-card">
                <h3><span className="audit-detail-glyph">⌖</span>Device &amp; Location</h3>
                <dl><dt>IP Address</dt><dd>{event.ipAddress || 'Not recorded'}</dd><dt>Location</dt><dd>Not available</dd><dt>Device</dt><dd>{event.userAgent || 'Not recorded'}</dd><dt>Request ID</dt><dd>{event.requestId || 'Not recorded'}</dd></dl>
              </section>
            </div>
            <div className="audit-detail-column">
              <section className="audit-detail-card audit-timeline-card">
                <h3><span className="audit-detail-glyph">◷</span>Event Timeline</h3>
                {timeline.map((item) => <div className={`audit-timeline-item ${item.id === event.id ? 'is-selected' : ''}`} key={item.id}><span className={`audit-timeline-dot is-${item.outcome === 'Success' ? 'success' : 'denied'}`} /><time>{displayTime(item.timestamp)}</time><strong>{item.action}</strong><p>{item.description}</p></div>)}
              </section>
              <section className="audit-detail-card audit-payload-card">
                <h3><span className="audit-detail-glyph">⌘</span>Event Payload</h3>
                <pre>{JSON.stringify(payload, null, 2)}</pre>
                <p>Payload contains recorded event fields only.</p>
              </section>
            </div>
          </div>
        )}
        <footer className="audit-modal-footer"><button className="audit-secondary-button" onClick={onClose} type="button">Close</button></footer>
      </section>
    </div>
  )
}

export default function AdminAuditLogs({ initialEventId, onOpenEvent, onCloseEvent }) {
  const [defaults] = useState(defaultDateRange)
  const [draftFilters, setDraftFilters] = useState({ ...defaults, action: '', actorId: '', documentId: '', result: '' })
  const [filters, setFilters] = useState({ ...defaults, action: '', actorId: '', documentId: '', result: '' })
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [activityDays, setActivityDays] = useState(7)
  const [activityLimit, setActivityLimit] = useState(5)
  const [loadResult, setLoadResult] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const requestQuery = queryString(filters, { sort, page, pageSize, activityDays })
  const requestKey = `${requestQuery}|retry:${reloadKey}`

  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/api/admin/audit/events?${requestQuery}`, { signal: controller.signal })
      .then((data) => setLoadResult({ key: requestKey, data }))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setLoadResult({ key: requestKey, error: requestError.message || 'Could not load audit events.' })
      })
    return () => controller.abort()
  }, [requestKey, requestQuery])

  const currentResult = loadResult?.key === requestKey ? loadResult : null
  const data = currentResult?.data || null
  const loading = !currentResult
  const loadError = currentResult?.error || ''
  const error = loadError || exportError
  const events = data?.events || []
  const metrics = data?.metrics
  const days = data?.activity || []
  const topActivities = (data?.topActivities || []).slice(0, activityLimit)
  const maxActivity = Math.max(1, ...topActivities.map((item) => item.count))
  const pageCount = data?.pageCount || 1
  const securityEvents = data?.securityEvents || []
  const [groupDates] = useState(() => {
    const today = new Date()
    const priorDay = new Date(today)
    priorDay.setDate(priorDay.getDate() - 1)
    return { today: dateKey(today), yesterday: dateKey(priorDay) }
  })
  const currentDay = groupDates.today
  const yesterday = groupDates.yesterday
  const groupedEvents = events.reduce((groups, event) => {
    const key = dateKey(event.timestamp)
    const title = key === currentDay ? 'Today' : key === yesterday ? 'Yesterday' : displayDate(event.timestamp)
    const group = groups.find((item) => item.key === key)
    if (group) group.events.push(event)
    else groups.push({ key, title, date: event.timestamp, events: [event] })
    return groups
  }, [])

  function updateDraft(name, value) {
    setDraftFilters((current) => ({ ...current, [name]: value }))
  }

  function applyFilters(submitEvent) {
    submitEvent.preventDefault()
    setFilters({ ...draftFilters })
    setPage(1)
  }

  function resetFilters() {
    const reset = { ...defaults, action: '', actorId: '', documentId: '', result: '' }
    setDraftFilters(reset)
    setFilters(reset)
    setSort('newest')
    setPage(1)
  }

  async function exportEvents() {
    setExporting(true)
    try {
      setExportError('')
      const file = await apiGetFile(`/api/admin/audit/export.csv?${queryString(filters, { sort })}`)
      const url = URL.createObjectURL(file.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'suredocs-audit-events.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (requestError) {
      setExportError(requestError.message || 'Could not export audit events.')
    } finally {
      setExporting(false)
    }
  }

  const options = data?.filters
  const metricCards = [
    { key: 'total', label: 'Total Events', value: metrics?.total, color: 'blue', icon: '▤', previous: metrics?.previous.total },
    { key: 'success', label: 'Successful Actions', value: metrics?.success, color: 'green', icon: '✓', previous: metrics?.previous.success },
    { key: 'denied', label: 'Denied Actions', value: metrics?.denied, color: 'red', icon: '×', previous: metrics?.previous.denied },
    { key: 'uniqueUsers', label: 'Unique Users', value: metrics?.uniqueUsers, color: 'purple', icon: '♙', previous: metrics?.previous.uniqueUsers },
  ].map((metric) => ({ ...metric, sparkline: sparklinePaths((data?.trends || []).map((day) => day[metric.key])) }))

  return (
    <div className="audit-page">
      <div className="audit-page-heading">
        <div><h1>Audit Logs</h1><p>Track and review all document and system activities across SureDocs</p></div>
        <button className="audit-export-button" disabled={exporting} onClick={exportEvents} type="button"><span>⇩</span>{exporting ? 'Exporting…' : 'Export'}<span className="audit-export-caret">⌄</span></button>
      </div>

      <section aria-label="Audit summary" className="audit-metrics">
        {metricCards.map((metric) => <article className={`audit-metric is-${metric.color}`} key={metric.key}>
          <span className="audit-metric-icon">{metric.icon}</span><div className="audit-metric-copy"><p>{metric.label}</p><strong>{!metrics ? '—' : Number(metric.value).toLocaleString()}</strong>{metrics ? <Trend current={metric.value} previous={metric.previous} /> : <span className="audit-trend">{loading ? 'Loading' : 'Unavailable'}</span>}</div>
          <svg aria-hidden="true" className="audit-sparkline" viewBox="0 0 80 30" preserveAspectRatio="none"><path d={metric.sparkline.area} /><path className="audit-sparkline-line" d={metric.sparkline.line} /></svg>
        </article>)}
      </section>

      <form className="audit-filter-bar" onSubmit={applyFilters}>
        <label className="audit-date-filter"><span aria-hidden="true">▦</span><input aria-label="Start date" onChange={(event) => updateDraft('from', event.target.value)} type="date" value={draftFilters.from} /><span>–</span><input aria-label="End date" onChange={(event) => updateDraft('to', event.target.value)} type="date" value={draftFilters.to} /></label>
        <label><span className="sr-only">Action</span><select aria-label="Action" onChange={(event) => updateDraft('action', event.target.value)} value={draftFilters.action}><option value="">All Actions</option>{(options?.actions || []).map((action) => <option key={action} value={action}>{action}</option>)}</select></label>
        <label><span className="sr-only">User</span><select aria-label="User" onChange={(event) => updateDraft('actorId', event.target.value)} value={draftFilters.actorId}><option value="">All Users</option>{(options?.users || []).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label><span className="sr-only">Document</span><select aria-label="Document" onChange={(event) => updateDraft('documentId', event.target.value)} value={draftFilters.documentId}><option value="">All Documents</option>{(options?.documents || []).map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
        <label><span className="sr-only">Result</span><select aria-label="Result" onChange={(event) => updateDraft('result', event.target.value)} value={draftFilters.result}><option value="">All Results</option>{(options?.results || []).map((result) => <option key={result} value={result}>{result.charAt(0) + result.slice(1).toLowerCase()}</option>)}</select></label>
        <div className="audit-filter-actions"><button className="audit-reset-button" onClick={resetFilters} type="button">Reset</button><button className="audit-apply-button" type="submit">Apply Filters</button></div>
      </form>

      {error && <div className="audit-error-banner" role="alert"><span>{error}</span><button onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div>}

      <div className="audit-dashboard-grid">
        <section aria-label="Audit events" className="audit-panel audit-events-panel">
          <header className="audit-panel-heading"><div><h2>Audit Events</h2><p>Complete history of all activities in SureDocs</p></div><div className="audit-panel-tools"><span className={`audit-live-dot ${loadError ? 'is-offline' : ''}`} /><span>{loadError ? 'Unavailable' : 'Live Updates'}</span><label><span className="audit-sort-icon">↕</span><select aria-label="Sort events" onChange={(event) => { setSort(event.target.value); setPage(1) }} value={sort}><option value="newest">Newest First</option><option value="oldest">Oldest First</option></select></label></div></header>
          <div aria-live="polite" className="audit-event-list">
            {loading && <div className="audit-empty-state">Loading audit events…</div>}
            {!loading && !error && groupedEvents.map((group) => <div className="audit-event-group" key={group.key}>
              <div className="audit-day-heading"><span className="audit-day-ring" /><strong>{group.title}</strong><time>{displayDate(group.date)}</time></div>
              {group.events.map((event) => <button className="audit-event-row" key={event.id} onClick={() => onOpenEvent(event.id)} type="button">
                <time className="audit-event-time">{displayTime(event.timestamp)}</time><ActionIcon event={event} />
                <span className="audit-event-action"><strong>{event.action}</strong><small>{event.description}</small></span>
                <span className="audit-event-user"><strong>{event.actor?.name || 'Unknown user'}</strong><small>{event.actor?.role || 'Unknown role'}</small></span>
                <span className="audit-event-document">{event.document ? <><span className="audit-file-icon">▤</span><span><strong>{event.document.name || 'Document unavailable'}</strong><small>{[event.document.fileType, fileSize(event.document.fileSizeBytes)].filter(Boolean).join(' · ') || event.document.category || 'Document'}</small></span></> : <span className="audit-no-document">—</span>}</span>
                <StatusPill outcome={event.outcome} /><span aria-hidden="true" className="audit-row-chevron">›</span>
              </button>)}
            </div>)}
            {!loading && !error && events.length === 0 && <div className="audit-empty-state">No audit events match these filters.</div>}
            {error && <div className="audit-empty-state">Audit event data is currently unavailable.</div>}
          </div>
          <footer className="audit-pagination"><span>{data?.total ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} of ${Number(data.total).toLocaleString()} events` : 'No matching events'}</span><div className="audit-pagination-controls"><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button">‹</button>{paginationItems(page, pageCount).map((item) => typeof item === 'number' ? <button aria-current={page === item ? 'page' : undefined} className={page === item ? 'is-current' : ''} key={item} onClick={() => setPage(item)} type="button">{item}</button> : <span key={item}>…</span>)}<button aria-label="Next page" disabled={page >= pageCount || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button">›</button><label><span className="sr-only">Events per page</span><select aria-label="Events per page" onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} value={pageSize}><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select></label></div></footer>
        </section>

        <aside className="audit-side-panels">
          <section className="audit-panel audit-activity-panel"><header className="audit-panel-heading"><h2>Activity Overview</h2><label><span className="sr-only">Activity time range</span><select aria-label="Activity time range" onChange={(event) => setActivityDays(Number(event.target.value))} value={activityDays}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label></header>
            <div className="audit-chart-legend"><span><i className="is-success" />Successful Actions</span><span><i className="is-denied" />Denied Actions</span></div>
            <div className="audit-chart"><Suspense fallback={<div className="audit-chart-loading">Loading chart…</div>}><AdminAuditActivityChart data={days} /></Suspense></div>
          </section>
          <section className="audit-panel audit-top-panel"><header className="audit-panel-heading"><h2>Top Activities</h2><label><span className="sr-only">Number of top activities</span><select aria-label="Number of top activities" onChange={(event) => setActivityLimit(Number(event.target.value))} value={activityLimit}><option value="5">Top 5</option><option value="10">Top 10</option></select></label></header>
            {topActivities.length ? <ol className="audit-top-list">{topActivities.map((item) => <li key={item.action}><div><span>{item.action}</span><strong>{Number(item.count).toLocaleString()}</strong></div><span className="audit-top-track"><i style={{ width: `${Math.max(2, (item.count / maxActivity) * 100)}%` }} /></span></li>)}</ol> : <p className="audit-small-empty">No activity in this date range.</p>}
          </section>
          <section className="audit-panel audit-security-panel"><header className="audit-panel-heading"><h2><span className="audit-security-mark">!</span>Recent Security Events</h2><span className="audit-security-count">{securityEvents.length}</span></header>
            {securityEvents.length ? <ul>{securityEvents.map((event) => <li key={event.id}><ActionIcon event={event} /><button onClick={() => onOpenEvent(event.id)} type="button"><strong>{event.action}</strong><small>{event.actor?.name || 'Unknown user'}</small></button><time>{displayTime(event.timestamp)}</time><StatusPill outcome={event.outcome} /></li>)}</ul> : <p className="audit-small-empty">No denied or failed events in this date range.</p>}
          </section>
        </aside>
      </div>
      <p className="audit-data-source">Audit data shown from SureDocs document and authentication records.</p>
      {initialEventId && <AuditEventDetails eventId={initialEventId} onClose={onCloseEvent} />}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { apiGet } from './api.js'
import {
  demoInsights, demoRiskDistribution, demoRiskyUsers, demoSecurityMetrics, demoTrendSeries, demoWorkflowStatuses,
} from './securityMonitoringMockData.js'
import './AdminSecurityMonitoring.css'

function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function makeDateRange(range) {
  const to = new Date()
  const from = new Date(to)
  if (range === '7d') from.setDate(to.getDate() - 6)
  else if (range === '30d') from.setDate(to.getDate() - 29)
  else from.setDate(1)
  return { from: localDateValue(from), to: localDateValue(to) }
}

function displayDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat('en-US', options).format(date)
}

function displayTime(value) {
  if (!value) return 'Unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function initials(value) {
  return (value || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function Icon({ name, size = 16 }) {
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="M12 8v5m0 3h.01" /></>,
    warning: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    device: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    light: <><path d="M9 18h6m-5 4h4m-2-20a7 7 0 0 0-4 12.75c.6.4 1 1.05 1 1.75h6c0-.7.4-1.35 1-1.75A7 7 0 0 0 12 2Z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
  }
  return <svg aria-hidden="true" className="sm-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.file}</svg>
}

function Sparkline({ values, color, fill = true, className = '' }) {
  const maximum = Math.max(1, ...values)
  const points = values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * 100},${28 - (value / maximum) * 24}`).join(' ')
  return <svg aria-hidden="true" className={`sm-sparkline ${className}`} viewBox="0 0 100 30" preserveAspectRatio="none">
    {fill && <polygon points={`0,30 ${points} 100,30`} fill={color} opacity=".1" />}
    <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
  </svg>
}

function MetricCard({ metric, value, live = false, onClick, active }) {
  const colors = { red: '#ff424b', orange: '#ffa51f', blue: '#2878ff', purple: '#8b35f5' }
  return <button className={`sm-metric-card tone-${metric.color}${active ? ' is-selected' : ''}`} onClick={onClick} type="button">
    <span className="sm-metric-icon"><Icon name={metric.icon} size={20} /></span>
    <span className="sm-metric-copy"><span className="sm-metric-label">{metric.label}</span><strong>{value ?? metric.value}</strong><small><b>↑</b> {metric.change}</small></span>
    <span className="sm-demo-dot" title={live ? 'Count is live; weekly trend and sparkline are illustrative' : 'Illustrative demo indicator'} />
    <Sparkline className="sm-metric-spark" color={colors[metric.color]} values={metric.values} />
  </button>
}

function PanelHeading({ title, action, children, eyebrow }) {
  return <header className="sm-panel-heading"><div><h2>{title}</h2>{eyebrow && <small>{eyebrow}</small>}</div>{children || action}</header>
}

function DemoRiskDistribution() {
  const total = demoRiskDistribution.reduce((sum, item) => sum + item.value, 0)
  return <section className="sm-panel sm-risk-panel">
    <PanelHeading title="Risk Distribution" eyebrow="Illustrative monitoring data" />
    <div className="sm-risk-content">
      <div className="sm-donut-wrap">
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={demoRiskDistribution} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="88%" paddingAngle={2} stroke="white" strokeWidth={2} isAnimationActive={false}><Cell fill="#ff424b" /><Cell fill="#ffa51f" /><Cell fill="#2878ff" /><Cell fill="#8b35f5" /></Pie><Tooltip formatter={(value, name) => [`${value} events`, name]} /></PieChart></ResponsiveContainer>
        <div className="sm-donut-center"><strong>{total}</strong><span>Total Risks</span></div>
      </div>
      <ul className="sm-risk-legend">{demoRiskDistribution.map((item, index) => <li key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><b>{item.value} <small>({[58, 25, 10, 7][index]}%)</small></b></li>)}</ul>
    </div>
  </section>
}

function ActivityTrend({ days, onDaysChange, dateEnd }) {
  const chartData = useMemo(() => {
    const count = days === '7' ? 7 : 9
    const endTime = Date.parse(`${dateEnd}T00:00:00Z`)
    const startTime = endTime - (days === '7' ? 6 : 29) * 24 * 60 * 60 * 1000
    return Array.from({ length: count }, (_, index) => {
      const timestamp = startTime + ((endTime - startTime) * index / (count - 1))
      return {
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp),
        ...Object.fromEntries(demoTrendSeries.map((series) => [series.key, series.values[index % series.values.length]])),
      }
    })
  }, [days, dateEnd])
  return <section className="sm-panel sm-trend-panel">
    <PanelHeading title="Security Activity Trend" eyebrow="Illustrative risk signals">
      <label className="sm-select"><span aria-hidden="true">Last {days} days</span><span className="sr-only">Activity trend period</span><select onChange={(event) => onDaysChange(event.target.value)} value={days}><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><Icon name="chevron" size={12} /></label>
    </PanelHeading>
    <div className="sm-chart-legend">{demoTrendSeries.map((series) => <span key={series.key}><i style={{ background: series.color }} />{series.name}</span>)}</div>
    <div className="sm-trend-chart">
      <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 7, right: 8, bottom: 0, left: -18 }}>
        <defs>{demoTrendSeries.map((series) => <linearGradient id={`sm-gradient-${series.key}`} key={series.key} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series.color} stopOpacity={0.14} /><stop offset="95%" stopColor={series.color} stopOpacity={0.005} /></linearGradient>)}</defs>
        <CartesianGrid stroke="#edf1f7" strokeDasharray="2 3" vertical />
        <XAxis dataKey="label" tick={{ fill: '#64779a', fontSize: 9 }} axisLine={{ stroke: '#dfe6f0' }} tickLine={false} tickMargin={6} />
        <YAxis domain={[0, 80]} ticks={[0, 20, 40, 60, 80]} tick={{ fill: '#64779a', fontSize: 9 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ border: '1px solid #e5ebf4', borderRadius: 8, fontSize: 10, boxShadow: '0 8px 24px #15233a1a' }} />
        {demoTrendSeries.map((series) => <Area key={series.key} type="monotone" dataKey={series.key} name={series.name} stroke={series.color} strokeWidth={1.7} fill={`url(#sm-gradient-${series.key})`} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive={false} />)}
      </AreaChart></ResponsiveContainer>
    </div>
    <span className="sm-chart-note">Demo series · live audit events are listed below</span>
  </section>
}

function AccountStatus({ summary, loading, error }) {
  const total = summary?.total_users || 0
  const active = summary?.active_users || 0
  const disabled = summary?.disabled_users || 0
  const pending = summary?.pending_users || 0
  const rows = [
    { name: 'Active', value: active, color: '#17b978' },
    { name: 'Disabled', value: disabled, color: '#ff424b' },
    { name: 'Pending', value: pending, color: '#ffa51f' },
  ]
  const otherStatuses = Math.max(0, total - active - disabled - pending)
  if (otherStatuses > 0) rows.push({ name: 'Other statuses', value: otherStatuses, color: '#b7c1d0' })
  return <section className="sm-panel sm-account-panel">
    <PanelHeading title="Account Security Status"><a className="sm-view-button" href="/admin/users">View All</a></PanelHeading>
    {error ? <p className="sm-empty-error">Account totals could not be loaded.</p> : <div className="sm-account-content">
      <div className="sm-account-donut">
        <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="value" innerRadius="69%" outerRadius="90%" startAngle={90} endAngle={-270} stroke="white" strokeWidth={2} isAnimationActive={false}>{rows.map((row) => <Cell fill={row.color} key={row.name} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /></PieChart></ResponsiveContainer>
        <div className="sm-donut-center"><strong>{loading ? '—' : total.toLocaleString()}</strong><span>Total Users</span></div>
      </div>
      <div className="sm-account-legend">{rows.map((row) => <div key={row.name}><span className="sm-legend-label"><i style={{ background: row.color }} />{row.name}</span><b>{loading ? '—' : row.value.toLocaleString()}</b><small>{total ? `${Math.round(row.value / total * 100)}%` : '—'}</small></div>)}</div>
    </div>}
  </section>
}

function SecurityInsights() {
  return <section className="sm-panel sm-insights-panel">
    <PanelHeading title="Security Insights" eyebrow="Illustrative monitoring insights" />
    <div className="sm-insights-box"><span className="sm-bulb"><Icon name="light" size={18} /></span><ul>{demoInsights.map((item) => <li key={item.text}><i className={`is-${item.color}`} />{item.text}</li>)}</ul></div>
  </section>
}

function eventSeverity(event) {
  if (event.outcome === 'Denied' || event.outcome === 'Failed') return 'High'
  if (/DOWNLOAD|PERMISSION|SENSITIVE/i.test(event.actionType || '')) return 'Medium'
  return 'Low'
}

function eventIcon(event) {
  const type = event.actionType || ''
  if (type.includes('LOGIN') || type.includes('AUTH') || type.includes('ACCOUNT')) return 'shield'
  if (type.includes('DOWNLOAD')) return 'download'
  if (type.includes('VIEW')) return 'eye'
  if (type.includes('PERMISSION')) return 'lock'
  return 'file'
}

function copyText(value, onCopied) {
  if (!value || !navigator.clipboard?.writeText) return
  navigator.clipboard.writeText(value).then(() => onCopied(value)).catch(() => {})
}

function AuditEventRow({ event, onOpen, activeMenu, setActiveMenu, onCopy, index }) {
  const risk = eventSeverity(event)
  const workflowStatus = demoWorkflowStatuses[index % demoWorkflowStatuses.length]
  const eventLabel = event.action || event.actionType || 'Audit event'
  return <tr className="sm-event-row" tabIndex={0} onClick={(clickEvent) => { clickEvent.currentTarget.focus(); onOpen(event, clickEvent.currentTarget) }} onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); keyEvent.currentTarget.focus(); onOpen(event, keyEvent.currentTarget) } }}>
    <td><span>{displayDate(event.timestamp, { month: 'short', day: '2-digit', year: 'numeric' })}</span><small>{displayTime(event.timestamp)}</small></td>
    <td><span className={`sm-event-type ${risk === 'High' ? 'is-red' : ''}`}><Icon name={eventIcon(event)} size={14} />{eventLabel}</span></td>
    <td><span className="sm-user-name">{event.actor?.name || 'Unknown user'}</span><small>{event.actor?.email || 'User not identified'}</small></td>
    <td><span className="sm-event-detail">{event.description || 'No additional details recorded.'}</span>{event.document?.name && <small>{event.document.name}</small>}</td>
    <td><span className={`sm-badge ${risk === 'High' ? 'is-high' : risk === 'Medium' ? 'is-medium' : 'is-neutral'}`} title="Illustrative client-side risk classification">{risk}</span></td>
    <td><span className={`sm-badge is-${workflowStatus.toLowerCase()}`} title="Demo workflow status; not stored by the API">{workflowStatus}</span></td>
    <td className="sm-actions-cell"><button aria-label={`More actions for ${eventLabel}`} aria-expanded={activeMenu === event.id} className="sm-more-button" onClick={(clickEvent) => { clickEvent.stopPropagation(); setActiveMenu(activeMenu === event.id ? null : event.id) }} type="button"><Icon name="more" size={16} /></button>
      {activeMenu === event.id && <div className="sm-row-menu"><button onClick={(clickEvent) => { clickEvent.stopPropagation(); setActiveMenu(null); onOpen(event, clickEvent.currentTarget.closest('tr')) }} type="button">View event details</button><button onClick={(clickEvent) => { clickEvent.stopPropagation(); copyText(event.id, onCopy); setActiveMenu(null) }} type="button">Copy event ID</button></div>}
    </td>
  </tr>
}

function RecentSecurityEvents({ events, loading, error, onOpen, filter, search, copied, setCopied }) {
  const [activeMenu, setActiveMenu] = useState(null)
  const tableRef = useRef(null)
  const visible = useMemo(() => {
    const relevant = events.filter((event) => event.outcome !== 'Success' || /LOGIN|AUTH|ACCOUNT|PERMISSION|DOWNLOADED/i.test(event.actionType || ''))
    const source = relevant.length ? relevant : events
    const filtered = filter === 'failed'
      ? source.filter((event) => /LOGIN|AUTH/i.test(event.actionType || '') || event.outcome === 'Failed')
      : filter === 'suspicious'
        ? source.filter((event) => event.outcome === 'Denied' || event.outcome === 'Failed')
        : source
    if (!search.trim()) return filtered
    const term = search.trim().toLowerCase()
    return filtered.filter((event) => `${event.action || ''} ${event.actionType || ''} ${event.description || ''} ${event.actor?.name || ''} ${event.actor?.email || ''} ${event.document?.name || ''}`.toLowerCase().includes(term))
  }, [events, filter, search])
  useEffect(() => {
    if (filter) tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [filter])
  return <section className="sm-panel sm-events-panel" ref={tableRef}>
    <PanelHeading title="Recent Security Events" eyebrow="Live audit events · risk and workflow badges are illustrative"><a className="sm-view-button" href="/admin/audit">View All</a></PanelHeading>
    {copied && <span className="sm-copy-toast" role="status">Copied {copied}</span>}
    {error ? <p className="sm-empty-error" role="alert">Security audit events could not be loaded. Check administrator access and try again.</p> : <div className="sm-table-wrap"><table className="sm-events-table"><thead><tr><th>Time</th><th>Event</th><th>User</th><th>Details</th><th>Risk Level</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {loading && <tr><td className="sm-table-state" colSpan="7">Loading audit events…</td></tr>}
      {!loading && visible.map((event, index) => <AuditEventRow key={event.id} event={event} index={index} onOpen={onOpen} activeMenu={activeMenu} setActiveMenu={setActiveMenu} onCopy={setCopied} />)}
      {!loading && !visible.length && <tr><td className="sm-table-state" colSpan="7">No matching audit events in this date range.</td></tr>}
    </tbody></table></div>}
    <footer className="sm-table-footer">{loading ? 'Loading…' : `Showing ${visible.length} of ${events.length} events returned by the audit API`}<span>Incident workflow status is not available in the current API.</span></footer>
  </section>
}

function TopRiskyUsers() {
  return <section className="sm-panel sm-risky-users-panel">
    <PanelHeading title="Top Risky Users" eyebrow="Demo risk scores · no backend risk-scoring source"><a className="sm-view-button" href="/admin/users">View All</a></PanelHeading>
    <div className="sm-table-wrap"><table className="sm-risky-users-table"><thead><tr><th>User</th><th>Risk Score</th><th>Events</th><th>Trend</th></tr></thead><tbody>{demoRiskyUsers.map((user) => <tr key={user.email}>
      <td><span className={`sm-avatar is-${user.color}`}>{user.initials}</span><span className="sm-user-copy"><b>{user.name}</b><small>{user.email}</small></span></td>
      <td><span className={`sm-score is-${user.score > 75 ? 'high' : user.score > 55 ? 'medium' : 'low'}`}>{user.score}</span></td><td>{user.events}</td><td><Sparkline values={user.values} color={user.score > 75 ? '#ff424b' : user.score > 55 ? '#ffa51f' : '#2878ff'} fill={false} /></td>
    </tr>)}</tbody></table></div>
  </section>
}

function DetailCard({ title, icon, children, className = '' }) {
  return <section className={`sm-detail-card ${className}`}><h3><Icon name={icon} size={14} />{title}</h3>{children}</section>
}

function CopyField({ value, label, copied, onCopy }) {
  const display = value || 'Unavailable'
  return <div className="sm-detail-field"><dt>{label}</dt><dd>{display}{value && <button aria-label={`Copy ${label}`} className="sm-copy-button" onClick={() => copyText(value, onCopy)} type="button"><Icon name={copied === value ? 'check' : 'copy'} size={12} /></button>}</dd></div>
}

function SecurityEventDetailsModal({ eventId, onClose, returnFocusRef, onCopied }) {
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState('')
  const dialogRef = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    apiGet(`/api/admin/audit/events/${encodeURIComponent(eventId)}`, { signal: controller.signal })
      .then((event) => setResult({ eventId, event }))
      .catch((error) => { if (error.name !== 'AbortError') setResult({ eventId, error: error.message || 'Could not load this audit event.' }) })
    return () => controller.abort()
  }, [eventId])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const trigger = returnFocusRef.current
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('button')?.focus()
    function onKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); onClose(); return }
      if (keyEvent.key !== 'Tab' || !dialogRef.current) return
      const focusables = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')]
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!dialogRef.current.contains(document.activeElement)) { keyEvent.preventDefault(); (keyEvent.shiftKey ? last : first).focus(); return }
      if (keyEvent.shiftKey && document.activeElement === first) { keyEvent.preventDefault(); last.focus() }
      else if (!keyEvent.shiftKey && document.activeElement === last) { keyEvent.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      if (trigger?.isConnected) trigger.focus()
    }
  }, [eventId, onClose, returnFocusRef])

  const resultForEvent = result?.eventId === eventId ? result : null
  const event = resultForEvent?.event
  const timeline = event?.timeline || []
  const risk = event ? eventSeverity(event) : 'Info'
  const markCopied = (value) => { setCopied(value); onCopied(value); window.setTimeout(() => setCopied(''), 1800) }
  const closeOnBackdrop = (mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }
  return <div className="sm-modal-backdrop" onMouseDown={closeOnBackdrop}>
    <section aria-labelledby="sm-modal-title" aria-modal="true" className="sm-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
      <header className="sm-modal-header"><div><h2 id="sm-modal-title">Security Event Details</h2><p>Detailed information about this audit event</p></div><button aria-label="Close event details" className="sm-close-button" onClick={onClose} type="button"><Icon name="close" size={18} /></button></header>
      {resultForEvent?.error ? <div className="sm-modal-state is-error" role="alert">{resultForEvent.error}</div> : !event ? <div className="sm-modal-state">Loading event details…</div> : <>
        <div className="sm-modal-grid">
          <div className="sm-modal-column">
            <section className={`sm-event-summary is-${risk.toLowerCase()}`}><span className="sm-summary-icon"><Icon name={eventIcon(event)} size={20} /></span><div><div className="sm-summary-title"><h3>{event.action || event.actionType || 'Audit event'}</h3><span className={`sm-badge ${risk === 'High' ? 'is-high' : risk === 'Medium' ? 'is-medium' : 'is-neutral'}`}>{risk} Risk</span></div><p>{event.description || 'No description was recorded.'}</p><small>{displayDate(event.timestamp)} · {displayTime(event.timestamp)}</small></div></section>
            <DetailCard title="User Information" icon="users">
              <div className="sm-detail-user"><span className="sm-detail-avatar">{initials(event.actor?.name)}</span><div><b>{event.actor?.name || 'Unknown user'}</b><small>{event.actor?.role || 'Role unavailable'}</small></div></div>
              <dl className="sm-detail-list"><CopyField label="Email" value={event.actor?.email} copied={copied} onCopy={markCopied} /><CopyField label="User ID" value={event.actor?.id} copied={copied} onCopy={markCopied} /><div className="sm-detail-field"><dt>Account Status</dt><dd>Unavailable</dd></div></dl>
            </DetailCard>
            {event.document && <DetailCard title="Document Information" icon="file">
              <div className="sm-document-name"><Icon name="file" size={15} /><b>{event.document.name || 'Document unavailable'}</b></div>
              <dl className="sm-detail-list"><CopyField label="Document ID" value={event.document.id} copied={copied} onCopy={markCopied} /><div className="sm-detail-field"><dt>File Type</dt><dd>{event.document.fileType || 'Unavailable'}</dd></div><div className="sm-detail-field"><dt>File Size</dt><dd>{event.document.fileSizeBytes ? `${(Number(event.document.fileSizeBytes) / (1024 * 1024)).toFixed(1)} MB` : 'Unavailable'}</dd></div><div className="sm-detail-field"><dt>Owner</dt><dd>{event.document.owner || 'Unavailable'}</dd></div></dl>
            </DetailCard>}
            <DetailCard title="Event Details" icon="file">
              <dl className="sm-detail-list"><CopyField label="Event ID" value={event.id} copied={copied} onCopy={markCopied} /><div className="sm-detail-field"><dt>Event Type</dt><dd>{event.actionType || 'Unavailable'}</dd></div><div className="sm-detail-field"><dt>Risk Level</dt><dd><span className={`sm-badge ${risk === 'High' ? 'is-high' : risk === 'Medium' ? 'is-medium' : 'is-neutral'}`}>{risk}</span></dd></div>{event.details?.attempts != null && <div className="sm-detail-field"><dt>Attempts</dt><dd>{event.details.attempts}</dd></div>}<div className="sm-detail-field"><dt>Reason</dt><dd>{event.reason || 'No reason recorded'}</dd></div><div className="sm-detail-field"><dt>Timestamp</dt><dd>{displayDate(event.timestamp)} {displayTime(event.timestamp)}</dd></div></dl>
            </DetailCard>
            <DetailCard title="Device & Location" icon="pin">
              <dl className="sm-detail-list"><CopyField label="IP Address" value={event.ipAddress} copied={copied} onCopy={markCopied} /><div className="sm-detail-field"><dt>Location</dt><dd>Unavailable</dd></div><div className="sm-detail-field"><dt>Device / Browser</dt><dd>{event.userAgent || 'Unavailable'}</dd></div><div className="sm-detail-field"><dt>ISP</dt><dd>Unavailable</dd></div><div className="sm-detail-field"><dt>Session ID</dt><dd>Unavailable</dd></div><CopyField label="Request ID" value={event.requestId} copied={copied} onCopy={markCopied} /><div className="sm-detail-field"><dt>User Agent</dt><dd className="sm-user-agent">{event.userAgent || 'Unavailable'}</dd></div></dl>
            </DetailCard>
          </div>
          <div className="sm-modal-column">
            <DetailCard title="Event Timeline" icon="clock" className="sm-timeline-card">
              {timeline.length ? <ol className="sm-timeline">{timeline.map((item) => <li className={`${item.id === event.id ? 'is-selected' : ''} ${item.outcome === 'Success' ? 'is-success' : 'is-risk'}`} key={item.id}><span className="sm-timeline-marker" /><time>{displayTime(item.timestamp)}</time><b>{item.action || item.actionType}</b><p>{item.description || item.outcome}</p></li>)}</ol> : <p className="sm-unavailable-note">No related timeline events were returned.</p>}
            </DetailCard>
            <DetailCard title="Related Information" icon="shield"><div className="sm-related-list">{[['Location Risk', 'Unavailable'], ['Device Risk', 'Unavailable'], ['IP Reputation', 'Unavailable'], ['User Risk Score', 'Unavailable'], ['Similar Events (24h)', 'Unavailable']].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><small className="sm-card-note">Risk enrichment is not provided by the current API.</small></DetailCard>
            <DetailCard title="Recommended Actions" icon="light"><ul className="sm-recommendations">{['Review the user’s recent activity.', 'Verify whether this event was authorized.', 'Review device and location history when available.', 'Monitor for additional suspicious activity.'].map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul><small className="sm-card-note">Recommendations only. No security action is performed here.</small></DetailCard>
          </div>
        </div>
        <footer className="sm-modal-footer"><button className="sm-view-button" onClick={onClose} type="button">Close</button></footer>
      </>}
    </section>
  </div>
}

export default function AdminSecurityMonitoring({ search = '' }) {
  const initialRange = useMemo(() => makeDateRange('month'), [])
  const [rangeName, setRangeName] = useState('month')
  const [dateRange, setDateRange] = useState(initialRange)
  const [data, setData] = useState(null)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState('')
  const [userSummary, setUserSummary] = useState(null)
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [failedLoginCount, setFailedLoginCount] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [activeMetric, setActiveMetric] = useState('')
  const [chartDays, setChartDays] = useState('7')
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const returnFocusRef = useRef(null)
  const closeModal = useCallback(() => setSelectedEvent(null), [])

  const loadEvents = useCallback(async (signal) => {
    setEventsLoading(true)
    setEventsError('')
    const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to, sort: 'newest', page: '1', page_size: '50', activity_days: chartDays })
    const loginParams = new URLSearchParams({ from: dateRange.from, to: dateRange.to, action: 'Login failed', sort: 'newest', page: '1', page_size: '1', activity_days: chartDays })
    try {
      const [eventsResult, failedResult] = await Promise.allSettled([
        apiGet(`/api/admin/audit/events?${params}`, { signal }),
        apiGet(`/api/admin/audit/events?${loginParams}`, { signal }),
      ])
      if (eventsResult.status === 'fulfilled') setData(eventsResult.value)
      else if (eventsResult.reason?.name !== 'AbortError') setEventsError(eventsResult.reason?.message || 'Audit events unavailable')
      if (failedResult.status === 'fulfilled') setFailedLoginCount(failedResult.value.total)
      else if (failedResult.reason?.name !== 'AbortError') setFailedLoginCount(null)
    } finally { if (!signal.aborted) setEventsLoading(false) }
  }, [dateRange, chartDays])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => { if (!controller.signal.aborted) loadEvents(controller.signal) })
    return () => controller.abort()
  }, [loadEvents])

  useEffect(() => {
    const controller = new AbortController()
    Promise.resolve().then(() => apiGet('/api/admin/users/summary', { signal: controller.signal }))
      .then((summary) => { if (!controller.signal.aborted) setUserSummary(summary) })
      .catch((error) => { if (!controller.signal.aborted && error.name !== 'AbortError') setUsersError(error.message || 'Account summary unavailable') })
      .finally(() => { if (!controller.signal.aborted) setUsersLoading(false) })
    return () => controller.abort()
  }, [])

  const events = data?.events || []
  const metrics = demoSecurityMetrics.map((item) => ({
    ...item,
    current: item.id === 'suspicious' ? data?.metrics?.denied ?? null : item.id === 'failed' ? failedLoginCount : null,
    live: item.id === 'suspicious' || item.id === 'failed',
  }))

  function updateRange(name) {
    setRangeName(name)
    setDateRange(makeDateRange(name))
    setActiveMetric('')
  }

  function handleMetric(metric) {
    setActiveMetric((value) => value === metric.id ? '' : metric.id)
    setNotice(metric.id === 'locations' || metric.id === 'devices'
      ? `${metric.label} is demo-only; the current API does not provide matching event filters.`
      : '')
  }

  function openEvent(event, trigger) {
    returnFocusRef.current = trigger
    setSelectedEvent(event.id)
  }

  const dateText = `${displayDate(dateRange.from, { month: 'short', day: 'numeric', year: 'numeric' })} – ${displayDate(dateRange.to, { month: 'short', day: 'numeric', year: 'numeric' })}`
  return <div className="admin-security-monitoring">
    <div className="sm-page-header"><div><h1>Security Monitoring</h1><p>Monitor suspicious activities, access patterns and potential security risks across SureDocs</p></div><label className="sm-date-control"><Icon name="calendar" size={15} /><span>{dateText}</span><select aria-label="Security monitoring date range" onChange={(event) => updateRange(event.target.value)} value={rangeName}><option value="month">This month</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select><Icon name="chevron" size={12} /></label></div>
    <div aria-label="Security indicators" className="sm-metrics-grid">{metrics.map((metric) => <MetricCard key={metric.id} metric={metric} value={metric.live ? (metric.current == null ? '—' : metric.current.toLocaleString()) : metric.value} live={metric.live} active={activeMetric === metric.id} onClick={() => handleMetric(metric)} />)}</div>
    <div className="sm-top-grid"><ActivityTrend days={chartDays} onDaysChange={setChartDays} dateEnd={dateRange.to} /><DemoRiskDistribution /></div>
    <div className="sm-middle-grid"><AccountStatus summary={userSummary} loading={usersLoading} error={usersError} /><SecurityInsights /></div>
    {notice && <p className="sm-action-note" role="status">{notice}</p>}
    <div className="sm-bottom-grid"><RecentSecurityEvents events={events} loading={eventsLoading} error={eventsError} onOpen={openEvent} filter={activeMetric === 'failed' || activeMetric === 'suspicious' ? activeMetric : ''} search={search} copied={copied} setCopied={(value) => { setCopied(value); window.setTimeout(() => setCopied(''), 1800) }} /><TopRiskyUsers /></div>
    <p className="sm-data-note">Live: audit event rows, event counts, and account totals. Demo-only: risk/workflow badges, metric trends, location/device detections, risk distribution, insights, and user risk scores.</p>
    {selectedEvent && <SecurityEventDetailsModal eventId={selectedEvent} onClose={closeModal} returnFocusRef={returnFocusRef} onCopied={(value) => { setCopied(value); window.setTimeout(() => setCopied(''), 1800) }} />}
  </div>
}

import { useEffect, useMemo, useState } from 'react'
import { apiGet } from './api.js'
import { getAdminDashboardSummary, getAdminDashboardStorage } from './dashboardApi.js'
import { getAdminOperationActivityMockData } from './adminOperationActivityMockData.js'
import { getAdminDeniedRequestsMockData } from './adminDeniedRequestsMockData.js'
import './AdminDashboardHome.css'

const numberFormat = new Intl.NumberFormat('en-US')

const iconPaths = {
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  active: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  disabled: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h6" /></>,
  storage: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  cloud: <><path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 8a4 4 0 0 1 0 8h-1" /><path d="m9 15 3-3 3 3m-3-3v9" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></>,
  up: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  line: <><path d="m3 16 5-6 4 3 8-8" /><circle cx="20" cy="5" r="1" /></>,
  bars: <><path d="M4 20V10m5 10V4m5 16v-7m6 7V7" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10m6-10v10" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5m5-5v12" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  grant: <><circle cx="8" cy="15" r="4" /><path d="m11 12 7-7a2 2 0 0 1 3 3l-7 7m-3-3 3 3" /></>,
  edit: <><path d="m4 16-.8 4.8L8 20l11-11-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  denied: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" /></>,
  plusUser: <><circle cx="9" cy="8" r="4" /><path d="M3 21v-2a6 6 0 0 1 12 0v2m5-11v6m-3-3h6" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  down: <path d="m7 10 5 5 5-5" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  permissions: <><circle cx="8" cy="15" r="4" /><path d="m11 12 7-7a2 2 0 0 1 3 3l-7 7m-3-3 3 3" /></>,
  audit: <><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></>,
  reports: <><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" /></>,
}

function Icon({ name, className = '' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {iconPaths[name] ?? iconPaths.document}
    </svg>
  )
}

function Sparkline({ points, tone }) {
  if (!Array.isArray(points) || points.length < 2) return <span aria-hidden="true" className={`summary-sparkline-unavailable ${tone}`} />
  const max = Math.max(...points)
  const min = Math.min(...points)
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = 32 - ((point - min) / Math.max(max - min, 1)) * 26
    return `${x},${y}`
  })

  return (
    <svg aria-hidden="true" className={`summary-sparkline ${tone}`} preserveAspectRatio="none" viewBox="0 0 100 36">
      <polygon points={`0,36 ${coords.join(' ')} 100,36`} />
      <polyline points={coords.join(' ')} />
    </svg>
  )
}

const summaryCards = [
  { key: 'users', label: 'Total Registered Users', icon: 'users', tone: 'blue', href: '/admin/users?filter=all' },
  { key: 'active', label: 'Active Accounts', icon: 'active', tone: 'green', href: '/admin/users?filter=active' },
  { key: 'disabled', label: 'Disabled Accounts', icon: 'disabled', tone: 'red', href: '/admin/users?filter=disabled' },
  { key: 'documents', label: 'Total Documents', icon: 'document', tone: 'purple', href: '/admin/documents' },
]

function SummaryCard({ card, value, trend, loading, days }) {
  const change = trend?.change_percent
  const trendText = change == null ? '—' : `${change > 0 ? '+' : ''}${change}%`
  const comparisonText = change == null ? 'comparison unavailable' : `vs ${days} days ago`
  return (
    <a aria-label={`${card.label}: ${loading ? 'loading' : value == null ? 'unavailable' : numberFormat.format(value)}. ${change == null ? comparisonText : `${trendText} ${comparisonText}`}.`} className={`summary-card tone-${card.tone}`} href={card.href}>
      <span className="summary-icon"><Icon name={card.icon} /></span>
      <span className="summary-copy">
        <span className="summary-label">{card.label}</span>
        <strong className="summary-value">{loading ? '…' : value == null ? '—' : numberFormat.format(value)}</strong>
        <span className={`summary-trend${trend?.change < 0 ? ' is-down' : ''}`}><b>{change != null && <Icon name="up" />}{loading ? '…' : trendText}</b><span>{comparisonText}</span></span>
      </span>
      <Sparkline points={trend?.points} tone={`spark-${card.tone}`} />
    </a>
  )
}

function SelectControl({ label, value, onChange, options, className = '', prefixIcon }) {
  return (
    <label className={`select-control ${className}`}>
      <span className="sr-only">{label}</span>
      {prefixIcon && <Icon className="select-prefix-icon" name={prefixIcon} />}
      <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Icon name="down" />
    </label>
  )
}

function formatBytes(value) {
  if (value == null) return '—'
  if (value >= 1024 ** 3) return `${(value / (1024 ** 3)).toFixed(1)} GB`
  if (value >= 1024 ** 2) return `${(value / (1024 ** 2)).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${numberFormat.format(value)} B`
}

function percentLabel(value) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value}%`
}

function dateLabel(value, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

const categoryColors = { pdf: '#1597a6', office: '#45c1bf', images: '#82d7cd', other: '#cbd5e1' }

function StoragePanel() {
  const [range, setRange] = useState('30')
  const [result, setResult] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    getAdminDashboardStorage(Number(range), { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setResult({ key: `${range}:${retryKey}`, data }) })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setResult({ key: `${range}:${retryKey}`, error: requestError.message || 'Storage metrics could not be loaded.' }) })
    return () => controller.abort()
  }, [range, retryKey])
  const current = result?.key === `${range}:${retryKey}` ? result : null
  const data = current?.data
  const loading = !current
  const error = current?.error || ''
  const categories = data?.categories || []
  const growth = data?.growth_percent
  let cursor = 0
  const gradient = categories.map((category) => {
    const start = cursor
    cursor += category.percent
    return `${categoryColors[category.key] || categoryColors.other} ${start}% ${cursor}%`
  }).join(', ')
  const donutBackground = data?.total_bytes ? `conic-gradient(${gradient})` : '#e8eef5'

  return (
    <section aria-label="Storage analytics from registered document object metadata" className="data-panel storage-panel">
      <div className="panel-heading">
        <span className="panel-icon teal"><Icon name="storage" /></span>
        <div className="panel-title-copy"><h2>Storage</h2><p>Stored document object sizes</p></div>
        <SelectControl label="Storage time range" value={range} onChange={setRange} options={[
          { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' },
        ]} />
      </div>
      {error && <div className="dashboard-inline-error" role="alert">Storage metrics could not be loaded. <button onClick={() => setRetryKey((key) => key + 1)} type="button">Retry</button></div>}
      <div className="storage-overview">
        <div className="storage-total"><strong>{loading ? '…' : error ? '—' : formatBytes(data?.total_bytes)}</strong><span className={`positive-trend${growth < 0 ? ' is-down' : ''}`}><Icon name="trend" /> {loading ? '…' : error ? '—' : percentLabel(growth)}</span><small>{loading ? 'Calculating storage growth…' : error ? 'Storage growth unavailable' : growth == null ? 'Growth unavailable for this period' : `in the last ${range} days`}</small></div>
        <div aria-label="Stored document size by file category" className="storage-donut" role="img" style={{ background: donutBackground }}>
          <div><strong>{loading ? '…' : error ? '—' : formatBytes(data?.total_bytes)}</strong><span>Total</span></div>
        </div>
        <ul className="storage-legend">
          {categories.map((category) => <li key={category.key}><span style={{ backgroundColor: categoryColors[category.key] || categoryColors.other }} /><span>{category.label}</span><b>{loading || error ? '—' : `${category.percent}%`}</b></li>)}
        </ul>
      </div>
      <div className="storage-stats">
        <div aria-label="Registered logical documents"><span className="small-stat-icon teal"><Icon name="document" /></span><span><b>{loading || error ? '—' : numberFormat.format(data?.logical_documents ?? 0)}</b><small>Total documents</small></span></div>
        <div><span className="small-stat-icon teal"><Icon name="cloud" /></span><span><b>{loading || error ? '—' : formatBytes(data?.added_bytes)}</b><small>Added last {range} days</small></span></div>
        <div><span className="small-stat-icon teal"><Icon name="trend" /></span><span><b>{loading || error ? '—' : percentLabel(growth)}</b><small>Storage growth</small></span></div>
      </div>
    </section>
  )
}

function DeniedRequestsPanel() {
  const [range, setRange] = useState('30')
  const [activeIndex, setActiveIndex] = useState(null)
  const data = useMemo(() => getAdminDeniedRequestsMockData(Number(range)), [range])
  const rows = data.daily
  const totals = data.totals
  const max = Math.max(1, ...rows.map((item) => item.denied))
  const middleIndex = Math.floor((rows.length - 1) / 2)
  const dateIndexes = rows.length ? [...new Set([0, middleIndex, rows.length - 1].filter((index) => index >= 0))] : []
  const activePoint = activeIndex == null ? null : rows[activeIndex]
  const trend = data.comparison.denied_change_percent
  const handleChartPointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const index = Math.max(0, Math.min(rows.length - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * rows.length)))
    setActiveIndex(index)
  }
  const handleChartKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    setActiveIndex((index) => event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? rows.length - 1
        : Math.max(0, Math.min(rows.length - 1, (index ?? 0) + (event.key === 'ArrowRight' ? 1 : -1))))
  }

  return (
    <section aria-label="Denied document access analytics" className="data-panel denied-panel">
      <div className="panel-heading">
        <span className="panel-icon violet"><Icon name="shield" /></span>
        <div className="panel-title-copy"><h2>Denied Requests</h2><p>Access attempts blocked</p></div>
        <SelectControl label="Denied requests time range" value={range} onChange={setRange} options={[
          { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' },
        ]} />
      </div>
      <div className="denied-chart-row">
        <div className="denied-total"><strong>{numberFormat.format(totals.denied)}</strong><span className={`negative-trend${trend != null && trend < 0 ? ' is-down' : ''}`}><Icon name="trend" /> {trend == null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}</span><small>{trend == null ? `of ${range}-day access attempts · comparison unavailable` : `vs prior ${range} days · ${numberFormat.format(totals.total_access_attempts)} attempts`}</small></div>
        <div className="denied-chart" aria-label="Denied document-access attempts by day">
          <div className="denied-y-labels"><span>{numberFormat.format(max)}</span><span>{numberFormat.format(Math.ceil(max / 2))}</span><span>0</span></div>
          <div
            aria-label="Denied access attempts by date. Use arrow keys to inspect dates."
            aria-valuemax={rows.length - 1}
            aria-valuemin="0"
            aria-valuenow={activeIndex ?? undefined}
            aria-valuetext={activePoint ? `${dateLabel(activePoint.date, { month: 'long', day: 'numeric', year: 'numeric' })}: ${activePoint.denied} denied attempts` : undefined}
            className="denied-bars"
            onBlur={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex((index) => index ?? 0)}
            onKeyDown={handleChartKeyDown}
            onPointerLeave={(event) => { if (event.currentTarget !== event.currentTarget.ownerDocument.activeElement) setActiveIndex(null) }}
            onPointerMove={handleChartPointerMove}
            role="slider"
            tabIndex="0"
          >
            {rows.map((item, index) => <span
              aria-hidden="true"
              className={index === activeIndex ? 'denied-bar-active' : ''}
              key={item.date}
              style={{ height: `${item.denied ? Math.max(3, (item.denied / max) * 100) : 0}%` }}
              title={`${dateLabel(item.date, { month: 'long', day: 'numeric', year: 'numeric' })}: ${numberFormat.format(item.denied)} denied access attempts`}
            />)}
          </div>
          <div className="denied-x-labels">{dateIndexes.map((index) => <span key={rows[index]?.date}>{rows[index] ? dateLabel(rows[index].date) : '—'}</span>)}</div>
          {activePoint && <div className={`denied-chart-tooltip${activeIndex > rows.length / 2 ? ' is-left' : ''}`} role="status">
            <b>{dateLabel(activePoint.date, { month: 'short', day: 'numeric', year: 'numeric' })}</b>
            <span>{numberFormat.format(activePoint.denied)} denied attempts</span>
            <span>{new Set(activePoint.userIds).size} affected users · {new Set(activePoint.documentIds).size} documents</span>
          </div>}
        </div>
      </div>
      <div className="denied-stats">
        <div><span className="small-stat-icon red"><Icon name="shield" /></span><span><b>{numberFormat.format(totals.unique_users)}</b><small>Unique users</small></span></div>
        <div><span className="small-stat-icon violet"><Icon name="document" /></span><span><b>{numberFormat.format(totals.distinct_documents)}</b><small>Different documents</small></span></div>
        <div><span className="small-stat-icon violet"><Icon name="active" /></span><span><b>{totals.denial_percent.toFixed(1)}%</b><small>Of access attempts</small></span></div>
      </div>
    </section>
  )
}

const operationTypesByKey = {
  read_view: 'Read / View',
  download: 'Download',
  upload: 'Upload',
  edit_replace: 'Edit / Replace',
  delete: 'Delete',
  permission_changes: 'Permission changes',
}

function ActivityChart({ data, view, loading, error }) {
  const [activePoint, setActivePoint] = useState(null)
  const [chartFocused, setChartFocused] = useState(false)
  const activeIndex = activePoint?.data === data ? activePoint.index : null
  const selectIndex = (index) => setActivePoint(index == null ? null : { data, index })
  if (!data.length) {
    const message = loading
      ? 'Loading operation trend…'
      : error
        ? 'Operation trend is unavailable.'
        : 'No operation events for this period.'
    return <div className="activity-chart-empty-state" role="status">{message}</div>
  }

  if (view === 'table') {
    const rows = data.flatMap((point) => Object.entries(point.byOperation).map(([key, counts]) => ({
      date: point.date,
      label: point.label,
      key,
      operation: operationTypesByKey[key],
      ...counts,
    })))
    return (
      <div className="activity-table-scroll">
        <table className="activity-data-table">
          <thead><tr><th>Date</th><th>Operation type</th><th>Successful</th><th>Denied</th><th>Total</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.date}:${row.key}`}><td>{row.label}</td><td>{row.operation}</td><td className="text-success">{numberFormat.format(row.success)}</td><td className="text-danger">{numberFormat.format(row.denied)}</td><td>{numberFormat.format(row.success + row.denied)}</td></tr>)}</tbody>
        </table>
      </div>
    )
  }

  const width = 700
  const height = 296
  const pad = { left: 42, right: 16, top: 30, bottom: 58 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.success, point.denied]))
  const x = (index) => pad.left + (data.length <= 1 ? innerWidth / 2 : index * (innerWidth / (data.length - 1)))
  const y = (value) => pad.top + innerHeight - (value / maxValue) * innerHeight
  const successPath = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.success)}`).join(' ')
  const deniedPath = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.denied)}`).join(' ')
  const successArea = `${successPath} L ${x(data.length - 1)} ${pad.top + innerHeight} L ${x(0)} ${pad.top + innerHeight} Z`
  const labelIndexes = [...new Set([0, Math.floor((data.length - 1) / 3), Math.floor(((data.length - 1) * 2) / 3), data.length - 1].filter((index) => index >= 0))]
  const highlightedIndex = activeIndex == null ? -1 : Math.min(activeIndex, data.length - 1)
  const highlightedPoint = highlightedIndex >= 0 ? data[highlightedIndex] : null
  const tooltipWidth = 180
  const tooltipX = highlightedPoint
    ? Math.max(4, Math.min(width - tooltipWidth - 4, x(highlightedIndex) < width / 2 ? x(highlightedIndex) + 14 : x(highlightedIndex) - tooltipWidth - 14))
    : 0
  const total = highlightedPoint ? highlightedPoint.success + highlightedPoint.denied : 0
  const denialRate = total ? ((highlightedPoint.denied / total) * 100).toFixed(1) : '0.0'
  const selectFromPointer = (event) => {
    const bounds = event.currentTarget.ownerSVGElement.getBoundingClientRect()
    const chartX = ((event.clientX - bounds.left) / bounds.width) * width
    const nearestIndex = data.length <= 1
      ? 0
      : Math.round(((chartX - pad.left) / innerWidth) * (data.length - 1))
    selectIndex(Math.max(0, Math.min(data.length - 1, nearestIndex)))
  }
  const moveActivePoint = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActivePoint((point) => {
        const index = point?.data === data ? point.index : null
        return {
          data,
          index: event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? data.length - 1
              : Math.max(0, Math.min(data.length - 1, (index ?? 0) + (event.key === 'ArrowRight' ? 1 : -1))),
        }
      })
    }
  }

  return (
    <div className="activity-chart-clip">
      <svg aria-label={`${view === 'line' ? 'Line' : 'Bar'} chart of document operations`} className="activity-chart" preserveAspectRatio="none" role="group" viewBox={`0 0 ${width} ${height}`}>
        <defs><linearGradient id="success-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#25bc80" stopOpacity=".22" /><stop offset="100%" stopColor="#25bc80" stopOpacity=".015" /></linearGradient></defs>
        {Array.from({ length: 5 }, (_, index) => Math.ceil(maxValue * index / 4)).map((tickValue, index) => <g key={`${index}-${tickValue}`}><line className="chart-gridline" x1={pad.left} x2={width - pad.right} y1={y(tickValue)} y2={y(tickValue)} /><text className="chart-axis-label" textAnchor="end" x={pad.left - 8} y={y(tickValue) + 4}>{numberFormat.format(tickValue)}</text></g>)}
        {view === 'line' ? <>
          <path d={successArea} fill="url(#success-fill)" />
          <path className="success-line" d={successPath} />
          <path className="denied-line" d={deniedPath} />
          {data.map((point, index) => <g key={point.date}><circle className="success-point" cx={x(index)} cy={y(point.success)} r="3"><title>{`${point.label}: ${numberFormat.format(point.success)} successful operations`}</title></circle><circle className="denied-point" cx={x(index)} cy={y(point.denied)} r="2.5"><title>{`${point.label}: ${numberFormat.format(point.denied)} denied operations`}</title></circle></g>)}
          <rect
            aria-label="Operation trend data points. Use arrow keys to inspect dates."
            aria-valuemax={data.length - 1}
            aria-valuemin="0"
            aria-valuenow={highlightedIndex >= 0 ? highlightedIndex : undefined}
            aria-valuetext={highlightedPoint ? `${highlightedPoint.label}: ${highlightedPoint.success} successful, ${highlightedPoint.denied} denied` : undefined}
            fill="transparent"
            height={innerHeight}
            onBlur={() => { setChartFocused(false); selectIndex(null) }}
            onFocus={() => { setChartFocused(true); selectIndex(activeIndex ?? 0) }}
            onKeyDown={moveActivePoint}
            onPointerDown={(event) => { if (event.pointerType === 'touch') selectFromPointer(event) }}
            onPointerLeave={(event) => { if (!chartFocused && event.pointerType !== 'touch') selectIndex(null) }}
            onPointerMove={(event) => { if (event.pointerType !== 'touch') selectFromPointer(event) }}
            onPointerUp={(event) => { if (event.pointerType === 'touch') selectFromPointer(event) }}
            role="slider"
            tabIndex="0"
            width={innerWidth}
            x={pad.left}
            y={pad.top}
          />
          {highlightedPoint && <g className="chart-highlight" pointerEvents="none">
            <line x1={x(highlightedIndex)} x2={x(highlightedIndex)} y1={pad.top} y2={pad.top + innerHeight} />
            <circle className="highlight-success-point" cx={x(highlightedIndex)} cy={y(highlightedPoint.success)} r="9" />
            <circle className="highlight-denied-point" cx={x(highlightedIndex)} cy={y(highlightedPoint.denied)} r="9" />
            <g className="chart-tooltip" pointerEvents="none" transform={`translate(${tooltipX} 9)`}>
              <rect height="150" rx="12" width="180" />
              <text className="tooltip-date" x="18" y="23">{highlightedPoint.label}</text>
              <circle className="tooltip-success-dot" cx="22" cy="49" r="5" /><text x="39" y="53">{numberFormat.format(highlightedPoint.success)}</text><text className="tooltip-muted" x="91" y="53">Successful</text>
              <circle className="tooltip-denied-dot" cx="22" cy="75" r="5" /><text x="39" y="79">{numberFormat.format(highlightedPoint.denied)}</text><text className="tooltip-muted" x="91" y="79">Denied</text>
              <line className="tooltip-divider" x1="14" x2="166" y1="94" y2="94" />
              <text className="tooltip-label" x="18" y="115">Total</text><text className="tooltip-value" textAnchor="end" x="162" y="115">{numberFormat.format(total)}</text>
              <text className="tooltip-label" x="18" y="137">Denial rate</text><text className="tooltip-value" textAnchor="end" x="162" y="137">{denialRate}%</text>
            </g>
          </g>}
        </> : data.map((point, index) => {
          const groupWidth = innerWidth / data.length
          const barWidth = Math.max(2, Math.min(10, groupWidth * 0.34))
          const successHeight = (point.success / maxValue) * innerHeight
          const deniedHeight = (point.denied / maxValue) * innerHeight
          const center = pad.left + index * groupWidth + groupWidth / 2
          return <g key={point.date}><rect className="success-bar" height={successHeight} rx="2" width={barWidth} x={center - barWidth - 1} y={pad.top + innerHeight - successHeight}><title>{`${point.label}: ${numberFormat.format(point.success)} successful operations`}</title></rect><rect className="denied-bar" height={deniedHeight} rx="2" width={barWidth} x={center + 1} y={pad.top + innerHeight - deniedHeight}><title>{`${point.label}: ${numberFormat.format(point.denied)} denied operations`}</title></rect></g>
        })}
        {labelIndexes.map((index) => <text className="chart-axis-label" key={index} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} x={x(index)} y={height - 30}>{data[index].label}</text>)}
      </svg>
    </div>
  )
}

function OperationsByType({ data = [], loading = false, error = false }) {
  const max = Math.max(1, ...data.map((item) => item.success + item.denied))
  return (
    <section aria-label="Operations by type" className="operations-type-panel">
      <div className="operations-type-heading"><h3>Operations by Type</h3><div className="chart-legend"><span><i className="legend-success" />Successful</span><span><i className="legend-denied" />Denied</span></div></div>
      <div className="operation-type-list">
        {data.map((item) => {
          const width = ((item.success + item.denied) / max) * 100
          const total = item.success + item.denied
          const successWidth = total ? (item.success / total) * 100 : 0
          return <div className="operation-type-row" key={item.key}><span className="operation-type-label">{item.label}</span><span aria-label={`${item.success} successful and ${item.denied} denied operations`} className="operation-bar-track"><span className="operation-bar-pair" style={{ width: `${width}%` }}><i style={{ width: `${successWidth}%` }} /><b /></span></span><span className="operation-count success-count">{numberFormat.format(item.success)}</span><span className="operation-count denied-count">{numberFormat.format(item.denied)}</span></div>
        })}
        {loading && <p className="operation-empty-state">Loading operation totals…</p>}
        {error && <p className="operation-empty-state" role="alert">Operation totals are unavailable.</p>}
        {!loading && !error && data.length === 0 && <p className="operation-empty-state">No operation events for this selection.</p>}
      </div>
    </section>
  )
}

function ActivitySection() {
  const [view, setView] = useState('line')
  const [range, setRange] = useState('30')
  const [operation, setOperation] = useState('all')
  const data = useMemo(() => getAdminOperationActivityMockData(Number(range), operation), [operation, range])
  const loading = false
  const error = ''
  const activityData = useMemo(() => (data?.daily || []).map((item) => ({
    ...item,
    byOperation: operation === 'all' ? item.byOperation : { [operation]: item.byOperation[operation] },
    label: dateLabel(item.date),
  })), [data, operation])
  const totals = data?.totals
  const comparison = (value) => value == null ? 'comparison unavailable' : `${value > 0 ? '+' : ''}${value}% vs prior ${range} days`
  const cards = [
    { label: 'Total Successful', key: 'success', value: totals?.success, change: totals?.success_change_percent, tone: 'green', icon: 'shield' },
    { label: 'Total Denied', key: 'denied', value: totals?.denied, change: totals?.denied_change_percent, tone: 'red', icon: 'denied' },
    { label: 'Total Operations', key: 'total', value: totals?.total, change: totals?.total_change_percent, tone: 'blue', icon: 'document' },
  ]
  const operationOptions = [
    { value: 'read_view', label: 'Read / View' },
    { value: 'download', label: 'Download' },
    { value: 'upload', label: 'Upload' },
    { value: 'edit_replace', label: 'Edit / Replace' },
    { value: 'delete', label: 'Delete' },
    { value: 'permission_changes', label: 'Permission changes' },
  ]

  return (
    <section aria-label="Document operations activity analytics" className="activity-section">
      <div className="section-heading-row activity-heading-row">
        <div><h2>Document Operations Activity</h2><p>Successful and denied operations across SureDocs.</p></div>
        <div className="activity-filters">
          <SelectControl label="Operations time range" value={range} onChange={setRange} options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} />
          <SelectControl label="Operation type" value={operation} onChange={setOperation} options={[{ value: 'all', label: 'All operations' }, ...operationOptions]} />
        </div>
      </div>
      <div className="activity-view-switch" role="tablist" aria-label="Activity view">
        {[['line', 'Line Chart', 'line'], ['bar', 'Bar Chart', 'bars'], ['table', 'Table View', 'table']].map(([key, label, icon]) => <button aria-selected={view === key} className={view === key ? 'selected' : ''} key={key} onClick={() => setView(key)} role="tab" type="button"><Icon name={icon} />{label}</button>)}
      </div>
      <div className="activity-layout">
        <section className="activity-trend-panel">
          <div className="activity-trend-heading"><h3>Operation Trend <Icon name="info" /></h3></div>
          <ActivityChart data={activityData} error={Boolean(error)} loading={loading} view={view} />
          <div className="chart-legend activity-legend"><span><i className="legend-success" />Successful</span><span><i className="legend-denied" />Denied</span></div>
        </section>
        <div className="activity-side-column">
          <div className="operation-summary-grid">
            {cards.map((card) => <article aria-label={`${card.label}: ${loading ? 'loading' : card.value == null ? 'unavailable' : numberFormat.format(card.value)}`} className={`operation-summary-card ${card.tone}`} key={card.key}><span className="operation-summary-icon"><Icon name={card.icon} /></span><span className="operation-summary-copy"><small>{card.label}</small><b>{loading ? '…' : error ? '—' : numberFormat.format(card.value ?? 0)}</b><em className={card.change < 0 ? 'is-down' : ''}>{card.change == null ? '—' : `${card.change > 0 ? '+' : ''}${card.change}%`}</em><small>{loading ? 'Loading selected range' : comparison(card.change)}</small></span></article>)}
          </div>
          <OperationsByType data={data?.by_type || []} error={Boolean(error)} loading={loading} />
        </div>
      </div>
    </section>
  )
}

const auditActionIcons = {
  DOCUMENT_DOWNLOADED: 'download', PERMISSION_GRANTED: 'grant', DOCUMENT_VIEWED: 'eye',
  ACCESS_DENIED: 'denied', DOCUMENT_UPLOADED: 'upload', DOCUMENT_METADATA_UPDATED: 'edit',
  PERMISSION_REVOKED: 'denied', DOCUMENT_VERSION_CREATED: 'upload', DOCUMENT_DELETED: 'denied',
  DOCUMENT_RESTORED: 'edit', UPLOAD_REJECTED: 'denied',
}

function auditDateTime(value) {
  if (!value) return { date: '—', time: '' }
  const date = new Date(value)
  return {
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date),
  }
}

function RecentAuditLogs() {
  const [result, setResult] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const today = new Date().toISOString().slice(0, 10)
    const start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const query = new URLSearchParams({ from: start, to: today, page: '1', page_size: '6', sort: 'newest' })
    apiGet(`/api/admin/audit/events?${query}`, { signal: controller.signal })
      .then((data) => setResult({ key: retryKey, data }))
      .catch((error) => { if (error.name !== 'AbortError') setResult({ key: retryKey, error: error.message || 'Could not load audit events.' }) })
    return () => controller.abort()
  }, [retryKey])
  const current = result?.key === retryKey ? result : null
  const logs = current?.data?.events || []
  const loading = !current
  const error = current?.error || ''
  return (
    <section className="audit-section">
      <div className="section-heading-row"><div><h2>Recent Audit logs</h2></div><a className="view-all-button" href="/admin/audit">View all</a></div>
      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead><tr><th>Date &amp; Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Document / Resource</th><th>Target User</th><th>Result</th><th>IP Address</th><th>Details</th></tr></thead>
          <tbody>
            {loading && <tr><td className="audit-state" colSpan="9">Loading recent audit logs…</td></tr>}
            {error && <tr><td className="audit-state" colSpan="9">Audit logs could not be loaded. <button onClick={() => { setResult(null); setRetryKey((key) => key + 1) }} type="button">Retry</button></td></tr>}
            {!loading && !error && logs.length === 0 && <tr><td className="audit-state" colSpan="9">No audit events are available for this period.</td></tr>}
            {!loading && !error && logs.map((item) => {
              const { date, time } = auditDateTime(item.timestamp)
              const action = item.action || item.actionType || 'Activity'
              const role = item.actor?.role === 'Administrator' ? 'Admin' : item.actor?.role || 'Unknown'
              const actionIcon = auditActionIcons[item.actionType] || 'document'
              const resultLabel = item.outcome || 'Unknown'
              const resource = item.document?.name || '—'
              const target = item.targetUser?.email || '—'
              const initials = (item.actor?.name || '?').split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
              return <tr key={item.id}>
                <td className="audit-date">{date}<small>{time}</small></td>
                <td><span className="actor-cell"><i>{initials}</i><span title={item.actor?.email || item.actor?.name}>{item.actor?.email || item.actor?.name || 'Unknown user'}</span></span></td>
                <td><span className={`role-badge ${role.toLowerCase()}`}>{role}</span></td>
                <td><span className={`audit-action action-${actionIcon}`}><Icon name={actionIcon} />{action}</span></td>
                <td className="audit-resource" title={resource}><span className="audit-resource-copy">{resource !== '—' && <Icon name="document" />}<span>{resource}</span></span></td>
                <td className="audit-target" title={target}>{target}</td>
                <td><span className={`result-badge ${resultLabel.toLowerCase()}`}>{resultLabel}</span></td>
                <td className="audit-ip">{item.ipAddress || '—'}</td>
                <td className="audit-details-cell"><a aria-label={`Open details for ${action}`} className="details-button" href={`/admin/audit/${encodeURIComponent(item.id)}`}><Icon name="more" /></a></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PlatformHealth() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiGet('/api/auth/health', { signal: controller.signal })
      .then(setHealth)
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestError.message || 'System health could not be loaded.') })
    return () => controller.abort()
  }, [retryKey])
  const services = health ? [
    { title: 'SureDocs API', detail: health.status === 'ok' ? 'The authenticated application API responded.' : 'The API reported an unavailable status.', state: health.status === 'ok' ? 'Responding' : 'Unavailable', icon: 'dashboard' },
    { title: 'PostgreSQL', detail: health.database === 'connected' ? 'The API health check successfully queried PostgreSQL.' : 'The API health check could not query PostgreSQL.', state: health.database === 'connected' ? 'Connected' : 'Unavailable', icon: 'storage' },
  ] : []
  return (
    <section className="health-section">
      <div className="section-heading-row"><div><h2>Platform Health</h2></div><button className="text-retry-button" onClick={() => { setHealth(null); setError(''); setRetryKey((key) => key + 1) }} type="button">Refresh</button></div>
      {error && <div className="dashboard-section-error" role="alert">System health could not be loaded. <button onClick={() => { setError(''); setRetryKey((key) => key + 1) }} type="button">Retry</button></div>}
      {!health && !error && <p className="health-empty-state">Checking API and database availability…</p>}
      {health && <div className="health-list">{services.map((service) => <article className="health-item" key={service.title}>
        <div className="health-row"><span className="health-icon"><Icon name={service.icon} /></span><span className="health-copy"><b>{service.title}</b><small>{service.detail}</small></span><span className={`health-status${service.state === 'Unavailable' ? ' is-unavailable' : ''}`}>{service.state}</span></div>
      </article>)}</div>}
    </section>
  )
}

function DashboardHeader({ onMenuClick, days, onDaysChange, asOf }) {
  const [openPanel, setOpenPanel] = useState(null)
  const [notificationData, setNotificationData] = useState(null)
  const [notificationError, setNotificationError] = useState('')
  const [notificationRetry, setNotificationRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    apiGet('/api/users/me/notifications?page=1&page_size=5', { signal: controller.signal })
      .then(setNotificationData)
      .catch((requestError) => { if (requestError.name !== 'AbortError') setNotificationError(requestError.message || 'Notifications could not be loaded.') })
    return () => controller.abort()
  }, [notificationRetry])
  const today = asOf ? new Date(asOf) : null
  const options = [7, 30, 90].map((period) => {
    if (!today) return { value: String(period), label: `Last ${period} days` }
    const first = new Date(today)
    first.setUTCDate(first.getUTCDate() - (period - 1))
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    return { value: String(period), label: period === 7 ? `${formatter.format(first)} – ${formatter.format(today)}` : `Last ${period} days` }
  })
  const notifications = notificationData?.items || []
  return (
    <header className="dashboard-header">
      <button aria-label="Open navigation menu" className="mobile-menu-button" onClick={onMenuClick} type="button"><Icon name="menu" /></button>
      <div className="dashboard-heading-copy"><h1>Administrator Dashboard</h1><p>Overview of users, documents, permissions, and security activity in SureDocs.</p></div>
      <div className="dashboard-header-actions">
        <div className="header-popover-wrap"><button aria-expanded={openPanel === 'notifications'} aria-label={`Notifications${notificationData ? `, ${notificationData.unread_count} unread` : ''}`} className="header-icon-button notification-button" onClick={() => setOpenPanel(openPanel === 'notifications' ? null : 'notifications')} type="button"><Icon name="bell" />{notificationData?.unread_count > 0 && <i>{notificationData.unread_count > 99 ? '99+' : notificationData.unread_count}</i>}</button>{openPanel === 'notifications' && <div className="header-popover"><b>Notifications</b>{notificationError ? <p role="alert">Notifications could not be loaded. <button onClick={() => { setNotificationError(''); setNotificationRetry((key) => key + 1) }} type="button">Retry</button></p> : !notificationData ? <p>Loading your notifications…</p> : notifications.length ? notifications.map((item) => <p key={item.id}><strong>{item.title}</strong><br />{item.message}</p>) : <p>You have no notifications.</p>}</div>}</div>
        <div className="header-popover-wrap"><button aria-expanded={openPanel === 'preferences'} aria-label="Dashboard preferences" className="header-icon-button" onClick={() => setOpenPanel(openPanel === 'preferences' ? null : 'preferences')} type="button"><Icon name="sun" /></button>{openPanel === 'preferences' && <div className="header-popover"><b>Dashboard preferences</b><p>Theme and dashboard settings are not connected yet.</p></div>}</div>
        <SelectControl className="dashboard-date-select" label="Dashboard comparison period" prefixIcon="calendar" value={String(days)} onChange={onDaysChange} options={options} />
      </div>
    </header>
  )
}

export default function AdminDashboardHome({ onMenuClick }) {
  const [days, setDays] = useState('7')
  const [summaryResult, setSummaryResult] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getAdminDashboardSummary(Number(days), { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setSummaryResult({ key: `${days}:${retryKey}`, data }) })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setSummaryResult({ key: `${days}:${retryKey}`, error: requestError.message || 'Could not load live dashboard metrics.' })
      })
    return () => controller.abort()
  }, [days, retryKey])

  const currentSummaryResult = summaryResult?.key === `${days}:${retryKey}` ? summaryResult : null
  const summary = currentSummaryResult?.data
  const loading = !currentSummaryResult
  const error = currentSummaryResult?.error || ''

  function retryMetrics() {
    setRetryKey((key) => key + 1)
  }

  return (
    <div className="admin-dashboard-home">
      <DashboardHeader asOf={summary?.as_of} days={days} onDaysChange={setDays} onMenuClick={onMenuClick} />
      <section aria-label="Live account and document metrics" className="summary-grid">
        {summaryCards.map((card) => <SummaryCard card={card} days={days} key={card.key} loading={loading} trend={summary?.trends?.[card.key]} value={card.key === 'documents' ? summary?.documents?.total : summary?.users?.[card.key === 'users' ? 'total' : card.key]} />)}
      </section>
      {loading && <p className="live-metrics-message" role="status">Loading live user and document counts…</p>}
      {error && <div className="live-metrics-error" role="alert"><span>Live metrics could not be loaded: {error}</span><button onClick={retryMetrics} type="button">Retry</button></div>}
      <div className="analytics-panels"><StoragePanel /><DeniedRequestsPanel /></div>
      <ActivitySection />
      <RecentAuditLogs />
      <PlatformHealth />
    </div>
  )
}

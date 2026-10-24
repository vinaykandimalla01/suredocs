import { useEffect, useMemo, useState } from 'react'
import { apiGet } from './api.js'
import { getAdminDashboardSummary } from './dashboardApi.js'
import { dashboardMockData } from './dashboardMockData.js'
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
  { key: 'users', label: 'Total Registered Users', icon: 'users', tone: 'blue', href: '/admin/users?filter=all', mockTrend: 'users' },
  { key: 'active', label: 'Active Accounts', icon: 'active', tone: 'green', href: '/admin/users?filter=active', mockTrend: 'active' },
  { key: 'disabled', label: 'Disabled Accounts', icon: 'disabled', tone: 'red', href: '/admin/users?filter=disabled', mockTrend: 'disabled' },
  { key: 'documents', label: 'Total Documents', icon: 'document', tone: 'purple', href: '/admin/documents', mockTrend: 'documents' },
]

function SummaryCard({ card, value, loading }) {
  const trend = dashboardMockData.metricTrends[card.mockTrend]
  return (
    <a aria-label={`${card.label}: ${loading ? 'loading' : value == null ? 'unavailable' : numberFormat.format(value)}. Illustrative trend ${trend.change} versus last week.`} className={`summary-card tone-${card.tone}`} href={card.href}>
      <span className="summary-icon"><Icon name={card.icon} /></span>
      <span className="summary-copy">
        <span className="summary-label">{card.label}</span>
        <strong className="summary-value">{loading ? '…' : value == null ? '—' : numberFormat.format(value)}</strong>
        <span className="summary-trend"><b><Icon name="up" />{trend.change}</b><span>vs last week</span></span>
      </span>
      <Sparkline points={trend.points} tone={`spark-${card.tone}`} />
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

function StoragePanel({ documentCount }) {
  const [range, setRange] = useState('30')
  const segments = dashboardMockData.storage.breakdown
  const growth = dashboardMockData.storage.ranges[range]
  const gradient = segments.map((segment, index) => {
    const start = segments.slice(0, index).reduce((total, item) => total + item.value, 0)
    return `${segment.color} ${start}% ${start + segment.value}%`
  }).join(', ')

  return (
    <section aria-label="Storage analytics, illustrative demo data" className="data-panel storage-panel">
      <div className="panel-heading">
        <span className="panel-icon teal"><Icon name="storage" /></span>
        <div className="panel-title-copy"><h2>Storage</h2><p>Total document storage used</p></div>
        <SelectControl label="Storage time range" value={range} onChange={setRange} options={[
          { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' },
        ]} />
      </div>
      <div className="storage-overview">
        <div className="storage-total"><strong>{dashboardMockData.storage.total}</strong><span className="positive-trend"><Icon name="trend" /> {growth}</span><small>in the last {range} days</small></div>
        <div aria-label="Mock storage breakdown" className="storage-donut" role="img" style={{ background: `conic-gradient(${gradient})` }}>
          <div><strong>{dashboardMockData.storage.total}</strong><span>Total</span></div>
        </div>
        <ul className="storage-legend">
          {segments.map((segment) => <li key={segment.label}><span style={{ backgroundColor: segment.color }} /><span>{segment.label}</span><b>{segment.value}%</b></li>)}
        </ul>
      </div>
      <div className="storage-stats">
        <div aria-label="Total documents, live value"><span className="small-stat-icon teal"><Icon name="document" /></span><span><b>{documentCount == null ? '—' : numberFormat.format(documentCount)}</b><small>Total documents</small></span></div>
        <div><span className="small-stat-icon teal"><Icon name="cloud" /></span><span><b>{dashboardMockData.storage.addedThisMonth}</b><small>Added this month</small></span></div>
        <div><span className="small-stat-icon teal"><Icon name="trend" /></span><span><b>{dashboardMockData.storage.growth}</b><small>Storage growth</small></span></div>
      </div>
    </section>
  )
}

function DeniedRequestsPanel() {
  const [range, setRange] = useState('30')
  const rangeData = dashboardMockData.deniedRequests.ranges[range]
  const data = rangeData.bars
  const max = 10

  return (
    <section aria-label="Denied requests analytics, illustrative demo data" className="data-panel denied-panel">
      <div className="panel-heading">
        <span className="panel-icon violet"><Icon name="shield" /></span>
        <div className="panel-title-copy"><h2>Denied Requests</h2><p>Access attempts blocked</p></div>
        <SelectControl label="Denied requests time range" value={range} onChange={setRange} options={[
          { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' },
        ]} />
      </div>
      <div className="denied-chart-row">
          <div className="denied-total"><strong>{rangeData.total}</strong><span className="negative-trend"><Icon name="trend" /> {dashboardMockData.deniedRequests.change}</span><small>in the last {range} days</small></div>
        <div className="denied-chart" aria-label="Mock denied requests by day">
          <div className="denied-y-labels"><span>{max}</span><span>{max / 2}</span><span>0</span></div>
          <div className="denied-bars">
            {data.map((value, index) => <span key={index} style={{ height: `${Math.max(value ? 5 : 0, (value / max) * 100)}%` }} title={`${value} demo requests`} />)}
          </div>
          {range === '30' && <div className="denied-tooltip"><b>6 requests</b><span>Oct 14, 2026</span></div>}
          <div className="denied-x-labels"><span>Oct 13</span><span>Oct 19</span><span>Oct 25</span><span>Oct 31</span></div>
        </div>
      </div>
      <div className="denied-stats">
        <div><span className="small-stat-icon red"><Icon name="shield" /></span><span><b>{rangeData.uniqueUsers}</b><small>Unique users</small></span></div>
        <div><span className="small-stat-icon violet"><Icon name="document" /></span><span><b>{rangeData.documents}</b><small>Different documents</small></span></div>
        <div><span className="small-stat-icon violet"><Icon name="active" /></span><span><b>{rangeData.requestShare}</b><small>Of total requests</small></span></div>
      </div>
    </section>
  )
}

function ActivityChart({ data, view }) {
  if (view === 'table') {
    return (
      <div className="activity-table-scroll">
        <table className="activity-data-table">
          <thead><tr><th>Date</th><th>Successful operations</th><th>Denied operations</th><th>Total</th></tr></thead>
          <tbody>{data.map((point) => <tr key={point.label}><td>{point.label}</td><td className="text-success">{numberFormat.format(point.success)}</td><td className="text-danger">{numberFormat.format(point.denied)}</td><td>{numberFormat.format(point.success + point.denied)}</td></tr>)}</tbody>
        </table>
      </div>
    )
  }

  const width = 700
  const height = 296
  const pad = { left: 42, right: 16, top: 30, bottom: 58 }
  const innerWidth = width - pad.left - pad.right
  const innerHeight = height - pad.top - pad.bottom
  const maxValue = 1400
  const x = (index) => pad.left + (data.length <= 1 ? innerWidth / 2 : index * (innerWidth / (data.length - 1)))
  const y = (value) => pad.top + innerHeight - (value / maxValue) * innerHeight
  const successPath = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.success)}`).join(' ')
  const deniedPath = data.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point.denied)}`).join(' ')
  const successArea = `${successPath} L ${x(data.length - 1)} ${pad.top + innerHeight} L ${x(0)} ${pad.top + innerHeight} Z`
  const labelIndexes = data.length === 30 ? [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 29] : [...new Set([0, Math.floor((data.length - 1) / 3), Math.floor(((data.length - 1) * 2) / 3), data.length - 1])]
  const highlightedIndex = data.length > 15 ? 15 : -1
  const highlightedPoint = highlightedIndex >= 0 ? data[highlightedIndex] : null

  return (
    <div className="activity-chart-clip">
      <svg aria-label={`Demo ${view === 'line' ? 'line' : 'bar'} chart for document operations`} className="activity-chart" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs><linearGradient id="success-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#25bc80" stopOpacity=".22" /><stop offset="100%" stopColor="#25bc80" stopOpacity=".015" /></linearGradient></defs>
        {Array.from({ length: 8 }, (_, index) => index * 200).map((tickValue) => <g key={tickValue}><line className="chart-gridline" x1={pad.left} x2={width - pad.right} y1={y(tickValue)} y2={y(tickValue)} /><text className="chart-axis-label" textAnchor="end" x={pad.left - 8} y={y(tickValue) + 4}>{numberFormat.format(tickValue)}</text></g>)}
        {view === 'line' ? <>
          <path d={successArea} fill="url(#success-fill)" />
          <path className="success-line" d={successPath} />
          <path className="denied-line" d={deniedPath} />
          {data.map((point, index) => <g key={point.label}><circle className="success-point" cx={x(index)} cy={y(point.success)} r="3" /><circle className="denied-point" cx={x(index)} cy={y(point.denied)} r="2.5"><title>{`${point.label}: ${point.denied} denied demo operations`}</title></circle></g>)}
          {highlightedPoint && <g className="chart-highlight">
            <line x1={x(highlightedIndex)} x2={x(highlightedIndex)} y1={pad.top} y2={pad.top + innerHeight} />
            <circle className="highlight-success-point" cx={x(highlightedIndex)} cy={y(highlightedPoint.success)} r="9" />
            <circle className="highlight-denied-point" cx={x(highlightedIndex)} cy={y(highlightedPoint.denied)} r="9" />
            <g className="chart-tooltip" transform="translate(386 9)">
              <rect height="150" rx="12" width="180" />
              <text className="tooltip-date" x="18" y="23">Jun 16</text>
              <circle className="tooltip-success-dot" cx="22" cy="49" r="5" /><text x="39" y="53">{numberFormat.format(highlightedPoint.success)}</text><text className="tooltip-muted" x="91" y="53">Successful</text>
              <circle className="tooltip-denied-dot" cx="22" cy="75" r="5" /><text x="39" y="79">{numberFormat.format(highlightedPoint.denied)}</text><text className="tooltip-muted" x="91" y="79">Denied</text>
              <line className="tooltip-divider" x1="14" x2="166" y1="94" y2="94" />
              <text className="tooltip-label" x="18" y="115">Total</text><text className="tooltip-value" textAnchor="end" x="162" y="115">{numberFormat.format(highlightedPoint.success + highlightedPoint.denied)}</text>
              <text className="tooltip-label" x="18" y="137">Denial rate</text><text className="tooltip-value" textAnchor="end" x="162" y="137">{((highlightedPoint.denied / (highlightedPoint.success + highlightedPoint.denied)) * 100).toFixed(1)}%</text>
            </g>
          </g>}
        </> : data.map((point, index) => {
          const groupWidth = innerWidth / data.length
          const barWidth = Math.max(2, Math.min(10, groupWidth * 0.34))
          const successHeight = (point.success / maxValue) * innerHeight
          const deniedHeight = Math.max(2, (point.denied / maxValue) * innerHeight)
          const center = pad.left + index * groupWidth + groupWidth / 2
          return <g key={point.label}><rect className="success-bar" height={successHeight} rx="2" width={barWidth} x={center - barWidth - 1} y={pad.top + innerHeight - successHeight}><title>{`${point.label}: ${point.success} successful demo operations`}</title></rect><rect className="denied-bar" height={deniedHeight} rx="2" width={barWidth} x={center + 1} y={pad.top + innerHeight - deniedHeight}><title>{`${point.label}: ${point.denied} denied demo operations`}</title></rect></g>
        })}
        {labelIndexes.map((index) => <text className="chart-axis-label" key={index} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} x={x(index)} y={height - 30}>{data[index].label}</text>)}
      </svg>
    </div>
  )
}

function OperationsByType() {
  const max = Math.max(...dashboardMockData.operationTypes.map((item) => item.success + item.denied))
  return (
    <section aria-label="Operations by type, illustrative demo data" className="operations-type-panel">
      <div className="operations-type-heading"><h3>Operations by Type <span>DEMO</span></h3><div className="chart-legend"><span><i className="legend-success" />Successful</span><span><i className="legend-denied" />Denied</span></div></div>
      <div className="operation-type-list">
        {dashboardMockData.operationTypes.map((item) => {
          const width = ((item.success + item.denied) / max) * 100
          const successWidth = (item.success / (item.success + item.denied)) * 100
          return <div className="operation-type-row" key={item.key}><span className="operation-type-label">{item.label}</span><span aria-label={`${item.success} successful and ${item.denied} denied demo operations`} className="operation-bar-track"><span className="operation-bar-pair" style={{ width: `${width}%` }}><i style={{ width: `${successWidth}%` }} /><b /></span></span><span className="operation-count success-count">{numberFormat.format(item.success)}</span><span className="operation-count denied-count">{numberFormat.format(item.denied)}</span></div>
        })}
      </div>
    </section>
  )
}

function ActivitySection() {
  const [view, setView] = useState('line')
  const [range, setRange] = useState('30')
  const [operation, setOperation] = useState('all')
  const activityData = useMemo(() => {
    const data = operation === 'all'
      ? dashboardMockData.operationSeries
      : dashboardMockData.operationsByType[operation].success.map((success, index) => ({
        label: dashboardMockData.operationSeries[index].label,
        success,
        denied: dashboardMockData.operationsByType[operation].denied[index],
      }))
    return range === '7' ? data.slice(-7) : data
  }, [operation, range])
  const totals = activityData.reduce((result, point) => ({ success: result.success + point.success, denied: result.denied + point.denied }), { success: 0, denied: 0 })
  const cards = [
    { label: 'Total Successful', value: totals.success, change: '+12%', tone: 'green', icon: 'shield' },
    { label: 'Total Denied', value: totals.denied, change: '+28%', tone: 'red', icon: 'denied' },
    { label: 'Total Operations', value: totals.success + totals.denied, change: '+14%', tone: 'blue', icon: 'document' },
  ]

  return (
    <section aria-label="Document operations activity, illustrative demo data" className="activity-section">
      <div className="section-heading-row activity-heading-row">
        <div><h2>Document Operations Activity</h2><p>Successful and denied operations across SureDocs.</p></div>
        <div className="activity-filters">
          <SelectControl label="Operations time range" value={range} onChange={setRange} options={[{ value: '30', label: 'Last 30 days' }, { value: '7', label: 'Last 7 days' }]} />
          <SelectControl label="Operation type" value={operation} onChange={setOperation} options={[{ value: 'all', label: 'All operations' }, ...dashboardMockData.operationTypes.map((item) => ({ value: item.key, label: item.label }))]} />
        </div>
      </div>
      <div className="activity-view-switch" role="tablist" aria-label="Activity view">
        {[['line', 'Line Chart', 'line'], ['bar', 'Bar Chart', 'bars'], ['table', 'Table View', 'table']].map(([key, label, icon]) => <button aria-selected={view === key} className={view === key ? 'selected' : ''} key={key} onClick={() => setView(key)} role="tab" type="button"><Icon name={icon} />{label}</button>)}
      </div>
      <div className="activity-layout">
        <section className="activity-trend-panel">
          <div className="activity-trend-heading"><h3>Operation Trend <Icon name="info" /></h3><span>DEMO DATA</span></div>
          <ActivityChart data={activityData} view={view} />
          <div className="chart-legend activity-legend"><span><i className="legend-success" />Successful</span><span><i className="legend-denied" />Denied</span></div>
        </section>
        <div className="activity-side-column">
          <div className="operation-summary-grid">
            {cards.map((card) => <article aria-label={`${card.label}, illustrative demo value ${numberFormat.format(card.value)}`} className={`operation-summary-card ${card.tone}`} key={card.label}><span className="operation-summary-icon"><Icon name={card.icon} /></span><span className="operation-summary-copy"><small>{card.label}</small><b>{numberFormat.format(card.value)}</b><em><Icon name="up" />{card.change}</em><small>vs previous 30 days</small></span></article>)}
          </div>
          <OperationsByType />
        </div>
      </div>
    </section>
  )
}

const auditActionLabels = {
  DOCUMENT_DOWNLOADED: 'Downloaded', PERMISSION_GRANTED: 'Granted Access', DOCUMENT_VIEWED: 'Viewed',
  ACCESS_DENIED: 'Access Denied', DOCUMENT_UPLOADED: 'Uploaded', DOCUMENT_METADATA_UPDATED: 'Metadata Updated', USER_CREATED: 'Created User',
  PERMISSION_REVOKED: 'Access Revoked', DOCUMENT_VERSION_CREATED: 'Uploaded', DOCUMENT_DELETED: 'Deleted',
  DOCUMENT_SCAN_COMPLETED: 'Document Scan Completed',
}
const auditActionIcons = { Downloaded: 'download', 'Granted Access': 'grant', Viewed: 'eye', 'Access Denied': 'denied', Uploaded: 'upload', 'Metadata Updated': 'edit', 'Access Revoked': 'denied', Deleted: 'denied' }

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
    apiGet('/api/admin/audit/events?page=1&page_size=6&sort=newest&activity_days=30', { signal: controller.signal })
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
              const action = auditActionLabels[item.actionType] || item.action || 'Activity'
              const role = item.actor?.role === 'Administrator' ? 'Admin' : item.actor?.role || 'Unknown'
              const actionIcon = auditActionIcons[action] || 'document'
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
  const [expanded, setExpanded] = useState(null)
  return (
    <section className="health-section">
      <div className="section-heading-row"><div><h2>Platform Health</h2></div></div>
      <div className="health-list">{dashboardMockData.platformHealth.map((service) => <article className="health-item" key={service.title}>
        <button aria-expanded={expanded === service.title} className="health-row" onClick={() => setExpanded(expanded === service.title ? null : service.title)} type="button">
          <span className="health-icon"><Icon name={service.icon} /></span><span className="health-copy"><b>{service.title}</b><small>{service.description}</small><em>{service.checked}</em></span><span className="health-status">Healthy · demo</span><Icon className={`health-chevron${expanded === service.title ? ' expanded' : ''}`} name="chevron" />
        </button>
        {expanded === service.title && <div className="health-detail">{service.detail}</div>}
      </article>)}</div>
    </section>
  )
}

function DashboardHeader({ onMenuClick }) {
  const [range, setRange] = useState('week')
  const [openPanel, setOpenPanel] = useState(null)
  return (
    <header className="dashboard-header">
      <button aria-label="Open navigation menu" className="mobile-menu-button" onClick={onMenuClick} type="button"><Icon name="menu" /></button>
      <div className="dashboard-heading-copy"><h1>Administrator Dashboard</h1><p>Overview of users, documents, permissions, and security activity in TrustVault.</p></div>
      <div className="dashboard-header-actions">
        <div className="header-popover-wrap"><button aria-expanded={openPanel === 'notifications'} aria-label="Notifications · demo" className="header-icon-button notification-button" onClick={() => setOpenPanel(openPanel === 'notifications' ? null : 'notifications')} type="button"><Icon name="bell" /><i>5</i></button>{openPanel === 'notifications' && <div className="header-popover"><b>Notifications · demo</b><p>No notification service is connected. This panel is a local preview.</p></div>}</div>
        <div className="header-popover-wrap"><button aria-expanded={openPanel === 'preferences'} aria-label="Dashboard preferences" className="header-icon-button" onClick={() => setOpenPanel(openPanel === 'preferences' ? null : 'preferences')} type="button"><Icon name="sun" /></button>{openPanel === 'preferences' && <div className="header-popover"><b>Dashboard preferences</b><p>Theme and dashboard settings are not connected yet.</p></div>}</div>
        <SelectControl className="dashboard-date-select" label="Dashboard date range · demo" prefixIcon="calendar" value={range} onChange={setRange} options={[{ value: 'week', label: 'Oct 13, 2026 – Oct 19, 2026' }, { value: 'month', label: 'Last 30 days · demo' }, { value: 'quarter', label: 'Last 90 days · demo' }]} />
      </div>
    </header>
  )
}

export default function AdminDashboardHome({ onMenuClick }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getAdminDashboardSummary({ signal: controller.signal })
      .then((result) => setSummary(result))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message || 'Could not load live dashboard metrics.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retryKey])

  function retryMetrics() {
    setLoading(true)
    setError('')
    setRetryKey((key) => key + 1)
  }

  return (
    <div className="admin-dashboard-home">
      <DashboardHeader onMenuClick={onMenuClick} />
      <section aria-label="Live account and document metrics" className="summary-grid">
        {summaryCards.map((card) => <SummaryCard card={card} key={card.key} loading={loading} value={card.key === 'documents' ? summary?.documents?.total : summary?.users?.[card.key === 'users' ? 'total' : card.key]} />)}
      </section>
      {loading && <p className="live-metrics-message" role="status">Loading live user and document counts…</p>}
      {error && <div className="live-metrics-error" role="alert"><span>Live metrics could not be loaded: {error}</span><button onClick={retryMetrics} type="button">Retry</button></div>}
      <div className="analytics-panels"><StoragePanel documentCount={summary?.documents?.total} /><DeniedRequestsPanel /></div>
      <ActivitySection />
      <RecentAuditLogs />
      <PlatformHealth />
    </div>
  )
}

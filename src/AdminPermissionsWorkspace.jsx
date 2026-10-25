import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiGet, apiGetFile } from './api.js'
import AdminPermissionDocumentModal from './AdminPermissionDocumentModal.jsx'
import './AdminPermissionsWorkspace.css'

// SVGs / Icons matching exact designs
function Icon({ name, className = 'w-4 h-4' }) {
  const icons = {
    search: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
    ),
    export: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    ),
    calendar: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
    chevronDown: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    ),
    chevronLeft: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    ),
    chevronRight: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    ),
    more: (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="19" cy="12" r="1.75" />
        <circle cx="5" cy="12" r="1.75" />
      </svg>
    ),
    fileText: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    clock: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    ban: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
      </svg>
    ),
    eye: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    download: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    ),
    edit: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
    filter: (
      <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    ),
  }
  return icons[name] || icons.fileText
}

function formatDateDisplay(value) {
  if (!value) return { date: '—', time: '' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date: dateStr, time: timeStr }
}

function formatDaysDisplay(days) {
  if (days === null || days === undefined) return 'Never'
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function formatInitials(name) {
  if (!name) return '??'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

function fileIconType(extension, filename = '') {
  const ext = (extension || filename.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf') return { label: 'PDF', cls: 'permissions-doc-icon-pdf' }
  if (['doc', 'docx'].includes(ext)) return { label: 'W', cls: 'permissions-doc-icon-docx' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { label: 'X', cls: 'permissions-doc-icon-xlsx' }
  if (['ppt', 'pptx'].includes(ext)) return { label: 'P', cls: 'permissions-doc-icon-pptx' }
  return { label: 'F', cls: 'permissions-doc-icon-file' }
}

const DATE_RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This year', value: '365d' },
  { label: 'All time', value: 'all' },
]

export default function AdminPermissionsWorkspace({ onOpenDocument }) {
  // Navigation / View state
  // View mode: 'overview' | 'total' | 'active' | 'expired' | 'revoked'
  const [viewMode, setViewMode] = useState(() => {
    const path = window.location.pathname.toLowerCase()
    if (path.includes('/permissions/total')) return 'total'
    if (path.includes('/permissions/active')) return 'active'
    if (path.includes('/permissions/expired')) return 'expired'
    if (path.includes('/permissions/revoked')) return 'revoked'
    return 'overview'
  })

  // Overview tab state: 'all' | 'active' | 'expired' | 'revoked'
  const [overviewTab, setOverviewTab] = useState('all')

  // Date range state
  const [dateRange, setDateRange] = useState('30d')
  const [dateMenuOpen, setDateMenuOpen] = useState(false)
  const dateMenuRef = useRef(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [docFilter, setDocFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState(() => {
    if (viewMode === 'active') return 'newest'
    if (viewMode === 'expired') return 'expired_date'
    if (viewMode === 'revoked') return 'revoked_date'
    return 'newest'
  })

  // Selection & pagination state
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // API Data state
  const [summaryData, setSummaryData] = useState(null)
  const [trendData, setTrendData] = useState([])
  const [distData, setDistData] = useState(null)
  const [topDocs, setTopDocs] = useState([])
  const [recordsPayload, setRecordsPayload] = useState({ items: [], total: 0, documents: [], users: [] })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [modalDocId, setModalDocId] = useState(null)

  const handleOpenDocModal = useCallback(
    (docId) => {
      setModalDocId(docId)
      onOpenDocument?.(docId)
    },
    [onOpenDocument]
  )

  // Sync debounce for search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  // Sync viewMode with URL history
  const navigateToView = useCallback((nextView) => {
    setViewMode(nextView)
    setPage(1)
    setSelectedRows(new Set())
    let sub = ''
    if (nextView === 'total') sub = '/total'
    else if (nextView === 'active') sub = '/active'
    else if (nextView === 'expired') sub = '/expired'
    else if (nextView === 'revoked') sub = '/revoked'

    window.history.pushState(null, '', `/admin/permissions${sub}`)
  }, [])

  // Listen to popstate
  useEffect(() => {
    function handlePopState() {
      const path = window.location.pathname.toLowerCase()
      if (path.includes('/permissions/total')) setViewMode('total')
      else if (path.includes('/permissions/active')) setViewMode('active')
      else if (path.includes('/permissions/expired')) setViewMode('expired')
      else if (path.includes('/permissions/revoked')) setViewMode('revoked')
      else setViewMode('overview')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Close menus on outside click
  useEffect(() => {
    function handleDocClick(e) {
      if (dateMenuRef.current && !dateMenuRef.current.contains(e.target)) {
        setDateMenuOpen(false)
      }
      if (!e.target.closest('.permissions-action-btn') && !e.target.closest('.permissions-actions-menu')) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => document.removeEventListener('mousedown', handleDocClick)
  }, [])

  // Determine effective status for current view
  const currentStatusParam = useMemo(() => {
    if (viewMode === 'active') return 'active'
    if (viewMode === 'expired') return 'expired'
    if (viewMode === 'revoked') return 'revoked'
    if (viewMode === 'overview') {
      if (overviewTab !== 'all') return overviewTab
    }
    return statusFilter
  }, [viewMode, overviewTab, statusFilter])

  // 1. Fetch Summary Data
  const loadSummary = useCallback(async () => {
    try {
      const data = await apiGet(`/api/admin/permissions/summary?range=${dateRange}`)
      setSummaryData(data)
    } catch {
      // Keep existing data on error
    }
  }, [dateRange])

  // 2. Fetch Trends & Distribution & Top Docs
  const loadAnalytics = useCallback(async () => {
    if (viewMode === 'overview') return
    try {
      const [trendRes, distRes] = await Promise.all([
        apiGet(`/api/admin/permissions/trends?range=${dateRange}&status=${viewMode}`),
        apiGet(`/api/admin/permissions/distribution?range=${dateRange}&status=${viewMode}`),
      ])
      setTrendData(trendRes)
      setDistData(distRes)

      if (viewMode === 'total') {
        const topRes = await apiGet(`/api/admin/permissions/top-documents?range=${dateRange}&limit=5`)
        setTopDocs(topRes)
      }
    } catch {
      // Keep existing
    }
  }, [dateRange, viewMode])

  // 3. Fetch Records Table
  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        range: dateRange,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (docFilter && docFilter !== 'all') params.set('document_id', docFilter)
      if (userFilter && userFilter !== 'all') params.set('user_id', userFilter)
      if (typeFilter && typeFilter !== 'all') params.set('permission_type', typeFilter)
      if (currentStatusParam && currentStatusParam !== 'all') params.set('status', currentStatusParam)
      if (sortBy) params.set('sort_by', sortBy)

      const payload = await apiGet(`/api/admin/permissions/records?${params.toString()}`)
      setRecordsPayload(payload)
    } catch {
      setRecordsPayload((prev) => ({ ...prev, items: [], total: 0 }))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, dateRange, debouncedSearch, docFilter, userFilter, typeFilter, currentStatusParam, sortBy])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  // Export CSV
  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        status: currentStatusParam || 'all',
        range: dateRange,
      })
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (docFilter && docFilter !== 'all') params.set('document_id', docFilter)
      if (typeFilter && typeFilter !== 'all') params.set('permission_type', typeFilter)

      const fileResult = await apiGetFile(`/api/admin/permissions/export?${params.toString()}`)
      const blob = fileResult.blob
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `suredocs_permissions_${viewMode}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(`Export failed: ${err.message || 'Please try again.'}`)
    } finally {
      setExporting(false)
    }
  }

  // Row selection toggle
  function toggleRow(id) {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllRows() {
    if (selectedRows.size === recordsPayload.items.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(recordsPayload.items.map((item) => item.id)))
    }
  }

  // Quick action: revoke
  async function handleQuickRevoke(record) {
    const reason = window.prompt(`Revoke access for ${record.user_name} on "${record.document_title}"?\nEnter reason for revocation:`, 'No longer required')
    if (!reason || !reason.trim()) return

    try {
      await apiGetFile(`/api/admin/permissions/documents/${record.document_id}/grants/${record.id}`)
    } catch {
      // Proceed to call POST revoke
    }
    try {
      const res = await fetch(`/api/admin/permissions/documents/${record.document_id}/grants/${record.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (res.ok) {
        loadSummary()
        loadAnalytics()
        loadRecords()
      } else {
        const err = await res.json().catch(() => null)
        alert(err?.detail || 'Unable to revoke permission.')
      }
    } catch (err) {
      alert(err.message || 'Revocation failed.')
    }
  }

  // Safe percentage helper
  function formatPct(val) {
    if (val === null || val === undefined) return '—'
    return `${val > 0 ? '↑' : val < 0 ? '↓' : ''} ${Math.abs(val)}%`
  }

  // Total pages
  const totalRecords = recordsPayload.total || 0
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  // Render subheader & controls according to current view
  const renderHeader = () => {
    if (viewMode === 'overview') {
      return (
        <div className="permissions-header">
          <div className="permissions-title-wrap">
            <h1>Permissions</h1>
            <p>View and manage document permissions across the organization.</p>
          </div>
          <div className="permissions-header-actions">
            <button className="permissions-btn-primary" disabled={exporting} onClick={handleExport} type="button">
              <Icon name="export" />
              {exporting ? 'Exporting…' : 'Export Permissions'}
            </button>
          </div>
        </div>
      )
    }

    let breadcrumbText = 'Total Permission Grants'
    let titleText = 'Total Permission Grants'
    let subtitleText = 'Overview and analysis of all document permission grants across SureDocs.'
    let exportBtnText = 'Export Report'

    if (viewMode === 'active') {
      breadcrumbText = 'Active Grants'
      titleText = 'Active Permission Grants'
      subtitleText = 'View and manage all currently active document permission grants.'
      exportBtnText = 'Export Active Grants'
    } else if (viewMode === 'expired') {
      breadcrumbText = 'Expired Grants'
      titleText = 'Expired Permission Grants'
      subtitleText = 'View and manage all expired document permission grants.'
      exportBtnText = 'Export Expired Grants'
    } else if (viewMode === 'revoked') {
      breadcrumbText = 'Revoked Grants'
      titleText = 'Revoked Permission Grants'
      subtitleText = 'View and manage all revoked document permission grants.'
      exportBtnText = 'Export Revoked Grants'
    }

    return (
      <div>
        <nav aria-label="Breadcrumb" className="permissions-breadcrumb">
          <button onClick={() => navigateToView('overview')} type="button">Permissions</button>
          <span className="permissions-breadcrumb-separator">/</span>
          <span className="permissions-breadcrumb-current">{breadcrumbText}</span>
        </nav>
        <div className="permissions-header">
          <div className="permissions-title-wrap">
            <h1>{titleText}</h1>
            <p>{subtitleText}</p>
          </div>
          <div className="permissions-header-actions">
            <div className="permissions-date-selector" ref={dateMenuRef}>
              <button
                className="permissions-date-btn"
                onClick={() => setDateMenuOpen((prev) => !prev)}
                type="button"
              >
                <Icon className="w-3.5 h-3.5" name="calendar" />
                <span>{DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label || 'Last 30 days'}</span>
                <Icon className="w-3.5 h-3.5 ml-1" name="chevronDown" />
              </button>
              {dateMenuOpen && (
                <div className="permissions-dropdown-menu">
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <button
                      className={`permissions-dropdown-item${dateRange === opt.value ? ' active' : ''}`}
                      key={opt.value}
                      onClick={() => {
                        setDateRange(opt.value)
                        setDateMenuOpen(false)
                        setPage(1)
                      }}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="permissions-btn-primary" disabled={exporting} onClick={handleExport} type="button">
              <Icon name="export" />
              {exporting ? 'Exporting…' : exportBtnText}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render KPI Row
  const renderKpiCards = () => {
    const s = summaryData || {}

    if (viewMode === 'overview') {
      return (
        <div className="permissions-kpi-grid">
          <div className="permissions-kpi-card" onClick={() => navigateToView('total')} role="button" tabIndex={0}>
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-blue">
                <Icon name="fileText" />
              </div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.total_grants?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="permissions-kpi-label">Total Permission Grants</div>
          </div>

          <div className="permissions-kpi-card" onClick={() => navigateToView('active')} role="button" tabIndex={0}>
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-green">
                <Icon name="users" />
              </div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.active_grants?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="permissions-kpi-label">Active Grants</div>
          </div>

          <div className="permissions-kpi-card" onClick={() => navigateToView('expired')} role="button" tabIndex={0}>
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-red">
                <Icon name="clock" />
              </div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.expired_grants?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="permissions-kpi-label">Expired Grants</div>
          </div>

          <div className="permissions-kpi-card" onClick={() => navigateToView('revoked')} role="button" tabIndex={0}>
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-dark">
                <Icon name="ban" />
              </div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.revoked_grants?.toLocaleString() ?? '—'}</div>
            </div>
            <div className="permissions-kpi-label">Revoked Grants</div>
          </div>
        </div>
      )
    }

    if (viewMode === 'total') {
      return (
        <div className="permissions-kpi-grid">
          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-blue">
                <Icon name="fileText" />
              </div>
              <div className="permissions-kpi-label">Total Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.total_grants?.toLocaleString() ?? '—'}</div>
              {s.total_change_pct !== null && s.total_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.total_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">All permission grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-blue" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-green">
                <Icon name="eye" />
              </div>
              <div className="permissions-kpi-label">Read Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.read_grants?.toLocaleString() ?? '—'}</div>
              {s.read_change_pct !== null && s.read_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.read_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.read_pct ?? 0}% of total</div>
            <div className="permissions-kpi-stripe permissions-stripe-green" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-purple">
                <Icon name="download" />
              </div>
              <div className="permissions-kpi-label">Download Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.download_grants?.toLocaleString() ?? '—'}</div>
              {s.download_change_pct !== null && s.download_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.download_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.download_pct ?? 0}% of total</div>
            <div className="permissions-kpi-stripe permissions-stripe-purple" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-orange">
                <Icon name="edit" />
              </div>
              <div className="permissions-kpi-label">Edit Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.edit_grants?.toLocaleString() ?? '—'}</div>
              {s.edit_change_pct !== null && s.edit_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.edit_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.edit_pct ?? 0}% of total</div>
            <div className="permissions-kpi-stripe permissions-stripe-orange" />
          </div>
        </div>
      )
    }

    if (viewMode === 'active') {
      return (
        <div className="permissions-kpi-grid">
          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-blue">
                <Icon name="users" />
              </div>
              <div className="permissions-kpi-label">Total Active Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.active_grants?.toLocaleString() ?? '—'}</div>
              {s.active_change_pct !== null && s.active_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.active_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">Currently valid grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-blue" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-green">
                <Icon name="eye" />
              </div>
              <div className="permissions-kpi-label">Active Read</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.active_read?.toLocaleString() ?? '—'}</div>
              {s.active_read_change_pct !== null && s.active_read_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.active_read_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.active_read_pct ?? 0}% of active grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-green" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-purple">
                <Icon name="download" />
              </div>
              <div className="permissions-kpi-label">Active Download</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.active_download?.toLocaleString() ?? '—'}</div>
              {s.active_download_change_pct !== null && s.active_download_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.active_download_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.active_download_pct ?? 0}% of active grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-purple" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-orange">
                <Icon name="edit" />
              </div>
              <div className="permissions-kpi-label">Active Edit</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.active_edit?.toLocaleString() ?? '—'}</div>
              {s.active_edit_change_pct !== null && s.active_edit_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.active_edit_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.active_edit_pct ?? 0}% of active grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-orange" />
          </div>
        </div>
      )
    }

    if (viewMode === 'expired') {
      return (
        <div className="permissions-kpi-grid">
          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-red">
                <Icon name="clock" />
              </div>
              <div className="permissions-kpi-label">Total Expired Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.expired_grants?.toLocaleString() ?? '—'}</div>
              {s.expired_change_pct !== null && s.expired_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.expired_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">No longer valid grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-red" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-blue">
                <Icon name="eye" />
              </div>
              <div className="permissions-kpi-label">Expired Read</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.expired_read?.toLocaleString() ?? '—'}</div>
              {s.expired_read_change_pct !== null && s.expired_read_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.expired_read_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.expired_read_pct ?? 0}% of expired grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-blue" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-purple">
                <Icon name="download" />
              </div>
              <div className="permissions-kpi-label">Expired Download</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.expired_download?.toLocaleString() ?? '—'}</div>
              {s.expired_download_change_pct !== null && s.expired_download_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.expired_download_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.expired_download_pct ?? 0}% of expired grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-purple" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-orange">
                <Icon name="edit" />
              </div>
              <div className="permissions-kpi-label">Expired Edit</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.expired_edit?.toLocaleString() ?? '—'}</div>
              {s.expired_edit_change_pct !== null && s.expired_edit_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.expired_edit_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.expired_edit_pct ?? 0}% of expired grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-orange" />
          </div>
        </div>
      )
    }

    if (viewMode === 'revoked') {
      return (
        <div className="permissions-kpi-grid">
          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-red">
                <Icon name="ban" />
              </div>
              <div className="permissions-kpi-label">Total Revoked Grants</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.revoked_grants?.toLocaleString() ?? '—'}</div>
              {s.revoked_change_pct !== null && s.revoked_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.revoked_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">Permissions no longer active</div>
            <div className="permissions-kpi-stripe permissions-stripe-red" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-blue">
                <Icon name="eye" />
              </div>
              <div className="permissions-kpi-label">Revoked Read</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.revoked_read?.toLocaleString() ?? '—'}</div>
              {s.revoked_read_change_pct !== null && s.revoked_read_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.revoked_read_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.revoked_read_pct ?? 0}% of revoked grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-blue" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-purple">
                <Icon name="download" />
              </div>
              <div className="permissions-kpi-label">Revoked Download</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.revoked_download?.toLocaleString() ?? '—'}</div>
              {s.revoked_download_change_pct !== null && s.revoked_download_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.revoked_download_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.revoked_download_pct ?? 0}% of revoked grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-purple" />
          </div>

          <div className="permissions-kpi-card">
            <div className="permissions-kpi-header">
              <div className="permissions-kpi-icon-wrap permissions-kpi-icon-orange">
                <Icon name="edit" />
              </div>
              <div className="permissions-kpi-label">Revoked Edit</div>
            </div>
            <div className="permissions-kpi-value-row">
              <div className="permissions-kpi-value">{s.revoked_edit?.toLocaleString() ?? '—'}</div>
              {s.revoked_edit_change_pct !== null && s.revoked_edit_change_pct !== undefined && (
                <span className="permissions-kpi-badge">{formatPct(s.revoked_edit_change_pct)}</span>
              )}
            </div>
            <div className="permissions-kpi-caption">{s.revoked_edit_pct ?? 0}% of revoked grants</div>
            <div className="permissions-kpi-stripe permissions-stripe-orange" />
          </div>
        </div>
      )
    }

    return null
  }

  // Render Charts Section
  const renderAnalyticsSection = () => {
    if (viewMode === 'overview') return null

    const isTotal = viewMode === 'total'
    const isRedTheme = viewMode === 'expired' || viewMode === 'revoked'

    return (
      <div className={isTotal ? 'permissions-analytics-3grid' : 'permissions-analytics-2grid'}>
        {/* Panel A: Trend Multi-line Chart */}
        <div className="permissions-analytics-card">
          <div className="permissions-analytics-card-header">
            <div>
              <div className="permissions-card-title">
                {viewMode === 'total' && 'Permission Grants Trend'}
                {viewMode === 'active' && 'Active Grants Trend'}
                {viewMode === 'expired' && 'Expired Grants Trend'}
                {viewMode === 'revoked' && 'Revoked Grants Trend'}
              </div>
              <div className="permissions-card-subtitle">
                {viewMode === 'total' && 'Number of permission grants created over time.'}
                {viewMode === 'active' && 'Number of active permission grants over time.'}
                {viewMode === 'expired' && 'Number of expired permission grants over time.'}
                {viewMode === 'revoked' && 'Number of revoked permission grants over time.'}
              </div>
            </div>
            {!isRedTheme ? (
              <div className="permissions-chart-legend">
                <span className="permissions-legend-item">
                  <span className="permissions-legend-dot bg-blue-600" /> Read
                </span>
                <span className="permissions-legend-item">
                  <span className="permissions-legend-dot bg-purple-600" /> Download
                </span>
                <span className="permissions-legend-item">
                  <span className="permissions-legend-dot bg-orange-500" /> Edit
                </span>
              </div>
            ) : (
              <div className="permissions-chart-legend">
                <span className="permissions-legend-item">
                  <span className="permissions-legend-dot bg-red-500" /> Total
                </span>
              </div>
            )}
          </div>

          <div style={{ width: '100%', height: 210 }}>
            {trendData.length > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                      fontSize: '11px',
                    }}
                  />
                  {!isRedTheme ? (
                    <>
                      <Line
                        dataKey="read"
                        dot={{ r: 2 }}
                        name="Read"
                        stroke="#1769F5"
                        strokeWidth={2}
                        type="monotone"
                      />
                      <Line
                        dataKey="download"
                        dot={{ r: 2 }}
                        name="Download"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        type="monotone"
                      />
                      <Line
                        dataKey="edit"
                        dot={{ r: 2 }}
                        name="Edit"
                        stroke="#F97316"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </>
                  ) : (
                    <Line
                      dataKey="total"
                      dot={{ r: 2 }}
                      name="Total"
                      stroke="#EF4444"
                      strokeWidth={2}
                      type="monotone"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="permissions-empty-state">
                <p className="permissions-empty-desc">No trend data available for this range.</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel B: Donut Distribution Chart */}
        <div className="permissions-analytics-card">
          <div className="permissions-analytics-card-header">
            <div>
              <div className="permissions-card-title">
                {viewMode === 'total' && 'Grant Distribution by Type'}
                {viewMode === 'active' && 'Active Grants by Type'}
                {viewMode === 'expired' && 'Expired Grants by Type'}
                {viewMode === 'revoked' && 'Revoked Grants by Type'}
              </div>
              <div className="permissions-card-subtitle">
                {viewMode === 'total' && 'Percentage breakdown of permission grants.'}
                {viewMode === 'active' && 'Distribution of currently active permission grants.'}
                {viewMode === 'expired' && 'Distribution of expired permission grants.'}
                {viewMode === 'revoked' && 'Distribution of revoked permission grants.'}
              </div>
            </div>
          </div>

          <div className="permissions-donut-wrap">
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    data={distData?.types || []}
                    dataKey="count"
                    innerRadius={46}
                    nameKey="type"
                    outerRadius={65}
                    paddingAngle={3}
                  >
                    {(distData?.types || []).map((entry) => (
                      <Cell fill={entry.color} key={entry.type} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="permissions-donut-center-metric">
                <div className="permissions-donut-total">{distData?.total?.toLocaleString() ?? 0}</div>
                <div className="permissions-donut-sub">
                  {viewMode === 'total' && 'Total Grants'}
                  {viewMode === 'active' && 'Active Grants'}
                  {viewMode === 'expired' && 'Expired Grants'}
                  {viewMode === 'revoked' && 'Revoked Grants'}
                </div>
              </div>
            </div>

            <div className="permissions-donut-legend-list">
              {(distData?.types || []).map((t) => (
                <div className="permissions-donut-legend-row" key={t.type}>
                  <span className="permissions-donut-row-label">
                    <span className="permissions-legend-dot" style={{ backgroundColor: t.color }} />
                    {t.type}
                  </span>
                  <span className="permissions-donut-row-vals">
                    {t.count}
                    <span className="permissions-donut-row-pct">{t.percentage}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel C: Ranked Top Documents (Only in Total Grants View) */}
        {isTotal && (
          <div className="permissions-analytics-card">
            <div className="permissions-analytics-card-header">
              <div>
                <div className="permissions-card-title">Top Documents by Grants</div>
                <div className="permissions-card-subtitle">Documents with the most permission grants.</div>
              </div>
            </div>

            <div className="permissions-ranked-list">
              {topDocs.length > 0 ? (
                topDocs.map((doc) => {
                  const icon = fileIconType(doc.file_extension, doc.title)
                  return (
                    <div
                      className="permissions-ranked-item cursor-pointer"
                      key={doc.id}
                      onClick={() => handleOpenDocModal(doc.id)}
                    >
                      <div className="permissions-ranked-left">
                        <span className={`permissions-doc-icon ${icon.cls}`}>{icon.label}</span>
                        <span className="permissions-ranked-name" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                      <div className="permissions-ranked-bar-wrap">
                        <div className="permissions-ranked-bar-fill" style={{ width: `${doc.percentage}%` }} />
                      </div>
                      <span className="permissions-ranked-count">{doc.grant_count}</span>
                    </div>
                  )
                })
              ) : (
                <p className="permissions-empty-desc">No document grant rankings found.</p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render Table Filter Controls
  const renderTableControls = () => {
    return (
      <div className="permissions-filter-bar">
        <div className="permissions-search-wrap">
          <Icon name="search" />
          <input
            className="permissions-search-input"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by document name, user, or owner..."
            type="search"
            value={search}
          />
        </div>

        <select
          aria-label="Filter by Document"
          className="permissions-filter-select"
          onChange={(e) => {
            setDocFilter(e.target.value)
            setPage(1)
          }}
          value={docFilter}
        >
          <option value="all">All Documents</option>
          {(recordsPayload.documents || []).map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.name}
            </option>
          ))}
        </select>

        {viewMode === 'overview' && (
          <select
            aria-label="Filter by User"
            className="permissions-filter-select"
            onChange={(e) => {
              setUserFilter(e.target.value)
              setPage(1)
            }}
            value={userFilter}
          >
            <option value="all">All Users</option>
            {(recordsPayload.users || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Filter by Permission Type"
          className="permissions-filter-select"
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
          value={typeFilter}
        >
          <option value="all">All Types</option>
          <option value="Read">Read</option>
          <option value="Download">Download</option>
          <option value="Edit">Edit</option>
        </select>

        {viewMode === 'overview' && (
          <select
            aria-label="Filter by Status"
            className="permissions-filter-select"
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            value={statusFilter}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        )}

        {viewMode !== 'overview' && (
          <select
            aria-label="Sort Order"
            className="permissions-filter-select"
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            value={sortBy}
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            {viewMode === 'active' && <option value="days_left">Sort: Days Left</option>}
            {viewMode === 'expired' && <option value="expired_date">Sort: Expired Date</option>}
            {viewMode === 'revoked' && <option value="revoked_date">Sort: Revoked Date</option>}
            <option value="title">Sort: Document</option>
            <option value="user">Sort: User</option>
          </select>
        )}
      </div>
    )
  }

  // Render Table Columns dynamically matching screenshots
  const renderTableHeaders = () => {
    return (
      <thead>
        <tr>
          <th style={{ width: 36 }}>
            <input
              checked={recordsPayload.items.length > 0 && selectedRows.size === recordsPayload.items.length}
              className="permissions-checkbox"
              onChange={toggleAllRows}
              type="checkbox"
            />
          </th>
          <th>Document</th>
          <th>Grantee (User)</th>
          <th>Permission {viewMode !== 'overview' ? 'Type' : ''}</th>
          <th>{viewMode === 'overview' ? 'Granted By' : 'Granted By (Owner)'}</th>
          <th>Granted At</th>
          <th>{viewMode === 'expired' ? 'Expired At' : 'Expires At'}</th>
          {viewMode === 'overview' && <th>Status</th>}
          {viewMode === 'total' && <th>Status</th>}
          {viewMode === 'active' && <th>Days Left</th>}
          {viewMode === 'expired' && <th>Expired Since</th>}
          {viewMode === 'revoked' && <th>Revoked At</th>}
          {viewMode === 'revoked' && <th>Revoked By</th>}
          {viewMode === 'revoked' && <th>Revocation Reason</th>}
          <th style={{ width: 44, textAlign: 'center' }}>Actions</th>
        </tr>
      </thead>
    )
  }

  // Render Table Rows
  const renderTableBody = () => {
    if (loading) {
      return (
        <tbody>
          <tr>
            <td colSpan={12} style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>
              Loading permissions…
            </td>
          </tr>
        </tbody>
      )
    }

    if (!recordsPayload.items || recordsPayload.items.length === 0) {
      return (
        <tbody>
          <tr>
            <td colSpan={12}>
              <div className="permissions-empty-state">
                <div className="permissions-empty-icon">
                  <Icon name="search" />
                </div>
                <div className="permissions-empty-title">No permission grants found</div>
                <p className="permissions-empty-desc">
                  No records match your selected filters and date range. Try clearing search or choosing another period.
                </p>
              </div>
            </td>
          </tr>
        </tbody>
      )
    }

    return (
      <tbody>
        {recordsPayload.items.map((row) => {
          const isSelected = selectedRows.has(row.id)
          const docIcon = fileIconType(row.file_extension, row.document_filename || row.document_title)
          const grantedDates = formatDateDisplay(row.granted_at)
          const expiresDates = formatDateDisplay(row.expires_at)
          const revokedDates = formatDateDisplay(row.revoked_at)

          // Status & badge styles
          let pillCls = 'permission-pill-read'
          if (row.permission_type?.includes('Download') && row.permission_type?.includes('Edit')) {
            pillCls = 'permission-pill-all'
          } else if (row.permission_type?.includes('Download')) {
            pillCls = 'permission-pill-download'
          } else if (row.permission_type?.includes('Edit')) {
            pillCls = 'permission-pill-edit'
          }

          let statusCls = 'status-pill-active'
          if (row.status === 'Expired') statusCls = 'status-pill-expired'
          else if (row.status === 'Revoked') statusCls = 'status-pill-revoked'

          return (
            <tr className={isSelected ? 'row-selected' : ''} key={row.id}>
              <td>
                <input
                  checked={isSelected}
                  className="permissions-checkbox"
                  onChange={() => toggleRow(row.id)}
                  type="checkbox"
                />
              </td>

              {/* Document */}
              <td>
                <div
                  className="permissions-cell-doc cursor-pointer"
                  onClick={() => handleOpenDocModal(row.document_id)}
                >
                  <span className={`permissions-doc-icon ${docIcon.cls}`}>{docIcon.label}</span>
                  <div>
                    <div className="permissions-doc-title-line" title={row.document_title}>
                      {row.document_title}
                    </div>
                    <div className="permissions-doc-id-line">
                      {row.document_filename || row.category || 'DOC-2024'}
                    </div>
                  </div>
                </div>
              </td>

              {/* Grantee (User) */}
              <td>
                <div className="permissions-cell-user">
                  <span className="permissions-user-avatar">{formatInitials(row.user_name)}</span>
                  <div>
                    <div className="permissions-user-name">{row.user_name}</div>
                    <div className="permissions-user-email">{row.user_email}</div>
                  </div>
                </div>
              </td>

              {/* Permission */}
              <td>
                <span className={`permission-pill ${pillCls}`}>
                  {row.permission_type || 'Read'}
                </span>
              </td>

              {/* Granted By */}
              <td>
                <div className="permissions-cell-grantor">
                  <span className="permissions-grantor-badge">{formatInitials(row.granted_by_name)}</span>
                  <span>{row.granted_by_name || 'System'}</span>
                </div>
              </td>

              {/* Granted At */}
              <td className="permissions-date-cell">
                <div>{grantedDates.date}</div>
                <small>{grantedDates.time}</small>
              </td>

              {/* Expires At / Expired At */}
              <td className="permissions-date-cell">
                <div>{viewMode === 'expired' ? (expiresDates.date || '—') : (expiresDates.date || '—')}</div>
                <small>{expiresDates.time}</small>
              </td>

              {/* Overview & Total: Status */}
              {(viewMode === 'overview' || viewMode === 'total') && (
                <td>
                  <span className={`status-pill ${statusCls}`}>{row.status}</span>
                </td>
              )}

              {/* Active: Days Left */}
              {viewMode === 'active' && (
                <td>
                  <span className={`days-left-pill ${row.days_left !== null && row.days_left <= 10 ? 'warning' : ''}`}>
                    {formatDaysDisplay(row.days_left)}
                  </span>
                </td>
              )}

              {/* Expired: Expired Since */}
              {viewMode === 'expired' && (
                <td>
                  <span className="expired-since-text">
                    {row.expired_since !== null ? `${row.expired_since} days` : '—'}
                  </span>
                </td>
              )}

              {/* Revoked: Revoked At */}
              {viewMode === 'revoked' && (
                <td className="permissions-date-cell">
                  <div>{revokedDates.date}</div>
                  <small>{revokedDates.time}</small>
                </td>
              )}

              {/* Revoked: Revoked By */}
              {viewMode === 'revoked' && (
                <td>
                  <div className="permissions-cell-grantor">
                    <span className="permissions-grantor-badge">{formatInitials(row.revoked_by_name || 'Admin')}</span>
                    <span>{row.revoked_by_name || 'Administrator'}</span>
                  </div>
                </td>
              )}

              {/* Revoked: Revocation Reason */}
              {viewMode === 'revoked' && (
                <td>
                  <span className="reason-badge">
                    {row.revocation_reason || 'Access no longer required'}
                  </span>
                </td>
              )}

              {/* Actions */}
              <td style={{ textAlign: 'center', position: 'relative' }}>
                <button
                  aria-label="Actions"
                  className="permissions-action-btn"
                  onClick={() => setActiveMenuId((prev) => (prev === row.id ? null : row.id))}
                  type="button"
                >
                  <Icon name="more" />
                </button>

                {activeMenuId === row.id && (
                  <div className="permissions-actions-menu">
                    <button
                      className="permissions-menu-item"
                      onClick={() => {
                        setActiveMenuId(null)
                        handleOpenDocModal(row.document_id)
                      }}
                      type="button"
                    >
                      <Icon className="w-3.5 h-3.5" name="fileText" />
                      View Details
                    </button>
                    {row.status === 'Active' && (
                      <button
                        className="permissions-menu-item danger"
                        onClick={() => {
                          setActiveMenuId(null)
                          handleQuickRevoke(row)
                        }}
                        type="button"
                      >
                        <Icon className="w-3.5 h-3.5" name="ban" />
                        Revoke Access
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    )
  }

  // Render pagination controls
  const renderPagination = () => {
    const startRange = totalRecords > 0 ? (page - 1) * pageSize + 1 : 0
    const endRange = Math.min(page * pageSize, totalRecords)

    return (
      <div className="permissions-pagination-row">
        <div>
          Showing {startRange} to {endRange} of {totalRecords.toLocaleString()} {viewMode === 'overview' ? 'permissions' : 'grants'}
        </div>

        <div className="permissions-page-controls">
          <button
            aria-label="Previous page"
            className="permissions-page-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            <Icon className="w-3 h-3" name="chevronLeft" />
          </button>

          {/* Compact page buttons */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
            let pNum = idx + 1
            if (page > 3 && totalPages > 5) {
              pNum = page - 2 + idx
              if (pNum > totalPages) pNum = totalPages - (4 - idx)
            }
            if (pNum <= 0 || pNum > totalPages) return null

            return (
              <button
                className={`permissions-page-btn${page === pNum ? ' active' : ''}`}
                key={pNum}
                onClick={() => setPage(pNum)}
                type="button"
              >
                {pNum}
              </button>
            )
          })}

          {totalPages > 5 && page < totalPages - 2 && (
            <>
              <span className="permissions-page-ellipsis">…</span>
              <button
                className={`permissions-page-btn${page === totalPages ? ' active' : ''}`}
                onClick={() => setPage(totalPages)}
                type="button"
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            aria-label="Next page"
            className="permissions-page-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            type="button"
          >
            <Icon className="w-3 h-3" name="chevronRight" />
          </button>

          {viewMode !== 'overview' && (
            <select
              aria-label="Page size"
              className="permissions-page-size-select"
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              value={pageSize}
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
            </select>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="admin-permissions-workspace">
      {renderHeader()}
      {renderKpiCards()}

      {/* Tabs Row for View 1 (Overview) */}
      {viewMode === 'overview' && (
        <div className="permissions-tabs-bar">
          <button
            className={`permissions-tab-btn${overviewTab === 'all' ? ' active' : ''}`}
            onClick={() => {
              setOverviewTab('all')
              setPage(1)
            }}
            type="button"
          >
            All Permissions
          </button>
          <button
            className={`permissions-tab-btn${overviewTab === 'active' ? ' active' : ''}`}
            onClick={() => {
              setOverviewTab('active')
              setPage(1)
            }}
            type="button"
          >
            Active
          </button>
          <button
            className={`permissions-tab-btn${overviewTab === 'expired' ? ' active' : ''}`}
            onClick={() => {
              setOverviewTab('expired')
              setPage(1)
            }}
            type="button"
          >
            Expired
          </button>
          <button
            className={`permissions-tab-btn${overviewTab === 'revoked' ? ' active' : ''}`}
            onClick={() => {
              setOverviewTab('revoked')
              setPage(1)
            }}
            type="button"
          >
            Revoked
          </button>
        </div>
      )}

      {/* Analytics Section (Panels for Views 2, 3, 4, 5) */}
      {renderAnalyticsSection()}

      {/* Main Table Card */}
      <div className="permissions-table-card">
        {viewMode !== 'overview' && (
          <div className="permissions-table-header-row">
            <div className="permissions-table-title-group">
              <h2>
                {viewMode === 'total' && 'All Permission Grants'}
                {viewMode === 'active' && 'Active Permission Grants'}
                {viewMode === 'expired' && 'Expired Permission Grants'}
                {viewMode === 'revoked' && 'Revoked Permission Grants'}
              </h2>
              <p>
                {viewMode === 'total' && 'View and manage all document permission grants.'}
                {viewMode === 'active' && 'List of all currently active document permission grants.'}
                {viewMode === 'expired' && 'List of all expired document permission grants.'}
                {viewMode === 'revoked' && 'List of all revoked document permission grants.'}
              </p>
            </div>
            {renderTableControls()}
          </div>
        )}

        {viewMode === 'overview' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
            {renderTableControls()}
          </div>
        )}

        <div className="permissions-table-wrap">
          <table className="permissions-table">
            {renderTableHeaders()}
            {renderTableBody()}
          </table>
        </div>

        {renderPagination()}
      </div>

      {modalDocId && (
        <AdminPermissionDocumentModal
          documentId={modalDocId}
          onClose={() => setModalDocId(null)}
          onPermissionUpdated={() => {
            loadSummary()
            loadAnalytics()
            loadRecords()
          }}
        />
      )}
    </div>
  )
}

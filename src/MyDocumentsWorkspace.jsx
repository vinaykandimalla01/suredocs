import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiDelete, apiGet, apiGetFile, apiPatch, apiPut } from './api.js'
import DocumentViewer from './DocumentViewer.jsx'
import './MyDocumentsWorkspace.css'

const PAGE_SIZE = 8
const EMPTY_FILTER = 'all'

function Icon({ name, className = '' }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.5 4.5" /></>,
    upload: <><path d="M12 15V3m-5 5 5-5 5 5" /><path d="M4 14v6h16v-6" /></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7M8 14h8m-8 4h8" /></>,
    database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /><path d="M4 17v2" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    sort: <><path d="m8 7 3-3 3 3M11 4v16m5-3 3 3 3-3m-3 3V4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    overview: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    activity: <><path d="M3 12h4l3-9 4 18 3-9h4" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    tag: <><path d="M20 13 13 20 3 10V4h6z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    folder: <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    calendarClock: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><circle cx="16.5" cy="15.5" r="2.5" /><path d="M16.5 14v1.5l1 0.7" /></>,
    external: <><path d="M14 3h7v7m-1-6-9 9" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    pdf: <><path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v6h6" /></>,
  }
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name] ?? paths.file}</svg>
}

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024
    unit = units[index]
  }
  const rounded = value >= 100 ? Math.round(value) : Number(value.toFixed(1))
  return `${rounded} ${unit}`
}

function dateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function shortModified(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date()
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const relativeDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === today.toDateString()) return `Today, ${timeLabel}`
  if (date.toDateString() === relativeDay.toDateString()) return `Yesterday, ${timeLabel}`
  return dateLabel
}

function titleCase(value = '') {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function permissionKey(permission) {
  if (permission.can_edit) return permission.can_download ? 'read_download_edit' : 'read_edit'
  return permission.can_download ? 'read_download' : 'read'
}

function permissionLabel(permission) {
  return ({
    read: 'Read',
    read_download: 'Read + Download',
    read_edit: 'Read + Edit',
    read_download_edit: 'Read + Download + Edit',
  })[permissionKey(permission)]
}

function documentStatus(document) {
  if (document.classification === 'RESTRICTED') return 'Restricted'
  return titleCase(document.status)
}

function documentStatusTone(document) {
  if (document.classification === 'RESTRICTED' || document.status === 'DELETED') return 'rose'
  if (document.status === 'ACTIVE') return 'green'
  return 'slate'
}

function extensionOf(document) {
  const name = document?.original_filename || document?.title || ''
  return name.split('.').pop()?.toLowerCase() || ''
}

function fileType(document) {
  return extensionOf(document).toUpperCase() || document?.content_type?.split('/').pop()?.toUpperCase() || 'FILE'
}

function sharedActionError(error) {
  if (error.status === 401) return 'Your session has expired. Sign in again to continue.'
  if (error.status === 403 || error.status === 404) return 'Access to this document has expired or been revoked.'
  return error.message || 'The document action could not be completed.'
}

async function downloadSharedFile(document) {
  const file = await apiGetFile(
    `/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(document.current_version_id)}/download`,
  )
  if (file.blob.size === 0) throw new Error('The downloaded document is empty.')
  const url = URL.createObjectURL(file.blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = document.original_filename || document.title
  window.document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fileTone(extension) {
  if (['pdf'].includes(extension)) return 'pdf'
  if (['doc', 'docx'].includes(extension)) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'sheet'
  if (['ppt', 'pptx'].includes(extension)) return 'slides'
  return 'other'
}

function categoryTone(category = '') {
  const value = category.toLowerCase()
  if (value.includes('finance')) return 'amber'
  if (value.includes('design') || value.includes('confidential')) return 'rose'
  if (value.includes('project') || value.includes('planning') || value.includes('client')) return 'blue'
  return 'purple'
}

function uniqueTags(values) {
  const tags = new Map()
  values.filter(Boolean).forEach((tag) => {
    const key = String(tag).trim().toLowerCase()
    if (key && !tags.has(key)) tags.set(key, String(tag))
  })
  return [...tags.values()]
}

function displayAction(action) {
  const labels = {
    DOCUMENT_VIEWED: 'Viewed',
    DOCUMENT_DOWNLOADED: 'Downloaded',
    DOCUMENT_METADATA_UPDATED: 'Metadata Updated',
    DOCUMENT_UPLOADED: 'Uploaded',
    PERMISSION_GRANTED: 'Permission Granted',
    PERMISSION_REVOKED: 'Access Revoked',
  }
  return labels[action] || titleCase(action)
}

function FileBadge({ document, large = false }) {
  const extension = extensionOf(document)
  return <span className={`sd-file-badge is-${fileTone(extension)}${large ? ' sd-file-badge--large' : ''}`}>{fileType(document).slice(0, 4)}</span>
}

function Avatar({ name, email, extra = false }) {
  if (extra) return <span className="sd-avatar sd-avatar--extra">+{extra}</span>
  const label = (name || email || '?').split(/[\s@._-]+/).filter(Boolean).map((part) => part[0]).slice(0, 1).join('').toUpperCase()
  const tone = Math.abs([...(email || name || 'S')].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 6
  return <span aria-label={name || email || 'User'} className={`sd-avatar sd-avatar--${tone}`} title={name || email}>{label}</span>
}

function Badge({ children, tone = 'blue' }) {
  return <span className={`sd-badge sd-badge--${tone}`}>{children}</span>
}

function Dropdown({ label, value, onChange, options, className = '' }) {
  return (
    <label className={`sd-select-wrap ${className}`}>
      <span className="sd-sr-only">{label}</span>
      <select aria-label={label} onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <Icon className="sd-select-chevron" name="chevron" />
    </label>
  )
}

function SearchField({ label, placeholder, value, onChange, className = '' }) {
  return (
    <label className={`sd-search-field ${className}`}>
      <span className="sd-sr-only">{label}</span>
      <Icon className="sd-search-icon" name="search" />
      <input onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type="search" value={value} />
    </label>
  )
}

function ActionMenu({ label, open, onToggle, children, className = '' }) {
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState(null)

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null)
      return undefined
    }

    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const menu = menuRef.current?.getBoundingClientRect()
      if (!anchor || !menu) return
      const gap = 4
      const top = anchor.bottom + menu.height + gap <= window.innerHeight
        ? anchor.bottom + gap
        : Math.max(8, anchor.top - menu.height - gap)
      const left = Math.max(8, Math.min(anchor.right - menu.width, window.innerWidth - menu.width - 8))
      setPosition({ top, left })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  return (
    <div className={`sd-menu-anchor ${className}`} ref={anchorRef}>
      <button aria-expanded={open} aria-label={label} className="sd-more-button" onClick={(event) => { event.stopPropagation(); onToggle() }} type="button"><Icon name="more" /></button>
      {open && createPortal(
        <div
          className="sd-action-menu sd-action-menu--floating"
          onClick={(event) => event.stopPropagation()}
          ref={menuRef}
          role="menu"
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}

function Pagination({ count, page, pageSize, onPageChange, noun }) {
  const pageCount = Math.max(1, Math.ceil(count / pageSize))
  const first = count ? (page - 1) * pageSize + 1 : 0
  const last = Math.min(page * pageSize, count)
  return (
    <footer className="sd-pagination">
      <p>Showing {first}–{last} of {count} {noun}</p>
      <div className="sd-pagination-controls">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} type="button">‹</button>
        {Array.from({ length: Math.min(pageCount, 3) }, (_, index) => {
          const number = Math.max(1, Math.min(page - 1, pageCount - 2)) + index
          return <button aria-current={page === number ? 'page' : undefined} className={page === number ? 'is-current' : ''} key={number} onClick={() => onPageChange(number)} type="button">{number}</button>
        })}
        <button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(Math.min(pageCount, page + 1))} type="button">›</button>
      </div>
    </footer>
  )
}

function roleLabel(value) {
  if (!value) return '—'
  return titleCase(value)
}

function eventDetails(event) {
  const details = event.details || {}
  if (details.description) return details.description
  if (event.action_type === 'DOCUMENT_METADATA_UPDATED') {
    const fields = Array.isArray(details.updated_fields) ? details.updated_fields : []
    return fields.length ? `Updated document ${fields.map((field) => field.replaceAll('_', ' ')).join(', ')}` : 'Updated document metadata'
  }
  if (event.action_type === 'PERMISSION_GRANTED') {
    const permission = details.can_download ? 'download' : 'read'
    return `Granted ${permission} access${event.target_name ? ` to ${event.target_name}` : ''}`
  }
  if (event.action_type === 'PERMISSION_REVOKED') return `Revoked access${event.target_name ? ` from ${event.target_name}` : ''}`
  if (event.action_type === 'DOCUMENT_UPLOADED') return `Uploaded new version${details.version_number ? ` (v${details.version_number})` : ''}`
  if (event.action_type === 'DOCUMENT_VIEWED') return 'Viewed document'
  if (event.action_type === 'DOCUMENT_DOWNLOADED') return 'Downloaded document'
  if (details.reason) return titleCase(details.reason)
  return titleCase(event.action_type)
}

function actionTone(action) {
  if (action.includes('DOWNLOAD')) return 'downloaded'
  if (action.includes('REVOK')) return 'revoked'
  if (action.includes('PERMISSION_GRANTED')) return 'granted'
  if (action.includes('UPDATED') || action.includes('METADATA')) return 'updated'
  if (action.includes('UPLOAD')) return 'uploaded'
  return 'viewed'
}

function DocumentModal({ document: initialDocument, user, onClose, onChanged, onOpenViewer }) {
  const [document, setDocument] = useState(initialDocument)
  const [tab, setTab] = useState('overview')
  const [permissions, setPermissions] = useState([])
  const [audit, setAudit] = useState([])
  const [versions, setVersions] = useState([])
  const [users, setUsers] = useState([])
  const [pendingRequestCount, setPendingRequestCount] = useState(null)
  const [pendingRequestError, setPendingRequestError] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const [permissionError, setPermissionError] = useState('')
  const [auditError, setAuditError] = useState('')
  const [versionsError, setVersionsError] = useState('')
  const [activeMenu, setActiveMenu] = useState('')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(initialDocument.title)
  const [editDescription, setEditDescription] = useState(initialDocument.description || '')
  const [editCategory, setEditCategory] = useState(initialDocument.category || '')
  const [editClassification, setEditClassification] = useState(initialDocument.classification || 'INTERNAL')
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [editingPermission, setEditingPermission] = useState(null)
  const [recipient, setRecipient] = useState('')
  const [canDownload, setCanDownload] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionRole, setPermissionRole] = useState(EMPTY_FILTER)
  const [permissionType, setPermissionType] = useState(EMPTY_FILTER)
  const [permissionStatus, setPermissionStatus] = useState(EMPTY_FILTER)
  const [permissionSort, setPermissionSort] = useState('newest')
  const [auditSearch, setAuditSearch] = useState('')
  const [auditAction, setAuditAction] = useState(EMPTY_FILTER)
  const [auditUser, setAuditUser] = useState(EMPTY_FILTER)
  const [auditStatus, setAuditStatus] = useState(EMPTY_FILTER)
  const [auditRange, setAuditRange] = useState('30')
  const [permissionPage, setPermissionPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)
  const [eventDetailsId, setEventDetailsId] = useState('')
  const modalRef = useRef(null)
  const permissionPageSize = 5
  const auditPageSize = 8

  const loadDetailData = useCallback(async () => {
    setDataLoading(true)
    const [detailResult, permissionsResult, auditResult, versionsResult, requestsResult] = await Promise.allSettled([
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}`),
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}/permissions`),
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}/audit`),
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}/versions`),
      initialDocument.is_owner
        ? apiGet(`/api/access-requests?scope=owned&status=PENDING&document_id=${encodeURIComponent(initialDocument.id)}&page=1&page_size=1`)
        : Promise.resolve(null),
    ])
    if (detailResult.status === 'fulfilled') {
      setDocument(detailResult.value)
      setEditTitle(detailResult.value.title)
      setEditDescription(detailResult.value.description || '')
      setEditCategory(detailResult.value.category || '')
      setEditClassification(detailResult.value.classification || 'INTERNAL')
    }
    if (permissionsResult.status === 'fulfilled') {
      setPermissions(permissionsResult.value.items)
      setPermissionError('')
    } else {
      setPermissions([])
      setPermissionError(permissionsResult.reason?.message || 'Access grants could not be loaded.')
    }
    if (auditResult.status === 'fulfilled') {
      setAudit(auditResult.value.items)
      setAuditError('')
    } else {
      setAudit([])
      setAuditError(auditResult.reason?.message || 'Activity could not be loaded.')
    }
    if (versionsResult.status === 'fulfilled') {
      setVersions(versionsResult.value.items)
      setVersionsError('')
    } else {
      setVersions([])
      setVersionsError(versionsResult.reason?.message || 'Version information could not be loaded.')
    }
    if (requestsResult.status === 'fulfilled') {
      setPendingRequestCount(requestsResult.value?.total ?? 0)
      setPendingRequestError('')
    } else {
      setPendingRequestCount(null)
      setPendingRequestError(requestsResult.reason?.message || 'Pending requests could not be loaded.')
    }
    setDataLoading(false)
  }, [initialDocument.id, initialDocument.is_owner])

  useEffect(() => { loadDetailData() }, [loadDetailData])

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    modalRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.document.addEventListener('keydown', onKeyDown)
    return () => {
      window.document.removeEventListener('keydown', onKeyDown)
      window.document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  useEffect(() => {
    if (tab !== 'shared' || !document.is_owner || users.length) return
    let active = true
    apiGet('/api/documents/users')
      .then((results) => { if (active) setUsers(results) })
      .catch((error) => { if (active) setShareError(error.message || 'User list is unavailable.') })
    return () => { active = false }
  }, [document.is_owner, tab, users.length])

  const now = Date.now()
  const activePermissions = permissions.filter((permission) => permission.is_effective && !permission.revoked_at && permission.user_account_status === 'ACTIVE')
  const revokedPermissions = permissions.filter((permission) => Boolean(permission.revoked_at))
  const permissionCounts = activePermissions.reduce((counts, permission) => {
    counts[permissionKey(permission)] += 1
    return counts
  }, { read: 0, read_download: 0, read_edit: 0, read_download_edit: 0 })
  const permissionOptions = useMemo(() => [
    { value: EMPTY_FILTER, label: 'All Permissions' },
    { value: 'read', label: 'Read' },
    { value: 'read_download', label: 'Read + Download' },
    { value: 'read_edit', label: 'Read + Edit' },
    { value: 'read_download_edit', label: 'Read + Download + Edit' },
  ], [])
  const permissionRoles = useMemo(() => [...new Set(permissions.map((permission) => permission.user_department || permission.user_role || permission.user_job_title).filter(Boolean))].sort(), [permissions])

  const filteredPermissions = useMemo(() => {
    const query = permissionSearch.trim().toLowerCase()
    return permissions.filter((permission) => {
      const status = permission.revoked_at ? 'revoked' : permission.user_account_status !== 'ACTIVE' ? 'inactive' : permission.is_effective ? 'active' : 'expired'
      return (!query || `${permission.user_name} ${permission.user_email} ${permission.user_department || ''} ${permission.user_role || ''} ${permission.user_job_title || ''}`.toLowerCase().includes(query)) &&
        (permissionRole === EMPTY_FILTER || (permission.user_department || permission.user_role || permission.user_job_title) === permissionRole) &&
        (permissionType === EMPTY_FILTER || permissionKey(permission) === permissionType) &&
        (permissionStatus === EMPTY_FILTER || status === permissionStatus)
    }).sort((first, second) => permissionSort === 'newest'
      ? new Date(second.granted_at) - new Date(first.granted_at)
      : new Date(first.granted_at) - new Date(second.granted_at))
  }, [permissionRole, permissionSearch, permissionSort, permissionStatus, permissionType, permissions])
  const visiblePermissions = filteredPermissions.slice((permissionPage - 1) * permissionPageSize, permissionPage * permissionPageSize)

  const auditActions = useMemo(() => [...new Set(audit.map((event) => event.action_type))], [audit])
  const auditUsers = useMemo(() => [...new Set(audit.map((event) => event.actor_name || 'System'))], [audit])
  const filteredAudit = useMemo(() => {
    const query = auditSearch.trim().toLowerCase()
    const cutoff = auditRange === 'all' ? null : now - Number(auditRange) * 24 * 60 * 60 * 1000
    return audit.filter((event) => {
      const actor = event.actor_name || 'System'
      const details = eventDetails(event)
      const status = event.result.toLowerCase()
      return (!query || `${actor} ${event.action_type} ${details}`.toLowerCase().includes(query)) &&
        (auditAction === EMPTY_FILTER || event.action_type === auditAction) &&
        (auditUser === EMPTY_FILTER || actor === auditUser) &&
        (auditStatus === EMPTY_FILTER || status === auditStatus) &&
        (!cutoff || new Date(event.occurred_at).getTime() >= cutoff)
    })
  }, [audit, auditAction, auditRange, auditSearch, auditStatus, auditUser, now])
  const visibleAudit = filteredAudit.slice((auditPage - 1) * auditPageSize, auditPage * auditPageSize)

  async function grantAccess(event) {
    event.preventDefault()
    if (!recipient) return
    setShareBusy(true)
    setShareError('')
    try {
      await apiPut(`/api/documents/${encodeURIComponent(document.id)}/permissions`, {
        user_id: recipient,
        can_view: true,
        can_download: canDownload,
        can_edit: canEdit,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setShareOpen(false)
      setEditingPermission(null)
      setRecipient('')
      setCanDownload(false)
      setCanEdit(false)
      setExpiresAt('')
      await loadDetailData()
      onChanged()
    } catch (error) {
      setShareError(error.message || 'Access could not be saved.')
    } finally {
      setShareBusy(false)
    }
  }

  async function revokeAccess(permission) {
    if (!window.confirm(`Revoke access for ${permission.user_name}?`)) return
    setShareBusy(true)
    setShareError('')
    try {
      await apiDelete(`/api/documents/${encodeURIComponent(document.id)}/permissions/${encodeURIComponent(permission.id)}`)
      setActiveMenu('')
      await loadDetailData()
      onChanged()
    } catch (error) {
      setShareError(error.message || 'Access could not be revoked.')
    } finally {
      setShareBusy(false)
    }
  }

  function startPermissionEdit(permission) {
    setEditingPermission(permission)
    setRecipient(permission.user_id)
    setCanDownload(permission.can_download)
    setCanEdit(permission.can_edit)
    setExpiresAt(permission.expires_at ? new Date(permission.expires_at).toISOString().slice(0, 16) : '')
    setShareOpen(true)
    setActiveMenu('')
  }

  async function saveMetadata(event) {
    event.preventDefault()
    setEditBusy(true)
    setEditError('')
    try {
      const updated = await apiPatch(`/api/documents/${encodeURIComponent(document.id)}`, {
        title: editTitle,
        description: editDescription || null,
        category: editCategory || null,
        classification: editClassification,
      })
      setDocument(updated)
      setEditing(false)
      onChanged(updated)
    } catch (error) {
      setEditError(error.message || 'Document details could not be saved.')
    } finally {
      setEditBusy(false)
    }
  }

  function openEdit() {
    setEditing(true)
    setTab('overview')
    setActiveMenu('')
  }

  function handleBackdrop(event) {
    if (event.target === event.currentTarget) onClose()
  }

  const metadataTags = Array.isArray(document.custom_metadata?.tags)
    ? document.custom_metadata.tags
    : []
  const tags = uniqueTags([document.category, ...metadataTags, document.classification])
  const latestVersion = [...versions].sort((first, second) => second.version_number - first.version_number)[0]
  const uploadedAt = latestVersion?.uploaded_at || document.created_at
  const currentUserOwnsDocument = document.is_owner && document.owner_user_id === user?.id
  const displayName = document.owner_name || '—'
  const displayEmail = currentUserOwnsDocument ? user?.email : document.owner_email

  return (
    <div className="sd-modal-backdrop" onMouseDown={handleBackdrop}>
      <section aria-label={`Document details: ${document.title}`} aria-modal="true" className={`sd-modal sd-modal--${tab}`} ref={modalRef} role="dialog" tabIndex={-1}>
        <header className="sd-modal-header">
          <FileBadge document={document} large />
          <div className="sd-modal-heading-copy">
            <h2 title={document.title}>{document.title}</h2>
            <p>{document.description || ' '}</p>
            <div className="sd-modal-tags">{tags.map((tag) => <Badge key={tag} tone={tag.toLowerCase() === 'confidential' || tag.toLowerCase() === 'restricted' ? 'rose' : 'purple'}>{titleCase(tag)}</Badge>)}</div>
          </div>
          <div className="sd-modal-header-actions">
            <Badge tone={document.status === 'ACTIVE' ? 'green' : 'slate'}><i className="sd-status-dot" />{titleCase(document.status)}</Badge>
            <ActionMenu label="Document actions" open={activeMenu === 'document'} onToggle={() => setActiveMenu((current) => current === 'document' ? '' : 'document')}>
              {document.is_owner && <button onClick={openEdit} role="menuitem" type="button">Edit metadata</button>}
              {document.is_owner && <button onClick={() => { setTab('shared'); setShareOpen(true); setActiveMenu('') }} role="menuitem" type="button">Share document</button>}
              {document.can_view && <button onClick={() => { setActiveMenu(''); onOpenViewer() }} role="menuitem" type="button">Open viewer</button>}
            </ActionMenu>
            <button aria-label="Close document details" className="sd-modal-close" onClick={onClose} type="button"><Icon name="close" /></button>
          </div>
        </header>

        <nav aria-label="Document detail tabs" className="sd-modal-tabs" role="tablist">
          {[
            { id: 'overview', label: 'Overview', icon: 'overview' },
            { id: 'shared', label: 'Shared With', icon: 'users' },
            { id: 'activity', label: 'Activity Logs', icon: 'activity' },
          ].map((item) => <button aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} id={`sd-tab-${item.id}`} key={item.id} onClick={() => { setTab(item.id); setActiveMenu('') }} role="tab" type="button"><Icon name={item.icon} />{item.label}</button>)}
        </nav>

        <div aria-labelledby={`sd-tab-${tab}`} className={`sd-modal-content sd-modal-content--${tab}`} role="tabpanel">
          {tab === 'overview' && (
            <div className="sd-overview-content">
              <section className="sd-detail-card sd-document-information">
                <h3><span className="sd-section-icon"><Icon name="file" /></span>Document Information</h3>
                <div className="sd-information-grid">
                  <div className="sd-information-column">
                    <DetailField icon="file" label="Document Name" value={document.original_filename || document.title} />
                    <DetailField icon="activity" label="Description" value={document.description || '—'} />
                    <DetailField icon="folder" label="Category" value={document.category ? <Badge tone={categoryTone(document.category)}>{titleCase(document.category)}</Badge> : '—'} />
                    <DetailField icon="tag" label="Tags" value={<span className="sd-inline-tags">{tags.length ? tags.map((tag) => <Badge key={tag} tone={tag.toLowerCase() === 'confidential' || tag.toLowerCase() === 'restricted' ? 'rose' : 'blue'}>{titleCase(tag)}</Badge>) : '—'}</span>} />
                  </div>
                  <div className="sd-information-column">
                    <DetailField icon="file" label="Document ID" value={<span className="sd-id-value" title={document.id}>{document.id}</span>} />
                    <DetailField icon="file" label="File Type" value={<Badge tone="rose">{fileType(document)}</Badge>} />
                    <DetailField icon="database" label="File Size" value={formatBytes(document.size_bytes)} />
                    <DetailField icon="database" label="Version" value={document.current_version_number ? `v${document.current_version_number}` : '—'} />
                  </div>
                  <div className="sd-information-column">
                    <DetailField icon="calendar" label="Uploaded On" value={dateTime(uploadedAt)} />
                    <DetailField icon="clock" label="Last Modified" value={dateTime(document.updated_at)} />
                    <DetailField icon="layers" label="Status" value={<span className="sd-detail-status"><i />{titleCase(document.status)}</span>} />
                  </div>
                </div>
              </section>

              <div className="sd-detail-columns">
                <section className="sd-detail-card sd-owner-card">
                  <h3><span className="sd-section-icon"><Icon name="users" /></span>Owner Details</h3>
                  <div className="sd-owner-identity"><Avatar email={displayEmail} name={displayName} /><span className="sd-owner-name"><strong>{displayName}</strong>{currentUserOwnsDocument && <Badge tone="blue">You</Badge>}<small>{displayEmail || '—'}</small></span></div>
                  <div className="sd-owner-property"><Icon name="users" /><span>Department</span><strong>{document.department || (currentUserOwnsDocument ? user?.department : null) || '—'}</strong></div>
                  <div className="sd-owner-property"><Icon name="shield" /><span>Role</span><strong>{currentUserOwnsDocument ? roleLabel(user?.role) : '—'}</strong></div>
                </section>

                <section className="sd-detail-card sd-security-card">
                  <h3><span className="sd-section-icon"><Icon name="shield" /></span>Security &amp; File Details</h3>
                  <div className="sd-security-grid">
                    <DetailField compact icon="lock" label="Encryption" value="Not exposed by API" />
                    <DetailField compact icon="shield" label="Integrity Check" value={document.checksum_sha256 ? <Badge tone="green">Checksum recorded</Badge> : '—'} />
                    <DetailField compact icon="users" label="Sharing Model" value={activePermissions.length ? 'Named users' : 'Owner only'} />
                    <DetailField compact icon="users" label="Active Access Grants" value={`${activePermissions.length} ${activePermissions.length === 1 ? 'user' : 'users'}`} />
                    <DetailField compact icon="clock" label="Pending Requests" value={<span className="sd-unavailable-count">—</span>} />
                    <DetailField compact icon="link" label="Sharing-link status" value="Not available" />
                  </div>
                </section>
              </div>

              {editing && (
                <form className="sd-edit-form" onSubmit={saveMetadata}>
                  <div className="sd-edit-heading"><h3>Edit document metadata</h3><button aria-label="Close edit form" onClick={() => setEditing(false)} type="button"><Icon name="close" /></button></div>
                  <div className="sd-edit-grid">
                    <label>Document name<input maxLength={255} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} /></label>
                    <label>Category<input maxLength={80} onChange={(event) => setEditCategory(event.target.value)} value={editCategory} /></label>
                    <label>Classification<select onChange={(event) => setEditClassification(event.target.value)} value={editClassification}><option value="INTERNAL">Internal</option><option value="CONFIDENTIAL">Confidential</option><option value="RESTRICTED">Restricted</option></select></label>
                    <label>Description<textarea maxLength={10000} onChange={(event) => setEditDescription(event.target.value)} rows={2} value={editDescription} /></label>
                  </div>
                  {editError && <p className="sd-inline-error" role="alert">{editError}</p>}
                  <div className="sd-edit-actions"><button className="sd-secondary-button" onClick={() => setEditing(false)} type="button">Cancel</button><button className="sd-primary-button" disabled={editBusy} type="submit">{editBusy ? 'Saving…' : 'Save changes'}</button></div>
                </form>
              )}

              <section className="sd-retention-strip" aria-label="Audit and retention summary">
                <div className="sd-retention-title"><span className="sd-section-icon"><Icon name="database" /></span><strong>Audit &amp; Retention</strong></div>
                <DetailField icon="calendar" label="Created" value={dateTime(document.created_at).split(',').slice(0, 2).join(',')} />
                <DetailField icon="clock" label="Retention" value="Not configured" />
                <DetailField icon="file" label="Audit logging" value={<span className="sd-detail-status"><i />{auditError ? 'Unavailable' : 'Enabled'}</span>} />
              </section>
              {dataLoading && <p className="sd-modal-loading" role="status">Loading document details…</p>}
            </div>
          )}

          {tab === 'shared' && (
            <div className="sd-shared-content">
              <div className="sd-shared-section-header">
                <div><h3><span className="sd-section-icon"><Icon name="users" /></span>Shared With</h3><p>People and groups who have access to this document.</p></div>
                {document.is_owner && <button className="sd-primary-button" onClick={() => { setEditingPermission(null); setRecipient(''); setCanDownload(false); setCanEdit(false); setExpiresAt(''); setShareOpen((open) => !open); setShareError('') }} type="button"><Icon name="users" />Share Document</button>}
              </div>

              <section aria-label="Access summary" className="sd-share-summary">
                <SummaryCard color="blue" icon="users" title="People with access" value={dataLoading ? '…' : activePermissions.length} detail={`Read ${permissionCounts.read} • Download ${permissionCounts.read_download} • Edit ${permissionCounts.read_edit} • Full ${permissionCounts.read_download_edit}`} />
                <SummaryCard color="amber" icon="clock" title="Pending requests" value={dataLoading ? '…' : document.is_owner ? pendingRequestCount ?? 'Unavailable' : '—'} detail={document.is_owner ? pendingRequestError || 'Awaiting owner review' : 'Visible to the document owner'} />
                <SummaryCard color="rose" icon="users" title="Revoked access" value={dataLoading ? '…' : revokedPermissions.length} detail="Previously revoked users" />
              </section>

              {shareOpen && document.is_owner && (
                <form className="sd-share-form" onSubmit={grantAccess}>
                  <div className="sd-share-form-heading"><strong>{editingPermission ? `Update access for ${editingPermission.user_name}` : 'Share document'}</strong><button aria-label="Close share form" onClick={() => { setShareOpen(false); setEditingPermission(null) }} type="button"><Icon name="close" /></button></div>
                  <div className="sd-share-form-fields">
                    <label>Recipient<select onChange={(event) => setRecipient(event.target.value)} required value={recipient}><option value="">Select an active user</option>{users.map((option) => <option key={option.id} value={option.id}>{option.full_name} ({option.email})</option>)}</select></label>
                    <label>Permission<select onChange={(event) => { setCanDownload(event.target.value.includes('download')); setCanEdit(event.target.value.includes('edit')) }} value={canEdit ? (canDownload ? 'read_download_edit' : 'read_edit') : (canDownload ? 'read_download' : 'read')}><option value="read">Read</option><option value="read_download">Read + Download</option><option value="read_edit">Read + Edit</option><option value="read_download_edit">Read + Download + Edit</option></select></label>
                    <label>Expires on<input onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /></label>
                    <button className="sd-primary-button" disabled={shareBusy || !recipient} type="submit">{shareBusy ? 'Saving…' : editingPermission ? 'Update access' : 'Grant access'}</button>
                  </div>
                  {shareError && <p className="sd-inline-error" role="alert">{shareError}</p>}
                </form>
              )}

              <div className="sd-table-filters sd-shared-filters">
                <SearchField className="sd-shared-search" label="Search access grants" onChange={(value) => { setPermissionSearch(value); setPermissionPage(1) }} placeholder="Search by name, email, or department…" value={permissionSearch} />
                <Dropdown label="Roles" onChange={(value) => { setPermissionRole(value); setPermissionPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Roles' }, ...permissionRoles.map((value) => ({ value, label: titleCase(value) }))]} value={permissionRole} />
                <Dropdown label="Permissions" onChange={(value) => { setPermissionType(value); setPermissionPage(1) }} options={permissionOptions} value={permissionType} />
                <Dropdown label="Grant status" onChange={(value) => { setPermissionStatus(value); setPermissionPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive account' }, { value: 'expired', label: 'Expired' }, { value: 'revoked', label: 'Revoked' }]} value={permissionStatus} />
                <Dropdown label="Grant date order" onChange={setPermissionSort} options={[{ value: 'newest', label: 'Granted On (Newest)' }, { value: 'oldest', label: 'Granted On (Oldest)' }]} value={permissionSort} />
              </div>

              <div className="sd-table-frame sd-permissions-table-frame">
                <table className="sd-data-table sd-permissions-table">
                  <thead><tr><th>Name <Icon name="sort" /></th><th>Role / Department <Icon name="sort" /></th><th>Permission <Icon name="sort" /></th><th>Granted On <Icon name="sort" /></th><th>Expires On <Icon name="sort" /></th><th>Status <Icon name="sort" /></th><th>Actions</th></tr></thead>
                  <tbody>
                    {visiblePermissions.map((permission) => {
                      const permissionStatusValue = permission.revoked_at ? 'Revoked' : permission.user_account_status !== 'ACTIVE' ? 'Inactive account' : permission.is_effective ? 'Active' : 'Expired'
                      return <tr key={permission.id}>
                        <td><span className="sd-person-cell"><Avatar email={permission.user_email} name={permission.user_name} /><span><strong>{permission.user_name}</strong><small>{permission.user_email}</small></span></span></td>
                        <td>{permission.user_department || permission.user_role || permission.user_job_title ? <Badge tone={categoryTone(permission.user_department || permission.user_role || permission.user_job_title)}>{titleCase(permission.user_department || permission.user_role || permission.user_job_title)}</Badge> : <span className="sd-role-unavailable">—</span>}</td>
                        <td><Badge tone={permission.can_edit ? 'amber' : permission.can_download ? 'green' : 'blue'}>{permissionLabel(permission)}</Badge></td>
                        <td>{dateTime(permission.granted_at)}</td>
                        <td>{permission.expires_at ? dateTime(permission.expires_at).split(',').slice(0, 2).join(',') : '—'}</td>
                        <td><Badge tone={permissionStatusValue === 'Active' ? 'green' : permissionStatusValue === 'Revoked' ? 'rose' : permissionStatusValue === 'Inactive account' ? 'amber' : 'slate'}>{permissionStatusValue}</Badge></td>
                        <td><ActionMenu className="sd-row-action-anchor" label={`Actions for ${permission.user_name}`} open={activeMenu === permission.id} onToggle={() => setActiveMenu((current) => current === permission.id ? '' : permission.id)}>
                          {document.is_owner && <button onClick={() => startPermissionEdit(permission)} role="menuitem" type="button">Edit permission</button>}
                          {document.is_owner && !permission.revoked_at && <button className="is-danger" disabled={shareBusy} onClick={() => revokeAccess(permission)} role="menuitem" type="button">Revoke access</button>}
                          {!document.is_owner && <span className="sd-menu-note">No actions available</span>}
                        </ActionMenu></td>
                      </tr>
                    })}
                    {!dataLoading && visiblePermissions.length === 0 && <tr><td className="sd-empty-cell" colSpan={7}>{permissionError || 'No people have access to this document.'}</td></tr>}
                    {dataLoading && <tr><td className="sd-empty-cell" colSpan={7}>Loading access grants…</td></tr>}
                  </tbody>
                </table>
              </div>
              {shareError && !shareOpen && <p className="sd-inline-error" role="alert">{shareError}</p>}
              <Pagination count={filteredPermissions.length} noun="users" onPageChange={setPermissionPage} page={permissionPage} pageSize={permissionPageSize} />
            </div>
          )}

          {tab === 'activity' && (
            <div className="sd-activity-content">
              <div className="sd-table-filters sd-activity-filters">
                <SearchField className="sd-activity-search" label="Search activities" onChange={(value) => { setAuditSearch(value); setAuditPage(1) }} placeholder="Search activities by user, action, or details…" value={auditSearch} />
                <Dropdown label="Activity type" onChange={(value) => { setAuditAction(value); setAuditPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Activities' }, ...auditActions.map((value) => ({ value, label: titleCase(value) }))]} value={auditAction} />
                <Dropdown label="Activity user" onChange={(value) => { setAuditUser(value); setAuditPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Users' }, ...auditUsers.map((value) => ({ value, label: value }))]} value={auditUser} />
                <Dropdown label="Activity status" onChange={(value) => { setAuditStatus(value); setAuditPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Status' }, ...[...new Set(audit.map((event) => event.result.toLowerCase()))].map((value) => ({ value, label: titleCase(value) }))]} value={auditStatus} />
                <Dropdown label="Activity date range" onChange={(value) => { setAuditRange(value); setAuditPage(1) }} options={[{ value: '30', label: 'Last 30 Days' }, { value: '7', label: 'Last 7 Days' }, { value: '90', label: 'Last 90 Days' }, { value: 'all', label: 'All Time' }]} value={auditRange} />
              </div>

              <div className="sd-table-frame sd-activity-table-frame">
                <table className="sd-data-table sd-activity-table">
                  <thead><tr><th>Date &amp; Time <Icon name="sort" /></th><th>User <Icon name="sort" /></th><th>Action <Icon name="sort" /></th><th>Details <Icon name="sort" /></th><th>IP Address <Icon name="sort" /></th><th>Status <Icon name="sort" /></th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleAudit.map((event) => <tr key={event.id}>
                      <td><span className={`sd-event-dot is-${actionTone(event.action_type)}`} />{dateTime(event.occurred_at)}</td>
                      <td><span className="sd-person-cell"><Avatar name={event.actor_name || 'System'} /><span><strong>{event.actor_name || 'System'}</strong><small>{event.actor_user_id === user?.id ? (user?.department || '—') : permissions.find((permission) => permission.user_id === event.actor_user_id)?.user_department || '—'}</small></span></span></td>
                      <td><Badge tone={actionTone(event.action_type)}>{displayAction(event.action_type)}</Badge></td>
                      <td className="sd-activity-details">{eventDetails(event)}</td>
                      <td>{event.ip_address || '—'}</td>
                      <td><Badge tone={event.result.toLowerCase() === 'success' ? 'green' : 'rose'}>{titleCase(event.result)}</Badge></td>
                      <td><ActionMenu className="sd-row-action-anchor" label={`Actions for activity ${dateTime(event.occurred_at)}`} open={activeMenu === event.id} onToggle={() => setActiveMenu((current) => current === event.id ? '' : event.id)}>
                        <button onClick={() => { setEventDetailsId((current) => current === event.id ? '' : event.id); setActiveMenu('') }} role="menuitem" type="button">{eventDetailsId === event.id ? 'Hide details' : 'View details'}</button>
                      </ActionMenu></td>
                    </tr>)}
                    {visibleAudit.map((event) => eventDetailsId === event.id && <tr className="sd-event-detail-row" key={`${event.id}-details`}><td colSpan={7}><strong>Event ID:</strong> {event.id}{event.request_id && <> · <strong>Request ID:</strong> {event.request_id}</>}</td></tr>)}
                    {!dataLoading && visibleAudit.length === 0 && <tr><td className="sd-empty-cell" colSpan={7}>{auditError || 'No activities match these filters.'}</td></tr>}
                    {dataLoading && <tr><td className="sd-empty-cell" colSpan={7}>Loading document activity…</td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination count={filteredAudit.length} noun="activities" onPageChange={setAuditPage} page={auditPage} pageSize={auditPageSize} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DetailField({ icon, label, value, compact = false }) {
  return <div className={`sd-detail-field${compact ? ' sd-detail-field--compact' : ''}`}>
    <Icon name={icon} />
    <span className="sd-detail-field-copy"><small>{label}</small><strong>{value}</strong></span>
  </div>
}

function SummaryCard({ color, icon, title, value, detail }) {
  return <article className={`sd-summary-card sd-summary-card--${color}`}><span className="sd-summary-icon"><Icon name={icon} /></span><span className="sd-summary-copy"><strong>{value}</strong><b>{title}</b><small>{detail}</small></span></article>
}

function modalDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function modalModifiedTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return modalDateTime(value)
}

function SharedDocumentModal({ initialDocument, initialEdit = false, onAccessChanged, onClose, onDocumentChanged, onView }) {
  const [document, setDocument] = useState(initialDocument)
  const [versions, setVersions] = useState([])
  const [activity, setActivity] = useState([])
  const [activityError, setActivityError] = useState('')
  const [actionError, setActionError] = useState('')
  const [tab, setTab] = useState('overview')
  const [dataLoading, setDataLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('')
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(initialDocument.title)
  const [editDescription, setEditDescription] = useState(initialDocument.description || '')
  const [editCategory, setEditCategory] = useState(initialDocument.category || '')
  const [editClassification, setEditClassification] = useState(initialDocument.classification || 'INTERNAL')
  const [editError, setEditError] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [activitySearch, setActivitySearch] = useState('')
  const [activityAction, setActivityAction] = useState(EMPTY_FILTER)
  const [activityUser, setActivityUser] = useState(EMPTY_FILTER)
  const [activityStatus, setActivityStatus] = useState(EMPTY_FILTER)
  const [activityRange, setActivityRange] = useState('30')
  const [activityPage, setActivityPage] = useState(1)
  const [eventDetailsId, setEventDetailsId] = useState('')
  const [activityMenuId, setActivityMenuId] = useState('')
  const modalRef = useRef(null)
  useEffect(() => {
    let active = true
    Promise.allSettled([
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}`),
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}/versions`),
      apiGet(`/api/documents/${encodeURIComponent(initialDocument.id)}/audit`),
    ]).then(([detailResult, versionsResult, auditResult]) => {
      if (!active) return
      if (detailResult.status === 'fulfilled') {
        const detail = detailResult.value
        setDocument(detail)
        setEditTitle(detail.title)
        setEditDescription(detail.description || '')
        setEditCategory(detail.category || '')
        setEditClassification(detail.classification || 'INTERNAL')
        setEditing(Boolean(initialEdit && detail.can_view && detail.can_edit))
      } else {
        setDocument((current) => ({ ...current, can_view: false, can_download: false, can_edit: false }))
        setActionError(sharedActionError(detailResult.reason))
      }
      if (versionsResult.status === 'fulfilled') setVersions(versionsResult.value.items || [])
      if (auditResult.status === 'fulfilled') setActivity(auditResult.value.items || [])
      else setActivityError(auditResult.reason?.message || 'Activity could not be loaded.')
      setDataLoading(false)
    })
    return () => { active = false }
  }, [initialDocument.id, initialEdit])

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    modalRef.current?.focus()
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.document.addEventListener('keydown', onKeyDown)
    return () => {
      window.document.removeEventListener('keydown', onKeyDown)
      window.document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const handleBackdrop = (event) => { if (event.target === event.currentTarget) onClose() }
  const tags = uniqueTags([...(Array.isArray(document.custom_metadata?.tags) ? document.custom_metadata.tags : []), document.classification])
  const latestVersion = [...versions].sort((first, second) => second.version_number - first.version_number)[0]
  const uploadedAt = latestVersion?.uploaded_at || document.created_at
  const hasAvailableVersion = Boolean(
    document.status === 'ACTIVE' &&
    document.current_version_id &&
    document.current_version_status === 'AVAILABLE',
  )
  const canView = Boolean(document.can_view && hasAvailableVersion)
  const canDownload = Boolean(document.can_download && canView)
  const canEdit = Boolean(document.can_edit && canView)
  const category = document.category ? titleCase(document.category) : '—'
  const filteredActivity = activity.filter((event) => {
    const actor = event.actor_name || 'System'
    const details = eventDetails(event)
    const cutoff = activityRange === 'all' ? null : Date.now() - Number(activityRange) * 86400000
    const query = activitySearch.trim().toLowerCase()
    return (!query || `${actor} ${event.action_type} ${details}`.toLowerCase().includes(query)) &&
      (activityAction === EMPTY_FILTER || event.action_type === activityAction) &&
      (activityUser === EMPTY_FILTER || actor === activityUser) &&
      (activityStatus === EMPTY_FILTER || event.result.toLowerCase() === activityStatus) &&
      (!cutoff || new Date(event.occurred_at).getTime() >= cutoff)
  })
  const visibleActivity = filteredActivity.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE)
  const activityActions = [...new Set(activity.map((event) => event.action_type))]
  const activityUsers = [...new Set(activity.map((event) => event.actor_name || 'System'))]
  const activityStatuses = [...new Set(activity.map((event) => event.result.toLowerCase()))]

  async function refreshAccessState() {
    try {
      const latest = await apiGet(`/api/documents/${encodeURIComponent(document.id)}`)
      setDocument(latest)
      setEditTitle(latest.title)
      setEditDescription(latest.description || '')
      setEditCategory(latest.category || '')
      setEditClassification(latest.classification || 'INTERNAL')
      setEditing((current) => current && latest.can_view && latest.can_edit)
    } catch (error) {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        setDocument((current) => ({ ...current, can_view: false, can_download: false, can_edit: false }))
        setEditing(false)
      } else {
        setActionError(sharedActionError(error))
      }
    } finally {
      onAccessChanged()
    }
  }

  async function handleDownload() {
    setActiveMenu('')
    setActionError('')
    try {
      await downloadSharedFile(document)
    } catch (error) {
      setActionError(sharedActionError(error))
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        await refreshAccessState()
      }
    }
  }

  async function saveMetadata(event) {
    event.preventDefault()
    setEditBusy(true)
    setEditError('')
    try {
      const updated = await apiPatch(`/api/documents/${encodeURIComponent(document.id)}`, {
        title: editTitle,
        description: editDescription || null,
        category: editCategory || null,
        classification: editClassification,
      })
      setDocument(updated)
      setEditing(false)
      onDocumentChanged(updated)
    } catch (error) {
      setEditError(sharedActionError(error))
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        await refreshAccessState()
      }
    } finally {
      setEditBusy(false)
    }
  }

  function openEdit() {
    setEditError('')
    setEditing(true)
    setActiveMenu('')
  }

  return (
    <div className="sd-modal-backdrop" onMouseDown={handleBackdrop}>
      <section aria-label={`Shared document details: ${document.title}`} aria-modal="true" className={`sd-modal sd-modal--shared-document sd-modal--shared-document-${tab}`} ref={modalRef} role="dialog" tabIndex={-1}>
        <header className="sd-modal-header">
          <FileBadge document={document} large />
          <div className="sd-modal-heading-copy">
            <h2 title={document.title}>{document.title}</h2>
            <p>{document.description || ' '}</p>
            <div className="sd-modal-tags">
              {document.category && <Badge tone={categoryTone(document.category)}>{category}</Badge>}
              {tags.map((tag) => <Badge key={tag} tone={tag.toLowerCase() === 'confidential' || tag.toLowerCase() === 'restricted' ? 'rose' : 'blue'}>{titleCase(tag)}</Badge>)}
            </div>
          </div>
          <div className="sd-modal-header-actions">
            <Badge tone={document.status === 'ACTIVE' ? 'green' : 'slate'}>{titleCase(document.status)}</Badge>
            <ActionMenu label="Shared document actions" open={activeMenu === 'document'} onToggle={() => setActiveMenu((current) => current === 'document' ? '' : 'document')}>
              {canView && <button onClick={() => onView(document)} role="menuitem" type="button">Read / View Document</button>}
              {canDownload && <button onClick={handleDownload} role="menuitem" type="button">Download Document</button>}
              {canEdit && <button onClick={openEdit} role="menuitem" type="button">Edit Document</button>}
            </ActionMenu>
            <button aria-label="Close document details" className="sd-modal-close" onClick={onClose} type="button"><Icon name="close" /></button>
          </div>
        </header>

        <nav aria-label="Shared document detail tabs" className="sd-modal-tabs" role="tablist">
          {[
            { id: 'overview', label: 'Overview', icon: 'overview' },
            { id: 'activity', label: 'Activity Logs', icon: 'activity' },
          ].map((item) => <button aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} id={`sd-shared-tab-${item.id}`} key={item.id} onClick={() => { setTab(item.id); setActiveMenu('') }} role="tab" type="button"><Icon name={item.icon} />{item.label}</button>)}
        </nav>

        <div aria-labelledby={`sd-shared-tab-${tab}`} className={`sd-modal-content sd-modal-content--shared-document-${tab}`} role="tabpanel">
          {tab === 'overview' && (
            <div className="sd-shared-document-overview">
              <section className="sd-detail-card sd-shared-document-information">
                <h3><span className="sd-section-icon"><Icon name="file" /></span>Document Information</h3>
                <div className="sd-information-grid">
                  <div className="sd-information-column">
                    <DetailField icon="file" label="Document Name" value={document.original_filename || document.title} />
                    <DetailField icon="activity" label="Description" value={document.description || '—'} />
                    <DetailField icon="folder" label="Category" value={document.category ? <Badge tone={categoryTone(document.category)}>{category}</Badge> : '—'} />
                  </div>
                  <div className="sd-information-column">
                    <DetailField icon="file" label="File Type" value={<Badge tone={fileTone(extensionOf(document))}>{fileType(document)}</Badge>} />
                    <DetailField icon="database" label="File Size" value={formatBytes(document.size_bytes)} />
                    <DetailField icon="layers" label="Version" value={document.current_version_number ? `v${document.current_version_number}` : '—'} />
                  </div>
                  <div className="sd-information-column">
                    <DetailField icon="calendar" label="Uploaded On" value={modalDateTime(uploadedAt)} />
                    <DetailField icon="clock" label="Last Modified" value={modalModifiedTime(document.updated_at)} />
                    <DetailField icon="layers" label="Status" value={<span className="sd-detail-status"><i />{titleCase(document.status)}</span>} />
                  </div>
                </div>
              </section>

              <div className="sd-detail-columns sd-shared-document-access-cards">
                <section className="sd-detail-card sd-owner-card">
                  <h3><span className="sd-section-icon"><Icon name="users" /></span>Shared By</h3>
                  <div className="sd-owner-identity"><Avatar email={document.owner_email} name={document.owner_name} /><span className="sd-owner-name"><strong>{document.owner_name || '—'}</strong><small>{document.owner_email || '—'}</small></span></div>
                  <div className="sd-owner-property"><Icon name="users" /><span>Department</span><strong>{document.owner_department || document.department || '—'}</strong></div>
                  <div className="sd-owner-property"><Icon name="shield" /><span>Role</span><strong>{roleLabel(document.owner_role)}</strong></div>
                </section>

                <section className="sd-detail-card sd-shared-my-access-card">
                  <h3><span className="sd-section-icon"><Icon name="link" /></span>My Access &amp; Permissions</h3>
                  <div className="sd-shared-access-grid">
                    <DetailField compact icon="eye" label="Permission" value={<Badge tone={document.can_download ? 'green' : 'blue'}>{permissionLabel(document)}</Badge>} />
                    <DetailField compact icon="calendar" label="Granted On" value={modalDateTime(document.permission_granted_at)} />
                    <DetailField compact icon="clock" label="Expires On" value={document.permission_expires_at ? modalDateTime(document.permission_expires_at).split(',').slice(0, 2).join(',') : 'No expiration'} />
                    <DetailField compact icon="users" label="Granted By" value={<span className="sd-shared-grantor"><strong>{document.permission_granted_by_name || document.owner_name || '—'}</strong><small>{document.permission_granted_by_email || document.owner_email || '—'}</small></span>} />
                  </div>
                </section>
              </div>

              <section className="sd-detail-card sd-shared-document-tags">
                <h3><span className="sd-section-icon"><Icon name="tag" /></span>Tags</h3>
                <div className="sd-shared-document-tag-list">{tags.length ? tags.map((tag) => <Badge key={tag} tone={tag.toLowerCase() === 'confidential' || tag.toLowerCase() === 'restricted' ? 'rose' : 'blue'}>{titleCase(tag)}</Badge>) : <span className="sd-shared-no-tags">No tags</span>}</div>
              </section>
              {editing && canEdit && (
                <form className="sd-edit-form" onSubmit={saveMetadata}>
                  <div className="sd-edit-heading"><h3>Edit document metadata</h3><button aria-label="Close edit form" onClick={() => setEditing(false)} type="button"><Icon name="close" /></button></div>
                  <div className="sd-edit-grid">
                    <label>Document name<input maxLength={255} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} /></label>
                    <label>Category<input maxLength={80} onChange={(event) => setEditCategory(event.target.value)} value={editCategory} /></label>
                    <label>Classification<select onChange={(event) => setEditClassification(event.target.value)} value={editClassification}><option value="INTERNAL">Internal</option><option value="CONFIDENTIAL">Confidential</option><option value="RESTRICTED">Restricted</option></select></label>
                    <label>Description<textarea maxLength={10000} onChange={(event) => setEditDescription(event.target.value)} rows={2} value={editDescription} /></label>
                  </div>
                  {editError && <p className="sd-inline-error" role="alert">{editError}</p>}
                  <div className="sd-edit-actions"><button className="sd-secondary-button" onClick={() => setEditing(false)} type="button">Cancel</button><button className="sd-primary-button" disabled={editBusy} type="submit">{editBusy ? 'Saving…' : 'Save changes'}</button></div>
                </form>
              )}
              {actionError && <p className="sd-inline-error" role="alert">{actionError}</p>}
              {dataLoading && <p className="sd-modal-loading" role="status">Loading document details…</p>}
            </div>
          )}

          {tab === 'activity' && (
            <div className="sd-activity-content sd-shared-document-activity">
              <div className="sd-shared-activity-heading"><h3><span className="sd-section-icon"><Icon name="activity" /></span><span>Activity Logs<small>Track all activities performed on this document.</small></span></h3></div>
              <div className="sd-table-filters sd-activity-filters">
                <SearchField className="sd-activity-search" label="Search activities" onChange={(value) => { setActivitySearch(value); setActivityPage(1) }} placeholder="Search activities by user, action, or details…" value={activitySearch} />
                <Dropdown label="Activity type" onChange={(value) => { setActivityAction(value); setActivityPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Activities' }, ...activityActions.map((value) => ({ value, label: titleCase(value) }))]} value={activityAction} />
                <Dropdown label="Activity user" onChange={(value) => { setActivityUser(value); setActivityPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Users' }, ...activityUsers.map((value) => ({ value, label: value }))]} value={activityUser} />
                <Dropdown label="Activity status" onChange={(value) => { setActivityStatus(value); setActivityPage(1) }} options={[{ value: EMPTY_FILTER, label: 'All Status' }, ...activityStatuses.map((value) => ({ value, label: titleCase(value) }))]} value={activityStatus} />
                <Dropdown label="Activity date range" onChange={(value) => { setActivityRange(value); setActivityPage(1) }} options={[{ value: '30', label: 'Last 30 Days' }, { value: '7', label: 'Last 7 Days' }, { value: '90', label: 'Last 90 Days' }, { value: 'all', label: 'All Time' }]} value={activityRange} />
              </div>
              <div className="sd-table-frame sd-activity-table-frame">
                <table className="sd-data-table sd-activity-table sd-shared-activity-table">
                  <thead><tr><th aria-label="Event indicator" /><th>Date &amp; Time <Icon name="sort" /></th><th>User <Icon name="sort" /></th><th>Action <Icon name="sort" /></th><th>Details <Icon name="sort" /></th><th>IP Address <Icon name="sort" /></th><th>Status <Icon name="sort" /></th><th>Actions</th></tr></thead>
                  <tbody>
                    {visibleActivity.map((event) => <tr key={event.id}>
                      <td><span className={`sd-event-dot is-${actionTone(event.action_type)}`} /></td>
                      <td>{dateTime(event.occurred_at)}</td>
                      <td><span className="sd-person-cell"><Avatar name={event.actor_name || 'System'} /><span><strong>{event.actor_name || 'System'}</strong><small>{event.actor_department || '—'}</small></span></span></td>
                      <td><Badge tone={actionTone(event.action_type)}>{displayAction(event.action_type)}</Badge></td>
                      <td className="sd-activity-details">{eventDetails(event)}</td>
                      <td>{event.ip_address || '—'}</td>
                      <td><Badge tone={event.result.toLowerCase() === 'success' ? 'green' : 'rose'}>{titleCase(event.result)}</Badge></td>
                      <td><ActionMenu className="sd-row-action-anchor" label={`Actions for activity ${modalDateTime(event.occurred_at)}`} open={activityMenuId === event.id} onToggle={() => setActivityMenuId((current) => current === event.id ? '' : event.id)}><button onClick={() => { setEventDetailsId((current) => current === event.id ? '' : event.id); setActivityMenuId('') }} role="menuitem" type="button">{eventDetailsId === event.id ? 'Hide details' : 'View details'}</button></ActionMenu></td>
                    </tr>)}
                    {visibleActivity.map((event) => eventDetailsId === event.id && <tr className="sd-event-detail-row" key={`${event.id}-details`}><td colSpan={8}><strong>Event ID:</strong> {event.id}{event.request_id && <> · <strong>Request ID:</strong> {event.request_id}</>}</td></tr>)}
                    {!dataLoading && visibleActivity.length === 0 && <tr><td className="sd-empty-cell" colSpan={8}>{activityError || 'No activities match these filters.'}</td></tr>}
                    {dataLoading && <tr><td className="sd-empty-cell" colSpan={8}>Loading document activity…</td></tr>}
                  </tbody>
                </table>
              </div>
              <Pagination count={filteredActivity.length} noun="activities" onPageChange={setActivityPage} page={activityPage} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function SharedWithMeWorkspace({ initialDocumentId = null, search: externalSearch, onSearchChange }) {
  const [documents, setDocuments] = useState([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [localSearch, setLocalSearch] = useState('')
  const search = externalSearch ?? localSearch
  const [category, setCategory] = useState(EMPTY_FILTER)
  const [type, setType] = useState(EMPTY_FILTER)
  const [status, setStatus] = useState(EMPTY_FILTER)
  const [modified, setModified] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(initialDocumentId)
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [checkedIds, setCheckedIds] = useState([])
  const [openMenu, setOpenMenu] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [actionError, setActionError] = useState('')
  const [viewerDocument, setViewerDocument] = useState(null)
  const [initialEdit, setInitialEdit] = useState(false)
  const tableCardRef = useRef(null)

  useLayoutEffect(() => {
    function updatePageSize() {
      const top = tableCardRef.current?.getBoundingClientRect().top
      if (top == null) return
      const availableHeight = window.innerHeight - top - 72
      setPageSize(Math.max(PAGE_SIZE, Math.floor(availableHeight / 35)))
    }
    updatePageSize()
    window.addEventListener('resize', updatePageSize)
    return () => window.removeEventListener('resize', updatePageSize)
  }, [])

  useEffect(() => {
    let active = true
    let requestSequence = 0
    function loadDocuments() {
      const sequence = ++requestSequence
      setLoading(true)
      setError('')
      Promise.allSettled([apiGet('/api/documents/shared'), apiGet('/api/documents/summary')]).then(([documentsResult, summaryResult]) => {
        if (!active || sequence !== requestSequence) return
        if (documentsResult.status === 'fulfilled') {
          setDocuments(documentsResult.value.items || [])
          setTotal(documentsResult.value.total ?? documentsResult.value.items?.length ?? 0)
        } else {
          setError(documentsResult.reason?.message || 'Shared documents could not be loaded.')
          setDocuments([])
          setTotal(0)
        }
        setSummary(summaryResult.status === 'fulfilled' ? summaryResult.value : null)
        setLoading(false)
      })
    }
    loadDocuments()
    window.addEventListener('focus', loadDocuments)
    return () => {
      active = false
      window.removeEventListener('focus', loadDocuments)
    }
  }, [refreshKey])

  const categories = useMemo(() => [...new Set(documents.map((document) => document.category).filter(Boolean))].sort(), [documents])
  const types = useMemo(() => [...new Set(documents.map(fileType))].sort(), [documents])
  const statuses = useMemo(() => [...new Set(documents.map(documentStatus))].sort(), [documents])
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    const cutoff = modified === '7' || modified === '30' ? Date.now() - Number(modified) * 86400000 : null
    return documents.filter((document) => {
      const searchable = `${document.title} ${document.original_filename || ''} ${document.owner_name || ''} ${document.owner_email || ''} ${document.owner_department || document.department || ''} ${document.category || ''}`.toLowerCase()
      return (!query || searchable.includes(query)) &&
        (category === EMPTY_FILTER || document.category === category) &&
        (type === EMPTY_FILTER || fileType(document) === type) &&
        (status === EMPTY_FILTER || documentStatus(document) === status) &&
        (!cutoff || new Date(document.updated_at).getTime() >= cutoff)
    }).sort((first, second) => modified === 'oldest'
      ? new Date(first.updated_at) - new Date(second.updated_at)
      : new Date(second.updated_at) - new Date(first.updated_at))
  }, [category, documents, modified, search, status, type])
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / pageSize))
  const visibleDocuments = filteredDocuments.slice((page - 1) * pageSize, page * pageSize)
  const selectedByPage = visibleDocuments.length > 0 && visibleDocuments.every((document) => checkedIds.includes(document.id))
  const selected = documents.find((document) => document.id === selectedId) || selectedDocument

  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  useEffect(() => { if (initialDocumentId) setSelectedId(initialDocumentId) }, [initialDocumentId])
  useEffect(() => {
    function onClick(event) { if (!event.target.closest('.sd-menu-anchor')) setOpenMenu('') }
    window.document.addEventListener('click', onClick)
    return () => window.document.removeEventListener('click', onClick)
  }, [])

  const onCloseModal = useCallback(() => {
    setSelectedId(null)
    setSelectedDocument(null)
    setInitialEdit(false)
    if (new URLSearchParams(window.location.search).has('documentId')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('documentId')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    }
  }, [])

  function changeSearch(value) {
    if (onSearchChange) onSearchChange(value)
    else setLocalSearch(value)
    setPage(1)
  }
  function setFilter(setter, value) { setter(value); setPage(1) }
  function openDetails(document, edit = false) {
    setSelectedDocument(document)
    setSelectedId(document.id)
    setInitialEdit(edit)
    setOpenMenu('')
  }

  function openViewer(document) {
    setOpenMenu('')
    onCloseModal()
    setViewerDocument(document)
  }

  async function handleDownload(document) {
    setActionError('')
    try {
      await downloadSharedFile(document)
    } catch (downloadError) {
      setActionError(sharedActionError(downloadError))
      if (downloadError.status === 403 || downloadError.status === 404) {
        setRefreshKey((value) => value + 1)
      }
    }
  }

  function handleDocumentChanged(updated) {
    setDocuments((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
  }

  return (
    <main className="sd-documents-page sd-shared-documents-page">
      <div className="sd-page-heading">
        <div className="sd-page-heading-copy"><nav aria-label="Breadcrumb" className="sd-breadcrumb"><a href="/employee">Dashboard</a><span>›</span><span>Shared with Me</span></nav><h1>Shared with Me</h1><p>Documents that have been shared with you by other users.</p></div>
      </div>

      {error && <p className="sd-page-alert" role="alert">{error}</p>}
      {actionError && <p className="sd-page-alert" role="alert">{actionError}</p>}

      <section aria-label="Shared document summary" className="sd-document-summary sd-shared-summary">
        <SummaryCard color="purple" icon="file" title="Shared with Me" value={loading ? '…' : total} detail="Documents shared by others" />
        <SummaryCard color="blue" icon="users" title="Shared by Me" value={loading ? '…' : summary?.shared_by_me ?? '—'} detail="Documents you have shared" />
        <SummaryCard color="amber" icon="clock" title="Pending Access Requests" value="—" detail="Awaiting your response" />
      </section>

      <section aria-label="Shared document filters" className="sd-table-filters sd-document-filters sd-shared-document-filters">
        <SearchField className="sd-document-search" label="Search shared documents" onChange={changeSearch} placeholder="Search documents, owners, or keywords…" value={search} />
        <Dropdown label="Category" onChange={(value) => setFilter(setCategory, value)} options={[{ value: EMPTY_FILTER, label: 'All Categories' }, ...categories.map((value) => ({ value, label: titleCase(value) }))]} value={category} />
        <Dropdown label="File type" onChange={(value) => setFilter(setType, value)} options={[{ value: EMPTY_FILTER, label: 'All File Types' }, ...types.map((value) => ({ value, label: value }))]} value={type} />
        <Dropdown label="Document status" onChange={(value) => setFilter(setStatus, value)} options={[{ value: EMPTY_FILTER, label: 'All Status' }, ...statuses.map((value) => ({ value, label: value }))]} value={status} />
        <Dropdown label="Modified date" onChange={(value) => setFilter(setModified, value)} options={[{ value: 'newest', label: 'Last Modified' }, { value: 'oldest', label: 'Oldest First' }, { value: '7', label: 'Last 7 Days' }, { value: '30', label: 'Last 30 Days' }]} value={modified} />
      </section>

      <section aria-label="Documents shared with me" className="sd-documents-table-card sd-shared-documents-table-card" ref={tableCardRef}>
        <div className="sd-documents-table-scroll">
          <table className="sd-data-table sd-shared-documents-table">
            <thead><tr>
              <th className="sd-checkbox-cell"><input aria-label="Select all shared documents on this page" checked={selectedByPage} onChange={() => setCheckedIds((current) => selectedByPage ? current.filter((id) => !visibleDocuments.some((document) => document.id === id)) : [...new Set([...current, ...visibleDocuments.map((document) => document.id)])])} type="checkbox" /></th>
              <th>Name <Icon name="sort" /></th><th>Shared By <Icon name="sort" /></th><th>Category <Icon name="sort" /></th><th>Type <Icon name="sort" /></th><th>Size <Icon name="sort" /></th><th>Last Modified <Icon name="sort" /></th><th>Status <Icon name="sort" /></th><th>My Permission <Icon name="sort" /></th><th>Actions</th>
            </tr></thead>
            <tbody>
              {visibleDocuments.map((document) => <tr key={document.id} onClick={() => openDetails(document)}>
                <td className="sd-checkbox-cell"><input aria-label={`Select ${document.title}`} checked={checkedIds.includes(document.id)} onClick={(event) => event.stopPropagation()} onChange={() => setCheckedIds((current) => current.includes(document.id) ? current.filter((id) => id !== document.id) : [...current, document.id])} type="checkbox" /></td>
                <td><button className="sd-document-name-button" onClick={() => openDetails(document)} type="button"><FileBadge document={document} /><span><strong>{document.original_filename || document.title}</strong><small>{document.description || document.title}</small></span></button></td>
                <td><span className="sd-person-cell sd-shared-owner-cell"><Avatar email={document.owner_email} name={document.owner_name} /><span><strong>{document.owner_name || '—'}</strong><small>{document.owner_department || document.department || '—'}</small></span></span></td>
                <td>{document.category ? <Badge tone={categoryTone(document.category)}>{titleCase(document.category)}</Badge> : '—'}</td>
                <td><Badge tone={fileTone(extensionOf(document))}>{fileType(document)}</Badge></td>
                <td>{formatBytes(document.size_bytes)}</td>
                <td>{shortModified(document.updated_at)}</td>
                <td><Badge tone={document.status === 'ACTIVE' ? 'green' : documentStatusTone(document)}>{titleCase(document.status)}</Badge></td>
                <td><Badge tone={document.can_download ? 'green' : 'blue'}>{permissionLabel(document)}</Badge></td>
                <td><ActionMenu className="sd-row-action-anchor" label={`Actions for ${document.title}`} open={openMenu === document.id} onToggle={() => setOpenMenu((current) => current === document.id ? '' : document.id)}>
                  <button onClick={(event) => { event.stopPropagation(); openDetails(document) }} role="menuitem" type="button">Document details</button>
                  {document.can_view && document.status === 'ACTIVE' && document.current_version_status === 'AVAILABLE' && <button onClick={(event) => { event.stopPropagation(); openViewer(document) }} role="menuitem" type="button">Read / View Document</button>}
                  {document.can_view && document.can_download && document.status === 'ACTIVE' && document.current_version_status === 'AVAILABLE' && <button onClick={(event) => { event.stopPropagation(); setOpenMenu(''); handleDownload(document) }} role="menuitem" type="button">Download Document</button>}
                  {document.can_view && document.can_edit && document.status === 'ACTIVE' && document.current_version_status === 'AVAILABLE' && <button onClick={(event) => { event.stopPropagation(); openDetails(document, true) }} role="menuitem" type="button">Edit Document</button>}
                </ActionMenu></td>
              </tr>)}
              {!loading && visibleDocuments.length === 0 && <tr><td className="sd-empty-cell" colSpan={10}>{error || (search || category !== EMPTY_FILTER || type !== EMPTY_FILTER || status !== EMPTY_FILTER ? 'No documents match these filters.' : 'No documents have been shared with you.')}</td></tr>}
              {loading && <tr><td className="sd-empty-cell" colSpan={10}>Loading shared documents…</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination count={filteredDocuments.length} noun="documents" onPageChange={setPage} page={page} pageSize={pageSize} />
      </section>

      {selected && <SharedDocumentModal initialDocument={selected} initialEdit={initialEdit} key={selected.id} onAccessChanged={() => setRefreshKey((value) => value + 1)} onClose={onCloseModal} onDocumentChanged={handleDocumentChanged} onView={openViewer} />}
      {viewerDocument && <DocumentViewer document={viewerDocument} onClose={() => setViewerDocument(null)} />}
    </main>
  )
}

export default function MyDocumentsWorkspace({ user, initialDocumentId = null, search: externalSearch, onSearchChange }) {
  const [documents, setDocuments] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingRequestCount, setPendingRequestCount] = useState(null)
  const [pendingRequestLoading, setPendingRequestLoading] = useState(true)
  const [pendingRequestError, setPendingRequestError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [localSearch, setLocalSearch] = useState('')
  const search = externalSearch ?? localSearch
  const [category, setCategory] = useState(EMPTY_FILTER)
  const [type, setType] = useState(EMPTY_FILTER)
  const [status, setStatus] = useState(EMPTY_FILTER)
  const [modified, setModified] = useState('newest')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState(initialDocumentId)
  const [checkedIds, setCheckedIds] = useState([])
  const [openMenu, setOpenMenu] = useState('')
  const [grantMap, setGrantMap] = useState({})
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const pageSize = PAGE_SIZE

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    apiGet('/api/documents/my')
      .then((response) => {
        if (!active) return
        setDocuments(response.items || [])
        setTotal(response.total ?? response.items?.length ?? 0)
      })
      .catch((requestError) => { if (active) setError(requestError.message || 'Documents could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshKey])

  useEffect(() => {
    let active = true
    let requestSequence = 0
    async function loadPendingRequestCount() {
      const currentRequest = ++requestSequence
      try {
        const summary = await apiGet('/api/access-requests/summary')
        if (!active || currentRequest !== requestSequence) return
        setPendingRequestCount(summary.pending_requests)
        setPendingRequestError('')
      } catch (requestError) {
        if (!active || currentRequest !== requestSequence) return
        setPendingRequestCount(null)
        setPendingRequestError(requestError.message || 'Request data unavailable')
      } finally {
        if (active && currentRequest === requestSequence) setPendingRequestLoading(false)
      }
    }
    loadPendingRequestCount()
    window.addEventListener('suredocs:access-requests-updated', loadPendingRequestCount)
    return () => {
      active = false
      window.removeEventListener('suredocs:access-requests-updated', loadPendingRequestCount)
    }
  }, [])

  const categories = useMemo(() => [...new Set(documents.map((document) => document.category).filter(Boolean))].sort(), [documents])
  const types = useMemo(() => [...new Set(documents.map(fileType))].sort(), [documents])
  const statuses = useMemo(() => [...new Set(documents.map(documentStatus))].sort(), [documents])
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    const cutoff = modified === '7' || modified === '30' ? Date.now() - Number(modified) * 86400000 : null
    return documents.filter((document) => {
      const searchable = `${document.title} ${document.original_filename || ''} ${document.owner_name || ''} ${document.category || ''}`.toLowerCase()
      return (!query || searchable.includes(query)) &&
        (category === EMPTY_FILTER || document.category === category) &&
        (type === EMPTY_FILTER || fileType(document) === type) &&
        (status === EMPTY_FILTER || documentStatus(document) === status) &&
        (!cutoff || new Date(document.updated_at).getTime() >= cutoff)
    }).sort((first, second) => modified === 'oldest'
      ? new Date(first.updated_at) - new Date(second.updated_at)
      : new Date(second.updated_at) - new Date(first.updated_at))
  }, [category, documents, modified, search, status, type])
  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / pageSize))
  const visibleDocuments = filteredDocuments.slice((page - 1) * pageSize, page * pageSize)
  const pageIds = visibleDocuments.map((document) => document.id).join('|')
  const storageBytes = documents.reduce((sum, document) => sum + (document.size_bytes || 0), 0)
  const selected = documents.find((document) => document.id === selectedId) || selectedDocument

  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  useEffect(() => {
    if (!pageIds) return undefined
    let active = true
    const ids = pageIds.split('|').filter((id) => grantMap[id] === undefined)
    if (!ids.length) return undefined
    Promise.all(ids.map(async (id) => {
      try {
        const response = await apiGet(`/api/documents/${encodeURIComponent(id)}/permissions`)
        return [id, response.items]
      } catch {
        return [id, null]
      }
    })).then((entries) => {
      if (active) setGrantMap((current) => ({ ...current, ...Object.fromEntries(entries) }))
    })
    return () => { active = false }
  }, [grantMap, pageIds])

  useEffect(() => {
    if (initialDocumentId) setSelectedId(initialDocumentId)
  }, [initialDocumentId])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDocument(null)
      setViewerOpen(false)
      return undefined
    }
    let active = true
    setSelectedDocument(documents.find((document) => document.id === selectedId) || null)
    apiGet(`/api/documents/${encodeURIComponent(selectedId)}`)
      .then((document) => { if (active) setSelectedDocument(document) })
      .catch(() => {})
    return () => { active = false }
  }, [documents, selectedId])

  useEffect(() => {
    function onClick(event) {
      if (!event.target.closest('.sd-menu-anchor')) setOpenMenu('')
    }
    window.document.addEventListener('click', onClick)
    return () => window.document.removeEventListener('click', onClick)
  }, [])

  const onCloseModal = useCallback(() => {
    setSelectedId(null)
    setSelectedDocument(null)
    setViewerOpen(false)
    if (new URLSearchParams(window.location.search).has('documentId')) {
      const url = new URL(window.location.href)
      url.searchParams.delete('documentId')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    }
  }, [])

  function openDetails(document) {
    setSelectedDocument(document)
    setSelectedId(document.id)
    setViewerOpen(false)
    setOpenMenu('')
  }

  function toggleSelection(documentId) {
    setCheckedIds((current) => current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId])
  }

  function setFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  function changeSearch(value) {
    if (onSearchChange) onSearchChange(value)
    else setLocalSearch(value)
    setPage(1)
  }

  function handleDocumentChanged(updated) {
    if (updated?.id) setDocuments((items) => items.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
    setRefreshKey((value) => value + 1)
  }

  const selectedByPage = visibleDocuments.length > 0 && visibleDocuments.every((document) => checkedIds.includes(document.id))

  return (
    <main className="sd-documents-page">
      <div className="sd-page-heading">
        <div className="sd-page-heading-copy"><nav aria-label="Breadcrumb" className="sd-breadcrumb"><a href="/employee">Dashboard</a><span>›</span><span>My Documents</span></nav><h1>My Documents</h1><p>Manage, organize, and control access to your documents.</p></div>
        <a className="sd-primary-button sd-upload-button" href="/employee/upload"><Icon name="upload" />Upload Document</a>
      </div>

      {error && <p className="sd-page-alert" role="alert">{error}</p>}

      <section aria-label="Document summary" className="sd-document-summary">
        <SummaryCard color="purple" icon="file" title="Total Documents" value={loading ? '…' : total} detail="Owned by you" />
        <SummaryCard color="green" icon="database" title="Total Storage Used" value={loading ? '…' : formatBytes(storageBytes)} detail="Across all documents" />
        <SummaryCard color="amber" icon="clock" title="Pending Requests" value={pendingRequestLoading ? '…' : pendingRequestCount ?? '—'} detail={pendingRequestError || 'Awaiting your review'} />
      </section>

      <section aria-label="Document filters" className="sd-table-filters sd-document-filters">
        <SearchField className="sd-document-search" label="Search your documents" onChange={changeSearch} placeholder="Search documents by name, category, or keyword…" value={search} />
        <Dropdown label="Category" onChange={(value) => setFilter(setCategory, value)} options={[{ value: EMPTY_FILTER, label: 'All Categories' }, ...categories.map((value) => ({ value, label: titleCase(value) }))]} value={category} />
        <Dropdown label="File type" onChange={(value) => setFilter(setType, value)} options={[{ value: EMPTY_FILTER, label: 'All File Types' }, ...types.map((value) => ({ value, label: value }))]} value={type} />
        <Dropdown label="Document status" onChange={(value) => setFilter(setStatus, value)} options={[{ value: EMPTY_FILTER, label: 'All Status' }, ...statuses.map((value) => ({ value, label: value }))]} value={status} />
        <Dropdown label="Modified date" onChange={(value) => setFilter(setModified, value)} options={[{ value: 'newest', label: 'Last Modified' }, { value: 'oldest', label: 'Oldest First' }, { value: '7', label: 'Last 7 Days' }, { value: '30', label: 'Last 30 Days' }]} value={modified} />
      </section>

      {checkedIds.length > 0 && <div className="sd-selection-bar"><span>{checkedIds.length} selected</span><button onClick={() => setCheckedIds([])} type="button">Clear selection</button></div>}

      <section aria-label="My documents" className="sd-documents-table-card">
        <div className="sd-documents-table-scroll">
          <table className="sd-data-table sd-documents-table">
            <thead><tr>
              <th className="sd-checkbox-cell"><input aria-label="Select all documents on this page" checked={selectedByPage} onChange={() => setCheckedIds((current) => selectedByPage ? current.filter((id) => !visibleDocuments.some((document) => document.id === id)) : [...new Set([...current, ...visibleDocuments.map((document) => document.id)])])} type="checkbox" /></th>
              <th>Name <Icon name="sort" /></th><th>Category <Icon name="sort" /></th><th>Type <Icon name="sort" /></th><th>Size <Icon name="sort" /></th><th>Last Modified <Icon name="sort" /></th><th>Status <Icon name="sort" /></th><th>Access Grants <Icon name="sort" /></th><th>Actions</th>
            </tr></thead>
            <tbody>
              {visibleDocuments.map((document) => {
                const grants = grantMap[document.id]
                const activeGrants = Array.isArray(grants) ? grants.filter((grant) => grant.is_effective && !grant.revoked_at) : []
                return <tr key={document.id}>
                  <td className="sd-checkbox-cell"><input aria-label={`Select ${document.title}`} checked={checkedIds.includes(document.id)} onChange={() => toggleSelection(document.id)} type="checkbox" /></td>
                  <td><button className="sd-document-name-button" onClick={() => openDetails(document)} type="button"><FileBadge document={document} /><span><strong>{document.title}</strong><small>{document.description || document.original_filename || ' '}</small></span></button></td>
                  <td>{document.category ? <Badge tone={categoryTone(document.category)}>{titleCase(document.category)}</Badge> : '—'}</td>
                  <td><Badge tone={fileTone(extensionOf(document))}>{fileType(document)}</Badge></td>
                  <td>{formatBytes(document.size_bytes)}</td>
                  <td>{shortModified(document.updated_at)}</td>
                  <td><Badge tone={documentStatusTone(document)}>{documentStatus(document)}</Badge></td>
                  <td><span aria-label={`${activeGrants.length} active access grants`} className="sd-avatar-stack">{activeGrants.slice(0, 2).map((grant) => <Avatar email={grant.user_email} key={grant.id} name={grant.user_name} />)}{activeGrants.length > 2 && <Avatar extra={activeGrants.length - 2} />}{grants === null && <span className="sd-no-grants" title="Access grants unavailable">—</span>}</span></td>
                  <td><ActionMenu className="sd-row-action-anchor" label={`Actions for ${document.title}`} open={openMenu === document.id} onToggle={() => setOpenMenu((current) => current === document.id ? '' : document.id)}>
                    <button onClick={() => openDetails(document)} role="menuitem" type="button">Document details</button>
                    {document.can_view && document.current_version_id && <button onClick={() => { openDetails(document); setViewerOpen(true) }} role="menuitem" type="button">View document</button>}
                    {document.can_download && document.current_version_id && <a href={`/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(document.current_version_id)}/download`} role="menuitem">Download document</a>}
                  </ActionMenu></td>
                </tr>
              })}
              {!loading && visibleDocuments.length === 0 && <tr><td className="sd-empty-cell" colSpan={9}>{search || category !== EMPTY_FILTER || type !== EMPTY_FILTER || status !== EMPTY_FILTER ? 'No documents match these filters.' : 'No documents have been uploaded yet.'}</td></tr>}
              {loading && <tr><td className="sd-empty-cell" colSpan={9}>Loading documents…</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination count={filteredDocuments.length} noun="documents" onPageChange={setPage} page={page} pageSize={pageSize} />
      </section>

      {selected && <DocumentModal document={selected} key={selected.id} onChanged={handleDocumentChanged} onClose={onCloseModal} onOpenViewer={() => setViewerOpen(true)} user={user} />}
      {selected && viewerOpen && selected.can_view && <DocumentViewer document={selected} onClose={() => setViewerOpen(false)} />}
    </main>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiDelete, apiGet, apiPatch, apiPost } from './api.js'
import DocumentViewer from './DocumentViewer.jsx'
import './SharingPermissionsPage.css'

const PAGE_SIZE = 7
const PERMISSIONS = [
  { key: 'read', label: 'Read', detail: 'Can view the document', can_view: true, can_download: false, can_edit: false },
  { key: 'read_download', label: 'Read + Download', detail: 'Can view and download the document', can_view: true, can_download: true, can_edit: false },
  { key: 'edit', label: 'Edit', detail: 'Can view and edit supported document details', can_view: true, can_download: false, can_edit: true },
  { key: 'read_download_edit', label: 'Read + Download + Edit', detail: 'Can view, download, and edit supported document details', can_view: true, can_download: true, can_edit: true },
]

function Icon({ name, className = '' }) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.5 4.5" /></>,
    file: <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M13 2v7h7M8 14h8m-8 4h8" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    denied: <><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    plus: <path d="M12 5v14M5 12h14" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-.8L19.4 7.8a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    sort: <><path d="m8 7 3-3 3 3M11 4v16m5-3 3 3 3-3m-3 3V4" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  }
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">{paths[name] ?? paths.file}</svg>
}

function requestMessage(error, fallback) {
  if (error?.status === 401) return 'Your session has expired. Sign in again to manage sharing.'
  if (error?.status === 403) return 'You do not have permission to manage this document.'
  if (error?.status === 404) return 'The document or permission record is no longer available.'
  if (error?.status >= 500) return 'SureDocs could not complete this request. Try again shortly.'
  return error?.message || fallback
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Never'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-US', includeTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
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
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?'
}

function permissionFor(record) {
  return PERMISSIONS.find((item) => item.key === record.permission_key)
    || PERMISSIONS.find((item) => item.can_edit === record.can_edit && item.can_download === record.can_download)
    || PERMISSIONS[0]
}

function permissionKeyFromGrant(grant) {
  if (grant.can_edit) return grant.can_download ? 'read_download_edit' : 'edit'
  return grant.can_download ? 'read_download' : 'read'
}

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function Avatar({ name }) {
  return <span aria-hidden="true" className="sharing-avatar">{initials(name)}</span>
}

function FileIcon({ filename, large = false }) {
  const source = String(filename || '')
  const extension = source.includes('.') ? source.split('.').pop()?.toLowerCase() || '' : ''
  const tone = ['pdf'].includes(extension) ? 'pdf'
    : ['doc', 'docx', 'rtf'].includes(extension) ? 'word'
      : ['xls', 'xlsx', 'csv'].includes(extension) ? 'sheet'
        : ['ppt', 'pptx'].includes(extension) ? 'slides'
          : ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension) ? 'image'
            : ['txt', 'md', 'adoc'].includes(extension) ? 'text' : 'other'
  const label = extension ? extension.slice(0, 4).toUpperCase() : ''
  return <span aria-label={label ? `${label} file` : 'Document file'} className={`sharing-file-icon is-${tone}${large ? ' is-large' : ''}`}>{label || <Icon name="file" />}</span>
}

function PermissionBadge({ record }) {
  const permission = permissionFor(record)
  const tone = record.can_edit ? 'violet' : record.can_download ? 'blue' : 'sky'
  return <span className={`sharing-permission-badge is-${tone}`}><Icon name={record.can_edit ? 'edit' : record.can_download ? 'download' : 'eye'} />{permission.label}</span>
}

function StatusBadge({ status }) {
  const labels = { active: 'Active', expiring_soon: 'Expiring Soon', expired: 'Expired', revoked: 'Revoked', denied: 'Denied', unavailable: 'Unavailable' }
  return <span className={`sharing-status-badge is-${status}`}>{labels[status] || status}</span>
}

function RemotePicker({ endpoint, placeholder, label, value, displayValue, onSelect, onClear, disabledIds = [], compact = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      const join = endpoint.includes('?') ? '&' : '?'
      apiGet(`${endpoint}${join}search=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((result) => setItems(Array.isArray(result) ? result : result.items || []))
        .catch((requestError) => {
          if (requestError.name !== 'AbortError') setError(requestMessage(requestError, 'Options could not be loaded.'))
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [endpoint, open, query])

  function select(item) {
    onSelect(item)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={`sharing-picker${compact ? ' is-compact' : ''}`}>
      <div className="sharing-picker-input-wrap">
        <Icon className="sharing-picker-search" name="search" />
        <input
          aria-label={label}
          autoComplete="off"
          onChange={(event) => { setQuery(event.target.value); setOpen(true); onClear?.() }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={value && !open ? displayValue : placeholder}
          ref={inputRef}
          value={open ? query : ''}
        />
        {value && <button aria-label={`Clear ${label.toLowerCase()}`} className="sharing-picker-clear" onClick={() => { onClear?.(); setQuery(''); setOpen(false) }} type="button"><Icon name="close" /></button>}
        <button aria-label={`Show ${label.toLowerCase()} options`} className="sharing-picker-chevron" onClick={() => setOpen((current) => !current)} type="button"><Icon name="chevron" /></button>
      </div>
      {open && (
        <>
          <button aria-label="Close picker" className="sharing-picker-dismiss" onClick={() => setOpen(false)} tabIndex={-1} type="button" />
          <div className="sharing-picker-options" role="listbox">
            {loading && <p className="sharing-picker-message">Searching…</p>}
            {error && <p className="sharing-picker-message is-error">{error}</p>}
            {!loading && !error && items.length === 0 && <p className="sharing-picker-message">No matching results.</p>}
            {!loading && items.map((item) => {
              const person = item.full_name !== undefined
              const id = item.id
              const disabled = disabledIds.includes(id)
              return (
                <button
                  aria-disabled={disabled}
                  className="sharing-picker-option"
                  key={id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => !disabled && select(item)}
                  role="option"
                  type="button"
                >
                  {person ? <Avatar name={item.full_name} /> : <FileIcon filename={item.original_filename || item.title} />}
                  <span className="sharing-picker-option-copy">
                    <strong>{person ? item.full_name : item.title}</strong>
                    <small>{person ? item.email : `${item.id} · ${item.owner_name} · ${formatBytes(item.size_bytes)}`}</small>
                  </span>
                  {disabled && <small className="sharing-picker-existing">Already has access</small>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Modal({ title, subtitle, onClose, size = 'wide', children }) {
  return createPortal(
    <div className="sharing-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section aria-label={title} aria-modal="true" className={`sharing-modal is-${size}`} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }} role="dialog" tabIndex={-1}>
        <header className="sharing-modal-header">
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button aria-label={`Close ${title}`} className="sharing-icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  )
}

function ConfirmModal({ title, message, busy, onCancel, onConfirm, confirmLabel }) {
  return (
    <div className="sharing-confirm-backdrop">
      <section aria-label={title} aria-modal="true" className="sharing-confirm-modal" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel() } }} role="dialog" tabIndex={-1}>
        <span className="sharing-confirm-icon"><Icon name="trash" /></span>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="sharing-modal-actions"><button className="sharing-button is-secondary" disabled={busy} onClick={onCancel} type="button">Cancel</button><button className="sharing-button is-danger" disabled={busy} onClick={onConfirm} type="button">{busy ? 'Working…' : confirmLabel}</button></div>
      </section>
    </div>
  )
}

function ActionMenu({ record, onManage, onView }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState(null)
  useEffect(() => {
    if (!open) return undefined
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 94), left: Math.max(8, rect.right - 174) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const close = (event) => {
      if (!anchorRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); document.removeEventListener('mousedown', close) }
  }, [open])
  return (
    <>
      <button aria-expanded={open} aria-label={`Actions for ${record.document_title}`} className="sharing-icon-button sharing-row-action" onClick={(event) => { event.stopPropagation(); setOpen((current) => !current) }} ref={anchorRef} type="button"><Icon name="more" /></button>
      {open && position && createPortal(
        <div className="sharing-action-menu" onClick={(event) => event.stopPropagation()} ref={menuRef} style={{ left: position.left, top: position.top }}>
          <button onClick={() => { setOpen(false); onManage() }} type="button">Manage Access</button>
          <button onClick={() => { setOpen(false); onView() }} type="button">View Document</button>
        </div>,
        document.body,
      )}
    </>
  )
}

function GrantActionMenu({ grant, onDetails, onRevoke }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState(null)
  useEffect(() => {
    if (!open) return undefined
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 94), left: Math.max(8, rect.right - 174) })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const close = (event) => {
      if (!anchorRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); document.removeEventListener('mousedown', close) }
  }, [open])
  return <>
    <button aria-expanded={open} aria-label={`Actions for ${grant.user_name}`} className="sharing-icon-button" onClick={(event) => { event.stopPropagation(); setOpen((current) => !current) }} ref={anchorRef} type="button"><Icon name="more" /></button>
    {open && position && createPortal(<div className="sharing-action-menu" ref={menuRef} style={{ left: position.left, top: position.top }}>
      <button onClick={() => { setOpen(false); onDetails() }} type="button">View Grant Details</button>
      {!grant.revoked_at && <button onClick={() => { setOpen(false); onRevoke() }} type="button">Revoke Access</button>}
    </div>, document.body)}
  </>
}

function PermissionSelect({ value, onChange, ariaLabel }) {
  return (
    <select aria-label={ariaLabel} className="sharing-permission-select" onChange={(event) => onChange(event.target.value)} value={value}>
      {PERMISSIONS.map((permission) => <option key={permission.key} value={permission.key}>{permission.label}</option>)}
    </select>
  )
}

function ShareDocumentModal({ onClose, onShared }) {
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [permission, setPermission] = useState('read')
  const [setExpiry, setSetExpiry] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [message, setMessage] = useState('')
  const [existingUsers, setExistingUsers] = useState([])
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingAccessError, setExistingAccessError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedPermission = PERMISSIONS.find((item) => item.key === permission) || PERMISSIONS[0]

  useEffect(() => {
    if (!selectedDocument) {
      setExistingUsers([])
      setExistingLoading(false)
      setExistingAccessError('')
      return undefined
    }
    const controller = new AbortController()
    setExistingLoading(true)
    setExistingAccessError('')
    apiGet(`/api/documents/${encodeURIComponent(selectedDocument.id)}/permissions`, { signal: controller.signal })
      .then((response) => setExistingUsers(response.items.filter((grant) => grant.is_effective).map((grant) => grant.user_id)))
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          const messageValue = requestMessage(requestError, 'Current access could not be checked.')
          setExistingAccessError(messageValue)
          setError(messageValue)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setExistingLoading(false) })
    return () => controller.abort()
  }, [selectedDocument])

  function addRecipient(user) {
    setSelectedUsers((current) => current.some((item) => item.id === user.id) ? current : [...current, user])
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!selectedDocument || !selectedUsers.length) {
      setError('Choose a document and at least one recipient.')
      return
    }
    if (existingLoading) {
      setError('Wait while current access is checked.')
      return
    }
    if (existingAccessError) {
      setError(existingAccessError)
      return
    }
    if (setExpiry && !expiresAt) {
      setError('Choose an expiration date and time.')
      return
    }
    const expiry = setExpiry ? new Date(expiresAt) : null
    if (expiry && (Number.isNaN(expiry.getTime()) || expiry <= new Date())) {
      setError('Expiration must be in the future.')
      return
    }
    setBusy(true)
    try {
      await apiPost('/api/sharing/grants', {
        document_id: selectedDocument.id,
        recipient_ids: selectedUsers.map((user) => user.id),
        can_view: selectedPermission.can_view,
        can_download: selectedPermission.can_download,
        can_edit: selectedPermission.can_edit,
        expires_at: expiry?.toISOString() ?? null,
        message: message.trim() || null,
      })
      onShared(selectedUsers.length)
    } catch (requestError) {
      setError(requestMessage(requestError, 'The document could not be shared.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} size="share" subtitle="Choose a document and grant access to specific people." title="Share a Document">
      <form className="sharing-modal-content" onSubmit={submit}>
        <label className="sharing-field"><span>Select Document <b>*</b></span>
          <RemotePicker displayValue={selectedDocument?.title} endpoint="/api/sharing/documents?shared_only=false&page=1&page_size=10" label="Search owned documents" onClear={() => setSelectedDocument(null)} onSelect={(item) => { setSelectedDocument(item); setSelectedUsers([]); setError('') }} placeholder="Search owned documents…" value={selectedDocument} />
          {selectedDocument && <span className="sharing-selected-document"><FileIcon filename={selectedDocument.original_filename || selectedDocument.title} /><span><strong>{selectedDocument.title}</strong><small>{selectedDocument.id} · Owned by you · {formatBytes(selectedDocument.size_bytes)}</small></span><button aria-label="Change document" onClick={() => setSelectedDocument(null)} type="button">Change</button></span>}
        </label>
        <div className="sharing-field">
          <span>Add People <b>*</b></span>
          <RemotePicker disabledIds={[...existingUsers, ...selectedUsers.map((item) => item.id)]} endpoint="/api/documents/users" label="Search people by name or email" onSelect={addRecipient} placeholder="Search by name or email…" />
          <div className="sharing-selected-people">
            {selectedUsers.map((user) => <span className="sharing-person-chip" key={user.id}><Avatar name={user.full_name} /><span><strong>{user.full_name}</strong><small>{user.email}</small></span><button aria-label={`Remove ${user.full_name}`} onClick={() => setSelectedUsers((current) => current.filter((item) => item.id !== user.id))} type="button"><Icon name="close" /></button></span>)}
            {selectedDocument && existingUsers.length > 0 && <small className="sharing-field-hint">People who already have access are excluded. Manage their grants in Manage Access.</small>}
          </div>
        </div>
        <div className="sharing-form-grid">
          <label className="sharing-field"><span>Permission <b>*</b></span><PermissionSelect ariaLabel="Permission for selected people" onChange={setPermission} value={permission} /><small className="sharing-field-hint">{selectedPermission.detail}</small></label>
          <fieldset className="sharing-field sharing-expiry"><legend>Expiration (optional)</legend>
            <label className="sharing-radio-line"><input checked={!setExpiry} onChange={() => setSetExpiry(false)} type="radio" /> Does not expire</label>
            <label className="sharing-radio-line"><input checked={setExpiry} onChange={() => setSetExpiry(true)} type="radio" /> Set expiration date</label>
            {setExpiry && <input aria-label="Permission expiration" className="sharing-input" onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} />}
            <small className="sharing-field-hint">Access can be changed or revoked at any time.</small>
          </fieldset>
        </div>
        <label className="sharing-field"><span>Message (optional)</span><textarea maxLength={500} onChange={(event) => setMessage(event.target.value)} placeholder="Add a short note for recipients…" rows={3} value={message} /><small className="sharing-character-count">{message.length}/500 · Included in SureDocs notifications</small></label>
        {error && <p className="sharing-inline-error" role="alert">{error}</p>}
        <footer className="sharing-modal-footer"><button className="sharing-button is-secondary" disabled={busy} onClick={onClose} type="button">Cancel</button><button className="sharing-button is-primary" disabled={busy || existingLoading || Boolean(existingAccessError) || !selectedDocument || selectedUsers.length === 0} type="submit"><Icon name="users" />{busy ? 'Sharing…' : 'Share Document'}</button></footer>
      </form>
    </Modal>
  )
}

function ManageAccessModal({ documentId, onClose, onChanged, onView }) {
  const [document, setDocument] = useState(null)
  const [grants, setGrants] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [message, setMessage] = useState('')
  const [adding, setAdding] = useState(false)
  const [newRecipient, setNewRecipient] = useState(null)
  const [newPermission, setNewPermission] = useState('read')
  const [newExpiryEnabled, setNewExpiryEnabled] = useState(false)
  const [newExpiry, setNewExpiry] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [detailGrant, setDetailGrant] = useState(null)

  const reload = useCallback(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const [documentResponse, permissionResponse] = await Promise.all([
        apiGet(`/api/documents/${encodeURIComponent(documentId)}`, { signal }),
        apiGet(`/api/documents/${encodeURIComponent(documentId)}/permissions`, { signal }),
      ])
      setDocument(documentResponse)
      setGrants(permissionResponse.items)
      setDrafts(Object.fromEntries(permissionResponse.items.map((grant) => [grant.id, {
        permission: permissionKeyFromGrant(grant),
        expires: localDateTime(grant.expires_at),
      }])))
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestMessage(requestError, 'Access details could not be loaded.'))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  const dirty = useMemo(() => grants.flatMap((grant) => {
    const draft = drafts[grant.id]
    if (!draft || grant.revoked_at) return []
    const permission = PERMISSIONS.find((item) => item.key === draft.permission) || PERMISSIONS[0]
    const expectedExpiry = grant.expires_at ? new Date(grant.expires_at).getTime() : null
    const currentExpiry = draft.expires ? new Date(draft.expires).getTime() : null
    if (permissionKeyFromGrant(grant) === draft.permission && expectedExpiry === currentExpiry) return []
    return [{ grant, draft, permission }]
  }), [drafts, grants])

  async function saveChanges() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await apiPatch(`/api/sharing/documents/${encodeURIComponent(documentId)}/grants`, {
        updates: dirty.map(({ grant, draft, permission }) => ({
          permission_id: grant.id,
          expected_updated_at: grant.updated_at,
          can_view: permission.can_view,
          can_download: permission.can_download,
          can_edit: permission.can_edit,
          expires_at: draft.expires ? new Date(draft.expires).toISOString() : null,
        })),
        message: message.trim() || null,
      })
      await reload()
      setMessage('')
      setSuccess('Access changes saved.')
      onChanged()
    } catch (requestError) {
      setError(requestMessage(requestError, 'Changes could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  async function addPerson() {
    if (!newRecipient) { setError('Choose an active person to add.'); return }
    if (newExpiryEnabled && !newExpiry) { setError('Choose an expiration date and time.'); return }
    const expiration = newExpiryEnabled ? new Date(newExpiry) : null
    if (expiration && (Number.isNaN(expiration.getTime()) || expiration <= new Date())) { setError('Expiration must be in the future.'); return }
    const permission = PERMISSIONS.find((item) => item.key === newPermission) || PERMISSIONS[0]
    setBusy(true)
    setError('')
    try {
      await apiPost('/api/sharing/grants', {
        document_id: documentId,
        recipient_ids: [newRecipient.id],
        can_view: permission.can_view,
        can_download: permission.can_download,
        can_edit: permission.can_edit,
        expires_at: expiration?.toISOString() ?? null,
      })
      setAdding(false)
      setNewRecipient(null)
      setNewPermission('read')
      setNewExpiryEnabled(false)
      setNewExpiry('')
      await reload()
      setSuccess('Access granted.')
      onChanged()
    } catch (requestError) {
      setError(requestMessage(requestError, 'Access could not be granted.'))
    } finally {
      setBusy(false)
    }
  }

  async function revokeGrant(grant) {
    setBusy(true)
    setError('')
    try {
      await apiDelete(`/api/documents/${encodeURIComponent(documentId)}/permissions/${encodeURIComponent(grant.id)}`)
      setConfirm(null)
      await reload()
      setSuccess(`Access revoked for ${grant.user_name}.`)
      onChanged()
    } catch (requestError) {
      setError(requestMessage(requestError, 'Access could not be revoked.'))
    } finally {
      setBusy(false)
    }
  }

  async function revokeAll() {
    setBusy(true)
    setError('')
    try {
      const response = await apiPost(`/api/sharing/documents/${encodeURIComponent(documentId)}/revoke-all`, {})
      setConfirm(null)
      await reload()
      setSuccess(`${response.revoked_count} access grant${response.revoked_count === 1 ? '' : 's'} revoked.`)
      onChanged()
    } catch (requestError) {
      setError(requestMessage(requestError, 'Access could not be revoked.'))
    } finally {
      setBusy(false)
    }
  }

  const activeRecipientIds = grants.filter((grant) => grant.is_effective).map((grant) => grant.user_id)

  return (
    <Modal onClose={onClose} size="manage" subtitle="Manage all users who have access to this document. Update permissions or revoke access for any user." title="Manage Access">
      <div className="sharing-modal-content">
        {loading ? <div className="sharing-loading">Loading current access…</div> : error && !document ? <div className="sharing-empty-state is-error" role="alert">{error}<button className="sharing-button is-secondary" onClick={() => reload()} type="button">Retry</button></div> : <>
          {document && <section className="sharing-document-summary">
            <FileIcon filename={document.original_filename || document.title} large />
            <div className="sharing-document-summary-main"><h3>{document.title}</h3><small>{document.id}</small><div className="sharing-document-meta"><span><b>Owner</b>{document.owner_name}</span><span><b>Category</b>{document.category || '—'}</span><span><b>File Size</b>{formatBytes(document.size_bytes)}</span><span><b>Uploaded On</b>{formatDate(document.created_at, true)}</span></div></div>
            <button className="sharing-button is-outline" disabled={document.status !== 'ACTIVE' || !document.can_view} onClick={() => onView(document.id)} type="button"><Icon name="eye" />View Document</button>
          </section>}
          <div className="sharing-access-heading"><div><h3>People with Access ({grants.length})</h3><p>Each person has an independent permission grant.</p></div><button className="sharing-button is-outline" onClick={() => { setAdding((current) => !current); setError('') }} type="button"><Icon name="plus" />Add People</button></div>
          {adding && <section className="sharing-add-person">
            <div className="sharing-add-person-picker"><RemotePicker disabledIds={activeRecipientIds} endpoint="/api/documents/users" label="Search active people" onSelect={setNewRecipient} placeholder="Search by name or email…" value={newRecipient} displayValue={newRecipient?.full_name} onClear={() => setNewRecipient(null)} />{newRecipient && <span className="sharing-selected-document"><Avatar name={newRecipient.full_name} /><span><strong>{newRecipient.full_name}</strong><small>{newRecipient.email}</small></span><button onClick={() => setNewRecipient(null)} type="button">Change</button></span>}</div>
            <PermissionSelect ariaLabel="New recipient permission" onChange={setNewPermission} value={newPermission} />
            <button className="sharing-button is-primary" disabled={busy || !newRecipient} onClick={addPerson} type="button">Grant Access</button>
            <label className="sharing-radio-line"><input checked={newExpiryEnabled} onChange={(event) => setNewExpiryEnabled(event.target.checked)} type="checkbox" /> Set expiration</label>
            {newExpiryEnabled && <input aria-label="New grant expiration" className="sharing-input" onChange={(event) => setNewExpiry(event.target.value)} type="datetime-local" value={newExpiry} />}
          </section>}
          <div className="sharing-access-table-wrap"><table className="sharing-access-table"><thead><tr><th>Recipient</th><th>Permission</th><th>Granted On</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {grants.map((grant) => {
              const draft = drafts[grant.id] || { permission: permissionKeyFromGrant(grant), expires: localDateTime(grant.expires_at) }
              const statusValue = grant.status || (grant.revoked_at ? 'revoked' : grant.is_effective ? 'active' : 'expired')
              return <tr key={grant.id}>
                <td><div className="sharing-recipient"><Avatar name={grant.user_name} /><span><strong>{grant.user_name}</strong><small>{grant.user_email}</small></span></div></td>
                <td><PermissionSelect ariaLabel={`Permission for ${grant.user_name}`} onChange={(next) => setDrafts((current) => ({ ...current, [grant.id]: { ...draft, permission: next } }))} value={draft.permission} /></td>
                <td>{formatDate(grant.granted_at, true)}</td>
                <td><input aria-label={`Expiration for ${grant.user_name}`} className="sharing-inline-date" disabled={Boolean(grant.revoked_at)} onChange={(event) => setDrafts((current) => ({ ...current, [grant.id]: { ...draft, expires: event.target.value } }))} type="datetime-local" value={draft.expires} /></td>
                <td><StatusBadge status={statusValue} /></td>
                <td><div className="sharing-access-actions"><GrantActionMenu grant={grant} onDetails={() => setDetailGrant(grant)} onRevoke={() => setConfirm({ kind: 'one', grant })} /></div></td>
              </tr>
            })}
            {grants.length === 0 && <tr><td className="sharing-empty-cell" colSpan={6}>No permission grants have been created for this document.</td></tr>}
          </tbody></table></div>
          <label className="sharing-field sharing-notes"><span>Message for people whose access changes (optional)</span><textarea maxLength={500} onChange={(event) => setMessage(event.target.value)} placeholder="Add a note to the SureDocs notification…" rows={2} value={message} /><small className="sharing-character-count">{message.length}/500</small></label>
        </>}
        {error && document && <p className="sharing-inline-error" role="alert">{error}</p>}
        {success && <p className="sharing-inline-success" role="status">{success}</p>}
        {!loading && document && <footer className="sharing-modal-footer sharing-manage-footer"><button className="sharing-button is-danger-outline" disabled={busy || !grants.some((grant) => grant.is_effective)} onClick={() => setConfirm({ kind: 'all' })} type="button"><Icon name="trash" />Revoke All Access</button><div className="sharing-modal-actions"><button className="sharing-button is-secondary" disabled={busy} onClick={onClose} type="button">Close</button><button className="sharing-button is-primary" disabled={busy || dirty.length === 0} onClick={saveChanges} type="button">{busy ? 'Saving…' : 'Save Changes'}</button></div></footer>}
      </div>
      {confirm && <ConfirmModal
        busy={busy}
        confirmLabel={confirm.kind === 'all' ? 'Revoke All Access' : 'Revoke Access'}
        message={confirm.kind === 'all'
          ? `This will revoke all active grants for ${document?.title || 'this document'}. The owner will keep ownership.`
          : `This will revoke ${confirm.grant.user_name}'s access to ${document?.title || 'this document'}.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm.kind === 'all' ? revokeAll() : revokeGrant(confirm.grant)}
        title={confirm.kind === 'all' ? 'Revoke all access?' : 'Revoke access?'}
      />}
      {detailGrant && <div className="sharing-confirm-backdrop"><section aria-label="Grant details" aria-modal="true" className="sharing-confirm-modal" role="dialog"><button aria-label="Close grant details" className="sharing-icon-button sharing-detail-close" onClick={() => setDetailGrant(null)} type="button"><Icon name="close" /></button><h3>Grant Details</h3><dl className="sharing-detail-list"><dt>Recipient</dt><dd>{detailGrant.user_name} · {detailGrant.user_email}</dd><dt>Granted by</dt><dd>{detailGrant.granted_by_name}</dd><dt>Granted on</dt><dd>{formatDate(detailGrant.granted_at, true)}</dd><dt>Updated</dt><dd>{formatDate(detailGrant.updated_at, true)}</dd><dt>Permission</dt><dd>{permissionFor(detailGrant).label}</dd></dl></section></div>}
    </Modal>
  )
}

export default function SharingPermissionsPage() {
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [documentFilter, setDocumentFilter] = useState(null)
  const [permissionFilter, setPermissionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateWindow, setDateWindow] = useState('30d')
  const [sortBy, setSortBy] = useState('event_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [refreshToken, setRefreshToken] = useState(0)
  const [shareOpen, setShareOpen] = useState(false)
  const [manageDocumentId, setManageDocumentId] = useState('')
  const [previewDocument, setPreviewDocument] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [notice, setNotice] = useState('')
  const previewController = useRef(null)

  useEffect(() => () => previewController.current?.abort(), [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    apiGet('/api/sharing/summary', { signal: controller.signal })
      .then((value) => { setSummary(value); setSummaryError('') })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setSummaryError(requestMessage(requestError, 'Sharing metrics could not be loaded.')) })
    return () => controller.abort()
  }, [refreshToken])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      search,
      date_window: dateWindow,
      sort_by: sortBy,
      sort_order: sortOrder,
      page: String(page),
      page_size: String(PAGE_SIZE),
    })
    if (documentFilter) query.set('document_id', documentFilter.id)
    if (permissionFilter) query.set('permission', permissionFilter)
    if (statusFilter) query.set('status', statusFilter)
    setLoading(true)
    setError('')
    apiGet(`/api/sharing/grants?${query}`, { signal: controller.signal })
      .then((response) => { setRows(response.items); setTotal(response.total) })
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(requestMessage(requestError, 'Shared permission records could not be loaded.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [dateWindow, documentFilter, page, permissionFilter, refreshToken, search, sortBy, sortOrder, statusFilter])

  function updateFilter(update) {
    update()
    setPage(1)
  }

  function changeSort(column) {
    if (sortBy === column) setSortOrder((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortBy(column); setSortOrder(column === 'event_at' ? 'desc' : 'asc') }
  }

  async function viewDocument(documentId) {
    previewController.current?.abort()
    const controller = new AbortController()
    previewController.current = controller
    setPreviewError('')
    try {
      const document = await apiGet(`/api/documents/${encodeURIComponent(documentId)}`, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (!document.can_view) throw Object.assign(new Error('Document access is no longer available.'), { status: 403 })
      setPreviewDocument(document)
    } catch (requestError) {
      if (requestError.name === 'AbortError') return
      setPreviewError(requestMessage(requestError, 'The document could not be opened.'))
      setNotice(requestMessage(requestError, 'The document could not be opened.'))
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const first = Math.max(1, Math.min(page - 2, totalPages - 4))
    return first + index
  })

  function refresh() {
    setRefreshToken((current) => current + 1)
  }

  return (
    <main className="sharing-page">
      <div className="sharing-page-heading"><div><div className="sharing-breadcrumb">Dashboard <span>›</span> Sharing &amp; Permissions</div><h1>Sharing &amp; Permissions</h1><p>Manage access you've granted to other people for documents you own.</p></div><button className="sharing-button is-primary" onClick={() => { setNotice(''); setShareOpen(true) }} type="button"><Icon name="users" />Share a Document</button></div>
      {notice && <p className="sharing-notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')} type="button"><Icon name="close" /></button></p>}
      {summaryError && <p className="sharing-inline-error" role="alert">{summaryError}<button className="sharing-link-button" onClick={() => setRefreshToken((current) => current + 1)} type="button">Retry</button></p>}
      <section aria-label="Permission summary" className="sharing-kpis">
        <article className="sharing-kpi is-blue"><span className="sharing-kpi-icon"><Icon name="users" /></span><div><span className="sharing-kpi-label">Active Grants</span><strong>{summary ? summary.active_grants : summaryError ? '—' : '…'}</strong><small>Currently active sharing grants</small></div></article>
        <article className="sharing-kpi is-amber"><span className="sharing-kpi-icon"><Icon name="clock" /></span><div><span className="sharing-kpi-label">Expiring Soon</span><strong>{summary ? summary.expiring_soon : summaryError ? '—' : '…'}</strong><small>Grants expiring in next 30 days</small></div></article>
        <article className="sharing-kpi is-red"><span className="sharing-kpi-icon"><Icon name="denied" /></span><div><span className="sharing-kpi-label">Denied Permissions</span><strong>{summary ? summary.denied_permissions : summaryError ? '—' : '…'}</strong><small>Denied or revoked in last {summary?.denied_window_days || 90} days</small></div></article>
      </section>
      <section className="sharing-table-card">
        <div className="sharing-toolbar">
          <label className="sharing-search"><Icon name="search" /><span className="sharing-sr-only">Search grants</span><input onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by document name, recipient, or email…" type="search" value={searchInput} /></label>
          <div className="sharing-filter-picker"><RemotePicker compact displayValue={documentFilter?.title || 'All Documents'} endpoint="/api/sharing/documents?shared_only=true&page=1&page_size=10" label="Filter by document" onClear={() => updateFilter(() => setDocumentFilter(null))} onSelect={(item) => updateFilter(() => setDocumentFilter(item))} placeholder="Search documents…" value={documentFilter} /></div>
          <label className="sharing-select-wrap"><span className="sharing-sr-only">Filter by permission</span><select onChange={(event) => updateFilter(() => setPermissionFilter(event.target.value))} value={permissionFilter}><option value="">All Permissions</option>{PERMISSIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><Icon name="chevron" /></label>
          <label className="sharing-select-wrap"><span className="sharing-sr-only">Filter by status</span><select onChange={(event) => updateFilter(() => setStatusFilter(event.target.value))} value={statusFilter}><option value="">All Status</option><option value="active">Active</option><option value="expiring_soon">Expiring Soon</option><option value="expired">Expired</option><option value="revoked">Revoked</option><option value="denied">Denied</option><option value="unavailable">Unavailable</option></select><Icon name="chevron" /></label>
          <label className="sharing-select-wrap"><span className="sharing-sr-only">Filter by grant date</span><select onChange={(event) => updateFilter(() => setDateWindow(event.target.value))} value={dateWindow}><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="90d">Last 90 Days</option><option value="all">All Time</option></select><Icon name="calendar" /></label>
        </div>
        <div className="sharing-table-scroll"><table className="sharing-table"><thead><tr>
          {[["document", "Document"], ["recipient", "Recipient"], ["permission", "Permission"], ["event_at", "Granted On"], ["expires_at", "Expires"], ["status", "Status"]].map(([column, label]) => <th key={column}><button onClick={() => changeSort(column)} type="button">{label}<Icon name="sort" /></button></th>)}<th>Actions</th>
        </tr></thead><tbody>
          {loading && <tr><td className="sharing-table-message" colSpan={7}>Loading permission records…</td></tr>}
          {!loading && error && <tr><td className="sharing-table-message is-error" colSpan={7}>{error}<button className="sharing-link-button" onClick={refresh} type="button">Retry</button></td></tr>}
          {!loading && !error && rows.map((record) => {
            const canManage = record.record_type === 'grant' && record.status !== 'unavailable'
            return <tr className={canManage ? 'is-clickable' : ''} key={`${record.record_type}-${record.id}`} onClick={() => canManage && setManageDocumentId(record.document_id)} onKeyDown={(event) => { if (canManage && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setManageDocumentId(record.document_id) } }} tabIndex={canManage ? 0 : undefined}>
              <td><div className="sharing-document-cell"><FileIcon filename={record.original_filename || record.document_title} /><span><strong>{record.document_title}</strong><small>{record.document_id}</small></span></div></td>
              <td><div className="sharing-recipient"><Avatar name={record.recipient_name} /><span><strong>{record.recipient_name}</strong><small>{record.recipient_email}</small></span></div></td>
              <td><PermissionBadge record={record} /></td>
              <td>{record.record_type === 'denied_request' ? <><strong>Denied</strong><small className="sharing-secondary-date">{formatDate(record.event_at, true)}</small></> : formatDate(record.event_at, true)}</td>
              <td>{formatDate(record.expires_at)}</td>
              <td><StatusBadge status={record.status} /></td>
              <td>{canManage ? <ActionMenu record={record} onManage={() => setManageDocumentId(record.document_id)} onView={() => viewDocument(record.document_id)} /> : <span className="sharing-no-action">—</span>}</td>
            </tr>
          })}
          {!loading && !error && rows.length === 0 && <tr><td className="sharing-table-message" colSpan={7}>{search || documentFilter || permissionFilter || statusFilter ? 'No permission records match your filters.' : 'You have not shared any documents yet.'}{!search && !documentFilter && !permissionFilter && !statusFilter && <button className="sharing-link-button" onClick={() => setShareOpen(true)} type="button">Share a Document</button>}</td></tr>}
        </tbody></table></div>
        {!loading && !error && <footer className="sharing-pagination"><span>Showing {rangeStart}–{rangeEnd} of {total} grants</span><nav aria-label="Grants pages"><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">‹</button>{pageNumbers.map((number) => <button aria-current={page === number ? 'page' : undefined} className={page === number ? 'is-current' : ''} key={number} onClick={() => setPage(number)} type="button">{number}</button>)}<button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} type="button">›</button></nav></footer>}
      </section>
      {shareOpen && <ShareDocumentModal onClose={() => setShareOpen(false)} onShared={(count) => { setShareOpen(false); setNotice(`Document shared with ${count} ${count === 1 ? 'person' : 'people'}.`); refresh() }} />}
      {manageDocumentId && <ManageAccessModal documentId={manageDocumentId} onChanged={refresh} onClose={() => setManageDocumentId('')} onView={viewDocument} />}
      {previewDocument && <DocumentViewer document={previewDocument} onClose={() => setPreviewDocument(null)} />}
      {previewError && <div className="sharing-confirm-backdrop"><section aria-label="Document unavailable" aria-modal="true" className="sharing-confirm-modal" role="alertdialog"><h3>Document could not be opened</h3><p>{previewError}</p><div className="sharing-modal-actions"><button className="sharing-button is-primary" onClick={() => setPreviewError('')} type="button">Close</button></div></section></div>}
    </main>
  )
}

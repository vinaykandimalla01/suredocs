import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPut, apiUpload } from './api.js'
import DocumentViewer from './DocumentViewer.jsx'
import EmployeeUploadWorkspace from './EmployeeUploadWorkspace.jsx'
import MyDocumentsWorkspace, { SharedWithMeWorkspace } from './MyDocumentsWorkspace.jsx'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg',
  'json', 'txt', 'log', 'csv',
])

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = units[0]
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024
    unit = units[index]
  }

  return `${value.toFixed(1)} ${unit}`
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

function fileExtension(file) {
  return file?.name.split('.').pop()?.toLowerCase() ?? ''
}

function PrimaryButton({ children, disabled = false, onClick, type = 'button' }) {
  return (
    <button
      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  )
}

function DocumentUploadForm({ onCancel, onUploaded }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [classification, setClassification] = useState('CONFIDENTIAL')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function chooseFile(selected) {
    if (!selected) return
    if (!ACCEPTED_EXTENSIONS.has(fileExtension(selected))) {
      setError('Choose a supported PDF, Office document, or PNG/JPEG image.')
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError('The maximum document size is 50 MB.')
      return
    }
    setFile(selected)
    setTitle((current) => current || selected.name.replace(/\.[^.]+$/, ''))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    setBusy(true)
    setError('')
    const body = new FormData()
    body.append('file', file)
    body.append('title', title)
    body.append('description', description)
    body.append('category', category)
    body.append('classification', classification)
    try {
      const savedDocument = await apiUpload('/api/documents/upload', body, {
        onProgress: setProgress,
      })
      onUploaded(savedDocument)
    } catch (requestError) {
      setError(requestError.message || 'The document upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Upload document</h2>
          <p className="mt-1 text-xs text-slate-500">Files are validated by the server and stored in private S3.</p>
        </div>
        <button className="text-xs font-medium text-slate-500 hover:text-slate-900" onClick={onCancel} type="button">Cancel</button>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block cursor-pointer rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-6 text-center">
          <span className="block text-sm font-medium text-slate-800">{file?.name ?? 'Choose a file'}</span>
          <span className="mt-1 block text-xs text-slate-500">
            {file ? `${formatBytes(file.size)} · ${file.type || 'File type checked on upload'}` : 'PDF, Office, PNG/JPG, JSON and text/log files · 50 MB maximum'}
          </span>
          <input
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.json,.txt,.log,.csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0])}
            type="file"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-slate-700">
            Display title
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" maxLength={255} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Category
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" maxLength={80} onChange={(event) => setCategory(event.target.value)} value={category} />
          </label>
          <label className="text-xs font-medium text-slate-700">
            Classification
            <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setClassification(event.target.value)} value={classification}>
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="RESTRICTED">Restricted</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-700">
            Description
            <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" maxLength={10000} onChange={(event) => setDescription(event.target.value)} rows={2} value={description} />
          </label>
        </div>
        {busy && (
          <div aria-live="polite" className="space-y-1">
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-slate-500">Uploading: {progress}%</p>
          </div>
        )}
        {error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800" role="alert">{error}</p>}
        <div className="flex justify-end"><PrimaryButton disabled={busy || !file} type="submit">{busy ? 'Uploading…' : 'Upload document'}</PrimaryButton></div>
      </form>
    </section>
  )
}

function DocumentEditor({ document, onSaved, onCancel }) {
  const [title, setTitle] = useState(document.title)
  const [description, setDescription] = useState(document.description ?? '')
  const [category, setCategory] = useState(document.category ?? '')
  const [classification, setClassification] = useState(document.classification)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const saved = await apiPatch(`/api/documents/${document.id}`, {
        title,
        description: description || null,
        category: category || null,
        classification,
      })
      onSaved(saved)
    } catch (requestError) {
      setError(requestError.message || 'Metadata could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={submit}>
      <h3 className="text-sm font-semibold text-slate-800">Edit metadata</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-700">Title<input className="mt-1 w-full rounded border border-slate-200 px-2 py-2" maxLength={255} onChange={(event) => setTitle(event.target.value)} required value={title} /></label>
        <label className="text-xs font-medium text-slate-700">Category<input className="mt-1 w-full rounded border border-slate-200 px-2 py-2" maxLength={80} onChange={(event) => setCategory(event.target.value)} value={category} /></label>
        <label className="text-xs font-medium text-slate-700">Classification<select className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-2" onChange={(event) => setClassification(event.target.value)} value={classification}><option value="INTERNAL">Internal</option><option value="CONFIDENTIAL">Confidential</option><option value="RESTRICTED">Restricted</option></select></label>
        <label className="text-xs font-medium text-slate-700">Description<textarea className="mt-1 w-full rounded border border-slate-200 px-2 py-2" maxLength={10000} onChange={(event) => setDescription(event.target.value)} rows={2} value={description} /></label>
      </div>
      {error && <p className="text-xs text-rose-700" role="alert">{error}</p>}
      <div className="flex justify-end gap-2"><button className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={onCancel} type="button">Cancel</button><PrimaryButton disabled={busy} type="submit">{busy ? 'Saving…' : 'Save changes'}</PrimaryButton></div>
    </form>
  )
}

function PermissionManager({ document, onClose }) {
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [recipient, setRecipient] = useState('')
  const [canView, setCanView] = useState(true)
  const [canDownload, setCanDownload] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [permissionResponse, userResponse] = await Promise.all([
      apiGet(`/api/documents/${document.id}/permissions`),
      apiGet('/api/documents/users'),
    ])
    setPermissions(permissionResponse.items)
    setUsers(userResponse)
  }, [document.id])

  useEffect(() => {
    let active = true
    Promise.all([
      apiGet(`/api/documents/${document.id}/permissions`),
      apiGet('/api/documents/users'),
    ])
      .then(([permissionResponse, userResponse]) => {
        if (!active) return
        setPermissions(permissionResponse.items)
        setUsers(userResponse)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => { active = false }
  }, [document.id])

  async function grant(event) {
    event.preventDefault()
    if (!recipient) return
    setBusy(true)
    setError('')
    try {
      await apiPut(`/api/documents/${document.id}/permissions`, {
        user_id: recipient,
        can_view: canView || canDownload,
        can_download: canDownload,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'Permission could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(permission) {
    setBusy(true)
    setError('')
    try {
      await apiDelete(`/api/documents/${document.id}/permissions/${permission.id}`)
      await refresh()
    } catch (requestError) {
      setError(requestError.message || 'Permission could not be revoked.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Manage access</h3><button className="text-xs text-slate-500" onClick={onClose} type="button">Close</button></div>
      <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={grant}>
        <select aria-label="Select recipient" className="rounded border border-slate-200 bg-white px-2 py-2 text-xs" onChange={(event) => setRecipient(event.target.value)} value={recipient}>
          <option value="">Choose active user</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.full_name} ({user.email})</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs"><input checked={canView} onChange={(event) => setCanView(event.target.checked)} type="checkbox" />View</label>
        <label className="flex items-center gap-2 text-xs"><input checked={canDownload} onChange={(event) => { setCanDownload(event.target.checked); if (event.target.checked) setCanView(true) }} type="checkbox" />Download</label>
        <input aria-label="Permission expiry" className="rounded border border-slate-200 px-2 py-2 text-xs" onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} />
        <div className="sm:col-span-4"><PrimaryButton disabled={busy || !recipient}>Grant or update access</PrimaryButton></div>
      </form>
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
      <div className="mt-4 divide-y divide-slate-100">
        {permissions.map((permission) => (
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs" key={permission.id}>
            <span><strong>{permission.user_name}</strong> · {permission.can_view ? 'View' : 'No view'}{permission.can_download ? ' + Download' : ''} · {permission.is_effective ? 'Active' : permission.revoked_at ? 'Revoked' : 'Expired'} · granted by {permission.granted_by_name}</span>
            {!permission.revoked_at && <button className="text-rose-700 hover:underline disabled:opacity-50" disabled={busy} onClick={() => revoke(permission)} type="button">Revoke</button>}
          </div>
        ))}
        {permissions.length === 0 && <p className="py-3 text-xs text-slate-500">No access grants yet.</p>}
      </div>
    </section>
  )
}

function DocumentVersions({ document, onView }) {
  const [versions, setVersions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiGet(`/api/documents/${document.id}/versions`)
      .then((response) => {
        if (active) setVersions(response.items)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => { active = false }
  }, [document.id])

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold text-slate-800">Version history</h3>
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
      <div className="mt-2 space-y-2">
        {versions.map((version) => (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-[11px]" key={version.id}>
            <span><strong>v{version.version_number}</strong> · {version.original_filename} · {formatBytes(version.size_bytes)}<span className="block text-slate-500">Uploaded by {version.uploaded_by_name} · {formatDate(version.uploaded_at)}</span></span>
            <span className="flex gap-2">
              {document.can_view && <button className="font-medium text-blue-700" onClick={() => onView(version)} type="button">View</button>}
              {document.can_download && <a className="font-medium text-blue-700" href={`/api/documents/${document.id}/versions/${version.id}/download`}>Download</a>}
            </span>
          </div>
        ))}
        {versions.length === 0 && !error && <p className="text-xs text-slate-500">No available versions.</p>}
      </div>
    </section>
  )
}

function DocumentAuditHistory({ document }) {
  const [events, setEvents] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    apiGet(`/api/documents/${document.id}/audit`)
      .then((response) => {
        if (active) setEvents(response.items)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => { active = false }
  }, [document.id])

  return (
    <section className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold text-slate-800">Recent document activity</h3>
      {error && <p className="mt-2 text-xs text-rose-700" role="alert">{error}</p>}
      <div className="mt-2 space-y-2">
        {events.slice(0, 8).map((event) => (
          <p className="text-[11px] text-slate-600" key={event.id}>
            <strong>{event.action_type.replaceAll('_', ' ')}</strong> · {event.actor_name ?? 'System'} · {formatDate(event.occurred_at)} · {event.result}
          </p>
        ))}
        {events.length === 0 && !error && <p className="text-xs text-slate-500">No recorded events.</p>}
      </div>
    </section>
  )
}

function LegacyDocumentsWorkspace({
  user,
  mode = 'owned',
  initialDocumentId = null,
  startInUpload = false,
  onOpenDocument,
  onCloseDocument,
}) {
  const isAdmin = mode === 'registry'
  const [showMyDocuments, setShowMyDocuments] = useState(false)
  const [uploading, setUploading] = useState(startInUpload)
  const [documents, setDocuments] = useState([])
  const [myDocumentCount, setMyDocumentCount] = useState(0)
  const [registryTotal, setRegistryTotal] = useState(0)
  const [localSelectedId, setLocalSelectedId] = useState(initialDocumentId)
  const selectedId = isAdmin ? initialDocumentId : localSelectedId
  const [editing, setEditing] = useState(false)
  const [managingPermissions, setManagingPermissions] = useState(false)
  const [replacementFile, setReplacementFile] = useState(null)
  const [replacementProgress, setReplacementProgress] = useState(0)
  const [replacementBusy, setReplacementBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewerSelection, setViewerSelection] = useState(null)

  const listEndpoint = mode === 'shared'
    ? '/api/documents/shared'
    : isAdmin && !showMyDocuments
      ? `/api/documents/registry?page=${page}&page_size=50`
      : '/api/documents/my'

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiGet(listEndpoint)
      setDocuments((items) => (
        isAdmin && !showMyDocuments && page > 1
          ? [...items, ...response.items]
          : response.items
      ))
      if (isAdmin && !showMyDocuments) setRegistryTotal(response.total)
      if (isAdmin && !showMyDocuments) {
        const mine = await apiGet('/api/documents/my')
        setMyDocumentCount(mine.total)
      } else if (isAdmin && showMyDocuments) {
        setMyDocumentCount(response.total)
      }
      if (selectedId && !response.items.some((item) => item.id === selectedId)) {
        const detail = await apiGet(`/api/documents/${selectedId}`)
        setDocuments((items) => [detail, ...items])
      }
    } catch (requestError) {
      setError(requestError.message || 'Documents could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [isAdmin, listEndpoint, page, selectedId, showMyDocuments])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) loadDocuments()
    })
    return () => { active = false }
  }, [loadDocuments, refreshKey])

  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId),
    [documents, selectedId],
  )
  const viewerDocument = useMemo(
    () => documents.find((document) => document.id === viewerSelection?.documentId),
    [documents, viewerSelection],
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return documents
    return documents.filter((document) => (
      `${document.title} ${document.original_filename ?? ''} ${document.owner_name} ${document.category ?? ''}`
        .toLowerCase()
        .includes(query)
    ))
  }, [documents, search])

  function onUploaded(document) {
    setUploading(false)
    setLocalSelectedId(document.id)
    setNotice('Document uploaded successfully.')
    setRefreshKey((value) => value + 1)
  }

  function selectDocument(documentId) {
    setLocalSelectedId(documentId)
    onOpenDocument?.(documentId)
  }

  function openViewer(documentId, version = null) {
    setViewerSelection({ documentId, version })
  }

  function closeSelectedDocument() {
    setLocalSelectedId(null)
    onCloseDocument?.()
  }

  async function replaceFile() {
    if (!selected || !replacementFile) return
    const body = new FormData()
    body.append('file', replacementFile)
    if (!ACCEPTED_EXTENSIONS.has(fileExtension(replacementFile)) || replacementFile.size > MAX_FILE_BYTES) {
      setError('Choose a supported file that is 50 MB or smaller.')
      return
    }
    setReplacementBusy(true)
    setError('')
    try {
      const updated = await apiUpload(`/api/documents/${selected.id}/versions`, body, {
        onProgress: setReplacementProgress,
      })
      setReplacementFile(null)
      setDocuments((items) => items.map((item) => item.id === updated.id ? updated : item))
      setNotice('A new document version was uploaded.')
    } catch (requestError) {
      setError(requestError.message || 'The replacement upload failed.')
    } finally {
      setReplacementBusy(false)
    }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm(`Delete "${selected.title}"? This hides it from active lists; stored versions are retained.`)) return
    setDeleting(true)
    setError('')
    try {
      await apiDelete(`/api/documents/${selected.id}`)
      setLocalSelectedId(null)
      onCloseDocument?.()
      setNotice('Document deleted. Stored versions were retained.')
      setRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(requestError.message || 'Document could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  const title = uploading
    ? 'Upload Document'
    : mode === 'shared'
      ? 'Shared with Me'
      : isAdmin && !showMyDocuments
        ? 'Document Registry'
        : 'My Documents'

  return (
    <>
    <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-blue-700">{isAdmin && !showMyDocuments ? 'Organization metadata' : user?.full_name ?? 'SureDocs'}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin && !showMyDocuments
              ? 'Organization-wide metadata registry. File contents remain owner/permission protected.'
              : mode === 'shared'
                ? 'Documents shared with you, limited to the access granted by each owner.'
                : 'Manage documents owned by your account.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && !uploading && (
            <button className={`rounded-lg px-3 py-2 text-xs font-semibold ${showMyDocuments ? 'bg-blue-50 text-blue-700' : 'border border-slate-200 bg-white text-slate-700'}`} onClick={() => { setShowMyDocuments((value) => !value); setLocalSelectedId(null); setPage(1) }} type="button">
              My Documents ({myDocumentCount})
            </button>
          )}
          {!uploading && mode !== 'shared' && (
            <PrimaryButton onClick={() => { setLocalSelectedId(null); setUploading(true) }}>Upload document</PrimaryButton>
          )}
          {mode === 'owned' && !uploading && <a className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" href="/employee/shared">Shared with me</a>}
          {uploading && <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium" onClick={() => setUploading(false)} type="button">Back to documents</button>}
        </div>
      </header>

      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800" role="alert">{error}</p>}
      {uploading ? (
        <DocumentUploadForm onCancel={() => setUploading(false)} onUploaded={onUploaded} />
      ) : (
        <>
          {isAdmin && !showMyDocuments && (
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Organization documents</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : registryTotal}</p></div>
              <button className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left hover:bg-blue-100" onClick={() => { setShowMyDocuments(true); setLocalSelectedId(null) }} type="button"><p className="text-xs text-blue-700">My Documents</p><p className="mt-1 text-2xl font-semibold text-blue-900">{myDocumentCount}</p></button>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Registry results</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : filtered.length}</p></div>
            </section>
          )}
          <section className={`grid items-start gap-4 ${selected ? 'xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.85fr)]' : ''}`}>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div><h2 className="text-sm font-semibold text-slate-800">Documents</h2><p className="mt-1 text-xs text-slate-500">{isAdmin && !showMyDocuments ? `Metadata registry · ${filtered.length} shown` : `${filtered.length} document${filtered.length === 1 ? '' : 's'}`}</p></div>
                <input aria-label="Search documents" className="min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-xs" onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" value={search} />
              </div>
              {loading ? <p className="p-6 text-sm text-slate-500" role="status">Loading documents…</p>
                : filtered.length === 0 ? <div className="p-8 text-center"><p className="text-sm font-medium text-slate-700">No documents found</p><p className="mt-1 text-xs text-slate-500">Uploaded documents will appear here after they are saved.</p></div>
                  : <div className="divide-y divide-slate-100">
                    {filtered.map((document) => (
                      <article className={`p-4 ${selectedId === document.id ? 'bg-blue-50/60' : ''}`} key={document.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button className="min-w-0 text-left disabled:cursor-not-allowed" disabled={!document.current_version_id} onClick={() => openViewer(document.id)} type="button">
                            <span className="block truncate text-sm font-semibold text-slate-900">{document.title}</span>
                            <span className="mt-1 block truncate text-xs text-slate-500">{document.original_filename ?? 'Upload incomplete'} · {formatBytes(document.size_bytes)}</span>
                          </button>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{document.classification}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>Owner: {document.owner_name}</span><span>{document.current_version_number ? `Version ${document.current_version_number}` : 'No available version'}</span><span>{document.content_type ?? '—'}</span><span>Updated {formatDate(document.updated_at)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="text-xs font-medium text-blue-700 hover:underline" onClick={() => selectDocument(document.id)} type="button">Details</button>
                          {document.can_view && document.current_version_id && <button className="text-xs font-medium text-blue-700 hover:underline" onClick={() => openViewer(document.id)} type="button">View</button>}
                          {document.can_download && document.current_version_id && <a className="text-xs font-medium text-blue-700 hover:underline" href={`/api/documents/${document.id}/versions/${document.current_version_id}/download`}>Download</a>}
                        </div>
                      </article>
                    ))}
                  </div>}
              {isAdmin && !showMyDocuments && documents.length < registryTotal && <div className="border-t border-slate-100 p-3 text-center"><button className="text-xs font-semibold text-blue-700" onClick={() => setPage((value) => value + 1)} type="button">Load more</button></div>}
            </div>

            {selected && (
              <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2"><div><h2 className="text-base font-semibold text-slate-900">{selected.title}</h2><p className="mt-1 text-xs text-slate-500">{selected.original_filename ?? 'File not available'}</p></div><button aria-label="Close details" className="text-slate-400 hover:text-slate-800" onClick={closeSelectedDocument} type="button">×</button></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div><dt className="text-slate-500">Owner</dt><dd className="mt-1 font-medium text-slate-800">{selected.owner_name}</dd></div>
                  <div><dt className="text-slate-500">Version</dt><dd className="mt-1 font-medium text-slate-800">{selected.current_version_number ?? '—'}</dd></div>
                  <div><dt className="text-slate-500">Classification</dt><dd className="mt-1 font-medium text-slate-800">{selected.classification}</dd></div>
                  <div><dt className="text-slate-500">Category</dt><dd className="mt-1 font-medium text-slate-800">{selected.category ?? '—'}</dd></div>
                  <div><dt className="text-slate-500">Type / size</dt><dd className="mt-1 font-medium text-slate-800">{selected.content_type ?? '—'} · {formatBytes(selected.size_bytes)}</dd></div>
                  <div><dt className="text-slate-500">Modified</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(selected.updated_at)}</dd></div>
                  <div className="col-span-2"><dt className="text-slate-500">Description</dt><dd className="mt-1 text-slate-800">{selected.description || 'No description'}</dd></div>
                </dl>
                {selected.is_owner && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button className="rounded border border-slate-200 px-2.5 py-1.5 text-xs" onClick={() => setEditing((value) => !value)} type="button">Edit metadata</button>
                    <button className="rounded border border-slate-200 px-2.5 py-1.5 text-xs" onClick={() => setManagingPermissions((value) => !value)} type="button">Manage access</button>
                    <button className="rounded border border-rose-200 px-2.5 py-1.5 text-xs text-rose-700 disabled:opacity-50" disabled={deleting} onClick={deleteSelected} type="button">{deleting ? 'Deleting…' : 'Delete'}</button>
                    <label className="cursor-pointer rounded border border-slate-200 px-2.5 py-1.5 text-xs">Replace file<input accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.json,.txt,.log,.csv" className="sr-only" onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)} type="file" /></label>
                  </div>
                )}
                {replacementFile && selected.is_owner && <div className="mt-3 rounded bg-slate-50 p-3"><p className="text-xs text-slate-700">{replacementFile.name} · {formatBytes(replacementFile.size)}</p><div className="mt-2 flex items-center gap-2"><PrimaryButton disabled={replacementBusy} onClick={replaceFile}>{replacementBusy ? 'Uploading…' : 'Upload new version'}</PrimaryButton><button className="text-xs text-slate-500 disabled:opacity-50" disabled={replacementBusy} onClick={() => setReplacementFile(null)} type="button">Cancel</button></div><p className="mt-2 text-xs text-slate-500">Upload progress: {replacementProgress}%</p></div>}
                {editing && selected.is_owner && <DocumentEditor document={selected} onCancel={() => setEditing(false)} onSaved={(saved) => { setDocuments((items) => items.map((item) => item.id === saved.id ? saved : item)); setEditing(false); setNotice('Metadata updated.') }} />}
                {managingPermissions && selected.is_owner && <PermissionManager document={selected} onClose={() => setManagingPermissions(false)} />}
                <DocumentVersions document={selected} onView={(version) => openViewer(selected.id, version)} />
                {selected.is_owner && <DocumentAuditHistory document={selected} />}
              </aside>
            )}
          </section>
        </>
      )}
    </main>
      {viewerDocument && (
        <DocumentViewer
          document={viewerDocument}
          key={`${viewerDocument.id}:${viewerSelection.version?.id ?? viewerDocument.current_version_id}`}
          onClose={() => setViewerSelection(null)}
          version={viewerSelection.version}
        />
      )}
    </>
  )
}

export default function DocumentsWorkspace(props) {
  if (props.mode === 'shared') {
    return <SharedWithMeWorkspace initialDocumentId={props.initialDocumentId} onSearchChange={props.onSearchChange} search={props.search} user={props.user} />
  }
  if (props.mode === 'owned' && !props.startInUpload) {
    return <MyDocumentsWorkspace initialDocumentId={props.initialDocumentId} onSearchChange={props.onSearchChange} search={props.search} user={props.user} />
  }
  if (props.mode === 'owned' && props.startInUpload) {
    return <EmployeeUploadWorkspace user={props.user} />
  }
  return <LegacyDocumentsWorkspace {...props} />
}

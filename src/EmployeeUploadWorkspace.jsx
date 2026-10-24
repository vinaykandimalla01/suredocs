import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPut, apiUpload } from './api.js'
import './EmployeeUploadWorkspace.css'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg',
  'json', 'txt', 'log', 'csv',
])
const CATEGORY_SUGGESTIONS = [
  'Clients', 'Design', 'Finance', 'Human Resources', 'HR', 'Legal', 'Operations',
  'Planning', 'Product', 'Projects', 'Research', 'Security',
]
const FILE_ACCEPT = [...ACCEPTED_EXTENSIONS].map((extension) => `.${extension}`).join(',')

function extensionOf(file) {
  return file?.name.split('.').pop()?.toLowerCase() || ''
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = units[0]
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024
    unit = units[index]
  }
  return `${size.toFixed(1)} ${unit}`
}

function iconPath(name) {
  const paths = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    fileUpload: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6m-3 3 3-3 3 3" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
    cloud: <><path d="M20 16.2A4.8 4.8 0 0 0 18 7h-1.1A7 7 0 1 0 4 16.2" /><path d="M12 12v9m-4-4 4-4 4 4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return paths[name]
}

function Icon({ name, className = '' }) {
  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">{iconPath(name)}</svg>
}

function FileMark({ filename, large = false }) {
  const extension = filename?.split('.').pop()?.toLowerCase() || 'file'
  const kind = ['pdf'].includes(extension) ? 'pdf'
    : ['xlsx', 'xls', 'csv'].includes(extension) ? 'sheet'
      : ['doc', 'docx'].includes(extension) ? 'word'
        : ['ppt', 'pptx'].includes(extension) ? 'slides' : 'other'
  return <span className={`upload-file-mark upload-file-mark--${kind}${large ? ' upload-file-mark--large' : ''}`}>{extension.toUpperCase().slice(0, 4)}</span>
}

function recentTime(value) {
  if (!value) return 'Uploaded date unavailable'
  const date = new Date(value)
  const now = new Date()
  const day = (item) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (day(date) === day(now)) return `Uploaded today, ${time}`
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (day(date) === day(yesterday)) return `Uploaded yesterday, ${time}`
  return `Uploaded on ${date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`
}

function RecentUploadRow({ document, menuOpen, onMenu }) {
  const extension = document.original_filename?.split('.').pop()?.toLowerCase() || 'file'
  const canDownload = Boolean(document.can_download && document.current_version_id)
  return (
    <article className="upload-recent-row">
      <FileMark filename={document.original_filename || document.title} />
      <div className="upload-recent-copy">
        <strong title={document.original_filename || document.title}>{document.original_filename || document.title}</strong>
        <span>{formatBytes(document.size_bytes)} <i>·</i> {recentTime(document.created_at)}</span>
      </div>
      <span className={`upload-recent-status${document.status === 'ACTIVE' ? '' : ' is-pending'}`}>{document.status === 'ACTIVE' ? 'Uploaded' : 'Processing'}</span>
      <div className="upload-recent-actions">
        <button aria-expanded={menuOpen} aria-label={`Actions for ${document.title}`} className="upload-more-button" onClick={(event) => { event.stopPropagation(); onMenu() }} type="button"><Icon name="more" /></button>
        {menuOpen && <div className="upload-recent-menu" onClick={(event) => event.stopPropagation()} role="menu">
          <a href={`/employee/documents?documentId=${encodeURIComponent(document.id)}`} role="menuitem">Document details</a>
          {canDownload
            ? <a href={`/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(document.current_version_id)}/download`} role="menuitem">Download document</a>
            : <span>Read access only</span>}
        </div>}
      </div>
    </article>
  )
}

export default function EmployeeUploadWorkspace() {
  const [recentDocuments, setRecentDocuments] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState('')
  const [openRecentMenu, setOpenRecentMenu] = useState('')
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestionsOpen, setTagSuggestionsOpen] = useState(false)
  const [accessMode, setAccessMode] = useState('private')
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientResults, setRecipientResults] = useState([])
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipientError, setRecipientError] = useState('')
  const [recipients, setRecipients] = useState([])
  const [canDownload, setCanDownload] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [createdDocument, setCreatedDocument] = useState(null)
  const [grantedRecipientIds, setGrantedRecipientIds] = useState([])
  const fileInput = useRef(null)
  const locked = Boolean(createdDocument)
  const selectedExtension = extensionOf(file)

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    setRecentError('')
    try {
      const response = await apiGet('/api/documents/my')
      setRecentDocuments(response.items || [])
    } catch (requestError) {
      setRecentError(requestError.message || 'Recent uploads could not be loaded.')
    } finally {
      setRecentLoading(false)
    }
  }, [])

  useEffect(() => { loadRecent() }, [loadRecent])

  useEffect(() => {
    const query = recipientQuery.trim()
    if (accessMode !== 'share' || locked || !query) {
      setRecipientResults([])
      setRecipientLoading(false)
      setRecipientError('')
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setRecipientLoading(true)
      setRecipientError('')
      try {
        const result = await apiGet(`/api/documents/users?search=${encodeURIComponent(query)}`, { signal: controller.signal })
        setRecipientResults(result.filter((person) => !recipients.some((selected) => selected.id === person.id)))
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setRecipientError(requestError.message || 'Users could not be searched.')
      } finally {
        if (!controller.signal.aborted) setRecipientLoading(false)
      }
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [accessMode, locked, recipientQuery, recipients])

  useEffect(() => {
    const closeMenu = (event) => {
      if (!event.target.closest('.upload-recent-actions')) setOpenRecentMenu('')
      if (!event.target.closest('.employee-upload-tag-picker')) setTagSuggestionsOpen(false)
    }
    window.document.addEventListener('click', closeMenu)
    return () => window.document.removeEventListener('click', closeMenu)
  }, [])

  const categories = useMemo(() => {
    const existing = recentDocuments.map((document) => document.category).filter(Boolean)
    return [...new Set([...CATEGORY_SUGGESTIONS, ...existing])].sort((first, second) => first.localeCompare(second))
  }, [recentDocuments])
  const existingTags = useMemo(() => [...new Set(recentDocuments.flatMap((document) => (
    Array.isArray(document.custom_metadata?.tags) ? document.custom_metadata.tags : []
  )).filter((tag) => typeof tag === 'string' && tag.trim()))], [recentDocuments])
  const filteredTagSuggestions = existingTags.filter((tag) => (
    !tags.some((selected) => selected.toLowerCase() === tag.toLowerCase()) &&
    (!tagInput.trim() || tag.toLowerCase().includes(tagInput.trim().toLowerCase()))
  )).slice(0, 8)

  function selectFile(selectedFile) {
    if (!selectedFile || busy || locked) return
    const extension = extensionOf(selectedFile)
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      setError('Choose a supported PDF, Office, image, or text file.')
      return
    }
    if (selectedFile.size === 0) {
      setError('Choose a non-empty file.')
      return
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setError('The maximum file size is 50 MB.')
      return
    }
    setFile(selectedFile)
    setTitle((current) => current || selectedFile.name.replace(/\.[^.]+$/, ''))
    setError('')
    setSuccess('')
  }

  function addTag(value = tagInput) {
    const normalized = value.trim().replace(/\s+/g, ' ')
    if (!normalized || tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
      setTagInput('')
      setTagSuggestionsOpen(false)
      return
    }
    setTags((current) => [...current, normalized])
    setTagInput('')
    setTagSuggestionsOpen(false)
    setError('')
  }

  function addRecipient(person) {
    setRecipients((current) => current.some((recipient) => recipient.id === person.id) ? current : [...current, person])
    setRecipientQuery('')
    setRecipientResults([])
    setRecipientError('')
  }

  function resetForm() {
    setFile(null)
    setTitle('')
    setDescription('')
    setCategory('')
    setTags([])
    setTagInput('')
    setTagSuggestionsOpen(false)
    setAccessMode('private')
    setRecipientQuery('')
    setRecipientResults([])
    setRecipients([])
    setCanDownload(false)
    setExpiresAt('')
    setCreatedDocument(null)
    setGrantedRecipientIds([])
    setProgress(0)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!createdDocument) {
      if (!file) { setError('Choose a file to upload.'); return }
      if (!title.trim()) { setError('Enter a document name.'); return }
      if (!category) { setError('Select a category.'); return }
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        setError('Choose a future expiration date for shared access.')
        return
      }
      if (accessMode === 'share' && recipients.length === 0) {
        setError('Choose at least one active person to share this document with.')
        return
      }
    }

    setBusy(true)
    let savedDocument = createdDocument
    try {
      if (!savedDocument) {
        const body = new FormData()
        body.append('file', file)
        body.append('title', title.trim())
        body.append('description', description.trim())
        body.append('category', category)
        body.append('classification', 'CONFIDENTIAL')
        tags.forEach((tag) => body.append('tags', tag))
        savedDocument = await apiUpload('/api/documents/upload', body, { onProgress: setProgress })
        setCreatedDocument(savedDocument)
        await loadRecent()
      }

      if (accessMode === 'share') {
        for (const recipient of recipients) {
          if (grantedRecipientIds.includes(recipient.id)) continue
          try {
            await apiPut(`/api/documents/${encodeURIComponent(savedDocument.id)}/permissions`, {
              user_id: recipient.id,
              can_view: true,
              can_download: canDownload,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            })
            setGrantedRecipientIds((current) => [...new Set([...current, recipient.id])])
          } catch (permissionError) {
            setError(`The document was uploaded. Sharing with ${recipient.full_name} failed: ${permissionError.message || 'Permission could not be saved.'} Retry to finish the remaining grants.`)
            setBusy(false)
            return
          }
        }
      }

      setSuccess(accessMode === 'share'
        ? 'Document uploaded and shared successfully.'
        : 'Document uploaded successfully.')
      resetForm()
      await loadRecent()
    } catch (requestError) {
      setError(requestError.message || 'The document upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const recentUploads = recentDocuments.slice(0, 3)
  const formatType = selectedExtension ? selectedExtension.toUpperCase() : ''

  return (
    <main className="employee-upload-page">
      <header className="employee-upload-heading">
        <nav aria-label="Breadcrumb"><a href="/employee">Dashboard</a><span>›</span><span>Upload Document</span></nav>
        <h1>Upload Document</h1>
        <p>Upload and share documents securely with your team.</p>
      </header>

      {success && <p className="employee-upload-alert is-success" role="status">{success}</p>}
      {error && <p className="employee-upload-alert is-error" role="alert">{error}</p>}

      <div className="employee-upload-columns">
        <section aria-labelledby="upload-select-file-heading" className="employee-upload-card employee-upload-file-card">
          <header className="employee-upload-card-heading">
            <span className="employee-upload-heading-icon"><Icon name="fileUpload" /></span>
            <span><h2 id="upload-select-file-heading">Select File</h2><p>Choose a file to upload to SureDocs.</p></span>
          </header>

          <div
            className={`employee-upload-dropzone${file ? ' has-file' : ''}${busy && !createdDocument ? ' is-uploading' : ''}`}
            onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('is-dragging') }}
            onDragLeave={(event) => event.currentTarget.classList.remove('is-dragging')}
            onDrop={(event) => { event.preventDefault(); event.currentTarget.classList.remove('is-dragging'); selectFile(event.dataTransfer.files?.[0]) }}
          >
            <input accept={FILE_ACCEPT} aria-label="Choose a document file" className="upload-file-input" disabled={busy || locked} onChange={(event) => selectFile(event.target.files?.[0])} ref={fileInput} type="file" />
            {file ? <>
              <FileMark filename={file.name} large />
              <strong className="employee-upload-file-name" title={file.name}>{file.name}</strong>
              <span className="employee-upload-dropzone-detail">{formatType} <i>·</i> {formatBytes(file.size)}</span>
              {!locked && <button className="employee-upload-browse-button" disabled={busy} onClick={() => fileInput.current?.click()} type="button">Choose a Different File</button>}
              {locked && <span className="employee-upload-file-locked"><Icon name="check" /> File uploaded</span>}
            </> : <>
              <Icon className="employee-upload-cloud" name="cloud" />
              <strong>Drag and drop your file here</strong>
              <span className="employee-upload-or">or</span>
              <button className="employee-upload-browse-button" disabled={busy} onClick={() => fileInput.current?.click()} type="button">Browse Files</button>
              <span className="employee-upload-formats">Supported formats: PDF, DOCX, XLSX, PPTX, TXT</span>
              <span className="employee-upload-limit">Maximum file size: 50 MB</span>
            </>}
            {busy && !createdDocument && <div className="employee-upload-progress" role="status"><span style={{ width: `${progress}%` }} /><small>Uploading {progress}%</small></div>}
          </div>

          <section aria-labelledby="upload-recent-heading" className="employee-upload-recent">
            <h3 id="upload-recent-heading"><Icon name="clock" />Recent Uploads</h3>
            {recentLoading
              ? <p className="employee-upload-recent-state" role="status">Loading recent uploads…</p>
              : recentError
                ? <p className="employee-upload-recent-state is-error" role="alert">{recentError}</p>
                : recentUploads.length
                  ? <div className="employee-upload-recent-list">{recentUploads.map((document) => <RecentUploadRow document={document} key={document.id} menuOpen={openRecentMenu === document.id} onMenu={() => setOpenRecentMenu((current) => current === document.id ? '' : document.id)} />)}</div>
                  : <p className="employee-upload-recent-state">No recent uploads yet.</p>}
          </section>
        </section>

        <form className="employee-upload-card employee-upload-details-card" noValidate onSubmit={submit}>
          <header className="employee-upload-card-heading">
            <span className="employee-upload-heading-icon"><Icon name="file" /></span>
            <span><h2>Document Details</h2><p>Add information about your document.</p></span>
          </header>

          <fieldset className="employee-upload-fields" disabled={busy || locked}>
            <label className="employee-upload-field employee-upload-field--full">
              <span>Document Name <b>*</b></span>
              <input autoComplete="off" maxLength={255} onChange={(event) => setTitle(event.target.value)} placeholder="Enter document name" required value={title} />
            </label>
            <label className="employee-upload-field employee-upload-field--full employee-upload-description">
              <span>Description</span>
              <textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="Enter document description (optional)" value={description} />
              <small>{description.length}/500</small>
            </label>
            <div className="employee-upload-field-row">
              <label className="employee-upload-field">
                <span>Category <b>*</b></span>
                <select onChange={(event) => setCategory(event.target.value)} required value={category}>
                  <option value="">Select category</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="employee-upload-field">
                <span>File Type <b>*</b></span>
                <select aria-label="File type" disabled={!file} onChange={() => {}} required value={selectedExtension}>
                  <option value="">Select file type</option>
                  {file && <option value={selectedExtension}>{formatType}</option>}
                </select>
              </label>
            </div>
            <div className="employee-upload-field employee-upload-field--full employee-upload-tag-field">
              <span>Tags</span>
              <div className="employee-upload-tag-picker">
                <div className="employee-upload-tag-control">
                  {tags.map((tag) => <button aria-label={`Remove ${tag} tag`} className="employee-upload-tag" key={tag} onClick={() => setTags((current) => current.filter((item) => item !== tag))} type="button">{tag}<Icon name="close" /></button>)}
                  <input aria-label="Add tags" onChange={(event) => setTagInput(event.target.value)} onFocus={() => setTagSuggestionsOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }} placeholder={tags.length ? 'Add another tag' : 'Add tags (press Enter to add)'} value={tagInput} />
                  <button aria-label="Show existing tags" aria-expanded={tagSuggestionsOpen} className="employee-upload-tag-chevron" onClick={() => setTagSuggestionsOpen((open) => !open)} type="button"><Icon name="chevron" /></button>
                </div>
                {tagSuggestionsOpen && filteredTagSuggestions.length > 0 && <div className="employee-upload-tag-suggestions" role="listbox">{filteredTagSuggestions.map((tag) => <button key={tag} onClick={() => addTag(tag)} role="option" type="button">{tag}</button>)}</div>}
              </div>
            </div>
            <fieldset className="employee-upload-access-field">
              <legend>Access Settings <b>*</b></legend>
              <div className="employee-upload-access-options">
                <label className={`employee-upload-access-card${accessMode === 'private' ? ' is-selected' : ''}`}>
                  <input checked={accessMode === 'private'} name="document-access" onChange={() => { setAccessMode('private'); setRecipientQuery(''); setRecipientResults([]) }} type="radio" value="private" />
                  <span className="employee-upload-radio" />
                  <Icon name="lock" />
                  <span><strong>Private</strong><small>Only you can access</small></span>
                </label>
                <label className={`employee-upload-access-card${accessMode === 'share' ? ' is-selected' : ''}`}>
                  <input checked={accessMode === 'share'} name="document-access" onChange={() => setAccessMode('share')} type="radio" value="share" />
                  <span className="employee-upload-radio" />
                  <Icon name="users" />
                  <span><strong>Share with people</strong><small>Grant access to specific users</small></span>
                </label>
              </div>
              {accessMode === 'share' && <div className="employee-upload-sharing-controls">
                <div className="employee-upload-recipient-search">
                  <Icon name="search" />
                  <input autoComplete="off" onChange={(event) => setRecipientQuery(event.target.value)} placeholder="Search by name or email" value={recipientQuery} />
                  {recipientQuery && <div className="employee-upload-recipient-results" role="listbox">
                    {recipientLoading ? <span role="status">Searching active users…</span>
                      : recipientError ? <span className="is-error" role="alert">{recipientError}</span>
                        : recipientResults.length ? recipientResults.slice(0, 8).map((person) => <button key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addRecipient(person)} role="option" type="button"><strong>{person.full_name}</strong><small>{person.email}</small></button>)
                          : <span>No matching active users.</span>}
                  </div>}
                </div>
                <label className="employee-upload-permission-select"><span>Permission</span><select onChange={(event) => setCanDownload(event.target.value === 'download')} value={canDownload ? 'download' : 'view'}><option value="view">Read</option><option value="download">Read + Download</option></select></label>
                <label className="employee-upload-expiration"><span>Expires (optional)</span><input aria-label="Permission expiration" min={new Date().toISOString().slice(0, 16)} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" value={expiresAt} /></label>
                {recipients.length > 0 && <div aria-label="Selected recipients" className="employee-upload-recipient-list">{recipients.map((person) => <span className="employee-upload-recipient" key={person.id}><span><strong>{person.full_name}</strong><small>{person.email}</small></span><em>{canDownload ? 'Read + Download' : 'Read'}</em><button aria-label={`Remove ${person.full_name}`} onClick={() => setRecipients((current) => current.filter((recipient) => recipient.id !== person.id))} type="button"><Icon name="close" /></button></span>)}</div>}
              </div>}
            </fieldset>
          </fieldset>

          <footer className="employee-upload-form-actions">
            <a aria-disabled={busy ? 'true' : undefined} className="employee-upload-cancel" href={busy ? undefined : '/employee/documents'}>Cancel</a>
            <button className="employee-upload-submit" disabled={busy} type="submit">
              {busy ? <><span className="employee-upload-spinner" />{createdDocument ? 'Sharing…' : 'Uploading…'}</> : createdDocument ? 'Retry Sharing' : <><Icon name="upload" />Upload Document</>}
            </button>
          </footer>
        </form>
      </div>
    </main>
  )
}

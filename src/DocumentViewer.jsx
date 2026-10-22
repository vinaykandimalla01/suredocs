import { useEffect, useMemo, useRef, useState } from 'react'
import { apiGetFile, apiPost } from './api.js'

const TEXT_CHUNK_SIZE = 80_000
const MAX_JSON_FORMAT_BYTES = 2 * 1024 * 1024
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function docxSourceDocument(markup, zoom) {
  const contentSecurityPolicy = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "script-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "connect-src 'none'",
    'img-src data:',
    'font-src data:',
    "style-src 'unsafe-inline'",
  ].join('; ')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
    <meta name="referrer" content="no-referrer">
    <style>
      html, body { min-height: 100%; margin: 0; background: #fff; color: #202124; }
      body { box-sizing: border-box; padding: 24px; zoom: ${zoom / 100}; }
      img { max-width: 100%; }
      a { color: #1a73e8; }
    </style>
  </head>
  <body>${markup}</body>
</html>`
}

function extensionOf(filename) {
  return filename?.split('.').pop()?.toLowerCase() ?? ''
}

function iconLabel(filename) {
  const extension = extensionOf(filename)
  return extension ? extension.slice(0, 4).toUpperCase() : 'FILE'
}

function errorMessage(error) {
  if (error.status === 401) return 'Your session has expired. Sign in again to view this document.'
  if (error.status === 403 || error.status === 404) {
    return "You don't have permission to view this document. Contact the document owner or your administrator if you need access."
  }
  if (error.status === 503 || error.status >= 500) {
    return "SureDocs couldn't retrieve this document right now. Try again later."
  }
  return error.message || 'The document could not be loaded. Check your connection and try again.'
}

function printText(filename, text) {
  const printWindow = window.open('', '_blank', 'popup,width=900,height=700')
  if (!printWindow) return

  printWindow.opener = null
  printWindow.document.title = filename
  const style = printWindow.document.createElement('style')
  style.textContent = 'body{margin:32px;color:#111;font:12px/1.55 ui-monospace,monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere}'
  const content = printWindow.document.createElement('pre')
  content.textContent = text
  printWindow.document.head.append(style)
  printWindow.document.body.replaceChildren(content)
  printWindow.document.close()
  printWindow.setTimeout(() => printWindow.print(), 150)
}

function ToolbarButton({ children, label, disabled = false, onClick, title }) {
  return (
    <button
      aria-label={label}
      className="document-viewer-tool"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      type="button"
    >
      {children}
    </button>
  )
}

export default function DocumentViewer({ document, version = null, onClose }) {
  const filename = version?.original_filename ?? document.original_filename ?? document.title
  const versionId = version?.id ?? document.current_version_id
  const extension = extensionOf(filename)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [preview, setPreview] = useState({ status: 'loading' })
  const [zoom, setZoom] = useState(100)
  const [chunkIndex, setChunkIndex] = useState(0)
  const dialog = useRef(null)
  const onCloseRef = useRef(onClose)

  const viewUrl = useMemo(() => {
    const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ''
    return `/api/documents/${encodeURIComponent(document.id)}/view${query}`
  }, [document.id, versionId])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let objectUrl = null

    async function load() {
      const file = await apiGetFile(viewUrl, { signal: controller.signal })
      if (cancelled) return

      const isJson = extension === 'json' && file.contentType === 'application/json'
      const isText = ['txt', 'log', 'csv'].includes(extension)
        && ['text/plain', 'text/csv'].includes(file.contentType)
      if (isJson || isText) {
        const raw = await file.blob.text()
        if (cancelled) return
        let content = raw
        let jsonFormattingSkipped = false
        let invalidJson = false
        if (isJson) {
          if (file.blob.size > MAX_JSON_FORMAT_BYTES) {
            jsonFormattingSkipped = true
          } else {
            try {
              content = JSON.stringify(JSON.parse(raw), null, 2)
            } catch {
              invalidJson = true
            }
          }
        }
        setPreview({
          status: 'ready',
          kind: 'text',
          content,
          invalidJson,
          jsonFormattingSkipped,
        })
        return
      }

      if (extension === 'docx') {
        try {
          if (file.contentType !== DOCX_CONTENT_TYPE) {
            throw new Error('SureDocs received an unexpected file type for this DOCX document.')
          }
          const [{ renderAsync }, { default: DOMPurify }] = await Promise.all([
            import('docx-preview'),
            import('dompurify'),
          ])
          const bodyContainer = window.document.createElement('div')
          const styleContainer = window.document.createElement('div')
          await renderAsync(file.blob, bodyContainer, styleContainer, {
            renderAltChunks: false,
            useBase64URL: true,
          })
          if (cancelled) return

          const markup = DOMPurify.sanitize(
            `${styleContainer.innerHTML}${bodyContainer.innerHTML}`,
            {
              USE_PROFILES: { html: true },
              FORBID_TAGS: [
                'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
                'textarea', 'select', 'video', 'audio', 'source',
              ],
              FORBID_ATTR: ['srcdoc', 'srcset', 'formaction'],
            },
          )
          if (!markup.trim()) throw new Error('The document contains no renderable content.')
          setPreview({ status: 'ready', kind: 'docx', markup })
        } catch {
          if (cancelled) return
          if (versionId) {
            const failureUrl = `/api/documents/${encodeURIComponent(document.id)}/preview-failure?version_id=${encodeURIComponent(versionId)}`
            void apiPost(failureUrl, {}).catch(() => {})
          }
          setPreview({
            status: 'error',
            message: "SureDocs retrieved this file, but couldn't render its DOCX contents. The file may be damaged or use unsupported Word features.",
            retryable: false,
          })
        }
        return
      }

      if (extension === 'pdf' && file.contentType === 'application/pdf') {
        objectUrl = URL.createObjectURL(file.blob)
        setPreview({ status: 'ready', kind: 'pdf', url: objectUrl })
        return
      }

      const supportedImageTypes = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
      }
      if (supportedImageTypes[extension] === file.contentType) {
        objectUrl = URL.createObjectURL(file.blob)
        setPreview({ status: 'ready', kind: 'image', url: objectUrl })
        return
      }

      setPreview({ status: 'unsupported' })
    }

    load().catch((error) => {
      if (!cancelled && error.name !== 'AbortError') {
        setPreview({
          status: 'error',
          message: errorMessage(error),
          retryable: !error.status || error.status >= 500,
        })
      }
    })

    return () => {
      cancelled = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.id, extension, loadAttempt, versionId, viewUrl])

  useEffect(() => {
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    dialog.current?.focus({ preventScroll: true })
    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const chunkCount = preview.status === 'ready' && preview.kind === 'text'
    ? Math.max(1, Math.ceil(preview.content.length / TEXT_CHUNK_SIZE))
    : 1
  const visibleText = preview.status === 'ready' && preview.kind === 'text'
    ? preview.content.slice(chunkIndex * TEXT_CHUNK_SIZE, (chunkIndex + 1) * TEXT_CHUNK_SIZE)
    : ''
  const docxHtml = preview.status === 'ready' && preview.kind === 'docx'
    ? docxSourceDocument(preview.markup, zoom)
    : ''
  const downloadUrl = versionId
    ? `/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(versionId)}/download`
    : `/api/documents/${encodeURIComponent(document.id)}/download`

  function adjustZoom(amount) {
    setZoom((current) => Math.min(200, Math.max(50, current + amount)))
  }

  return (
    <div aria-label={`Document viewer: ${filename}`} aria-modal="true" className="document-viewer-backdrop" ref={dialog} role="dialog" tabIndex={-1}>
      <div className="document-viewer-shell">
        <header className="document-viewer-header">
          <div className="document-viewer-file">
            <ToolbarButton label="Close viewer" onClick={onClose}>
              <span aria-hidden="true" className="document-viewer-close-mark">×</span>
            </ToolbarButton>
            <span aria-hidden="true" className="document-viewer-file-icon">{iconLabel(filename)}</span>
            <div className="document-viewer-filename-wrap">
              <strong className="document-viewer-filename" title={filename}>{filename}</strong>
              <span className="document-viewer-brand">SUREDOCS · SECURE PREVIEW</span>
            </div>
          </div>
        </header>

        <nav aria-label="Document controls" className="document-viewer-controls">
          <div className="document-viewer-control-group">
            {document.can_download && versionId && (
              <ToolbarButton label="Download document" onClick={() => { window.location.href = downloadUrl }}>
                <span aria-hidden="true">↓</span>
              </ToolbarButton>
            )}
            {preview.kind === 'text' && preview.status === 'ready' && (
              <ToolbarButton label="Print document" onClick={() => printText(filename, preview.content)}>
                <span aria-hidden="true">▤</span>
              </ToolbarButton>
            )}
          </div>
          <div className="document-viewer-control-group document-viewer-zoom-group">
            <ToolbarButton disabled={zoom <= 50} label="Zoom out" onClick={() => adjustZoom(-10)}><span aria-hidden="true">−</span></ToolbarButton>
            <span aria-live="polite" className="document-viewer-zoom-value">{zoom}%</span>
            <ToolbarButton disabled={zoom >= 200} label="Zoom in" onClick={() => adjustZoom(10)}><span aria-hidden="true">＋</span></ToolbarButton>
            <span className="document-viewer-control-divider" />
            <ToolbarButton label="Fit to width" onClick={() => setZoom(100)}><span aria-hidden="true">↔</span></ToolbarButton>
          </div>
          <div aria-live="polite" className="document-viewer-status">
            {preview.status === 'loading' ? 'Loading preview…' : preview.status === 'ready' ? 'Secure preview' : ''}
          </div>
        </nav>

        <main className="document-viewer-stage">
          <section className={`document-viewer-canvas${preview.kind === 'text' ? ' is-text' : ''}`}>
            {preview.status === 'loading' && (
              <div className="document-viewer-message" role="status">
                <span className="document-viewer-spinner" />
                <strong>Opening document</strong>
                <span>SureDocs is checking your access and preparing the file preview.</span>
              </div>
            )}
            {preview.status === 'error' && (
              <div className="document-viewer-message" role="alert">
                <span aria-hidden="true" className="document-viewer-message-icon">!</span>
                <strong>{preview.message.includes("don't have permission") ? 'Unauthorized Access' : 'Document unavailable'}</strong>
                <span>{preview.message}</span>
                <div className="document-viewer-message-actions">
                  <button className="document-viewer-primary" onClick={onClose} type="button">Close</button>
                  {preview.retryable && (
                    <button className="document-viewer-secondary" onClick={() => { setPreview({ status: 'loading' }); setChunkIndex(0); setLoadAttempt((value) => value + 1) }} type="button">Try again</button>
                  )}
                </div>
              </div>
            )}
            {preview.status === 'unsupported' && (
              <div className="document-viewer-message" role="status">
                <span aria-hidden="true" className="document-viewer-message-icon">{iconLabel(filename)}</span>
                <strong>Preview unavailable</strong>
                <span>This file type cannot be previewed here. The protected original file is still available through SureDocs.</span>
                <div className="document-viewer-message-actions">
                  {document.can_download && versionId && <a className="document-viewer-primary" href={downloadUrl}>Download document</a>}
                  <button className="document-viewer-secondary" onClick={onClose} type="button">Close</button>
                </div>
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'text' && (
              <div className="document-viewer-text-page">
                {(preview.invalidJson || preview.jsonFormattingSkipped) && (
                  <p className="document-viewer-content-note" role="status">
                    {preview.invalidJson
                      ? 'This file is not valid JSON. Showing the original text without changes.'
                      : 'Large JSON file shown without reformatting to keep the preview responsive.'}
                  </p>
                )}
                <pre className="document-viewer-pre" style={{ fontSize: `${14 * zoom / 100}px` }}>{visibleText}</pre>
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'pdf' && (
              <iframe
                className="document-viewer-pdf"
                key={preview.url}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts"
                src={preview.url}
                style={{ width: `${zoom}%` }}
                title={filename}
              />
            )}
            {preview.status === 'ready' && preview.kind === 'image' && (
              <div className="document-viewer-image-wrap">
                <img alt={filename} className="document-viewer-image" src={preview.url} style={{ width: `${zoom}%` }} />
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'docx' && (
              <iframe
                className="document-viewer-docx"
                referrerPolicy="no-referrer"
                sandbox=""
                srcDoc={docxHtml}
                title={filename}
              />
            )}
          </section>
          {preview.status === 'ready' && preview.kind === 'text' && chunkCount > 1 && (
            <div className="document-viewer-pagination">
              <button disabled={chunkIndex === 0} onClick={() => setChunkIndex((value) => value - 1)} type="button">Previous</button>
              <span>Part {chunkIndex + 1} of {chunkCount}</span>
              <button disabled={chunkIndex + 1 === chunkCount} onClick={() => setChunkIndex((value) => value + 1)} type="button">Next</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

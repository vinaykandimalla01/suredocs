import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGetFile, apiPost } from './api.js'
import { parseCsv, readPptx, readXlsx, renderMarkdown } from './documentPreviewFormats.js'

const TEXT_CHUNK_SIZE = 80_000
const MAX_JSON_FORMAT_BYTES = 2 * 1024 * 1024
const OFFICE_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const TEXT_PREVIEW_TYPES = {
  adoc: new Set(['text/plain', 'text/asciidoc']),
  csv: new Set(['text/csv']),
  html: new Set(['text/html']),
  ics: new Set(['text/calendar', 'text/plain']),
  ini: new Set(['text/plain']),
  json: new Set(['application/json']),
  jsonl: new Set(['application/x-ndjson', 'application/json', 'application/ndjson']),
  log: new Set(['text/plain']),
  md: new Set(['text/markdown', 'text/plain']),
  mmd: new Set(['text/plain']),
  ndjson: new Set(['application/x-ndjson', 'application/json', 'application/ndjson']),
  org: new Set(['text/plain']),
  properties: new Set(['text/plain']),
  proto: new Set(['text/plain']),
  rst: new Set(['text/plain']),
  rtf: new Set(['application/rtf', 'text/rtf']),
  sql: new Set(['application/sql']),
  tex: new Set(['application/x-tex', 'text/plain']),
  toml: new Set(['application/toml', 'application/x-toml', 'text/plain']),
  tsv: new Set(['text/tab-separated-values', 'text/plain']),
  txt: new Set(['text/plain']),
  xml: new Set(['application/xml', 'text/xml']),
  xsd: new Set(['application/xml', 'text/xml']),
  yaml: new Set(['application/yaml', 'application/x-yaml', 'text/yaml', 'text/plain']),
}

const IMAGE_TYPES = {
  'image/gif': 'gif',
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function safeTypeForImage(bytes, contentType) {
  if (contentType === 'image/png' && bytes.length >= 8
    && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return true
  if (contentType === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return true
  if (contentType === 'image/gif' && bytes.length >= 13
    && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6)))) return true
  if (contentType === 'image/webp' && bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return true
  return false
}

function isZipContent(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
    && [0x03, 0x05, 0x07].includes(bytes[2])
    && [0x04, 0x06, 0x08].includes(bytes[3])
}

async function decodeUtf8(blob) {
  return new TextDecoder('utf-8', { fatal: true }).decode(await blob.arrayBuffer())
}

async function createDecodedImage(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const image = new window.Image()
    image.src = url
    await image.decode()
    return url
  } catch (error) {
    URL.revokeObjectURL(url)
    throw new Error('The image content could not be decoded safely.', { cause: error })
  }
}

async function createSanitizedSvg(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('The SVG contains unsafe XML declarations.')
  const { default: DOMPurify } = await import('dompurify')
  const sanitized = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true },
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'style', 'animate', 'animateMotion', 'animateTransform', 'set'],
    FORBID_ATTR: ['href', 'xlink:href', 'style', 'onload', 'onclick'],
  })
  if (!sanitized.includes('<svg')) throw new Error('The SVG does not contain a safe image.')
  return new Blob([sanitized], { type: 'image/svg+xml' })
}

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
  if (error.status === 403) return "You don't have permission to view this document. Contact the document owner or your administrator if you need access."
  if (error.status === 404) return 'The document or its available file version could not be found, or you may no longer have access.'
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

function PreviewDataTable({ rows, headerRow = false, zoom = 100 }) {
  const maxColumns = rows.reduce((count, row) => Math.max(count, row.length), 0)
  if (!maxColumns || !rows.some((row) => row.some((cell) => String(cell ?? '').length))) {
    return <p className="document-viewer-empty-sheet">This document has no readable cell values.</p>
  }

  const visibleRows = headerRow ? rows.slice(1) : rows
  const labels = headerRow
    ? rows[0]
    : Array.from({ length: maxColumns }, (_, index) => `Column ${index + 1}`)

  return (
    <div className="document-viewer-table-wrap">
      <table className="document-viewer-data-table" style={{ fontSize: `${13 * zoom / 100}px` }}>
        <thead><tr>{Array.from({ length: maxColumns }, (_, index) => (
          <th key={index}>{labels[index] || `Column ${index + 1}`}</th>
        ))}</tr></thead>
        <tbody>{visibleRows.map((row, rowIndex) => (
          <tr key={rowIndex}>{Array.from({ length: maxColumns }, (_, columnIndex) => (
            <td key={columnIndex}>{row[columnIndex] ?? ''}</td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export default function DocumentViewer({ document, version = null, onClose }) {
  const filename = version?.original_filename ?? document.original_filename ?? document.title
  const versionId = version?.id ?? document.current_version_id
  const extension = (version?.file_extension ?? document.file_extension ?? extensionOf(filename)).replace(/^\./, '').toLowerCase()
  const metadataContentType = (version?.content_type ?? document.content_type ?? '')
    .split(';', 1)[0].trim().toLowerCase()
  const expectedSize = version?.size_bytes ?? document.size_bytes
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [previewState, setPreviewState] = useState({ status: 'loading', documentId: document.id })
  const [zoom, setZoom] = useState(100)
  const [chunkIndex, setChunkIndex] = useState(0)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [slideIndex, setSlideIndex] = useState(0)
  const [pdfFit, setPdfFit] = useState(true)
  const dialog = useRef(null)
  const onCloseRef = useRef(onClose)
  const pdfLoadedRef = useRef(null)
  const preview = previewState.documentId === document.id ? previewState : { status: 'loading' }

  const setPreview = useCallback((next) => {
    setPreviewState({ ...next, documentId: document.id })
  }, [document.id])

  const viewUrl = useMemo(() => {
    const query = versionId ? `?version_id=${encodeURIComponent(versionId)}` : ''
    return `/api/documents/${encodeURIComponent(document.id)}/view${query}`
  }, [document.id, versionId])
  const successUrl = useMemo(() => (
    `/api/documents/${encodeURIComponent(document.id)}/preview-success?version_id=${encodeURIComponent(versionId ?? '')}`
  ), [document.id, versionId])
  const failureUrl = useMemo(() => (
    `/api/documents/${encodeURIComponent(document.id)}/preview-failure?version_id=${encodeURIComponent(versionId ?? '')}`
  ), [document.id, versionId])

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let retrieved = false
    let objectUrl = null
    pdfLoadedRef.current = null

    async function reportFailure() {
      if (!versionId) return
      await apiPost(failureUrl, {}).catch(() => {})
    }

    async function reportSuccess() {
      if (!versionId) throw new Error('The document version could not be verified.')
      await apiPost(successUrl, {})
    }

    async function showReady(content) {
      if (cancelled) return
      await reportSuccess()
      if (!cancelled) setPreview({ status: 'ready', ...content })
    }

    async function load() {
      const file = await apiGetFile(viewUrl, { signal: controller.signal })
      if (cancelled) return
      retrieved = true
      if (file.blob.size === 0) throw new Error('The retrieved document is empty.')

      if (metadataContentType && file.contentType && metadataContentType !== file.contentType) {
        throw new Error('The document metadata does not match the retrieved file type.')
      }
      const contentType = file.contentType || metadataContentType
      if (Number.isSafeInteger(expectedSize) && expectedSize > 0 && file.blob.size !== expectedSize) {
        throw new Error('The retrieved file size does not match its verified metadata.')
      }
      const prefix = new Uint8Array(await file.blob.slice(0, 16).arrayBuffer())
      if (cancelled) return

      if (contentType === 'application/pdf') {
        if (String.fromCharCode(...prefix.slice(0, 5)) !== '%PDF-') {
          throw new Error('The response declared a PDF, but its bytes did not match a PDF file.')
        }
        objectUrl = URL.createObjectURL(file.blob)
        setPreview({ status: 'rendering', kind: 'pdf', url: objectUrl })
        pdfLoadedRef.current = async () => {
          if (cancelled) return
          try {
            await reportSuccess()
            if (!cancelled) setPreview({ status: 'ready', kind: 'pdf', url: objectUrl })
          } catch (error) {
            if (!cancelled) {
              await reportFailure()
              setPreview({ status: 'error', message: errorMessage(error), retryable: Boolean(error.status && error.status >= 500) })
            }
          }
        }
        return
      }

      if (contentType === 'image/svg+xml') {
        const svg = await createSanitizedSvg(await decodeUtf8(file.blob))
        objectUrl = await createDecodedImage(svg)
        await showReady({ kind: 'image', url: objectUrl })
        return
      }

      if (IMAGE_TYPES[contentType]) {
        if (!safeTypeForImage(prefix, contentType)) {
          throw new Error('The response content type did not match the image bytes.')
        }
        objectUrl = await createDecodedImage(file.blob)
        await showReady({ kind: 'image', url: objectUrl })
        return
      }

      if (contentType === OFFICE_TYPES.docx || contentType === OFFICE_TYPES.xlsx || contentType === OFFICE_TYPES.pptx) {
        if (!isZipContent(prefix)) throw new Error('The Office file did not contain a valid ZIP package.')
        if (contentType === OFFICE_TYPES.docx) {
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
          await showReady({ kind: 'docx', markup })
          return
        }
        if (contentType === OFFICE_TYPES.xlsx) {
          const workbook = await readXlsx(file.blob)
          await showReady({ kind: 'xlsx', sheets: workbook.sheets, truncated: workbook.truncated })
          return
        }
        const slides = await readPptx(file.blob)
        await showReady({ kind: 'pptx', slides })
        return
      }

      if (TEXT_PREVIEW_TYPES[extension]?.has(contentType)) {
        const raw = await decodeUtf8(file.blob)
        if (cancelled) return
        if (raw.includes('\u0000')) throw new Error('This document contains binary data and cannot be shown as text.')
        if (!raw.trim()) throw new Error('The retrieved document contains no text to display.')
        let content = raw
        let jsonFormattingSkipped = false
        let invalidJson = false
        if (extension === 'json') {
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
        if (extension === 'csv' || extension === 'tsv') {
          const table = parseCsv(raw, extension === 'tsv' ? '\t' : ',')
          await showReady({ kind: 'table', ...table })
          return
        }
        if (extension === 'md') {
          if (file.blob.size <= MAX_JSON_FORMAT_BYTES) {
            const { default: DOMPurify } = await import('dompurify')
            await showReady({ kind: 'markdown', content, markup: renderMarkdown(content, DOMPurify) })
            return
          }
          await showReady({ kind: 'text', content, largeMarkdown: true })
          return
        }
        await showReady({ kind: 'text', content, invalidJson, jsonFormattingSkipped })
        return
      }

      await reportFailure()
      if (!cancelled) setPreview({ status: 'unsupported' })
    }

    load().catch((error) => {
      if (!cancelled && error.name !== 'AbortError') {
        if (retrieved) void reportFailure()
        setPreview({
          status: 'error',
          message: retrieved
            ? `SureDocs retrieved the file, but could not safely render it. ${error.message || 'Check the file format and try again.'}`
            : errorMessage(error),
          retryable: !retrieved && (!error.status || error.status >= 500),
        })
      }
    })

    return () => {
      cancelled = true
      controller.abort()
      if (pdfLoadedRef.current) pdfLoadedRef.current = null
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.id, expectedSize, extension, failureUrl, loadAttempt, metadataContentType, setPreview, successUrl, versionId, viewUrl])

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

  const chunkCount = preview.status === 'ready' && ['text', 'markdown'].includes(preview.kind)
    ? Math.max(1, Math.ceil(preview.content.length / TEXT_CHUNK_SIZE))
    : 1
  const activeChunkIndex = Math.min(chunkIndex, chunkCount - 1)
  const visibleText = preview.status === 'ready' && ['text', 'markdown'].includes(preview.kind)
    ? preview.content.slice(activeChunkIndex * TEXT_CHUNK_SIZE, (activeChunkIndex + 1) * TEXT_CHUNK_SIZE)
    : ''
  const docxHtml = preview.status === 'ready' && preview.kind === 'docx'
    ? docxSourceDocument(preview.markup, zoom)
    : ''
  const downloadUrl = versionId
    ? `/api/documents/${encodeURIComponent(document.id)}/versions/${encodeURIComponent(versionId)}/download`
    : `/api/documents/${encodeURIComponent(document.id)}/download`

  function adjustZoom(amount) {
    setPdfFit(false)
    setZoom((current) => Math.min(200, Math.max(50, current + amount)))
  }

  function completePdfPreview() {
    const complete = pdfLoadedRef.current
    if (!complete) return
    pdfLoadedRef.current = null
    void complete()
  }

  function failPdfPreview() {
    if (!pdfLoadedRef.current) return
    pdfLoadedRef.current = null
    void apiPost(failureUrl, {}).catch(() => {})
    setPreview({ status: 'error', message: 'The browser could not render this PDF preview.', retryable: false })
  }

  const activeSheetIndex = preview.kind === 'xlsx' && sheetIndex < preview.sheets.length ? sheetIndex : 0
  const activeSlideIndex = preview.kind === 'pptx' && slideIndex < preview.slides.length ? slideIndex : 0
  const currentSheet = preview.kind === 'xlsx' ? preview.sheets[activeSheetIndex] : null
  const currentSlide = preview.kind === 'pptx' ? preview.slides[activeSlideIndex] : null
  const pdfSource = preview.kind === 'pdf'
    ? `${preview.url}#toolbar=1&navpanes=1&zoom=${pdfFit || zoom === 100 ? 'page-width' : zoom}`
    : ''

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
            {['text', 'markdown'].includes(preview.kind) && preview.status === 'ready' && (
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
          <section aria-busy={preview.status === 'loading' || preview.status === 'rendering'} className={`document-viewer-canvas${['text', 'markdown', 'table', 'xlsx', 'pptx'].includes(preview.kind) ? ' is-text' : ''}`}>
            {(preview.status === 'loading' || preview.status === 'rendering') && (
              <div className="document-viewer-message" role="status">
                <span className="document-viewer-spinner" />
                <strong>{preview.status === 'rendering' ? 'Rendering document' : 'Opening document'}</strong>
                <span>{preview.status === 'rendering' ? 'The file was retrieved. SureDocs is checking the rendered preview.' : 'SureDocs is checking your access and retrieving the protected file.'}</span>
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
                <strong>Preview not supported</strong>
                <span>{['doc', 'xls', 'ppt'].includes(extension)
                  ? `The protected ${extension.toUpperCase()} file was retrieved, but this installation has no safe legacy Office renderer. The original remains available through SureDocs.`
                  : 'The protected original was retrieved, but SureDocs has no safe preview renderer for this format.'}</span>
                <div className="document-viewer-message-actions">
                  {document.can_download && versionId && <a className="document-viewer-primary" href={downloadUrl}>Download document</a>}
                  <button className="document-viewer-secondary" onClick={onClose} type="button">Close</button>
                </div>
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'text' && (
              <div className="document-viewer-text-page">
                {(preview.invalidJson || preview.jsonFormattingSkipped || preview.largeMarkdown) && (
                  <p className="document-viewer-content-note" role="status">
                    {preview.invalidJson
                      ? 'This file is not valid JSON. Showing the original text without changes.'
                      : preview.largeMarkdown
                        ? 'Large Markdown file shown as source text to keep the preview responsive.'
                        : 'Large JSON file shown without reformatting to keep the preview responsive.'}
                  </p>
                )}
                <pre className="document-viewer-pre" style={{ fontSize: `${14 * zoom / 100}px` }}>{visibleText}</pre>
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'markdown' && (
              <article className="document-viewer-markdown" dangerouslySetInnerHTML={{ __html: preview.markup }} />
            )}
            {preview.status === 'ready' && preview.kind === 'table' && (
              <>
                {(preview.truncatedRows || preview.truncatedColumns) && <p className="document-viewer-content-note" role="status">The table preview is limited to the first 500 rows and 80 columns.</p>}
                <PreviewDataTable headerRow rows={preview.rows} zoom={zoom} />
              </>
            )}
            {preview.status === 'ready' && preview.kind === 'xlsx' && (
              <div className="document-viewer-workbook">
                <label className="document-viewer-sheet-picker">Sheet <select aria-label="Workbook sheet" onChange={(event) => setSheetIndex(Number(event.target.value))} value={activeSheetIndex}>{preview.sheets.map((sheet, index) => <option key={`${sheet.name}-${index}`} value={index}>{sheet.name}</option>)}</select></label>
                {preview.truncated && <p className="document-viewer-content-note" role="status">The workbook preview is limited to the first 500 rows and 80 columns per sheet.</p>}
                <PreviewDataTable rows={currentSheet?.rows ?? []} zoom={zoom} />
              </div>
            )}
            {preview.status === 'ready' && preview.kind === 'pptx' && currentSlide && (
              <article className="document-viewer-slide">
                <p className="document-viewer-slide-label">Slide {currentSlide.number}</p>
                {currentSlide.paragraphs.length
                  ? currentSlide.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
                  : <p className="document-viewer-empty-sheet">This slide contains no readable text. Embedded visuals are not included in this text based preview.</p>}
                <p className="document-viewer-content-note" role="note">Slide text is shown here. Images, animations, charts, and embedded objects are not rendered.</p>
              </article>
            )}
            {(preview.status === 'ready' || preview.status === 'rendering') && preview.kind === 'pdf' && (
              <iframe
                className="document-viewer-pdf"
                key={pdfSource}
                onError={failPdfPreview}
                onLoad={completePdfPreview}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts"
                src={pdfSource}
                style={{ width: '100%', visibility: preview.status === 'ready' ? 'visible' : 'hidden' }}
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
          {preview.status === 'ready' && ['text', 'markdown'].includes(preview.kind) && chunkCount > 1 && (
            <div className="document-viewer-pagination">
              <button disabled={activeChunkIndex === 0} onClick={() => setChunkIndex((value) => Math.max(0, value - 1))} type="button">Previous</button>
              <span>Part {activeChunkIndex + 1} of {chunkCount}</span>
              <button disabled={activeChunkIndex + 1 === chunkCount} onClick={() => setChunkIndex((value) => value + 1)} type="button">Next</button>
            </div>
          )}
          {preview.status === 'ready' && preview.kind === 'pptx' && (
            <div aria-label="Slide navigation" className="document-viewer-pagination">
              <button disabled={activeSlideIndex === 0} onClick={() => setSlideIndex((value) => Math.max(0, value - 1))} type="button">Previous slide</button>
              <span>Slide {activeSlideIndex + 1} of {preview.slides.length}</span>
              <button disabled={activeSlideIndex + 1 >= preview.slides.length} onClick={() => setSlideIndex((value) => value + 1)} type="button">Next slide</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

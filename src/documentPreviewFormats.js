const MAX_CSV_ROWS = 500
const MAX_TABLE_COLUMNS = 80
const MAX_OFFICE_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
const MAX_OFFICE_XML_BYTES = 32 * 1024 * 1024

function localElements(root, localName) {
  return Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === localName)
}

function directChild(node, localName) {
  return Array.from(node.children).find((child) => child.localName === localName) ?? null
}

function parseXml(source, label) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error(`${label} contains unsafe XML declarations.`)
  const document = new DOMParser().parseFromString(source, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error(`${label} contains invalid XML.`)
  return document
}

async function loadOfficePackage(blob) {
  const { default: JSZip } = await import('jszip')
  const archive = await JSZip.loadAsync(blob, { checkCRC32: false })
  let totalSize = 0
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue
    const size = entry._data?.uncompressedSize ?? 0
    totalSize += size
    if (size > MAX_OFFICE_XML_BYTES || totalSize > MAX_OFFICE_UNCOMPRESSED_BYTES) {
      throw new Error('This Office document expands beyond the safe preview size.')
    }
  }
  return archive
}

async function readXml(archive, path, label) {
  const entry = archive.file(path)
  if (!entry || entry.dir) throw new Error(`${label} is missing from the Office document.`)
  const source = await entry.async('string')
  return parseXml(source, label)
}

function relationshipId(node) {
  return node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    ?? Array.from(node.attributes).find((attribute) => attribute.localName === 'id')?.value
    ?? ''
}

function resolvePackageTarget(sourcePath, target, root) {
  if (!target || target.includes('://') || target.startsWith('//')) return null
  const parts = target.startsWith('/') ? [] : sourcePath.split('/').slice(0, -1)
  for (const part of target.replace(/^\/+/, '').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  const normalized = parts.join('/')
  return normalized.startsWith(`${root}/`) ? normalized : null
}

function columnIndex(reference) {
  const letters = reference.replace(/[^A-Za-z].*$/, '').replace(/\$/g, '').toUpperCase()
  let value = 0
  for (const letter of letters) value = value * 26 + letter.charCodeAt(0) - 64
  return value - 1
}

function cellText(cell, sharedStrings) {
  const type = cell.getAttribute('t')
  if (type === 'inlineStr') {
    const inline = directChild(cell, 'is')
    return inline ? localElements(inline, 't').map((node) => node.textContent ?? '').join('') : ''
  }
  const value = directChild(cell, 'v')?.textContent ?? ''
  if (type === 's') return sharedStrings[Number(value)] ?? ''
  if (type === 'b') return value === '1' ? 'TRUE' : value === '0' ? 'FALSE' : value
  if (type === 'e') return `Error: ${value}`
  if (directChild(cell, 'f') && !value) return 'Formula result unavailable'
  return value
}

export function parseCsv(source, delimiter = ',') {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  let truncatedRows = false
  let truncatedColumns = false
  const pushCell = () => {
    if (row.length < MAX_TABLE_COLUMNS) row.push(cell)
    else truncatedColumns = true
    cell = ''
  }
  const pushRow = () => {
    pushCell()
    if (rows.length < MAX_CSV_ROWS) rows.push(row)
    else truncatedRows = true
    row = []
  }

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (character === '"') quoted = false
      else cell += character
    } else if (character === '"' && cell.length === 0) quoted = true
    else if (character === delimiter) pushCell()
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      pushRow()
    } else cell += character
  }
  if (quoted) throw new Error('The CSV contains an unterminated quoted cell.')
  if (cell.length || row.length) pushRow()
  return { rows, truncatedRows, truncatedColumns }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function markdownInline(source) {
  return escapeHtml(source)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

export function renderMarkdown(source, DOMPurify) {
  const blocks = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let paragraph = []
  let list = []
  let code = null

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(markdownInline).join('<br>')}</p>`)
    paragraph = []
  }
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map((line) => `<li>${markdownInline(line)}</li>`).join('')}</ul>`)
    list = []
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      flushParagraph()
      flushList()
      if (code) {
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        code = null
      } else code = []
      continue
    }
    if (code) {
      code.push(line)
      continue
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    const bullet = line.match(/^\s*[-+*]\s+(.+)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const level = heading[1].length
      blocks.push(`<h${level}>${markdownInline(heading[2])}</h${level}>`)
    } else if (bullet || ordered) {
      flushParagraph()
      list.push((bullet ?? ordered)[1])
    } else if (quote) {
      flushParagraph()
      flushList()
      blocks.push(`<blockquote><p>${markdownInline(quote[1])}</p></blockquote>`)
    } else if (!line.trim()) {
      flushParagraph()
      flushList()
    } else {
      flushList()
      paragraph.push(line)
    }
  }
  if (code) blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  flushParagraph()
  flushList()

  return DOMPurify.sanitize(blocks.join(''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['a', 'img', 'iframe', 'object', 'embed', 'form', 'input', 'video', 'audio'],
    FORBID_ATTR: ['href', 'src', 'srcdoc', 'srcset', 'formaction'],
  })
}

export async function readXlsx(blob) {
  const archive = await loadOfficePackage(blob)
  const workbook = await readXml(archive, 'xl/workbook.xml', 'Workbook index')
  const relationships = await readXml(archive, 'xl/_rels/workbook.xml.rels', 'Workbook relationships')
  const targets = new Map(localElements(relationships, 'Relationship')
    .filter((node) => node.getAttribute('TargetMode') !== 'External')
    .map((node) => [node.getAttribute('Id'), node.getAttribute('Target')]))
  const sharedEntry = archive.file('xl/sharedStrings.xml')
  const sharedStrings = []
  if (sharedEntry) {
    const sharedXml = await readXml(archive, 'xl/sharedStrings.xml', 'Shared strings')
    for (const item of localElements(sharedXml, 'si')) {
      sharedStrings.push(localElements(item, 't').map((node) => node.textContent ?? '').join(''))
    }
  }

  const sheets = []
  let truncated = false
  for (const sheet of localElements(workbook, 'sheet')) {
    const target = targets.get(relationshipId(sheet))
    const path = resolvePackageTarget('xl/workbook.xml', target, 'xl')
    if (!path) continue
    const sheetXml = await readXml(archive, path, `Worksheet ${sheet.getAttribute('name') || sheets.length + 1}`)
    const rows = []
    for (const rowNode of localElements(sheetXml, 'row')) {
      const row = []
      for (const cell of Array.from(rowNode.children).filter((node) => node.localName === 'c')) {
        const index = columnIndex(cell.getAttribute('r') || '')
        if (index < 0) continue
        if (index >= MAX_TABLE_COLUMNS) {
          truncated = true
          continue
        }
        row[index] = cellText(cell, sharedStrings)
      }
      if (row.length > MAX_TABLE_COLUMNS) {
        row.length = MAX_TABLE_COLUMNS
        truncated = true
      }
      rows.push(row)
      if (rows.length >= MAX_CSV_ROWS) {
        truncated = localElements(sheetXml, 'row').length > rows.length || truncated
        break
      }
    }
    sheets.push({ name: sheet.getAttribute('name') || `Sheet ${sheets.length + 1}`, rows })
  }
  if (!sheets.length) throw new Error('The workbook does not contain a readable worksheet.')
  return { sheets, truncated }
}

export async function readPptx(blob) {
  const archive = await loadOfficePackage(blob)
  const presentation = await readXml(archive, 'ppt/presentation.xml', 'Presentation index')
  const relationships = await readXml(archive, 'ppt/_rels/presentation.xml.rels', 'Presentation relationships')
  const targets = new Map(localElements(relationships, 'Relationship')
    .filter((node) => node.getAttribute('TargetMode') !== 'External')
    .map((node) => [node.getAttribute('Id'), node.getAttribute('Target')]))
  const slideIds = localElements(presentation, 'sldId')
  const slides = []
  for (const slideId of slideIds) {
    const target = targets.get(relationshipId(slideId))
    const path = resolvePackageTarget('ppt/presentation.xml', target, 'ppt')
    if (!path) continue
    const slideXml = await readXml(archive, path, `Slide ${slides.length + 1}`)
    const paragraphs = localElements(slideXml, 'p').map((paragraph) =>
      localElements(paragraph, 't').map((node) => node.textContent ?? '').join(''),
    ).filter((text) => text.trim())
    slides.push({ number: slides.length + 1, paragraphs })
  }
  if (!slides.length) throw new Error('The presentation does not contain readable slides.')
  return slides
}

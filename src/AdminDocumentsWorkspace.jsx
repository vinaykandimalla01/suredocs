import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  aggregateDataNote,
  bytesLabel,
  categoryCounts,
  documentUsers,
  getEventsForDocument,
  getPermissionsForDocument,
  initialDocumentPermissions,
  mockAuditEvents,
  mockDocuments,
  monthlyTrendSeries,
  organizationDocumentMetrics,
  summarizePermissions,
  trendSeries,
} from './adminDocumentsMockData.js'
import './AdminDocumentsWorkspace.css'

const registryPageSizes = [10, 20, 50]
const statusValues = ['Active', 'Archived']
const accessValues = ['Read', 'Edit', 'Download', 'None']
const permissionAccessValues = ['Read', 'Edit', 'Download']
const trendColors = { total: '#377cf6', owned: '#22a879', shared: '#8b5de5' }

const iconContent = {
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.7 6.8-4.1m-6.8 6.7 6.8 4.1" /></>,
  storage: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.65 3.58 3 8 3s8-1.35 8-3V5M4 12c0 1.65 3.58 3 8 3s8-1.35 8-3" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  filter: <path d="M4 5h16l-6.3 7.2v5L10 19v-6.8L4 5Z" />,
  grid: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  arrow: <><path d="M5 12h14m-7-7 7 7-7 7" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5m5-5v12" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  plus: <path d="M12 5v14m-7-7h14" />,
  revoke: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  sort: <><path d="m8 7 4-4 4 4M12 3v18m4-4-4 4-4-4" /></>,
  pin: <><path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
}

function Icon({ name, className = '' }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      {iconContent[name] ?? iconContent.document}
    </svg>
  )
}

function formatDate(value, includeTime = false) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    timeZone: 'UTC',
  }).format(new Date(value))
}

function documentAccessLevel(document, permissions) {
  const activeLevels = getPermissionsForDocument(permissions, document.id)
    .filter((permission) => permission.status === 'Active')
    .map((permission) => permission.accessLevel)
  if (activeLevels.includes('Download')) return 'Download'
  if (activeLevels.includes('Edit')) return 'Edit'
  if (activeLevels.includes('Read')) return 'Read'
  return 'None'
}

function Avatar({ user, small = false }) {
  if (!user) return <span className={`docs-avatar${small ? ' is-small' : ''}`}>?</span>
  return <span aria-label={user.name} className={`docs-avatar${small ? ' is-small' : ''}`} title={user.name}>{user.initials}</span>
}

function FileTypeIcon({ fileType }) {
  const color = fileType === 'PDF' ? 'pdf' : fileType === 'XLSX' || fileType === 'CSV' ? 'sheet' : fileType === 'PPTX' ? 'slides' : fileType === 'ZIP' ? 'archive' : fileType === 'PNG' ? 'image' : fileType === 'TXT' || fileType === 'Other' ? 'text' : 'word'
  return <span aria-hidden="true" className={`docs-file-icon is-${color}`}>{fileType === 'Other' ? 'FILE' : fileType}</span>
}

function StatusBadge({ status }) {
  const className = status.toLowerCase().replace(/\s+/g, '-')
  return <span className={`docs-status-badge is-${className}`}>{status}</span>
}

function AccessBadge({ level }) {
  return <span className={`docs-access-badge is-${level.toLowerCase()}`}>{level}</span>
}

function MiniSparkline({ color, variant = 0 }) {
  const paths = ['M2 24 C16 23 19 17 30 18 S44 13 54 14 S70 7 86 4', 'M2 21 C12 18 19 20 28 15 S42 18 52 11 S68 12 86 3', 'M2 24 C13 22 18 11 29 14 S42 8 52 10 S68 6 86 3', 'M2 22 C14 20 20 15 29 17 S43 12 54 13 S69 6 86 4']
  return <svg aria-hidden="true" className="docs-sparkline" viewBox="0 0 88 28"><path d={paths[variant % paths.length]} fill="none" stroke={color} strokeLinecap="round" strokeWidth="2" /></svg>
}

function MetricCard({ label, value, detail, icon, color, variant = 0, onClick, compact = false }) {
  const content = (
    <>
      <span className="docs-metric-icon" style={{ color, backgroundColor: `${color}14` }}><Icon name={icon} /></span>
      <div className="docs-metric-copy">
        <span className="docs-metric-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
      <MiniSparkline color={color} variant={variant} />
    </>
  )
  if (onClick) {
    return <button className={`docs-metric-card is-clickable${compact ? ' is-compact' : ''}`} onClick={onClick} type="button">{content}<span className="docs-metric-open">View details <Icon name="arrow" /></span></button>
  }
  return <div className={`docs-metric-card${compact ? ' is-compact' : ''}`}>{content}</div>
}

function TrendChart({ scope, range, color }) {
  const data = range === '365'
    ? monthlyTrendSeries
    : range === '90'
      ? monthlyTrendSeries.slice(-3)
      : trendSeries
  const key = scope === 'owned' ? 'owned' : scope === 'shared' ? 'shared' : 'documents'
  const name = scope === 'owned' ? 'Owned documents' : scope === 'shared' ? 'Shared documents' : 'Documents'
  const title = scope === 'owned' ? 'Owned Documents Trend' : scope === 'shared' ? 'Shared Documents Trend' : 'Documents Trend'

  return (
    <section className="docs-panel docs-chart-panel">
      <div className="docs-panel-heading">
        <div><h2>{title}</h2><p>Document activity over time</p></div>
        <span className="docs-chart-legend"><i style={{ backgroundColor: color }} />{name}</span>
      </div>
      <div aria-label={`${name} trend chart`} className="docs-chart-area" role="img">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <defs><linearGradient id={`docs-fill-${scope}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.2} /><stop offset="95%" stopColor={color} stopOpacity={0.015} /></linearGradient></defs>
            <CartesianGrid stroke="#e9eef5" strokeDasharray="3 4" vertical={false} />
            <XAxis axisLine={false} dataKey="label" tick={{ fill: '#8995a8', fontSize: 9 }} tickLine={false} tickMargin={10} minTickGap={25} />
            <YAxis axisLine={false} tick={{ fill: '#8995a8', fontSize: 9 }} tickLine={false} tickMargin={8} width={42} />
            <Tooltip contentStyle={{ border: '1px solid #e1e8f1', borderRadius: 8, boxShadow: '0 8px 22px #253b5c12', fontSize: 11 }} labelStyle={{ color: '#66758c', fontSize: 10 }} formatter={(value) => [`${value.toLocaleString()} documents`, name]} />
            <Area activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} dataKey={key} dot={{ r: 2, fill: color, stroke: '#fff', strokeWidth: 1 }} fill={`url(#docs-fill-${scope})`} isAnimationActive={false} stroke={color} strokeWidth={2.2} type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function CategoryDonut({ scope, color }) {
  const rows = organizationDocumentMetrics.categories.map((entry) => ({
    name: entry.name,
    value: scope === 'owned' ? entry.owned : scope === 'shared' ? entry.shared : entry.count,
    color: entry.color,
  }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <section className="docs-panel docs-category-panel">
      <div className="docs-panel-heading"><div><h2>Documents by category</h2><p>Organization distribution</p></div><span className="docs-panel-dot" style={{ backgroundColor: color }} /></div>
      <div className="docs-donut-layout">
        <div className="docs-donut-wrap">
          <ResponsiveContainer height="100%" width="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" innerRadius="67%" isAnimationActive={false} outerRadius="90%" paddingAngle={2} stroke="#fff" strokeWidth={2}>
                {rows.map((row) => <Cell fill={row.color} key={row.name} />)}
              </Pie>
              <Tooltip contentStyle={{ border: '1px solid #e1e8f1', borderRadius: 8, fontSize: 11 }} formatter={(value, name) => [value.toLocaleString(), name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="docs-donut-center"><strong>{total.toLocaleString()}</strong><span>documents</span></div>
        </div>
        <div className="docs-category-legend">
          {rows.map((row) => <div className="docs-legend-row" key={row.name}><i style={{ backgroundColor: row.color }} /><span>{row.name}</span><strong>{row.value.toLocaleString()}</strong><small>{Math.round((row.value / total) * 100)}%</small></div>)}
        </div>
      </div>
    </section>
  )
}

function FileTypeChart({ scope }) {
  const rows = organizationDocumentMetrics.fileTypes.map((entry) => ({
    ...entry,
    value: scope === 'owned' ? entry.owned : scope === 'shared' ? entry.shared : entry.count,
  }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  const barColor = scope === 'owned' ? '#37a978' : scope === 'shared' ? '#8a60dc' : null
  const maximum = Math.max(...rows.map((row) => row.value))
  return (
    <section className="docs-panel docs-filetypes-panel">
      <div className="docs-panel-heading"><div><h2>Documents by file type</h2><p>File format distribution across the selected view</p></div><span className="docs-panel-dot" style={{ backgroundColor: trendColors[scope] }} /></div>
      <div className="docs-filetype-list">
        {rows.map((row) => <div className="docs-filetype-row" key={row.name}>
          <FileTypeIcon fileType={row.name === 'PNG / JPG' ? 'PNG' : row.name === 'CSV / Other' ? 'CSV' : row.name} />
          <span className="docs-filetype-name">{row.name}</span>
          <div aria-label={`${row.value.toLocaleString()} documents, ${Math.round((row.value / total) * 100)} percent`} className="docs-filetype-track" role="img">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={[{ name: row.name, value: row.value }]} layout="vertical" margin={{ top: 3, right: 0, left: 0, bottom: 3 }}>
                <XAxis axisLine={false} domain={[0, maximum]} hide type="number" />
                <YAxis axisLine={false} dataKey="name" hide type="category" />
                <Tooltip contentStyle={{ border: '1px solid #e1e8f1', borderRadius: 8, boxShadow: '0 8px 22px #253b5c12', fontSize: 10 }} cursor={false} formatter={(value) => [`${value.toLocaleString()} documents (${Math.round((value / total) * 100)}%)`, row.name]} />
                <Bar background={{ fill: '#f0f3f7', radius: 4 }} barSize={6} dataKey="value" isAnimationActive={false} radius={4}>
                  <Cell fill={barColor ?? row.color} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <strong>{row.value.toLocaleString()}</strong><small>{Math.round((row.value / total) * 100)}%</small>
        </div>)}
      </div>
    </section>
  )
}

function ChartGrid({ scope, range }) {
  return <div className="docs-analytics-grid"><TrendChart color={trendColors[scope]} range={range} scope={scope} /><CategoryDonut color={trendColors[scope]} scope={scope} /><FileTypeChart scope={scope} /></div>
}

function CategorySidebar({ selected, onSelect }) {
  return (
    <aside className="docs-category-sidebar">
      <div className="docs-category-heading"><span>Categories</span><button aria-label="Show all categories" onClick={() => onSelect('all')} type="button"><Icon name="filter" /></button></div>
      <button aria-pressed={selected === 'all'} className={`docs-category-item${selected === 'all' ? ' is-selected' : ''}`} onClick={() => onSelect('all')} type="button"><span className="docs-category-symbol is-all"><Icon name="document" /></span><span>All Documents</span><b>{organizationDocumentMetrics.total.toLocaleString()}</b></button>
      {categoryCounts.map((item, index) => <button aria-pressed={selected === item.name} className={`docs-category-item${selected === item.name ? ' is-selected' : ''}`} key={item.name} onClick={() => onSelect(item.name)} type="button"><span className={`docs-category-symbol tone-${index}`}><i /></span><span>{item.name}</span><b>{item.count.toLocaleString()}</b></button>)}
    </aside>
  )
}

function DocumentTable({ rows, selectedIds, onSelectedIdsChange, onOpenDocument, permissions, view = 'total', layout, onLayoutChange, sortKey, sortDirection, onSort, page, pageSize, onPageChange, onPageSizeChange, search, onSearchChange, category, onCategoryChange, status, onStatusChange, access, onAccessChange, fileType, onFileTypeChange, owner, onOwnerChange, onReset, filteredCount, showSharedWith = false, showAccessLevel = false, showOwnerFilter = false }) {
  const currentPageIds = rows.map((document) => document.id)
  const selectedOnPage = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id))
  const firstRow = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, filteredCount)
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize))
  const activeFilters = [search, category !== 'all', status !== 'all', access !== 'all', fileType !== 'all', owner !== 'all'].filter(Boolean).length

  function toggleOne(documentId) {
    onSelectedIdsChange(selectedIds.includes(documentId) ? selectedIds.filter((id) => id !== documentId) : [...selectedIds, documentId])
  }

  function togglePage() {
    onSelectedIdsChange(selectedOnPage ? selectedIds.filter((id) => !currentPageIds.includes(id)) : [...new Set([...selectedIds, ...currentPageIds])])
  }

  function sortButton(label, key) {
    return <button aria-label={`Sort by ${label}${sortKey === key ? `, ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`} className="docs-sort-button" onClick={() => onSort(key)} type="button">{label}<Icon name="sort" /></button>
  }

  function openFromRow(event, document) {
    if (event.target.closest('button, input, a, select, label')) return
    onOpenDocument(document.id)
  }

  const toolbar = (
    <>
      <div className="docs-registry-toolbar">
        <label className="docs-searchbox"><Icon name="search" /><span className="sr-only">Search documents</span><input aria-label="Search documents by name, owner, category, or metadata" onChange={(event) => onSearchChange(event.target.value)} placeholder="Search documents..." type="search" value={search} /></label>
        <select aria-label="Filter by category" className="docs-inline-filter is-category" onChange={(event) => onCategoryChange(event.target.value)} value={category}><option value="all">All Categories</option>{categoryCounts.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
        <select aria-label="Filter by status" className="docs-inline-filter is-status" onChange={(event) => onStatusChange(event.target.value)} value={status}><option value="all">All Status</option>{statusValues.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select aria-label="Filter by access level" className="docs-inline-filter is-access" onChange={(event) => onAccessChange(event.target.value)} value={access}><option value="all">All Access Levels</option>{accessValues.map((item) => <option key={item} value={item}>{item === 'None' ? 'No active access' : item}</option>)}</select>
        {view !== 'main' && <select aria-label="Filter by file type" className="docs-inline-filter is-file-type" onChange={(event) => onFileTypeChange(event.target.value)} value={fileType}><option value="all">All File Types</option>{['PDF', 'DOCX', 'XLSX', 'PPTX', 'TXT', 'ZIP', 'PNG', 'CSV'].map((item) => <option key={item} value={item}>{item}</option>)}</select>}
        {showOwnerFilter && <select aria-label="Filter by owner" className="docs-inline-filter is-owner" onChange={(event) => onOwnerChange(event.target.value)} value={owner}><option value="all">All Owners</option>{documentUsers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>}
        <div aria-label="Document view" className="docs-view-toggle" role="group"><button aria-label="List view" aria-pressed={layout === 'list'} className={layout === 'list' ? 'is-selected' : ''} onClick={() => onLayoutChange('list')} type="button"><Icon name="list" /></button><button aria-label="Grid view" aria-pressed={layout === 'grid'} className={layout === 'grid' ? 'is-selected' : ''} onClick={() => onLayoutChange('grid')} type="button"><Icon name="grid" /></button></div>
        <button className="docs-reset-button" onClick={onReset} type="button">Reset</button>
      </div>
      {activeFilters > 0 && <div className="docs-active-filters"><span><Icon name="filter" />{activeFilters} active filter{activeFilters === 1 ? '' : 's'}</span><button onClick={onReset} type="button">Clear all</button></div>}
    </>
  )

  const tableRows = rows.map((document) => {
    const ownerUser = documentUsers.find((person) => person.id === document.ownerId)
    const grants = getPermissionsForDocument(permissions, document.id).filter((grant) => grant.status === 'Active')
    return (
      <tr aria-label={`Open ${document.name}`} className="docs-table-row" key={document.id} onClick={(event) => openFromRow(event, document)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDocument(document.id) } }} tabIndex={0}>
        <td><input aria-label={`Select ${document.name}`} checked={selectedIds.includes(document.id)} onChange={() => toggleOne(document.id)} onClick={(event) => event.stopPropagation()} type="checkbox" /></td>
        <td className="docs-name-cell"><div className="docs-name-line"><FileTypeIcon fileType={document.fileType} /><button className="docs-document-name" onClick={() => onOpenDocument(document.id)} type="button">{document.name}</button></div><span className="docs-document-description">{document.description}</span></td>
        <td><span className="docs-owner-cell"><Avatar small user={ownerUser} /><span><b>{document.ownerName}</b><small>{document.ownerEmail}</small></span></span></td>
        <td><span className={`docs-category-pill cat-${document.category.toLowerCase()}`}>{document.category}</span></td>
        {showSharedWith && <td><span className="docs-shared-avatars">{grants.slice(0, 3).map((grant) => <Avatar key={grant.id} small user={documentUsers.find((person) => person.id === grant.userId)} />)}{grants.length > 3 && <span className="docs-avatar docs-avatar-more">+{grants.length - 3}</span>}</span></td>}
        <td>{formatDate(document.uploadDate)}</td>
        <td>{formatDate(document.lastModified)}</td>
        <td><span className="docs-type-cell"><FileTypeIcon fileType={document.fileType} /><small>{document.fileType}</small></span></td>
        <td className="docs-size-cell">{bytesLabel(document.fileSizeBytes)}</td>
        <td><StatusBadge status={document.status} /></td>
        {showAccessLevel && <td><AccessBadge level={documentAccessLevel(document, permissions)} /></td>}
        <td><span className="docs-active-count">{grants.length}<small>users</small></span></td>
        <td><button aria-label={`View details for ${document.name}`} className="docs-row-action" onClick={() => onOpenDocument(document.id)} type="button"><Icon name="eye" /><span>View</span></button></td>
      </tr>
    )
  })

  return (
    <section className="docs-panel docs-registry-panel">
      <div className="docs-registry-heading"><div><h2>{view === 'owned' ? 'Owned document registry' : view === 'shared' ? 'Shared document registry' : 'Document registry'}</h2><p>Showing {firstRow}–{lastRow} of {filteredCount} sample records</p></div>{view !== 'main' && <span className="docs-sample-count">{filteredCount} records</span>}</div>
      {toolbar}
      {layout === 'list' ? (
        <div className="docs-table-scroll">
          <table className={`docs-table${showSharedWith ? ' has-shared-column' : ''}${showAccessLevel ? ' has-access-column' : ''}`}>
            <thead><tr>
              <th><input aria-label="Select all rows on this page" checked={selectedOnPage} onChange={togglePage} type="checkbox" /></th>
              <th>{sortButton('Document name', 'name')}</th><th>{sortButton('Owner', 'ownerName')}</th><th>{sortButton('Category', 'category')}</th>
              {showSharedWith && <th>Shared with</th>}
              <th>{sortButton('Upload date', 'uploadDate')}</th><th>{sortButton('Last modified', 'lastModified')}</th><th>{sortButton('File type', 'fileType')}</th><th>{sortButton('Size', 'fileSizeBytes')}</th><th>{sortButton('Status', 'status')}</th>
              {showAccessLevel && <th>Access level</th>}<th>{sortButton('Active users', 'activeUsers')}</th><th>Actions</th>
            </tr></thead>
            <tbody>{tableRows}</tbody>
          </table>
          {rows.length === 0 && <div className="docs-empty-state"><span><Icon name="search" /></span><h3>No documents match these filters</h3><p>Clear a filter or try another search term.</p><button onClick={onReset} type="button">Reset filters</button></div>}
        </div>
      ) : (
        <div className="docs-card-grid">
          {rows.map((document) => {
            const ownerUser = documentUsers.find((person) => person.id === document.ownerId)
            const grants = getPermissionsForDocument(permissions, document.id).filter((grant) => grant.status === 'Active')
            return <article className="docs-document-card" key={document.id}>
              <div className="docs-document-card-top"><FileTypeIcon fileType={document.fileType} /><input aria-label={`Select ${document.name}`} checked={selectedIds.includes(document.id)} onChange={() => toggleOne(document.id)} type="checkbox" /></div>
              <button className="docs-document-card-name" onClick={() => onOpenDocument(document.id)} type="button">{document.name}</button>
              <p>{document.description}</p>
              <div className="docs-document-card-meta"><span><Avatar small user={ownerUser} />{document.ownerName}</span><span className={`docs-category-pill cat-${document.category.toLowerCase()}`}>{document.category}</span></div>
              <div className="docs-document-card-foot"><StatusBadge status={document.status} /><span>{bytesLabel(document.fileSizeBytes)} · {grants.length} active</span><button aria-label={`Open ${document.name}`} onClick={() => onOpenDocument(document.id)} type="button"><Icon name="arrow" /></button></div>
            </article>
          })}
          {rows.length === 0 && <div className="docs-empty-state"><span><Icon name="search" /></span><h3>No documents match these filters</h3><p>Clear a filter or try another search term.</p><button onClick={onReset} type="button">Reset filters</button></div>}
        </div>
      )}
      <footer className="docs-pagination"><span>Rows per page <select aria-label="Rows per page" onChange={(event) => onPageSizeChange(Number(event.target.value))} value={pageSize}>{registryPageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></span><span>{firstRow}–{lastRow} of {filteredCount}</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">‹</button><span>Page {page} of {pageCount}</span><button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">›</button></div></footer>
    </section>
  )
}

function DocumentRegistry({ scope = 'main', category, onCategoryChange, permissions, onOpenDocument, onVisibleRowsChange }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [access, setAccess] = useState('all')
  const [fileType, setFileType] = useState('all')
  const [owner, setOwner] = useState('all')
  const [layout, setLayout] = useState('list')
  const [sortKey, setSortKey] = useState('uploadDate')
  const [sortDirection, setSortDirection] = useState('desc')
  const [pageState, setPageState] = useState({ signature: '', value: 1 })
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState([])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const filtered = mockDocuments.filter((document) => {
      if (scope === 'owned' && !document.isOwned) return false
      if (scope === 'shared' && !document.isShared) return false
      if (category !== 'all' && document.category !== category) return false
      if (status !== 'all' && document.status !== status) return false
      const accessLevel = documentAccessLevel(document, permissions)
      if (access !== 'all' && accessLevel !== access) return false
      if (fileType !== 'all' && document.fileType !== fileType) return false
      if (owner !== 'all' && document.ownerId !== owner) return false
      if (!query) return true
      const sharedNames = getPermissionsForDocument(permissions, document.id)
        .map((permission) => documentUsers.find((person) => person.id === permission.userId)?.name ?? '')
        .join(' ')
      const searchable = [document.name, document.description, document.ownerName, document.ownerEmail, document.category, document.fileType, document.status, accessLevel, ...document.tags, sharedNames]
        .join(' ').toLocaleLowerCase()
      return searchable.includes(query)
    })

    const valueFor = (document) => sortKey === 'activeUsers'
      ? getPermissionsForDocument(permissions, document.id).filter((grant) => grant.status === 'Active').length
      : document[sortKey]
    return filtered.sort((first, second) => {
      const firstValue = valueFor(first)
      const secondValue = valueFor(second)
      const comparison = typeof firstValue === 'number'
        ? firstValue - secondValue
        : String(firstValue ?? '').localeCompare(String(secondValue ?? ''), undefined, { numeric: true, sensitivity: 'base' })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [access, category, fileType, owner, permissions, scope, search, sortDirection, sortKey, status])

  const pageSignature = JSON.stringify([access, category, fileType, owner, search, scope, status, pageSize, permissions.map((item) => `${item.id}:${item.status}`).join('|')])
  const page = pageState.signature === pageSignature ? pageState.value : 1
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visiblePage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)

  function changePage(value) {
    setPageState({ signature: pageSignature, value })
  }
  useEffect(() => { onVisibleRowsChange?.(filteredRows) }, [filteredRows, onVisibleRowsChange])

  function reset() {
    setSearch('')
    onCategoryChange('all')
    setStatus('all')
    setAccess('all')
    setFileType('all')
    setOwner('all')
    setSelectedIds([])
  }

  function sortBy(key) {
    if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDirection(key === 'name' || key === 'ownerName' ? 'asc' : 'desc')
    }
  }

  return <DocumentTable
    access={access}
    category={category}
    filteredCount={filteredRows.length}
    fileType={fileType}
    layout={layout}
    onAccessChange={setAccess}
    onCategoryChange={onCategoryChange}
    onFileTypeChange={setFileType}
    onLayoutChange={setLayout}
    onOpenDocument={onOpenDocument}
    onOwnerChange={setOwner}
    onPageChange={changePage}
    onPageSizeChange={setPageSize}
    onReset={reset}
    onSearchChange={setSearch}
    onSelectedIdsChange={setSelectedIds}
    onSort={sortBy}
    onStatusChange={setStatus}
    owner={owner}
    page={visiblePage}
    pageSize={pageSize}
    permissions={permissions}
    rows={pageRows}
    search={search}
    selectedIds={selectedIds}
    showOwnerFilter={scope === 'owned'}
    showSharedWith={scope === 'shared'}
    showAccessLevel={scope === 'total' || scope === 'shared'}
    sortDirection={sortDirection}
    sortKey={sortKey}
    status={status}
    view={scope}
  />
}

function RateMetricCard({ label, value, detail, color, percent }) {
  return <div className="docs-metric-card docs-rate-card"><div className="docs-rate-ring" style={{ '--docs-rate': `${percent}%`, '--docs-rate-color': color }}><strong>{percent}%</strong></div><div className="docs-metric-copy"><span className="docs-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div></div>
}

function MetricCards({ scope, navigate }) {
  const metrics = organizationDocumentMetrics
  if (scope === 'owned') {
    return <div className="docs-metric-grid is-four"><MetricCard color="#22a879" detail="Organization total" icon="document" label="Owned Documents" value={metrics.owned.toLocaleString()} variant={1} /><MetricCard color="#43b98b" detail="Across the organization" icon="users" label="Unique Owners" value={metrics.uniqueOwners.toLocaleString()} variant={3} /><MetricCard color="#1fa287" detail="Across owned records" icon="storage" label="Total Size (Owned)" value={bytesLabel(metrics.ownedStorageBytes)} variant={0} /><RateMetricCard color="#25a875" detail="14 documents need attention" label="Active Owned Docs" percent={Math.round((metrics.activeOwned / metrics.owned) * 100)} value={metrics.activeOwned.toLocaleString()} /></div>
  }
  if (scope === 'shared') {
    return <div className="docs-metric-grid is-four"><MetricCard color="#8b5de5" detail="Organization total" icon="share" label="Shared Documents" value={metrics.shared.toLocaleString()} variant={2} /><MetricCard color="#7759d8" detail="Owners with shared records" icon="users" label="Unique Document Owners" value={metrics.uniqueSharedOwners.toLocaleString()} variant={0} /><MetricCard color="#bd68c7" detail="Documents shared with users" icon="share" label="Shared With Users" value={metrics.sharedWithUsers.toLocaleString()} variant={1} /><MetricCard color="#38a8b6" detail="Across shared records" icon="storage" label="Total Size (Shared)" value={bytesLabel(metrics.sharedStorageBytes)} variant={3} /></div>
  }
  return <div className="docs-metric-grid is-four">
    <MetricCard color="#377cf6" detail="+12% from last month" icon="document" label="Total Documents" onClick={() => navigate('total')} value={metrics.total.toLocaleString()} variant={0} />
    <MetricCard color="#36ad7e" detail={`${Math.round((metrics.owned / metrics.total) * 100)}% of total`} icon="users" label="Owned Documents" onClick={() => navigate('owned')} value={metrics.owned.toLocaleString()} variant={1} />
    <MetricCard color="#8b5de5" detail={`${Math.round((metrics.shared / metrics.total) * 100)}% of total`} icon="share" label="Shared Documents" onClick={() => navigate('shared')} value={metrics.shared.toLocaleString()} variant={2} />
    <MetricCard color="#16a6a0" detail="Across all documents" icon="storage" label="Total Storage" value={bytesLabel(metrics.storageBytes)} variant={3} />
  </div>
}

function Breadcrumbs({ scope, onDocumentsClick }) {
  return <nav aria-label="Breadcrumb" className="docs-breadcrumbs"><button onClick={onDocumentsClick} type="button">Documents</button><span>/</span><span>{scope === 'total' ? 'Total Documents' : scope === 'owned' ? 'Owned Documents' : 'Shared Documents'}</span></nav>
}

function AnalyticsHeading({ scope, range, setRange, onExport, onDocumentsClick }) {
  const title = scope === 'total' ? 'Total Documents' : scope === 'owned' ? 'Owned Documents' : 'Shared Documents'
  const subtitle = scope === 'total'
    ? 'Comprehensive view of all documents in the organization.'
    : scope === 'owned'
      ? 'Documents uploaded and owned by users in the organization.'
      : 'Documents that have been shared with other users in the organization.'
  return <header className="docs-page-heading is-analytics">
    <div><Breadcrumbs onDocumentsClick={onDocumentsClick} scope={scope} /><h1>{title}</h1><p>{subtitle}</p></div>
    <div className="docs-heading-actions"><label className="docs-range-select"><Icon name="calendar" /><span className="sr-only">Date range</span><select aria-label="Date range" onChange={(event) => setRange(event.target.value)} value={range}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></label><button className="docs-export-button" onClick={onExport} type="button"><Icon name="upload" />Export CSV</button></div>
  </header>
}

function PermissionStatusSummary({ permissions, compact = false }) {
  const summary = summarizePermissions(permissions)
  const config = {
    Active: { icon: 'check', className: 'active' },
    Pending: { icon: 'clock', className: 'pending' },
    Expired: { icon: 'calendar', className: 'expired' },
    Revoked: { icon: 'revoke', className: 'revoked' },
  }
  return <div className={`docs-permission-summary${compact ? ' is-compact' : ''}`}>
    {summary.map((item) => <div className={`docs-permission-stat is-${config[item.status].className}`} key={item.status}><span><Icon name={config[item.status].icon} /></span><small>{item.status}</small><strong>{item.count}</strong></div>)}
  </div>
}

function OverviewTab({ document, permissions, events, tags, onShowAccess, onShowActivity, onAddTag }) {
  const [tagDraft, setTagDraft] = useState('')
  const activePermissions = permissions.filter((permission) => permission.status === 'Active')
  const recentEvents = events.slice(0, 3)
  const owner = documentUsers.find((person) => person.id === document.ownerId)

  function addTag(event) {
    event.preventDefault()
    const tag = tagDraft.trim()
    if (!tag || tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
    onAddTag(tag)
    setTagDraft('')
  }

  const details = [
    ['Document ID', document.documentId],
    ['Owner', owner?.name ?? document.ownerName],
    ['Owner email', owner?.email ?? document.ownerEmail],
    ['Category', document.category],
    ['File type', document.fileType],
    ['File size', bytesLabel(document.fileSizeBytes)],
    ['Uploaded', formatDate(document.uploadDate, true)],
    ['Last modified', formatDate(document.lastModified, true)],
    ['Status', document.status],
    ['Admin access', 'Metadata review'],
  ]

  return <div className="docs-overview-layout">
    <section className="docs-detail-card">
      <div className="docs-detail-card-heading"><div><h3>Document Details</h3><p>Registry metadata for this document</p></div><Icon name="info" /></div>
      <dl className="docs-detail-list">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === 'Status' ? <StatusBadge status={value} /> : value}</dd></div>)}
        <div className="is-description"><dt>Description</dt><dd>{document.description}</dd></div>
      </dl>
      <div className="docs-tags-section"><div><strong>Tags</strong><span>Document labels</span></div><div className="docs-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div><form className="docs-add-tag" onSubmit={addTag}><input aria-label="New document tag" maxLength={28} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add a tag" value={tagDraft} /><button aria-label="Add tag" disabled={!tagDraft.trim()} type="submit"><Icon name="plus" /></button></form></div>
      <p className="docs-metadata-notice"><Icon name="info" />Administrator view is limited to document metadata and recorded access information.</p>
    </section>
    <div className="docs-overview-side">
      <section className="docs-detail-card docs-overview-access">
        <div className="docs-detail-card-heading"><div><h3>Access Summary</h3><p>Permission records for this document</p></div><button className="docs-text-action" onClick={onShowAccess} type="button">View all <Icon name="arrow" /></button></div>
        <PermissionStatusSummary compact permissions={permissions} />
        <div className="docs-mini-list-heading"><strong>Shared With</strong><span>{activePermissions.length} active</span></div>
        <div className="docs-shared-user-list">{activePermissions.length ? activePermissions.slice(0, 4).map((permission) => {
          const person = documentUsers.find((item) => item.id === permission.userId)
          return <div className="docs-shared-user" key={permission.id}><Avatar user={person} /><span><b>{person?.name ?? 'Unknown user'}</b><small>Granted {formatDate(permission.grantedAt)}</small></span><AccessBadge level={permission.accessLevel} /></div>
        }) : <p className="docs-inline-empty">There are no active grants for this document.</p>}</div>
      </section>
      <section className="docs-detail-card docs-recent-activity">
        <div className="docs-detail-card-heading"><div><h3>Recent Activity</h3><p>Latest recorded events</p></div><button className="docs-text-action" onClick={onShowActivity} type="button">View all <Icon name="arrow" /></button></div>
        {recentEvents.length ? <div className="docs-recent-event-list">{recentEvents.map((event) => {
          const actor = documentUsers.find((person) => person.id === event.actorUserId)
          return <div className="docs-recent-event" key={event.id}><span className={`docs-event-icon is-${event.eventType}`}><Icon name={event.eventType === 'access' ? 'eye' : event.eventType === 'permission' ? 'users' : 'document'} /></span><span><b>{event.action}</b><small>{actor?.name ?? 'System'} · {formatDate(event.timestamp, true)}</small></span></div>
        })}</div> : <p className="docs-inline-empty">No activity has been recorded.</p>}
      </section>
    </div>
  </div>
}

function AccessSharingTab({ document, permissions, onGrant, onRevoke, onRevokeAll, settings, onSettingsChange }) {
  const [permissionSearch, setPermissionSearch] = useState('')
  const [permissionAccess, setPermissionAccess] = useState('all')
  const [selectedPermissions, setSelectedPermissions] = useState([])
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientId, setRecipientId] = useState('')
  const [accessLevel, setAccessLevel] = useState('')
  const [expiration, setExpiration] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const nextId = useRef(permissions.length + 1)

  const visiblePermissions = permissions.filter((permission) => {
    const person = documentUsers.find((item) => item.id === permission.userId)
    const query = permissionSearch.trim().toLowerCase()
    return (permissionAccess === 'all' || permission.accessLevel === permissionAccess) && (!query || `${person?.name} ${person?.email}`.toLowerCase().includes(query))
  })
  const recipientMatches = recipientQuery.trim()
    ? documentUsers.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(recipientQuery.trim().toLowerCase())).slice(0, 5)
    : []
  const selectedOnPage = visiblePermissions.length > 0 && visiblePermissions.every((permission) => selectedPermissions.includes(permission.id))

  function togglePermission(id) {
    setSelectedPermissions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function submitGrant(event) {
    event.preventDefault()
    if (!recipientId || !accessLevel) {
      setError('Choose a user and an access level before granting access.')
      return
    }
    const user = documentUsers.find((person) => person.id === recipientId)
    const requestedExpiration = expiration || (settings.defaultExpiration ? '2026-11-23' : '')
    onGrant({
      id: `PERM-MOCK-${String(nextId.current++).padStart(3, '0')}`,
      documentId: document.id,
      userId: user.id,
      accessLevel,
      grantedBy: 'USR-003',
      grantedAt: '2026-10-24T12:00:00.000Z',
      expiresAt: requestedExpiration ? new Date(`${requestedExpiration}T23:59:59.000Z`).toISOString() : null,
      status: 'Active',
    })
    setNotice(`Mock ${accessLevel.toLowerCase()} access granted to ${user.name}.`)
    setError('')
    setRecipientId('')
    setRecipientQuery('')
    setAccessLevel('')
    setExpiration('')
  }

  function revokePermission(permission) {
    const person = documentUsers.find((item) => item.id === permission.userId)
    if (!window.confirm(`Revoke ${permission.accessLevel.toLowerCase()} access for ${person?.name ?? 'this user'} on “${document.name}”? This updates this local mock record only.`)) return
    onRevoke(permission.id)
    setNotice(`Mock access for ${person?.name ?? 'the user'} was revoked.`)
  }

  function revokeAll() {
    const activeCount = permissions.filter((permission) => permission.status === 'Active' || permission.status === 'Pending').length
    if (!activeCount) return
    if (!window.confirm(`Revoke all ${activeCount} active or pending grants for “${document.name}”? The change applies to this local mock preview only.`)) return
    onRevokeAll()
    setNotice('All active and pending mock grants were revoked.')
  }

  return <div className="docs-access-tab">
    <PermissionStatusSummary permissions={permissions} />
    <div className="docs-access-layout">
      <section className="docs-detail-card docs-permission-list-card">
        <div className="docs-detail-card-heading"><div><h3>User Access List</h3><p>{visiblePermissions.length} permission records for this document</p></div><span className="docs-local-pill">Mock data</span></div>
        <div className="docs-permission-toolbar"><label className="docs-searchbox"><Icon name="search" /><span className="sr-only">Search permissions</span><input aria-label="Search users by name or email" onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Search users or email..." type="search" value={permissionSearch} /></label><label className="docs-compact-select"><span className="sr-only">Filter permissions by access level</span><select aria-label="Filter by access level" onChange={(event) => setPermissionAccess(event.target.value)} value={permissionAccess}><option value="all">All access</option>{permissionAccessValues.map((level) => <option key={level} value={level}>{level}</option>)}</select></label></div>
        <div className="docs-permission-table-wrap"><table className="docs-permission-table"><thead><tr><th><input aria-label="Select all permission rows" checked={selectedOnPage} onChange={() => setSelectedPermissions(selectedOnPage ? selectedPermissions.filter((id) => !visiblePermissions.some((permission) => permission.id === id)) : [...new Set([...selectedPermissions, ...visiblePermissions.map((permission) => permission.id)])])} type="checkbox" /></th><th>User</th><th>Email</th><th>Access level</th><th>Granted by</th><th>Granted on</th><th>Expires on</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{visiblePermissions.map((permission) => {
            const person = documentUsers.find((item) => item.id === permission.userId)
            const grantor = documentUsers.find((item) => item.id === permission.grantedBy)
            return <tr key={permission.id}><td><input aria-label={`Select permission for ${person?.name ?? 'user'}`} checked={selectedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} type="checkbox" /></td><td><span className="docs-permission-person"><Avatar small user={person} /><b>{person?.name ?? 'Unknown user'}</b></span></td><td>{person?.email ?? '—'}</td><td><AccessBadge level={permission.accessLevel} /></td><td>{grantor?.name ?? 'Administrator'}</td><td>{formatDate(permission.grantedAt)}</td><td>{permission.expiresAt ? formatDate(permission.expiresAt) : 'Never'}</td><td><StatusBadge status={permission.status} /></td><td>{permission.status === 'Active' || permission.status === 'Pending' ? <button className="docs-revoke-button" onClick={() => revokePermission(permission)} type="button">Revoke</button> : <span className="docs-action-muted">—</span>}</td></tr>
          })}</tbody></table>
          {visiblePermissions.length === 0 && <div className="docs-table-empty">No permission records match this search.</div>}
        </div>
        <p className="docs-table-footnote">Permission changes here update only this browser session's mock data.</p>
      </section>
      <aside className="docs-sharing-controls">
        <section className="docs-detail-card docs-share-form-card"><div className="docs-detail-card-heading"><div><h3>Share Document</h3><p>Grant a user access in this preview</p></div><span className="docs-share-form-icon"><Icon name="share" /></span></div>
          <form onSubmit={submitGrant}>
            <label className="docs-form-label">Find a user<input aria-label="Search users by name or email to share this document" autoComplete="off" onChange={(event) => { setRecipientQuery(event.target.value); setRecipientId('') }} placeholder="Name or email address" value={recipientQuery} />
              {recipientMatches.length > 0 && !recipientId && <span className="docs-user-suggestions" role="listbox">{recipientMatches.map((person) => <button aria-selected={false} key={person.id} onClick={() => { setRecipientId(person.id); setRecipientQuery(`${person.name} · ${person.email}`) }} role="option" type="button"><Avatar small user={person} /><span><b>{person.name}</b><small>{person.email}</small></span></button>)}</span>}
            </label>
            {recipientId && <p className="docs-selected-user"><Icon name="check" />{documentUsers.find((person) => person.id === recipientId)?.name} selected</p>}
            <label className="docs-form-label">Access level<select aria-label="Access level to grant" onChange={(event) => setAccessLevel(event.target.value)} required value={accessLevel}><option disabled value="">Select an access level</option><option value="Read">Read</option><option value="Edit">Edit</option><option disabled={!settings.allowDownload} value="Download">Download{settings.allowDownload ? '' : ' (disabled in settings)'}</option></select></label>
            <label className="docs-form-label">Expiration date <span className="docs-optional">Optional</span><input aria-label="Optional access expiration date" min="2026-10-24" onChange={(event) => setExpiration(event.target.value)} type="date" value={expiration} /></label>
            {settings.defaultExpiration && !expiration && <p className="docs-default-expiration">Default expiration: 30 days (Nov 23, 2026)</p>}
            <button className="docs-grant-button" disabled={!recipientId || !accessLevel} type="submit"><Icon name="plus" />Grant Access</button>
          </form>
          {error && <p className="docs-form-feedback is-error" role="alert">{error}</p>}
          {notice && <p className="docs-form-feedback" role="status">{notice}</p>}
        </section>
        <section className="docs-detail-card docs-settings-card"><div className="docs-detail-card-heading"><div><h3>Access Settings</h3><p>Local sharing preferences</p></div></div>
          <label className="docs-setting-row"><span><b>Allow resharing</b><small>Recipients may share this record onward</small></span><input checked={settings.allowResharing} onChange={(event) => onSettingsChange('allowResharing', event.target.checked)} type="checkbox" /></label>
          <label className="docs-setting-row"><span><b>Allow download access</b><small>Enable the Download permission level</small></span><input checked={settings.allowDownload} onChange={(event) => onSettingsChange('allowDownload', event.target.checked)} type="checkbox" /></label>
          <label className="docs-setting-row"><span><b>Default expiration</b><small>New grants expire after 30 days</small></span><input checked={settings.defaultExpiration} onChange={(event) => onSettingsChange('defaultExpiration', event.target.checked)} type="checkbox" /></label>
        </section>
        <section className="docs-danger-zone"><div><strong>Revoke all access</strong><p>Mark active and pending grants as revoked for this document.</p></div><button disabled={!permissions.some((permission) => permission.status === 'Active' || permission.status === 'Pending')} onClick={revokeAll} type="button"><Icon name="revoke" />Revoke All</button></section>
      </aside>
    </div>
  </div>
}

function ActivityLogTab({ document, events }) {
  const [query, setQuery] = useState('')
  const [eventType, setEventType] = useState('all')
  const [actorId, setActorId] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [pageState, setPageState] = useState({ signature: '', value: 1 })
  const [pageSize, setPageSize] = useState(6)
  const summary = useMemo(() => ({
    total: events.length,
    access: events.filter((event) => event.eventType === 'access').length,
    modification: events.filter((event) => event.eventType === 'modification').length,
    permission: events.filter((event) => event.eventType === 'permission').length,
  }), [events])

  const filteredEvents = events.filter((event) => {
    const actor = documentUsers.find((person) => person.id === event.actorUserId)
    const queryMatch = !query.trim() || `${event.action} ${event.details} ${actor?.name} ${actor?.email}`.toLowerCase().includes(query.trim().toLowerCase())
    const typeMatch = eventType === 'all' || event.eventType === eventType
    const userMatch = actorId === 'all' || event.actorUserId === actorId
    const days = dateRange === '7' ? 7 : dateRange === '30' ? 30 : Infinity
    const dateMatch = Date.parse('2026-10-24T23:59:59.999Z') - new Date(event.timestamp).getTime() <= days * 86400000
    return queryMatch && typeMatch && userMatch && dateMatch
  })
  const pageSignature = JSON.stringify([actorId, dateRange, eventType, query, pageSize])
  const page = pageState.signature === pageSignature ? pageState.value : 1
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const visiblePage = Math.min(page, pageCount)
  const pageEvents = filteredEvents.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)

  function changePage(value) {
    setPageState({ signature: pageSignature, value })
  }

  function reset() {
    setQuery('')
    setEventType('all')
    setActorId('all')
    setDateRange('all')
  }

  const cards = [
    ['Total Events', summary.total, 'All recorded events', 'all'],
    ['Access Events', summary.access, 'Views and access attempts', 'access'],
    ['Modification Events', summary.modification, 'Uploads and metadata updates', 'modification'],
    ['Permission Events', summary.permission, 'Grants and revocations', 'permission'],
  ]

  return <div className="docs-activity-tab">
    <div className="docs-activity-metrics">{cards.map(([label, value, detail, type]) => <div className={`docs-activity-metric is-${type}`} key={label}><span className={`docs-event-icon is-${type}`}><Icon name={type === 'access' ? 'eye' : type === 'permission' ? 'users' : type === 'modification' ? 'document' : 'clock'} /></span><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>)}</div>
    <p className="docs-activity-note">Event families are assigned one category each. System events appear only in Total Events.</p>
    <section className="docs-detail-card docs-audit-panel">
      <div className="docs-detail-card-heading"><div><h3>Activity Log</h3><p>{filteredEvents.length} recorded events for {document.name}</p></div><span className="docs-local-pill">Mock audit data</span></div>
      <div className="docs-audit-filters"><label className="docs-searchbox"><Icon name="search" /><span className="sr-only">Search events</span><input aria-label="Search events by user, action, or details" onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." type="search" value={query} /></label><label><span className="sr-only">Filter by event type</span><select aria-label="Filter by event type" onChange={(event) => setEventType(event.target.value)} value={eventType}><option value="all">All event types</option><option value="access">Access</option><option value="modification">Modification</option><option value="permission">Permission</option></select></label><label><span className="sr-only">Filter by user</span><select aria-label="Filter by user" onChange={(event) => setActorId(event.target.value)} value={actorId}><option value="all">All users</option>{documentUsers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span className="sr-only">Filter by date range</span><select aria-label="Filter by date range" onChange={(event) => setDateRange(event.target.value)} value={dateRange}><option value="all">All dates</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label><button className="docs-reset-button" onClick={reset} type="button">Reset</button></div>
      <div className="docs-audit-layout">
        <div className="docs-audit-table-wrap"><table className="docs-audit-table"><thead><tr><th>Timestamp</th><th>Event</th><th>User</th><th>IP address</th><th>Result</th><th>Details</th></tr></thead><tbody>{pageEvents.map((event) => {
          const actor = documentUsers.find((person) => person.id === event.actorUserId)
          return <tr key={event.id}><td>{formatDate(event.timestamp, true)}</td><td><span className={`docs-event-type is-${event.eventType}`}>{event.eventType}</span><b>{event.action}</b></td><td>{actor?.name ?? 'System'}</td><td className="docs-mono">{event.ipAddress}</td><td><span className={`docs-result-badge is-${event.result.toLowerCase()}`}>{event.result}</span></td><td>{event.details}</td></tr>
        })}</tbody></table>
        {pageEvents.length === 0 && <div className="docs-table-empty">No audit events match these filters.</div>}
        <footer className="docs-pagination is-audit"><span>Rows <select aria-label="Audit rows per page" onChange={(event) => setPageSize(Number(event.target.value))} value={pageSize}><option value={6}>6</option><option value={10}>10</option><option value={20}>20</option></select></span><span>{filteredEvents.length === 0 ? 0 : (visiblePage - 1) * pageSize + 1}–{Math.min(visiblePage * pageSize, filteredEvents.length)} of {filteredEvents.length}</span><div><button aria-label="Previous audit page" disabled={visiblePage <= 1} onClick={() => changePage(visiblePage - 1)} type="button">‹</button><span>Page {visiblePage} of {pageCount}</span><button aria-label="Next audit page" disabled={visiblePage >= pageCount} onClick={() => changePage(visiblePage + 1)} type="button">›</button></div></footer>
        </div>
        <aside className="docs-timeline"><div className="docs-timeline-heading"><h3>Event Timeline</h3><span>{pageEvents.length} events</span></div>
          {pageEvents.length ? <div className="docs-timeline-list">{pageEvents.map((event) => {
            const actor = documentUsers.find((person) => person.id === event.actorUserId)
            return <article className="docs-timeline-event" key={event.id}><span className={`docs-timeline-marker is-${event.eventType}`}><Icon name={event.eventType === 'access' ? 'eye' : event.eventType === 'permission' ? 'users' : 'document'} /></span><div><small>{formatDate(event.timestamp, true)}</small><b>{event.action}</b><p>{event.details}</p><span className="docs-timeline-actor">{actor?.name ?? 'System'} · {event.result}</span></div></article>
          })}</div> : <p className="docs-inline-empty">No events to show in this range.</p>}
          <p className="docs-timeline-caption">Timeline and table show the same filtered page of events.</p>
        </aside>
      </div>
    </section>
  </div>
}

function DocumentDetailsModal({ document, permissions, events, activeTab, onTabChange, onClose, onGrant, onRevoke, onRevokeAll, sharingSettings, onSettingsChange, tags, onAddTag }) {
  const closeButton = useRef(null)
  const owner = documentUsers.find((person) => person.id === document.ownerId)
  const tabs = ['Overview', 'Access & Sharing', 'Activity Log']

  useEffect(() => {
    const previousOverflow = documentBodyOverflow()
    globalThis.document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    function closeOnEscape(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      globalThis.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [document.id, onClose])

  return <div className="docs-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <section aria-labelledby="docs-modal-title" aria-modal="true" className="docs-details-modal" role="dialog">
      <header className="docs-modal-header"><div className="docs-modal-file-icon"><FileTypeIcon fileType={document.fileType} /></div><div className="docs-modal-heading-copy"><div className="docs-modal-title-line"><h2 id="docs-modal-title">{document.name}</h2><StatusBadge status={document.status} /></div><div className="docs-modal-meta"><span>{document.fileType}</span><i /> <span>{bytesLabel(document.fileSizeBytes)}</span><i /> <span className={`docs-category-pill cat-${document.category.toLowerCase()}`}>{document.category}</span><i /> <span>Uploaded {formatDate(document.uploadDate)}</span></div></div><button aria-label="Close document details" className="docs-modal-close" onClick={onClose} ref={closeButton} type="button"><Icon name="close" /></button></header>
      <div aria-label="Document details tabs" className="docs-modal-tabs" role="tablist">{tabs.map((tab) => {
        const key = tab === 'Overview' ? 'overview' : tab === 'Access & Sharing' ? 'access' : 'activity'
        const selected = activeTab === key
        return <button aria-controls={`docs-tab-panel-${key}`} aria-selected={selected} className={selected ? 'is-active' : ''} id={`docs-tab-${key}`} key={key} onClick={() => onTabChange(key)} onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const currentIndex = tabs.findIndex((item) => item === tab)
          const nextIndex = (currentIndex + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
          globalThis.document.getElementById(`docs-tab-${tabs[nextIndex] === 'Overview' ? 'overview' : tabs[nextIndex] === 'Access & Sharing' ? 'access' : 'activity'}`)?.focus()
          onTabChange(tabs[nextIndex] === 'Overview' ? 'overview' : tabs[nextIndex] === 'Access & Sharing' ? 'access' : 'activity')
        }} role="tab" tabIndex={selected ? 0 : -1} type="button">{tab}</button>
      })}</div>
      <div className="docs-modal-content" id={`docs-tab-panel-${activeTab}`} aria-labelledby={`docs-tab-${activeTab}`} role="tabpanel">
        {activeTab === 'overview' && <OverviewTab document={document} events={events} onAddTag={onAddTag} onShowAccess={() => onTabChange('access')} onShowActivity={() => onTabChange('activity')} permissions={permissions} tags={tags} />}
        {activeTab === 'access' && <AccessSharingTab document={document} onGrant={onGrant} onRevoke={onRevoke} onRevokeAll={onRevokeAll} onSettingsChange={onSettingsChange} permissions={permissions} settings={sharingSettings} />}
        {activeTab === 'activity' && <ActivityLogTab document={document} events={events} />}
      </div>
      <footer className="docs-modal-footer"><span><Icon name="pin" />{owner?.name ?? document.ownerName} · Document ID {document.documentId}</span><span>Local preview interactions</span></footer>
    </section>
  </div>
}

function documentBodyOverflow() {
  return document.body.style.overflow
}

const validDocumentViews = new Set(['main', 'total', 'owned', 'shared'])

function readDocumentView() {
  const requested = new URLSearchParams(window.location.search).get('view') ?? 'main'
  return validDocumentViews.has(requested) ? requested : 'main'
}

function csvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export default function AdminDocumentsWorkspace({ initialDocumentId, onOpenDocument, onCloseDocument }) {
  const [view, setView] = useState(readDocumentView)
  const [dateRange, setDateRange] = useState('30')
  const [category, setCategory] = useState('all')
  const [permissions, setPermissions] = useState(() => initialDocumentPermissions)
  const [auditEvents, setAuditEvents] = useState(() => mockAuditEvents)
  const [sharingSettings, setSharingSettings] = useState(() => Object.fromEntries(mockDocuments.map((document, index) => [document.id, {
    allowResharing: index % 2 === 0,
    allowDownload: index % 3 === 0,
    defaultExpiration: index % 4 === 0,
  }])))
  const [tagsByDocument, setTagsByDocument] = useState({})
  const [tabSelection, setTabSelection] = useState(() => ({ documentId: initialDocumentId ?? null, tab: 'overview' }))
  const [uploadInfoOpen, setUploadInfoOpen] = useState(false)
  const [exportRows, setExportRows] = useState(mockDocuments)
  const nextAuditId = useRef(1)
  const selectedDocument = mockDocuments.find((document) => document.id === initialDocumentId) ?? null
  const selectedPermissions = selectedDocument ? getPermissionsForDocument(permissions, selectedDocument.id) : []
  const selectedEvents = selectedDocument ? getEventsForDocument(auditEvents, selectedDocument.id) : []
  const selectedSettings = selectedDocument ? sharingSettings[selectedDocument.id] : null
  const selectedTags = selectedDocument ? tagsByDocument[selectedDocument.id] ?? selectedDocument.tags : []
  const activeTab = selectedDocument && tabSelection.documentId === selectedDocument.id ? tabSelection.tab : 'overview'
  const isAnalytics = view !== 'main'

  const rememberExportRows = useMemo(() => (rows) => setExportRows(rows), [])

  useEffect(() => {
    function syncView() { setView(readDocumentView()) }
    window.addEventListener('popstate', syncView)
    return () => window.removeEventListener('popstate', syncView)
  }, [])

  function changeDocumentTab(tab) {
    setTabSelection({ documentId: selectedDocument?.id ?? initialDocumentId ?? null, tab })
  }

  function navigate(nextView) {
    const next = validDocumentViews.has(nextView) ? nextView : 'main'
    const query = next === 'main' ? '' : `?view=${next}`
    window.history.pushState({}, '', `/admin/documents${query}`)
    setView(next)
    if (next !== 'main') setCategory('all')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openDetails(documentId) {
    setTabSelection({ documentId, tab: 'overview' })
    onOpenDocument(documentId)
  }

  function exportCsv() {
    const header = ['Document ID', 'Document Name', 'Owner', 'Owner Email', 'Category', 'Upload Date', 'Last Modified', 'File Type', 'Size', 'Status', 'Access Level']
    const records = exportRows.map((document) => [document.documentId, document.name, document.ownerName, document.ownerEmail, document.category, formatDate(document.uploadDate), formatDate(document.lastModified), document.fileType, bytesLabel(document.fileSizeBytes), document.status, documentAccessLevel(document, permissions)])
    const csv = [header, ...records].map((row) => row.map(csvValue).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = globalThis.document.createElement('a')
    anchor.href = url
    anchor.download = `suredocs-${view}-documents.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function appendAuditEvent(documentId, action, details) {
    const event = {
      id: `AUD-MOCK-${String(nextAuditId.current++).padStart(3, '0')}`,
      documentId,
      actorUserId: 'USR-003',
      action,
      timestamp: '2026-10-24T12:00:00.000Z',
      result: 'Recorded',
      ipAddress: '10.24.3.24',
      details,
      eventType: 'permission',
    }
    setAuditEvents((current) => [event, ...current])
  }

  function grantPermission(permission) {
    const existing = permissions.find((item) => item.documentId === permission.documentId && item.userId === permission.userId)
    if (existing) {
      setPermissions((current) => current.map((item) => item.id === existing.id ? { ...item, ...permission, id: existing.id } : item))
    } else {
      setPermissions((current) => [...current, permission])
    }
    const person = documentUsers.find((item) => item.id === permission.userId)
    appendAuditEvent(permission.documentId, 'Permission granted', `${permission.accessLevel} access was granted to ${person?.name ?? 'a user'} in this local preview.`)
  }

  function revokePermission(permissionId) {
    const permission = permissions.find((item) => item.id === permissionId)
    if (!permission) return
    setPermissions((current) => current.map((item) => item.id === permissionId ? { ...item, status: 'Revoked' } : item))
    const person = documentUsers.find((item) => item.id === permission.userId)
    appendAuditEvent(permission.documentId, 'Permission revoked', `Access for ${person?.name ?? 'a user'} was revoked in this local preview.`)
  }

  function revokeAllPermissions() {
    if (!selectedDocument) return
    const count = selectedPermissions.filter((permission) => permission.status === 'Active' || permission.status === 'Pending').length
    setPermissions((current) => current.map((permission) => permission.documentId === selectedDocument.id && (permission.status === 'Active' || permission.status === 'Pending')
      ? { ...permission, status: 'Revoked' }
      : permission))
    appendAuditEvent(selectedDocument.id, 'Permissions revoked', `${count} active or pending grants were revoked in this local preview.`)
  }

  function updateSharingSetting(key, value) {
    if (!selectedDocument) return
    setSharingSettings((current) => ({
      ...current,
      [selectedDocument.id]: { ...current[selectedDocument.id], [key]: value },
    }))
  }

  function addDocumentTag(tag) {
    if (!selectedDocument) return
    setTagsByDocument((current) => ({
      ...current,
      [selectedDocument.id]: [...(current[selectedDocument.id] ?? selectedDocument.tags), tag],
    }))
  }

  const currentScope = view === 'main' ? 'main' : view
  const currentTitle = view === 'total' ? 'Total Documents' : view === 'owned' ? 'Owned Documents' : view === 'shared' ? 'Shared Documents' : 'Documents'

  return <div className={`admin-documents-workspace is-${view}`}>
    {!isAnalytics ? <>
      <header className="docs-page-heading">
        <div><h1>Documents</h1><p>Manage all documents in the organization. View, search, and monitor document activity.</p></div>
        <button className="docs-upload-button" onClick={() => setUploadInfoOpen(true)} type="button"><Icon name="upload" />Upload Document</button>
      </header>
      <MetricCards navigate={navigate} scope="main" />
      <div className="docs-main-layout">
        <CategorySidebar onSelect={setCategory} selected={category} />
        <div className="docs-main-registry"><DocumentRegistry category={category} onCategoryChange={setCategory} onOpenDocument={openDetails} onVisibleRowsChange={rememberExportRows} permissions={permissions} scope="main" /><p className="docs-data-note"><Icon name="info" />{aggregateDataNote}</p></div>
      </div>
    </> : <>
      <AnalyticsHeading onDocumentsClick={() => navigate('main')} onExport={exportCsv} range={dateRange} scope={currentScope} setRange={setDateRange} />
      <MetricCards navigate={navigate} scope={currentScope} />
      <ChartGrid range={dateRange} scope={currentScope} />
      <div className="docs-analytics-registry"><div className="docs-registry-intro"><div><h2>{currentTitle} Registry</h2><p>Search, filter, and review the matching organization records.</p></div><span className="docs-sample-pill">Curated mock sample</span></div><DocumentRegistry category={category} onCategoryChange={setCategory} onOpenDocument={openDetails} onVisibleRowsChange={rememberExportRows} permissions={permissions} scope={currentScope} /><p className="docs-data-note"><Icon name="info" />{aggregateDataNote}</p></div>
    </>}
    {selectedDocument && selectedSettings && <DocumentDetailsModal activeTab={activeTab} document={selectedDocument} events={selectedEvents} onAddTag={addDocumentTag} onClose={onCloseDocument} onGrant={grantPermission} onRevoke={revokePermission} onRevokeAll={revokeAllPermissions} onSettingsChange={updateSharingSetting} onTabChange={changeDocumentTab} permissions={selectedPermissions} sharingSettings={selectedSettings} tags={selectedTags} />}
    {uploadInfoOpen && <div className="docs-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setUploadInfoOpen(false) }}><section aria-labelledby="docs-upload-info-title" aria-modal="true" className="docs-upload-info-modal" role="dialog"><span className="docs-upload-info-icon"><Icon name="upload" /></span><h2 id="docs-upload-info-title">Upload Document</h2><p>The admin Documents workspace is using seeded mock data for this preview. File upload and storage are not connected here.</p><div className="docs-upload-info-note"><Icon name="info" />This preview will not upload a file or change PostgreSQL or S3.</div><button className="docs-export-button" onClick={() => setUploadInfoOpen(false)} type="button">Close</button></section></div>}
  </div>
}

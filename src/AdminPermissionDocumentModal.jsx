import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { apiDelete, apiGet } from './api.js'

const ACCESS_ACTIONS = new Set(['PERMISSION_GRANTED', 'PERMISSION_REVOKED'])

function formatDate(value, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : {}),
    timeZone: 'UTC',
  }).format(date) + (withTime ? ' UTC' : '')
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unit = units[0]
  for (let index = 1; size >= 1024 && index < units.length; index += 1) {
    size /= 1024
    unit = units[index]
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`
}

function initials(name) {
  return (name || 'Unknown user').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function getPermissionType(event) {
  const details = event.details || {}
  if (typeof details.can_view !== 'boolean' || typeof details.can_download !== 'boolean') return 'Not recorded'
  return details.can_download ? 'Read + Download' : details.can_view ? 'Read' : 'Not recorded'
}

function displayAction(action) {
  return (action || 'Unknown action').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusStyle(status) {
  const normalizedStatus = String(status || '').toLowerCase()
  if (normalizedStatus === 'active') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (normalizedStatus === 'expired') return 'bg-amber-50 text-amber-700 ring-amber-200'
  if (normalizedStatus === 'revoked') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function StatusBadge({ status }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyle(status)}`}>{status}</span>
}

function PersonMark({ name, tone = 'blue' }) {
  const tones = tone === 'indigo' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
  return <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${tones}`}>{initials(name)}</span>
}

function FileMark({ filename }) {
  const extension = (filename || '').split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'
  const color = ['XLS', 'XLSX', 'CSV'].includes(extension) ? 'bg-emerald-600' : ['PPT', 'PPTX'].includes(extension) ? 'bg-orange-500' : extension === 'PDF' ? 'bg-rose-600' : 'bg-blue-600'
  return <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color} text-[10px] font-bold tracking-wide text-white`}>{extension}</span>
}

function EmptyState({ title, message }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
    <p className="text-sm font-semibold text-slate-700">{title}</p>
    <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">{message}</p>
  </div>
}

function DateRangeFilters({ from, to, onFromChange, onToChange }) {
  return <div className="grid grid-cols-2 gap-2">
    <label className="block text-[11px] font-medium text-slate-600">From
      <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => onFromChange(event.target.value)} type="date" value={from} />
    </label>
    <label className="block text-[11px] font-medium text-slate-600">To
      <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => onToChange(event.target.value)} type="date" value={to} />
    </label>
  </div>
}

function matchesDateRange(value, from, to) {
  if (!value) return false
  const day = new Date(value).toISOString().slice(0, 10)
  return (!from || day >= from) && (!to || day <= to)
}

function AccessHistory({ events }) {
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const records = useMemo(() => events
    .filter((event) => ACCESS_ACTIONS.has(event.action_type))
    .filter((event) => eventType === 'all' || event.action_type === eventType)
    .filter((event) => (!from && !to) || matchesDateRange(event.occurred_at, from, to))
    .filter((event) => {
      const needle = search.trim().toLowerCase()
      return !needle || [event.actor_name, event.actor_email, event.target_name, event.target_email, event.action_type, event.result, event.details?.reason].filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
    .sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at)), [events, eventType, from, search, to])

  return <section aria-label="Access history" className="space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">Access History</h3>
      <p className="mt-1 text-xs text-slate-500">Permission grants and revocations recorded for this document.</p>
    </div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_190px_260px]">
      <label className="relative block"><span className="sr-only">Search access history</span><span aria-hidden="true" className="absolute left-3 top-[11px] text-slate-400">⌕</span><input className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearch(event.target.value)} placeholder="Search people, event, or reason" value={search} /></label>
      <label className="block text-[11px] font-medium text-slate-600">Event type<select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none" onChange={(event) => setEventType(event.target.value)} value={eventType}><option value="all">All events</option><option value="PERMISSION_GRANTED">Permission granted</option><option value="PERMISSION_REVOKED">Permission revoked</option></select></label>
      <DateRangeFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
    </div>
    {records.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[850px] text-left text-xs">
      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600"><tr><th className="px-3 py-3">Date &amp; time</th><th className="px-3 py-3">Event / permission</th><th className="px-3 py-3">Performed by</th><th className="px-3 py-3">User affected</th><th className="px-3 py-3">Previous → new</th><th className="px-3 py-3">Result / reason</th></tr></thead>
      <tbody>{records.map((event) => {
        const revoked = event.action_type === 'PERMISSION_REVOKED'
        const type = getPermissionType(event)
        return <tr className="border-t border-slate-100 align-top" key={event.id}>
          <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(event.occurred_at, true)}</td>
          <td className="px-3 py-3"><p className="font-medium text-slate-800">{revoked ? 'Permission revoked' : 'Permission granted'}</p><p className="mt-1 text-slate-500">{type}</p></td>
          <td className="px-3 py-3"><p className="font-medium text-slate-700">{event.actor_name || 'System'}</p><p className="mt-1 text-slate-500">{event.actor_email || '—'}</p></td>
          <td className="px-3 py-3"><p className="font-medium text-slate-700">{event.target_name || 'Unknown user'}</p><p className="mt-1 text-slate-500">{event.target_email || '—'}</p></td>
          <td className="px-3 py-3 text-slate-600">{revoked ? `${type} → No access` : `No access → ${type}`}</td>
          <td className="px-3 py-3"><p className="font-medium text-slate-700">{event.result}</p><p className="mt-1 max-w-[220px] whitespace-normal text-slate-500">{revoked ? event.details?.reason || 'Reason not recorded' : '—'}</p></td>
        </tr>
      })}</tbody>
    </table></div> : <EmptyState title="No matching access history" message="Permission grant and revocation events will appear here when they have been recorded." />}
  </section>
}

function SharedUsers({ document, grants, onRevoke }) {
  const [search, setSearch] = useState('')
  const [permissionType, setPermissionType] = useState('all')
  const [permissionStatus, setPermissionStatus] = useState('all')
  const [expandedGrant, setExpandedGrant] = useState(null)
  const records = useMemo(() => grants.filter((grant) => {
    const needle = search.trim().toLowerCase()
    return (!needle || `${grant.user_name} ${grant.user_email} ${grant.user_department || ''} ${grant.granted_by_name} ${grant.granted_by_email}`.toLowerCase().includes(needle)) &&
      (permissionType === 'all' || grant.permission_type === permissionType) &&
      (permissionStatus === 'all' || grant.status === permissionStatus)
  }), [grants, permissionStatus, permissionType, search])

  return <section aria-label="Shared users" className="space-y-4">
    <div><h3 className="text-sm font-semibold text-slate-900">Shared Users</h3><p className="mt-1 text-xs text-slate-500">Every permission record associated with this document, including expired and revoked grants.</p></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_190px_190px]">
      <label className="relative block"><span className="sr-only">Search shared users</span><span aria-hidden="true" className="absolute left-3 top-[11px] text-slate-400">⌕</span><input className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" value={search} /></label>
      <label className="block text-[11px] font-medium text-slate-600">Permission<select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none" onChange={(event) => setPermissionType(event.target.value)} value={permissionType}><option value="all">All permissions</option><option value="Read">Read</option><option value="Read + Download">Read + Download</option></select></label>
      <label className="block text-[11px] font-medium text-slate-600">Status<select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none" onChange={(event) => setPermissionStatus(event.target.value)} value={permissionStatus}><option value="all">All statuses</option><option>Active</option><option>Expired</option><option>Revoked</option></select></label>
    </div>
    {records.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1050px] text-left text-xs">
      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600"><tr><th className="px-3 py-3">User</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Permission</th><th className="px-3 py-3">Granted by</th><th className="px-3 py-3">Granted at</th><th className="px-3 py-3">Expires at</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr></thead>
      <tbody>{records.map((grant) => {
        const canRevoke = grant.status === 'Active' && grant.user_id !== document.owner.id
        return <Fragment key={grant.id}>
          <tr className="border-t border-slate-100 align-top">
            <td className="px-3 py-3"><div className="flex items-center gap-2"><PersonMark name={grant.user_name} /><span><span className="block font-medium text-slate-800">{grant.user_name}</span><span className="mt-0.5 block text-slate-500">{grant.user_email}</span></span></div></td>
            <td className="px-3 py-3 text-slate-600">{grant.user_department || '—'}</td>
            <td className="px-3 py-3"><span className="rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">{grant.permission_type}</span></td>
            <td className="px-3 py-3"><span className="block text-slate-700">{grant.granted_by_name}</span><span className="mt-0.5 block text-slate-500">{grant.granted_by_email}</span></td>
            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(grant.granted_at, true)}</td>
            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{grant.expires_at ? formatDate(grant.expires_at, true) : 'Never'}</td>
            <td className="px-3 py-3"><StatusBadge status={grant.status} /></td>
            <td className="px-3 py-3"><div className="flex items-center gap-2"><button aria-expanded={expandedGrant === grant.id} className="rounded-md px-2 py-1.5 font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" onClick={() => setExpandedGrant((current) => current === grant.id ? null : grant.id)} type="button">{expandedGrant === grant.id ? 'Hide' : 'View'}</button>{canRevoke && <button className="rounded-md px-2 py-1.5 font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" onClick={() => onRevoke(grant)} type="button">Revoke</button>}</div></td>
          </tr>
          {expandedGrant === grant.id && <tr className="border-t border-slate-100 bg-slate-50/70"><td className="px-4 py-3 text-[11px] text-slate-600" colSpan={8}><div className="grid gap-2 sm:grid-cols-3"><p><span className="font-semibold text-slate-700">Grant ID: </span>{grant.id}</p><p><span className="font-semibold text-slate-700">Revoked at: </span>{grant.revoked_at ? formatDate(grant.revoked_at, true) : '—'}</p><p><span className="font-semibold text-slate-700">Revoked by ID: </span>{grant.revoked_by_user_id || '—'}</p></div></td></tr>}
        </Fragment>
      })}</tbody>
    </table></div> : <EmptyState title="No shared users match these filters" message="This document has no matching permission records. Grants are shown here from the document permission records." />}
  </section>
}

function DocumentActivity({ events }) {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const activity = useMemo(() => events.filter((event) => !ACCESS_ACTIONS.has(event.action_type))
    .filter((event) => action === 'all' || event.action_type === action)
    .filter((event) => (!from && !to) || matchesDateRange(event.occurred_at, from, to))
    .filter((event) => {
      const needle = search.trim().toLowerCase()
      return !needle || [event.actor_name, event.actor_email, event.action_type, event.result, event.ip_address, JSON.stringify(event.details || {})].filter(Boolean).join(' ').toLowerCase().includes(needle)
    })
    .sort((left, right) => new Date(right.occurred_at) - new Date(left.occurred_at)), [action, events, from, search, to])
  const actions = [...new Set(events.filter((event) => !ACCESS_ACTIONS.has(event.action_type)).map((event) => event.action_type))].sort()

  return <section aria-label="Document activity" className="space-y-4">
    <div><h3 className="text-sm font-semibold text-slate-900">Document Activity</h3><p className="mt-1 text-xs text-slate-500">Operations performed on this document. Access History separately shows permission lifecycle changes.</p></div>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_190px_260px]">
      <label className="relative block"><span className="sr-only">Search document activity</span><span aria-hidden="true" className="absolute left-3 top-[11px] text-slate-400">⌕</span><input className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, result, details, or IP" value={search} /></label>
      <label className="block text-[11px] font-medium text-slate-600">Action type<select className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-blue-400 focus:outline-none" onChange={(event) => setAction(event.target.value)} value={action}><option value="all">All recorded actions</option>{actions.map((value) => <option key={value} value={value}>{displayAction(value)}</option>)}</select></label>
      <DateRangeFilters from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
    </div>
    {activity.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[900px] text-left text-xs">
      <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600"><tr><th className="px-3 py-3">Date &amp; time</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Action</th><th className="px-3 py-3">Details</th><th className="px-3 py-3">Result</th><th className="px-3 py-3">Source IP</th></tr></thead>
      <tbody>{activity.map((event) => <tr className="border-t border-slate-100 align-top" key={event.id}><td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(event.occurred_at, true)}</td><td className="px-3 py-3"><p className="font-medium text-slate-700">{event.actor_name || 'System'}</p><p className="mt-1 text-slate-500">{event.actor_email || '—'}</p></td><td className="px-3 py-3 font-medium text-slate-700">{displayAction(event.action_type)}</td><td className="max-w-sm whitespace-normal px-3 py-3 text-slate-600">{Object.keys(event.details || {}).length ? Object.entries(event.details).map(([key, value]) => `${displayAction(key)}: ${value ?? '—'}`).join(' · ') : '—'}</td><td className="px-3 py-3"><span className={event.result === 'SUCCESS' ? 'font-medium text-emerald-700' : event.result === 'DENIED' ? 'font-medium text-rose-700' : 'font-medium text-amber-700'}>{event.result}</span></td><td className="whitespace-nowrap px-3 py-3 text-slate-600">{event.ip_address || '—'}</td></tr>)}</tbody>
    </table></div> : <EmptyState title="No matching document activity" message="Recorded uploads, views, downloads, and other document operations will appear here. No activity has been fabricated." />}
  </section>
}

export default function AdminPermissionDocumentModal({ documentId, onClose }) {
  const [payload, setPayload] = useState(null)
  const [tab, setTab] = useState('access')
  const [revokeGrant, setRevokeGrant] = useState(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeError, setRevokeError] = useState('')
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [loadedRequestKey, setLoadedRequestKey] = useState('')
  const [loadFailure, setLoadFailure] = useState(null)
  const revokeGrantRef = useRef(null)
  const closeRef = useRef(onClose)
  const modalRef = useRef(null)
  const revokeDialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => { revokeGrantRef.current = revokeGrant }, [revokeGrant])

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${documentId}:${refreshKey}`
    apiGet(`/api/admin/permissions/documents/${encodeURIComponent(documentId)}`, { signal: controller.signal })
      .then((response) => {
        setPayload(response)
        setLoadFailure(null)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadFailure({ key: requestKey, message: error.message || 'Unable to load document details.' })
      })
      .finally(() => { if (!controller.signal.aborted) setLoadedRequestKey(requestKey) })
    return () => controller.abort()
  }, [documentId, refreshKey])

  useEffect(() => {
    const pageDocument = window.document
    previousFocus.current = pageDocument.activeElement
    const previousOverflow = pageDocument.body.style.overflow
    pageDocument.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (revokeGrantRef.current) setRevokeGrant(null)
        else closeRef.current?.()
        return
      }
      if (event.key === 'Tab') {
        const activeDialog = revokeGrantRef.current ? revokeDialogRef.current : modalRef.current
        const focusable = [...(activeDialog?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])]
          .filter((element) => element.getAttribute('aria-hidden') !== 'true')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) {
          event.preventDefault()
        } else if (event.shiftKey && window.document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && window.document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      pageDocument.body.style.overflow = previousOverflow
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
    }
  }, [])

  useEffect(() => {
    if (revokeGrant) cancelButtonRef.current?.focus()
  }, [revokeGrant])

  async function confirmRevoke(event) {
    event.preventDefault()
    if (!revokeGrant || !revokeReason.trim()) return
    setRevokeBusy(true)
    setRevokeError('')
    try {
      await apiDelete(`/api/admin/permissions/documents/${encodeURIComponent(documentId)}/grants/${encodeURIComponent(revokeGrant.id)}`, { body: { reason: revokeReason.trim() } })
      setSuccessMessage(`Permission revoked for ${revokeGrant.user_name}.`)
      setRevokeGrant(null)
      setRevokeReason('')
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setRevokeError(error.message || 'The permission could not be revoked.')
    } finally {
      setRevokeBusy(false)
    }
  }

  const requestKey = `${documentId}:${refreshKey}`
  const loading = loadedRequestKey !== requestKey
  const loadError = loadFailure?.key === requestKey ? loadFailure.message : ''
  const docInfo = payload?.document
  const tabs = [
    { id: 'access', label: 'Access History' },
    { id: 'shared', label: 'Shared Users' },
    { id: 'activity', label: 'Document Activity' },
  ]

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-[1px] sm:p-5" onClick={() => closeRef.current?.()} role="presentation">
    <section aria-labelledby="permission-document-title" aria-modal="true" className="relative flex max-h-[96vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92vh]" onClick={(event) => event.stopPropagation()} ref={modalRef} role="dialog">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {docInfo ? <FileMark filename={docInfo.original_filename || docInfo.title} /> : <span aria-hidden="true" className="h-11 w-11 animate-pulse rounded-xl bg-slate-100" />}
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg" id="permission-document-title">{docInfo?.title || (loading ? 'Loading document…' : 'Document details')}</h2>{docInfo?.status && <StatusBadge status={docInfo.status} />}</div>
            {docInfo && <p className="mt-1 break-all text-[11px] text-slate-500 sm:text-xs">{docInfo.id} <span className="px-1 text-slate-300">·</span>{docInfo.file_extension?.toUpperCase() || 'File type unavailable'} <span className="px-1 text-slate-300">·</span>{formatFileSize(docInfo.size_bytes)}</p>}
          </div>
        </div>
        <button aria-label="Close document details" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => closeRef.current?.()} ref={closeButtonRef} type="button"><svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {loading && <div aria-live="polite" className="space-y-4"><p className="text-sm text-slate-500">Loading document details and recorded activity…</p><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-52 animate-pulse rounded-xl bg-slate-100" /></div>}
        {!loading && loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert"><p className="text-sm font-semibold text-rose-800">Document details could not be loaded</p><p className="mt-1 text-xs text-rose-700">{loadError}</p><button className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-rose-800 ring-1 ring-rose-300 hover:bg-rose-100" onClick={() => setRefreshKey((value) => value + 1)} type="button">Try again</button></div>}
        {!loading && docInfo && <div className="space-y-5">
          <section aria-label="Document owner" className="rounded-xl border border-blue-100 bg-blue-50/55 p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Document Owner</h3><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100">Owner</span></div><div className="flex flex-wrap items-center gap-3"><PersonMark name={docInfo.owner.full_name} tone="indigo" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-900">{docInfo.owner.full_name}</p><p className="mt-0.5 break-all text-xs text-slate-600">{docInfo.owner.email}</p></div><dl className="grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t border-blue-100 pt-3 text-[11px] sm:w-auto sm:min-w-[420px] sm:grid-cols-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><div><dt className="text-slate-500">User ID</dt><dd className="mt-0.5 break-all font-medium text-slate-700">{docInfo.owner.id}</dd></div><div><dt className="text-slate-500">Role / account</dt><dd className="mt-0.5 font-medium text-slate-700">{docInfo.owner.role} · {docInfo.owner.account_status}</dd></div><div><dt className="text-slate-500">Department</dt><dd className="mt-0.5 font-medium text-slate-700">{docInfo.owner.department || '—'}</dd></div><div><dt className="text-slate-500">Owner designation</dt><dd className="mt-0.5 font-medium text-slate-700">{docInfo.owner.job_title || 'Document owner'}</dd></div></dl></div></section>

          <section aria-label="Document details" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Document Details</h3><span className="text-[10px] text-slate-400">Current metadata</span></div><dl className="grid gap-x-5 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">{[
            ['Document name', docInfo.title], ['Document ID', docInfo.id], ['File type', docInfo.file_extension?.toUpperCase() || docInfo.content_type || '—'], ['File size', formatFileSize(docInfo.size_bytes)], ['Category', docInfo.category || '—'], ['Classification', docInfo.classification || '—'], ['Uploaded', formatDate(docInfo.uploaded_at || docInfo.created_at, true)], ['Last modified', formatDate(docInfo.updated_at, true)], ['Document status', docInfo.status], ['Department', docInfo.department || '—'],
          ].map(([label, value]) => <div className="min-w-0" key={label}><dt className="text-[11px] text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-800">{value}</dd></div>)}</dl>{docInfo.description && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-[11px] text-slate-500">Description</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{docInfo.description}</p></div>}</section>

          {successMessage && <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800" role="status"><span>{successMessage}</span><button aria-label="Dismiss success message" className="font-semibold" onClick={() => setSuccessMessage('')} type="button">×</button></div>}

          <div className="border-b border-slate-200"><div aria-label="Document permission sections" className="flex gap-1 overflow-x-auto" role="tablist">{tabs.map((item) => <button aria-controls={`permission-tab-${item.id}`} aria-selected={tab === item.id} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold transition-colors sm:px-5 ${tab === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`} id={`permission-tab-button-${item.id}`} key={item.id} onClick={() => setTab(item.id)} role="tab" type="button">{item.label}</button>)}</div></div>
          <div aria-labelledby={`permission-tab-button-${tab}`} id={`permission-tab-${tab}`} role="tabpanel">{tab === 'access' ? <AccessHistory events={payload.audit || []} /> : tab === 'shared' ? <SharedUsers document={docInfo} grants={payload.permissions || []} onRevoke={(grant) => { setRevokeGrant(grant); setRevokeReason(''); setRevokeError('') }} /> : <DocumentActivity events={payload.audit || []} />}</div>
        </div>}
      </div>
      <footer className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6"><button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" onClick={() => closeRef.current?.()} type="button">Close</button></footer>
    </section>

    {revokeGrant && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget && !revokeBusy) setRevokeGrant(null) }} role="presentation"><form aria-labelledby="revoke-permission-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} onSubmit={confirmRevoke} ref={revokeDialogRef} role="dialog"><div className="flex items-start gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">!</span><div><h3 className="text-sm font-semibold text-slate-900" id="revoke-permission-title">Revoke document permission?</h3><p className="mt-1 text-xs leading-5 text-slate-600">This removes <strong>{revokeGrant.user_name}</strong>’s <strong>{revokeGrant.permission_type}</strong> permission for <strong>{docInfo?.title}</strong>. Other grants are not affected.</p></div></div><label className="mt-4 block text-xs font-semibold text-slate-700">Reason for revocation<textarea autoFocus className="mt-1.5 min-h-24 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-xs font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" maxLength={500} onChange={(event) => setRevokeReason(event.target.value)} placeholder="Enter why this access should be removed" required value={revokeReason} /></label>{revokeError && <p className="mt-2 text-xs text-rose-700" role="alert">{revokeError}</p>}<div className="mt-4 flex justify-end gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" disabled={revokeBusy} onClick={() => setRevokeGrant(null)} ref={cancelButtonRef} type="button">Cancel</button><button className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={revokeBusy || !revokeReason.trim()} type="submit">{revokeBusy ? 'Revoking…' : 'Confirm revocation'}</button></div></form></div>}
  </div>
}

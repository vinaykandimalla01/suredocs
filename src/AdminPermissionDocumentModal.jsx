import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiGet, apiPost } from './api.js'
import './AdminPermissionDocumentModal.css'

function formatDate(val, withTime = false) {
  if (!val) return '—'
  const d = new Date(val)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  })
}

function formatDateDisplay(value) {
  if (!value) return { date: '—', time: '' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date, time }
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let b = bytes / 1024
  let u = units[0]
  for (let i = 1; b >= 1024 && i < units.length; i++) {
    b /= 1024
    u = units[i]
  }
  return `${b.toFixed(b >= 10 ? 0 : 1)} ${u}`
}

function getInitials(name) {
  if (!name) return '??'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

const REVOKE_REASONS = [
  'No longer required',
  'User offboarded',
  'Sensitive data',
  'Permission revoked',
  'Expired grant',
  'Role change',
  'Access misuse',
  'Project completed',
  'User requested',
  'Compliance requirement',
]

export default function AdminPermissionDocumentModal({ documentId, onClose, onPermissionUpdated }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('shared')

  // Search & filter in Shared Users tab
  const [sharedSearch, setSharedSearch] = useState('')
  const [sharedStatus, setSharedStatus] = useState('all')

  // Selected user for the right-hand panel
  const [selectedUserGrant, setSelectedUserGrant] = useState(null)

  // Add User Access state
  const [userQuery, setUserQuery] = useState('')
  const [eligibleUsers, setEligibleUsers] = useState([])
  const [selectedGrantUser, setSelectedGrantUser] = useState(null)
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState('Read')
  const [grantBusy, setGrantBusy] = useState(false)
  const [grantNotice, setGrantNotice] = useState('')

  // Revoke state
  const [revokeReason, setRevokeReason] = useState('No longer required')
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [revokeNotice, setRevokeNotice] = useState('')

  // Fetch document details
  const loadData = useCallback(async () => {
    if (!documentId) return
    setLoading(true)
    setError('')
    try {
      const res = await apiGet(`/api/admin/permissions/documents/${encodeURIComponent(documentId)}`)
      setData(res)
      // If no user is selected yet, select the first grant if available
      if (res.permissions && res.permissions.length > 0) {
        setSelectedUserGrant((prev) => {
          if (!prev) return res.permissions[0]
          const found = res.permissions.find((p) => p.id === prev.id)
          return found || res.permissions[0]
        })
      }
    } catch (err) {
      setError(err.message || 'Unable to load document details.')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Fetch eligible users when searching in Add Access
  useEffect(() => {
    if (!documentId) return
    let active = true
    apiGet(`/api/admin/permissions/documents/${encodeURIComponent(documentId)}/eligible-users?search=${encodeURIComponent(userQuery)}`)
      .then((users) => {
        if (active) setEligibleUsers(users || [])
      })
      .catch(() => {
        if (active) setEligibleUsers([])
      })
    return () => {
      active = false
    }
  }, [documentId, userQuery])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Filtered shared users
  const filteredGrants = useMemo(() => {
    if (!data?.permissions) return []
    return data.permissions.filter((g) => {
      const q = sharedSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        g.user_name.toLowerCase().includes(q) ||
        g.user_email.toLowerCase().includes(q) ||
        (g.user_department && g.user_department.toLowerCase().includes(q))
      const matchStatus =
        sharedStatus === 'all' ||
        g.status.toLowerCase() === sharedStatus.toLowerCase()
      return matchSearch && matchStatus
    })
  }, [data?.permissions, sharedSearch, sharedStatus])

  // Handle Grant Access
  async function handleGrantSubmit(e) {
    e.preventDefault()
    if (!selectedGrantUser) {
      alert('Please select a user to grant access to.')
      return
    }

    setGrantBusy(true)
    setGrantNotice('')
    try {
      await apiPost(`/api/admin/permissions/documents/${documentId}/grants`, {
        user_id: selectedGrantUser.id,
        permission_level: selectedPermissionLevel,
      })
      setGrantNotice(`Access granted to ${selectedGrantUser.full_name}.`)
      setSelectedGrantUser(null)
      setUserQuery('')
      loadData()
      onPermissionUpdated?.()
    } catch (err) {
      alert(err.message || 'Failed to grant access.')
    } finally {
      setGrantBusy(false)
    }
  }

  // Handle Revoke
  async function handleRevokeSubmit(e) {
    e.preventDefault()
    if (!selectedUserGrant) {
      alert('Please select a permission grant to revoke.')
      return
    }
    if (selectedUserGrant.status !== 'Active') {
      alert('This permission is already no longer active.')
      return
    }

    const confirmed = window.confirm(
      `Revoke ${selectedUserGrant.permission_type} permission for ${selectedUserGrant.user_name}? This cannot be undone.`
    )
    if (!confirmed) return

    setRevokeBusy(true)
    setRevokeNotice('')
    try {
      await apiPost(
        `/api/admin/permissions/documents/${documentId}/grants/${selectedUserGrant.id}/revoke`,
        { reason: revokeReason }
      )
      setRevokeNotice(`Permission revoked for ${selectedUserGrant.user_name}.`)
      loadData()
      onPermissionUpdated?.()
    } catch (err) {
      alert(err.message || 'Failed to revoke access.')
    } finally {
      setRevokeBusy(false)
    }
  }

  const doc = data?.document
  const owner = doc?.owner
  const overview = data?.overview || { read_count: 0, download_count: 0, edit_count: 0 }

  return (
    <div
      className="doc-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
      role="presentation"
    >
      <div aria-modal="true" className="doc-modal-container" role="dialog">
        {/* Header */}
        <div className="doc-modal-header">
          <div className="doc-modal-header-left">
            <span className="doc-modal-file-icon pdf">
              {doc?.file_extension?.toUpperCase() || 'PDF'}
            </span>
            <div className="doc-modal-title-wrap">
              <h2 className="doc-modal-title">{doc?.title || (loading ? 'Loading document…' : 'Document Details')}</h2>
              {doc && (
                <div className="doc-modal-subtitle">
                  {doc.id.slice(0, 12)} · {doc.file_extension?.toUpperCase() || 'PDF'} · {formatBytes(doc.size_bytes)} · {doc.category || 'General'}
                </div>
              )}
            </div>
          </div>

          <div className="doc-modal-header-right">
            <span className="status-pill status-pill-active">{doc?.status || 'Active'}</span>
            <button aria-label="Close" className="doc-modal-close-btn" onClick={onClose} type="button">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        {loading && (
          <div style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
            Loading document details and permissions…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 32, textAlign: 'center', color: '#EF4444' }}>
            <p style={{ fontWeight: 600 }}>Error loading document</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>{error}</p>
            <button className="permissions-btn-secondary" onClick={loadData} style={{ marginTop: 12 }} type="button">
              Retry
            </button>
          </div>
        )}

        {!loading && doc && (
          <div className="doc-modal-body">
            {/* Left Column */}
            <div className="doc-modal-col-left">
              {/* Document Owner Card */}
              <div className="doc-owner-card">
                <div className="doc-owner-card-header">
                  <div className="doc-owner-heading">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Document Owner
                  </div>
                  <span className="doc-owner-badge">Owner</span>
                </div>

                <div className="doc-owner-info-row">
                  <div className="doc-owner-profile">
                    <span className="doc-owner-avatar">{getInitials(owner?.full_name)}</span>
                    <div>
                      <div className="doc-owner-name">{owner?.full_name}</div>
                      <div className="doc-owner-meta-text">{owner?.email}</div>
                      <div className="doc-owner-meta-text" style={{ color: '#64748B' }}>
                        {owner?.department || 'Executive Department'}
                      </div>
                    </div>
                  </div>

                  <div className="doc-owner-stats-grid">
                    <div className="doc-owner-stat-col">
                      <span className="doc-owner-stat-label">User ID</span>
                      <span className="doc-owner-stat-val">{owner?.id ? `SS-${owner.id.slice(0, 4)}` : 'SS-1001'}</span>
                    </div>
                    <div className="doc-owner-stat-col">
                      <span className="doc-owner-stat-label">Role</span>
                      <span className="doc-owner-stat-val">{owner?.role || 'Employee'}</span>
                    </div>
                    <div className="doc-owner-stat-col">
                      <span className="doc-owner-stat-label">Joined On</span>
                      <span className="doc-owner-stat-val">{formatDate(owner?.created_at) || 'Mar 12, 2023'}</span>
                    </div>
                    <div className="doc-owner-stat-col">
                      <span className="doc-owner-stat-label">Account Status</span>
                      <span className="status-pill status-pill-active" style={{ marginTop: 2 }}>
                        {owner?.account_status || 'Active'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Details Card */}
              <div className="doc-details-card">
                <div className="doc-details-card-header">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Document Details
                </div>

                <div className="doc-details-content-grid">
                  <div className="doc-details-file-block">
                    <span className="doc-details-file-icon pdf">PDF</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{doc.title}</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{doc.id}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        <span className="permission-pill permission-pill-read">PDF</span>
                        <span className="permission-pill permission-pill-read">{formatBytes(doc.size_bytes)}</span>
                        <span className="permission-pill permission-pill-read">{doc.category || 'Business'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="doc-details-meta-list">
                    <div className="doc-details-row">
                      <span className="doc-details-label">Category</span>
                      <span className="doc-details-val">{doc.category || 'Business'}</span>
                    </div>
                    <div className="doc-details-row">
                      <span className="doc-details-label">Uploaded At</span>
                      <span className="doc-details-val">{formatDate(doc.uploaded_at || doc.created_at, true)}</span>
                    </div>
                    <div className="doc-details-row">
                      <span className="doc-details-label">Last Modified</span>
                      <span className="doc-details-val">{formatDate(doc.updated_at, true)}</span>
                    </div>
                    <div className="doc-details-row">
                      <span className="doc-details-label">Storage Location</span>
                      <span className="doc-details-val">{doc.storage_location || 'S3 / suredocs-private/documents'}</span>
                    </div>
                  </div>
                </div>

                {doc.description && (
                  <div className="doc-details-desc-box">
                    <strong>Description:</strong> {doc.description}
                  </div>
                )}
              </div>

              {/* Horizontal Tabs */}
              <div className="doc-modal-tabs">
                <button
                  className={`doc-modal-tab-btn${activeTab === 'access' ? ' active' : ''}`}
                  onClick={() => setActiveTab('access')}
                  type="button"
                >
                  Access History
                </button>
                <button
                  className={`doc-modal-tab-btn${activeTab === 'shared' ? ' active' : ''}`}
                  onClick={() => setActiveTab('shared')}
                  type="button"
                >
                  Shared Users ({data.permissions?.length ?? 0})
                </button>
                <button
                  className={`doc-modal-tab-btn${activeTab === 'activity' ? ' active' : ''}`}
                  onClick={() => setActiveTab('activity')}
                  type="button"
                >
                  Document Activity
                </button>
                <button
                  className={`doc-modal-tab-btn${activeTab === 'related' ? ' active' : ''}`}
                  onClick={() => setActiveTab('related')}
                  type="button"
                >
                  Related Permissions
                </button>
                <button
                  className={`doc-modal-tab-btn${activeTab === 'versions' ? ' active' : ''}`}
                  onClick={() => setActiveTab('versions')}
                  type="button"
                >
                  Document Versions
                </button>
              </div>

              {/* Tab 1: Shared Users */}
              {activeTab === 'shared' && (
                <div className="doc-shared-users-sec">
                  <div className="doc-shared-users-header">
                    <div>
                      <div className="doc-shared-users-title">Shared Users ({data.permissions?.length ?? 0})</div>
                      <div className="doc-shared-users-sub">Users who have been granted access to this document.</div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="permissions-search-input"
                        onChange={(e) => setSharedSearch(e.target.value)}
                        placeholder="Search users..."
                        style={{ height: 28, fontSize: 11 }}
                        type="search"
                        value={sharedSearch}
                      />
                      <select
                        className="permissions-filter-select"
                        onChange={(e) => setSharedStatus(e.target.value)}
                        style={{ height: 28, fontSize: 11 }}
                        value={sharedStatus}
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </div>
                  </div>

                  <div className="doc-shared-table-wrap">
                    <table className="doc-shared-table">
                      <thead>
                        <tr>
                          <th style={{ width: 28 }}>#</th>
                          <th>User</th>
                          <th>Department</th>
                          <th>Permission</th>
                          <th>Granted At</th>
                          <th>Expires At</th>
                          <th>Status</th>
                          <th style={{ width: 36, textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGrants.map((grant) => {
                          const isSelected = selectedUserGrant?.id === grant.id
                          const gDate = formatDateDisplay(grant.granted_at)
                          const eDate = formatDateDisplay(grant.expires_at)

                          let pillCls = 'permission-pill-read'
                          if (grant.permission_type?.includes('Download')) pillCls = 'permission-pill-download'
                          if (grant.permission_type?.includes('Edit')) pillCls = 'permission-pill-edit'

                          let statusCls = 'status-pill-active'
                          if (grant.status === 'Expired') statusCls = 'status-pill-expired'
                          else if (grant.status === 'Revoked') statusCls = 'status-pill-revoked'

                          return (
                            <tr
                              className={`cursor-pointer${isSelected ? ' selected-row' : ''}`}
                              key={grant.id}
                              onClick={() => setSelectedUserGrant(grant)}
                            >
                              <td>
                                <input
                                  checked={isSelected}
                                  className="permissions-checkbox"
                                  onChange={() => setSelectedUserGrant(grant)}
                                  type="radio"
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="permissions-user-avatar">{getInitials(grant.user_name)}</span>
                                  <div>
                                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{grant.user_name}</div>
                                    <div style={{ fontSize: 10, color: '#64748B' }}>{grant.user_email}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ color: '#475569' }}>{grant.user_department || 'Marketing'}</td>
                              <td>
                                <span className={`permission-pill ${pillCls}`}>{grant.permission_type}</span>
                              </td>
                              <td className="permissions-date-cell">
                                <div>{gDate.date}</div>
                                <small>{gDate.time}</small>
                              </td>
                              <td className="permissions-date-cell">
                                <div>{grant.expires_at ? eDate.date : 'Never'}</div>
                                <small>{grant.expires_at ? eDate.time : ''}</small>
                              </td>
                              <td>
                                <span className={`status-pill ${statusCls}`}>{grant.status}</span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button className="permissions-action-btn" type="button">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="1.5" />
                                    <circle cx="19" cy="12" r="1.5" />
                                    <circle cx="5" cy="12" r="1.5" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          )
                        })}

                        {filteredGrants.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
                              No shared users matching filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Access History */}
              {activeTab === 'access' && (
                <div className="doc-shared-users-sec">
                  <div className="doc-shared-users-title">Access History</div>
                  <div className="doc-shared-users-sub">Permission grant and revocation events recorded for this document.</div>
                  <div className="doc-shared-table-wrap">
                    <table className="doc-shared-table">
                      <thead>
                        <tr>
                          <th>Date &amp; Time</th>
                          <th>Event</th>
                          <th>Performed By</th>
                          <th>User Affected</th>
                          <th>Result</th>
                          <th>Reason / Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.audit || []).map((ev) => (
                          <tr key={ev.id}>
                            <td className="permissions-date-cell">{formatDate(ev.occurred_at, true)}</td>
                            <td>{ev.action_type}</td>
                            <td>{ev.actor_name || 'Administrator'}</td>
                            <td>{ev.target_name || '—'}</td>
                            <td>
                              <span className={`status-pill ${ev.result === 'SUCCESS' ? 'status-pill-active' : 'status-pill-expired'}`}>
                                {ev.result}
                              </span>
                            </td>
                            <td>{ev.details?.reason || JSON.stringify(ev.details || {})}</td>
                          </tr>
                        ))}
                        {(data.audit || []).length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>
                              No access history recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Document Activity */}
              {activeTab === 'activity' && (
                <div className="doc-shared-users-sec">
                  <div className="doc-shared-users-title">Document Activity</div>
                  <div className="doc-shared-users-sub">Views, downloads, and operations performed on this document.</div>
                  <div className="doc-shared-table-wrap">
                    <table className="doc-shared-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Actor</th>
                          <th>Operation</th>
                          <th>Result</th>
                          <th>IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.audit || []).map((ev) => (
                          <tr key={ev.id}>
                            <td className="permissions-date-cell">{formatDate(ev.occurred_at, true)}</td>
                            <td>{ev.actor_name || 'System'}</td>
                            <td>{ev.action_type}</td>
                            <td>
                              <span className={`status-pill ${ev.result === 'SUCCESS' ? 'status-pill-active' : 'status-pill-expired'}`}>
                                {ev.result}
                              </span>
                            </td>
                            <td>{ev.ip_address || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: Related Permissions */}
              {activeTab === 'related' && (
                <div className="doc-shared-users-sec">
                  <div className="doc-shared-users-title">Related Permissions</div>
                  <div className="doc-shared-users-sub">All permission relationships associated with this document.</div>
                  <div className="doc-shared-table-wrap">
                    <table className="doc-shared-table">
                      <thead>
                        <tr>
                          <th>Grantee</th>
                          <th>Permission</th>
                          <th>Granted By</th>
                          <th>Granted At</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.permissions || []).map((p) => (
                          <tr key={p.id}>
                            <td>{p.user_name}</td>
                            <td>{p.permission_type}</td>
                            <td>{p.granted_by_name}</td>
                            <td>{formatDate(p.granted_at, true)}</td>
                            <td>
                              <span className={`status-pill ${p.status === 'Active' ? 'status-pill-active' : 'status-pill-revoked'}`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 5: Document Versions */}
              {activeTab === 'versions' && (
                <div className="doc-shared-users-sec">
                  <div className="doc-shared-users-title">Document Versions</div>
                  <div className="doc-shared-users-sub">Version history for this document.</div>
                  <div className="doc-shared-table-wrap">
                    <table className="doc-shared-table">
                      <thead>
                        <tr>
                          <th>Version</th>
                          <th>File</th>
                          <th>Size</th>
                          <th>Uploaded At</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.versions || []).map((ver) => (
                          <tr key={ver.id}>
                            <td>v{ver.version_number}</td>
                            <td>{ver.original_filename || doc.title}</td>
                            <td>{formatBytes(ver.size_bytes)}</td>
                            <td>{formatDate(ver.uploaded_at, true)}</td>
                            <td>
                              <span className="status-pill status-pill-active">{ver.status}</span>
                            </td>
                          </tr>
                        ))}
                        {(data.versions || []).length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#64748B' }}>
                              Version 1 (Initial release)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Permission Management Panel */}
            <div className="doc-modal-col-right">
              <div className="doc-pm-panel-header">
                <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <div>
                  <div className="doc-pm-title">Permission Management</div>
                  <div className="doc-pm-subtitle">Manage access for users who have been granted permissions to this document.</div>
                </div>
              </div>

              {/* Current Permission Overview Mini Cards */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Current Permission Overview
                </div>
                <div className="doc-pm-overview-grid">
                  <div className="doc-pm-mini-card">
                    <div className="doc-pm-mini-card-top">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span className="doc-pm-mini-val">{overview.read_count}</span>
                    </div>
                    <span className="doc-pm-mini-label">Read Access</span>
                  </div>

                  <div className="doc-pm-mini-card">
                    <div className="doc-pm-mini-card-top">
                      <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                      <span className="doc-pm-mini-val">{overview.download_count}</span>
                    </div>
                    <span className="doc-pm-mini-label">Download Access</span>
                  </div>

                  <div className="doc-pm-mini-card">
                    <div className="doc-pm-mini-card-top">
                      <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span className="doc-pm-mini-val">{overview.edit_count}</span>
                    </div>
                    <span className="doc-pm-mini-label">Edit Access</span>
                  </div>
                </div>
              </div>

              {/* Add or Revoke User Access Form */}
              <form className="doc-pm-section-card" onSubmit={handleGrantSubmit}>
                <div className="doc-pm-sec-title">Add or Revoke User Access</div>

                <div style={{ position: 'relative' }}>
                  <input
                    className="doc-pm-input-field"
                    onChange={(e) => {
                      setUserQuery(e.target.value)
                      setSelectedGrantUser(null)
                    }}
                    placeholder="Search users by name or email…"
                    type="search"
                    value={selectedGrantUser ? `${selectedGrantUser.full_name} (${selectedGrantUser.email})` : userQuery}
                  />

                  {userQuery && !selectedGrantUser && eligibleUsers.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(15,23,42,0.1)',
                        maxHeight: 140,
                        overflowY: 'auto',
                      }}
                    >
                      {eligibleUsers.map((u) => (
                        <div
                          className="cursor-pointer"
                          key={u.id}
                          onClick={() => setSelectedGrantUser(u)}
                          style={{ padding: '6px 10px', fontSize: 11, borderBottom: '1px solid #F1F5F9' }}
                        >
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{u.full_name}</div>
                          <div style={{ fontSize: 10, color: '#64748B' }}>{u.email} · {u.department || 'Employee'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  aria-label="Select Permission"
                  className="doc-pm-input-field"
                  onChange={(e) => setSelectedPermissionLevel(e.target.value)}
                  value={selectedPermissionLevel}
                >
                  <option value="Read">Read</option>
                  <option value="Read + Download">Read + Download</option>
                  <option value="Edit">Edit</option>
                  <option value="Read + Download + Edit">Read + Download + Edit</option>
                </select>

                <button
                  className="doc-pm-btn-grant"
                  disabled={grantBusy || !selectedGrantUser}
                  type="submit"
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                  {grantBusy ? 'Granting…' : 'Grant Access'}
                </button>
                {grantNotice && (
                  <div style={{ fontSize: 11, color: '#059669', textAlign: 'center' }}>{grantNotice}</div>
                )}
              </form>

              {/* Selected User Permission Card */}
              {selectedUserGrant && (
                <div className="doc-pm-selected-user-card">
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>Selected User Permission</div>
                  <div className="doc-pm-user-header">
                    <div className="doc-pm-user-summary">
                      <span className="permissions-user-avatar">{getInitials(selectedUserGrant.user_name)}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A' }}>{selectedUserGrant.user_name}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>{selectedUserGrant.user_email}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>
                          {selectedUserGrant.user_department || 'Marketing Department'}
                        </div>
                      </div>
                    </div>
                    <span className={`status-pill ${selectedUserGrant.status === 'Active' ? 'status-pill-active' : 'status-pill-revoked'}`}>
                      {selectedUserGrant.status}
                    </span>
                  </div>

                  <div className="doc-pm-user-details-list">
                    <div className="doc-pm-detail-row">
                      <span className="doc-pm-detail-key">Permission Type</span>
                      <span className="doc-pm-detail-val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {selectedUserGrant.permission_type}
                      </span>
                    </div>

                    <div className="doc-pm-detail-row">
                      <span className="doc-pm-detail-key">Granted At</span>
                      <span className="doc-pm-detail-val">{formatDate(selectedUserGrant.granted_at, true)}</span>
                    </div>

                    <div className="doc-pm-detail-row">
                      <span className="doc-pm-detail-key">Expires At</span>
                      <span className="doc-pm-detail-val">{selectedUserGrant.expires_at ? formatDate(selectedUserGrant.expires_at, true) : 'Never'}</span>
                    </div>

                    <div className="doc-pm-detail-row">
                      <span className="doc-pm-detail-key">Days Remaining</span>
                      <span className="days-left-pill">
                        {selectedUserGrant.expires_at ? `${selectedUserGrant.days_remaining ?? 0} days` : 'Non-expiring'}
                      </span>
                    </div>

                    <div className="doc-pm-detail-row">
                      <span className="doc-pm-detail-key">Granted By</span>
                      <span className="doc-pm-detail-val">
                        {selectedUserGrant.granted_by_name || 'Sarah Smith'} (Document Owner)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Revoke Permission Card (Red Accent) */}
              {selectedUserGrant && selectedUserGrant.status === 'Active' && (
                <form className="doc-pm-revoke-card" onSubmit={handleRevokeSubmit}>
                  <div className="doc-pm-revoke-title-row">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="12" />
                      <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    Revoke Permission
                  </div>
                  <p className="doc-pm-revoke-warning-text">
                    This will immediately remove <strong>{selectedUserGrant.user_name}</strong>’s access to this document.
                  </p>

                  <label className="doc-details-label" style={{ fontSize: 10, fontWeight: 600 }}>
                    Reason for Revocation
                    <select
                      className="doc-pm-revoke-select"
                      onChange={(e) => setRevokeReason(e.target.value)}
                      style={{ marginTop: 4 }}
                      value={revokeReason}
                    >
                      {REVOKE_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="doc-pm-revoke-btn"
                    disabled={revokeBusy}
                    type="submit"
                  >
                    {revokeBusy ? 'Revoking…' : 'Revoke Permission'}
                  </button>
                  {revokeNotice && (
                    <div style={{ fontSize: 10, color: '#059669', textAlign: 'center' }}>{revokeNotice}</div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api.js'
import './ProfileSettingsWorkspace.css'

// ---------------------------------------------------------------------------
// Authentic Provider Logos & System Icons
// ---------------------------------------------------------------------------

function GoogleDriveLogo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15z" fill="#ea4335" />
      <path d="M43.65 25H71.15c0-1.55-.4-3.1-1.2-4.5l-7.65-13.25c-.8-1.4-1.95-2.5-3.3-3.3z" fill="#00832d" />
      <path d="m59.8 53-16.15-28H27.5l16.15 28z" fill="#2684fc" />
      <path d="M73.55 76.8H27.5l13.75-23.8h35.6c-1.35 1.4-2.5 2.5-3.3 3.3z" fill="#ffba00" />
    </svg>
  )
}

function OneDriveLogo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.2 25.5h14.3c3.6 0 6.5-2.9 6.5-6.5 0-3.3-2.5-6.1-5.8-6.5-.4-4.8-4.4-8.5-9.3-8.5-3.8 0-7.2 2.3-8.5 5.8C3.1 10.3 0 13.7 0 17.8c0 4.2 3.5 7.7 7.7 7.7h2.5z"
        fill="#0078d4"
      />
      <path
        d="M20.2 12.5c-.4-4.8-4.4-8.5-9.3-8.5-3.8 0-7.2 2.3-8.5 5.8 1.4-.5 3-.8 4.6-.8 5.7 0 10.5 4.1 11.4 9.6 1.1-.9 2.5-1.5 4-1.7-.6-2.1-1.2-3.4-2.2-4.4z"
        fill="#28a8ea"
        opacity="0.8"
      />
    </svg>
  )
}

function DropboxLogo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="m8 6 8 5.3-8 5.4-8-5.4L8 6zm16 0 8 5.3-8 5.4-8-5.4 8-5.3zM0 22.1l8 5.3 8-5.3-8-5.4-8 5.4zm32 0-8 5.3-8-5.3 8-5.4 8 5.4zm-16 1.1 8-5.4 8 5.4-8 5.3-8-5.3z" fill="#0061ff" />
    </svg>
  )
}

function SlackLogo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <path d="M28.4 80.5a13.3 13.3 0 1 1-13.3-13.3h13.3v13.3zm6.6 0a13.3 13.3 0 0 1 26.6 0v33.2a13.3 13.3 0 1 1-26.6 0V80.5z" fill="#e01e5a" />
      <path d="M47.5 28.4a13.3 13.3 0 1 1 13.3-13.3v13.3H47.5zm0 6.6a13.3 13.3 0 0 1 0 26.6H14.3a13.3 13.3 0 1 1 0-26.6h33.2z" fill="#36c5f0" />
      <path d="M99.6 47.5a13.3 13.3 0 1 1 13.3 13.3H99.6V47.5zm-6.6 0a13.3 13.3 0 0 1-26.6 0V14.3a13.3 13.3 0 1 1 26.6 0v33.2z" fill="#2eb67d" />
      <path d="M80.5 99.6a13.3 13.3 0 1 1-13.3 13.3V99.6h13.3zm0-6.6a13.3 13.3 0 0 1 0-26.6h33.2a13.3 13.3 0 1 1 0 26.6H80.5z" fill="#ecb22e" />
    </svg>
  )
}

function Microsoft365Logo({ className = 'h-8 w-8' }) {
  return (
    <svg className={className} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.5 3 7 7.5v17L19.5 29 27 24.5v-17L19.5 3z" fill="#eb3c00" />
      <path d="M19.5 3v26L27 24.5v-17L19.5 3z" fill="#ea3e2b" opacity="0.8" />
      <path d="M7 7.5l12.5 4.5v8L7 24.5v-17z" fill="#ff8c00" />
      <path d="M11.5 12h8v8h-8z" fill="#fff" opacity="0.9" />
    </svg>
  )
}

function PsiIcon({ name, className = 'h-4 w-4' }) {
  const icons = {
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
      </>
    ),
    shieldCheck: (
      <>
        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    sliders: (
      <>
        <line x1="4" x2="20" y1="21" y2="21" />
        <line x1="4" x2="20" y1="14" y2="14" />
        <line x1="4" x2="20" y1="7" y2="7" />
        <circle cx="8" cy="7" r="3" fill="currentColor" />
        <circle cx="16" cy="14" r="3" fill="currentColor" />
        <circle cx="10" cy="21" r="3" fill="currentColor" />
      </>
    ),
    storage: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
    edit: (
      <>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    checkCircle: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
      </>
    ),
    monitor: (
      <>
        <rect height="14" rx="2" width="20" x="2" y="3" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
    calendar: (
      <>
        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    grid: (
      <>
        <rect height="7" width="7" x="3" y="3" />
        <rect height="7" width="7" x="14" y="3" />
        <rect height="7" width="7" x="14" y="14" />
        <rect height="7" width="7" x="3" y="14" />
      </>
    ),
    mail: (
      <>
        <rect height="14" rx="2" width="20" x="2" y="5" />
        <path d="m22 7-10 7L2 7" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
      </>
    ),
    megaphone: (
      <>
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </>
    ),
    dots: (
      <>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      </>
    ),
    lock: (
      <>
        <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {icons[name]}
    </svg>
  )
}

function FileTypeBadge({ type }) {
  const configs = {
    PDF: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'PDF' },
    DOCX: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'DOCX' },
    XLSX: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'XLSX' },
    PPTX: { bg: 'bg-orange-50 text-orange-700 border-orange-200', label: 'PPTX' },
    Others: { bg: 'bg-slate-50 text-slate-700 border-slate-200', label: 'Others' },
  }
  const config = configs[type] || configs.Others
  return (
    <span className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[11px] font-bold border ${config.bg}`}>
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Profile & Settings Workspace
// ---------------------------------------------------------------------------

export default function ProfileSettingsWorkspace({ initialSection = 'account', user }) {
  const [activeSection, setActiveSection] = useState(initialSection)
  const [toastMessage, setToastMessage] = useState('')
  const fileInputRef = useRef(null)

  // Account Information form state
  const [profile, setProfile] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    department: user?.department || '',
    role: user?.role === 'ADMIN' ? 'Platform Administrator' : user?.role === 'MANAGER' ? 'Manager' : 'Employee',
    phone: '',
    location: '',
    bio: '',
    status: '',
    avatarUrl: null,
  })
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password state
  const [passwordState, setPasswordState] = useState({
    current: '',
    newPassword: '',
    confirm: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Security state
  const [sessions, setSessions] = useState([])

  // Notifications state (all 7 exact reference settings)
  const [notifications, setNotifications] = useState({
    documentAccessRequests: true,
    accessGranted: true,
    accessRevoked: true,
    accessRequestDecisions: true,
    documentActivity: true,
    securityAlerts: true,
    productUpdates: false,
    marketingCommunications: false,
  })

  // Preferences state
  const [preferences, setPreferences] = useState({
    appearance: 'light', // 'light' | 'dark' | 'system'
    language: 'English (US)',
    dateFormat: 'Oct 24, 2026',
    timeFormat: '12-hour (AM/PM)',
    defaultView: 'list', // 'list' | 'grid'
  })

  const [storageData, setStorageData] = useState({
    usedGb: '0',
    documentsGb: '0',
    versionsMb: 0,
    trashMb: 0,
    breakdown: [],
  })

  // Connected Accounts state
  const [integrations, setIntegrations] = useState([])

  // Sync section from URL or props
  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/employee/profile/security') setActiveSection('security')
    else if (path === '/employee/profile/notifications') setActiveSection('notifications')
    else if (path === '/employee/profile/preferences') setActiveSection('preferences')
    else if (path === '/employee/profile/storage' || path === '/employee/storage') setActiveSection('storage')
    else if (path === '/employee/profile/connected' || path === '/employee/connected') setActiveSection('connected')
    else setActiveSection('account')
  }, [initialSection])

  // Load profile from API on mount
  useEffect(() => {
    let active = true
    apiGet('/api/users/me/profile')
      .then((data) => {
        if (!active || !data) return
        setProfile((prev) => ({
          ...prev,
          fullName: data.full_name || prev.fullName,
          email: data.email || prev.email,
          department: data.department || prev.department,
          role: data.role === 'ADMIN' ? 'Platform Administrator' : data.role === 'MANAGER' ? 'Manager' : 'Employee',
          status: data.account_status || prev.status,
          phone: data.phone ?? '',
          location: data.location ?? '',
          bio: data.bio ?? '',
        }))
      })
      .catch(() => {})

    apiGet('/api/users/me/sessions')
      .then((sessionItems) => {
        if (active && Array.isArray(sessionItems) && sessionItems.length > 0) {
          setSessions(
            sessionItems.map((s) => ({
              id: s.id,
              device: s.device,
              location: s.location,
              lastActive: s.last_active || s.lastActive || '—',
              status: s.status,
              isCurrent: s.is_current ?? s.isCurrent ?? false,
            }))
          )
        }
      })
      .catch(() => {})

    apiGet('/api/users/me/notifications/preferences')
      .then((data) => {
        if (!active || !data) return
        setNotifications({
          documentAccessRequests: data.document_access_requests,
          accessGranted: data.access_granted,
          accessRevoked: data.access_revoked,
          accessRequestDecisions: data.access_request_decisions,
          documentActivity: data.document_activity,
          securityAlerts: data.security_alerts,
          productUpdates: data.product_updates,
          marketingCommunications: data.marketing_communications,
        })
      })
      .catch(() => {})

    apiGet('/api/users/me/preferences')
      .then((data) => {
        if (!active || !data) return
        setPreferences({
          appearance: data.appearance,
          language: data.language,
          dateFormat: data.date_format,
          timeFormat: data.time_format,
          defaultView: data.default_view,
        })
      })
      .catch(() => {})

    apiGet('/api/users/me/storage')
      .then((data) => {
        if (!active || !data) return
        const colors = { PDF: '#2563eb', DOCX: '#7c3aed', XLSX: '#10b981', PPTX: '#f97316', Others: '#64748b' }
        setStorageData({
          usedGb: Number(data.used_gb || 0).toFixed(3),
          documentsGb: Number(data.documents_gb || 0).toFixed(3),
          versionsMb: data.versions_mb || 0,
          trashMb: data.trash_mb || 0,
          breakdown: (data.breakdown || []).map((row) => ({
            type: row.file_type,
            count: row.count,
            size: row.size,
            percentage: row.percentage,
            barColor: row.color || colors[row.file_type] || colors.Others,
          })),
        })
      })
      .catch(() => {})

    apiGet('/api/users/me/integrations')
      .then((items) => {
        if (active && Array.isArray(items)) setIntegrations(items)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  function showToast(msg) {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage('')
    }, 3200)
  }

  function navigateTo(section) {
    setActiveSection(section)
    const targetMap = {
      account: '/employee/profile',
      security: '/employee/profile/security',
      notifications: '/employee/profile/notifications',
      preferences: '/employee/profile/preferences',
      storage: '/employee/storage',
      connected: '/employee/connected',
    }
    const target = targetMap[section] || '/employee/profile'
    window.history.pushState(null, '', target)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  // 1. Account Info Handlers
  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      await apiPatch('/api/users/me/profile', {
        full_name: profile.fullName,
        department: profile.department,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
      })
      setIsEditingProfile(false)
      showToast('Profile information updated successfully.')
    } catch (err) {
      showToast(err.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Only JPG and PNG images are permitted.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size exceeds 2 MB limit.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setProfile((prev) => ({ ...prev, avatarUrl: event.target?.result }))
      showToast('Profile picture updated successfully.')
    }
    reader.readAsDataURL(file)
  }

  // 2. Password Handlers
  async function handleUpdatePassword(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    const { current, newPassword, confirm } = passwordState
    if (!current) {
      setPasswordError('Please enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long.')
      return
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
      setPasswordError('Password must include uppercase and lowercase letters.')
      return
    }
    if (!/\d/.test(newPassword)) {
      setPasswordError('Password must include at least one number.')
      return
    }
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword)) {
      setPasswordError('Password must include at least one special character.')
      return
    }
    if (newPassword !== confirm) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setUpdatingPassword(true)
    try {
      await apiPost('/api/users/me/password', {
        current_password: current,
        new_password: newPassword,
        confirm_password: confirm,
      })
      setPasswordSuccess('Your password has been securely updated.')
      setPasswordState({ current: '', newPassword: '', confirm: '' })
      showToast('Password updated successfully.')
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Check your current password.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  // 3. Security Handlers
  async function handleRevokeSession(sessionId) {
    try {
      await apiDelete(`/api/users/me/sessions/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      showToast('Session terminated successfully.')
    } catch {
      showToast('The session could not be revoked.')
    }
  }

  // 4. Notifications Handlers
  async function handleSaveNotifications() {
    try {
      await apiPut('/api/users/me/notifications/preferences', {
        document_access_requests: notifications.documentAccessRequests,
        access_granted: notifications.accessGranted,
        access_revoked: notifications.accessRevoked,
        access_request_decisions: notifications.accessRequestDecisions,
        document_activity: notifications.documentActivity,
        security_alerts: notifications.securityAlerts,
        product_updates: notifications.productUpdates,
        marketing_communications: notifications.marketingCommunications,
      })
      showToast('Notification preferences saved successfully.')
    } catch (error) {
      showToast(error.message || 'Notification preferences could not be saved.')
    }
  }

  // 5. Preferences Handlers
  async function handleSavePreferences() {
    try {
      await apiPut('/api/users/me/preferences', {
        appearance: preferences.appearance,
        language: preferences.language,
        date_format: preferences.dateFormat,
        time_format: preferences.timeFormat,
        default_view: preferences.defaultView,
      })
      showToast('Preferences saved successfully.')
    } catch (error) {
      showToast(error.message || 'Preferences could not be saved.')
    }
  }

  // 6. Connected Accounts Handlers
  async function handleToggleIntegration(providerId) {
    try {
      const res = await apiPost(`/api/users/me/integrations/${providerId}/toggle`, {})
      if (Array.isArray(res)) {
        setIntegrations(res)
      } else {
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === providerId ? { ...item, connected: !item.connected } : item
          )
        )
      }
      const target = integrations.find((i) => i.id === providerId)
      showToast(target?.connected ? `Disconnected ${target.name}.` : `Connected ${target?.name} successfully.`)
    } catch (error) {
      showToast(error.message || 'This integration is not configured.')
    }
  }

  // Titles & breadcrumbs per subsection
  const sectionMeta = {
    account: {
      breadcrumb: 'Security', // Matches the PDF screenshot Page 1 breadcrumb literally
      title: 'Profile & Settings',
      subtitle: 'Manage your account information, security settings, and preferences.',
    },
    security: {
      breadcrumb: 'Security',
      title: 'Profile & Settings',
      subtitle: 'Manage your account information, security settings, and preferences.',
    },
    notifications: {
      breadcrumb: 'Notifications',
      title: 'Profile & Settings',
      subtitle: 'Manage your account information, security settings, and preferences.',
    },
    preferences: {
      breadcrumb: 'Preferences',
      title: 'Profile & Settings',
      subtitle: 'Manage your app preferences in SureDocs.',
    },
    storage: {
      breadcrumb: 'Storage',
      title: 'Storage Usage',
      subtitle: 'View your storage usage and manage your files.',
    },
    connected: {
      breadcrumb: 'Connected Accounts',
      title: 'Connected Accounts',
      subtitle: 'Link your accounts to easily access and manage your documents.',
    },
  }[activeSection] || {
    breadcrumb: 'Security',
    title: 'Profile & Settings',
    subtitle: 'Manage your account information, security settings, and preferences.',
  }

  // Password requirements checklist evaluation
  const newPw = passwordState.newPassword
  const reqLen = newPw.length >= 8
  const reqCase = /[A-Z]/.test(newPw) && /[a-z]/.test(newPw)
  const reqNum = /\d/.test(newPw)
  const reqSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPw)

  return (
    <div className="ps-workspace">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="ps-toast" role="status">
          <PsiIcon className="h-4 w-4 text-emerald-400" name="checkCircle" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb matching reference */}
      <nav aria-label="Breadcrumb" className="ps-breadcrumb">
        <a href="/employee">Dashboard</a>
        <span className="ps-breadcrumb-sep">&gt;</span>
        <a href="/employee/profile" onClick={(e) => { e.preventDefault(); navigateTo('account') }}>
          Profile &amp; Settings
        </a>
        <span className="ps-breadcrumb-sep">&gt;</span>
        <span className="ps-breadcrumb-current">{sectionMeta.breadcrumb}</span>
      </nav>

      {/* Main Heading */}
      <header className="ps-header">
        <h1 className="ps-title">{sectionMeta.title}</h1>
        <p className="ps-subtitle">{sectionMeta.subtitle}</p>
      </header>

      {/* ====================================================================
          SCREEN 1: ACCOUNT INFORMATION
          ==================================================================== */}
      {activeSection === 'account' && (
        <div className="ps-two-column">
          {/* Left Settings Navigation Panel */}
          <aside className="ps-nav-card" role="navigation">
            <button
              className="ps-nav-item ps-nav-item--active"
              onClick={() => navigateTo('account')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="user" />
              <span>Account Information</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('security')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="shield" />
              <span>Security</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('notifications')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="bell" />
              <span>Notifications</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('preferences')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="sliders" />
              <span>Preferences</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('storage')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="storage" />
              <span>Storage</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('connected')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="link" />
              <span>Connected Accounts</span>
            </button>
          </aside>

          {/* Right Content Area */}
          <main className="ps-content-stack">
            {/* Main Account Information Card (Matches Page 1) */}
            <div className="ps-card">
              <div className="ps-card-header">
                <div className="ps-card-header-left">
                  <div className="ps-card-header-icon">
                    <PsiIcon className="h-5 w-5" name="user" />
                  </div>
                  <div>
                    <h2 className="ps-card-heading">Account Information</h2>
                    <p className="ps-card-subtitle">View and update your account details.</p>
                  </div>
                </div>
                {isEditingProfile ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="ps-btn-outline"
                      onClick={() => setIsEditingProfile(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="ps-btn-primary"
                      disabled={savingProfile}
                      onClick={handleSaveProfile}
                      type="button"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                ) : (
                  <button
                    className="ps-btn-outline"
                    onClick={() => setIsEditingProfile(true)}
                    type="button"
                  >
                    <PsiIcon className="h-3.5 w-3.5" name="edit" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>

              {/* Avatar Hero */}
              <div className="ps-user-hero">
                {profile.avatarUrl ? (
                  <img
                    alt={profile.fullName}
                    className="ps-avatar-circle object-cover"
                    src={profile.avatarUrl}
                  />
                ) : (
                  <div className="ps-avatar-circle">P</div>
                )}
                <div className="ps-user-info">
                  <h3 className="ps-user-name">{profile.fullName}</h3>
                  <span className="ps-user-role">{profile.jobTitle || 'Product Analyst'}</span>
                  <span className="ps-badge-active">
                    <PsiIcon className="h-3 w-3" name="check" />
                    <span>Active</span>
                  </span>
                </div>
              </div>

              {/* Two-Column Form Fields */}
              <div className="ps-form-grid">
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-name">Full Name</label>
                  <input
                    className="ps-input"
                    disabled={!isEditingProfile}
                    id="field-name"
                    onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    value={profile.fullName}
                  />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-email">Email Address</label>
                  <input
                    className="ps-input"
                    disabled
                    id="field-email"
                    value={profile.email}
                  />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-dept">Department</label>
                  <input
                    className="ps-input"
                    disabled={!isEditingProfile}
                    id="field-dept"
                    onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                    value={profile.department}
                  />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-role">Role</label>
                  <input
                    className="ps-input"
                    disabled
                    id="field-role"
                    value="Employee"
                  />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-phone">Phone Number</label>
                  <input
                    className="ps-input"
                    disabled={!isEditingProfile}
                    id="field-phone"
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    value={profile.phone}
                  />
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="field-loc">Location</label>
                  <input
                    className="ps-input"
                    disabled={!isEditingProfile}
                    id="field-loc"
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    value={profile.location}
                  />
                </div>
              </div>

              {/* Bio Field with character counter matching reference */}
              <div className="ps-textarea-wrap">
                <label className="ps-label" htmlFor="field-bio">Bio</label>
                <textarea
                  className="ps-textarea"
                  disabled={!isEditingProfile}
                  id="field-bio"
                  maxLength={500}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  rows={2}
                  value={profile.bio}
                />
                <span className="ps-char-count">{profile.bio.length}/500</span>
              </div>
            </div>

            {/* Profile Picture Card */}
            <div className="ps-card">
              <div className="ps-card-header">
                <div>
                  <h2 className="ps-card-heading">Profile Picture</h2>
                  <p className="ps-card-subtitle">Update your profile picture.</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                {profile.avatarUrl ? (
                  <img
                    alt={profile.fullName}
                    className="h-16 w-16 rounded-full object-cover"
                    src={profile.avatarUrl}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#8b5cf6] text-white flex items-center justify-center text-2xl font-bold">
                    P
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    ref={fileInputRef}
                    type="file"
                  />
                  <button
                    className="ps-btn-outline w-fit"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    Change Photo
                  </button>
                  <span className="text-xs text-[#64709a]">JPG, PNG up to 2 MB.</span>
                </div>
              </div>
            </div>

            {/* Password Card */}
            <div className="ps-card">
              <div className="ps-card-header">
                <div>
                  <h2 className="ps-card-heading">Password</h2>
                  <p className="ps-card-subtitle">Update your password to keep your account secure.</p>
                </div>
              </div>
              <form onSubmit={handleUpdatePassword}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="ps-field">
                    <label className="ps-label" htmlFor="acc-curr-pw">Current Password</label>
                    <div className="ps-input-wrap">
                      <input
                        className="ps-input"
                        id="acc-curr-pw"
                        onChange={(e) => setPasswordState({ ...passwordState, current: e.target.value })}
                        placeholder="Enter current password"
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordState.current}
                      />
                      <button
                        className="ps-btn-eye"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        type="button"
                      >
                        <PsiIcon className="h-4 w-4" name={showPasswords.current ? 'eyeOff' : 'eye'} />
                      </button>
                    </div>
                  </div>
                  <div className="ps-field">
                    <label className="ps-label" htmlFor="acc-new-pw">New Password</label>
                    <div className="ps-input-wrap">
                      <input
                        className="ps-input"
                        id="acc-new-pw"
                        onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })}
                        placeholder="Enter new password"
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordState.newPassword}
                      />
                      <button
                        className="ps-btn-eye"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        type="button"
                      >
                        <PsiIcon className="h-4 w-4" name={showPasswords.new ? 'eyeOff' : 'eye'} />
                      </button>
                    </div>
                  </div>
                  <div className="ps-field">
                    <label className="ps-label" htmlFor="acc-conf-pw">Confirm New Password</label>
                    <div className="ps-input-wrap">
                      <input
                        className="ps-input"
                        id="acc-conf-pw"
                        onChange={(e) => setPasswordState({ ...passwordState, confirm: e.target.value })}
                        placeholder="Confirm new password"
                        type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordState.confirm}
                      />
                      <button
                        className="ps-btn-eye"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        type="button"
                      >
                        <PsiIcon className="h-4 w-4" name={showPasswords.confirm ? 'eyeOff' : 'eye'} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Requirements Panel */}
                <div className="ps-requirements-box">
                  <div className="ps-requirements-title">Password Requirements</div>
                  <div className="ps-requirements-list">
                    <div className={`ps-req-item ${reqLen ? 'ps-req--valid' : ''}`}>
                      <span className="ps-req-dot" />
                      <span>At least 8 characters long</span>
                    </div>
                    <div className={`ps-req-item ${reqCase ? 'ps-req--valid' : ''}`}>
                      <span className="ps-req-dot" />
                      <span>Include uppercase and lowercase letters</span>
                    </div>
                    <div className={`ps-req-item ${reqNum ? 'ps-req--valid' : ''}`}>
                      <span className="ps-req-dot" />
                      <span>Include at least one number</span>
                    </div>
                    <div className={`ps-req-item ${reqSpecial ? 'ps-req--valid' : ''}`}>
                      <span className="ps-req-dot" />
                      <span>Include at least one special character</span>
                    </div>
                  </div>
                </div>

                {passwordError && (
                  <p className="mt-3 text-xs font-semibold text-rose-600">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordSuccess}</p>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    className="ps-btn-primary"
                    disabled={updatingPassword}
                    type="submit"
                  >
                    {updatingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* Account Status Card */}
            <div className="ps-card">
              <div className="ps-card-header">
                <div>
                  <h2 className="ps-card-heading">Account Status</h2>
                  <p className="ps-card-subtitle">Your account is active and in good standing.</p>
                </div>
              </div>
              <div className="ps-status-box">
                <div className="ps-status-left">
                  <PsiIcon className="ps-status-icon" name="checkCircle" />
                  <div>
                    <h3 className="ps-status-title">Active Account</h3>
                    <p className="ps-status-desc">Your account is active and you have full access to SureDocs.</p>
                  </div>
                </div>
                <span className="ps-badge-active">
                  <PsiIcon className="h-3 w-3" name="check" />
                  <span>Active</span>
                </span>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ====================================================================
          SCREEN 2: SECURITY
          ==================================================================== */}
      {activeSection === 'security' && (
        <div className="ps-two-column">
          {/* Left Settings Navigation Panel */}
          <aside className="ps-nav-card" role="navigation">
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('account')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="user" />
              <span>Account Information</span>
            </button>
            <button
              className="ps-nav-item ps-nav-item--active"
              onClick={() => navigateTo('security')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="shield" />
              <span>Security</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('notifications')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="bell" />
              <span>Notifications</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('preferences')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="sliders" />
              <span>Preferences</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('storage')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="storage" />
              <span>Storage</span>
            </button>
            <button
              className="ps-nav-item"
              onClick={() => navigateTo('connected')}
              type="button"
            >
              <PsiIcon className="ps-nav-icon" name="link" />
              <span>Connected Accounts</span>
            </button>
          </aside>

          {/* Right Security Stack */}
          <main className="ps-content-stack">
            {/* Top Header Card */}
            <div className="ps-card mb-5">
              <div className="ps-card-header-left">
                <div className="ps-card-header-icon">
                  <PsiIcon className="h-5 w-5" name="lock" />
                </div>
                <div>
                  <h2 className="ps-card-heading">Security Settings</h2>
                  <p className="ps-card-subtitle">Manage your account security and sign-in preferences.</p>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="ps-security-grid">
              {/* Change Password Card */}
              <div className="ps-card">
                <h3 className="ps-card-heading mb-4">Change Password</h3>
                <form onSubmit={handleUpdatePassword}>
                  <div className="flex flex-col gap-3">
                    <div className="ps-field">
                      <label className="ps-label" htmlFor="sec-curr-pw">Current Password</label>
                      <div className="ps-input-wrap">
                        <input
                          className="ps-input"
                          id="sec-curr-pw"
                          onChange={(e) => setPasswordState({ ...passwordState, current: e.target.value })}
                          placeholder="Enter current password"
                          type={showPasswords.current ? 'text' : 'password'}
                          value={passwordState.current}
                        />
                        <button
                          className="ps-btn-eye"
                          onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                          type="button"
                        >
                          <PsiIcon className="h-4 w-4" name={showPasswords.current ? 'eyeOff' : 'eye'} />
                        </button>
                      </div>
                    </div>
                    <div className="ps-field">
                      <label className="ps-label" htmlFor="sec-new-pw">New Password</label>
                      <div className="ps-input-wrap">
                        <input
                          className="ps-input"
                          id="sec-new-pw"
                          onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })}
                          placeholder="Enter new password"
                          type={showPasswords.new ? 'text' : 'password'}
                          value={passwordState.newPassword}
                        />
                        <button
                          className="ps-btn-eye"
                          onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                          type="button"
                        >
                          <PsiIcon className="h-4 w-4" name={showPasswords.new ? 'eyeOff' : 'eye'} />
                        </button>
                      </div>
                    </div>
                    <div className="ps-field">
                      <label className="ps-label" htmlFor="sec-conf-pw">Confirm New Password</label>
                      <div className="ps-input-wrap">
                        <input
                          className="ps-input"
                          id="sec-conf-pw"
                          onChange={(e) => setPasswordState({ ...passwordState, confirm: e.target.value })}
                          placeholder="Confirm new password"
                          type={showPasswords.confirm ? 'text' : 'password'}
                          value={passwordState.confirm}
                        />
                        <button
                          className="ps-btn-eye"
                          onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                          type="button"
                        >
                          <PsiIcon className="h-4 w-4" name={showPasswords.confirm ? 'eyeOff' : 'eye'} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="mt-2 text-xs font-semibold text-rose-600">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className="mt-2 text-xs font-semibold text-emerald-600">{passwordSuccess}</p>
                  )}

                  <button
                    className="ps-btn-primary mt-4 w-full"
                    disabled={updatingPassword}
                    type="submit"
                  >
                    {updatingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>

            </div>

            {/* Active Sessions Card */}
            <div className="ps-card">
              <div className="flex items-center gap-2 mb-1">
                <PsiIcon className="h-5 w-5 text-[#3b49df]" name="monitor" />
                <h3 className="ps-card-heading">Active Sessions</h3>
              </div>
              <p className="ps-card-subtitle mb-4">Manage your active login sessions.</p>

              <div className="ps-table-wrap">
                <table className="ps-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Location</th>
                      <th>Last Active</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td className="ps-session-device">{session.device}</td>
                        <td>{session.location}</td>
                        <td>{session.lastActive}</td>
                        <td>
                          {session.status === 'Current' || session.isCurrent ? (
                            <span className="ps-badge-current">Current</span>
                          ) : (
                            <span className="ps-badge-logout">Logout</span>
                          )}
                        </td>
                        <td>
                          {session.status === 'Current' || session.isCurrent ? (
                            <button
                              className="ps-dots-btn"
                              title="Current active session"
                              type="button"
                            >
                              <PsiIcon className="h-4 w-4" name="dots" />
                            </button>
                          ) : (
                            <button
                              className="ps-dots-btn"
                              onClick={() => handleRevokeSession(session.id)}
                              title="Revoke session"
                              type="button"
                            >
                              <PsiIcon className="h-4 w-4" name="dots" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ====================================================================
          SCREEN 3: NOTIFICATIONS
          ==================================================================== */}
      {activeSection === 'notifications' && (
        <main>
          <div className="ps-notifications-card">
            {/* Row 1: Document Access Requests */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="mail" />
                <div>
                  <h3 className="ps-notif-title">Document Access Requests</h3>
                  <p className="ps-notif-desc">Get notified when someone requests access to your documents.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.documentAccessRequests}
                  onChange={(e) => setNotifications({ ...notifications, documentAccessRequests: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 2: Access Granted */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="users" />
                <div>
                  <h3 className="ps-notif-title">Access Granted</h3>
                  <p className="ps-notif-desc">Get notified when access is granted to your documents.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.accessGranted}
                  onChange={(e) => setNotifications({ ...notifications, accessGranted: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 3: Access Revoked */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="user" />
                <div>
                  <h3 className="ps-notif-title">Access Revoked</h3>
                  <p className="ps-notif-desc">Get notified when access is revoked.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.accessRevoked}
                  onChange={(e) => setNotifications({ ...notifications, accessRevoked: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 4: Document Activity */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="document" />
                <div>
                  <h3 className="ps-notif-title">Document Activity</h3>
                  <p className="ps-notif-desc">Get notified about important document activities.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.documentActivity}
                  onChange={(e) => setNotifications({ ...notifications, documentActivity: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 5: Security Alerts */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="shieldCheck" />
                <div>
                  <h3 className="ps-notif-title">Security Alerts</h3>
                  <p className="ps-notif-desc">Get notified about suspicious activity or security events.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.securityAlerts}
                  onChange={(e) => setNotifications({ ...notifications, securityAlerts: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 6: Product Updates */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="megaphone" />
                <div>
                  <h3 className="ps-notif-title">Product Updates</h3>
                  <p className="ps-notif-desc">Get notified about new features and updates.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.productUpdates}
                  onChange={(e) => setNotifications({ ...notifications, productUpdates: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>

            {/* Row 7: Marketing Communications */}
            <div className="ps-notif-row">
              <div className="ps-notif-left">
                <PsiIcon className="ps-notif-icon" name="mail" />
                <div>
                  <h3 className="ps-notif-title">Marketing Communications</h3>
                  <p className="ps-notif-desc">Receive product tips, guides, and best practices.</p>
                </div>
              </div>
              <label className="ps-switch">
                <input
                  checked={notifications.marketingCommunications}
                  onChange={(e) => setNotifications({ ...notifications, marketingCommunications: e.target.checked })}
                  type="checkbox"
                />
                <span className="ps-slider" />
              </label>
            </div>
          </div>

          <div className="ps-bottom-actions">
            <button
              className="ps-btn-primary"
              onClick={handleSaveNotifications}
              type="button"
            >
              Save Preferences
            </button>
          </div>
        </main>
      )}

      {/* ====================================================================
          SCREEN 4: PREFERENCES
          ==================================================================== */}
      {activeSection === 'preferences' && (
        <main>
          <div className="ps-card">
            {/* Appearance */}
            <section className="ps-pref-section">
              <div className="ps-pref-header">
                <PsiIcon className="ps-pref-icon" name="monitor" />
                <div>
                  <h2 className="ps-pref-title">Appearance</h2>
                  <p className="ps-pref-subtitle">Choose your preferred theme.</p>
                </div>
              </div>
              <div className="ps-options-grid">
                <div
                  className={`ps-option-card ${preferences.appearance === 'light' ? 'ps-option--selected' : ''}`}
                  onClick={() => setPreferences({ ...preferences, appearance: 'light' })}
                >
                  <div className="ps-radio">
                    {preferences.appearance === 'light' && <div className="ps-radio-inner" />}
                  </div>
                  <div>
                    <h3 className="ps-option-title">Light Mode</h3>
                    <p className="ps-option-desc">Clean and bright interface</p>
                  </div>
                </div>

                <div
                  className={`ps-option-card ${preferences.appearance === 'dark' ? 'ps-option--selected' : ''}`}
                  onClick={() => setPreferences({ ...preferences, appearance: 'dark' })}
                >
                  <div className="ps-radio">
                    {preferences.appearance === 'dark' && <div className="ps-radio-inner" />}
                  </div>
                  <div>
                    <h3 className="ps-option-title">Dark Mode</h3>
                    <p className="ps-option-desc">Comfortable for low light</p>
                  </div>
                </div>

                <div
                  className={`ps-option-card ${preferences.appearance === 'system' ? 'ps-option--selected' : ''}`}
                  onClick={() => setPreferences({ ...preferences, appearance: 'system' })}
                >
                  <div className="ps-radio">
                    {preferences.appearance === 'system' && <div className="ps-radio-inner" />}
                  </div>
                  <div>
                    <h3 className="ps-option-title">System Default</h3>
                    <p className="ps-option-desc">Use system settings</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Language */}
            <section className="ps-pref-section">
              <div className="ps-pref-header">
                <PsiIcon className="ps-pref-icon" name="globe" />
                <div>
                  <h2 className="ps-pref-title">Language</h2>
                  <p className="ps-pref-subtitle">Select your preferred language.</p>
                </div>
              </div>
              <div className="ps-select-wrap">
                <select
                  className="ps-select"
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                  value={preferences.language}
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Hindi">Hindi (हिन्दी)</option>
                  <option value="Spanish">Spanish (Español)</option>
                  <option value="French">French (Français)</option>
                  <option value="German">German (Deutsch)</option>
                </select>
                <svg className="ps-select-chevron" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </section>

            {/* Date & Time */}
            <section className="ps-pref-section">
              <div className="ps-pref-header">
                <PsiIcon className="ps-pref-icon" name="calendar" />
                <div>
                  <h2 className="ps-pref-title">Date &amp; Time</h2>
                  <p className="ps-pref-subtitle">Choose your date and time format.</p>
                </div>
              </div>
              <div className="ps-datetime-row">
                <div className="ps-field">
                  <label className="ps-label">Date Format</label>
                  <div className="ps-select-wrap">
                    <select
                      className="ps-select"
                      onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                      value={preferences.dateFormat}
                    >
                      <option value="Oct 24, 2026">Oct 24, 2026</option>
                      <option value="24/10/2026">24/10/2026</option>
                      <option value="2026-10-24">2026-10-24</option>
                    </select>
                    <svg className="ps-select-chevron" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <div className="ps-field">
                  <label className="ps-label flex items-center gap-1.5">
                    <PsiIcon className="h-3.5 w-3.5 text-[#3b49df]" name="clock" />
                    <span>Time Format</span>
                  </label>
                  <div className="ps-select-wrap">
                    <select
                      className="ps-select"
                      onChange={(e) => setPreferences({ ...preferences, timeFormat: e.target.value })}
                      value={preferences.timeFormat}
                    >
                      <option value="12-hour (AM/PM)">12-hour (AM/PM)</option>
                      <option value="24-hour">24-hour</option>
                    </select>
                    <svg className="ps-select-chevron" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            {/* Default View */}
            <section className="ps-pref-section">
              <div className="ps-pref-header">
                <PsiIcon className="ps-pref-icon" name="grid" />
                <div>
                  <h2 className="ps-pref-title">Default View</h2>
                  <p className="ps-pref-subtitle">Choose the default view for documents.</p>
                </div>
              </div>
              <div className="ps-options-grid ps-options-grid--two">
                <div
                  className={`ps-option-card ${preferences.defaultView === 'list' ? 'ps-option--selected' : ''}`}
                  onClick={() => setPreferences({ ...preferences, defaultView: 'list' })}
                >
                  <div className="ps-radio">
                    {preferences.defaultView === 'list' && <div className="ps-radio-inner" />}
                  </div>
                  <div>
                    <h3 className="ps-option-title">List View</h3>
                    <p className="ps-option-desc">Show documents in a list</p>
                  </div>
                </div>

                <div
                  className={`ps-option-card ${preferences.defaultView === 'grid' ? 'ps-option--selected' : ''}`}
                  onClick={() => setPreferences({ ...preferences, defaultView: 'grid' })}
                >
                  <div className="ps-radio">
                    {preferences.defaultView === 'grid' && <div className="ps-radio-inner" />}
                  </div>
                  <div>
                    <h3 className="ps-option-title">Grid View</h3>
                    <p className="ps-option-desc">Show documents in a grid</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="ps-bottom-actions">
            <button
              className="ps-btn-primary"
              onClick={handleSavePreferences}
              type="button"
            >
              Save Preferences
            </button>
          </div>
        </main>
      )}

      {/* ====================================================================
          SCREEN 5: STORAGE
          ==================================================================== */}
      {activeSection === 'storage' && (
        <main>
          {/* Top Row: Donut Overview & Storage Limit Card */}
          <div className="ps-storage-top">
            {/* Storage Overview Card */}
            <div className="ps-card">
              <div className="ps-storage-overview-content">
                {/* SVG Donut Ring Chart */}
                <div className="ps-donut-wrap">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                    {/* Background Track (Available) */}
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="#e2e8f0"
                      strokeWidth="11"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="#2563eb"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - (Number(storageData.documentsGb) / (Number(storageData.usedGb) || 1)))}
                      strokeWidth="11"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="#8b5cf6"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - ((Number(storageData.versionsMb) / 1024) / (Number(storageData.usedGb) || 1)))}
                      strokeWidth="11"
                      style={{
                        transform: `rotate(${(Number(storageData.documentsGb) / (Number(storageData.usedGb) || 1)) * 360}deg)`,
                        transformOrigin: '50% 50%',
                      }}
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="#ef4444"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - ((Number(storageData.trashMb) / 1024) / (Number(storageData.usedGb) || 1)))}
                      strokeWidth="11"
                      style={{
                        transform: `rotate(${((Number(storageData.documentsGb) + Number(storageData.versionsMb) / 1024) / (Number(storageData.usedGb) || 1)) * 360}deg)`,
                        transformOrigin: '50% 50%',
                      }}
                    />
                  </svg>
                  <div className="ps-donut-center">
                    <span className="ps-donut-used">{storageData.usedGb} GB</span>
                    <span className="ps-donut-desc">stored versions</span>
                    <span className="ps-donut-desc">quota not configured</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="ps-storage-legend">
                  {[
                    { label: 'Documents', size: `${storageData.documentsGb} GB`, color: '#2563eb' },
                    { label: 'Versions', size: `${storageData.versionsMb} MB`, color: '#8b5cf6' },
                    { label: 'Trash', size: `${storageData.trashMb} MB`, color: '#ef4444' },
                  ].map((item) => (
                    <div className="ps-legend-item" key={item.label}>
                      <span className="ps-legend-label">
                        <span className="ps-legend-dot" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                      </span>
                      <span className="ps-legend-value">{item.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Storage Limit Card */}
            <div className="ps-card ps-storage-limit-card">
              <span className="ps-limit-label">Storage Limit</span>
              <span className="ps-limit-value">Not configured</span>
              <button
                className="ps-btn-outline w-full justify-center"
                disabled
                title="Storage quotas are not configured."
                type="button"
              >
                Quota unavailable
              </button>
            </div>
          </div>

          {/* Bottom Card: Storage Breakdown Table */}
          <div className="ps-card">
            <div className="flex items-center gap-2 mb-4">
              <PsiIcon className="h-5 w-5 text-[#3b49df]" name="storage" />
              <h2 className="ps-card-heading">Storage Breakdown</h2>
            </div>

            <div className="ps-table-wrap">
              <table className="ps-table">
                <thead>
                  <tr>
                    <th>File Type</th>
                    <th>Count</th>
                    <th>Size</th>
                    <th>Percentage</th>
                    <th style={{ width: '38%' }}><span className="sr-only">Usage Distribution</span></th>
                  </tr>
                </thead>
                <tbody>
                  {storageData.breakdown.map((row) => (
                    <tr key={row.type}>
                      <td>
                        <FileTypeBadge type={row.type} />
                      </td>
                      <td>{row.count}</td>
                      <td className="font-semibold text-slate-800">{row.size}</td>
                      <td className="font-medium text-slate-700">{row.percentage}%</td>
                      <td>
                        <div className="ps-progress-bar-wrap">
                          <div
                            className="ps-progress-bar-fill"
                            style={{
                              width: `${row.percentage}%`,
                              backgroundColor: row.barColor,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {storageData.breakdown.length === 0 && <tr><td className="text-center text-slate-500" colSpan="5">No stored document versions are recorded for this account.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* ====================================================================
          SCREEN 6: CONNECTED ACCOUNTS
          ==================================================================== */}
      {activeSection === 'connected' && (
        <main>
          <div className="ps-card">
            {integrations.map((item) => (
              <div className="ps-integration-row" key={item.id}>
                <div className="ps-integration-left">
                  <div className="ps-integration-logo">
                    {item.id === 'google-drive' && <GoogleDriveLogo className="h-7 w-7" />}
                    {item.id === 'onedrive' && <OneDriveLogo className="h-7 w-7" />}
                    {item.id === 'dropbox' && <DropboxLogo className="h-7 w-7" />}
                    {item.id === 'slack' && <SlackLogo className="h-7 w-7" />}
                    {item.id === 'ms365' && <Microsoft365Logo className="h-7 w-7" />}
                  </div>
                  <div>
                    <h3 className="ps-integration-title">{item.name}</h3>
                    <p className="ps-integration-desc">{item.description}</p>
                  </div>
                </div>

                <div className="ps-integration-actions">
                  {item.status === 'Not configured' ? (
                    <span className="text-xs font-semibold text-slate-500">Not configured</span>
                  ) : item.connected ? (
                    <>
                      <span className="ps-badge-connected">
                        <PsiIcon className="h-3 w-3" name="check" />
                        <span>Connected</span>
                      </span>
                      <button
                        className="ps-dots-btn"
                        onClick={() => handleToggleIntegration(item.id)}
                        title="Disconnect account"
                        type="button"
                      >
                        <PsiIcon className="h-4 w-4" name="dots" />
                      </button>
                    </>
                  ) : (
                    <button
                      className="ps-btn-outline"
                      disabled={item.status === 'Not configured'}
                      onClick={() => handleToggleIntegration(item.id)}
                      type="button"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  )
}

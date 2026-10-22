import { useEffect, useState } from 'react'
import { apiGet, apiPost } from './api.js'
import AdminDashboard from './AdminDashboard.jsx'
import EmployeeDashboard from './EmployeeDashboard.jsx'

function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      className="login-brand-mark"
      viewBox="0 0 20 22"
    >
      <path
        d="M3 1.5h9.5L17 6v14.5H3z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m12.2 4.2 1.6 1.6h-1.6zM9.7 8.1 7 9.2v2.1c0 1.7 1.1 2.8 2.7 3.5 1.6-.7 2.7-1.8 2.7-3.5V9.2L9.7 8.1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="login-eye-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M2.5 12s3.3-6.2 9.5-6.2 9.5 6.2 9.5 6.2-3.3 6.2-9.5 6.2S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" className="login-eye-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="m3 3 18 18M10.7 10.7a2 2 0 0 0 2.6 2.6M7.2 7.4C4.5 9.1 3 12 3 12s3.3 6.2 9 6.2c2 0 3.7-.7 5.2-1.7m-2.1-2.1A9.9 9.9 0 0 0 21 12s-3.3-6.2-9-6.2c-1 0-1.9.2-2.8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="login-spinner"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function LoginField({ id, label, type, placeholder, value, onChange, error, trailing }) {
  return (
    <div className="login-field">
      <label className="login-field-label" htmlFor={id}>
        {label}
      </label>
      <div
        className={`login-input-wrap${error ? ' has-error' : ''}`}
      >
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          aria-required="true"
          autoComplete={id === 'email' ? 'email' : 'current-password'}
          className="login-input"
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailing}
      </div>
      {error && (
        <p className="login-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function BrandingSection() {
  return (
    <section className="login-brand-panel">
      <header className="login-brand-header">
        <div className="login-brand-name">
          <BrandMark />
          <span>SureDocs</span>
        </div>
        <span className="login-micro-label">WORKSPACE / SIGN IN</span>
      </header>
      <div className="login-illustration-wrap">
        <AccessIllustration />
      </div>
      <div className="login-brand-copy">
        <div className="login-eyebrow">
          <span />SECURE DOCUMENT WORKSPACE
        </div>
        <h2>
          Confidentiality, <span>built into<br className="login-desktop-break" /> every document.</span>
        </h2>
        <p>
          One secure workspace for the documents your<br className="login-desktop-break" /> organization depends on.
        </p>
      </div>
      <div className="login-features">
        <div><span className="login-feature-number">01</span><strong>Controlled access</strong></div>
        <div><span className="login-feature-number">02</span><strong>Document-level permissions</strong></div>
        <div><span className="login-feature-number">03</span><strong>Auditable activity</strong></div>
      </div>
    </section>
  )
}

function AccessIllustration() {
  return (
    <svg
      aria-label="Layered documents with access permissions and audit activity"
      className="login-illustration"
      role="img"
      viewBox="0 0 300 220"
      fill="none"
    >
      <g stroke="#e6e2dc" strokeWidth=".7" strokeDasharray="1 2">
        <path d="M15 57h270M15 150h270M46 10v196M254 10v196" />
        <path
          d="M24 26h22M24 26v22M276 26h-22M276 26v22M24 194h22M24 194v-22M276 194h-22M276 194v-22"
          stroke="#777f85"
          strokeWidth="1"
          strokeDasharray="none"
        />
      </g>
      <g stroke="#d4d0c9" strokeWidth=".9">
        <path d="M103 43h81l15 15v121h-96z" fill="#f4f2ee" />
        <path d="M184 43v15h15" />
        <path d="M87 57h81l15 15v120H87z" fill="#f7f5f1" />
        <path d="M168 57v15h15" />
      </g>
      <g stroke="#535961" strokeWidth="1">
        <path d="M51 74h83l14 14v108H51z" fill="#fff" />
        <path d="M134 74v14h14" />
      </g>
      <circle cx="51" cy="74" r="4.4" fill="#151a20" />
      <path d="M49.2 74h3.6M51 72.2v3.6" stroke="#fff" strokeWidth=".7" />
      <g fill="#78899a" fontFamily="monospace" fontSize="4.8" letterSpacing=".6">
        <text x="59" y="87">CONFIDENTIAL</text>
        <text x="211" y="94">ACCESS · 3 MEMBERS</text>
        <text x="211" y="174">AUDIT LOG · 04:18 UTC</text>
        <text x="59" y="181">SD-0212 · FILE 3</text>
        <text x="41" y="214">FIG. 01 — ACCESS MODEL</text>
      </g>
      <g stroke="#dedbd5" strokeWidth=".8">
        <path d="M59 109h69M59 115h58M59 133h69M59 139h57M59 157h69M59 163h58" />
      </g>
      <g fill="#161a1e">
        <path d="M59 96h47v3.5H59zM59 126h35v3.5H59zM59 150h51v3.5H59z" />
      </g>
      <path d="M148 108h58m0 0v-7h4m-62 7v25h58m0 0v-4h4" stroke="#3150d2" strokeWidth=".9" />
      <path d="M148 133h58m0 0v26h4" stroke="#7b838c" strokeWidth=".8" />
      <circle cx="148" cy="108" r="1.6" fill="#3150d2" />
      <circle cx="148" cy="133" r="1.4" fill="#6f7881" />
      <g>
        <rect x="210" y="95" width="56" height="14" rx="1.2" fill="#fff" stroke="#3150d2" strokeWidth=".9" />
        <circle cx="217" cy="102" r="3" fill="#3150d2" />
        <path d="m215.7 102 1 1 1.8-2" stroke="#fff" strokeWidth=".6" />
        <text x="223" y="104" fill="#2946c5" fontFamily="monospace" fontSize="5.4">Owner</text>
        <rect x="210" y="121" width="56" height="14" rx="1.2" fill="#fff" stroke="#8f9499" strokeWidth=".8" />
        <circle cx="217" cy="128" r="3" stroke="#646e78" strokeWidth=".8" />
        <path d="M216 128h2m-1-1v2" stroke="#646e78" strokeWidth=".6" />
        <text x="223" y="130" fill="#323940" fontFamily="monospace" fontSize="5.4">Can edit</text>
        <rect x="210" y="147" width="56" height="14" rx="1.2" fill="#f6f5f2" stroke="#d7d3cd" strokeWidth=".8" />
        <circle cx="217" cy="154" r="3" stroke="#a8a9a7" strokeWidth=".8" />
        <text x="223" y="156" fill="#95999d" fontFamily="monospace" fontSize="5.2">View only</text>
      </g>
      <g stroke="#7b8792" strokeWidth=".8">
        <path d="M214 184v5m5-7v7m5-5v5m5-8v8m5-4v4m5-7v7m5-5v5m5-9v9m5-4v4m5-7v7m5-5v5m5-9v9" />
      </g>
      <path d="M269 181v9" stroke="#3150d2" strokeWidth="1" />
      <path d="M59 176a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" stroke="#7c8994" strokeWidth=".8" />
      <path d="M61 176h2m-1-1v2" stroke="#7c8994" strokeWidth=".7" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiLogin(email, password) {
  return apiPost('/api/auth/login', { email, password })
}

async function apiGetMe() {
  const data = await apiGet('/api/auth/me')
  return data.user
}

async function apiLogout() {
  await apiPost('/api/auth/logout', null)
}

// ---------------------------------------------------------------------------
// Login form — preserves existing layout and design
// ---------------------------------------------------------------------------

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}

    const trimmedEmail = email.trim()
    if (!trimmedEmail) nextErrors.email = 'Enter your work email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      nextErrors.email = 'Enter a valid email address.'
    if (!password) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    setNotice('')

    if (Object.keys(nextErrors).length > 0) return

    setLoading(true)
    try {
      const data = await apiLogin(trimmedEmail, password)
      onLogin(data.user)
    } catch (err) {
      setNotice(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function updateEmail(event) {
    setEmail(event.target.value)
    if (errors.email) setErrors((current) => ({ ...current, email: '' }))
    setNotice('')
  }

  function updatePassword(event) {
    setPassword(event.target.value)
    if (errors.password) setErrors((current) => ({ ...current, password: '' }))
    setNotice('')
  }

  return (
    <section className="login-form-panel">
      <p className="login-admin-notice">Access is managed by your organization's administrator.</p>
      <div className="login-form-content">
        <h1>Welcome back</h1>
        <p className="login-form-subtitle">Sign in to your SureDocs workspace.</p>
        <form noValidate onSubmit={handleSubmit}>
          <LoginField
            error={errors.email}
            id="email"
            label="Work email"
            onChange={updateEmail}
            placeholder="name@company.com"
            type="email"
            value={email}
          />
          <LoginField
            error={errors.password}
            id="password"
            label="Password"
            onChange={updatePassword}
            placeholder=""
            type={showPassword ? 'text' : 'password'}
            value={password}
            trailing={
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="login-eye-button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                type="button"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
          <div className="login-options">
            <label className="login-remember">
              <input
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              <span>Remember me</span>
            </label>
            <span aria-disabled="true" className="login-link login-unavailable">
              Forgot password?
            </span>
          </div>
          <button
            className="login-submit"
            disabled={loading}
            type="submit"
          >
            {loading ? <SpinnerIcon /> : 'Sign in to SureDocs →'}
          </button>
          <p
            aria-live="polite"
            className={`login-notice${notice ? ' has-notice' : ''}`}
            role="status"
          >
            {notice}
          </p>
        </form>
        <p className="login-support">
          Having trouble signing in?{' '}
          <span aria-disabled="true" className="login-unavailable">
            Contact support.
          </span>
        </p>
      </div>
      <footer className="login-footer">
        <span>© 2026 SureDocs</span>
        <span className="login-encrypted">
          <svg aria-hidden="true" viewBox="0 0 12 14">
            <path d="M3 6V4a3 3 0 0 1 6 0v2M2 6h8v7H2z" fill="currentColor" />
          </svg>
          ENCRYPTED SESSION
        </span>
      </footer>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Application root — authentication state + routing
// ---------------------------------------------------------------------------

function App() {
  const [user, setUser] = useState(null)       // authenticated user from /api/auth/me
  const [checking, setChecking] = useState(true) // initial session check in progress
  const [path, setPath] = useState(window.location.pathname)

  // On mount, validate the existing session cookie
  useEffect(() => {
    let cancelled = false
    apiGetMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => { cancelled = true }
  }, [])

  // Listen for popstate (browser back/forward) to re-render
  useEffect(() => {
    function onPopState() {
      setPath(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Intercept sign-out links in dashboard sidebars (href="/")
  // and call the logout API before navigating.
  useEffect(() => {
    function handleClick(event) {
      const anchor = event.target.closest('a[href="/"]')
      if (!anchor) return
      event.preventDefault()
      apiLogout().finally(() => {
        setUser(null)
        window.history.pushState(null, '', '/')
        setPath('/')
      })
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // Handle successful login
  function handleLogin(authenticatedUser) {
    setUser(authenticatedUser)
    const target = authenticatedUser.role === 'ADMIN' ? '/admin' : '/employee'
    window.history.pushState(null, '', target)
    setPath(target)
  }

  // While checking the session, show a brief loading indicator
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <SpinnerIcon />
      </div>
    )
  }

  // Protected admin routes
  if (path.startsWith('/admin')) {
    if (!user) {
      window.history.replaceState(null, '', '/')
      return (
        <main className="login-page">
          <BrandingSection />
          <LoginForm onLogin={handleLogin} />
        </main>
      )
    }
    if (user.role !== 'ADMIN') {
      window.history.replaceState(null, '', '/employee')
      return <EmployeeDashboard user={user} />
    }
    return <AdminDashboard user={user} />
  }

  // Protected employee routes
  if (path.startsWith('/employee')) {
    if (!user) {
      window.history.replaceState(null, '', '/')
      return (
        <main className="login-page">
          <BrandingSection />
          <LoginForm onLogin={handleLogin} />
        </main>
      )
    }
    return <EmployeeDashboard user={user} />
  }

  // Root path: if authenticated, redirect to dashboard
  if (user) {
    const target = user.role === 'ADMIN' ? '/admin' : '/employee'
    window.history.replaceState(null, '', target)
    if (user.role === 'ADMIN') return <AdminDashboard user={user} />
    return <EmployeeDashboard user={user} />
  }

  // Unauthenticated — show login
  return (
    <main className="login-page">
      <BrandingSection />
      <LoginForm onLogin={handleLogin} />
    </main>
  )
}

export default App

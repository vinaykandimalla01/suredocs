import { useEffect, useState } from 'react'
import AdminDashboard from './AdminDashboard.jsx'
import EmployeeDashboard from './EmployeeDashboard.jsx'
import illustration from './assets/collaboration-illustration.svg'

function ShieldMark({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 44"
    >
      <path
        d="M20 2.5 36 8v12.2c0 9.4-6.2 16.8-16 21.3C10.2 37 4 29.6 4 20.2V8l16-5.5Z"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M14 13h6.2c5.1 0 8.1 2.9 8.1 7.3 0 4.5-3 7.4-8.1 7.4H14V13Zm5.8 10.4c2.2 0 3.5-1.1 3.5-3.1s-1.3-3.1-3.5-3.1h-1v6.2h1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function BrandName({ compact = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ShieldMark
        className={compact ? 'h-8 w-7 text-suredocs-blue' : 'h-14 w-12 text-suredocs-blue'}
      />
      <span
        className={
          compact
            ? 'text-[25px] font-bold tracking-[-1.1px] text-suredocs-ink'
            : 'text-5xl font-bold tracking-[-2.5px] text-suredocs-ink sm:text-6xl'
        }
      >
        SureDocs
      </span>
    </span>
  )
}

function EmailIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="18"
        x="3"
        y="5"
      />
      <path
        d="m3 7 9 5 9-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="15"
        x="4.5"
        y="10"
      />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m3 3 18 18M10.5 10.7a3 3 0 0 0 4.2 4.2M7.4 7.4C4.6 9.2 3 12 3 12s3.5 7 9 7c2 0 3.7-.6 5.2-1.6m-2-2.4A9.8 9.8 0 0 0 21 12s-3.5-7-9-7c-1 0-1.9.2-2.8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 animate-spin"
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

function LoginField({ id, label, type, placeholder, value, onChange, error, icon, trailing }) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-semibold text-suredocs-ink"
        htmlFor={id}
      >
        {label}
      </label>
      <div
        className={`flex h-[50px] items-center gap-3 rounded-[10px] border bg-white px-4 transition focus-within:border-suredocs-blue focus-within:ring-2 focus-within:ring-blue-100 ${
          error ? 'border-red-400' : 'border-suredocs-border'
        }`}
      >
        <span className="shrink-0 text-suredocs-muted">{icon}</span>
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={Boolean(error)}
          aria-required="true"
          autoComplete={id === 'email' ? 'email' : 'current-password'}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-suredocs-ink outline-none placeholder:text-suredocs-placeholder"
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailing && <span className="shrink-0">{trailing}</span>}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}

function BrandingSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-8 text-center lg:min-h-screen lg:w-[58%] lg:px-10 lg:py-12">
      <img
        alt="People collaborating to share folders and documents"
        className="mb-2 w-full max-w-[455px]"
        src={illustration}
      />
      <BrandName />
      <p className="mt-2 text-[17px] font-bold tracking-[0.025em] text-suredocs-ink sm:text-[19px]">
        SECURE. COLLABORATE. SHARE.
      </p>
      <p className="mt-1 text-[17px] text-suredocs-secondary sm:text-[20px]">
        Your Enterprise Document Solution
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || 'Login failed')
  }
  return data
}

async function apiGetMe() {
  const res = await fetch('/api/auth/me', {
    credentials: 'include',
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.user
}

async function apiLogout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}

// ---------------------------------------------------------------------------
// Login form — preserves existing layout and design
// ---------------------------------------------------------------------------

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <section className="flex items-center justify-center px-5 py-6 sm:px-8 lg:min-h-screen lg:w-[42%] lg:px-7 lg:py-10">
      <div className="w-full max-w-[442px] rounded-[18px] border border-white/80 bg-white px-7 py-8 shadow-[0_12px_30px_rgba(29,55,82,0.13)] sm:px-9 sm:py-9">
        <div className="mb-5 flex justify-center">
          <BrandName compact />
        </div>
        <h1 className="mb-7 text-center text-[23px] font-bold tracking-[-0.45px] text-suredocs-ink sm:text-[25px]">
          Sign In to Your Account
        </h1>
        <form className="space-y-5" noValidate onSubmit={handleSubmit}>
          <LoginField
            error={errors.email}
            icon={<EmailIcon />}
            id="email"
            label="Work Email"
            onChange={updateEmail}
            placeholder="Enter your work email"
            type="email"
            value={email}
          />
          <LoginField
            error={errors.password}
            icon={<LockIcon />}
            id="password"
            label="Password"
            onChange={updatePassword}
            placeholder="Enter your password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            trailing={
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="rounded p-1 text-suredocs-muted transition-colors hover:text-suredocs-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                type="button"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            }
          />
          <button
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-suredocs-blue px-5 text-base font-semibold text-white shadow-[0_4px_10px_rgba(37,99,235,0.24)] transition-colors hover:bg-suredocs-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? <SpinnerIcon /> : 'Sign In'}
          </button>
          <p
            aria-live="polite"
            className={`min-h-5 text-center text-sm ${
              notice ? 'text-red-600' : 'text-suredocs-secondary'
            }`}
            role="status"
          >
            {notice}
          </p>
        </form>
      </div>
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
        <main className="login-backdrop flex min-h-screen flex-col lg:flex-row">
          <BrandingSection />
          <LoginForm onLogin={handleLogin} />
        </main>
      )
    }
    if (user.role !== 'ADMIN') {
      window.history.replaceState(null, '', '/employee')
      return <EmployeeDashboard />
    }
    return <AdminDashboard />
  }

  // Protected employee routes
  if (path.startsWith('/employee')) {
    if (!user) {
      window.history.replaceState(null, '', '/')
      return (
        <main className="login-backdrop flex min-h-screen flex-col lg:flex-row">
          <BrandingSection />
          <LoginForm onLogin={handleLogin} />
        </main>
      )
    }
    return <EmployeeDashboard />
  }

  // Root path: if authenticated, redirect to dashboard
  if (user) {
    const target = user.role === 'ADMIN' ? '/admin' : '/employee'
    window.history.replaceState(null, '', target)
    if (user.role === 'ADMIN') return <AdminDashboard />
    return <EmployeeDashboard />
  }

  // Unauthenticated — show login
  return (
    <main className="login-backdrop flex min-h-screen flex-col lg:flex-row">
      <BrandingSection />
      <LoginForm onLogin={handleLogin} />
    </main>
  )
}

export default App


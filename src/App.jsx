import { useState } from 'react'
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

function UserIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 20c.5-3.3 2.7-5.2 6.5-5.2s6 1.9 6.5 5.2"
        stroke="currentColor"
        strokeLinecap="round"
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

function LoginField({ id, label, type, placeholder, value, onChange, error, icon }) {
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
          autoComplete={id === 'username' ? 'username' : 'current-password'}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-suredocs-ink outline-none placeholder:text-suredocs-placeholder"
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          type={type}
          value={value}
        />
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

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}

    if (!username.trim()) nextErrors.username = 'Enter your username.'
    if (!password) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    setNotice('')

    if (Object.keys(nextErrors).length === 0) {
      setNotice('Sign-in is not connected yet. Your details have not been sent.')
    }
  }

  function updateUsername(event) {
    setUsername(event.target.value)
    if (errors.username) setErrors((current) => ({ ...current, username: '' }))
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
            error={errors.username}
            icon={<UserIcon />}
            id="username"
            label="Username"
            onChange={updateUsername}
            placeholder="Enter your username"
            type="text"
            value={username}
          />
          <LoginField
            error={errors.password}
            icon={<LockIcon />}
            id="password"
            label="Password"
            onChange={updatePassword}
            placeholder="Enter your password"
            type="password"
            value={password}
          />
          <button
            className="flex h-[50px] w-full items-center justify-center rounded-full bg-suredocs-blue px-5 text-base font-semibold text-white shadow-[0_4px_10px_rgba(37,99,235,0.24)] transition-colors hover:bg-suredocs-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            type="submit"
          >
            Sign In
          </button>
          <p
            aria-live="polite"
            className={`min-h-5 text-center text-sm ${
              notice ? 'text-suredocs-secondary' : 'text-red-600'
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

function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminDashboard />
  }
  if (window.location.pathname.startsWith('/employee')) {
    return <EmployeeDashboard />
  }

  return (
    <main className="login-backdrop flex min-h-screen flex-col lg:flex-row">
      <BrandingSection />
      <LoginForm />
    </main>
  )
}

export default App

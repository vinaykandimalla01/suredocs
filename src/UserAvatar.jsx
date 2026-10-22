export default function UserAvatar({
  fullName,
  email,
  className = 'h-9 w-9 bg-blue-50 text-[11px] text-blue-700',
}) {
  const initial = fullName?.trim().charAt(0) || email?.trim().charAt(0) || 'U'

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ${className}`}
    >
      {initial.toLocaleUpperCase()}
    </span>
  )
}

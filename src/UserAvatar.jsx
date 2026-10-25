export default function UserAvatar({
  fullName,
  email,
  imageSrc,
  className = 'h-9 w-9 bg-blue-50 text-[11px] text-blue-700',
}) {
  const initial = fullName?.trim().charAt(0) || email?.trim().charAt(0) || 'U'

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ${className}`}
    >
      {imageSrc
        ? <img alt="" src={imageSrc} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
        : initial.toLocaleUpperCase()}
    </span>
  )
}

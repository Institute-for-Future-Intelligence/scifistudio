interface LogoProps {
  size?: number
}

function Logo({ size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring - planet orbit */}
      <ellipse
        cx="32"
        cy="32"
        rx="28"
        ry="10"
        stroke="url(#gradient1)"
        strokeWidth="2"
        transform="rotate(-20 32 32)"
      />

      {/* Planet/Star core */}
      <circle
        cx="32"
        cy="32"
        r="16"
        fill="url(#gradient2)"
      />

      {/* Inner glow */}
      <circle
        cx="32"
        cy="32"
        r="10"
        fill="url(#gradient3)"
      />

      {/* Sparkle/star points */}
      <path
        d="M32 8L34 18L32 16L30 18L32 8Z"
        fill="#fff"
        opacity="0.8"
      />
      <path
        d="M32 56L34 46L32 48L30 46L32 56Z"
        fill="#fff"
        opacity="0.8"
      />
      <path
        d="M8 32L18 34L16 32L18 30L8 32Z"
        fill="#fff"
        opacity="0.8"
      />
      <path
        d="M56 32L46 34L48 32L46 30L56 32Z"
        fill="#fff"
        opacity="0.8"
      />

      {/* Center highlight */}
      <circle
        cx="28"
        cy="28"
        r="4"
        fill="#fff"
        opacity="0.6"
      />

      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <radialGradient id="gradient3" cx="40%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
      </defs>
    </svg>
  )
}

export default Logo

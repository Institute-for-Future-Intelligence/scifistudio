/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
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
      <g transform="rotate(-45 32 32)">
        {/* Starship body — tall, cylindrical with rounded nose */}
        <path
          d="M24 14 C24 8 28 2 32 2 C36 2 40 8 40 14 L40 46 L24 46 Z"
          fill="#d1d5db"
        />

        {/* Lighter panel — left half highlight */}
        <path
          d="M24 14 C24 8 28 2 32 2 L32 46 L24 46 Z"
          fill="#e5e7eb"
        />

        {/* Nose tip accent */}
        <path
          d="M28 8 C28 5 30 2 32 2 C34 2 36 5 36 8 Z"
          fill="#9ca3af"
        />

        {/* Heat shield band */}
        <rect x="24" y="38" width="16" height="4" fill="#374151" />

        {/* Window row */}
        <circle cx="32" cy="18" r="2.5" fill="#6d28d9" />
        <circle cx="32" cy="18" r="1.5" fill="#a5b4fc" />

        {/* Body seam lines */}
        <line x1="32" y1="10" x2="32" y2="38" stroke="#9ca3af" strokeWidth="0.5" />

        {/* Forward flap — left */}
        <path d="M24 16 L18 22 L18 30 L24 28 Z" fill="#9ca3af" />

        {/* Forward flap — right */}
        <path d="M40 16 L46 22 L46 30 L40 28 Z" fill="#6b7280" />

        {/* Aft flap — left */}
        <path d="M24 38 L16 46 L16 52 L24 48 Z" fill="#9ca3af" />

        {/* Aft flap — right */}
        <path d="M40 38 L48 46 L48 52 L40 48 Z" fill="#6b7280" />

        {/* Engine section */}
        <rect x="24" y="46" width="16" height="4" rx="1" fill="#4b5563" />

        {/* Raptor flames */}
        <path d="M26 50 L24 60 L28 56 L32 62 L36 56 L40 60 L38 50 Z" fill="#60a5fa" />
        <path d="M28 50 L27 57 L30 54 L32 58 L34 54 L37 57 L36 50 Z" fill="#93c5fd" />
      </g>
    </svg>
  )
}

export default Logo

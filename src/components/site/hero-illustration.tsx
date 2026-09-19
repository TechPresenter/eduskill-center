/**
 * Original flat illustration for the homepage hero: a young Indian student with a laptop,
 * a certificate and graduation motifs in the brand palette. Pure SVG – no external assets.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 560" role="img" aria-label="Illustration of a young student learning on a laptop, with a certificate and graduation cap" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hi-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8EAF6" />
          <stop offset="1" stopColor="#DBE3F5" />
        </linearGradient>
        <linearGradient id="hi-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1D4AA3" />
          <stop offset="1" stopColor="#12357A" />
        </linearGradient>
        <clipPath id="hi-circle">
          <circle cx="280" cy="290" r="230" />
        </clipPath>
      </defs>

      {/* Background circle and accents */}
      <circle cx="280" cy="290" r="230" fill="url(#hi-bg)" />
      <circle cx="470" cy="110" r="46" fill="none" stroke="#E8520A" strokeWidth="10" opacity="0.9" />
      <circle cx="64" cy="420" r="12" fill="#E8520A" />
      <circle cx="510" cy="330" r="8" fill="#12357A" opacity="0.6" />
      <g fill="#12357A" opacity="0.25">
        {Array.from({ length: 5 }).map((_, r) =>
          Array.from({ length: 5 }).map((_, c) => <circle key={`${r}-${c}`} cx={40 + c * 16} cy={70 + r * 16} r="2.5" />)
        )}
      </g>

      {/* Desk */}
      <g clipPath="url(#hi-circle)">
        <rect x="50" y="430" width="460" height="120" rx="8" fill="#12357A" />
        <rect x="50" y="424" width="460" height="14" rx="7" fill="#102F70" />
      </g>

      {/* Student body */}
      <g>
        {/* neck */}
        <rect x="262" y="228" width="36" height="34" rx="12" fill="#C98A5B" />
        {/* kurta / top */}
        <path d="M190 440 C186 340 210 292 262 268 L280 292 L298 268 C350 292 374 340 370 440 Z" fill="#E8520A" />
        <path d="M262 268 L280 320 L298 268 L280 292 Z" fill="#FDECE3" opacity="0.9" />
        {/* dupatta */}
        <path d="M204 300 C240 340 232 400 216 440 L246 440 C258 396 262 350 244 300 Z" fill="#12357A" opacity="0.9" />
        {/* arms */}
        <path d="M196 336 C176 366 168 396 196 424 L234 412 C216 392 214 372 224 350 Z" fill="#E8520A" />
        <path d="M364 336 C384 366 392 396 364 424 L326 412 C344 392 346 372 336 350 Z" fill="#E8520A" />
        {/* hands */}
        <ellipse cx="232" cy="416" rx="18" ry="12" fill="#C98A5B" />
        <ellipse cx="328" cy="416" rx="18" ry="12" fill="#C98A5B" />
      </g>

      {/* Head */}
      <g>
        <ellipse cx="280" cy="180" rx="56" ry="62" fill="#C98A5B" />
        {/* hair */}
        <path d="M224 176 C222 120 250 100 280 100 C312 100 340 122 336 178 C330 150 316 138 300 134 C284 132 262 136 246 150 C236 158 228 168 224 176 Z" fill="#1B2440" />
        <path d="M228 200 C218 190 218 160 226 148 L224 200 Z" fill="#1B2440" />
        <path d="M332 200 C342 190 342 160 334 148 L336 200 Z" fill="#1B2440" />
        {/* braid */}
        <path d="M334 178 C352 200 352 240 344 268 C338 240 336 210 330 190 Z" fill="#1B2440" />
        {/* ears */}
        <circle cx="226" cy="186" r="8" fill="#B9784B" />
        <circle cx="334" cy="186" r="8" fill="#B9784B" />
        {/* eyes */}
        <circle cx="262" cy="184" r="4.5" fill="#1B2440" />
        <circle cx="298" cy="184" r="4.5" fill="#1B2440" />
        <path d="M254 172 C258 168 266 168 270 172" stroke="#1B2440" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M290 172 C294 168 302 168 306 172" stroke="#1B2440" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* smile */}
        <path d="M266 206 C274 214 286 214 294 206" stroke="#1B2440" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* bindi */}
        <circle cx="280" cy="160" r="3.5" fill="#E8520A" />
      </g>

      {/* Laptop */}
      <g>
        <rect x="200" y="330" width="160" height="104" rx="10" fill="#12357A" />
        <rect x="210" y="340" width="140" height="84" rx="6" fill="url(#hi-screen)" />
        <rect x="222" y="352" width="60" height="8" rx="4" fill="#ffffff" opacity="0.85" />
        <rect x="222" y="368" width="96" height="6" rx="3" fill="#ffffff" opacity="0.45" />
        <rect x="222" y="380" width="80" height="6" rx="3" fill="#ffffff" opacity="0.45" />
        <rect x="222" y="396" width="44" height="14" rx="7" fill="#E8520A" />
        <path d="M290 392 L302 404 L322 384" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="184" y="430" width="192" height="12" rx="6" fill="#102F70" />
      </g>

      {/* Floating certificate */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -6; 0 0" dur="5s" repeatCount="indefinite" />
        <rect x="392" y="196" width="118" height="86" rx="12" fill="#ffffff" stroke="#E4E7EC" />
        <rect x="406" y="212" width="52" height="7" rx="3.5" fill="#12357A" />
        <rect x="406" y="226" width="90" height="5" rx="2.5" fill="#CBD2E0" />
        <rect x="406" y="238" width="78" height="5" rx="2.5" fill="#CBD2E0" />
        <rect x="406" y="250" width="60" height="5" rx="2.5" fill="#CBD2E0" />
        <circle cx="486" cy="258" r="12" fill="#E8520A" />
        <path d="M480 258 L485 263 L493 253" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M480 268 L482 282 L486 276 L490 282 L492 268 Z" fill="#E8520A" opacity="0.8" />
      </g>

      {/* Floating graduation cap */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="6s" repeatCount="indefinite" />
        <path d="M70 226 L138 198 L206 226 L138 254 Z" fill="#12357A" />
        <path d="M104 240 L104 268 C104 282 172 282 172 268 L172 240 L138 254 Z" fill="#1D4AA3" />
        <path d="M206 226 L206 258" stroke="#E8520A" strokeWidth="4" strokeLinecap="round" />
        <circle cx="206" cy="262" r="5" fill="#E8520A" />
      </g>

      {/* Book */}
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -4; 0 0" dur="4.5s" repeatCount="indefinite" />
        <rect x="82" y="318" width="74" height="54" rx="8" fill="#ffffff" stroke="#E4E7EC" />
        <rect x="94" y="330" width="28" height="6" rx="3" fill="#E8520A" />
        <rect x="94" y="342" width="50" height="4" rx="2" fill="#CBD2E0" />
        <rect x="94" y="352" width="42" height="4" rx="2" fill="#CBD2E0" />
      </g>

      {/* Sparkles */}
      <g fill="#E8520A">
        <path d="M430 96 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
        <path d="M116 138 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" opacity="0.8" />
        <path d="M478 400 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" opacity="0.7" />
      </g>
    </svg>
  );
}

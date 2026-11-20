import React from 'react';

interface BrandLogoProps {
  variant?: 'dark' | 'light';
  compact?: boolean;
  showSubtext?: boolean;
  storeName?: string;
  subtext?: string;
  logoUrl?: string;
  className?: string;
}

export function BrandLogo({
  variant = 'dark',
  compact = false,
  showSubtext = true,
  storeName = 'DIAMOND MARKET',
  subtext = 'SHOES & WEARS',
  logoUrl = '',
  className = '',
}: BrandLogoProps) {
  const isDark = variant === 'dark';
  const wordmarkColor = isDark ? 'text-white' : 'text-[var(--dm-black,#111111)]';
  const subColor = isDark ? 'text-[var(--dm-gold,#C6A15B)]' : 'text-[#8C6D34]';
  const ringBorder = isDark
    ? 'border-[var(--dm-gold,#C6A15B)]/60 bg-[#181818]'
    : 'border-[var(--dm-black,#111111)]/15 bg-[var(--dm-black,#111111)]';

  return (
    <span className={`inline-flex items-center gap-3 select-none ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={storeName}
          className={`shrink-0 object-contain rounded-lg ${compact ? 'h-8 max-w-[110px]' : 'h-10 max-w-[140px]'}`}
        />
      ) : (
        <span
          className={`relative flex items-center justify-center shrink-0 rounded-full border transition-colors ${
            compact ? 'w-8 h-8' : 'w-10 h-10'
          } ${ringBorder}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={compact ? 'w-4 h-4' : 'w-5 h-5'}
          >
            <path
              d="M16 3L28 13.5L16 29L4 13.5L16 3Z"
              stroke="var(--dm-gold, #C6A15B)"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 13.5H27.5"
              stroke="var(--dm-gold, #C6A15B)"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            <path
              d="M16 3L11.5 13.5L16 29L20.5 13.5L16 3Z"
              stroke="var(--dm-gold, #C6A15B)"
              strokeWidth="1.15"
              strokeLinejoin="round"
              opacity="0.8"
            />
          </svg>
        </span>
      )}

      <span className="flex flex-col leading-none text-left">
        <span
          className={`font-display font-semibold tracking-[0.12em] uppercase ${
            compact ? 'text-sm' : 'text-base sm:text-lg'
          } ${wordmarkColor}`}
        >
          {storeName}
        </span>
        {showSubtext && subtext && (
          <span
            className={`text-[9px] font-semibold tracking-[0.26em] uppercase mt-1 ${subColor}`}
          >
            {subtext}
          </span>
        )}
      </span>
    </span>
  );
}

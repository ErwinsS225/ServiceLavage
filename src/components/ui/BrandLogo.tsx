import { Car } from 'lucide-react';
import { theme } from '../../styles/theme';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function BrandLogo({ size = 'md', showTagline = false, className = '' }: BrandLogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
  };
  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-950/40 border border-indigo-400/30 flex-shrink-0`}
        aria-hidden="true"
      >
        <Car className="w-4 h-4 stroke-[2.2]" />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className={`${titleSizes[size]} tracking-tight text-white font-sans whitespace-nowrap`}>
            Service<span className="text-sky-400">Lavage</span>
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
            {theme.brand.countryCode}
          </span>
        </div>
        {showTagline && (
          <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
            {theme.brand.tagline}
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { AUTH_COPY, type AuthScreen } from './authCopy';

/**
 * One pair of photographs per screen. Each pair is shown alternately, so the
 * panel feels alive without loading four images at once.
 */
const SCENES = {
  signin: ['/assets/auth-signin-1.jpg', '/assets/auth-signin-2.jpg'],
  signup: ['/assets/auth-signup-1.jpg', '/assets/auth-signup-2.jpg'],
  forgot: ['/assets/auth-forgot-1.jpg', '/assets/auth-forgot-2.jpg'],
  reset: ['/assets/auth-reset-1.jpg', '/assets/auth-reset-2.jpg'],
} as const;

export type AuthScene = keyof typeof SCENES;

/**
 * Split-screen shell shared by sign-up, sign-in, password recovery and
 * password reset, so all four states have the same frame and only the form
 * changes. The visual panel is decorative and hidden below `lg`, where it
 * would eat the vertical space the form needs on a phone.
 */
export function AuthLayout({ title, screen, scene = 'signin', children, footer }: {
  title: string;
  screen: AuthScreen;
  scene?: AuthScene;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const copy = AUTH_COPY[screen];
  // Alternate the two photographs of the scene. Paused for users who ask for
  // reduced motion, who keep the first image.
  const images = SCENES[scene];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setFrame(value => (value + 1) % images.length), 9000);
    return () => window.clearInterval(timer);
  }, [images]);
  return <main className="min-h-screen bg-[#111317] text-gray-100 flex items-center justify-center p-0 sm:p-6">
    <div className="auth-rim w-full max-w-5xl sm:rounded-2xl">
      <div className="auth-rim-body lg:grid lg:grid-cols-[45%_55%]">

      {/* Decorative panel: image, veil, wordmark and a short promise. */}
      <aside className="relative hidden lg:block">
        {images.map((src, index) => <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          fetchPriority={index === 0 ? 'high' : 'low'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === frame ? 'opacity-100' : 'opacity-0'}`}
        />)}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/75" />
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-900/35 to-transparent" />
        {/* Scrim below the text only: the photo is busy around the caption. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">Clean It CI</p>
            <h2 className="mt-6 text-4xl font-light leading-tight text-white">{copy.headline}</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">{copy.intro}</p>
            <ul className="mt-8 space-y-3">
              {copy.points.map(point => <li key={point} className="flex gap-2.5 text-[13px] leading-snug text-white/80">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                <span>{point}</span>
              </li>)}
            </ul>
          </div>
          <div className="space-y-4">
            <span className="inline-block border border-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
              Lavage auto
            </span>
            <p className="text-[11px] text-white/55">ERP multitenant · Côte d’Ivoire</p>
          </div>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16 lg:py-14">
        <h1 className="mb-8 hidden text-2xl font-bold lg:block">{title}</h1>
        <div className="mb-10 lg:hidden">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gray-500">Clean It CI</p>
          <h1 className="mt-2 text-2xl font-bold">{copy.headline}</h1>
          <p className="mt-1 text-sm text-gray-400">{copy.intro}</p>
        </div>
        {children}
        {footer && <div className="mt-10 border-t border-[#262b35] pt-5">{footer}</div>}
      </section>
      </div>
    </div>
  </main>;
}

/**
 * Labelled field with the error state wired to `aria-invalid` and a visible
 * message, so a failed submission is announced instead of only coloured.
 */
export function AuthField({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return <label className="block">
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</span>
    {children}
    {error
      ? <span role="alert" className="mt-1.5 block text-xs text-red-400">{error}</span>
      : hint ? <span className="mt-1.5 block text-xs text-gray-500">{hint}</span> : null}
  </label>;
}

/** Shared input styling; the violet focus ring matches the action button. */
export const authInput = 'w-full rounded-lg border border-[#343b48] bg-[#1c1f27] px-4 py-3 text-white placeholder:text-gray-600 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/25';

/** Primary action: solid violet, full width, disabled while a request is in flight. */
export const authButton = 'w-full rounded-lg bg-violet-600 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60';

/** Inline text action used for "sign in instead", "forgot password", "go back". */
export const authLink = 'text-sm text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline disabled:opacity-50';

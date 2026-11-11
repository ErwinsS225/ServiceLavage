import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './mockSupabase';

// `import.meta.env` is undefined outside Vite (the test runner imports this
// module too), so the access is guarded instead of crashing at import time.
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

/**
 * Captured synchronously, before the Supabase client consumes and clears the
 * URL hash. Used to show the "new password" form after a recovery e-mail link
 * even if the PASSWORD_RECOVERY auth event is emitted before React mounts.
 */
export const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

const forceMock =
  typeof window !== 'undefined' &&
  typeof window.localStorage !== 'undefined' &&
  window.localStorage.getItem('servicelavage:force_mock') === 'true';

export const isMockMode = forceMock || !(url && key);

export function toggleMockMode(enable?: boolean) {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  const current = window.localStorage.getItem('servicelavage:force_mock') === 'true';
  const target = enable ?? !current;
  if (target) {
    window.localStorage.setItem('servicelavage:force_mock', 'true');
  } else {
    window.localStorage.removeItem('servicelavage:force_mock');
  }
  window.location.reload();
}

export const supabase: SupabaseClient | null =
  !forceMock && url && key
    ? createClient(url, key)
    : typeof window !== 'undefined'
      ? createMockSupabaseClient()
      : null;


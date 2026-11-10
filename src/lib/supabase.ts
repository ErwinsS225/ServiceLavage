import { createClient } from '@supabase/supabase-js';

// `import.meta.env` is undefined outside Vite (the test runner imports this
// module too), so the access is guarded instead of crashing at import time.
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Captured synchronously, before the Supabase client consumes and clears the
 * URL hash. Used to show the "new password" form after a recovery e-mail link
 * even if the PASSWORD_RECOVERY auth event is emitted before React mounts.
 */
export const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

export const supabase = url && key ? createClient(url, key) : null;

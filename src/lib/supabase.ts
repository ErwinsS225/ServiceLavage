import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Captured synchronously, before the Supabase client consumes and clears the
 * URL hash. Used to show the "new password" form after a recovery e-mail link
 * even if the PASSWORD_RECOVERY auth event is emitted before React mounts.
 */
export const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery');

export const supabase = url && key ? createClient(url, key) : null;

/** Minimum password length enforced here and by the Supabase project setting. */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordValidation =
  | { ok: true }
  | { ok: false; reason: 'too_short' | 'mismatch' | 'empty' };

/**
 * Validates a new password without ever logging or returning its value.
 * Confirmation is checked locally so an obvious typo never reaches the server.
 */
export function validateNewPassword(password: string, confirmation: string): PasswordValidation {
  if (!password) return { ok: false, reason: 'empty' };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: 'too_short' };
  if (password !== confirmation) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

/**
 * Absolute URL Supabase redirects to after a recovery e-mail.
 * A valid absolute URL is required by Supabase Auth; a malformed value would
 * silently produce a dead link, so the origin is used as a safe fallback.
 */
export function recoveryRedirectUrl(origin: string): string {
  try {
    const base = new URL(origin);
    if (base.protocol !== 'https:' && base.protocol !== 'http:') throw new Error('unsupported protocol');
    return new URL('/', base).toString();
  } catch {
    return origin;
  }
}

/** Never reveals whether an address is registered: the same text is always shown. */
export const RECOVERY_SENT_MESSAGE =
  'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé. Vérifiez votre boîte de réception et vos indésirables.';

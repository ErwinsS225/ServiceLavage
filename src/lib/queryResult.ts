/**
 * One place for the two things every screen does with a Supabase result:
 * turn `{ data, error }` into a value or a throw, and turn any thrown value
 * into a French sentence the user can act on.
 *
 * Before this module each component repeated its own
 * `if (error) setError(\`… : ${error.message}\`)`, so wording and behaviour
 * drifted between screens. The wording now lives next to the call that fails
 * (in `stationApi` / `portalApi`), and components only display what they get.
 */

/** Shape of a PostgREST / RPC result, without importing the whole Supabase types. */
export interface Result<T> {
  data: T | null;
  error: { message: string } | null;
}

/**
 * Returns the payload or throws an Error carrying `message` and the server
 * detail. Callers catch: an unhandled PostgREST error used to render an empty
 * table without telling anyone the query failed.
 */
export function unwrap<T>(result: Result<T>, message: string): T {
  if (result.error) throw new Error(`${message} : ${result.error.message}`);
  if (result.data === null) throw new Error(message);
  return result.data;
}

/** Like `unwrap`, but `null` is an acceptable answer (e.g. `maybeSingle`). */
export function unwrapNullable<T>(result: Result<T>, message: string): T | null {
  if (result.error) throw new Error(`${message} : ${result.error.message}`);
  return result.data;
}

/**
 * French message for anything thrown in a screen. Network errors arrive as
 * `TypeError: Failed to fetch`, which means nothing to a station manager, so
 * they are replaced by `fallback` with a hint to check the connection.
 */
export function describeError(cause: unknown, fallback: string): string {
  if (cause instanceof Error) {
    if (/^(Failed to fetch|NetworkError|Load failed)/i.test(cause.message) || /AbortError/.test(cause.name)) {
      return `${fallback} Vérifiez votre connexion.`;
    }
    return cause.message;
  }
  return fallback;
}

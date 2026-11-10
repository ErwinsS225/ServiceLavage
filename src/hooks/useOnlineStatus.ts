import { useEffect, useState } from 'react';

/**
 * `navigator.onLine` as React state, updated by the `online` / `offline`
 * events. Three screens used to subscribe separately (portal, inventory,
 * orders); one hook keeps the behaviour identical everywhere.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToastActions } from './context/ToastContext';
import { createQueryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

/**
 * Le cache est créé à l'intérieur d'un composant pour pouvoir signaler ses
 * échecs via les toasts. `useState` garantit qu'il n'est construit qu'une fois,
 * même en StrictMode (un cache recréé à chaque rendu perdrait toutes les
 * données chargées).
 */
function Application() {
  const toast = useToastActions();
  // `useToastActions` renvoie une référence stable : le cache n'est donc créé
  // qu'une fois, et son gestionnaire d'erreur reste valide.
  const queryClient = useMemo(
    () => createQueryClient({ onQueryError: (message, detail) => toast.error(message, detail) }),
    [toast],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <Application />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Cache the application shell only in production and on secure origins.
// API and authentication responses are never cached by this service worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.error('Enregistrement du service worker impossible :', error);
    });
  });
}

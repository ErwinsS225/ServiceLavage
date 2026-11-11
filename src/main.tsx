import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToastActions } from './context/ToastContext';
import { createQueryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installGlobalErrorHandlers } from './lib/globalErrors';
import { observePageLoad } from './lib/performance';
import { track } from './lib/telemetry';
import './index.css';

// Branché avant le premier rendu : une erreur survenue pendant le montage doit
// déjà être capturée. React ne démarre qu'ensuite.
installGlobalErrorHandlers();

// Mesure de l'affichage initial. Aucun effet sur le rendu : si le navigateur ne
// fournit pas la métrique, rien n'est inventé.
observePageLoad();

track.info('app.demarrage', { version: import.meta.env.VITE_APP_VERSION ?? 'dev' });

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
    () =>
      createQueryClient({
        onQueryError: (message, detail) => {
          toast.error(message, detail);
          // Le toast previent l'utilisateur ; l'evenement garde la trace. Le
          // diagnostic peut ainsi dire « 3 lectures echouees sur l'ecran
          // Prestations » sans que personne n'ait ouvert la console.
          track.warn('data.lecture_signalee', { ecran: 'cache-global' });
        },
      }),
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

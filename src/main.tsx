import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { createQueryClient } from './lib/queryClient';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// One cache for the whole application, created once. Server data lives here;
// screen state (forms, open modals, selected tab) stays in the components.
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
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

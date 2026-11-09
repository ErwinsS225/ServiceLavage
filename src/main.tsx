import {createRoot} from 'react-dom/client';
import { OwnerPortal } from './components/OwnerPortal';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <OwnerPortal />
  </ErrorBoundary>,
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

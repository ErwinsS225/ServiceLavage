import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches rendering errors from the whole active portal so a single failure
 * shows a recoverable screen instead of a blank page.
 *
 * The technical detail is only logged to the console; the user sees a neutral
 * message with no stack trace, no SQL and no identifier.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erreur non gérée dans le portail :', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="min-h-screen bg-[#111317] text-gray-100 flex items-center justify-center p-6">
      <section role="alert" className="w-full max-w-lg rounded-2xl border border-[#303640] bg-[#16181d] p-8 space-y-4">
        <h1 className="text-xl font-bold">Une erreur inattendue s’est produite</h1>
        <p className="text-sm text-gray-400">
          L’application n’a pas pu afficher cette page. Aucune donnée n’a été perdue :
          les opérations en attente sur cet appareil sont conservées.
        </p>
        <p className="text-xs text-gray-500">
          Si le problème persiste, notez l’heure de l’incident et contactez le support.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-gray-950"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-[#343b48] px-4 py-2 font-semibold text-gray-200"
          >
            Recharger la page
          </button>
        </div>
      </section>
    </main>;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { track } from '../lib/telemetry';
import { copyDiagnostics } from '../lib/diagnosticsExport';

/**
 * Capture les erreurs de rendu de tout le portail : une seule défaillance
 * affiche un écran récupérable au lieu d'une page blanche.
 *
 * Ce qui a changé avec l'observabilité : l'incident n'est plus perdu. Il était
 * écrit en `console.error` — donc visible seulement si quelqu'un ouvrait la
 * console au bon moment, sur l'appareil du caissier. Il est maintenant
 * journalisé comme un **événement nommé**, avec une empreinte qui permet de
 * compter les occurrences, et il alimente l'export de diagnostic que le
 * technicien peut récupérer sans accès à la console.
 *
 * L'utilisateur, lui, ne voit toujours ni trace ni identifiant : seulement un
 * message neutre et deux actions.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; copyState: string }
> {
  state = { failed: false, copyState: '' };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    track.error(
      'ui.erreur_rendu',
      error,
      {
        // Le premier composant de la pile suffit à situer l'écran concerné ;
        // la pile complète contient des chemins de build, sans intérêt ici.
        composant: info.componentStack?.split('\n')[1]?.trim().slice(0, 120) ?? 'inconnu',
      },
      { message: 'Erreur non gérée pendant le rendu' },
    );
  }

  /**
   * Copie et rend compte du résultat.
   *
   * Avant, le bouton appelait `copyDiagnostics()` sans lire son retour : sur une
   * page servie en http (le cas d'un poste fixe sur le réseau local d'une
   * station), le presse-papiers n'existe pas, l'appel échouait en silence et
   * l'utilisateur croyait avoir copié quelque chose.
   */
  private handleCopy = async () => {
    const outcome = await copyDiagnostics();
    this.setState({ copyState: outcome.ok ? 'ok' : outcome.reason });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)] flex items-center justify-center p-6">
        <section
          role="alert"
          className="w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-card)] p-8 space-y-4"
        >
          <h1 className="text-xl font-bold">Une erreur inattendue s’est produite</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            L’application n’a pas pu afficher cette page. Aucune donnée n’a été perdue : les opérations en
            attente sur cet appareil sont conservées.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            L’incident a été enregistré sur cet appareil. Si le problème persiste, transmettez le diagnostic
            au support : il contient l’heure et l’écran concerné, mais aucune donnée personnelle.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => this.setState({ failed: false })}
              className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              Recharger la page
            </button>
            <button
              type="button"
              onClick={this.handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] px-4 py-2 font-semibold text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copier le diagnostic
            </button>
          </div>
          {/* `role="status"` : le retour de copie est annoncé sans interrompre,
              comme une confirmation, pas comme une alerte. */}
          <p role="status" className="text-xs text-[var(--text-secondary)]">
            {this.state.copyState === 'ok' ? (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Diagnostic copié. Collez-le dans le message au support.
              </span>
            ) : (
              this.state.copyState
            )}
          </p>
        </section>
      </main>
    );
  }
}

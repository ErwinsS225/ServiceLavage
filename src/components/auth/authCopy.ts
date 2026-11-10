/**
 * Sales copy for the authentication screens.
 *
 * Every claim here maps to something that actually works today; the point of
 * the panel is to state the value of the product, not to promise a roadmap.
 * Anything still marked `planned` in src/data/planFeatures.ts is deliberately
 * absent from this file.
 *
 * Kept in one place so the four screens cannot drift apart: a promise made on
 * the sign-up page must not contradict the panel shown at sign-in.
 */
export type AuthCopy = {
  /** Big line on the visual panel. */
  headline: string;
  /** One sentence under the headline. */
  intro: string;
  /** Three concrete benefits, shown as a short list. */
  points: readonly string[];
};

export type AuthScreen = 'signin' | 'signup' | 'forgot' | 'reset';

export const AUTH_COPY: Record<AuthScreen, AuthCopy> = {
  signin: {
    headline: 'Votre station, sous contrôle',
    intro:
      'Toutes vos prestations, votre équipe et votre stock au même endroit — même quand le réseau tombe.',
    points: [
      'Chaque prestation envoyée une seule fois, jamais facturée deux fois',
      'Prestations enregistrées hors ligne, envoyées au retour du réseau',
      'Chacun voit ce qui le concerne : gérant, vendeur, laveur',
    ],
  },
  signup: {
    headline: 'Ouvrez votre station en dix minutes',
    intro:
      'Pas d’installation, pas de registre papier : créez votre compte, nommez votre station, invitez votre équipe.',
    points: [
      'Votre catalogue, vos prix, vos clients — prêts dès la première prestation',
      'Vos employés se connectent avec leurs propres accès',
      'Un essai sans engagement, aucune carte bancaire demandée',
    ],
  },
  forgot: {
    headline: 'Un mot de passe s’oublie, pas vos données',
    intro:
      'Rien n’est perdu : vos prestations, votre stock et votre historique restent en place pendant que vous récupérez l’accès.',
    points: [
      'Station et données inchangées pendant la récupération',
      'Aucune adresse révélée : le message est identique qu’un compte existe ou non',
    ],
  },
  reset: {
    headline: 'Nouveau mot de passe, même station',
    intro:
      'Choisissez un mot de passe solide : tout le reste — équipe, catalogue, prestations — vous attend intact.',
    points: [
      'Vérifié avant l’envoi : aucune faute de frappe ne passe',
      'Confirmation demandée : vous ne pouvez pas vous tromper',
    ],
  },
};

/** Empty state shown instead of the station list for an account that owns none. */
export const NO_STATION_COPY = {
  title: 'Votre station commence ici',
  body: 'Créez-la en quelques secondes, ou rejoignez celle de votre employeur avec la référence reçue.',
};

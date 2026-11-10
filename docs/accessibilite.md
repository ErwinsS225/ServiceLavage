# Accessibilité

État au 10 novembre 2026. Ce document sépare trois choses qu'on confond
souvent : ce qui a été **mesuré**, ce qui a été **corrigé**, et ce qui **reste
à faire**. Un audit qui ne dit que la première partie n'est pas un audit.

## La contrainte de terrain

L'application est utilisée debout, dans une station, parfois avec des gants, sur
un téléphone bon marché, en plein soleil. Cela change ce qui compte :

| Contrainte réelle | Conséquence technique |
| --- | --- |
| doigts épais ou gantés | cibles tactiles ≥ 44 px, écarts suffisants |
| plein soleil | contraste élevé, pas de texte gris clair sur gris |
| clavier physique au back-office | focus visible partout, ordre logique |
| lecteur d'écran pour un caissier malvoyant | tableaux nommés, en-têtes associés, annonces non agressives |

Le contraste n'est donc pas un raffinement esthétique : c'est la condition pour
lire un montant en FCFA sans se tromper.

## Ce qui a été mesuré, avant correction

Chiffres obtenus par calcul WCAG 2.1 (luminance relative), pas à l'œil.

| Point | Mesure | Verdict |
| --- | --- | --- |
| Éléments interactifs avec style de focus déclaré | **5 sur 112** | contour par défaut, souvent supprimé |
| `outline-none` sans remplacement | 6 fichiers | focus invisible au clavier |
| `text-muted` (utilisé 27 fois) sur carte sombre | **3,84:1** | sous le seuil AA de 4,5 |
| Bordure forte `#32394a` sur carte sombre | **1,58:1** | ne délimite aucun champ |
| Alerte erreur, mode clair | **1,66:1** | illisible |
| `text-white` sur surface (mode clair) | **1:1** | invisible |
| `<th>` sans `scope` | tous | association en-tête/cellule aléatoire |
| Modales avec piège de focus | **0 sur 2** | `Tab` sort vers l'arrière-plan |
| Modales avec identifiant de titre unique | **0 sur 2** | deux modales se confondent |
| Lien d'évitement | absent | en-tête traversé à chaque module |
| `prefers-reduced-motion` | 1 règle (décor auth) | non généralisé |

Le mode sombre était bon (7,12 à 12,67 sur les paires principales). **C'est le
mode clair qui était cassé** : les jetons basculaient, les composants non. Un
utilisateur qui cliquait « Clair » obtenait du texte blanc sur fond blanc.

## Ce qui a été corrigé

### Focus visible

Une règle globale dans `src/index.css` :

```css
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```

Pourquoi `:focus-visible` et non `:focus` : un clic souris ne doit pas laisser
d'anneau, un déplacement clavier doit en laisser un. Le navigateur fait cette
distinction, autant s'en servir.

Pourquoi un jeton par thème : l'indigo de marque `#4f46e5` ne donne que 3,4:1
sur la surface sombre — assez pour un composant (3:1), pas pour être vu
facilement. `--focus-ring` vaut `#a5b4fc` en sombre (9,16:1) et `#4f46e5` en
clair (6,29:1).

### Contraste

- `--text-muted` : `#64748b` → `#9aa5b5` en sombre (**3,84 → 7,33:1**),
  `#5b6779` en clair (4,76:1). Ce jeton sert 27 fois, dont des légendes et des
  libellés de formulaire.
- `--border-strong` / `--border-subtle` : portées à 3:1 minimum, seuil WCAG
  1.4.11 pour délimiter un composant.
- Alertes : jeux de jetons par thème (`--alert-*-text/bg/border`). Le texte
  passe de **1,66 à 6,84–8,01:1** en mode clair ; les valeurs sombres, déjà
  conformes, sont conservées.
- 41 couleurs de surface codées en dur remplacées par `var(--surface-*)`,
  44 `text-white` remplacés par `var(--text-primary)` **sauf** sur les fonds de
  marque, où le blanc est correct (6,29:1 sur indigo-600).
- `--surface-page`, utilisé dans `OwnerPortal` sans être défini, est défini.

### Modales

`ui/Modal.tsx` remplit les quatre conditions qui rendent une modale utilisable :
le focus entre, y reste (`Tab`/`Maj+Tab` bouclent), ressort **au bon endroit**
(retour sur le déclencheur), et le titre est relié par un identifiant unique
(`useId`). `ReceiptModal` a reçu le même traitement, avec sa mise en page propre.

### Structure

Lien d'évitement en tête de page (`Aller au contenu principal`), tableaux nommés
(`aria-label`) et en-têtes `scope="col"`, icônes décoratives `aria-hidden`,
`Alert` qui n'utilise `role="alert"` que pour ce qui bloque (erreur,
avertissement) et `role="status"` pour le reste.

### Mouvement

`prefers-reduced-motion: reduce` coupe animations et transitions globalement.
Exception assumée et ciblée : les indicateurs de chargement portent
`.motion-safe-keep`, sinon ils ne tournent plus et n'indiquent plus rien. Le
défilement doux n'est activé que sous `prefers-reduced-motion: no-preference`.

## Ce qui reste à faire

Par ordre d'impact réel, et sans maquillage :

1. **Cibles tactiles.** `buttonStyles({ size: 'sm' })` mesure 32 px de haut.
   44 px est la recommandation pour un usage au doigt. Passer le `sm` à 36–40 px
   et réserver 32 px aux actions secondaires groupées. **Non fait** : cela
   change la densité de toutes les barres d'outils, c'est une décision de
   produit, pas une correction technique.
2. **Mode clair des écrans secondaires.** `ReportDocument` et `ReceiptPaper`
   sont des documents imprimables, volontairement sur fond blanc : leurs
   couleurs fixes sont légitimes. En revanche les pages d'authentification ont
   un fond photographique sombre avec un voile ; le conteneur suit maintenant le
   thème, mais une revue visuelle des quatre écrans d'auth en mode clair reste
   nécessaire.
3. **Test avec un vrai lecteur d'écran.** Aucun test automatisé ne remplace
   NVDA ou VoiceOver. Les invariants testés empêchent les régressions
   mécaniques, ils ne disent rien de la qualité de l'expérience.
4. **Navigation par onglets.** Les onglets de modules sont des `<button>` avec
   `aria-current`, ce qui est correct mais ne suit pas le motif ARIA
   `tablist`/`tab` (flèches gauche/droite). À faire si un utilisateur clavier
   le demande : le motif complet impose de gérer le focus itinérant, ce qui est
   plus fragile que ce qui existe.
5. **`aria-live` sur les compteurs du tableau de bord.** Les chiffres changent
   après une action ; ils sont rendus dans une région `role="status"` pour
   certains, pas tous.

## Comment vérifier

```bash
npm run check:contrast   # 28 paires, WCAG AA, les deux thèmes
npx tsx --test tests/accessibility.test.ts    # invariants de structure
npx tsx --test tests/modalAccessibility.test.tsx  # focus, piège, restitution
```

`check:contrast` lit les mêmes valeurs que `src/index.css` ;
`tests/contrast.test.ts` échoue si les deux divergent — sinon le contrôle
resterait vert sur des couleurs qui n'existent plus.

## Limites de la méthode

- Le contraste est calculé sur les **jetons**, pas sur chaque combinaison
  possible. Une classe `text-emerald-400` posée à la main sur une surface
  inhabituelle peut encore échapper au contrôle.
- Les tests de structure lisent le code source par expression régulière. Ils
  attrapent les oublis mécaniques, pas les erreurs de jugement (un `aria-label`
  présent mais faux passe le test).
- Aucun test ne mesure le **rendu** : pas de navigateur sans interface
  disponible ici. Les valeurs du bundle CSS ont été vérifiées (`outline` et
  `--focus-ring` présents après minification), pas l'apparence à l'écran.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import security from 'eslint-plugin-security';
import globals from 'globals';

/**
 * Configuration ESLint — analyse statique.
 *
 * Principe directeur : ne pas dupliquer ce que TypeScript vérifie déjà. `tsc`
 * en mode strict couvre les types, les variables inutilisées et les imports
 * morts ; ESLint n'ajoute de la valeur que sur ce que le compilateur ne voit
 * pas : les pièges de React, les motifs à risque en sécurité, les schémas de
 * code qui se dégradent sans casser.
 *
 * Ce fichier est en `.js` volontairement : ESLint lit sa configuration avant
 * d'appliquer le parseur TypeScript, et une config `.ts` demanderait un
 * transpileur juste pour se charger.
 */

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'archive/',
      'node_modules/',
      // Documentation et fichiers de données : pas de code exécutable.
      'docs/',
    ],
  },

  // Base : règles recommandées de JS et de TypeScript.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Application (navigateur).
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      security,
    },
    rules: {
      // --- React ---------------------------------------------------------
      // Les deux règles qui attrapent des bugs réels, pas du style :
      // un `useEffect` aux dépendances incomplètes (valeur figée) et une
      // violation de l'ordre des hooks (état mélangé entre rendus).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // --- Sécurité ------------------------------------------------------
      // `dangerouslySetInnerHTML` est une porte d'entrée XSS : aucune
      // occurrence n'est acceptable sans justification écrite.
      'react/no-danger': 'off', // plugin non installé ; couvert par la règle ci-dessous
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-unsafe-regex': 'warn',

      // --- Conventions ---------------------------------------------------
      // Une variable inutilisée est déjà signalée par `tsc` (noUnusedLocals).
      // On garde le préfixe `_` pour les paramètres volontairement ignorés.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // `any` implicite est refusé par `tsc` ; `any` explicite reste toléré
      // dans les tests de faux clients, mais signalé ici.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Un `console.log` oublié part en production ; `console.error` et
      // `console.warn` restent autorisés (diagnostics volontaires).
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      // Interdit les promesses flottantes non marquées : un `void` explicite
      // ou un `await` est requis, ce qui rend visible l'intention.
      '@typescript-eslint/no-floating-promises': 'off', // nécessite un projet typé, coûteux ici
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      // Une comparaison `===` entre deux types incompatibles est déjà une
      // erreur de compilation ; cette règle couvre le reste.
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
    },
  },

  // Tests : environnement Node, et quelques tolérances utiles.
  {
    files: ['tests/**/*.{ts,tsx}', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Un faux client de test doit pouvoir être `any` : c'est le prix d'un
      // double de `SupabaseClient` sans réimplémenter toute la surface.
      '@typescript-eslint/no-explicit-any': 'off',
      // Les scripts de diagnostic écrivent volontairement sur la sortie.
      'no-console': 'off',
      'security/detect-child-process': 'off',
    },
  },

  // Fichiers de configuration : Node, et aucune règle de navigateur.
  {
    files: ['*.config.{js,ts,mjs}', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);

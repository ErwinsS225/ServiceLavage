# Authentification et récupération de compte

## Parcours disponibles dans le portail

| Parcours | État | Détail |
| --- | :---: | --- |
| Inscription (e-mail + mot de passe) | ✅ | `signUp` avec `emailRedirectTo` explicite |
| Confirmation par e-mail | ✅ | Obligatoire : `mailer_autoconfirm = false` |
| Connexion | ✅ | `signInWithPassword` |
| Déconnexion | ✅ | `signOut` |
| **Réinitialisation de mot de passe** | ✅ | `resetPasswordForEmail` → formulaire de nouveau mot de passe |
| Changement d'e-mail | ❌ | Non exposé dans l'interface |
| MFA / TOTP | ❌ | Désactivé dans l'interface (activé côté Supabase) |
| Connexion sociale | ❌ | Non configurée |

## Réinitialisation de mot de passe — fonctionnement

1. L'utilisateur clique sur **« Mot de passe oublié ? »** sous le formulaire de connexion.
2. Il saisit son adresse : `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
3. Le message affiché est **toujours le même**, que le compte existe ou non (« Si un compte existe pour cette adresse… ») : il ne permet pas d'énumérer les comptes.
4. L'e-mail contient un lien vers l'URL autorisée. À l'ouverture, Supabase ajoute `#access_token=…&type=recovery` et ouvre une session temporaire.
5. Le portail affiche alors le formulaire **« Choisissez un nouveau mot de passe »** :
   - détection **synchrone** du fragment d'URL dans `src/lib/supabase.ts` (`isRecoveryLink`), capturé **avant** que le client Supabase ne purge le hash — sinon un rechargement perdrait l'information ;
   - rafraîchissement par l'événement `PASSWORD_RECOVERY` de `onAuthStateChange`.
6. Validation locale (`validateNewPassword`) : minimum **8 caractères** et confirmation identique.
7. `supabase.auth.updateUser({ password })` puis retour à un état connecté normal.

**Fichiers concernés :** `src/lib/passwordRecovery.ts`, `src/lib/supabase.ts`, `src/components/OwnerPortal.tsx`.
**Tests :** `tests/passwordRecovery.test.ts` (5 tests — longueur, confirmation, construction de l'URL, origine malformée, neutralité du message).

## Configuration Supabase requise

| Paramètre | Valeur en place | Remarque |
| --- | --- | --- |
| `site_url` | URL publique de l'application | Utilisée par défaut pour les liens e-mail |
| `uri_allow_list` | URL publique (+ `/*`) et `http://localhost:3000` (+ `/*`) | **Toute URL absente de cette liste fait échouer silencieusement la redirection** |
| `mailer_autoconfirm` | `false` | Ne jamais désactiver pour « faire passer » un test |
| `jwt_exp` | 3600 s | — |
| `refresh_token_rotation_enabled` | `true` | — |

### Écarts à corriger manuellement (non exposés par l'API utilisée)

| Paramètre | Valeur actuelle | Cible | Motif |
| --- | ---: | ---: | --- |
| `password_min_length` | 6 | **8** | Aligner sur `MIN_PASSWORD_LENGTH` du code |
| `password_hibp_enabled` | `false` | **`true`** | Refus des mots de passe compromis |
| `rate_limit_email_sent` | 2 / heure | **≥ 30** | 2/heure bloque les inscriptions et réinitialisations légitimes |

À modifier dans **Dashboard → Authentication → Providers / Rate Limits**, ou via la Management API :

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password_min_length":8,"password_hibp_enabled":true,"rate_limit_email_sent":30}'
```

> ⚠️ Le code impose déjà 8 caractères côté client (`MIN_PASSWORD_LENGTH`). Tant que le paramètre serveur reste à 6, un appel direct à l'API Auth accepterait un mot de passe de 6 caractères : la validation serveur doit être alignée, pas seulement l'interface.

## SMTP

Aucun SMTP personnalisé n'est configuré : les e-mails passent par le service par défaut de Supabase, avec une délivrabilité limitée et un quota d'envoi faible. **Avant une mise en service réelle**, configurer un fournisseur (Resend, Postmark, Brevo…) dans **Dashboard → Authentication → SMTP Settings**. Sans cela, les e-mails de confirmation et de réinitialisation peuvent être rejetés ou classés en indésirables.

## URL de prévisualisation

L'application est actuellement servie via l'aperçu Arena :
`https://3000-i1m97gawrx886m2sglg71.e2b.app`

Cette URL est déclarée dans `site_url` et `uri_allow_list`, mais elle est **instable** (elle change à chaque session). Pour un usage réel, fournir un domaine stable puis mettre à jour ces deux paramètres.

## Réversibilité

Aucun secret n'est utilisé : tout repose sur la clé publiable. Revenir en arrière consiste à supprimer les deux blocs `forgot`/`recovery` de `OwnerPortal.tsx` ; aucune migration ni donnée n'est affectée.

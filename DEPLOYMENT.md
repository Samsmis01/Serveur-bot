# Déploiement conseillé

## Option A — 2 services sur le même VPS (le plus simple)
Les deux services partagent `./shared/sessions`.

1. Copier `.env.example` vers `.env` dans chaque serveur.
2. Mettre exactement la même valeur `SESSIONS_DIR=/app/sessions` si Docker, ou le même chemin absolu si lancement Node direct.
3. Changer `PAIRING_API_KEY`.
4. Ne jamais exposer le dossier `shared/sessions` par HTTP.
5. Lancer Server 2 puis Server 1.

## Option B — Site Vercel + API VPS
- Déployer `web/` sur Vercel.
- Dans les variables d’environnement Vercel, définir `PAIRING_SERVER_URL` et `PAIRING_API_KEY`.
- Le navigateur appelle `/api/pair`; la fonction Vercel transmet la requête à Server 1 sans exposer la clé API.

## Deux serveurs physiques
Le dossier de session doit être partagé de manière sûre entre Server 1 et Server 2. Ne synchronise pas naïvement les fichiers d'authentification avec Git, un dépôt public ou un service de fichiers non chiffré.

## WhatsApp
Le pairing code n'est pas une API mobile : il sert à lier le compte comme appareil compagnon. Utilise le numéro au format international sans +, espaces, tirets ou parenthèses.

Si le pairing retourne un code mais échoue côté WhatsApp, vérifie d'abord la version de Baileys, le navigateur déclaré, l'heure système, le réseau et les appareils déjà liés. Baileys évolue rapidement.

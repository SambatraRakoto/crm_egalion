# Déploiement via Portainer (Docker) — Nuruya CRM

Déploiement en conteneurs sur un VPS **Ubuntu** avec **Portainer**.
La stack lance **3 conteneurs** : `db` (PostgreSQL), `api` (backend Node), `web` (Nginx + frontend).

```
              Internet :80 / :443
                     │
              ┌──────▼──────┐
              │  web (Nginx)│  ← sert le frontend + proxifie /api → api:4000
              └──────┬──────┘
                     │ réseau Docker interne "nuruya"
            ┌────────▼────────┐
            │  api (Node)     │  :4000  (migrations auto au démarrage)
            └────────┬────────┘
                     │
            ┌────────▼────────┐
            │  db (Postgres)  │  volume persistant db_data
            └─────────────────┘
```

> **Pas de CORS** (même origine), **port 4000 jamais exposé** au public, **données DB persistées** dans un volume Docker.

Fichiers déjà présents dans le repo :
- `backend/Dockerfile`, `backend/.dockerignore`
- `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`
- `docker-compose.yml` (la stack)

---

## Prérequis

- Docker + Portainer déjà installés sur le VPS (tu les as).
- DNS : un enregistrement **A** `crm.nuruya.com` → IP du VPS.
- Le code accessible via **Git** (recommandé pour que Portainer build les images).

---

## Méthode A — Stack depuis un dépôt Git (recommandée)

Portainer construit les images directement depuis le repo.

1. **Portainer → Stacks → + Add stack.**
2. Nom : `nuruya`.
3. Build method : **Repository**.
   - Repository URL : `https://github.com/<toi>/<repo>`
   - Repository reference : `refs/heads/main`
   - Compose path : `docker-compose.yml`
   - Si repo privé : renseigner les identifiants / token.
4. Section **Environment variables** → ajouter (bouton *Add an environment variable*) :

   | Name | Value (exemple) |
   |---|---|
   | `APP_PUBLIC_URL` | `https://crm.nuruya.com` |
   | `PGDATABASE` | `nuruya_crm` |
   | `PGUSER` | `nuruya_app` |
   | `PGPASSWORD` | *(mot de passe fort)* |
   | `JWT_ACCESS_SECRET` | *(64 hex — voir ci-dessous)* |
   | `JWT_REFRESH_SECRET` | *(64 hex, différent)* |
   | `VITE_USD_TO_GHS` | `15.4` |
   | `WEB_PORT` | `80` |
   | `SHAQ_IDENTIFIER` / `SHAQ_SECRET` | *(si ShaQ utilisé)* |
   | `SHOPIFY_*` | *(si Shopify utilisé)* |

   Générer les secrets JWT (sur ta machine ou le VPS) :
   ```bash
   openssl rand -hex 32
   ```
5. **Deploy the stack.** Portainer build les 3 images et démarre les conteneurs.

> ⚠️ `APP_PUBLIC_URL` est **bakée dans le frontend au build** (Vite). Si tu changes de domaine, il faut **redéployer / rebuild** la stack.

---

## Méthode B — Web editor (copier-coller)

Si tu ne passes pas par Git :

1. Sur le VPS, clone le repo dans un dossier (ex. `/opt/nuruya`) — nécessaire car le compose utilise `build:` (contexte local).
   ```bash
   sudo git clone <URL_REPO> /opt/nuruya
   ```
2. Portainer → Stacks → Add stack → **Web editor**.
3. Colle le contenu de `docker-compose.yml`.
4. Renseigne les **Environment variables** (tableau ci-dessus).
5. Deploy.

> Le `build:` nécessite que les fichiers source soient présents sur l'hôte Docker. La méthode Git (A) gère ça automatiquement ; sinon assure-toi que le contexte de build est accessible.

---

## Étape post-déploiement — créer le compte admin (1 seule fois)

Les **migrations** s'exécutent automatiquement au démarrage du conteneur `api`.
Le **seed** (super admin) se lance manuellement une fois :

1. Portainer → **Containers** → `nuruya-api-1` (ou nom équivalent) → **Console** → *Connect* (`/bin/sh`).
2. Exécuter :
   ```bash
   npm run seed
   ```
   → crée `admin@nuruya.com` / `Admin@123`.

> 🔐 Connecte-toi puis **change immédiatement le mot de passe** (bouton « Change password »).

---

## Vérification

```bash
# Depuis le VPS
curl http://localhost/api/v1/health         # → 200
curl -X POST http://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nuruya.com","password":"Admin@123"}'   # → accessToken
```

Ouvre `http://crm.nuruya.com` dans le navigateur.

---

## Activer HTTPS

La stack expose le site en **HTTP (port 80)**. Pour le HTTPS, le plus simple avec Portainer :

### Option 1 — Nginx Proxy Manager (GUI, recommandé)
1. Déployer une stack **Nginx Proxy Manager** (image `jc21/nginx-proxy-manager`).
2. Mettre `web` (notre frontend) sur le port interne et NPM devant (ports 80/443).
   - Soit retirer `ports` du service `web` et le mettre sur le réseau de NPM,
   - soit pointer un *Proxy Host* NPM → `http://web:80`.
3. Dans NPM : Proxy Host `crm.nuruya.com` → Forward to `web:80`, onglet **SSL** → *Request a new Let's Encrypt certificate* → activer *Force SSL*.

### Option 2 — Traefik
Reverse proxy avec résolution TLS automatique via labels Docker (plus avancé).

### Option 3 — Cloudflare
Mettre le domaine derrière Cloudflare (proxy orange) et activer le mode SSL **Flexible/Full** — HTTPS côté visiteur sans certificat sur le VPS (rapide mais TLS terminé chez Cloudflare).

> Si tu utilises un reverse proxy HTTPS devant, change `APP_PUBLIC_URL` en `https://...` et **redéploie** (pour rebuild le frontend) afin que les appels API partent en HTTPS.

---

## Mises à jour (redéploiement)

**Méthode Git :** Portainer → Stacks → `nuruya` → **Pull and redeploy** (active *Re-pull image and redeploy* / rebuild).
Les migrations DB se rejouent automatiquement (idempotentes). Le volume `db_data` conserve les données.

**Manuel :**
```bash
cd /opt/nuruya && git pull
# puis dans Portainer : Stacks → nuruya → Update the stack (rebuild)
```

---

## Sauvegarde de la base

```bash
# Dump depuis le conteneur db
docker exec -t $(docker ps -qf name=nuruya-db) \
  pg_dump -U nuruya_app nuruya_crm > nuruya_$(date +%F).sql
```

---

## Dépannage

| Symptôme | Vérification |
|---|---|
| `api` redémarre en boucle | Logs du conteneur `api` ; souvent `PGPASSWORD` manquant ou DB pas prête |
| 502 sur `/api` | Le conteneur `api` est-il *healthy* ? Réseau `nuruya` partagé ? |
| Page blanche | `VITE_USE_MOCK` doit être `false` (déjà forcé) ; vider le cache navigateur |
| Login échoue (aucun user) | As-tu lancé `npm run seed` dans la console du conteneur `api` ? |
| Données perdues après update | Ne pas supprimer le volume `db_data` ; ne pas faire *Remove volumes* |
| Appels API en `http://localhost:4000` | `APP_PUBLIC_URL` non défini au build → rebuild avec la bonne valeur |

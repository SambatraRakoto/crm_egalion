# Déploiement manuel sur VPS — Nuruya CRM

Guide pas-à-pas pour déployer **manuellement** le CRM sur un VPS **Ubuntu 22.04 LTS**.

**Stack :**
- Backend : Node.js / Express — port `4000`, préfixe `/api/v1`, PostgreSQL, JWT.
- Frontend : React + Vite — compilé en fichiers statiques (`dist/`).
- Reverse proxy : **Nginx** (sert le frontend + proxifie l'API → pas de CORS).
- Process manager : **PM2** (garde le backend en vie, redémarre au reboot).
- HTTPS : **Let's Encrypt / Certbot**.

> Dans ce guide : domaine d'exemple = `crm.nuruya.com`. Remplace-le partout par le tien.
> Toutes les commandes serveur se font en SSH sur le VPS.

---

## 0. Prérequis

- Un VPS Ubuntu 22.04 avec accès `root` ou un user `sudo`.
- Un nom de domaine (ex. `crm.nuruya.com`) avec un **enregistrement DNS A** pointant vers l'IP du VPS.
- Le code du projet accessible (Git de préférence).

```bash
ssh root@IP_DU_VPS
```

---

## 1. Sécuriser le serveur (recommandé)

```bash
# Créer un utilisateur non-root
adduser deploy
usermod -aG sudo deploy
# (optionnel) copier ta clé SSH puis se reconnecter en 'deploy'

# Pare-feu : autoriser SSH + HTTP + HTTPS uniquement
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

> ⚠️ Le port `4000` (backend) ne doit **PAS** être ouvert au public. Nginx y accède en local (`127.0.0.1`).

---

## 2. Installer les dépendances système

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# PostgreSQL + Nginx + Git
sudo apt install -y postgresql postgresql-contrib nginx git

# PM2 (gestionnaire de process Node)
sudo npm install -g pm2
```

---

## 3. Créer la base de données PostgreSQL

```bash
sudo -u postgres psql
```

Dans le shell `psql` :

```sql
CREATE DATABASE nuruya_crm;
CREATE USER nuruya_app WITH ENCRYPTED PASSWORD 'UN_MOT_DE_PASSE_FORT';
GRANT ALL PRIVILEGES ON DATABASE nuruya_crm TO nuruya_app;
-- PostgreSQL 15+ : donner aussi les droits sur le schéma public
\c nuruya_crm
GRANT ALL ON SCHEMA public TO nuruya_app;
\q
```

> Note les identifiants `nuruya_app` / mot de passe → ils iront dans le `.env` backend.

---

## 4. Récupérer le code

```bash
sudo mkdir -p /var/www/nuruya
sudo chown -R $USER:$USER /var/www/nuruya
cd /var/www/nuruya

git clone <URL_DU_REPO> .
# Structure attendue : /var/www/nuruya/backend  et  /var/www/nuruya/frontend
```

> Pas de Git ? Transfère les dossiers via `scp` ou `rsync` depuis ta machine :
> `rsync -avz --exclude node_modules --exclude dist ./nuruya/ deploy@IP:/var/www/nuruya/`

---

## 5. Configurer & lancer le BACKEND

```bash
cd /var/www/nuruya/backend
npm ci --omit=dev   # installe les dépendances de prod
cp .env.example .env
nano .env
```

### `.env` de production (valeurs clés à changer)

```env
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1
APP_TIMEZONE=Africa/Accra
APP_PUBLIC_URL=https://crm.nuruya.com

# PostgreSQL (utilise l'utilisateur créé à l'étape 3)
PGHOST=localhost
PGPORT=5432
PGDATABASE=nuruya_crm
PGUSER=nuruya_app
PGPASSWORD=UN_MOT_DE_PASSE_FORT
PGSSL=false
PG_POOL_MAX=10

# JWT — GÉNÈRE DE VRAIS SECRETS (voir commande ci-dessous)
JWT_ACCESS_SECRET=__REMPLACER__
JWT_REFRESH_SECRET=__REMPLACER__
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Sécurité — l'app est servie sur le même domaine, donc CORS = ce domaine
BCRYPT_ROUNDS=12
CORS_ORIGIN=https://crm.nuruya.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=20

# Shopify (si utilisé)
SHOPIFY_STORE_DOMAIN=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2024-10
SHOPIFY_WEBHOOK_SECRET=

# ShaQ (si utilisé)
SHAQ_API_BASE=https://public-api.shaqexpress.com
SHAQ_IDENTIFIER=
SHAQ_SECRET=
SHAQ_WEBHOOK_SECRET=
```

**Générer des secrets JWT solides :**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Lance-le 2 fois, colle les valeurs dans JWT_ACCESS_SECRET et JWT_REFRESH_SECRET
```

### Migrer le schéma + créer le compte admin

```bash
npm run migrate   # crée les tables
npm run seed      # crée le super admin : admin@nuruya.com / Admin@123
```

> 🔐 **Change le mot de passe admin** après la première connexion (bouton « Change password »).

### Démarrer avec PM2

```bash
pm2 start src/server.js --name nuruya-api
pm2 save                      # sauvegarde la liste des process
pm2 startup                   # affiche une commande → copie/colle-la pour le démarrage auto
pm2 logs nuruya-api --lines 50   # vérifier qu'il démarre sans erreur
```

Test local du backend :

```bash
curl http://localhost:4000/api/v1/health   # doit répondre 200
```

---

## 6. Compiler le FRONTEND

```bash
cd /var/www/nuruya/frontend
npm ci
cp .env.example .env.production
nano .env.production
```

### `.env.production`

```env
# Même domaine → URL vide ou le domaine ; le préfixe pointe vers /api/v1 proxifié par Nginx
VITE_API_URL=https://crm.nuruya.com
VITE_API_PREFIX=/api/v1

# IMPÉRATIF : false en production (sinon données fictives)
VITE_USE_MOCK=false

VITE_USD_TO_GHS=15.4
```

```bash
npm run build   # génère le dossier dist/
```

> Le dossier `dist/` contient les fichiers statiques que Nginx va servir.

---

## 7. Configurer Nginx (frontend + proxy API)

```bash
sudo nano /etc/nginx/sites-available/nuruya
```

Colle cette configuration :

```nginx
server {
    listen 80;
    server_name crm.nuruya.com;

    # ----- Frontend (fichiers statiques compilés par Vite) -----
    root /var/www/nuruya/frontend/dist;
    index index.html;

    # SPA : toute route inconnue retombe sur index.html (react-router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ----- API : proxy vers le backend Node local -----
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache des assets statiques (hash dans le nom → cache long)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
```

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/nuruya /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # désactive le site par défaut
sudo nginx -t        # tester la config
sudo systemctl reload nginx
```

À ce stade, le site doit être accessible en **HTTP** : `http://crm.nuruya.com`

---

## 8. Activer HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d crm.nuruya.com
# Choisis l'option de redirection HTTP -> HTTPS
```

Certbot modifie automatiquement la config Nginx et installe le renouvellement auto. Vérifier :

```bash
sudo certbot renew --dry-run
```

Le site est maintenant en **HTTPS** : `https://crm.nuruya.com`

---

## 9. Vérification finale

```bash
# Backend vivant ?
pm2 status
curl -k https://crm.nuruya.com/api/v1/health

# Test de connexion (doit renvoyer un accessToken)
curl -k -X POST https://crm.nuruya.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nuruya.com","password":"Admin@123"}'
```

Puis ouvre `https://crm.nuruya.com` dans le navigateur, connecte-toi, et **change le mot de passe admin**.

---

## 10. Mises à jour ultérieures (redéploiement)

```bash
cd /var/www/nuruya
git pull

# Backend
cd backend
npm ci --omit=dev
npm run migrate          # applique les nouvelles migrations (idempotent)
pm2 restart nuruya-api

# Frontend
cd ../frontend
npm ci
npm run build            # régénère dist/ ; Nginx sert la nouvelle version immédiatement
```

---

## Aide-mémoire / dépannage

| Problème | Vérification |
|---|---|
| 502 Bad Gateway | Le backend tourne-t-il ? `pm2 status`, `pm2 logs nuruya-api` |
| Page blanche | `VITE_USE_MOCK=false` ? `dist/` bien généré ? `nginx -t` |
| API 404 | Le préfixe est `/api/v1` ; vérifier `location /api/` dans Nginx |
| Erreur DB | Identifiants `.env` = utilisateur PostgreSQL ; `sudo -u postgres psql` |
| CORS | Inutile ici (même domaine). Si sous-domaine API séparé : `CORS_ORIGIN` = domaine du front |
| Logs backend | `pm2 logs nuruya-api` |
| Logs Nginx | `sudo tail -f /var/log/nginx/error.log` |

### Sauvegarde de la base (à planifier)

```bash
pg_dump -U nuruya_app -h localhost nuruya_crm > /var/backups/nuruya_$(date +%F).sql
```

---

## Variante : API sur un sous-domaine séparé

Si tu préfères `app.nuruya.com` (front) + `api.nuruya.com` (API) :
1. Deux blocs `server` Nginx (un par sous-domaine), celui de l'API proxifie tout vers `127.0.0.1:4000`.
2. Frontend `.env.production` : `VITE_API_URL=https://api.nuruya.com`.
3. Backend `.env` : `CORS_ORIGIN=https://app.nuruya.com` (le CORS devient nécessaire).
4. Un certificat Certbot par sous-domaine (`-d app.nuruya.com -d api.nuruya.com`).

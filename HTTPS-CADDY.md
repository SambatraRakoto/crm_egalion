# HTTPS automatique avec Caddy — domaine Hostinger (Portainer)

URL propre `https://crm.tondomaine.com` avec certificat **Let's Encrypt
automatique** (obtention + renouvellement gérés par Caddy).

```
Visiteur ──HTTPS(443)──▶ Caddy (cert auto) ──▶ web:80 (Nginx) ──▶ api ──▶ db
```

## Pré-requis
- Un domaine (le tien, gratuit chez Hostinger).
- Ports **80** et **443** ouverts (challenge Let's Encrypt + trafic HTTPS).

---

## Étape 1 — DNS : pointer le domaine vers le VPS

Dans **hPanel Hostinger → Domaines → (ton domaine) → DNS / Nameservers → Gérer les enregistrements DNS** :

| Type | Nom | Valeur | TTL |
|---|---|---|---|
| `A` | `crm` | `2.25.210.208` *(IP de ton VPS)* | Auto |

> Ça crée `crm.tondomaine.com`. Attends quelques minutes que le DNS se propage.
> Vérifie : `ping crm.tondomaine.com` doit renvoyer l'IP du VPS.

(Si tu veux le CRM sur la racine `tondomaine.com`, mets un enregistrement `A` avec
le nom `@` ; adapte `SITE_DOMAIN` en conséquence.)

---

## Étape 2 — Ouvrir les ports 80 et 443

**a) Firewall Hostinger** (hPanel → VPS → **Firewall**) : autorise les ports
entrants **80 (HTTP)** et **443 (HTTPS)**.

**b) Pare-feu du serveur** (SSH) :
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

> Sans le port 80 ouvert, Let's Encrypt ne peut pas valider le domaine (challenge HTTP-01).

---

## Étape 3 — Variables de la stack (Portainer)

Stack `nuruya` → **Environment variables** :

| Name | Value |
|---|---|
| `SITE_DOMAIN` | `crm.tondomaine.com` *(le domaine, SANS https://)* |
| `APP_PUBLIC_URL` | `https://crm.tondomaine.com` *(AVEC https://)* |

---

## Étape 4 — Déployer

Portainer → Stack `nuruya` → **Update the stack** → coche **Re-pull and rebuild** → Update.

- Caddy démarre, contacte Let's Encrypt et obtient le certificat (quelques secondes).
- Le frontend est rebâti (API en relatif → suit le HTTPS).

Vérifie les logs de Caddy : Portainer → conteneur `caddy` → **Logs** → tu dois voir
`certificate obtained successfully`.

---

## Étape 5 — Vérifier

Ouvre **https://crm.tondomaine.com** → cadenas vert valide → login.

```bash
curl -I https://crm.tondomaine.com/api/v1/health   # → HTTP/2 200
```

---

## Étape 6 — Webhooks Shopify (enfin en HTTPS ✅)

Les 8 URLs deviennent :
```
https://crm.tondomaine.com/api/v1/shopify/webhooks/orders
https://crm.tondomaine.com/api/v1/shopify/webhooks/orders/cancelled
https://crm.tondomaine.com/api/v1/shopify/webhooks/fulfillments
https://crm.tondomaine.com/api/v1/shopify/webhooks/products
https://crm.tondomaine.com/api/v1/shopify/webhooks/inventory
```
→ ou bouton d'enregistrement automatique dans le CRM (page Shopify).

---

## Dépannage

| Symptôme | Cause / fix |
|---|---|
| Caddy : `could not get certificate` | DNS pas encore propagé, ou port 80/443 fermé (Hostinger + ufw) |
| `DNS problem: NXDOMAIN` | L'enregistrement A `crm` est manquant ou pointe la mauvaise IP |
| Page « 525 » / boucle | Vérifie que `SITE_DOMAIN` = exactement le domaine du DNS |
| 502 Bad Gateway | Conteneur `web` non démarré, ou pas sur le réseau `nuruya` |
| Trop d'essais Let's Encrypt | Rate-limit (5/semaine) ; le volume `caddy_data` conserve le cert, ne le supprime pas |

> ⚠️ Ne supprime jamais le volume `caddy_data` : il stocke les certificats. Le
> recréer trop souvent peut déclencher le rate-limit de Let's Encrypt.

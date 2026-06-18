# HTTPS sans ouvrir de port — Cloudflare Tunnel (Portainer)

Expose le CRM en **HTTPS** via un tunnel **sortant**. Aucun port (80/8080/443)
n'est ouvert sur le VPS. Le certificat TLS est géré automatiquement par Cloudflare.

```
Visiteur ──HTTPS──▶ Cloudflare ──tunnel chiffré sortant──▶ cloudflared (VPS) ──▶ web:80 ──▶ api
```

## Pré-requis
- Un nom de domaine (ex. `nuruya.com`) **ajouté sur Cloudflare** (plan gratuit suffit).
  - Sur Cloudflare : *Add a site* → suivre l'assistant → changer les **nameservers** du domaine chez ton registrar pour ceux de Cloudflare.

---

## Étape 1 — Créer le tunnel (dashboard Cloudflare)

1. Va sur **https://one.dash.cloudflare.com** (Zero Trust).
2. Menu **Networks → Tunnels → Create a tunnel**.
3. Type : **Cloudflared**. Donne un nom (ex. `nuruya`). **Save tunnel**.
4. À l'écran « Install connector », Cloudflare affiche une commande contenant un
   **token** (longue chaîne après `--token`). **Copie ce token** — c'est tout ce
   dont on a besoin (on n'installe rien à la main, c'est le conteneur qui le fait).

## Étape 2 — Router le hostname public

Toujours dans la création du tunnel, onglet **Public Hostnames → Add a public hostname** :

| Champ | Valeur |
|---|---|
| Subdomain | `crm` |
| Domain | `nuruya.com` |
| Type | `HTTP` |
| URL | `web:80` |

→ **Save**. Cela crée `https://crm.nuruya.com` qui pointe (via le tunnel) vers le
conteneur `web` sur le port 80. Cloudflare crée aussi automatiquement
l'enregistrement DNS.

> Important : le service est `HTTP` + `web:80` (interne au réseau Docker). C'est
> Cloudflare qui fait le HTTPS côté visiteur.

## Étape 3 — Déployer dans Portainer

1. La stack contient déjà le service `cloudflared` (voir `docker-compose.yml`).
2. Portainer → Stacks → `nuruya` → **Environment variables**, ajoute :

   | Name | Value |
   |---|---|
   | `CLOUDFLARE_TUNNEL_TOKEN` | *(le token copié à l'étape 1)* |
   | `APP_PUBLIC_URL` | `https://crm.nuruya.com` |

3. **Update the stack** → coche **Re-pull and rebuild** → Update.
   - Le rebuild régénère le frontend (API en chemin relatif → suit le HTTPS).
   - `cloudflared` se connecte ; dans le dashboard Cloudflare le tunnel passe **HEALTHY**.

## Étape 4 — Vérifier

- Ouvre **https://crm.nuruya.com** → cadenas valide, login OK.
- Logs du connecteur : Portainer → conteneur `cloudflared` → Logs (doit afficner
  « Registered tunnel connection »).

---

## Notes
- **Aucun port** n'est exposé : tu peux fermer 80/8080 dans `ufw` (`sudo ufw deny 8080/tcp`).
- L'appel API part en `https://crm.nuruya.com/api/v1/...` (même origine) → tunnel →
  `web` (Nginx) → proxy `/api` → `api`. Pas de CORS, pas de port.
- Le CORS backend (`CORS_ORIGIN=https://crm.nuruya.com`) est aligné via `APP_PUBLIC_URL`.

## Dépannage
| Symptôme | Cause / fix |
|---|---|
| Tunnel « DOWN » dans Cloudflare | Token erroné, ou `cloudflared` ne démarre pas → voir ses logs |
| 502 Bad Gateway (page Cloudflare) | Le hostname doit pointer vers `web:80` (pas `localhost`) et `web` doit tourner |
| Erreur SSL persistante | Vider le cache / navigation privée ; vérifier qu'on ouvre bien `https://crm.nuruya.com` |
| Login bloqué | Rebuild fait ? `APP_PUBLIC_URL` = exactement l'URL publique HTTPS ? |

---

## Alternative SANS nom de domaine — Tailscale Funnel

Si tu n'as **pas de domaine**, Tailscale Funnel donne une URL HTTPS gratuite
(`https://<machine>.<tailnet>.ts.net`), aussi en tunnel sortant.

1. Installer Tailscale sur le VPS : `curl -fsSL https://tailscale.com/install.sh | sh`
2. `sudo tailscale up`
3. Exposer le service web (port hôte, ex. 8080 mappé localement, ou le port du conteneur) :
   ```bash
   sudo tailscale funnel 8080
   ```
   (ou `sudo tailscale funnel --bg http://localhost:8080`)
4. Tailscale affiche l'URL `https://<machine>.<tailnet>.ts.net` → mets-la dans
   `APP_PUBLIC_URL` et rebuild la stack.

> Funnel nécessite d'activer HTTPS et Funnel dans la console Tailscale (Settings →
> Features). C'est plus simple si tu n'as pas de domaine, mais l'URL est moins
> « jolie » qu'un domaine Cloudflare.

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# reset-orders.sh — Vide UNIQUEMENT les commandes.
#   Supprime : orders, order_items, delivery_events
#   Conserve : products, users, roles, shopify_settings, etc.
#
# Usage :
#   ./reset-orders.sh                 # demande confirmation
#   ./reset-orders.sh --yes           # sans confirmation
#   DB_CONTAINER=autre-nom ./reset-orders.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Nom du conteneur PostgreSQL (adapte si besoin).
DB_CONTAINER="${DB_CONTAINER:-crm_egalion-db-1}"

# Confirmation (sauf si --yes).
if [ "${1:-}" != "--yes" ]; then
  echo "⚠️  Cela va SUPPRIMER toutes les commandes de la base ($DB_CONTAINER)."
  read -r -p "Continuer ? (oui/non) : " ans
  [ "$ans" = "oui" ] || { echo "Annulé."; exit 0; }
fi

# Purge (utilise le user/db configurés DANS le conteneur → pas d'erreur de rôle).
docker exec -i "$DB_CONTAINER" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE orders, order_items, delivery_events RESTART IDENTITY CASCADE;"'

# Vérification.
echo "✅ Commandes supprimées. Vérification :"
docker exec -i "$DB_CONTAINER" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM users) AS users;"'

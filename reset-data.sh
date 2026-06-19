#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# reset-data.sh — Réinitialise les données métier, en GARDANT les utilisateurs.
#   Supprime  : orders, order_items, delivery_events, products, sync_logs, audit_logs
#   Conserve  : users, roles, user_roles, refresh_tokens, password_resets,
#               shopify_settings (connexion Shopify préservée)
#
# Usage :
#   ./reset-data.sh              # demande confirmation
#   ./reset-data.sh --yes        # sans confirmation
#   ./reset-data.sh --shopify    # vide AUSSI shopify_settings (déconnecte Shopify)
#   DB_CONTAINER=autre-nom ./reset-data.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_CONTAINER="${DB_CONTAINER:-crm_egalion-db-1}"

# Tables à vider.
TABLES="orders, order_items, delivery_events, products, sync_logs, audit_logs"
for arg in "$@"; do
  [ "$arg" = "--shopify" ] && TABLES="$TABLES, shopify_settings"
done

# Confirmation (sauf si --yes présent).
case " $* " in
  *" --yes "*) ;;
  *)
    echo "⚠️  Réinitialisation des données ($DB_CONTAINER). Tables vidées :"
    echo "    $TABLES"
    read -r -p "Continuer ? (oui/non) : " ans
    [ "$ans" = "oui" ] || { echo "Annulé."; exit 0; }
    ;;
esac

# Purge (utilise le user/db configurés DANS le conteneur → pas d'erreur de rôle).
docker exec -i "$DB_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -c \"TRUNCATE $TABLES RESTART IDENTITY CASCADE;\""

# Vérification.
echo "✅ Données réinitialisées. Vérification :"
docker exec -i "$DB_CONTAINER" sh -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT (SELECT count(*) FROM orders) AS orders, (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM users) AS users;"'

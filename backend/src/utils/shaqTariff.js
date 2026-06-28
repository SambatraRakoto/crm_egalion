'use strict';

/**
 * ShaQ Express tariff & financial formulas.
 * Source: ShaQ Express Service Level Agreement (Contrat ShaQ), Section 3.1
 * "Geographical Coverage & Delivery Rates" + Section 9 "Cash on Delivery".
 * All amounts in GHS.
 */

// Regional delivery rate grid: base = rate per 0-1kg, extraKg = per extra kg.
const REGION_RATES = {
  greater_accra: { capital: 'Accra', base: 45, extraKg: 5 },
  ashanti: { capital: 'Kumasi', base: 55, extraKg: 5 },
  bono: { capital: 'Sunyani', base: 60, extraKg: 7 },
  bono_east: { capital: 'Techiman', base: 60, extraKg: 7 },
  ahafo: { capital: 'Goaso', base: 60, extraKg: 7 },
  central: { capital: 'Cape Coast', base: 50, extraKg: 5 },
  eastern: { capital: 'Koforidua', base: 50, extraKg: 5 },
  northern: { capital: 'Tamale', base: 80, extraKg: 8 },
  savannah: { capital: 'Damongo', base: 80, extraKg: 8 },
  north_east: { capital: 'Nalerigu', base: 80, extraKg: 8 },
  upper_east: { capital: 'Bolgatanga', base: 90, extraKg: 8 },
  upper_west: { capital: 'Wa', base: 90, extraKg: 8 },
  volta: { capital: 'Ho', base: 50, extraKg: 5 },
  oti: { capital: 'Dambai', base: 60, extraKg: 5 },
  western: { capital: 'Takoradi', base: 70, extraKg: 6 },
  western_north: { capital: 'Wiawso', base: 70, extraKg: 6 },
};

// Aliases for legacy / alternative region spellings.
const REGION_ALIASES = {
  'brong_ahafo': 'bono',
  'brong-ahafo': 'bono',
  accra: 'greater_accra',
};

// Default fee when a region is unknown/missing (cheapest southern belt rate).
const DEFAULT_FEE = 50;

/**
 * Handling fee rate (= "commission ShaQ"), Section 9.1: 5%.
 * IMPORTANT: the 5% is taken on the order amount AFTER removing the delivery fee
 * (commission = (price − delivery fee) × 5%), NOT on the full order amount.
 */
const COMMISSION_RATE = 0.05;
/** Returns charge (Section 10): 70% of original delivery cost. */
const RETURN_RATE = 0.70;

// FR : Normalise un nom de région (alias inclus).
// EN : Normalize a region name (aliases included).
function normalizeRegion(region) {
  const key = String(region || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return REGION_ALIASES[key] || key;
}

/** Regional base delivery fee, with extra-kg surcharge above 1kg. */
// FR : Frais de livraison régional (+ surcoût par kg).
// EN : Regional delivery fee (+ per-kg surcharge).
function deliveryFee(region, weightKg = 1) {
  const r = REGION_RATES[normalizeRegion(region)];
  if (!r) return DEFAULT_FEE;
  const extra = Math.max(0, Math.ceil((Number(weightKg) || 1) - 1));
  return r.base + extra * r.extraKg;
}

/**
 * Handling fee (commission ShaQ) = (price − delivery fee) × 5%.
 * The delivery fee is removed FIRST, then 5% is taken on the remainder.
 * Computed dynamically, never stored.
 */
// FR : Commission ShaQ = (prix − frais de livraison) × 5%.
// EN : ShaQ handling fee = (price − delivery fee) × 5%.
function commission(price, deliveryFee = 0) {
  const base = (Number(price) || 0) - (Number(deliveryFee) || 0);
  return Number((Math.max(0, base) * COMMISSION_RATE).toFixed(2));
}

/**
 * Per-order economics (matches the worked example in the spec):
 *   commission_shaq = (price − frais_livraison) × 0.05
 *   marge_nette     = price − frais_livraison − commission_shaq − cout_fournisseur
 * where cout_fournisseur = supplier_unit_cost × quantity (summed over items).
 *
 * @param {{ price:number, deliveryFee:number, supplierCost:number }} input
 */
// FR : Économie d'une commande (commission, marge nette).
// EN : Per-order economics (commission, net margin).
function orderEconomics({ price = 0, deliveryFee: fee = 0, supplierCost = 0 } = {}) {
  const p = Number(price) || 0;
  const frais = Number(fee) || 0;
  const cout = Number(supplierCost) || 0;
  const commissionShaq = commission(p, frais);
  const totalShaqFees = Number((frais + commissionShaq).toFixed(2));
  const margeNette = Number((p - frais - commissionShaq - cout).toFixed(2));
  const margeNettePct = p > 0 ? Number(((margeNette / p) * 100).toFixed(2)) : 0;
  return {
    price: p,
    fraisLivraison: frais,
    commissionShaq,
    coutFournisseur: cout,
    totalShaqFees,
    margeNette,
    margeNettePct,
  };
}

/** Flat tariff grid for the API/UI. */
// FR : Grille tarifaire à plat pour l'API/UI.
// EN : Flat tariff grid for the API/UI.
function tariffGrid() {
  return Object.entries(REGION_RATES).map(([key, r]) => ({
    region: key
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    regionKey: key,
    capital: r.capital,
    baseFee: r.base,
    extraKgFee: r.extraKg,
  }));
}

module.exports = {
  REGION_RATES,
  COMMISSION_RATE,
  RETURN_RATE,
  DEFAULT_FEE,
  normalizeRegion,
  deliveryFee,
  commission,
  orderEconomics,
  tariffGrid,
};

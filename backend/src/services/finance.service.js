'use strict';

const financeRepo = require('../repositories/finance.repository');
const { resolveDateRange } = require('../utils/dateRange');

const num = (v) => Number(Number(v || 0).toFixed(2));

// FR : Synthèse financière période (encaissé, restant, commission, marge).
// EN : Period financial summary (collected, outstanding, commission, margin).
async function summary(query) {
  const { from, to } = resolveDateRange(query);
  const [r, supplierCost] = await Promise.all([
    financeRepo.summary(from, to),
    financeRepo.supplierCostDelivered(from, to),
  ]);
  const totalRevenue = num(r.total_revenue);
  const collected = num(r.collected); // CA produits livrés
  const outstanding = num(r.outstanding);

  // ShaQ economics on delivered orders (commission and delivery fee kept separate):
  const fraisLivraison = num(r.frais_livraison);     // frais_livraison (en base, par région)
  const commissionShaq = num(r.commission_shaq);     // 5% × prix (dynamique)
  const totalShaqFees = num(fraisLivraison + commissionShaq);
  const coutFournisseur = num(supplierCost);
  // marge_nette = prix − frais_livraison − commission_shaq − cout_fournisseur
  const margeNette = num(collected - fraisLivraison - commissionShaq - coutFournisseur);
  const margeNettePct = collected > 0 ? num((margeNette / collected) * 100) : 0;

  return {
    deliveredOrders: Number(r.delivered_orders) || 0,
    totalRevenue,
    collected,
    outstanding,
    codCollected: num(r.cod_collected),
    codPending: num(r.cod_pending),
    // Two ShaQ cost lines, distinct on purpose (see UI requirement):
    fraisLivraison,
    commissionShaq,
    totalShaqFees,
    coutFournisseur,
    margeNette,
    margeNettePct,
    // Back-compat aliases
    totalDeliveryCost: fraisLivraison,
    totalLogisticsCost: totalShaqFees,
    netPosition: margeNette,
  };
}

// FR : Rapport financier par granularité (séries + totaux).
// EN : Financial report by granularity (series + totals).
async function report(query) {
  const { from, to } = resolveDateRange(query);
  const rows = await financeRepo.report(from, to, query.granularity || 'month');
  const series = rows.map((x) => ({
    bucket: x.bucket,
    orders: Number(x.orders) || 0,
    revenue: num(x.revenue),
    collected: num(x.collected),
    outstanding: num(x.outstanding),
    logisticsCost: num(x.logistics_cost),
  }));
  const totals = series.reduce(
    (acc, x) => ({
      revenue: acc.revenue + x.revenue,
      collected: acc.collected + x.collected,
      outstanding: acc.outstanding + x.outstanding,
      logisticsCost: acc.logisticsCost + x.logisticsCost,
    }),
    { revenue: 0, collected: 0, outstanding: 0, logisticsCost: 0 }
  );
  return {
    series,
    totals: {
      revenue: num(totals.revenue),
      collected: num(totals.collected),
      outstanding: num(totals.outstanding),
      logisticsCost: num(totals.logisticsCost),
      netPosition: num(totals.collected - totals.logisticsCost),
    },
  };
}

module.exports = { summary, report };

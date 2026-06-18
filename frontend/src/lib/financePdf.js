/**
 * Financial report → PDF (jsPDF + autotable).
 *
 * Renders the period-scoped finance dashboard data (the "données figées") as a
 * downloadable report: settled KPIs, ShaQ economics breakdown (commission and
 * delivery fee kept separate) and the per-period table.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const INDIGO = [79, 70, 229];
const SLATE = [100, 116, 139];

export function exportFinancePdf({ data, currency = 'USD', periodLabel = 'Tout' }) {
  const code = currency === 'GHS' ? 'GHS' : 'USD';
  const val = (m) => (currency === 'GHS' ? m?.ghs ?? 0 : m?.usd ?? 0);
  const fmt = (m) => `${val(m).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${code}`;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Financial report', 40, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nuruya CRM — Period: ${periodLabel}`, 40, 52);
  doc.setFontSize(8);
  doc.text(`Generated on ${now}`, pageW - 40, 52, { align: 'right' });

  // ── Settled KPIs ────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 92,
    head: [['Indicator', 'Value']],
    body: [
      ['Delivered orders', String(data.deliveredOrders ?? 0)],
      ['Payments received (already paid)', fmt(data.collected)],
      ['Outstanding balance (left to collect)', fmt(data.outstanding)],
      ['COD remittances', fmt(data.cod)],
    ],
    theme: 'grid',
    headStyles: { fillColor: INDIGO, halign: 'left' },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    styles: { fontSize: 10, cellPadding: 6 },
    margin: { left: 40, right: 40 },
  });

  // ── ShaQ economics (commission & frais séparés) ─────────────────────────
  const totalShaq = {
    usd: (data.fraisLivraison?.usd ?? 0) + (data.commissionShaq?.usd ?? 0),
    ghs: (data.fraisLivraison?.ghs ?? 0) + (data.commissionShaq?.ghs ?? 0),
  };
  doc.setTextColor(...SLATE);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ShaQ economics (delivered orders)', 40, doc.lastAutoTable.finalY + 26);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 34,
    body: [
      ['Delivered revenue', fmt(data.collected)],
      ['  incl. Delivery fee (regional grid)', `- ${fmt(data.fraisLivraison)}`],
      ['  incl. ShaQ commission (5% x price)', `- ${fmt(data.commissionShaq)}`],
      ['Total ShaQ fees', fmt(totalShaq)],
      ['Supplier cost (unit cost x qty)', `- ${fmt(data.coutFournisseur)}`],
      [`Net margin  (${data.margeNettePct ?? 0}%)`, fmt(data.margeNette)],
    ],
    theme: 'plain',
    columnStyles: { 1: { halign: 'right' } },
    styles: { fontSize: 10, cellPadding: 4 },
    margin: { left: 40, right: 40 },
    didParseCell: (h) => {
      const label = h.row.raw[0];
      if (label === 'Total ShaQ fees' || label.startsWith('Net margin')) {
        h.cell.styles.fontStyle = 'bold';
        h.cell.styles.fillColor = [241, 245, 249];
      }
      if (label.startsWith('Net margin') && h.column.index === 1) h.cell.styles.textColor = [16, 185, 129];
    },
  });

  // ── Per-period table ────────────────────────────────────────────────────
  const revKey = currency === 'GHS' ? 'revenueGHS' : 'revenueUSD';
  const colKey = currency === 'GHS' ? 'collectedGHS' : 'collectedUSD';
  const outKey = currency === 'GHS' ? 'outstandingGHS' : 'outstandingUSD';
  const logKey = currency === 'GHS' ? 'logisticsGHS' : 'logisticsUSD';
  const rows = (data.byMonth || []).map((m) => [
    m.month,
    `${(m[revKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `${(m[colKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `${(m[outKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `${(m[logKey] || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    String(m.orders || 0),
  ]);

  if (rows.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 24,
      head: [[`Period`, `Revenue (${code})`, `Collected (${code})`, `Outstanding (${code})`, `Logistics (${code})`, 'Orders']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: INDIGO },
      columnStyles: {
        1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
        4: { halign: 'right' }, 5: { halign: 'right' },
      },
      styles: { fontSize: 9, cellPadding: 5 },
      margin: { left: 40, right: 40 },
    });
  }

  const safe = String(periodLabel).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`financial-report-${safe}.pdf`);
}

export default exportFinancePdf;

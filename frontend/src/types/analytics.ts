/** Dashboard & finance analytics types (field names match the chart components). */

import type { Money } from './common';

export interface Series {
  labels: string[];
  data: number[];
}

export interface RevenueSeries {
  labels: string[];
  dataUSD: number[];
  dataGHS: number[];
}

export interface StatusSlice {
  label: string;
  count: number;
  pct: string;
}

export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export interface RegionRevenue {
  region: string;
  orders: number;
  revenueUSD: number;
}

export interface RegionCancellation {
  region: string;
  rate: number;
  total: number;
  cancelled: number;
}

export interface FinancialMonthRow {
  month: string;
  revenueUSD: number;
  revenueGHS: number;
  collectedUSD: number;
  collectedGHS: number;
  outstandingUSD: number;
  outstandingGHS: number;
  logisticsUSD: number;
  logisticsGHS: number;
  orders: number;
  avgUSD: number;
  avgGHS: number;
}

export interface FinanceData {
  totalRevenue: Money;
  avgOrderValue: Money;
  collected: Money;
  outstanding: Money;
  cod: Money;
  returnRate: string;
  deliveryRate: string;
  byMonth: FinancialMonthRow[];
}

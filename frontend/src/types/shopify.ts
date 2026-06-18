/** Shopify integration & sync types. */

export type SyncStatus = 'success' | 'error' | 'warning';

export interface SyncLog {
  id: number;
  date: string;
  status: SyncStatus;
  products: number;
  orders: number;
  duration: string;
  note: string;
}

/** Shopify settings singleton (`GET/PUT /shopify/settings`). The token is never
 * returned in clear text by the backend. */
export interface ShopifySettings {
  shopDomain: string;
  /** Masked, e.g. "••••••••1234". Never the real token. */
  tokenMasked: string;
  webhooksRegistered: boolean;
  autoSync: boolean;
}

export interface ConnectionCheck {
  connected: boolean;
  shopName?: string;
  message?: string;
}

export interface SyncResult {
  status: SyncStatus;
  products: number;
  orders: number;
  duration: string;
  note: string;
}

import { customDataSource } from './custom';
import { demoDataSource } from './demo';
import type { DataSource } from './types';

export type { DataSource, DataSourceSearchResult, GatewayProduct } from './types';

/**
 * Pick a data source from the `DATA_SOURCE` env var.
 *
 *   DATA_SOURCE=demo    (default) → bundled LUXE BOND JSON
 *   DATA_SOURCE=custom           → proxies to CUSTOM_DATA_SOURCE_URL
 *
 * Recipes select the right value through their `.env.example`.
 */
export function getDataSource(): DataSource {
  const choice = (process.env.DATA_SOURCE ?? 'demo').trim().toLowerCase();
  if (choice === 'custom') return customDataSource;
  return demoDataSource;
}

/**
 * DataSource abstraction for the OSS demo-gateway.
 *
 * Every recipe in `examples/recipes/*` that uses demo-gateway does so through
 * one of these implementations. Swapping data sources is the primary knob a
 * developer turns when adapting the example to their own commerce backend.
 *
 * The interface is deliberately small: `search(query) -> products`.
 * Ranking / filtering logic lives in `lib/search-catalog.ts` so that any
 * adapter that can return a full catalog gets consistent search behavior for
 * free.
 */

export type GatewayProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  description: string;
  inStock: boolean;
};

export type DataSourceSearchResult = {
  products: GatewayProduct[];
  queryInterpreted: string;
};

export interface DataSource {
  /** Stable identifier surfaced in `/api/health` as `connector`. */
  readonly id: string;

  /** Run a natural-language product search. */
  search(query: string): Promise<DataSourceSearchResult>;

  /** Total rows available to the search (surfaced in `/api/health`). */
  count(): Promise<number>;
}

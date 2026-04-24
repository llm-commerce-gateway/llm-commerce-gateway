import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { searchProducts } from '../search-catalog';
import type { CatalogProduct } from '../static-catalog';
import { STATIC_CATALOG } from '../static-catalog';
import type {
  DataSource,
  DataSourceSearchResult,
} from './types';

/**
 * Default data source: reads a static JSON catalog from
 * `examples/demo-data/<brand>/products.json`.
 *
 * Resolution order:
 *   1. `DEMO_DATA_PATH` env var (absolute or relative to this app's cwd)
 *   2. `../demo-data/luxe-bond/products.json` (bundled with the repo)
 *   3. `STATIC_CATALOG` fallback (compiled into the binary so deploys without
 *      access to the repo still work)
 */

const DEFAULT_DATA_PATH = '../demo-data/luxe-bond/products.json';

type ProductsFile = {
  products?: CatalogProduct[];
};

let cachedCatalog: CatalogProduct[] | null = null;

function loadCatalog(): CatalogProduct[] {
  if (cachedCatalog) return cachedCatalog;

  const envPath = process.env.DEMO_DATA_PATH?.trim();
  const candidate = envPath || DEFAULT_DATA_PATH;
  const absolute = resolve(process.cwd(), candidate);

  try {
    const raw = readFileSync(absolute, 'utf-8');
    const parsed = JSON.parse(raw) as ProductsFile;
    if (Array.isArray(parsed.products) && parsed.products.length > 0) {
      cachedCatalog = parsed.products;
      return cachedCatalog;
    }
  } catch {
    // fall through to the compiled-in fallback
  }

  cachedCatalog = STATIC_CATALOG;
  return cachedCatalog;
}

export const demoDataSource: DataSource = {
  id: 'demo-static',

  async search(query: string): Promise<DataSourceSearchResult> {
    return searchProducts(loadCatalog(), query);
  },

  async count(): Promise<number> {
    return loadCatalog().length;
  },
};

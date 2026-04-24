import type { CatalogProduct } from './static-catalog';
import type { GatewayProduct } from './data-source/types';

export type { GatewayProduct } from './data-source/types';

function tokenVariants(t: string): string[] {
  const out = new Set<string>([t]);
  if (t.length > 3 && t.endsWith('s')) out.add(t.slice(0, -1));
  if (t.length > 2 && !t.endsWith('s')) out.add(`${t}s`);
  return [...out];
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\w\s$]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractMaxPrice(q: string): number | null {
  const m = q.match(/(?:under|below|less than|<)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  if (m) return Number(m[1]);
  const m2 = q.match(/\$\s*(\d+)\s*(?:or less|max|maximum)/i);
  if (m2) return Number(m2[1]);
  return null;
}

function wantsInStockOnly(q: string): boolean {
  const s = q.toLowerCase();
  return (
    s.includes('in stock') ||
    s.includes('in-stock') ||
    s.includes('available') ||
    s.includes('available only')
  );
}

function scoreProduct(p: CatalogProduct, tokens: string[]): number {
  const nameL = p.name.toLowerCase();
  const catL = p.category.toLowerCase();
  const brandL = p.brand.toLowerCase();
  const descL = p.description.toLowerCase();
  const tagsL = p.tags.map((x) => x.toLowerCase());
  const skuL = p.sku.toLowerCase();

  let score = 0;
  for (const t of tokens) {
    if (t.length < 3 || t.startsWith('$') || /^\d+$/.test(t)) continue;
    for (const v of tokenVariants(t)) {
      if (nameL.includes(v)) { score += 3; break; }
      if (catL.includes(v)) { score += 2; break; }
      if (brandL.includes(v)) { score += 2; break; }
      if (descL.includes(v)) { score += 1; break; }
      if (tagsL.some((tag) => tag.includes(v))) { score += 1; break; }
      if (skuL.includes(v)) { score += 2; break; }
    }
  }
  return score;
}

export function searchProducts(catalog: CatalogProduct[], query: string): {
  products: GatewayProduct[];
  queryInterpreted: string;
} {
  const raw = query.trim();
  const tokens = tokenize(raw);
  const maxPrice = extractMaxPrice(raw);
  const inStockOnly = wantsInStockOnly(raw);

  let pool = catalog.filter((p) => {
    if (maxPrice !== null && p.unitPrice > maxPrice) return false;
    if (inStockOnly && !p.inStock) return false;
    return true;
  });

  if (tokens.length === 0) {
    pool = [...catalog];
  } else {
    const scored = pool.map((p) => ({ p, s: scoreProduct(p, tokens) }));
    const anyHit = scored.some((x) => x.s > 0);
    if (anyHit) {
      scored.sort((a, b) => b.s - a.s);
      pool = scored.filter((x) => x.s > 0).map((x) => x.p);
    }
  }

  if (pool.length === 0) {
    pool = catalog.slice(0, 20);
  }

  const top = pool.slice(0, 12).map(
    (p): GatewayProduct => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      price: p.unitPrice,
      currency: p.currency,
      description: p.description,
      inStock: p.inStock,
    }),
  );

  return {
    products: top,
    queryInterpreted: raw || '(empty — returning catalog sample)',
  };
}

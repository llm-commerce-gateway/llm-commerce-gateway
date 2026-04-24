export interface ProductResult {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  description?: string;
  inStock: boolean;
  imageUrl?: string;
  sku?: string;
}

export function parseProductsFromToolResult(content: string): ProductResult[] {
  try {
    const parsed = JSON.parse(content) as unknown;
    const candidates = [
      (parsed as { products?: unknown }).products,
      (parsed as { items?: unknown }).items,
      (parsed as { results?: unknown }).results,
      Array.isArray(parsed) ? parsed : null,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.slice(0, 6).map((item: Record<string, unknown>, i) => ({
          id: String(item.id ?? item.sku ?? `product-${i}`),
          name: String(item.name ?? item.title ?? 'Product'),
          brand: String(item.brand ?? item.brandName ?? ''),
          price: Number(item.price ?? item.unitPrice ?? 0),
          currency: String(item.currency ?? 'USD'),
          description: item.description
            ? String(item.description).slice(0, 120)
            : undefined,
          inStock: Boolean(item.inStock ?? item.in_stock ?? true),
          imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
          sku: item.sku != null ? String(item.sku) : undefined,
        }));
      }
    }
    return [];
  } catch {
    return [];
  }
}

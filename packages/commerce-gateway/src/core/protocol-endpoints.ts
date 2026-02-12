/**
 * @betterdata/llm-gateway - Protocol-Compliant Endpoints
 * 
 * Implements the required gateway protocol endpoints as specified in
 * commerce-gateway-implementation-spec.md Section 6
 * 
 * @license MIT
 */

import type { Hono } from 'hono';
import type { GatewayBackends } from '../backends/interfaces';
import type { Logger } from '../observability/index';

// ============================================================================
// Types
// ============================================================================

export interface ProtocolEndpointsConfig {
  basePath?: string;
  backends: GatewayBackends;
  logger: Logger;
  version?: string;
}

// ============================================================================
// Protocol Endpoints
// ============================================================================

/**
 * Add protocol-compliant endpoints to the gateway app
 */
export function addProtocolEndpoints(app: Hono, config: ProtocolEndpointsConfig): void {
  const basePath = config.basePath ?? '';
  const { backends, logger, version = '1.0.0' } = config;

  // ==========================================================================
  // GET /health
  // ==========================================================================
  app.get(`${basePath}/health`, async (c) => {
    try {
      // Simple health check - could be enhanced to check backends
      const status = 'healthy'; // Could check backend health here
      
      return c.json({
        status,
        version,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Health check failed', error instanceof Error ? error : null);
      return c.json({
        status: 'unhealthy',
        version,
        timestamp: new Date().toISOString(),
      }, 503);
    }
  });

  // ==========================================================================
  // POST /search
  // ==========================================================================
  app.post(`${basePath}/search`, async (c) => {
    try {
      const body = await c.req.json<{
        query: string;
        filters?: Record<string, unknown>;
        limit?: number;
        offset?: number;
      }>();

      if (!body.query) {
        return c.json({ error: 'Query parameter is required' }, 400);
      }

      const limit = Math.min(body.limit ?? 10, 100);
      const offset = body.offset ?? 0;

      const result = await backends.products.searchProducts(body.query, body.filters, {
        limit,
        offset,
      });

      return c.json({
        products: result.products.map(formatProductForProtocol),
        total: result.total,
        facets: result.facets,
      });
    } catch (error) {
      logger.error('Search failed', error instanceof Error ? error : null);
      return c.json({ error: 'Search failed' }, 500);
    }
  });

  // ==========================================================================
  // GET /product/{id}
  // ==========================================================================
  app.get(`${basePath}/product/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      
      if (!id) {
        return c.json({ error: 'Product ID is required' }, 400);
      }

      const product = await backends.products.getProductDetails(id);
      
      if (!product) {
        return c.json({ error: 'Product not found' }, 404);
      }

      return c.json(formatProductForProtocol(product));
    } catch (error) {
      logger.error('Get product failed', error instanceof Error ? error : null);
      return c.json({ error: 'Failed to get product' }, 500);
    }
  });

  // ==========================================================================
  // GET /product/gtin/{gtin}
  // ==========================================================================
  app.get(`${basePath}/product/gtin/:gtin`, async (c) => {
    try {
      const gtin = c.req.param('gtin');
      
      if (!gtin) {
        return c.json({ error: 'GTIN is required' }, 400);
      }

      // Validate GTIN format
      if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) {
        return c.json({ error: 'Invalid GTIN format' }, 400);
      }

      // Try to find product by GTIN
      // This assumes the backend supports GTIN lookup
      // If not, we'd need to search and filter by GTIN
      const product = await backends.products.getProductDetails(gtin);
      
      if (!product || product.gtin !== gtin) {
        // Fallback: search for products with this GTIN
        const searchResult = await backends.products.searchProducts(gtin, {
          limit: 1,
        });
        
        const found = searchResult.products.find(p => p.gtin === gtin);
        
        if (!found) {
          return c.json({ error: 'Product not found' }, 404);
        }
        
        return c.json(formatProductForProtocol(found));
      }

      return c.json(formatProductForProtocol(product));
    } catch (error) {
      logger.error('Get product by GTIN failed', error instanceof Error ? error : null);
      return c.json({ error: 'Failed to get product' }, 500);
    }
  });

  // ==========================================================================
  // POST /pricing
  // ==========================================================================
  app.post(`${basePath}/pricing`, async (c) => {
    try {
      const body = await c.req.json<{
        product_ids?: string[];
        gtins?: string[];
      }>();

      if (!body.product_ids && !body.gtins) {
        return c.json({ error: 'product_ids or gtins required' }, 400);
      }

      const prices: Array<{
        product_id?: string;
        gtin?: string;
        amount: number;
        currency: string;
        formatted?: string;
        original_amount?: number;
        sale?: boolean;
        valid_until?: string;
      }> = [];

      // Get pricing for product IDs
      if (body.product_ids) {
        for (const productId of body.product_ids) {
          const product = await backends.products.getProductDetails(productId);
          if (product && product.price) {
            prices.push({
              product_id: productId,
              amount: product.price.amount,
              currency: product.price.currency,
              formatted: product.price.formatted,
              original_amount: product.price.originalAmount,
              sale: product.price.sale,
              valid_until: product.price.validUntil,
            });
          }
        }
      }

      // Get pricing for GTINs
      if (body.gtins) {
        for (const gtin of body.gtins) {
          // Try to find product by GTIN
          const searchResult = await backends.products.searchProducts(gtin, { limit: 1 });
          const product = searchResult.products.find(p => p.gtin === gtin);
          
          if (product && product.price) {
            prices.push({
              gtin,
              amount: product.price.amount,
              currency: product.price.currency,
              formatted: product.price.formatted,
              original_amount: product.price.originalAmount,
              sale: product.price.sale,
              valid_until: product.price.validUntil,
            });
          }
        }
      }

      return c.json({ prices });
    } catch (error) {
      logger.error('Get pricing failed', error instanceof Error ? error : null);
      return c.json({ error: 'Failed to get pricing' }, 500);
    }
  });

  // ==========================================================================
  // POST /availability
  // ==========================================================================
  app.post(`${basePath}/availability`, async (c) => {
    try {
      const body = await c.req.json<{
        product_ids?: string[];
        gtins?: string[];
        location?: string;
      }>();

      if (!body.product_ids && !body.gtins) {
        return c.json({ error: 'product_ids or gtins required' }, 400);
      }

      const availability: Array<{
        product_id?: string;
        gtin?: string;
        in_stock: boolean;
        quantity?: number;
        location?: string;
        restock_date?: string;
        shipping_estimate?: string;
      }> = [];

      // Check availability for product IDs
      if (body.product_ids) {
        const inventory = await backends.products.checkInventory(body.product_ids);
        
        for (const inv of inventory) {
          availability.push({
            product_id: inv.productId,
            in_stock: inv.available ?? false,
            quantity: inv.quantity,
            location: body.location ?? inv.locations?.[0]?.locationId,
            shipping_estimate: inv.shippingEstimate,
          });
        }
      }

      // Check availability for GTINs
      if (body.gtins) {
        // Find products by GTIN and check their inventory
        for (const gtin of body.gtins) {
          const searchResult = await backends.products.searchProducts(gtin, { limit: 1 });
          const product = searchResult.products.find(p => p.gtin === gtin);
          
          if (product) {
            const inventory = await backends.products.checkInventory([product.id]);
            const inv = inventory[0];
            
            if (inv) {
              availability.push({
                gtin,
                in_stock: inv.available ?? false,
                quantity: inv.quantity,
                location: body.location ?? inv.locations?.[0]?.locationId,
                shipping_estimate: inv.shippingEstimate,
              });
            }
          }
        }
      }

      return c.json({ availability });
    } catch (error) {
      logger.error('Check availability failed', error instanceof Error ? error : null);
      return c.json({ error: 'Failed to check availability' }, 500);
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format product for protocol response
 */
function formatProductForProtocol(product: any): any {
  return {
    id: product.id,
    gtin: product.gtin,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category ? [product.category] : product.categories,
    images: product.images?.map((img: any) => ({
      url: img.url,
      alt: img.alt,
      width: img.width,
      height: img.height,
      type: img.type,
    })),
    attributes: product.attributes,
    price: product.price ? {
      amount: product.price.amount,
      currency: product.price.currency,
      formatted: product.price.formatted,
      original_amount: product.price.originalAmount,
      sale: product.price.sale,
      valid_until: product.price.validUntil,
    } : undefined,
    availability: product.inventory ? {
      in_stock: product.inventory.available ?? product.inStock,
      quantity: product.inventory.quantity,
      location: product.inventory.locations?.[0]?.locationId,
      restock_date: product.inventory.restockDate,
      shipping_estimate: product.inventory.shippingEstimate,
    } : undefined,
    url: product.url,
  };
}


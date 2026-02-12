/**
 * Catalog Types for Product Matching
 * 
 * Types and interfaces for matching vendor products to canonical ProductMaster records.
 */

/**
 * Location data for product listings
 */
export interface LocationData {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

/**
 * Shipping option for product listings
 */
export interface ShippingOption {
  method: string;
  cost: number;
  estimatedDays: number;
}

/**
 * Input from vendor product catalog (e.g., Shopify, Square)
 */
export interface VendorProductInput {
  // Platform context (from VendorPlatformAccount)
  vendorPlatformAccountId?: string;  // Link to platform account
  
  // Platform-specific IDs (for deep linking)
  platformProductId?: string;        // e.g., Shopify: "gid://shopify/Product/12345"
  platformVariantId?: string;        // e.g., Shopify: "gid://shopify/ProductVariant/67890"
  
  // Identifiers
  gtin?: string;
  vendorSku: string;
  
  // Product info
  brand?: string;
  name: string;
  description?: string;
  
  // Pricing & inventory
  price: number;
  compareAtPrice?: number;
  currency?: string;
  inStock: boolean;
  availableQuantity?: number;
  
  // Location
  locationData?: LocationData;
  
  // Shipping
  shippingOptions?: ShippingOption[];
  pickupAvailable?: boolean;
  freeShipping?: boolean;
  
  // Media
  images?: string[];
  
  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Minimal ProductMaster representation for matching
 */
export interface ProductMasterMatch {
  id: string;
  globalSku: string | null;
  gtin: string | null;
  brandName: string | null;
  productName: string;
  description: string | null;
}

/**
 * Result of matching a vendor product to a ProductMaster
 */
export interface MatchResult {
  productMaster: ProductMasterMatch;
  isNewProduct: boolean;
  matchConfidence: number; // 0-1
  matchMethod: 'gtin' | 'brand_name_fuzzy' | 'manual' | 'new';
}

/**
 * Batch import result
 */
export interface BatchImportResult {
  total: number;
  matched: number;
  created: number;
  failed: number;
  errors: Array<{
    vendorSku: string;
    error: string;
  }>;
}


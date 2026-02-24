/**
 * @betterdata/commerce-gateway - Link Types
 * 
 * Type definitions for link generation and analytics.
 * 
 * @license MIT
 */

import type { Product, Cart } from '../backends/interfaces';

// ============================================================================
// Link Types
// ============================================================================

/**
 * Short link result
 */
export interface ShortLink {
  /** Short link ID */
  id: string;
  
  /** Short URL */
  shortUrl: string;
  
  /** Original/destination URL */
  originalUrl: string;
  
  /** Domain used */
  domain: string;
  
  /** Link key/slug */
  key: string;
  
  /** QR code URL (if generated) */
  qrCodeUrl?: string;
  
  /** QR code SVG (if generated) */
  qrCodeSvg?: string;
  
  /** QR code image data URL (if generated) */
  qrCodeDataUrl?: string;
  
  /** Expiration timestamp */
  expiresAt?: Date;
  
  /** Created timestamp */
  createdAt: Date;
  
  /** Embedded context */
  context?: LinkContext;
  
  /** Analytics URL */
  analyticsUrl?: string;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Link context (embedded in link for retrieval)
 */
export interface LinkContext {
  /** Session ID */
  sessionId: string;
  
  /** LLM provider that generated this link */
  llmProvider: 'claude' | 'openai' | 'grok' | 'google' | 'custom';
  
  /** Conversation ID */
  conversationId?: string;
  
  /** User ID (if authenticated) */
  userId?: string;
  
  /** Organization ID */
  organizationId?: string;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Link type
 */
export type LinkType = 'product' | 'cart' | 'checkout' | 'custom';

/**
 * QR code options
 */
export interface QRCodeOptions {
  /** QR code size in pixels */
  size?: number;
  
  /** Output format */
  format?: 'png' | 'svg' | 'jpeg';
  
  /** Logo URL to embed */
  logo?: string;
  
  /** Logo size as percentage of QR code */
  logoSize?: number;
  
  /** Foreground color */
  fgColor?: string;
  
  /** Background color */
  bgColor?: string;
  
  /** Error correction level */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Link creation options
 */
export interface CreateLinkOptions {
  /** Custom expiry in hours */
  expiryHours?: number;
  
  /** Custom key/slug */
  key?: string;
  
  /** UTM parameters */
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  
  /** Generate QR code */
  qrCode?: boolean | QRCodeOptions;
  
  /** Custom tags */
  tags?: string[];
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Link Generator Interface
// ============================================================================

/**
 * Link generator interface
 */
export interface LinkGenerator {
  /**
   * Create a product link
   */
  createProductLink(
    product: Product,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink>;
  
  /**
   * Create a cart link
   */
  createCartLink(
    cart: Cart,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink>;
  
  /**
   * Create a checkout link
   */
  createCheckoutLink(
    cart: Cart,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink>;
  
  /**
   * Create a custom link
   */
  createLink(
    url: string,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink>;
  
  /**
   * Get link by ID
   */
  getLink(linkId: string): Promise<ShortLink | null>;
  
  /**
   * Delete a link
   */
  deleteLink(linkId: string): Promise<void>;
  
  /**
   * Update link metadata
   */
  updateLink(linkId: string, updates: Partial<CreateLinkOptions>): Promise<ShortLink>;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Click context
 */
export interface ClickContext {
  /** User agent string */
  userAgent?: string;
  
  /** Referer URL */
  referer?: string;
  
  /** IP address */
  ip?: string;
  
  /** Country code */
  country?: string;
  
  /** City */
  city?: string;
  
  /** Device type */
  device?: 'desktop' | 'mobile' | 'tablet' | 'bot';
  
  /** Browser name */
  browser?: string;
  
  /** OS name */
  os?: string;
  
  /** Timestamp */
  timestamp?: Date;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conversion context
 */
export interface ConversionContext {
  /** Order ID */
  orderId: string;
  
  /** Order total */
  orderTotal: number;
  
  /** Currency */
  currency: string;
  
  /** Items purchased */
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  
  /** Timestamp */
  timestamp?: Date;
  
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Link metrics
 */
export interface LinkMetrics {
  /** Link ID */
  linkId: string;
  
  /** Total clicks */
  clicks: number;
  
  /** Unique clicks */
  uniqueClicks: number;
  
  /** Conversions */
  conversions: number;
  
  /** Conversion rate */
  conversionRate: number;
  
  /** Total revenue from conversions */
  revenue: number;
  
  /** Currency */
  currency: string;
  
  /** Clicks by country */
  clicksByCountry: Record<string, number>;
  
  /** Clicks by device */
  clicksByDevice: Record<string, number>;
  
  /** Clicks by browser */
  clicksByBrowser: Record<string, number>;
  
  /** Clicks by day */
  clicksByDay: Array<{ date: string; clicks: number }>;
  
  /** Top referers */
  topReferers: Array<{ referer: string; clicks: number }>;
  
  /** First click timestamp */
  firstClick?: Date;
  
  /** Last click timestamp */
  lastClick?: Date;
}

/**
 * Link analytics interface
 */
export interface LinkAnalytics {
  /**
   * Track a click event
   */
  trackClick(linkId: string, context: ClickContext): Promise<void>;
  
  /**
   * Track a conversion event
   */
  trackConversion(linkId: string, context: ConversionContext): Promise<void>;
  
  /**
   * Get metrics for a link
   */
  getMetrics(linkId: string): Promise<LinkMetrics>;
  
  /**
   * Get metrics for multiple links
   */
  getBatchMetrics(linkIds: string[]): Promise<Map<string, LinkMetrics>>;
  
  /**
   * Get top performing links
   */
  getTopLinks(options?: {
    limit?: number;
    sortBy?: 'clicks' | 'conversions' | 'revenue';
    timeRange?: { start: Date; end: Date };
  }): Promise<LinkMetrics[]>;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Base link generator configuration
 */
export interface BaseLinkConfig {
  /** Default domain */
  domain?: string;
  
  /** Base URL for your store */
  storeBaseUrl: string;
  
  /** Default expiry times in hours */
  defaultExpiry?: {
    product?: number;
    cart?: number;
    checkout?: number;
  };
  
  /** Enable QR codes by default */
  qrCode?: boolean | QRCodeOptions;
  
  /** Default UTM parameters */
  defaultUtm?: CreateLinkOptions['utm'];
  
  /** Debug mode */
  debug?: boolean;
}

/**
 * Dub.co configuration
 */
export interface DubConfig extends BaseLinkConfig {
  /** Dub API key */
  apiKey: string;
  
  /** Workspace ID */
  workspaceId?: string;
  
  /** Default domain (e.g., 'shop.link') */
  domain: string;
  
  /** Enable link expiration */
  enableExpiry?: boolean;
}

/**
 * Bitly configuration
 */
export interface BitlyConfig extends BaseLinkConfig {
  /** Bitly API key */
  apiKey: string;
  
  /** Group GUID */
  groupGuid?: string;
  
  /** Custom domain */
  domain?: string;
}

/**
 * Custom link generator configuration
 */
export interface CustomLinkConfig extends BaseLinkConfig {
  /** API endpoint for creating links */
  createEndpoint: string;
  
  /** API endpoint for getting links */
  getEndpoint?: string;
  
  /** API endpoint for deleting links */
  deleteEndpoint?: string;
  
  /** Auth header name */
  authHeader?: string;
  
  /** Auth header value */
  authValue?: string;
  
  /** Custom headers */
  headers?: Record<string, string>;
}

// ============================================================================
// Default Expiry Times
// ============================================================================

export const DEFAULT_EXPIRY_HOURS = {
  product: 168,    // 7 days
  cart: 24,        // 24 hours
  checkout: 1,     // 1 hour
  custom: 168,     // 7 days
} as const;


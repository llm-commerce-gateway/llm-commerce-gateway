/**
 * @betterdata/commerce-gateway - Base Link Generator
 * 
 * Base class for link generator implementations.
 * 
 * @license MIT
 */

import type { Product, Cart } from '../backends/interfaces';
import type {
  LinkGenerator,
  ShortLink,
  LinkContext,
  CreateLinkOptions,
  BaseLinkConfig,
  LinkType,
  QRCodeOptions,
} from './types';
import { DEFAULT_EXPIRY_HOURS } from './types';
import { generateQRCodeSVG, generateQRCodeDataUrl } from './qr/generator';

// ============================================================================
// Base Link Generator
// ============================================================================

/**
 * Base class for link generator implementations
 */
export abstract class BaseLinkGenerator implements LinkGenerator {
  protected config: BaseLinkConfig;
  protected defaultExpiry: Record<string, number>;

  constructor(config: BaseLinkConfig) {
    this.config = config;
    this.defaultExpiry = {
      product: config.defaultExpiry?.product ?? DEFAULT_EXPIRY_HOURS.product,
      cart: config.defaultExpiry?.cart ?? DEFAULT_EXPIRY_HOURS.cart,
      checkout: config.defaultExpiry?.checkout ?? DEFAULT_EXPIRY_HOURS.checkout,
      custom: DEFAULT_EXPIRY_HOURS.custom,
    };
  }

  // ============================================================================
  // Abstract Methods (implement in subclasses)
  // ============================================================================

  /**
   * Create a short link
   */
  abstract createLink(
    url: string,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink>;

  /**
   * Get link by ID
   */
  abstract getLink(linkId: string): Promise<ShortLink | null>;

  /**
   * Delete a link
   */
  abstract deleteLink(linkId: string): Promise<void>;

  /**
   * Update link
   */
  abstract updateLink(
    linkId: string,
    updates: Partial<CreateLinkOptions>
  ): Promise<ShortLink>;

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Create a product link
   */
  async createProductLink(
    product: Product,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink> {
    const url = this.buildProductUrl(product);
    
    return this.createLink(url, context, {
      expiryHours: this.defaultExpiry.product,
      ...options,
      metadata: {
        type: 'product',
        productId: product.id,
        productName: product.name,
        ...options?.metadata,
      },
    });
  }

  /**
   * Create a cart link
   */
  async createCartLink(
    cart: Cart,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink> {
    const url = this.buildCartUrl(cart);
    
    return this.createLink(url, context, {
      expiryHours: this.defaultExpiry.cart,
      ...options,
      metadata: {
        type: 'cart',
        cartId: cart.id,
        itemCount: cart.items.length,
        total: cart.total,
        ...options?.metadata,
      },
    });
  }

  /**
   * Create a checkout link
   */
  async createCheckoutLink(
    cart: Cart,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink> {
    const url = this.buildCheckoutUrl(cart);
    
    return this.createLink(url, context, {
      expiryHours: this.defaultExpiry.checkout,
      ...options,
      metadata: {
        type: 'checkout',
        cartId: cart.id,
        total: cart.total,
        ...options?.metadata,
      },
    });
  }

  // ============================================================================
  // URL Builders
  // ============================================================================

  /**
   * Build product URL
   */
  protected buildProductUrl(product: Product): string {
    const base = this.config.storeBaseUrl.replace(/\/$/, '');
    return `${base}/products/${product.slug ?? product.id}`;
  }

  /**
   * Build cart URL
   */
  protected buildCartUrl(cart: Cart): string {
    const base = this.config.storeBaseUrl.replace(/\/$/, '');
    return `${base}/cart/${cart.id}`;
  }

  /**
   * Build checkout URL
   */
  protected buildCheckoutUrl(cart: Cart): string {
    const base = this.config.storeBaseUrl.replace(/\/$/, '');
    if (cart.checkoutUrl) {
      return cart.checkoutUrl;
    }
    return `${base}/checkout/${cart.id}`;
  }

  /**
   * Add UTM parameters to URL
   */
  protected addUtmParams(url: string, utm?: CreateLinkOptions['utm']): string {
    if (!utm) return url;
    
    const urlObj = new URL(url);
    
    if (utm.source) urlObj.searchParams.set('utm_source', utm.source);
    if (utm.medium) urlObj.searchParams.set('utm_medium', utm.medium);
    if (utm.campaign) urlObj.searchParams.set('utm_campaign', utm.campaign);
    if (utm.term) urlObj.searchParams.set('utm_term', utm.term);
    if (utm.content) urlObj.searchParams.set('utm_content', utm.content);
    
    return urlObj.toString();
  }

  /**
   * Get combined UTM params (defaults + options)
   */
  protected getUtmParams(options?: CreateLinkOptions): CreateLinkOptions['utm'] {
    return {
      ...this.config.defaultUtm,
      ...options?.utm,
    };
  }

  /**
   * Calculate expiry date
   */
  protected calculateExpiry(
    type: LinkType,
    hours?: number
  ): Date {
    const expiryHours = hours ?? this.defaultExpiry[type] ?? this.defaultExpiry.custom ?? 24;
    return new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  }

  /**
   * Generate a random key/slug
   */
  protected generateKey(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  /**
   * Generate a unique link ID
   */
  protected generateLinkId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `lnk_${timestamp}${random}`;
  }

  // ============================================================================
  // QR Code Generation
  // ============================================================================

  /**
   * Generate QR code for a link
   */
  protected async generateQRCode(
    shortUrl: string,
    options?: boolean | QRCodeOptions
  ): Promise<{ qrCodeSvg?: string; qrCodeDataUrl?: string; qrCodeUrl?: string }> {
    if (!options) return {};
    
    const qrOptions: QRCodeOptions = typeof options === 'boolean' 
      ? {} 
      : options;

    const size = qrOptions.size ?? 256;
    const format = qrOptions.format ?? 'svg';
    const fgColor = qrOptions.fgColor ?? '#000000';
    const bgColor = qrOptions.bgColor ?? '#ffffff';
    const errorCorrection = qrOptions.errorCorrection ?? 'M';

    try {
      if (format === 'svg') {
        const svg = generateQRCodeSVG(shortUrl, {
          size,
          fgColor,
          bgColor,
          errorCorrection,
          logo: qrOptions.logo,
          logoSize: qrOptions.logoSize,
        });
        
        return { qrCodeSvg: svg };
      } else {
        const dataUrl = await generateQRCodeDataUrl(shortUrl, {
          size,
          format,
          fgColor,
          bgColor,
          errorCorrection,
          logo: qrOptions.logo,
          logoSize: qrOptions.logoSize,
        });
        
        return { qrCodeDataUrl: dataUrl };
      }
    } catch (error) {
      this.log('QR code generation failed', error);
      return {};
    }
  }

  /**
   * Merge QR code options
   */
  protected getQRCodeOptions(
    options?: CreateLinkOptions
  ): boolean | QRCodeOptions | undefined {
    if (options?.qrCode !== undefined) {
      return options.qrCode;
    }
    return this.config.qrCode;
  }

  // ============================================================================
  // Logging
  // ============================================================================

  protected log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[LinkGenerator] ${message}`, data ?? '');
    }
  }
}


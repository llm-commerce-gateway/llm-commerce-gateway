/**
 * @betterdata/commerce-gateway - Custom Link Generator
 * 
 * Flexible link generation for self-hosted or custom link shorteners.
 * 
 * @license Apache-2.0
 */

import type {
  ShortLink,
  LinkContext,
  CreateLinkOptions,
  CustomLinkConfig,
} from '../types';
import { BaseLinkGenerator } from '../BaseLinkGenerator';

// ============================================================================
// Custom Link Generator
// ============================================================================

/**
 * Custom/self-hosted link generator implementation
 * 
 * @example
 * ```typescript
 * import { CustomLinkGenerator } from '@betterdata/commerce-gateway/links/custom';
 * 
 * const links = new CustomLinkGenerator({
 *   storeBaseUrl: 'https://mystore.com',
 *   domain: 'links.mystore.com',
 *   createEndpoint: 'https://api.mystore.com/links',
 *   getEndpoint: 'https://api.mystore.com/links',
 *   authHeader: 'X-API-Key',
 *   authValue: process.env.MY_API_KEY!,
 * });
 * 
 * const link = await links.createProductLink(product, context);
 * ```
 */
export class CustomLinkGenerator extends BaseLinkGenerator {
  private createEndpoint: string;
  private getEndpoint?: string;
  private deleteEndpoint?: string;
  private authHeader?: string;
  private authValue?: string;
  private customHeaders: Record<string, string>;
  private domain: string;

  // In-memory store for links (if no get endpoint configured)
  private linkStore: Map<string, ShortLink> = new Map();

  constructor(config: CustomLinkConfig) {
    super(config);
    
    this.createEndpoint = config.createEndpoint;
    this.getEndpoint = config.getEndpoint;
    this.deleteEndpoint = config.deleteEndpoint;
    this.authHeader = config.authHeader;
    this.authValue = config.authValue;
    this.customHeaders = config.headers ?? {};
    this.domain = config.domain ?? new URL(config.createEndpoint).hostname;
  }

  // ============================================================================
  // Link Operations
  // ============================================================================

  /**
   * Create a short link
   */
  async createLink(
    url: string,
    context: LinkContext,
    options?: CreateLinkOptions
  ): Promise<ShortLink> {
    const utm = this.getUtmParams(options);
    const urlWithUtm = this.addUtmParams(url, utm);
    const key = options?.key ?? this.generateKey();
    const expiresAt = options?.expiryHours
      ? new Date(Date.now() + options.expiryHours * 60 * 60 * 1000)
      : undefined;

    const requestBody = {
      url: urlWithUtm,
      key,
      context,
      metadata: options?.metadata,
      tags: options?.tags,
      expiresAt: expiresAt?.toISOString(),
    };

    try {
      const response = await this.makeRequest<{
        id?: string;
        shortUrl?: string;
        key?: string;
        qrCodeUrl?: string;
      }>('POST', this.createEndpoint, requestBody);

      const shortLink: ShortLink = {
        id: response.id ?? this.generateLinkId(),
        shortUrl: response.shortUrl ?? `https://${this.domain}/${key}`,
        originalUrl: urlWithUtm,
        domain: this.domain,
        key: response.key ?? key,
        qrCodeUrl: response.qrCodeUrl,
        expiresAt,
        createdAt: new Date(),
        context,
        metadata: options?.metadata,
      };

      // Generate QR code if requested
      const qrOptions = this.getQRCodeOptions(options);
      if (qrOptions) {
        const qrCodes = await this.generateQRCode(shortLink.shortUrl, qrOptions);
        Object.assign(shortLink, qrCodes);
      }

      // Store locally for retrieval
      this.linkStore.set(shortLink.id, shortLink);

      return shortLink;
    } catch (error) {
      // If API fails, fall back to local generation
      this.log('API failed, using local generation', error);
      return this.createLocalLink(urlWithUtm, key, context, expiresAt, options);
    }
  }

  /**
   * Create a link locally (no external API)
   */
  private async createLocalLink(
    url: string,
    key: string,
    context: LinkContext,
    expiresAt?: Date,
    options?: CreateLinkOptions
  ): Promise<ShortLink> {
    const shortLink: ShortLink = {
      id: this.generateLinkId(),
      shortUrl: `https://${this.domain}/${key}`,
      originalUrl: url,
      domain: this.domain,
      key,
      expiresAt,
      createdAt: new Date(),
      context,
      metadata: options?.metadata,
    };

    // Generate QR code if requested
    const qrOptions = this.getQRCodeOptions(options);
    if (qrOptions) {
      const qrCodes = await this.generateQRCode(shortLink.shortUrl, qrOptions);
      Object.assign(shortLink, qrCodes);
    }

    // Store locally
    this.linkStore.set(shortLink.id, shortLink);

    return shortLink;
  }

  /**
   * Get link by ID
   */
  async getLink(linkId: string): Promise<ShortLink | null> {
    // Check local store first
    const localLink = this.linkStore.get(linkId);
    if (localLink) {
      // Check expiry
      if (localLink.expiresAt && localLink.expiresAt < new Date()) {
        this.linkStore.delete(linkId);
        return null;
      }
      return localLink;
    }

    // Try API if configured
    if (this.getEndpoint) {
      try {
        const response = await this.makeRequest<{
          id: string;
          shortUrl: string;
          originalUrl: string;
          key: string;
          expiresAt?: string;
          createdAt: string;
          context?: LinkContext;
          metadata?: Record<string, unknown>;
        }>('GET', `${this.getEndpoint}/${linkId}`);

        return {
          id: response.id,
          shortUrl: response.shortUrl,
          originalUrl: response.originalUrl,
          domain: this.domain,
          key: response.key,
          expiresAt: response.expiresAt ? new Date(response.expiresAt) : undefined,
          createdAt: new Date(response.createdAt),
          context: response.context,
          metadata: response.metadata,
        };
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Delete a link
   */
  async deleteLink(linkId: string): Promise<void> {
    // Remove from local store
    this.linkStore.delete(linkId);

    // Try API if configured
    if (this.deleteEndpoint) {
      try {
        await this.makeRequest('DELETE', `${this.deleteEndpoint}/${linkId}`);
      } catch {
        // Ignore API errors, link is removed locally
      }
    }
  }

  /**
   * Update link
   */
  async updateLink(
    linkId: string,
    updates: Partial<CreateLinkOptions>
  ): Promise<ShortLink> {
    const existingLink = await this.getLink(linkId);
    if (!existingLink) {
      throw new Error(`Link not found: ${linkId}`);
    }

    // Update local copy
    const updatedLink: ShortLink = {
      ...existingLink,
      key: updates.key ?? existingLink.key,
      metadata: {
        ...existingLink.metadata,
        ...updates.metadata,
      },
    };

    if (updates.expiryHours) {
      updatedLink.expiresAt = new Date(Date.now() + updates.expiryHours * 60 * 60 * 1000);
    }

    // Update short URL if key changed
    if (updates.key) {
      updatedLink.shortUrl = `https://${this.domain}/${updates.key}`;
    }

    this.linkStore.set(linkId, updatedLink);

    return updatedLink;
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Get all links from local store
   */
  getAllLinks(): ShortLink[] {
    const now = new Date();
    const links: ShortLink[] = [];

    for (const [id, link] of this.linkStore) {
      // Filter out expired links
      if (link.expiresAt && link.expiresAt < now) {
        this.linkStore.delete(id);
        continue;
      }
      links.push(link);
    }

    return links;
  }

  /**
   * Clear expired links
   */
  clearExpired(): number {
    const now = new Date();
    let cleared = 0;

    for (const [id, link] of this.linkStore) {
      if (link.expiresAt && link.expiresAt < now) {
        this.linkStore.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  /**
   * Make API request
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    if (this.authHeader && this.authValue) {
      headers[this.authHeader] = this.authValue;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    this.log(`${method} ${endpoint}`, body);

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }
}

// ============================================================================
// In-Memory Link Generator (No External API)
// ============================================================================

/**
 * Simple in-memory link generator for development/testing
 */
export class InMemoryLinkGenerator extends CustomLinkGenerator {
  constructor(config: Omit<CustomLinkConfig, 'createEndpoint'> & { domain: string }) {
    super({
      ...config,
      createEndpoint: 'memory://links', // Dummy endpoint
    });
  }
}


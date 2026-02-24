/**
 * @betterdata/commerce-gateway - Dub.co Link Generator
 * 
 * Link generation using Dub.co (recommended).
 * 
 * @see https://dub.co/docs
 * @license MIT
 */

import type {
  ShortLink,
  LinkContext,
  CreateLinkOptions,
  DubConfig,
} from '../types';
import { BaseLinkGenerator } from '../BaseLinkGenerator';

// ============================================================================
// Dub.co API Types
// ============================================================================

interface DubLink {
  id: string;
  domain: string;
  key: string;
  url: string;
  shortLink: string;
  qrCode?: string;
  archived: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  description?: string;
  image?: string;
  clicks: number;
  leads: number;
  sales: number;
  saleAmount: number;
  trackConversion: boolean;
  tags?: Array<{ id: string; name: string; color: string }>;
  comments?: string;
  geo?: Record<string, string>;
  publicStats: boolean;
  rewrite: boolean;
  doIndex: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface DubCreateRequest {
  url: string;
  domain?: string;
  key?: string;
  externalId?: string;
  prefix?: string;
  trackConversion?: boolean;
  archived?: boolean;
  publicStats?: boolean;
  tagIds?: string[];
  comments?: string;
  expiresAt?: string;
  title?: string;
  description?: string;
  image?: string;
  rewrite?: boolean;
  ios?: string;
  android?: string;
  geo?: Record<string, string>;
  doIndex?: boolean;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface DubUpdateRequest extends Partial<DubCreateRequest> {}

// ============================================================================
// Dub Link Generator
// ============================================================================

/**
 * Dub.co link generator implementation
 * 
 * @example
 * ```typescript
 * import { DubLinkGenerator } from '@betterdata/commerce-gateway/links/dub';
 * 
 * const links = new DubLinkGenerator({
 *   apiKey: process.env.DUB_API_KEY!,
 *   domain: 'shop.link',
 *   storeBaseUrl: 'https://mystore.com',
 *   qrCode: true,
 * });
 * 
 * const link = await links.createProductLink(product, context);
 * console.log(link.shortUrl); // https://shop.link/abc123
 * ```
 */
export class DubLinkGenerator extends BaseLinkGenerator {
  private apiKey: string;
  private domain: string;
  private workspaceId?: string;
  private baseUrl = 'https://api.dub.co';
  private enableExpiry: boolean;

  constructor(config: DubConfig) {
    super(config);
    
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.workspaceId = config.workspaceId;
    this.enableExpiry = config.enableExpiry ?? true;
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
    
    const request: DubCreateRequest = {
      url: urlWithUtm,
      domain: this.domain,
      key: options?.key,
      trackConversion: true,
      publicStats: false,
      comments: JSON.stringify(context),
    };

    // Add expiration if enabled
    if (this.enableExpiry && options?.expiryHours) {
      const expiresAt = new Date(Date.now() + options.expiryHours * 60 * 60 * 1000);
      request.expiresAt = expiresAt.toISOString();
    }

    // Add UTM params
    if (utm) {
      request.utm_source = utm.source;
      request.utm_medium = utm.medium;
      request.utm_campaign = utm.campaign;
      request.utm_term = utm.term;
      request.utm_content = utm.content;
    }

    // Add title/description from metadata
    if (options?.metadata?.title) {
      request.title = String(options.metadata.title);
    }
    if (options?.metadata?.description) {
      request.description = String(options.metadata.description);
    }

    const dubLink = await this.makeRequest<DubLink>('POST', '/links', request);

    // Generate QR code if requested
    const qrOptions = this.getQRCodeOptions(options);
    const qrCodes = await this.generateQRCode(dubLink.shortLink, qrOptions);

    return this.mapDubLink(dubLink, context, qrCodes);
  }

  /**
   * Get link by ID
   */
  async getLink(linkId: string): Promise<ShortLink | null> {
    try {
      const dubLink = await this.makeRequest<DubLink>('GET', `/links/${linkId}`);
      
      // Try to parse context from comments
      let context: LinkContext | undefined;
      if (dubLink.comments) {
        try {
          context = JSON.parse(dubLink.comments) as LinkContext;
        } catch {
          // Comments aren't valid JSON context
        }
      }

      return this.mapDubLink(dubLink, context);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a link
   */
  async deleteLink(linkId: string): Promise<void> {
    await this.makeRequest('DELETE', `/links/${linkId}`);
  }

  /**
   * Update link
   */
  async updateLink(
    linkId: string,
    updates: Partial<CreateLinkOptions>
  ): Promise<ShortLink> {
    const request: DubUpdateRequest = {};

    if (updates.key) {
      request.key = updates.key;
    }

    if (updates.expiryHours && this.enableExpiry) {
      const expiresAt = new Date(Date.now() + updates.expiryHours * 60 * 60 * 1000);
      request.expiresAt = expiresAt.toISOString();
    }

    if (updates.utm) {
      request.utm_source = updates.utm.source;
      request.utm_medium = updates.utm.medium;
      request.utm_campaign = updates.utm.campaign;
      request.utm_term = updates.utm.term;
      request.utm_content = updates.utm.content;
    }

    if (updates.metadata?.title) {
      request.title = String(updates.metadata.title);
    }
    if (updates.metadata?.description) {
      request.description = String(updates.metadata.description);
    }

    const dubLink = await this.makeRequest<DubLink>('PATCH', `/links/${linkId}`, request);
    return this.mapDubLink(dubLink);
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Get links with filters
   */
  async getLinks(options?: {
    domain?: string;
    tagId?: string;
    search?: string;
    sort?: 'createdAt' | 'clicks' | 'lastClicked';
    page?: number;
    pageSize?: number;
  }): Promise<ShortLink[]> {
    const params = new URLSearchParams();
    
    if (options?.domain) params.set('domain', options.domain);
    if (options?.tagId) params.set('tagId', options.tagId);
    if (options?.search) params.set('search', options.search);
    if (options?.sort) params.set('sort', options.sort);
    if (options?.page) params.set('page', options.page.toString());
    if (options?.pageSize) params.set('pageSize', options.pageSize.toString());

    const queryString = params.toString();
    const path = queryString ? `/links?${queryString}` : '/links';
    
    const dubLinks = await this.makeRequest<DubLink[]>('GET', path);
    return dubLinks.map(link => this.mapDubLink(link));
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get link analytics from Dub
   */
  async getAnalytics(linkId: string, options?: {
    event?: 'clicks' | 'leads' | 'sales';
    groupBy?: 'timeseries' | 'countries' | 'cities' | 'devices' | 'browsers' | 'os' | 'referers';
    interval?: '1h' | '24h' | '7d' | '30d' | '90d' | 'all';
  }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('linkId', linkId);
    
    if (options?.event) params.set('event', options.event);
    if (options?.groupBy) params.set('groupBy', options.groupBy);
    if (options?.interval) params.set('interval', options.interval);

    return this.makeRequest('GET', `/analytics?${params.toString()}`);
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  /**
   * Make API request to Dub.co
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.workspaceId) {
      headers['dub-workspace-id'] = this.workspaceId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    this.log(`${method} ${path}`, body);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(`Dub API error: ${errorData.error?.message ?? response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map Dub link to ShortLink
   */
  private mapDubLink(
    dubLink: DubLink,
    context?: LinkContext,
    qrCodes?: { qrCodeSvg?: string; qrCodeDataUrl?: string; qrCodeUrl?: string }
  ): ShortLink {
    return {
      id: dubLink.id,
      shortUrl: dubLink.shortLink,
      originalUrl: dubLink.url,
      domain: dubLink.domain,
      key: dubLink.key,
      qrCodeUrl: dubLink.qrCode ?? qrCodes?.qrCodeUrl,
      qrCodeSvg: qrCodes?.qrCodeSvg,
      qrCodeDataUrl: qrCodes?.qrCodeDataUrl,
      expiresAt: dubLink.expiresAt ? new Date(dubLink.expiresAt) : undefined,
      createdAt: new Date(dubLink.createdAt),
      context,
      analyticsUrl: `https://app.dub.co/analytics?domain=${dubLink.domain}&key=${dubLink.key}`,
      metadata: {
        clicks: dubLink.clicks,
        leads: dubLink.leads,
        sales: dubLink.sales,
        saleAmount: dubLink.saleAmount,
        title: dubLink.title,
        description: dubLink.description,
      },
    };
  }
}


/**
 * @betterdata/commerce-gateway - Bitly Link Generator
 * 
 * Link generation using Bitly.
 * 
 * @see https://dev.bitly.com/
 * @license Apache-2.0
 */

import type {
  ShortLink,
  LinkContext,
  CreateLinkOptions,
  BitlyConfig,
} from '../types';
import { BaseLinkGenerator } from '../BaseLinkGenerator';

// ============================================================================
// Bitly API Types
// ============================================================================

interface BitlyLink {
  id: string;
  link: string;
  long_url: string;
  title?: string;
  archived: boolean;
  created_at: string;
  created_by: string;
  client_id: string;
  custom_bitlinks: string[];
  tags: string[];
  launchpad_ids: string[];
  deeplinks: Array<{
    guid: string;
    bitlink: string;
    app_uri_path: string;
    install_url: string;
    app_guid: string;
    os: string;
    install_type: string;
    created: string;
    modified: string;
    brand_guid: string;
  }>;
  references?: {
    group: string;
    organization: string;
  };
}

interface BitlyCreateRequest {
  long_url: string;
  domain?: string;
  title?: string;
  tags?: string[];
  group_guid?: string;
  deeplinks?: Array<{
    app_uri_path: string;
    install_url: string;
    install_type: string;
    app_guid?: string;
  }>;
}

interface BitlyClicksResponse {
  unit_reference: string;
  units: number;
  unit: string;
  link_clicks: Array<{
    date: string;
    clicks: number;
  }>;
}

interface BitlyCountriesResponse {
  unit_reference: string;
  units: number;
  unit: string;
  metrics: Array<{
    value: string;
    clicks: number;
  }>;
}

// ============================================================================
// Bitly Link Generator
// ============================================================================

/**
 * Bitly link generator implementation
 * 
 * @example
 * ```typescript
 * import { BitlyLinkGenerator } from '@betterdata/commerce-gateway/links/bitly';
 * 
 * const links = new BitlyLinkGenerator({
 *   apiKey: process.env.BITLY_API_KEY!,
 *   storeBaseUrl: 'https://mystore.com',
 *   domain: 'bit.ly', // or your custom domain
 * });
 * 
 * const link = await links.createProductLink(product, context);
 * console.log(link.shortUrl); // https://bit.ly/abc123
 * ```
 */
export class BitlyLinkGenerator extends BaseLinkGenerator {
  private apiKey: string;
  private groupGuid?: string;
  private domain: string;
  private baseUrl = 'https://api-ssl.bitly.com/v4';

  // Store context in memory (Bitly doesn't support custom metadata)
  private contextStore: Map<string, LinkContext> = new Map();

  constructor(config: BitlyConfig) {
    super(config);
    
    this.apiKey = config.apiKey;
    this.groupGuid = config.groupGuid;
    this.domain = config.domain ?? 'bit.ly';
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
    
    const request: BitlyCreateRequest = {
      long_url: urlWithUtm,
      domain: this.domain,
      title: options?.metadata?.title as string | undefined,
      tags: options?.tags,
      group_guid: this.groupGuid,
    };

    const bitlyLink = await this.makeRequest<BitlyLink>('POST', '/bitlinks', request);

    // Store context locally (Bitly doesn't support metadata)
    this.contextStore.set(bitlyLink.id, context);

    // Generate QR code if requested
    const qrOptions = this.getQRCodeOptions(options);
    const qrCodes = await this.generateQRCode(bitlyLink.link, qrOptions);

    // Calculate expiry (Bitly doesn't support expiration, we track it locally)
    const expiresAt = options?.expiryHours 
      ? new Date(Date.now() + options.expiryHours * 60 * 60 * 1000)
      : undefined;

    return this.mapBitlyLink(bitlyLink, context, expiresAt, qrCodes);
  }

  /**
   * Get link by ID
   */
  async getLink(linkId: string): Promise<ShortLink | null> {
    try {
      // Bitly uses the full link as ID (e.g., "bit.ly/abc123")
      const encodedId = encodeURIComponent(linkId);
      const bitlyLink = await this.makeRequest<BitlyLink>('GET', `/bitlinks/${encodedId}`);
      
      // Retrieve stored context
      const context = this.contextStore.get(bitlyLink.id);

      return this.mapBitlyLink(bitlyLink, context);
    } catch (error) {
      if (error instanceof Error && error.message.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete a link
   * Note: Bitly doesn't support deleting links, only archiving
   */
  async deleteLink(linkId: string): Promise<void> {
    const encodedId = encodeURIComponent(linkId);
    
    // Archive the link (Bitly doesn't support deletion)
    await this.makeRequest('PATCH', `/bitlinks/${encodedId}`, {
      archived: true,
    });

    // Remove from local context store
    this.contextStore.delete(linkId);
  }

  /**
   * Update link
   */
  async updateLink(
    linkId: string,
    updates: Partial<CreateLinkOptions>
  ): Promise<ShortLink> {
    const encodedId = encodeURIComponent(linkId);
    
    const request: Partial<BitlyCreateRequest> = {};

    if (updates.metadata?.title) {
      request.title = String(updates.metadata.title);
    }

    if (updates.tags) {
      request.tags = updates.tags;
    }

    const bitlyLink = await this.makeRequest<BitlyLink>('PATCH', `/bitlinks/${encodedId}`, request);
    const context = this.contextStore.get(bitlyLink.id);
    
    return this.mapBitlyLink(bitlyLink, context);
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get click analytics for a link
   */
  async getClicks(linkId: string, options?: {
    unit?: 'minute' | 'hour' | 'day' | 'week' | 'month';
    units?: number;
  }): Promise<BitlyClicksResponse> {
    const encodedId = encodeURIComponent(linkId);
    const params = new URLSearchParams();
    
    params.set('unit', options?.unit ?? 'day');
    params.set('units', String(options?.units ?? 30));

    return this.makeRequest<BitlyClicksResponse>(
      'GET',
      `/bitlinks/${encodedId}/clicks?${params.toString()}`
    );
  }

  /**
   * Get country metrics for a link
   */
  async getCountries(linkId: string, options?: {
    unit?: 'minute' | 'hour' | 'day' | 'week' | 'month';
    units?: number;
  }): Promise<BitlyCountriesResponse> {
    const encodedId = encodeURIComponent(linkId);
    const params = new URLSearchParams();
    
    params.set('unit', options?.unit ?? 'day');
    params.set('units', String(options?.units ?? 30));

    return this.makeRequest<BitlyCountriesResponse>(
      'GET',
      `/bitlinks/${encodedId}/countries?${params.toString()}`
    );
  }

  /**
   * Get QR code URL from Bitly
   */
  async getBitlyQRCode(linkId: string): Promise<string> {
    const encodedId = encodeURIComponent(linkId);
    const response = await this.makeRequest<{ qr_code: string }>(
      'GET',
      `/bitlinks/${encodedId}/qr`
    );
    return response.qr_code;
  }

  // ============================================================================
  // API Helpers
  // ============================================================================

  /**
   * Make API request to Bitly
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
      const errorData = await response.json().catch(() => ({ message: response.statusText })) as { message?: string; description?: string };
      throw new Error(`Bitly API error: ${errorData.message ?? errorData.description ?? response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Map Bitly link to ShortLink
   */
  private mapBitlyLink(
    bitlyLink: BitlyLink,
    context?: LinkContext,
    expiresAt?: Date,
    qrCodes?: { qrCodeSvg?: string; qrCodeDataUrl?: string; qrCodeUrl?: string }
  ): ShortLink {
    // Extract domain and key from link
    const linkUrl = new URL(bitlyLink.link);
    const domain = linkUrl.hostname;
    const key = linkUrl.pathname.substring(1);

    return {
      id: bitlyLink.id,
      shortUrl: bitlyLink.link,
      originalUrl: bitlyLink.long_url,
      domain,
      key,
      qrCodeUrl: qrCodes?.qrCodeUrl,
      qrCodeSvg: qrCodes?.qrCodeSvg,
      qrCodeDataUrl: qrCodes?.qrCodeDataUrl,
      expiresAt,
      createdAt: new Date(bitlyLink.created_at),
      context,
      analyticsUrl: `https://app.bitly.com/Bl6rPzIl2mA/bitlinks/${encodeURIComponent(bitlyLink.id)}`,
      metadata: {
        title: bitlyLink.title,
        tags: bitlyLink.tags,
        archived: bitlyLink.archived,
      },
    };
  }
}


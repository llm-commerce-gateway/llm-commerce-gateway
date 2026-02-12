/**
 * @betterdata/llm-gateway CLI - Registry API Client
 * 
 * Client for registry API operations (register, verify, claim-gtins)
 * 
 * @license MIT
 */

// ============================================================================
// Types
// ============================================================================

export interface RegisterGatewayRequest {
  brand_name: string;
  domain: string;
  endpoint: string;
  protocol: 'mcp' | 'rest' | 'openapi' | 'graphql';
  capabilities: {
    catalog_search: boolean;
    pricing: 'public' | 'private' | false;
    inventory: 'real_time' | 'cached' | false;
    checkout: boolean;
  };
  auth?: {
    type: 'none' | 'api_key' | 'oauth2' | 'bearer';
    [key: string]: unknown;
  };
  aliases?: string[];
  categories?: string[];
}

export interface RegisterGatewayResponse {
  id: string;
  slug: string;
  status: 'pending' | 'active' | 'suspended' | 'unhealthy';
  verification: {
    dns_txt: {
      record: string;
      value: string;
    };
    well_known: {
      url: string;
      content: {
        token: string;
      };
    };
  };
  message: string;
}

export interface VerifyGatewayResponse {
  verified: boolean;
  method?: 'dns_txt' | 'well_known';
  status?: 'pending' | 'active' | 'suspended' | 'unhealthy';
  message: string;
  expected_token_prefix?: string;
  checked?: {
    dns_txt: boolean;
    well_known: boolean;
  };
}

export interface ClaimGTINsRequest {
  gs1_prefix?: {
    prefix: string;
    proof: 'gs1_certificate' | 'brand_attestation' | 'self_declared';
    proof_url?: string;
  };
  gtins?: Array<{
    gtin: string;
    product_name?: string;
    role: 'manufacturer' | 'reseller';
  }>;
}

export interface ClaimGTINsResponse {
  claimed: Array<{
    type: 'prefix' | 'gtin';
    prefix?: string;
    gtin?: string;
    role?: string;
    verified?: boolean;
  }>;
  conflicts: Array<{
    type: 'gtin';
    gtin: string;
    claimed_by: string;
    dispute_url: string;
  }>;
}

// ============================================================================
// Registry Client
// ============================================================================

export class RegistryAPIClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl = config.baseUrl ?? 'https://registry.betterdata.co';
    this.apiKey = config.apiKey ?? process.env.BETTERDATA_API_KEY;
  }

  /**
   * Register a new gateway
   */
  async registerGateway(data: RegisterGatewayRequest): Promise<RegisterGatewayResponse> {
    const response = await this.request('POST', '/api/gateways', data);
    return response as RegisterGatewayResponse;
  }

  /**
   * Verify domain ownership
   */
  async verifyGateway(gatewayId: string): Promise<VerifyGatewayResponse> {
    const response = await this.request('POST', `/api/gateways/${gatewayId}/verify`);
    return response as VerifyGatewayResponse;
  }

  /**
   * Claim GTINs
   */
  async claimGTINs(gatewayId: string, data: ClaimGTINsRequest): Promise<ClaimGTINsResponse> {
    const response = await this.request('POST', `/api/gateways/${gatewayId}/gtins`, data);
    return response as ClaimGTINsResponse;
  }

  /**
   * Get gateway status
   */
  async getGatewayStatus(gatewayId: string): Promise<{
    id: string;
    slug: string;
    status: string;
    domain_verified: boolean;
    brand_verified: boolean;
    trust_score: number;
  }> {
    const response = await this.request('GET', `/api/gateways/${gatewayId}`);
    return response as any;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMessage = `Registry API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        if (errorBody) {
          errorMessage = errorBody;
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }
}


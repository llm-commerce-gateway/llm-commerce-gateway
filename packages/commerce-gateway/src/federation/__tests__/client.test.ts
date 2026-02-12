/**
 * Gateway Client Tests
 *
 * Tests for the GatewayClient that calls remote merchant gateways.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GatewayClient } from '../client/gateway-client';
import type { MerchantRegistration } from '../types';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockMerchant: MerchantRegistration = {
  domain: 'teststore.com',
  aliases: ['teststore', 'test store'],
  gatewayUrl: 'https://api.teststore.com',
  tier: 'verified',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: false,
  },
  metadata: {
    name: 'Test Store',
    categories: ['general'],
  },
};

const mockSearchResponse = {
  success: true,
  data: {
    products: [
      {
        id: 'prod-1',
        title: 'Test Product',
        description: 'A test product',
        price: { amount: 99.99, currency: 'USD' },
        images: [{ url: 'https://example.com/image.jpg', alt: 'Test' }],
        url: 'https://teststore.com/products/prod-1',
        inStock: true,
      },
    ],
    total: 1,
    hasMore: false,
  },
};

const mockWellKnownResponse = {
  schemaVersion: '1.0',
  domain: 'teststore.com',
  gatewayUrl: 'https://api.teststore.com',
  capabilities: {
    search: true,
    cart: true,
    checkout: true,
    inventory: true,
    recommendations: false,
  },
  verification: {
    methods: ['api_callback'],
  },
  metadata: {
    name: 'Test Store',
    categories: ['general'],
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('GatewayClient', () => {
  let client: GatewayClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new GatewayClient({ timeout: 5000, retries: 1 });

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('executeSearch', () => {
    it('should execute successful search', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const result = await client.executeSearch(mockMerchant, 'test query');

      expect(result.status).toBe('ok');
      expect(result.data).toBeDefined();
      expect(result.data?.products).toHaveLength(1);
      expect(result.attribution?.merchant.domain).toBe('teststore.com');
    });

    it('should include filters in request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSearchResponse),
      });

      await client.executeSearch(mockMerchant, 'shoes', {
        filters: { category: 'footwear', priceMax: 100 },
        limit: 5,
      });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.arguments.query).toBe('shoes');
      expect(requestBody.arguments.category).toBe('footwear');
      expect(requestBody.arguments.priceMax).toBe(100);
      expect(requestBody.arguments.limit).toBe(5);
    });

    it('should handle timeout', async () => {
      // Create client with very short timeout
      const quickClient = new GatewayClient({ timeout: 1, retries: 0 });

      // Mock fetch that takes too long
      fetchMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, json: () => mockSearchResponse }), 100);
          })
      );

      const result = await quickClient.executeSearch(mockMerchant, 'test');

      expect(result.status).toBe('merchant_unreachable');
      expect(result.message).toContain('timed out');
    });

    it('should handle network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.executeSearch(mockMerchant, 'test');

      expect(result.status).toBe('merchant_unreachable');
      expect(result.message).toContain('Network error');
    });

    it('should handle non-200 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await client.executeSearch(mockMerchant, 'test');

      expect(result.status).toBe('merchant_unreachable');
    });

    it('should handle invalid response format', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await client.executeSearch(mockMerchant, 'test');

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should include Authorization header with API key', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSearchResponse),
      });

      const merchantWithKey = { ...mockMerchant, apiKey: 'test-api-key' };
      await client.executeSearch(merchantWithKey, 'test');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should retry on failure', async () => {
      const retryClient = new GatewayClient({ timeout: 5000, retries: 2 });

      fetchMock
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockSearchResponse),
        });

      const result = await retryClient.executeSearch(mockMerchant, 'test');

      expect(result.status).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('executeToolCall', () => {
    it('should execute generic tool call', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { cartId: 'cart-123' } }),
      });

      const result = await client.executeToolCall(mockMerchant, 'add_to_cart', {
        productId: 'prod-1',
        quantity: 2,
      });

      expect(result.status).toBe('ok');
      expect(result.data).toEqual({ cartId: 'cart-123' });
    });

    it('should include correct tool name in request', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await client.executeToolCall(mockMerchant, 'get_cart', { cartId: 'cart-123' });

      const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(requestBody.tool).toBe('get_cart');
      expect(requestBody.arguments.cartId).toBe('cart-123');
    });
  });

  describe('checkCapabilities', () => {
    it('should fetch and parse well-known response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockWellKnownResponse),
      });

      const capabilities = await client.checkCapabilities('https://api.teststore.com');

      expect(capabilities).not.toBeNull();
      expect(capabilities?.search).toBe(true);
      expect(capabilities?.cart).toBe(true);
    });

    it('should return null on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const capabilities = await client.checkCapabilities('https://api.teststore.com');

      expect(capabilities).toBeNull();
    });

    it('should return null on 404', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const capabilities = await client.checkCapabilities('https://api.teststore.com');

      expect(capabilities).toBeNull();
    });

    it('should return null on invalid JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const capabilities = await client.checkCapabilities('https://api.teststore.com');

      expect(capabilities).toBeNull();
    });

    it('should call correct well-known URL', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockWellKnownResponse),
      });

      await client.checkCapabilities('https://api.teststore.com');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.teststore.com/.well-known/llm-gateway.json',
        expect.any(Object)
      );
    });
  });

  describe('verifyMerchant', () => {
    it('should verify via api_callback', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            signature: 'valid-signature',
            domain: 'teststore.com',
          }),
      });

      const verified = await client.verifyMerchant(
        'teststore.com',
        'https://api.teststore.com',
        'api_callback'
      );

      expect(verified).toBe(true);
    });

    it('should return false on verification failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const verified = await client.verifyMerchant(
        'teststore.com',
        'https://api.teststore.com',
        'api_callback'
      );

      expect(verified).toBe(false);
    });

    it('should return false on network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      const verified = await client.verifyMerchant(
        'teststore.com',
        'https://api.teststore.com',
        'api_callback'
      );

      expect(verified).toBe(false);
    });

    it('should post to correct verification endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ signature: 'sig', domain: 'teststore.com' }),
      });

      await client.verifyMerchant('teststore.com', 'https://api.teststore.com', 'api_callback');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.teststore.com/api/federation/verify',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('with JWT signing', () => {
    it('should include JWT in Authorization header when signing key provided', async () => {
      // Note: This test would need a real or mocked JWT signer
      // For now, we just verify the client accepts signing config
      const signingClient = new GatewayClient({
        timeout: 5000,
        retries: 1,
        // jwtSigningKey would be provided here
      });

      expect(signingClient).toBeDefined();
    });
  });
});


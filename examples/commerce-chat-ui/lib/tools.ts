import { formatGatewayQueryMessage } from './format-gateway-query';
import type { ProductResult } from './parse-tool-results';
import { queryGateway } from './gateway';

/**
 * Commerce tools the LLM can call. All routes flow into one gateway query.
 *
 * The tool names match the Commerce Gateway MCP conventions — if you
 * swap in a different LLM, the gateway shape stays the same.
 */

export const COMMERCE_TOOL_NAMES = [
  'shop',
  'search_products',
  'check_availability',
  'price_check',
] as const;

export type CommerceToolName = (typeof COMMERCE_TOOL_NAMES)[number];

function buildGatewayQuery(
  name: CommerceToolName,
  args: Record<string, unknown>,
): string {
  const q = (k: string) => String(args[k] ?? '').trim();
  switch (name) {
    case 'shop':
      return `@shop ${q('query')}`;
    case 'search_products':
      return q('query') || 'search products';
    case 'check_availability':
      return `Check availability for SKU or product: ${
        q('sku') || q('product_id') || q('query')
      }`;
    case 'price_check':
      return `Price check for: ${q('sku') || q('product_id') || q('query')}`;
    default:
      return q('query') || JSON.stringify(args);
  }
}

export type ToolCallRecord = {
  name: string;
  args: Record<string, unknown>;
  query: string;
  productsFound: number;
};

export async function runCommerceTool(
  name: string,
  argsJson: string,
): Promise<{
  text: string;
  products: ProductResult[];
  trace: ToolCallRecord;
}> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    args = {};
  }

  const toolName = COMMERCE_TOOL_NAMES.includes(name as CommerceToolName)
    ? (name as CommerceToolName)
    : 'search_products';

  const gatewayQuery = buildGatewayQuery(toolName, args);
  const payload = await queryGateway(gatewayQuery);
  const { content, products } = formatGatewayQueryMessage(payload);

  return {
    text: `[${name}] ${content}`,
    products,
    trace: {
      name,
      args,
      query: gatewayQuery,
      productsFound: products.length,
    },
  };
}

/** Anthropic Messages API tool definitions */
export const anthropicCommerceTools = [
  {
    name: 'shop',
    description:
      'Use when the user says @shop, names a brand, or asks to shop/buy/find products. Pass the full @shop-style query.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'e.g. "Nike", "@shop Adidas ultraboost", or a GTIN',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_products',
    description: 'Natural-language product search (no @shop prefix required).',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_availability',
    description: 'Check whether a product or SKU is in stock / available.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sku: { type: 'string' },
        product_id: { type: 'string' },
        query: { type: 'string' },
      },
    },
  },
  {
    name: 'price_check',
    description: 'Get current price for a product or SKU.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sku: { type: 'string' },
        product_id: { type: 'string' },
        query: { type: 'string' },
      },
    },
  },
];

/** OpenAI-compatible tool schema (OpenAI + xAI share this shape). */
export const openaiCommerceTools = [
  {
    type: 'function' as const,
    function: {
      name: 'shop',
      description:
        'Use when the user says @shop, names a brand, or asks to shop/buy/find products.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'e.g. "Nike" or "@shop Adidas"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_products',
      description: 'Natural-language product search.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_availability',
      description: 'Check product availability.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          product_id: { type: 'string' },
          query: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'price_check',
      description: 'Check current price.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          product_id: { type: 'string' },
          query: { type: 'string' },
        },
      },
    },
  },
];

export const COMMERCE_SYSTEM_PROMPT = `You are a helpful shopping assistant powered by Commerce Gateway.
You have tools that query a live product catalog through a single gateway endpoint.

When the user says "@shop {brand}" or asks to find, buy, search, or browse products,
call shop or search_products. After tool results, answer in natural language and
summarize what you found.

Examples:
- "@shop Nike" → shop with query "@shop Nike" or "Nike"
- "Running shoes under $100" → search_products`;

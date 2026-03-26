/**
 * @betterdata/commerce-gateway - MCP Prompts
 * 
 * Pre-built prompt templates that help Claude understand
 * how to assist customers effectively.
 * 
 * @license Apache-2.0
 */

import type {
  MCPPrompt,
  MCPPromptMessage,
} from '../types';

// ============================================================================
// Built-in Prompts
// ============================================================================

export const BUILT_IN_PROMPTS: MCPPrompt[] = [
  {
    name: 'shopping_assistant',
    description: 'Start a helpful shopping conversation with product discovery focus',
    arguments: [
      {
        name: 'customer_name',
        description: 'Customer name for personalized greeting',
        required: false,
      },
      {
        name: 'context',
        description: 'Optional context about what the customer is looking for',
        required: false,
      },
    ],
  },
  {
    name: 'product_comparison',
    description: 'Compare two or more products to help customer decide',
    arguments: [
      {
        name: 'product_ids',
        description: 'Comma-separated product IDs to compare',
        required: true,
      },
    ],
  },
  {
    name: 'gift_finder',
    description: 'Help find the perfect gift based on recipient and occasion',
    arguments: [
      {
        name: 'recipient',
        description: 'Who the gift is for (e.g., "mom", "friend", "colleague")',
        required: true,
      },
      {
        name: 'occasion',
        description: 'The occasion (e.g., "birthday", "anniversary", "holiday")',
        required: false,
      },
      {
        name: 'budget',
        description: 'Budget range (e.g., "under $50", "$50-100")',
        required: false,
      },
    ],
  },
  {
    name: 'checkout_help',
    description: 'Guide customer through the checkout process',
    arguments: [],
  },
  {
    name: 'order_status',
    description: 'Help customer check on an existing order',
    arguments: [
      {
        name: 'order_number',
        description: 'The order number to look up',
        required: false,
      },
    ],
  },
  {
    name: 'reorder',
    description: 'Help customer reorder previously purchased items',
    arguments: [],
  },
];

// ============================================================================
// Prompt Message Generators
// ============================================================================

export function generatePromptMessages(
  promptName: string,
  args: Record<string, string>
): MCPPromptMessage[] {
  switch (promptName) {
    case 'shopping_assistant':
      return generateShoppingAssistantPrompt(args);
    case 'product_comparison':
      return generateProductComparisonPrompt(args);
    case 'gift_finder':
      return generateGiftFinderPrompt(args);
    case 'checkout_help':
      return generateCheckoutHelpPrompt(args);
    case 'order_status':
      return generateOrderStatusPrompt(args);
    case 'reorder':
      return generateReorderPrompt(args);
    default:
      return [{
        role: 'user',
        content: { type: 'text', text: 'Please help me.' },
      }];
  }
}

function generateShoppingAssistantPrompt(
  args: Record<string, string>
): MCPPromptMessage[] {
  const name = args.customer_name || 'there';
  const context = args.context || '';
  
  const greeting = context
    ? `Hi ${name}! I understand you're looking for ${context}. I'd love to help you find exactly what you need.`
    : `Hi ${name}! I'm your personal shopping assistant. What brings you in today?`;

  return [
    {
      role: 'assistant',
      content: {
        type: 'text',
        text: `${greeting}

I can help you with:
• **Finding products** - Tell me what you're looking for in your own words
• **Comparing options** - I'll help you weigh the pros and cons
• **Checking availability** - Real-time stock information
• **Getting recommendations** - Based on your preferences
• **Completing your purchase** - Easy checkout assistance

What would you like to explore?`,
      },
    },
  ];
}

function generateProductComparisonPrompt(
  args: Record<string, string>
): MCPPromptMessage[] {
  const productIds = args.product_ids || '';
  
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Please compare these products for me: ${productIds}

I'd like to understand:
- Key differences between them
- Which one offers better value
- Pros and cons of each
- Your recommendation based on common use cases`,
      },
    },
  ];
}

function generateGiftFinderPrompt(
  args: Record<string, string>
): MCPPromptMessage[] {
  const recipient = args.recipient || 'someone special';
  const occasion = args.occasion || 'a special occasion';
  const budget = args.budget || '';
  
  const budgetText = budget ? ` My budget is ${budget}.` : '';
  
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `I need help finding a gift for ${recipient} for ${occasion}.${budgetText}

Can you suggest some thoughtful options?`,
      },
    },
    {
      role: 'assistant',
      content: {
        type: 'text',
        text: `I'd love to help you find the perfect gift for ${recipient}! Let me search for some great options.

To give you the best suggestions, it would help to know:
- What are their interests or hobbies?
- Any specific style preferences?
- Should I focus on practical items, experiences, or something indulgent?

In the meantime, let me show you some popular gift ideas...`,
      },
    },
  ];
}

function generateCheckoutHelpPrompt(
  _args: Record<string, string>
): MCPPromptMessage[] {
  return [
    {
      role: 'assistant',
      content: {
        type: 'text',
        text: `I'm here to help you complete your purchase! 🛒

Let me check your cart and guide you through checkout. Here's what we'll do:

1. **Review your cart** - Make sure everything looks right
2. **Shipping information** - Where should we send your order?
3. **Payment** - Secure checkout options
4. **Confirmation** - You'll get an order number and tracking info

Ready to get started? Let me pull up your cart.`,
      },
    },
  ];
}

function generateOrderStatusPrompt(
  args: Record<string, string>
): MCPPromptMessage[] {
  const orderNumber = args.order_number;
  
  if (orderNumber) {
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Can you check the status of my order? The order number is ${orderNumber}.`,
        },
      },
    ];
  }
  
  return [
    {
      role: 'assistant',
      content: {
        type: 'text',
        text: `I can help you check on your order! 📦

Do you have your order number handy? It should be in your confirmation email and starts with something like "ORD-" followed by letters and numbers.

If you don't have it, I can try to look it up using:
- Your email address
- The approximate date you ordered

How would you like to proceed?`,
      },
    },
  ];
}

function generateReorderPrompt(
  _args: Record<string, string>
): MCPPromptMessage[] {
  return [
    {
      role: 'assistant',
      content: {
        type: 'text',
        text: `Want to reorder something you've bought before? I can help with that! 🔄

I can:
- Look up your order history
- Add previously purchased items to your cart
- Check if there are any updates or new versions

Would you like me to show you your recent orders, or do you remember what you'd like to reorder?`,
      },
    },
  ];
}

// ============================================================================
// Get Prompts
// ============================================================================

/**
 * Get all available prompts
 */
export function getPrompts(): MCPPrompt[] {
  return BUILT_IN_PROMPTS;
}

/**
 * Get a specific prompt by name
 */
export function getPrompt(name: string): MCPPrompt | undefined {
  return BUILT_IN_PROMPTS.find(p => p.name === name);
}

/**
 * Execute a prompt and get its messages
 */
export function executePrompt(
  name: string,
  args: Record<string, string>
): { messages: MCPPromptMessage[] } | null {
  const prompt = getPrompt(name);
  if (!prompt) {
    return null;
  }
  
  return {
    messages: generatePromptMessages(name, args),
  };
}


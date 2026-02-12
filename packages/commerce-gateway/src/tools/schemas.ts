import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export const PriceRangeSchema = z.object({
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
});

// ============================================================================
// Search Products Schema
// ============================================================================

export const SearchProductsInputSchema = z.object({
  query: z.string().min(1).max(500).describe('Natural language search query for products'),
  filters: z
    .object({
      category: z.string().optional().describe('Product category to filter by'),
      priceRange: PriceRangeSchema.optional().describe('Price range filter'),
      inStock: z.boolean().optional().describe('Filter to only show in-stock items'),
      tags: z.array(z.string()).optional().describe('Product tags to filter by'),
      brand: z.string().optional().describe('Brand name to filter by'),
      hairType: z.string().optional().describe('Hair type compatibility filter'),
      concerns: z.array(z.string()).optional().describe('Hair/skin concerns to address'),
    })
    .optional(),
  pagination: PaginationSchema.optional(),
  sortBy: z
    .enum(['relevance', 'price_asc', 'price_desc', 'rating', 'newest', 'popularity'])
    .default('relevance')
    .describe('Sort order for results'),
});

export type SearchProductsInput = z.infer<typeof SearchProductsInputSchema>;

export const SearchProductsOutputSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      description: z.string(),
      shortDescription: z.string().optional(),
      price: z.object({
        amount: z.number(),
        currency: z.string(),
        compareAtPrice: z.number().optional(),
      }),
      images: z.array(
        z.object({
          url: z.string(),
          alt: z.string().optional(),
        })
      ),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      rating: z
        .object({
          average: z.number(),
          count: z.number(),
        })
        .optional(),
      availability: z.object({
        inStock: z.boolean(),
        quantity: z.number().optional(),
        leadTime: z.string().optional(),
      }),
      relevanceScore: z.number().optional(),
    })
  ),
  totalCount: z.number(),
  hasMore: z.boolean(),
  facets: z
    .object({
      categories: z.array(z.object({ name: z.string(), count: z.number() })).optional(),
      priceRanges: z.array(z.object({ label: z.string(), min: z.number(), max: z.number(), count: z.number() })).optional(),
      tags: z.array(z.object({ name: z.string(), count: z.number() })).optional(),
    })
    .optional(),
});

export type SearchProductsOutput = z.infer<typeof SearchProductsOutputSchema>;

// ============================================================================
// Get Product Details Schema
// ============================================================================

export const GetProductDetailsInputSchema = z.object({
  productId: z.string().describe('Product ID or slug to retrieve details for'),
  includeVariants: z.boolean().default(true).describe('Include product variants'),
  includeRelated: z.boolean().default(false).describe('Include related products'),
  includeInventory: z.boolean().default(true).describe('Include real-time inventory data'),
});

export type GetProductDetailsInput = z.infer<typeof GetProductDetailsInputSchema>;

export const GetProductDetailsOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  description: z.string(),
  shortDescription: z.string().optional(),
  price: z.object({
    amount: z.number(),
    currency: z.string(),
    compareAtPrice: z.number().optional(),
  }),
  images: z.array(
    z.object({
      url: z.string(),
      alt: z.string().optional(),
    })
  ),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rating: z
    .object({
      average: z.number(),
      count: z.number(),
    })
    .optional(),
  availability: z.object({
    inStock: z.boolean(),
    quantity: z.number().optional(),
    leadTime: z.string().optional(),
  }),
  variants: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        sku: z.string(),
        price: z.object({
          amount: z.number(),
          currency: z.string(),
        }),
        attributes: z.record(z.string()),
        availability: z.object({
          inStock: z.boolean(),
          quantity: z.number().optional(),
        }),
      })
    )
    .optional(),
  attributes: z.record(z.union([z.string(), z.array(z.string())])),
  ingredients: z.array(z.string()).optional(),
  usage: z.string().optional(),
  benefits: z.array(z.string()).optional(),
  relatedProducts: z.array(z.string()).optional(),
});

export type GetProductDetailsOutput = z.infer<typeof GetProductDetailsOutputSchema>;

// ============================================================================
// Add to Cart Schema
// ============================================================================

export const AddToCartInputSchema = z.object({
  productId: z.string().describe('Product ID to add to cart'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().min(1).max(99).default(1).describe('Quantity to add'),
  reserveInventory: z.boolean().default(true).describe('Reserve inventory for this item'),
  reserveDurationMinutes: z.number().min(5).max(60).default(15).describe('How long to reserve inventory'),
});

export type AddToCartInput = z.infer<typeof AddToCartInputSchema>;

export const AddToCartOutputSchema = z.object({
  cartId: z.string(),
  item: z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
  }),
  cart: z.object({
    itemCount: z.number(),
    subtotal: z.number(),
    currency: z.string(),
    reservedUntil: z.string().optional(),
  }),
  checkoutUrl: z.string().optional(),
  message: z.string(),
});

export type AddToCartOutput = z.infer<typeof AddToCartOutputSchema>;

// ============================================================================
// Check Inventory Schema
// ============================================================================

export const CheckInventoryInputSchema = z.object({
  productId: z.string().describe('Product ID to check inventory for'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  locationId: z.string().optional().describe('Specific location to check'),
  quantity: z.number().min(1).default(1).describe('Quantity needed'),
});

export type CheckInventoryInput = z.infer<typeof CheckInventoryInputSchema>;

/**
 * Lot/expiry information for inventory.
 *
 * 🟡 EXPERIMENTAL: Only included when ENABLE_LOT_EXPIRY feature flag is enabled.
 * @see docs/contracts/llm-gateway-release-contract.md
 */
export const LotExpiryInfoSchema = z.object({
  /** Lot/batch number */
  lotNumber: z.string().optional(),
  /** Product expiration date (ISO 8601) */
  expiryDate: z.string().optional(),
  /** Manufacturing date (ISO 8601) */
  manufacturingDate: z.string().optional(),
  /** Days until expiry */
  daysUntilExpiry: z.number().optional(),
});

export type LotExpiryInfo = z.infer<typeof LotExpiryInfoSchema>;

export const CheckInventoryOutputSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  availability: z.object({
    inStock: z.boolean(),
    quantityAvailable: z.number(),
    canFulfill: z.boolean(),
    message: z.string(),
  }),
  locations: z
    .array(
      z.object({
        locationId: z.string(),
        locationName: z.string(),
        quantityAvailable: z.number(),
        leadTimeDays: z.number().optional(),
        /**
         * 🟡 EXPERIMENTAL: Only included when ENABLE_LOT_EXPIRY is enabled.
         */
        lotExpiry: LotExpiryInfoSchema.optional(),
      })
    )
    .optional(),
  alternatives: z
    .array(
      z.object({
        variantId: z.string(),
        variantName: z.string(),
        quantityAvailable: z.number(),
      })
    )
    .optional(),
  /**
   * 🟡 EXPERIMENTAL: Only included when ENABLE_LOT_EXPIRY feature flag is enabled.
   * Contains lot/batch and expiry information.
   */
  lotExpiry: LotExpiryInfoSchema.optional(),
});

export type CheckInventoryOutput = z.infer<typeof CheckInventoryOutputSchema>;

// ============================================================================
// Check Availability Schema (Buyer-safe)
// ============================================================================

export const CheckAvailabilityInputSchema = z.object({
  productId: z.string().describe('Product ID to check availability for'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().min(1).default(1).describe('Quantity needed'),
});

export type CheckAvailabilityInput = z.infer<typeof CheckAvailabilityInputSchema>;

export const CheckAvailabilityOutputSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  availability: z.object({
    available: z.boolean(),
    message: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  delivery: z
    .object({
      estimate: z.string().optional(),
      minDays: z.number().optional(),
      maxDays: z.number().optional(),
    })
    .optional(),
});

export type CheckAvailabilityOutput = z.infer<typeof CheckAvailabilityOutputSchema>;

// ============================================================================
// Get Recommendations Schema
// ============================================================================

export const GetRecommendationsInputSchema = z.object({
  productIds: z.array(z.string()).optional().describe('Product IDs to base recommendations on'),
  context: z
    .object({
      hairType: z.string().optional().describe('User hair type'),
      skinType: z.string().optional().describe('User skin type'),
      concerns: z.array(z.string()).optional().describe('Hair/skin concerns'),
      budget: z.enum(['low', 'medium', 'high']).optional().describe('Budget preference'),
      occasion: z.string().optional().describe('Occasion or use case'),
    })
    .optional(),
  strategy: z
    .enum(['similar', 'complementary', 'trending', 'personalized', 'bundle'])
    .default('personalized')
    .describe('Recommendation strategy'),
  limit: z.number().min(1).max(20).default(5).describe('Number of recommendations'),
});

export type GetRecommendationsInput = z.infer<typeof GetRecommendationsInputSchema>;

export const GetRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      product: z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        description: z.string(),
        price: z.object({
          amount: z.number(),
          currency: z.string(),
        }),
        images: z.array(
          z.object({
            url: z.string(),
            alt: z.string().optional(),
          })
        ),
        availability: z.object({
          inStock: z.boolean(),
          quantity: z.number().optional(),
        }),
      }),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
      strategy: z.string(),
    })
  ),
  totalAvailable: z.number(),
});

export type GetRecommendationsOutput = z.infer<typeof GetRecommendationsOutputSchema>;

// ============================================================================
// Create Order Schema
// ============================================================================

export const CreateOrderInputSchema = z.object({
  cartId: z.string().describe('Cart ID to convert to order'),
  shippingAddress: z.object({
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().optional(),
    address1: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string(),
    phone: z.string().optional(),
  }),
  billingAddress: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      company: z.string().optional(),
      address1: z.string(),
      address2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string(),
      phone: z.string().optional(),
    })
    .optional(),
  paymentMethod: z.string().describe('Payment method identifier'),
  notes: z.string().optional().describe('Order notes'),
  giftMessage: z.string().optional().describe('Gift message if this is a gift'),
  isGift: z.boolean().default(false).describe('Whether this is a gift order'),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const CreateOrderOutputSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  total: z.object({
    subtotal: z.number(),
    shipping: z.number(),
    tax: z.number(),
    total: z.number(),
    currency: z.string(),
  }),
  estimatedDelivery: z.string().optional(),
  trackingUrl: z.string().optional(),
  confirmationUrl: z.string(),
});

export type CreateOrderOutput = z.infer<typeof CreateOrderOutputSchema>;

// ============================================================================
// Get Cart Schema
// ============================================================================

export const GetCartInputSchema = z.object({
  cartId: z.string().optional().describe('Cart ID to retrieve, uses session cart if not provided'),
});

export type GetCartInput = z.infer<typeof GetCartInputSchema>;

export const GetCartOutputSchema = z.object({
  cartId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      variantId: z.string().optional(),
      name: z.string(),
      sku: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      totalPrice: z.number(),
      image: z.string().optional(),
      availability: z.object({
        inStock: z.boolean(),
        quantityAvailable: z.number(),
      }),
    })
  ),
  subtotal: z.number(),
  itemCount: z.number(),
  currency: z.string(),
  reservedUntil: z.string().optional(),
  checkoutUrl: z.string(),
});

export type GetCartOutput = z.infer<typeof GetCartOutputSchema>;

// ============================================================================
// Remove from Cart Schema
// ============================================================================

export const RemoveFromCartInputSchema = z.object({
  productId: z.string().describe('Product ID to remove'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
});

export type RemoveFromCartInput = z.infer<typeof RemoveFromCartInputSchema>;

export const RemoveFromCartOutputSchema = z.object({
  success: z.boolean(),
  cart: z.object({
    itemCount: z.number(),
    subtotal: z.number(),
    currency: z.string(),
  }),
  message: z.string(),
});

export type RemoveFromCartOutput = z.infer<typeof RemoveFromCartOutputSchema>;

// ============================================================================
// Update Cart Item Schema
// ============================================================================

export const UpdateCartItemInputSchema = z.object({
  productId: z.string().describe('Product ID to update'),
  variantId: z.string().optional().describe('Variant ID if applicable'),
  quantity: z.number().min(0).max(99).describe('New quantity (0 to remove)'),
});

export type UpdateCartItemInput = z.infer<typeof UpdateCartItemInputSchema>;

export const UpdateCartItemOutputSchema = z.object({
  success: z.boolean(),
  item: z
    .object({
      productId: z.string(),
      variantId: z.string().optional(),
      name: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      totalPrice: z.number(),
    })
    .optional(),
  cart: z.object({
    itemCount: z.number(),
    subtotal: z.number(),
    currency: z.string(),
  }),
  message: z.string(),
});

export type UpdateCartItemOutput = z.infer<typeof UpdateCartItemOutputSchema>;

// ============================================================================
// Get Usage Instructions Schema
// ============================================================================

export const GetUsageInstructionsInputSchema = z.object({
  productId: z.string().describe('Product ID to get usage instructions for'),
  context: z
    .object({
      hairType: z.string().optional(),
      concerns: z.array(z.string()).optional(),
      frequency: z.enum(['daily', 'weekly', 'as_needed']).optional(),
    })
    .optional(),
});

export type GetUsageInstructionsInput = z.infer<typeof GetUsageInstructionsInputSchema>;

export const GetUsageInstructionsOutputSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  instructions: z.object({
    steps: z.array(
      z.object({
        step: z.number(),
        instruction: z.string(),
        tip: z.string().optional(),
      })
    ),
    frequency: z.string(),
    duration: z.string().optional(),
    warnings: z.array(z.string()).optional(),
  }),
  tips: z.array(z.string()).optional(),
  complementaryProducts: z.array(z.string()).optional(),
});

export type GetUsageInstructionsOutput = z.infer<typeof GetUsageInstructionsOutputSchema>;

// ============================================================================
// All Tool Schemas Export
// ============================================================================

export const ToolSchemas = {
  search_products: {
    input: SearchProductsInputSchema,
    output: SearchProductsOutputSchema,
  },
  get_product_details: {
    input: GetProductDetailsInputSchema,
    output: GetProductDetailsOutputSchema,
  },
  add_to_cart: {
    input: AddToCartInputSchema,
    output: AddToCartOutputSchema,
  },
  check_inventory: {
    input: CheckInventoryInputSchema,
    output: CheckInventoryOutputSchema,
  },
  check_availability: {
    input: CheckAvailabilityInputSchema,
    output: CheckAvailabilityOutputSchema,
  },
  get_recommendations: {
    input: GetRecommendationsInputSchema,
    output: GetRecommendationsOutputSchema,
  },
  create_order: {
    input: CreateOrderInputSchema,
    output: CreateOrderOutputSchema,
  },
  get_cart: {
    input: GetCartInputSchema,
    output: GetCartOutputSchema,
  },
  remove_from_cart: {
    input: RemoveFromCartInputSchema,
    output: RemoveFromCartOutputSchema,
  },
  update_cart_item: {
    input: UpdateCartItemInputSchema,
    output: UpdateCartItemOutputSchema,
  },
  get_usage_instructions: {
    input: GetUsageInstructionsInputSchema,
    output: GetUsageInstructionsOutputSchema,
  },
} as const;

export type ToolName = keyof typeof ToolSchemas;


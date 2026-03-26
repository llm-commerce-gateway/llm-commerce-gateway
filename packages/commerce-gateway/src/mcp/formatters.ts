/**
 * @betterdata/commerce-gateway - MCP Response Formatters
 * 
 * Formats data into rich markdown and structured content for Claude.
 * Provides consistent, beautiful output across all tools.
 * 
 * @license Apache-2.0
 */

import type { 
  Product, 
  Cart, 
  CartItem,
  Order, 
  InventoryStatus,
  Recommendation,
} from '../backends/interfaces';
import type { MCPContent, MCPTextContent, MCPImageContent } from './types';

// ============================================================================
// Product Formatters
// ============================================================================

/**
 * Format a single product as rich markdown
 */
export function formatProduct(product: Product, options?: {
  includeDetails?: boolean;
  linkUrl?: string;
}): MCPContent[] {
  const { includeDetails = false, linkUrl } = options ?? {};
  
  const price = `$${product.price.amount.toFixed(2)} ${product.price.currency}`;
  const comparePrice = product.price.compareAtPrice 
    ? `~~$${product.price.compareAtPrice.toFixed(2)}~~` 
    : '';
  
  const availability = product.availability?.inStock
    ? `✅ **In Stock**${product.availability.quantity ? ` (${product.availability.quantity} available)` : ''}`
    : '❌ **Out of Stock**';

  let markdown = `### ${product.name}\n\n`;
  
  // Price line
  if (comparePrice) {
    markdown += `**${price}** ${comparePrice}\n\n`;
  } else {
    markdown += `**${price}**\n\n`;
  }
  
  // Description
  if (product.description) {
    markdown += `${product.description}\n\n`;
  }
  
  // Availability
  markdown += `${availability}\n\n`;
  
  // Category and tags
  if (product.category || (product.tags && product.tags.length > 0)) {
    const categoryTag = product.category ? `**Category:** ${product.category}` : '';
    const tags = product.tags?.length ? `**Tags:** ${product.tags.join(', ')}` : '';
    markdown += [categoryTag, tags].filter(Boolean).join(' | ') + '\n\n';
  }
  
  // Link
  if (linkUrl) {
    markdown += `[View Product →](${linkUrl})\n\n`;
  }
  
  // Extended details
  if (includeDetails && product.variants && product.variants.length > 0) {
    markdown += '#### Variants\n\n';
    product.variants.forEach(v => {
      const variantPrice = v.price ? `$${v.price.amount.toFixed(2)}` : price;
      const variantAvail = v.availability?.inStock ? '✅' : '❌';
      markdown += `- **${v.name}** - ${variantPrice} ${variantAvail}\n`;
    });
    markdown += '\n';
  }
  
  const content: MCPContent[] = [
    { type: 'text', text: markdown } as MCPTextContent,
  ];
  
  // Add image if available
  if (product.images && product.images.length > 0) {
    const primaryImage = product.images[0];
    if (primaryImage?.url?.startsWith('data:')) {
      // For URLs, we embed as text with markdown image syntax
      // For base64, we'd use MCPImageContent
      const parts = primaryImage.url.split(';base64,');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const mimeMatch = parts[0];
        const data = parts[1];
        const mimeType = mimeMatch.replace('data:', '');
        content.unshift({ 
          type: 'image', 
          data, 
          mimeType 
        } as MCPImageContent);
      }
    }
  }
  
  return content;
}

/**
 * Format product search results
 */
export function formatProductList(
  products: Product[],
  options?: {
    title?: string;
    showCount?: boolean;
    total?: number;
    hasMore?: boolean;
  }
): MCPContent[] {
  const { title = 'Products Found', showCount = true, total, hasMore } = options ?? {};
  
  if (products.length === 0) {
    return [{
      type: 'text',
      text: `### ${title}\n\nNo products found matching your criteria. Try broadening your search or adjusting filters.`,
    }];
  }
  
  let markdown = `### ${title}\n\n`;
  
  if (showCount) {
    const countText = total !== undefined 
      ? `Showing ${products.length} of ${total} results`
      : `${products.length} product${products.length === 1 ? '' : 's'} found`;
    markdown += `*${countText}${hasMore ? ' (more available)' : ''}*\n\n`;
  }
  
  products.forEach((product, index) => {
    const price = `$${product.price.amount.toFixed(2)}`;
    const stock = product.availability?.inStock ? '✅' : '❌';
    
    markdown += `**${index + 1}. ${product.name}** - ${price} ${stock}\n`;
    if (product.description) {
      const shortDesc = product.description.length > 100 
        ? product.description.substring(0, 100) + '...'
        : product.description;
      markdown += `   ${shortDesc}\n`;
    }
    markdown += `   *ID: ${product.id}*\n\n`;
  });
  
  if (hasMore) {
    markdown += `---\n*More products available. Refine your search or ask to see more.*\n`;
  }
  
  return [{ type: 'text', text: markdown }];
}

// ============================================================================
// Cart Formatters
// ============================================================================

/**
 * Format cart contents
 */
export function formatCart(cart: Cart, options?: {
  showCheckoutLink?: boolean;
  checkoutUrl?: string;
}): MCPContent[] {
  const { showCheckoutLink = true, checkoutUrl } = options ?? {};
  
  if (cart.items.length === 0) {
    return [{
      type: 'text',
      text: `### 🛒 Your Cart\n\nYour cart is empty. Start shopping by searching for products!`,
    }];
  }
  
  let markdown = `### 🛒 Your Cart\n\n`;
  markdown += `**${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}**\n\n`;
  
  // Items table header
  markdown += '| Item | Qty | Price |\n';
  markdown += '|------|-----|-------|\n';
  
  cart.items.forEach(item => {
    const totalPrice = `$${item.totalPrice.toFixed(2)}`;
    markdown += `| ${item.name} | ${item.quantity} | ${totalPrice} |\n`;
  });
  
  markdown += '\n';
  
  // Totals
  markdown += '---\n\n';
  markdown += `**Subtotal:** $${cart.subtotal.toFixed(2)} ${cart.currency}\n\n`;
  
  // Reservation notice
  if (cart.reservedUntil) {
    const reservedDate = new Date(cart.reservedUntil);
    const minutesLeft = Math.round((reservedDate.getTime() - Date.now()) / 60000);
    if (minutesLeft > 0) {
      markdown += `⏱️ *Items reserved for ${minutesLeft} more minute${minutesLeft === 1 ? '' : 's'}*\n\n`;
    }
  }
  
  // Checkout link
  if (showCheckoutLink && checkoutUrl) {
    markdown += `[Proceed to Checkout →](${checkoutUrl})\n`;
  }
  
  return [{ type: 'text', text: markdown }];
}

/**
 * Format cart update confirmation
 */
export function formatCartUpdate(
  action: 'added' | 'updated' | 'removed',
  item: CartItem,
  cart: Cart
): MCPContent[] {
  const actionText = {
    added: `Added **${item.quantity}x ${item.name}** to your cart`,
    updated: `Updated **${item.name}** quantity to ${item.quantity}`,
    removed: `Removed **${item.name}** from your cart`,
  };
  
  let markdown = `### ✅ Cart Updated\n\n`;
  markdown += `${actionText[action]}\n\n`;
  markdown += `**Cart Total:** $${cart.subtotal.toFixed(2)} (${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'})\n`;
  
  return [{ type: 'text', text: markdown }];
}

// ============================================================================
// Inventory Formatters
// ============================================================================

/**
 * Format inventory status
 */
export function formatInventoryStatus(
  status: InventoryStatus,
  productName?: string
): MCPContent[] {
  const name = productName ?? status.productId;
  
  let markdown = `### 📦 Inventory Status: ${name}\n\n`;
  
  if (status.inStock) {
    markdown += `✅ **In Stock** - ${status.quantity} available\n\n`;
    
    if (status.quantity <= 10) {
      markdown += `⚠️ *Low stock - order soon to secure your items*\n\n`;
    } else {
      markdown += `Ships within 1-2 business days\n\n`;
    }
  } else {
    markdown += `❌ **Out of Stock**\n\n`;
    markdown += `We're restocking soon. Check back later or explore alternatives.\n\n`;
  }
  
  // Location-specific availability
  if (status.locations && status.locations.length > 0) {
    markdown += '#### Store Availability\n\n';
    status.locations.forEach(loc => {
      const locStock = loc.quantity > 0 ? `${loc.quantity} available` : 'Out of stock';
      const leadTime = loc.leadTimeDays ? ` (${loc.leadTimeDays} day shipping)` : '';
      markdown += `- **${loc.locationName}**: ${locStock}${leadTime}\n`;
    });
    markdown += '\n';
  }
  
  return [{ type: 'text', text: markdown }];
}

// ============================================================================
// Recommendations Formatters
// ============================================================================

/**
 * Format product recommendations
 */
export function formatRecommendations(
  recommendations: Recommendation[],
  options?: {
    title?: string;
    strategy?: string;
  }
): MCPContent[] {
  const { title, strategy } = options ?? {};
  
  if (recommendations.length === 0) {
    return [{
      type: 'text',
      text: `### Recommendations\n\nNo recommendations available at this time.`,
    }];
  }
  
  const strategyTitles: Record<string, string> = {
    similar: '✨ Similar Products You Might Like',
    complementary: '🎯 Complete Your Look',
    trending: '🔥 Trending Now',
    personalized: '💝 Picked Just For You',
    bundle: '💰 Better Together',
  };
  
  const heading = title ?? strategyTitles[strategy ?? 'personalized'] ?? 'Recommendations';
  
  let markdown = `### ${heading}\n\n`;
  
  recommendations.forEach((rec, index) => {
    const product = rec.product;
    const price = `$${product.price.amount.toFixed(2)}`;
    const stock = product.availability?.inStock ? '✅' : '❌';
    
    markdown += `**${index + 1}. ${product.name}** - ${price} ${stock}\n`;
    markdown += `   ${rec.reason}\n`;
    if (product.description) {
      const shortDesc = product.description.length > 80 
        ? product.description.substring(0, 80) + '...'
        : product.description;
      markdown += `   *${shortDesc}*\n`;
    }
    markdown += `   ID: \`${product.id}\`\n\n`;
  });
  
  return [{ type: 'text', text: markdown }];
}

// ============================================================================
// Order Formatters
// ============================================================================

/**
 * Format order confirmation
 */
export function formatOrder(order: Order): MCPContent[] {
  let markdown = `### 🎉 Order Confirmed!\n\n`;
  markdown += `**Order Number:** ${order.orderNumber}\n`;
  markdown += `**Status:** ${order.status}\n\n`;
  
  // Items summary
  markdown += '#### Items\n\n';
  order.items.forEach(item => {
    markdown += `- ${item.name} x${item.quantity} - $${item.totalPrice.toFixed(2)}\n`;
  });
  markdown += '\n';
  
  // Totals
  markdown += '#### Order Total\n\n';
  markdown += `| | |\n|---|---|\n`;
  markdown += `| Subtotal | $${order.subtotal.toFixed(2)} |\n`;
  markdown += `| Shipping | $${order.shipping.toFixed(2)} |\n`;
  markdown += `| Tax | $${order.tax.toFixed(2)} |\n`;
  markdown += `| **Total** | **$${order.total.toFixed(2)} ${order.currency}** |\n\n`;
  
  // Shipping address
  if (order.shippingAddress) {
    const addr = order.shippingAddress;
    markdown += '#### Shipping To\n\n';
    markdown += `${addr.firstName} ${addr.lastName}\n`;
    markdown += `${addr.address1}\n`;
    if (addr.address2) markdown += `${addr.address2}\n`;
    markdown += `${addr.city}, ${addr.state} ${addr.postalCode}\n`;
    markdown += `${addr.country}\n\n`;
  }
  
  // Delivery estimate
  if (order.estimatedDelivery) {
    const delivery = new Date(order.estimatedDelivery);
    markdown += `**Estimated Delivery:** ${delivery.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })}\n\n`;
  }
  
  // Tracking
  if (order.trackingUrl) {
    markdown += `[Track Your Order →](${order.trackingUrl})\n`;
  }
  
  return [{ type: 'text', text: markdown }];
}

// ============================================================================
// Error Formatters
// ============================================================================

/**
 * Format error response
 */
export function formatError(
  message: string,
  suggestions?: string[]
): MCPContent[] {
  let markdown = `### ⚠️ Something went wrong\n\n`;
  markdown += `${message}\n\n`;
  
  if (suggestions && suggestions.length > 0) {
    markdown += '**Try:**\n';
    suggestions.forEach(s => {
      markdown += `- ${s}\n`;
    });
  }
  
  return [{ type: 'text', text: markdown }];
}

/**
 * Format not found response
 */
export function formatNotFound(
  type: 'product' | 'cart' | 'order',
  id: string
): MCPContent[] {
  const messages: Record<string, string> = {
    product: `I couldn't find a product with ID \`${id}\`. Please check the ID and try again.`,
    cart: `No cart found. Start shopping by searching for products!`,
    order: `I couldn't find an order with ID \`${id}\`. Please check the order number.`,
  };
  
  return [{
    type: 'text',
    text: `### Not Found\n\n${messages[type]}`,
  }];
}


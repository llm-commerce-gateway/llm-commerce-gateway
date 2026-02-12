/**
 * X/Twitter Optimized Formatter for Grok
 * 
 * Formats product results and responses in a tweet-friendly, emoji-rich format
 * optimized for mobile viewing and X platform sharing.
 * 
 * @module llm-gateway/adapters/grok
 */

import type { Product, CartItem, Order } from '../../backends/interfaces';

// ============================================================================
// Formatter Configuration
// ============================================================================

export interface TwitterFormatterConfig {
  /**
   * Maximum characters per message (default: 280 for tweet compatibility)
   */
  maxLength?: number;
  
  /**
   * Whether to use emojis extensively (default: true)
   */
  useEmojis?: boolean;
  
  /**
   * Whether to optimize for mobile (shorter, punchier) (default: true)
   */
  mobileFirst?: boolean;
  
  /**
   * Whether to include hashtags (default: false)
   */
  includeHashtags?: boolean;
}

// ============================================================================
// Emoji Library
// ============================================================================

const EMOJIS = {
  // Categories
  search: '🔍',
  product: '🛍️',
  cart: '🛒',
  checkout: '💳',
  delivery: '📦',
  star: '⭐',
  fire: '🔥',
  new: '✨',
  sale: '💥',
  money: '💰',
  check: '✅',
  cross: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  arrow: '➡️',
  link: '🔗',
  sparkles: '✨',
  
  // Product categories (inferred)
  electronics: '💻',
  fashion: '👕',
  shoes: '👟',
  accessories: '👜',
  jewelry: '💎',
  watch: '⌚',
  phone: '📱',
  headphones: '🎧',
  camera: '📷',
  book: '📚',
  game: '🎮',
  toy: '🧸',
  food: '🍔',
  beauty: '💄',
  home: '🏠',
  sports: '⚽',
  fitness: '💪',
  health: '🏥',
  pet: '🐶',
  car: '🚗',
  travel: '✈️',
  
  // Price indicators
  cheap: '💵',
  expensive: '💎',
  discount: '🏷️',
  
  // Stock indicators
  inStock: '✅',
  lowStock: '⚠️',
  outOfStock: '❌',
};

// ============================================================================
// Twitter Formatter
// ============================================================================

export class TwitterFormatter {
  private config: Required<TwitterFormatterConfig>;

  constructor(config: TwitterFormatterConfig = {}) {
    this.config = {
      maxLength: config.maxLength ?? 280,
      useEmojis: config.useEmojis ?? true,
      mobileFirst: config.mobileFirst ?? true,
      includeHashtags: config.includeHashtags ?? false,
    };
  }

  /**
   * Format search results for X/Twitter
   */
  formatSearchResults(
    products: Product[],
    query: string,
    total?: number
  ): string {
    if (products.length === 0) {
      return this.emoji('search') + ` No results for "${query}" ` + this.emoji('cross');
    }

    const lines: string[] = [];
    
    // Header
    const resultCount = total !== undefined ? total : products.length;
    lines.push(`${this.emoji('search')} Found ${resultCount} results for "${query}"`);
    lines.push('');

    // Show top 3-4 products (mobile-friendly)
    const displayCount = this.config.mobileFirst ? 3 : 4;
    const toShow = products.slice(0, displayCount);

    for (let i = 0; i < toShow.length; i++) {
      const product = toShow[i];
      if (!product) {
        continue;
      }
      const line = this.formatProductLine(product, i + 1);
      
      // Check if adding this line would exceed max length
      const currentLength = lines.join('\n').length;
      if (currentLength + line.length + 1 > this.config.maxLength) {
        break;
      }
      
      lines.push(line);
    }

    // Add "more" indicator if there are additional products
    if (products.length > displayCount) {
      lines.push('');
      lines.push(`${this.emoji('arrow')} +${products.length - displayCount} more available`);
    }

    return this.truncate(lines.join('\n'));
  }

  /**
   * Format a single product line (compact)
   */
  private formatProductLine(product: Product, index?: number): string {
    const parts: string[] = [];

    // Number or emoji
    if (index !== undefined) {
      parts.push(`${index}.`);
    }

    // Category emoji
    const categoryEmoji = this.getCategoryEmoji(product.category || '');
    if (categoryEmoji) {
      parts.push(categoryEmoji);
    }

    // Product name (shortened if needed)
    const maxNameLength = this.config.mobileFirst ? 30 : 50;
    const name = product.name.length > maxNameLength
      ? product.name.substring(0, maxNameLength - 1) + '…'
      : product.name;
    parts.push(name);

    // Price with emoji
    if (product.price !== undefined) {
      const priceEmoji = this.getPriceEmoji(product.price.amount);
      parts.push(`${priceEmoji}$${product.price.amount.toFixed(0)}`);
    }

    // Stock indicator (only if low or out of stock)
    const availability = product.availability;
    if (availability && !availability.inStock) {
      parts.push(this.emoji('outOfStock'));
    } else if (availability?.quantity !== undefined && availability.quantity < 10) {
      parts.push(this.emoji('lowStock'));
    }

    return parts.join(' ');
  }

  /**
   * Format product details (full view)
   */
  formatProductDetails(product: Product): string {
    const lines: string[] = [];

    // Header with category emoji
    const categoryEmoji = this.getCategoryEmoji(product.category || '');
    lines.push(`${categoryEmoji} ${product.name}`);
    lines.push('');

    // Price
    if (product.price !== undefined) {
      const priceEmoji = this.getPriceEmoji(product.price.amount);
      lines.push(`${priceEmoji} $${product.price.amount.toFixed(2)}`);
    }

    // Brand (from attributes)
    const brand = product.attributes?.brand;
    if (brand && typeof brand === 'string') {
      lines.push(`Brand: ${brand}`);
    }

    // Stock status
    const isInStock = product.availability?.inStock ?? true;
    const stockEmoji = isInStock ? this.emoji('inStock') : this.emoji('outOfStock');
    const stockText = isInStock ? 'In Stock' : 'Out of Stock';
    lines.push(`${stockEmoji} ${stockText}`);

    // Description (truncated for mobile)
    if (product.description) {
      const maxDescLength = this.config.mobileFirst ? 100 : 150;
      const desc = product.description.length > maxDescLength
        ? product.description.substring(0, maxDescLength - 1) + '…'
        : product.description;
      lines.push('');
      lines.push(desc);
    }

    return this.truncate(lines.join('\n'));
  }

  /**
   * Format cart summary
   */
  formatCart(items: CartItem[], total: number): string {
    const lines: string[] = [];

    // Header
    lines.push(`${this.emoji('cart')} Your Cart (${items.length} items)`);
    lines.push('');

    // Items (show top 3 on mobile, 5 otherwise)
    const displayCount = this.config.mobileFirst ? 3 : 5;
    const toShow = items.slice(0, displayCount);

    for (const item of toShow) {
      const emoji = this.emoji('product');
      const name = this.truncateText(item.name || 'Item', 25);
      const price = item.unitPrice ? `$${item.unitPrice.toFixed(0)}` : '';
      const qty = item.quantity > 1 ? `×${item.quantity}` : '';
      
      lines.push(`${emoji} ${name} ${qty} ${price}`);
    }

    // Show more indicator
    if (items.length > displayCount) {
      lines.push(`${this.emoji('arrow')} +${items.length - displayCount} more`);
    }

    // Total
    lines.push('');
    lines.push(`${this.emoji('money')} Total: $${total.toFixed(2)}`);

    return this.truncate(lines.join('\n'));
  }

  /**
   * Format checkout confirmation
   */
  formatCheckout(order: Order): string {
    const lines: string[] = [];

    lines.push(`${this.emoji('check')} Order confirmed!`);
    lines.push('');
    lines.push(`${this.emoji('money')} Total: $${order.total.toFixed(2)}`);
    
    if (order.id) {
      lines.push(`${this.emoji('info')} Order #${order.id.substring(0, 8)}`);
    }

    lines.push('');
    lines.push(`${this.emoji('delivery')} Estimated delivery: 3-5 days`);

    return this.truncate(lines.join('\n'));
  }

  /**
   * Format error message
   */
  formatError(message: string): string {
    return `${this.emoji('warning')} ${message}`;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): string {
    return `${this.emoji('check')} ${message}`;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get emoji for text (if enabled)
   */
  private emoji(key: keyof typeof EMOJIS): string {
    return this.config.useEmojis ? EMOJIS[key] : '';
  }

  /**
   * Get category emoji based on product category
   */
  private getCategoryEmoji(category: string): string {
    if (!this.config.useEmojis) return '';

    const lower = category.toLowerCase();

    // Direct matches
    if (lower.includes('electron') || lower.includes('tech')) return EMOJIS.electronics;
    if (lower.includes('fashion') || lower.includes('cloth')) return EMOJIS.fashion;
    if (lower.includes('shoe') || lower.includes('sneaker')) return EMOJIS.shoes;
    if (lower.includes('bag') || lower.includes('accessory')) return EMOJIS.accessories;
    if (lower.includes('jewelry') || lower.includes('jewel')) return EMOJIS.jewelry;
    if (lower.includes('watch')) return EMOJIS.watch;
    if (lower.includes('phone') || lower.includes('mobile')) return EMOJIS.phone;
    if (lower.includes('headphone') || lower.includes('audio')) return EMOJIS.headphones;
    if (lower.includes('camera') || lower.includes('photo')) return EMOJIS.camera;
    if (lower.includes('book')) return EMOJIS.book;
    if (lower.includes('game') || lower.includes('gaming')) return EMOJIS.game;
    if (lower.includes('toy')) return EMOJIS.toy;
    if (lower.includes('food') || lower.includes('grocery')) return EMOJIS.food;
    if (lower.includes('beauty') || lower.includes('cosmetic')) return EMOJIS.beauty;
    if (lower.includes('home') || lower.includes('furniture')) return EMOJIS.home;
    if (lower.includes('sport')) return EMOJIS.sports;
    if (lower.includes('fitness') || lower.includes('gym')) return EMOJIS.fitness;
    if (lower.includes('health') || lower.includes('medical')) return EMOJIS.health;
    if (lower.includes('pet')) return EMOJIS.pet;
    if (lower.includes('car') || lower.includes('auto')) return EMOJIS.car;
    if (lower.includes('travel') || lower.includes('luggage')) return EMOJIS.travel;

    // Default
    return EMOJIS.product;
  }

  /**
   * Get price emoji based on value
   */
  private getPriceEmoji(price: number): string {
    if (!this.config.useEmojis) return '';
    
    if (price < 20) return EMOJIS.cheap;
    if (price > 500) return EMOJIS.expensive;
    return EMOJIS.money;
  }

  /**
   * Truncate text to fit in max length
   */
  private truncate(text: string): string {
    if (text.length <= this.config.maxLength) return text;

    // Truncate and add ellipsis
    return text.substring(0, this.config.maxLength - 1) + '…';
  }

  /**
   * Truncate text to specific length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Twitter formatter instance
 * 
 * @example
 * ```typescript
 * const formatter = createTwitterFormatter({
 *   maxLength: 280,
 *   useEmojis: true,
 *   mobileFirst: true,
 * });
 * 
 * const formatted = formatter.formatSearchResults(products, 'shoes');
 * console.log(formatted);
 * ```
 */
export function createTwitterFormatter(config?: TwitterFormatterConfig): TwitterFormatter {
  return new TwitterFormatter(config);
}


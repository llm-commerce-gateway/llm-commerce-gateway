/**
 * @betterdata/llm-gateway/links
 * 
 * Link generation and analytics module.
 * 
 * @example
 * ```typescript
 * // Dub.co (recommended)
 * import { DubLinkGenerator } from '@betterdata/llm-gateway/links';
 * 
 * const links = new DubLinkGenerator({
 *   apiKey: process.env.DUB_API_KEY!,
 *   domain: 'shop.link',
 *   storeBaseUrl: 'https://mystore.com',
 * });
 * 
 * const link = await links.createProductLink(product, context);
 * 
 * // Analytics
 * import { LinkAnalytics, createLinkAnalytics } from '@betterdata/llm-gateway/links';
 * 
 * const analytics = createLinkAnalytics({
 *   redis: { url: process.env.REDIS_URL },
 * });
 * 
 * await analytics.trackClick(linkId, { userAgent, ip });
 * const metrics = await analytics.getMetrics(linkId);
 * ```
 * 
 * @license MIT
 */

// Base class
export { BaseLinkGenerator } from './BaseLinkGenerator';

// Implementations
export { DubLinkGenerator } from './implementations/DubLinkGenerator';
export { BitlyLinkGenerator } from './implementations/BitlyLinkGenerator';
export { CustomLinkGenerator, InMemoryLinkGenerator } from './implementations/CustomLinkGenerator';

// Analytics
export {
  LinkAnalytics,
  RedisAnalyticsStorage,
  InMemoryAnalyticsStorage,
  createLinkAnalytics,
} from './analytics/LinkAnalytics';

// QR Code
export { generateQRCodeSVG, generateQRCodeDataUrl } from './qr/generator';

// Types
export type {
  // Core types
  ShortLink,
  LinkContext,
  LinkType,
  CreateLinkOptions,
  QRCodeOptions,
  
  // Generator interface
  LinkGenerator,
  
  // Analytics types
  LinkAnalytics as ILinkAnalytics,
  ClickContext,
  ConversionContext,
  LinkMetrics,
  
  // Configuration
  BaseLinkConfig,
  DubConfig,
  BitlyConfig,
  CustomLinkConfig,
} from './types';

export { DEFAULT_EXPIRY_HOURS } from './types';


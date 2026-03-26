/**
 * @betterdata/commerce-gateway - Analytics Sink Interface
 *
 * Defines the contract for tracking federation events.
 * Implement this interface to collect analytics for your own dashboards.
 *
 * @example
 * ```typescript
 * import type { AnalyticsSink, SearchEvent } from '@betterdata/commerce-gateway/federation';
 *
 * class MyAnalyticsSink implements AnalyticsSink {
 *   async trackSearch(event: SearchEvent) {
 *     await myAnalyticsService.track('federation.search', event);
 *   }
 *
 *   async trackResolution(event: ResolutionEvent) {
 *     await myAnalyticsService.track('federation.resolution', event);
 *   }
 *
 *   async trackToolCall(event: ToolCallEvent) {
 *     await myAnalyticsService.track('federation.tool_call', event);
 *   }
 *
 *   async flush() {
 *     await myAnalyticsService.flush();
 *   }
 * }
 * ```
 *
 * @license Apache-2.0
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * Base event interface with common fields.
 */
export interface BaseEvent {
  /** ISO timestamp when the event occurred */
  timestamp: string;

  /** Session ID if available */
  sessionId?: string;

  /** Request ID for correlation */
  requestId?: string;

  /** Hub ID if in a multi-hub setup */
  hubId?: string;
}

/**
 * Event when a federated search is performed.
 */
export interface SearchEvent extends BaseEvent {
  /** Type discriminator */
  type: 'search';

  /** The merchant that was searched */
  merchant: {
    domain: string;
    name: string;
    tier: 'verified' | 'registered' | 'discovered';
  };

  /** The search query */
  query: string;

  /** Any filters applied */
  filters?: {
    category?: string;
    priceMin?: number;
    priceMax?: number;
    limit?: number;
  };

  /** Search result summary */
  result: {
    /** Whether the search succeeded */
    success: boolean;

    /** Number of products returned */
    productCount: number;

    /** Response time in milliseconds */
    latencyMs: number;

    /** Error message if failed */
    error?: string;
  };
}

/**
 * Event when a merchant is resolved from user input.
 */
export interface ResolutionEvent extends BaseEvent {
  /** Type discriminator */
  type: 'resolution';

  /** The raw user input */
  input: string;

  /** Resolution result */
  result: {
    /** Whether a merchant was found */
    found: boolean;

    /** Resolved merchant domain (if found) */
    domain?: string;

    /** Resolution confidence */
    confidence?: 'high' | 'medium' | 'low';

    /** How the merchant was matched */
    matchMethod?: 'domain' | 'alias' | 'url' | 'fuzzy';

    /** Alternative merchants suggested (if not found) */
    alternativesCount?: number;
  };
}

/**
 * Event when a tool is called on a merchant gateway.
 */
export interface ToolCallEvent extends BaseEvent {
  /** Type discriminator */
  type: 'tool_call';

  /** The merchant gateway that was called */
  merchant: {
    domain: string;
    name: string;
    tier: 'verified' | 'registered' | 'discovered';
  };

  /** Tool that was called */
  tool: string;

  /** Tool call result */
  result: {
    /** Whether the call succeeded */
    success: boolean;

    /** Response time in milliseconds */
    latencyMs: number;

    /** Error message if failed */
    error?: string;

    /** HTTP status code */
    statusCode?: number;
  };
}

/**
 * Event when merchants are discovered.
 */
export interface DiscoveryEvent extends BaseEvent {
  /** Type discriminator */
  type: 'discovery';

  /** The discovery query */
  query: string;

  /** Category filter if applied */
  category?: string;

  /** Discovery result */
  result: {
    /** Number of merchants found */
    merchantCount: number;

    /** Top merchant domains */
    topMerchants: string[];

    /** Response time in milliseconds */
    latencyMs: number;
  };
}

/**
 * Event when a merchant is registered or updated.
 */
export interface RegistrationEvent extends BaseEvent {
  /** Type discriminator */
  type: 'registration';

  /** Action performed */
  action: 'register' | 'unregister' | 'update' | 'verify';

  /** Merchant domain */
  domain: string;

  /** Merchant tier */
  tier?: 'verified' | 'registered' | 'discovered';

  /** Whether the action succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Union of all analytics event types.
 */
export type AnalyticsEvent =
  | SearchEvent
  | ResolutionEvent
  | ToolCallEvent
  | DiscoveryEvent
  | RegistrationEvent;

// ============================================================================
// Analytics Sink Interface
// ============================================================================

/**
 * Interface for collecting federation analytics.
 *
 * Implementations can send events to any analytics backend:
 * - Better Data Cloud (proprietary)
 * - Segment, Mixpanel, Amplitude
 * - Custom data warehouse
 * - Local file logging
 *
 * The OSS package ships with NoopAnalyticsSink which discards all events.
 * Implement this interface to collect your own analytics.
 */
export interface AnalyticsSink {
  /**
   * Track a federated search event.
   *
   * @param event - Search event details
   */
  trackSearch(event: SearchEvent): void | Promise<void>;

  /**
   * Track a merchant resolution event.
   *
   * @param event - Resolution event details
   */
  trackResolution(event: ResolutionEvent): void | Promise<void>;

  /**
   * Track a tool call event.
   *
   * @param event - Tool call event details
   */
  trackToolCall(event: ToolCallEvent): void | Promise<void>;

  /**
   * Track a discovery event.
   *
   * @param event - Discovery event details
   */
  trackDiscovery(event: DiscoveryEvent): void | Promise<void>;

  /**
   * Track a registration event.
   *
   * @param event - Registration event details
   */
  trackRegistration(event: RegistrationEvent): void | Promise<void>;

  /**
   * Track any analytics event (generic).
   *
   * @param event - Any analytics event
   */
  track(event: AnalyticsEvent): void | Promise<void>;

  /**
   * Flush any buffered events.
   *
   * Should be called before process exit to ensure all events are sent.
   */
  flush(): Promise<void>;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Options for creating an analytics sink.
 */
export interface AnalyticsSinkOptions {
  /** Whether to buffer events before sending */
  buffer?: boolean;

  /** Buffer size before auto-flush */
  bufferSize?: number;

  /** Auto-flush interval in milliseconds */
  flushInterval?: number;

  /** Whether to include session IDs */
  includeSessionId?: boolean;

  /** Custom metadata to include with all events */
  metadata?: Record<string, string>;
}


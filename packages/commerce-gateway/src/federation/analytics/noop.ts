/**
 * @betterdata/commerce-gateway - No-op Analytics Sink
 *
 * Default analytics sink that discards all events.
 * Use this when you don't need analytics or for testing.
 *
 * @example
 * ```typescript
 * import { FederationHub, NoopAnalyticsSink } from '@betterdata/commerce-gateway/federation';
 *
 * const hub = new FederationHub({
 *   registry: { type: 'memory' },
 *   analytics: new NoopAnalyticsSink(),
 * });
 * ```
 *
 * @license MIT
 */

import type {
  AnalyticsSink,
  AnalyticsEvent,
  SearchEvent,
  ResolutionEvent,
  ToolCallEvent,
  DiscoveryEvent,
  RegistrationEvent,
} from './interface';
import type { CapabilityProvider, GatewayCapabilities } from '../../capabilities';
import { VERSION } from '../../version';

// ============================================================================
// No-op Analytics Sink
// ============================================================================

/**
 * Analytics sink that discards all events.
 *
 * This is the default sink used when no analytics are configured.
 * All methods are no-ops that return immediately.
 *
 * For production analytics, implement your own AnalyticsSink or use
 * a Better Data Cloud subscription for managed analytics.
 */
export class NoopAnalyticsSink implements AnalyticsSink, CapabilityProvider {
  /**
   * Track a search event (no-op).
   */
  trackSearch(_event: SearchEvent): void {
    // No-op: event discarded
  }

  /**
   * Track a resolution event (no-op).
   */
  trackResolution(_event: ResolutionEvent): void {
    // No-op: event discarded
  }

  /**
   * Track a tool call event (no-op).
   */
  trackToolCall(_event: ToolCallEvent): void {
    // No-op: event discarded
  }

  /**
   * Track a discovery event (no-op).
   */
  trackDiscovery(_event: DiscoveryEvent): void {
    // No-op: event discarded
  }

  /**
   * Track a registration event (no-op).
   */
  trackRegistration(_event: RegistrationEvent): void {
    // No-op: event discarded
  }

  /**
   * Track any analytics event (no-op).
   */
  track(_event: AnalyticsEvent): void {
    // No-op: event discarded
  }

  /**
   * Flush buffered events (no-op, resolves immediately).
   */
  async flush(): Promise<void> {
    // No-op: nothing to flush
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this analytics sink.
   *
   * NoopAnalyticsSink supports:
   * - events: [] (no events tracked)
   * - realtime: false
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    return {
      specVersion: '2025-12-22',
      gatewayVersion: VERSION,
      features: {
        registry: {
          merchantWrite: false,
          verificationAutomation: false,
          supportsPrivateHubs: false,
        },
        discovery: {
          rankedResults: false,
          supportsFilters: false,
          supportsPagination: false,
          supportsTagSearch: false,
        },
        analytics: {
          events: [],
          realtime: false,
        },
        verification: {
          dnsTxt: false,
          metaTag: false,
          callbackChallenge: false,
          manualReview: false,
        },
      },
    };
  }
}

// ============================================================================
// Console Analytics Sink (for debugging)
// ============================================================================

/**
 * Analytics sink that logs events to console.
 *
 * Useful for debugging and development.
 *
 * @example
 * ```typescript
 * import { ConsoleAnalyticsSink } from '@betterdata/commerce-gateway/federation';
 *
 * const hub = new FederationHub({
 *   registry: { type: 'memory' },
 *   analytics: new ConsoleAnalyticsSink({ verbose: true }),
 * });
 * ```
 */
export class ConsoleAnalyticsSink implements AnalyticsSink, CapabilityProvider {
  private verbose: boolean;
  private prefix: string;

  constructor(options?: { verbose?: boolean; prefix?: string }) {
    this.verbose = options?.verbose ?? false;
    this.prefix = options?.prefix ?? '[Federation Analytics]';
  }

  trackSearch(event: SearchEvent): void {
    if (this.verbose) {
      console.log(this.prefix, 'Search:', {
        merchant: event.merchant.domain,
        query: event.query,
        success: event.result.success,
        products: event.result.productCount,
        latency: `${event.result.latencyMs}ms`,
      });
    } else {
      console.log(
        this.prefix,
        `Search: ${event.merchant.domain} "${event.query}" → ${event.result.productCount} products (${event.result.latencyMs}ms)`
      );
    }
  }

  trackResolution(event: ResolutionEvent): void {
    if (this.verbose) {
      console.log(this.prefix, 'Resolution:', {
        input: event.input,
        found: event.result.found,
        domain: event.result.domain,
        confidence: event.result.confidence,
      });
    } else {
      const result = event.result.found
        ? `→ ${event.result.domain} (${event.result.confidence})`
        : '→ not found';
      console.log(this.prefix, `Resolution: "${event.input}" ${result}`);
    }
  }

  trackToolCall(event: ToolCallEvent): void {
    if (this.verbose) {
      console.log(this.prefix, 'Tool Call:', {
        merchant: event.merchant.domain,
        tool: event.tool,
        success: event.result.success,
        latency: `${event.result.latencyMs}ms`,
      });
    } else {
      const status = event.result.success ? '✓' : '✗';
      console.log(
        this.prefix,
        `Tool: ${event.tool} @ ${event.merchant.domain} ${status} (${event.result.latencyMs}ms)`
      );
    }
  }

  trackDiscovery(event: DiscoveryEvent): void {
    if (this.verbose) {
      console.log(this.prefix, 'Discovery:', {
        query: event.query,
        category: event.category,
        merchantCount: event.result.merchantCount,
        topMerchants: event.result.topMerchants,
      });
    } else {
      console.log(
        this.prefix,
        `Discovery: "${event.query}" → ${event.result.merchantCount} merchants`
      );
    }
  }

  trackRegistration(event: RegistrationEvent): void {
    const status = event.success ? '✓' : '✗';
    console.log(this.prefix, `Registration: ${event.action} ${event.domain} ${status}`);
  }

  track(event: AnalyticsEvent): void {
    switch (event.type) {
      case 'search':
        this.trackSearch(event);
        break;
      case 'resolution':
        this.trackResolution(event);
        break;
      case 'tool_call':
        this.trackToolCall(event);
        break;
      case 'discovery':
        this.trackDiscovery(event);
        break;
      case 'registration':
        this.trackRegistration(event);
        break;
    }
  }

  async flush(): Promise<void> {
    // Console sink doesn't buffer, nothing to flush
  }

  // ==========================================================================
  // CapabilityProvider Implementation
  // ==========================================================================

  /**
   * Get the capabilities of this analytics sink.
   *
   * ConsoleAnalyticsSink supports basic event types for debugging.
   */
  async getCapabilities(): Promise<GatewayCapabilities> {
    return {
      specVersion: '2025-12-22',
      gatewayVersion: VERSION,
      features: {
        registry: {
          merchantWrite: false,
          verificationAutomation: false,
          supportsPrivateHubs: false,
        },
        discovery: {
          rankedResults: false,
          supportsFilters: false,
          supportsPagination: false,
          supportsTagSearch: false,
        },
        analytics: {
          events: ['search', 'resolution', 'tool_call', 'discovery', 'registration'],
          realtime: false,
        },
        verification: {
          dnsTxt: false,
          metaTag: false,
          callbackChallenge: false,
          manualReview: false,
        },
      },
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a no-op analytics sink.
 */
export function createNoopAnalyticsSink(): NoopAnalyticsSink {
  return new NoopAnalyticsSink();
}

/**
 * Create a console analytics sink.
 */
export function createConsoleAnalyticsSink(options?: {
  verbose?: boolean;
  prefix?: string;
}): ConsoleAnalyticsSink {
  return new ConsoleAnalyticsSink(options);
}


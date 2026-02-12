/**
 * Better Data Cloud Analytics Sink
 *
 * Implements the AnalyticsSink interface for sending analytics events
 * to the Better Data Cloud Federation API.
 *
 * Features:
 * - Batched event sending for efficiency
 * - Automatic flush on interval or batch size
 * - Retry logic for failed sends
 * - Graceful degradation (never throws, logs errors)
 *
 * @example
 * ```typescript
 * import { BetterDataAnalyticsSink } from '@betterdata/llm-gateway/federation/providers';
 *
 * const analytics = new BetterDataAnalyticsSink({
 *   apiKey: process.env.BETTERDATA_API_KEY!,
 *   hubId: 'global',
 * });
 *
 * // Track events
 * analytics.trackSearch({
 *   merchantId: 'nike',
 *   query: 'running shoes',
 *   success: true,
 *   latencyMs: 150,
 * });
 *
 * // Ensure all events are sent before shutdown
 * await analytics.flush();
 * ```
 */

import type { AnalyticsSink } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface BetterDataAnalyticsConfig {
  /**
   * Better Data Cloud API URL.
   * @default "https://api.betterdata.com/federation"
   */
  apiUrl?: string;

  /**
   * API key for authentication.
   */
  apiKey: string;

  /**
   * Federation hub ID.
   * @default "global"
   */
  hubId?: string;

  /**
   * Number of events to buffer before sending.
   * @default 100
   */
  batchSize?: number;

  /**
   * Interval in milliseconds between automatic flushes.
   * @default 5000
   */
  flushIntervalMs?: number;

  /**
   * Maximum number of retry attempts for failed sends.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Request timeout in milliseconds.
   * @default 10000
   */
  timeoutMs?: number;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

export interface SearchEvent {
  /** Merchant ID or domain */
  merchantId: string;
  /** Merchant domain */
  merchantDomain?: string;
  /** Search query */
  query: string;
  /** Whether the search was successful */
  success: boolean;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Number of results returned */
  resultCount?: number;
  /** Error type if failed */
  errorType?: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Timestamp (defaults to now) */
  timestamp?: string;
}

export interface ResolutionEvent {
  /** Input that was resolved (domain or alias) */
  input: string;
  /** Resolved merchant ID */
  resolvedMerchantId?: string;
  /** Resolved merchant domain */
  resolvedDomain?: string;
  /** Resolution method used */
  method: 'domain' | 'alias' | 'discovery' | 'not_found';
  /** Resolution latency in milliseconds */
  latencyMs: number;
  /** Timestamp (defaults to now) */
  timestamp?: string;
}

export interface GatewayHealthEvent {
  /** Merchant ID */
  merchantId: string;
  /** Gateway URL */
  gatewayUrl: string;
  /** Whether the health check succeeded */
  success: boolean;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp (defaults to now) */
  timestamp?: string;
}

type AnalyticsEvent =
  | { type: 'search'; data: SearchEvent }
  | { type: 'resolution'; data: ResolutionEvent }
  | { type: 'health'; data: GatewayHealthEvent };

// ============================================================================
// BetterDataAnalyticsSink
// ============================================================================

export class BetterDataAnalyticsSink implements AnalyticsSink {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly hubId: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly debug: boolean;

  private buffer: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private retryQueue: AnalyticsEvent[] = [];

  constructor(config: BetterDataAnalyticsConfig) {
    this.apiUrl = config.apiUrl ?? 'https://api.betterdata.com/federation';
    this.apiKey = config.apiKey;
    this.hubId = config.hubId ?? 'global';
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.debug = config.debug ?? false;

    if (!this.apiKey) {
      throw new Error('BetterDataAnalyticsSink: apiKey is required');
    }

    // Start automatic flush timer
    this.startFlushTimer();
  }

  /**
   * Track a search event.
   */
  trackSearch(event: SearchEvent): void {
    this.addEvent({
      type: 'search',
      data: {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      },
    });
  }

  /**
   * Track a resolution event.
   */
  trackResolution(event: ResolutionEvent): void {
    this.addEvent({
      type: 'resolution',
      data: {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      },
    });
  }

  /**
   * Track a gateway health check event.
   */
  trackHealth(event: GatewayHealthEvent): void {
    this.addEvent({
      type: 'health',
      data: {
        ...event,
        timestamp: event.timestamp ?? new Date().toISOString(),
      },
    });
  }

  /**
   * Flush all buffered events to the API.
   *
   * Call this before shutdown to ensure all events are sent.
   */
  async flush(): Promise<void> {
    if (this.isFlushing) {
      // Wait for current flush to complete
      while (this.isFlushing) {
        await this.delay(100);
      }
      return;
    }

    this.isFlushing = true;

    try {
      // Include any events from retry queue
      const allEvents = [...this.retryQueue, ...this.buffer];
      this.buffer = [];
      this.retryQueue = [];

      if (allEvents.length === 0) {
        return;
      }

      this.log(`Flushing ${allEvents.length} events`);

      // Send in batches
      for (let i = 0; i < allEvents.length; i += this.batchSize) {
        const batch = allEvents.slice(i, i + this.batchSize);
        await this.sendBatch(batch);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Stop the analytics sink and flush remaining events.
   */
  async stop(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  /**
   * Get the current buffer size (for monitoring).
   */
  getBufferSize(): number {
    return this.buffer.length + this.retryQueue.length;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private addEvent(event: AnalyticsEvent): void {
    this.buffer.push(event);

    // Auto-flush if batch size reached
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch((err) => {
        this.log(`Background flush error: ${err.message}`, 'error');
      });
    }
  }

  private async sendBatch(events: AnalyticsEvent[], attempt = 1): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/analytics/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Hub-Id': this.hubId,
        },
        body: JSON.stringify({
          hubId: this.hubId,
          events: events.map((e) => ({
            eventType: e.type,
            ...e.data,
          })),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.log(`Sent ${events.length} events successfully`);
    } catch (error: any) {
      this.log(`Send failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`, 'error');

      if (attempt < this.maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
        await this.delay(delay);
        return this.sendBatch(events, attempt + 1);
      }

      // Add failed events to retry queue for next flush
      this.log(`Adding ${events.length} events to retry queue`, 'warn');
      this.retryQueue.push(...events);
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch((err) => {
          this.log(`Timer flush error: ${err.message}`, 'error');
        });
      }
    }, this.flushIntervalMs);

    // Ensure timer doesn't prevent process exit
    if (typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      this.flushTimer.unref();
    }
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private log(message: string, level: 'debug' | 'warn' | 'error' = 'debug'): void {
    if (!this.debug && level === 'debug') {
      return;
    }

    const prefix = '[BetterDataAnalyticsSink]';
    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
}

// ============================================================================
// Convenience: Create a no-op sink for testing
// ============================================================================

export class NoopAnalyticsSink implements AnalyticsSink {
  trackSearch(_event: SearchEvent): void {
    // No-op
  }

  trackResolution(_event: ResolutionEvent): void {
    // No-op
  }

  trackHealth(_event: GatewayHealthEvent): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }
}


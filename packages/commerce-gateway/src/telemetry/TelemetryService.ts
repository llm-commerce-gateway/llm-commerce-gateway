/**
 * @betterdata/llm-gateway - Telemetry Service (OSS)
 *
 * Optional, anonymous, aggregate telemetry payload builder.
 * Telemetry is opt-in and disabled by default.
 *
 * @license MIT
 */

import type { LLMProvider, TelemetryConfig } from '../core/types';
import { VERSION } from '../version';
import { TELEMETRY_SCHEMA_VERSION, type TelemetryPayload } from './types';

const DEFAULT_FEATURES = {
  registry_enabled: false,
  federation_enabled: false,
  streaming_enabled: false,
};

const DEFAULT_ENDPOINT = 'https://telemetry.betterdata.co';
const DEFAULT_SEND_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

export class TelemetryService {
  private requestCount = 0;
  private toolInvocationCount = 0;
  private providersUsed = new Set<string>();
  private senderTimer: ReturnType<typeof setTimeout> | null = null;
  private nextDelayMs = DEFAULT_SEND_INTERVAL_MS;
  private sending = false;

  constructor(
    private config?: TelemetryConfig,
    private gatewayVersion: string = VERSION,
    llmProviders?: LLMProvider[]
  ) {
    llmProviders?.forEach((provider) => this.providersUsed.add(provider));
  }

  isEnabled(): boolean {
    return Boolean(this.config?.enabled);
  }

  recordRequest(): void {
    this.requestCount += 1;
  }

  recordToolInvocation(provider?: LLMProvider): void {
    this.toolInvocationCount += 1;
    if (provider) {
      this.providersUsed.add(provider);
    }
  }

  buildTelemetryPayload(options?: { toolCount?: number }): TelemetryPayload {
    return this.buildPayload(options);
  }

  buildPayload(options?: { toolCount?: number }): TelemetryPayload {
    const features = {
      ...DEFAULT_FEATURES,
      ...(this.config?.features ?? {}),
    };

    return {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      gateway: {
        version: this.gatewayVersion,
        runtime: 'node',
        deployment: this.config?.deployment ?? 'self-hosted',
        uptime_seconds: Math.floor(process.uptime()),
      },
      features: {
        registry_enabled: Boolean(features.registry_enabled),
        federation_enabled: Boolean(features.federation_enabled),
        streaming_enabled: Boolean(features.streaming_enabled),
      },
      usage: {
        request_count_24h: this.requestCount,
        tool_invocations_24h: this.toolInvocationCount,
        providers_used: Array.from(this.providersUsed),
        tool_count: options?.toolCount ?? 0,
      },
      health: {
        error_rate_pct: 0,
        p95_latency_ms: 0,
      },
    };
  }

  startSender(options?: { toolCount?: number | (() => number) }): void {
    if (!this.isEnabled()) {
      return;
    }

    this.stopSender();
    this.nextDelayMs = DEFAULT_SEND_INTERVAL_MS;
    this.scheduleSend(options);
  }

  stopSender(): void {
    if (this.senderTimer) {
      clearTimeout(this.senderTimer);
      this.senderTimer = null;
    }
  }

  private scheduleSend(options?: { toolCount?: number | (() => number) }): void {
    this.senderTimer = setTimeout(() => {
      void this.sendOnce(options);
    }, this.nextDelayMs);
  }

  private async sendOnce(options?: { toolCount?: number | (() => number) }): Promise<void> {
    if (!this.isEnabled() || this.sending) {
      return;
    }

    this.sending = true;
    const toolCount = typeof options?.toolCount === 'function'
      ? options.toolCount()
      : options?.toolCount;

    try {
      const payload = this.buildPayload({ toolCount });
      const endpoint = this.config?.endpoint ?? DEFAULT_ENDPOINT;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Telemetry endpoint responded ${response.status}`);
      }

      this.nextDelayMs = DEFAULT_SEND_INTERVAL_MS;
    } catch {
      this.nextDelayMs = Math.min(this.nextDelayMs * 2, MAX_BACKOFF_MS);
    } finally {
      this.sending = false;
      this.scheduleSend(options);
    }
  }
}

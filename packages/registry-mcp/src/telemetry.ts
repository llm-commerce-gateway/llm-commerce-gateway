/**
 * Registry MCP - Telemetry (Lightweight)
 *
 * Minimal counters, histograms, and structured logs for OSS.
 * No external dependencies.
 *
 * @license Apache-2.0
 */

import crypto from 'node:crypto';

export const METRICS = {
  registryDiscoveryRequestsTotal: 'registry_discovery_requests_total',
  registryDiscoveryErrorsTotal: 'registry_discovery_errors_total',
  registryDiscoveryLatencySeconds: 'registry_discovery_latency_seconds',
  registryMetadataValidationsTotal: 'registry_metadata_validations_total',
  registryMetadataValidationErrorsTotal: 'registry_metadata_validation_errors_total',
} as const;

type Histogram = {
  count: number;
  sum: number;
  min: number;
  max: number;
};

const counters = new Map<string, number>();
const histograms = new Map<string, Histogram>();

export type LogLevel = 'info' | 'warn' | 'error';

export function createCorrelationId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logStructured(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {}
): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(payload));
  } else {
    console.log(JSON.stringify(payload));
  }
}

export function incrementCounter(name: string, value = 1): void {
  const current = counters.get(name) ?? 0;
  counters.set(name, current + value);
}

export function observeHistogramSeconds(name: string, seconds: number): void {
  const existing = histograms.get(name) ?? {
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
  };

  const next = {
    count: existing.count + 1,
    sum: existing.sum + seconds,
    min: Math.min(existing.min, seconds),
    max: Math.max(existing.max, seconds),
  };

  histograms.set(name, next);
}

export function startTimerSeconds(metricName: string): () => void {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    const seconds = Number(end - start) / 1_000_000_000;
    observeHistogramSeconds(metricName, seconds);
  };
}

export function startTrace(name: string, correlationId: string): { traceId: string; end: (status?: string) => void } {
  const traceId = createCorrelationId();
  logStructured('info', 'trace_start', {
    trace_id: traceId,
    correlation_id: correlationId,
    span: name,
  });

  return {
    traceId,
    end: (status = 'ok') => {
      logStructured('info', 'trace_end', {
        trace_id: traceId,
        correlation_id: correlationId,
        span: name,
        status,
      });
    },
  };
}

export function getMetrics(): string[] {
  return [
    METRICS.registryDiscoveryRequestsTotal,
    METRICS.registryDiscoveryErrorsTotal,
    METRICS.registryDiscoveryLatencySeconds,
    METRICS.registryMetadataValidationsTotal,
    METRICS.registryMetadataValidationErrorsTotal,
  ];
}

/**
 * @betterdata/llm-gateway - Control-Plane Metrics (Scaffolding)
 *
 * Minimal metric name catalog + emit stub for hosted observability.
 *
 * @license MIT
 */

import type { Logger } from './Logger';

export const CONTROL_PLANE_METRICS = {
  gateway: {
    latencyMs: 'gateway.latency_ms',
    errorTotal: 'gateway.error_total',
    requestsTotal: 'gateway.requests_total',
    providerErrorTotal: 'gateway.provider_error_total',
    timeoutsTotal: 'gateway.timeouts_total',
    concurrency: 'gateway.concurrency',
  },
  registry: {
    lookupLatencyMs: 'registry.lookup_latency_ms',
    cacheHitTotal: 'registry.cache_hit_total',
    cacheMissTotal: 'registry.cache_miss_total',
    schemaValidationFailTotal: 'registry.schema_validation_fail_total',
    registrationFailTotal: 'registry.registration_fail_total',
  },
  federation: {
    handshakeSuccessTotal: 'federation.handshake_success_total',
    handshakeFailTotal: 'federation.handshake_fail_total',
    tokenValidationFailTotal: 'federation.token_validation_fail_total',
    signatureVerificationFailTotal: 'federation.signature_verification_fail_total',
    stalePeerTotal: 'federation.stale_peer_total',
    loopDetectedTotal: 'federation.loop_detected_total',
    fanoutDepth: 'federation.fanout_depth',
  },
} as const;

export type MetricTags = Record<string, string | number | boolean>;

export function emitControlPlaneMetric(
  logger: Logger | undefined,
  name: string,
  value: number,
  tags: MetricTags = {}
): void {
  if (!logger) {
    return;
  }

  logger.info('metric', {
    name,
    value,
    tags,
  });
}

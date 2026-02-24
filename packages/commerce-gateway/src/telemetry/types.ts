/**
 * @betterdata/commerce-gateway - Telemetry Types
 *
 * Canonical OSS telemetry payload types and schema.
 *
 * @license MIT
 */

import { z } from 'zod';

export const TELEMETRY_SCHEMA_VERSION = '1.0' as const;

export const TelemetryPayloadSchema = z.object({
  schema_version: z.literal(TELEMETRY_SCHEMA_VERSION),
  timestamp: z.string(),
  gateway: z.object({
    version: z.string(),
    runtime: z.literal('node'),
    deployment: z.enum(['self-hosted', 'hosted']),
    uptime_seconds: z.number().int().nonnegative(),
  }).strict(),
  features: z.object({
    registry_enabled: z.boolean(),
    federation_enabled: z.boolean(),
    streaming_enabled: z.boolean(),
  }).strict(),
  usage: z.object({
    request_count_24h: z.number().int().nonnegative(),
    tool_invocations_24h: z.number().int().nonnegative(),
    providers_used: z.array(z.string()),
    tool_count: z.number().int().nonnegative(),
  }).strict(),
  health: z.object({
    error_rate_pct: z.number().nonnegative(),
    p95_latency_ms: z.number().nonnegative(),
  }).strict(),
}).strict();

export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>;

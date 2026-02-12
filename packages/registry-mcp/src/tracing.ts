/**
 * Registry MCP - Tracing Stub
 *
 * Minimal tracer wrapper for observability verification.
 *
 * @license MIT
 */

import { createCorrelationId, startTrace } from './telemetry.ts';

export const tracer = {
  startSpan(name: string, correlationId?: string) {
    const correlation = correlationId ?? createCorrelationId();
    return startTrace(name, correlation);
  },
};

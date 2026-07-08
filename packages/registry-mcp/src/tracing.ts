/**
 * Registry MCP - Tracing Stub
 *
 * Minimal tracer wrapper for observability verification.
 *
 * @license Apache-2.0
 */

import { createCorrelationId, startTrace } from './telemetry.js';

export const tracer = {
  startSpan(name: string, correlationId?: string) {
    const correlation = correlationId ?? createCorrelationId();
    return startTrace(name, correlation);
  },
};

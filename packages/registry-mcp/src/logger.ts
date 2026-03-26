/**
 * Registry MCP - Structured Logger
 *
 * Lightweight logger wrapper for observability verification.
 *
 * @license Apache-2.0
 */

import { logStructured } from './telemetry.ts';

export const logger = {
  info(message: string, fields: Record<string, unknown> = {}) {
    logStructured('info', message, fields);
  },
  warn(message: string, fields: Record<string, unknown> = {}) {
    logStructured('warn', message, fields);
  },
  error(message: string, fields: Record<string, unknown> = {}) {
    logStructured('error', message, fields);
  },
};

/**
 * @betterdata/commerce-gateway - Observability Module
 * 
 * Provides structured logging and observability utilities.
 * 
 * @license Apache-2.0
 */

export {
  // Logger interface and types
  type Logger,
  type LogLevel,
  type LogEntry,
  type ConsoleLoggerOptions,
  type ExternalLogger,

  // Logger implementations
  ConsoleLogger,
  StructuredLogger,
  NoOpLogger,
  TestLogger,

  // Global logger management
  setLogger,
  getLogger,
  resetLogger,
} from './Logger';

export {
  CONTROL_PLANE_METRICS,
  emitControlPlaneMetric,
  type MetricTags,
} from './metrics';


/**
 * @betterdata/llm-gateway - Analytics Module
 *
 * Provides analytics sink interface and implementations for tracking
 * federation events.
 *
 * @example
 * ```typescript
 * import {
 *   NoopAnalyticsSink,
 *   ConsoleAnalyticsSink,
 *   type AnalyticsSink,
 * } from '@betterdata/llm-gateway/federation';
 *
 * // No analytics (default)
 * const noopSink = new NoopAnalyticsSink();
 *
 * // Console logging for debugging
 * const consoleSink = new ConsoleAnalyticsSink({ verbose: true });
 *
 * // Custom implementation
 * class MyAnalyticsSink implements AnalyticsSink {
 *   // ... your implementation
 * }
 * ```
 *
 * @license MIT
 */

// ============================================================================
// Interface Exports
// ============================================================================

export type {
  AnalyticsSink,
  AnalyticsSinkOptions,
  AnalyticsEvent,
  BaseEvent,
  SearchEvent,
  ResolutionEvent,
  ToolCallEvent,
  DiscoveryEvent,
  RegistrationEvent,
} from './interface';

// ============================================================================
// Implementation Exports
// ============================================================================

export {
  NoopAnalyticsSink,
  ConsoleAnalyticsSink,
  createNoopAnalyticsSink,
  createConsoleAnalyticsSink,
} from './noop';


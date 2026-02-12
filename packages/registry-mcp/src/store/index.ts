/**
 * Registry store module — interfaces and implementations.
 *
 * @module registry-mcp/store
 */

export { MemoryRegistryStore } from './memory.js';

export type {
  // Interfaces
  RegistryStore,
  RegistryAdminStore,
  // Core types
  Gateway,
  GatewayFilters,
  CreateGatewayInput,
  UpdateGatewayInput,
  DiscoveryQuery,
  DiscoveryResult,
  ShopResolution,
  UsagePeriod,
  UsageStats,
  AuditEntry,
  AuditFilters,
  // Admin types
  TenantInfo,
  TenantFilters,
  AdminSearchResult,
} from './interfaces.js';

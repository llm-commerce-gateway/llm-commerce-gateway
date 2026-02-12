/**
 * Registry store interfaces — OSS contract for data operations.
 * OSS provides MemoryRegistryStore; proprietary provides PrismaRegistryStore.
 *
 * @module registry-mcp/store
 */

// ============================================================================
// Core Types (OSS contract — used by both OSS and proprietary)
// ============================================================================

export interface Gateway {
  id: string;
  name: string;
  organizationId: string;
  ownerId: string;
  endpoint?: string;
  capabilities: string[];
  status: 'active' | 'suspended' | 'inactive';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GatewayFilters {
  status?: string;
  capability?: string;
  limit?: number;
  offset?: number;
}

export interface CreateGatewayInput {
  name: string;
  organizationId: string;
  ownerId: string;
  endpoint?: string;
  capabilities?: string[];
  status?: 'active' | 'suspended' | 'inactive';
  metadata?: Record<string, unknown>;
}

export interface UpdateGatewayInput {
  name?: string;
  endpoint?: string;
  capabilities?: string[];
  status?: 'active' | 'suspended' | 'inactive';
  metadata?: Record<string, unknown>;
}

export interface DiscoveryQuery {
  handle?: string;
  capability?: string;
  limit?: number;
}

export interface DiscoveryResult {
  gatewayId: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  score?: number;
}

export interface ShopResolution {
  gatewayId: string;
  name: string;
  endpoint: string;
  capabilities: string[];
}

export interface UsagePeriod {
  start: Date;
  end: Date;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  byProvider: Record<string, { requests: number; tokens: number }>;
}

export interface AuditEntry {
  id?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  organizationId: string;
  changes?: Record<string, unknown>;
  timestamp: Date;
}

export interface AuditFilters {
  startDate?: Date;
  endDate?: Date;
  action?: string;
  resourceType?: string;
  limit?: number;
}

// ============================================================================
// Admin Types (proprietary only — typed here for interface completeness)
// ============================================================================

export interface TenantInfo {
  organizationId: string;
  name: string;
  gatewayCount?: number;
  [key: string]: unknown;
}

export interface TenantFilters {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface AdminSearchResult {
  type: 'gateway' | 'organization' | 'user';
  id: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RegistryStore Interface
// ============================================================================

/**
 * Abstract registry store — all data operations go through this.
 * OSS provides MemoryRegistryStore, proprietary provides PrismaRegistryStore.
 */
export interface RegistryStore {
  // Gateway CRUD
  getGateway(id: string, orgId: string): Promise<Gateway | null>;
  listGateways(orgId: string, filters?: GatewayFilters): Promise<Gateway[]>;
  createGateway(data: CreateGatewayInput): Promise<Gateway>;
  updateGateway(id: string, orgId: string, data: UpdateGatewayInput): Promise<Gateway>;
  deleteGateway(id: string, orgId: string): Promise<void>;

  // Discovery (OSS core — discovery-only surface)
  discoverGateways(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
  resolveShop(handle: string): Promise<ShopResolution | null>;

  // Usage tracking
  getUsage(gatewayId: string, orgId: string, period: UsagePeriod): Promise<UsageStats>;

  // Audit log
  writeAuditEntry(entry: AuditEntry): Promise<void>;
  getAuditLogs(orgId: string, filters: AuditFilters): Promise<AuditEntry[]>;
}

/**
 * Admin operations — only available in proprietary RegistryAdminStore.
 * Typed here for interface completeness; OSS MemoryRegistryStore does not implement these.
 */
export interface RegistryAdminStore extends RegistryStore {
  adminGetTenant(orgId: string): Promise<TenantInfo | null>;
  adminListTenants(filters?: TenantFilters): Promise<TenantInfo[]>;
  adminSearch(query: string): Promise<AdminSearchResult[]>;
}

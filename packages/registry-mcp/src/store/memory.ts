/**
 * In-memory registry store for self-hosted / OSS use.
 * No database required. Data resets on restart.
 * Good for development, testing, and single-tenant deployments.
 *
 * @module registry-mcp/store
 */

import type {
  RegistryStore,
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
} from './interfaces.js';

export class MemoryRegistryStore implements RegistryStore {
  private gateways: Map<string, Gateway> = new Map();
  private auditLog: AuditEntry[] = [];
  private auditIdCounter = 0;

  async getGateway(id: string, orgId: string): Promise<Gateway | null> {
    const gw = this.gateways.get(id);
    return gw && gw.organizationId === orgId ? gw : null;
  }

  async listGateways(orgId: string, filters?: GatewayFilters): Promise<Gateway[]> {
    let results = Array.from(this.gateways.values()).filter(
      (gw) => gw.organizationId === orgId,
    );
    if (filters?.status) {
      results = results.filter((gw) => gw.status === filters.status);
    }
    if (filters?.capability) {
      results = results.filter((gw) => gw.capabilities.includes(filters.capability!));
    }
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  async createGateway(data: CreateGatewayInput): Promise<Gateway> {
    const id = crypto.randomUUID();
    const now = new Date();
    const gateway: Gateway = {
      id,
      name: data.name,
      organizationId: data.organizationId,
      ownerId: data.ownerId,
      endpoint: data.endpoint,
      capabilities: data.capabilities ?? [],
      status: data.status ?? 'active',
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.gateways.set(id, gateway);
    return gateway;
  }

  async updateGateway(
    id: string,
    orgId: string,
    data: UpdateGatewayInput,
  ): Promise<Gateway> {
    const existing = await this.getGateway(id, orgId);
    if (!existing) {
      throw new Error('Gateway not found or access denied');
    }
    const updated: Gateway = {
      ...existing,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.endpoint !== undefined && { endpoint: data.endpoint }),
      ...(data.capabilities !== undefined && { capabilities: data.capabilities }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
      updatedAt: new Date(),
    };
    this.gateways.set(id, updated);
    return updated;
  }

  async deleteGateway(id: string, orgId: string): Promise<void> {
    const existing = await this.getGateway(id, orgId);
    if (!existing) {
      throw new Error('Gateway not found or access denied');
    }
    this.gateways.delete(id);
  }

  async discoverGateways(query: DiscoveryQuery): Promise<DiscoveryResult[]> {
    let results = Array.from(this.gateways.values()).filter(
      (gw) => gw.status === 'active',
    );
    if (query.handle) {
      const handleLower = query.handle.toLowerCase();
      results = results.filter((gw) =>
        gw.name.toLowerCase().includes(handleLower),
      );
    }
    if (query.capability) {
      results = results.filter((gw) =>
        gw.capabilities.includes(query.capability!),
      );
    }
    const limit = query.limit ?? 10;
    return results.slice(0, limit).map((gw) => ({
      gatewayId: gw.id,
      name: gw.name,
      endpoint: gw.endpoint ?? '',
      capabilities: gw.capabilities,
    }));
  }

  async resolveShop(handle: string): Promise<ShopResolution | null> {
    const results = await this.discoverGateways({ handle, limit: 1 });
    const first = results[0];
    if (!first) return null;
    return {
      gatewayId: first.gatewayId,
      name: first.name,
      endpoint: first.endpoint,
      capabilities: first.capabilities,
    };
  }

  async getUsage(
    _gatewayId: string,
    _orgId: string,
    _period: UsagePeriod,
  ): Promise<UsageStats> {
    return {
      totalRequests: 0,
      totalTokens: 0,
      byProvider: {},
    };
  }

  async writeAuditEntry(entry: AuditEntry): Promise<void> {
    this.auditIdCounter += 1;
    const stored: AuditEntry = {
      ...entry,
      id: entry.id ?? `audit-${this.auditIdCounter}`,
      timestamp: entry.timestamp ?? new Date(),
    };
    this.auditLog.push(stored);
  }

  async getAuditLogs(orgId: string, filters: AuditFilters): Promise<AuditEntry[]> {
    let results = this.auditLog.filter((e) => e.organizationId === orgId);
    if (filters.startDate) {
      results = results.filter((e) => e.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter((e) => e.timestamp <= filters.endDate!);
    }
    if (filters.action) {
      results = results.filter((e) => e.action === filters.action);
    }
    if (filters.resourceType) {
      results = results.filter((e) => e.resourceType === filters.resourceType);
    }
    const limit = filters.limit ?? 50;
    return results.slice(-limit).reverse();
  }
}

/**
 * Registry MCP - Feature Flags
 *
 * Server-side, env-driven flags (reversible without redeploy).
 *
 * @license Apache-2.0
 */

export interface FeatureFlags {
  oss_registry_discovery: boolean;
  oss_registry_metadata: boolean;
}

export const FLAG_OWNERS: Record<keyof FeatureFlags, string> = {
  oss_registry_discovery: 'platform-oss',
  oss_registry_metadata: 'platform-oss',
};

const defaults: FeatureFlags = {
  oss_registry_discovery: true,
  oss_registry_metadata: true,
};

export function getFlags(): FeatureFlags {
  return {
    oss_registry_discovery: process.env.OSS_REGISTRY_DISCOVERY !== 'false',
    oss_registry_metadata: process.env.OSS_REGISTRY_METADATA !== 'false',
  };
}

export function isEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFlags();
  return flags[flag] ?? defaults[flag];
}

export const REGISTRY_FLAGS = {
  registry_tenant_access: {
    key: 'registry_tenant_access',
    default: true,
    description: 'Enable tenant registry access',
  },
  registry_superadmin_access: {
    key: 'registry_superadmin_access',
    default: true,
    description: 'Enable SuperAdmin cross-tenant access',
  },
  registry_impersonation: {
    key: 'registry_impersonation',
    default: false,
    description: 'Enable impersonation (Admin → SCM only)',
  },
  registry_audit_logging: {
    key: 'registry_audit_logging',
    default: true,
    description: 'Enable audit logging',
  },
} as const;

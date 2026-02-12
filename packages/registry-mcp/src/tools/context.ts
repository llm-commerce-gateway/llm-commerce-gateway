/**
 * Tool execution context — store + auth for OSS discovery tools.
 * Replaces RegistryMCPContext for tools that use RegistryStore + RegistryAuthContext.
 */

import type { RegistryStore } from '../store/interfaces.js';
import type { RegistryAuthContext } from '../auth/interfaces.js';

export interface RegistryToolContext {
  store: RegistryStore;
  auth: RegistryAuthContext;
}

/** Map Prisma-style status to OSS Gateway status */
export function normalizeStatus(
  status?: string,
): 'active' | 'suspended' | 'inactive' | undefined {
  if (!status) return undefined;
  const s = status.toUpperCase();
  if (s === 'ACTIVE') return 'active';
  if (s === 'SUSPENDED') return 'suspended';
  if (s === 'PENDING') return 'inactive';
  return undefined;
}

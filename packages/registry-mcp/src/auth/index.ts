/**
 * Auth module — interfaces and implementations for registry-mcp.
 *
 * @module registry-mcp/auth
 */

export { StaticAuthProvider } from './static.js';
export type { StaticAuthProviderConfig } from './static.js';

export type {
  RegistryAuthContext,
  RegistryPermissions,
  RegistryAuthProvider,
} from './interfaces.js';

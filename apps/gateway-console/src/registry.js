/**
 * Registry URL resolution and health check for the gateway console.
 * Used by the /api/status route. Extracted for testability.
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_REGISTRY_URL = "https://registry.betterdata.co";
const HEALTH_ENDPOINT = "/.well-known/commerce-gateway.json";
const REQUEST_TIMEOUT_MS = 5000;

async function checkGatewayConnectivityWithFallback(registryUrl) {
  try {
    const module = await import("@betterdata/commerce-gateway/registry");
    return module.checkGatewayConnectivity(registryUrl);
  } catch {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${registryUrl}${HEALTH_ENDPOINT}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return {
          reachable: false,
          error: `Connectivity check failed with HTTP ${response.status}`,
        };
      }
      const payload = await response.json();
      return {
        reachable: true,
        gatewayVersion: payload?.gateway?.version ?? payload?.version,
        schemaVersion: payload?.version,
        capabilities: payload?.gateway?.capabilities
          ? Object.keys(payload.gateway.capabilities).filter(
              (key) => Boolean(payload.gateway.capabilities[key])
            )
          : [],
      };
    } catch (error) {
      return {
        reachable: false,
        error: error instanceof Error ? error.message : "Connectivity check failed",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Resolve registry URL: env var > config file > default.
 * @returns {string} Registry base URL (no trailing slash)
 */
export function getRegistryUrl() {
  if (process.env.REGISTRY_URL && process.env.REGISTRY_URL.trim() !== "") {
    return process.env.REGISTRY_URL.replace(/\/$/, "");
  }
  try {
    const configPath = path.join(process.cwd(), "gateway.config.json");
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.registryUrl && typeof config.registryUrl === "string") {
      return config.registryUrl.replace(/\/$/, "");
    }
  } catch {
    // Config file doesn't exist or isn't valid — fall through
  }
  return DEFAULT_REGISTRY_URL;
}

/**
 * @typedef {'connected' | 'disconnected' | 'checking'} ConnectionState
 *
 * @typedef {object} RegistryStatus
 * @property {ConnectionState} state
 * @property {string} registryUrl
 * @property {string} lastChecked - ISO timestamp
 * @property {string|null} lastSuccessful - ISO timestamp of last successful check
 * @property {object|null} gatewayMetadata
 * @property {string} gatewayMetadata.name
 * @property {string} gatewayMetadata.version
 * @property {string|null} gatewayMetadata.tenantId
 * @property {string|null} error
 */

/**
 * Check registry health by fetching the well-known endpoint.
 * @param {string} registryUrl - Base URL (no trailing slash)
 * @returns {Promise<RegistryStatus>}
 */
export async function checkRegistryHealth(registryUrl) {
  const url = `${registryUrl}${HEALTH_ENDPOINT}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const connectivity = await checkGatewayConnectivityWithFallback(registryUrl);
    if (!connectivity.reachable) {
      return {
        state: "disconnected",
        registryUrl,
        lastChecked: new Date().toISOString(),
        lastSuccessful: null,
        gatewayMetadata: null,
        error: connectivity.error ?? "Unknown connectivity error",
      };
    }

    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json();

    return {
      state: "connected",
      registryUrl,
      lastChecked: new Date().toISOString(),
      lastSuccessful: new Date().toISOString(),
      gatewayMetadata: {
        name: data.gateway?.name ?? data.name ?? "Unknown",
        version: connectivity.gatewayVersion ?? data.gateway?.version ?? "Unknown",
        schemaVersion: connectivity.schemaVersion ?? "Unknown",
        capabilities: connectivity.capabilities ?? [],
        tenantId: data.gateway?.tenantId ?? null,
      },
      error: null,
    };
  } catch (err) {
    return {
      state: "disconnected",
      registryUrl,
      lastChecked: new Date().toISOString(),
      lastSuccessful: null,
      gatewayMetadata: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

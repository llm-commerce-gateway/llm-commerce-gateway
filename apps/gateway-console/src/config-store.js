import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CONFIG_FILE_NAME = "gateway.config.json";

export function getConfigPath() {
  return path.join(process.cwd(), CONFIG_FILE_NAME);
}

function readRawConfig() {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeProviders(config) {
  if (Array.isArray(config.providers)) {
    return config.providers.map((provider) => ({
      id: provider.id ?? crypto.randomUUID(),
      type: provider.type ?? provider.provider ?? "custom",
      model: provider.model ?? "",
      apiKey: provider.apiKey ?? "",
      status: provider.status ?? "configured",
      createdAt: provider.createdAt ?? new Date().toISOString(),
      lastCheckedAt: provider.lastCheckedAt ?? null,
    }));
  }
  return [];
}

function normalizeConnectors(config) {
  if (Array.isArray(config.connectors)) {
    return config.connectors.map((connector) => ({
      id: connector.id ?? crypto.randomUUID(),
      type: connector.type ?? "manual",
      status: connector.status ?? "configured",
      config: connector.config ?? {},
      createdAt: connector.createdAt ?? new Date().toISOString(),
      lastCheckedAt: connector.lastCheckedAt ?? null,
      lastSyncAt: connector.lastSyncAt ?? null,
    }));
  }

  if (config.backends?.connectors && typeof config.backends.connectors === "object") {
    return Object.entries(config.backends.connectors).map(([type, value]) => ({
      id: crypto.randomUUID(),
      type,
      status: "configured",
      config: value ?? {},
      createdAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastSyncAt: null,
    }));
  }

  return [];
}

function normalizeKeys(config) {
  if (Array.isArray(config.console?.keys)) {
    return config.console.keys.map((key) => ({
      id: key.id ?? crypto.randomUUID(),
      name: key.name ?? "Gateway key",
      environment: key.environment ?? "live",
      keyHash: key.keyHash ?? "",
      keyPrefix: key.keyPrefix ?? "bd_gw_live_",
      last4: key.last4 ?? null,
      status: key.status ?? "active",
      createdAt: key.createdAt ?? new Date().toISOString(),
      revokedAt: key.revokedAt ?? null,
      lastUsedAt: key.lastUsedAt ?? null,
      usageCount: typeof key.usageCount === "number" ? key.usageCount : 0,
    }));
  }
  return [];
}

export function readGatewayConsoleConfig() {
  const config = readRawConfig();
  return {
    config,
    providers: normalizeProviders(config),
    connectors: normalizeConnectors(config),
    keys: normalizeKeys(config),
    telemetryEnabled: isTelemetryEnabled(config),
    // Registration fields — populated after registering at
    // https://registry.betterdata.co/register
    // claimToken: verify ownership; keep this value secure
    // registryGatewayId: your gateway's stable registry identifier
    claimToken: typeof config.claimToken === "string" ? config.claimToken : undefined,
    registryGatewayId:
      typeof config.registryGatewayId === "string" ? config.registryGatewayId : undefined,
    registryBrandSlug:
      typeof config.registryBrandSlug === "string" ? config.registryBrandSlug : undefined,
    registrationTimestamp:
      typeof config.registrationTimestamp === "string" ? config.registrationTimestamp : undefined,
    environment: typeof config.environment === "string" ? config.environment : undefined,
  };
}

export function writeGatewayConsoleConfig(config) {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function persistProviders(nextProviders) {
  const { config } = readGatewayConsoleConfig();
  const nextConfig = {
    ...config,
    providers: nextProviders,
  };
  writeGatewayConsoleConfig(nextConfig);
  return nextProviders;
}

export function persistConnectors(nextConnectors) {
  const { config } = readGatewayConsoleConfig();
  const backends = typeof config.backends === "object" && config.backends ? { ...config.backends } : {};
  const connectorsObject = {};

  for (const connector of nextConnectors) {
    if (connector.status !== "disconnected") {
      connectorsObject[connector.type] = connector.config ?? {};
    }
  }

  const nextConfig = {
    ...config,
    connectors: nextConnectors,
    backends: {
      ...backends,
      connectors: connectorsObject,
    },
  };
  writeGatewayConsoleConfig(nextConfig);
  return nextConnectors;
}

export function persistKeys(nextKeys) {
  const { config } = readGatewayConsoleConfig();
  const consoleSection =
    typeof config.console === "object" && config.console ? { ...config.console } : {};
  const nextConfig = {
    ...config,
    console: {
      ...consoleSection,
      keys: nextKeys,
    },
  };
  writeGatewayConsoleConfig(nextConfig);
  return nextKeys;
}

export function isTelemetryEnabled(config) {
  const envValue = process.env.TELEMETRY_ENABLED;
  if (envValue) {
    const normalized = String(envValue).toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes") {
      return true;
    }
  }
  return Boolean(config?.telemetry?.enabled);
}

export function hashKey(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateGatewayKey(environment) {
  const prefix = environment === "test" ? "bd_gw_test_" : "bd_gw_live_";
  const randomPart = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${prefix}${randomPart}`;
  return {
    plaintext,
    keyPrefix: prefix,
    last4: plaintext.slice(-4),
    keyHash: hashKey(plaintext),
  };
}

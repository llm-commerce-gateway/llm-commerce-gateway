import { NextResponse } from "next/server";
import { readGatewayConsoleConfig } from "../../../src/config-store.js";

/**
 * Read gateway.config.json and return sanitized config for read-only display.
 * Returns empty arrays if file doesn't exist or isn't valid.
 */
export async function GET() {
  const {
    providers,
    connectors,
    keys,
    telemetryEnabled,
    claimToken,
    registryGatewayId,
    registryBrandSlug,
    registrationTimestamp,
    environment,
  } = readGatewayConsoleConfig();
  return NextResponse.json({
    providers: providers.map((provider) => ({
      name: provider.type,
      configured: Boolean(provider.apiKey),
      model: provider.model,
      status: provider.status,
    })),
    connectors: connectors.map((connector) => ({
      type: connector.type,
      configured: Boolean(connector.config && Object.keys(connector.config).length > 0),
      status: connector.status,
    })),
    keys: keys.map((key) => ({
      name: key.name,
      environment: key.environment,
      status: key.status,
    })),
    telemetryEnabled,
    claimToken,
    registryGatewayId,
    registryBrandSlug,
    registrationTimestamp,
    environment,
  });
}

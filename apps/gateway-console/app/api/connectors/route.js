import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  persistConnectors,
  readGatewayConsoleConfig,
} from "../../../src/config-store.js";

function sanitizeConnector(connector) {
  return {
    id: connector.id,
    type: connector.type,
    status: connector.status,
    config: connector.config ?? {},
    createdAt: connector.createdAt,
    lastCheckedAt: connector.lastCheckedAt,
    lastSyncAt: connector.lastSyncAt,
  };
}

function connectorConnectionLooksValid(type, config) {
  if (type === "shopify") {
    return Boolean(config.storeUrl && config.apiKey);
  }
  if (type === "woocommerce") {
    return Boolean(config.storeUrl && config.consumerKey && config.consumerSecret);
  }
  if (type === "csv") {
    return Boolean(config.fileName);
  }
  if (type === "manual") {
    return true;
  }
  if (type === "betterdata_catalog") {
    return true;
  }
  return false;
}

export async function GET() {
  const { connectors } = readGatewayConsoleConfig();
  return NextResponse.json({
    connectors: connectors.map(sanitizeConnector),
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action = "save" } = body;
    const { connectors } = readGatewayConsoleConfig();

    if (action === "test") {
      const ok = connectorConnectionLooksValid(body.type, body.config ?? {});
      return NextResponse.json({
        ok,
        message: ok
          ? "Connection test passed (local validation)."
          : "Connection test failed. Missing required connector fields.",
      });
    }

    if (action === "remove") {
      if (!body.id) {
        return NextResponse.json({ error: "Connector id is required." }, { status: 400 });
      }
      const nextConnectors = connectors.filter((connector) => connector.id !== body.id);
      persistConnectors(nextConnectors);
      return NextResponse.json({ connectors: nextConnectors.map(sanitizeConnector) });
    }

    if (action === "sync") {
      if (!body.id) {
        return NextResponse.json({ error: "Connector id is required." }, { status: 400 });
      }
      const nextConnectors = connectors.map((connector) =>
        connector.id === body.id
          ? {
              ...connector,
              status: "synced",
              lastSyncAt: new Date().toISOString(),
            }
          : connector
      );
      persistConnectors(nextConnectors);
      return NextResponse.json({ connectors: nextConnectors.map(sanitizeConnector) });
    }

    if (!body.type) {
      return NextResponse.json({ error: "type is required." }, { status: 400 });
    }

    const normalizedConfig = body.config ?? {};
    const existing = connectors.find((connector) => connector.id === body.id);
    const connector = {
      id: existing?.id ?? crypto.randomUUID(),
      type: body.type,
      status: body.status ?? "configured",
      config: normalizedConfig,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      lastSyncAt: existing?.lastSyncAt ?? null,
    };

    const nextConnectors = existing
      ? connectors.map((item) => (item.id === existing.id ? connector : item))
      : [connector, ...connectors];

    persistConnectors(nextConnectors);
    return NextResponse.json({
      connectors: nextConnectors.map(sanitizeConnector),
      configOutput: {
        env: [
          `GATEWAY_CONNECTOR_TYPE=${connector.type}`,
          `GATEWAY_CONNECTOR_CONFIG=${JSON.stringify(connector.config)}`,
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}

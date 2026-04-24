import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  generateGatewayKey,
  persistKeys,
  readGatewayConsoleConfig,
} from "../../../src/config-store.js";

function sanitizeKey(key, telemetryEnabled) {
  return {
    id: key.id,
    name: key.name,
    environment: key.environment,
    keyPrefix: `${key.keyPrefix}...${key.last4 ?? ""}`,
    status: key.status,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    usageCount: telemetryEnabled ? key.usageCount : null,
  };
}

export async function GET() {
  const { keys, telemetryEnabled } = readGatewayConsoleConfig();
  return NextResponse.json({
    telemetryEnabled,
    keys: keys.map((key) => sanitizeKey(key, telemetryEnabled)),
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action = "generate" } = body;
    const { keys, telemetryEnabled } = readGatewayConsoleConfig();

    if (action === "revoke") {
      if (!body.id) {
        return NextResponse.json({ error: "Key id is required." }, { status: 400 });
      }
      const nextKeys = keys.map((key) =>
        key.id === body.id
          ? {
              ...key,
              status: "revoked",
              revokedAt: new Date().toISOString(),
            }
          : key
      );
      persistKeys(nextKeys);
      return NextResponse.json({
        telemetryEnabled,
        keys: nextKeys.map((key) => sanitizeKey(key, telemetryEnabled)),
      });
    }

    if (!body.name || !body.environment) {
      return NextResponse.json(
        { error: "name and environment are required." },
        { status: 400 }
      );
    }

    const generated = generateGatewayKey(body.environment);
    const newKey = {
      id: crypto.randomUUID(),
      name: body.name,
      environment: body.environment,
      keyHash: generated.keyHash,
      keyPrefix: generated.keyPrefix,
      last4: generated.last4,
      status: "active",
      createdAt: new Date().toISOString(),
      revokedAt: null,
      lastUsedAt: null,
      usageCount: 0,
    };

    const nextKeys = [newKey, ...keys];
    persistKeys(nextKeys);

    return NextResponse.json({
      telemetryEnabled,
      key: sanitizeKey(newKey, telemetryEnabled),
      plaintext: generated.plaintext,
      keys: nextKeys.map((key) => sanitizeKey(key, telemetryEnabled)),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  persistProviders,
  readGatewayConsoleConfig,
} from "../../../src/config-store.js";

function sanitizeProvider(provider) {
  return {
    id: provider.id,
    type: provider.type,
    model: provider.model,
    status: provider.status,
    hasApiKey: Boolean(provider.apiKey),
    keyLast4: provider.apiKey ? provider.apiKey.slice(-4) : null,
    createdAt: provider.createdAt,
    lastCheckedAt: provider.lastCheckedAt,
  };
}

function providerConnectionLooksValid(type, apiKey) {
  if (!apiKey || typeof apiKey !== "string") return false;
  if (type === "claude") return apiKey.startsWith("sk-ant-");
  if (type === "openai") return apiKey.startsWith("sk-");
  if (type === "gemini") return apiKey.startsWith("AIza");
  return apiKey.length >= 8;
}

export async function GET() {
  const { providers } = readGatewayConsoleConfig();
  return NextResponse.json({
    providers: providers.map(sanitizeProvider),
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action = "save" } = body;
    const { providers } = readGatewayConsoleConfig();

    if (action === "test") {
      const valid = providerConnectionLooksValid(body.type, body.apiKey);
      return NextResponse.json({
        ok: valid,
        message: valid
          ? "Connection test passed (format validation)."
          : "Connection test failed. Check provider type and key format.",
      });
    }

    if (action === "remove") {
      if (!body.id) {
        return NextResponse.json({ error: "Provider id is required." }, { status: 400 });
      }
      const nextProviders = providers.filter((provider) => provider.id !== body.id);
      persistProviders(nextProviders);
      return NextResponse.json({ providers: nextProviders.map(sanitizeProvider) });
    }

    if (!body.type || !body.model || !body.apiKey) {
      return NextResponse.json(
        { error: "type, model, and apiKey are required." },
        { status: 400 }
      );
    }

    const existing = providers.find((provider) => provider.id === body.id);
    const provider = {
      id: existing?.id ?? crypto.randomUUID(),
      type: body.type,
      model: body.model,
      apiKey: body.apiKey,
      status: "configured",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
    };

    const nextProviders = existing
      ? providers.map((item) => (item.id === existing.id ? provider : item))
      : [provider, ...providers];

    persistProviders(nextProviders);
    return NextResponse.json({
      providers: nextProviders.map(sanitizeProvider),
      configOutput: {
        env: [
          `GATEWAY_PROVIDER_TYPE=${provider.type}`,
          `GATEWAY_PROVIDER_MODEL=${provider.model}`,
          `GATEWAY_PROVIDER_API_KEY=${provider.apiKey}`,
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}

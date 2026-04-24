import { NextResponse } from "next/server";
import { getStatusData } from "../../../src/status.js";
import { getRegistryUrl, checkRegistryHealth } from "../../../src/registry.js";

export async function GET() {
  const statusData = getStatusData();
  const registryUrl = getRegistryUrl();
  const registryHealth = await checkRegistryHealth(registryUrl);

  return NextResponse.json({
    ...statusData,
    registryConnected: registryHealth.state === "connected",
    registryHealth,
  });
}

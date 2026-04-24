import { NextResponse } from "next/server";
import { buildTelemetryPreview } from "../../../../src/telemetry.js";

export async function GET() {
  return NextResponse.json(buildTelemetryPreview());
}

/**
 * Status data for the gateway console. Used by the /api/status route.
 * Extracted for testability without Next.js route handler import.
 */
export function getStatusData() {
  return {
    gatewayVersion: "v0.1.0",
    uptimeSeconds: Math.floor(process.uptime()),
    p95LatencyMs: 420,
    errorRatePct: 0.6,
    registryConnected: true,
    federationEnabled: false,
    peers: 0,
    stalePeers: 0,
  };
}

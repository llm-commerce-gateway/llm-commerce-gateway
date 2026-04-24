"use client";

import { useEffect, useState, useCallback } from "react";
import type { JSX } from "react";

type ConnectionState = "connected" | "disconnected" | "checking";

interface RegistryHealth {
  state: ConnectionState;
  registryUrl: string;
  lastChecked: string;
  lastSuccessful: string | null;
  gatewayMetadata: {
    name: string;
    version: string;
    schemaVersion?: string;
    capabilities?: string[];
    tenantId: string | null;
  } | null;
  error: string | null;
}

interface StatusData {
  gatewayVersion: string;
  uptimeSeconds: number;
  p95LatencyMs: number;
  errorRatePct: number;
  registryConnected: boolean;
  federationEnabled: boolean;
  peers: number;
  stalePeers: number;
  registryHealth?: RegistryHealth;
}

function formatRelativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  return `${hr} hour${hr === 1 ? "" : "s"} ago`;
}

export default function StatusPage(): JSX.Element {
  const baseUrl =
    typeof window !== "undefined"
      ? ""
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3012";
  const [data, setData] = useState<StatusData | null>(null);
  const [checking, setChecking] = useState(true);
  const [lastSuccessful, setLastSuccessful] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch(`${baseUrl}/api/status`, { cache: "no-store" });
      const json = (await res.json()) as StatusData;
      setData(json);
      if (json.registryHealth?.state === "connected" && json.registryHealth.lastSuccessful) {
        setLastSuccessful(json.registryHealth.lastSuccessful);
      }
    } finally {
      setChecking(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const displayState: ConnectionState =
    checking && !data ? "checking" : (data?.registryHealth?.state ?? "disconnected");
  const effectiveLastSuccessful = data?.registryHealth?.lastSuccessful ?? lastSuccessful;

  return (
    <main className="container">
      <h1>Status</h1>
      <p className="muted">Local gateway health and registry connection.</p>

      {data && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span
              className={displayState === "checking" ? "status-dot-checking" : ""}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background:
                  displayState === "connected"
                    ? "#22c55e"
                    : displayState === "disconnected"
                      ? "#ef4444"
                      : "#eab308",
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {displayState === "connected"
                ? "Connected"
                : displayState === "disconnected"
                  ? "Disconnected"
                  : "Checking..."}
            </span>
            <button
              type="button"
              className="button"
              onClick={() => void fetchStatus()}
              disabled={checking}
            >
              Check Now
            </button>
          </div>

          {data.registryHealth && (
            <div className="card-grid" style={{ marginBottom: 16 }}>
              <div>
                <div className="muted">Registry URL</div>
                <div style={{ fontSize: 13, wordBreak: "break-all" }}>
                  {data.registryHealth.registryUrl}
                </div>
              </div>
              {effectiveLastSuccessful && (
                <div>
                  <div className="muted">Last successful check</div>
                  <div>{formatRelativeTime(effectiveLastSuccessful)}</div>
                </div>
              )}
              {data.registryHealth.state === "connected" && data.registryHealth.gatewayMetadata && (
                <>
                  <div>
                    <div className="muted">Gateway name</div>
                    <div>{data.registryHealth.gatewayMetadata.name}</div>
                  </div>
                  <div>
                    <div className="muted">Gateway version</div>
                    <div>{data.registryHealth.gatewayMetadata.version}</div>
                  </div>
                  <div>
                    <div className="muted">Tenant ID</div>
                    <div>
                      {data.registryHealth.gatewayMetadata.tenantId ?? "Not registered"}
                    </div>
                  </div>
                </>
              )}
              {data.registryHealth.state === "disconnected" && data.registryHealth.error && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="muted">Error</div>
                  <div style={{ color: "#dc2626", fontSize: 13 }}>
                    {data.registryHealth.error}
                  </div>
                </div>
              )}
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "16px 0" }} />

          <div className="card-grid">
            <div>
              <div className="muted">Gateway Version</div>
              <div>{data.gatewayVersion}</div>
            </div>
            <div>
              <div className="muted">Uptime</div>
              <div>{data.uptimeSeconds}s</div>
            </div>
            <div>
              <div className="muted">p95 Latency</div>
              <div>{data.p95LatencyMs} ms</div>
            </div>
            <div>
              <div className="muted">Error Rate</div>
              <div>{data.errorRatePct}%</div>
            </div>
            <div>
              <div className="muted">Federation Enabled</div>
              <div>{data.federationEnabled ? "Yes" : "No"}</div>
            </div>
            <div>
              <div className="muted">Peers</div>
              <div>{data.peers}</div>
            </div>
            <div>
              <div className="muted">Stale Peers</div>
              <div>{data.stalePeers}</div>
            </div>
          </div>
        </div>
      )}

      {!data && !checking && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted">Unable to load status. Check the console for errors.</p>
        </div>
      )}
    </main>
  );
}

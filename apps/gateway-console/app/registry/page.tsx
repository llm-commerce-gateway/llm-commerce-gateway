"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

type ConnectionState = "connected" | "disconnected" | "checking";

interface RegistryStatusResponse {
  registryHealth?: {
    state: ConnectionState;
    registryUrl: string;
    gatewayMetadata: {
      name: string;
      version: string;
      schemaVersion?: string;
      capabilities?: string[];
      tenantId: string | null;
    } | null;
    error: string | null;
  };
}

interface GatewayConfigResponse {
  claimToken?: string;
  registryGatewayId?: string;
  registryBrandSlug?: string;
  registrationTimestamp?: string;
  environment?: string;
}

interface SearchResultItem {
  id: string;
  brandName?: string;
  name?: string;
  domain?: string;
  status?: string;
  environment?: string;
  verified?: boolean;
}

function toBrandSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function RegistryPage(): JSX.Element {
  const [status, setStatus] = useState<RegistryStatusResponse | null>(null);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfigResponse | null>(null);
  const [checking, setChecking] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);

  const loadStatus = async () => {
    setChecking(true);
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }),
        fetch("/api/gateway-config", { cache: "no-store" }),
      ]);
      const statusJson = (await statusRes.json()) as RegistryStatusResponse;
      const configJson = (await configRes.json()) as GatewayConfigResponse;
      setStatus(statusJson);
      setGatewayConfig(configJson);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const connectionState: ConnectionState =
    checking && !status ? "checking" : (status?.registryHealth?.state ?? "disconnected");

  const brandSlug = useMemo(() => {
    if (!gatewayConfig) return null;
    if (gatewayConfig.registryBrandSlug) return gatewayConfig.registryBrandSlug;
    if (gatewayConfig.registryGatewayId) return toBrandSlug(gatewayConfig.registryGatewayId);
    return null;
  }, [gatewayConfig]);

  const isRegistered =
    Boolean(gatewayConfig?.claimToken) && Boolean(gatewayConfig?.registryGatewayId);

  const runSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(
        `https://registry.betterdata.co/api/registry/public/search?q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as { results?: SearchResultItem[] };
      setSearchResults(Array.isArray(payload.results) ? payload.results : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="container">
      <h1>Registry</h1>
      <p className="muted">Single-tenant registry configuration and health.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Registry connection status</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <span style={{ fontWeight: 600 }}>
            {connectionState === "connected" && "CONNECTED"}
            {connectionState === "disconnected" && "DISCONNECTED"}
            {connectionState === "checking" && "CHECKING"}
          </span>
          <button type="button" className="button" disabled={checking} onClick={() => void loadStatus()}>
            {checking ? "Checking..." : "Check now"}
          </button>
        </div>
        <div className="card-grid" style={{ marginTop: 12 }}>
          <div>
            <div className="muted">Registry URL</div>
            <div>{status?.registryHealth?.registryUrl ?? "https://registry.betterdata.co"}</div>
          </div>
          <div>
            <div className="muted">Registry version</div>
            <div>{status?.registryHealth?.gatewayMetadata?.version ?? "Unknown"}</div>
          </div>
          <div>
            <div className="muted">Schema version</div>
            <div>{status?.registryHealth?.gatewayMetadata?.schemaVersion ?? "Unknown"}</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted">Supported capabilities</div>
          <div>
            {status?.registryHealth?.gatewayMetadata?.capabilities?.length
              ? status.registryHealth.gatewayMetadata.capabilities.join(", ")
              : "None reported"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Gateway registration status</h3>
        {isRegistered ? (
          <div className="card-grid" style={{ marginTop: 10 }}>
            <div>
              <div className="muted">Gateway ID</div>
              <div>{gatewayConfig?.registryGatewayId}</div>
            </div>
            <div>
              <div className="muted">Registration timestamp</div>
              <div>{gatewayConfig?.registrationTimestamp ?? "Unknown"}</div>
            </div>
            <div>
              <div className="muted">Environment</div>
              <div>{gatewayConfig?.environment ?? "Unknown"}</div>
            </div>
            <div>
              <div className="muted">Status</div>
              <div>Registered and claimed</div>
            </div>
            {brandSlug ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <a
                  href={`https://registry.betterdata.co/brand/${brandSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#2563eb" }}
                >
                  Open registry listing
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p style={{ marginTop: 10 }}>
              Registering your gateway makes it discoverable in the Better Data registry network.
              It enables federation connectivity and trust verification with other gateways.
            </p>
            <div style={{ marginTop: 12 }}>
              <a
                href="https://registry.betterdata.co/register"
                target="_blank"
                rel="noreferrer"
                className="button"
              >
                Register your gateway →
              </a>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary>Why register?</summary>
              <ul>
                <li>Discovery by other operators in the network</li>
                <li>Trust scoring and verification eligibility</li>
                <li>Federation connectivity (upcoming)</li>
              </ul>
            </details>
          </>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Registry discovery</h3>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search for gateways in the registry network"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
          />
          <button type="button" className="button" onClick={() => void runSearch()} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchResults.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Search for gateways in the registry network
          </p>
        ) : (
          <ul style={{ marginTop: 12, paddingLeft: 18 }}>
            {searchResults.map((item) => (
              <li key={item.id} style={{ marginBottom: 8 }}>
                <strong>{item.brandName ?? item.name ?? item.id}</strong> ·{" "}
                {item.domain ?? "unknown domain"} · {item.environment ?? "unknown env"} ·{" "}
                {item.verified || item.status === "verified" ? "Verified" : "Unverified"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

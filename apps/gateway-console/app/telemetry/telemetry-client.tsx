"use client";

import { useEffect, useState } from "react";

type TelemetryPreview = {
  schema_version: string;
  timestamp: string;
  gateway: {
    version: string;
    runtime: string;
    runtime_version: string;
    deployment: string;
    uptime_seconds: number;
  };
  features: {
    registry_enabled: boolean;
    federation_enabled: boolean;
    streaming_enabled: boolean;
  };
  usage: {
    request_count_session: number;
    tool_invocations_session: number;
    providers_used: string[];
    tool_count: number;
  };
  health: {
    error_rate_pct: number;
    p95_latency_ms: number;
  };
};

export function TelemetryClient() {
  const [enabled, setEnabled] = useState(false);
  const [preview, setPreview] = useState<TelemetryPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/telemetry/preview");
        const data = (await res.json()) as TelemetryPreview;
        setPreview(data);
      } finally {
        setLoading(false);
      }
    };

    void loadPreview();
  }, []);

  return (
    <div className="card">
      <h3>Telemetry</h3>
      <p className="muted">Telemetry is OFF by default in OSS mode.</p>

      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        <span>Telemetry: {enabled ? "ON" : "OFF (default)"}</span>
      </label>

      <div style={{ marginTop: 16 }}>
        <div className="badge">Preview (local only)</div>
        {loading ? (
          <p className="muted">Loading preview...</p>
        ) : preview ? (
          <pre style={{ fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        ) : (
          <p className="muted">No preview available.</p>
        )}
      </div>
    </div>
  );
}

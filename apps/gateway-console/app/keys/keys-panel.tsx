"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

interface KeyItem {
  id: string;
  name: string;
  environment: "live" | "test";
  keyPrefix: string;
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number | null;
}

export function KeysPanel(): JSX.Element {
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    environment: "live" as "live" | "test",
  });

  const loadKeys = async () => {
    setLoading(true);
    await fetch("/api/keys")
      .then((res) => res.json())
      .then((data: { telemetryEnabled: boolean; keys: KeyItem[] }) => {
        setTelemetryEnabled(Boolean(data.telemetryEnabled));
        setKeys(data.keys ?? []);
      })
      .catch(() => {
        setTelemetryEnabled(false);
        setKeys([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadKeys();
  }, []);

  const handleGenerate = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          name: form.name || "Gateway key",
          environment: form.environment,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to generate key");
      }
      setKeys(json.keys ?? []);
      setTelemetryEnabled(Boolean(json.telemetryEnabled));
      setNewKeyValue(json.plaintext ?? null);
      setMessage("Key generated. Copy it now.");
      setForm({ name: "", environment: "live" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to generate key");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          id,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to revoke key");
      }
      setKeys(json.keys ?? []);
      setTelemetryEnabled(Boolean(json.telemetryEnabled));
      setMessage("Key revoked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to revoke key");
    } finally {
      setSaving(false);
    }
  };

  const copyNewKey = async () => {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setMessage("Key copied to clipboard.");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Generate key</h3>
        <p className="muted">Gateway API keys are stored locally in your gateway config.</p>

        <div className="card-grid" style={{ marginTop: 12 }}>
          <label>
            <div className="muted">Key name</div>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
              placeholder="CI service"
            />
          </label>
          <label>
            <div className="muted">Environment</div>
            <select
              value={form.environment}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  environment: event.target.value as "live" | "test",
                }))
              }
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              <option value="live">Live</option>
              <option value="test">Test</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="button" className="button" onClick={handleGenerate} disabled={saving}>
            {saving ? "Generating..." : "Generate key"}
          </button>
        </div>

        {message ? <p className="muted" style={{ marginTop: 10 }}>{message}</p> : null}
      </div>

      {newKeyValue ? (
        <div className="card" style={{ marginTop: 16, borderColor: "#f59e0b", background: "#fffbeb" }}>
          <h3 style={{ marginTop: 0, color: "#92400e" }}>Copy key now</h3>
          <p className="muted" style={{ color: "#92400e" }}>
            This key is only shown once. Store it securely before closing this panel.
          </p>
          <pre
            style={{
              marginTop: 8,
              background: "#fff",
              border: "1px solid #fcd34d",
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
{newKeyValue}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="button" onClick={copyNewKey}>
              Copy
            </button>
            <button type="button" className="button" onClick={() => setNewKeyValue(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Configured keys</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : keys.length === 0 ? (
          <p className="muted">No gateway keys yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 4px" }}>Name</th>
                <th style={{ padding: "8px 4px" }}>Prefix</th>
                <th style={{ padding: "8px 4px" }}>Environment</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Usage</th>
                <th style={{ padding: "8px 4px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 4px" }}>{key.name}</td>
                  <td style={{ padding: "8px 4px" }}>{key.keyPrefix}</td>
                  <td style={{ padding: "8px 4px", textTransform: "capitalize" }}>{key.environment}</td>
                  <td style={{ padding: "8px 4px" }}>{key.status}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {telemetryEnabled ? key.usageCount ?? 0 : "Enable telemetry to view usage"}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void handleRevoke(key.id)}
                      disabled={saving || key.status === "revoked"}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

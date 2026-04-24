"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

interface ConnectorItem {
  id: string;
  type: string;
  status: string;
  config: Record<string, string>;
  createdAt: string;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
}

export function ConnectorsList(): JSX.Element {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [configOutput, setConfigOutput] = useState<string[]>([]);
  const [form, setForm] = useState({
    id: "",
    type: "shopify",
    storeUrl: "",
    apiKey: "",
    consumerKey: "",
    consumerSecret: "",
    fileName: "",
    endpoint: "",
  });

  const loadConnectors = async () => {
    setLoading(true);
    await fetch("/api/connectors")
      .then((res) => res.json())
      .then((data: { connectors: ConnectorItem[] }) => {
        setConnectors(data.connectors ?? []);
      })
      .catch(() => setConnectors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadConnectors();
  }, []);

  const connectorConfig = () => {
    if (form.type === "shopify") {
      return {
        storeUrl: form.storeUrl,
        apiKey: form.apiKey,
      };
    }
    if (form.type === "woocommerce") {
      return {
        storeUrl: form.storeUrl,
        consumerKey: form.consumerKey,
        consumerSecret: form.consumerSecret,
      };
    }
    if (form.type === "csv") {
      return {
        fileName: form.fileName,
      };
    }
    if (form.type === "manual") {
      return { source: "manual" };
    }
    if (form.type === "betterdata_catalog") {
      return { source: "betterdata_catalog" };
    }
    return { endpoint: form.endpoint };
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          id: form.id || undefined,
          type: form.type,
          status: "configured",
          config: connectorConfig(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save connector");
      }
      setConnectors(json.connectors ?? []);
      setConfigOutput(json.configOutput?.env ?? []);
      setMessage("Connector saved.");
      setForm({
        id: "",
        type: "shopify",
        storeUrl: "",
        apiKey: "",
        consumerKey: "",
        consumerSecret: "",
        fileName: "",
        endpoint: "",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save connector");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          type: form.type,
          config: connectorConfig(),
        }),
      });
      const json = await res.json();
      setMessage(json.message ?? (json.ok ? "Connection test passed." : "Connection test failed."));
    } catch {
      setMessage("Connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async (id: string) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove connector");
      setConnectors(json.connectors ?? []);
      setMessage("Connector removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove connector");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (id: string) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to sync connector");
      setConnectors(json.connectors ?? []);
      setMessage("Sync completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to sync connector");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (connector: ConnectorItem) => {
    setForm({
      id: connector.id,
      type: connector.type,
      storeUrl: connector.config.storeUrl ?? "",
      apiKey: "",
      consumerKey: connector.config.consumerKey ?? "",
      consumerSecret: connector.config.consumerSecret ?? "",
      fileName: connector.config.fileName ?? "",
      endpoint: connector.config.endpoint ?? "",
    });
    setMessage("Editing connector. Enter updated credentials if needed.");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add / Update connector</h3>
        <p className="muted">Connect local gateway data sources for querying products.</p>

        <div className="card-grid" style={{ marginTop: 12 }}>
          <label>
            <div className="muted">Connector type</div>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              <option value="shopify">Shopify</option>
              <option value="woocommerce">WooCommerce</option>
              <option value="csv">CSV Upload</option>
              <option value="manual">Manual Entry</option>
              <option value="betterdata_catalog">Better Data Catalog</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          {(form.type === "shopify" || form.type === "woocommerce") && (
            <label>
              <div className="muted">Store URL</div>
              <input
                value={form.storeUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, storeUrl: event.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                placeholder="https://your-store.example"
              />
            </label>
          )}

          {form.type === "shopify" && (
            <label>
              <div className="muted">API key / access token</div>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                placeholder="shpat_..."
              />
            </label>
          )}

          {form.type === "woocommerce" && (
            <>
              <label>
                <div className="muted">Consumer key</div>
                <input
                  value={form.consumerKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, consumerKey: event.target.value }))}
                  style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  placeholder="ck_..."
                />
              </label>
              <label>
                <div className="muted">Consumer secret</div>
                <input
                  type="password"
                  value={form.consumerSecret}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, consumerSecret: event.target.value }))
                  }
                  style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  placeholder="cs_..."
                />
              </label>
            </>
          )}

          {form.type === "csv" && (
            <label>
              <div className="muted">CSV file name</div>
              <input
                value={form.fileName}
                onChange={(event) => setForm((prev) => ({ ...prev, fileName: event.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                placeholder="products.csv"
              />
            </label>
          )}

          {form.type === "custom" && (
            <label>
              <div className="muted">Custom endpoint</div>
              <input
                value={form.endpoint}
                onChange={(event) => setForm((prev) => ({ ...prev, endpoint: event.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                placeholder="https://api.example.com/catalog"
              />
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="button" onClick={handleTest} disabled={testing}>
            {testing ? "Testing..." : "Test connection"}
          </button>
          <button type="button" className="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : form.id ? "Update connector" : "Add connector"}
          </button>
        </div>

        {message ? <p className="muted" style={{ marginTop: 10 }}>{message}</p> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Configured connectors</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : connectors.length === 0 ? (
          <p className="muted">No connectors in gateway config.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 4px" }}>Type</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Last sync</th>
                <th style={{ padding: "8px 4px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((connector) => (
                <tr key={connector.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 4px", textTransform: "capitalize" }}>{connector.type}</td>
                  <td style={{ padding: "8px 4px" }}>{connector.status}</td>
                  <td style={{ padding: "8px 4px" }}>{connector.lastSyncAt ?? "Never"}</td>
                  <td style={{ padding: "8px 4px", display: "flex", gap: 8 }}>
                    <button type="button" className="button" onClick={() => startEdit(connector)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void handleSync(connector.id)}
                      disabled={saving}
                    >
                      Sync now
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void handleRemove(connector.id)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Config output</h3>
        <p className="muted">Add these to your local environment or gateway config file.</p>
        <pre
          style={{
            marginTop: 8,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
{configOutput.length > 0
  ? configOutput.join("\n")
  : 'GATEWAY_CONNECTOR_TYPE=shopify\nGATEWAY_CONNECTOR_CONFIG={"storeUrl":"https://your-store.example","apiKey":"<token>"}'}
        </pre>
      </div>
    </div>
  );
}

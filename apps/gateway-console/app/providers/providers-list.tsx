"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";

interface ProviderItem {
  id: string;
  type: string;
  model: string;
  status: string;
  hasApiKey: boolean;
  keyLast4: string | null;
  createdAt: string;
  lastCheckedAt: string | null;
}

export function ProvidersList(): JSX.Element {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    id: "",
    type: "claude",
    model: "claude-sonnet-4-20250514",
    apiKey: "",
  });
  const [configOutput, setConfigOutput] = useState<string[]>([]);

  const loadProviders = async () => {
    setLoading(true);
    await fetch("/api/providers")
      .then((res) => res.json())
      .then((data: { providers: ProviderItem[] }) => {
        setProviders(data.providers ?? []);
      })
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void loadProviders();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      action: "save",
      id: form.id || undefined,
      type: form.type,
      model: form.model,
      apiKey: form.apiKey,
    };

    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save provider");
      }
      setProviders(json.providers ?? []);
      setConfigOutput(json.configOutput?.env ?? []);
      setMessage("Provider saved.");
      setForm({
        id: "",
        type: "claude",
        model: "claude-sonnet-4-20250514",
        apiKey: "",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save provider");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          type: form.type,
          apiKey: form.apiKey,
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
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to remove provider");
      setProviders(json.providers ?? []);
      setMessage("Provider removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove provider");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (provider: ProviderItem) => {
    setForm({
      id: provider.id,
      type: provider.type,
      model: provider.model || "",
      apiKey: "",
    });
    setMessage("Editing provider. Enter a new API key to rotate credentials.");
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add / Update provider</h3>
        <p className="muted">Select provider type, model, and API key for this self-hosted gateway.</p>

        <div className="card-grid" style={{ marginTop: 12 }}>
          <label>
            <div className="muted">Provider type</div>
            <select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label>
            <div className="muted">Model</div>
            <input
              value={form.model}
              onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
              placeholder="claude-sonnet-4-20250514"
            />
          </label>
          <label>
            <div className="muted">API key</div>
            <input
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
              style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
              placeholder="Enter provider API key"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button type="button" className="button" onClick={handleTest} disabled={testing || !form.apiKey}>
            {testing ? "Testing..." : "Test connection"}
          </button>
          <button type="button" className="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : form.id ? "Update provider" : "Add provider"}
          </button>
        </div>

        {message ? <p className="muted" style={{ marginTop: 10 }}>{message}</p> : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Configured providers</h3>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : providers.length === 0 ? (
          <p className="muted">No providers configured yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 4px" }}>Type</th>
                <th style={{ padding: "8px 4px" }}>Model</th>
                <th style={{ padding: "8px 4px" }}>API key</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 4px", textTransform: "capitalize" }}>{provider.type}</td>
                  <td style={{ padding: "8px 4px" }}>{provider.model || "—"}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {provider.hasApiKey ? `••••${provider.keyLast4 ?? ""}` : "Missing"}
                  </td>
                  <td style={{ padding: "8px 4px" }}>{provider.status}</td>
                  <td style={{ padding: "8px 4px", display: "flex", gap: 8 }}>
                    <button type="button" className="button" onClick={() => startEdit(provider)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => void handleRemove(provider.id)}
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
        <p className="muted">Use these values in your environment or config file.</p>
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
  : "GATEWAY_PROVIDER_TYPE=claude\nGATEWAY_PROVIDER_MODEL=claude-sonnet-4-20250514\nGATEWAY_PROVIDER_API_KEY=<your_api_key>"}
        </pre>
      </div>
    </div>
  );
}

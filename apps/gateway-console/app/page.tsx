import type { JSX } from "react";

export default function OverviewPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Gateway Console (OSS)</h1>
      <p className="muted">
        Single-tenant operator console for self-hosted LLM Gateway deployments.
      </p>

      <div className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Status</h3>
          <p className="muted">Runtime health, latency, and error signals.</p>
          <a className="badge" href="/status">View status</a>
        </div>
        <div className="card">
          <h3>Providers</h3>
          <p className="muted">Configure LLM providers for this gateway.</p>
          <a className="badge" href="/providers">View providers</a>
        </div>
        <div className="card">
          <h3>Connectors</h3>
          <p className="muted">Manage commerce platform connectors.</p>
          <a className="badge" href="/connectors">View connectors</a>
        </div>
        <div className="card">
          <h3>Telemetry</h3>
          <p className="muted">Privacy-safe, opt-in telemetry preview.</p>
          <a className="badge" href="/telemetry">View telemetry</a>
        </div>
      </div>
    </main>
  );
}

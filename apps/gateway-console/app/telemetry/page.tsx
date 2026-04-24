import { TelemetryClient } from "./telemetry-client";

import type { JSX } from "react";

export default function TelemetryPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Telemetry (Optional)</h1>
      <p className="muted">
        Telemetry is opt-in and never sends user content. Preview is local-only.
      </p>

      <div className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>What is collected</h3>
          <ul className="muted">
            <li>Gateway version and runtime</li>
            <li>Deployment mode (self-hosted)</li>
            <li>Aggregate health signals</li>
            <li>Aggregate usage counts</li>
          </ul>
        </div>
        <div className="card">
          <h3>What is prohibited</h3>
          <ul className="muted">
            <li>Prompts or tool payloads</li>
            <li>Secrets or API keys</li>
            <li>Tenant/org identifiers</li>
            <li>Emails, domains, headers, or bodies</li>
          </ul>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <TelemetryClient />
      </div>
    </main>
  );
}

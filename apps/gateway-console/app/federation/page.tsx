import type { JSX } from "react";

export default function FederationPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Federation - Coming in v0.2</h1>
      <p className="muted">
        Federation controls for a single-tenant, self-hosted gateway.
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <p>Federation will enable:</p>
        <ul>
          <li>Discover and connect to other gateway instances in the registry network</li>
          <li>Query across federated gateways with unified credentials</li>
          <li>Trust scoring and verification across the network</li>
        </ul>
        <p className="muted" style={{ marginTop: 12 }}>
          Federation management requires a Better Data account and a registered gateway.
          Registry connectivity and discovery are available today via the Registry tab.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <a href="https://registry.betterdata.co/register" target="_blank" rel="noreferrer" className="button">
            Register your gateway to prepare for federation →
          </a>
          <a
            href="https://github.com/llm-commerce-gateway/llm-commerce-gateway/tree/main/commerce-registry-protocol/spec/resolution.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#2563eb", alignSelf: "center" }}
          >
            Read the federation protocol spec →
          </a>
        </div>
      </div>
    </main>
  );
}

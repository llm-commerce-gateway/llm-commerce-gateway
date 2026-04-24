import type { JSX } from "react";
import { KeysPanel } from "./keys-panel";

export default function KeysPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Keys</h1>
      <p className="muted">
        Generate and revoke local gateway API keys for self-hosted access.
      </p>
      <KeysPanel />
    </main>
  );
}

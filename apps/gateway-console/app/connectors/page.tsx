import type { JSX } from "react";
import { ConnectorsList } from "./connectors-list";

export default function ConnectorsPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Connectors</h1>
      <p className="muted">
        Manage commerce platform connectors (self-hosted only).
      </p>
      <ConnectorsList />
    </main>
  );
}

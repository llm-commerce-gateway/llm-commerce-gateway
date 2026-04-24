import type { JSX } from "react";
import { ProvidersList } from "./providers-list";

export default function ProvidersPage(): JSX.Element {
  return (
    <main className="container">
      <h1>Providers</h1>
      <p className="muted">
        Configure LLM providers for this single-tenant gateway instance.
      </p>
      <ProvidersList />
    </main>
  );
}

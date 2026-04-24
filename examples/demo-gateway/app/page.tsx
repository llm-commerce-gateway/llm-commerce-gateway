export default function Page() {
  return (
    <main>
      <h1>demo-gateway</h1>
      <p>
        Reference Commerce Gateway implementation. Works out of the box against a
        bundled static catalog. Swap in your own backend via{' '}
        <code>DATA_SOURCE=custom</code>.
      </p>
      <h2>Endpoints</h2>
      <ul>
        <li>
          <code>POST /api/gateway/query</code> — body{' '}
          <code>{'{ "query": "…" }'}</code>, header{' '}
          <code>Authorization: Bearer $DEMO_GATEWAY_TOKEN</code>
        </li>
        <li>
          <code>GET /api/health</code>
        </li>
      </ul>
      <p>
        See <code>examples/recipes/</code> in the repo for end-to-end chat + gateway
        recipes.
      </p>
    </main>
  );
}

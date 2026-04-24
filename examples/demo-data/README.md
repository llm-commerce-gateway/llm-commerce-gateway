# Demo data

Static JSON catalogs used by the OSS examples. These let every recipe run
end-to-end with zero external dependencies.

## `luxe-bond/products.json`

A fictional skincare brand catalog (15 products) used as the default dataset for
`examples/demo-gateway` when `DATA_SOURCE=demo`.

Each product has the shape:

```ts
type DemoProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  unitPrice: number;      // USD
  currency: string;
  description: string;
  inStock: boolean;
  category: string;
  tags: string[];
};
```

## Adding your own dataset

1. Copy `luxe-bond/products.json` to `examples/demo-data/<your-brand>/products.json`.
2. Keep the schema identical (the demo-gateway reader is typed against it).
3. Point demo-gateway at it:

   ```bash
   DEMO_DATA_PATH=../demo-data/<your-brand>/products.json
   ```

See `examples/recipes/chat-custom-api/` for the pattern used to plug your real
backend in behind the same `POST /api/gateway/query` contract.

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'shopify/index': 'src/shopify/index.ts',
    'bigcommerce/index': 'src/bigcommerce/index.ts',
    'woocommerce/index': 'src/woocommerce/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
});

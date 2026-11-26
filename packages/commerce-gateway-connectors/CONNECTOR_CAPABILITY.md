# Connector capability matrix

Normalized MCP tool **names** do not mean identical backend **behavior**. Source: `src/shopify`, `src/woocommerce`, `src/bigcommerce` (`1.0.0-rc.2`).

| Behavior | Shopify Storefront GraphQL | WooCommerce REST `wc/v3` | BigCommerce REST v3 |
| --- | --- | --- | --- |
| `search_products` | Yes | Yes | Yes |
| `get_product_details` | Yes | Yes | Yes |
| Availability on product/variant | `availableForSale`, `quantityAvailable` | Stock fields | Inventory fields |
| `get_recommendations` | Heuristic (search) | Heuristic | Heuristic |
| `add_to_cart` | Cart API | In-memory session cart | Cart API |
| `create_order` | Checkout handoff (`checkoutCreate` + URL) | REST order (`set_paid: false` by default) | REST order |
| Get order by id / number | **Throws** (Admin API) | REST | REST |
| Multi-merchant unified cart | No | No | No |
| UCP / Shop MCP / Admin API | No | n/a | n/a |

Public docs: https://commercegateway.io/docs/getting-started/connector-capabilities

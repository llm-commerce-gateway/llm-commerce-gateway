# Commerce Registry Protocol

> **Open Protocol Specification (MIT License)**

This repository contains the open protocol specification for the Commerce Gateway Registry system. This specification enables interoperability between commerce gateways and registry services.

## Overview

The Commerce Registry Protocol defines:

- **Resolution System**: How to resolve brand names and GTINs to gateway endpoints
- **Registration Process**: How gateways register and verify domain ownership
- **Discovery Mechanism**: How gateways can be discovered via `.well-known` endpoints

## Specification Documents

- **[Resolution](./spec/resolution.md)** - Brand and GTIN resolution algorithms
- **[Registration](./spec/registration.md)** - Gateway registration and verification
- **[Well-Known Schema](./spec/well-known.md)** - `.well-known/commerce-gateway.json` format

## License

MIT License - See [LICENSE](./LICENSE) file for details.

## Related Projects

- **Commerce Gateway (OSS)**: `@betterdata/commerce-gateway` - Open source gateway implementation
- **Commerce Registry (Proprietary)**: Registry service implementation (Better Data operated)

## Contributing

This is an open protocol specification. Contributions to improve interoperability are welcome.

## Version

Current Version: **1.0**

## Non-goals

This specification intentionally does **not**:

- Define a specific registry implementation — only the protocol and schema
- Require Better Data or any hosted service — implementations may be fully self-hosted
- Mandate authentication or authorization schemes — implementations choose their own

---

*This protocol enables a federated commerce gateway ecosystem where brands can self-host their gateways while participating in a shared discovery and trust system.*


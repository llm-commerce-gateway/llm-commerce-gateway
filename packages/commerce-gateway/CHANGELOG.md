# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- Marketplace search types no longer import `@prisma/client`, so `pnpm build` / dts succeeds in the OSS workspace.

## 1.0.0-rc.2

Published npm prerelease.

## 1.0.0 - Initial release

- Universal LLM Gateway for conversational commerce
- Pluggable backends (Product, Cart, Order)
- Claude MCP, OpenAI Functions, Grok Tools adapters
- Session management with Redis
- Federation Hub for multi-merchant routing
- Commerce Gateway Registry integration
- Rate limiting, auth, and telemetry (opt-in)

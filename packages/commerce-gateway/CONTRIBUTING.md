# Contributing to LLM Gateway

First off, thank you for considering contributing to LLM Gateway! It's people like you that make this project possible.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- **Node.js 20** or later
- **pnpm 8** or later (we use pnpm for package management)
- Git

You can verify your versions with:

```bash
node --version  # Should be v20.x or later
pnpm --version  # Should be 8.x or later
```

### Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/llm-gateway.git
   cd llm-gateway
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Set up environment**

   ```bash
   cp env.example.txt .env
   # Edit .env with your API keys (optional for most development)
   ```

5. **Run tests**

   ```bash
   pnpm test
   ```

6. **Build the project**

   ```bash
   pnpm build
   ```

## Project Structure

```
packages/llm-gateway/
├── src/
│   ├── adapters/          # LLM provider adapters (OpenAI, Grok)
│   ├── auth/              # Authentication strategies
│   ├── backends/          # Backend interface definitions
│   ├── catalog/           # Product catalog & search
│   │   ├── interfaces.ts  # Extension point interfaces
│   │   ├── basic-*.ts     # Open source implementations
│   │   └── ingestion/     # Advanced ingestion (SCM)
│   ├── core/              # Gateway core, tools, errors
│   ├── ingestion/         # Lightweight product import
│   ├── links/             # Link generation & tracking
│   ├── mcp/               # Claude MCP protocol
│   ├── observability/     # Logging infrastructure
│   ├── session/           # Session management
│   ├── tools/             # Tool implementations
│   └── index.ts           # Main exports
├── examples/              # Example implementations
├── tests/                 # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── docs/                  # Documentation
└── package.json
```

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting a bug, include:**

- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, OS, etc.)
- Code samples if applicable

**Use this template:**

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
1. Configure gateway with '...'
2. Call '...'
3. See error

**Expected behavior**
What you expected to happen.

**Environment:**
- Node.js version: 
- OS: 
- Gateway version:

**Additional context**
Any other context about the problem.
```

### Suggesting Features

We love feature suggestions! Please check existing issues first.

**Feature requests should include:**

- Clear use case
- Proposed solution
- Alternatives considered
- Impact on existing functionality

### Your First Code Contribution

Unsure where to begin? Look for issues labeled:

- `good first issue` - Simple issues for newcomers
- `help wanted` - Issues where we need assistance
- `documentation` - Documentation improvements

### Pull Requests

1. **Create a branch**

   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-bugfix
   ```

2. **Make your changes**

   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation if needed

3. **Run checks**

   ```bash
   pnpm test          # Run tests
   pnpm typecheck     # Check types
   pnpm lint          # Check linting
   ```

4. **Commit your changes**

   Follow our [commit message format](#commit-messages).

5. **Push to your fork**

   ```bash
   git push origin feature/my-feature
   ```

6. **Open a Pull Request**

   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changed and why

## PR Requirements Checklist

Before submitting a pull request, ensure:

- [ ] **Tests added** for new functionality
- [ ] **All tests pass** (`pnpm test`)
- [ ] **Changeset added** for user-facing changes (see below)
- [ ] **RC/RFC reference** included for behavior changes
- [ ] **Documentation updated** if the change is user-facing

### Adding a Changeset

We use [Changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. If your PR includes user-facing changes:

```bash
pnpm changeset
```

This will prompt you to:
1. Select which packages are affected
2. Choose the semver bump type (patch/minor/major)
3. Write a summary of the change

The changeset file will be created in `.changeset/` — commit this with your PR.

**When to add a changeset:**
- New features
- Bug fixes
- Breaking changes
- Performance improvements

**When NOT to add a changeset:**
- Documentation-only changes
- Internal refactoring with no API changes
- Test-only changes

## Pull Request Process

1. Ensure all tests pass
2. Update documentation for any changed functionality
3. Add a changeset if your change affects users
4. Request review from maintainers
5. Address review feedback — this is normal and part of the process
6. Maintainer will merge once approved

**Review timeline:** Maintainers typically review within 48-72 hours. At least one maintainer approval is required.

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions

```typescript
// Good
export interface ProductSearchOptions {
  query: string;
  limit?: number;
}

export async function searchProducts(
  options: ProductSearchOptions
): Promise<Product[]> {
  // ...
}

// Avoid
export type ProductSearchOptions = {
  query: string;
  limit?: number;
}

export async function searchProducts(options) {
  // ...
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `product-search.ts`)
- **Classes**: `PascalCase` (e.g., `ProductMatcher`)
- **Functions**: `camelCase` (e.g., `searchProducts`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RESULTS`)
- **Interfaces**: `PascalCase`, no `I` prefix (e.g., `SearchOptions`)

### Code Style

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Max line length: 100 characters
- Use ESLint and Prettier (configured in project)

### Documentation

- Use JSDoc comments for public APIs
- Include `@example` blocks for complex functions
- Document parameters and return types

```typescript
/**
 * Search for products matching a query.
 * 
 * @param query - The search query text
 * @param options - Search configuration options
 * @returns Array of matching products sorted by relevance
 * 
 * @example
 * ```typescript
 * const products = await searchProducts('running shoes', {
 *   limit: 10,
 *   inStockOnly: true,
 * });
 * ```
 */
export async function searchProducts(
  query: string,
  options?: SearchOptions
): Promise<Product[]> {
  // ...
}
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### Examples

```
feat(ingestion): add Square inventory API support

- Fetch inventory counts from Square Inventory API
- Batch requests in groups of 100 variation IDs
- Map inventory to products correctly

Closes #123
```

```
fix(cart): prevent duplicate items in cart

Items with the same productId and variantId are now
properly merged instead of creating duplicates.
```

```
docs: add Shopify integration example
```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific file
pnpm test src/catalog/basic-search-service.test.ts

# Unit tests only
pnpm test:unit

# E2E tests only
pnpm test:e2e
```

### Writing Tests

- Place tests next to source files or in `tests/` directory
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BasicSearchService } from './basic-search-service';
import { InMemoryCatalog } from './in-memory-catalog';

describe('BasicSearchService', () => {
  let service: BasicSearchService;
  let catalog: InMemoryCatalog;

  beforeEach(() => {
    catalog = new InMemoryCatalog([
      { id: '1', name: 'Running Shoes', price: 99.99, inStock: true, currency: 'USD' },
      { id: '2', name: 'Walking Shoes', price: 79.99, inStock: true, currency: 'USD' },
    ]);
    service = new BasicSearchService({ catalog });
  });

  it('should find products by keyword', async () => {
    const result = await service.search({ text: 'running' });
    
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Running Shoes');
  });

  it('should return empty array for no matches', async () => {
    const result = await service.search({ text: 'nonexistent' });
    
    expect(result.products).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
```

## Documentation

### Where to Document

- **Code comments**: Implementation details
- **JSDoc**: Public API documentation
- **README.md**: Getting started, quick examples
- **docs/**: Detailed guides and concepts

### Documentation Style

- Use clear, simple language
- Include code examples
- Keep examples up-to-date with the code
- Test code examples work

## What We're Looking For

We welcome contributions in these areas:

### Bug Fixes
Found a bug? We'd love a fix! Please include:
- A clear description of the bug
- Steps to reproduce
- A test that fails without your fix and passes with it

### New Adapters
Want to add support for a new LLM provider? Please include:
- Full adapter implementation
- Unit tests
- Integration tests (can be skipped in CI if they require API keys)
- Documentation with usage examples

### New Connectors
Adding a new connector for tools or data sources? Include:
- Connector implementation
- Tests
- Documentation

### Documentation Improvements
- Fix typos or unclear explanations
- Add examples
- Improve API documentation

### Performance Improvements
- Profile first, optimize second
- Include benchmarks showing the improvement
- Ensure no functionality is broken

## What We Can't Accept

To maintain focus and quality, we cannot accept:

### Cloud-Only Features
Features specific to the commercial cloud product should not be in the OSS package. If you're unsure, open a discussion first.

### Breaking Changes Without RFC
Significant API changes require an RFC (Request for Comments). See [RFC_TEMPLATE.md](./RFC_TEMPLATE.md).

### Dependencies Without Justification
New dependencies add maintenance burden. Please justify:
- Why the dependency is needed
- Why existing dependencies can't solve the problem
- The dependency's maintenance status and security posture

### Code Without Tests
All new code must include tests. We make exceptions only for:
- Trivial documentation fixes
- Configuration changes

## Getting Help

- **Open a Discussion**: Use GitHub Discussions for questions about usage or contribution
- **Tag Maintainers**: If your PR is blocked, tag a maintainer in a comment
- **Check Existing Issues**: Your question may already be answered

---

Thank you for contributing!

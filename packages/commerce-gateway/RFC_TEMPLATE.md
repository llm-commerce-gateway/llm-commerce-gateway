# RFC: [Title]

> **Status**: Draft | Under Review | Accepted | Rejected | Implemented
>
> **Author(s)**: @your-github-username
>
> **Created**: YYYY-MM-DD
>
> **Last Updated**: YYYY-MM-DD

## Summary

One paragraph explanation of the feature or change.

## Motivation

Why are we doing this? What use cases does it support? What problems does it solve?

- What is the expected outcome?
- Who benefits from this change?
- What happens if we don't do this?

## Detailed Design

The meat of the proposal. Be specific about:

- How the feature works from a user's perspective
- Technical implementation details
- Edge cases and how they're handled

### API Changes

Show the proposed API with concrete examples:

```typescript
// Before (if applicable)
const adapter = createAdapter('openai', apiKey);

// After
const adapter = createAdapter({
  provider: 'openai',
  apiKey,
  options: {
    timeout: 30000,
    retries: 3,
  },
});
```

### Configuration

If the feature requires configuration, show the schema:

```typescript
interface NewFeatureConfig {
  enabled: boolean;
  options?: {
    setting1: string;
    setting2: number;
  };
}
```

### Implementation

High-level implementation approach:

1. Step one
2. Step two
3. Step three

Key files that will be modified:
- `src/core/...`
- `src/adapters/...`

## Drawbacks

Why should we NOT do this? Consider:

- Complexity added to the codebase
- Performance implications
- Learning curve for users
- Maintenance burden
- Breaking changes

## Alternatives

What other designs were considered? Why were they not chosen?

### Alternative A: [Name]

Description and why it was rejected.

### Alternative B: [Name]

Description and why it was rejected.

### Do Nothing

What happens if we don't implement this? Is that acceptable?

## Adoption Strategy

How will existing users adopt this feature?

- Is this a breaking change?
- What migration steps are required?
- Can we provide codemods or migration scripts?
- What's the deprecation timeline for old APIs?

## Unresolved Questions

What needs to be resolved before this RFC can be accepted?

- [ ] Question 1
- [ ] Question 2
- [ ] Question 3

---

## RFC Process

1. **Draft**: Copy this template and fill it out
2. **Submit**: Open a PR with your RFC in `docs/rfcs/`
3. **Discussion**: Community and maintainers discuss in PR comments
4. **Decision**: Maintainers accept, reject, or request changes
5. **Implementation**: Once accepted, implementation can begin

### Tips for Writing RFCs

- Be specific — vague proposals are hard to evaluate
- Show examples — code speaks louder than prose
- Consider trade-offs — every design has downsides
- Start small — smaller RFCs are easier to review and accept

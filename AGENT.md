# AGENT.md

This file provides comprehensive guidance for AI coding assistants working with the team-labeler-action codebase.

## Project Context

This is a GitHub Action that automatically labels pull requests and issues based on team membership. It's distributed as a compiled JavaScript action (Node 20) and must maintain backward compatibility with existing user configurations.

## Development Workflow

### Standard Development Cycle
```bash
# After making changes to src/
pnpm build        # Compile TS → JS (lib/)
pnpm test         # Verify tests pass
pnpm package      # Bundle with rollup (dist/)
```

### Quick Development
```bash
pnpm all          # Build + format + lint + package + test
```

### Testing Specific Scenarios
```bash
pnpm test -- __tests__/github.test.ts               # Single file
pnpm test -- -t "should return only the teams"       # Specific test
pnpm test:e2e                                         # End-to-end tests
```

## Code Patterns and Conventions

### Error Handling Pattern
```typescript
// src/main.ts pattern - always use core.error and core.setFailed
try {
  // action logic
} catch (error) {
  if (error instanceof Error) {
    core.error(error)
    core.setFailed(error.message)
  }
}
```

### GitHub API Client Pattern
```typescript
// Always create clients this way
const client = createClient(token)
const orgClient = orgToken ? createClient(orgToken) : null

// Check for null before using orgClient
if (!orgClient) {
  return []
}
```

### Pagination Pattern
```typescript
// CRITICAL: Always use paginate for lists that can exceed 100 items
const teams = await client.paginate(client.rest.teams.list, {
  org: orgName,
  per_page: 100
})

// For nested pagination (teams → members)
for (const team of teams) {
  const members = await client.paginate(
    client.rest.teams.listMembersInOrg,
    {
      org: orgName,
      team_slug: team.slug,
      per_page: 100
    }
  )
}
```

### Case-Insensitive Matching Pattern
```typescript
// teams.ts uses toLowerCase() for username/team comparisons
authors.some(a => a.toLowerCase() === author.toLowerCase())
```

**Note**: `src/github.ts` currently uses case-sensitive matching (`===`) when checking org team membership, while `src/teams.ts` correctly uses case-insensitive matching. This inconsistency should be kept in mind when working on team matching logic.

## File Structure and Responsibilities

### src/main.ts
- **Purpose**: Entry point, orchestrates the entire workflow
- **Key Responsibilities**: Input validation, client creation, calling helper functions, output setting
- **Pattern**: Uses early returns for missing context (no PR number, no author)
- **Important**: Must always call `core.setOutput('team_labels', ...)` for GitHub Actions output

### src/github.ts
- **Purpose**: All GitHub API interactions and context extraction
- **Key Functions**:
  - `getPrNumber()` / `getPrAuthor()`: Extract from `github.context.payload` (supports both PRs and issues)
  - `getLabelsConfiguration()`: Fetches YAML, supports external repos
  - `getUserTeamsWithDeps()`: Main team fetching logic with pagination (exported for testing)
  - `getUserTeams()`: Wrapper that injects `github.context.repo.owner` and `core` logger
  - `addLabels()`: Applies labels via `issues.addLabels` API
- **Testing Note**: `getUserTeamsWithDeps` accepts explicit dependencies for testability

### src/teams.ts
- **Purpose**: Pure team matching logic (no side effects)
- **Key Function**: `getTeamLabel()` - Maps author to team labels
- **Pattern**: Returns array (user can be in multiple teams)
- **Important**: Case-insensitive matching is required

### src/types.ts
- **Purpose**: Shared TypeScript types
- **Current Types**: `ExternalRepo` for cross-repo configuration

### Configuration Files
- `rollup.config.ts`: Bundler config (TypeScript → CommonJS bundle)
- `vitest.config.ts`: Unit test configuration
- `vitest.config.e2e.ts`: E2E test configuration
- `eslint.config.mjs`: ESLint flat config with TypeScript rules
- `.prettierrc.json`: Prettier formatting (no semi, single quotes, no trailing commas)

## Testing Patterns

### Test Framework
Tests use **vitest** (not jest). The API is largely compatible but uses `vi` instead of `jest` for mocking.

### Mock Structure
```typescript
// Standard mock pattern for GitHub client
const createMockClient = () => ({
  paginate: vi.fn(),
  rest: {
    teams: {
      list: vi.fn(),
      listMembersInOrg: vi.fn()
    }
  }
})

// Setup pagination mock
const setupPaginateMock = (mockClient, teamsResponse, membershipMap) => {
  mockClient.paginate.mockImplementation((method, params) => {
    if (method === mockClient.rest.teams.list) {
      return Promise.resolve(teamsResponse)
    }
    if (method === mockClient.rest.teams.listMembersInOrg) {
      const teamSlug = params.team_slug
      return Promise.resolve(membershipMap[teamSlug] || [])
    }
    return Promise.resolve([])
  })
}
```

### Test Organization
- Use **Given/When/Then** comments for clarity
- Group related tests in `describe` blocks by scenario
- Test pagination scenarios (100+ items)
- Test error handling with and without logger
- Test edge cases: no teams, no membership, API failures

### E2E Tests
Located in `__tests__/e2e/e2e.test.ts`. These tests use `undici` MockAgent to mock HTTP requests and test the full action flow including PR events, issue events, org team integration, and error handling.

### Critical Test Coverage Areas
1. Pagination with 100+ teams and members
2. Null client handling (when org-token not provided)
3. API error handling with optional logger
4. Case-insensitive matching
5. Multiple team membership
6. External repo configuration

## Action Configuration (action.yml)

### Inputs
- `repo-token` (required): Standard GITHUB_TOKEN
- `org-token` (optional): PAT with `read:org` for team membership
- `configuration-path` (default: `.github/teams.yml`)
- `teams-repo` / `teams-branch`: For external team configs

### Output
- `team_labels`: JSON array of applied labels

## Common Modification Scenarios

### Adding New GitHub API Calls
1. Add function to `src/github.ts`
2. Use `github.getOctokit(token)` client
3. Handle pagination if list operation
4. Add error handling
5. Export testable version with dependencies (`WithDeps` suffix)
6. Create tests with mocked client

### Adding New Team Matching Logic
1. Modify `src/teams.ts` `getTeamLabel()`
2. Keep function pure (no side effects)
3. Maintain case-insensitive matching
4. Add tests to `__tests__/teams.test.ts`

### Modifying Action Inputs/Outputs
1. Update `action.yml`
2. Update `src/main.ts` to read new inputs via `core.getInput()`
3. Document in README.md
4. Maintain backward compatibility

## Build and Distribution

### Build Process
1. TypeScript (`src/`) → JavaScript (`lib/`) via `tsc` (ES2022 target)
2. JavaScript (`lib/`) → Bundled (`dist/index.js`) via `rollup` (CommonJS output)
3. `dist/index.js` is what GitHub Actions executes

### Pre-Release Checklist
- [ ] Run `pnpm all` successfully
- [ ] Verify `dist/index.js` is updated
- [ ] Test with sample repository
- [ ] Update version in `package.json`
- [ ] Tag release matching action version

## Dependencies

### Runtime Dependencies
- `@actions/core`: Action inputs/outputs, logging
- `@actions/github`: GitHub API client, context
- `js-yaml`: Parse team configuration YAML

### Key Dev Dependencies
- `rollup` + plugins: Bundle for distribution
- `vitest`: Testing framework
- `undici`: HTTP mocking for E2E tests
- `@typescript-eslint/*`: TypeScript linting
- `prettier`: Code formatting

## Permissions Model

### Minimum Permissions (YAML teams only)
```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

### With GitHub Teams
Requires Personal Access Token (classic or fine-grained) with:
- `read:org` scope (classic)
- Organization → Members → Read-only (fine-grained)

## Error Handling Philosophy

- **Never throw in main.ts**: Catch all errors, log with `core.error()`, fail with `core.setFailed()`
- **Graceful degradation**: If org-token fails, continue with YAML-only teams
- **Informative warnings**: Use `logger.warning()` for non-critical failures
- **Silent failures acceptable**: Return empty array rather than crash (e.g., no org-token provided)

## TypeScript Configuration Notes

- Target: ES2022
- Module: ES2022 (rollup converts to CommonJS for GitHub Actions)
- Module Resolution: bundler
- Output: `lib/` directory
- Root: `src/` directory
- `strict: true` (full strict mode enabled)
- Excludes: `node_modules`, `__tests__`, `vitest.config*.ts`, `rollup.config.ts`

## GitHub Context Usage

```typescript
// Access PR/Issue information
github.context.payload.pull_request
github.context.payload.issue

// Access repository information
github.context.repo.owner
github.context.repo.repo
github.context.sha
```

## YAML Configuration Format

```yaml
# Simple username-based teams
TeamName:
  - '@username1'
  - '@username2'

# GitHub organization teams (requires org-token)
FrontendTeam:
  - '@myorg/frontend'
  - '@username3'

# Mixed approach
DevOpsTeam:
  - '@myorg/devops'
  - '@contractor1'
  - '@contractor2'
```

## Performance Considerations

- **Pagination**: Each team requires a separate API call to list members
- **API Rate Limits**: With 100 teams, expect 100+ API calls
- **Caching**: Not implemented (GitHub Actions are ephemeral)
- **Optimization**: Consider batching if API limits become an issue

## Backward Compatibility Requirements

- Must support YAML-only configuration (no org-token)
- Must handle both PR and issue events
- Must support external repository configurations
- Case-insensitive username matching must be preserved

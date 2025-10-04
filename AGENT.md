# AGENT.md

This file provides comprehensive guidance for AI coding assistants working with the team-labeler-action codebase.

## Project Context

This is a GitHub Action that automatically labels pull requests and issues based on team membership. It's distributed as a compiled JavaScript action (Node 20) and must maintain backward compatibility with existing user configurations.

## Development Workflow

### Standard Development Cycle
```bash
# After making changes to src/
yarn build        # Compile TS → JS (lib/)
yarn test         # Verify tests pass
yarn package      # Bundle with ncc (dist/)
```

### Quick Development
```bash
yarn all          # Build + format + lint + package + test
```

### Testing Specific Scenarios
```bash
jest __tests__/github.test.ts                    # Single file
jest -t "should return only the teams"           # Specific test
jest --watch                                      # Watch mode
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
// Always use toLowerCase() for username/team comparisons
authors.some(a => a.toLowerCase() === author.toLowerCase())
```

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

## Testing Patterns

### Mock Structure
```typescript
// Standard mock pattern for GitHub client
const createMockClient = () => ({
  paginate: jest.fn(),
  rest: {
    teams: {
      list: jest.fn(),
      listMembersInOrg: jest.fn()
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
1. TypeScript (`src/`) → JavaScript (`lib/`) via `tsc`
2. JavaScript (`lib/`) → Bundled (`dist/index.js`) via `@vercel/ncc`
3. `dist/index.js` is what GitHub Actions executes

### Pre-Release Checklist
- [ ] Run `yarn all` successfully
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
- `@vercel/ncc`: Bundle for distribution
- `jest` + `ts-jest`: Testing framework
- `@typescript-eslint/*`: TypeScript linting

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

- Target: ES6
- Module: CommonJS (required for GitHub Actions)
- Output: `lib/` directory
- Root: `src/` directory
- `noImplicitAny: false` (allows some flexibility)
- Excludes: `node_modules`, `**/*.test.ts`

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

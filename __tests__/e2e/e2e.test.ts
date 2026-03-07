import {describe, test, expect, beforeEach, afterEach, vi} from 'vitest'
import {MockAgent, setGlobalDispatcher} from 'undici'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as github from '@actions/github'

// ── Helpers ──

function yaml(config: Record<string, string[]>): string {
  return Object.entries(config)
    .map(
      ([label, members]) =>
        `${label}:\n${members.map(m => `  - '${m}'`).join('\n')}`
    )
    .join('\n')
}

function parseOutput(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8')
  const outputs: Record<string, string> = {}
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^(.+?)<<(.+)$/)
    if (m) {
      const [, key, delim] = m
      const vals: string[] = []
      i++
      while (i < lines.length && lines[i] !== delim) vals.push(lines[i++])
      outputs[key] = vals.join('\n')
    }
    i++
  }
  return outputs
}

// ── Tests ──

describe('E2E: team-labeler-action', () => {
  let tmpDir: string
  let outputPath: string
  let stdoutWrites: string[]
  let mockAgent: MockAgent

  beforeEach(() => {
    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'))
    outputPath = path.join(tmpDir, 'output')
    fs.writeFileSync(outputPath, '')

    vi.stubEnv('GITHUB_REPOSITORY', 'test-owner/test-repo')
    vi.stubEnv('GITHUB_SHA', 'abc123')
    vi.stubEnv('GITHUB_OUTPUT', outputPath)
    vi.stubEnv('INPUT_REPO-TOKEN', 'fake-token')
    vi.stubEnv('INPUT_CONFIGURATION-PATH', '.github/teams.yml')

    stdoutWrites = []
    vi.spyOn(process.stdout, 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        stdoutWrites.push(String(chunk))
        return true
      }
    )
  })

  afterEach(async () => {
    await mockAgent.close()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    fs.rmSync(tmpDir, {recursive: true, force: true})
  })

  function stdout(): string {
    return stdoutWrites.join('')
  }

  async function runAction(): Promise<void> {
    vi.resetModules()
    await import('../../src/main')
  }

  function prEvent(user: string, number = 42) {
    github.context.payload = {pull_request: {number, user: {login: user}}}
  }

  function issueEvent(user: string, number = 7) {
    github.context.payload = {issue: {number, user: {login: user}}}
  }

  function setupConfigHandler(pool: ReturnType<MockAgent['get']>, yamlContent: string) {
    pool
      .intercept({
        path: /^\/repos\/test-owner\/test-repo\/contents\/.+/,
        method: 'GET'
      })
      .reply(200, {
        content: Buffer.from(yamlContent).toString('base64'),
        encoding: 'base64'
      }, {headers: {'content-type': 'application/json'}})
  }

  function setupLabelsHandler(
    pool: ReturnType<MockAgent['get']>,
    issueNumber: number,
    capture?: (body: {labels: string[]}) => void
  ) {
    pool
      .intercept({
        path: `/repos/test-owner/test-repo/issues/${issueNumber}/labels`,
        method: 'POST'
      })
      .reply(opts => {
        if (capture && opts.body) {
          capture(JSON.parse(String(opts.body)))
        }
        return {
          statusCode: 200,
          data: [],
          responseOptions: {headers: {'content-type': 'application/json'}}
        }
      })
  }

  function setupTeamsHandler(
    pool: ReturnType<MockAgent['get']>,
    teams: Array<{slug: string; name: string}>
  ) {
    pool
      .intercept({
        path: /^\/orgs\/test-owner\/teams(\?.*)?$/,
        method: 'GET'
      })
      .reply(200, teams, {headers: {'content-type': 'application/json'}})
  }

  function setupMembersHandler(
    pool: ReturnType<MockAgent['get']>,
    membersByTeam: Record<string, string[]>
  ) {
    pool
      .intercept({
        path: (p: string) => /^\/orgs\/test-owner\/teams\/[^/]+\/members/.test(p),
        method: 'GET'
      })
      .reply(opts => {
        const slug = opts.path.match(/\/teams\/([^/]+)\/members/)?.[1] ?? ''
        return {
          statusCode: 200,
          data: (membersByTeam[slug] ?? []).map(login => ({login})),
          responseOptions: {headers: {'content-type': 'application/json'}}
        }
      })
      .persist()
  }

  test('labels PR when author matches teams.yml config', async () => {
    prEvent('Anakin')
    let postedLabels: {labels: string[]} | undefined
    const pool = mockAgent.get('https://api.github.com')
    setupConfigHandler(pool, yaml({Frontend: ['@Anakin', '@Yoda']}))
    setupLabelsHandler(pool, 42, body => {
      postedLabels = body
    })

    await runAction()
    await vi.waitFor(
      () => {
        expect(postedLabels).toBeDefined()
      },
      {timeout: 5000}
    )

    expect(postedLabels).toEqual({labels: ['Frontend']})
    expect(JSON.parse(parseOutput(outputPath).team_labels)).toEqual([
      'Frontend'
    ])
    expect(stdout()).not.toContain('::error::')
  })

  test('no labels when author not in any team', async () => {
    prEvent('Anakin')
    const pool = mockAgent.get('https://api.github.com')
    setupConfigHandler(pool, yaml({Frontend: ['@Yoda', '@Obi-Wan']}))

    await runAction()
    await vi.waitFor(
      () => {
        expect(fs.readFileSync(outputPath, 'utf-8')).toContain('team_labels')
      },
      {timeout: 5000}
    )

    expect(JSON.parse(parseOutput(outputPath).team_labels)).toEqual([])
    expect(stdout()).not.toContain('::error::')
  })

  test('labels issue when issue author matches config', async () => {
    issueEvent('Anakin')
    let postedLabels: {labels: string[]} | undefined
    const pool = mockAgent.get('https://api.github.com')
    setupConfigHandler(pool, yaml({Backend: ['@Anakin']}))
    setupLabelsHandler(pool, 7, body => {
      postedLabels = body
    })

    await runAction()
    await vi.waitFor(
      () => {
        expect(postedLabels).toBeDefined()
      },
      {timeout: 5000}
    )

    expect(postedLabels).toEqual({labels: ['Backend']})
    expect(JSON.parse(parseOutput(outputPath).team_labels)).toEqual([
      'Backend'
    ])
    expect(stdout()).not.toContain('::error::')
  })

  test('labels from org team membership using org-token', async () => {
    prEvent('Anakin')
    vi.stubEnv('INPUT_ORG-TOKEN', 'fake-org-token')
    let postedLabels: {labels: string[]} | undefined
    const pool = mockAgent.get('https://api.github.com')
    setupConfigHandler(pool, yaml({PlatformTeam: ['@test-owner/platform']}))
    setupLabelsHandler(pool, 42, body => {
      postedLabels = body
    })
    setupTeamsHandler(pool, [{slug: 'platform', name: 'Platform'}])
    setupMembersHandler(pool, {platform: ['Anakin']})

    await runAction()
    await vi.waitFor(
      () => {
        expect(postedLabels).toBeDefined()
      },
      {timeout: 5000}
    )

    expect(postedLabels).toEqual({labels: ['PlatformTeam']})
    expect(JSON.parse(parseOutput(outputPath).team_labels)).toEqual([
      'PlatformTeam'
    ])
    expect(stdout()).not.toContain('::error::')
  })

  test('multiple labels from direct user match and org team', async () => {
    prEvent('Anakin')
    vi.stubEnv('INPUT_ORG-TOKEN', 'fake-org-token')
    let postedLabels: {labels: string[]} | undefined
    const pool = mockAgent.get('https://api.github.com')
    setupConfigHandler(
      pool,
      yaml({
        Frontend: ['@Anakin'],
        PlatformTeam: ['@test-owner/platform']
      })
    )
    setupLabelsHandler(pool, 42, body => {
      postedLabels = body
    })
    setupTeamsHandler(pool, [{slug: 'platform', name: 'Platform'}])
    setupMembersHandler(pool, {platform: ['Anakin']})

    await runAction()
    await vi.waitFor(
      () => {
        expect(postedLabels).toBeDefined()
      },
      {timeout: 5000}
    )

    expect(postedLabels?.labels).toHaveLength(2)
    expect(postedLabels?.labels).toContain('Frontend')
    expect(postedLabels?.labels).toContain('PlatformTeam')
    expect(stdout()).not.toContain('::error::')
  })

  test('exits gracefully when no PR/issue in context', async () => {
    github.context.payload = {ref: 'refs/heads/main'}

    await runAction()
    await vi.waitFor(
      () => {
        expect(stdout()).toContain(
          'Could not get pull request number from context, exiting'
        )
      },
      {timeout: 5000}
    )

    expect(stdout()).not.toContain('::error::')
  })

  test('handles API error gracefully', async () => {
    prEvent('Anakin')
    const pool = mockAgent.get('https://api.github.com')
    pool
      .intercept({
        path: /^\/repos\/test-owner\/test-repo\/contents\/.+/,
        method: 'GET'
      })
      .reply(500, {message: 'Internal Server Error'})

    await runAction()
    await vi.waitFor(
      () => {
        expect(stdout()).toContain('::error::')
      },
      {timeout: 5000}
    )
  })
})

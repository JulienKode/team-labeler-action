import {describe, test, expect, beforeAll, beforeEach, afterAll, afterEach, vi} from 'vitest'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as github from '@actions/github'

// ── MSW Server ──

const server = setupServer()

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

function configHandler(yamlContent: string) {
  return http.get(
    'https://api.github.com/repos/test-owner/test-repo/contents/:path',
    () =>
      HttpResponse.json({
        content: Buffer.from(yamlContent).toString('base64'),
        encoding: 'base64'
      })
  )
}

function labelsHandler(
  issueNumber: number,
  capture?: (body: unknown) => void
) {
  return http.post(
    `https://api.github.com/repos/test-owner/test-repo/issues/${issueNumber}/labels`,
    async ({request}) => {
      const body = await request.json()
      if (capture) capture(body)
      return HttpResponse.json([])
    }
  )
}

function teamsHandler(teams: Array<{slug: string; name: string}>) {
  return http.get('https://api.github.com/orgs/test-owner/teams', () =>
    HttpResponse.json(teams)
  )
}

function membersHandler(membersByTeam: Record<string, string[]>) {
  return http.get(
    'https://api.github.com/orgs/test-owner/teams/:slug/members',
    ({params}) => {
      const slug = params.slug as string
      return HttpResponse.json(
        (membersByTeam[slug] ?? []).map(login => ({login}))
      )
    }
  )
}

// ── Tests ──

describe('E2E: team-labeler-action', () => {
  let tmpDir: string
  let outputPath: string
  let stdoutWrites: string[]

  beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
  afterAll(() => server.close())

  beforeEach(() => {
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

  afterEach(() => {
    server.resetHandlers()
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

  test('labels PR when author matches teams.yml config', async () => {
    prEvent('Anakin')
    let postedLabels: unknown
    server.use(
      configHandler(yaml({Frontend: ['@Anakin', '@Yoda']})),
      labelsHandler(42, body => {
        postedLabels = body
      })
    )

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
    server.use(configHandler(yaml({Frontend: ['@Yoda', '@Obi-Wan']})))

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
    let postedLabels: unknown
    server.use(
      configHandler(yaml({Backend: ['@Anakin']})),
      labelsHandler(7, body => {
        postedLabels = body
      })
    )

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
    let postedLabels: unknown
    server.use(
      configHandler(yaml({PlatformTeam: ['@test-owner/platform']})),
      labelsHandler(42, body => {
        postedLabels = body
      }),
      teamsHandler([{slug: 'platform', name: 'Platform'}]),
      membersHandler({platform: ['Anakin']})
    )

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
    let postedLabels: unknown
    server.use(
      configHandler(
        yaml({
          Frontend: ['@Anakin'],
          PlatformTeam: ['@test-owner/platform']
        })
      ),
      labelsHandler(42, body => {
        postedLabels = body
      }),
      teamsHandler([{slug: 'platform', name: 'Platform'}]),
      membersHandler({platform: ['Anakin']})
    )

    await runAction()
    await vi.waitFor(
      () => {
        expect(postedLabels).toBeDefined()
      },
      {timeout: 5000}
    )

    const labels = (postedLabels as {labels: string[]}).labels
    expect(labels).toHaveLength(2)
    expect(labels).toContain('Frontend')
    expect(labels).toContain('PlatformTeam')
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
    server.use(
      http.get(
        'https://api.github.com/repos/test-owner/test-repo/contents/:path',
        () => HttpResponse.json({message: 'Internal Server Error'}, {status: 500})
      )
    )

    await runAction()
    await vi.waitFor(
      () => {
        expect(stdout()).toContain('::error::')
      },
      {timeout: 5000}
    )
  })
})

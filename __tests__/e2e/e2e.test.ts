import * as path from 'path'
import * as fs from 'fs'
import {MockAgent, setGlobalDispatcher, getGlobalDispatcher} from 'undici'

// Path to fixtures
const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const EVENTS_DIR = path.join(FIXTURES_DIR, 'events')
const CONFIGS_DIR = path.join(FIXTURES_DIR, 'configs')

const teamsYamlContent = fs.readFileSync(
  path.join(CONFIGS_DIR, 'teams.yml'),
  'utf8'
)
const teamsYamlBase64 = Buffer.from(teamsYamlContent).toString('base64')

describe('E2E: Team Labeler Action', () => {
  const originalEnv = process.env
  const originalDispatcher = getGlobalDispatcher()
  let mockAgent: MockAgent
  let capturedLabels: string[] = []
  let labelsCalled = false

  beforeEach(() => {
    process.env = {...originalEnv}
    capturedLabels = []
    labelsCalled = false

    mockAgent = new MockAgent()
    mockAgent.disableNetConnect()
    setGlobalDispatcher(mockAgent)

    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    mockAgent.close()
    setGlobalDispatcher(originalDispatcher)
  })

  function setupGitHubEnvironment(eventFile: string) {
    const eventPath = path.join(EVENTS_DIR, eventFile)

    process.env.GITHUB_EVENT_PATH = eventPath
    process.env.GITHUB_REPOSITORY = 'test-org/team-labeler-action'
    process.env.GITHUB_SHA = 'abc123'

    process.env['INPUT_REPO-TOKEN'] = 'fake-token'
    process.env['INPUT_CONFIGURATION-PATH'] = '.github/teams.yml'

    return eventPath
  }

  function mockGitHubApiForConfig(customContent?: string) {
    const content = customContent
      ? Buffer.from(customContent).toString('base64')
      : teamsYamlBase64

    const mockPool = mockAgent.get('https://api.github.com')

    // Mock GET /repos/:owner/:repo/contents/:path for fetching teams.yml
    mockPool
      .intercept({
        path: /\/repos\/test-org\/team-labeler-action\/contents\/.*/,
        method: 'GET'
      })
      .reply(
        200,
        JSON.stringify({
          type: 'file',
          encoding: 'base64',
          content,
          name: 'teams.yml',
          path: '.github/teams.yml'
        }),
        {
          headers: {'content-type': 'application/json'}
        }
      )
  }

  function mockGitHubApiForLabels(prNumber: number) {
    const mockPool = mockAgent.get('https://api.github.com')

    mockPool
      .intercept({
        path: `/repos/test-org/team-labeler-action/issues/${prNumber}/labels`,
        method: 'POST'
      })
      .reply(200, opts => {
        labelsCalled = true
        if (typeof opts.body === 'string') {
          const body = JSON.parse(opts.body)
          capturedLabels = body.labels
        }
        return JSON.stringify([])
      })
  }

  function mockGitHubApiForTeams(
    orgName: string,
    teams: Array<{slug: string; members: string[]}>
  ) {
    const mockPool = mockAgent.get('https://api.github.com')

    mockPool
      .intercept({
        path: new RegExp(`^/orgs/${orgName}/teams(\\?.*)?$`),
        method: 'GET'
      })
      .reply(
        200,
        JSON.stringify(teams.map(t => ({slug: t.slug, name: t.slug}))),
        {headers: {'content-type': 'application/json'}}
      )

    for (const team of teams) {
      mockPool
        .intercept({
          path: new RegExp(
            `^/orgs/${orgName}/teams/${team.slug}/members(\\?.*)?$`
          ),
          method: 'GET'
        })
        .reply(200, JSON.stringify(team.members.map(login => ({login}))), {
          headers: {'content-type': 'application/json'}
        })
    }
  }

  async function runAction(): Promise<void> {
    const mainPath = path.resolve(__dirname, '../../lib/main.js')

    delete require.cache[require.resolve(mainPath)]

    require(mainPath)

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  describe('Pull Request with author in team config', () => {
    it('should add matching labels when author is in one team', async () => {
      // GIVEN
      setupGitHubEnvironment('pull_request.json')
      mockGitHubApiForConfig()
      mockGitHubApiForLabels(42)

      // WHEN
      await runAction()

      // THEN
      expect(labelsCalled).toBe(true)
      expect(capturedLabels.sort()).toEqual(['DarkSide', 'LightSide'])
    })
  })

  describe('Pull Request with author not in any team', () => {
    it('should not call labels API when author has no matching teams', async () => {
      // GIVEN
      setupGitHubEnvironment('pull_request_unknown_author.json')
      mockGitHubApiForConfig()
      // Don't set up label mock - we expect it not to be called

      // WHEN
      await runAction()

      // THEN - the label endpoint should NOT have been called
      expect(labelsCalled).toBe(false)
      expect(capturedLabels).toEqual([])
    })
  })

  describe('Issue event', () => {
    it('should work with issue context and add matching labels', async () => {
      // GIVEN
      setupGitHubEnvironment('issue.json')
      mockGitHubApiForConfig()
      mockGitHubApiForLabels(100)

      // WHEN
      await runAction()

      // THEN
      expect(labelsCalled).toBe(true)
      expect(capturedLabels).toEqual(['LightSide'])
    })
  })

  describe('Multiple teams for same author', () => {
    it('should add all matching labels when author belongs to multiple teams', async () => {
      // GIVEN - Anakin is in both LightSide and DarkSide per teams.yml
      setupGitHubEnvironment('pull_request.json')
      mockGitHubApiForConfig()
      mockGitHubApiForLabels(42)

      // WHEN
      await runAction()

      // THEN
      expect(labelsCalled).toBe(true)
      expect(capturedLabels.sort()).toEqual(['DarkSide', 'LightSide'])
    })
  })

  describe('Org token flow with team memberships', () => {
    it('should fetch team memberships and add labels based on org teams', async () => {
      // GIVEN
      setupGitHubEnvironment('pull_request_unknown_author.json')
      process.env['INPUT_ORG-TOKEN'] = 'fake-org-token'

      const customTeamsYaml = `
LightSide:
  - "@Yoda"
  - "@Anakin"

Droids:
  - "@test-org/droids-team"
`
      mockGitHubApiForConfig(customTeamsYaml)

      mockGitHubApiForTeams('test-org', [
        {slug: 'droids-team', members: ['UnknownUser', 'R2D2']},
        {slug: 'jedi-team', members: ['Yoda', 'ObiWan']}
      ])

      mockGitHubApiForLabels(55)

      // WHEN
      await runAction()

      // THEN
      expect(labelsCalled).toBe(true)
      expect(capturedLabels).toEqual(['Droids'])
    })
  })
})

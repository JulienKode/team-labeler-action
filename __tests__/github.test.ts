import {getUserTeamsWithDeps} from '../src/github'

const TEST_USER = 'testuser'
const TEST_ORG = 'test-org'

const createMockTeam = (slug: string, name?: string) => ({
  slug,
  name: name || `${slug} Team`
})

const createMockUser = (login: string) => ({login})

const createMockClient = () => ({
  paginate: jest.fn(),
  rest: {
    teams: {
      list: jest.fn(),
      listMembersInOrg: jest.fn()
    }
  }
})

const createMockLogger = () => ({
  warning: jest.fn()
})

const setupPaginateMock = (
  mockClient: any,
  teamsResponse: any[],
  membershipMap: Record<string, any[]>
) => {
  mockClient.paginate.mockImplementation((method: any, params: any) => {
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

describe('getUserTeamsWithDeps', () => {
  let mockClient: any
  let mockLogger: ReturnType<typeof createMockLogger>

  beforeEach(() => {
    mockClient = createMockClient()
    mockLogger = createMockLogger()
  })

  describe('when the GitHub client is null', () => {
    it('should return an empty array without making any API calls', async () => {
      // GIVEN
      const nullClient = null

      // WHEN
      const result = await getUserTeamsWithDeps(nullClient, TEST_USER, TEST_ORG)

      // THEN
      expect(result).toEqual([])
    })
  })

  describe('when fetching teams from an organization with many teams', () => {
    it('should return only the teams the user belongs to with correct pagination', async () => {
      // GIVEN
      const userTeamSlugs = ['frontend', 'backend', 'devops', 'security']
      const allTeams = [
        ...userTeamSlugs.map(slug => createMockTeam(slug)),
        ...Array.from({length: 31}, (_, i) => createMockTeam(`team-${i}`))
      ]

      const membershipMap: Record<string, any[]> = {}
      userTeamSlugs.forEach(slug => {
        membershipMap[slug] = [createMockUser(TEST_USER)]
      })
      allTeams.forEach(team => {
        if (!userTeamSlugs.includes(team.slug)) {
          membershipMap[team.slug] = [createMockUser('otheruser')]
        }
      })

      setupPaginateMock(mockClient, allTeams, membershipMap)

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        TEST_ORG,
        mockLogger
      )

      // THEN
      expect(result).toHaveLength(4)
      expect(result).toEqual([
        '@test-org/frontend',
        '@test-org/backend',
        '@test-org/devops',
        '@test-org/security'
      ])
      expect(mockClient.paginate).toHaveBeenCalledWith(
        mockClient.rest.teams.list,
        {org: TEST_ORG, per_page: 100}
      )
      expect(mockClient.paginate).toHaveBeenCalledTimes(allTeams.length + 1)
    })
  })

  describe('when dealing with teams that have many members', () => {
    it('should correctly identify user membership in teams with more than 30 members', async () => {
      // GIVEN
      const teams = [
        createMockTeam('large-team', 'Large Team'),
        createMockTeam('small-team', 'Small Team')
      ]

      const largeTeamMembers = [
        ...Array.from({length: 49}, (_, i) => createMockUser(`user-${i}`)),
        createMockUser(TEST_USER)
      ]

      const membershipMap = {
        'large-team': largeTeamMembers,
        'small-team': [createMockUser('otheruser')]
      }

      setupPaginateMock(mockClient, teams, membershipMap)

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        'my-org',
        mockLogger
      )

      // THEN
      expect(result).toHaveLength(1)
      expect(result).toEqual(['@my-org/large-team'])
    })
  })

  describe('when API calls fail', () => {
    it('should return empty array and log a warning when logger is provided', async () => {
      // GIVEN
      const apiError = new Error('API Error')
      mockClient.paginate.mockRejectedValue(apiError)

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        TEST_ORG,
        mockLogger
      )

      // THEN
      expect(result).toEqual([])
      expect(mockLogger.warning).toHaveBeenCalledWith(
        'Failed to fetch user teams. Ensure the org-token has the necessary permissions.'
      )
    })

    it('should return empty array without logging when no logger is provided', async () => {
      // GIVEN
      mockClient.paginate.mockRejectedValue(new Error('API Error'))

      // WHEN
      const result = await getUserTeamsWithDeps(mockClient, TEST_USER, TEST_ORG)

      // THEN
      expect(result).toEqual([])
      expect(mockLogger.warning).not.toHaveBeenCalled()
    })
  })

  describe('when user is not a member of any teams', () => {
    it('should return empty array after checking all teams', async () => {
      // GIVEN
      const teams = [
        createMockTeam('team-1', 'Team 1'),
        createMockTeam('team-2', 'Team 2')
      ]

      const membershipMap = {
        'team-1': [createMockUser('otheruser')],
        'team-2': [createMockUser('anotheruser')]
      }

      setupPaginateMock(mockClient, teams, membershipMap)

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        TEST_ORG,
        mockLogger
      )

      // THEN
      expect(result).toEqual([])
      expect(mockClient.paginate).toHaveBeenCalledTimes(3)
    })
  })

  describe('when using custom organization names', () => {
    it('should format team names with the provided organization', async () => {
      // GIVEN
      const customOrg = 'custom-org'
      const teams = [createMockTeam('awesome-team', 'Awesome Team')]
      const membershipMap = {
        'awesome-team': [createMockUser(TEST_USER)]
      }

      mockClient.paginate.mockImplementation((method: any, params: any) => {
        if (method === mockClient.rest.teams.list) {
          expect(params.org).toBe(customOrg)
          return Promise.resolve(teams)
        }
        if (method === mockClient.rest.teams.listMembersInOrg) {
          expect(params.org).toBe(customOrg)
          return Promise.resolve(membershipMap[params.team_slug] || [])
        }
        return Promise.resolve([])
      })

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        customOrg,
        mockLogger
      )

      // THEN
      expect(result).toEqual(['@custom-org/awesome-team'])
    })
  })

  describe('when organization has no teams', () => {
    it('should return empty array with minimal API calls', async () => {
      // GIVEN
      setupPaginateMock(mockClient, [], {})

      // WHEN
      const result = await getUserTeamsWithDeps(
        mockClient,
        TEST_USER,
        TEST_ORG,
        mockLogger
      )

      // THEN
      expect(result).toEqual([])
      expect(mockClient.paginate).toHaveBeenCalledTimes(1)
      expect(mockClient.paginate).toHaveBeenCalledWith(
        mockClient.rest.teams.list,
        {org: TEST_ORG, per_page: 100}
      )
    })
  })
})

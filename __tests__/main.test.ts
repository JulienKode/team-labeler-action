import {
  createClient,
  getLabelGlobMapFromObject,
  mapLabelConfigTeamsToUsers
} from '../src/github'
import {getReviewersLabels} from '../src/reviewers'
import * as yaml from 'js-yaml'

const configurationContentDetailed: string = `
'Team Triaged':
  assigned:
    teams:
      - '@Team'
    users:
      - '@RandoJoe'

'Team Approved':
  approved:
    teams:
      - '@Team'
    users:

'Not Team Member Assigned':
  assigned:
    users:
      - '@NotATeamMember'

'Not Team Member Approved':
  approved:
    users:
      - '@NotATeamMember'
      `
const configurationContentSimple: string = `
'Team Triaged':
  - '@Team'
  - '@NotATeamMember'
  - '@SimpleMan'
      `

jest.mock
jest.mock('../src/teams', () => {
  const original = jest.requireActual('../src/teams')
  return {
    ...original,
    getTeamMembers: () => {
      return ['JohnDoe', 'Funguy', 'Lilguy', 'TeamMember']
    }
  }
})

global.github = {
  context: {
    repo: {
      owner: 'owner',
      repo: 'repo'
    }
  }
}

describe('inputs', () => {
  it('it can process reviewer_labels.yml with simple structure', async () => {
    const configObject: any = yaml.load(configurationContentSimple)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['SimpleMan'], // One assignment
      [], // Approvals
      teamsMap
    )
    expect(labelsToApply).toEqual(['Team Triaged'])
  })

  it('maps label config teams to users', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)

    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)

    const expectedMap = new Map()
    expectedMap.set('Team', ['John Doe', 'Team'])

    expect(teamsMap.entries).toBe(expectedMap.entries)
  })

  it('it can process reviewer_labels.yml with detailed structure', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['Team'],
      ['NotATeamMember'],
      teamsMap
    )
    expect(labelsToApply).toEqual(['Team Triaged', 'Not Team Member Approved'])
  })

  it('it can detect a team has reviewed from the individual members reviews and applies the correct label', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['Team'],
      ['TeamMember'],
      teamsMap
    )
    expect(labelsToApply).toEqual(['Team Triaged', 'Team Approved'])
  })

  it('it can detect a non team member has reviewed from the their individual review and applies the correct label', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['NotATeamMember'],
      ['NotATeamMember'],
      teamsMap
    )
    expect(labelsToApply).toEqual([
      'Not Team Member Assigned',
      'Not Team Member Approved'
    ])
  })

  it('it can detect a non team member is assigned from the their individual review and applies the correct label', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['NotATeamMember'],
      [],
      teamsMap
    )
    expect(labelsToApply).toEqual(['Not Team Member Assigned'])
  })

  it('it can detect a extra-team member outside of the team applies the same team label if configured', async () => {
    const configObject: any = yaml.load(configurationContentDetailed)
    const labelsConfig = getLabelGlobMapFromObject(configObject)
    const token = process.env.GITHUB_TOKEN
    if (token == null) return
    const client = createClient(token)
    const teamsMap = await mapLabelConfigTeamsToUsers(client, labelsConfig)
    const labelsToApply: string[] = getReviewersLabels(
      labelsConfig,
      ['RandoJoe'],
      [],
      teamsMap
    )
    expect(labelsToApply).toEqual(['Team Triaged'])
  })
})

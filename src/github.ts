import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import {ExternalRepo} from './types'

type GitHub = ReturnType<typeof github.getOctokit>

interface LabelConfiguration {
  [key: string]: string | string[]
}

interface Logger {
  warning(message: string): void
}

export function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) {
    const issue = github.context.payload.issue
    if (!issue) {
      return undefined
    }
    return issue.number
  }

  return pullRequest.number
}

export function getPrAuthor(): string | undefined {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) {
    const issue = github.context.payload.issue
    if (!issue) {
      return undefined
    }
    return issue.user.login
  }

  return pullRequest.user.login
}

export async function getLabelsConfiguration(
  client: GitHub,
  configurationPath: string,
  externalRepo: ExternalRepo | undefined
): Promise<Map<string, string[]>> {
  const configurationContent: string = await fetchContent(
    client,
    configurationPath,
    externalRepo
  )
  const configObject: LabelConfiguration = yaml.load(
    configurationContent
  ) as LabelConfiguration
  return getLabelGlobMapFromObject(configObject)
}

async function fetchContent(
  client: GitHub,
  path: string,
  externalRepo: ExternalRepo | undefined
): Promise<string> {
  let repo = github.context.repo.repo
  let ref = github.context.sha
  if (externalRepo?.repo) {
    repo = externalRepo?.repo
    ref = externalRepo?.ref
  }

  core.info(`Using repo ${repo} and ref ${ref}`)
  const response = await client.rest.repos.getContent({
    owner: github.context.repo.owner,
    repo,
    path,
    ref
  })

  // @ts-ignore
  if (!Array.isArray(response.data) && response.data.content)
    // @ts-ignore
    return Buffer.from(response.data.content, 'base64').toString()
  throw new Error('Invalid yaml file')
}

function getLabelGlobMapFromObject(
  configObject: LabelConfiguration
): Map<string, string[]> {
  const labelGlobs: Map<string, string[]> = new Map()
  for (const label in configObject) {
    if (typeof configObject[label] === 'string') {
      labelGlobs.set(label, [configObject[label] as string])
    } else if (Array.isArray(configObject[label])) {
      labelGlobs.set(label, configObject[label] as string[])
    } else {
      throw Error(
        `found unexpected type for label ${label} (should be string or array of globs)`
      )
    }
  }

  return labelGlobs
}

export function createClient(token: string): GitHub {
  return github.getOctokit(token)
}

export async function addLabels(
  client: GitHub,
  prNumber: number,
  labels: string[]
) {
  await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels
  })
}

export async function getUserTeamsWithDeps(
  client: GitHub | null,
  author: string,
  orgName: string,
  logger?: Logger
): Promise<string[]> {
  if (!client) {
    return []
  }

  try {
    // Get all teams in the org using pagination
    const teams = await client.paginate(client.rest.teams.list, {
      org: orgName,
      per_page: 100
    })

    // Filter teams by checking if the author is a member
    const userTeams: Array<{slug: string}> = []

    for (const team of teams) {
      // Check if the author is a member of this team using pagination
      const members = await client.paginate(
        client.rest.teams.listMembersInOrg,
        {
          org: orgName,
          team_slug: team.slug,
          per_page: 100
        }
      )

      if (members.some(member => member.login === author)) {
        userTeams.push(team)
      }
    }

    return userTeams.map(team => `@${orgName}/${team.slug}`)
  } catch (_error) {
    if (logger) {
      logger.warning(
        'Failed to fetch user teams. Ensure the org-token has the necessary permissions.'
      )
    }
    return []
  }
}

export async function getUserTeams(
  client: GitHub | null,
  author: string
): Promise<string[]> {
  return getUserTeamsWithDeps(client, author, github.context.repo.owner, core)
}

import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import {ExternalRepo} from './types'

type GitHub = ReturnType<typeof github.getOctokit>

interface LabelConfiguration {
  [key: string]: string | string[]
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

export async function getUserTeams(
  client: GitHub | null,
  author: string
): Promise<string[]> {
  if (!client) {
    return []
  }

  try {
    // Get all teams in the org of the current repo
    const response = await client.rest.teams.list({
      org: github.context.repo.owner
    })

    // For all teams, get their members
    const members = await Promise.all(
      response.data.map(team =>
        client.rest.teams.listMembersInOrg({
          org: github.context.repo.owner,
          team_slug: team.slug
        })
      )
    )

    // For each team, check if the user that opened the PR is a member
    const userTeams = response.data.filter((_, index) =>
      members[index].data.some(member => member.login === author)
    )

    return userTeams.map(team => `@${github.context.repo.owner}/${team.slug}`)
  } catch (_error) {
    core.warning(
      'Failed to fetch user teams. Ensure the org-token has the necessary permissions.'
    )
    return []
  }
}

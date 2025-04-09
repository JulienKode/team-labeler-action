import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import {ExternalRepo} from './types'

type GitHub = ReturnType<typeof github.getOctokit>

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
  core.debug(`Loading configuration from ${configurationPath}`)
  const configurationContent: string = await fetchContent(
    client,
    configurationPath,
    externalRepo
  )
  core.debug(`Configuration content:\n${configurationContent}`)

  const configObject: any = yaml.load(configurationContent)
  core.debug(`Parsed configuration: ${JSON.stringify(configObject, null, 2)}`)

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

function getLabelGlobMapFromObject(configObject: any): Map<string, string[]> {
  const labelGlobs: Map<string, string[]> = new Map()
  for (const label in configObject) {
    if (typeof configObject[label] === 'string') {
      labelGlobs.set(label, [configObject[label]])
    } else if (configObject[label] instanceof Array) {
      labelGlobs.set(label, configObject[label])
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

export async function getUserTeams(client: GitHub | null): Promise<string[]> {
  if (!client) {
    core.debug('No org client provided, skipping team lookup')
    return []
  }

  try {
    core.debug('Fetching teams for authenticated user...')
    const response = await client.rest.teams.listForAuthenticatedUser()
    core.debug(`Found ${response.data.length} teams`)

    const teams = response.data.map(team => {
      const teamName = `@${team.organization.login}/${team.slug}`
      core.debug(`Team found: ${teamName}`)
      return teamName
    })

    core.debug(`Final team list: ${JSON.stringify(teams)}`)
    return teams
  } catch (error) {
    core.warning(
      'Failed to fetch user teams. Ensure the org-token has the necessary permissions.'
    )
    if (error instanceof Error) {
      core.debug(`Error details: ${error.message}`)
    }
    return []
  }
}

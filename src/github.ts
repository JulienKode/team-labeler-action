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
  const configurationContent: string = await fetchContent(
    client,
    configurationPath,
    externalRepo
  )
  const configObject: any = yaml.load(configurationContent)
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

// This function is changed to support the new team.yml file format
function getLabelGlobMapFromObject(
  configObject: Map<string, {github: string; email: string}[]>
): Map<string, string[]> {
  const labelGlobs: Map<string, string[]> = new Map()

  for (const [label, entries] of Object.entries(configObject)) {
    // We currently don't support Array as key, so we can safely assume that label is a string
    if (typeof label !== 'string') {
      throw Error(
        `found unexpected type for label ${label} (should be string or array of globs)`
      )
    }

    // We are modifying the team.yml file to have the github user name and email as properties
    const userName = entries.map(entry => entry.githubUsername)
    labelGlobs.set(label, userName)
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

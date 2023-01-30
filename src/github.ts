import * as github from '@actions/github'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'

export function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) {
    return undefined
  }

  return pullRequest.number
}

export function getPrAuthor(): string | undefined {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) {
    return undefined
  }

  return pullRequest.user.login
}

export async function getLabelsConfiguration(
  client: github.GitHub,
  configurationPath: string,
  teamsRepo: string
): Promise<Map<string, string[]>> {
  core.info('Getting config')
  const configurationContent: string = await fetchContent(
    client,
    configurationPath,
    teamsRepo
  )
  const configObject: any = yaml.safeLoad(configurationContent)
  return getLabelGlobMapFromObject(configObject)
}

async function fetchContent(
  client: github.GitHub,
  repoPath: string,
  teamsRepo: string
): Promise<string> {
  let repo = github.context.repo.repo
  core.warning(repo)
  let sha = github.context.sha
  if (teamsRepo !== '') {
    core.warning('Setting custom repo and branch to main')
    repo = teamsRepo
    sha = 'main'
  }

  const response = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo,
    path: repoPath,
    ref: sha
  })

  if (
    !Array.isArray(response.data) &&
    typeof response.data === 'object' &&
    response.data.content
  )
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

export function createClient(token: string): github.GitHub {
  return new github.GitHub(token)
}

export async function addLabels(
  client: github.GitHub,
  prNumber: number,
  labels: string[]
) {
  await client.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels
  })
}

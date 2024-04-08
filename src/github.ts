import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import * as core from '@actions/core'
import {ExternalRepo} from './types'
import {filterAtSign, getTeamMembers} from './teams'

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

export function getAllReviewers(): string[] | undefined {
  const pullRequest = github.context.payload.pull_request

  if (pullRequest == null) {
    return undefined
  }

  const reviewers =
    pullRequest.requested_reviewers?.map(rr => `${rr.login}`) ?? []
  const teamReviewers =
    pullRequest.requested_teams?.map(rr => `${rr.name}`) ?? []

  const allReviewers: string[] = [...teamReviewers, ...reviewers]

  return allReviewers
}

export async function listReviews(
  client: GitHub,
  externalRepo: ExternalRepo | undefined
) {
  const pullRequest = github.context.payload.pull_request

  if (pullRequest == null) {
    throw new Error('No pull request in context')
  }

  const pullRequestNumber = pullRequest.number

  let repo = github.context.repo.repo
  let ref = github.context.sha
  if (externalRepo?.repo) {
    repo = externalRepo?.repo
    ref = externalRepo?.ref
  }

  core.info(
    `listReviews: Using repo "${repo}" & ref "${ref}" & owner ${github.context.repo.owner}`
  )
  const reviews = await client.rest.pulls.listReviews({
    pull_number: pullRequestNumber,
    owner: github.context.repo.owner,
    repo,
    ref,
    per_page: 9999999
  })
  const allReviews = reviews.data
    .filter(review => review.state === 'APPROVED')
    .map(review => review.user?.login ?? '')
    .filter(v => v != '')
  return allReviews
}

export async function getLabelsConfiguration(
  client: GitHub,
  configurationPath: string,
  externalRepo: ExternalRepo | undefined
): Promise<Map<string, LabelConfig>> {
  core.info(`getLabelsConfiguration`)
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

  core.info(
    `fetchContent: Using repo "${repo}" & ref "${ref}" & path "${path}" & owner ${github.context.repo.owner}`
  )
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

export type LabelConfig =
  | {
      assigned?: {
        teams?: string[]
        users?: string[]
      }
      approved?: {
        teams?: string[]
        users?: string[]
      }
    }
  | string[]

const escapeDetailedLabelConfig = (labelConfig: LabelConfig) =>
  labelConfig instanceof Array
    ? {}
    : {
        ...(labelConfig?.assigned
          ? {
              assigned: {
                teams: labelConfig.assigned.teams?.map(entry =>
                  filterAtSign(entry)
                ),
                users: labelConfig.assigned.users?.map(entry =>
                  filterAtSign(entry)
                )
              }
            }
          : {}),
        ...(labelConfig?.approved
          ? {
              approved: {
                teams: labelConfig.approved.teams?.map(entry =>
                  filterAtSign(entry)
                ),
                users: labelConfig.approved.users?.map(entry =>
                  filterAtSign(entry)
                )
              }
            }
          : {})
      }

export function getLabelGlobMapFromObject(
  configObject: any
): Map<string, LabelConfig> {
  const labelGlobs: Map<string, LabelConfig> = new Map()
  for (const label in configObject) {
    if (typeof configObject[label] === 'string') {
      const escapedEntry = filterAtSign(configObject[label])
      labelGlobs.set(label, [escapedEntry])
    } else if (configObject[label] instanceof Array) {
      const escapedEntry = configObject[label].map(entry => filterAtSign(entry))
      labelGlobs.set(label, escapedEntry)
    } else if (
      'assigned' in configObject[label] ||
      'approved' in configObject[label]
    ) {
      const escapedEntry = escapeDetailedLabelConfig(configObject[label])
      labelGlobs.set(label, escapedEntry)
    } else {
      throw Error(
        `found unexpected type for label ${label} (should be string or array of globs)`
      )
    }
  }

  return labelGlobs
}

export async function mapLabelConfigTeamsToUsers(
  client: GitHub,
  labelConfigs: Map<string, LabelConfig>
): Promise<Map<string, string[]>> {
  const allTeams: string[] = []
  for (const [, labelReviewers] of labelConfigs.entries()) {
    if ('assigned' in labelReviewers || 'approved' in labelReviewers) {
      const currentLabelTeams = [
        ...new Set([
          ...(labelReviewers?.assigned?.teams ?? []),
          ...(labelReviewers?.approved?.teams ?? [])
        ])
      ]
      allTeams.push(...currentLabelTeams)
    } else if (labelReviewers instanceof Array) {
      allTeams.push(...labelReviewers)
    } else if (typeof labelReviewers === 'string') {
      allTeams.push(labelReviewers)
    }
  }
  const dedupedTeams = [...new Set(allTeams)]
  const arr = await Promise.all(
    dedupedTeams
      .map(team => filterAtSign(team))
      .map(async team => {
        const members = await getTeamMembers(client, team)
        return {
          team,
          members
        }
      })
  )
  return new Map(arr.map(obj => [obj.team, obj.members]))
}

export function createClient(token: string): GitHub {
  return github.getOctokit(token)
}

export async function addPrLabels(
  client: GitHub,
  prNumber: number,
  labels: string[]
) {
  const result = await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels
  })

  return result
}

export async function getPrLabels(client: GitHub, prNumber: number) {
  const result = await client.rest.issues.listLabelsOnIssue({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber
  })
  return result
}

export async function removePrLabel(
  client: GitHub,
  prNumber: number,
  label: string
) {
  const result = await client.rest.issues.removeLabel({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    name: label
  })
  return result
}

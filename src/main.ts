import * as core from '@actions/core'
import * as github from '@actions/github'

import {getReviewersLabels} from './reviewers'
import {
  getPrNumber,
  getPrAuthor,
  getLabelsConfiguration,
  createClient,
  getAllReviewers,
  listReviews,
  getPrLabels,
  addPrLabels,
  mapLabelConfigTeamsToUsers
} from './github'
import {FailureResponse, ReviewResponse} from './types'

async function run() {
  try {
    const token = core.getInput('repo-token', {required: true})
    const configPath = core.getInput('configuration-path', {required: true})
    const teamsRepo = core.getInput('teams-repo', {required: false})
    const teamsBranch = core.getInput('teams-branch', {required: false})

    const externalRepo =
      teamsRepo !== '' ? {repo: teamsRepo, ref: teamsBranch} : undefined

    const pullRequest = github.context.payload.pull_request

    if (pullRequest == null) {
      core.info('Could not get pull request number from context, exiting')
      return
    }

    const prNumber = getPrNumber()
    if (!prNumber) {
      core.info('Could not get pull request number from context, exiting')
      return
    }

    const allReviewers = getAllReviewers()
    if (!allReviewers) {
      core.info('Could not get pull request user from context, exiting')
      return
    }
    core.info(`Reviewer list: ${pullRequest.number} body:`)
    console.log(allReviewers.length)
    console.log(allReviewers)

    const client = createClient(token)

    const allReviews = await listReviews(client, externalRepo)
    if (!allReviews) {
      core.info('Could not get pull request user from context, exiting')
      return
    }
    core.info(`Reviews list: ${pullRequest.number} body: `)
    console.log(allReviews.length)
    console.log(allReviews)

    const labelsConfiguration = await getLabelsConfiguration(
      client,
      configPath,
      externalRepo
    )

    core.info(`Labels Configuration body`)
    console.log([...labelsConfiguration.entries()])
    const teamsMap = await mapLabelConfigTeamsToUsers(
      client,
      labelsConfiguration
    )

    const labelsToApply = getReviewersLabels(
      labelsConfiguration,
      allReviewers,
      allReviews,
      teamsMap
    )
    console.log('labelsToApply')
    console.log(labelsToApply)
    if (labelsToApply.length > 0)
      await addPrLabels(client, prNumber, labelsToApply)
    core.setOutput('reviewer_labels', JSON.stringify(labelsToApply))
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
}

run()

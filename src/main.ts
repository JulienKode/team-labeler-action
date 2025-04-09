import * as core from '@actions/core'
import {getTeamLabel} from './teams'
import {
  getPrNumber,
  getPrAuthor,
  getLabelsConfiguration,
  addLabels,
  createClient,
  getUserTeams
} from './github'

async function run() {
  try {
    const token = core.getInput('repo-token', {required: true})
    const orgToken = core.getInput('org-token', {required: false})
    const configPath = core.getInput('configuration-path', {required: true})
    const teamsRepo = core.getInput('teams-repo', {required: false})
    const teamsBranch = core.getInput('teams-branch', {required: false})

    const prNumber = getPrNumber()
    if (!prNumber) {
      core.info('Could not get pull request number from context, exiting')
      return
    }

    const author = getPrAuthor()
    if (!author) {
      core.info('Could not get pull request user from context, exiting')
      return
    }

    const client = createClient(token)
    const orgClient = orgToken ? createClient(orgToken) : null
    core.debug(`Using org-token: ${orgToken ? 'Yes' : 'No'}`)

    const labelsConfiguration: Map<string, string[]> =
      await getLabelsConfiguration(
        client,
        configPath,
        teamsRepo !== '' ? {repo: teamsRepo, ref: teamsBranch} : undefined
      )

    // Debug log all labels configuration
    core.debug('Labels configuration:')
    for (const [label, patterns] of labelsConfiguration.entries()) {
      core.debug(`  ${label}: ${JSON.stringify(patterns)}`)
    }

    const userTeams = await getUserTeams(orgClient)
    core.debug(`User teams (${userTeams.length}): ${JSON.stringify(userTeams)}`)

    const labels: string[] = getTeamLabel(labelsConfiguration, `@${author}`)
    core.debug(`Direct user labels for @${author}: ${JSON.stringify(labels)}`)

    const teamLabels: string[] = userTeams
      .map(userTeam => {
        const teamMatchLabels = getTeamLabel(labelsConfiguration, userTeam)
        core.debug(
          `Labels for team ${userTeam}: ${JSON.stringify(teamMatchLabels)}`
        )
        return teamMatchLabels
      })
      .flat()
    core.debug(`Team-based labels: ${JSON.stringify(teamLabels)}`)

    const allLabels = [...new Set([...labels, ...teamLabels])]
    core.debug(`Final labels to apply: ${JSON.stringify(allLabels)}`)

    if (allLabels.length > 0) await addLabels(client, prNumber, allLabels)
    core.setOutput('team_labels', JSON.stringify(allLabels))
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
}

run()

import * as core from '@actions/core'

export function getTeamLabel(
  labelsConfiguration: Map<string, string[]>,
  author: string
): string[] {
  core.debug(`Looking for team labels for: ${author}`)
  const labels: string[] = []
  for (const [label, authors] of labelsConfiguration.entries()) {
    core.debug(`Checking label "${label}" with ${authors.length} entries`)
    const matchedAuthor = authors.find(
      a => a.toLowerCase() === author.toLowerCase()
    )
    if (matchedAuthor) {
      core.debug(`Match found for "${label}": ${matchedAuthor}`)
      labels.push(label)
    }
  }
  core.debug(`Found labels for ${author}: ${JSON.stringify(labels)}`)
  return labels
}

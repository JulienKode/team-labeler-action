import * as github from '@actions/github'
import {isUserMemberOfTeam} from './github'

export async function getTeamLabel(
  labelsConfiguration: Map<string, string[]>,
  author: string,
  client?: github.GitHub
): Promise<string[]> {
  const labels: string[] = []
  for (const [label, authors] of labelsConfiguration.entries()) {
    for (const authorConfig of authors) {
      if (isTeam(authorConfig)) {
        const orgUser = getOrgAndUser(authorConfig);
        if (client && await isUserMemberOfTeam(client, orgUser[0], orgUser[1], author)) {
          labels.push(label);
        }
      } else {
        if (authors.includes(`@${author}`)) labels.push(label)
      }
    }
  }

  return labels
}

function isTeam(authorConfig: string): boolean {
  return authorConfig.includes('/')
}

function getOrgAndUser(authorConfig: string): [string, string] {
  const orgUser = authorConfig.split('/', 2)

  return [orgUser[0].slice(1), orgUser[1]]
}

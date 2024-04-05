import * as github from '@actions/github'

type GitHub = ReturnType<typeof github.getOctokit>
export const filterAtSign = (str: string) => str.split(/^@/).join('')
export async function getTeamMembers(
  client: GitHub,
  teamName: string
): Promise<string[]> {
  const owner = github.context.repo.owner
  const teamSlug = teamName.toLowerCase().split(' ').join('-')

  const response = await client.request(
    `GET /orgs/${owner}/teams/${teamSlug}/members`,
    {
      org: owner,
      team_slug: teamName,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  return response.data.map(user => user.login)
}

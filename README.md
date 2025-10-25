# Team Labeler Action 👥

[![build](https://github.com/JulienKode/team-labeler-action/workflows/build/badge.svg)](https://github.com/JulienKode/team-labeler-action/actions)
[![test](https://github.com/JulienKode/team-labeler-action/workflows/test/badge.svg)](https://github.com/JulienKode/team-labeler-action/actions)
[![GitHub issues](https://img.shields.io/github/issues/JulienKode/team-labeler-action?style=flat-square)](https://github.com/JulienKode/team-labeler-action/issues)
[![GitHub forks](https://img.shields.io/github/forks/JulienKode/team-labeler-action?style=flat-square)](https://github.com/JulienKode/team-labeler-action/network)
[![GitHub stars](https://img.shields.io/github/stars/JulienKode/team-labeler-action?style=flat-square)](https://github.com/JulienKode/team-labeler-action/stargazers)
[![GitHub license](https://img.shields.io/github/license/JulienKode/team-labeler-action?style=flat-square)](https://github.com/JulienKode/team-labeler-action/blob/master/LICENSE)
[![Watch on GitHub](https://img.shields.io/github/watchers/JulienKode/team-labeler-action.svg?style=social)](https://github.com/JulienKode/team-labeler-action/watchers)
[![Tweet](https://img.shields.io/twitter/url/https/github.com/JulienKode/team-labeler-action.svg?style=social)](https://twitter.com/intent/tweet?text=Checkout%20this%20library%20https%3A%2F%2Fgithub.com%2FJulienKode%2Fteam-labeler-action)

This repository provides a **GitHub action** to automatically **team label** on a **pull request** based author team.
This is useful if multiple team are working on the same project.

![example](./assets/example.png)

## Configuration

### Create `.github/teams.yml`

You need to provide a yml file that contains members of your teams:

```yaml
LightSide:
  - '@Yoda'
  - '@Luke'

DarkSide:
  - '@DarkVador'
  - '@Palpatine'
```

### GitHub Team Support

You can also use GitHub team names to automatically apply labels based on team membership. To do this:

Include team names in your configuration using the format `@organization/team-slug`:

```yaml
FrontendTeam:
  - '@YourOrg/frontend'
  
BackendTeam:
  - '@YourOrg/backend'
```

## Usage

### Create `.github/workflows/team-labeler.yml`

Create a workflow (eg: `.github/workflows/team-labeler.yml` see [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) to utilize the labeler action.
This action only needs the GITHUB_TOKEN secret as it interacts with the GitHub API to modify labels. It's working for pull request and issues. The action can be used as such:

```yaml
on:
  pull_request:
  issues:
name: team-label
permissions:
  contents: read
  pull-requests: write
  issues: write # Necessary to create the labels if they do not exist yet.
jobs:
  team-labeler:
    runs-on: ubuntu-latest
    steps:
    - uses: JulienKode/team-labeler-action@v2.0.2
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
        # Optional: Add if you want to use GitHub team-based labeling
        org-token: "${{ secrets.ORG_TOKEN }}"
```

## Required Permissions

1. **For basic functionality**, the workflow needs:
   - `contents: read`
   - `pull-requests: write` (to apply labels to pull requests)
   - `issues: write` (to apply labels to issues and create labels if they do not exist yet)

2. **For GitHub team integration**, you need to:
   - Create a Personal Access Token with `read:org` permission
   - Add this token as a repository secret (e.g., `ORG_TOKEN`)
   - Pass this token to the action using the `org-token` parameter

> Note: While the `issues:write` permission does allow for creating labels through GitHub's API.


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
  - '@RebelAlliance/jedi'

DarkSide:
  - '@DarkVador'
  - '@Palpatine'
```

## Usage

### Create `.github/workflows/team-labeler.yml`

Create a workflow (eg: `.github/workflows/team-labeler.yml` see [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) to utilize the labeler action.
This action only needs the GITHUB_TOKEN secret as it interacts with the GitHub API to modify labels. If you want to create labels based on GitHub team memberships, the GITHUB_TOKEN should be a PAT that can read GitHub teams (`read:org`).
The action can be used as such:

```yaml
on: pull_request
name: team-label
jobs:
  team-labeler:
    runs-on: ubuntu-latest
    steps:
    - uses: JulienKode/team-labeler-action@v0.1.1
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
```

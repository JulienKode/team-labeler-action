# Auto Reviewer Labeler Action 👥

[![build](https://github.com/Shenato/auto-reviewer-labeler-action/workflows/build/badge.svg)](https://github.com/Shenato/auto-reviewer-labeler-action/actions)
[![test](https://github.com/Shenato/auto-reviewer-labeler-action/workflows/test/badge.svg)](https://github.com/Shenato/auto-reviewer-labeler-action/actions)
[![GitHub issues](https://img.shields.io/github/issues/Shenato/auto-reviewer-labeler-action?style=flat-square)](https://github.com/Shenato/auto-reviewer-labeler-action/issues)
[![GitHub forks](https://img.shields.io/github/forks/Shenato/auto-reviewer-labeler-action?style=flat-square)](https://github.com/Shenato/auto-reviewer-labeler-action/network)
[![GitHub stars](https://img.shields.io/github/stars/Shenato/auto-reviewer-labeler-action?style=flat-square)](https://github.com/Shenato/auto-reviewer-labeler-action/stargazers)
[![GitHub license](https://img.shields.io/github/license/Shenato/auto-reviewer-labeler-action?style=flat-square)](https://github.com/Shenato/auto-reviewer-labeler-action/blob/master/LICENSE)
[![Watch on GitHub](https://img.shields.io/github/watchers/Shenato/auto-reviewer-labeler-action.svg?style=social)](https://github.com/Shenato/auto-reviewer-labeler-action/watchers)


This repository provides a **GitHub action** to automatically **label** a **pull request** based reviewers assigned.
This is useful if multiple team are working on the same project.

![example](./assets/example.png)

## Configuration

### Create `.github/reviewer_labels.yml`

You need to provide a yml file that contains the label and a list of the reviewers that assign that label:

```yaml
'Team Light Triaged':
  assigned:
    teams:
      - '@Company/team-light'
    users:
      - '@Luke'
'Team Dark Triaged':
  assigned:
    teams:
      - '@Company/team-dark'
    users:
      - '@DarkVador'
      - '@Palpatine'

'Team Light Triaged Approved':
  approved:
    teams:
      - '@Company/team-light'
```

## Usage

### Create `.github/workflows/team-labeler.yml`

Create a workflow (eg: `.github/workflows/team-labeler.yml` see [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) to utilize the labeler action.
This action only needs the GITHUB_TOKEN secret as it interacts with the GitHub API to modify labels. It's working for pull request and issues. The action can be used as such:

```yaml
on:
  pull_request:
  issues:
name: reviewer-labeler
permissions:
  contents: read
  pull-requests: write
jobs:
  reviewer-labeler:
    runs-on: ubuntu-latest
    steps:
    - uses: Shenato/auto-team-labeler-action@v1.1.0
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
```


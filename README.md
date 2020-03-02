[![Actions Status](https://github.com/JulienKode/team-labeler-action/workflows/build-test/badge.svg)](https://github.com/JulienKode/team-labeler-action/actions)

This repository provides a **GitHub action** to automatically **team label** on a **pull request** based author team.
This is useful if multiple team are working on the same project.

![example](./assets/example.png)

# Team Labeler Action 👥

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

## Usage

### Create `.github/workflows/team-labeler.yml`

Create a workflow (eg: `.github/workflows/team-labeler.yml` see [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)) to utilize the labeler action.
This action only needs the GITHUB_TOKEN secret as it interacts with the GitHub API to modify labels. The action can be used as such:

```yaml
on: pull_request
name: team-label
jobs:
  team-labeler:
    runs-on: ubuntu-latest
    steps:
    - uses: JulienKode/team-labeler-action@v0.1.0
      with:
        repo-token: "${{ secrets.GITHUB_TOKEN }}"
```

export type ExternalRepo = {
  repo: string
  ref: string
}

export type FailureResponse = {
  message: string
  documentation_url: string
}

export type ReviewResponse = {
  author_association: string
  body: string
  commit_id: string
  html_url: string
  id: number
  node_id: string
  pull_request_url: string
  state: string
  submitted_at: string
  user: {
    avatar_url: string
    events_url: string
    followers_url: string
    following_url: string
    gists_url: string
    gravatar_id: string
    html_url: string
    id: number
    login: string
    node_id: string
    organizations_url: string
    received_events_url: string
    repos_url: string
    site_admin: boolean
    starred_url: string
    subscriptions_url: string
    type: string
    url: string
  }
  _links: {
    html: {
      href: string
    }
    pull_request: {
      href: string
    }
  }
}

// Patch undici.fetch to proxy through globalThis.fetch.
// @actions/github uses undici.fetch directly (bypassing globalThis.fetch),
// which MSW cannot intercept. This redirects undici.fetch through
// globalThis.fetch so MSW's setupServer() can intercept all HTTP requests.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const undici = require('undici')
undici.fetch = (...args: Parameters<typeof globalThis.fetch>) =>
  globalThis.fetch(...args)

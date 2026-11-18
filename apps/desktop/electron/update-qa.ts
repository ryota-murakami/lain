import { readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

interface UpdateQAIdentity {
  packaged: boolean
  version: string
  appPath: string
}

/**
 * Permit a local update feed only for a packaged QA version inside its isolated fixture.
 * Main calls this before setting userData; the updater repeats it before selecting a provider.
 * @param env - Explicit QA opt-in, test mode, temporary profile and loopback feed URL.
 * @param identity - Native application identity, never renderer input.
 * @returns Validated fixture paths, or undefined for every normal application launch.
 * @throws When an opted-in fixture points outside its temporary workspace or uses a remote feed.
 * @example
 * const fixture = readUpdateQAFixture(process.env, { packaged: app.isPackaged, version: app.getVersion(), appPath: app.getAppPath() })
 */
export function readUpdateQAFixture(
  env: NodeJS.ProcessEnv,
  identity: UpdateQAIdentity,
) {
  if (env.LAIN_UPDATE_QA !== '1') return undefined
  if (
    !identity.packaged ||
    env.LAIN_TEST_MODE !== '1' ||
    !/^\d+\.\d+\.\d+-qa\.\d+\.[12]$/.test(identity.version)
  ) {
    throw new Error(
      'Update QA requires a packaged QA version with synthetic authentication.',
    )
  }
  const profile = realpathSync(env.LAIN_USER_DATA_DIR ?? '')
  const workspace = path.dirname(profile)
  const temporary = realpathSync(tmpdir())
  // Real paths reject symlinks into an existing application or personal profile.
  if (
    path.dirname(workspace) !== temporary ||
    !/^lain-update-qa-/.test(path.basename(workspace)) ||
    path.basename(profile) !== 'profile'
  ) {
    throw new Error('Update QA requires its own temporary profile.')
  }
  const installed = realpathSync(identity.appPath)
  if (!installed.startsWith(`${workspace}${path.sep}`)) {
    throw new Error(
      'Update QA cannot replace an application outside its fixture.',
    )
  }
  if (
    readFileSync(path.join(profile, '.lain-update-qa'), 'utf8') !==
    'isolated-native-update-fixture-v1'
  ) {
    throw new Error('The update QA profile marker is missing.')
  }
  const feed = new URL(env.LAIN_UPDATE_QA_FEED ?? '')
  if (
    feed.protocol !== 'http:' ||
    feed.hostname !== '127.0.0.1' ||
    !feed.port ||
    feed.username ||
    feed.password ||
    feed.search ||
    feed.hash
  ) {
    throw new Error('Update QA permits an explicit loopback HTTP feed only.')
  }
  return { profile, workspace, feed: feed.href }
}

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, expect, test } from 'vitest'

import { readUpdateQAFixture } from '../../electron/update-qa'

const workspaces: string[] = []
afterEach(() => {
  for (const workspace of workspaces.splice(0))
    rmSync(workspace, { recursive: true, force: true })
})

/** Create an isolated on-disk profile and app archive for the native safety contract. @example const fixture = setupFixture() */
function setupFixture() {
  const workspace = mkdtempSync(path.join(tmpdir(), 'lain-update-qa-'))
  workspaces.push(workspace)
  const profile = path.join(workspace, 'profile')
  mkdirSync(profile)
  writeFileSync(
    path.join(profile, '.lain-update-qa'),
    'isolated-native-update-fixture-v1',
  )
  const appPath = path.join(workspace, 'app.asar')
  writeFileSync(appPath, 'fixture')
  return {
    env: {
      LAIN_UPDATE_QA: '1',
      LAIN_TEST_MODE: '1',
      LAIN_USER_DATA_DIR: profile,
      LAIN_UPDATE_QA_FEED: 'http://127.0.0.1:4321/',
    },
    identity: { packaged: true, version: '0.1.2-qa.20261109.1', appPath },
  }
}

test('normal releases ignore fixture settings unless explicitly opted in', () => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act / Assert
  expect(
    readUpdateQAFixture({ ...env, LAIN_UPDATE_QA: undefined }, identity),
  ).toBeUndefined()
})

test('isolated signed QA versions may use their own loopback feed', () => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act
  const fixture = readUpdateQAFixture(env, identity)
  // Assert
  expect(fixture?.feed).toBe('http://127.0.0.1:4321/')
  expect(path.basename(fixture?.profile ?? '')).toBe('profile')
})

test.each([
  'https://example.com/',
  'http://localhost:4321/',
  'http://127.0.0.1/',
  'http://user:password@127.0.0.1:4321/',
])('QA refuses a nonisolated update feed: %s', (feed) => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act / Assert
  expect(() =>
    readUpdateQAFixture({ ...env, LAIN_UPDATE_QA_FEED: feed }, identity),
  ).toThrow('loopback HTTP feed only')
})

test('a production version cannot opt into the QA feed', () => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act / Assert
  expect(() =>
    readUpdateQAFixture(env, { ...identity, version: '0.1.1' }),
  ).toThrow('packaged QA version')
})

test('QA cannot replace an app outside its temporary workspace', () => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act / Assert
  expect(() =>
    readUpdateQAFixture(env, { ...identity, appPath: tmpdir() }),
  ).toThrow('outside its fixture')
})

test('QA cannot reuse a personal profile even if the environment requests it', () => {
  // Arrange
  const { env, identity } = setupFixture()
  // Act / Assert
  expect(() =>
    readUpdateQAFixture({ ...env, LAIN_USER_DATA_DIR: tmpdir() }, identity),
  ).toThrow('own temporary profile')
})

import { expect, test } from 'vitest'

import { RequestBudget } from './request-budget'

test('background synchronization leaves thirty requests per minute for other clients', () => {
  // Arrange
  const budget = new RequestBudget()
  for (let request = 0; request < 90; request++) budget.reserve(1000)
  // Act
  const delay = budget.reserve(1000)
  // Assert
  expect(delay).toBe(60_000)
})

test('rate-limit reset delays new work without replaying mutations', () => {
  // Arrange
  const budget = new RequestBudget()
  budget.block(80_000)
  // Act
  const delay = budget.reserve(20_000)
  // Assert
  expect(delay).toBe(60_000)
})

test('queued requests honor a newer server reset when their original wait expires', () => {
  // Arrange
  const budget = new RequestBudget()
  for (let request = 0; request < 90; request++) budget.reserve(1000)
  expect(budget.reserve(1000)).toBe(60_000)
  budget.block(100_000)
  // Act
  const delay = budget.reserve(61_000)
  // Assert
  expect(delay).toBe(39_000)
})

test('a large waiting queue cannot burst past the request limit after cooldown', () => {
  // Arrange
  const budget = new RequestBudget()
  budget.block(60_000)
  for (let request = 0; request < 200; request++) budget.reserve(1000)
  // Act
  const immediatelyAllowed = Array.from({ length: 200 }, () =>
    budget.reserve(60_000),
  ).filter((delay) => delay === 0).length
  // Assert
  expect(immediatelyAllowed).toBe(90)
})

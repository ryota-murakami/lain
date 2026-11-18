import { chromium } from '../../../apps/desktop/node_modules/@playwright/test/index.mjs'
import { writeFile } from 'node:fs/promises'

/**
 * Calculates WCAG relative luminance for an authored opaque hex color.
 * The contrast audit calls this for the theme's base text/background tokens.
 * @returns Relative luminance in the inclusive range zero to one.
 * @example
 * luminance('#ffffff')
 */
function luminance(color) {
  let value = color.trim().slice(1)
  if (value.length === 3)
    value = [...value].map((digit) => digit + digit).join('')
  const channels = [0, 2, 4].map(
    (index) => parseInt(value.slice(index, index + 2), 16) / 255,
  )
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

/**
 * Compares a base text/background pair during the focused theme audit.
 * @returns WCAG contrast ratio; a minimum of 4.5 is required here.
 * @example
 * contrast('#000000', '#ffffff')
 */
function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => a - b)
  return Number(((values[1] + 0.05) / (values[0] + 0.05)).toFixed(2))
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const results = []
try {
  // This is a token audit, not a claim of complete WCAG conformance.
  for (let index = 1; index <= 12; index += 1) {
    const id = `W${String(index).padStart(2, '0')}`
    await page.goto(`http://127.0.0.1:4317/${id}/`)
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.body)
      return Object.fromEntries(
        [
          '--bg',
          '--ink',
          '--muted',
          '--accent',
          '--accent-ink',
          '--surface',
        ].map((property) => [property, style.getPropertyValue(property)]),
      )
    })
    results.push({
      id,
      body: contrast(colors['--ink'], colors['--bg']),
      secondary: contrast(colors['--muted'], colors['--bg']),
      surfaceSecondary: contrast(colors['--muted'], colors['--surface']),
      download: contrast(colors['--accent-ink'], colors['--accent']),
    })
  }
} finally {
  await browser.close()
}
await writeFile(
  new URL('./contrast-results.json', import.meta.url),
  JSON.stringify(results, null, 2),
)
const failures = results.filter(({ id: _id, ...ratios }) =>
  Object.values(ratios).some((ratio) => ratio < 4.5),
)
console.log(
  JSON.stringify({
    checked: 48,
    failures,
    minimum: Math.min(
      ...results.flatMap(({ id: _id, ...ratios }) => Object.values(ratios)),
    ),
  }),
)
if (failures.length > 0) process.exitCode = 1

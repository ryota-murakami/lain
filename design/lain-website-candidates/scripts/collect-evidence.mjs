import { execFileSync } from 'node:child_process'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const qa = fileURLToPath(new URL('../qa/', import.meta.url))
await mkdir(`${qa}/videos`, { recursive: true })
await mkdir(`${qa}/frames`, { recursive: true })
const tests = await readdir(`${qa}/test-results`)
const manifest = []

// Named evidence survives Playwright's per-run output cleanup.
for (let index = 1; index <= 12; index += 1) {
  const id = `W${String(index).padStart(2, '0')}`
  const matches = tests.filter((name) => name.startsWith(`motion-${id}-`))
  if (matches.length !== 1)
    throw new Error(`Expected exactly one motion recording for ${id}`)
  const input = `${qa}/test-results/${matches[0]}/video.webm`
  const video = `${qa}/videos/${id}-walkthrough.mp4`
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-c:v',
    'libx264',
    '-crf',
    '24',
    '-preset',
    'fast',
    '-pix_fmt',
    'yuv420p',
    '-an',
    video,
  ])
  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', video],
      { encoding: 'utf8' },
    ),
  )
  const duration = Number(probe.format.duration)
  const sheet = `${qa}/frames/${id}-motion.png`
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    video,
    '-vf',
    `fps=${12 / duration},tpad=stop_mode=clone:stop_duration=1,scale=480:338,tile=3x4`,
    '-frames:v',
    '1',
    sheet,
  ])
  manifest.push({
    id,
    video: `videos/${id}-walkthrough.mp4`,
    frameSheet: `frames/${id}-motion.png`,
    durationSeconds: duration,
    sampling:
      '12 evenly spaced frames, left-to-right then top-to-bottom; last frame repeated only if rounding requires padding',
  })
}
await writeFile(`${qa}/video-manifest.json`, JSON.stringify(manifest, null, 2))
console.log('Preserved twelve videos and twelve extracted frame sheets.')

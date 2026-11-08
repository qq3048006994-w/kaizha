// Repeatable review matrix; every command keeps its real exit code and log.
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { startReviewBrowser, root } from './review-browser.mjs'

const runId = new Date().toISOString().replaceAll(':', '-')
const outDir = path.join(root, 'test-artifacts/review', runId)
await mkdir(outDir, { recursive: true })
const adapter = fileURLToPath(new URL('./review-platform.mjs', import.meta.url))
const unitFiles = (await readdir(path.join(root, 'src/game'))).filter(name => name.endsWith('.test.js')).map(name => `src/game/${name}`)
const commands = [
  ['build', ['node_modules/vite/bin/vite.js', 'build']],
  ['lint', ['node_modules/eslint/bin/eslint.js', 'src']],
  ['unit', ['--test', ...unitFiles]],
  ...['e2e', 'e2e-endings', 'e2e-undo', 'e2e-chapter-font', 'e2e-stage', 'check-dist',
    'check-nameplate', 'check-no-bold', 'check-archive-white', 'check-fonts'].map(name => [name, ['--import', adapter, `scripts/${name}.mjs`]]),
  ['check-bust-white', ['scripts/check_bust_white.py'], process.env.KAIZHA_PYTHON || 'python'],
  ['endings-flow', ['scripts/e2e-endings-flow.mjs']],
  ['reliability', ['scripts/e2e-reliability.mjs']],
]
const results = []
for (const [name, args, executable = process.execPath] of commands) {
  let fontRuntime
  let output = ''
  const started = Date.now()
  let code = null
  let error
  try {
    if (name === 'check-fonts') fontRuntime = await startReviewBrowser(4212)
    const child = spawn(executable, args, { cwd: root, timeout: 240000,
      env: { ...process.env, ...(fontRuntime ? { KAIZHA_URL: fontRuntime.baseUrl } : {}) },
      stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const outcome = await new Promise(resolve => {
      child.once('error', e => resolve({ code: null, error: String(e) }))
      child.once('close', (exitCode, signal) => resolve({ code: exitCode, ...(signal ? { error: signal } : {}) }))
    })
    code = outcome.code
    error = outcome.error
    // Some older suites report their assertions in JSON, not the exit code.
    if (code === 0) {
      const reportNames = { e2e: 'results.json', 'e2e-undo': 'undo-results.json',
        'e2e-chapter-font': 'chapter-font-results.json', 'e2e-stage': 'stage-results.json',
        'endings-flow': 'review/endings-flow-results.json', reliability: 'review/reliability-results.json' }
      if (reportNames[name]) {
        const reportPath = path.join(root, 'test-artifacts', reportNames[name])
        if ((await stat(reportPath)).mtimeMs < started) throw new Error('Stale assertion report')
        const report = JSON.parse(await readFile(reportPath, 'utf8'))
        if (!report.results?.length || report.results.some(result => !result.pass)) throw new Error('Missing or failed assertions')
        await writeFile(path.join(outDir, `${name}-assertions.json`), JSON.stringify(report, null, 2))
      }
      if (name === 'unit' && !/tests [1-9]/.test(output)) throw new Error('Zero unit tests executed')
    }
  } catch (e) { error = String(e) } finally { await fontRuntime?.close() }
  const result = { name, pass: code === 0 && !error, exitCode: code, seconds: Math.round((Date.now() - started) / 100) / 10,
    ...(error ? { error } : {}), log: `${name}.log` }
  results.push(result)
  await writeFile(path.join(outDir, `${name}.log`), output + (error ? `\n${error}\n` : ''))
  await writeFile(path.join(outDir, 'summary.json'), JSON.stringify({ runId, results }, null, 2))
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${name} (${result.seconds}s)`)
}
console.log(`Logs: ${outDir}`)
if (results.some(result => !result.pass)) process.exitCode = 1

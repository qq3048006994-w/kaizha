import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import './review-platform.mjs'

export const root = fileURLToPath(new URL('..', import.meta.url))
export async function startReviewBrowser(port = 4210) {
  const baseUrl = `http://127.0.0.1:${port}`
  // Refuse to use an unrelated service, so a stale server cannot yield a false pass.
  let occupied = false
  try { await fetch(baseUrl, { signal: AbortSignal.timeout(1000) }); occupied = true } catch {}
  if (occupied) throw new Error(`Port ${port} is already in use`)
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  server.stdout.on('data', chunk => { log += chunk })
  server.stderr.on('data', chunk => { log += chunk })
  let browser
  const close = async () => {
    try { await browser?.close() } finally {
      if (server.exitCode === null) {
        const exited = new Promise(resolve => server.once('exit', resolve))
        server.kill()
        await exited
      }
    }
  }
  try {
    let ready = false
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error(log)
      try {
        const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1000) })
        if (response.ok) { ready = true; break }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (!ready) throw new Error(`Server not ready: ${log}`)
    browser = await chromium.launch({ headless: true })
    return { browser, baseUrl, close }
  } catch (error) { await close(); throw error }
}

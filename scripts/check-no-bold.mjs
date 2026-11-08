// 验证结局页标题、确认框标题等金色浮雕标题不再合成加粗
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4185
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
})

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(baseUrl); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('server not ready')
}

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  // 首页 → 确认框（重开卷宗）：先写入存档，制造"已有存档"状态
  await page.evaluate(() => {
    localStorage.setItem('kaizha:auto', JSON.stringify({ version: 1, game: { history: [] }, savedAt: Date.now() }))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const t = btns.find((b) => /开始审案/.test(b.textContent))
    t?.click()
  })
  await page.waitForTimeout(600)
  const hasConfirm = await page.locator('.confirm-dialog').count()
  if (hasConfirm > 0) {
    const info = await page.evaluate(() => {
      const h = document.querySelector('.confirm-dialog h2')
      const cs = getComputedStyle(h)
      return { text: h.textContent.trim(), weight: cs.fontWeight, synthesis: cs.fontSynthesis, stroke: cs.webkitTextStrokeWidth }
    })
    console.log('confirm-dialog h2:', JSON.stringify(info))
    await page.screenshot({ path: `${outDir}/no-bold-confirm.png` })
  } else {
    console.log('confirm-dialog not found on home')
  }

  // 结局页标题：直接注入一个模拟结局 DOM 检查计算样式
  await page.evaluate(() => {
    document.body.innerHTML = `<main class="ending-page"><div class="ending-content"><div class="ending-kicker">结局 · 悬案待雪</div><h1>悬案待雪</h1></div></main>`
  })
  await page.waitForTimeout(300)
  const end = await page.evaluate(() => {
    const h = document.querySelector('.ending-content h1')
    const cs = getComputedStyle(h)
    return { text: h.textContent, weight: cs.fontWeight, synthesis: cs.fontSynthesis, stroke: cs.webkitTextStrokeWidth }
  })
  console.log('ending-content h1:', JSON.stringify(end))
  await page.screenshot({ path: `${outDir}/no-bold-ending.png` })

  await browser.close()
} finally {
  server.kill()
}
process.exit(0)

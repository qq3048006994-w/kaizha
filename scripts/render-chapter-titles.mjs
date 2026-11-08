// 在章节页上逐一替换主标题文本，验证四堂标题（鸣冤/合证/折辩/开铡）的行草渲染与不重叠
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4181
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
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.intro-skip').click()
  await page.waitForTimeout(600)

  for (const [i, title] of ['鸣冤', '合证', '折辩', '开铡'].entries()) {
    const info = await page.evaluate((t) => {
      const h1 = document.querySelector('.chapter-title-wrap h1')
      h1.innerHTML = ''
      for (const ch of t) {
        const s = document.createElement('span')
        s.textContent = ch
        h1.appendChild(s)
      }
      const boxes = [...h1.querySelectorAll('span')].map((s) => s.getBoundingClientRect())
      const overlap = boxes.some((b, k) => k > 0 && b.left < boxes[k - 1].right - 0.5)
      const h1b = h1.getBoundingClientRect()
      const cta = document.querySelector('.seal-cta').getBoundingClientRect()
      const num = document.querySelector('.chapter-number').getBoundingClientRect()
      const sub = document.querySelector('.chapter-title-wrap h2').getBoundingClientRect()
      return {
        text: h1.textContent,
        overlap,
        font: getComputedStyle(h1).fontFamily,
        size: getComputedStyle(h1).fontSize,
        titleBottom: Math.round(h1b.bottom),
        subTop: Math.round(sub.top),
        numBottom: Math.round(num.bottom),
        titleTop: Math.round(h1b.top),
        ctaTop: Math.round(cta.top),
        ctaBottom: Math.round(cta.bottom),
        viewH: window.innerHeight,
      }
    }, title)
    console.log(title, JSON.stringify(info))
    await page.screenshot({ path: `${outDir}/chapter-title-${i + 1}.png`, fullPage: true })
  }
  await browser.close()
} finally {
  server.kill()
}
process.exit(0)

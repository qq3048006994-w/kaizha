// 验证人物名牌文字在框内居中（含 letter-spacing 末尾空隙补偿）
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4187
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
  await page.waitForTimeout(500)
  // 升堂进入公堂
  await page.locator('.seal-cta').click()
  await page.waitForTimeout(900)

  const info = await page.evaluate(() => {
    const plate = document.querySelector('.dialogue-nameplate')
    const b = plate.getBoundingClientRect()
    const center = b.left + b.width / 2
    const out = { plateWidth: b.width, plateCenter: center, textAlign: getComputedStyle(plate).textAlign }
    for (const sel of ['span', 'small']) {
      const el = plate.querySelector(sel)
      const range = document.createRange()
      range.selectNodeContents(el)
      const r = range.getBoundingClientRect()
      out[sel] = { text: el.textContent, left: r.left, right: r.right, width: r.width, textCenter: r.left + r.width / 2 }
    }
    return out
  })
  console.log(JSON.stringify(info, null, 2))
  const spanOffset = Math.abs(info.span.textCenter - info.plateCenter)
  const smallOffset = Math.abs(info.small.textCenter - info.plateCenter)
  if (info.textAlign !== 'center') throw new Error(`名牌未居中：textAlign=${info.textAlign}`)
  if (spanOffset > 2) throw new Error(`名牌主文字未视觉居中：偏移 ${spanOffset}px`)
  if (smallOffset > 2) throw new Error(`名牌副标题未视觉居中：偏移 ${smallOffset}px`)
  console.log(`名牌居中校验通过：主文字偏移 ${spanOffset.toFixed(2)}px，副标题偏移 ${smallOffset.toFixed(2)}px`)
  await page.screenshot({ path: `${outDir}/nameplate-center.png` })
  // 名牌局部放大图
  const plate = await page.locator('.dialogue-nameplate').boundingBox()
  await page.screenshot({ path: `${outDir}/nameplate-zoom.png`, clip: { x: plate.x - 20, y: plate.y - 15, width: plate.width + 40, height: plate.height + 30 } })
  await browser.close()
} finally {
  server.kill()
}
process.exit(0)

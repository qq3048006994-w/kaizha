// 对比渲染：同一组章节标题在多款草书字体下的效果，供选型
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4183
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'

const fonts = [
  ['ZhiMangXing', '志莽行书'],
  ['LongCang', '龙藏体'],
  ['LiuJianMaoCao', '柳建毛草'],
  ['MaShanZheng', '马善政楷书'],
]

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
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const faces = fonts.map(([f]) => `@font-face{font-family:"${f}";src:url("/assets/fonts/${f}-Regular.ttf") format("truetype");}`).join('\n')
  await page.addStyleTag({ content: `
${faces}
body{background:#0d1512 !important;}
.row{display:flex;align-items:center;gap:40px;padding:24px 30px;border-bottom:1px solid #243028}
.tag{width:150px;font-size:15px;color:#c8bda0;line-height:1.6}
.s{font-size:104px;line-height:1.3;white-space:nowrap;color:#f4efe4}
` })
  await page.evaluate(({ fonts }) => {
    document.body.innerHTML = fonts.map(([f, n]) => `<div class="row"><div class="tag">${n}<br>${f}</div><div class="s" style="font-family:'${f}'">鸣冤 合证 折辩 开铡</div></div>`).join('')
  }, { fonts })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${outDir}/brush-compare.png`, fullPage: true })
  await browser.close()
} finally {
  server.kill()
}
process.exit(0)

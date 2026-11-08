// dist 离线校验：自带静态服务器，不依赖外部 preview 进程。
// 默认校验 <root>/dist；可用 KAIZHA_DIST 指向一次全新构建目录，
// 避免「删除 dist 被安全策略拦截」导致只能校验陈旧产物。
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = process.env.KAIZHA_DIST || path.join(root, 'dist')
const port = 4193
const baseUrl = `http://127.0.0.1:${port}`

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
}

const rootResolved = path.resolve(distDir)
const server = createServer(async (req, res) => {
  let rel = '/'
  try { rel = decodeURIComponent(new URL(req.url, baseUrl).pathname) } catch {}
  if (rel === '/' || rel === '') rel = '/index.html'
  let target = path.resolve(rootResolved, rel.replace(/^\/+/, ''))
  if (!target.startsWith(rootResolved)) { res.writeHead(403); res.end('forbidden'); return }
  try {
    const info = await stat(target)
    if (info.isDirectory()) target = path.join(target, 'index.html')
    const body = await readFile(target)
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream' })
    res.end(body)
  } catch {
    // SPA 回退：未知路径一律交给 index.html
    try {
      const body = await readFile(path.join(rootResolved, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(body)
    } catch {
      res.writeHead(404); res.end('not found')
    }
  }
})
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const external = []
page.on('request', (request) => {
  const url = request.url()
  if (!url.startsWith(baseUrl) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url)
})
const failed = []
page.on('response', (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`) })
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /开始审案/ }).click()
// 新版首章前有片头影像，跳过后进入第一章章节页
await page.waitForTimeout(800)
const skip = page.locator('.intro-skip')
if (await skip.count()) {
  await skip.click()
  await page.waitForTimeout(600)
}
await page.getByRole('button', { name: /升 堂/ }).click()
await page.waitForTimeout(1200)
// 首节点是旁白（「谁说话谁出现」→ 场上无人），推进到秦香莲发言节点
// 再校验单人近景舞台：恰好 1 位立绘、图片真实加载、旧中间人物层无残留。
const next = page.locator('.next-button').first()
if (await next.count()) { await next.click(); await page.waitForTimeout(800) }
const portraitCount = await page.locator('.stage-portrait img').count()
const portraitsLoaded = await page.evaluate(() =>
  [...document.querySelectorAll('.stage-portrait img')].every((img) => img.complete && img.naturalWidth > 0))
const legacyCharacter = await page.locator('.court-character').count()
const legacySlot = await page.locator('.stage-slot').count()
const stageData = await page.locator('.dialogue-stage').getAttribute('data-stage')
const report = { external, failed, portraitCount, portraitsLoaded, legacyCharacter, legacySlot, stageData, title: await page.title() }
console.log(JSON.stringify(report, null, 2))
await browser.close()
await new Promise((resolve) => server.close(resolve))
if (external.length || failed.length || portraitCount !== 1 || !portraitsLoaded || legacyCharacter > 0 || legacySlot > 0) process.exit(1)

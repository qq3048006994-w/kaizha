import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4173
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'
const results = []

function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
  if (!condition) throw new Error(`${name}: ${detail}`)
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('开发服务器未启动')
}

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (chunk) => { serverLog += chunk })
server.stderr.on('data', (chunk) => { serverLog += chunk })

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const consoleErrors = []
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(`${message.text()} @ ${message.location().url}`) })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('response', (response) => { if (response.status() === 404) consoleErrors.push(`404 ${response.url()}`) })

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  check('首页加载', await page.locator('.home-page').isVisible())
  check('首页无横向滚动', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: `${outDir}/desktop-1920-home.png`, fullPage: true })

  await page.getByRole('button', { name: /人物志/ }).click()
  check('人物志打开', await page.locator('.archive-modal-characters').isVisible())
  await page.screenshot({ path: `${outDir}/desktop-1920-characters.png`, fullPage: true })
  await page.getByRole('button', { name: '关闭案卷' }).click()
  await page.getByRole('button', { name: /游戏设置/ }).click()
  check('设置打开', await page.locator('.archive-modal-settings').isVisible())
  await page.getByRole('button', { name: '关闭案卷' }).click()
  await page.getByRole('button', { name: /结局档案/ }).click()
  check('结局档案打开', await page.locator('.archive-modal-endings').isVisible())
  await page.getByRole('button', { name: '关闭案卷' }).click()

  await page.getByRole('button', { name: /开始审案/ }).click()
  check('片头影像全屏播放', await page.locator('.intro-video-layer').isVisible())
  check('片头右上角可跳过', await page.locator('.intro-skip').isVisible())
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/desktop-1920-intro.png`, fullPage: true })
  const videoState = await page.evaluate(async () => {
    const video = document.querySelector('.intro-video')
    if (!video || !isFinite(video.duration)) return { ready: false }
    video.currentTime = Math.max(0, video.duration - 0.4)
    await new Promise((resolve) => { video.addEventListener('ended', resolve, { once: true }); setTimeout(resolve, 8000) })
    return {
      ready: true,
      duration: Math.round(video.duration),
      ended: video.ended,
      width: video.videoWidth,
      height: video.videoHeight,
    }
  })
  check('片头视频可解码播放', videoState.ready, JSON.stringify(videoState))
  // HEVC / hvc1 片源在无头 Edge 里 duration 仍有值、但 videoWidth=0 画面全黑，
  // 故必须单独断言视频轨真的解出了画面，防止「只有声音没有画面」的片头混进来。
  check('片头画面已解码（非黑屏）', videoState.width > 0 && videoState.height > 0, JSON.stringify(videoState))
  await page.locator('.chapter-opening').waitFor({ timeout: 15000 })
  check('片头播完自动进入章节开场', await page.locator('.chapter-opening').isVisible())
  await page.getByRole('button', { name: /升 堂/ }).click()
  await page.locator('.dialogue-text').click()
  await page.getByRole('button', { name: /继续/ }).click()
  await page.getByRole('button', { name: /先收状纸/ }).click()
  await page.locator('.dialogue-text').click()
  await page.getByRole('button', { name: /手动存档/ }).click()
  check('手动存档反馈', await page.locator('.game-toast').isVisible())
  await page.screenshot({ path: `${outDir}/desktop-1920-court.png`, fullPage: true })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /继续案件/ }).click()
  check('刷新后继续案件', await page.locator('.dialogue-paper').isVisible())
  await page.locator('.dialogue-text').click()
  await page.getByRole('button', { name: /继续/ }).click()

  const choice = async (name) => {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await page.locator('.dialogue-text').click()
    await page.getByRole('button', { name: /继续|本堂结案/ }).click()
    const nextCourt = page.getByRole('button', { name: /进入下一堂/ })
    if (await nextCourt.count()) await nextCourt.click()
  }
  const startCourt = async () => {
    await page.getByRole('button', { name: /升 堂/ }).click()
    await page.locator('.dialogue-text').click()
    const next = page.getByRole('button', { name: /继续/ })
    if (await next.count()) await next.click()
  }

  await choice('验看旧婚书')
  await choice('不与孩子争辩')
  await choice('封存原件')
  await choice('细问举刀')
  await choice('立案，先查物证')
  await startCourt()
  check('进入第二堂', await page.locator('text=第二堂·合证').first().isVisible())

  await choice('三方互核')
  await choice('依方位勘血')
  await choice('依法同验')
  await choice('由地保见证取纸')

  await page.getByRole('button', { name: /打开证据推演案/ }).click()
  const board = page.locator('.link-board')
  check('证据关联打开', await board.isVisible())
  await board.getByRole('button', { name: /状纸/ }).click()
  await board.getByRole('button', { name: /婚书/ }).click()
  await board.getByRole('button', { name: '关联推演' }).click()
  check('错误关联有提示', await board.locator('.link-workbench').filter({ hasText: '尚不能指向同一项事实' }).isVisible())
  await board.getByRole('button', { name: /状纸/ }).click()
  await board.getByRole('button', { name: /儿女户籍/ }).click()
  await board.getByRole('button', { name: '关联推演' }).click()
  await board.getByRole('button', { name: /韩琪钢刀/ }).click()
  await board.getByRole('button', { name: /驸马府刀鞘/ }).click()
  await board.getByRole('button', { name: /驸马府腰牌/ }).click()
  await board.getByRole('button', { name: '关联推演' }).click()
  await board.getByRole('button', { name: /三官堂血迹验状/ }).click()
  await board.getByRole('button', { name: /韩琪遗书/ }).click()
  await board.getByRole('button', { name: '关联推演' }).click()
  check('三组证据关联完成', await page.locator('.link-progress').filter({ hasText: '3' }).isVisible())
  await page.screenshot({ path: `${outDir}/desktop-1920-evidence-link.png`, fullPage: true })
  await page.getByRole('button', { name: '关闭证据关联' }).click()
  await choice('逐组关联')
  await choice('按三组证据写质询次序')
  await startCourt()

  await choice('并示婚书')
  await choice('合验钢刀')
  await page.locator('.dialogue-text').click()
  await page.getByRole('button', { name: /继续/ }).click()
  await choice('以验状血痕印证遗书')
  await choice('记下“奉命”失言')
  await startCourt()
  check('进入第四堂', await page.locator('text=第四堂·开铡').first().isVisible())

  for (const label of ['让书吏再读三条证据链', '衣食可安置', '跪接懿旨', '事实会写入判词']) await choice(label)
  await page.getByRole('button', { name: /依律宣判/ }).click()
  check('终审二次确认', await page.locator('.confirm-dialog').isVisible())
  await page.getByRole('button', { name: '确认宣判' }).click()
  check('正法昭彰结局', await page.locator('.ending-page h1').filter({ hasText: '正法昭彰' }).isVisible())
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${outDir}/desktop-1920-ending.png`, fullPage: true })

  await page.getByRole('button', { name: '返回开封府' }).click()
  await page.getByRole('button', { name: /继续案件/ }).click()
  check('结局后可继续查看结局', await page.locator('.ending-page').isVisible())

  for (const viewport of [{ width: 1600, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
    check(`${viewport.width}×${viewport.height} 无横向滚动`, noOverflow)
    await page.screenshot({ path: `${outDir}/viewport-${viewport.width}x${viewport.height}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => localStorage.clear())
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${outDir}/mobile-390-intro.png`, fullPage: true })
  await page.locator('.intro-skip').click()
  check('右上角跳过可直接断案', await page.locator('.chapter-opening').isVisible())
  await page.screenshot({ path: `${outDir}/mobile-390-chapter.png`, fullPage: true })
  await page.getByRole('button', { name: /升 堂/ }).click()
  await page.waitForTimeout(400)
  check('手机窄屏堂审无横向滚动', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: `${outDir}/mobile-390-court.png`, fullPage: true })

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.join('\n'))
  await writeFile(`${outDir}/results.json`, JSON.stringify({ passed: results.length, results }, null, 2))
  await browser.close()
} finally {
  server.kill()
}
console.log(`E2E passed: ${results.length} checks`)
// shell:true 启动的 npm 子进程可能留下未回收的句柄，显式退出避免非零退出码
process.exit(0)

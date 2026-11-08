// 专项验收：① 反悔机制（回到上一步 / 回到此处）② 有存档时可另立新卷宗（bug 修复）
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4177
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'
const results = []

function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
  if (!condition) throw new Error(`${name}: ${detail}`)
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('开发服务器未启动')
}

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  // ── 开始审案 → 跳过片头 ──
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.intro-skip').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: /升 堂/ }).click()
  await page.waitForTimeout(500)

  // ── 记录初始状态 ──
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  check('初始状态无回退记录', before.undoStack.length === 0, `undoStack=${before.undoStack?.length}`)

  // ── 推进到第一个有选项的节点 ──
  for (let i = 0; i < 4; i += 1) {
    const choice = page.locator('.choice-button:not([disabled])').first()
    if (await choice.count()) break
    const next = page.locator('.next-button').first()
    if (await next.count()) { await next.click(); await page.waitForTimeout(450) } else break
  }
  check('已推进到可抉择节点', await page.locator('.choice-button:not([disabled])').count() > 0)

  // ── 做第一次抉择 ──
  const firstChoice = page.locator('.choice-button:not([disabled])').first()
  await firstChoice.click()
  await page.waitForTimeout(700)
  const afterChoice = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  check('抉择后产生一条回退记录', afterChoice.undoStack.length === 1, `undoStack=${afterChoice.undoStack?.length}`)
  check('抉择后审案记录 +1', afterChoice.history.length === before.history.length + 1)
  check('快照记录了 history 长度而非全文', typeof afterChoice.undoStack[0].historyLength === 'number' && afterChoice.undoStack[0].history === undefined)

  // ── 继续推进几步 ──
  for (let i = 0; i < 2; i += 1) {
    const next = page.locator('.next-button').first()
    if (await next.count()) { await next.click(); await page.waitForTimeout(500) }
    const choice = page.locator('.choice-button:not([disabled])').first()
    if (await choice.count()) { await choice.click(); await page.waitForTimeout(600) }
  }
  const mid = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  check('多步后回退记录累积', mid.undoStack.length >= 2, `undoStack=${mid.undoStack.length}`)

  // ── 打开「审案记录」面板 ──
  await page.getByRole('button', { name: /录/ }).first().click()
  await page.waitForTimeout(600)
  check('审案记录面板出现「回到上一步」', await page.locator('.archive-undo-bar').isVisible())
  const undoStepButtons = await page.locator('.archive-undo-step').count()
  check('每条记录旁有「回到此处」按钮', undoStepButtons >= 1, `count=${undoStepButtons}`)
  await page.screenshot({ path: `${outDir}/undo-history-panel.png`, fullPage: true })

  // ── 点「回到上一步」，验证状态真的回退 ──
  const beforeUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  await page.locator('.archive-undo-bar .archive-button').click()
  await page.waitForTimeout(800)
  const afterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  check('回退后回到审案页', await page.locator('.game-page').isVisible())
  check('回退后回退记录减少', afterUndo.undoStack.length === beforeUndo.undoStack.length - 1,
    `${beforeUndo.undoStack.length} -> ${afterUndo.undoStack.length}`)
  check('回退后审案记录被截断', afterUndo.history.length < beforeUndo.history.length,
    `${beforeUndo.history.length} -> ${afterUndo.history.length}`)
  check('回退后该步获得的证物被收回', afterUndo.evidence.length <= beforeUndo.evidence.length)

  // ── 回退后能重新抉择（关键：反悔后重新选） ──
  const rechoice = page.locator('.choice-button:not([disabled])').first()
  check('回退后回到可抉择状态', await rechoice.count() > 0)
  let afterRechoice = afterUndo
  if (await rechoice.count()) {
    await rechoice.click()
    await page.waitForTimeout(600)
    afterRechoice = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
    check('回退后可重新做出抉择', afterRechoice.history.length > afterUndo.history.length)
  }

  // ── 底栏「回到上一步」按钮（限定 .game-footer 作用域，避免匹配到面板内同名按钮） ──
  await page.locator('.game-footer button', { hasText: '回到上一步' }).click()
  await page.waitForTimeout(600)
  const afterFooterUndo = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
  check('底栏「回到上一步」可用', afterFooterUndo.undoStack.length < afterRechoice.undoStack.length,
    `${afterRechoice.undoStack.length} -> ${afterFooterUndo.undoStack.length}`)
  await page.screenshot({ path: `${outDir}/undo-after-revert.png`, fullPage: true })

  // ── 回到主菜单，验证「另立新卷宗」bug 修复 ──
  await page.locator('.game-tools button', { hasText: '设' }).click()
  await page.waitForTimeout(500)
  await page.locator('.archive-action-buttons button', { hasText: '返回主菜单' }).click()
  await page.waitForTimeout(700)
  check('返回主菜单成功', await page.locator('.home-page').isVisible())

  // 此刻应存在自动存档 → 点「开始审案」应弹出游戏内确认框（而非原生 confirm）
  let nativeDialog = false
  page.on('dialog', async (d) => { nativeDialog = true; await d.dismiss() })
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(700)
  const hasSaveNow = await page.evaluate(() => Boolean(localStorage.getItem('kaizha:auto')))
  check('主菜单检测到已有存档', hasSaveNow)
  check('有存档时弹出游戏内确认框（bug 已修复）', await page.locator('.confirm-overlay').isVisible())
  check('未触发原生 confirm 弹窗', !nativeDialog)
  await page.screenshot({ path: `${outDir}/new-case-confirm.png`, fullPage: true })

  // 确认另立新案 → 应进入片头
  await page.getByRole('button', { name: /确认另立新案/ }).click()
  await page.waitForTimeout(800)
  check('确认后进入片头影像', await page.locator('.intro-video').count() > 0 || await page.locator('.intro-skip').isVisible())

  await browser.close()
  check('控制台无错误', consoleErrors.length === 0, consoleErrors.join('\n'))
  await writeFile(`${outDir}/undo-results.json`, JSON.stringify({ passed: results.length, results }, null, 2))
  console.log(`专项验收通过：${results.length} checks`)
} finally {
  server.kill()
}
process.exit(0)

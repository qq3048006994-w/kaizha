import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { startReviewBrowser, root } from './review-browser.mjs'

const outDir = `${root}/test-artifacts/round2`
await mkdir(outDir, { recursive: true })
const results = []
const runtime = await startReviewBrowser(4217)
const fresh = () => ({ courtIndex: 0, nodeId: 'c1_plaint', phase: 'story', evidence: [], flags: [],
  insight: 0, pressure: 0, history: [], readNodeIds: [], undoStack: [], nextNode: null,
  lastResponse: '', ending: null, finalChoice: null, startedAt: new Date().toISOString() })
const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)

// Every fixture is isolated in a new browser context; no persistent demo profile
// or production story data is changed by these failure-injection tests.
async function seed(page, automatic, manual) {
  await page.evaluate(({ automatic, manual }) => {
    if (automatic) localStorage.setItem('kaizha:auto', JSON.stringify(automatic))
    if (manual) localStorage.setItem('kaizha:manual', JSON.stringify(manual))
  }, { automatic: automatic && { version: 1, state: automatic }, manual: manual && { version: 1, state: manual } })
  await page.reload()
}

async function blockStorage(page, { writes = [], removes = [] }) {
  await page.evaluate(({ writes, removes }) => {
    const originalSet = Storage.prototype.setItem
    const originalRemove = Storage.prototype.removeItem
    window.__blockedStorage = { writes, removes }
    Storage.prototype.setItem = function (key, value) {
      if (window.__blockedStorage.writes.includes(key)) throw new DOMException('Test write refusal', 'QuotaExceededError')
      return originalSet.call(this, key, value)
    }
    Storage.prototype.removeItem = function (key) {
      if (window.__blockedStorage.removes.includes(key)) throw new DOMException('Test remove refusal', 'SecurityError')
      return originalRemove.call(this, key)
    }
  }, { writes, removes })
}

async function continueCase(page) {
  await page.getByRole('button', { name: /继续案件/ }).click()
}

async function run(name, action) {
  const context = await runtime.browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  try {
    await page.goto(runtime.baseUrl)
    await action(page)
    assert.deepEqual(errors, [])
    results.push({ name, pass: true, consoleErrors: errors })
    console.log(`PASS storage feedback: ${name}`)
  } catch (error) {
    results.push({ name, pass: false, error: String(error), consoleErrors: errors })
    console.error(`FAIL storage feedback: ${name}: ${error}`)
  } finally {
    await context.close()
  }
}

try {
  await run('automatic failure remains visible; manual success cannot mask it; actual automatic recovery clears it', async page => {
    await seed(page, fresh())
    await blockStorage(page, { writes: ['kaizha:auto'] })
    await continueCase(page)
    const status = page.locator('.game-footer [data-save-state]')
    await page.waitForFunction(() => document.querySelector('.game-footer [data-save-state]')?.textContent.includes('自动存档失败'))
    assert.equal(await status.getAttribute('data-save-state'), 'error')
    await page.getByRole('button', { name: /先收状纸/ }).click()
    await page.locator('.game-footer').getByRole('button', { name: '手动存档', exact: true }).click()
    assert.match(await page.locator('.game-toast').innerText(), /手动存档完成/)
    assert.match(await status.innerText(), /自动存档失败，刷新可能丢失进度/)
    assert.equal((await readState(page)).history.length, 0)
    await page.evaluate(() => { window.__blockedStorage.writes = [] })
    assert.equal(await status.getAttribute('data-save-state'), 'error')
    await page.getByRole('button', { name: /^继续/ }).click()
    await page.waitForFunction(() => document.querySelector('.game-footer [data-save-state]')?.dataset.saveState === 'saved')
    assert.match(await status.innerText(), /自动存档已保存/)
    const restored = await readState(page)
    assert.equal(restored.nodeId, 'c1_marriage')
    assert.equal(restored.history.length, 1)
  })

  await run('manual write failure shows an error without corrupting successful automatic status', async page => {
    await seed(page, fresh())
    await blockStorage(page, { writes: ['kaizha:manual'] })
    await continueCase(page)
    await page.waitForFunction(() => document.querySelector('.game-footer [data-save-state]')?.dataset.saveState === 'saved')
    await page.locator('.game-footer').getByRole('button', { name: '手动存档', exact: true }).click()
    assert.match(await page.locator('.game-toast').innerText(), /失败/)
    assert.equal(await page.locator('.game-footer [data-save-state]').getAttribute('data-save-state'), 'saved')
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:manual')), null)
  })

  await run('reset refusal preserves the current case, settings panel, and in-memory progress', async page => {
    await seed(page, fresh(), fresh())
    await continueCase(page)
    await page.getByRole('button', { name: /先收状纸/ }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kaizha:auto')).state.phase === 'response')
    const before = await readState(page)
    await blockStorage(page, { removes: ['kaizha:auto', 'kaizha:manual'] })
    await page.locator('.game-tools button').filter({ hasText: '设置' }).click()
    await page.getByRole('button', { name: '重置游戏', exact: true }).click()
    await page.getByRole('button', { name: '确认重置', exact: true }).click()
    assert.equal(await page.locator('.game-page').isVisible(), true)
    assert.equal(await page.locator('.archive-settings-panel').isVisible(), true)
    assert.equal(await page.locator('.archive-reset-confirmation').isVisible(), true)
    assert.match(await page.locator('.game-toast').innerText(), /拒绝清除/)
    assert.equal(await page.locator('.home-page').count(), 0)
    assert.deepEqual(await readState(page), before)
    await page.getByRole('button', { name: '关闭案卷' }).click()
    await page.getByRole('button', { name: /^继续/ }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kaizha:auto')).state.nodeId === 'c1_marriage')
    assert.equal((await readState(page)).history.length, before.history.length)
  })

  await run('ending archive refusal keeps the ending and a persistent warning, including after refresh', async page => {
    await seed(page, { ...fresh(), courtIndex: 3, nodeId: 'c4_final' })
    await blockStorage(page, { writes: ['kaizha:endings'] })
    await continueCase(page)
    await page.getByRole('button', { name: /遵从懿旨，移交宗正府/ }).click()
    await page.getByRole('button', { name: '确认宣判', exact: true }).click()
    assert.equal(await page.locator('.ending-page').isVisible(), true)
    assert.equal(await page.locator('.ending-content h1').innerText(), '权门蔽日')
    assert.match(await page.locator('.ending-content [role="alert"]').innerText(), /未写入档案/)
    assert.match(await page.locator('.game-toast').innerText(), /结局档案写入失败/)
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:endings')), null)
    assert.equal((await readState(page)).ending, 'power')
    await page.reload()
    await continueCase(page)
    assert.equal(await page.locator('.ending-content h1').innerText(), '权门蔽日')
    assert.match(await page.locator('.ending-content [role="alert"]').innerText(), /尚未写入结局档案/)
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:endings')), null)
  })

  await run('ending remains visible with an automatic save warning even when its archive write succeeds', async page => {
    await seed(page, { ...fresh(), courtIndex: 3, nodeId: 'c4_final' })
    await blockStorage(page, { writes: ['kaizha:auto'] })
    await continueCase(page)
    await page.waitForFunction(() => document.querySelector('.game-footer [data-save-state]')?.dataset.saveState === 'error')
    await page.getByRole('button', { name: /遵从懿旨，移交宗正府/ }).click()
    await page.getByRole('button', { name: '确认宣判', exact: true }).click()
    assert.equal(await page.locator('.ending-content h1').innerText(), '权门蔽日')
    await page.waitForFunction(() => document.querySelector('.ending-content')?.textContent.includes('自动存档失败，刷新可能丢失进度'))
    const archive = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:endings')))
    assert.equal(archive.endings[0].endingId, 'power')
    assert.equal((await readState(page)).ending, null)
  })

  for (const settings of [
    { fontSize: { toString: null }, textSpeed: [], music: 'true', autoPlay: {} },
    null,
    ['large', true],
  ]) {
    await run(`malformed settings normalize safely: ${JSON.stringify(settings)}`, async page => {
      await seed(page, fresh())
      await page.evaluate(value => localStorage.setItem('kaizha:settings', JSON.stringify(value)), settings)
      await page.reload()
      assert.equal(await page.evaluate(() => document.documentElement.dataset.fontSize), 'medium')
      await continueCase(page)
      assert.equal(await page.locator('.game-page').isVisible(), true)
      const normalized = await page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:settings')))
      assert.deepEqual(normalized, { music: false, sound: true, textSpeed: 'normal', autoPlay: false, skipRead: true, fontSize: 'medium' })
    })
  }

  await run('invalid automatic state explicitly identifies manual fallback', async page => {
    const manual = { ...fresh(), nodeId: 'c1_marriage', evidence: ['complaint'] }
    await seed(page, { ...fresh(), courtIndex: 99 }, manual)
    await continueCase(page)
    assert.match(await page.locator('.game-toast').innerText(), /自动存档不可用，已恢复手动卷宗/)
    assert.deepEqual(await readState(page), manual)
  })

  await run('invalid date input is rejected without crashing and restores the healthy manual case', async page => {
    const manual = { ...fresh(), nodeId: 'c1_marriage', evidence: ['complaint'] }
    await seed(page, { ...fresh(), startedAt: { toString: null } }, manual)
    await continueCase(page)
    assert.match(await page.locator('.game-toast').innerText(), /已恢复手动卷宗/)
    assert.deepEqual(await readState(page), manual)
  })
} finally {
  await writeFile(`${outDir}/storage-feedback.json`, JSON.stringify({ results }, null, 2))
  await runtime.close()
}

if (results.some(result => !result.pass)) throw new Error('Storage feedback regression scenarios failed; see storage-feedback.json')

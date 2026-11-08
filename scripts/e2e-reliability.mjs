import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { courts } from '../src/data/story.js'
import { startReviewBrowser, root } from './review-browser.mjs'

const outDir = `${root}/test-artifacts/review`
await mkdir(outDir, { recursive: true })
const runtime = await startReviewBrowser(4211)
const results = []
const fresh = () => ({ courtIndex: 0, nodeId: 'c1_plaint', phase: 'story', evidence: [], flags: [],
  insight: 0, pressure: 0, history: [], readNodeIds: [], undoStack: [], nextNode: null,
  lastResponse: '', ending: null, finalChoice: null, startedAt: new Date().toISOString() })
const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
// Corruption and rollback fixtures use fresh, disposable contexts, never a demo profile.
async function seed(page, automatic, manual) {
  await page.evaluate(({ automatic, manual }) => {
    if (automatic) localStorage.setItem('kaizha:auto', JSON.stringify({ version: 1, state: automatic }))
    if (manual) localStorage.setItem('kaizha:manual', JSON.stringify({ version: 1, state: manual }))
  }, { automatic, manual })
  await page.reload()
}
async function run(name, action) {
  const context = await runtime.browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  try {
    await page.goto(runtime.baseUrl)
    await action(page)
    assert.deepEqual(errors, [])
    results.push({ name, pass: true, consoleErrors: errors })
    console.log(`PASS reliability: ${name}`)
  } catch (error) {
    results.push({ name, pass: false, error: String(error), consoleErrors: errors })
    throw error
  } finally { await context.close() }
}
async function continueCase(page) {
  await page.getByRole('button', { name: /继续案件/ }).click()
}
try {
  for (const patch of [{ courtIndex: 99 }, { evidence: null }, { nodeId: 'absent' }, { undoStack: [null] }]) {
    await run(`corrupt slot rejected: ${JSON.stringify(patch)}`, async page => {
      await seed(page, { ...fresh(), ...patch })
      await continueCase(page)
      assert.equal(await page.locator('.home-page').isVisible(), true)
      assert.match(await page.locator('.game-toast').innerText(), /存档|状态/)
    })
  }
  await run('corrupt auto slot restores healthy manual slot', async page => {
    const manual = { ...fresh(), nodeId: 'c1_marriage', evidence: ['complaint'] }
    await seed(page, { ...fresh(), courtIndex: 99 }, manual)
    await continueCase(page)
    assert.deepEqual(await readState(page), manual)
    assert.equal(await page.locator('.game-page').isVisible(), true)
  })
  await run('new case cancel preserves slots; confirm persists before intro and removes stale manual', async page => {
    const old = { ...fresh(), courtIndex: 1, nodeId: 'c2_arrive' }
    await seed(page, old, old)
    await page.getByRole('button', { name: /开始审案/ }).click()
    await page.getByRole('button', { name: '继续当前案件', exact: true }).click()
    assert.deepEqual(await readState(page), old)
    await page.getByRole('button', { name: /开始审案/ }).click()
    await page.getByRole('button', { name: '确认另立新案', exact: true }).click()
    assert.equal((await readState(page)).courtIndex, 0)
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:manual')), null)
    assert.equal(await page.locator('.intro-video-layer').isVisible(), true)
    await page.reload()
    await continueCase(page)
    assert.equal(await page.locator('.chapter-opening').isVisible(), true)
  })
  await run('history buttons restore first and second choices to their own nodes', async page => {
    await seed(page, fresh())
    await continueCase(page)
    await page.getByRole('button', { name: /先收状纸/ }).click()
    await page.getByRole('button', { name: /^继续/ }).click()
    await page.getByRole('button', { name: /验看旧婚书/ }).click()
    await page.locator('.game-tools button').filter({ hasText: '记录' }).click()
    await page.locator('.archive-history-timeline li').nth(1).getByRole('button', { name: '回到此处' }).click()
    assert.equal((await readState(page)).nodeId, 'c1_marriage')
    assert.equal((await readState(page)).history.length, 1)
    await page.locator('.game-tools button').filter({ hasText: '记录' }).click()
    await page.locator('.archive-history-timeline li').first().getByRole('button', { name: '回到此处' }).click()
    assert.equal((await readState(page)).nodeId, 'c1_plaint')
    assert.deepEqual((await readState(page)).evidence, [])
  })
  await run('trimmed 30-entry undo stack uses historyLength rather than list offset', async page => {
    const snapshot = { ...fresh(), nodeId: 'c1_marriage', evidence: ['complaint'], historyLength: 5 }
    delete snapshot.history
    delete snapshot.undoStack
    const state = { ...fresh(), nodeId: 'c1_children', history: Array.from({ length: 35 }, (_, i) => ({ text: `fixture ${i}` })),
      undoStack: Array.from({ length: 30 }, (_, i) => ({ ...snapshot, historyLength: i + 5 })) }
    await seed(page, state)
    await continueCase(page)
    await page.locator('.game-tools button').filter({ hasText: '记录' }).click()
    assert.equal(await page.locator('.archive-history-timeline li').nth(0).getByRole('button', { name: '回到此处' }).count(), 0)
    await page.locator('.archive-history-timeline li').nth(5).getByRole('button', { name: '回到此处' }).click()
    assert.equal((await readState(page)).history.length, 5)
    assert.equal((await readState(page)).undoStack.length, 0)
  })
  await run('revealed text stays complete and autoplay pauses for menus then resumes', async page => {
    const state = { ...fresh(), nodeId: 'c1_arraign' }
    await seed(page, state)
    await continueCase(page)
    await page.waitForTimeout(180)
    await page.locator('.typewriter').click()
    const expected = courts[0].nodes.find(node => node.id === state.nodeId).text
    assert.equal(await page.locator('.typewriter').innerText(), expected)
    await page.waitForTimeout(150)
    assert.equal(await page.locator('.typewriter').innerText(), expected)
    await page.locator('.game-tools button').filter({ hasText: '设置' }).click()
    await page.getByLabel('自动播放').check()
    await page.waitForTimeout(2000)
    assert.equal((await readState(page)).nodeId, state.nodeId)
    await page.getByRole('button', { name: '关闭案卷' }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('kaizha:auto')).state.nodeId === 'c1_plaint')
  })
  await run('reset removes game slots but preserves ending archive and settings', async page => {
    await seed(page, fresh(), fresh())
    await page.evaluate(() => localStorage.setItem('kaizha:endings', JSON.stringify({ version: 1, endings: [{ endingId: 'pending', unlockedAt: new Date().toISOString() }] })))
    await continueCase(page)
    await page.locator('.game-tools button').filter({ hasText: '设置' }).click()
    await page.getByRole('button', { name: '重置游戏', exact: true }).click()
    await page.getByRole('button', { name: '确认重置', exact: true }).click()
    assert.equal(await page.locator('.home-page').isVisible(), true)
    const slots = await page.evaluate(() => ({ auto: localStorage.getItem('kaizha:auto'), manual: localStorage.getItem('kaizha:manual'),
      endings: JSON.parse(localStorage.getItem('kaizha:endings')), settings: localStorage.getItem('kaizha:settings') }))
    assert.equal(slots.auto, null)
    assert.equal(slots.manual, null)
    assert.equal(slots.endings.endings[0].endingId, 'pending')
    assert.ok(slots.settings)
    await page.getByRole('button', { name: /开始审案/ }).click()
    assert.equal(await page.locator('.intro-video-layer').isVisible(), true)
  })
} finally {
  await writeFile(`${outDir}/reliability-results.json`, JSON.stringify({ results }, null, 2))
  await runtime.close()
}

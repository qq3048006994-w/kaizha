import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { courts } from '../src/data/story.js'
import { evidence, evidenceById, evidenceLinks } from '../src/data/evidence.js'
import { evaluateEnding, REQUIRED_PROOF_FLAGS } from '../src/game/endings.js'
import { startReviewBrowser, root } from './review-browser.mjs'

// Disposable fixture contexts verify display and feedback. Natural playthroughs
// remain the responsibility of the existing e2e-endings-flow script.
const outDir = `${root}/test-artifacts/round2`
await mkdir(outDir, { recursive: true })
const runtime = await startReviewBrowser(4214)
const results = []
const viewports = [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]
const fixture = (patch = {}) => ({
  courtIndex: 0, nodeId: 'c1_arraign', phase: 'story', evidence: [], flags: [], insight: 0, pressure: 0,
  history: [], readNodeIds: [], undoStack: [], nextNode: null, lastResponse: '', ending: null,
  finalChoice: null, startedAt: '2026-11-08T00:00:00.000Z', ...patch,
})
const readState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const finite = document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
    await Promise.allSettled(finite.map((animation) => animation.finished))
  })
}

async function assertInViewport(locator, viewport) {
  assert.equal(await locator.isVisible(), true)
  const box = await locator.boundingBox()
  assert.ok(box && box.width > 0 && box.height > 0)
  assert.ok(box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
    `Outside ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`)
}

async function run(name, state, action, viewport = viewports[0], archiveRaw = null) {
  const context = await runtime.browser.newContext({ viewport })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  try {
    await page.goto(runtime.baseUrl)
    await page.evaluate(({ state, archiveRaw }) => {
      localStorage.setItem('kaizha:settings', JSON.stringify({ sound: false, music: false, textSpeed: 'fast', skipRead: true }))
      localStorage.setItem('kaizha:auto', JSON.stringify({ version: 1, state }))
      if (archiveRaw !== null) localStorage.setItem('kaizha:endings', archiveRaw)
    }, { state, archiveRaw })
    await page.reload()
    await page.getByRole('button', { name: /继续案件/ }).click()
    await settle(page)
    await action(page)
    assert.deepEqual(consoleErrors, [])
    results.push({ name, pass: true, viewport, consoleErrors })
    console.log(`PASS round2 experience: ${name}`)
  } catch (error) {
    results.push({ name, pass: false, viewport, error: String(error), consoleErrors })
    console.error(`FAIL round2 experience: ${name}: ${error}`)
  } finally {
    await context.close()
  }
}

try {
  for (const viewport of viewports) {
    for (const [courtIndex, court] of courts.entries()) {
      await run(`chapter ${courtIndex + 1} guidance and start visible at ${viewport.width}x${viewport.height}`,
        fixture({ courtIndex, nodeId: court.startNode, phase: 'opening' }), async (page) => {
          const guidance = page.locator('.court-guidance')
          assert.match(await guidance.innerText(), /本堂要点/)
          assert.ok((await guidance.locator('span').innerText()).length >= 20)
          await assertInViewport(guidance, viewport)
          const start = page.getByRole('button', { name: /升 堂/ })
          await assertInViewport(start, viewport)
          await start.click()
          await page.waitForFunction(() => JSON.parse(localStorage.getItem('kaizha:auto')).state.phase === 'story')
          assert.equal((await readState(page)).phase, 'story')
        }, viewport)
    }
  }

  await run('mobile court-end progress remains visible', fixture({ phase: 'courtEnd', nodeId: 'c1_order',
    evidence: ['complaint', 'marriage_contract', 'children_registry'] }), async (page) => {
    const summary = page.locator('.court-end-panel .court-review')
    assert.match(await summary.innerText(), /名分凭据 2\/2/)
    await assertInViewport(summary, viewports[2])
    await assertInViewport(page.getByRole('button', { name: /进入下一堂/ }), viewports[2])
  }, viewports[2])

  await run('evidence feedback follows submission, mismatch and duplicate preserve state',
    fixture({ courtIndex: 1, nodeId: 'c2_link', evidence: evidence.map((item) => item.id) }), async (page) => {
      await page.locator('.inline-link-button').click()
      const board = page.locator('.link-board')
      const feedback = board.locator('.link-workbench p')
      const select = async (id) => board.locator('.link-evidence-card').filter({ has: page.locator('strong', { hasText: evidenceById[id].name }) }).click()
      await select('marriage_contract')
      await select('children_registry')
      assert.equal(await feedback.getAttribute('class'), 'hint')
      const before = await readState(page)
      await board.getByRole('button', { name: '关联推演', exact: true }).click()
      await page.waitForFunction((flag) => JSON.parse(localStorage.getItem('kaizha:auto')).state.flags.includes(flag), evidenceLinks[0].flag)
      assert.equal(await feedback.getAttribute('class'), 'success')
      assert.match(await feedback.innerText(), /已印证/)
      assert.equal(await board.locator('.link-evidence-card[aria-pressed="true"]').count(), 0)
      await page.waitForTimeout(150)
      assert.equal(await feedback.getAttribute('class'), 'success')
      const linked = await readState(page)
      assert.equal(linked.history.length, before.history.length + 1)
      assert.equal(linked.insight, before.insight + 2)
      assert.equal(linked.flags.filter((flag) => flag === evidenceLinks[0].flag).length, 1)

      await select('marriage_contract')
      await select('children_registry')
      await board.getByRole('button', { name: '关联推演', exact: true }).click()
      assert.match(await feedback.innerText(), /已经记入卷宗/)
      const repeated = await readState(page)
      assert.equal(repeated.history.length, linked.history.length)
      assert.equal(repeated.insight, linked.insight)
      assert.deepEqual(repeated.flags, linked.flags)

      await select('children_registry')
      await select('han_qi_saber')
      await board.getByRole('button', { name: '关联推演', exact: true }).click()
      assert.equal(await feedback.getAttribute('class'), 'error')
      assert.match(await feedback.innerText(), /尚未成链/)
      const mismatch = await readState(page)
      assert.deepEqual(mismatch, repeated)
    })

  for (const outcome of ['success', 'countered']) {
    const node = courts[2].nodes.find((item) => item.id === 'c3_identity')
    const choice = node.choices.find((item) => item.outcome === outcome)
    await run(`third-court ${outcome} inquiry feedback matches choice`, fixture({ courtIndex: 2, nodeId: node.id,
      evidence: evidence.map((item) => item.id), readNodeIds: [`2:${node.id}:story`] }), async (page) => {
      await page.getByRole('button', { name: new RegExp(choice.label) }).click()
      await page.waitForFunction((outcome) => JSON.parse(localStorage.getItem('kaizha:auto')).state.history.at(-1)?.outcome === outcome, outcome)
      const feedback = page.locator('.inquiry-feedback')
      assert.equal(await feedback.getAttribute('class'), `inquiry-feedback ${outcome}`)
      assert.match(await feedback.innerText(), outcome === 'success' ? /质询已获印证/ : /质询未获印证/)
      const state = await readState(page)
      assert.equal(state.history.at(-1).outcome, outcome)
      for (const flag of choice.effects.flags) assert.equal(state.flags.includes(flag), true)
    })
  }

  const complete = fixture({ courtIndex: 3, nodeId: 'c4_final', evidence: evidence.map((item) => item.id),
    flags: [...REQUIRED_PROOF_FLAGS], readNodeIds: ['3:c4_final:story'] })
  const finalNode = courts[3].nodes.find((item) => item.id === 'c4_final')
  const verdictCases = [
    ...['law', 'defy', 'yield', 'defer'].map((finalChoice) => ({ name: `complete ${finalChoice}`, state: complete, finalChoice })),
    { name: 'missing evidence, link and inquiry', state: { ...complete,
      evidence: complete.evidence.filter((id) => id !== 'marriage_contract'),
      flags: complete.flags.filter((flag) => !['kinship_linked', 'identity_confirmed'].includes(flag)) }, finalChoice: 'law' },
  ]
  for (const { name, state, finalChoice } of verdictCases) {
    await run(`verdict explanation and review: ${name}`, state, async (page) => {
      const choice = finalNode.choices.find((item) => item.finalChoice === finalChoice)
      const expectedEnding = evaluateEnding({ ...state, finalChoice })
      const beforePreview = await readState(page)
      await page.getByRole('button', { name: new RegExp(choice.label) }).click()
      const explanation = page.locator('.verdict-review')
      assert.equal(await explanation.isVisible(), true)
      const previewExplanation = await explanation.locator('p').innerText()
      assert.deepEqual(await readState(page), beforePreview)
      if (name.startsWith('missing')) {
        assert.match(await explanation.innerText(), /悬案待雪/)
        assert.match(await explanation.innerText(), /尚缺关键证物：婚书/)
        assert.match(await explanation.innerText(), /尚未完成关联：婚配与亲子/)
        assert.match(await explanation.innerText(), /尚未印证：婚配与亲子质询/)
      }
      await page.getByRole('button', { name: '确认宣判', exact: true }).click()
      await page.waitForFunction((endingId) => JSON.parse(localStorage.getItem('kaizha:auto')).state.ending === endingId, expectedEnding)
      assert.equal((await readState(page)).ending, expectedEnding)
      assert.equal((await readState(page)).finalChoice, finalChoice)
      const beforeReview = await readState(page)
      const endingExplanation = await page.locator('.ending-explanation').innerText()
      assert.equal(endingExplanation, previewExplanation)
      const review = page.locator('details.case-review')
      await review.locator('summary').click()
      assert.equal(await review.getAttribute('open'), '')
      const details = await review.innerText()
      if (name.startsWith('missing')) {
        assert.match(details, /尚缺：婚书/)
        assert.match(details, /待推演：婚配与亲子/)
        assert.match(details, /未印证：婚配与亲子质询/)
      } else {
        assert.match(details, /七件核心证物齐备/)
        assert.match(details, /第三堂三项关键质询均已印证/)
      }
      assert.deepEqual(await readState(page), beforeReview)
    })
  }

  const legacy = fixture({ courtIndex: 3, nodeId: 'c4_final', phase: 'ended', ending: 'justice', finalChoice: 'law' })
  const legacyArchive = JSON.stringify({ version: 1, endings: [{ endingId: 'justice', unlockedAt: '2026-11-07T00:00:00.000Z' }] })
  await run('legacy ending retains its verdict and archive while explaining incomplete proof', legacy, async (page) => {
    assert.equal(await page.locator('.ending-content h1').innerText(), '正法昭彰')
    assert.match(await page.locator('.ending-explanation').innerText(), /不足以完整复核/)
    assert.deepEqual(await readState(page), legacy)
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:endings')), legacyArchive)
    await page.locator('details.case-review summary').click()
    assert.match(await page.locator('details.case-review').innerText(), /关键证物 0\/7/)
    assert.deepEqual(await readState(page), legacy)
    assert.equal(await page.evaluate(() => localStorage.getItem('kaizha:endings')), legacyArchive)
  }, viewports[0], legacyArchive)
} finally {
  await writeFile(`${outDir}/experience.json`, JSON.stringify({
    description: 'Disposable browser fixture tests; not natural playthrough evidence or judging scores.',
    results,
  }, null, 2))
  await runtime.close()
}
if (results.some((result) => !result.pass)) process.exitCode = 1

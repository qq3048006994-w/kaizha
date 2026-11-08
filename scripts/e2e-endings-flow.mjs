// Natural play only: never inject progress, flags, evidence, or a verdict.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { courts } from '../src/data/story.js'
import { evidenceById, evidenceLinks, CORE_EVIDENCE_IDS } from '../src/data/evidence.js'
import { endingCatalog, REQUIRED_PROOF_FLAGS } from '../src/game/endings.js'
import { startReviewBrowser, root } from './review-browser.mjs'

const outDir = `${root}/test-artifacts/review`
await mkdir(outDir, { recursive: true })
const runtime = await startReviewBrowser()
const results = []
const cases = [
  { id: 'law', final: 'law', ending: 'justice' },
  { id: 'defy', final: 'defy', ending: 'defiance' },
  { id: 'yield', final: 'yield', ending: 'power' },
  { id: 'defer', final: 'defer', ending: 'pending' },
  { id: 'missing-evidence', final: 'law', ending: 'pending', sparse: true },
  { id: 'missing-inquiry', final: 'law', ending: 'pending', wrongInquiry: true },
  { id: 'mobile-law', final: 'law', ending: 'justice', mobile: true },
]
const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('kaizha:auto')).state)
async function waitState(page, condition, description) {
  for (let i = 0; i < 100; i++) {
    const state = await readState(page)
    if (condition(state)) return state
    await page.waitForTimeout(25)
  }
  throw new Error(`State did not reach ${description}`)
}

try {
  for (const scenario of cases) {
    const context = await runtime.browser.newContext(scenario.mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
      : { viewport: { width: 1366, height: 768 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
    const trace = []
    try {
      await page.goto(runtime.baseUrl)
      await page.getByRole('button', { name: /开始审案/ }).click()
      await page.locator('.intro-skip').click()
      const visited = new Set()
      let restored = false
      let finalState
      for (let step = 0; step < 160; step++) {
        const state = await readState(page)
        visited.add(state.courtIndex)
        trace.push(`${state.courtIndex}:${state.nodeId}:${state.phase}`)
        if (state.phase === 'ended') { finalState = state; break }
        if (state.phase === 'opening') {
          await page.getByRole('button', { name: /升 堂/ }).click()
          await waitState(page, s => s.phase === 'story', 'story')
          continue
        }
        if (state.phase === 'courtEnd') {
          await page.getByRole('button', { name: /进入下一堂/ }).click()
          await waitState(page, s => s.courtIndex === state.courtIndex + 1, 'next court')
          continue
        }
        if (state.phase === 'response') {
          await page.getByRole('button', { name: /^(继续|本堂结案)/ }).click()
          await waitState(page, s => s.phase !== 'response', 'response completed')
          continue
        }
        if (!restored && state.courtIndex === 1 && state.nodeId === 'c2_arrive') {
          await page.getByRole('button', { name: '手动存档', exact: true }).click()
          await page.reload()
          await page.getByRole('button', { name: /继续案件/ }).click()
          assert.deepEqual(await readState(page), state, 'refresh must preserve the complete state')
          restored = true
        }
        const node = courts[state.courtIndex].nodes.find(n => n.id === state.nodeId)
        if (!node.choices) {
          await page.getByRole('button', { name: /^(继续|本堂结案)/ }).click()
          await waitState(page, s => s.nodeId !== state.nodeId || s.phase !== state.phase, 'next node')
          continue
        }
        let choice = node.choices[0]
        if (scenario.sparse && state.courtIndex < 2) choice = node.choices.at(-1)
        if (scenario.sparse && state.courtIndex === 2) choice = node.choices.find(c => !c.proof?.length)
        if (scenario.wrongInquiry && node.id === 'c3_identity') choice = node.choices[1]
        if (node.id === 'c2_link' && !scenario.sparse) {
          await page.locator('.inline-link-button').click()
          const board = page.locator('.link-board')
          for (const link of evidenceLinks) {
            for (const id of link.evidence) await board.getByRole('button', { name: new RegExp(evidenceById[id].name) }).click()
            await board.getByRole('button', { name: '关联推演', exact: true }).click()
            await waitState(page, s => s.flags.includes(link.flag), link.flag)
          }
          await page.getByRole('button', { name: '关闭证据关联' }).click()
        }
        if (node.id === 'c4_final') choice = node.choices.find(c => c.finalChoice === scenario.final)
        assert.ok(choice, `No playable choice on ${node.id}`)
        await page.locator('.choice-button').filter({ hasText: choice.label }).click()
        if (choice.finalChoice) await page.getByRole('button', { name: '确认宣判', exact: true }).click()
        await waitState(page, s => s.phase !== 'story', 'choice result')
      }
      assert.ok(finalState, 'Flow did not terminate within 160 steps')
      assert.equal(visited.size, 4)
      assert.equal(finalState.ending, scenario.ending)
      assert.equal(finalState.finalChoice, scenario.final)
      if (!scenario.sparse) assert.ok(CORE_EVIDENCE_IDS.every(id => finalState.evidence.includes(id)))
      if (!scenario.sparse && !scenario.wrongInquiry) assert.ok(REQUIRED_PROOF_FLAGS.every(flag => finalState.flags.includes(flag)))
      assert.equal(await page.locator('.ending-content h1').innerText(), endingCatalog[scenario.ending].title)
      assert.ok(await page.evaluate(id => JSON.parse(localStorage.getItem('kaizha:endings')).endings.some(entry => entry.endingId === id), scenario.ending))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      assert.deepEqual(errors, [])
      // Capture the finished design, rather than the first translucent animation frame.
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.ending-content')).opacity === '1')
      await page.screenshot({ path: `${outDir}/flow-${scenario.id}.png`, fullPage: true })
      results.push({ id: scenario.id, pass: true, ending: finalState.ending, courts: visited.size, restored, steps: trace.length, consoleErrors: errors, trace })
      console.log(`PASS natural flow: ${scenario.id} -> ${scenario.ending}`)
    } catch (error) {
      results.push({ id: scenario.id, pass: false, error: String(error), trace, consoleErrors: errors })
      throw error
    } finally { await context.close() }
  }
} finally {
  await writeFile(`${outDir}/endings-flow-results.json`, JSON.stringify({ results }, null, 2))
  await runtime.close()
}

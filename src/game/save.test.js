import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { autoSave, manualSave, loadGame, clearSave, recordEnding, readEndingArchive, STORAGE_KEYS } from './save.js'

const originalWindow = globalThis.window
let values
beforeEach(() => {
  values = new Map()
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } }
})
afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
})
const state = () => ({
  courtIndex: 0, nodeId: 'c1_plaint', phase: 'story', evidence: ['complaint'], flags: [],
  insight: 2, pressure: 0, history: [], readNodeIds: [], undoStack: [],
  finalChoice: null, ending: null, nextNode: null, lastResponse: '', startedAt: '2026-11-08T00:00:00.000Z',
})
const put = value => values.set(STORAGE_KEYS.auto, JSON.stringify({ version: 1, state: value }))

test('automatic and manual slots round trip independently without modifying state', () => {
  const original = state()
  assert.equal(autoSave(original).ok, true)
  assert.equal(manualSave({ ...original, insight: 4 }).ok, true)
  assert.deepEqual(loadGame('auto').state, original)
  assert.equal(loadGame('manual').state.insight, 4)
  assert.equal(original.insight, 2)
})

test('missing, invalid JSON, wrong version and invalid slots return useful errors', () => {
  assert.equal(loadGame('auto').reason, 'missing')
  values.set(STORAGE_KEYS.auto, '{')
  assert.equal(loadGame('auto').reason, 'corrupted')
  values.set(STORAGE_KEYS.auto, JSON.stringify({ version: 999, state: state() }))
  assert.equal(loadGame('auto').reason, 'version')
  assert.equal(loadGame('other').reason, 'invalid-slot')
})

test('unsafe position, collections, history and undo snapshots cannot reach the renderer', () => {
  for (const patch of [
    { courtIndex: 99 }, { courtIndex: -1 }, { courtIndex: 1.5 }, { nodeId: 'absent' },
    { phase: 'absent' }, { phase: 'response', nextNode: 'absent' },
    { evidence: null }, { evidence: ['unknown'] }, { flags: {} }, { readNodeIds: [null] },
    { history: [null] }, { history: [{ response: {} }] }, { insight: '12' },
    { pressure: null }, { lastResponse: {} }, { ending: 'absent' },
    { phase: 'ended', ending: null }, { undoStack: [null] },
    { undoStack: [{ ...state(), historyLength: 99 }] },
  ]) {
    put({ ...state(), ...patch })
    assert.equal(loadGame('auto').reason, 'corrupted', JSON.stringify(patch))
  }
  assert.ok(values.has(STORAGE_KEYS.auto), 'rejected data must remain available for diagnosis')
})

test('version 1 saves without the later optional undo stack remain readable', () => {
  const legacy = state()
  delete legacy.undoStack
  put(legacy)
  assert.equal(loadGame('auto').ok, true)
})

test('a corrupt auto slot leaves the manual fallback intact', () => {
  manualSave(state())
  put({ ...state(), courtIndex: 99 })
  assert.equal(loadGame('auto').ok, false)
  assert.deepEqual(loadGame('manual').state, state())
})

test('storage read/write/remove failures and unavailable storage never throw', () => {
  for (const [method, action, reason] of [
    ['getItem', () => loadGame('auto'), 'read-failed'],
    ['setItem', () => autoSave(state()), 'write-failed'],
    ['removeItem', () => clearSave('all'), 'clear-failed'],
  ]) {
    const old = window.localStorage[method]
    window.localStorage[method] = () => { throw new Error('storage denied') }
    assert.equal(action().reason, reason)
    window.localStorage[method] = old
  }
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied') } })
  assert.equal(loadGame('auto').reason, 'unavailable')
  assert.equal(autoSave(state()).reason, 'unavailable')
})

test('clearing game slots preserves settings and deduplicated ending records', () => {
  autoSave(state())
  manualSave(state())
  values.set('kaizha:settings', '{}')
  assert.equal(recordEnding('justice').ok, true)
  assert.equal(recordEnding('justice').endings.length, 1)
  assert.equal(clearSave('all').ok, true)
  assert.equal(loadGame('auto').reason, 'missing')
  assert.equal(loadGame('manual').reason, 'missing')
  assert.equal(readEndingArchive().endings.length, 1)
  assert.equal(values.get('kaizha:settings'), '{}')
})

test('damaged ending and date objects are rejected without primitive coercion', () => {
  for (const patch of [
    { ending: { toString: null } },
    { startedAt: { toString: null } },
    { startedAt: [] },
    { startedAt: true },
    { startedAt: 'not a date' },
    { startedAt: 1e20 },
    { undoStack: [{ ...state(), startedAt: { toString: null }, historyLength: 0 }] },
  ]) {
    put({ ...state(), ...patch })
    assert.equal(loadGame('auto').reason, 'corrupted', JSON.stringify(patch))
  }
})

test('version 1 optional dates remain compatible with missing dates and numeric timestamps', () => {
  for (const date of [undefined, null, '', '2026-11-08T00:00:00.000Z', 1794096000000]) {
    const legacy = { ...state(), startedAt: date }
    delete legacy.undoStack
    put(legacy)
    assert.equal(loadGame('auto').ok, true)
    values.set(STORAGE_KEYS.endings, JSON.stringify({ version: 1, endings: [{ endingId: 'justice', unlockedAt: date }] }))
    assert.equal(readEndingArchive().ok, true)
  }
})

test('archive reads deduplicate known endings without modifying the saved source', () => {
  const raw = JSON.stringify({ version: 1, endings: [
    { endingId: 'justice', unlockedAt: '2026-11-08T00:00:00.000Z' },
    { endingId: 'justice', unlockedAt: '2026-11-08T01:00:00.000Z' },
    { endingId: 'pending' },
  ] })
  values.set(STORAGE_KEYS.endings, raw)
  const archive = readEndingArchive()
  assert.equal(archive.ok, true)
  assert.deepEqual(archive.endings.map(entry => entry.endingId), ['justice', 'pending'])
  assert.equal(archive.endings[0].unlockedAt, '2026-11-08T00:00:00.000Z')
  assert.equal(values.get(STORAGE_KEYS.endings), raw)
})

test('damaged archives recover safe entries in memory and cannot be overwritten', () => {
  for (const badEntry of [null, [], 'justice', {}, { endingId: 'made-up' },
    { endingId: { toString: null } }, { endingId: 'justice', unlockedAt: { toString: null } },
    { endingId: 'justice', unlockedAt: 'invalid' }]) {
    const raw = JSON.stringify({ version: 1, endings: [badEntry, { endingId: 'pending' }, { endingId: 'pending' }] })
    values.set(STORAGE_KEYS.endings, raw)
    const archive = readEndingArchive()
    assert.equal(archive.ok, false, JSON.stringify(badEntry))
    assert.equal(archive.reason, 'corrupted')
    assert.deepEqual(archive.endings, [{ endingId: 'pending' }])
    assert.equal(recordEnding('justice').reason, 'corrupted')
    assert.equal(values.get(STORAGE_KEYS.endings), raw)
  }
})

test('recordEnding rejects IDs outside the four ending catalog entries', () => {
  recordEnding('justice')
  const raw = values.get(STORAGE_KEYS.endings)
  for (const id of ['made-up', 'constructor', '__proto__', '', null, { toString: null }]) {
    assert.equal(recordEnding(id).reason, 'invalid-ending')
    assert.equal(values.get(STORAGE_KEYS.endings), raw)
  }
})

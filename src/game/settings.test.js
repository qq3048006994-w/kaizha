import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultSettings, normalizeSettings } from './settings.js'

test('valid stored settings preserve every supported preference', () => {
  const saved = { music: true, sound: false, textSpeed: 'slow', autoPlay: true, skipRead: false, fontSize: 'large' }
  assert.deepEqual(normalizeSettings(saved), saved)
  for (const textSpeed of ['slow', 'normal', 'fast']) {
    for (const fontSize of ['small', 'medium', 'large']) {
      const settings = normalizeSettings({ textSpeed, fontSize })
      assert.equal(settings.textSpeed, textSpeed)
      assert.equal(settings.fontSize, fontSize)
    }
  }
})

test('invalid stored settings fall back without passing objects to the DOM', () => {
  const saved = JSON.parse('{"fontSize":{"toString":null},"textSpeed":[],"music":"true","sound":0,"autoPlay":{},"skipRead":null,"extra":"ignored"}')
  assert.deepEqual(normalizeSettings(saved), defaultSettings)
})

test('non-object stored JSON and missing fields use independent defaults', () => {
  for (const value of [undefined, null, true, false, 42, 'large', []]) {
    assert.deepEqual(normalizeSettings(value), defaultSettings)
  }
  const partial = { sound: false, fontSize: 'small', unexpected: true }
  const normalized = normalizeSettings(partial)
  assert.deepEqual(normalized, { ...defaultSettings, sound: false, fontSize: 'small' })
  normalized.music = true
  assert.equal(defaultSettings.music, false)
  assert.deepEqual(partial, { sound: false, fontSize: 'small', unexpected: true })
})

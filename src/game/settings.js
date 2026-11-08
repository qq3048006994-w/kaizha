export const defaultSettings = Object.freeze({
  music: false,
  sound: true,
  textSpeed: 'normal',
  autoPlay: false,
  skipRead: true,
  fontSize: 'medium',
})

const booleanSettings = ['music', 'sound', 'autoPlay', 'skipRead']
const settingChoices = {
  textSpeed: ['slow', 'normal', 'fast'],
  fontSize: ['small', 'medium', 'large'],
}

// Stored preferences are external input. Keep valid old values, while ensuring
// that rendering and DOM dataset writes only receive the supported primitives.
export function normalizeSettings(value) {
  const settings = { ...defaultSettings }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return settings

  for (const key of booleanSettings) {
    if (typeof value[key] === 'boolean') settings[key] = value[key]
  }
  for (const [key, choices] of Object.entries(settingChoices)) {
    if (choices.includes(value[key])) settings[key] = value[key]
  }
  return settings
}

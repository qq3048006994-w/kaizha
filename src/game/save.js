import { courts } from '../data/story.js';
import { evidenceById } from '../data/evidence.js';
import { endingCatalog } from './endings.js';

export const SAVE_VERSION = 1;

export const STORAGE_KEYS = Object.freeze({
  auto: 'kaizha:auto',
  manual: 'kaizha:manual',
  endings: 'kaizha:endings',
});

function storage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function failure(reason, message, extra = {}) {
  return { ok: false, reason, message, ...extra };
}

function unavailable(extra) {
  return failure('unavailable', '当前环境无法使用本地存档。', extra);
}

function validSlot(slot) {
  return slot === 'auto' || slot === 'manual';
}

function validPosition(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (!Number.isInteger(state.courtIndex)) return false;
  const court = courts[state.courtIndex];
  if (!court || !court.nodes.some((node) => node.id === state.nodeId)) return false;
  const phase = state.phase || 'story';
  if (!['opening', 'story', 'response', 'courtEnd', 'ended'].includes(phase)) return false;
  if (phase === 'response' && state.nextNode !== null && !court.nodes.some((node) => node.id === state.nextNode)) return false;
  if (state.ending != null && !Object.hasOwn(endingCatalog, state.ending)) return false;
  if (phase === 'ended' && !state.ending) return false;
  for (const key of ['evidence', 'flags', 'readNodeIds']) {
    if (state[key] !== undefined && (!Array.isArray(state[key]) || state[key].some((item) => typeof item !== 'string'))) return false;
  }
  if (state.evidence?.some((id) => !Object.hasOwn(evidenceById, id))) return false;
  for (const key of ['insight', 'pressure']) {
    if (state[key] !== undefined && !Number.isFinite(state[key])) return false;
  }
  if (state.lastResponse !== undefined && typeof state.lastResponse !== 'string') return false;
  return true;
}

function validState(state) {
  if (!validPosition(state)) return false;
  if (state.history !== undefined && (!Array.isArray(state.history) || state.history.some((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return true;
    return ['courtTitle', 'speaker', 'text', 'choice', 'response', 'outcome'].some((key) => entry[key] != null && typeof entry[key] !== 'string');
  }))) return false;
  if (state.undoStack !== undefined && (!Array.isArray(state.undoStack) || state.undoStack.some((snapshot) =>
    !validPosition(snapshot) || !Number.isInteger(snapshot.historyLength) || snapshot.historyLength < 0 ||
    snapshot.historyLength > (state.history?.length || 0) ||
    typeof snapshot.lastResponse !== 'string' || !Number.isFinite(snapshot.insight) || !Number.isFinite(snapshot.pressure) ||
    !['evidence', 'flags', 'readNodeIds'].every((key) => Array.isArray(snapshot[key]))
  ))) return false;
  return true;
}

function parseEnvelope(raw, slot) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return failure('corrupted', '存档内容已损坏，无法读取。可清除该档后重新保存。');
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return failure('corrupted', '存档格式不完整，无法读取。可清除该档后重新保存。');
  }
  if (envelope.version !== SAVE_VERSION) {
    return failure('version', `存档版本不兼容（当前版本 ${SAVE_VERSION}），请清除旧档。`);
  }
  if (slot && !validState(envelope.state)) {
    return failure('corrupted', '存档缺少有效游戏状态，无法读取。');
  }
  if (!slot && !Array.isArray(envelope.endings)) {
    return failure('corrupted', '结局档案格式已损坏，无法读取。', { endings: [] });
  }

  return { ok: true, envelope };
}

// slot 为 auto 或 manual。成功返回 { ok, savedAt }，失败不抛出异常。
export function saveGame(state, slot = 'manual') {
  const localStorage = storage();
  if (!localStorage) return unavailable();
  if (!validSlot(slot)) return failure('invalid-slot', '存档栏位须为 auto 或 manual。');
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return failure('invalid-state', '只能保存有效的游戏状态对象。');
  }

  const savedAt = new Date().toISOString();
  try {
    localStorage.setItem(
      STORAGE_KEYS[slot],
      JSON.stringify({ version: SAVE_VERSION, savedAt, state }),
    );
    return { ok: true, savedAt, key: STORAGE_KEYS[slot] };
  } catch {
    return failure('write-failed', '存档写入失败，可能因存储空间不足或浏览器限制。');
  }
}

// 成功返回 { ok, state, savedAt }；缺档、损坏和版本不符均返回可读原因。
export function loadGame(slot = 'manual') {
  const localStorage = storage();
  if (!localStorage) return unavailable();
  if (!validSlot(slot)) return failure('invalid-slot', '存档栏位须为 auto 或 manual。');

  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEYS[slot]);
  } catch {
    return failure('read-failed', '浏览器拒绝读取本地存档。');
  }
  if (raw === null) return failure('missing', '此栏位尚无存档。');

  const parsed = parseEnvelope(raw, slot);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    state: parsed.envelope.state,
    savedAt: parsed.envelope.savedAt,
  };
}

export function clearSave(slot = 'manual') {
  const localStorage = storage();
  if (!localStorage) return unavailable();
  const slots = slot === 'all' ? ['auto', 'manual'] : [slot];
  if (!slots.every(validSlot)) return failure('invalid-slot', '存档栏位须为 auto、manual 或 all。');

  try {
    slots.forEach((name) => localStorage.removeItem(STORAGE_KEYS[name]));
    return { ok: true };
  } catch {
    return failure('clear-failed', '浏览器拒绝清除本地存档。');
  }
}

// 结局档案始终按 endingId 去重，重复达成不会生成重复条目。
export function readEndingArchive() {
  const localStorage = storage();
  if (!localStorage) return unavailable({ endings: [] });

  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEYS.endings);
  } catch {
    return failure('read-failed', '浏览器拒绝读取结局档案。', { endings: [] });
  }
  if (raw === null) return { ok: true, endings: [] };

  const parsed = parseEnvelope(raw, null);
  if (!parsed.ok) return parsed;
  return { ok: true, endings: parsed.envelope.endings };
}

export function recordEnding(endingId) {
  const localStorage = storage();
  if (!localStorage) return unavailable();
  if (typeof endingId !== 'string' || !endingId) {
    return failure('invalid-ending', '结局 id 不能为空。');
  }

  const archive = readEndingArchive();
  if (!archive.ok) return archive;
  if (archive.endings.some((entry) => entry?.endingId === endingId)) {
    return { ok: true, endings: archive.endings };
  }

  const endings = [
    ...archive.endings,
    { endingId, unlockedAt: new Date().toISOString() },
  ];
  try {
    localStorage.setItem(
      STORAGE_KEYS.endings,
      JSON.stringify({ version: SAVE_VERSION, endings }),
    );
    return { ok: true, endings };
  } catch {
    return failure('write-failed', '结局档案写入失败。');
  }
}

export function clearEndingArchive() {
  const localStorage = storage();
  if (!localStorage) return unavailable();
  try {
    localStorage.removeItem(STORAGE_KEYS.endings);
    return { ok: true };
  } catch {
    return failure('clear-failed', '浏览器拒绝清除结局档案。');
  }
}

export const autoSave = (state) => saveGame(state, 'auto');
export const manualSave = (state) => saveGame(state, 'manual');

export default {
  saveGame,
  loadGame,
  clearSave,
  autoSave,
  manualSave,
  recordEnding,
  readEndingArchive,
  clearEndingArchive,
};

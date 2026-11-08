import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_EVIDENCE_IDS } from '../data/evidence.js';
import { canFormCompleteChain, endingCatalog, evaluateEnding, REQUIRED_PROOF_FLAGS } from './endings.js';

const completeEvidence = () => [...CORE_EVIDENCE_IDS];
const completeFlags = () => [...REQUIRED_PROOF_FLAGS];

test('完整证据且依法宣判，结局为 justice', () => {
  const state = {
    evidence: completeEvidence(),
    flags: completeFlags(),
    finalChoice: 'law',
  };
  assert.equal(evaluateEnding(state), 'justice');
});

test('完整证据且抗旨开铡，结局为 defiance', () => {
  const state = {
    evidence: completeEvidence().map((id) => ({ id })),
    flags: Object.fromEntries(completeFlags().map((flag) => [flag, true])),
    finalChoice: 'defy',
  };
  assert.equal(evaluateEnding(state), 'defiance');
});

test('选择服从懿旨，无论证据是否完整均为 power', () => {
  assert.equal(evaluateEnding({ evidence: completeEvidence(), finalChoice: 'yield' }), 'power');
  assert.equal(evaluateEnding({ evidence: [], finalChoice: 'yield' }), 'power');
});

test('选择暂缓，即使证据完整也为 pending', () => {
  assert.equal(
    evaluateEnding({ evidence: completeEvidence(), flags: [], finalChoice: 'defer' }),
    'pending',
  );
});

test('证据不足仍坚持 law 或 defy，均为 pending', () => {
  const evidence = completeEvidence().slice(0, -1);
  assert.equal(evaluateEnding({ evidence, finalChoice: 'law' }), 'pending');
  assert.equal(evaluateEnding({ evidence, finalChoice: 'defy' }), 'pending');
});

test('证物齐全但关联或第三堂印证未完成，仍为 pending', () => {
  assert.equal(evaluateEnding({ evidence: completeEvidence(), flags: completeFlags().slice(1), finalChoice: 'law' }), 'pending');
  assert.equal(evaluateEnding({ evidence: completeEvidence(), flags: completeFlags().slice(0, -1), finalChoice: 'defy' }), 'pending');
});

test('缺省或未知最终选择不会误入宣判结局', () => {
  assert.equal(evaluateEnding({ evidence: completeEvidence() }), 'pending');
  assert.equal(evaluateEnding({ evidence: completeEvidence(), finalChoice: 'unknown' }), 'pending');
  assert.equal(evaluateEnding(), 'pending');
});

test('完整链辅助函数忽略重复项，并识别任一关键证物遗漏', () => {
  assert.equal(canFormCompleteChain([...completeEvidence(), ...completeEvidence()]), true);
  assert.equal(canFormCompleteChain({ evidence: completeEvidence() }), true);

  for (const missing of CORE_EVIDENCE_IDS) {
    const evidence = completeEvidence().filter((id) => id !== missing);
    assert.equal(canFormCompleteChain(evidence), false, `遗漏 ${missing} 时不应成链`);
  }
});

test('结局档案键与四结局文案完整', () => {
  assert.deepEqual(Object.keys(endingCatalog).sort(), ['defiance', 'justice', 'pending', 'power']);
  for (const ending of Object.values(endingCatalog)) {
    assert.ok(ending.title && ending.seal && ending.body && ending.epilogue && ending.tone);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { CORE_EVIDENCE_IDS, evidenceLinks } from '../data/evidence.js';
import { evaluateEnding, REQUIRED_PROOF_FLAGS } from './endings.js';
import { getCaseReview } from './caseReview.js';

const complete = () => ({ evidence: [...CORE_EVIDENCE_IDS], flags: [...REQUIRED_PROOF_FLAGS] });

test('unselected review identifies specific missing items without inventing a verdict', () => {
  const review = getCaseReview();
  assert.equal(review.evidence.collected, 0);
  assert.equal(review.evidence.total, 7);
  assert.equal(review.evidence.missing[0].name, '婚书');
  assert.deepEqual(review.links.missing.map((link) => link.title), evidenceLinks.map((link) => link.title));
  assert.equal(review.inquiries.missing.length, 3);
  assert.ok(review.inquiries.missing.every((item) => item.label.includes('质询')));
  assert.equal(review.isComplete, false);
  assert.equal(review.decision.endingId, null);
  assert.match(review.decision.explanation, /尚未落笔/);
  assert.doesNotMatch(review.decision.explanation, /结果为|因此形成/);
});

test('complete review explains all four original verdicts', () => {
  for (const [choice, ending] of Object.entries({ law: 'justice', defy: 'defiance', yield: 'power', defer: 'pending' })) {
    const review = getCaseReview(complete(), { finalChoice: choice });
    assert.equal(review.isComplete, true);
    assert.equal(review.evidence.collected, 7);
    assert.equal(review.links.completed, 3);
    assert.equal(review.inquiries.confirmed, 3);
    assert.equal(review.decision.endingId, ending);
    assert.equal(review.evidence.missing.length + review.links.missing.length + review.inquiries.missing.length, 0);
    assert.ok(review.decision.explanation);
  }
});

test('missing evidence, links and inquiry flags explain the precise unresolved requirement', () => {
  const cases = [
    { state: { ...complete(), evidence: CORE_EVIDENCE_IDS.filter((id) => id !== 'han_qi_letter') }, text: '尚缺关键证物：韩琪遗书' },
    { state: { ...complete(), flags: REQUIRED_PROOF_FLAGS.filter((flag) => flag !== 'command_linked') }, text: '尚未完成关联：凶器与差遣' },
    { state: { ...complete(), flags: REQUIRED_PROOF_FLAGS.filter((flag) => flag !== 'identity_confirmed') }, text: '尚未印证：婚配与亲子质询' },
  ];
  for (const { state, text } of cases) for (const choice of ['law', 'defy']) {
    const review = getCaseReview(state, { finalChoice: choice });
    assert.equal(review.isComplete, false);
    assert.equal(review.decision.endingId, 'pending');
    assert.ok(review.decision.explanation.includes(text), review.decision.explanation);
  }
});

test('voluntary transfer or deferral is not described as evidence failure', () => {
  for (const choice of ['yield', 'defer']) {
    const empty = getCaseReview({}, { finalChoice: choice });
    const full = getCaseReview(complete(), { finalChoice: choice });
    assert.equal(empty.decision.endingId, full.decision.endingId);
    assert.doesNotMatch(empty.decision.explanation, /尚缺|尚未完成|尚未印证|案卷尚有缺环/);
    assert.match(empty.decision.explanation, /你选择/);
  }
});

test('object evidence and truthy flag maps match the existing evaluator and ignore duplicate evidence', () => {
  const state = {
    evidence: [...CORE_EVIDENCE_IDS, ...CORE_EVIDENCE_IDS, 'complaint', null].map((id) => id ? { id } : null),
    flags: { ...Object.fromEntries(REQUIRED_PROOF_FLAGS.map((flag) => [flag, true])), unrelated: false },
    finalChoice: 'law',
  };
  const review = getCaseReview(state);
  assert.equal(review.evidence.collected, 7);
  assert.equal(review.links.completed, 3);
  assert.equal(review.inquiries.confirmed, 3);
  assert.equal(review.isComplete, true);
  assert.equal(review.decision.endingId, evaluateEnding(state));
  state.flags.identity_confirmed = false;
  assert.equal(getCaseReview(state).isComplete, false);
  assert.equal(getCaseReview(state).inquiries.missing[0].flag, 'identity_confirmed');
});

test('previewing another final choice never mutates state or the catalog', () => {
  const state = { ...complete(), finalChoice: 'yield', history: [{ choice: 'existing' }] };
  const before = structuredClone(state);
  Object.freeze(state.evidence);
  Object.freeze(state.flags);
  Object.freeze(state);
  const preview = getCaseReview(state, { finalChoice: 'defy' });
  assert.equal(preview.decision.endingId, 'defiance');
  assert.deepEqual(state, before);
  preview.evidence.missing.push({ id: 'not-real', name: 'fixture' });
  assert.equal(getCaseReview(state).evidence.missing.length, 0);
  assert.deepEqual(CORE_EVIDENCE_IDS, before.evidence);
});

test('every missing required proof retains the original verdict outcome', () => {
  const states = [complete(), {}, null,
    ...CORE_EVIDENCE_IDS.map((missing) => ({ ...complete(), evidence: CORE_EVIDENCE_IDS.filter((id) => id !== missing) })),
    ...REQUIRED_PROOF_FLAGS.map((missing) => ({ ...complete(), flags: REQUIRED_PROOF_FLAGS.filter((flag) => flag !== missing) })),
  ];
  for (const state of states) for (const finalChoice of ['law', 'defy', 'yield', 'defer', 'unknown']) {
    const review = getCaseReview(state, { finalChoice });
    assert.equal(review.decision.endingId, evaluateEnding({ ...state, finalChoice }));
    assert.equal(review.isComplete, evaluateEnding({ ...state, finalChoice: 'law' }) === 'justice');
  }
});

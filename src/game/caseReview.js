import { CORE_EVIDENCE_IDS, evidenceById, evidenceLinks } from '../data/evidence.js';
import { evaluateEnding, REQUIRED_PROOF_FLAGS } from './endings.js';

// Display labels only: requirements and verdict rules stay in their original modules.
const INQUIRY_LABELS = Object.freeze({
  identity_confirmed: '婚配与亲子质询',
  command_confirmed: '凶器与差遣质询',
  hanqi_truth_confirmed: '韩琪收刀缘由质询',
});

function ownedEvidence(state) {
  const list = Array.isArray(state?.evidence) ? state.evidence : [];
  return new Set(list.map((item) => typeof item === 'string' ? item : item?.id));
}

function ownedFlags(state) {
  const flags = state?.flags;
  return new Set(Array.isArray(flags) ? flags : Object.keys(flags || {}).filter((flag) => flags[flag]));
}

function explainDecision(choice, endingId, missing) {
  if (choice == null) return '尚未落笔。可先核对关键证物、证据关联与第三堂质询，再决定如何裁决。';
  if (choice === 'yield') return '你选择遵从懿旨，将案件移交宗正府；这一裁决形成「权门蔽日」，不因证据齐备而自动改为依法宣判。';
  if (choice === 'defer') return '你选择暂缓宣判、继续查证，因此形成「悬案待雪」；这与证据是否齐备是两件事。';
  if (endingId === 'justice') return '七件关键证物、三条证据关联和第三堂三项质询均已完备；你选择依律宣判，因此形成「正法昭彰」。';
  if (endingId === 'defiance') return '七件关键证物、三条证据关联和第三堂三项质询均已完备；你选择当面抗旨、开铡担责，因此形成「抗旨开铡」。';
  if (choice !== 'law' && choice !== 'defy') return '未识别这项裁决，请回到终审核对选择；当前案卷不能据此作出有效宣判。';
  const gaps = [
    missing.evidence.length ? `尚缺关键证物：${missing.evidence.map((item) => item.name).join('、')}` : '',
    missing.links.length ? `尚未完成关联：${missing.links.map((item) => item.title).join('、')}` : '',
    missing.inquiries.length ? `尚未印证：${missing.inquiries.map((item) => item.label).join('、')}` : '',
  ].filter(Boolean);
  return `你选择${choice === 'law' ? '依律宣判' : '当面抗旨'}，但案卷尚有缺环，结果为「悬案待雪」。${gaps.join('；')}。`;
}

/** Read-only evidence review shared by verdict confirmation and ending display.
 * `finalChoice` previews a choice without changing the game or persisting state.
 * `isComplete` and every selected verdict come from the existing ending evaluator.
 */
export function getCaseReview(state = {}, { finalChoice = state?.finalChoice } = {}) {
  const evidence = ownedEvidence(state);
  const flags = ownedFlags(state);
  const linkFlags = new Set(evidenceLinks.map((link) => link.flag));
  const inquiryFlags = REQUIRED_PROOF_FLAGS.filter((flag) => !linkFlags.has(flag));
  const missing = {
    evidence: CORE_EVIDENCE_IDS.filter((id) => !evidence.has(id)).map((id) => ({ id, name: evidenceById[id]?.name || id })),
    links: evidenceLinks.filter((link) => !flags.has(link.flag)).map((link) => ({ id: link.id, title: link.title })),
    inquiries: inquiryFlags.filter((flag) => !flags.has(flag)).map((flag) => ({ flag, label: INQUIRY_LABELS[flag] || flag })),
  };
  const choice = finalChoice == null || finalChoice === '' ? null : finalChoice;
  const endingId = choice == null ? null : evaluateEnding({ ...state, finalChoice: choice });
  return {
    evidence: { collected: CORE_EVIDENCE_IDS.length - missing.evidence.length, total: CORE_EVIDENCE_IDS.length, missing: missing.evidence },
    links: { completed: evidenceLinks.length - missing.links.length, total: evidenceLinks.length, missing: missing.links },
    inquiries: { confirmed: inquiryFlags.length - missing.inquiries.length, total: inquiryFlags.length, missing: missing.inquiries },
    isComplete: evaluateEnding({ ...state, finalChoice: 'law' }) === 'justice',
    decision: { choice, endingId, explanation: explainDecision(choice, endingId, missing) },
  };
}

export default getCaseReview;

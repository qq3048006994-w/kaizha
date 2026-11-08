import { CORE_EVIDENCE_IDS } from '../data/evidence.js';

export const endingCatalog = {
  justice: {
    id: 'justice',
    title: '正法昭彰',
    seal: '明镜高悬',
    body: '婚书、官册、刀鞘与验状依次入判。包拯依律落笔，陈世美再也不能以驸马二字遮住旧案。铡声落下，堂上无人称快，只有书吏把每一页证词收齐。',
    epilogue: '秦香莲带孩子离开开封。她没有回头，城门外的路终于不必再通往一个不肯相认的人。',
    tone: 'vermilion',
    color: '#a83232',
  },
  defiance: {
    id: 'defiance',
    title: '抗旨开铡',
    seal: '虽死不避',
    body: '懿旨供在堂上，令签握在手中。包拯自认抗旨之责，却不肯把已明的罪交给权势掩埋。他亲手启铡，也亲手写好自己的罪状。',
    epilogue: '日后或贬或罪，已非这一堂所能预知。开封百姓只记得：那一天，皇命到了，法也没有退。',
    tone: 'crimson',
    color: '#7f1d1d',
  },
  power: {
    id: 'power',
    title: '权门蔽日',
    seal: '法理难伸',
    body: '卷宗随木匣移交宗正府，驸马府的车驾先出了开封府。事实曾经摆在堂上，却被一句“皇家体面”压成了不可声张的旧事。',
    epilogue: '秦香莲仍留着状纸副本。日子可以往前走，那页纸上的名字也不会因无人宣判而消失。',
    tone: 'ink',
    color: '#374151',
  },
  pending: {
    id: 'pending',
    title: '悬案待雪',
    seal: '案未终卷',
    body: '证据未合，或宣判未落，包拯收起了令签。堂审可以暂止，卷宗不能销去；尚缺的每一环，都可能成为权势脱罪的缝隙。',
    epilogue: '展昭继续守证，公孙策继续核卷。秦香莲等一个答案，开封府等下一次升堂。',
    tone: 'ash',
    color: '#64748b',
  },
};

function evidenceIdsFrom(input) {
  const list = Array.isArray(input) ? input : input?.evidence;
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => (typeof item === 'string' ? item : item?.id))
    .filter((id) => typeof id === 'string');
}

// 同时接受 canFormCompleteChain(state) 与 canFormCompleteChain(evidenceArray)。
export function canFormCompleteChain(stateOrEvidence = []) {
  const owned = new Set(evidenceIdsFrom(stateOrEvidence));
  return CORE_EVIDENCE_IDS.every((id) => owned.has(id));
}

export const REQUIRED_PROOF_FLAGS = Object.freeze([
  'kinship_linked',
  'command_linked',
  'loyalty_linked',
  'identity_confirmed',
  'command_confirmed',
  'hanqi_truth_confirmed',
]);

function hasVerifiedInquiry(state) {
  const flags = state?.flags;
  const owned = new Set(Array.isArray(flags) ? flags : Object.keys(flags || {}).filter((key) => flags[key]));
  return REQUIRED_PROOF_FLAGS.every((flag) => owned.has(flag));
}

// 返回 endingCatalog 的键，便于 UI 再取标题、印章与正文。
export function evaluateEnding(state = {}) {
  const finalChoice = state?.finalChoice;

  if (finalChoice === 'yield') return 'power';
  if (finalChoice === 'defer') return 'pending';
  if (!canFormCompleteChain(state) || !hasVerifiedInquiry(state)) return 'pending';
  if (finalChoice === 'law') return 'justice';
  if (finalChoice === 'defy') return 'defiance';

  // 未选择及未知值均不擅作宣判。
  return 'pending';
}

export default evaluateEnding;

// 证物静态档案。调查状态指档案初始状态，玩家实得证物由游戏 state.evidence 管理。
export const evidence = [
  {
    id: 'complaint',
    name: '状纸',
    source: '第一堂·秦香莲当庭递交',
    description: '写明家乡婚配、一双儿女及三官堂变故。字句平直，无一句添油加醋。',
    investigationStatus: 'filed',
    key: false,
    criticalMarker: '原告所诉的时间、地名与后续证物可以互校。',
    keywords: ['控告', '寻夫', '三官堂'],
  },
  {
    id: 'marriage_contract',
    name: '婚书',
    source: '秦香莲随身旧匣；第二堂可请乡邻与书吏复核',
    description: '纸质陈旧，载陈世美与秦香莲成婚之年、双方籍贯及媒证姓名。',
    investigationStatus: 'sealed',
    key: true,
    criticalMarker: '陈世美尚未赴考时已经成婚，签名与驸马府文书笔迹相合。',
    keywords: ['原配', '成婚年月', '媒证'],
  },
  {
    id: 'children_registry',
    name: '儿女户籍',
    source: '均州原籍户籍誊本；第二堂可调取核对',
    description: '官册誊本记明两名子女的生年、父母姓名，并有原籍书吏画押。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '父母栏与婚书相合，儿女生日均在陈世美离家之前之后可核验的时段内。',
    keywords: ['亲子', '原籍', '官册'],
  },
  {
    id: 'han_qi_saber',
    name: '韩琪钢刀',
    source: '三官堂现场，展昭封存',
    description: '刀身留有干涸血迹，护手内侧錾着驸马府器物编号，非市井常见式样。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '器物编号与驸马府刀鞘相续，血迹位置和验状所载相符。',
    keywords: ['兵刃', '府中编号', '血迹'],
  },
  {
    id: 'sanguantang_report',
    name: '三官堂血迹验状',
    source: '三官堂勘验；仵作、地保分别画押',
    description: '记录门闩、血迹、母子停留处与韩琪自刎方位，未把推测写成事实。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '血迹显示韩琪曾在母子面前收刀退开，最终刀口只在其自身。',
    keywords: ['勘验', '收刀', '自刎'],
  },
  {
    id: 'palace_scabbard',
    name: '驸马府刀鞘',
    source: '驸马府兵器架暗格；第二堂依法查取',
    description: '空鞘所系绦带已断，鞘口磨损与韩琪钢刀吻合，内侧留同一器物编号。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '刀与鞘原属一套，证明凶器出自驸马府，而非韩琪临时拾得。',
    keywords: ['空鞘', '配套', '器物编号'],
  },
  {
    id: 'palace_token',
    name: '驸马府腰牌',
    source: '韩琪衣襟夹层；第二堂与府中出入簿互验',
    description: '背面刻韩琪姓名，边缘新添一道系绳磨痕；出入簿记其奉命夜出。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '腰牌、夜出时刻与三官堂更次相接，补明韩琪奉府中差遣而行。',
    keywords: ['差遣', '夜出', '更次'],
  },
  {
    id: 'han_qi_letter',
    name: '韩琪遗书',
    source: '三官堂神像底座；第二堂由地保见证取存',
    description: '寥寥数语，记“奉命”与“不忍”两难，并求勿罪其家人。无煽情之辞。',
    investigationStatus: 'pending',
    key: true,
    criticalMarker: '“奉命”指向差遣来源，“不忍”与验状中的收刀痕迹相互印证。',
    keywords: ['奉命', '不忍', '忠义两难'],
  },
];

export const evidenceById = Object.fromEntries(
  evidence.map((item) => [item.id, item]),
);

// 第二堂关联界面使用：evidence 为组成关联的证物 id，feedback 为关联成功反馈。
export const evidenceLinks = [
  {
    id: 'kinship',
    title: '婚配与亲子',
    evidence: ['marriage_contract', 'children_registry'],
    feedback: '婚书证成婚在先，户籍证儿女所出。所谓“素不相识”，已不能成立。',
    flag: 'kinship_linked',
  },
  {
    id: 'command',
    title: '凶器与差遣',
    evidence: ['han_qi_saber', 'palace_scabbard', 'palace_token'],
    feedback: '刀鞘同号，腰牌对应夜出簿。钢刀出自驸马府，韩琪亦是奉府命夜行。',
    flag: 'command_linked',
  },
  {
    id: 'loyalty',
    title: '忠义两难',
    evidence: ['sanguantang_report', 'han_qi_letter'],
    feedback: '遗书所谓“奉命、不忍”，恰与收刀退开的血痕相合。韩琪不是行凶得逞的杀手。',
    flag: 'loyalty_linked',
  },
];

// 判定“完整证据链”所需的七件关键证物；状纸是程序文书，不代替事实证明。
export const CORE_EVIDENCE_IDS = Object.freeze([
  'marriage_contract',
  'children_registry',
  'han_qi_saber',
  'palace_scabbard',
  'palace_token',
  'sanguantang_report',
  'han_qi_letter',
]);

export function getEvidence(id) {
  return evidenceById[id] ?? null;
}

export default evidence;

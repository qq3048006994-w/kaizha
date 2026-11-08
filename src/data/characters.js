// 人物称谓与立场仅供界面展示；剧情依据民间故事作游戏化改编。
//
// 审案舞台「谁说话谁出现」约定：
//   stageBust（可选）  本人近景半身立绘；未配置时由 assets.js 的 stageBusts
//   按 id 取 public/assets/characters/stage/ 下的同名文件。
//   defaultSide  仅决定名牌贴左还是贴右，不再决定画面站位（立绘恒居中）。
//   portraitLeft / portraitRight  本人侧身透明立绘，作为近景图的回落链。
//   无立绘角色（旁白、太后、公孙策、展昭）说话时不登场；后续只要给这些角色
//   补上 stageBust 或任一 portrait 路径即自动接入，无需改组件逻辑。
const SIDE = '/assets/characters/side/';

export const characters = {
  narrator: {
    id: 'narrator',
    name: '旁白',
    role: '公堂叙事',
    defaultSide: null,
    description: '只写堂上所见，不替任何人断罪。',
  },
  bao: {
    id: 'bao',
    name: '包拯',
    role: '开封府尹',
    // 玩家即包拯，默认不常驻大立绘；关键时刻可由 node.cast 显式切入
    defaultSide: null,
    portraitLeft: `${SIDE}bao-left.png`,
    portraitRight: `${SIDE}bao-right.png`,
    description: '持法审慎，越是权势相逼，越要证据分明。',
  },
  qin: {
    id: 'qin',
    name: '秦香莲',
    role: '原告',
    defaultSide: 'left',
    portraitLeft: `${SIDE}qin-left.png`,
    portraitRight: `${SIDE}qin-right.png`,
    description: '陈世美发妻，携儿女进京寻夫；言语克制，所求在事实得明。',
  },
  chen: {
    id: 'chen',
    name: '陈世美',
    role: '驸马、被告',
    defaultSide: 'right',
    portraitLeft: `${SIDE}chen-left.png`,
    portraitRight: `${SIDE}chen-right.png`,
    description: '起初矢口否认，随着证据闭合而逐渐失去镇定。',
  },
  han: {
    id: 'han',
    name: '韩琪',
    role: '已故差役',
    defaultSide: 'left',
    // 暂无左右专用立绘，回落 characterArt.han（同角色通用透明立绘）
    description: '受命行凶，终不忍加害母子，以死留证。',
  },
  princess: {
    id: 'princess',
    name: '公主',
    role: '陈世美现任妻子',
    defaultSide: 'right',
    portraitRight: `${SIDE}princess-right.png`,
    // 左侧专用图尚未提供，回落 characterArt.princess，不做镜像
    description: '维护驸马府与自身婚姻，以皇家体面逼迫开封府退让。',
  },
  dowager: {
    id: 'dowager',
    name: '太后',
    role: '皇室尊长',
    defaultSide: null,
    description: '以赦令与君臣名分施压，要包拯把国法让位于天家。',
  },
  gongsun: {
    id: 'gongsun',
    name: '公孙策',
    role: '开封府师爷',
    defaultSide: null,
    description: '核对文书、勘验物证，提醒包拯补全证据链。',
  },
  zhan: {
    id: 'zhan',
    name: '展昭',
    role: '开封府护卫',
    defaultSide: null,
    description: '查访三官堂与驸马府，保护证人、封存证物。',
  },
};

export default characters;

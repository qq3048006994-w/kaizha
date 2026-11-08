export const characterArt = {
  bao: '/assets/characters/baozheng.png',
  qin: '/assets/characters/qinxianglian.png',
  chen: '/assets/characters/chenshimei.png',
  han: '/assets/characters/hanqi.png',
  princess: '/assets/characters/princess.png',
}

// 人物档案右侧大全身照：白底版（取自用户首次提供的原始设定集，非抠图）
export const characterArtWhite = {
  bao: '/assets/characters/baozheng-white-full.jpg',
  qin: '/assets/characters/qinxianglian-white-full.jpg',
  chen: '/assets/characters/chenshimei-white-full.jpg',
  han: '/assets/characters/hanqi-white-full.jpg',
  princess: '/assets/characters/princess-white-full.jpg',
}

export const characterPortraits = {
  bao: '/assets/portraits/baozheng.png',
  qin: '/assets/portraits/qinxianglian.png',
  chen: '/assets/portraits/chenshimei.png',
  han: '/assets/portraits/hanqi.png',
  princess: '/assets/portraits/princess.png',
}

export const backgrounds = {
  court: '/assets/backgrounds/court-empty.jpg',
  gavel: '/assets/backgrounds/court-gavel.jpg',
  study: '/assets/backgrounds/baozheng-study.jpg',
}

// 审案舞台「谁说话谁出现」单人近景立绘：取自人物志白底半身照的抠图，
// 641x730 统一画布（头顶留白已裁），五人构图一致，切换角色时位置不跳动。
export const stageBusts = {
  bao: '/assets/characters/stage/bao-bust.png',
  qin: '/assets/characters/stage/qin-bust.png',
  chen: '/assets/characters/stage/chen-bust.png',
  han: '/assets/characters/stage/han-bust.png',
  princess: '/assets/characters/stage/princess-bust.png',
}

// 单人舞台取图链：优先本人近景半身立绘（character.stageBust 或 stageBusts），
// 再回落本人侧身立绘、本人通用透明立绘。全程只取「本人」的图，
// 不串角色、不水平镜像；给无立绘角色补上任一路径即自动登场，无需改组件。
export function stagePortraitSources(character, side) {
  if (!character?.id) return []
  const sources = []
  if (character.stageBust) sources.push(character.stageBust)
  if (stageBusts[character.id]) sources.push(stageBusts[character.id])
  const key = side === 'right' ? 'portraitRight' : 'portraitLeft'
  if (side && character[key]) sources.push(character[key])
  if (characterArt[character.id]) sources.push(characterArt[character.id])
  return sources.filter((src, index) => sources.indexOf(src) === index)
}

import { characters } from '../data/characters.js'
import { stagePortraitSources } from '../assets.js'
import CharacterPortrait from './CharacterPortrait.jsx'

/**
 * 「谁说话谁出现」——舞台永远只解析出当前 node.speaker 一位角色。
 *
 * - 只有当前说话者上场，任何时刻不会出现第二个人，也不会有非当前人物
 *   被淡化成「幽灵」；人物完全不透明，可实地遮挡后面的公堂背景。
 * - 近景半身立绘固定在画面中央附近，下缘藏进对话框之后，由对话框
 *   自然裁出半身（视觉小说构图）；随屏幕尺寸只做等比缩放，位置不变。
 * - 旁白、太后、公孙策、展昭等无立绘角色 → 舞台留空，公堂背景干净。
 * - court.cast / node.cast 是旧「双人常驻」配置，单人版不再读取，
 *   仅作历史数据保留；node.side 只决定名牌贴向哪一侧。
 * - 结果完全由 game（courtIndex / nodeId / phase）派生，不引入独立状态，
 *   刷新 / 续档后立绘与剧情节点严格一致，不会位置错乱或留下残影。
 */
export function resolveStage(court, node) {
  const id = node?.speaker
  const character = characters[id]
  if (!character) return { activeId: null, side: null }
  const side = node?.side || character.defaultSide || null
  const sources = stagePortraitSources(character, side)
  return { activeId: sources.length ? id : null, side }
}

export default function DialogueStage({ court, node }) {
  const { activeId, side } = resolveStage(court, node)
  const character = activeId ? characters[activeId] : null

  return (
    <div className="dialogue-stage" data-stage={activeId || '-'} aria-hidden="true">
      {character && (
        <div className="stage-focus" key={activeId}>
          <CharacterPortrait character={character} side={side} speaking />
        </div>
      )}
    </div>
  )
}

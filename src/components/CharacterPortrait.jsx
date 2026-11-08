import { useState } from 'react'
import { stagePortraitSources } from '../assets.js'

/**
 * 单人近景立绘。
 *
 * - 只取「本人」的图，加载失败逐级回落，绝不跨角色取图、绝不水平镜像。
 * - 完全不透明：不做 is-dim / 降饱和度 / 降亮度，人物可实地遮挡公堂背景。
 * - 由父级 .stage-focus 的 key 控制重挂载，切换角色时淡入且不残留旧图。
 */
export default function CharacterPortrait({ character, side, speaking }) {
  const sources = stagePortraitSources(character, side)
  const [sourceIndex, setSourceIndex] = useState(0)
  const src = sources[sourceIndex]

  if (!src) return null

  return (
    <figure
      className={`stage-portrait${speaking ? ' is-speaking' : ''}`}
      data-character={character.id}
      data-side={side || 'center'}
      data-src={src}
    >
      <img
        src={src}
        alt={`${character.name} · 近景立绘`}
        onError={() => setSourceIndex((index) => index + 1)}
        draggable="false"
      />
    </figure>
  )
}

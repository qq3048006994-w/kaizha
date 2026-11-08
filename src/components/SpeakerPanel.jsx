/**
 * 对话框发言人面板：姓名 + 身份标签，让玩家一眼知道正在与谁说话。
 *
 * 保留 .dialogue-nameplate 类名与既有的 letter-spacing / text-indent 居中补偿，
 * 兼容 check-nameplate 等既有验收脚本。side 决定名牌贴左还是贴右，
 * 与当前说话者的站位呼应（左站位 → 名牌在左，右站位 → 名牌在右）。
 */
export default function SpeakerPanel({ name, role, side }) {
  const resolved = side === 'right' ? 'right' : 'left'
  return (
    <div className={`dialogue-nameplate speaker-panel side-${resolved}`} data-side={resolved}>
      <span>{name}</span>
      <small>{role}</small>
    </div>
  )
}

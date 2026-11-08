import { useEffect, useState } from 'react'
import { courts } from '../data/story.js'
import { characters } from '../data/characters.js'
import { evidenceById, evidenceLinks } from '../data/evidence.js'
import Typewriter from '../components/Typewriter.jsx'
import DialogueStage from '../components/DialogueStage.jsx'
import SpeakerPanel from '../components/SpeakerPanel.jsx'

export default function GamePage({ game, onAdvance, onChoice, onOpen, onOpenLinks, onManualSave, onUndo, settings, playSound }) {
  const court = courts[game.courtIndex]
  const node = court.nodes.find((item) => item.id === game.nodeId) || court.nodes[0]
  const [completedTextKey, setCompletedTextKey] = useState('')
  const [confirmChoice, setConfirmChoice] = useState(null)
  const undoCount = Array.isArray(game.undoStack) ? game.undoStack.length : 0
  const isResponse = game.phase === 'response'
  const isOpening = game.phase === 'opening'
  const isCourtEnd = game.phase === 'courtEnd'
  const speaker = characters[node.speaker] || characters.narrator
  const displayText = isResponse ? game.lastResponse : node.text
  const panelSide = node.side || speaker.defaultSide || 'left'
  const isRead = settings.skipRead && game.readNodeIds.includes(`${game.courtIndex}:${node.id}:${isResponse ? 'response' : 'story'}`)
  const linkCount = evidenceLinks.filter((link) => game.flags.includes(link.flag)).length
  const textKey = `${game.courtIndex}-${node.id}-${game.phase}-${settings.textSpeed}`
  const textDone = completedTextKey === textKey

  useEffect(() => {
    if (!textDone || !settings.autoPlay || isOpening || isCourtEnd || confirmChoice) return
    if (!isResponse && node.choices?.length) return
    const timer = window.setTimeout(onAdvance, 1500)
    return () => window.clearTimeout(timer)
  }, [textDone, settings.autoPlay, isResponse, isOpening, isCourtEnd, confirmChoice, node.choices?.length, onAdvance])

  const proofMissing = (choice) => (choice.proof || []).filter((id) => !game.evidence.includes(id))
  const proofNames = (choice) => (choice.proof || []).map((id) => evidenceById[id]?.name).filter(Boolean).join(' + ')

  const choose = (choice) => {
    if (proofMissing(choice).length) return
    if (choice.id === 'c2_form_links' && linkCount < 3) {
      onOpenLinks()
      return
    }
    playSound(choice.outcome === 'success' ? 'success' : 'paper')
    if (choice.finalChoice) setConfirmChoice(choice)
    else onChoice(choice)
  }

  const advance = () => {
    playSound(isCourtEnd || node.next === null ? 'gavel' : 'paper')
    onAdvance()
  }

  if (isOpening) {
    return (
      <main className="chapter-opening" style={{ backgroundImage: `url(/assets/backgrounds/court-gavel.jpg)` }}>
        <div className="chapter-ink" />
        <div className="chapter-number">第{['一', '二', '三', '四'][game.courtIndex]}堂</div>
        <div className="chapter-title-wrap">
          <span>KAIFENG PREFECTURE · CASE 01</span>
          <h1>{court.title.split('·')[1].split('').map((ch, i) => <span key={i}>{ch}</span>)}</h1>
          <i />
          <h2>{court.subtitle}</h2>
          <p>{court.opening}</p>
          <button className="seal-cta" onClick={advance}><span>升 堂</span><small>击木开审</small></button>
        </div>
        <div className="chapter-vertical">不问贵贱 · 只问是非</div>
      </main>
    )
  }

  return (
    <main className={`game-page speaker-${node.speaker}`}>
      <header className="game-topbar">
        <button className="mini-brand" onClick={() => onOpen('settings')} aria-label="打开游戏菜单"><img src="/assets/logo/kaizha-calligraphy.png" alt="开铡" /></button>
        <div className="court-progress">
          {courts.map((item, index) => (
            <div className={`${index === game.courtIndex ? 'current' : ''} ${index < game.courtIndex ? 'done' : ''}`} key={item.id}>
              <span>{index < game.courtIndex ? '✓' : `0${index + 1}`}</span><p>{item.title.split('·')[1]}<small>{index === game.courtIndex ? court.subtitle : ['鸣冤初审', '验刀追凶', '对质辨伪', '御压终审'][index]}</small></p>
            </div>
          ))}
        </div>
        <div className="game-tools">
          <button onClick={() => onOpen('case')}><i>卷</i><span>卷宗</span></button>
          <button onClick={() => onOpen('evidence')}><i>证</i><span>证物</span><b>{game.evidence.length}</b></button>
          <button onClick={() => onOpen('characters')}><i>人</i><span>人物</span></button>
          <button onClick={() => onOpen('history')}><i>录</i><span>记录</span></button>
          <button onClick={() => onOpen('settings')}><i>设</i><span>设置</span></button>
        </div>
      </header>

      <section className="court-scene">
        <div className="scene-grain" />
        <div className="scene-location"><span>开封府</span><small>{court.title} · {court.subtitle}</small></div>
        <DialogueStage court={court} node={node} />
        {node.speaker === 'chen' && game.flags.includes('chen_lost_control') && <div className="tension-caption">其辞渐乱 · 其心已失</div>}
        <aside className="court-status">
          <span>证据链</span><strong>{linkCount}<small>/3</small></strong>
          <i style={{ '--fill': `${linkCount / 3 * 100}%` }} />
          <button onClick={onOpenLinks}>关联推演</button>
        </aside>
      </section>

      <section className="dialogue-area">
        <SpeakerPanel name={isResponse ? '堂审笔录' : speaker.name} role={isResponse ? court.title : speaker.role} side={panelSide} />
        <div className="dialogue-paper">
          <div className="dialogue-text" onClick={() => {}}>
            <Typewriter
              key={textKey}
              text={displayText}
              speed={settings.textSpeed}
              instant={isRead}
              onComplete={() => setCompletedTextKey(textKey)}
            />
          </div>

          {isCourtEnd ? (
            <div className="court-end-panel">
              <div><span>本堂已毕</span><strong>{court.title}</strong><p>已收证物 {game.evidence.length} 件 · 已形成证据链 {linkCount} 条</p></div>
              <button className="next-button" onClick={advance}>进入下一堂 <b>→</b></button>
            </div>
          ) : isResponse || !node.choices?.length ? (
            <div className="dialogue-next-row">
              <span>{settings.autoPlay ? '自动播放已开启' : '点击正文可立即显示全文'}</span>
              <button className="next-button" onClick={advance}>{node.next === null && !isResponse ? '本堂结案' : game.nextNode === null && isResponse ? '本堂结案' : '继续'} <b>→</b></button>
            </div>
          ) : (
            <div className="choice-list">
              {node.choices.map((choice, index) => {
                const missing = proofMissing(choice)
                return (
                  <button key={choice.id} className={`choice-button tone-${choice.tone} ${missing.length ? 'locked' : ''}`} onClick={() => choose(choice)} disabled={missing.length > 0}>
                    <span className="choice-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="choice-label">{choice.label}{choice.proof?.length > 0 && <small>{missing.length ? `尚缺：${missing.map((id) => evidenceById[id]?.name).join('、')}` : `出示：${proofNames(choice)}`}</small>}</span>
                    <b>›</b>
                  </button>
                )
              })}
            </div>
          )}
          {node.id === 'c2_link' && !isResponse && <button className="inline-link-button" onClick={onOpenLinks}>打开证据推演案 · 已完成 {linkCount}/3</button>}
        </div>
      </section>

      <footer className="game-footer">
        <span>庆历年间 · 开封府</span>
        <p><i /> 自动存档已启用</p>
        <button onClick={() => onUndo?.()} disabled={undoCount === 0} title="回到上一次抉择之前，重新选择">回到上一步</button>
        <button onClick={onManualSave}>手动存档</button>
      </footer>

      {confirmChoice && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="确认最终判决">
          <div className="confirm-dialog">
            <span className="eyebrow dark">终审 · 此判不可轻悔</span>
            <h2>确认落笔？</h2>
            <p>{confirmChoice.label}</p>
            <small>判决将依据当前 {game.evidence.length} 件证物、{linkCount} 条证据链与堂审结果生成。</small>
            <div><button onClick={() => setConfirmChoice(null)}>再思片刻</button><button className="danger" onClick={() => { playSound('gavel'); onChoice(confirmChoice); setConfirmChoice(null) }}>确认宣判</button></div>
          </div>
        </div>
      )}
    </main>
  )
}

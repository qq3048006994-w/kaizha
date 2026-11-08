import { endingCatalog } from '../game/endings.js'
import { CORE_EVIDENCE_IDS, evidenceLinks } from '../data/evidence.js'

export default function EndingPage({ game, onHome, onRestart, onArchive, onUndo }) {
  const ending = endingCatalog[game.ending] || endingCatalog.pending
  const coreCount = CORE_EVIDENCE_IDS.filter((id) => game.evidence.includes(id)).length
  const linkCount = evidenceLinks.filter((link) => game.flags.includes(link.flag)).length
  const undoCount = Array.isArray(game.undoStack) ? game.undoStack.length : 0
  return (
    <main className={`ending-page ending-${ending.id}`}>
      <div className="ending-shade" />
      <header className="ending-header"><span>陈世美案 · 终审卷</span><p>KAIFENG PREFECTURE ARCHIVE</p></header>
      <section className="ending-content">
        <div className="ending-seal"><span>{ending.seal}</span></div>
        <span className="ending-kicker">结局 {Object.keys(endingCatalog).indexOf(ending.id) + 1} / 4</span>
        <h1>{ending.title}</h1>
        <div className="ending-rule"><i />案 已 终 审<i /></div>
        <p className="ending-body">{ending.body}</p>
        <p className="ending-epilogue">{ending.epilogue}</p>
        <div className="ending-stats">
          <div><strong>{coreCount}<small>/7</small></strong><span>核心证物</span></div>
          <div><strong>{linkCount}<small>/3</small></strong><span>证据关联</span></div>
          <div><strong>{game.insight}</strong><span>明察</span></div>
          <div><strong>{game.pressure}</strong><span>皇权压力</span></div>
        </div>
        <div className="ending-actions">
          <button className="primary-cta compact" onClick={onRestart}><span>再审一次</span><small>探寻其他结局</small></button>
          <button className="secondary-cta" onClick={onArchive}>查看结局档案</button>
          {undoCount > 0 && (
            <button className="secondary-cta" onClick={() => onUndo?.(undoCount - 1)}>反悔 · 回到终审前</button>
          )}
          <button className="text-button" onClick={onHome}>返回开封府</button>
        </div>
      </section>
      <footer className="ending-footer">不问贵贱，只问是非。<span>《开铡》</span></footer>
    </main>
  )
}

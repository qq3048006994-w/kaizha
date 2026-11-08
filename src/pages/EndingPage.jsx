import { endingCatalog } from '../game/endings.js'
import { CORE_EVIDENCE_IDS, evidenceLinks } from '../data/evidence.js'
import { getCaseReview } from '../game/caseReview.js'

export default function EndingPage({ game, onHome, onRestart, onArchive, onUndo, archiveWarning = '', saveStatus = { ok: true, message: '' } }) {
  const ending = endingCatalog[game.ending] || endingCatalog.pending
  const coreCount = CORE_EVIDENCE_IDS.filter((id) => game.evidence.includes(id)).length
  const linkCount = evidenceLinks.filter((link) => game.flags.includes(link.flag)).length
  const undoCount = Array.isArray(game.undoStack) ? game.undoStack.length : 0
  const review = getCaseReview(game)
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
        <p className="ending-explanation">{review.decision.endingId === game.ending ? review.decision.explanation : '本档保留原有结局，但现存判决记录与证据不足以完整复核触发条件；可展开下方卷宗逐项查看。'}</p>
        {archiveWarning && <p className="archive-archive-warning" role="alert">{archiveWarning}</p>}
        {!saveStatus.ok && <p className="archive-archive-warning" role="alert">{saveStatus.message}</p>}
        <details className="case-review">
          <summary>判词依据 · 证据回顾</summary>
          <dl>
            <div><dt>关键证物 {review.evidence.collected}/7</dt><dd>{review.evidence.missing.length ? `尚缺：${review.evidence.missing.map((item) => item.name).join('、')}` : '七件核心证物齐备，可逐项互证。'}</dd></div>
            <div><dt>证据关联 {review.links.completed}/3</dt><dd>{review.links.missing.length ? `待推演：${review.links.missing.map((item) => item.title).join('、')}` : '婚配亲子、凶器差遣、忠义两难均已关联。'}</dd></div>
            <div><dt>关键质询 {review.inquiries.confirmed}/3</dt><dd>{review.inquiries.missing.length ? `未印证：${review.inquiries.missing.map((item) => item.label).join('、')}` : '第三堂三项关键质询均已印证。'}</dd></div>
          </dl>
        </details>
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

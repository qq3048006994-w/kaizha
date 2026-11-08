import { useMemo, useState } from 'react'
import { evidence, evidenceLinks } from '../data/evidence.js'
import EvidenceIcon from './EvidenceIcon.jsx'

export default function EvidenceLinkBoard({ game, onLink, onClose }) {
  const [selected, setSelected] = useState([])
  const [feedback, setFeedback] = useState('选中两件或三件证物，推演它们能共同证明的事实。')
  const [feedbackKind, setFeedbackKind] = useState('hint')
  const owned = evidence.filter((item) => game.evidence.includes(item.id))
  const completed = evidenceLinks.filter((link) => game.flags.includes(link.flag))

  const toggle = (id) => {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 3 ? [...current, id] : [...current.slice(1), id])
    setFeedback('证物已置入推演案。继续选择，或开始关联。')
    setFeedbackKind('hint')
  }

  const result = useMemo(() => {
    const key = [...selected].sort().join('|')
    return evidenceLinks.find((link) => [...link.evidence].sort().join('|') === key)
  }, [selected])

  const linkEvidence = () => {
    if (selected.length < 2) {
      setFeedbackKind('error')
      setFeedback('孤证难立。至少再选一件能够互证的证物。')
      return
    }
    if (!result) {
      setFeedbackKind('error')
      const closest = evidenceLinks.some((link) => selected.every((id) => link.evidence.includes(id)))
      setFeedback(closest
        ? '方向相合，但仍缺一环。想想还缺哪件证物，才能让事实无须靠猜测补足。'
        : '这些证物尚不能指向同一项事实。先分开审视来源、时间与器物编号。')
      return
    }
    if (game.flags.includes(result.flag)) {
      setFeedbackKind('hint')
      setFeedback('这条证据链已经记入卷宗，不必重复关联。')
      return
    }
    onLink(result)
    setFeedbackKind('success')
    setFeedback(result.feedback)
    setSelected([])
  }

  return (
    <section className="link-board" aria-label="证据关联推演">
      <header className="link-board-header">
        <div>
          <span className="eyebrow dark">公孙策 · 合证之法</span>
          <h2>证物关联推演</h2>
          <p>证物不会开口，彼此印证方能还原事实。</p>
        </div>
        <div className="link-progress"><strong>{completed.length}</strong><span>/ 3 条证据链</span></div>
        {onClose && <button className="icon-button ink" onClick={onClose} aria-label="关闭证据关联">×</button>}
      </header>
      <div className="link-rule-list">
        {evidenceLinks.map((link, index) => (
          <div className={game.flags.includes(link.flag) ? 'linked' : ''} key={link.id}>
            <span>0{index + 1}</span>{game.flags.includes(link.flag) ? link.title : '尚未形成证据链'}
            <b>{game.flags.includes(link.flag) ? '已印证' : '待推演'}</b>
          </div>
        ))}
      </div>
      <div className="link-evidence-grid">
        {owned.map((item) => (
          <button
            key={item.id}
            className={`link-evidence-card ${selected.includes(item.id) ? 'selected' : ''}`}
            onClick={() => toggle(item.id)}
            aria-pressed={selected.includes(item.id)}
          >
            <EvidenceIcon id={item.id} />
            <strong>{item.name}</strong>
            <small>{item.keywords.join(' · ')}</small>
            <i>{selected.includes(item.id) ? '已入案' : '点击选取'}</i>
          </button>
        ))}
      </div>
      <div className="link-workbench">
        <div className="link-slots">
          {[0, 1, 2].map((index) => <span className={selected[index] ? 'filled' : ''} key={index}>{selected[index] ? evidence.find((item) => item.id === selected[index])?.name : '虚位'}</span>)}
        </div>
        <p className={feedbackKind} role="status" aria-live="polite" aria-atomic="true">{feedbackKind === 'success' ? '已印证 · ' : feedbackKind === 'error' ? '尚未成链 · ' : ''}{feedback}</p>
        <button className="seal-button" onClick={linkEvidence}>关联推演</button>
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import HomePage from './pages/HomePage.jsx'
import GamePage from './pages/GamePage.jsx'
import EndingPage from './pages/EndingPage.jsx'
import ArchiveModal from './components/ArchiveModal.jsx'
import EvidenceLinkBoard from './components/EvidenceLinkBoard.jsx'
import IntroVideo from './components/IntroVideo.jsx'
import { courts } from './data/story.js'
import { characters } from './data/characters.js'
import { evaluateEnding } from './game/endings.js'
import { autoSave, loadGame, manualSave, recordEnding, readEndingArchive, clearSave, STORAGE_KEYS } from './game/save.js'
import useAudio from './hooks/useAudio.js'

const defaultSettings = {
  music: false,
  sound: true,
  textSpeed: 'normal',
  autoPlay: false,
  skipRead: true,
  fontSize: 'medium',
}

function freshGame() {
  return {
    courtIndex: 0,
    nodeId: courts[0].startNode,
    phase: 'opening',
    evidence: [],
    flags: [],
    insight: 0,
    pressure: 0,
    history: [],
    readNodeIds: [],
    finalChoice: null,
    ending: null,
    nextNode: null,
    lastResponse: '',
    startedAt: new Date().toISOString(),
    // 可回退快照栈：每做一次抉择或推演就压入一份「操作前」的状态，供玩家反悔。
    undoStack: [],
  }
}

// 最多保留的快照层数，避免存档体积随审案轮次无限增长。
const UNDO_LIMIT = 30;

// 生成一份可序列化的快照（剔除 undoStack 自身，避免无限嵌套）。
// history 只记录长度而非整份拷贝：快照与 history 一一对应，
// 恢复时按长度切片即可，避免存档体积呈 O(n²) 膨胀。
function snapshotOf(state) {
  const rest = { ...state };
  delete rest.undoStack;
  const { history, ...fields } = rest;
  return {
    ...fields,
    evidence: [...fields.evidence],
    flags: [...fields.flags],
    readNodeIds: [...fields.readNodeIds],
    historyLength: history.length,
  };
}


function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem('kaizha:settings') || '{}') }
  } catch {
    return defaultSettings
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [game, setGame] = useState(freshGame)
  const [settings, setSettings] = useState(loadSettings)
  const [modal, setModal] = useState(null)
  const [linkBoardOpen, setLinkBoardOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  // 存档探测令牌：每次 +1 触发重新探测，避免在 effect 内 setState 造成级联渲染。
  const [saveProbe, setSaveProbe] = useState(0)
  const [endingCount, setEndingCount] = useState(() => readEndingArchive().endings?.length || 0)
  const [pendingNewGame, setPendingNewGame] = useState(false)
  const playSound = useAudio(settings)

  // 「是否有存档」是派生值：直接探测 localStorage，始终与真实存储一致。
  const hasSave = (() => {
    void saveProbe
    try { return Boolean(localStorage.getItem(STORAGE_KEYS.auto) || localStorage.getItem(STORAGE_KEYS.manual)) } catch { return false }
  })()

  useEffect(() => {
    document.documentElement.dataset.fontSize = settings.fontSize
    try { localStorage.setItem('kaizha:settings', JSON.stringify(settings)) } catch {
      // 隐私模式或存储受限时不阻断游戏。
    }
  }, [settings])

  useEffect(() => {
    if (screen !== 'game' && screen !== 'ending') return
    autoSave(game)
  }, [game, screen])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  const toast = (message) => setToastMessage(message)
  const updateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }))

  const newGame = (options = {}) => {
    // 注意：不能把 skipConfirm 作为第一个位置参数——React 的 onClick 会传入事件对象，
    // 事件对象为真值会导致确认框被跳过。这里统一收对象参数。
    const skipConfirm = options === true || (options && options.skipConfirm === true);
    // 有存档时先在游戏内确认；用自绘确认框而非 window.confirm，
    // 因为原生弹窗在 Electron / 部分浏览器中会被拦截，导致无法另立新卷宗。
    if (!skipConfirm && hasSave) {
      setPendingNewGame(true)
      return
    }
    setPendingNewGame(false)
    const nextGame = freshGame()
    // Commit the new automatic slot before discarding the old manual fallback.
    // Refreshing during the intro must not revive the previous case.
    const saved = autoSave(nextGame)
    const cleared = saved.ok ? clearSave('manual') : null
    setGame(nextGame)
    setModal(null)
    setLinkBoardOpen(false)
    setScreen('intro')
    playSound('gavel')
    toast(!saved.ok ? saved.message : !cleared.ok ? cleared.message : '已另立新卷宗。')
  }

  const confirmNewGame = () => {
    setPendingNewGame(false)
    newGame({ skipConfirm: true })
  }

  const continueGame = () => {
    const automatic = loadGame('auto')
    let result = automatic
    if (!result.ok) result = loadGame('manual')
    if (!result.ok) {
      toast((result.reason === 'missing' && automatic.reason !== 'missing' ? automatic.message : result.message) || '没有可继续的案件。')
      return
    }
    setGame({ ...freshGame(), ...result.state, phase: result.state.phase || 'story' })
    setScreen(result.state.ending ? 'ending' : 'game')
    toast('卷宗已恢复。')
  }

  const handleChoice = (choice) => {
    const court = courts[game.courtIndex]
    const node = court.nodes.find((item) => item.id === game.nodeId)
    const effects = choice.effects || {}
    const next = {
      ...game,
      evidence: [...new Set([...game.evidence, ...(effects.evidence || [])])],
      flags: [...new Set([...game.flags, ...(effects.flags || [])])],
      insight: game.insight + (effects.insight || 0),
      pressure: game.pressure + (effects.pressure || 0),
      history: [...game.history, {
        courtTitle: court.title,
        speaker: characters[node.speaker]?.name || '旁白',
        text: node.text,
        choice: choice.label,
        response: choice.response,
        outcome: choice.outcome || null,
      }],
      readNodeIds: [...new Set([...game.readNodeIds, `${game.courtIndex}:${node.id}:story`])],
      lastResponse: choice.response,
      nextNode: choice.next,
      phase: 'response',
      // 压入「本次抉择之前」的快照，玩家可随时反悔回退。
      undoStack: [...(game.undoStack || []), snapshotOf(game)].slice(-UNDO_LIMIT),
    }
    if (choice.finalChoice) {
      next.finalChoice = choice.finalChoice
      next.ending = evaluateEnding(next)
      next.phase = 'ended'
      recordEnding(next.ending)
      setEndingCount(readEndingArchive().endings?.length || 0)
      setScreen('ending')
    }
    setGame(next)
  }

  // 回退到第 index 个快照之后的状态（index 为快照数组下标）。
  // 传入 -1 表示回退到最靠近当前的一步。
  const handleUndo = (index = -1) => {
    const stack = game.undoStack || []
    if (!stack.length) {
      toast('尚无可回退的步骤。')
      return
    }
    const target = index < 0 ? stack.length - 1 : Math.min(index, stack.length - 1)
    const snapshot = stack[target]
    if (!snapshot) {
      toast('无法回退到该步骤。')
      return
    }
    const { historyLength, ...restored } = snapshot
    setGame({
      ...restored,
      // 审案记录按快照记录的长度截断，丢弃该步之后的痕迹。
      history: game.history.slice(0, historyLength),
      undoStack: stack.slice(0, target),
      phase: restored.phase === 'ended' ? 'story' : restored.phase,
    })
    setScreen('game')
    setModal(null)
    playSound('paper')
    toast('已回退一步，可重新抉择。')
  }

  const handleAdvance = () => {
    const court = courts[game.courtIndex]
    const node = court.nodes.find((item) => item.id === game.nodeId)
    if (game.phase === 'opening') {
      setGame({ ...game, phase: 'story' })
      return
    }
    if (game.phase === 'courtEnd') {
      const nextIndex = Math.min(game.courtIndex + 1, courts.length - 1)
      setGame({ ...game, courtIndex: nextIndex, nodeId: courts[nextIndex].startNode, phase: 'opening', nextNode: null })
      return
    }
    const readKey = `${game.courtIndex}:${node.id}:${game.phase === 'response' ? 'response' : 'story'}`
    const readNodeIds = [...new Set([...game.readNodeIds, readKey])]
    if (game.phase === 'response') {
      if (game.nextNode === null) setGame({ ...game, phase: 'courtEnd', readNodeIds })
      else setGame({ ...game, nodeId: game.nextNode, phase: 'story', nextNode: null, readNodeIds })
      return
    }
    if (node.next === null) setGame({ ...game, phase: 'courtEnd', readNodeIds })
    else setGame({ ...game, nodeId: node.next, readNodeIds })
  }

  const handleLink = (link) => {
    setGame((current) => ({
      ...current,
      flags: [...new Set([...current.flags, link.flag])],
      insight: current.insight + 2,
      history: [...current.history, { courtTitle: '第二堂·合证', speaker: '证据推演', text: link.title, choice: '完成证物关联', response: link.feedback }],
      // 推演同样是一次「操作」，压入快照以便反悔。
      undoStack: [...(current.undoStack || []), snapshotOf(current)].slice(-UNDO_LIMIT),
    }))
    playSound('success')
    toast(`证据链已成立：${link.title}`)
  }

  const saveManual = () => {
    const result = manualSave(game)
    toast(result.ok ? `手动存档完成 · ${new Date(result.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : result.message)
    if (result.ok) setSaveProbe((n) => n + 1)
  }

  const resetGame = () => {
    clearSave('all')
    setGame(freshGame())
    setSaveProbe((n) => n + 1)
    setModal(null)
    setScreen('home')
    toast('案件进度已重置，结局档案仍保留。')
  }

  const openLinks = () => {
    setModal(null)
    setLinkBoardOpen(true)
  }

  const goHome = () => { setModal(null); setSaveProbe((n) => n + 1); setScreen('home') }
  const commonArchiveProps = {
    game,
    settings,
    onSettingsChange: updateSettings,
    onManualSave: saveManual,
    onOpenEvidenceLink: openLinks,
    onReset: resetGame,
    onHome: goHome,
    onUndo: handleUndo,
    toast,
  }

  return (
    <div className="app-shell">
      {screen === 'home' && <HomePage onNewGame={newGame} onContinue={continueGame} onOpen={setModal} hasSave={hasSave} endingCount={endingCount} />}
      {screen === 'intro' && <IntroVideo onDone={() => setScreen('game')} onSkip={() => setScreen('game')} />}
      {screen === 'game' && <GamePage game={game} onAdvance={handleAdvance} onChoice={handleChoice} onOpen={setModal} onOpenLinks={openLinks} onManualSave={saveManual} onUndo={handleUndo} settings={settings} playSound={playSound} paused={Boolean(modal || linkBoardOpen || pendingNewGame)} />}
      {screen === 'ending' && <EndingPage game={game} onHome={() => setScreen('home')} onRestart={newGame} onArchive={() => setModal('endings')} onUndo={handleUndo} />}
      {modal && <ArchiveModal type={modal} onClose={() => setModal(null)} {...commonArchiveProps} />}
      {linkBoardOpen && <div className="link-board-overlay"><EvidenceLinkBoard game={game} onLink={handleLink} onClose={() => setLinkBoardOpen(false)} /></div>}
      {pendingNewGame && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="确认另立新案">
          <div className="confirm-dialog">
            <span className="eyebrow dark">另立新案</span>
            <h2>确认重开卷宗？</h2>
            <p>当前案件进度将被新的卷宗取代。</p>
            <small>自动存档与手动存档会被覆盖；已解锁的结局档案仍会保留。</small>
            <div><button onClick={() => setPendingNewGame(false)}>继续当前案件</button><button className="danger" onClick={confirmNewGame}>确认另立新案</button></div>
          </div>
        </div>
      )}
      {toastMessage && <div className="game-toast" role="status"><span>印</span>{toastMessage}</div>}
    </div>
  )
}

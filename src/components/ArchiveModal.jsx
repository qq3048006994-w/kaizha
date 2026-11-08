import { useEffect, useMemo, useState } from 'react';
import { characterArtWhite, characterPortraits } from '../assets.js';
import { characters } from '../data/characters.js';
import {
  CORE_EVIDENCE_IDS,
  evidence,
  evidenceById,
  evidenceLinks,
} from '../data/evidence.js';
import { endingCatalog } from '../game/endings.js';
import { readEndingArchive } from '../game/save.js';
import EvidenceIcon from './EvidenceIcon.jsx';

const PANEL_TITLES = {
  evidence: '证物案卷',
  characters: '人物档案',
  case: '案情纪要',
  history: '审案记录',
  settings: '游戏设置',
  endings: '结局档案',
};

const CHARACTER_ORDER = ['bao', 'qin', 'chen', 'han', 'princess'];

const CHARACTER_PROFILES = {
  bao: {
    personality: '刚正而审慎，不因民怨定案，也不因皇命改判；每一次落签都以证据为凭。',
    relationship: '秦香莲的审案官；陈世美案的主审者。与公孙策、展昭共同核卷、守证。',
    connection: '主持四堂会审，在国法与权势之间作出最终抉择。',
  },
  qin: {
    personality: '坚韧克制，护子情深。所受苦难并未使她夸饰证词，只求旧日婚配得到承认。',
    relationship: '陈世美的原配，两名儿女之母；韩琪因不忍加害她与孩子而以死留证。',
    connection: '案件原告，以状纸、婚书与原籍户籍说明婚配及亲子关系。',
  },
  chen: {
    personality: '重名逐利，善于以身份掩饰旧事；面对闭合的证物链，辩解渐难自圆其说。',
    relationship: '秦香莲的原配丈夫、两名儿女之父，也是公主的现任丈夫与驸马府之主。',
    connection: '案件被告。其是否停妻再娶、是否牵涉三官堂之事，是堂审核心。',
  },
  han: {
    personality: '忠于差遣却未泯恻隐，在奉命与不忍之间选择了收刀，并留下可供查验的痕迹。',
    relationship: '驸马府差役，受命夜赴三官堂；最终未伤害秦香莲母子。',
    connection: '钢刀、腰牌、遗书与现场验状共同还原其夜行经过及两难抉择。',
  },
  princess: {
    personality: '尊荣自持，极力维护婚姻与皇家体面；面对旧案，更在意驸马府不可动摇。',
    relationship: '陈世美现任妻子，以皇室身份向开封府施压；与秦香莲处于婚姻事实的两端。',
    connection: '第三堂权势压力的来源之一，其态度影响包拯最终如何落判。',
  },
};

const INVESTIGATION_LABELS = {
  filed: '已归档',
  sealed: '已封存',
  pending: '待复核',
};

const TEXT_SPEEDS = [
  { value: 'slow', label: '徐缓' },
  { value: 'normal', label: '适中' },
  { value: 'fast', label: '迅捷' },
];

const FONT_SIZES = [
  { value: 'small', label: '小字' },
  { value: 'medium', label: '标准' },
  { value: 'large', label: '大字' },
];

const COURT_NAMES = ['第一堂', '第二堂', '第三堂'];

function formatDate(value) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未记录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function acquisitionCourt(item) {
  return item.source.match(/第[一二三]堂/)?.[0] || '第一堂';
}

function SectionHeading({ eyebrow, title, detail }) {
  return (
    <div className="archive-section-heading">
      <div>
        {eyebrow && <span className="archive-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {detail && <p>{detail}</p>}
    </div>
  );
}

function EvidencePanel({ game, onOpenEvidenceLink, toast }) {
  const [selectedId, setSelectedId] = useState(null);
  const owned = useMemo(() => new Set(game.evidence || []), [game.evidence]);
  const flags = useMemo(() => new Set(game.flags || []), [game.flags]);
  const selected = selectedId && owned.has(selectedId) ? evidenceById[selectedId] : null;
  const completedLinks = evidenceLinks.filter((link) => flags.has(link.flag)).length;

  function openLinkMode(link) {
    const complete = flags.has(link.flag);
    toast?.(complete ? `「${link.title}」已关联，可重新查验证据。` : `进入「${link.title}」关联查验。`);
    onOpenEvidenceLink?.();
  }

  return (
    <div className="archive-panel archive-evidence-panel">
      <SectionHeading
        eyebrow="开封府证物房"
        title="物有其源，证有其验"
        detail={`已收录 ${owned.size} / ${evidence.length} 件 · 已完成 ${completedLinks} / ${evidenceLinks.length} 组关联`}
      />

      <div className="archive-evidence-layout">
        <div className="archive-evidence-grid" aria-label="证物列表">
          {evidence.map((item) => {
            const isOwned = owned.has(item.id);
            if (!isOwned) {
              return (
                <article className="archive-evidence-card is-locked" key={item.id} aria-label="尚未取得的证物">
                  <span className="archive-evidence-placeholder" aria-hidden="true">未</span>
                  <div>
                    <h3>证物未录</h3>
                    <p>继续查案以补全此页</p>
                  </div>
                  <span className="archive-status">未取得</span>
                </article>
              );
            }

            return (
              <button
                className={`archive-evidence-card is-owned${selectedId === item.id ? ' is-selected' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selectedId === item.id}
              >
                <EvidenceIcon id={item.id} />
                <div className="archive-evidence-card-copy">
                  <span className="archive-card-kicker">{acquisitionCourt(item)} · 获取</span>
                  <h3>{item.name}</h3>
                  <p className="archive-evidence-source">{item.source}</p>
                  <p>{item.description}</p>
                  <span className="archive-investigation-status">
                    调查状态 · {INVESTIGATION_LABELS[item.investigationStatus] || item.investigationStatus}
                  </span>
                </div>
                {item.key && <span className="archive-key-seal">关键<br />证物</span>}
                <span className="archive-card-action">点击查验</span>
              </button>
            );
          })}
        </div>

        <aside className={`archive-evidence-detail${selected ? ' has-evidence' : ''}`} aria-live="polite">
          {selected ? (
            <>
              <EvidenceIcon id={selected.id} />
              <span className="archive-eyebrow">证物细目 · {acquisitionCourt(selected)}</span>
              <h3>{selected.name}</h3>
              <dl>
                <div><dt>来源</dt><dd>{selected.source}</dd></div>
                <div><dt>查验</dt><dd>{selected.criticalMarker}</dd></div>
                <div><dt>调查状态</dt><dd>{INVESTIGATION_LABELS[selected.investigationStatus] || selected.investigationStatus}</dd></div>
              </dl>
              <div className="archive-keywords" aria-label="证物关键词">
                {selected.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
              {selected.key && <p className="archive-key-note">此物属于完整证据链的七件关键证物。</p>}
            </>
          ) : (
            <div className="archive-empty-selection">
              <span className="archive-empty-seal" aria-hidden="true">验</span>
              <h3>择证细验</h3>
              <p>点击已取得的证物，在此查看来源、查验要点与关键词。</p>
            </div>
          )}
        </aside>
      </div>

      <section className="archive-link-gateway" aria-labelledby="archive-link-title">
        <SectionHeading
          eyebrow="第二堂 · 证据互校"
          title="证物关联"
          detail="将分散的物证串成可经受质询的事实。"
        />
        <h3 id="archive-link-title" className="archive-visually-hidden">选择证物关联</h3>
        <div className="archive-link-grid">
          {evidenceLinks.map((link, index) => {
            const complete = flags.has(link.flag);
            return (
              <button
                className={`archive-link-card${complete ? ' is-complete' : ''}`}
                key={link.id}
                type="button"
                onClick={() => openLinkMode(link)}
              >
                <span className="archive-link-number">关联 {String(index + 1).padStart(2, '0')}</span>
                <strong>{link.title}</strong>
                <span>{link.evidence.map((id) => evidenceById[id]?.name).filter(Boolean).join(' · ')}</span>
                <span className="archive-link-state">{complete ? '已解锁 · 已关联' : '待关联'}<span aria-hidden="true"> →</span></span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CharactersPanel({ game }) {
  const [selectedId, setSelectedId] = useState('bao');
  const courtIndex = Number(game.courtIndex) || 0;
  const unlocked = {
    bao: true,
    qin: true,
    chen: true,
    han: courtIndex >= 1,
    princess: courtIndex >= 2,
  };
  const activeId = unlocked[selectedId] ? selectedId : 'bao';
  const character = characters[activeId];
  const profile = CHARACTER_PROFILES[activeId];

  return (
    <div className="archive-panel archive-characters-panel">
      <SectionHeading
        eyebrow="涉案诸人"
        title="观其所言，察其所立"
        detail="人物档案随堂审推进而解封。"
      />
      <div className="archive-character-layout">
        <div className="archive-character-list" role="list" aria-label="人物列表">
          {CHARACTER_ORDER.map((id, index) => {
            const item = characters[id];
            const isUnlocked = unlocked[id];
            return (
              <button
                key={id}
                type="button"
                className={`archive-character-tab${activeId === id ? ' is-active' : ''}${!isUnlocked ? ' is-locked' : ''}`}
                onClick={() => isUnlocked && setSelectedId(id)}
                disabled={!isUnlocked}
                aria-pressed={activeId === id}
              >
                <span className="archive-character-index">{String(index + 1).padStart(2, '0')}</span>
                {isUnlocked ? (
                  <img src={characterPortraits[id]} alt="" />
                ) : (
                  <span className="archive-locked-portrait" aria-hidden="true">封</span>
                )}
                <span className="archive-character-tab-copy">
                  <strong>{isUnlocked ? item.name : '档案未启'}</strong>
                  <small>{isUnlocked ? item.role : `第${id === 'han' ? '二' : '三'}堂后解封`}</small>
                </span>
                <span className="archive-character-tab-state">{isUnlocked ? '已录' : '未录'}</span>
              </button>
            );
          })}
        </div>

        <article className="archive-character-sheet">
          <div className="archive-character-art">
            <span className="archive-art-vertical-name" aria-hidden="true">{character.name}</span>
            <img src={characterArtWhite[activeId]} alt={`${character.name}立绘`} />
            <span className="archive-character-role-seal">{character.role}</span>
          </div>
          <div className="archive-character-biography">
            <span className="archive-eyebrow">人物卷 · {String(CHARACTER_ORDER.indexOf(activeId) + 1).padStart(2, '0')}</span>
            <h3>{character.name}</h3>
            <p className="archive-character-role">{character.role}</p>
            <dl>
              <div><dt>身份</dt><dd>{character.role}。{character.description}</dd></div>
              <div><dt>性格</dt><dd>{profile.personality}</dd></div>
              <div><dt>关系</dt><dd>{profile.relationship}</dd></div>
              <div><dt>案件关联</dt><dd>{profile.connection}</dd></div>
            </dl>
          </div>
        </article>
      </div>
    </div>
  );
}

function CasePanel({ game }) {
  const owned = useMemo(() => new Set(game.evidence || []), [game.evidence]);
  const flags = useMemo(() => new Set(game.flags || []), [game.flags]);
  const coreCount = CORE_EVIDENCE_IDS.filter((id) => owned.has(id)).length;
  const courtIndex = Number(game.courtIndex) || 0;
  const facts = [
    {
      id: 'complaint',
      show: owned.has('complaint'),
      title: '原告所诉',
      text: '秦香莲携儿女进京寻夫，并当庭陈述家乡婚配与三官堂变故。',
    },
    {
      id: 'kinship',
      show: owned.has('marriage_contract') && owned.has('children_registry'),
      title: '婚配与亲子有据',
      text: '婚书与原籍户籍可相互核对，陈世美与秦香莲及儿女的关系不再只是口供。',
    },
    {
      id: 'weapon',
      show: owned.has('han_qi_saber') && owned.has('palace_scabbard'),
      title: '凶器出自驸马府',
      text: '刀身与空鞘的器物编号相续，鞘口磨损亦可互验。',
    },
    {
      id: 'command',
      show: owned.has('palace_token'),
      title: '韩琪奉命夜出',
      text: '腰牌背刻韩琪姓名，可与府中出入簿及三官堂更次互校。',
    },
    {
      id: 'mercy',
      show: owned.has('sanguantang_report') && owned.has('han_qi_letter'),
      title: '收刀与遗书互证',
      text: '现场勘验所见与“奉命、不忍”的遗书相互印证，韩琪未曾加害母子。',
    },
  ].filter((fact) => fact.show);

  return (
    <div className="archive-panel archive-case-panel">
      <SectionHeading
        eyebrow="秦香莲案"
        title="事实为纲，证据为目"
        detail={`案卷启于 ${formatDate(game.startedAt)}`}
      />
      <div className="archive-case-metrics">
        <div><span>当前堂次</span><strong>{COURT_NAMES[courtIndex] || `第 ${courtIndex + 1} 堂`}</strong><small>审案轮次 {courtIndex + 1}</small></div>
        <div><span>洞察</span><strong>{Number(game.insight) || 0}</strong><small>用于查问与辨疑</small></div>
        <div><span>威压</span><strong>{Number(game.pressure) || 0}</strong><small>权势施加于公堂之重</small></div>
      </div>

      <div className="archive-case-columns">
        <section className="archive-known-facts">
          <h3>已知事实 <span>{facts.length}</span></h3>
          {facts.length ? (
            <ol>
              {facts.map((fact, index) => (
                <li key={fact.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{fact.title}</strong><p>{fact.text}</p></div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="archive-empty-copy">尚无足以落卷的事实，先听堂上所述、查所得证物。</p>
          )}
        </section>

        <section className="archive-chain-progress">
          <h3>证据链进度</h3>
          <div className="archive-progress-heading"><strong>{coreCount} / {CORE_EVIDENCE_IDS.length}</strong><span>关键证物</span></div>
          <div className="archive-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={CORE_EVIDENCE_IDS.length} aria-valuenow={coreCount} aria-label="关键证物收集进度">
            <span style={{ width: `${(coreCount / CORE_EVIDENCE_IDS.length) * 100}%` }} />
          </div>
          <ul className="archive-chain-list">
            {CORE_EVIDENCE_IDS.map((id) => (
              <li key={id} className={owned.has(id) ? 'is-owned' : ''}>
                <span aria-hidden="true">{owned.has(id) ? '✓' : '○'}</span>
                {owned.has(id) ? evidenceById[id].name : '尚未查明'}
              </li>
            ))}
          </ul>
          <div className="archive-case-link-summary">
            {evidenceLinks.map((link) => (
              <div key={link.id} className={flags.has(link.flag) ? 'is-complete' : ''}>
                <span>{link.title}</span><strong>{flags.has(link.flag) ? '已关联' : '待关联'}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function HistoryPanel({ game, onUndo }) {
  const history = Array.isArray(game.history) ? game.history : [];
  const undoCount = Array.isArray(game.undoStack) ? game.undoStack.length : 0;
  return (
    <div className="archive-panel archive-history-panel">
      <SectionHeading
        eyebrow="堂审留痕"
        title="一言一问，俱入卷中"
        detail={`共 ${history.length} 条审案记录`}
      />
      {undoCount > 0 && (
        <div className="archive-undo-bar">
          <p>案卷尚可翻改。若有抉择失据，可回到此前任意一步重断。</p>
          <button type="button" className="archive-button" onClick={() => onUndo?.(undoCount - 1)}>
            回到上一步
          </button>
        </div>
      )}
      {history.length ? (
        <ol className="archive-history-timeline">
          {history.map((entry, index) => (
            <li key={`${entry.courtTitle || 'court'}-${index}`}>
              <div className="archive-history-marker"><span>{index + 1}</span></div>
              <article>
                <header>
                  <span>{entry.courtTitle || '堂审记录'}</span>
                  <strong>{entry.speaker || '旁白'}</strong>
                  {/* Snapshot historyLength remains valid even after the 30-step stack is trimmed. */}
                  {(game.undoStack || []).some((snapshot) => snapshot.historyLength === index) && (
                    <button
                      type="button"
                      className="archive-undo-step"
                      title="回到这一步之前，重新抉择"
                      onClick={() => onUndo?.(game.undoStack.findIndex((snapshot) => snapshot.historyLength === index))}
                    >
                      回到此处
                    </button>
                  )}
                </header>
                {entry.text && <p className="archive-history-text">{entry.text}</p>}
                {entry.choice && <p className="archive-history-choice"><span>你的抉择</span>{entry.choice}</p>}
                {entry.response && <p className="archive-history-response"><span>堂上回响</span>{entry.response}</p>}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div className="archive-empty-state">
          <span aria-hidden="true">录</span>
          <h3>堂审尚未落笔</h3>
          <p>开始审案后，人物话语、你的抉择与回应会依时序留在这里。</p>
        </div>
      )}
    </div>
  );
}

function ToggleSetting({ title, description, checked, onChange }) {
  return (
    <label className="archive-setting-row archive-toggle-setting">
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span className="archive-toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}

function ChoiceSetting({ title, description, value, choices, onChange }) {
  return (
    <div className="archive-setting-row archive-choice-setting">
      <span><strong>{title}</strong><small>{description}</small></span>
      <div className="archive-segmented-control" role="group" aria-label={title}>
        {choices.map((choice) => (
          <button
            type="button"
            key={choice.value}
            className={value === choice.value ? 'is-active' : ''}
            aria-pressed={value === choice.value}
            onClick={() => onChange(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSettingsChange, onManualSave, onReset, onHome }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const currentSpeed = TEXT_SPEEDS.some((item) => item.value === settings.textSpeed) ? settings.textSpeed : 'normal';
  const currentFontSize = FONT_SIZES.some((item) => item.value === settings.fontSize) ? settings.fontSize : 'medium';
  const update = (key, value) => onSettingsChange?.({ [key]: value });

  return (
    <div className="archive-panel archive-settings-panel">
      <SectionHeading
        eyebrow="阅览与声色"
        title="依你所好，重整案卷"
        detail="设置变更即时生效。"
      />
      <div className="archive-settings-groups">
        <section className="archive-settings-group">
          <h3>声音</h3>
          <ToggleSetting title="背景音乐" description="开启或关闭堂审与案卷音乐" checked={settings.music} onChange={(value) => update('music', value)} />
          <ToggleSetting title="游戏音效" description="开启或关闭惊堂木、翻页等音效" checked={settings.sound} onChange={(value) => update('sound', value)} />
        </section>
        <section className="archive-settings-group">
          <h3>阅读</h3>
          <ChoiceSetting title="文字速度" description="调节对话逐字显现的速度" value={currentSpeed} choices={TEXT_SPEEDS} onChange={(value) => update('textSpeed', value)} />
          <ToggleSetting title="自动播放" description="对话完整显示后自动进入下一句" checked={settings.autoPlay} onChange={(value) => update('autoPlay', value)} />
          <ToggleSetting title="跳过已读" description="允许快速略过此前已经阅读的对话" checked={settings.skipRead} onChange={(value) => update('skipRead', value)} />
          <ChoiceSetting title="文字大小" description="调节游戏正文与对话字号" value={currentFontSize} choices={FONT_SIZES} onChange={(value) => update('fontSize', value)} />
        </section>
      </div>

      <section className="archive-game-actions" aria-label="游戏操作">
        <div>
          <span className="archive-eyebrow">本局操作</span>
          <h3>存卷、归府或重新开堂</h3>
        </div>
        <div className="archive-action-buttons">
          <button type="button" className="archive-button archive-button-primary" onClick={() => onManualSave?.()}>手动存档</button>
          <button type="button" className="archive-button" onClick={() => onHome?.()}>返回主菜单</button>
          <button type="button" className="archive-button archive-button-danger" onClick={() => setConfirmReset(true)}>重置游戏</button>
        </div>
        {confirmReset && (
          <div className="archive-reset-confirmation" role="alert">
            <div><strong>确定重置此局？</strong><p>当前审案进度将被清除，已解锁的结局档案不受影响。</p></div>
            <button type="button" className="archive-button" onClick={() => setConfirmReset(false)}>取消</button>
            <button type="button" className="archive-button archive-button-danger" onClick={() => onReset?.()}>确认重置</button>
          </div>
        )}
      </section>
    </div>
  );
}

function EndingsPanel() {
  const archive = useMemo(() => readEndingArchive(), []);
  const unlocked = useMemo(
    () => new Set((archive.endings || []).map((entry) => entry?.endingId).filter(Boolean)),
    [archive.endings],
  );
  const endings = Object.values(endingCatalog);

  return (
    <div className="archive-panel archive-endings-panel">
      <SectionHeading
        eyebrow="四卷终局"
        title="法之归处，由抉择写成"
        detail={`已解锁 ${unlocked.size} / ${endings.length} 个结局`}
      />
      {!archive.ok && <p className="archive-archive-warning">{archive.message || '结局档案暂时无法读取。'}</p>}
      <div className="archive-ending-grid">
        {endings.map((ending, index) => {
          const isUnlocked = unlocked.has(ending.id);
          const record = (archive.endings || []).find((entry) => entry?.endingId === ending.id);
          return (
            <article className={`archive-ending-card${isUnlocked ? ' is-unlocked' : ' is-locked'}`} key={ending.id}>
              <header>
                <span className="archive-ending-number">终局 {String(index + 1).padStart(2, '0')}</span>
                <span className="archive-ending-status">{isUnlocked ? '已解锁' : '未解锁'}</span>
              </header>
              <div className="archive-ending-seal" style={isUnlocked ? { borderColor: ending.color, color: ending.color } : undefined}>
                {isUnlocked ? ending.seal : '封存'}
              </div>
              <h3>{ending.title}</h3>
              {isUnlocked ? (
                <>
                  <p>{ending.body}</p>
                  <p className="archive-ending-epilogue">{ending.epilogue}</p>
                  <footer>达成于 {formatDate(record?.unlockedAt)}</footer>
                </>
              ) : (
                <p className="archive-ending-locked-copy">此卷正文尚未落成。继续审案、补全证据，并亲自作出最后抉择。</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function ArchiveModal({
  type,
  onClose,
  game = {},
  settings = {},
  onSettingsChange,
  onManualSave,
  onOpenEvidenceLink,
  onReset,
  onHome,
  onUndo,
  toast,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  let content;
  switch (type) {
    case 'evidence':
      content = <EvidencePanel game={game} onOpenEvidenceLink={onOpenEvidenceLink} toast={toast} />;
      break;
    case 'characters':
      content = <CharactersPanel game={game} />;
      break;
    case 'history':
      content = <HistoryPanel game={game} onUndo={onUndo} />;
      break;
    case 'settings':
      content = (
        <SettingsPanel
          settings={settings}
          onSettingsChange={onSettingsChange}
          onManualSave={onManualSave}
          onReset={onReset}
          onHome={onHome}
        />
      );
      break;
    case 'endings':
      content = <EndingsPanel />;
      break;
    case 'case':
    default:
      content = <CasePanel game={game} />;
      break;
  }

  return (
    <div className="archive-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <section className={`archive-modal archive-modal-${type}`} role="dialog" aria-modal="true" aria-labelledby="archive-modal-title">
        <div className="archive-border-corner archive-border-corner-tl" aria-hidden="true" />
        <div className="archive-border-corner archive-border-corner-tr" aria-hidden="true" />
        <div className="archive-border-corner archive-border-corner-bl" aria-hidden="true" />
        <div className="archive-border-corner archive-border-corner-br" aria-hidden="true" />
        <header className="archive-header">
          <div className="archive-header-title">
            <span className="archive-eyebrow">开封府 · 案卷</span>
            <h1 id="archive-modal-title">{PANEL_TITLES[type] || '案情纪要'}</h1>
          </div>
          <div className="archive-header-emblem" aria-hidden="true"><span>明</span><span>镜</span></div>
          <button className="archive-close" type="button" onClick={() => onClose?.()} aria-label="关闭案卷">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="archive-body">{content}</div>
        <footer className="archive-footer">
          <span>开铡 · 铡美案</span>
          <span>据卷明断，不以权势易法</span>
        </footer>
      </section>
    </div>
  );
}

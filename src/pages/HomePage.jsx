export default function HomePage({ onNewGame, onContinue, onOpen, hasSave, endingCount }) {
  return (
    <main className="home-page">
      <div className="home-vignette" />
      <header className="home-nav">
        <div className="prefecture-mark"><span>開</span><div>开封府<b>KAIFENG PREFECTURE</b></div></div>
        <nav aria-label="主菜单">
          <button onClick={() => onOpen('characters')}>人物志</button>
          <button onClick={() => onOpen('endings')}>结局档案 <i>{endingCount}/4</i></button>
          <button onClick={() => onOpen('settings')}>游戏设置</button>
        </nav>
      </header>

      <section className="home-hero">
        <div className="title-lockup">
          <img src="/assets/logo/kaizha-calligraphy.png" alt="开铡" className="game-logo" />
          <div className="title-rule"><i /><span>一纸诉状，四堂审判</span><i /></div>
          <p className="home-tagline">公堂之上，究竟是王法，还是王权？</p>
          <div className="home-actions">
            <button className="primary-cta" onClick={onNewGame}><span>开始审案</span><small>新立卷宗</small></button>
            <button className="secondary-cta" onClick={onContinue} disabled={!hasSave}><span>继续案件</span><small>{hasSave ? '恢复上次堂审' : '尚无存档'}</small></button>
          </div>
          <p className="adaptation-note">依据民间故事游戏化改编 · 本作不作为史实陈述</p>
        </div>
      </section>

      <footer className="home-chapters">
        {[
          ['壹', '鸣冤', '一纸状词，先问名分'],
          ['贰', '验刀', '物有来处，事有勾连'],
          ['叁', '对质', '驸马善辩，证据不辩'],
          ['肆', '终审', '圣旨到堂，法在何处'],
        ].map(([number, title, subtitle], index) => (
          <div key={number}><span>{number}</span><p><b>{title}</b><small>{subtitle}</small></p><i>0{index + 1}</i></div>
        ))}
      </footer>
      <div className="home-motto">不问贵贱，只问是非。</div>
    </main>
  )
}

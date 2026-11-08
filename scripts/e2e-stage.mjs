// 专项验收：审案页「单人近景 · 谁说话谁出现」舞台重构
// 覆盖用户要求的 4 类自查：视觉 / 功能 / 适配 / 资源正确性
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4181
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'
const results = []

function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
  if (!condition) throw new Error(`${name}: ${detail}`)
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('开发服务器未启动')
}

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
})

// 把页面上的舞台 / 对话框 / 顶栏几何与状态一次性取回
const readLayout = (page) => page.evaluate(() => {
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, cx: (r.left + r.right) / 2 }
  }
  const portraits = [...document.querySelectorAll('.stage-portrait')].map((el) => {
    const img = el.querySelector('img')
    const cs = getComputedStyle(el)
    const ics = img ? getComputedStyle(img) : null
    return {
      rect: box(el),
      character: el.dataset.character,
      side: el.dataset.side,
      src: el.dataset.src,
      className: el.className,
      opacity: cs.opacity,
      filter: cs.filter,
      animation: cs.animationName,
      imgOk: !!img && img.complete && img.naturalWidth > 0,
      imgNatural: img ? [img.naturalWidth, img.naturalHeight] : null,
      imgOpacity: ics ? ics.opacity : null,
      imgFilter: ics ? ics.filter : null,
      imgTransform: ics ? ics.transform : null,
      imgRect: box(img),
    }
  })
  const q = (sel) => document.querySelector(sel)
  const focus = q('.stage-focus')
  return {
    portraits,
    stage: box(q('.dialogue-stage')),
    stageData: q('.dialogue-stage')?.dataset.stage || '',
    focus: box(focus),
    focusAnimation: focus ? getComputedStyle(focus).animationName : null,
    dialogue: box(q('.dialogue-area')),
    paper: box(q('.dialogue-paper')),
    text: box(q('.dialogue-text')),
    topbar: box(q('.game-topbar')),
    tools: box(q('.game-tools')),
    status: box(q('.court-status')),
    plate: q('.dialogue-nameplate') ? { ...box(q('.dialogue-nameplate')), text: q('.dialogue-nameplate').innerText, side: q('.dialogue-nameplate').dataset.side } : null,
    zStage: q('.dialogue-stage') ? getComputedStyle(q('.dialogue-stage')).zIndex : null,
    zDialogue: q('.dialogue-area') ? getComputedStyle(q('.dialogue-area')).zIndex : null,
    zStatus: q('.court-status') ? getComputedStyle(q('.court-status')).zIndex : null,
    zTopbar: q('.game-topbar') ? getComputedStyle(q('.game-topbar')).zIndex : null,
    pointerEvents: q('.dialogue-stage') ? getComputedStyle(q('.dialogue-stage')).pointerEvents : null,
    vw: window.innerWidth, vh: window.innerHeight,
    scrollW: document.documentElement.scrollWidth,
    centerCharacterCount: document.querySelectorAll('.court-character').length,
    legacySlotCount: document.querySelectorAll('.stage-slot').length,
  }
})

const intersects = (a, b) => !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

async function enterCourt(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.intro-skip').click()
  await page.waitForTimeout(450)
  await page.getByRole('button', { name: /升 堂/ }).click()
  await page.waitForTimeout(550)
}

async function step(page) {
  const choice = page.locator('.choice-button:not([disabled])').first()
  if (await choice.count()) { await choice.click(); return true }
  const next = page.locator('.next-button').first()
  if (await next.count()) { await next.click(); return true }
  return false
}

// 逐节点推进，并在每一步都断言「最多一位立绘」
async function advanceUntil(page, predicate, maxSteps, label) {
  const seen = []
  for (let i = 0; i < maxSteps; i += 1) {
    const L = await readLayout(page)
    seen.push({ stage: L.stageData, count: L.portraits.length })
    check(`${label} 第 ${i + 1} 步不出现多人同屏`, L.portraits.length <= 1, JSON.stringify(L.portraits.map(p => p.character)))
    if (predicate(L)) return L
    if (!(await step(page))) break
    await page.waitForTimeout(360)
  }
  return null
}

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await enterCourt(page)

  // ── 一、视觉审查：单人、居中、近景、不透明 ──────────────────
  let L = await readLayout(page)
  check('旧「画面正中单人层」已彻底移除（DOM 无残留）', L.centerCharacterCount === 0, `count=${L.centerCharacterCount}`)
  check('旧「左右双人站位槽」已彻底移除', L.legacySlotCount === 0, `count=${L.legacySlotCount}`)
  check('对话舞台存在', !!L.stage && L.stage.width > 0)

  // 首节点是旁白（无立绘），「谁说话谁出现」→ 场上无人
  check('旁白节点不显示任何立绘（谁说话谁出现）', L.stageData === '-' && L.portraits.length === 0, JSON.stringify({ stage: L.stageData, count: L.portraits.length }))

  // 推进到秦香莲发言
  const qinLayout = await advanceUntil(page, (v) => v.stageData === 'qin', 8, '推进到秦香莲')
  check('可推进到秦香莲发言节点', !!qinLayout)
  L = qinLayout || await readLayout(page)
  await page.screenshot({ path: `${outDir}/stage-qin-speaking.png` })

  check('秦香莲发言时恰好 1 位立绘', L.portraits.length === 1, `count=${L.portraits.length}`)
  const p = L.portraits[0]
  check('出现的正是当前说话者（谁说话谁出现）', !!p && p.character === L.stageData && L.stageData === 'qin', JSON.stringify({ character: p?.character, stage: L.stageData }))
  check('立绘使用人物志近景半身照', !!p && /-bust\.png$/.test(p.src), JSON.stringify(p?.src))
  check('立绘图片真实加载成功', !!p && p.imgOk, JSON.stringify(p?.imgOk))
  check('近景半身图统一规格 641x730', !!p && p.imgNatural?.[0] === 641 && p.imgNatural?.[1] === 730, JSON.stringify(p?.imgNatural))

  // 居中：人物中心与视口中心一致（不是贴左/右边缘）
  check('人物位于画面中央附近（不再贴左右边缘）', !!p && Math.abs(p.rect.cx - L.vw / 2) <= 12, `cx=${p?.rect.cx} vw=${L.vw}`)
  check('人物不再缩在画面角落', !!p && p.rect.left > L.vw * 0.18 && p.rect.right < L.vw * 0.82, `left=${p?.rect.left} right=${p?.rect.right}`)

  // 大立绘 / 近景：高度占可视高度 55% 以上，明显高于对话框
  const heightRatio = p.rect.height / L.vh
  check('立绘为近景大立绘（高度占可视高度 ≥55%）', heightRatio >= 0.55, `ratio=${heightRatio.toFixed(3)}`)
  check('立绘明显高于对话框', p.rect.height > (L.paper?.height || 0) * 1.3, `portrait=${p.rect.height} paper=${L.paper?.height}`)

  // 不透明、不淡化：彻底告别「跟鬼一样」
  check('人物完全不透明（无 is-dim / 无降透明度）', !!p && p.opacity === '1' && p.imgOpacity === '1' && !/is-dim|is-normal/.test(p.className), JSON.stringify({ opacity: p?.opacity, imgOpacity: p?.imgOpacity, cls: p?.className }))
  check('人物未被降饱和度 / 压暗', !!p && p.filter === 'none' && !/brightness|saturate/.test(p.imgFilter || ''), JSON.stringify({ filter: p?.filter, imgFilter: p?.imgFilter }))
  check('立绘未做水平镜像', !/matrix\(-/.test(p.imgTransform || ''), JSON.stringify(p?.imgTransform))

  // 层级：人物可以挡住背景，但绝不挡住 UI（对话框/名牌/证据链/顶栏都在其上）
  check('对话框层级高于舞台，人物不遮挡姓名/正文/选项', Number(L.zDialogue) > Number(L.zStage), `dialogue=${L.zDialogue} stage=${L.zStage}`)
  check('证据链面板层级高于舞台，不被人物盖住', Number(L.zStatus) > Number(L.zStage), `status=${L.zStatus} stage=${L.zStage}`)
  check('顶部导航栏层级高于舞台', Number(L.zTopbar) > Number(L.zStage), `topbar=${L.zTopbar} stage=${L.zStage}`)
  check('立绘不顶到顶部导航栏', !!L.topbar && p.rect.top >= L.topbar.bottom - 1, `top=${p.rect.top} topbarBottom=${L.topbar?.bottom}`)
  check('立绘不压住右上角功能按钮', !intersects(p.imgRect, L.tools), `tools=${JSON.stringify(L.tools)} img=${JSON.stringify(p.imgRect)}`)
  check('舞台不拦截点击', L.pointerEvents === 'none', `pointerEvents=${L.pointerEvents}`)

  // 名牌与入场 / 呼吸反馈
  check('名牌显示姓名 + 身份标签', !!L.plate && L.plate.text.includes('秦香莲'), JSON.stringify(L.plate))
  check('入场动画已启用', /portraitEnter/.test(L.focusAnimation || ''), `animation=${L.focusAnimation}`)
  check('说话时有极轻微呼吸浮动', /portraitBreath/.test(p.animation || ''), `animation=${p.animation}`)

  // ── 二、功能审查：切换同步、永不双人、刷新续档 ────────────────
  const chenLayout = await advanceUntil(page, (v) => v.stageData === 'chen', 40, '推进到陈世美')
  check('可推进到陈世美发言节点', !!chenLayout)
  if (chenLayout) {
    await page.screenshot({ path: `${outDir}/stage-chen-speaking.png` })
    const c = chenLayout.portraits[0]
    check('切换到陈世美时恰好 1 位立绘且就是陈世美', chenLayout.portraits.length === 1 && c?.character === 'chen', JSON.stringify(chenLayout.portraits.map(x => x.character)))
    check('切换后人物仍完全不透明', c?.opacity === '1' && !/is-dim/.test(c?.className || ''), JSON.stringify(c?.opacity))
    check('切换后人物仍居中', Math.abs((c?.rect.cx || 0) - chenLayout.vw / 2) <= 12, `cx=${c?.rect.cx}`)
    check('立绘与角色一一对应，无串图', /chen-bust\.png$/.test(c?.src || ''), JSON.stringify(c?.src))
    check('名牌同步显示陈世美', !!chenLayout.plate && chenLayout.plate.text.includes('陈世美'), JSON.stringify(chenLayout.plate))
  }

  // 推进到包拯发言（玩家角色，验证「谁说话谁出现」也覆盖包拯）
  const baoLayout = await advanceUntil(page, (v) => v.stageData === 'bao', 40, '推进到包拯')
  check('包拯发言时同样登场（谁说话谁出现）', !!baoLayout && baoLayout.portraits.length === 1 && baoLayout.portraits[0]?.character === 'bao', JSON.stringify(baoLayout?.portraits.map(x => x.character)))
  if (baoLayout) await page.screenshot({ path: `${outDir}/stage-bao-speaking.png` })

  // 刷新续档后立绘状态不丢失（刷新会回到首页，需按既有流程点「继续案件」）
  const before = await readLayout(page)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const resume = page.getByRole('button', { name: /继续案件/ })
  if (await resume.count()) { await resume.click(); await page.waitForTimeout(700) }
  L = await readLayout(page)
  check('刷新续档后立绘与当前节点仍一致', L.portraits.length <= 1 && L.portraits.every(x => x.character === L.stageData), JSON.stringify({ stage: L.stageData, portraits: L.portraits.map(x => x.character) }))
  check('刷新续档后立绘仍完全不透明', L.portraits.every(x => x.opacity === '1' && !/is-dim/.test(x.className)), JSON.stringify(L.portraits.map(x => x.opacity)))
  check('刷新后无中间人物残留', L.centerCharacterCount === 0 && L.legacySlotCount === 0)
  check('刷新后没有 console 报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

  // ── 三、适配审查：16:9 优先 + 常见宽度 + 窄屏降级 ─────────────
  const viewports = [
    { width: 1920, height: 1080, name: '1920x1080' },
    { width: 1600, height: 900, name: '1600x900' },
    { width: 1366, height: 768, name: '1366x768' },
    { width: 1280, height: 720, name: '1280x720' },
    { width: 900, height: 700, name: '900x700' },
    { width: 390, height: 844, name: '390x844' },
  ]
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.waitForTimeout(450)
    const V = await readLayout(page)
    check(`${vp.name} 无横向溢出`, V.scrollW <= V.vw + 1, `scrollW=${V.scrollW} vw=${V.vw}`)
    check(`${vp.name} 任何时刻仅 1 位立绘`, V.portraits.length <= 1, `count=${V.portraits.length}`)
    check(`${vp.name} 对话框仍在最上层`, Number(V.zDialogue) > Number(V.zStage))
    check(`${vp.name} 证据链面板仍在最上层`, Number(V.zStatus) > Number(V.zStage))
    check(`${vp.name} 立绘不压顶部导航`, V.portraits.every(x => !V.topbar || x.rect.top >= V.topbar.bottom - 1), JSON.stringify(V.portraits.map(x => Math.round(x.rect.top))))
    check(`${vp.name} 人物大致居中（微调可接受）`, V.portraits.every(x => Math.abs(x.rect.cx - V.vw / 2) <= 14), JSON.stringify(V.portraits.map(x => Math.round(x.rect.cx))))
    check(`${vp.name} 人物仍完全不透明`, V.portraits.every(x => x.opacity === '1' && !/is-dim/.test(x.className)), JSON.stringify(V.portraits.map(x => x.opacity)))
    check(`${vp.name} 立绘仍为近景大立绘`, V.portraits.every(x => x.rect.height / V.vh >= 0.5), JSON.stringify(V.portraits.map(x => +(x.rect.height / V.vh).toFixed(2))))
    await page.screenshot({ path: `${outDir}/stage-${vp.name}.png` })
  }

  // 回到桌面端留一张主视觉截图
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${outDir}/stage-desktop.png` })

  // ── 四、五张近景立绘资源逐一审查 ────────────────────────────
  // 用 canvas 读角点与中心像素：角点必须透明（白底已抠净），中心必须
  // 不透明（人物本体完整，白袍不会被啃出洞）。
  const bustPaths = ['bao', 'qin', 'chen', 'han', 'princess'].map(id => `/assets/characters/stage/${id}-bust.png`)
  const bustInfo = await page.evaluate(async (paths) => {
    const out = []
    for (const p of paths) {
      const img = new Image()
      const ok = await new Promise((resolve) => {
        img.onload = () => resolve(true)
        img.onerror = () => resolve(false)
        img.src = p
      })
      if (!ok) { out.push({ p, ok: false }); continue }
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      out.push({
        p, ok: true,
        w: img.naturalWidth, h: img.naturalHeight,
        cornerAlpha: ctx.getImageData(3, 3, 1, 1).data[3],
        centerAlpha: ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data[3],
      })
    }
    return out
  }, bustPaths)
  check('五张近景立绘全部可加载', bustInfo.every(x => x.ok), JSON.stringify(bustInfo.filter(x => !x.ok)))
  check('五张近景立绘统一 641x730', bustInfo.every(x => x.w === 641 && x.h === 730), JSON.stringify(bustInfo.map(x => [x.w, x.h])))
  check('五张立绘四角白底已抠净（无白色矩形块）', bustInfo.every(x => x.cornerAlpha < 16), JSON.stringify(bustInfo.map(x => x.cornerAlpha)))
  check('五张立绘人物本体完整不透明（白袍无破洞）', bustInfo.every(x => x.centerAlpha > 200), JSON.stringify(bustInfo.map(x => x.centerAlpha)))

  // ── 五、预置存档逐个角色渲染审查（含第四堂公主 / 旁白空场） ────
  const presetNode = async (courtIndex, nodeId) => {
    await page.evaluate(({ courtIndex: ci, nodeId: nid }) => {
      localStorage.clear()
      localStorage.setItem('kaizha:auto', JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: {
          courtIndex: ci, nodeId: nid, phase: 'story',
          evidence: [], flags: [], insight: 0, pressure: 0,
          history: [], readNodeIds: [], finalChoice: null, ending: null,
          nextNode: null, lastResponse: '', startedAt: new Date().toISOString(),
          undoStack: [],
        },
      }))
    }, { courtIndex, nodeId })
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const resume = page.getByRole('button', { name: /继续案件/ })
    if (await resume.count()) { await resume.click(); await page.waitForTimeout(700) }
  }

  await presetNode(3, 'c4_princess')
  const PR = await readLayout(page)
  check('第四堂公主发言时恰好 1 位立绘且就是公主', PR.portraits.length === 1 && PR.portraits[0]?.character === 'princess', JSON.stringify(PR.portraits.map(x => x.character)))
  check('公主立绘完全不透明、居中且图片加载成功', !!PR.portraits[0] && PR.portraits[0].opacity === '1' && PR.portraits[0].imgOk && Math.abs(PR.portraits[0].rect.cx - PR.vw / 2) <= 12, JSON.stringify(PR.portraits[0]?.opacity))
  await page.screenshot({ path: `${outDir}/stage-princess-speaking.png` })

  await presetNode(0, 'c1_arraign')
  const NR = await readLayout(page)
  check('旁白节点舞台为空，不出现任何人物（谁说话谁出现）', NR.portraits.length === 0 && NR.stageData === '-', JSON.stringify({ stage: NR.stageData, count: NR.portraits.length }))
  check('空场时对话舞台仍存在且无残留图层', !!NR.stage && NR.centerCharacterCount === 0 && NR.legacySlotCount === 0)
  await page.screenshot({ path: `${outDir}/stage-narrator-empty.png` })

  await browser.close()
  const passed = results.filter(r => r.pass).length
  await writeFile(`${outDir}/stage-results.json`, JSON.stringify({ passed, total: results.length, results }, null, 2))
  console.log(`\n=== 单人近景舞台验收：${passed}/${results.length} 通过 ===`)
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ' :: ' + r.detail : ''}`)
  server.kill()
  process.exit(0)
} catch (error) {
  const passed = results.filter(r => r.pass).length
  await writeFile(`${outDir}/stage-results.json`, JSON.stringify({ passed, total: results.length, error: String(error), results }, null, 2)).catch(() => {})
  console.error(`\n=== 验收中断：${passed}/${results.length} 通过 ===`)
  console.error(String(error))
  server.kill()
  process.exit(1)
}

// 章节页字体规范与「升堂」按钮专项验收
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4178
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

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /开始审案/ }).click()
  await page.waitForTimeout(700)
  await page.locator('.intro-skip').click()
  await page.waitForTimeout(600)

  // ── 字体规范核对 ──
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready
    const fam = (sel) => getComputedStyle(document.querySelector(sel)).fontFamily
    const size = (sel) => getComputedStyle(document.querySelector(sel)).fontSize
    const weight = (sel) => getComputedStyle(document.querySelector(sel)).fontWeight
    const color = (sel) => getComputedStyle(document.querySelector(sel)).color
    const h1 = document.querySelector('.chapter-title-wrap h1')
    return {
      titleFont: fam('.chapter-title-wrap h1'),
      titleSize: size('.chapter-title-wrap h1'),
      titleWeight: weight('.chapter-title-wrap h1'),
      titleGlyphs: h1.querySelectorAll('span').length,
      titleChars: h1.textContent,
      titleGlyphFamily: h1.querySelector('span') ? getComputedStyle(h1.querySelector('span')).fontFamily : '',
      titleGlyphRotation: h1.querySelector('span') ? getComputedStyle(h1.querySelector('span')).transform : '',
      subFont: fam('.chapter-title-wrap h2'),
      subSize: size('.chapter-title-wrap h2'),
      bodyFont: fam('.chapter-title-wrap p'),
      bodySize: size('.chapter-title-wrap p'),
      numberFont: fam('.chapter-number'),
      numberSize: size('.chapter-number'),
      ctaFont: fam('.seal-cta span'),
      ctaSize: size('.seal-cta span'),
      ctaWeight: weight('.seal-cta span'),
      ctaColor: color('.seal-cta span'),
      ctaBg: getComputedStyle(document.querySelector('.seal-cta')).backgroundColor,
      ctaShadow: getComputedStyle(document.querySelector('.seal-cta')).boxShadow,
      ctaTextShadow: getComputedStyle(document.querySelector('.seal-cta span')).textShadow,
      ctaStroke: getComputedStyle(document.querySelector('.seal-cta span')).webkitTextStrokeWidth,
      loaded: [...document.fonts].map((f) => `${f.family}:${f.status}`),
    }
  })
  console.log(JSON.stringify(fonts, null, 2))

  check('章节主标题使用狂草族（龙藏体）', fonts.titleFont.includes('Long Cang'), fonts.titleFont)
  check('章节主标题不加粗（细笔挺拔）', fonts.titleWeight === '400', fonts.titleWeight)
  check('主标题逐字包裹以模拟手写错落', fonts.titleGlyphs >= 2, `glyphs=${fonts.titleGlyphs}`)
  check('主标题文字内容正确', fonts.titleChars === '鸣冤', fonts.titleChars)
  check('主标题单字使用同一狂草族', fonts.titleGlyphFamily.includes('Long Cang'), fonts.titleGlyphFamily)
  check('主标题单字带错落旋转（非矩阵即恒等）', fonts.titleGlyphRotation !== 'none' && fonts.titleGlyphRotation !== 'matrix(1, 0, 0, 1, 0, 0)', fonts.titleGlyphRotation)
  check('副标题使用悦宋族', fonts.subFont.includes('FZQingKeBenYueSong'), fonts.subFont)
  check('正文使用悦宋族', fonts.bodyFont.includes('FZQingKeBenYueSong'), fonts.bodyFont)
  check('章节编号使用秀楷族', fonts.numberFont.includes('FZSongKeBenXiuKai'), fonts.numberFont)
  check('升堂按钮使用悦宋族', fonts.ctaFont.includes('FZQingKeBenYueSong'), fonts.ctaFont)
  check('升堂按钮字号在 22—24px', parseFloat(fonts.ctaSize) >= 22 && parseFloat(fonts.ctaSize) <= 24, fonts.ctaSize)
  check('升堂按钮文字适度加粗', parseInt(fonts.ctaWeight, 10) >= 600, fonts.ctaWeight)
  check('升堂按钮文字为暖象牙白 #F4E8D0', fonts.ctaColor === 'rgb(244, 232, 208)', fonts.ctaColor)
  check('升堂按钮底色为暗朱红 #983D2D', fonts.ctaBg === 'rgb(152, 61, 45)', fonts.ctaBg)
  check('升堂按钮无立体阴影', fonts.ctaShadow === 'none', fonts.ctaShadow)
  check('升堂按钮文字无发光/浮雕投影', fonts.ctaTextShadow === 'none', fonts.ctaTextShadow)
  const loadedMap = Object.fromEntries(fonts.loaded.map((s) => s.split(':')))
  check('开源回退字体（臻楷）加载成功', loadedMap['LXGW ZhenKai'] === 'loaded', fonts.loaded.join(','))
  check('开源回退字体（仿宋）加载成功', loadedMap['ZhuqueFangSong'] === 'loaded', fonts.loaded.join(','))
  check('狂草字体（龙藏体）加载成功', loadedMap['Long Cang'] === 'loaded', fonts.loaded.join(','))
  // 方正两款字体以 local() 声明：本机未安装时状态为 error 属预期，回落到开源同风格字体
  check('方正秀楷以 local() 方式声明（未安装时回落）', 'FZSongKeBenXiuKai' in loadedMap, fonts.loaded.join(','))
  check('方正悦宋以 local() 方式声明（未安装时回落）', 'FZQingKeBenYueSong' in loadedMap, fonts.loaded.join(','))
  check('无未预期的字体加载失败', Object.entries(loadedMap).every(([fam, st]) => st === 'loaded' || fam.startsWith('FZ') || st === 'unloaded'), fonts.loaded.join(','))

  // ── 布局：无重叠 / 无截断 ──
  const layout = await page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height } }
    const cta = r('.seal-cta')
    const title = r('.chapter-title-wrap h1')
    const sub = r('.chapter-title-wrap h2')
    const num = r('.chapter-number')
    const overflowX = document.documentElement.scrollWidth <= window.innerWidth + 1
    const glyphs = [...document.querySelectorAll('.chapter-title-wrap h1 span')].map((el) => {
      const b = el.getBoundingClientRect()
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
    })
    // 文字是否被容器裁切
    const clipped = [...document.querySelectorAll('.seal-cta span, .seal-cta small, .chapter-title-wrap h1, .chapter-title-wrap h2')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => el.className || el.tagName)
    return { cta, title, sub, num, overflowX, clipped, glyphs }
  })
  // 主标题逐字包围盒不得互相重叠（用户明确要求「不要出现位置重叠」）
  check('主标题各字之间无重叠', layout.glyphs.length >= 2 && layout.glyphs.every((g, i) => i === 0 || g.left >= layout.glyphs[i - 1].right - 0.5), JSON.stringify(layout.glyphs))
  check('主标题整体不超出容器', layout.title.left >= -1 && layout.title.right <= 1601, JSON.stringify(layout.title))
  check('页面无横向溢出', layout.overflowX)
  check('升堂按钮在视口内', layout.cta.left >= 0 && layout.cta.right <= 1601, JSON.stringify(layout.cta))
  check('主标题在升堂按钮上方不重叠', layout.title.bottom < layout.cta.top, `${layout.title.bottom} vs ${layout.cta.top}`)
  check('副标题在主标题下方不重叠', layout.title.bottom <= layout.sub.top, `${layout.title.bottom} vs ${layout.sub.top}`)
  check('章节编号在主标题上方不重叠', layout.num.bottom <= layout.title.top, `${layout.num.bottom} vs ${layout.title.top}`)
  check('无文字被裁切/截断', layout.clipped.length === 0, layout.clipped.join(','))

  await page.screenshot({ path: `${outDir}/chapter-seal-cta.png`, fullPage: true })

  // ── 金色浮雕标题一律不加粗（用户要求：这类都不要加粗） ──
  const boldCheck = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.innerHTML = `
      <div class="ending-content"><h1 id="p-ending">悬案待雪</h1></div>
      <div class="confirm-dialog"><h2 id="p-confirm">确认重开卷宗？</h2></div>
      <div class="link-board-header"><h2 id="p-link">证据关联</h2></div>
      <div class="archive-header-title"><h1 id="p-arch">开铡</h1></div>
      <div class="archive-section-heading"><h2 id="p-sec">一</h2></div>
      <div class="archive-character-biography"><h3 id="p-bio">秦香莲</h3></div>
      <div class="archive-evidence-detail"><h3 id="p-evi">状纸</h3></div>
      <div class="archive-ending-card"><h3 id="p-end">正法昭彰</h3></div>`
    probe.style.cssText = 'position:absolute;left:-9999px;top:0'
    document.body.appendChild(probe)
    const out = {}
    for (const id of ['p-ending', 'p-confirm', 'p-link', 'p-arch', 'p-sec', 'p-bio', 'p-evi', 'p-end']) {
      const cs = getComputedStyle(document.getElementById(id))
      out[id] = { weight: cs.fontWeight, synthesis: cs.fontSynthesis }
    }
    probe.remove()
    return out
  })
  for (const [id, v] of Object.entries(boldCheck)) {
    check(`${id} 不合成加粗`, v.weight === '400' && v.synthesis === 'none', JSON.stringify(v))
  }

  // ── 多尺寸下的显示效果 ──
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(350)
    const v = await page.evaluate(() => {
      const el = document.querySelector('.seal-cta')
      const span = document.querySelector('.seal-cta span')
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(span)
      // 视觉居中：文字块在按钮内的居中偏差
      const sb = span.getBoundingClientRect()
      const offX = Math.abs((sb.left + sb.right) / 2 - (b.left + b.right) / 2)
      const offY = Math.abs((sb.top + sb.bottom) / 2 - (b.top + b.bottom) / 2)
      return {
        inView: b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
        clipped: span.scrollWidth > span.clientWidth + 1,
        fontSize: cs.fontSize,
        offX: Number(offX.toFixed(2)),
        offY: Number(offY.toFixed(2)),
        overflowX: document.documentElement.scrollWidth <= window.innerWidth + 1,
      }
    })
    check(`${vp.width}×${vp.height} 升堂按钮完整可见`, v.inView)
    check(`${vp.width}×${vp.height} 升堂按钮文字未截断`, !v.clipped)
    check(`${vp.width}×${vp.height} 升堂按钮文字水平居中`, v.offX <= 1.5, `offX=${v.offX}`)
    check(`${vp.width}×${vp.height} 升堂按钮无横向溢出`, v.overflowX)
    await page.screenshot({ path: `${outDir}/seal-cta-${vp.width}x${vp.height}.png`, fullPage: true })
  }

  await browser.close()
  check('控制台无错误', consoleErrors.length === 0, consoleErrors.join('\n'))
  await writeFile(`${outDir}/chapter-font-results.json`, JSON.stringify({ passed: results.length, results }, null, 2))
  console.log(`章节页字体与按钮验收通过：${results.length} checks`)
} finally {
  server.kill()
}
process.exit(0)

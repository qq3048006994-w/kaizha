// 验证人物档案白底大图：规格统一、图片自身无空白尾部、渲染层无空白区
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4192
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
})

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(baseUrl); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('server not ready')
}

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  // 预置一份第三堂存档，让韩琪 / 公主档案解封，五个人物都能逐个验到
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('kaizha:auto', JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        courtIndex: 2,
        nodeId: 'c3_enter',
        phase: 'story',
        evidence: [], flags: [], insight: 0, pressure: 0,
        history: [], readNodeIds: [], finalChoice: null, ending: null,
        nextNode: null, lastResponse: '', startedAt: new Date().toISOString(),
        undoStack: [],
      },
    }))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /继续案件/ }).click()
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.game-tools button')]
    btns.find((b) => /人物/.test(b.textContent))?.click()
  })
  await page.waitForTimeout(700)

  const info = await page.evaluate(() => {
    const art = document.querySelector('.archive-character-art img')
    const tabs = [...document.querySelectorAll('.archive-character-tab img')]
    const bg = getComputedStyle(document.querySelector('.archive-character-art')).backgroundColor
    const imgs = [art, ...tabs]
    return Promise.all(imgs.map((i) => new Promise((res) => {
      if (!i) return res(null)
      if (i.complete) return res({ src: i.src.split('/').pop(), ok: i.naturalWidth > 0, w: i.naturalWidth })
      i.onload = () => res({ src: i.src.split('/').pop(), ok: i.naturalWidth > 0, w: i.naturalWidth })
      i.onerror = () => res({ src: i.src.split('/').pop(), ok: false })
    }))).then((r) => ({ bg, images: r }))
  })
  console.log(JSON.stringify(info, null, 2))

  // 一、图片规格：641x790，人物内容一直到底部（不允许再留纯白尾部）
  const specs = await page.evaluate(async () => {
    const names = ['baozheng', 'qinxianglian', 'chenshimei', 'hanqi', 'princess']
    const out = []
    for (const n of names) {
      const im = new Image()
      im.src = `/assets/characters/${n}-white-full.jpg`
      await im.decode()
      const c = document.createElement('canvas')
      c.width = im.naturalWidth
      c.height = im.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(im, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let lastNonWhite = -1
      let minX = Infinity, maxX = -Infinity
      for (let y = 0; y < c.height; y += 1) {
        for (let x = 0; x < c.width; x += 1) {
          const i = (y * c.width + x) * 4
          const r = d[i], g = d[i + 1], b = d[i + 2]
          if (r < 245 || g < 245 || b < 245) lastNonWhite = y
          const face = r > 90 && g > 45 && b > 25 && r > g + 12 && g > b + 5 && r - b > 35
          if (face && y >= 150 && y <= 350) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
          }
        }
      }
      out.push({
        n,
        w: im.naturalWidth,
        h: im.naturalHeight,
        blankTail: c.height - 1 - lastNonWhite,
        headCenter: (minX + maxX) / 2,
      })
    }
    return out
  })

  // 二、渲染几何：cover 铺满、无 letterbox、面板不再被撑出巨大空白
  const dom = await page.evaluate(() => {
    const art = document.querySelector('.archive-character-art')
    const img = art.querySelector('img')
    const sheet = document.querySelector('.archive-character-sheet')
    const cs = getComputedStyle(img)
    const ar = art.getBoundingClientRect()
    const ir = img.getBoundingClientRect()
    const sr = sheet.getBoundingClientRect()
    return {
      objectFit: cs.objectFit,
      objectPosition: cs.objectPosition,
      naturalW: img.naturalWidth, naturalH: img.naturalHeight,
      artW: ar.width, artH: ar.height,
      imgH: ir.height,
      sheetH: sr.height,
    }
  })
  console.log('\n渲染几何:', JSON.stringify(dom))

  const failures = []
  for (const s of specs) {
    if (s.w !== 641 || s.h !== 790) failures.push(`${s.n}: 尺寸 ${s.w}x${s.h} != 641x790`)
    if (s.blankTail > 10) failures.push(`${s.n}: 底部仍有 ${s.blankTail}px 纯白空白尾`)
    if (Math.abs(s.headCenter - 320.5) > 40) failures.push(`${s.n}: 头部中心 ${s.headCenter.toFixed(1)} 偏离画布中心`)
  }
  if (info.bg !== 'rgb(255, 255, 255)') failures.push(`容器底色 ${info.bg} != 纯白`)
  if (!info.images[0]?.src?.endsWith('-white-full.jpg') || !info.images[0]?.ok) failures.push('大图未使用白底全身图或加载失败')
  if (info.images.slice(1).some((i) => i?.src?.includes('white-full'))) failures.push('左侧栏被误换成白底图')

  if (dom.objectFit !== 'cover') failures.push(`大图 object-fit=${dom.objectFit}，应为 cover（否则会露出 letterbox 空白）`)
  if (!/0%\s*0%|50%\s*0%|top/.test(dom.objectPosition)) failures.push(`大图 object-position=${dom.objectPosition}，应顶部对齐`)
  if (dom.naturalH !== 790 || dom.naturalW !== 641) failures.push(`大图固有尺寸 ${dom.naturalW}x${dom.naturalH} 不是 641x790（旧版 1600 高会撑出空白）`)
  // 旧版 641x1600 会把面板撑到「宽 x 2.496」；现版高宽比最多约 1.5，用比例判据跨视口通用
  if (dom.artH / dom.artW > 1.8) failures.push(`白底容器高宽比 ${(dom.artH / dom.artW).toFixed(2)} 异常，疑似旧版白尾撑高`)
  if (dom.artH < 300) failures.push(`白底容器高 ${dom.artH.toFixed(0)}px，被压塌`)
  if (Math.abs(dom.artH - dom.imgH) > 2) failures.push(`图片(${dom.imgH.toFixed(0)})与容器(${dom.artH.toFixed(0)})不等高，存在 letterbox`)

  console.log('\n规格校验:')
  for (const s of specs) console.log(`  ${s.n}: ${s.w}x${s.h} blankTail=${s.blankTail} headCenter=${s.headCenter.toFixed(1)}`)

  // 三、五个人物逐个点开：逐一确认几何 + 截图
  const ids = ['bao', 'qin', 'chen', 'han', 'princess']
  const names = ['baozheng', 'qinxianglian', 'chenshimei', 'hanqi', 'princess']
  for (let i = 0; i < ids.length; i += 1) {
    await page.evaluate((idx) => {
      const tabs = [...document.querySelectorAll('.archive-character-tab')]
      if (tabs[idx] && !tabs[idx].disabled) tabs[idx].click()
    }, i)
    await page.waitForTimeout(450)
    const one = await page.evaluate(() => {
      const art = document.querySelector('.archive-character-art')
      const img = art.querySelector('img')
      const r = art.getBoundingClientRect()
      return { w: r.width, h: r.height, imgH: img.getBoundingClientRect().height, ok: img.complete && img.naturalWidth > 0, src: img.src.split('/').pop() }
    })
    if (!one.ok) failures.push(`${ids[i]}: 大图加载失败`)
    if (one.src !== `${names[i]}-white-full.jpg`) failures.push(`${ids[i]}: 未切到本人白底图，当前 ${one.src}`)
    if (one.h / one.w > 1.8 || one.h < 300) failures.push(`${ids[i]}: 白底容器 ${one.w.toFixed(0)}x${one.h.toFixed(0)} 高宽比异常`)
    if (Math.abs(one.h - one.imgH) > 2) failures.push(`${ids[i]}: 图片与容器不等高，仍有空白`)
    console.log(`  ${ids[i]}: artH=${one.h.toFixed(0)} src=${one.src}`)
    await page.screenshot({ path: `${outDir}/archive-white-${names[i]}.png` })
  }

  // 四、多视口审查：canvas 精确模拟 object-fit:cover / center top，
  //    取渲染后底部 18% 区域，确认不是一片纯白空白（即人物确实铺到底）。
  const viewports = [
    { w: 1920, h: 1080 },
    { w: 1600, h: 900 },
    { w: 1366, h: 768 },
    { w: 1280, h: 800 },
    { w: 900, h: 800 },
    { w: 390, h: 844 },
  ]
  // 切到帽翅最宽的包拯，检查窄视口下横向裁切是否伤到人物
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.archive-character-tab')]
    if (tabs[0] && !tabs[0].disabled) tabs[0].click()
  })
  await page.waitForTimeout(400)
  console.log('\n多视口底部空白审查:')
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${outDir}/archive-white-viewport-${vp.w}.png` })
    const band = await page.evaluate(() => {
      const art = document.querySelector('.archive-character-art')
      const img = art.querySelector('img')
      const W = art.clientWidth, H = art.clientHeight
      const cs = getComputedStyle(img)
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      const nw = img.naturalWidth, nh = img.naturalHeight
      const scale = Math.max(W / nw, H / nh) // cover
      const dw = nw * scale, dh = nh * scale
      const dx = (W - dw) / 2
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)
      ctx.drawImage(img, dx, 0, dw, dh)      // center top
      const y0 = Math.floor(H * 0.82)
      const d = ctx.getImageData(0, y0, W, H - y0).data
      let nonWhite = 0, total = 0
      for (let i = 0; i < d.length; i += 4) {
        total += 1
        if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) nonWhite += 1
      }
      const ar = art.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      return {
        W, H, artH: ar.height, imgH: ir.height, objectFit: cs.objectFit,
        bottomNonWhiteRatio: nonWhite / total,
      }
    })
    const ratio = band.bottomNonWhiteRatio
    console.log(`  ${vp.w}x${vp.h}: art=${band.W.toFixed(0)}x${band.H.toFixed(0)} imgH=${band.imgH.toFixed(0)} fit=${band.objectFit} 底部非白占比=${ratio.toFixed(3)}`)
    if (band.objectFit !== 'cover') failures.push(`${vp.w}x${vp.h}: object-fit 不是 cover`)
    if (Math.abs(band.artH - band.imgH) > 2) failures.push(`${vp.w}x${vp.h}: 图片与容器不等高，存在 letterbox 空白`)
    if (ratio < 0.02) failures.push(`${vp.w}x${vp.h}: 底部 18% 几乎纯白(${ratio.toFixed(3)})，仍露出空白`)
  }
  await page.setViewportSize({ width: 1600, height: 900 })

  if (failures.length) {
    console.error('FAIL:\n  ' + failures.join('\n  '))
    process.exitCode = 1
  } else {
    console.log('PASS: 五张白底图 641x790 无空白尾、cover 铺满、五人档案均无下方空白')
  }
  await browser.close()
} finally {
  server.kill()
}
process.exit(process.exitCode || 0)

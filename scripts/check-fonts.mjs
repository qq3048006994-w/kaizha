// 字体与版式验收：确认三款字体真实加载、标题族/正文族正确应用、主副标题比例达标。
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseUrl = process.env.KAIZHA_URL || 'http://127.0.0.1:5180'
const outDir = fileURLToPath(new URL('../test-artifacts', import.meta.url))
await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
page.on('dialog', (dialog) => dialog.accept())
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
const report = {}

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
report.fonts = await page.evaluate(async () => {
  await document.fonts.ready
  return {
    title: document.fonts.check('400 40px "LXGW ZhenKai"', '鸣冤'),
    kai: document.fonts.check('400 20px "LXGW ZhenKai"', '开铡'),
    song: document.fonts.check('400 20px "ZhuqueFangSong"', '公堂之上'),
    loaded: [...document.fonts].map((font) => `${font.family}:${font.status}`),
  }
})
await page.screenshot({ path: `${outDir}/font-home.png`, fullPage: true })

await page.getByRole('button', { name: /开始审案/ }).click()
await page.waitForTimeout(700)
await page.locator('.intro-skip').click()
await page.waitForTimeout(600)
report.chapter = await page.evaluate(() => {
  const h1 = document.querySelector('.chapter-title-wrap h1')
  const h2 = document.querySelector('.chapter-title-wrap h2')
  const s1 = parseFloat(getComputedStyle(h1).fontSize)
  const s2 = parseFloat(getComputedStyle(h2).fontSize)
  return {
    titleFont: getComputedStyle(h1).fontFamily,
    titleSize: s1,
    subFont: getComputedStyle(h2).fontFamily,
    subSize: s2,
    ratio: Number((s2 / s1).toFixed(2)),
  }
})
await page.screenshot({ path: `${outDir}/font-chapter.png`, fullPage: true })

await page.getByRole('button', { name: /升 堂/ }).click()
await page.waitForTimeout(900)
report.court = await page.evaluate(() => ({
  dialogueFont: getComputedStyle(document.querySelector('.dialogue-text')).fontFamily,
  dialogueSize: getComputedStyle(document.querySelector('.dialogue-text')).fontSize,
  nameplateFont: getComputedStyle(document.querySelector('.dialogue-nameplate span')).fontFamily,
}))
await page.screenshot({ path: `${outDir}/font-court.png`, fullPage: true })

await page.getByRole('button', { name: /人物/ }).click()
await page.waitForTimeout(700)
report.archive = await page.evaluate(() => ({
  headingFont: getComputedStyle(document.querySelector('.archive-header-title h1')).fontFamily,
  headingSize: getComputedStyle(document.querySelector('.archive-header-title h1')).fontSize,
  bioFont: getComputedStyle(document.querySelector('.archive-character-biography h3')).fontFamily,
}))
await page.screenshot({ path: `${outDir}/font-archive.png`, fullPage: true })

console.log(JSON.stringify(report, null, 2))
await browser.close()

import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' })
const page = await browser.newPage()
await page.goto(process.env.KAIZHA_URL || 'http://127.0.0.1:5180', { waitUntil: 'networkidle' })
const result = await page.evaluate(async () => {
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 120
  const ctx = canvas.getContext('2d')
  const signature = (family) => {
    ctx.clearRect(0, 0, 400, 120)
    ctx.fillStyle = '#000'
    ctx.font = `80px ${family}`
    ctx.fillText('包拯鸣冤', 10, 90)
    const data = ctx.getImageData(0, 0, 400, 120).data
    let hash = 0
    let ink = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 40) { ink += 1; hash = (hash * 31 + i) >>> 0 }
    }
    return { ink, hash }
  }
  return {
    title: signature('"LXGW ZhenKai"'),
    song: signature('"ZhuqueFangSong"'),
    generic: signature('sans-serif'),
  }
})
console.log(JSON.stringify(result, null, 2))
const t = result.title.hash, s = result.song.hash, g = result.generic.hash
console.log('title !== sans-serif :', t !== g)
console.log('song  !== sans-serif :', s !== g)
console.log('title !== song       :', t !== s)
await browser.close()

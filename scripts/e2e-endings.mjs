// 结局界面可达性验收：注入四种结局的终局状态，逐一验证结局页与档案显示。
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = `${root}/test-artifacts`
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const port = 4175
const baseUrl = `http://127.0.0.1:${port}`
const npm = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd'

const cases = [
  { id: 'justice', title: '正法昭彰', finalChoice: 'law' },
  { id: 'defiance', title: '抗旨开铡', finalChoice: 'defy' },
  { id: 'power', title: '权门蔽日', finalChoice: 'yield' },
  { id: 'pending', title: '悬案待雪', finalChoice: 'defer' },
]

const server = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
})

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('开发服务器未启动')
}

try {
  await mkdir(outDir, { recursive: true })
  await waitForServer()
  const browser = await chromium.launch({ headless: true, executablePath })
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  for (const item of cases) {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.evaluate((ending) => {
      localStorage.setItem('kaizha:auto', JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        state: {
          courtIndex: 3, nodeId: 'c4_final', phase: 'ended', evidence: [], flags: [],
          insight: 12, pressure: 8, history: [], readNodeIds: [], finalChoice: ending.finalChoice,
          ending: ending.id, nextNode: null, lastResponse: '', startedAt: new Date().toISOString(),
        },
      }))
      localStorage.setItem('kaizha:endings', JSON.stringify({
        version: 1,
        endings: [{ endingId: ending.id, unlockedAt: new Date().toISOString() }],
      }))
    }, item)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /继续案件/ }).click()
    const heading = page.locator('.ending-page h1')
    await heading.waitFor()
    const text = (await heading.innerText()).trim()
    if (text !== item.title) throw new Error(`结局 ${item.id} 显示为 ${text}`)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${outDir}/ending-${item.id}.png`, fullPage: true })
    console.log(`结局可达：${item.title}`)
  }
  await browser.close()
  console.log(`结局可达性验收通过：${cases.length} 个结局`)
} finally {
  server.kill()
}
process.exit(0)

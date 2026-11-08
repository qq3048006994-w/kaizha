// 以开发模式启动桌面版：自动拉起 vite 并打开 Electron 窗口。
const { spawn } = require('node:child_process')
const path = require('node:path')

const root = path.join(__dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const vite = spawn(npm, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

const electron = spawn(npm, ['exec', '--', 'electron', '.'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, KAIZHA_DEV: '1' },
})

const shutdown = () => {
  vite.kill()
  electron.kill()
}
process.on('exit', shutdown)
process.on('SIGINT', () => { shutdown(); process.exit(0) })
vite.on('exit', shutdown)
electron.on('exit', shutdown)

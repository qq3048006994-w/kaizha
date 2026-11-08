// Test-only adapter for legacy Windows paths. No application code is changed.
import { existsSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import childProcess from 'node:child_process'
import { chromium } from 'playwright'

const executablePath = process.env.KAIZHA_BROWSER ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined)
const launch = chromium.launch.bind(chromium)
chromium.launch = (options = {}) => {
  const configured = executablePath ||
    (options.executablePath && existsSync(options.executablePath) ? options.executablePath : undefined)
  return launch({ ...options, executablePath: configured })
}

const spawn = childProcess.spawn
childProcess.spawn = function (command, args, options) {
  if (command === 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2-6/npm.cmd') {
    // Existing suites invoke only `npm run dev -- <vite arguments>`.
    if (args?.slice(0, 3).join(' ') !== 'run dev --') throw new Error('Unexpected legacy npm command')
    return spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), ...args.slice(3)],
      { ...options, shell: false })
  }
  return spawn(command, args, options)
}
syncBuiltinESMExports()

const { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } = require('node:fs')
const { homedir } = require('node:os')
const { join, resolve } = require('node:path')
const { spawn } = require('node:child_process')

function buildConfig(cwd, env) {
  const host = env.MOCKUP_HOST || '127.0.0.1'
  const urlHost = env.MOCKUP_URL_HOST || 'localhost'
  const port = env.MOCKUP_PORT || '63136'
  const session = env.MOCKUP_SESSION || 'mockup'
  const screenDir = resolve(cwd, '.superpowers', 'brainstorm', session)
  const serverScript =
    env.MOCKUP_SERVER_SCRIPT ||
    join(
      homedir(),
      '.codex',
      'superpowers',
      'skills',
      'brainstorming',
      'scripts',
      'server.cjs',
    )

  return {
    host,
    port,
    screenDir,
    serverScript,
    url: `http://${urlHost}:${port}`,
    urlHost,
  }
}

function collectHtmlFiles(rootDir, ignoreDir) {
  if (!existsSync(rootDir)) {
    return []
  }

  const results = []

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = join(rootDir, entry.name)

    if (ignoreDir && resolve(entryPath) === resolve(ignoreDir)) {
      continue
    }

    if (entry.isDirectory()) {
      results.push(...collectHtmlFiles(entryPath, ignoreDir))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(entryPath)
    }
  }

  return results
}

function seedMockupScreenDir(cwd, screenDir) {
  mkdirSync(screenDir, { recursive: true })

  const existingHtml = collectHtmlFiles(screenDir)
  if (existingHtml.length > 0) {
    return null
  }

  const brainstormRoot = resolve(cwd, '.superpowers', 'brainstorm')
  const latestHtml = collectHtmlFiles(brainstormRoot, screenDir)
    .map((file) => ({ file, mtimeMs: statSync(file).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]

  if (!latestHtml) {
    return null
  }

  const destination = join(screenDir, 'current.html')
  copyFileSync(latestHtml.file, destination)
  return destination
}

function run() {
  const config = buildConfig(process.cwd(), process.env)

  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(config)}\n`)
    return
  }

  if (!existsSync(config.serverScript)) {
    throw new Error(`Mockup server script not found: ${config.serverScript}`)
  }

  const seededFile = seedMockupScreenDir(process.cwd(), config.screenDir)

  process.stdout.write(`Mockup viewer on ${config.url}\n`)
  process.stdout.write(`Screen dir: ${config.screenDir}\n`)
  if (seededFile) {
    process.stdout.write(`Seeded from: ${seededFile}\n`)
  }

  const child = spawn(process.execPath, [config.serverScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BRAINSTORM_DIR: config.screenDir,
      BRAINSTORM_HOST: config.host,
      BRAINSTORM_URL_HOST: config.urlHost,
      BRAINSTORM_PORT: config.port,
    },
    stdio: 'inherit',
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })
}

if (require.main === module) {
  run()
}

module.exports = {
  buildConfig,
  collectHtmlFiles,
  seedMockupScreenDir,
}

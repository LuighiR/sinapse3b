import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

describe('mockup server launcher', () => {
  const scriptPath = resolve(process.cwd(), 'scripts/mockup-server.cjs')

  test('prints the default mockup server configuration', () => {
    const stdout = execFileSync(process.execPath, [scriptPath, '--dry-run'], {
      cwd: process.cwd(),
      env: process.env,
      encoding: 'utf8',
    })

    const config = JSON.parse(stdout) as {
      host: string
      port: string
      screenDir: string
      url: string
    }

    expect(config.host).toBe('127.0.0.1')
    expect(config.port).toBe('63136')
    expect(config.url).toBe('http://localhost:63136')
    expect(config.screenDir).toBe(
      resolve(process.cwd(), '.superpowers/brainstorm/mockup'),
    )
  })

  test('allows overriding the port and session name via environment variables', () => {
    const stdout = execFileSync(process.execPath, [scriptPath, '--dry-run'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MOCKUP_PORT: '64001',
        MOCKUP_SESSION: 'custom-preview',
      },
      encoding: 'utf8',
    })

    const config = JSON.parse(stdout) as {
      port: string
      screenDir: string
      url: string
    }

    expect(config.port).toBe('64001')
    expect(config.url).toBe('http://localhost:64001')
    expect(config.screenDir).toBe(
      resolve(process.cwd(), '.superpowers/brainstorm/custom-preview'),
    )
  })
})

import { existsSync } from 'node:fs'

describe('frontend bootstrap', () => {
  it('creates the Next.js app entrypoints', () => {
    expect(existsSync('frontend/package.json')).toBe(true)
    expect(existsSync('frontend/src/app/layout.tsx')).toBe(true)
    expect(existsSync('frontend/src/app/page.tsx')).toBe(true)
  })
})

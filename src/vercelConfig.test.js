import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const config = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
)

test('Vercel serves the SPA entry point for existing protected route prefixes', () => {
  const rewrites = new Map(config.rewrites.map(({ source, destination }) => [source, destination]))

  for (const source of ['/admin', '/admin/:path*', '/employee', '/employee/:path*']) {
    assert.equal(rewrites.get(source), '/index.html')
  }
  assert.equal(rewrites.get('/forgot-password'), '/index.html')
  assert.equal(rewrites.get('/reset-password'), '/index.html')
})

test('Vercel proxies API paths through the app origin to the production backend', () => {
  const apiRewrite = config.rewrites.find(({ source }) => source === '/api/:path*')

  assert.deepEqual(apiRewrite, {
    source: '/api/:path*',
    destination: 'https://suredocs-backned.vercel.app/api/:path*',
  })
  assert.notEqual(apiRewrite.destination, '/index.html')
})

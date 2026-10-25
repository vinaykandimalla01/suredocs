import assert from 'node:assert/strict'
import test from 'node:test'

import { getApiBaseUrl, resolveApiUrl } from './apiUrl.js'

test('uses the configured production API origin', () => {
  const baseUrl = getApiBaseUrl({
    PROD: true,
    VITE_API_BASE_URL: 'https://suredocs-backned.vercel.app',
  })

  assert.equal(
    resolveApiUrl(baseUrl, '/api/auth/login'),
    'https://suredocs-backned.vercel.app/api/auth/login',
  )
})

test('defaults to the SureDocs backend origin for production builds', () => {
  assert.equal(
    resolveApiUrl(getApiBaseUrl({ PROD: true }), '/api/auth/health'),
    'https://suredocs-backned.vercel.app/api/auth/health',
  )
})

test('uses a relative API path in local development for the Vite proxy', () => {
  assert.equal(getApiBaseUrl({ PROD: false }), '')
  assert.equal(resolveApiUrl('', '/api/auth/login'), '/api/auth/login')
})

test('normalizes trailing slashes and a mistaken API suffix in the base URL', () => {
  assert.equal(
    resolveApiUrl('https://suredocs-backned.vercel.app/api///', '/api/auth/login'),
    'https://suredocs-backned.vercel.app/api/auth/login',
  )
})

test('normalizes endpoint slashes and duplicate API prefixes', () => {
  assert.equal(
    resolveApiUrl('https://suredocs-backned.vercel.app/', '//api//api//auth/login'),
    'https://suredocs-backned.vercel.app/api/auth/login',
  )
})

test('rejects an empty endpoint path', () => {
  assert.throws(() => resolveApiUrl('', '  '), {
    name: 'TypeError',
    message: 'API endpoint path must be a non-empty string.',
  })
})

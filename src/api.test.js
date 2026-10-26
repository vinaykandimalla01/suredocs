import assert from 'node:assert/strict'
import test from 'node:test'

import { apiGet, apiPut } from './api.js'

async function withApiResponse(status, callback) {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const eventTarget = new EventTarget()
  globalThis.window = eventTarget
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, 'include')
    return new Response(JSON.stringify({ detail: 'Request rejected' }), {
      headers: { 'content-type': 'application/json' },
      status,
    })
  }
  try {
    return await callback(eventTarget)
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
}

test('401 API responses preserve status and notify the app to end the session once', async () => {
  await withApiResponse(401, async (eventTarget) => {
    let unauthorizedEvents = 0
    eventTarget.addEventListener('suredocs:unauthorized', () => { unauthorizedEvents += 1 })

    await assert.rejects(apiGet('/api/private'), (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.message, 'Request rejected')
      return true
    })
    assert.equal(unauthorizedEvents, 1)
  })
})

test('403 API responses preserve status without treating authorization as session expiry', async () => {
  await withApiResponse(403, async (eventTarget) => {
    let unauthorizedEvents = 0
    eventTarget.addEventListener('suredocs:unauthorized', () => { unauthorizedEvents += 1 })

    await assert.rejects(apiPut('/api/admin/resource', {}), (error) => {
      assert.equal(error.status, 403)
      assert.equal(error.message, 'Request rejected')
      return true
    })
    assert.equal(unauthorizedEvents, 0)
  })
})

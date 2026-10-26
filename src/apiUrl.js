export function getApiBaseUrl(env = {}) {
  const configuredBaseUrl = typeof env.VITE_API_BASE_URL === 'string'
    ? env.VITE_API_BASE_URL.trim()
    : ''
  // Production routes /api through the frontend's Vercel deployment so the
  // session cookie stays first-party in every browser.
  const baseUrl = env.PROD ? '' : configuredBaseUrl

  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '')
}

export function resolveApiUrl(baseUrl, path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new TypeError('API endpoint path must be a non-empty string.')
  }

  let endpoint = path.trim()
  if (!endpoint.startsWith('/')) endpoint = `/${endpoint}`
  const queryIndex = endpoint.indexOf('?')
  const pathname = queryIndex === -1 ? endpoint : endpoint.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : endpoint.slice(queryIndex)
  const normalizedPath = pathname.replace(/\/{2,}/g, '/')
  endpoint = `${normalizedPath.replace(/^\/(?:api\/)+api(?=\/|$)/i, '/api')}${query}`

  return `${getApiBaseUrl({ VITE_API_BASE_URL: baseUrl })}${endpoint}`
}

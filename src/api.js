const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

async function fetchApi(path, options) {
  try {
    return await fetch(apiUrl(path), options)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Unable to connect to SureDocs. Check your connection and try again.')
    }
    throw error
  }
}

export function apiErrorMessage(detail, fallback = 'Request failed') {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue) => {
        if (typeof issue === 'string') return issue
        if (!issue || typeof issue !== 'object' || typeof issue.msg !== 'string') return ''
        const fields = Array.isArray(issue.loc)
          ? issue.loc.filter((part) => typeof part === 'string').join('.')
          : ''
        return fields ? `${fields}: ${issue.msg}` : issue.msg
      })
      .filter(Boolean)
    if (messages.length) return messages.join(' ')
  }
  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') {
    return detail.msg
  }
  return fallback
}

export async function apiGet(path, { signal } = {}) {
  const response = await fetchApi(path, {
    credentials: 'include',
    signal,
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
    error.status = response.status
    throw error
  }

  return data
}

export async function apiGetFile(path, { signal } = {}) {
  const response = await fetchApi(path, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const error = new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
    error.status = response.status
    throw error
  }

  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '',
  }
}

export async function apiPost(path, body, { signal } = {}) {
  const response = await fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
    error.status = response.status
    throw error
  }

  return data
}

export async function apiPatch(path, body, { signal } = {}) {
  const response = await fetchApi(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
    error.status = response.status
    throw error
  }

  return data
}

export async function apiPut(path, body, { signal } = {}) {
  const response = await fetchApi(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
  }

  return data
}

export async function apiDelete(path, { body, signal } = {}) {
  const response = await fetchApi(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    credentials: 'include',
    signal,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(apiErrorMessage(data?.detail, `Request failed with status ${response.status}`))
  }
}

export function apiUpload(path, body, { onProgress, method = 'POST' } = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(method, apiUrl(path))
    request.withCredentials = true
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    })
    request.addEventListener('load', () => {
      const data = (() => {
        try {
          return JSON.parse(request.responseText)
        } catch {
          return null
        }
      })()
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(apiErrorMessage(data?.detail, `Request failed with status ${request.status}`)))
        return
      }
      resolve(data)
    })
    request.addEventListener('error', () => reject(new Error('Unable to connect to SureDocs.')))
    request.addEventListener('abort', () => reject(new Error('Upload was cancelled.')))
    request.send(body)
  })
}

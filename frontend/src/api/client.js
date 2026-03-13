const BASE = '/api'

async function request(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? (options.headers || {})
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(`${BASE}${endpoint}`, {
    credentials: 'include',
    headers,
    ...options,
  })

  let data
  try { data = await res.json() } catch { data = {} }

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data   = data
    throw err
  }
  return data
}

export const api = {
  get:    (url, params) => {
    const q = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    ).toString() : ''
    return request(url + q)
  },
  post:   (url, body)   => request(url, { method: 'POST',   body: JSON.stringify(body) }),
  postForm: (url, formData) => request(url, { method: 'POST', body: formData }),
  put:    (url, body)   => request(url, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  (url, body)   => request(url, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (url)         => request(url, { method: 'DELETE' }),
}

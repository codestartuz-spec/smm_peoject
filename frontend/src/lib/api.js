function csrfToken() {
  const m = document.cookie.split('; ').find((r) => r.startsWith('csrftoken='))
  return m ? decodeURIComponent(m.split('=')[1]) : ''
}

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'X-CSRFToken': csrfToken() }
  let payload
  if (form) payload = form
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
  let res
  try {
    res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' })
  } catch {
    throw new ApiError("Serverga ulanib bo'lmadi. Django ishlayaptimi?", 0)
  }
  let data = null
  try { data = await res.json() } catch { /* bo'sh javob */ }
  if (!res.ok) throw new ApiError(data?.error || `Xato (${res.status})`, res.status, data)
  return data
}

export const get = (p) => api(p)
export const post = (p, body) => api(p, { method: 'POST', body: body ?? {} })
export const put = (p, body) => api(p, { method: 'PUT', body })
export const del = (p) => api(p, { method: 'DELETE' })

/** Fayl yuklash (progress bilan). */
export function uploadForm(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('POST', path)
    x.setRequestHeader('X-CSRFToken', csrfToken())
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100))
    x.onerror = () => reject(new ApiError("Serverga ulanib bo'lmadi", 0))
    x.onload = () => {
      let d = null
      try { d = JSON.parse(x.responseText) } catch { /* */ }
      if (x.status === 413) return reject(new ApiError('Fayl juda katta (server limiti)', 413))
      x.status >= 400 ? reject(new ApiError(d?.error || `Xato (${x.status})`, x.status, d)) : resolve(d)
    }
    x.send(form)
  })
}

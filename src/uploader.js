// Uploads one queued photo straight to Cloudinary using a signature from /api/upload.

// Cloudinary free plan rejects images over 10MB or 25 megapixels
const MAX_BYTES = 10 * 1024 * 1024
const MAX_PIXELS = 25_000_000

// Returns the original file untouched unless it exceeds the plan limits;
// only then is it scaled down (as little as needed) and re-encoded.
export async function fitCloudinaryLimits(file) {
  let img
  try {
    img = await new Promise((resolve, reject) => {
      const el = new Image()
      const url = URL.createObjectURL(file)
      el.onload = () => { URL.revokeObjectURL(url); resolve(el) }
      el.onerror = () => { URL.revokeObjectURL(url); reject() }
      el.src = url
    })
  } catch {
    return file // browser can't decode it (e.g. HEIC on some Androids) — let Cloudinary handle it
  }

  const pixels = img.naturalWidth * img.naturalHeight
  if (file.size <= MAX_BYTES && pixels <= MAX_PIXELS) return file

  let scale = Math.min(1, Math.sqrt((MAX_PIXELS * 0.98) / pixels))
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95))
    if (blob && blob.size <= MAX_BYTES) {
      return new File([blob], 'wedding-moment.jpg', { type: 'image/jpeg' })
    }
    scale *= 0.85
  }
  return file
}

function httpError(message, status) {
  const err = new Error(message)
  err.status = status
  return err
}

async function getSignature(publicId) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId }),
      signal: controller.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw httpError(data.error || 'Could not prepare upload', res.status)
    return data
  } finally {
    clearTimeout(timer)
  }
}

// XHR (not fetch) so we can report upload progress on slow connections
function postWithProgress(url, body, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = 3 * 60 * 1000
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total) }
    xhr.onload = () => {
      let data = null
      try { data = JSON.parse(xhr.responseText) } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(httpError(data?.error?.message || `Upload failed (${xhr.status})`, xhr.status))
    }
    xhr.onerror = () => reject(httpError('Network error', 0))
    xhr.ontimeout = () => reject(httpError('Upload timed out', 0))
    xhr.send(body)
  })
}

// Throws on failure; err.status === 400 means Cloudinary rejected the file itself.
export async function uploadQueuedItem(item, onProgress) {
  const sig = await getSignature(item.id)
  const file = await fitCloudinaryLimits(new Blob([item.data], { type: item.type || 'image/jpeg' }))

  const form = new FormData()
  form.append('file', file, item.name || 'wedding-moment.jpg')
  form.append('api_key', sig.apiKey)
  form.append('timestamp', sig.timestamp)
  form.append('signature', sig.signature)
  form.append('folder', sig.folder)
  form.append('tags', sig.tags)
  form.append('public_id', sig.public_id)
  form.append('overwrite', sig.overwrite)

  return postWithProgress(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, form, onProgress)
}

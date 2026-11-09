// Persistent upload queue backed by IndexedDB.
// Photos are saved on the phone *before* uploading, so a network drop,
// closed tab or dead battery doesn't lose them — the app finishes the
// upload the next time it's opened.
//
// Item shape: { id, name, type, data: ArrayBuffer, attempts }
// `id` is time-ordered, so the store's key order = the order photos were shared.

const DB_NAME = 'wedding-uploads'
const STORE = 'queue'

// Fallback for browsers where IndexedDB is unavailable or full
// (e.g. some private-browsing modes). Works for this visit only.
const memory = new Map()
let persistent = true
let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((err) => {
    console.warn('Upload queue: falling back to memory', err)
    persistent = false
    return null
  })
  return dbPromise
}

// Runs fn(store) in a transaction; resolves with the request's result once committed
function run(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req ? req.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let askedForPersistence = false

export async function put(item) {
  const db = await openDb()
  if (db) {
    if (!askedForPersistence) {
      askedForPersistence = true
      // Ask the browser not to evict our data under storage pressure (best effort)
      navigator.storage?.persist?.().catch(() => {})
    }
    try {
      await run(db, 'readwrite', (s) => s.put(item))
      memory.delete(item.id)
      return
    } catch (err) {
      console.warn('Upload queue: could not save to IndexedDB', err)
      persistent = false
    }
  }
  memory.set(item.id, item)
}

// Oldest item still waiting, or null
export async function first() {
  const db = await openDb()
  let stored = null
  if (db) {
    try {
      stored = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
        req.onsuccess = () => resolve(req.result ? req.result.value : null)
        req.onerror = () => reject(req.error)
      })
    } catch (err) {
      console.warn('Upload queue: read failed', err)
    }
  }
  const inMemory = [...memory.values()].sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null
  if (!stored) return inMemory
  if (!inMemory) return stored
  return stored.id < inMemory.id ? stored : inMemory
}

export async function count() {
  const db = await openDb()
  let n = 0
  if (db) {
    try { n = await run(db, 'readonly', (s) => s.count()) } catch { /* ignore */ }
  }
  return n + memory.size
}

export async function remove(id) {
  memory.delete(id)
  const db = await openDb()
  if (db) {
    try { await run(db, 'readwrite', (s) => s.delete(id)) } catch { /* ignore */ }
  }
}

// false if any photo is only held in memory (would be lost on close)
export function isPersistent() {
  return persistent && memory.size === 0
}

// Time-ordered, URL-safe id — also used as the Cloudinary public_id so a
// photo that's retried after a dropped connection is never stored twice.
export function makeId(index = 0) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('')
  return `${Date.now().toString(36)}-${String(index).padStart(2, '0')}-${rand}`
}

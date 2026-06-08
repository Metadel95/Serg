import React, { useState, useEffect } from 'react'
import './Admin.css'

export default function Admin() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASSWORD || 'wedding2025'

  const login = () => {
    if (password === ADMIN_PASS) {
      setAuthed(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  useEffect(() => {
    if (!authed) return
    fetchPhotos()
  }, [authed])

  const fetchPhotos = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/photos')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load photos')
      setPhotos(data.photos || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadAll = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/download-all')
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sarah-james-wedding-photos.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed. Please try again or download photos individually.')
    } finally {
      setDownloading(false)
    }
  }

  const downloadSingle = (url, idx) => {
    const a = document.createElement('a')
    a.href = url.replace('/upload/', '/upload/fl_attachment/')
    a.download = `wedding-photo-${idx + 1}.jpg`
    a.target = '_blank'
    a.click()
  }

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="login-card">
          <div className="login-ornament">✦</div>
          <h1 className="login-title">Admin Dashboard</h1>
          <p className="login-sub">Sarah &amp; James · June 14, 2025</p>
          <div className="login-field">
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              className={authError ? 'input-error' : ''}
              autoFocus
            />
            {authError && <p className="field-error">Incorrect password</p>}
          </div>
          <button className="btn-login" onClick={login}>Enter</button>
        </div>
      </div>
    )
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div className="admin">
      {/* Lightbox */}
      {lightbox !== null && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          <img
            src={photos[lightbox]?.url}
            alt={`Wedding photo ${lightbox + 1}`}
            className="lightbox-img"
            onClick={e => e.stopPropagation()}
          />
          <div className="lightbox-nav" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(l => Math.max(0, l - 1))}
              disabled={lightbox === 0}
            >←</button>
            <span>{lightbox + 1} / {photos.length}</span>
            <button
              onClick={() => setLightbox(l => Math.min(photos.length - 1, l + 1))}
              disabled={lightbox === photos.length - 1}
            >→</button>
          </div>
        </div>
      )}

      <div className="admin-header">
        <div>
          <h1 className="admin-title">Sarah &amp; James</h1>
          <p className="admin-sub">Wedding Photos · June 14, 2025</p>
        </div>
        <div className="admin-actions">
          <button className="btn-refresh" onClick={fetchPhotos}>
            <RefreshIcon /> Refresh
          </button>
          <button
            className="btn-download-all"
            onClick={downloadAll}
            disabled={downloading || photos.length === 0}
          >
            {downloading ? <SpinnerSmall /> : <DownloadIcon />}
            Download All
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <p className="stat-num">{photos.length}</p>
          <p className="stat-label">Photos Submitted</p>
        </div>
        <div className="stat-card">
          <p className="stat-num">{new Set(photos.map(p => p.deviceId)).size}</p>
          <p className="stat-label">Unique Devices</p>
        </div>
        <div className="stat-card">
          <p className="stat-num">{photos.length > 0 ? new Date(photos[0].uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</p>
          <p className="stat-label">First Upload</p>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <SpinnerSmall />
          <p>Loading photos…</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>⚠ {error}</p>
          <button onClick={fetchPhotos}>Try again</button>
        </div>
      )}

      {!loading && !error && photos.length === 0 && (
        <div className="empty-state">
          <p className="empty-icon">♡</p>
          <p className="empty-text">No photos yet</p>
          <p className="empty-sub">Photos will appear here as guests upload them</p>
        </div>
      )}

      {!loading && !error && photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo, i) => (
            <div key={photo.publicId || i} className="photo-item" onClick={() => setLightbox(i)}>
              <img src={photo.thumbnail || photo.url} alt={`Wedding photo ${i + 1}`} loading="lazy" />
              <div className="photo-overlay">
                <button
                  className="btn-dl-single"
                  onClick={e => { e.stopPropagation(); downloadSingle(photo.url, i) }}
                >
                  <DownloadIcon />
                </button>
                <span className="photo-date">
                  {photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  }) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const SpinnerSmall = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spinSlow 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="#D4C9BA" strokeWidth="2.5"/>
    <path d="M12 2 a10 10 0 0 1 10 10" stroke="#B8977A" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)

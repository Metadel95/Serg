import React, { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const MAX_UPLOADS = 5
const STORAGE_KEY = 'wedding_upload_count'

// ── Decorative ornament SVG ──────────────────────────────────────────────────
const Ornament = () => (
  <svg width="120" height="16" viewBox="0 0 120 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ornament">
    <line x1="0" y1="8" x2="46" y2="8" stroke="#D4C9BA" strokeWidth="0.75"/>
    <circle cx="54" cy="8" r="3" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <circle cx="60" cy="8" r="5" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <circle cx="66" cy="8" r="3" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <line x1="74" y1="8" x2="120" y2="8" stroke="#D4C9BA" strokeWidth="0.75"/>
  </svg>
)

// ── Loading spinner ──────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#E8E0D5" strokeWidth="2"/>
    <path d="M12 2 a10 10 0 0 1 10 10" stroke="#B8977A" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

// ── Counter dots ─────────────────────────────────────────────────────────────
const CounterDots = ({ count, max }) => (
  <div className="counter-dots">
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`dot ${i < count ? 'filled' : ''}`} />
    ))}
  </div>
)

// ── SCREENS ──────────────────────────────────────────────────────────────────
const SCREEN = { HOME: 'home', CAMERA: 'camera', PREVIEW: 'preview', UPLOADING: 'uploading', SUCCESS: 'success', LIMIT: 'limit' }

export default function App() {
  const [screen, setScreen] = useState(SCREEN.HOME)
  const [uploadCount, setUploadCount] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? parseInt(stored, 10) : 0
  })
  const [capturedImage, setCapturedImage] = useState(null) // { dataUrl, blob }
  const [error, setError] = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(null)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  // Stop camera stream helper
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // Check limit on mount
  useEffect(() => {
    if (uploadCount >= MAX_UPLOADS) setScreen(SCREEN.LIMIT)
  }, []) // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => stopStream(), [stopStream])

  // ── Open camera ─────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (uploadCount >= MAX_UPLOADS) { setScreen(SCREEN.LIMIT); return }
    setError(null)

    // On mobile, trigger native file picker which opens camera
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      fileInputRef.current?.click()
      return
    }

    // Desktop: use getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      streamRef.current = stream
      setScreen(SCREEN.CAMERA)
      // Attach stream after DOM update
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)
    } catch {
      // Fallback to file picker
      fileInputRef.current?.click()
    }
  }

  // ── Mobile file input change ─────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedImage({ dataUrl: ev.target.result, blob: file })
      setScreen(SCREEN.PREVIEW)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Desktop capture ──────────────────────────────────────────────────────
  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setCapturedImage({ dataUrl, blob })
      stopStream()
      setScreen(SCREEN.PREVIEW)
    }, 'image/jpeg', 0.92)
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  const uploadPhoto = async () => {
    if (!capturedImage) return
    setScreen(SCREEN.UPLOADING)
    setError(null)

    const formData = new FormData()
    formData.append('photo', capturedImage.blob, 'wedding-moment.jpg')

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Upload failed')

      const newCount = uploadCount + 1
      setUploadCount(newCount)
      localStorage.setItem(STORAGE_KEY, String(newCount))
      setUploadedUrl(data.url)

      if (newCount >= MAX_UPLOADS) {
        setScreen(SCREEN.LIMIT)
      } else {
        setScreen(SCREEN.SUCCESS)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setScreen(SCREEN.PREVIEW)
    }
  }

  // ── Retake ───────────────────────────────────────────────────────────────
  const retake = () => {
    setCapturedImage(null)
    setUploadedUrl(null)
    setError(null)
    setScreen(SCREEN.HOME)
  }

  const addAnother = () => {
    setCapturedImage(null)
    setUploadedUrl(null)
    setError(null)
    setScreen(SCREEN.HOME)
  }

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── HOME ── */}
      {screen === SCREEN.HOME && (
        <div className="screen screen-home">
          <div className="home-inner">
            <p className="home-eyebrow fade-up fade-up-1">You are warmly invited to share</p>
            <Ornament />
            <h1 className="home-names fade-up fade-up-2">
              <span>Sarah</span>
              <span className="ampersand">&amp;</span>
              <span>James</span>
            </h1>
            <p className="home-date fade-up fade-up-3">June 14, 2025</p>
            <Ornament />
            <p className="home-subtitle fade-up fade-up-4">
              Help us capture this beautiful day.<br />
              Your photos become our memories.
            </p>

            {uploadCount > 0 && (
              <div className="counter-badge fade-up fade-up-4">
                <CounterDots count={uploadCount} max={MAX_UPLOADS} />
                <span className="counter-text">{uploadCount} of {MAX_UPLOADS} photos shared</span>
              </div>
            )}

            <button className="btn-primary fade-up fade-up-5" onClick={openCamera}>
              <CameraIcon />
              Capture a Moment
            </button>

            {error && <p className="error-msg fade-in">{error}</p>}
          </div>

          <div className="home-footer fade-up fade-up-5">
            <p>With love &amp; gratitude</p>
          </div>
        </div>
      )}

      {/* ── CAMERA (desktop) ── */}
      {screen === SCREEN.CAMERA && (
        <div className="screen screen-camera">
          <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
          <div className="camera-overlay">
            <button className="btn-close" onClick={() => { stopStream(); setScreen(SCREEN.HOME) }}>
              <CloseIcon />
            </button>
            <div className="camera-frame">
              <div className="frame-corner tl" /><div className="frame-corner tr" />
              <div className="frame-corner bl" /><div className="frame-corner br" />
            </div>
            <button className="btn-shutter" onClick={capturePhoto}>
              <div className="shutter-inner" />
            </button>
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {screen === SCREEN.PREVIEW && capturedImage && (
        <div className="screen screen-preview scale-in">
          <div className="preview-card">
            <img src={capturedImage.dataUrl} alt="Your captured moment" className="preview-img" />
            <div className="preview-info">
              <p className="preview-label">Your moment</p>
              <CounterDots count={uploadCount} max={MAX_UPLOADS} />
              <p className="preview-count">{uploadCount} of {MAX_UPLOADS} photos used</p>
            </div>
            {error && <p className="error-msg">{error}</p>}
            <div className="preview-actions">
              <button className="btn-secondary" onClick={retake}>Retake</button>
              <button className="btn-primary" onClick={uploadPhoto}>
                <UploadIcon />
                Share this photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOADING ── */}
      {screen === SCREEN.UPLOADING && (
        <div className="screen screen-status fade-in">
          <div className="status-card">
            <Spinner />
            <p className="status-title">Sharing your moment…</p>
            <p className="status-sub">Please hold still</p>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {screen === SCREEN.SUCCESS && (
        <div className="screen screen-status scale-in">
          <div className="status-card">
            <div className="success-icon">♡</div>
            <p className="status-title">Thank you!</p>
            <p className="status-sub">Your photo has been added to our collection</p>
            <CounterDots count={uploadCount} max={MAX_UPLOADS} />
            <p className="counter-text" style={{ marginTop: 8 }}>{uploadCount} of {MAX_UPLOADS} photos shared</p>
            {uploadCount < MAX_UPLOADS && (
              <button className="btn-primary" style={{ marginTop: 28 }} onClick={addAnother}>
                <CameraIcon />
                Capture another
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── LIMIT ── */}
      {screen === SCREEN.LIMIT && (
        <div className="screen screen-home">
          <div className="home-inner">
            <div className="limit-icon fade-up fade-up-1">✦</div>
            <Ornament />
            <h1 className="home-names fade-up fade-up-2" style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)' }}>
              Thank You
            </h1>
            <p className="home-date fade-up fade-up-2">Sarah &amp; James</p>
            <Ornament />
            <p className="home-subtitle fade-up fade-up-3">
              You have shared all {MAX_UPLOADS} of your photos.<br />
              Your memories are safe with us.
            </p>
            <div className="counter-badge fade-up fade-up-3" style={{ background: '#F0EBE3' }}>
              <CounterDots count={MAX_UPLOADS} max={MAX_UPLOADS} />
              <span className="counter-text">{MAX_UPLOADS}/{MAX_UPLOADS} · Upload limit reached</span>
            </div>
            <p className="limit-note fade-up fade-up-4">
              We are so grateful you celebrated<br />this day with us 🤍
            </p>
          </div>
          <div className="home-footer fade-up fade-up-5">
            <p>With all our love</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

import React, { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const MAX_UPLOADS = 10
const STORAGE_KEY = 'wedding_upload_count_v2'

const TIPS = [
  "📸 Candid laughs make the best memories",
  "🥂 Catch a toast in action!",
  "💃 Get the dance floor energy",
  "🌸 Find a beautiful detail to capture",
  "🤗 Grab a selfie with your favourite people",
  "✨ Look for a magical background moment",
  "👨‍👩‍👧 Snap a family moment",
  "🎂 Don't miss the cake!",
  "😂 Capture someone's happy tears",
  "🌅 Find the best light in the room",
]

const FUN_MESSAGES = [
  { emoji: "🎉", title: "Shot fired!", sub: "The couple will love this one." },
  { emoji: "🔥", title: "That's a keeper!", sub: "Seriously good stuff." },
  { emoji: "✨", title: "Magic captured!", sub: "This is what memories are made of." },
  { emoji: "💫", title: "Nailed it!", sub: "The album is getting better and better." },
  { emoji: "🎊", title: "Beautiful!", sub: "Mekbeb & Nebyat will treasure this." },
]

// Cloudinary free plan rejects images over 10MB or 25 megapixels
const MAX_BYTES = 10 * 1024 * 1024
const MAX_PIXELS = 25_000_000

// Returns the original file untouched unless it exceeds the plan limits;
// only then is it scaled down (as little as needed) and re-encoded.
async function fitCloudinaryLimits(file) {
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
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.95))
    if (blob && blob.size <= MAX_BYTES) {
      return new File([blob], 'wedding-moment.jpg', { type: 'image/jpeg' })
    }
    scale *= 0.85
  }
  return file
}

const SCREEN = {
  WELCOME: 'welcome',
  HOME: 'home',
  CAMERA: 'camera',
  PREVIEW: 'preview',
  UPLOADING: 'uploading',
  SUCCESS: 'success',
  LIMIT: 'limit',
}

const Ornament = () => (
  <svg width="100" height="14" viewBox="0 0 100 14" fill="none" className="ornament">
    <line x1="0" y1="7" x2="38" y2="7" stroke="#D4C9BA" strokeWidth="0.75"/>
    <circle cx="44" cy="7" r="2.5" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <circle cx="50" cy="7" r="4" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <circle cx="56" cy="7" r="2.5" fill="none" stroke="#B8977A" strokeWidth="0.75"/>
    <line x1="62" y1="7" x2="100" y2="7" stroke="#D4C9BA" strokeWidth="0.75"/>
  </svg>
)

const Spinner = () => (
  <svg className="spinner" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="13" stroke="#E8E0D5" strokeWidth="2.5"/>
    <path d="M16 3 a13 13 0 0 1 13 13" stroke="#B8977A" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
)
// Animated film strip counter
const FilmStrip = ({ count, max }) => (
  <div className="film-strip">
    {Array.from({ length: max }).map((_, i) => (
      <div key={i} className={`film-frame ${i < count ? 'taken' : ''} ${i === count ? 'next' : ''}`}>
        {i < count ? '✓' : i === count ? '●' : ''}
      </div>
    ))}
  </div>
)

export default function App() {
  const [screen, setScreen] = useState(SCREEN.WELCOME)
  const [uploadCount, setUploadCount] = useState(() => {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? parseInt(s, 10) : 0
  })
  const [capturedImage, setCapturedImage] = useState(null)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [currentTip, setCurrentTip] = useState(0)
  const [welcomeStep, setWelcomeStep] = useState(0) // 0,1,2 for animated welcome

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const canvasRef = useRef(null)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (uploadCount >= MAX_UPLOADS) setScreen(SCREEN.LIMIT)
  }, []) // eslint-disable-line

  useEffect(() => () => stopStream(), [stopStream])

  // Rotate tips on home screen
  useEffect(() => {
    if (screen !== SCREEN.HOME) return
    const t = setInterval(() => setCurrentTip(c => (c + 1) % TIPS.length), 3500)
    return () => clearInterval(t)
  }, [screen])

  // Welcome animation steps
  useEffect(() => {
    if (screen !== SCREEN.WELCOME) return
    const timers = [
      setTimeout(() => setWelcomeStep(1), 600),
      setTimeout(() => setWelcomeStep(2), 1400),
      setTimeout(() => setWelcomeStep(3), 2200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [screen])

  const openCamera = async () => {
    if (uploadCount >= MAX_UPLOADS) { setScreen(SCREEN.LIMIT); return }
    setError(null)
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      fileInputRef.current?.click()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      setScreen(SCREEN.CAMERA)
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      }, 100)
    } catch {
      fileInputRef.current?.click()
    }
  }

  const openGallery = () => {
    if (uploadCount >= MAX_UPLOADS) { setScreen(SCREEN.LIMIT); return }
    setError(null)
    galleryInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) {
      setError('Please choose a photo (image file).')
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedImage({ dataUrl: ev.target.result, blob: file })
      setScreen(SCREEN.PREVIEW)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      setCapturedImage({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), blob })
      stopStream()
      setScreen(SCREEN.PREVIEW)
    }, 'image/jpeg', 0.92)
  }

  const uploadPhoto = async () => {
    if (!capturedImage) return
    setScreen(SCREEN.UPLOADING)
    setError(null)
    try {
      // 1. Get a signed upload permission from our API (tiny request)
      const signRes = await fetch('/api/upload', { method: 'POST' })
      const sig = await signRes.json()
      if (!signRes.ok) throw new Error(sig.error || 'Upload failed')

      // 2. Only shrink if Cloudinary's free-plan limits would reject it
      const file = await fitCloudinaryLimits(capturedImage.blob)

      // 3. Send the photo straight to Cloudinary at full quality
      const formData = new FormData()
      formData.append('file', file, file.name || 'wedding-moment.jpg')
      formData.append('api_key', sig.apiKey)
      formData.append('timestamp', sig.timestamp)
      formData.append('signature', sig.signature)
      formData.append('folder', sig.folder)
      formData.append('tags', sig.tags)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Cloudinary error:', data)
        throw new Error('Upload to cloud failed. Please try again.')
      }
      const newCount = uploadCount + 1
      setUploadCount(newCount)
      localStorage.setItem(STORAGE_KEY, String(newCount))
      setSuccessMsg(FUN_MESSAGES[(newCount - 1) % FUN_MESSAGES.length])
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

  const remaining = MAX_UPLOADS - uploadCount

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileChange} style={{ display: 'none' }} />
      <input ref={galleryInputRef} type="file" accept="image/*"
        onChange={handleFileChange} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ══ WELCOME SCREEN ══ */}
      {screen === SCREEN.WELCOME && (
        <div className="screen screen-welcome">
          <div className={`welcome-content ${welcomeStep >= 1 ? 'visible' : ''}`}>
            <div className={`welcome-ring ${welcomeStep >= 1 ? 'pop' : ''}`}>💍</div>
            <h1 className={`welcome-names ${welcomeStep >= 2 ? 'visible' : ''}`}>
              Mekbeb <span>&amp;</span> Nebyat
            </h1>
            <p className={`welcome-date ${welcomeStep >= 2 ? 'visible' : ''}`}>
              November 14, 2026
            </p>
            <p className={`welcome-invite ${welcomeStep >= 3 ? 'visible' : ''}`}>
              You're officially a wedding photographer today 📷
            </p>
            <button
              className={`btn-welcome ${welcomeStep >= 3 ? 'visible' : ''}`}
              onClick={() => setScreen(SCREEN.HOME)}
            >
              Let's go! →
            </button>
          </div>
        </div>
      )}

      {/* ══ HOME SCREEN ══ */}
      {screen === SCREEN.HOME && (
        <div className="screen screen-home">

          {/* Top bar */}
          <div className="top-bar fade-up fade-up-1">
            <div className="top-names">Mekbeb &amp; Nebyat</div>
            <div className="top-date">November 14, 2026</div>
          </div>

          {/* Main card */}
          <div className="home-card fade-up fade-up-2">
            <div className="home-card-top">
              <span className="card-emoji">📸</span>
              <h2 className="card-title">Your turn to shine!</h2>
              <p className="card-desc">
                You've got <strong>{remaining} photo{remaining !== 1 ? 's' : ''}</strong> left to share with us.{' '}
                {remaining === MAX_UPLOADS
                  ? 'Make every one count! ✨'
                  : remaining > 5
                  ? 'Keep them coming!'
                  : remaining > 2
                  ? 'Use them wisely 😄'
                  : remaining === 1
                  ? 'Make this last one legendary! 🏆'
                  : 'Almost out — go for the best shot!'}
              </p>
            </div>

            {/* Film strip counter */}
            <div className="counter-section">
              <FilmStrip count={uploadCount} max={MAX_UPLOADS} />
              <p className="counter-label">
                {uploadCount === 0
                  ? `${MAX_UPLOADS} photos ready to go`
                  : `${uploadCount} shared · ${remaining} remaining`}
              </p>
            </div>

            <button className="btn-camera" onClick={openCamera}>
              <CameraIcon />
              <span>Take a Photo</span>
            </button>
            <button className="btn-gallery" onClick={openGallery}>
              <GalleryIcon />
              <span>Upload from Gallery</span>
            </button>
          </div>

          {/* How it works */}
          <div className="how-it-works fade-up fade-up-3">
            <p className="how-title">How it works</p>
            <div className="steps">
              <div className="step">
                <div className="step-num">1</div>
                <div className="step-text">Take a photo, or pick one from your gallery</div>
              </div>
              <div className="step-arrow">↓</div>
              <div className="step">
                <div className="step-num">2</div>
                <div className="step-text">Preview your shot</div>
              </div>
              <div className="step-arrow">↓</div>
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-text">Hit share — it goes straight to the couple 🥂</div>
              </div>
            </div>
          </div>

          {/* Rotating tip */}
          <div className="tip-bar fade-up fade-up-4" key={currentTip}>
            <span className="tip-label">💡 Tip</span>
            <span className="tip-text">{TIPS[currentTip]}</span>
          </div>

          {error && <p className="error-msg fade-in">{error}</p>}
        </div>
      )}

      {/* ══ CAMERA (desktop) ══ */}
      {screen === SCREEN.CAMERA && (
        <div className="screen screen-camera">
          <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
          <div className="camera-overlay">
            <button className="btn-close" onClick={() => { stopStream(); setScreen(SCREEN.HOME) }}>
              <CloseIcon />
            </button>
            <div className="camera-hint">Smile! 😄</div>
            <div className="camera-frame">
              <div className="frame-corner tl" /><div className="frame-corner tr" />
              <div className="frame-corner bl" /><div className="frame-corner br" />
            </div>
            <button className="btn-shutter" onClick={capturePhoto}>
              <div className="shutter-inner" />
            </button>
            <p className="shutter-hint">Tap to capture</p>
          </div>
        </div>
      )}

      {/* ══ PREVIEW ══ */}
      {screen === SCREEN.PREVIEW && capturedImage && (
        <div className="screen screen-preview">
          <div className="preview-wrapper">

            <div className="preview-header fade-up fade-up-1">
              <p className="preview-eyebrow">📷 Preview your shot</p>
              <p className="preview-sub">Happy with it? Share it with Mekbeb &amp; Nebyat!</p>
            </div>

            <div className="preview-photo-wrap fade-up fade-up-2">
              <img src={capturedImage.dataUrl} alt="Preview" className="preview-img" />
              <div className="preview-badge">{uploadCount + 1} of {MAX_UPLOADS}</div>
            </div>

            {error && <p className="error-msg fade-in">{error}</p>}

            <div className="preview-actions fade-up fade-up-3">
              <button className="btn-retake" onClick={() => { setCapturedImage(null); setScreen(SCREEN.HOME) }}>
                <RetakeIcon /> Not this one
              </button>
              <button className="btn-share" onClick={uploadPhoto}>
                <HeartIcon /> Share this!
              </button>
            </div>

            <p className="preview-note fade-up fade-up-4">
              {remaining === 1
                ? '⚠️ This is your last photo — make it count!'
                : `${remaining} photo${remaining !== 1 ? 's' : ''} remaining after this`}
            </p>
          </div>
        </div>
      )}

      {/* ══ UPLOADING ══ */}
      {screen === SCREEN.UPLOADING && (
        <div className="screen screen-status fade-in">
          <div className="status-card">
            <Spinner />
            <p className="status-title">Sending your photo… 🚀</p>
            <p className="status-sub">Adding it to the collection</p>
          </div>
        </div>
      )}

      {/* ══ SUCCESS ══ */}
      {screen === SCREEN.SUCCESS && successMsg && (
        <div className="screen screen-success">
          <div className="success-wrap scale-in">

            <div className="success-emoji">{successMsg.emoji}</div>
            <h2 className="success-title">{successMsg.title}</h2>
            <p className="success-sub">{successMsg.sub}</p>

            <Ornament />

            <div className="success-counter">
              <FilmStrip count={uploadCount} max={MAX_UPLOADS} />
              <p className="counter-label">
                <strong>{uploadCount}</strong> shared · <strong>{MAX_UPLOADS - uploadCount}</strong> remaining
              </p>
            </div>

            <div className="success-actions">
              <button className="btn-camera" onClick={() => { setCapturedImage(null); setScreen(SCREEN.HOME) }}>
                <CameraIcon /> Take another!
              </button>
              <button className="btn-gallery" onClick={openGallery}>
                <GalleryIcon /> Upload from Gallery
              </button>
            </div>

            <p className="success-note">
              {MAX_UPLOADS - uploadCount === 1
                ? '⚡ Just 1 photo left — save it for something special!'
                : `You've got ${MAX_UPLOADS - uploadCount} more shots — go explore! 🎉`}
            </p>
          </div>
        </div>
      )}

      {/* ══ LIMIT SCREEN ══ */}
      {screen === SCREEN.LIMIT && (
        <div className="screen screen-limit">
          <div className="limit-wrap fade-up fade-up-1">
            <div className="limit-emoji">🎊</div>
            <Ornament />
            <h2 className="limit-title">You're a legend!</h2>
            <p className="limit-sub">Mekbeb &amp; Nebyat · November 14, 2026</p>
            <p className="limit-body">
              You used all <strong>{MAX_UPLOADS} photos</strong> — thank you so much!
              Your memories are now safely in the couple's collection. 💛
            </p>
            <div className="limit-strip">
              <FilmStrip count={MAX_UPLOADS} max={MAX_UPLOADS} />
              <p className="counter-label">All {MAX_UPLOADS} photos shared 🎉</p>
            </div>
            <div className="limit-hearts">
              {['💛','🤍','💛','🤍','💛'].map((h, i) => (
                <span key={i} className="limit-heart" style={{ animationDelay: `${i * 0.15}s` }}>{h}</span>
              ))}
            </div>
            <p className="limit-thanks">
              We are so grateful you celebrated<br />this beautiful day with us.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)
const GalleryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
const RetakeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
  </svg>
)
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

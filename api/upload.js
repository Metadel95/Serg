// api/upload.js — Vercel Serverless Function
// Uses busboy to parse multipart (avoids formidable serverless issues)
// then streams directly to Cloudinary — no temp file needed

const cloudinary = require('cloudinary').v2
const Busboy = require('busboy')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify Cloudinary is configured
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('Missing CLOUDINARY_CLOUD_NAME env var')
    return res.status(500).json({ error: 'Server not configured. Contact the admin.' })
  }

  return new Promise((resolve) => {
    let settled = false
    const done = (statusCode, body) => {
      if (settled) return
      settled = true
      res.status(statusCode).json(body)
      resolve()
    }

    let busboy
    try {
      busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
      })
    } catch (err) {
      console.error('Busboy init error:', err)
      return done(400, { error: 'Invalid request format' })
    }

    let fileReceived = false

    busboy.on('file', (_fieldname, fileStream, _info) => {
      fileReceived = true

      // Stream directly from busboy → Cloudinary (no disk write)
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'wedding-sarah-james-2025',
          resource_type: 'image',
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
          tags: ['wedding', 'guest-upload'],
        },
        (err, result) => {
          if (err) {
            console.error('Cloudinary error:', err)
            return done(500, { error: 'Upload to cloud failed. Please try again.' })
          }
          done(200, { url: result.secure_url, publicId: result.public_id })
        }
      )

      fileStream.on('error', (err) => {
        console.error('File stream error:', err)
        uploadStream.destroy(err)
        done(500, { error: 'File read error. Please try again.' })
      })

      fileStream.pipe(uploadStream)
    })

    busboy.on('finish', () => {
      if (!fileReceived) {
        done(400, { error: 'No photo file found in request.' })
      }
    })

    busboy.on('error', (err) => {
      console.error('Busboy error:', err)
      done(500, { error: 'Could not read upload. Please try again.' })
    })

    req.pipe(busboy)
  })
}

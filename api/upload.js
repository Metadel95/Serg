// api/upload.js — Vercel Serverless Function
// Returns a short-lived signature so the browser can upload the photo
// DIRECTLY to Cloudinary. The file itself never passes through Vercel,
// so Vercel's 4.5MB request limit doesn't apply and the original
// full-quality photo is stored (no incoming transformation).

const cloudinary = require('cloudinary').v2

const FOLDER = 'wedding-Mekbeb-Nebyat-2025'
const TAGS = 'wedding,guest-upload'

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error('Missing Cloudinary env vars')
    return res.status(500).json({ error: 'Server not configured. Contact the admin.' })
  }

  const timestamp = Math.round(Date.now() / 1000)
  // Every param sent to Cloudinary (except file, api_key, signature) must be signed
  const params = { folder: FOLDER, tags: TAGS, timestamp }
  const signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET)

  return res.status(200).json({
    cloudName: CLOUDINARY_CLOUD_NAME,
    apiKey: CLOUDINARY_API_KEY,
    signature,
    ...params,
  })
}

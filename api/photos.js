// api/photos.js — Vercel Serverless Function
// Returns all uploaded wedding photos from Cloudinary

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await cloudinary.search
      .expression('folder:wedding-sarah-james-2025 AND tags=guest-upload')
      .sort_by('created_at', 'desc')
      .with_field('context')
      .max_results(500)
      .execute()

    const photos = result.resources.map(r => ({
      publicId: r.public_id,
      url: r.secure_url,
      // Thumbnail: auto-cropped 400x400
      thumbnail: cloudinary.url(r.public_id, {
        width: 400, height: 400, crop: 'fill', quality: 'auto', fetch_format: 'auto', secure: true
      }),
      uploadedAt: r.created_at,
      width: r.width,
      height: r.height,
    }))

    return res.status(200).json({ photos, total: photos.length })
  } catch (err) {
    console.error('Cloudinary list error:', err)
    return res.status(500).json({ error: 'Could not load photos' })
  }
}

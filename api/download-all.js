// api/download-all.js — Vercel Serverless Function
// Streams a zip of all wedding photos

import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Cloudinary's built-in zip/archive generation
    const result = await cloudinary.utils.download_zip_url({
      public_ids: await getPublicIds(),
      resource_type: 'image',
    })

    // Redirect to Cloudinary's generated zip URL
    return res.redirect(302, result)
  } catch (err) {
    console.error('Download all error:', err)
    return res.status(500).json({ error: 'Could not generate download' })
  }
}

async function getPublicIds() {
  const result = await cloudinary.search
    .expression('folder:wedding-sarah-james-2025 AND tags=guest-upload')
    .sort_by('created_at', 'desc')
    .max_results(500)
    .execute()
  return result.resources.map(r => r.public_id)
}

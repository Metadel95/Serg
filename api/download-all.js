// api/download-all.js — Vercel Serverless Function
const cloudinary = require('cloudinary').v2

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await cloudinary.search
      .expression('folder:wedding-sarah-james-2025 AND tags=guest-upload')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute()

    const publicIds = result.resources.map(r => r.public_id)

    if (publicIds.length === 0) {
      return res.status(404).json({ error: 'No photos found' })
    }

    const zipUrl = cloudinary.utils.download_zip_url({
      public_ids: publicIds,
      resource_type: 'image',
    })

    return res.redirect(302, zipUrl)
  } catch (err) {
    console.error('Download all error:', err)
    return res.status(500).json({ error: 'Could not generate download' })
  }
}

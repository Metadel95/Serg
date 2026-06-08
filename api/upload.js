// api/upload.js — Vercel Serverless Function
const cloudinary = require('cloudinary').v2
const { IncomingForm } = require('formidable')
const { createReadStream } = require('fs')

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

  const form = new IncomingForm({ maxFileSize: 15 * 1024 * 1024, keepExtensions: true })

  let files
  try {
    ;[, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fi) => err ? reject(err) : resolve([f, fi]))
    })
  } catch {
    return res.status(400).json({ error: 'Could not parse upload' })
  }

  const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo
  if (!photoFile) return res.status(400).json({ error: 'No photo file provided' })

  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'wedding-sarah-james-2025',
          resource_type: 'image',
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
          tags: ['wedding', 'guest-upload'],
        },
        (err, result) => err ? reject(err) : resolve(result)
      )
      createReadStream(photoFile.filepath).pipe(uploadStream)
    })

    return res.status(200).json({
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    })
  } catch (err) {
    console.error('Cloudinary upload error:', err)
    return res.status(500).json({ error: 'Upload failed. Please try again.' })
  }
}

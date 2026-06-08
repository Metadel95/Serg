// api/test.js — Quick diagnostic endpoint
// Visit /api/test in browser to check config is working
module.exports = function handler(req, res) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  res.status(200).json({
    status: 'ok',
    cloudinary: {
      cloud_name: cloudName  ? `✓ set (${cloudName})`          : '✗ MISSING',
      api_key:    apiKey     ? `✓ set (${apiKey.slice(0,4)}…)`  : '✗ MISSING',
      api_secret: apiSecret  ? '✓ set'                          : '✗ MISSING',
    },
    allConfigured: !!(cloudName && apiKey && apiSecret),
  })
}

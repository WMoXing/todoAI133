const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

module.exports = {
  port: process.env.PORT || 3001,
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },
  bitiful: {
    accessKey: process.env.BITIFUL_ACCESS_KEY,
    secretKey: process.env.BITIFUL_SECRET_KEY,
    bucket: process.env.BITIFUL_BUCKET,
    endpoint: process.env.BITIFUL_ENDPOINT || 'https://s3.bitiful.net',
  },
}
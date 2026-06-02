const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const config = require('../config')

const BITIFUL_KEY = 'todo-data/data.json'

let data = {
  tasks: [],
  projects: [],
  chatSessions: [],
}

function getS3Client() {
  return new S3Client({
    endpoint: config.bitiful.endpoint,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.bitiful.accessKey,
      secretAccessKey: config.bitiful.secretKey,
    },
    forcePathStyle: true,
  })
}

async function loadFromBitiful() {
  const client = getS3Client()
  try {
    const cmd = new GetObjectCommand({
      Bucket: config.bitiful.bucket,
      Key: BITIFUL_KEY,
    })
    const response = await client.send(cmd)
    const body = await response.Body.transformToString('utf-8')
    data = JSON.parse(body)
    console.log('从缤纷云加载数据成功')
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.log('数据文件不存在，创建空数据集')
      data = { tasks: [], projects: [], chatSessions: [] }
      await saveToBitiful()
    } else {
      console.warn('从缤纷云加载数据失败，使用本地缓存:', err.message)
    }
  }
}

async function saveToBitiful() {
  const client = getS3Client()
  const body = JSON.stringify(data, null, 2)
  const cmd = new PutObjectCommand({
    Bucket: config.bitiful.bucket,
    Key: BITIFUL_KEY,
    Body: body,
    ContentType: 'application/json',
  })
  await client.send(cmd)
}

function getData() {
  return data
}

function setData(newData) {
  data = newData
}

module.exports = {
  loadFromBitiful,
  saveToBitiful,
  getData,
  setData,
}
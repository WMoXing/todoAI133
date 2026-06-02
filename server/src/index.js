const express = require('express')
const cors = require('cors')
const path = require('path')
const config = require('./config')
const { loadFromBitiful } = require('./data/store')

const tasksRouter = require('./routes/tasks')
const projectsRouter = require('./routes/projects')
const aiRouter = require('./routes/ai')
const chatRouter = require('./routes/chat')

const app = express()

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/tasks', tasksRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/ai/chat', chatRouter)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// Serve built frontend in production
const distPath = path.join(__dirname, '..', '..', 'client', 'dist')
app.use(express.static(distPath))

// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' })
  res.sendFile(path.join(distPath, 'index.html'))
})

app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  console.error(err.stack)
  res.status(500).json({ error: '内部错误', detail: err.message })
})

async function start() {
  try {
    await loadFromBitiful()
    console.log('数据加载完成')
  } catch (err) {
    console.warn('数据加载失败，使用空数据集:', err.message)
  }

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`)
  })
}

start()
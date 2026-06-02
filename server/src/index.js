const express = require('express')
const cors = require('cors')
const fs = require('fs')
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

// Serve built frontend
const distPath = path.join(__dirname, '..', '..', 'client', 'dist')
const indexPath = path.join(distPath, 'index.html')
const distExists = fs.existsSync(indexPath)

console.log('dist path:', distPath)
console.log('dist exists:', distExists)

if (distExists) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' })
    res.sendFile(indexPath)
  })
} else {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' })
    res.type('html').send('<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>AI Todo</title></head><body style="font-family:sans-serif;padding:40px;text-align:center"><h1>AI Todo</h1><p>前端尚未构建。请在 Render 构建命令中确保运行 <code>npm run build</code>。</p><hr><p>API 状态: <a href="/api/health">/api/health</a></p></body></html>')
  })
}

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
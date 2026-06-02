const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getData, saveToBitiful } = require('../data/store')

const router = express.Router()

router.get('/sessions', (req, res) => {
  const { chatSessions } = getData()
  const list = chatSessions.map(s => ({
    id: s.id,
    messageCount: s.messages.length,
    updatedAt: s.updatedAt,
    preview: s.messages.length > 0
      ? s.messages[s.messages.length - 1].content.slice(0, 50)
      : '',
  }))
  res.json(list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)))
})

router.get('/sessions/:id', (req, res) => {
  const { chatSessions } = getData()
  const session = chatSessions.find(s => s.id === req.params.id)
  if (!session) return res.status(404).json({ error: '会话不存在' })
  res.json(session)
})

router.post('/sessions', async (req, res) => {
  const now = new Date().toISOString()
  const session = {
    id: uuidv4(),
    messages: [],
    contextTaskIds: [],
    createdAt: now,
    updatedAt: now,
  }

  const { chatSessions } = getData()
  chatSessions.push(session)
  getData().chatSessions = chatSessions
  await saveToBitiful()

  res.status(201).json(session)
})

router.delete('/sessions/:id', async (req, res) => {
  const { chatSessions } = getData()
  const index = chatSessions.findIndex(s => s.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '会话不存在' })

  chatSessions.splice(index, 1)
  getData().chatSessions = chatSessions
  await saveToBitiful()

  res.json({ success: true })
})

module.exports = router

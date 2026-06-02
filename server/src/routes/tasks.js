const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getData, saveToBitiful } = require('../data/store')

const router = express.Router()

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next)
}

router.get('/', asyncHandler(async (req, res) => {
  const { projectId, status, tag, priority, search } = req.query
  const { tasks } = getData()

  let filtered = tasks.filter(t => !t.deletedAt)

  if (projectId) filtered = filtered.filter(t => t.projectId === projectId)
  if (status) filtered = filtered.filter(t => t.status === status)
  if (priority) filtered = filtered.filter(t => t.priority === priority)
  if (tag) filtered = filtered.filter(t => t.tags.includes(tag))
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q))
  }

  res.json(filtered)
}))

router.get('/trash', asyncHandler(async (req, res) => {
  const { tasks } = getData()
  res.json(tasks.filter(t => t.deletedAt))
}))

router.post('/', asyncHandler(async (req, res) => {
  const now = new Date().toISOString()
  const task = {
    id: uuidv4(),
    title: req.body.title || '未命名任务',
    completed: false,
    status: 'todo',
    dueDate: req.body.dueDate || null,
    dueTime: req.body.dueTime || null,
    tags: req.body.tags || [],
    priority: req.body.priority || 'medium',
    notes: req.body.notes || '',
    parentId: req.body.parentId || null,
    childIds: [],
    projectId: req.body.projectId || 'default',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    isRecurring: req.body.isRecurring || false,
    recurrenceRule: req.body.recurrenceRule || null,
    aiGenerated: req.body.aiGenerated || false,
    aiParentId: req.body.aiParentId || null,
  }

  const { tasks } = getData()
  tasks.push(task)
  getData().tasks = tasks
  await saveToBitiful()

  res.status(201).json(task)
}))

router.put('/:id', asyncHandler(async (req, res) => {
  const { tasks } = getData()
  const index = tasks.findIndex(t => t.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '任务不存在' })

  const allowed = ['title', 'dueDate', 'dueTime', 'tags', 'priority', 'notes', 'status', 'completed','childIds','isRecurring','recurrenceRule']
  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      tasks[index][field] = req.body[field]
    }
  })
  tasks[index].updatedAt = new Date().toISOString()

  if (req.body.status === 'done' || req.body.completed) {
    tasks[index].completed = true
    tasks[index].status = 'done'
  } else if (req.body.status === 'in_progress' && !tasks[index].completed) {
    tasks[index].completed = false
  } else if (req.body.status === 'todo') {
    tasks[index].completed = false
  }

  getData().tasks = tasks
  await saveToBitiful()

  res.json(tasks[index])
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const { tasks } = getData()
  const index = tasks.findIndex(t => t.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '任务不存在' })

  tasks[index].deletedAt = new Date().toISOString()
  getData().tasks = tasks
  await saveToBitiful()

  res.json({ success: true })
}))

router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { tasks } = getData()
  const index = tasks.findIndex(t => t.id === req.params.id)
  if (index === -1 || !tasks[index].deletedAt) {
    return res.status(404).json({ error: '任务不在回收站中' })
  }

  tasks[index].deletedAt = null
  getData().tasks = tasks
  await saveToBitiful()

  res.json(tasks[index])
}))

module.exports = router
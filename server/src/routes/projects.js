const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getData, saveToBitiful } = require('../data/store')

const router = express.Router()

router.get('/', (req, res) => {
  const { projects } = getData()
  res.json(projects)
})

router.post('/', async (req, res) => {
  const now = new Date().toISOString()
  const project = {
    id: uuidv4(),
    name: req.body.name || '新清单',
    color: req.body.color || '#409eff',
    createdAt: now,
  }

  const { projects } = getData()
  projects.push(project)
  getData().projects = projects
  await saveToBitiful()

  res.status(201).json(project)
})

router.put('/:id', async (req, res) => {
  const { projects } = getData()
  const index = projects.findIndex(p => p.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '清单不存在' })

  if (req.body.name !== undefined) projects[index].name = req.body.name
  if (req.body.color !== undefined) projects[index].color = req.body.color

  getData().projects = projects
  await saveToBitiful()

  res.json(projects[index])
})

router.delete('/:id', async (req, res) => {
  const { projects, tasks } = getData()

  const index = projects.findIndex(p => p.id === req.params.id)
  if (index === -1) return res.status(404).json({ error: '清单不存在' })

  projects.splice(index, 1)

  const updatedTasks = tasks.map(t =>
    t.projectId === req.params.id ? { ...t, projectId: 'default' } : t
  )

  getData().projects = projects
  getData().tasks = updatedTasks
  await saveToBitiful()

  res.json({ success: true })
})

module.exports = router

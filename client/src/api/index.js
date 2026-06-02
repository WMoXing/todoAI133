import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export function fetchTasks(params) {
  return api.get('/tasks', { params }).then(r => r.data)
}

export function createTask(data) {
  return api.post('/tasks', data).then(r => r.data)
}

export function updateTask(id, data) {
  return api.put(`/tasks/${id}`, data).then(r => r.data)
}

export function deleteTask(id) {
  return api.delete(`/tasks/${id}`).then(r => r.data)
}

export function restoreTask(id) {
  return api.post(`/tasks/${id}/restore`).then(r => r.data)
}

export function fetchProjects() {
  return api.get('/projects').then(r => r.data)
}

export function createProject(data) {
  return api.post('/projects', data).then(r => r.data)
}

export function updateProject(id, data) {
  return api.put(`/projects/${id}`, data).then(r => r.data)
}

export function deleteProject(id) {
  return api.delete(`/projects/${id}`).then(r => r.data)
}

export function parseTask(text) {
  return api.post('/ai/parse', { text }).then(r => r.data)
}

export function breakdownTask(taskTitle, taskNotes) {
  return api.post('/ai/breakdown', { taskTitle, taskNotes }).then(r => r.data)
}

export function createChatSession() {
  return api.post('/ai/chat/sessions').then(r => r.data)
}

export function fetchChatSessions() {
  return api.get('/ai/chat/sessions').then(r => r.data)
}

export function fetchChatSession(id) {
  return api.get(`/ai/chat/sessions/${id}`).then(r => r.data)
}

export function deleteChatSession(id) {
  return api.delete(`/ai/chat/sessions/${id}`).then(r => r.data)
}

export function sendChatMessage(message, sessionId) {
  return fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  })
}

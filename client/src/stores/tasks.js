import { defineStore } from 'pinia'
import { fetchTasks, createTask, updateTask, deleteTask, restoreTask } from '../api'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    loading: false,
    error: null,
  }),

  getters: {
    activeTasks: (state) => state.tasks.filter(t => !t.deletedAt),
    trashTasks: (state) => state.tasks.filter(t => t.deletedAt),
    getTasksByProject: (state) => (projectId) =>
      state.tasks.filter(t => t.projectId === projectId && !t.deletedAt),
    getTasksByStatus: (state) => (status) =>
      state.tasks.filter(t => t.status === status && !t.deletedAt),
  },

  actions: {
    async loadTasks(params = {}) {
      this.loading = true
      try {
        this.tasks = await fetchTasks(params)
      } finally {
        this.loading = false
      }
    },

    async addTask(data) {
      const task = await createTask(data)
      this.tasks.push(task)
      return task
    },

    async editTask(id, data) {
      const updated = await updateTask(id, data)
      const index = this.tasks.findIndex(t => t.id === id)
      if (index !== -1) this.tasks[index] = updated
      return updated
    },

    async removeTask(id) {
      await deleteTask(id)
      const task = this.tasks.find(t => t.id === id)
      if (task) task.deletedAt = new Date().toISOString()
    },

    async recoverTask(id) {
      const task = await restoreTask(id)
      const index = this.tasks.findIndex(t => t.id === id)
      if (index !== -1) this.tasks[index] = task
      return task
    },
  },
})

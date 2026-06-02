import { defineStore } from 'pinia'
import { fetchProjects, createProject, updateProject, deleteProject } from '../api'

export const useProjectStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loading: false,
  }),

  getters: {
    defaultProject: (state) => state.projects.find(p => p.id === 'default'),
  },

  actions: {
    async loadProjects() {
      this.loading = true
      try {
        this.projects = await fetchProjects()
      } finally {
        this.loading = false
      }
    },

    async addProject(data) {
      const project = await createProject(data)
      this.projects.push(project)
      return project
    },

    async editProject(id, data) {
      const updated = await updateProject(id, data)
      const index = this.projects.findIndex(p => p.id === id)
      if (index !== -1) this.projects[index] = updated
      return updated
    },

    async removeProject(id) {
      await deleteProject(id)
      this.projects = this.projects.filter(p => p.id !== id)
    },
  },
})

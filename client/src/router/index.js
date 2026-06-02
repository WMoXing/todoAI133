import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    component: () => import('../views/TasksView.vue'),
  },
  {
    path: '/ai',
    component: () => import('../views/AIAssistantView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router

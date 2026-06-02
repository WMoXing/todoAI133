import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(localStorage.getItem('darkMode') === 'true')

  function initDarkMode() {
    if (darkMode.value) {
      document.documentElement.classList.add('dark')
    }
  }

  watch(darkMode, (val) => {
    localStorage.setItem('darkMode', val)
    document.documentElement.classList.toggle('dark', val)
  })

  return { darkMode, initDarkMode }
})
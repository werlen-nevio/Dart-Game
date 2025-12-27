import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api.service'
import { socketService } from '@/services/socket.service'
import { UserDTO } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserDTO | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function register(email: string, username: string, password: string) {
    loading.value = true
    try {
      const response = await authApi.register(email, username, password)
      user.value = response.user
      return response.user
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const response = await authApi.login(email, password)
      user.value = response.user

      // Connect socket
      await socketService.connect(response.accessToken)

      return response.user
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    loading.value = true
    try {
      await authApi.logout()
      socketService.disconnect()
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadCurrentUser() {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      return null
    }

    loading.value = true
    try {
      const response = await authApi.getCurrentUser()
      user.value = response.user

      // Connect socket
      if (!socketService.isConnected()) {
        await socketService.connect(token)
      }

      return response.user
    } catch (error) {
      // Token invalid, clear it
      localStorage.removeItem('accessToken')
      user.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    register,
    login,
    logout,
    loadCurrentUser,
  }
})

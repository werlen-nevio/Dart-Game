import axios from 'axios'
import { UserDTO } from '@/types'

const API_URL = '/api'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

// Interceptor to add access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor to handle 401 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
        const { accessToken } = response.data

        localStorage.setItem('accessToken', accessToken)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`

        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export const authApi = {
  async register(email: string, username: string, password: string): Promise<{ user: UserDTO }> {
    const response = await api.post('/auth/register', { email, username, password })
    return response.data
  },

  async login(email: string, password: string): Promise<{ user: UserDTO; accessToken: string }> {
    const response = await api.post('/auth/login', { email, password })
    localStorage.setItem('accessToken', response.data.accessToken)
    return response.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
    localStorage.removeItem('accessToken')
  },

  async getCurrentUser(): Promise<{ user: UserDTO }> {
    const response = await api.get('/auth/me')
    return response.data
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    const response = await api.post('/auth/refresh')
    return response.data
  },
}

export default api

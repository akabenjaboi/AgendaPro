import axios from 'axios'
import { supabase } from '../lib/supabase'
import { API_BASE } from './apiBase'

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor: adjunta el JWT de Supabase en cada request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Interceptor: manejo global de errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || 'Error inesperado'
    return Promise.reject(new Error(message))
  }
)

export default api

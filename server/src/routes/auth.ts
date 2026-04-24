import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos', code: 'VALIDATION_ERROR' })
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return res.status(401).json({ error: 'Credenciales incorrectas', code: 'INVALID_CREDENTIALS' })
    res.json({ user: data.user, session: data.session })
  } catch {
    res.status(500).json({ error: 'Error al iniciar sesión', code: 'INTERNAL_ERROR' })
  }
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos', code: 'VALIDATION_ERROR' })
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone, role: 'professional' } },
    })
    if (error) return res.status(400).json({ error: error.message, code: 'REGISTER_ERROR' })
    res.status(201).json({ user: data.user })
  } catch {
    res.status(500).json({ error: 'Error al registrar usuario', code: 'INTERNAL_ERROR' })
  }
})

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (token) await supabase.auth.admin.signOut(token)
    res.json({ message: 'Sesión cerrada correctamente' })
  } catch {
    res.status(500).json({ error: 'Error al cerrar sesión', code: 'INTERNAL_ERROR' })
  }
})

export default router

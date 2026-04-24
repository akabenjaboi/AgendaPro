import { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase'

export interface AuthenticatedRequest extends Request {
  userId?: string
  userEmail?: string
  professionalId?: string
}

/**
 * Middleware: verifica que el JWT de Supabase sea válido.
 * Extrae el user_id y lo adjunta al request.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de autenticación requerido', code: 'UNAUTHORIZED' })
      return
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Token inválido o expirado', code: 'INVALID_TOKEN' })
      return
    }

    req.userId = user.id
    req.userEmail = user.email
    next()
  } catch {
    res.status(500).json({ error: 'Error al verificar autenticación', code: 'AUTH_ERROR' })
  }
}

/**
 * Middleware: verifica que el usuario sea un profesional.
 * Debe usarse después de requireAuth.
 * Adjunta el professionalId al request.
 */
export async function requireProfessional(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Usuario no autenticado', code: 'UNAUTHORIZED' })
      return
    }

    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', req.userId)
      .single()

    if (error || !professional) {
      res.status(403).json({ error: 'Acceso restringido a profesionales', code: 'FORBIDDEN' })
      return
    }

    req.professionalId = professional.id
    next()
  } catch {
    res.status(500).json({ error: 'Error al verificar rol', code: 'ROLE_ERROR' })
  }
}

import { Router } from 'express'
import { requireAuth, requireProfessional, AuthenticatedRequest } from '../middlewares/auth'
import { supabase } from '../lib/supabase'
import {
  sendAppointmentConfirmedEmail,
  sendAppointmentCancelledEmail
} from '../services/email'

const router = Router()
router.use(requireAuth)
router.use(requireProfessional)

// ===================== PERFIL =====================

// GET /api/professional/profile
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', req.professionalId)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Perfil no encontrado', code: 'NOT_FOUND' })
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener perfil', code: 'INTERNAL_ERROR' })
  }
})

// PUT /api/professional/profile
router.put('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, specialty, bio, phone, slug, avatar_url, timezone, booking_link_active } = req.body

    // Validar slug único si se cambió
    if (slug) {
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('slug', slug)
        .neq('id', req.professionalId!)
        .single()

      if (existing) {
        return res.status(409).json({ error: 'El slug ya está en uso', code: 'SLUG_TAKEN' })
      }
    }

    const { data, error } = await supabase
      .from('professionals')
      .update({ name, specialty, bio, phone, slug, avatar_url, timezone, booking_link_active })
      .eq('id', req.professionalId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al actualizar perfil', code: 'INTERNAL_ERROR' })
  }
})

// ===================== SERVICIOS =====================

router.get('/services', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('professional_id', req.professionalId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener servicios', code: 'INTERNAL_ERROR' })
  }
})

router.post('/services', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, duration_minutes, price, currency } = req.body
    if (!name || !duration_minutes) {
      return res.status(400).json({ error: 'Nombre y duración son requeridos', code: 'VALIDATION_ERROR' })
    }
    const { data, error } = await supabase
      .from('services')
      .insert({ professional_id: req.professionalId, name, description, duration_minutes, price, currency })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch {
    res.status(500).json({ error: 'Error al crear servicio', code: 'INTERNAL_ERROR' })
  }
})

router.put('/services/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { name, description, duration_minutes, price, currency, is_active } = req.body

    const { data, error } = await supabase
      .from('services')
      .update({ name, description, duration_minutes, price, currency, is_active })
      .eq('id', id)
      .eq('professional_id', req.professionalId)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: 'Servicio no encontrado', code: 'NOT_FOUND' })
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al actualizar servicio', code: 'INTERNAL_ERROR' })
  }
})

router.delete('/services/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('professional_id', req.professionalId)

    if (error) throw error
    res.json({ message: 'Servicio eliminado' })
  } catch {
    res.status(500).json({ error: 'Error al eliminar servicio', code: 'INTERNAL_ERROR' })
  }
})

// ===================== DISPONIBILIDAD =====================

router.get('/availability', async (req: AuthenticatedRequest, res) => {
  try {
    const { data: avail } = await supabase
      .from('availability')
      .select('*')
      .eq('professional_id', req.professionalId)
      .order('day_of_week')

    const { data: blocked } = await supabase
      .from('blocked_slots')
      .select('*')
      .eq('professional_id', req.professionalId)
      .gte('ends_at', new Date().toISOString())
      .order('starts_at')

    res.json({ availability: avail, blocked_slots: blocked })
  } catch {
    res.status(500).json({ error: 'Error al obtener disponibilidad', code: 'INTERNAL_ERROR' })
  }
})

router.put('/availability', async (req: AuthenticatedRequest, res) => {
  try {
    const { availability } = req.body as {
      availability: Array<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }>
    }

    // Eliminar disponibilidad actual y reemplazar
    await supabase.from('availability').delete().eq('professional_id', req.professionalId)

    const toInsert = availability.map(a => ({ ...a, professional_id: req.professionalId }))
    const { data, error } = await supabase.from('availability').insert(toInsert).select()

    if (error) throw error
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al guardar disponibilidad', code: 'INTERNAL_ERROR' })
  }
})

router.post('/blocked-slots', async (req: AuthenticatedRequest, res) => {
  try {
    const { starts_at, ends_at, reason } = req.body
    if (!starts_at || !ends_at) {
      return res.status(400).json({ error: 'Fechas de inicio y fin son requeridas', code: 'VALIDATION_ERROR' })
    }
    const { data, error } = await supabase
      .from('blocked_slots')
      .insert({ professional_id: req.professionalId, starts_at, ends_at, reason })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch {
    res.status(500).json({ error: 'Error al bloquear horario', code: 'INTERNAL_ERROR' })
  }
})

router.delete('/blocked-slots/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { error } = await supabase
      .from('blocked_slots')
      .delete()
      .eq('id', id)
      .eq('professional_id', req.professionalId)

    if (error) throw error
    res.json({ message: 'Bloqueo eliminado' })
  } catch {
    res.status(500).json({ error: 'Error al eliminar bloqueo', code: 'INTERNAL_ERROR' })
  }
})

// ===================== CITAS =====================

router.get('/appointments', async (req: AuthenticatedRequest, res) => {
  try {
    const { status, start, end, service_id } = req.query as Record<string, string>
    let query = supabase
      .from('appointments')
      .select('*, services(name, duration_minutes)')
      .eq('professional_id', req.professionalId)
      .order('starts_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (service_id) query = query.eq('service_id', service_id)
    if (start) query = query.gte('starts_at', start)
    if (end) query = query.lte('starts_at', end)

    const { data, error } = await query
    if (error) throw error
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener citas', code: 'INTERNAL_ERROR' })
  }
})

router.get('/appointments/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('appointments')
      .select('*, services(*)')
      .eq('id', id)
      .eq('professional_id', req.professionalId)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener cita', code: 'INTERNAL_ERROR' })
  }
})

router.patch('/appointments/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { status, cancellation_reason } = req.body

    const validStatuses = ['pending', 'confirmed', 'cancelled', 'no_show', 'completed']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido', code: 'VALIDATION_ERROR' })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (cancellation_reason) updateData.cancellation_reason = cancellation_reason
    if (status === 'cancelled') updateData.cancelled_by = 'professional'

    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('professional_id', req.professionalId)
      .select()
      .single()

    if (error || !data) return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })

    // Enviar email según el nuevo status
    if (status === 'confirmed' || status === 'cancelled') {
      const { data: fullApt } = await supabase
        .from('appointments')
        .select(`
          patient_name, patient_email, starts_at, ends_at,
          professionals (name, user_id),
          services (name)
        `)
        .eq('id', id)
        .single()

      if (fullApt) {
        let profEmail = 'noreply@agendapro.com'
        const profNode = fullApt.professionals as any
        if (profNode?.user_id) {
          const { data: authData } = await supabase.auth.admin.getUserById(profNode.user_id)
          if (authData.user?.email) profEmail = authData.user.email
        }

        const patientContact = { name: fullApt.patient_name, email: fullApt.patient_email }
        const profContact = { name: profNode?.name || 'Profesional', email: profEmail }
        const emailDetails = {
          serviceName: (fullApt.services as any)?.name || 'Servicio',
          startsAt: fullApt.starts_at,
          endsAt: fullApt.ends_at,
          token: data.confirmation_token // needed for cancel link in confirmed email
        }

        if (status === 'confirmed') {
          sendAppointmentConfirmedEmail(patientContact, profContact, emailDetails).catch(console.error)
        } else if (status === 'cancelled') {
          sendAppointmentCancelledEmail(patientContact, profContact, emailDetails, 'professional', cancellation_reason).catch(console.error)
        }
      }
    }

    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al actualizar cita', code: 'INTERNAL_ERROR' })
  }
})

export default router

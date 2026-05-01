import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import {
  sendAppointmentCreatedEmail,
  sendNewRequestEmailToProfessional,
  sendAppointmentCancelledEmail,
  sendAppointmentRescheduledEmailToProfessional
} from '../services/email'

const router = Router()
const RESCHEDULE_LIMIT_HOURS_BEFORE = Number(process.env.RESCHEDULE_LIMIT_HOURS_BEFORE ?? 24)

function canReschedule(startsAt: string, limitHours: number): boolean {
  const startsAtMs = new Date(startsAt).getTime()
  const limitMs = limitHours * 60 * 60 * 1000
  return Date.now() <= startsAtMs - limitMs
}

function getStartOfIsoWeek(dateInput: Date): Date {
  const date = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function getEndOfIsoWeek(dateInput: Date): Date {
  const start = getStartOfIsoWeek(dateInput)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

async function validateAppointmentCapacity({
  professionalId,
  serviceId,
  startsAt,
  excludeAppointmentId,
}: {
  professionalId: string
  serviceId: string | null
  startsAt: Date
  excludeAppointmentId?: string
}) {
  const { data: professional } = await supabase
    .from('professionals')
    .select('max_appointments_per_day, max_appointments_per_week')
    .eq('id', professionalId)
    .single()

  const dayLimit = professional?.max_appointments_per_day ?? null
  const weekLimit = professional?.max_appointments_per_week ?? null

  let serviceWeekLimit: number | null = null
  if (serviceId) {
    const { data: service } = await supabase
      .from('services')
      .select('max_appointments_per_week')
      .eq('id', serviceId)
      .eq('professional_id', professionalId)
      .single()
    serviceWeekLimit = service?.max_appointments_per_week ?? null
  }

  if (dayLimit === null && weekLimit === null && serviceWeekLimit === null) {
    return null
  }

  const dayStart = new Date(startsAt)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(startsAt)
  dayEnd.setUTCHours(23, 59, 59, 999)
  const weekStart = getStartOfIsoWeek(startsAt)
  const weekEnd = getEndOfIsoWeek(startsAt)

  let query = supabase
    .from('appointments')
    .select('id, starts_at, service_id')
    .eq('professional_id', professionalId)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', weekStart.toISOString())
    .lte('starts_at', weekEnd.toISOString())

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId)
  }

  const { data: appointments } = await query
  const list = appointments ?? []
  const dayCount = list.filter(apt => {
    const starts = new Date(apt.starts_at).getTime()
    return starts >= dayStart.getTime() && starts <= dayEnd.getTime()
  }).length
  const weekCount = list.length
  const serviceWeekCount = serviceId
    ? list.filter(apt => apt.service_id === serviceId).length
    : 0

  if (dayLimit !== null && dayCount >= dayLimit) {
    return { code: 'DAILY_LIMIT_REACHED', error: 'No hay cupos disponibles para ese día' }
  }
  if (weekLimit !== null && weekCount >= weekLimit) {
    return { code: 'WEEKLY_LIMIT_REACHED', error: 'No hay cupos disponibles para esa semana' }
  }
  if (serviceWeekLimit !== null && serviceWeekCount >= serviceWeekLimit) {
    return { code: 'SERVICE_WEEKLY_LIMIT_REACHED', error: 'Ese servicio alcanzó su límite semanal de citas' }
  }

  return null
}

// POST /api/appointments — Crear cita (público, sin auth)
router.post('/', async (req, res) => {
  try {
    const {
      professional_id,
      service_id,
      patient_name,
      patient_email,
      patient_phone,
      patient_notes,
      starts_at,
    } = req.body

    // Validaciones básicas
    if (!professional_id || !patient_name || !patient_email || !starts_at) {
      return res.status(400).json({
        error: 'Faltan campos obligatorios: professional_id, patient_name, patient_email, starts_at',
        code: 'VALIDATION_ERROR',
      })
    }

    // Obtener duración y buffers del servicio para calcular ends_at y proteger el bloque completo
    let durationMinutes = 60
    let bufferBeforeMinutes = 0
    let bufferAfterMinutes = 0
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes, buffer_before_minutes, buffer_after_minutes')
        .eq('id', service_id)
        .eq('professional_id', professional_id)
        .single()
      if (service) {
        durationMinutes = service.duration_minutes
        bufferBeforeMinutes = Number(service.buffer_before_minutes ?? 0)
        bufferAfterMinutes = Number(service.buffer_after_minutes ?? 0)
      }
    }

    const startTime = new Date(starts_at)
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
    const protectedStart = new Date(startTime.getTime() - bufferBeforeMinutes * 60 * 1000)
    const protectedEnd = new Date(endTime.getTime() + bufferAfterMinutes * 60 * 1000)

    // Verificar que el slot sigue disponible (prevenir race conditions)
    const searchStart = new Date(protectedStart.getTime() - 24 * 60 * 60 * 1000)
    const searchEnd = new Date(protectedEnd.getTime() + 24 * 60 * 60 * 1000)
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, services(buffer_before_minutes, buffer_after_minutes)')
      .eq('professional_id', professional_id)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', searchStart.toISOString())
      .lte('starts_at', searchEnd.toISOString())

    const hasConflict = (existingAppointments ?? []).some((apt) => {
      const aptStart = new Date(apt.starts_at)
      const aptEnd = new Date(apt.ends_at)
      const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services
      const aptBufferBefore = Number(aptService?.buffer_before_minutes ?? 0)
      const aptBufferAfter = Number(aptService?.buffer_after_minutes ?? 0)
      const aptProtectedStart = new Date(aptStart.getTime() - aptBufferBefore * 60 * 1000)
      const aptProtectedEnd = new Date(aptEnd.getTime() + aptBufferAfter * 60 * 1000)
      return protectedStart < aptProtectedEnd && protectedEnd > aptProtectedStart
    })

    if (hasConflict) {
      return res.status(409).json({
        error: 'El horario seleccionado ya no está disponible. Por favor elige otro.',
        code: 'SLOT_UNAVAILABLE',
      })
    }

    const capacityError = await validateAppointmentCapacity({
      professionalId: professional_id,
      serviceId: service_id || null,
      startsAt: startTime,
    })
    if (capacityError) {
      return res.status(409).json(capacityError)
    }

    // Generar token único para cancelación sin login
    const confirmationToken = uuidv4()

    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert({
        professional_id,
        service_id: service_id || null,
        patient_name: patient_name.trim(),
        patient_email: patient_email.toLowerCase().trim(),
        patient_phone: patient_phone || null,
        patient_notes: patient_notes || null,
        starts_at: startTime.toISOString(),
        ends_at: endTime.toISOString(),
        status: 'pending',
        confirmation_token: confirmationToken,
      })
      .select()
      .single()

    if (error) throw error

    // Fetch details for email
    const { data: profData } = await supabase
      .from('professionals')
      .select('name, user_id')
      .eq('id', professional_id)
      .single()

    let profEmail = 'notificaciones@blinktime.lat'
    if (profData?.user_id) {
      // Usar API de admin para obtener email real (requiere service_role key)
      const { data: authData } = await supabase.auth.admin.getUserById(profData.user_id)
      if (authData.user?.email) profEmail = authData.user.email
    }

    const patientContact = { name: appointment.patient_name, email: appointment.patient_email }
    const profContact = { name: profData?.name || 'Profesional', email: profEmail }
    const emailDetails = {
      serviceName: service_id ? 'Consulta' : 'Servicio', // We should fetch actual service name
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      token: appointment.confirmation_token
    }
    
    if (service_id) {
       const { data: srv } = await supabase.from('services').select('name').eq('id', service_id).single()
       if (srv) emailDetails.serviceName = srv.name
    }

    await Promise.allSettled([
      sendAppointmentCreatedEmail(patientContact, profContact, emailDetails),
      sendNewRequestEmailToProfessional(profContact, patientContact, emailDetails),
    ])

    res.status(201).json({
      message: 'Cita creada exitosamente',
      appointment: {
        id: appointment.id,
        starts_at: appointment.starts_at,
        ends_at: appointment.ends_at,
        status: appointment.status,
        confirmation_token: appointment.confirmation_token,
      },
    })
  } catch {
    res.status(500).json({ error: 'Error al crear la cita', code: 'INTERNAL_ERROR' })
  }
})

// GET /api/appointments/cancel/:token — Info de cita por token
router.get('/cancel/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, patient_name, patient_email, starts_at, ends_at, status,
        professionals (name, specialty),
        services (name, duration_minutes)
      `)
      .eq('confirmation_token', token)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })
    }

    if (data.status === 'cancelled') {
      return res.status(410).json({ error: 'Esta cita ya fue cancelada', code: 'ALREADY_CANCELLED' })
    }

    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener la cita', code: 'INTERNAL_ERROR' })
  }
})

// GET /api/appointments/reschedule/:token — Info de cita para reagendar
router.get('/reschedule/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, patient_name, patient_email, starts_at, ends_at, status, service_id,
        professionals (name, specialty, slug),
        services (id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes)
      `)
      .eq('confirmation_token', token)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })
    }

    if (data.status === 'cancelled') {
      return res.status(410).json({ error: 'No se puede reagendar una cita cancelada', code: 'INVALID_STATUS' })
    }

    if (data.status === 'completed') {
      return res.status(400).json({ error: 'No se puede reagendar una cita completada', code: 'INVALID_STATUS' })
    }

    const allowed = canReschedule(data.starts_at, RESCHEDULE_LIMIT_HOURS_BEFORE)
    res.json({
      ...data,
      reschedule_limit_hours_before: RESCHEDULE_LIMIT_HOURS_BEFORE,
      can_reschedule: allowed,
      reschedule_deadline: new Date(
        new Date(data.starts_at).getTime() - RESCHEDULE_LIMIT_HOURS_BEFORE * 60 * 60 * 1000
      ).toISOString(),
    })
  } catch {
    res.status(500).json({ error: 'Error al obtener la cita', code: 'INTERNAL_ERROR' })
  }
})

// PATCH /api/appointments/reschedule/:token — Reagendar cita sin auth
router.patch('/reschedule/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { starts_at } = req.body as { starts_at?: string }

    if (!starts_at) {
      return res.status(400).json({ error: 'El nuevo horario es requerido', code: 'VALIDATION_ERROR' })
    }

    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, status, starts_at, ends_at, professional_id, service_id, patient_name, patient_email')
      .eq('confirmation_token', token)
      .single()

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({ error: 'No se puede reagendar esta cita', code: 'INVALID_STATUS' })
    }

    if (!canReschedule(appointment.starts_at, RESCHEDULE_LIMIT_HOURS_BEFORE)) {
      return res.status(400).json({
        error: `Solo puedes reagendar hasta ${RESCHEDULE_LIMIT_HOURS_BEFORE} horas antes de la cita`,
        code: 'RESCHEDULE_WINDOW_CLOSED',
      })
    }

    const newStart = new Date(starts_at)
    if (Number.isNaN(newStart.getTime()) || newStart <= new Date()) {
      return res.status(400).json({ error: 'El nuevo horario debe ser válido y futuro', code: 'VALIDATION_ERROR' })
    }

    const capacityError = await validateAppointmentCapacity({
      professionalId: appointment.professional_id,
      serviceId: appointment.service_id,
      startsAt: newStart,
      excludeAppointmentId: appointment.id,
    })
    if (capacityError) {
      return res.status(409).json(capacityError)
    }

    let durationMinutes = Math.max(1, Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000))
    let bufferBeforeMinutes = 0
    let bufferAfterMinutes = 0
    let serviceName = 'Servicio'

    if (appointment.service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('name, duration_minutes, buffer_before_minutes, buffer_after_minutes')
        .eq('id', appointment.service_id)
        .eq('professional_id', appointment.professional_id)
        .single()
      if (service) {
        durationMinutes = service.duration_minutes
        bufferBeforeMinutes = Number(service.buffer_before_minutes ?? 0)
        bufferAfterMinutes = Number(service.buffer_after_minutes ?? 0)
        serviceName = service.name
      }
    }

    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000)
    const protectedStart = new Date(newStart.getTime() - bufferBeforeMinutes * 60 * 1000)
    const protectedEnd = new Date(newEnd.getTime() + bufferAfterMinutes * 60 * 1000)

    const searchStart = new Date(protectedStart.getTime() - 24 * 60 * 60 * 1000)
    const searchEnd = new Date(protectedEnd.getTime() + 24 * 60 * 60 * 1000)
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('id, starts_at, ends_at, services(buffer_before_minutes, buffer_after_minutes)')
      .eq('professional_id', appointment.professional_id)
      .neq('id', appointment.id)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', searchStart.toISOString())
      .lte('starts_at', searchEnd.toISOString())

    const hasConflict = (existingAppointments ?? []).some((apt) => {
      const aptStart = new Date(apt.starts_at)
      const aptEnd = new Date(apt.ends_at)
      const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services
      const aptBufferBefore = Number(aptService?.buffer_before_minutes ?? 0)
      const aptBufferAfter = Number(aptService?.buffer_after_minutes ?? 0)
      const aptProtectedStart = new Date(aptStart.getTime() - aptBufferBefore * 60 * 1000)
      const aptProtectedEnd = new Date(aptEnd.getTime() + aptBufferAfter * 60 * 1000)
      return protectedStart < aptProtectedEnd && protectedEnd > aptProtectedStart
    })

    if (hasConflict) {
      return res.status(409).json({
        error: 'El horario seleccionado ya no está disponible. Por favor elige otro.',
        code: 'SLOT_UNAVAILABLE',
      })
    }

    const previousStartsAt = appointment.starts_at
    const { data: updated, error } = await supabase
      .from('appointments')
      .update({
        starts_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id)
      .select()
      .single()

    if (error || !updated) throw error

    // Notificar al profesional del cambio
    const { data: profData } = await supabase
      .from('professionals')
      .select('name, user_id')
      .eq('id', appointment.professional_id)
      .single()

    let profEmail = 'notificaciones@blinktime.lat'
    if (profData?.user_id) {
      const { data: authData } = await supabase.auth.admin.getUserById(profData.user_id)
      if (authData.user?.email) profEmail = authData.user.email
    }

    const patientContact = { name: appointment.patient_name, email: appointment.patient_email }
    const profContact = { name: profData?.name || 'Profesional', email: profEmail }
    const emailDetails = {
      serviceName,
      startsAt: updated.starts_at,
      endsAt: updated.ends_at,
      token,
    }
    sendAppointmentRescheduledEmailToProfessional(profContact, patientContact, emailDetails, previousStartsAt).catch(console.error)

    res.json({
      message: 'Cita reagendada correctamente',
      appointment: {
        id: updated.id,
        starts_at: updated.starts_at,
        ends_at: updated.ends_at,
        status: updated.status,
      },
    })
  } catch {
    res.status(500).json({ error: 'Error al reagendar la cita', code: 'INTERNAL_ERROR' })
  }
})

// PATCH /api/appointments/cancel/:token — Cancelar cita sin auth
router.patch('/cancel/:token', async (req, res) => {
  try {
    const { token } = req.params
    const { reason } = req.body

    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, status, starts_at')
      .eq('confirmation_token', token)
      .single()

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada', code: 'NOT_FOUND' })
    }

    if (appointment.status === 'cancelled') {
      return res.status(410).json({ error: 'Esta cita ya fue cancelada', code: 'ALREADY_CANCELLED' })
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ error: 'No se puede cancelar una cita completada', code: 'INVALID_STATUS' })
    }

    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || null,
        cancelled_by: 'patient',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointment.id)

    if (error) throw error

    // Fetch details for email
    const { data: fullApt } = await supabase
      .from('appointments')
      .select(`
        patient_name, patient_email, starts_at, ends_at,
        professionals (name, user_id),
        services (name)
      `)
      .eq('id', appointment.id)
      .single()

    if (fullApt) {
      let profEmail = 'notificaciones@blinktime.lat'
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
        endsAt: fullApt.ends_at
      }

      sendAppointmentCancelledEmail(patientContact, profContact, emailDetails, 'patient', reason).catch(console.error)
    }

    res.json({ message: 'Cita cancelada correctamente' })
  } catch {
    res.status(500).json({ error: 'Error al cancelar la cita', code: 'INTERNAL_ERROR' })
  }
})

export default router

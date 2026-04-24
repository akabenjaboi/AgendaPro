import { Router } from 'express'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import {
  sendAppointmentCreatedEmail,
  sendNewRequestEmailToProfessional,
  sendAppointmentCancelledEmail
} from '../services/email'

const router = Router()

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

    // Obtener duración del servicio para calcular ends_at
    let durationMinutes = 60
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', service_id)
        .single()
      if (service) durationMinutes = service.duration_minutes
    }

    const startTime = new Date(starts_at)
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    // Verificar que el slot sigue disponible (prevenir race conditions)
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', professional_id)
      .in('status', ['pending', 'confirmed'])
      .lt('starts_at', endTime.toISOString())
      .gt('ends_at', startTime.toISOString())

    if (existingAppointments && existingAppointments.length > 0) {
      return res.status(409).json({
        error: 'El horario seleccionado ya no está disponible. Por favor elige otro.',
        code: 'SLOT_UNAVAILABLE',
      })
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

    let profEmail = 'noreply@agendapro.com'
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

    // Fire & Forget emails
    sendAppointmentCreatedEmail(patientContact, profContact, emailDetails).catch(console.error)
    sendNewRequestEmailToProfessional(profContact, patientContact, emailDetails).catch(console.error)

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

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { error, json, readPathSegments } from "../_shared/http.ts"
import { supabase } from "../_shared/supabase.ts"
import { canReschedule } from "../_shared/time.ts"
import {
  getProfessionalContact,
  hasSlotConflict,
  serviceTiming,
  validateAppointmentCapacity,
} from "../_shared/appointments.ts"
import {
  sendAppointmentCancelledEmail,
  sendAppointmentCreatedEmail,
  sendAppointmentRescheduledEmailToProfessional,
  sendNewRequestEmailToProfessional,
} from "../_shared/email.ts"

const RESCHEDULE_LIMIT_HOURS_BEFORE = Number(Deno.env.get("RESCHEDULE_LIMIT_HOURS_BEFORE") ?? 24)

function createToken() {
  return crypto.randomUUID()
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const [action, token] = readPathSegments(req, "appointments")

    if (req.method === "POST" && !action) {
      const body = await req.json()
      const {
        professional_id,
        service_id,
        patient_name,
        patient_email,
        patient_phone,
        patient_notes,
        starts_at,
      } = body

      if (!professional_id || !patient_name || !patient_email || !starts_at) {
        return error("Faltan campos obligatorios: professional_id, patient_name, patient_email, starts_at", "VALIDATION_ERROR", 400)
      }

      const timing = await serviceTiming(professional_id, service_id || null)
      const startTime = new Date(starts_at)
      const endTime = new Date(startTime.getTime() + timing.durationMinutes * 60 * 1000)
      const protectedStart = new Date(startTime.getTime() - timing.bufferBeforeMinutes * 60 * 1000)
      const protectedEnd = new Date(endTime.getTime() + timing.bufferAfterMinutes * 60 * 1000)

      const hasConflict = await hasSlotConflict({
        professionalId: professional_id,
        protectedStart,
        protectedEnd,
      })
      if (hasConflict) {
        return error("El horario seleccionado ya no está disponible. Por favor elige otro.", "SLOT_UNAVAILABLE", 409)
      }

      const capacityError = await validateAppointmentCapacity({
        professionalId: professional_id,
        serviceId: service_id || null,
        startsAt: startTime,
      })
      if (capacityError) return json(capacityError, 409)

      const confirmationToken = createToken()
      const { data: appointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          professional_id,
          service_id: service_id || null,
          patient_name: String(patient_name).trim(),
          patient_email: String(patient_email).toLowerCase().trim(),
          patient_phone: patient_phone || null,
          patient_notes: patient_notes || null,
          starts_at: startTime.toISOString(),
          ends_at: endTime.toISOString(),
          status: "pending",
          confirmation_token: confirmationToken,
        })
        .select()
        .single()

      if (insertError || !appointment) throw insertError

      const profContact = await getProfessionalContact(professional_id)
      const patientContact = { name: appointment.patient_name, email: appointment.patient_email }

      await Promise.allSettled([
        sendAppointmentCreatedEmail(patientContact, profContact, {
          serviceName: timing.serviceName,
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
          token: appointment.confirmation_token,
        }),
        sendNewRequestEmailToProfessional(profContact, patientContact, {
          serviceName: timing.serviceName,
          startsAt: appointment.starts_at,
          endsAt: appointment.ends_at,
          token: appointment.confirmation_token,
        }),
      ])

      return json({
        message: "Cita creada exitosamente",
        appointment: {
          id: appointment.id,
          starts_at: appointment.starts_at,
          ends_at: appointment.ends_at,
          status: appointment.status,
          confirmation_token: appointment.confirmation_token,
        },
      }, 201)
    }

    if (action === "cancel" && token && req.method === "GET") {
      const { data, error: dbError } = await supabase
        .from("appointments")
        .select(`
          id, patient_name, patient_email, starts_at, ends_at, status,
          professionals (name, specialty),
          services (name, duration_minutes)
        `)
        .eq("confirmation_token", token)
        .single()

      if (dbError || !data) return error("Cita no encontrada", "NOT_FOUND", 404)
      if (data.status === "cancelled") return error("Esta cita ya fue cancelada", "ALREADY_CANCELLED", 410)
      return json(data)
    }

    if (action === "cancel" && token && req.method === "PATCH") {
      const body = await req.json().catch(() => ({}))
      const reason = body.reason as string | undefined

      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, status, starts_at")
        .eq("confirmation_token", token)
        .single()

      if (!appointment) return error("Cita no encontrada", "NOT_FOUND", 404)
      if (appointment.status === "cancelled") return error("Esta cita ya fue cancelada", "ALREADY_CANCELLED", 410)
      if (appointment.status === "completed") return error("No se puede cancelar una cita completada", "INVALID_STATUS", 400)

      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancellation_reason: reason || null,
          cancelled_by: "patient",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)

      if (updateError) throw updateError

      const { data: fullApt } = await supabase
        .from("appointments")
        .select(`
          patient_name, patient_email, starts_at, ends_at, professional_id,
          services (name)
        `)
        .eq("id", appointment.id)
        .single()

      if (fullApt) {
        const profContact = await getProfessionalContact(fullApt.professional_id)
        const patientContact = { name: fullApt.patient_name, email: fullApt.patient_email }
        await sendAppointmentCancelledEmail(patientContact, profContact, {
          serviceName: (fullApt.services as { name?: string } | null)?.name || "Servicio",
          startsAt: fullApt.starts_at,
          endsAt: fullApt.ends_at,
        }, "patient", reason).catch(console.error)
      }

      return json({ message: "Cita cancelada correctamente" })
    }

    if (action === "reschedule" && token && req.method === "GET") {
      const { data, error: dbError } = await supabase
        .from("appointments")
        .select(`
          id, patient_name, patient_email, starts_at, ends_at, status, service_id,
          professionals (name, specialty, slug),
          services (id, name, duration_minutes, buffer_before_minutes, buffer_after_minutes)
        `)
        .eq("confirmation_token", token)
        .single()

      if (dbError || !data) return error("Cita no encontrada", "NOT_FOUND", 404)
      if (data.status === "cancelled" || data.status === "completed") return error("No se puede reagendar esta cita", "INVALID_STATUS", 400)

      const allowed = canReschedule(data.starts_at, RESCHEDULE_LIMIT_HOURS_BEFORE)
      return json({
        ...data,
        reschedule_limit_hours_before: RESCHEDULE_LIMIT_HOURS_BEFORE,
        can_reschedule: allowed,
        reschedule_deadline: new Date(
          new Date(data.starts_at).getTime() - RESCHEDULE_LIMIT_HOURS_BEFORE * 60 * 60 * 1000,
        ).toISOString(),
      })
    }

    if (action === "reschedule" && token && req.method === "PATCH") {
      const body = await req.json().catch(() => ({}))
      const startsAt = body.starts_at as string | undefined

      if (!startsAt) return error("El nuevo horario es requerido", "VALIDATION_ERROR", 400)

      const { data: appointment } = await supabase
        .from("appointments")
        .select("id, status, starts_at, ends_at, professional_id, service_id, patient_name, patient_email")
        .eq("confirmation_token", token)
        .single()

      if (!appointment) return error("Cita no encontrada", "NOT_FOUND", 404)
      if (appointment.status === "cancelled" || appointment.status === "completed") return error("No se puede reagendar esta cita", "INVALID_STATUS", 400)
      if (!canReschedule(appointment.starts_at, RESCHEDULE_LIMIT_HOURS_BEFORE)) {
        return error(`Solo puedes reagendar hasta ${RESCHEDULE_LIMIT_HOURS_BEFORE} horas antes de la cita`, "RESCHEDULE_WINDOW_CLOSED", 400)
      }

      const newStart = new Date(startsAt)
      if (Number.isNaN(newStart.getTime()) || newStart <= new Date()) {
        return error("El nuevo horario debe ser válido y futuro", "VALIDATION_ERROR", 400)
      }

      const capacityError = await validateAppointmentCapacity({
        professionalId: appointment.professional_id,
        serviceId: appointment.service_id,
        startsAt: newStart,
        excludeAppointmentId: appointment.id,
      })
      if (capacityError) return json(capacityError, 409)

      const timing = await serviceTiming(appointment.professional_id, appointment.service_id)
      const newEnd = new Date(newStart.getTime() + timing.durationMinutes * 60 * 1000)
      const protectedStart = new Date(newStart.getTime() - timing.bufferBeforeMinutes * 60 * 1000)
      const protectedEnd = new Date(newEnd.getTime() + timing.bufferAfterMinutes * 60 * 1000)

      const hasConflict = await hasSlotConflict({
        professionalId: appointment.professional_id,
        protectedStart,
        protectedEnd,
        excludeAppointmentId: appointment.id,
      })
      if (hasConflict) {
        return error("El horario seleccionado ya no está disponible. Por favor elige otro.", "SLOT_UNAVAILABLE", 409)
      }

      const previousStartsAt = appointment.starts_at
      const { data: updated, error: updateError } = await supabase
        .from("appointments")
        .update({
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)
        .select()
        .single()

      if (updateError || !updated) throw updateError

      const profContact = await getProfessionalContact(appointment.professional_id)
      const patientContact = { name: appointment.patient_name, email: appointment.patient_email }
      await sendAppointmentRescheduledEmailToProfessional(
        profContact,
        patientContact,
        {
          serviceName: timing.serviceName,
          startsAt: updated.starts_at,
          endsAt: updated.ends_at,
          token,
        },
        previousStartsAt,
      ).catch(console.error)

      return json({
        message: "Cita reagendada correctamente",
        appointment: {
          id: updated.id,
          starts_at: updated.starts_at,
          ends_at: updated.ends_at,
          status: updated.status,
        },
      })
    }

    return error("Ruta no encontrada", "NOT_FOUND", 404)
  } catch (e) {
    console.error(e)
    return error("Error al procesar solicitud", "INTERNAL_ERROR", 500)
  }
})


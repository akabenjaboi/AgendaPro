import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { error } from "../_shared/http.ts"
import { supabase } from "../_shared/supabase.ts"
import { getProfessionalContact } from "../_shared/appointments.ts"
import { sendAppointmentCancelledEmail } from "../_shared/email.ts"
import { normalizePhone, validateTwilioSignature } from "../_shared/whatsapp.ts"

type ReminderWithAppointment = {
  id: string
  response_token: string
  status: string
  reminder_type: string
  patient_phone: string
  appointments: {
    id: string
    status: string
    patient_name: string
    patient_email: string
    starts_at: string
    ends_at: string
    professional_id: string
    services: { name?: string } | { name?: string }[] | null
  }
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function twiml(message: string): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  })
}

function parseDecision(rawBody: string): "yes" | "no" | null {
  const normalized = rawBody
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

  if (/\bno\b/.test(normalized)) return "no"
  if (/\bsi\b/.test(normalized) || /\byes\b/.test(normalized)) return "yes"
  return null
}

function parseToken(rawBody: string): string | null {
  const match = rawBody.toUpperCase().match(/\b[A-Z0-9]{6,}\b/)
  return match?.[0] ?? null
}

function serviceName(services: ReminderWithAppointment["appointments"]["services"]) {
  const item = Array.isArray(services) ? services[0] : services
  return item?.name || "Servicio"
}

async function resolveReminderByToken(token: string): Promise<ReminderWithAppointment | null> {
  const { data, error: dbError } = await supabase
    .from("whatsapp_reminders")
    .select(`
      id, response_token, status, reminder_type, patient_phone,
      appointments!inner (
        id, status, patient_name, patient_email, starts_at, ends_at, professional_id, services(name)
      )
    `)
    .eq("response_token", token)
    .eq("reminder_type", "attendance_confirmation")
    .maybeSingle()

  if (dbError) throw dbError
  return (data as ReminderWithAppointment | null) ?? null
}

async function resolveReminderByPhone(phone: string): Promise<{ reminder: ReminderWithAppointment | null; ambiguous: boolean }> {
  const { data, error: dbError } = await supabase
    .from("whatsapp_reminders")
    .select(`
      id, response_token, status, reminder_type, patient_phone, sent_at,
      appointments!inner (
        id, status, patient_name, patient_email, starts_at, ends_at, professional_id, services(name)
      )
    `)
    .eq("patient_phone", phone)
    .eq("reminder_type", "attendance_confirmation")
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(5)

  if (dbError) throw dbError
  const rows = (data ?? []) as ReminderWithAppointment[]
  const now = Date.now()
  const active = rows.filter((row) => {
    const startsAt = new Date(row.appointments.starts_at).getTime()
    return startsAt >= now - 12 * 60 * 60 * 1000 && ["pending", "confirmed"].includes(row.appointments.status)
  })

  if (active.length === 0) return { reminder: null, ambiguous: false }
  if (active.length > 1) return { reminder: null, ambiguous: true }
  return { reminder: active[0], ambiguous: false }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return error("Método no permitido", "METHOD_NOT_ALLOWED", 405)

  try {
    const rawBody = await req.text()
    const verifySignature = (Deno.env.get("TWILIO_VALIDATE_SIGNATURE") ?? "true") !== "false"
    if (verifySignature) {
      const valid = await validateTwilioSignature(req, rawBody)
      if (!valid) return error("Firma de Twilio inválida", "UNAUTHORIZED", 401)
    }

    const params = new URLSearchParams(rawBody)
    const from = params.get("From")
    const incomingBody = params.get("Body")?.trim() ?? ""
    if (!from || !incomingBody) {
      return twiml("No pudimos procesar tu respuesta. Intenta nuevamente con SI o NO.")
    }

    const decision = parseDecision(incomingBody)
    if (!decision) {
      return twiml("Respuesta no reconocida. Por favor responde SI para confirmar o NO para cancelar tu cita.")
    }

    const token = parseToken(incomingBody)
    const phone = normalizePhone(from)
    const resolved = token ? { reminder: await resolveReminderByToken(token), ambiguous: false } : await resolveReminderByPhone(phone)

    if (resolved.ambiguous) {
      return twiml("Tienes más de una cita pendiente. Responde incluyendo el codigo del recordatorio. Ejemplo: NO ABC12345")
    }
    if (!resolved.reminder) {
      return twiml("No encontramos una cita pendiente asociada a este mensaje.")
    }

    const reminder = resolved.reminder
    const appointment = reminder.appointments
    if (!["pending", "confirmed"].includes(appointment.status)) {
      return twiml("La cita ya no está disponible para confirmar o cancelar.")
    }

    const nowIso = new Date().toISOString()
    const reminderStatus = decision === "yes" ? "responded_yes" : "responded_no"
    const attendanceResponse = decision === "yes" ? "yes" : "no"

    const { error: reminderUpdateError } = await supabase
      .from("whatsapp_reminders")
      .update({
        status: reminderStatus,
        response_raw: incomingBody,
        responded_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", reminder.id)

    if (reminderUpdateError) throw reminderUpdateError

    if (decision === "yes") {
      const { error: appointmentUpdateError } = await supabase
        .from("appointments")
        .update({
          patient_attendance_response: attendanceResponse,
          patient_attendance_responded_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", appointment.id)

      if (appointmentUpdateError) throw appointmentUpdateError
      return twiml("Gracias. Confirmaste que asistirás a tu cita.")
    }

    const cancellationReason = "Cancelada por paciente vía WhatsApp"
    const { error: appointmentUpdateError } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancelled_by: "patient",
        cancellation_reason: cancellationReason,
        patient_attendance_response: attendanceResponse,
        patient_attendance_responded_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", appointment.id)

    if (appointmentUpdateError) throw appointmentUpdateError

    const professional = await getProfessionalContact(appointment.professional_id)
    const patient = { name: appointment.patient_name, email: appointment.patient_email }
    await sendAppointmentCancelledEmail(
      patient,
      professional,
      {
        serviceName: serviceName(appointment.services),
        startsAt: appointment.starts_at,
        endsAt: appointment.ends_at,
      },
      "patient",
      cancellationReason,
    ).catch(console.error)

    return twiml("Entendido. Tu cita fue cancelada exitosamente.")
  } catch (e) {
    console.error(e)
    return twiml("Ocurrió un error procesando tu respuesta. Intenta nuevamente en unos minutos.")
  }
})

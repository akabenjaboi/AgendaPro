import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { error, json } from "../_shared/http.ts"
import { supabase } from "../_shared/supabase.ts"
import { normalizePhone, sendWhatsAppMessage } from "../_shared/whatsapp.ts"

type AppointmentCandidate = {
  id: string
  professional_id: string
  patient_name: string
  patient_phone: string
  starts_at: string
  services: { name?: string } | { name?: string }[] | null
  professionals?: { timezone?: string | null } | { timezone?: string | null }[] | null
}

function getServiceName(services: AppointmentCandidate["services"]) {
  const item = Array.isArray(services) ? services[0] : services
  return item?.name || "Servicio"
}

function getProfessionalTimezone(
  professionals: AppointmentCandidate["professionals"],
): string {
  const item = Array.isArray(professionals) ? professionals[0] : professionals
  return item?.timezone || "UTC"
}

function createReminderMessage(apt: AppointmentCandidate, responseToken: string): string {
  const when = new Date(apt.starts_at).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: getProfessionalTimezone(apt.professionals),
  })
  return [
    `Hola ${apt.patient_name}, te recordamos tu cita de ${getServiceName(apt.services)} para ${when}.`,
    "Responde SI para confirmar asistencia o NO para cancelar la cita.",
    `Codigo: ${responseToken}`,
  ].join("\n")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok")
  if (req.method !== "POST") return error("Método no permitido", "METHOD_NOT_ALLOWED", 405)

  try {
    const expectedSecret = Deno.env.get("WHATSAPP_REMINDER_SECRET")
    if (!expectedSecret) return error("Falta WHATSAPP_REMINDER_SECRET", "CONFIG_ERROR", 500)
    if (req.headers.get("x-reminder-secret") !== expectedSecret) {
      return error("No autorizado", "UNAUTHORIZED", 401)
    }

    const payload = await req.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>
    const hoursBefore = Number(payload.hours_before ?? Deno.env.get("WHATSAPP_REMINDER_HOURS_BEFORE") ?? 24)
    const windowMinutes = Number(payload.window_minutes ?? Deno.env.get("WHATSAPP_REMINDER_WINDOW_MINUTES") ?? 30)
    const limit = Number(payload.limit ?? 100)

    const now = new Date()
    const from = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000)
    const to = new Date(from.getTime() + windowMinutes * 60 * 1000)

    const { data: candidates, error: candidatesError } = await supabase
      .from("appointments")
      .select("id, professional_id, patient_name, patient_phone, starts_at, services(name), professionals(timezone)")
      .in("status", ["pending", "confirmed"])
      .not("patient_phone", "is", null)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .order("starts_at", { ascending: true })
      .limit(limit)

    if (candidatesError) throw candidatesError
    const list = (candidates ?? []) as AppointmentCandidate[]
    if (list.length === 0) return json({ sent: 0, skipped: 0, errors: [] })

    const appointmentIds = list.map((apt) => apt.id)
    const { data: existingRows, error: existingError } = await supabase
      .from("whatsapp_reminders")
      .select("appointment_id")
      .in("appointment_id", appointmentIds)
      .eq("reminder_type", "attendance_confirmation")

    if (existingError) throw existingError
    const existingIds = new Set((existingRows ?? []).map((row) => row.appointment_id as string))

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const apt of list) {
      if (existingIds.has(apt.id)) {
        skipped += 1
        continue
      }

      const responseToken = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()
      const messageBody = createReminderMessage(apt, responseToken)

      try {
        const normalizedPhone = normalizePhone(apt.patient_phone)
        const twilio = await sendWhatsAppMessage(normalizedPhone, messageBody)
        const { error: insertError } = await supabase
          .from("whatsapp_reminders")
          .insert({
            appointment_id: apt.id,
            professional_id: apt.professional_id,
            patient_phone: normalizedPhone,
            reminder_type: "attendance_confirmation",
            response_token: responseToken,
            message_sid: twilio.sid,
            status: "sent",
          })

        if (insertError) throw insertError
        sent += 1
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e)
        errors.push(`${apt.id}: ${reason}`)
      }
    }

    return json({ sent, skipped, errors })
  } catch (e) {
    console.error(e)
    return error("Error al enviar recordatorios WhatsApp", "INTERNAL_ERROR", 500)
  }
})

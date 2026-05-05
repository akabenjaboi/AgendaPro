import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { error, json, readPathSegments } from "../_shared/http.ts"
import { supabase } from "../_shared/supabase.ts"
import {
  sendAppointmentCancelledEmail,
  sendAppointmentConfirmedEmail,
  sendAppointmentConfirmedEmailToProfessional,
} from "../_shared/email.ts"
import { getProfessionalContact } from "../_shared/appointments.ts"

async function authenticateProfessional(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: error("Token de autenticación requerido", "UNAUTHORIZED", 401) }
  }

  const token = authHeader.split(" ")[1]
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return { errorResponse: error("Token inválido o expirado", "INVALID_TOKEN", 401) }
  }

  const { data: professional, error: profError } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", authData.user.id)
    .single()

  if (profError || !professional) {
    return { errorResponse: error("Acceso restringido a profesionales", "FORBIDDEN", 403) }
  }

  return { professionalId: professional.id }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const auth = await authenticateProfessional(req)
    if (auth.errorResponse) return auth.errorResponse

    const [resource, appointmentId] = readPathSegments(req, "professional")
    if (resource !== "appointments" || !appointmentId || !["PATCH", "DELETE"].includes(req.method)) {
      return error("Ruta no encontrada", "NOT_FOUND", 404)
    }

    if (req.method === "DELETE") {
      const { data: existing, error: getError } = await supabase
        .from("appointments")
        .select("id, status")
        .eq("id", appointmentId)
        .eq("professional_id", auth.professionalId)
        .single()

      if (getError || !existing) return error("Cita no encontrada", "NOT_FOUND", 404)
      if (existing.status !== "cancelled") {
        return error("Solo se pueden eliminar citas canceladas", "INVALID_STATUS", 400)
      }

      const { error: deleteError } = await supabase
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .eq("professional_id", auth.professionalId)

      if (deleteError) throw deleteError
      return json({ message: "Cita eliminada correctamente" })
    }

    const body = await req.json().catch(() => ({}))
    const status = body.status as string | undefined
    const cancellationReason = body.cancellation_reason as string | undefined

    const validStatuses = ["pending", "confirmed", "cancelled", "no_show", "completed"]
    if (status && !validStatuses.includes(status)) {
      return error("Estado inválido", "VALIDATION_ERROR", 400)
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (cancellationReason) updateData.cancellation_reason = cancellationReason
    if (status === "cancelled") updateData.cancelled_by = "professional"

    const { data, error: updateError } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", appointmentId)
      .eq("professional_id", auth.professionalId)
      .select()
      .single()

    if (updateError || !data) return error("Cita no encontrada", "NOT_FOUND", 404)

    if (status === "confirmed" || status === "cancelled") {
      const { data: fullApt } = await supabase
        .from("appointments")
        .select("patient_name, patient_email, starts_at, ends_at, professional_id, services(name), confirmation_token")
        .eq("id", appointmentId)
        .single()

      if (fullApt) {
        const profContact = await getProfessionalContact(fullApt.professional_id)
        const patientContact = { name: fullApt.patient_name, email: fullApt.patient_email }
        const emailDetails = {
          serviceName: (fullApt.services as { name?: string } | null)?.name || "Servicio",
          startsAt: fullApt.starts_at,
          endsAt: fullApt.ends_at,
          token: fullApt.confirmation_token,
        }

        if (status === "confirmed") {
          await Promise.allSettled([
            sendAppointmentConfirmedEmail(patientContact, profContact, emailDetails),
            sendAppointmentConfirmedEmailToProfessional(profContact, patientContact, emailDetails),
          ])
        } else if (status === "cancelled") {
          await sendAppointmentCancelledEmail(patientContact, profContact, emailDetails, "professional", cancellationReason).catch(console.error)
        }
      }
    }

    return json(data)
  } catch (e) {
    console.error(e)
    return error("Error al procesar solicitud", "INTERNAL_ERROR", 500)
  }
})


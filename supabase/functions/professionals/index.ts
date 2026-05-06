import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { supabase } from "../_shared/supabase.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { error, json, readPathSegments } from "../_shared/http.ts"
import { calculateAvailableSlots, rangeForWeekQueries } from "../_shared/availability.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const [slug, action] = readPathSegments(req, "professionals")
    if (!slug) return error("Ruta no encontrada", "NOT_FOUND", 404)

    if (req.method === "GET" && !action) {
      const { data, error: dbError } = await supabase
        .from("professionals")
        .select("id, name, specialty, bio, phone, email, slug, avatar_url, timezone, booking_link_active")
        .eq("slug", slug)
        .eq("booking_link_active", true)
        .single()

      if (dbError || !data) return error("Profesional no encontrado", "NOT_FOUND", 404)
      return json(data)
    }

    if (req.method === "GET" && action === "services") {
      const { data: professional } = await supabase
        .from("professionals")
        .select("id")
        .eq("slug", slug)
        .single()

      if (!professional) return error("Profesional no encontrado", "NOT_FOUND", 404)

      const { data, error: dbError } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, max_appointments_per_week, price, currency")
        .eq("professional_id", professional.id)
        .eq("is_active", true)

      if (dbError) throw dbError
      return json(data ?? [])
    }

    if (req.method === "GET" && action === "availability") {
      const url = new URL(req.url)
      const start = url.searchParams.get("start")
      const end = url.searchParams.get("end")
      const serviceId = url.searchParams.get("service_id")

      if (!start || !end) {
        return error("Parámetros start y end son requeridos", "VALIDATION_ERROR", 400)
      }

      const { data: professional } = await supabase
        .from("professionals")
        .select("id, timezone, max_appointments_per_day, max_appointments_per_week")
        .eq("slug", slug)
        .single()

      if (!professional) return error("Profesional no encontrado", "NOT_FOUND", 404)

      let durationMinutes = 60
      let serviceBufferBefore = 0
      let serviceBufferAfter = 0
      let serviceWeeklyLimit: number | null = null

      if (serviceId) {
        const { data: service } = await supabase
          .from("services")
          .select("duration_minutes, buffer_before_minutes, buffer_after_minutes, max_appointments_per_week")
          .eq("id", serviceId)
          .eq("professional_id", professional.id)
          .single()
        if (service) {
          durationMinutes = service.duration_minutes
          serviceBufferBefore = Number(service.buffer_before_minutes ?? 0)
          serviceBufferAfter = Number(service.buffer_after_minutes ?? 0)
          serviceWeeklyLimit = service.max_appointments_per_week
        }
      }

      const { data: availability } = await supabase
        .from("availability")
        .select("*")
        .eq("professional_id", professional.id)
        .eq("is_active", true)

      const { weekRangeStart, weekRangeEnd } = rangeForWeekQueries(start, end)

      const { data: appointments } = await supabase
        .from("appointments")
        .select("starts_at, ends_at, service_id, services(buffer_before_minutes, buffer_after_minutes)")
        .eq("professional_id", professional.id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", weekRangeStart.toISOString())
        .lte("starts_at", weekRangeEnd.toISOString())

      const { data: blockedSlots } = await supabase
        .from("blocked_slots")
        .select("starts_at, ends_at")
        .eq("professional_id", professional.id)
        .gte("starts_at", `${start}T00:00:00`)
        .lte("ends_at", `${end}T23:59:59`)

      const availableSlots = calculateAvailableSlots({
        availability: availability ?? [],
        appointments: appointments ?? [],
        blockedSlots: blockedSlots ?? [],
        startDate: start,
        endDate: end,
        durationMinutes,
        serviceBufferBefore,
        serviceBufferAfter,
        maxAppointmentsPerDay: professional.max_appointments_per_day,
        maxAppointmentsPerWeek: professional.max_appointments_per_week,
        serviceId: serviceId ?? undefined,
        serviceMaxAppointmentsPerWeek: serviceWeeklyLimit,
        professionalTimezone: professional.timezone || "UTC",
      })

      return json(availableSlots)
    }

    return error("Ruta no encontrada", "NOT_FOUND", 404)
  } catch (e) {
    console.error(e)
    return error("Error al procesar solicitud", "INTERNAL_ERROR", 500)
  }
})


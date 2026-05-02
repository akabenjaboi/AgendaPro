import { supabase } from "./supabase.ts"
import { getEndOfIsoWeek, getStartOfIsoWeek } from "./time.ts"

export async function getProfessionalContact(professionalId: string) {
  const { data: profData } = await supabase
    .from("professionals")
    .select("name, user_id")
    .eq("id", professionalId)
    .single()

  let email = "notificaciones@blinktime.lat"
  if (profData?.user_id) {
    const { data: authData } = await supabase.auth.admin.getUserById(profData.user_id)
    if (authData.user?.email) email = authData.user.email
  }

  return { name: profData?.name || "Profesional", email }
}

export async function serviceTiming(professionalId: string, serviceId: string | null) {
  let durationMinutes = 60
  let bufferBeforeMinutes = 0
  let bufferAfterMinutes = 0
  let serviceName = "Servicio"
  let serviceWeeklyLimit: number | null = null

  if (!serviceId) {
    return { durationMinutes, bufferBeforeMinutes, bufferAfterMinutes, serviceName, serviceWeeklyLimit }
  }

  const { data: service } = await supabase
    .from("services")
    .select("name, duration_minutes, buffer_before_minutes, buffer_after_minutes, max_appointments_per_week")
    .eq("id", serviceId)
    .eq("professional_id", professionalId)
    .single()

  if (service) {
    durationMinutes = service.duration_minutes
    bufferBeforeMinutes = Number(service.buffer_before_minutes ?? 0)
    bufferAfterMinutes = Number(service.buffer_after_minutes ?? 0)
    serviceName = service.name
    serviceWeeklyLimit = service.max_appointments_per_week
  }

  return { durationMinutes, bufferBeforeMinutes, bufferAfterMinutes, serviceName, serviceWeeklyLimit }
}

export async function validateAppointmentCapacity({
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
    .from("professionals")
    .select("max_appointments_per_day, max_appointments_per_week")
    .eq("id", professionalId)
    .single()

  const dayLimit = professional?.max_appointments_per_day ?? null
  const weekLimit = professional?.max_appointments_per_week ?? null

  let serviceWeekLimit: number | null = null
  if (serviceId) {
    const { data: service } = await supabase
      .from("services")
      .select("max_appointments_per_week")
      .eq("id", serviceId)
      .eq("professional_id", professionalId)
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
    .from("appointments")
    .select("id, starts_at, service_id")
    .eq("professional_id", professionalId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", weekStart.toISOString())
    .lte("starts_at", weekEnd.toISOString())

  if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId)

  const { data: appointments } = await query
  const list = appointments ?? []
  const dayCount = list.filter((apt) => {
    const starts = new Date(apt.starts_at).getTime()
    return starts >= dayStart.getTime() && starts <= dayEnd.getTime()
  }).length
  const weekCount = list.length
  const serviceWeekCount = serviceId ? list.filter((apt) => apt.service_id === serviceId).length : 0

  if (dayLimit !== null && dayCount >= dayLimit) {
    return { code: "DAILY_LIMIT_REACHED", error: "No hay cupos disponibles para ese día" }
  }
  if (weekLimit !== null && weekCount >= weekLimit) {
    return { code: "WEEKLY_LIMIT_REACHED", error: "No hay cupos disponibles para esa semana" }
  }
  if (serviceWeekLimit !== null && serviceWeekCount >= serviceWeekLimit) {
    return { code: "SERVICE_WEEKLY_LIMIT_REACHED", error: "Ese servicio alcanzó su límite semanal de citas" }
  }

  return null
}

export async function hasSlotConflict({
  professionalId,
  protectedStart,
  protectedEnd,
  excludeAppointmentId,
}: {
  professionalId: string
  protectedStart: Date
  protectedEnd: Date
  excludeAppointmentId?: string
}) {
  const searchStart = new Date(protectedStart.getTime() - 24 * 60 * 60 * 1000)
  const searchEnd = new Date(protectedEnd.getTime() + 24 * 60 * 60 * 1000)

  let query = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, services(buffer_before_minutes, buffer_after_minutes)")
    .eq("professional_id", professionalId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", searchStart.toISOString())
    .lte("starts_at", searchEnd.toISOString())

  if (excludeAppointmentId) query = query.neq("id", excludeAppointmentId)

  const { data: existingAppointments } = await query

  return (existingAppointments ?? []).some((apt) => {
    const aptStart = new Date(apt.starts_at)
    const aptEnd = new Date(apt.ends_at)
    const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services
    const aptBufferBefore = Number(aptService?.buffer_before_minutes ?? 0)
    const aptBufferAfter = Number(aptService?.buffer_after_minutes ?? 0)
    const aptProtectedStart = new Date(aptStart.getTime() - aptBufferBefore * 60 * 1000)
    const aptProtectedEnd = new Date(aptEnd.getTime() + aptBufferAfter * 60 * 1000)
    return protectedStart < aptProtectedEnd && protectedEnd > aptProtectedStart
  })
}


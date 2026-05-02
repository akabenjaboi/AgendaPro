import { getEndOfIsoWeek, getIsoWeekKey, getStartOfIsoWeek } from "./time.ts"

export function rangeForWeekQueries(start: string, end: string) {
  const rangeStartDate = new Date(`${start}T00:00:00.000Z`)
  const rangeEndDate = new Date(`${end}T23:59:59.999Z`)
  const weekRangeStart = getStartOfIsoWeek(rangeStartDate)
  const weekRangeEnd = getEndOfIsoWeek(rangeEndDate)
  return { weekRangeStart, weekRangeEnd }
}

export function calculateAvailableSlots({
  availability,
  appointments,
  blockedSlots,
  startDate,
  endDate,
  durationMinutes,
  serviceBufferBefore,
  serviceBufferAfter,
  maxAppointmentsPerDay,
  maxAppointmentsPerWeek,
  serviceId,
  serviceMaxAppointmentsPerWeek,
}: {
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>
  appointments: Array<{
    starts_at: string
    ends_at: string
    service_id?: string | null
    services?: { buffer_before_minutes: number | null; buffer_after_minutes: number | null } | Array<{ buffer_before_minutes: number | null; buffer_after_minutes: number | null }> | null
  }>
  blockedSlots: Array<{ starts_at: string; ends_at: string }>
  startDate: string
  endDate: string
  durationMinutes: number
  serviceBufferBefore: number
  serviceBufferAfter: number
  maxAppointmentsPerDay: number | null
  maxAppointmentsPerWeek: number | null
  serviceId?: string
  serviceMaxAppointmentsPerWeek: number | null
}) {
  const slots: Record<string, string[]> = {}
  const dailyCounts = new Map<string, number>()
  const weeklyCounts = new Map<string, number>()
  const weeklyServiceCounts = new Map<string, number>()

  for (const apt of appointments) {
    const aptDate = new Date(apt.starts_at)
    const dayKey = aptDate.toISOString().slice(0, 10)
    const weekKey = getIsoWeekKey(aptDate)
    dailyCounts.set(dayKey, (dailyCounts.get(dayKey) ?? 0) + 1)
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) ?? 0) + 1)
    if (serviceId && apt.service_id === serviceId) {
      weeklyServiceCounts.set(weekKey, (weeklyServiceCounts.get(weekKey) ?? 0) + 1)
    }
  }

  const start = new Date(startDate + "T12:00:00")
  const end = new Date(endDate + "T12:00:00")

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    const dateStr = d.toISOString().split("T")[0]

    const dayAvailability = availability.find((a) => a.day_of_week === dayOfWeek)
    if (!dayAvailability) continue

    const weekKey = getIsoWeekKey(new Date(`${dateStr}T12:00:00.000Z`))
    if (maxAppointmentsPerDay !== null && (dailyCounts.get(dateStr) ?? 0) >= maxAppointmentsPerDay) continue
    if (maxAppointmentsPerWeek !== null && (weeklyCounts.get(weekKey) ?? 0) >= maxAppointmentsPerWeek) continue
    if (serviceId && serviceMaxAppointmentsPerWeek !== null && (weeklyServiceCounts.get(weekKey) ?? 0) >= serviceMaxAppointmentsPerWeek) continue

    const [sh, sm] = dayAvailability.start_time.split(":").map(Number)
    const [eh, em] = dayAvailability.end_time.split(":").map(Number)

    const dayStart = new Date(`${dateStr}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`)
    const dayEnd = new Date(`${dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`)

    const freeSlots: string[] = []
    const current = new Date(dayStart)
    current.setMinutes(current.getMinutes() + serviceBufferBefore)

    while (current.getTime() + (durationMinutes + serviceBufferAfter) * 60_000 <= dayEnd.getTime()) {
      const slotStart = new Date(current)
      const slotEnd = new Date(current.getTime() + durationMinutes * 60_000)
      const slotProtectedStart = new Date(slotStart.getTime() - serviceBufferBefore * 60_000)
      const slotProtectedEnd = new Date(slotEnd.getTime() + serviceBufferAfter * 60_000)

      const hasAppointment = appointments.some((apt) => {
        const aptStart = new Date(apt.starts_at)
        const aptEnd = new Date(apt.ends_at)
        const aptService = Array.isArray(apt.services) ? apt.services[0] : apt.services
        const aptBufferBefore = Number(aptService?.buffer_before_minutes ?? 0)
        const aptBufferAfter = Number(aptService?.buffer_after_minutes ?? 0)
        const aptProtectedStart = new Date(aptStart.getTime() - aptBufferBefore * 60_000)
        const aptProtectedEnd = new Date(aptEnd.getTime() + aptBufferAfter * 60_000)

        return slotProtectedStart < aptProtectedEnd && slotProtectedEnd > aptProtectedStart
      })

      const isBlocked = blockedSlots.some((block) => {
        const blockStart = new Date(block.starts_at)
        const blockEnd = new Date(block.ends_at)
        return slotProtectedStart < blockEnd && slotProtectedEnd > blockStart
      })

      const isInPast = slotStart <= new Date()

      if (!hasAppointment && !isBlocked && !isInPast) {
        freeSlots.push(slotStart.toISOString())
      }

      current.setMinutes(current.getMinutes() + durationMinutes + serviceBufferBefore + serviceBufferAfter)
    }

    if (freeSlots.length > 0) {
      slots[dateStr] = freeSlots
    }
  }

  return slots
}


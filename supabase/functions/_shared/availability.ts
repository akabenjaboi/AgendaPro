import { getEndOfIsoWeek, getIsoWeekKey, getStartOfIsoWeek } from "./time.ts"

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  const hour = read("hour") % 24
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
    second: read("second"),
  }
}

function zonedDateKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

function zonedDayOfWeek(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date)
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return map[short] ?? 0
}

function parseDateKey(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number)
  return { year, month, day }
}

function dateKeyToUtcNoon(dateStr: string): Date {
  const { year, month, day } = parseDateKey(dateStr)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return (asUtc - date.getTime()) / 60_000
}

function zonedDateTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const { year, month, day } = parseDateKey(dateStr)
  const [hour, minute] = timeStr.split(":").map(Number)
  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)

  let utcMs = localAsUtcMs
  for (let i = 0; i < 2; i++) {
    const offset = timeZoneOffsetMinutes(new Date(utcMs), timeZone)
    utcMs = localAsUtcMs - offset * 60_000
  }
  return new Date(utcMs)
}

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
  professionalTimezone,
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
  professionalTimezone: string
}) {
  const slots: Record<string, string[]> = {}
  const dailyCounts = new Map<string, number>()
  const weeklyCounts = new Map<string, number>()
  const weeklyServiceCounts = new Map<string, number>()
  const timeZone = professionalTimezone || "UTC"

  for (const apt of appointments) {
    const aptDate = new Date(apt.starts_at)
    const dayKey = zonedDateKey(aptDate, timeZone)
    const weekKey = getIsoWeekKey(dateKeyToUtcNoon(dayKey))
    dailyCounts.set(dayKey, (dailyCounts.get(dayKey) ?? 0) + 1)
    weeklyCounts.set(weekKey, (weeklyCounts.get(weekKey) ?? 0) + 1)
    if (serviceId && apt.service_id === serviceId) {
      weeklyServiceCounts.set(weekKey, (weeklyServiceCounts.get(weekKey) ?? 0) + 1)
    }
  }

  const startMs = dateKeyToUtcNoon(startDate).getTime()
  const endMs = dateKeyToUtcNoon(endDate).getTime()

  for (let currentMs = startMs; currentMs <= endMs; currentMs += 24 * 60 * 60 * 1000) {
    const loopDate = new Date(currentMs)
    const dateStr = zonedDateKey(loopDate, timeZone)
    const dayOfWeek = zonedDayOfWeek(loopDate, timeZone)

    const dayAvailability = availability.find((a) => a.day_of_week === dayOfWeek)
    if (!dayAvailability) continue

    const weekKey = getIsoWeekKey(dateKeyToUtcNoon(dateStr))
    if (maxAppointmentsPerDay !== null && (dailyCounts.get(dateStr) ?? 0) >= maxAppointmentsPerDay) continue
    if (maxAppointmentsPerWeek !== null && (weeklyCounts.get(weekKey) ?? 0) >= maxAppointmentsPerWeek) continue
    if (serviceId && serviceMaxAppointmentsPerWeek !== null && (weeklyServiceCounts.get(weekKey) ?? 0) >= serviceMaxAppointmentsPerWeek) continue

    const [sh, sm] = dayAvailability.start_time.split(":").map(Number)
    const [eh, em] = dayAvailability.end_time.split(":").map(Number)

    const dayStart = zonedDateTimeToUtc(dateStr, `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`, timeZone)
    const dayEnd = zonedDateTimeToUtc(dateStr, `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`, timeZone)

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


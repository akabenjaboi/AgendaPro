export function getIsoWeekKey(dateInput: Date): string {
  const date = new Date(Date.UTC(
    dateInput.getUTCFullYear(),
    dateInput.getUTCMonth(),
    dateInput.getUTCDate(),
  ))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`
}

export function getStartOfIsoWeek(dateInput: Date): Date {
  const date = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  date.setUTCHours(0, 0, 0, 0)
  return date
}

export function getEndOfIsoWeek(dateInput: Date): Date {
  const start = getStartOfIsoWeek(dateInput)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)
  return end
}

export function canReschedule(startsAt: string, limitHours: number): boolean {
  const startsAtMs = new Date(startsAt).getTime()
  const limitMs = limitHours * 60 * 60 * 1000
  return Date.now() <= startsAtMs - limitMs
}


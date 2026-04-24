import { supabase } from '../lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  id: string
  professional_id: string
  day_of_week: number   // 0=Dom … 6=Sáb
  start_time: string    // "09:00"
  end_time: string      // "18:00"
  is_active: boolean
}

export interface BlockedSlot {
  id: string
  professional_id: string
  starts_at: string     // ISO timestamp
  ends_at: string       // ISO timestamp
  reason: string | null
}

export interface WeekDay {
  day_of_week: number
  label: string
  shortLabel: string
  enabled: boolean
  start_time: string
  end_time: string
}

// ─── Constantes ─────────────────────────────────────────────────────────────

export const WEEK_DAYS: Omit<WeekDay, 'enabled' | 'start_time' | 'end_time'>[] = [
  { day_of_week: 1, label: 'Lunes',     shortLabel: 'Lun' },
  { day_of_week: 2, label: 'Martes',    shortLabel: 'Mar' },
  { day_of_week: 3, label: 'Miércoles', shortLabel: 'Mié' },
  { day_of_week: 4, label: 'Jueves',    shortLabel: 'Jue' },
  { day_of_week: 5, label: 'Viernes',   shortLabel: 'Vie' },
  { day_of_week: 6, label: 'Sábado',    shortLabel: 'Sáb' },
  { day_of_week: 0, label: 'Domingo',   shortLabel: 'Dom' },
]

export const DEFAULT_START = '09:00'
export const DEFAULT_END   = '18:00'

/** Genera las opciones de tiempo cada 30 minutos */
export function generateTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const value = `${hh}:${mm}`
      // Formato 12h para display
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'AM' : 'PM'
      const label = `${String(hour12).padStart(2, '0')}:${mm} ${ampm}`
      options.push({ value, label })
    }
  }
  return options
}

export const TIME_OPTIONS = generateTimeOptions()

// ─── API ─────────────────────────────────────────────────────────────────────

/** Obtiene la disponibilidad semanal del profesional */
export async function getAvailability(professionalId: string): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('professional_id', professionalId)
    .order('day_of_week')

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Reemplaza toda la disponibilidad semanal */
export async function saveAvailability(
  professionalId: string,
  days: WeekDay[]
): Promise<void> {
  // 1. Eliminar slots existentes
  const { error: deleteError } = await supabase
    .from('availability')
    .delete()
    .eq('professional_id', professionalId)

  if (deleteError) throw new Error(deleteError.message)

  // 2. Insertar sólo los días habilitados
  const toInsert = days
    .filter(d => d.enabled)
    .map(d => ({
      professional_id: professionalId,
      day_of_week: d.day_of_week,
      start_time: d.start_time,
      end_time: d.end_time,
      is_active: true,
    }))

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('availability')
      .insert(toInsert)

    if (insertError) throw new Error(insertError.message)
  }
}

/** Obtiene los slots bloqueados futuros */
export async function getBlockedSlots(professionalId: string): Promise<BlockedSlot[]> {
  const { data, error } = await supabase
    .from('blocked_slots')
    .select('*')
    .eq('professional_id', professionalId)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at')

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Agrega un slot bloqueado */
export async function addBlockedSlot(
  professionalId: string,
  startsAt: string,
  endsAt: string,
  reason: string | null
): Promise<BlockedSlot> {
  const { data, error } = await supabase
    .from('blocked_slots')
    .insert({
      professional_id: professionalId,
      starts_at: startsAt,
      ends_at: endsAt,
      reason: reason || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Elimina un slot bloqueado */
export async function removeBlockedSlot(id: string, professionalId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('id', id)
    .eq('professional_id', professionalId)

  if (error) throw new Error(error.message)
}

/** Convierte la respuesta de la BD en el formato WeekDay para el formulario */
export function slotsToWeekDays(slots: AvailabilitySlot[]): WeekDay[] {
  return WEEK_DAYS.map(day => {
    const slot = slots.find(s => s.day_of_week === day.day_of_week)
    return {
      ...day,
      enabled:    !!slot,
      start_time: slot?.start_time ?? DEFAULT_START,
      end_time:   slot?.end_time   ?? DEFAULT_END,
    }
  })
}

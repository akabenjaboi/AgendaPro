import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/professionals/:slug — Perfil público
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name, specialty, bio, phone, email, slug, avatar_url, timezone, booking_link_active')
      .eq('slug', slug)
      .eq('booking_link_active', true)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Profesional no encontrado', code: 'NOT_FOUND' })
    }
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener perfil', code: 'INTERNAL_ERROR' })
  }
})

// GET /api/professionals/:slug/services — Servicios activos
router.get('/:slug/services', async (req, res) => {
  try {
    const { slug } = req.params
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('slug', slug)
      .single()

    if (!professional) return res.status(404).json({ error: 'Profesional no encontrado', code: 'NOT_FOUND' })

    const { data, error } = await supabase
      .from('services')
      .select('id, name, description, duration_minutes, price, currency')
      .eq('professional_id', professional.id)
      .eq('is_active', true)

    if (error) throw error
    res.json(data)
  } catch {
    res.status(500).json({ error: 'Error al obtener servicios', code: 'INTERNAL_ERROR' })
  }
})

// GET /api/professionals/:slug/availability?start=&end=&service_id=
router.get('/:slug/availability', async (req, res) => {
  try {
    const { slug } = req.params
    const { start, end, service_id } = req.query as { start?: string; end?: string; service_id?: string }

    if (!start || !end) {
      return res.status(400).json({ error: 'Parámetros start y end son requeridos', code: 'VALIDATION_ERROR' })
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, timezone')
      .eq('slug', slug)
      .single()

    if (!professional) return res.status(404).json({ error: 'Profesional no encontrado', code: 'NOT_FOUND' })

    // Obtener duración del servicio
    let durationMinutes = 60
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duration_minutes')
        .eq('id', service_id)
        .eq('professional_id', professional.id)
        .single()
      if (service) durationMinutes = service.duration_minutes
    }

    // Obtener disponibilidad semanal
    const { data: availability } = await supabase
      .from('availability')
      .select('*')
      .eq('professional_id', professional.id)
      .eq('is_active', true)

    // Obtener citas existentes en el rango
    const { data: appointments } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('professional_id', professional.id)
      .in('status', ['pending', 'confirmed'])
      .gte('starts_at', `${start}T00:00:00`)
      .lte('starts_at', `${end}T23:59:59`)

    // Obtener bloques bloqueados
    const { data: blockedSlots } = await supabase
      .from('blocked_slots')
      .select('starts_at, ends_at')
      .eq('professional_id', professional.id)
      .gte('starts_at', `${start}T00:00:00`)
      .lte('ends_at', `${end}T23:59:59`)

    // Calcular slots disponibles
    const availableSlots = calculateAvailableSlots({
      availability: availability || [],
      appointments: appointments || [],
      blockedSlots: blockedSlots || [],
      startDate: start,
      endDate: end,
      durationMinutes,
    })

    res.json(availableSlots)
  } catch {
    res.status(500).json({ error: 'Error al calcular disponibilidad', code: 'INTERNAL_ERROR' })
  }
})

/**
 * Calcula los slots de tiempo disponibles para un rango de fechas.
 * 
 * Algoritmo:
 * 1. Para cada día en el rango, verificar si hay disponibilidad ese día de la semana
 * 2. Generar todos los bloques posibles según la duración del servicio
 * 3. Filtrar los bloques que se superponen con citas existentes
 * 4. Filtrar los bloques que se superponen con slots bloqueados
 * 5. Retornar solo los bloques libres
 */
function calculateAvailableSlots({
  availability,
  appointments,
  blockedSlots,
  startDate,
  endDate,
  durationMinutes,
}: {
  availability: Array<{ day_of_week: number; start_time: string; end_time: string }>
  appointments: Array<{ starts_at: string; ends_at: string }>
  blockedSlots: Array<{ starts_at: string; ends_at: string }>
  startDate: string
  endDate: string
  durationMinutes: number
}) {
  const slots: Record<string, string[]> = {}

  // Usar T12:00:00 para evitar bug de zona horaria en getDay()
  const start = new Date(startDate + 'T12:00:00')
  const end   = new Date(endDate   + 'T12:00:00')

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay()
    const dateStr   = d.toISOString().split('T')[0]

    const dayAvailability = availability.find(a => a.day_of_week === dayOfWeek)
    if (!dayAvailability) continue

    // start_time puede venir como "09:00" o "09:00:00"
    const [sh, sm] = dayAvailability.start_time.split(':').map(Number)
    const [eh, em] = dayAvailability.end_time.split(':').map(Number)

    const dayStart = new Date(`${dateStr}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`)
    const dayEnd   = new Date(`${dateStr}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`)

    const freeSlots: string[] = []
    const current = new Date(dayStart)

    while (current.getTime() + durationMinutes * 60_000 <= dayEnd.getTime()) {
      const slotStart = new Date(current)
      const slotEnd   = new Date(current.getTime() + durationMinutes * 60_000)

      const hasAppointment = appointments.some(apt => {
        const aptStart = new Date(apt.starts_at)
        const aptEnd   = new Date(apt.ends_at)
        return slotStart < aptEnd && slotEnd > aptStart
      })

      const isBlocked = blockedSlots.some(block => {
        const blockStart = new Date(block.starts_at)
        const blockEnd   = new Date(block.ends_at)
        return slotStart < blockEnd && slotEnd > blockStart
      })

      const isInPast = slotStart <= new Date()

      if (!hasAppointment && !isBlocked && !isInPast) {
        freeSlots.push(slotStart.toISOString())
      }

      current.setMinutes(current.getMinutes() + durationMinutes)
    }

    if (freeSlots.length > 0) {
      slots[dateStr] = freeSlots
    }
  }

  return slots
}

export default router


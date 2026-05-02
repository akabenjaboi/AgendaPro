import axios from 'axios'
import { formatPrice, formatDuration } from './services'
import { API_BASE } from './apiBase'

const API = API_BASE

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface PublicProfessional {
  id: string
  name: string
  specialty: string | null
  bio: string | null
  email: string
  slug: string
  avatar_url: string | null
  timezone: string
}

export interface PublicService {
  id: string
  name: string
  description: string | null
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  max_appointments_per_week: number | null
  price: number | null
  currency: string
}

/** Mapa fecha → array de ISO timestamps disponibles */
export type AvailabilityMap = Record<string, string[]>

export interface BookingPayload {
  professional_id: string
  service_id: string | null
  patient_name: string
  patient_email: string
  patient_phone: string
  patient_notes: string
  starts_at: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getPublicProfile(slug: string): Promise<PublicProfessional> {
  const { data } = await axios.get(`${API}/professionals/${slug}`)
  return data
}

export async function getPublicServices(slug: string): Promise<PublicService[]> {
  const { data } = await axios.get(`${API}/professionals/${slug}/services`)
  return data
}

/**
 * Consulta los slots disponibles para un rango de fechas.
 * El servidor retorna un mapa: { "2026-04-25": ["2026-04-25T09:00:00.000Z", ...] }
 */
export async function getAvailabilitySlots(
  slug: string,
  start: string,   // YYYY-MM-DD
  end: string,     // YYYY-MM-DD
  serviceId?: string
): Promise<AvailabilityMap> {
  const params: Record<string, string> = { start, end }
  if (serviceId) params.service_id = serviceId
  const { data } = await axios.get(`${API}/professionals/${slug}/availability`, { params })
  return data
}

export async function createAppointment(payload: BookingPayload) {
  const { data } = await axios.post(`${API}/appointments`, payload)
  return data
}

// ─── Helpers de presentación ─────────────────────────────────────────────────

export { formatPrice, formatDuration }

/** Genera el rango de fechas de hoy + N días */
export function getDateRange(daysAhead = 30): { start: string; end: string } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + daysAhead)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

/** Formatea una fecha YYYY-MM-DD a texto legible */
export function formatDate(dateStr: string, locale = 'es-CL'): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Extrae HH:MM de un ISO timestamp */
export function extractTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Iniciales para avatar de texto */
export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

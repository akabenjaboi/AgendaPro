import { supabase } from '../lib/supabase'

export interface Service {
  id: string
  professional_id: string
  name: string
  description: string | null
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  max_appointments_per_week: number | null
  price: number | null
  currency: string
  is_active: boolean
  created_at: string
}

export interface ServicePayload {
  name: string
  description: string | null
  duration_minutes: number
  buffer_before_minutes: number
  buffer_after_minutes: number
  max_appointments_per_week: number | null
  price: number | null
  currency: string
  is_active: boolean
}

export async function getServices(professionalId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('professional_id', professionalId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createService(
  professionalId: string,
  payload: ServicePayload
): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert({ ...payload, professional_id: professionalId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateService(
  id: string,
  professionalId: string,
  payload: Partial<ServicePayload>
): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .eq('professional_id', professionalId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteService(id: string, professionalId: string): Promise<void> {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('professional_id', professionalId)

  if (error) throw new Error(error.message)
}

/** Formatea un precio en CLP con separador de miles */
export function formatPrice(price: number | null, currency = 'CLP'): string {
  if (price === null || price === undefined) return 'Gratis'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

/** Formatea duración en minutos a texto legible */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export const DURATION_OPTIONS = [
  { value: 15,  label: '15 min' },
  { value: 20,  label: '20 min' },
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hora' },
  { value: 75,  label: '1 h 15 min' },
  { value: 90,  label: '1 h 30 min' },
  { value: 120, label: '2 horas' },
  { value: 150, label: '2 h 30 min' },
  { value: 180, label: '3 horas' },
]

export const CURRENCY_OPTIONS = [
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'PEN', label: 'PEN — Sol peruano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
]

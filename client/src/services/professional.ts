import { supabase } from '../lib/supabase'

export interface ProfessionalProfile {
  id: string
  user_id: string
  name: string
  specialty: string | null
  bio: string | null
  phone: string | null
  email: string
  slug: string
  avatar_url: string | null
  timezone: string
  booking_link_active: boolean
  created_at: string
}

export interface UpdateProfilePayload {
  name: string
  specialty: string | null
  bio: string | null
  phone: string | null
  slug: string
  timezone: string
  booking_link_active: boolean
}

/** Obtiene el perfil del profesional autenticado */
export async function getMyProfile(userId: string): Promise<ProfessionalProfile | null> {
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Actualiza el perfil del profesional */
export async function updateProfile(
  professionalId: string,
  payload: UpdateProfilePayload
): Promise<ProfessionalProfile> {
  const { data, error } = await supabase
    .from('professionals')
    .update(payload)
    .eq('id', professionalId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

/** Verifica si un slug ya está en uso (excluyendo el propio) */
export async function isSlugTaken(slug: string, excludeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('professionals')
    .select('id')
    .eq('slug', slug)
    .neq('id', excludeId)
    .maybeSingle()

  return !!data
}

/** Genera un slug URL-safe a partir de un texto */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')      // quitar caracteres especiales
    .replace(/\s+/g, '-')              // espacios → guiones
    .replace(/-+/g, '-')               // guiones dobles → uno
    .replace(/^-|-$/g, '')             // quitar guiones al inicio/fin
}

export const TIMEZONES = [
  { value: 'America/Santiago',       label: 'Santiago, Chile (CLT/CLST)' },
  { value: 'America/Buenos_Aires',   label: 'Buenos Aires, Argentina (ART)' },
  { value: 'America/Bogota',         label: 'Bogotá, Colombia (COT)' },
  { value: 'America/Lima',           label: 'Lima, Perú (PET)' },
  { value: 'America/Mexico_City',    label: 'Ciudad de México (CST)' },
  { value: 'America/Caracas',        label: 'Caracas, Venezuela (VET)' },
  { value: 'America/New_York',       label: 'Nueva York (EST/EDT)' },
  { value: 'Europe/Madrid',          label: 'Madrid, España (CET/CEST)' },
  { value: 'UTC',                    label: 'UTC' },
]

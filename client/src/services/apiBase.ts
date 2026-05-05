const rawBase = import.meta.env.VITE_API_URL || 'https://iuqmpsbgnbcmsuzhgcrb.supabase.co/functions/v1'

export const API_BASE = rawBase.replace(/\/+$/, '')


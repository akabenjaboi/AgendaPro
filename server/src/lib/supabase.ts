import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}

// Cliente con service_role: acceso total, bypasea RLS
// SOLO usar en el servidor, NUNCA en el frontend
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Cliente para validar tokens de usuarios (no bypasea RLS)
export const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)

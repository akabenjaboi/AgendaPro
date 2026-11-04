import { supabase } from "./supabase.ts"
import { error } from "./http.ts"

/** Valida el JWT de Supabase y devuelve el profesional asociado. */
export async function authenticateProfessional(req: Request): Promise<
  { professionalId: string; errorResponse?: undefined } | { professionalId?: undefined; errorResponse: Response }
> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return { errorResponse: error("Token de autenticación requerido", "UNAUTHORIZED", 401) }
  }

  const token = authHeader.split(" ")[1]
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    return { errorResponse: error("Token inválido o expirado", "INVALID_TOKEN", 401) }
  }

  const { data: professional, error: profError } = await supabase
    .from("professionals")
    .select("id")
    .eq("user_id", authData.user.id)
    .single()

  if (profError || !professional) {
    return { errorResponse: error("Acceso restringido a profesionales", "FORBIDDEN", 403) }
  }

  return { professionalId: professional.id }
}

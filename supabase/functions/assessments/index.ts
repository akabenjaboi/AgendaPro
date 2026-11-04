import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { error, json, readPathSegments } from "../_shared/http.ts"
import { supabase } from "../_shared/supabase.ts"
import { authenticateProfessional } from "../_shared/auth.ts"
import { getProfessionalContact } from "../_shared/appointments.ts"
import {
  sendAssessmentCompletedEmailToProfessional,
  sendAssessmentInvitationEmail,
} from "../_shared/email.ts"
import {
  INSTRUMENTS,
  type InstrumentAnswers,
  getInstrument,
  publicInstrument,
  scoreInstrument,
  validateAnswers,
} from "../_shared/instruments.ts"

// Rutas:
//   GET  /assessments/instruments            público    catálogo de tests
//   GET  /assessments/respond/:token         público    test para el paciente
//   POST /assessments/respond/:token         público    enviar respuestas
//   GET  /assessments?patient_email=...      profesional historial del paciente
//   GET  /assessments?appointment_id=...     profesional tests de una cita
//   POST /assessments                        profesional crear y (opcional) enviar por correo
//   POST /assessments/:id/revoke             profesional anular un enlace pendiente

const LINK_VALID_DAYS = 7

type AssignmentRow = {
  id: string
  appointment_id: string | null
  patient_name: string
  patient_email: string
  instrument_codes: string[]
  token: string
  status: "pending" | "completed" | "revoked"
  sent_via_email: boolean
  expires_at: string
  completed_at: string | null
  created_at: string
}

type ResultRow = {
  assignment_id: string
  instrument_code: string
  instrument_version: number
  answers: InstrumentAnswers
  total_score: number
  max_score: number
  severity: string
  flags: Array<{ code: string; itemId: string; value: number; message: string }>
  created_at: string
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function effectiveStatus(a: Pick<AssignmentRow, "status" | "expires_at">) {
  if (a.status === "pending" && new Date(a.expires_at).getTime() < Date.now()) return "expired"
  return a.status
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? ""
}

/** Resultado listo para el profesional: puntaje, severidad y cada respuesta con su texto. */
function presentResult(r: ResultRow) {
  const instrument = getInstrument(r.instrument_code)
  const band = instrument?.bands.find((b) => b.level === r.severity)
  const optionLabel = (value: number) => instrument?.options.find((o) => o.value === value)?.label ?? String(value)
  const extraQuestion = instrument?.extraQuestion
  const extraValue = r.answers?.extra

  return {
    instrument_code: r.instrument_code,
    short_name: instrument?.shortName ?? r.instrument_code,
    name: instrument?.name ?? r.instrument_code,
    total_score: r.total_score,
    max_score: r.max_score,
    severity: r.severity,
    severity_label: band?.label ?? r.severity,
    tier: band?.tier ?? 0,
    flags: r.flags ?? [],
    completed_at: r.created_at,
    items: (instrument?.items ?? []).map((item, i) => ({
      id: item.id,
      text: item.text,
      value: r.answers.items[i],
      label: optionLabel(r.answers.items[i]),
    })),
    extra: extraQuestion && typeof extraValue === "number"
      ? {
        text: extraQuestion.text,
        value: extraValue,
        label: extraQuestion.options.find((o) => o.value === extraValue)?.label ?? String(extraValue),
      }
      : null,
  }
}

async function listForProfessional(professionalId: string, url: URL) {
  const appointmentId = url.searchParams.get("appointment_id")
  const patientEmail = url.searchParams.get("patient_email")?.toLowerCase().trim()
  if (!appointmentId && !patientEmail) {
    return error("Indica appointment_id o patient_email", "VALIDATION_ERROR", 400)
  }

  let query = supabase
    .from("assessment_assignments")
    .select("id, appointment_id, patient_name, patient_email, instrument_codes, token, status, sent_via_email, expires_at, completed_at, created_at")
    .eq("professional_id", professionalId)
    .order("created_at", { ascending: false })
  if (appointmentId) query = query.eq("appointment_id", appointmentId)
  if (patientEmail) query = query.eq("patient_email", patientEmail)

  const { data: assignments, error: dbError } = await query
  if (dbError) throw dbError
  const rows = (assignments ?? []) as AssignmentRow[]

  const ids = rows.map((a) => a.id)
  const { data: results, error: resError } = ids.length
    ? await supabase
      .from("assessment_results")
      .select("assignment_id, instrument_code, instrument_version, answers, total_score, max_score, severity, flags, created_at")
      .in("assignment_id", ids)
    : { data: [], error: null }
  if (resError) throw resError

  const byAssignment = new Map<string, ResultRow[]>()
  for (const r of (results ?? []) as ResultRow[]) {
    byAssignment.set(r.assignment_id, [...(byAssignment.get(r.assignment_id) ?? []), r])
  }

  return json(rows.map((a) => {
    const status = effectiveStatus(a)
    const assignmentResults = byAssignment.get(a.id) ?? []
    return {
      id: a.id,
      appointment_id: a.appointment_id,
      patient_name: a.patient_name,
      patient_email: a.patient_email,
      instrument_codes: a.instrument_codes,
      instrument_names: a.instrument_codes.map((c) => getInstrument(c)?.shortName ?? c),
      status,
      // El enlace solo se expone mientras se puede responder.
      token: status === "pending" ? a.token : null,
      sent_via_email: a.sent_via_email,
      expires_at: a.expires_at,
      completed_at: a.completed_at,
      created_at: a.created_at,
      results: a.instrument_codes
        .map((code) => assignmentResults.find((r) => r.instrument_code === code))
        .filter((r): r is ResultRow => !!r)
        .map(presentResult),
    }
  }))
}

async function createAssignment(professionalId: string, req: Request) {
  const body = await req.json().catch(() => null)
  const appointmentId = body?.appointment_id
  const sendEmail = body?.send_email === true
  const codes: unknown = body?.instrument_codes

  if (!appointmentId || typeof appointmentId !== "string") {
    return error("appointment_id es requerido", "VALIDATION_ERROR", 400)
  }
  if (!Array.isArray(codes) || codes.length === 0 || !codes.every((c) => typeof c === "string" && getInstrument(c))) {
    return error("Selecciona al menos un test válido", "VALIDATION_ERROR", 400)
  }
  const instrumentCodes = [...new Set(codes as string[])]

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id, patient_name, patient_email")
    .eq("id", appointmentId)
    .eq("professional_id", professionalId)
    .single()
  if (!appointment) return error("Cita no encontrada", "NOT_FOUND", 404)

  const expiresAt = new Date(Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000)
  const { data: assignment, error: insertError } = await supabase
    .from("assessment_assignments")
    .insert({
      professional_id: professionalId,
      appointment_id: appointment.id,
      patient_name: appointment.patient_name,
      patient_email: String(appointment.patient_email).toLowerCase().trim(),
      instrument_codes: instrumentCodes,
      token: createToken(),
      expires_at: expiresAt.toISOString(),
    })
    .select("id, token, expires_at")
    .single()
  if (insertError || !assignment) throw insertError

  let emailSent = false
  if (sendEmail) {
    try {
      const [professional, { data: prof }] = await Promise.all([
        getProfessionalContact(professionalId),
        supabase.from("professionals").select("timezone").eq("id", professionalId).single(),
      ])
      await sendAssessmentInvitationEmail(
        { name: appointment.patient_name, email: appointment.patient_email },
        professional,
        {
          token: assignment.token,
          instrumentNames: instrumentCodes.map((c) => getInstrument(c)!.shortName),
          expiresAt: assignment.expires_at,
          timezone: prof?.timezone ?? undefined,
        },
      )
      emailSent = true
      await supabase.from("assessment_assignments").update({ sent_via_email: true }).eq("id", assignment.id)
    } catch (e) {
      console.error("No se pudo enviar el correo del test", e)
    }
  }

  return json({
    id: assignment.id,
    token: assignment.token,
    expires_at: assignment.expires_at,
    email_sent: emailSent,
  }, 201)
}

async function revokeAssignment(professionalId: string, assignmentId: string) {
  const { data, error: dbError } = await supabase
    .from("assessment_assignments")
    .update({ status: "revoked" })
    .eq("id", assignmentId)
    .eq("professional_id", professionalId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle()
  if (dbError) throw dbError
  if (!data) return error("El test no existe o ya no está pendiente", "NOT_FOUND", 404)
  return json({ id: data.id, status: "revoked" })
}

async function loadAssignmentByToken(token: string) {
  const { data } = await supabase
    .from("assessment_assignments")
    .select("id, professional_id, patient_name, instrument_codes, status, expires_at")
    .eq("token", token)
    .maybeSingle()
  return data as (Pick<AssignmentRow, "id" | "patient_name" | "instrument_codes" | "status" | "expires_at"> & { professional_id: string }) | null
}

function tokenStateError(status: string) {
  if (status === "completed") return error("Este cuestionario ya fue respondido", "ALREADY_COMPLETED", 409)
  if (status === "expired") return error("El enlace venció", "EXPIRED", 410)
  if (status === "revoked") return error("El enlace fue anulado", "REVOKED", 410)
  return null
}

async function getForPatient(token: string) {
  const assignment = await loadAssignmentByToken(token)
  if (!assignment) return error("Enlace no válido", "NOT_FOUND", 404)
  const stateError = tokenStateError(effectiveStatus(assignment))
  if (stateError) return stateError

  const { data: professional } = await supabase
    .from("professionals")
    .select("name, specialty")
    .eq("id", assignment.professional_id)
    .single()

  return json({
    patient_first_name: firstName(assignment.patient_name),
    professional: { name: professional?.name ?? "Tu profesional", specialty: professional?.specialty ?? null },
    instruments: assignment.instrument_codes.map((c) => getInstrument(c)).filter((i) => !!i).map((i) => publicInstrument(i!)),
  })
}

async function submitFromPatient(token: string, req: Request) {
  const assignment = await loadAssignmentByToken(token)
  if (!assignment) return error("Enlace no válido", "NOT_FOUND", 404)
  const stateError = tokenStateError(effectiveStatus(assignment))
  if (stateError) return stateError

  const body = await req.json().catch(() => null)
  if (body?.consent !== true) {
    return error("Debes aceptar compartir tus respuestas para continuar", "CONSENT_REQUIRED", 400)
  }
  const answers = body?.answers ?? {}

  const rows = []
  const flaggedNames: string[] = []
  for (const code of assignment.instrument_codes) {
    const instrument = getInstrument(code)
    if (!instrument) continue
    const validation = validateAnswers(instrument, answers[code])
    if (validation) return error(validation, "VALIDATION_ERROR", 400)

    const items = answers[code].items as number[]
    const extra = instrument.extraQuestion && typeof answers[code].extra === "number" &&
        (!instrument.extraQuestion.onlyIfAnyPositive || items.some((v) => v > 0))
      ? answers[code].extra as number
      : null
    const score = scoreInstrument(instrument, { items, extra })
    if (score.flags.length > 0) flaggedNames.push(instrument.shortName)

    rows.push({
      assignment_id: assignment.id,
      professional_id: assignment.professional_id,
      instrument_code: instrument.code,
      instrument_version: instrument.version,
      answers: { items, extra },
      total_score: score.total,
      max_score: score.max,
      severity: score.severity,
      flags: score.flags,
    })
  }

  // La restricción unique(assignment_id, instrument_code) evita respuestas duplicadas
  // si el paciente envía dos veces al mismo tiempo.
  const { error: insertError } = await supabase.from("assessment_results").insert(rows)
  if (insertError) {
    if (insertError.code === "23505") return error("Este cuestionario ya fue respondido", "ALREADY_COMPLETED", 409)
    throw insertError
  }

  const now = new Date().toISOString()
  await supabase
    .from("assessment_assignments")
    .update({ status: "completed", completed_at: now, consent_at: now })
    .eq("id", assignment.id)

  const urgent = flaggedNames.length > 0
  try {
    const professional = await getProfessionalContact(assignment.professional_id)
    await sendAssessmentCompletedEmailToProfessional(professional, assignment.patient_name, {
      instrumentNames: assignment.instrument_codes.map((c) => getInstrument(c)?.shortName ?? c),
      urgent,
    })
  } catch (e) {
    console.error("No se pudo notificar al profesional", e)
  }

  // El paciente no ve puntajes. Solo se le muestran recursos de apoyo si
  // respondió afirmativamente a una pregunta de riesgo.
  return json({ ok: true, show_support_resources: urgent })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const [first, second] = readPathSegments(req, "assessments")

    // ── Rutas públicas ──────────────────────────────────────────────────────
    if (first === "instruments" && req.method === "GET") {
      return json(Object.values(INSTRUMENTS).map((i) => ({
        code: i.code,
        short_name: i.shortName,
        name: i.name,
        description: i.description,
        item_count: i.items.length,
      })))
    }
    if (first === "respond" && second) {
      if (req.method === "GET") return await getForPatient(second)
      if (req.method === "POST") return await submitFromPatient(second, req)
      return error("Método no permitido", "METHOD_NOT_ALLOWED", 405)
    }

    // ── Rutas del profesional ───────────────────────────────────────────────
    const auth = await authenticateProfessional(req)
    if (auth.errorResponse) return auth.errorResponse

    if (!first && req.method === "GET") return await listForProfessional(auth.professionalId, url)
    if (!first && req.method === "POST") return await createAssignment(auth.professionalId, req)
    if (first && second === "revoke" && req.method === "POST") {
      return await revokeAssignment(auth.professionalId, first)
    }

    return error("Ruta no encontrada", "NOT_FOUND", 404)
  } catch (e) {
    console.error(e)
    return error("Error al procesar solicitud", "INTERNAL_ERROR", 500)
  }
})

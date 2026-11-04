import axios from 'axios'
import api from './api'
import { API_BASE } from './apiBase'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface InstrumentSummary {
  code: string
  short_name: string
  name: string
  description: string
  item_count: number
}

export interface AssessmentFlag {
  code: string
  itemId: string
  value: number
  message: string
}

export interface AssessmentResult {
  instrument_code: string
  short_name: string
  name: string
  total_score: number
  max_score: number
  severity: string
  severity_label: string
  tier: number
  flags: AssessmentFlag[]
  completed_at: string
  items: { id: string; text: string; value: number; label: string }[]
  extra: { text: string; value: number; label: string } | null
}

export type AssessmentStatus = 'pending' | 'completed' | 'revoked' | 'expired'

export interface AssessmentAssignment {
  id: string
  appointment_id: string | null
  patient_name: string
  patient_email: string
  instrument_codes: string[]
  instrument_names: string[]
  status: AssessmentStatus
  token: string | null
  sent_via_email: boolean
  expires_at: string
  completed_at: string | null
  created_at: string
  results: AssessmentResult[]
}

export interface CreatedAssessment {
  id: string
  token: string
  expires_at: string
  email_sent: boolean
}

export interface PublicInstrument {
  code: string
  shortName: string
  name: string
  instructions: string
  options: { value: number; label: string }[]
  items: { id: string; text: string }[]
  extraQuestion: {
    id: string
    text: string
    options: { value: number; label: string }[]
    onlyIfAnyPositive: boolean
  } | null
  citation: string
}

export interface PublicAssessment {
  patient_first_name: string
  professional: { name: string; specialty: string | null }
  instruments: PublicInstrument[]
}

export type PatientAnswers = Record<string, { items: number[]; extra: number | null }>

// ─── Profesional (requiere sesión) ───────────────────────────────────────────

export async function listInstruments(): Promise<InstrumentSummary[]> {
  const { data } = await api.get('/assessments/instruments')
  return data
}

export async function listPatientAssessments(patientEmail: string): Promise<AssessmentAssignment[]> {
  const { data } = await api.get('/assessments', { params: { patient_email: patientEmail } })
  return data
}

export async function createAssessment(payload: {
  appointment_id: string
  instrument_codes: string[]
  send_email: boolean
}): Promise<CreatedAssessment> {
  const { data } = await api.post('/assessments', payload)
  return data
}

export async function revokeAssessment(id: string): Promise<void> {
  await api.post(`/assessments/${id}/revoke`)
}

export function assessmentLink(token: string): string {
  return `${window.location.origin}/test/${token}`
}

// ─── Paciente (público, sin cuenta) ──────────────────────────────────────────

export async function getPublicAssessment(token: string): Promise<PublicAssessment> {
  const { data } = await axios.get(`${API_BASE}/assessments/respond/${token}`)
  return data
}

export async function submitPublicAssessment(
  token: string,
  answers: PatientAnswers,
): Promise<{ ok: true; show_support_resources: boolean }> {
  const { data } = await axios.post(`${API_BASE}/assessments/respond/${token}`, { consent: true, answers })
  return data
}

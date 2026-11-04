// Definiciones de instrumentos psicométricos y su corrección automática.
//
// Cada instrumento es un objeto de datos (preguntas, opciones, rangos de
// severidad, alertas). `scoreInstrument` es genérico: agregar un test nuevo
// significa agregar una definición, no programar lógica nueva.
//
// Este archivo no importa nada para poder testearse con Node y Deno.

export interface InstrumentOption {
  value: number
  label: string
}

export interface InstrumentItem {
  id: string
  text: string
}

export interface SeverityBand {
  min: number
  max: number
  level: string // clave estable, p.ej. "moderate"
  label: string // etiqueta en español para el profesional
  tier: 0 | 1 | 2 | 3 | 4 // 0 = mínima … 4 = máxima (para colores)
}

export interface FlagRule {
  code: string
  itemId: string
  minValue: number
  message: string
}

export interface ExtraQuestion {
  id: string
  text: string
  options: InstrumentOption[]
  /** Solo se pregunta si alguna respuesta de los ítems es > 0. */
  onlyIfAnyPositive: boolean
}

export interface Instrument {
  code: string
  version: number
  name: string
  shortName: string
  description: string
  instructions: string
  options: InstrumentOption[]
  items: InstrumentItem[]
  bands: SeverityBand[]
  flags: FlagRule[]
  extraQuestion?: ExtraQuestion
  citation: string
}

export interface InstrumentAnswers {
  items: number[]
  extra?: number | null
}

export interface ScoreFlag {
  code: string
  itemId: string
  value: number
  message: string
}

export interface InstrumentScore {
  total: number
  max: number
  severity: string
  severityLabel: string
  tier: number
  flags: ScoreFlag[]
}

const FREQUENCY_OPTIONS: InstrumentOption[] = [
  { value: 0, label: "Ningún día" },
  { value: 1, label: "Varios días" },
  { value: 2, label: "Más de la mitad de los días" },
  { value: 3, label: "Casi todos los días" },
]

const FREQUENCY_INSTRUCTIONS =
  "Durante las últimas 2 semanas, ¿qué tan seguido ha tenido molestias debido a los siguientes problemas?"

// Versión oficial en español (EE. UU.) de Pfizer / Spitzer, Williams, Kroenke.
export const PHQ9: Instrument = {
  code: "phq9",
  version: 1,
  name: "Cuestionario sobre la salud del paciente-9 (PHQ-9)",
  shortName: "PHQ-9",
  description: "Tamizaje y severidad de síntomas depresivos",
  instructions: FREQUENCY_INSTRUCTIONS,
  options: FREQUENCY_OPTIONS,
  items: [
    { id: "1", text: "Poco interés o placer en hacer cosas" },
    { id: "2", text: "Se ha sentido decaído(a), deprimido(a) o sin esperanzas" },
    { id: "3", text: "Ha tenido dificultad para quedarse o permanecer dormido(a), o ha dormido demasiado" },
    { id: "4", text: "Se ha sentido cansado(a) o con poca energía" },
    { id: "5", text: "Sin apetito o ha comido en exceso" },
    { id: "6", text: "Se ha sentido mal con usted mismo(a) – o que es un fracaso o que ha quedado mal con usted mismo(a) o con su familia" },
    { id: "7", text: "Ha tenido dificultad para concentrarse en ciertas actividades, tales como leer el periódico o ver la televisión" },
    { id: "8", text: "¿Se ha movido o hablado tan lento que otras personas podrían haberlo notado? O lo contrario – muy inquieto(a) o agitado(a) que ha estado moviéndose mucho más de lo normal" },
    { id: "9", text: "Pensamientos de que estaría mejor muerto(a) o de lastimarse de alguna manera" },
  ],
  bands: [
    { min: 0, max: 4, level: "minimal", label: "Mínima", tier: 0 },
    { min: 5, max: 9, level: "mild", label: "Leve", tier: 1 },
    { min: 10, max: 14, level: "moderate", label: "Moderada", tier: 2 },
    { min: 15, max: 19, level: "moderately_severe", label: "Moderadamente severa", tier: 3 },
    { min: 20, max: 27, level: "severe", label: "Severa", tier: 4 },
  ],
  flags: [
    {
      code: "suicidal_ideation",
      itemId: "9",
      minValue: 1,
      message: "Respuesta positiva en el ítem 9 (pensamientos de muerte o de hacerse daño). Requiere evaluación de riesgo.",
    },
  ],
  extraQuestion: {
    id: "difficulty",
    text: "Si marcó cualquiera de los problemas, ¿qué tanta dificultad le han dado estos problemas para hacer su trabajo, encargarse de las tareas del hogar, o llevarse bien con otras personas?",
    options: [
      { value: 0, label: "No ha sido difícil" },
      { value: 1, label: "Un poco difícil" },
      { value: 2, label: "Muy difícil" },
      { value: 3, label: "Extremadamente difícil" },
    ],
    onlyIfAnyPositive: true,
  },
  citation:
    "Elaborado por los doctores Robert L. Spitzer, Janet B. W. Williams, Kurt Kroenke y colegas. PRIME-MD® es una marca registrada de Pfizer Inc. Copyright © 1999 Pfizer Inc.",
}

// Versión oficial en español (EE. UU.) de Pfizer / Spitzer, Williams, Kroenke.
export const GAD7: Instrument = {
  code: "gad7",
  version: 1,
  name: "Escala de ansiedad generalizada (GAD-7)",
  shortName: "GAD-7",
  description: "Tamizaje y severidad de síntomas de ansiedad",
  instructions: FREQUENCY_INSTRUCTIONS,
  options: FREQUENCY_OPTIONS,
  items: [
    { id: "1", text: "Se ha sentido nervioso(a), ansioso(a) o con los nervios de punta" },
    { id: "2", text: "No ha sido capaz de parar o controlar su preocupación" },
    { id: "3", text: "Se ha preocupado demasiado por motivos diferentes" },
    { id: "4", text: "Ha tenido dificultad para relajarse" },
    { id: "5", text: "Se ha sentido tan inquieto(a) que no ha podido quedarse quieto(a)" },
    { id: "6", text: "Se ha molestado o irritado fácilmente" },
    { id: "7", text: "Ha tenido miedo de que algo terrible fuera a pasar" },
  ],
  bands: [
    { min: 0, max: 4, level: "minimal", label: "Mínima", tier: 0 },
    { min: 5, max: 9, level: "mild", label: "Leve", tier: 1 },
    { min: 10, max: 14, level: "moderate", label: "Moderada", tier: 2 },
    { min: 15, max: 21, level: "severe", label: "Severa", tier: 4 },
  ],
  flags: [],
  citation:
    "Elaborado por los doctores Robert L. Spitzer, Janet B. W. Williams, Kurt Kroenke y colegas, mediante una subvención educativa otorgada por Pfizer Inc. No se requiere permiso para reproducir, traducir, presentar o distribuir.",
}

export const INSTRUMENTS: Record<string, Instrument> = {
  [PHQ9.code]: PHQ9,
  [GAD7.code]: GAD7,
}

export function getInstrument(code: string): Instrument | null {
  return Object.prototype.hasOwnProperty.call(INSTRUMENTS, code) ? INSTRUMENTS[code] : null
}

/** Valida respuestas; devuelve un mensaje de error o null si son válidas. */
export function validateAnswers(instrument: Instrument, answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return `Faltan respuestas para ${instrument.shortName}`
  const { items, extra } = answers as Record<string, unknown>

  if (!Array.isArray(items) || items.length !== instrument.items.length) {
    return `${instrument.shortName}: se esperaban ${instrument.items.length} respuestas`
  }
  const allowed = new Set(instrument.options.map((o) => o.value))
  if (!items.every((v) => typeof v === "number" && allowed.has(v))) {
    return `${instrument.shortName}: hay respuestas con valores inválidos`
  }

  if (instrument.extraQuestion && extra !== undefined && extra !== null) {
    const extraAllowed = new Set(instrument.extraQuestion.options.map((o) => o.value))
    if (typeof extra !== "number" || !extraAllowed.has(extra)) {
      return `${instrument.shortName}: respuesta adicional inválida`
    }
  }
  return null
}

/** Corrige un instrumento. Asume respuestas ya validadas con `validateAnswers`. */
export function scoreInstrument(instrument: Instrument, answers: InstrumentAnswers): InstrumentScore {
  const total = answers.items.reduce((sum, v) => sum + v, 0)
  const maxOption = Math.max(...instrument.options.map((o) => o.value))
  const max = maxOption * instrument.items.length

  const band = instrument.bands.find((b) => total >= b.min && total <= b.max)
  if (!band) throw new Error(`Puntaje fuera de rango para ${instrument.code}: ${total}`)

  const flags: ScoreFlag[] = []
  for (const rule of instrument.flags) {
    const index = instrument.items.findIndex((item) => item.id === rule.itemId)
    const value = answers.items[index]
    if (index >= 0 && value >= rule.minValue) {
      flags.push({ code: rule.code, itemId: rule.itemId, value, message: rule.message })
    }
  }

  return { total, max, severity: band.level, severityLabel: band.label, tier: band.tier, flags }
}

/** Versión pública (para el paciente): sin rangos ni reglas de alerta. */
export function publicInstrument(instrument: Instrument) {
  return {
    code: instrument.code,
    shortName: instrument.shortName,
    name: instrument.name,
    instructions: instrument.instructions,
    options: instrument.options,
    items: instrument.items,
    extraQuestion: instrument.extraQuestion ?? null,
    citation: instrument.citation,
  }
}

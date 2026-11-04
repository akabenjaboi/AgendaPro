import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Calendar, CheckCircle, AlertTriangle, XCircle, Loader2, ArrowLeft, ClipboardList, Heart, Phone,
} from 'lucide-react'
import {
  getPublicAssessment, submitPublicAssessment,
  type PublicAssessment, type PatientAnswers,
} from '../../services/assessments'

type PageState =
  | 'loading' | 'intro' | 'questions' | 'review' | 'submitting' | 'done'
  | 'not_found' | 'completed' | 'expired' | 'error'

type Step =
  | { kind: 'item'; instrument: number; item: number }
  | { kind: 'extra'; instrument: number }

export default function AssessmentPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>(token ? 'loading' : 'not_found')
  const [data, setData] = useState<PublicAssessment | null>(null)
  const [consent, setConsent] = useState(false)
  const [answers, setAnswers] = useState<PatientAnswers>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [showSupport, setShowSupport] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    getPublicAssessment(token)
      .then(res => {
        setData(res)
        setAnswers(Object.fromEntries(res.instruments.map(i => [
          i.code, { items: Array(i.items.length).fill(-1), extra: null },
        ])))
        setState('intro')
      })
      .catch(err => {
        const code = err.response?.data?.code
        if (code === 'NOT_FOUND') setState('not_found')
        else if (code === 'ALREADY_COMPLETED') setState('completed')
        else if (code === 'EXPIRED' || code === 'REVOKED') setState('expired')
        else setState('error')
      })
  }, [token])

  // Los pasos dependen de las respuestas: la pregunta adicional del PHQ-9
  // solo aparece si el paciente marcó algún problema.
  const steps = useMemo<Step[]>(() => {
    if (!data) return []
    const list: Step[] = []
    data.instruments.forEach((ins, i) => {
      ins.items.forEach((_, j) => list.push({ kind: 'item', instrument: i, item: j }))
      if (ins.extraQuestion) {
        const anyPositive = (answers[ins.code]?.items ?? []).some(v => v > 0)
        if (!ins.extraQuestion.onlyIfAnyPositive || anyPositive) {
          list.push({ kind: 'extra', instrument: i })
        }
      }
    })
    return list
  }, [data, answers])

  // Referencia a los pasos actuales: tras responder, la lista puede crecer
  // (p.ej. aparece la pregunta adicional) y el avance debe verla.
  const stepsRef = useRef<Step[]>(steps)
  useEffect(() => { stepsRef.current = steps }, [steps])

  const advancingRef = useRef(false)

  const choose = (step: Step, value: number) => {
    if (!data || advancingRef.current) return
    advancingRef.current = true
    const code = data.instruments[step.instrument].code
    setAnswers(prev => {
      const current = prev[code]
      const next = step.kind === 'item'
        ? { ...current, items: current.items.map((v, i) => (i === step.item ? value : v)) }
        : { ...current, extra: value }
      return { ...prev, [code]: next }
    })
    // Avanza solo, con una pequeña pausa para que se vea la opción elegida.
    setTimeout(() => {
      advancingRef.current = false
      setStepIndex(i => {
        if (i >= stepsRef.current.length - 1) { setState('review'); return i }
        return i + 1
      })
    }, 180)
  }

  const submit = async () => {
    if (!token || !data) return
    setState('submitting')
    setSubmitError(null)
    try {
      const payload: PatientAnswers = {}
      for (const ins of data.instruments) {
        const a = answers[ins.code]
        const anyPositive = a.items.some(v => v > 0)
        const keepExtra = ins.extraQuestion && (!ins.extraQuestion.onlyIfAnyPositive || anyPositive)
        payload[ins.code] = { items: a.items, extra: keepExtra ? a.extra : null }
      }
      const res = await submitPublicAssessment(token, payload)
      setShowSupport(res.show_support_resources)
      setState('done')
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } }).response?.data?.code
      if (code === 'ALREADY_COMPLETED') { setState('completed'); return }
      if (code === 'EXPIRED' || code === 'REVOKED') { setState('expired'); return }
      setSubmitError('No pudimos enviar tus respuestas. Revisa tu conexión e inténtalo de nuevo.')
      setState('review')
    }
  }

  // ── Estados simples ──────────────────────────────────────────────────────
  if (state === 'loading') return (
    <Shell>
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Shell>
  )
  if (state === 'not_found') return (
    <Shell><StateCard icon={<AlertTriangle className="w-10 h-10 text-amber-400" />} bg="bg-amber-500/10"
      title="Enlace no válido" message="Revisa que hayas copiado el enlace completo o pide uno nuevo a tu profesional." /></Shell>
  )
  if (state === 'completed') return (
    <Shell><StateCard icon={<CheckCircle className="w-10 h-10 text-green-400" />} bg="bg-green-500/10"
      title="Ya respondiste este cuestionario" message="Tus respuestas ya fueron enviadas. No necesitas hacer nada más." /></Shell>
  )
  if (state === 'expired') return (
    <Shell><StateCard icon={<XCircle className="w-10 h-10 text-slate-500" />} bg="bg-slate-100"
      title="Este enlace ya no está disponible" message="El enlace venció o fue anulado. Si necesitas responder, pide uno nuevo a tu profesional." /></Shell>
  )
  if (state === 'error' || !data) return (
    <Shell><StateCard icon={<XCircle className="w-10 h-10 text-red-400" />} bg="bg-red-500/10"
      title="Error" message="Ocurrió un error. Por favor intenta nuevamente más tarde." /></Shell>
  )

  if (state === 'done') return (
    <Shell>
      <div className="space-y-4">
        <StateCard icon={<CheckCircle className="w-10 h-10 text-green-400" />} bg="bg-green-500/10"
          title="¡Gracias!" message={`Tus respuestas fueron enviadas a ${data.professional.name}. Ya puedes cerrar esta página.`} />
        {showSupport && <SupportResources />}
      </div>
    </Shell>
  )

  // ── Introducción y consentimiento ────────────────────────────────────────
  if (state === 'intro') {
    const totalQuestions = data.instruments.reduce((n, i) => n + i.items.length, 0)
    return (
      <Shell>
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Hola{data.patient_first_name ? `, ${data.patient_first_name}` : ''}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {data.professional.name} te pide responder {data.instruments.length === 1 ? 'un breve cuestionario' : 'unos breves cuestionarios'}.
            </p>
          </div>

          <div className="card p-5 space-y-3">
            {data.instruments.map(ins => (
              <div key={ins.code} className="flex items-start gap-2 text-sm text-slate-700">
                <ClipboardList size={14} className="text-brand-600 shrink-0 mt-0.5" />
                <span>{ins.name} · {ins.items.length} preguntas</span>
              </div>
            ))}
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-200/60">
              {totalQuestions} preguntas en total · toma unos {Math.max(2, Math.ceil(totalQuestions / 4))} minutos.
              No hay respuestas buenas ni malas: responde según cómo te has sentido.
            </p>
          </div>

          <label className="flex items-start gap-3 card p-4 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand-600"
            />
            <span className="text-sm text-slate-700">
              Acepto que mis respuestas sean enviadas a {data.professional.name} y almacenadas de forma
              confidencial para mi atención. Solo mi profesional podrá verlas.
            </span>
          </label>

          <button
            onClick={() => { setStepIndex(0); setState('questions') }}
            disabled={!consent}
            className="btn-primary w-full justify-center py-3"
          >
            Comenzar
          </button>
        </div>
      </Shell>
    )
  }

  // ── Revisión y envío ─────────────────────────────────────────────────────
  if (state === 'review' || state === 'submitting') {
    return (
      <Shell>
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Listo para enviar</h1>
            <p className="text-slate-600 text-sm mt-1">
              Respondiste todas las preguntas. Puedes volver atrás para cambiar alguna respuesta antes de enviar.
            </p>
          </div>
          {submitError && (
            <div className="card p-4 border-red-200 bg-red-50 text-sm text-red-700">{submitError}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setStepIndex(steps.length - 1); setState('questions') }}
              disabled={state === 'submitting'}
              className="btn-secondary flex-1 justify-center"
            >
              <ArrowLeft size={14} /> Revisar
            </button>
            <button onClick={submit} disabled={state === 'submitting'} className="btn-primary flex-1 justify-center">
              {state === 'submitting' ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : 'Enviar respuestas'}
            </button>
          </div>
        </div>
      </Shell>
    )
  }

  // ── Preguntas, una por pantalla ──────────────────────────────────────────
  const step = steps[Math.min(stepIndex, steps.length - 1)]
  const instrument = data.instruments[step.instrument]
  const current = answers[instrument.code]
  const selected = step.kind === 'item' ? current.items[step.item] : current.extra
  const question = step.kind === 'item' ? instrument.items[step.item].text : instrument.extraQuestion!.text
  const options = step.kind === 'item' ? instrument.options : instrument.extraQuestion!.options
  const progress = Math.round((stepIndex / steps.length) * 100)

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{instrument.shortName}</span>
            <span>{stepIndex + 1} de {steps.length}</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          {step.kind === 'item' && (
            <p className="text-xs text-slate-500">{instrument.instructions}</p>
          )}
          <p className="text-base font-medium text-slate-900 leading-snug">{question}</p>
          <div className="space-y-2">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => choose(step, opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                  selected === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-900 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => (stepIndex === 0 ? setState('intro') : setStepIndex(i => i - 1))}
            className="btn-ghost text-sm px-2"
          >
            <ArrowLeft size={14} /> Atrás
          </button>
          {selected !== null && selected >= 0 && (
            <button
              onClick={() => (stepIndex >= steps.length - 1 ? setState('review') : setStepIndex(i => i + 1))}
              className="btn-secondary text-sm"
            >
              Siguiente
            </button>
          )}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">{instrument.citation}</p>
      </div>
    </Shell>
  )
}

// ── Recursos de apoyo ───────────────────────────────────────────────────────
function SupportResources() {
  return (
    <div className="card p-5 space-y-3 border-brand-200">
      <div className="flex items-center gap-2">
        <Heart size={16} className="text-brand-600" />
        <h2 className="text-base font-semibold text-slate-900">No estás solo(a)</h2>
      </div>
      <p className="text-sm text-slate-700">
        Si en algún momento sientes que podrías hacerte daño, busca ayuda de inmediato. Hablar con alguien ayuda.
      </p>
      <ul className="space-y-2 text-sm text-slate-700">
        <li className="flex items-start gap-2">
          <Phone size={14} className="text-brand-600 mt-0.5 shrink-0" />
          <span><strong>Chile:</strong> Línea de Prevención del Suicidio, llama al <a href="tel:*4141" className="font-semibold text-brand-800 underline">*4141</a> (gratis, 24 horas).</span>
        </li>
        <li className="flex items-start gap-2">
          <Phone size={14} className="text-brand-600 mt-0.5 shrink-0" />
          <span><strong>Emergencias:</strong> llama al <a href="tel:131" className="font-semibold text-brand-800 underline">131</a> (SAMU) o acude al servicio de urgencia más cercano. Fuera de Chile, al número de emergencias de tu país.</span>
        </li>
      </ul>
    </div>
  )
}

// ── Componentes auxiliares ──────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-12 pb-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-brand-500/10 rounded-xl">
            <Calendar size={18} className="text-brand-600" />
          </div>
          <span className="font-bold text-slate-900 text-lg">Blinktime</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function StateCard({ icon, bg, title, message }: {
  icon: React.ReactNode; bg: string; title: string; message: string
}) {
  return (
    <div className="card p-8 text-center">
      <div className={`w-16 h-16 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
        {icon}
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-600 text-sm">{message}</p>
    </div>
  )
}

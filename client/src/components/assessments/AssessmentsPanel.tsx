import { useCallback, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import toast from 'react-hot-toast'
import {
  AlertTriangle, Check, ChevronDown, ChevronUp, ClipboardList, Copy, ExternalLink,
  Loader2, Mail, Plus, QrCode, Send, X,
} from 'lucide-react'
import {
  assessmentLink, createAssessment, listInstruments, listPatientAssessments, revokeAssessment,
  type AssessmentAssignment, type AssessmentResult, type InstrumentSummary,
} from '../../services/assessments'

interface Props {
  appointmentId: string
  patientName: string
  patientEmail: string
  patientPhone: string | null
}

const STATUS_STYLE: Record<AssessmentAssignment['status'], { label: string; cls: string }> = {
  pending:   { label: 'Pendiente', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  completed: { label: 'Respondido', cls: 'text-green-700 bg-green-50 border-green-200' },
  expired:   { label: 'Vencido', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  revoked:   { label: 'Anulado', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
}

const TIER_STYLE = [
  'text-slate-700 bg-slate-100 border-slate-200',   // mínima
  'text-yellow-800 bg-yellow-50 border-yellow-200', // leve
  'text-amber-800 bg-amber-50 border-amber-200',    // moderada
  'text-orange-800 bg-orange-50 border-orange-200', // moderadamente severa
  'text-red-700 bg-red-50 border-red-200',          // severa
]

export default function AssessmentsPanel({ appointmentId, patientName, patientEmail, patientPhone }: Props) {
  const [history, setHistory] = useState<AssessmentAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const load = useCallback(() =>
    listPatientAssessments(patientEmail)
      .then(setHistory)
      .catch(() => { toast.error('No se pudieron cargar los tests') })
      .finally(() => setLoading(false)),
  [patientEmail])

  useEffect(() => {
    listPatientAssessments(patientEmail)
      .then(setHistory)
      .catch(() => { toast.error('No se pudieron cargar los tests') })
      .finally(() => setLoading(false))
  }, [patientEmail])

  const fromThisAppointment = history.filter(a => a.appointment_id === appointmentId)
  const fromOthers = history.filter(a => a.appointment_id !== appointmentId)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Tests</p>
        {!composing && (
          <button
            onClick={() => setComposing(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-800 bg-brand-50 border border-brand-200 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={12} /> Enviar test
          </button>
        )}
      </div>

      {composing && (
        <ComposeForm
          appointmentId={appointmentId}
          patientEmail={patientEmail}
          onCancel={() => setComposing(false)}
          onCreated={async id => {
            setComposing(false)
            setJustCreated(id)
            await load()
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
      ) : history.length === 0 && !composing ? (
        <p className="text-sm text-slate-500">
          Aún no has enviado tests a {patientName.split(' ')[0]}.
        </p>
      ) : (
        <div className="space-y-2">
          {fromThisAppointment.map(a => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              patientPhone={patientPhone}
              defaultShareOpen={a.id === justCreated}
              onRevoked={load}
            />
          ))}
          {fromOthers.length > 0 && (
            <>
              <p className="text-xs text-slate-400 pt-2">Historial del paciente en otras citas</p>
              {fromOthers.map(a => (
                <AssignmentCard key={a.id} assignment={a} patientPhone={patientPhone} onRevoked={load} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Formulario de envío ─────────────────────────────────────────────────────
function ComposeForm({ appointmentId, patientEmail, onCancel, onCreated }: {
  appointmentId: string
  patientEmail: string
  onCancel: () => void
  onCreated: (id: string) => Promise<void>
}) {
  const [instruments, setInstruments] = useState<InstrumentSummary[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [sendEmail, setSendEmail] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listInstruments().then(setInstruments).catch(() => toast.error('No se pudo cargar la lista de tests'))
  }, [])

  const toggle = (code: string) =>
    setSelected(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]))

  const submit = async () => {
    setSaving(true)
    try {
      const created = await createAssessment({
        appointment_id: appointmentId,
        instrument_codes: selected,
        send_email: sendEmail,
      })
      if (sendEmail && !created.email_sent) {
        toast.error('El test se creó, pero no se pudo enviar el correo. Comparte el enlace manualmente.')
      } else {
        toast.success(sendEmail ? 'Test enviado por correo' : 'Enlace del test creado')
      }
      await onCreated(created.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear el test')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-3 space-y-3">
      <div className="space-y-1.5">
        {instruments.length === 0 && <Loader2 size={14} className="animate-spin text-slate-400" />}
        {instruments.map(ins => (
          <label key={ins.code} className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-brand-300">
            <input
              type="checkbox"
              checked={selected.includes(ins.code)}
              onChange={() => toggle(ins.code)}
              className="mt-0.5 w-4 h-4 accent-brand-600"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">{ins.short_name}</span>
              <span className="text-slate-500"> · {ins.description} · {ins.item_count} preguntas</span>
            </span>
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={sendEmail}
          onChange={e => setSendEmail(e.target.checked)}
          className="w-4 h-4 accent-brand-600"
        />
        <Mail size={13} className="text-slate-500" />
        Enviar por correo a <span className="font-medium truncate">{patientEmail}</span>
      </label>
      <p className="text-xs text-slate-500 -mt-1">
        También podrás copiar el enlace o mostrar un código QR para responder en la sesión.
      </p>

      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm flex-1 justify-center">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={saving || selected.length === 0}
          className="btn-primary text-sm flex-1 justify-center"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sendEmail ? 'Enviar' : 'Crear enlace'}
        </button>
      </div>
    </div>
  )
}

// ─── Tarjeta de un envío ─────────────────────────────────────────────────────
function AssignmentCard({ assignment: a, patientPhone, defaultShareOpen = false, onRevoked }: {
  assignment: AssessmentAssignment
  patientPhone: string | null
  defaultShareOpen?: boolean
  onRevoked: () => Promise<void>
}) {
  const [shareOpen, setShareOpen] = useState(defaultShareOpen)
  const [revoking, setRevoking] = useState(false)
  const status = STATUS_STYLE[a.status]
  const urgent = a.results.some(r => r.flags.length > 0)

  const revoke = async () => {
    if (!confirm('¿Anular este enlace? El paciente ya no podrá responder.')) return
    setRevoking(true)
    try {
      await revokeAssessment(a.id)
      toast.success('Enlace anulado')
      await onRevoked()
    } catch {
      toast.error('No se pudo anular el enlace')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className={`rounded-xl border bg-white p-3 space-y-2 ${urgent ? 'border-red-300' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
            <ClipboardList size={13} className="text-slate-500 shrink-0" />
            {a.instrument_names.join(' + ')}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {a.status === 'completed' && a.completed_at
              ? `Respondido el ${format(parseISO(a.completed_at), "d MMM yyyy, HH:mm", { locale: es })}`
              : `Enviado el ${format(parseISO(a.created_at), "d MMM yyyy, HH:mm", { locale: es })}`}
            {a.sent_via_email && a.status !== 'completed' && ' · por correo'}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {a.results.map(r => <ResultRow key={r.instrument_code} result={r} />)}

      {a.status === 'pending' && a.token && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setShareOpen(o => !o)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
            >
              <QrCode size={12} /> {shareOpen ? 'Ocultar enlace' : 'Compartir enlace'}
            </button>
            <button
              onClick={revoke}
              disabled={revoking}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1.5 rounded-lg"
            >
              {revoking ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Anular
            </button>
          </div>
          {shareOpen && <SharePanel token={a.token} patientPhone={patientPhone} />}
        </>
      )}
    </div>
  )
}

// ─── Compartir: copiar, WhatsApp, abrir, QR ──────────────────────────────────
function SharePanel({ token, patientPhone }: { token: string; patientPhone: string | null }) {
  const link = assessmentLink(token)
  const [copied, setCopied] = useState(false)
  const phoneDigits = patientPhone?.replace(/\D/g, '') ?? ''
  const waText = encodeURIComponent(`Hola, te comparto un breve cuestionario para tu atención: ${link}`)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace y cópialo manualmente.')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <div className="flex gap-2">
        <input readOnly value={link} onFocus={e => e.target.select()} className="input text-xs py-2 px-3" />
        <button onClick={copy} className="btn-secondary text-xs px-3 py-2 shrink-0">
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <div className="flex gap-2 text-xs">
        {phoneDigits && (
          <a
            href={`https://wa.me/${phoneDigits}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-center font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-2.5 py-1.5 rounded-lg"
          >
            Enviar por WhatsApp
          </a>
        )}
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1 font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg"
        >
          <ExternalLink size={12} /> Abrir aquí
        </a>
      </div>
      <div className="flex flex-col items-center gap-1 py-2">
        <div className="bg-white p-2 rounded-lg border border-slate-200">
          <QRCodeSVG value={link} size={148} />
        </div>
        <p className="text-xs text-slate-500">El paciente puede escanearlo para responder en la sesión</p>
      </div>
    </div>
  )
}

// ─── Resultado de un instrumento ─────────────────────────────────────────────
function ResultRow({ result: r }: { result: AssessmentResult }) {
  const [open, setOpen] = useState(r.flags.length > 0)

  return (
    <div className="rounded-lg bg-slate-50/70 border border-slate-200/70">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800">{r.short_name}</span>
          <span className="text-sm text-slate-600">{r.total_score}/{r.max_score}</span>
          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${TIER_STYLE[r.tier] ?? TIER_STYLE[0]}`}>
            {r.severity_label}
          </span>
          {r.flags.length > 0 && <AlertTriangle size={14} className="text-red-600 shrink-0" />}
        </span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {r.flags.map(f => (
            <div key={f.code} className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{f.message}</span>
            </div>
          ))}
          <ol className="space-y-1.5">
            {r.items.map(item => (
              <li key={item.id} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-slate-600">{item.id}. {item.text}</span>
                <span className={`shrink-0 font-medium ${item.value > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {item.value} · {item.label}
                </span>
              </li>
            ))}
          </ol>
          {r.extra && (
            <p className="text-xs text-slate-600 pt-1 border-t border-slate-200/70">
              <span className="text-slate-500">Dificultad funcional:</span> <span className="font-medium text-slate-800">{r.extra.label}</span>
            </p>
          )}
          <p className="text-[11px] text-slate-400">Herramienta de tamizaje: no constituye un diagnóstico.</p>
        </div>
      )}
    </div>
  )
}

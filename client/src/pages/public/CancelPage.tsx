import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import {
  Calendar, Clock, User, CheckCircle, XCircle, Loader2,
  AlertTriangle, ArrowLeft,
} from 'lucide-react'
import { API_BASE } from '../../services/apiBase'

const API  = API_BASE

interface AppointmentInfo {
  id: string
  patient_name: string
  patient_email: string
  starts_at: string
  ends_at: string
  status: string
  professionals: { name: string; specialty: string | null }
  services: { name: string; duration_minutes: number } | null
}

type PageState = 'loading' | 'found' | 'not_found' | 'already_cancelled' | 'cancelled' | 'error'

export default function CancelPage() {
  const { token } = useParams<{ token: string }>()
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!token) { setPageState('not_found'); return }
    axios.get(`${API}/appointments/cancel/${token}`)
      .then(res => {
        setAppointment(res.data)
        setPageState(res.data.status === 'cancelled' ? 'already_cancelled' : 'found')
      })
      .catch(err => {
        const code = err.response?.data?.code
        if (code === 'NOT_FOUND') setPageState('not_found')
        else if (code === 'ALREADY_CANCELLED') setPageState('already_cancelled')
        else setPageState('error')
      })
  }, [token])

  const handleCancel = async () => {
    if (!token) return
    setCancelling(true)
    try {
      await axios.patch(`${API}/appointments/cancel/${token}`, { reason })
      setPageState('cancelled')
    } catch {
      setPageState('error')
    } finally {
      setCancelling(false)
    }
  }

  // ── States ─────────────────────────────────────────────────────────────────
  if (pageState === 'loading') return (
    <Shell>
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </Shell>
  )

  if (pageState === 'not_found') return (
    <Shell>
      <StateCard
        icon={<AlertTriangle className="w-10 h-10 text-amber-400" />}
        bg="bg-amber-500/10"
        title="Cita no encontrada"
        message="El enlace de cancelación no es válido o ya expiró."
      />
    </Shell>
  )

  if (pageState === 'already_cancelled') return (
    <Shell>
      <StateCard
        icon={<XCircle className="w-10 h-10 text-slate-600" />}
        bg="bg-slate-100/30"
        title="Cita ya cancelada"
        message="Esta cita ya fue cancelada anteriormente."
      />
    </Shell>
  )

  if (pageState === 'cancelled') return (
    <Shell>
      <StateCard
        icon={<CheckCircle className="w-10 h-10 text-green-400" />}
        bg="bg-green-500/10"
        title="Cita cancelada"
        message="Tu cita fue cancelada correctamente. Lamentamos que no puedas asistir."
      />
    </Shell>
  )

  if (pageState === 'error') return (
    <Shell>
      <StateCard
        icon={<XCircle className="w-10 h-10 text-red-400" />}
        bg="bg-red-500/10"
        title="Error"
        message="Ocurrió un error. Por favor intenta nuevamente más tarde."
      />
    </Shell>
  )

  if (!appointment) return null

  const startDate = parseISO(appointment.starts_at)
  const endDate   = parseISO(appointment.ends_at)

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cancelar cita</h1>
          <p className="text-slate-600 text-sm mt-1">
            Estás a punto de cancelar la siguiente cita
          </p>
        </div>

        {/* Resumen */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <User size={14} className="text-brand-400 shrink-0" />
            <span>{appointment.professionals.name}
              {appointment.professionals.specialty && (
                <span className="text-slate-500 ml-1">— {appointment.professionals.specialty}</span>
              )}
            </span>
          </div>
          {appointment.services && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle size={14} className="text-brand-400 shrink-0" />
              {appointment.services.name}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Calendar size={14} className="text-brand-400 shrink-0" />
            <span className="capitalize">
              {format(startDate, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Clock size={14} className="text-brand-400 shrink-0" />
            {format(startDate, 'HH:mm')} – {format(endDate, 'HH:mm')}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              appointment.status === 'confirmed' ? 'bg-green-400'
              : appointment.status === 'pending'  ? 'bg-amber-400'
              : 'bg-slate-500'
            }`} />
            <span className="text-slate-600 capitalize">{appointment.status}</span>
          </div>
        </div>

        {/* Motivo (opcional) */}
        <div>
          <label className="label">
            Motivo de cancelación
            <span className="text-slate-600 font-normal ml-1">(opcional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            placeholder="Ej: No puedo asistir ese día..."
            className="input resize-none"
          />
        </div>

        {/* Botones */}
        {!showConfirm ? (
          <div className="flex gap-3">
            <a
              href={`/book/${appointment.professionals.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`}
              className="btn-secondary flex-1 justify-center"
            >
              <ArrowLeft size={14} />
              Volver
            </a>
            <button
              onClick={() => setShowConfirm(true)}
              className="btn-danger flex-1 justify-center"
            >
              <XCircle size={14} />
              Cancelar cita
            </button>
          </div>
        ) : (
          <div className="card p-4 border-red-500/20">
            <p className="text-slate-700 text-sm mb-4">
              ¿Confirmas que deseas cancelar esta cita? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1 justify-center">
                No, mantener
              </button>
              <button onClick={handleCancel} disabled={cancelling} className="btn-danger flex-1 justify-center">
                {cancelling
                  ? <><Loader2 size={14} className="animate-spin" />Cancelando...</>
                  : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 bg-brand-500/10 rounded-xl">
            <Calendar size={18} className="text-brand-400" />
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

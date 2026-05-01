import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'
import { Calendar, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { getAvailabilitySlots, getDateRange, formatDate, extractTime, type AvailabilityMap } from '../../services/booking'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const API = `${BASE}/api`

interface RescheduleInfo {
  id: string
  starts_at: string
  ends_at: string
  status: string
  service_id: string | null
  reschedule_limit_hours_before: number
  can_reschedule: boolean
  reschedule_deadline: string
  professionals: { name: string; specialty: string | null; slug: string }
  services: { id: string; name: string; duration_minutes: number } | null
}

type PageState =
  | 'loading'
  | 'found'
  | 'not_found'
  | 'window_closed'
  | 'rescheduled'
  | 'error'

export default function ReschedulePage() {
  const { token } = useParams<{ token: string }>()
  const [appointment, setAppointment] = useState<RescheduleInfo | null>(null)
  const [availability, setAvailability] = useState<AvailabilityMap>({})
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setPageState('not_found')
      return
    }
    axios.get(`${API}/appointments/reschedule/${token}`)
      .then(res => {
        const info = res.data as RescheduleInfo
        setAppointment(info)
        setPageState(info.can_reschedule ? 'found' : 'window_closed')
      })
      .catch(err => {
        const code = err.response?.data?.code
        if (code === 'NOT_FOUND') setPageState('not_found')
        else if (code === 'RESCHEDULE_WINDOW_CLOSED') setPageState('window_closed')
        else setPageState('error')
      })
  }, [token])

  useEffect(() => {
    if (!appointment || pageState !== 'found') return
    const { start, end } = getDateRange(45)
    setLoadingSlots(true)
    getAvailabilitySlots(appointment.professionals.slug, start, end, appointment.service_id ?? undefined)
      .then(setAvailability)
      .catch(() => setAvailability({}))
      .finally(() => setLoadingSlots(false))
  }, [appointment, pageState])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7 + i)
    return d.toISOString().split('T')[0]
  })

  const hasSlots = (date: string) => (availability[date]?.length ?? 0) > 0

  const handleReschedule = async () => {
    if (!token || !selectedSlot) return
    setSubmitting(true)
    try {
      await axios.patch(`${API}/appointments/reschedule/${token}`, { starts_at: selectedSlot })
      setPageState('rescheduled')
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'RESCHEDULE_WINDOW_CLOSED') {
        setPageState('window_closed')
      } else {
        setPageState('error')
      }
    } finally {
      setSubmitting(false)
    }
  }

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
        message="El enlace de reagendamiento no es válido o ya expiró."
      />
    </Shell>
  )

  if (pageState === 'window_closed') {
    const deadline = appointment?.reschedule_deadline
    return (
      <Shell>
        <StateCard
          icon={<AlertTriangle className="w-10 h-10 text-amber-400" />}
          bg="bg-amber-500/10"
          title="Plazo de reagendamiento vencido"
          message={
            deadline
              ? `Puedes reagendar hasta ${appointment?.reschedule_limit_hours_before}h antes. El plazo terminó el ${format(parseISO(deadline), "d 'de' MMMM, HH:mm", { locale: es })}.`
              : 'Ya no es posible reagendar esta cita.'
          }
        />
      </Shell>
    )
  }

  if (pageState === 'rescheduled') return (
    <Shell>
      <StateCard
        icon={<CheckCircle className="w-10 h-10 text-green-400" />}
        bg="bg-green-500/10"
        title="Cita reagendada"
        message="Tu cita fue reagendada correctamente. El profesional ya fue notificado."
      />
    </Shell>
  )

  if (pageState === 'error') return (
    <Shell>
      <StateCard
        icon={<XCircle className="w-10 h-10 text-red-400" />}
        bg="bg-red-500/10"
        title="Error"
        message="Ocurrió un error al reagendar. Intenta nuevamente."
      />
    </Shell>
  )

  if (!appointment) return null

  return (
    <Shell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reagendar cita</h1>
          <p className="text-slate-600 text-sm mt-1">
            Selecciona un nuevo horario para tu cita.
          </p>
        </div>

        <div className="card p-4 space-y-2">
          <p className="text-xs text-slate-500">Horario actual</p>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Calendar size={14} className="text-brand-400 shrink-0" />
            <span className="capitalize">{format(parseISO(appointment.starts_at), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Clock size={14} className="text-brand-400 shrink-0" />
            {format(parseISO(appointment.starts_at), 'HH:mm')} – {format(parseISO(appointment.ends_at), 'HH:mm')}
          </div>
          <p className="text-xs text-slate-500">
            Puedes reagendar hasta {appointment.reschedule_limit_hours_before}h antes.
          </p>
        </div>

        {loadingSlots ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/50">
                <button
                  onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                  disabled={weekOffset === 0}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-slate-700 text-sm font-medium">
                  {new Date(weekDays[0] + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setWeekOffset(weekOffset + 1)}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-7 divide-x divide-slate-200/50">
                {weekDays.map(date => {
                  const d = new Date(date + 'T12:00:00')
                  const isSelected = selectedDate === date
                  const available = hasSlots(date)
                  return (
                    <button
                      key={date}
                      disabled={!available}
                      onClick={() => setSelectedDate(date)}
                      className={`flex flex-col items-center py-3 gap-1 transition-colors ${
                        isSelected ? 'bg-brand-600/30' : available ? 'hover:bg-slate-100/50' : ''
                      } disabled:cursor-not-allowed`}
                    >
                      <span className={`text-xs font-medium uppercase tracking-wide ${isSelected ? 'text-brand-400' : 'text-slate-500'}`}>
                        {d.toLocaleDateString('es-CL', { weekday: 'short' }).slice(0, 2)}
                      </span>
                      <span className={`text-sm font-bold ${isSelected ? 'text-brand-300' : available ? 'text-slate-800' : 'text-slate-600'}`}>
                        {d.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDate && (
              <div>
                <p className="text-slate-600 text-sm mb-3 capitalize">{formatDate(selectedDate)}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(availability[selectedDate] ?? []).map(slot => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                        selectedSlot === slot
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                          : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {extractTime(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleReschedule}
              disabled={!selectedSlot || submitting}
              className="btn-primary w-full justify-center"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" />Reagendando...</>
                : 'Confirmar nuevo horario'}
            </button>
          </>
        )}
      </div>
    </Shell>
  )
}

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
  icon: React.ReactNode
  bg: string
  title: string
  message: string
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

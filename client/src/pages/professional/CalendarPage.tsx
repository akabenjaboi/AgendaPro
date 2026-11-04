import { useState, useEffect, useMemo, useCallback } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import type { Event as CalendarEvent, EventProps, Formats, ToolbarProps, View } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import {
  format, parse, startOfWeek, endOfWeek, getDay, parseISO, isToday, isWithinInterval,
} from 'date-fns'
import { es } from 'date-fns/locale/es'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Eye, EyeOff, Hourglass, Sun } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import api from '../../services/api'
import { getMyProfile } from '../../services/professional'
import toast from 'react-hot-toast'
import { AppointmentDetailModal } from './AppointmentsPage'
import type { Appointment } from './AppointmentsPage'

// ─── Localización ────────────────────────────────────────────────────────────
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
})

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const formats: Formats = {
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: () => '', // el horario lo muestra nuestro componente de evento
  agendaTimeRangeFormat: ({ start, end }, culture, loc) =>
    `${loc!.format(start, 'HH:mm', culture)} – ${loc!.format(end, 'HH:mm', culture)}`,
  agendaDateFormat: (date, culture, loc) => capitalize(loc!.format(date, 'EEE d MMM', culture)),
  dayFormat: (date, culture, loc) => capitalize(loc!.format(date, 'EEE d', culture)),
  weekdayFormat: (date, culture, loc) => capitalize(loc!.format(date, 'EEE', culture)),
  monthHeaderFormat: (date, culture, loc) => capitalize(loc!.format(date, 'MMMM yyyy', culture)),
  dayHeaderFormat: (date, culture, loc) => capitalize(loc!.format(date, "EEEE d 'de' MMMM", culture)),
  dayRangeHeaderFormat: ({ start, end }, culture, loc) =>
    `${loc!.format(start, 'd MMM', culture)} – ${loc!.format(end, 'd MMM yyyy', culture)}`,
}

// ─── Estilos por estado ──────────────────────────────────────────────────────
const STATUS_META: Record<Appointment['status'], { label: string; dot: string; event: string }> = {
  pending:   { label: 'Pendiente',  dot: 'bg-amber-400',  event: 'apt-pending' },
  confirmed: { label: 'Aprobada',   dot: 'bg-brand-600',  event: 'apt-confirmed' },
  completed: { label: 'Completada', dot: 'bg-slate-400',  event: 'apt-completed' },
  cancelled: { label: 'Cancelada',  dot: 'bg-rose-300',   event: 'apt-cancelled' },
}

interface MyEvent extends CalendarEvent {
  title: string
  start: Date
  end: Date
  resource: Appointment
}

const VIEW_LABELS: Record<string, string> = { month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' }

// ─── Página ──────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user } = useAuthStore()
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<View>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'week'
  )

  useEffect(() => {
    if (!user) return
    getMyProfile(user.id)
      .then(async prof => {
        if (!prof) return
        setProfessionalId(prof.id)
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id, patient_name, patient_email, patient_phone, patient_notes,
            starts_at, ends_at, status, patient_attendance_response,
            services (name, duration_minutes)
          `)
          .eq('professional_id', prof.id)
        if (error) throw error
        setAppointments((data ?? []) as unknown as Appointment[])
      })
      .catch(() => toast.error('Error al cargar el calendario'))
      .finally(() => setLoading(false))
  }, [user])

  const updateStatus = async (id: string, newStatus: string) => {
    if (!professionalId) return
    setActionLoading(true)
    try {
      await api.patch(`/professional/appointments/${id}`, { status: newStatus })
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: newStatus as Appointment['status'] } : a)
      )
      setSelectedApt(prev => (prev?.id === id ? { ...prev, status: newStatus as Appointment['status'] } : prev))
      const labels: Record<string, string> = {
        confirmed: 'Cita aprobada',
        completed: 'Cita marcada como completada',
        cancelled: 'Cita cancelada',
      }
      toast.success(labels[newStatus] ?? 'Cita actualizada')
    } catch {
      toast.error('Error al actualizar la cita')
    } finally {
      setActionLoading(false)
    }
  }

  const deleteAppointment = async (id: string) => {
    setActionLoading(true)
    try {
      await api.delete(`/professional/appointments/${id}`)
      setAppointments(prev => prev.filter(a => a.id !== id))
      setSelectedApt(prev => (prev?.id === id ? null : prev))
      toast.success('Cita eliminada')
    } catch {
      toast.error('Error al eliminar la cita')
    } finally {
      setActionLoading(false)
    }
  }

  const events: MyEvent[] = useMemo(() => appointments
    .filter(apt => showCancelled || apt.status !== 'cancelled')
    .map(apt => ({
      title: apt.patient_name,
      start: parseISO(apt.starts_at),
      end: parseISO(apt.ends_at),
      resource: apt,
    })), [appointments, showCancelled])

  // Resumen rápido
  const stats = useMemo(() => {
    const now = new Date()
    const week = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    const active = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed')
    return {
      today: active.filter(a => isToday(parseISO(a.starts_at))).length,
      week: active.filter(a => isWithinInterval(parseISO(a.starts_at), week)).length,
      pending: appointments.filter(a => a.status === 'pending' && parseISO(a.starts_at) >= now).length,
    }
  }, [appointments])

  const eventPropGetter = useCallback((event: MyEvent) => ({
    className: STATUS_META[event.resource.status]?.event ?? '',
  }), [])

  const dayPropGetter = useCallback((day: Date) => ({
    className: day.getDay() === 0 || day.getDay() === 6 ? 'rbc-weekend' : '',
  }), [])

  const components = useMemo(() => ({
    toolbar: CalendarToolbar,
    event: EventCard,
    month: { event: MonthEvent },
    agenda: { event: AgendaEvent },
  }), [])

  return (
    <div className="space-y-5 animate-fade-in flex flex-col h-[calc(100vh-6rem)]">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-slate-600 mt-1 text-sm">Tus citas de un vistazo</p>
        </div>
        <div data-tour="calendar-stats" className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile icon={<Sun size={14} />} label="Hoy" value={stats.today} />
          <StatTile icon={<CalendarDays size={14} />} label="Esta semana" value={stats.week} />
          <StatTile icon={<Hourglass size={14} />} label="Por aprobar" value={stats.pending} highlight={stats.pending > 0} />
        </div>
      </div>

      <div className="card p-0 flex-1 flex flex-col min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-5">
            <div data-tour="calendar-grid" className="flex-1 min-h-0 flex flex-col">
            <BigCalendar
              localizer={localizer}
              culture="es"
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={date}
              onNavigate={setDate}
              view={view}
              onView={setView}
              views={['month', 'week', 'day', 'agenda']}
              formats={formats}
              components={components}
              eventPropGetter={eventPropGetter}
              dayPropGetter={dayPropGetter}
              onSelectEvent={event => setSelectedApt(event.resource)}
              scrollToTime={new Date(1970, 0, 1, 8, 0)}
              step={30}
              timeslots={2}
              popup
              messages={{
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                agenda: 'Agenda',
                date: 'Fecha',
                time: 'Hora',
                event: 'Cita',
                allDay: 'Todo el día',
                noEventsInRange: 'No hay citas en este rango.',
                showMore: total => `+${total} más`,
              }}
              className="flex-1 min-h-0"
            />
            </div>

            {/* Leyenda */}
            <div data-tour="calendar-legend" className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {(['pending', 'confirmed', 'completed', 'cancelled'] as const)
                  .filter(s => showCancelled || s !== 'cancelled')
                  .map(s => (
                    <span key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[s].dot}`} />
                      {STATUS_META[s].label}
                    </span>
                  ))}
              </div>
              <button
                onClick={() => setShowCancelled(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {showCancelled ? <EyeOff size={13} /> : <Eye size={13} />}
                {showCancelled ? 'Ocultar canceladas' : 'Mostrar canceladas'}
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedApt && (
        <AppointmentDetailModal
          appointment={selectedApt}
          loading={actionLoading}
          onClose={() => setSelectedApt(null)}
          onUpdateStatus={updateStatus}
          onDelete={deleteAppointment}
        />
      )}
    </div>
  )
}

// ─── Componentes ─────────────────────────────────────────────────────────────
function StatTile({ icon, label, value, highlight = false }: {
  icon: React.ReactNode; label: string; value: number; highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 sm:px-4 sm:py-2.5 min-w-[92px] ${
      highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
    }`}>
      <div className={`flex items-center gap-1.5 text-[11px] font-medium ${highlight ? 'text-amber-700' : 'text-slate-500'}`}>
        {icon} {label}
      </div>
      <p className={`text-xl font-bold leading-tight mt-0.5 ${highlight ? 'text-amber-900' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function CalendarToolbar({ label, view, views, onNavigate, onView }: ToolbarProps<MyEvent>) {
  const viewList = (Array.isArray(views) ? views : Object.keys(views)) as View[]
  return (
    <div data-tour="calendar-toolbar" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onNavigate('PREV')} aria-label="Anterior" className="p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => onNavigate('TODAY')} className="px-3 py-1.5 text-sm font-medium text-slate-700 border-x border-slate-200 hover:bg-slate-50 transition-colors">
            Hoy
          </button>
          <button onClick={() => onNavigate('NEXT')} aria-label="Siguiente" className="p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 ml-1">{label}</h2>
      </div>

      <div className="flex p-1 rounded-xl bg-slate-100 self-start sm:self-auto">
        {viewList.map(v => (
          <button
            key={v}
            onClick={() => onView(v)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {VIEW_LABELS[v] ?? v}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Evento en vistas de semana y día. */
function EventCard({ event }: EventProps<MyEvent>) {
  const apt = event.resource
  return (
    <div className="h-full flex flex-col gap-0.5 overflow-hidden leading-tight">
      <span className="font-semibold truncate">{apt.patient_name}</span>
      <span className="flex items-center gap-1 opacity-80 text-[11px]">
        <Clock size={10} className="shrink-0" />
        {format(event.start, 'HH:mm')} – {format(event.end, 'HH:mm')}
      </span>
      {apt.services?.name && <span className="opacity-75 text-[11px] truncate">{apt.services.name}</span>}
    </div>
  )
}

/** Evento compacto en la vista mensual. */
function MonthEvent({ event }: EventProps<MyEvent>) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="font-semibold tabular-nums">{format(event.start, 'HH:mm')}</span>
      <span className="truncate">{event.resource.patient_name}</span>
    </div>
  )
}

/** Fila en la vista de agenda. */
function AgendaEvent({ event }: EventProps<MyEvent>) {
  const apt = event.resource
  const meta = STATUS_META[apt.status]
  return (
    <div className="flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
      <div className="min-w-0">
        <p className="font-medium text-slate-800 truncate">{apt.patient_name}</p>
        <p className="text-xs text-slate-500 truncate">
          {apt.services?.name ?? 'Cita'} · {meta.label}
        </p>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar'
import type { Event as CalendarEvent, View } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { format, parse, startOfWeek, getDay, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es' // We specifically import 'es' from date-fns
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import api from '../../services/api'
import { getMyProfile } from '../../services/professional'
import toast from 'react-hot-toast'
import { AppointmentDetailModal } from './AppointmentsPage'
import type { Appointment } from './AppointmentsPage'

// Configuración de localización para el calendario
const locales = {
  'es': es,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// Tipos para react-big-calendar
interface MyEvent extends CalendarEvent {
  title: string
  start: Date
  end: Date
  resource: Appointment
}

export default function CalendarPage() {
  const { user } = useAuthStore()
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const prof = await getMyProfile(user!.id)
      if (!prof) return
      setProfessionalId(prof.id)
      await fetchAppointments(prof.id)
    } catch {
      toast.error('Error al cargar el calendario')
    } finally {
      setLoading(false)
    }
  }

  const fetchAppointments = async (profId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, patient_name, patient_email, patient_phone, patient_notes,
        starts_at, ends_at, status,
        services (name, duration_minutes)
      `)
      .eq('professional_id', profId)

    if (error) throw error
    setAppointments((data ?? []) as unknown as Appointment[])
  }

  const updateStatus = async (id: string, newStatus: string) => {
    if (!professionalId) return
    setActionLoading(true)
    try {
      await api.patch(`/professional/appointments/${id}`, { status: newStatus })

      // Actualizar el estado local
      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: newStatus as Appointment['status'] } : a)
      )
      if (selectedApt?.id === id) {
        setSelectedApt(prev => prev ? { ...prev, status: newStatus as Appointment['status'] } : null)
      }

      const labels: Record<string, string> = {
        confirmed: 'Cita confirmada',
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

  const deleteCancelledAppointment = async (id: string) => {
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

  // Convertir nuestros Appointments al formato que espera react-big-calendar
  const events: MyEvent[] = appointments.map(apt => ({
    title: `${apt.patient_name} - ${apt.services?.name ?? 'Cita'}`,
    start: parseISO(apt.starts_at),
    end: parseISO(apt.ends_at),
    resource: apt
  }))

  // Personalizar la clase de los eventos según el status
  const eventPropGetter = (event: MyEvent) => {
    const status = event.resource.status
    let className = 'rbc-event'
    if (status === 'pending') className += ' rbc-event-pending'
    if (status === 'confirmed') className += ' rbc-event-confirmed'
    if (status === 'cancelled') className += ' opacity-50 grayscale'
    if (status === 'completed') className += ' opacity-60'

    return { className }
  }

  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<View>(() =>
    window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'month'
  )

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-6rem)]">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Calendario de Citas</h1>
        <p className="text-slate-600 mt-1 text-sm">Gestiona tus consultas visualmente</p>
      </div>

      <div className="card p-0 flex-1 flex flex-col min-h-0 bg-white overflow-hidden shadow-sm border-brand-100">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 p-4 flex flex-col min-h-0">
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              culture="es"
              date={date}
              onNavigate={(newDate) => setDate(newDate)}
              view={view}
              onView={(newView) => setView(newView)}
              messages={{
                next: 'Sig',
                previous: 'Ant',
                today: 'Hoy',
                month: 'Mes',
                week: 'Semana',
                day: 'Día',
                agenda: 'Agenda',
                date: 'Fecha',
                time: 'Hora',
                event: 'Cita',
                noEventsInRange: 'No hay citas en este rango.'
              }}
              eventPropGetter={eventPropGetter}
              onSelectEvent={(event) => setSelectedApt(event.resource)}
              className="flex-1 min-h-0"
            />
          </div>
        )}
      </div>

      {/* Reutilizamos el modal de AppointmentsPage */}
      {selectedApt && (
        <AppointmentDetailModal
          appointment={selectedApt}
          loading={actionLoading}
          onClose={() => setSelectedApt(null)}
          onUpdateStatus={updateStatus}
          onDeleteCancelled={deleteCancelledAppointment}
        />
      )}
    </div>
  )
}

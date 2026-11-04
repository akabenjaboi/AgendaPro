import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import api from '../../services/api'
import { getMyProfile } from '../../services/professional'
import AssessmentsPanel from '../../components/assessments/AssessmentsPanel'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
import { es } from 'date-fns/locale/es'
import toast from 'react-hot-toast'
import {
  Calendar, User, Phone, Mail, FileText,
  Check, X, CheckCircle2, Filter, Search, ChevronDown, Loader2, MessageCircle, Trash2, AlertTriangle,
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface Appointment {
  id: string
  patient_name: string
  patient_email: string
  patient_phone: string | null
  patient_notes: string | null
  starts_at: string
  ends_at: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  patient_attendance_response: 'yes' | 'no' | null
  services: { name: string; duration_minutes: number } | null
}

export type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'

export const STATUS_LABELS: Record<string, string> = {
  pending:   'Pendiente de aprobación',
  confirmed: 'Aprobada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

export const STATUS_COLORS: Record<string, string> = {
  pending:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  confirmed: 'text-green-400 bg-green-500/10 border-green-500/20',
  completed: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  cancelled: 'text-slate-500 bg-slate-100/30 border-slate-200',
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const { user } = useAuthStore()
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [appointments, setAppointments]     = useState<Appointment[]>([])
  const [loading, setLoading]               = useState(true)
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('all')
  const [search, setSearch]                 = useState('')
  const [selected, setSelected]             = useState<Appointment | null>(null)
  const [actionLoading, setActionLoading]   = useState(false)

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
      toast.error('Error al cargar citas')
    } finally {
      setLoading(false)
    }
  }

  const fetchAppointments = async (profId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, patient_name, patient_email, patient_phone, patient_notes,
        starts_at, ends_at, status, patient_attendance_response,
        services (name, duration_minutes)
      `)
      .eq('professional_id', profId)
      .order('starts_at', { ascending: false })

    if (error) throw error
    setAppointments((data ?? []) as unknown as Appointment[])
  }

  // ── Acción sobre cita ────────────────────────────────────────────────────
  const updateStatus = async (id: string, newStatus: string) => {
    if (!professionalId) return
    setActionLoading(true)
    try {
      await api.patch(`/professional/appointments/${id}`, { status: newStatus })

      setAppointments(prev =>
        prev.map(a => a.id === id ? { ...a, status: newStatus as Appointment['status'] } : a)
      )
      if (selected?.id === id) {
        setSelected(prev => prev ? { ...prev, status: newStatus as Appointment['status'] } : null)
      }

      const labels: Record<string, string> = {
        confirmed: 'Cita aprobada',
        completed: 'Cita marcada como completada',
        cancelled: 'Cita cancelada',
      }
      toast.success(labels[newStatus] ?? 'Actualizada')
    } catch {
      toast.error('Error al actualizar la cita')
    } finally {
      setActionLoading(false)
    }
  }

  const [toDelete, setToDelete] = useState<Appointment | null>(null)

  const deleteAppointment = async (id: string) => {
    setActionLoading(true)
    try {
      await api.delete(`/professional/appointments/${id}`)
      setAppointments(prev => prev.filter(a => a.id !== id))
      setSelected(prev => (prev?.id === id ? null : prev))
      setToDelete(null)
      toast.success('Cita eliminada')
    } catch {
      toast.error('Error al eliminar la cita')
    } finally {
      setActionLoading(false)
    }
  }

  // ── Filtrado y búsqueda ─────────────────────────────────────────────────
  const filtered = appointments.filter(a => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q
      || a.patient_name.toLowerCase().includes(q)
      || a.patient_email.toLowerCase().includes(q)
      || (a.services?.name ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ── Counts ───────────────────────────────────────────────────────────────
  const counts = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Citas</h1>
        <p className="text-slate-600 mt-1 text-sm">
          {appointments.length} cita{appointments.length !== 1 ? 's' : ''} en total
        </p>
      </div>

      {/* Stats rápidas */}
      <div data-tour="appointments-stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`card p-3 text-left transition-all hover:border-slate-300 ${
              statusFilter === s ? 'ring-1 ring-brand-500/40' : ''
            }`}
          >
            <p className="text-2xl font-bold text-slate-900">{counts[s] ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">{STATUS_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div data-tour="appointments-filters" className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
          <input
            type="text"
            placeholder="Buscar por paciente, email o servicio..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="input pl-9 pr-8 text-sm appearance-none"
          >
            <option value="all" className="bg-white">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v} className="bg-white">{l}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-600">No hay citas que coincidan con tu búsqueda</p>
        </div>
      ) : (
        <div data-tour="appointments-table" className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/50">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">Paciente</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">Fecha</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">Servicio</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium whitespace-nowrap">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/50">
                {filtered.map(apt => (
                  <AppointmentRow
                    key={apt.id}
                    appointment={apt}
                    onClick={() => setSelected(apt)}
                    onDelete={() => setToDelete(apt)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {selected && (
        <AppointmentDetailModal
          appointment={selected}
          loading={actionLoading}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
          onDelete={deleteAppointment}
        />
      )}

      {/* Confirmación de eliminación desde la tabla */}
      {toDelete && (
        <DeleteAppointmentDialog
          appointment={toDelete}
          loading={actionLoading}
          onCancel={() => setToDelete(null)}
          onConfirm={() => deleteAppointment(toDelete.id)}
        />
      )}
    </div>
  )
}

// ─── AppointmentRow ──────────────────────────────────────────────────────────
function AppointmentRow({
  appointment: apt,
  onClick,
  onDelete,
}: {
  appointment: Appointment
  onClick: () => void
  onDelete: () => void
}) {
  const start = parseISO(apt.starts_at)
  const inPast = isPast(parseISO(apt.ends_at))

  const dateLabel = isToday(start)    ? `Hoy ${format(start, 'HH:mm')}`
                  : isTomorrow(start) ? `Mañana ${format(start, 'HH:mm')}`
                  : format(start, "d MMM · HH:mm", { locale: es })

  return (
    <tr
      onClick={onClick}
      className={`hover:bg-slate-100/30 cursor-pointer transition-colors ${inPast && apt.status !== 'completed' ? 'opacity-60' : ''}`}
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="font-medium text-slate-800">{apt.patient_name}</p>
        <p className="text-slate-500 text-xs">{apt.patient_email}</p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-slate-700 capitalize text-xs">{dateLabel}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-slate-600 text-xs">{apt.services?.name ?? '—'}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[apt.status]}`}>
            {STATUS_LABELS[apt.status]}
          </span>
          {apt.patient_attendance_response === 'yes' && (
            <span title="Paciente confirmó asistencia vía WhatsApp" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-medium text-green-500 bg-green-500/10 border border-green-500/20">
              <MessageCircle size={10} /> ✓
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <button
          data-tour="appointments-delete"
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Eliminar cita"
          aria-label={`Eliminar cita de ${apt.patient_name}`}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ─── AppointmentDetailModal ──────────────────────────────────────────────────
export function AppointmentDetailModal({
  appointment: apt,
  loading,
  onClose,
  onUpdateStatus,
  onDelete,
}: {
  appointment: Appointment
  loading: boolean
  onClose: () => void
  onUpdateStatus: (id: string, status: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const start = parseISO(apt.starts_at)
  const end   = parseISO(apt.ends_at)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const canConfirm  = apt.status === 'pending'
  const canComplete = apt.status === 'confirmed' || apt.status === 'pending'
  const canCancel   = apt.status !== 'cancelled' && apt.status !== 'completed'

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative my-6 w-full max-w-md card p-0 overflow-hidden animate-slide-up shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[apt.status]}`}>
              {STATUS_LABELS[apt.status]}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Fecha y hora */}
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-500/10 rounded-lg shrink-0 mt-0.5">
              <Calendar size={15} className="text-brand-400" />
            </div>
            <div>
              <p className="text-slate-800 font-medium capitalize">
                {format(start, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
              <p className="text-slate-500 text-sm">
                {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                {apt.services && <span className="ml-2">({apt.services.name})</span>}
              </p>
            </div>
          </div>

          {/* Paciente */}
          <div className="space-y-2 bg-slate-50/40 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Paciente</p>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <User size={13} className="text-slate-500" /> {apt.patient_name}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Mail size={13} className="text-slate-500" /> {apt.patient_email}
            </div>
            {apt.patient_phone && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Phone size={13} className="text-slate-500" /> {apt.patient_phone}
              </div>
            )}
            {apt.patient_notes && (
              <div className="flex items-start gap-2 text-sm text-slate-600 mt-2 pt-2 border-t border-slate-200/50">
                <FileText size={13} className="text-slate-500 mt-0.5 shrink-0" />
                <span className="italic">{apt.patient_notes}</span>
              </div>
            )}
            {apt.patient_attendance_response && (
              <div className={`flex items-center gap-2 text-sm mt-2 pt-2 border-t border-slate-200/50 ${
                apt.patient_attendance_response === 'yes' ? 'text-green-500' : 'text-red-400'
              }`}>
                <MessageCircle size={13} />
                {apt.patient_attendance_response === 'yes'
                  ? 'Confirmó asistencia vía WhatsApp'
                  : 'Indicó que no asistirá vía WhatsApp'}
              </div>
            )}
          </div>

          {/* Tests psicométricos */}
          <AssessmentsPanel
            appointmentId={apt.id}
            patientName={apt.patient_name}
            patientEmail={apt.patient_email}
            patientPhone={apt.patient_phone}
          />

          {/* Acciones */}
          {(canConfirm || canComplete || canCancel) && (
            <div className="flex flex-col gap-2">
              {canConfirm && (
                <button
                  onClick={() => onUpdateStatus(apt.id, 'confirmed')}
                  disabled={loading}
                  className="btn-primary justify-center"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Aprobar cita
                </button>
              )}
              {canComplete && (
                <button
                  onClick={() => onUpdateStatus(apt.id, 'completed')}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium
                             text-brand-400 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition-colors"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Marcar como completada
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => onUpdateStatus(apt.id, 'cancelled')}
                  disabled={loading}
                  className="btn-danger justify-center"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                  Cancelar cita
                </button>
              )}
            </div>
          )}

          {/* Eliminar definitivamente */}
          {!confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl text-sm font-medium
                         text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
              Eliminar cita
            </button>
          ) : (
            <DeleteConfirmBox
              status={apt.status}
              loading={loading}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={() => onDelete(apt.id)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Confirmación de eliminación ─────────────────────────────────────────────
function DeleteConfirmBox({ status, loading, onCancel, onConfirm }: {
  status: Appointment['status']
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isActive = status === 'pending' || status === 'confirmed'
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2 text-sm text-red-800">
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">¿Eliminar esta cita definitivamente?</p>
          <p className="text-xs text-red-700/90">
            Se borrará junto con sus recordatorios y no se puede deshacer. Los tests que haya
            respondido el paciente se conservan en su historial.
          </p>
          {isActive && (
            <p className="text-xs text-red-700/90">
              <strong>No se avisará al paciente.</strong> Si quieres notificarle, usa “Cancelar cita”.
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={loading} className="btn-secondary flex-1 justify-center text-sm py-2">
          No, volver
        </button>
        <button onClick={onConfirm} disabled={loading} className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold py-2 bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Sí, eliminar
        </button>
      </div>
    </div>
  )
}

function DeleteAppointmentDialog({ appointment: apt, loading, onCancel, onConfirm }: {
  appointment: Appointment
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm card p-5 space-y-4 animate-slide-up shadow-2xl">
        <div>
          <p className="font-semibold text-slate-900">{apt.patient_name}</p>
          <p className="text-sm text-slate-500 capitalize">
            {format(parseISO(apt.starts_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
            {apt.services && ` · ${apt.services.name}`}
          </p>
        </div>
        <DeleteConfirmBox status={apt.status} loading={loading} onCancel={onCancel} onConfirm={onConfirm} />
      </div>
    </div>,
    document.body
  )
}

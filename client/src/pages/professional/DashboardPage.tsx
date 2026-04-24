import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import {
  Calendar,
  Clock,
  AlertCircle,
  ChevronRight,
  Copy,
  ExternalLink,
  TrendingUp,
  Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, isToday, isFuture, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

interface Professional {
  id: string
  name: string
  specialty: string | null
  slug: string
  booking_link_active: boolean
}

interface Appointment {
  id: string
  patient_name: string
  patient_email: string
  starts_at: string
  ends_at: string
  status: string
  services: { name: string } | null
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendiente', className: 'badge-pending' },
  confirmed: { label: 'Confirmada', className: 'badge-confirmed' },
  cancelled: { label: 'Cancelada', className: 'badge-cancelled' },
  completed: { label: 'Completada', className: 'badge-completed' },
  no_show: { label: 'No asistió', className: 'badge-no-show' },
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [professional, setProfessional] = useState<Professional | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [user])

  const loadDashboard = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Cargar perfil del profesional
      const { data: prof } = await supabase
        .from('professionals')
        .select('id, name, specialty, slug, booking_link_active')
        .eq('user_id', user.id)
        .single()

      setProfessional(prof)

      if (prof) {
        // Cargar próximas citas (pendientes y confirmadas)
        const { data: apts } = await supabase
          .from('appointments')
          .select('id, patient_name, patient_email, starts_at, ends_at, status, services(name)')
          .eq('professional_id', prof.id)
          .in('status', ['pending', 'confirmed'])
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(5)

        setAppointments((apts as unknown as Appointment[]) || [])
      }
    } finally {
      setLoading(false)
    }
  }

  const bookingUrl = professional
    ? `${window.location.origin}/book/${professional.slug}`
    : ''

  const copyBookingLink = () => {
    navigator.clipboard.writeText(bookingUrl)
    toast.success('Link copiado al portapapeles')
  }

  const todayCount = appointments.filter(a => isToday(parseISO(a.starts_at))).length
  const pendingCount = appointments.filter(a => a.status === 'pending').length
  const upcomingCount = appointments.filter(a => isFuture(parseISO(a.starts_at))).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Si no tiene perfil de profesional aún (raro, pero posible si el trigger falló)
  if (!professional) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Completa tu perfil</h2>
        <p className="text-slate-600 mb-4">Aún no tienes un perfil de profesional configurado.</p>
        <Link to="/settings" className="btn-primary justify-center">
          Configurar perfil
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Hola, {professional.name.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-600 mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {/* Link público */}
        <div className="card p-3 flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${professional.booking_link_active ? 'bg-green-400 animate-pulse-slow' : 'bg-slate-500'}`} />
          <span className="text-slate-600 text-sm truncate max-w-[200px]">{bookingUrl}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={copyBookingLink} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Copiar link">
              <Copy size={14} />
            </button>
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-600 hover:text-brand-400 hover:bg-slate-100 rounded-lg transition-colors" title="Ver página pública">
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Estadísticas del día */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Calendar className="text-brand-400" size={20} />}
          label="Citas hoy"
          value={todayCount}
          color="brand"
        />
        <StatCard
          icon={<AlertCircle className="text-amber-400" size={20} />}
          label="Por confirmar"
          value={pendingCount}
          color="amber"
        />
        <StatCard
          icon={<TrendingUp className="text-green-400" size={20} />}
          label="Próximas citas"
          value={upcomingCount}
          color="green"
        />
      </div>

      {/* Próximas citas */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <Clock className="text-brand-400" size={18} />
            <h2 className="font-semibold text-slate-900">Próximas citas</h2>
          </div>
          <Link to="/appointments" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No tienes citas próximas</p>
            <p className="text-slate-600 text-sm mt-1">
              Comparte tu link de agendamiento para recibir citas
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50">
            {appointments.map((apt) => {
              const statusInfo = STATUS_MAP[apt.status]
              return (
                <div key={apt.id} className="flex items-center gap-4 p-4 hover:bg-slate-100/20 transition-colors">
                  {/* Fecha/hora */}
                  <div className="text-center min-w-[52px]">
                    <p className="text-brand-400 font-bold text-lg leading-none">
                      {format(parseISO(apt.starts_at), 'd')}
                    </p>
                    <p className="text-slate-500 text-xs uppercase">
                      {format(parseISO(apt.starts_at), 'MMM', { locale: es })}
                    </p>
                  </div>

                  {/* Línea divisora */}
                  <div className="w-px h-10 bg-slate-100" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-medium truncate">{apt.patient_name}</p>
                    <p className="text-slate-500 text-sm truncate">
                      {apt.services?.name ?? 'Sin servicio'} ·{' '}
                      {format(parseISO(apt.starts_at), 'HH:mm')} –{' '}
                      {format(parseISO(apt.ends_at), 'HH:mm')}
                    </p>
                  </div>

                  {/* Badge estado */}
                  <span className={statusInfo.className}>{statusInfo.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Acceso rápido si perfil incompleto */}
      {!professional.specialty && (
        <div className="card p-4 flex items-center gap-4 border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="text-amber-400 shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-slate-800 font-medium text-sm">Completa tu perfil profesional</p>
            <p className="text-slate-500 text-xs">Agrega tu especialidad y bio para que tus clientes te conozcan mejor</p>
          </div>
          <Link to="/settings" className="btn-secondary text-sm py-2 shrink-0">
            Completar
          </Link>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: 'brand' | 'amber' | 'green'
}) {
  const colorMap = {
    brand: 'bg-brand-500/10',
    amber: 'bg-amber-500/10',
    green: 'bg-green-500/10',
  }
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-600 text-sm">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

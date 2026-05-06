import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  getPublicProfile, getPublicServices, getAvailabilitySlots, createAppointment,
  formatPrice, formatDuration, getDateRange, formatDate, extractTime, getInitials,
  type PublicProfessional, type PublicService, type AvailabilityMap,
} from '../../services/booking'
import {
  Calendar, Clock, User, Mail, Phone, FileText, ChevronRight,
  ChevronLeft, CheckCircle, Loader2, AlertCircle, ArrowLeft,
} from 'lucide-react'

// ── Schema del formulario de paciente ─────────────────────────────────────
const patientSchema = z.object({
  patient_name:  z.string().min(2, 'Mínimo 2 caracteres'),
  patient_email: z.string().email('Email inválido'),
  patient_phone: z.string().optional().or(z.literal('')),
  patient_notes: z.string().max(500).optional().or(z.literal('')),
})
type PatientForm = z.infer<typeof patientSchema>

// ── Steps ─────────────────────────────────────────────────────────────────
type Step = 'service' | 'datetime' | 'form' | 'confirm'

function dateKeyLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()

  // Data
  const [professional, setProfessional] = useState<PublicProfessional | null>(null)
  const [services, setServices]         = useState<PublicService[]>([])
  const [availability, setAvailability] = useState<AvailabilityMap>({})

  // Selections
  const [selectedService, setSelectedService] = useState<PublicService | null>(null)
  const [selectedDate, setSelectedDate]       = useState<string>('')
  const [selectedSlot, setSelectedSlot]       = useState<string>('')

  // UI state
  const [step, setStep]         = useState<Step>('service')
  const [loading, setLoading]   = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]       = useState('')
  const [confirmation, setConfirmation] = useState<{ starts_at: string; confirmation_token: string } | null>(null)

  // Calendario — semana visible
  const [weekOffset, setWeekOffset] = useState(0)

  const { register, handleSubmit, formState: { errors } } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  })

  // ── Cargar perfil y servicios ────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return
    Promise.all([getPublicProfile(slug), getPublicServices(slug)])
      .then(([prof, svcs]) => { setProfessional(prof); setServices(svcs) })
      .catch(() => setError('No se pudo cargar el perfil'))
      .finally(() => setLoading(false))
  }, [slug])

  // ── Cargar slots cuando hay servicio ────────────────────────────────────
  useEffect(() => {
    if (!slug || !selectedService) return
    const { start, end } = getDateRange(45)
    setLoadingSlots(true)
    getAvailabilitySlots(slug, start, end, selectedService.id)
      .then(setAvailability)
      .catch(() => setAvailability({}))
      .finally(() => setLoadingSlots(false))
  }, [slug, selectedService])

  // ── Semana visible ────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + weekOffset * 7 + i)
    return dateKeyLocal(d)
  })

  const hasSlots = (date: string) => (availability[date]?.length ?? 0) > 0

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (formData: PatientForm) => {
    if (!professional || !selectedSlot) return
    setSubmitting(true)
    try {
      const result = await createAppointment({
        professional_id: professional.id,
        service_id: selectedService?.id ?? null,
        patient_name: formData.patient_name,
        patient_email: formData.patient_email,
        patient_phone: formData.patient_phone ?? '',
        patient_notes: formData.patient_notes ?? '',
        starts_at: selectedSlot,
      })
      setConfirmation(result.appointment)
      setStep('confirm')
    } catch {
      setError('Error al crear la cita. El horario puede ya no estar disponible.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error && !professional) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="card p-8 text-center max-w-sm w-full">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-slate-900 font-semibold mb-2">Página no disponible</h2>
        <p className="text-slate-600 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!professional) return null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero / Header */}
      <div className="bg-white/50 border-b border-slate-200/50">
        <div className="max-w-2xl mx-auto px-4 py-8 flex items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl gradient-brand flex items-center justify-center text-white text-xl font-bold shrink-0">
            {professional.avatar_url
              ? <img src={professional.avatar_url} alt={professional.name} className="w-full h-full rounded-2xl object-cover" />
              : getInitials(professional.name)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{professional.name}</h1>
            {professional.specialty && <p className="text-brand-400 text-sm mt-0.5">{professional.specialty}</p>}
            {professional.bio && <p className="text-slate-600 text-sm mt-1 line-clamp-2">{professional.bio}</p>}
          </div>
        </div>

        {/* Stepper */}
        {step !== 'confirm' && (
          <div className="max-w-2xl mx-auto px-4 pb-4">
            <div className="flex items-center gap-2">
              {(['service', 'datetime', 'form'] as Step[]).map((s, idx) => {
                const labels = ['Servicio', 'Fecha y hora', 'Tus datos']
                const isActive = step === s
                const isDone = ['service', 'datetime', 'form'].indexOf(step) > idx
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                      isActive ? 'text-brand-400' : isDone ? 'text-slate-600' : 'text-slate-600'
                    }`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border transition-colors ${
                        isActive ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                        : isDone ? 'border-slate-300 bg-slate-100 text-slate-600'
                        : 'border-slate-200 text-slate-600'
                      }`}>
                        {isDone ? <CheckCircle size={12} /> : idx + 1}
                      </div>
                      {labels[idx]}
                    </div>
                    {idx < 2 && <ChevronRight size={12} className="text-slate-700" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── STEP 1: Servicio ──────────────────────────────────────────── */}
        {step === 'service' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-semibold text-slate-900">¿Qué tipo de consulta necesitas?</h2>
            {services.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-slate-600">Este profesional no tiene servicios disponibles aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedService(svc); setStep('datetime') }}
                    className="w-full card p-4 text-left hover:bg-slate-100/50 hover:border-brand-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900 group-hover:text-brand-300 transition-colors">{svc.name}</p>
                        {svc.description && <p className="text-slate-500 text-sm mt-0.5">{svc.description}</p>}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock size={12} /> {formatDuration(svc.duration_minutes)}
                          </span>
                          <span className="text-xs text-brand-400 font-medium">
                            {formatPrice(svc.price, svc.currency)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-600 group-hover:text-brand-400 transition-colors shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Fecha y hora ──────────────────────────────────────── */}
        {step === 'datetime' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-semibold text-slate-900">Elige fecha y hora</h2>
            </div>

            {/* Servicio seleccionado */}
            {selectedService && (
              <div className="card p-3 flex items-center gap-3">
                <div className="p-2 bg-brand-500/10 rounded-lg"><Clock size={14} className="text-brand-400" /></div>
                <div>
                  <p className="text-slate-800 text-sm font-medium">{selectedService.name}</p>
                  <p className="text-slate-500 text-xs">{formatDuration(selectedService.duration_minutes)} · {formatPrice(selectedService.price, selectedService.currency)}</p>
                </div>
              </div>
            )}

            {loadingSlots ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Semana nav */}
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

                  {/* Grid de días */}
                  <div className="grid grid-cols-7 divide-x divide-slate-200/50">
                    {weekDays.map(date => {
                      const d = new Date(date + 'T12:00:00')
                      const isSelected = selectedDate === date
                      const available = hasSlots(date)
                      const isToday = date === dateKeyLocal(new Date())

                      return (
                        <button
                          key={date}
                          disabled={!available}
                          onClick={() => setSelectedDate(date)}
                          className={`flex flex-col items-center py-3 gap-1 transition-colors ${
                            isSelected ? 'bg-brand-600/30' : available ? 'hover:bg-slate-100/50' : ''
                          } disabled:cursor-not-allowed`}
                        >
                          <span className={`text-xs font-medium uppercase tracking-wide ${
                            isSelected ? 'text-brand-400' : 'text-slate-500'
                          }`}>
                            {d.toLocaleDateString('es-CL', { weekday: 'short' }).slice(0, 2)}
                          </span>
                          <span className={`text-sm font-bold ${
                            isSelected ? 'text-brand-300'
                            : isToday ? 'text-brand-400'
                            : available ? 'text-slate-800' : 'text-slate-600'
                          }`}>
                            {d.getDate()}
                          </span>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            available ? (isSelected ? 'bg-brand-400' : 'bg-brand-600') : 'bg-transparent'
                          }`} />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Slots del día seleccionado */}
                {selectedDate && (
                  <div>
                    <p className="text-slate-600 text-sm mb-3 capitalize">{formatDate(selectedDate)}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {(availability[selectedDate] ?? []).map(slot => {
                        const isSelected = selectedSlot === slot
                        return (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                                : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {extractTime(slot)}
                          </button>
                        )
                      })}
                    </div>
                    {selectedSlot && (
                      <button
                        onClick={() => setStep('form')}
                        className="btn-primary w-full justify-center mt-4"
                      >
                        Continuar <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                )}

                {Object.keys(availability).length === 0 && !loadingSlots && (
                  <div className="card p-8 text-center">
                    <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-600">No hay horarios disponibles en los próximos 45 días</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Datos del paciente ────────────────────────────────── */}
        {step === 'form' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-lg font-semibold text-slate-900">Tus datos</h2>
            </div>

            {/* Resumen de la cita */}
            <div className="card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar size={14} className="text-brand-400" />
                <span className="capitalize">{formatDate(selectedDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Clock size={14} className="text-brand-400" />
                <span>{extractTime(selectedSlot)} — {selectedService && formatDuration(selectedService.duration_minutes)}</span>
              </div>
              {selectedService && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={14} className="text-brand-400" />
                  <span>{selectedService.name} · {formatPrice(selectedService.price, selectedService.currency)}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Nombre completo *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input {...register('patient_name')} type="text" placeholder="Tu nombre completo"
                    className={`${errors.patient_name ? 'input-error' : 'input'} pl-10`} />
                </div>
                {errors.patient_name && <p className="error-msg">{errors.patient_name.message}</p>}
              </div>

              <div>
                <label className="label">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input {...register('patient_email')} type="email" placeholder="tu@email.com"
                    className={`${errors.patient_email ? 'input-error' : 'input'} pl-10`} />
                </div>
                {errors.patient_email && <p className="error-msg">{errors.patient_email.message}</p>}
              </div>

              <div>
                <label className="label">Teléfono <span className="text-slate-600 font-normal">(opcional)</span></label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input {...register('patient_phone')} type="tel" placeholder="+56 9 1234 5678"
                    className="input pl-10" />
                </div>
              </div>

              <div>
                <label className="label">Notas adicionales <span className="text-slate-600 font-normal">(opcional)</span></label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 text-slate-500" size={15} />
                  <textarea {...register('patient_notes')} rows={3} placeholder="Motivo de consulta, síntomas, etc."
                    className="input pl-10 resize-none" />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-3">
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" />Agendando...</>
                  : <>Confirmar cita <ChevronRight size={16} /></>}
              </button>

              <p className="text-slate-600 text-xs text-center">
                Recibirás un email de confirmación con los detalles de tu cita.
              </p>
            </form>
          </div>
        )}

        {/* ── STEP 4: Confirmación ──────────────────────────────────────── */}
        {step === 'confirm' && confirmation && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="card p-8">
              <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">¡Cita agendada!</h2>
              <p className="text-slate-600 text-sm mb-6">Te enviamos un email de confirmación.</p>

              <div className="bg-slate-50/50 rounded-xl p-4 text-left space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-brand-400" />
                  <span className="text-slate-700">{professional.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-brand-400" />
                  <span className="text-slate-700 capitalize">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-brand-400" />
                  <span className="text-slate-700">
                    {extractTime(confirmation.starts_at)}
                    {selectedService && ` · ${formatDuration(selectedService.duration_minutes)}`}
                  </span>
                </div>
                {selectedService && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className="text-brand-400" />
                    <span className="text-slate-700">{selectedService.name}</span>
                  </div>
                )}
              </div>

              <a
                href={`/cancel/${confirmation.confirmation_token}`}
                className="text-slate-500 text-sm hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                ¿Necesitas cancelar? Haz clic aquí
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

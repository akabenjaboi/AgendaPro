import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../stores/authStore'
import {
  getMyProfile,
  updateProfile,
  isSlugTaken,
  toSlug,
  TIMEZONES,
  type ProfessionalProfile,
} from '../../services/professional'
import toast from 'react-hot-toast'
import {
  User,
  Link2,
  Copy,
  ExternalLink,
  Save,
  Loader2,
  Globe,
  Phone,
  FileText,
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Schema de validación
// ─────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  specialty: z.string().max(100, 'Máximo 100 caracteres').optional().or(z.literal('')),
  bio: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  phone: z.string().max(20, 'Máximo 20 caracteres').optional().or(z.literal('')),
  slug: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(60, 'Máximo 60 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  timezone: z.string().min(1, 'Selecciona una zona horaria'),
  booking_link_active: z.boolean(),
  max_appointments_per_day: z.union([z.coerce.number().min(1, 'Mínimo 1 cita').max(100, 'Máximo 100 citas'), z.literal('')]).optional(),
  max_appointments_per_week: z.union([z.coerce.number().min(1, 'Mínimo 1 cita').max(1000, 'Máximo 1000 citas'), z.literal('')]).optional(),
})

type FormData = z.infer<typeof schema>

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [bookingActive, setBookingActive] = useState(true)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      specialty: '',
      bio: '',
      phone: '',
      slug: '',
      timezone: 'America/Santiago',
      booking_link_active: true,
      max_appointments_per_day: '',
      max_appointments_per_week: '',
    },
  })

  const watchedSlug = watch('slug')
  const watchedName = watch('name')

  // ── Cargar perfil al montar ──────────────────
  useEffect(() => {
    if (!user) return
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await getMyProfile(user!.id)
      if (data) {
        setProfile(data)
        setBookingActive(data.booking_link_active)
        reset({
          name: data.name,
          specialty: data.specialty ?? '',
          bio: data.bio ?? '',
          phone: data.phone ?? '',
          slug: data.slug,
          timezone: data.timezone,
          booking_link_active: data.booking_link_active,
          max_appointments_per_day: data.max_appointments_per_day ?? '',
          max_appointments_per_week: data.max_appointments_per_week ?? '',
        })
      }
    } catch {
      toast.error('Error al cargar tu perfil')
    } finally {
      setLoading(false)
    }
  }

  // ── Auto-generar slug desde el nombre ──────
  const handleNameBlur = () => {
    if (!profile || watchedSlug === profile.slug) return
    // Solo auto-genera si el slug aún coincide con el nombre original
    if (watchedSlug === toSlug(profile.name)) {
      setValue('slug', toSlug(watchedName), { shouldDirty: true, shouldValidate: true })
    }
  }

  // ── Validar slug con debounce ───────────────
  const checkSlug = useCallback(
    async (slug: string) => {
      if (!profile || slug === profile.slug || slug.length < 3) {
        setSlugStatus('idle')
        return
      }
      setSlugStatus('checking')
      try {
        const taken = await isSlugTaken(slug, profile.id)
        setSlugStatus(taken ? 'taken' : 'available')
      } catch {
        setSlugStatus('idle')
      }
    },
    [profile]
  )

  useEffect(() => {
    if (!watchedSlug || !profile) return
    const timer = setTimeout(() => checkSlug(watchedSlug), 500)
    return () => clearTimeout(timer)
  }, [watchedSlug, checkSlug, profile])

  // ── Toggle booking link ─────────────────────
  const handleToggleBooking = async () => {
    if (!profile) return
    const newValue = !bookingActive
    setBookingActive(newValue)
    setValue('booking_link_active', newValue, { shouldDirty: true })
  }

  // ── Guardar perfil ──────────────────────────
  const onSubmit = async (data: FormData) => {
    if (!profile) return
    if (slugStatus === 'taken') {
      toast.error('El slug ya está en uso, elige otro')
      return
    }
    setSaving(true)
    try {
      const updated = await updateProfile(profile.id, {
        name: data.name,
        specialty: data.specialty || null,
        bio: data.bio || null,
        phone: data.phone || null,
        slug: data.slug,
        timezone: data.timezone,
        booking_link_active: data.booking_link_active,
        max_appointments_per_day: data.max_appointments_per_day === '' || data.max_appointments_per_day === undefined
          ? null
          : Number(data.max_appointments_per_day),
        max_appointments_per_week: data.max_appointments_per_week === '' || data.max_appointments_per_week === undefined
          ? null
          : Number(data.max_appointments_per_week),
      })
      setProfile(updated)
      setBookingActive(updated.booking_link_active)
      reset(data) // resetear isDirty
      toast.success('Perfil actualizado correctamente')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const bookingUrl = profile
    ? `${window.location.origin}/book/${profile.slug}`
    : ''

  const copyLink = () => {
    navigator.clipboard.writeText(bookingUrl)
    toast.success('Link copiado')
  }

  // ── Loading state ───────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <p className="text-slate-600">No se encontró tu perfil profesional.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-600 mt-1">Administra tu perfil y preferencias</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── SECCIÓN: Perfil ─────────────────── */}
        <Section icon={<User size={18} className="text-brand-400" />} title="Información personal">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="sm:col-span-2">
              <label className="label">Nombre completo *</label>
              <input
                {...register('name')}
                onBlur={handleNameBlur}
                type="text"
                placeholder="Dr. Juan Pérez"
                className={errors.name ? 'input-error' : 'input'}
              />
              {errors.name && <p className="error-msg">{errors.name.message}</p>}
            </div>

            {/* Especialidad */}
            <div className="sm:col-span-2">
              <label className="label">
                Especialidad
                <span className="text-slate-600 font-normal ml-1">(opcional)</span>
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  {...register('specialty')}
                  type="text"
                  placeholder="Psicólogo, Médico General, Nutricionista..."
                  className={`${errors.specialty ? 'input-error' : 'input'} pl-10`}
                />
              </div>
              {errors.specialty && <p className="error-msg">{errors.specialty.message}</p>}
            </div>

            {/* Bio */}
            <div className="sm:col-span-2">
              <label className="label">
                Descripción / Bio
                <span className="text-slate-600 font-normal ml-1">(opcional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3.5 text-slate-500" size={16} />
                <textarea
                  {...register('bio')}
                  rows={3}
                  placeholder="Cuéntale a tus pacientes sobre ti, tu experiencia y especialización..."
                  className={`${errors.bio ? 'input-error' : 'input'} pl-10 resize-none`}
                />
              </div>
              <div className="flex justify-between mt-1">
                {errors.bio
                  ? <p className="error-msg">{errors.bio.message}</p>
                  : <span />}
                <span className="text-xs text-slate-600">
                  {(watch('bio') || '').length}/500
                </span>
              </div>
            </div>

            {/* Teléfono */}
            <div className="sm:col-span-2">
              <label className="label">
                Teléfono
                <span className="text-slate-600 font-normal ml-1">(opcional — WhatsApp futuro)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  {...register('phone')}
                  type="tel"
                  placeholder="+56 9 1234 5678"
                  className={`${errors.phone ? 'input-error' : 'input'} pl-10`}
                />
              </div>
              {errors.phone && <p className="error-msg">{errors.phone.message}</p>}
            </div>

            {/* Zona horaria */}
            <div className="sm:col-span-2">
              <label className="label">Zona horaria</label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <select
                  {...register('timezone')}
                  className={`${errors.timezone ? 'input-error' : 'input'} pl-10 appearance-none`}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value} className="bg-white">
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.timezone && <p className="error-msg">{errors.timezone.message}</p>}
            </div>

            <div>
              <label className="label">
                Máximo de citas por día
                <span className="text-slate-600 font-normal ml-1">(vacío = sin límite)</span>
              </label>
              <input
                {...register('max_appointments_per_day')}
                type="number"
                min="1"
                step="1"
                className={errors.max_appointments_per_day ? 'input-error' : 'input'}
              />
              {errors.max_appointments_per_day && <p className="error-msg">{String(errors.max_appointments_per_day.message)}</p>}
            </div>

            <div>
              <label className="label">
                Máximo de citas por semana
                <span className="text-slate-600 font-normal ml-1">(vacío = sin límite)</span>
              </label>
              <input
                {...register('max_appointments_per_week')}
                type="number"
                min="1"
                step="1"
                className={errors.max_appointments_per_week ? 'input-error' : 'input'}
              />
              {errors.max_appointments_per_week && <p className="error-msg">{String(errors.max_appointments_per_week.message)}</p>}
            </div>
          </div>
        </Section>

        {/* ── SECCIÓN: Link público ───────────── */}
        <Section icon={<Link2 size={18} className="text-brand-400" />} title="Link de agendamiento">
          {/* Vista previa del link */}
          <div className="bg-slate-50/50 rounded-xl p-4 flex items-center gap-3 mb-4">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${
              bookingActive ? 'bg-green-400 animate-pulse-slow' : 'bg-slate-600'
            }`} />
            <span className="text-slate-700 text-sm font-mono flex-1 truncate">
              {window.location.origin}/book/<span className="text-brand-400">{watchedSlug || '...'}</span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={copyLink}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Copiar link"
              >
                <Copy size={14} />
              </button>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-slate-600 hover:text-brand-400 hover:bg-slate-100 rounded-lg transition-colors"
                title="Abrir página pública"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Slug editable */}
          <div className="mb-4">
            <label className="label">
              Identificador único (slug) *
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 text-sm select-none pointer-events-none">
                /book/
              </div>
              <input
                {...register('slug')}
                type="text"
                placeholder="dr-juan-perez"
                className={`${errors.slug || slugStatus === 'taken' ? 'input-error' : 'input'} pl-14 pr-10`}
              />
              {/* Indicador de estado del slug */}
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {slugStatus === 'checking' && (
                  <Loader2 size={15} className="text-slate-500 animate-spin" />
                )}
                {slugStatus === 'available' && (
                  <CheckCircle size={15} className="text-green-400" />
                )}
                {slugStatus === 'taken' && (
                  <XCircle size={15} className="text-red-400" />
                )}
              </div>
            </div>
            {errors.slug && <p className="error-msg">{errors.slug.message}</p>}
            {slugStatus === 'taken' && !errors.slug && (
              <p className="error-msg">Este identificador ya está en uso</p>
            )}
            {slugStatus === 'available' && (
              <p className="text-xs text-green-400 mt-1">✓ Disponible</p>
            )}
            <p className="text-xs text-slate-600 mt-1">
              Solo letras minúsculas, números y guiones. Ej: dr-juan-perez
            </p>
          </div>

          {/* Toggle activo/inactivo */}
          <div className="flex items-center justify-between p-4 bg-slate-50/30 rounded-xl">
            <div>
              <p className="text-slate-800 font-medium text-sm">Link de agendamiento activo</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {bookingActive
                  ? 'Tus clientes pueden ver tu página y agendar citas'
                  : 'Tu página está desactivada, no se pueden agendar citas nuevas'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleBooking}
              className="shrink-0 transition-colors ml-4"
              aria-label="Toggle link activo"
            >
              {bookingActive
                ? <ToggleRight size={36} className="text-brand-500" />
                : <ToggleLeft size={36} className="text-slate-600" />}
            </button>
          </div>
        </Section>

        {/* ── Botón guardar ──────────────────── */}
        <div className="flex items-center justify-between pt-2">
          {isDirty ? (
            <p className="text-sm text-amber-400 flex items-center gap-2">
              <AlertCircle size={14} />
              Tienes cambios sin guardar
            </p>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={saving || slugStatus === 'taken'}
            className="btn-primary px-6 py-3"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────
// Sub-componente: Section card
// ─────────────────────────────────────────────
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/50">
        {icon}
        <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}

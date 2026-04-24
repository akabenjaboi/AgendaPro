import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuthStore } from '../../stores/authStore'
import { getMyProfile } from '../../services/professional'
import {
  getServices,
  createService,
  updateService,
  deleteService,
  formatPrice,
  formatDuration,
  DURATION_OPTIONS,
  CURRENCY_OPTIONS,
  type Service,
} from '../../services/services'
import toast from 'react-hot-toast'
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  DollarSign,
  Briefcase,
  Loader2,
  X,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  PackageOpen,
} from 'lucide-react'

// ─── Schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(300, 'Máximo 300 caracteres').optional().or(z.literal('')),
  duration_minutes: z.coerce.number().min(5, 'Mínimo 5 minutos').max(480, 'Máximo 8 horas'),
  price: z.union([
    z.coerce.number().min(0, 'El precio no puede ser negativo'),
    z.literal(''),
  ]).optional(),
  currency: z.string().min(1),
  is_active: z.boolean(),
})

type ServiceFormData = z.infer<typeof schema>

// ─── Componente principal ───────────────────────────────────────────────────
export default function ServicesPage() {
  const { user } = useAuthStore()
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // ── Cargar datos ─────────────────────────────
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
      const data = await getServices(prof.id)
      setServices(data)
    } catch {
      toast.error('Error al cargar servicios')
    } finally {
      setLoading(false)
    }
  }

  // ── Abrir modal ──────────────────────────────
  const openCreate = () => {
    setEditingService(null)
    setModalOpen(true)
  }

  const openEdit = (service: Service) => {
    setEditingService(service)
    setModalOpen(true)
  }

  // ── Guardar (crear o editar) ─────────────────
  const handleSave = async (data: ServiceFormData) => {
    if (!professionalId) return

    const payload = {
      name: data.name,
      description: data.description || null,
      duration_minutes: data.duration_minutes,
      price: data.price === '' || data.price === undefined ? null : Number(data.price),
      currency: data.currency,
      is_active: data.is_active,
    }

    try {
      if (editingService) {
        const updated = await updateService(editingService.id, professionalId, payload)
        setServices(prev => prev.map(s => s.id === updated.id ? updated : s))
        toast.success('Servicio actualizado')
      } else {
        const created = await createService(professionalId, payload)
        setServices(prev => [created, ...prev])
        toast.success('Servicio creado')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  // ── Toggle activo/inactivo ───────────────────
  const handleToggle = async (service: Service) => {
    if (!professionalId) return
    setSavingId(service.id)
    try {
      const updated = await updateService(service.id, professionalId, {
        is_active: !service.is_active,
      })
      setServices(prev => prev.map(s => s.id === updated.id ? updated : s))
      toast.success(updated.is_active ? 'Servicio activado' : 'Servicio desactivado')
    } catch {
      toast.error('Error al cambiar estado')
    } finally {
      setSavingId(null)
    }
  }

  // ── Eliminar ─────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget || !professionalId) return
    try {
      await deleteService(deleteTarget.id, professionalId)
      setServices(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success('Servicio eliminado')
      setDeleteTarget(null)
    } catch {
      toast.error('Error al eliminar')
    }
  }

  // ── Render ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const active = services.filter(s => s.is_active)
  const inactive = services.filter(s => !s.is_active)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Servicios</h1>
          <p className="text-slate-600 mt-1 text-sm">
            {services.length === 0
              ? 'Aún no tienes servicios'
              : `${active.length} activo${active.length !== 1 ? 's' : ''} · ${inactive.length} inactivo${inactive.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} />
          Nuevo servicio
        </button>
      </div>

      {/* Estado vacío */}
      {services.length === 0 && (
        <div className="card p-12 text-center">
          <PackageOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-slate-700 font-semibold mb-2">Sin servicios todavía</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            Crea tu primer servicio para que los clientes puedan elegir qué tipo de atención necesitan al agendar.
          </p>
          <button onClick={openCreate} className="btn-primary mx-auto">
            <Plus size={16} />
            Crear primer servicio
          </button>
        </div>
      )}

      {/* Grid de servicios activos */}
      {active.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Activos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                toggling={savingId === service.id}
                onEdit={() => openEdit(service)}
                onToggle={() => handleToggle(service)}
                onDelete={() => setDeleteTarget(service)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid de servicios inactivos */}
      {inactive.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Inactivos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            {inactive.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                toggling={savingId === service.id}
                onEdit={() => openEdit(service)}
                onToggle={() => handleToggle(service)}
                onDelete={() => setDeleteTarget(service)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <ServiceModal
          service={editingService}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Modal de confirmación de eliminar */}
      {deleteTarget && (
        <DeleteConfirmModal
          serviceName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

// ─── ServiceCard ────────────────────────────────────────────────────────────
function ServiceCard({
  service,
  toggling,
  onEdit,
  onToggle,
  onDelete,
}: {
  service: Service
  toggling: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="card p-5 flex flex-col gap-4 group">
      {/* Nombre + acciones */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-brand-500/10 rounded-xl shrink-0">
            <Briefcase size={16} className="text-brand-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{service.name}</h3>
            {service.description && (
              <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{service.description}</p>
            )}
          </div>
        </div>

        {/* Botones (visibles al hacer hover) */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Duración + precio */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
          <Clock size={14} className="text-slate-500" />
          {formatDuration(service.duration_minutes)}
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
          <DollarSign size={14} className="text-slate-500" />
          {formatPrice(service.price, service.currency)}
        </div>
      </div>

      {/* Toggle activo */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
        <span className="text-xs text-slate-500">
          {service.is_active ? 'Disponible para clientes' : 'No disponible'}
        </span>
        <button
          onClick={onToggle}
          disabled={toggling}
          className="flex items-center gap-2 text-xs transition-colors"
        >
          {toggling
            ? <Loader2 size={20} className="text-slate-500 animate-spin" />
            : service.is_active
              ? <ToggleRight size={24} className="text-brand-500" />
              : <ToggleLeft size={24} className="text-slate-600" />}
        </button>
      </div>
    </div>
  )
}

// ─── ServiceModal ───────────────────────────────────────────────────────────
function ServiceModal({
  service,
  onClose,
  onSave,
}: {
  service: Service | null
  onClose: () => void
  onSave: (data: ServiceFormData) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      duration_minutes: service?.duration_minutes ?? 60,
      price: service?.price ?? '',
      currency: service?.currency ?? 'CLP',
      is_active: service?.is_active ?? true,
    },
  })

  const onSubmit = async (data: ServiceFormData) => {
    setSaving(true)
    try {
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg card p-0 overflow-hidden animate-slide-up shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
          <h2 className="font-semibold text-slate-900">
            {service ? 'Editar servicio' : 'Nuevo servicio'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="label">Nombre del servicio *</label>
            <input
              {...register('name')}
              type="text"
              placeholder="Consulta inicial, Sesión de seguimiento..."
              className={errors.name ? 'input-error' : 'input'}
              autoFocus
            />
            {errors.name && <p className="error-msg">{errors.name.message}</p>}
          </div>

          {/* Descripción */}
          <div>
            <label className="label">
              Descripción
              <span className="text-slate-600 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Breve descripción de qué incluye este servicio..."
              className="input resize-none"
            />
            <p className="text-xs text-slate-600 mt-1 text-right">
              {(watch('description') || '').length}/300
            </p>
          </div>

          {/* Duración + Precio en fila */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Duración *</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <select
                  {...register('duration_minutes')}
                  className={`${errors.duration_minutes ? 'input-error' : 'input'} pl-9 appearance-none`}
                >
                  {DURATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-white">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.duration_minutes && <p className="error-msg">{errors.duration_minutes.message}</p>}
            </div>

            <div>
              <label className="label">
                Precio
                <span className="text-slate-600 font-normal ml-1">(vacío = gratis)</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                <input
                  {...register('price')}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  className={`${errors.price ? 'input-error' : 'input'} pl-9`}
                />
              </div>
              {errors.price && <p className="error-msg">{String(errors.price.message)}</p>}
            </div>
          </div>

          {/* Moneda */}
          <div>
            <label className="label">Moneda</label>
            <select
              {...register('currency')}
              className="input appearance-none"
            >
              {CURRENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-white">
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="flex items-center justify-between p-3 bg-slate-50/40 rounded-xl">
            <span className="text-sm text-slate-700">Servicio activo</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                {...register('is_active')}
                type="checkbox"
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer
                              peer-checked:bg-brand-600 transition-colors
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                              after:bg-white after:rounded-full after:h-5 after:w-5
                              after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <><Loader2 size={15} className="animate-spin" />Guardando...</>
                : service ? 'Guardar cambios' : 'Crear servicio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── DeleteConfirmModal ─────────────────────────────────────────────────────
function DeleteConfirmModal({
  serviceName,
  onCancel,
  onConfirm,
}: {
  serviceName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm card p-6 animate-slide-up shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-red-500/10 rounded-xl">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h2 className="font-semibold text-slate-900">Eliminar servicio</h2>
        </div>
        <p className="text-slate-600 text-sm mb-6">
          ¿Estás seguro de que quieres eliminar{' '}
          <span className="text-slate-800 font-medium">"{serviceName}"</span>?
          Esta acción no se puede deshacer. Las citas existentes no se verán afectadas.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button onClick={onConfirm} className="btn-danger flex-1 justify-center">
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}


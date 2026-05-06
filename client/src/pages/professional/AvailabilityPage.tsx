import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { getMyProfile } from '../../services/professional'
import {
  getAvailability,
  saveAvailability,
  getBlockedSlots,
  addBlockedSlot,
  removeBlockedSlot,
  slotsToWeekDays,
  TIME_OPTIONS,
  type WeekDay,
  type BlockedSlot,
} from '../../services/availability'
import toast from 'react-hot-toast'
import { format, parseISO, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale/es'
import {
  Loader2,
  Plus,
  Trash2,
  CalendarOff,
  Clock,
  X,
  Calendar,
  AlertCircle,
} from 'lucide-react'

// ─── Componente principal ────────────────────────────────────────────────────
export default function AvailabilityPage() {
  const { user } = useAuthStore()
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  const [weekDays, setWeekDays]   = useState<WeekDay[]>([])
  const [blocked, setBlocked]     = useState<BlockedSlot[]>([])
  const [loading, setLoading]     = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showBlockForm, setShowBlockForm] = useState(false)
  const initializedRef = useRef(false)

  // ── Cargar datos ─────────────────────────────
  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  const loadAll = async () => {
    setLoading(true)
    try {
      const prof = await getMyProfile(user!.id)
      if (!prof) return
      setProfessionalId(prof.id)
      const [slots, blockedSlots] = await Promise.all([
        getAvailability(prof.id),
        getBlockedSlots(prof.id),
      ])
      setWeekDays(slotsToWeekDays(slots))
      setBlocked(blockedSlots)
      initializedRef.current = true
    } catch {
      toast.error('Error al cargar disponibilidad')
    } finally {
      setLoading(false)
    }
  }

  // ── Guardado automático del horario semanal ───
  useEffect(() => {
    if (!professionalId || !initializedRef.current) return

    const invalid = weekDays.some(d => d.enabled && d.start_time >= d.end_time)
    if (invalid) {
      setSaveState('error')
      return
    }

    setSaveState('saving')
    const timeoutId = window.setTimeout(async () => {
      try {
        await saveAvailability(professionalId, weekDays)
        setSaveState('saved')
        window.setTimeout(() => setSaveState('idle'), 1200)
      } catch {
        setSaveState('error')
        toast.error('Error al guardar el horario')
      }
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [professionalId, weekDays])

  // ── Cambios en días ──────────────────────────
  const toggleDay = (index: number) => {
    setWeekDays(prev => prev.map((d, i) =>
      i === index ? { ...d, enabled: !d.enabled } : d
    ))
  }

  const updateTime = (index: number, field: 'start_time' | 'end_time', value: string) => {
    setWeekDays(prev => prev.map((d, i) =>
      i === index ? { ...d, [field]: value } : d
    ))
  }

  // ── Aplicar mismo horario a días laborales ───
  const applyToWeekdays = (sourceIndex: number) => {
    const source = weekDays[sourceIndex]
    setWeekDays(prev => prev.map((d, i) => {
      // Solo aplica a Lun-Vie (índices 0-4)
      if (i <= 4 && d.enabled) {
        return { ...d, start_time: source.start_time, end_time: source.end_time }
      }
      return d
    }))
    toast.success('Horario copiado a días laborales activos')
  }

  // ── Eliminar bloqueo ─────────────────────────
  const handleRemoveBlocked = async (slot: BlockedSlot) => {
    if (!professionalId) return
    try {
      await removeBlockedSlot(slot.id, professionalId)
      setBlocked(prev => prev.filter(b => b.id !== slot.id))
      toast.success('Bloqueo eliminado')
    } catch {
      toast.error('Error al eliminar el bloqueo')
    }
  }

  // ── Agregar bloqueo ──────────────────────────
  const handleAddBlocked = async (slot: { starts_at: string; ends_at: string; reason: string }) => {
    if (!professionalId) return
    try {
      const created = await addBlockedSlot(
        professionalId,
        slot.starts_at,
        slot.ends_at,
        slot.reason || null
      )
      setBlocked(prev => [...prev, created].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      ))
      setShowBlockForm(false)
      toast.success('Horario bloqueado')
    } catch {
      toast.error('Error al bloquear el horario')
    }
  }

  // ── Loading state ────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const enabledCount = weekDays.filter(d => d.enabled).length

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disponibilidad</h1>
          <p className="text-slate-600 mt-1 text-sm">
            {enabledCount === 0
              ? 'Sin días configurados — no recibirás citas'
              : `${enabledCount} día${enabledCount !== 1 ? 's' : ''} habilitado${enabledCount !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs mt-1 text-slate-500">
            {saveState === 'saving' && 'Guardando cambios automáticamente...'}
            {saveState === 'saved' && 'Cambios guardados'}
            {saveState === 'error' && 'Hay horarios inválidos o un error al guardar'}
            {saveState === 'idle' && 'Guardado automático activado'}
          </p>
        </div>
      </div>

      {/* ── Horario semanal ──────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/50">
          <Clock size={17} className="text-brand-400" />
          <h2 className="font-semibold text-slate-900 text-sm">Horario semanal</h2>
        </div>

        {enabledCount === 0 && (
          <div className="px-5 py-3 bg-amber-500/5 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertCircle size={14} />
              Activa al menos un día para que los clientes puedan agendar
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-200/50">
          {weekDays.map((day, index) => (
            <DayRow
              key={day.day_of_week}
              day={day}
              index={index}
              onToggle={() => toggleDay(index)}
              onTimeChange={(field, value) => updateTime(index, field, value)}
              onApplyToWeekdays={() => applyToWeekdays(index)}
              isWeekday={index <= 4}
            />
          ))}
        </div>
      </div>

      {/* ── Fechas bloqueadas ────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/50">
          <div className="flex items-center gap-3">
            <CalendarOff size={17} className="text-brand-400" />
            <h2 className="font-semibold text-slate-900 text-sm">Fechas bloqueadas</h2>
          </div>
          <button
            onClick={() => setShowBlockForm(true)}
            className="btn-secondary py-1.5 px-3 text-xs"
          >
            <Plus size={13} />
            Agregar bloqueo
          </button>
        </div>

        {blocked.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="w-9 h-9 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No tienes períodos bloqueados</p>
            <p className="text-slate-600 text-xs mt-1">
              Usa los bloqueos para vacaciones, licencias o días especiales
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50">
            {blocked.map(slot => (
              <BlockedSlotRow
                key={slot.id}
                slot={slot}
                onRemove={() => handleRemoveBlocked(slot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal agregar bloqueo */}
      {showBlockForm && (
        <AddBlockModal
          onClose={() => setShowBlockForm(false)}
          onSave={handleAddBlocked}
        />
      )}
    </div>
  )
}

// ─── DayRow ──────────────────────────────────────────────────────────────────
function DayRow({
  day,
  index,
  onToggle,
  onTimeChange,
  onApplyToWeekdays,
  isWeekday,
}: {
  day: WeekDay
  index: number
  onToggle: () => void
  onTimeChange: (field: 'start_time' | 'end_time', value: string) => void
  onApplyToWeekdays: () => void
  isWeekday: boolean
}) {
  const isInvalid = day.enabled && day.start_time >= day.end_time

  return (
    <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${
      day.enabled ? '' : 'opacity-50'
    }`}>
      {/* Toggle día */}
      <label className="flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={day.enabled}
          onChange={onToggle}
          className="sr-only peer"
          id={`day-${index}`}
        />
        <div className="w-9 h-5 bg-slate-600 rounded-full peer
                        peer-checked:bg-brand-600 transition-colors relative
                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                        after:bg-white after:rounded-full after:h-4 after:w-4
                        after:transition-all peer-checked:after:translate-x-4" />
      </label>

      {/* Nombre del día */}
      <label
        htmlFor={`day-${index}`}
        className="w-24 text-sm font-medium text-slate-800 cursor-pointer shrink-0"
      >
        {day.label}
      </label>

      {/* Selectores de hora */}
      {day.enabled ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={day.start_time}
            onChange={e => onTimeChange('start_time', e.target.value)}
            className={`input py-1.5 text-sm appearance-none ${isInvalid ? 'border-red-500/50' : ''}`}
          >
            {TIME_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-white">{o.label}</option>
            ))}
          </select>

          <span className="text-slate-600 text-sm shrink-0">→</span>

          <select
            value={day.end_time}
            onChange={e => onTimeChange('end_time', e.target.value)}
            className={`input py-1.5 text-sm appearance-none ${isInvalid ? 'border-red-500/50' : ''}`}
          >
            {TIME_OPTIONS.map(o => (
              <option key={o.value} value={o.value} className="bg-white">{o.label}</option>
            ))}
          </select>

          {/* Botón copiar a días laborales (solo en días hábiles) */}
          {isWeekday && (
            <button
              type="button"
              onClick={onApplyToWeekdays}
              title="Aplicar este horario a todos los días laborales activos"
              className="text-xs text-slate-500 hover:text-brand-400 transition-colors shrink-0 hidden sm:block"
            >
              Copiar a semana
            </button>
          )}
        </div>
      ) : (
        <span className="text-slate-600 text-sm flex-1">No disponible</span>
      )}

      {/* Error de rango */}
      {isInvalid && (
        <span className="text-xs text-red-400 shrink-0">Hora inválida</span>
      )}
    </div>
  )
}

// ─── BlockedSlotRow ───────────────────────────────────────────────────────────
function BlockedSlotRow({
  slot,
  onRemove,
}: {
  slot: BlockedSlot
  onRemove: () => void
}) {
  const start = parseISO(slot.starts_at)
  const end   = parseISO(slot.ends_at)
  const sameDay = isSameDay(start, end)

  const dateLabel = sameDay
    ? format(start, "EEEE d 'de' MMMM", { locale: es })
    : `${format(start, "d MMM", { locale: es })} → ${format(end, "d MMM yyyy", { locale: es })}`

  const timeLabel = sameDay
    ? `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`
    : null

  return (
    <div className="flex items-center gap-4 px-5 py-4 group hover:bg-slate-100/20 transition-colors">
      <div className="p-2 bg-red-500/10 rounded-lg shrink-0">
        <CalendarOff size={14} className="text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 text-sm font-medium capitalize">{dateLabel}</p>
        {timeLabel && <p className="text-slate-500 text-xs">{timeLabel}</p>}
        {slot.reason && (
          <p className="text-slate-600 text-xs mt-0.5 truncate">"{slot.reason}"</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors
                   opacity-0 group-hover:opacity-100"
        title="Eliminar bloqueo"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── AddBlockModal ────────────────────────────────────────────────────────────
function AddBlockModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { starts_at: string; ends_at: string; reason: string }) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [isAllDay, setIsAllDay] = useState(true)
  const [form, setForm] = useState({
    date_from: '',
    date_to:   '',
    time_from: '00:00',
    time_to:   '23:30',
    reason:    '',
  })
  const [error, setError] = useState('')

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.date_from) { setError('Selecciona la fecha de inicio'); return }
    const dateTo = form.date_to || form.date_from

    const starts_at = isAllDay
      ? `${form.date_from}T00:00:00`
      : `${form.date_from}T${form.time_from}:00`

    const ends_at = isAllDay
      ? `${dateTo}T23:59:59`
      : `${dateTo}T${form.time_to}:00`

    if (new Date(ends_at) <= new Date(starts_at)) {
      setError('La fecha/hora de fin debe ser posterior al inicio')
      return
    }

    setSaving(true)
    try {
      await onSave({ starts_at, ends_at, reason: form.reason })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-6 w-full max-w-md card p-0 overflow-hidden animate-slide-up shadow-2xl shadow-black/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
          <div className="flex items-center gap-2">
            <CalendarOff size={16} className="text-red-400" />
            <h2 className="font-semibold text-slate-900">Bloquear horario</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Toggle todo el día */}
          <div className="flex items-center justify-between p-3 bg-slate-50/40 rounded-xl">
            <span className="text-sm text-slate-700">Todo el día</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={() => setIsAllDay(!isAllDay)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-brand-600 transition-colors
                              after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                              after:bg-white after:rounded-full after:h-4 after:w-4
                              after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Desde *</label>
              <input
                type="date"
                value={form.date_from}
                onChange={e => set('date_from', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="label">Hasta <span className="text-slate-600 font-normal">(opcional)</span></label>
              <input
                type="date"
                value={form.date_to}
                onChange={e => set('date_to', e.target.value)}
                min={form.date_from || new Date().toISOString().split('T')[0]}
                className="input text-sm"
              />
            </div>
          </div>

          {/* Horas (solo si no es todo el día) */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hora inicio</label>
                <select value={form.time_from} onChange={e => set('time_from', e.target.value)} className="input text-sm appearance-none">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white">{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Hora fin</label>
                <select value={form.time_to} onChange={e => set('time_to', e.target.value)} className="input text-sm appearance-none">
                  {TIME_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white">{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="label">Motivo <span className="text-slate-600 font-normal">(opcional)</span></label>
            <input
              type="text"
              placeholder="Vacaciones, licencia médica..."
              value={form.reason}
              onChange={e => set('reason', e.target.value)}
              className="input text-sm"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving
                ? <><Loader2 size={14} className="animate-spin" />Guardando...</>
                : <><CalendarOff size={14} />Bloquear</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

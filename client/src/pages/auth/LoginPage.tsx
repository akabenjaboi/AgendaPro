import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import { Calendar, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw error
      toast.success('¡Bienvenido de vuelta!')
      navigate('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
      toast.error(message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar con Google'
      toast.error(message)
      setGoogleLoading(false)
    }
  }

  useEffect(() => {
    if (user) navigate('/dashboard')
  }, [user, navigate])

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Panel izquierdo — decorativo */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden
                      bg-gradient-to-br from-brand-50 via-brand-100/50 to-white">
        {/* Círculos decorativos */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-brand-200/40 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-300/30 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
            <Calendar className="w-5.5 h-5.5 text-slate-900" size={22} />
          </div>
          <span className="text-slate-900 font-bold text-xl">Blinktime</span>
        </div>

        <div className="relative">
          <h2 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
            Gestiona tu agenda<br />
            <span className="text-brand-800">de forma inteligente</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed max-w-sm">
            Permite que tus clientes agenden citas 24/7 desde cualquier dispositivo. Sin llamadas, sin formularios complicados.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              'Link de agendamiento personalizado',
              'Notificaciones automáticas por email',
              'Panel de gestión en tiempo real',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-200 border border-brand-300 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-brand-600" />
                </div>
                <span className="text-slate-700 font-medium text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-slate-500 text-sm">© 2026 Blinktime. Todos los derechos reservados.</p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 lg:max-w-md flex flex-col justify-center px-8 py-12 bg-white shadow-[0_0_40px_rgba(0,0,0,0.03)] z-10">
        <div className="max-w-sm mx-auto w-full">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="text-slate-900 font-bold text-lg">Blinktime</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Iniciar sesión</h1>
            <p className="text-slate-600">Ingresa tus credenciales para continuar</p>
          </div>

          <div className="space-y-3 mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="animate-spin" size={18} /> : <GoogleMark />}
              Continuar con Google
            </button>
            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-xs text-slate-500">o con email</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="tu@email.com"
                  className={`${errors.email ? 'input-error' : 'input'} pl-10`}
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="error-msg">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className={`${errors.password ? 'input-error' : 'input'} pl-10 pr-10`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="error-msg">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-slate-600 text-sm">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.9 2.9l3 2.3c1.8-1.6 2.8-4 2.8-6.8 0-.6-.1-1.2-.2-1.8H12z" />
      <path fill="#34A853" d="M12 22c2.5 0 4.6-.8 6.2-2.2l-3-2.3c-.8.6-1.9 1-3.2 1-2.4 0-4.5-1.6-5.2-3.8l-3.1 2.4C5.3 20 8.4 22 12 22z" />
      <path fill="#FBBC05" d="M6.8 14.7c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.7 8.5C3.2 9.6 3 10.8 3 12s.2 2.4.7 3.5l3.1-2.8z" />
      <path fill="#4285F4" d="M12 6.8c1.4 0 2.7.5 3.7 1.5l2.8-2.8C16.6 3.8 14.5 3 12 3 8.4 3 5.3 5 3.7 8.5l3.1 2.4c.7-2.2 2.8-4.1 5.2-4.1z" />
    </svg>
  )
}

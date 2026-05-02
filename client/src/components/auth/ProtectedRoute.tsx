import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function ProtectedRoute() {
  const { user, session, loading } = useAuthStore()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user || !session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

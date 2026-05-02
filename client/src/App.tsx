import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useAuthStore } from './stores/authStore'

// Pages
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/professional/DashboardPage'
import CalendarPage from './pages/professional/CalendarPage'
import AppointmentsPage from './pages/professional/AppointmentsPage'
import AvailabilityPage from './pages/professional/AvailabilityPage'
import ServicesPage from './pages/professional/ServicesPage'
import SettingsPage from './pages/professional/SettingsPage'
import BookingPage from './pages/public/BookingPage'
import CancelPage from './pages/public/CancelPage'
import ReschedulePage from './pages/public/ReschedulePage'
import MyAppointmentsPage from './pages/patient/MyAppointmentsPage'
import LandingPage from './pages/public/LandingPage'

// Layout
import ProfessionalLayout from './components/layout/ProfessionalLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'

function HomeRoute() {
  const { user, session, loading } = useAuthStore()
  if (loading) return <LandingPage />
  if (user && session) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}

function App() {
  const { setUser, setSession, setLoading } = useAuthStore()

  useEffect(() => {
    // Inicializar sesión al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setLoading])

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#14b8a6', secondary: '#f1f5f9' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' },
          },
        }}
      />
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/cancel/:token" element={<CancelPage />} />
        <Route path="/reschedule/:token" element={<ReschedulePage />} />
        <Route path="/my-appointments" element={<MyAppointmentsPage />} />

        {/* Panel del profesional (protegido) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ProfessionalLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/availability" element={<AvailabilityPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Redirección raíz / Landing Page */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Clock,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/appointments', icon: ClipboardList, label: 'Citas' },
  { to: '/availability', icon: Clock, label: 'Disponibilidad' },
  { to: '/services', icon: Briefcase, label: 'Servicios' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
]

export default function ProfessionalLayout() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Sesión cerrada correctamente')
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
            <Calendar className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-slate-900 font-bold text-base leading-none">Blinktime</h1>
            <p className="text-slate-500 text-xs mt-0.5">Panel Profesional</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              isActive ? 'sidebar-link-active' : 'sidebar-link'
            }
          >
            <Icon className="w-4.5 h-4.5 shrink-0" size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario y logout */}
      <div className="p-3 border-t border-slate-200/50">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-white text-sm font-semibold">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-700 text-sm font-medium truncate">{user?.email}</p>
            <p className="text-slate-500 text-xs">Profesional</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/10 
                     transition-all duration-200 text-sm font-medium"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white/50 border-r border-slate-200/50">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200/50">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Topbar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 bg-white/50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-brand rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-slate-900" />
            </div>
            <span className="text-slate-900 font-bold text-sm">Blinktime</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

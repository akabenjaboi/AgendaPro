import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, Clock, Smartphone, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 selection:bg-brand-500/30 selection:text-brand-900">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md border-b border-slate-200/50 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center shadow-md shadow-brand-200">
              <Calendar className="w-4.5 h-4.5 text-slate-900" />
            </div>
            <span className="text-slate-900 font-bold text-lg">AgendaPro</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Iniciar sesión
            </Link>
            <Link to="/register" className="btn-primary text-sm px-4 py-2">
              Comenzar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-6 lg:pt-48 lg:pb-32 relative overflow-hidden">
        {/* Decorative backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-200/30 rounded-full blur-[100px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-300/20 rounded-full blur-[80px] -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 mb-8 animate-fade-in">
            <span className="flex w-2 h-2 rounded-full bg-brand-500 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
            </span>
            <span className="text-xs font-medium text-brand-800">Ya disponible para profesionales</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-[1.1] animate-slide-up">
            Gestiona tu agenda de <br className="hidden lg:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#164346] to-[#3A8A8F]">
              forma inteligente
            </span>
          </h1>
          
          <p className="text-lg lg:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '100ms' }}>
            La plataforma definitiva para profesionales independientes. Automatiza tus reservas, envía recordatorios y elimina las inasistencias en piloto automático.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <Link to="/register" className="btn-primary text-base px-8 py-4 w-full sm:w-auto justify-center shadow-xl shadow-brand-500/20">
              Crear cuenta gratis
              <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="px-8 py-4 rounded-xl text-slate-700 bg-white border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all font-medium w-full sm:w-auto text-center">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-24 bg-white border-t border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Todo lo que necesitas para tu consulta</h2>
            <p className="text-slate-600 max-w-xl mx-auto">Olvídate del desorden de WhatsApp. AgendaPro centraliza tu negocio para que te enfoques en atender a tus pacientes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card p-8 bg-slate-50/50 border-transparent hover:border-brand-200 transition-colors">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-6">
                <Smartphone className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Tu propio enlace 24/7</h3>
              <p className="text-slate-600 leading-relaxed">Comparte tu link único en Instagram o WhatsApp. Tus pacientes podrán ver tu disponibilidad y agendar en cualquier momento.</p>
            </div>

            {/* Feature 2 */}
            <div className="card p-8 bg-slate-50/50 border-transparent hover:border-brand-200 transition-colors">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-6">
                <CheckCircle2 className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Adiós inasistencias</h3>
              <p className="text-slate-600 leading-relaxed">Envío de confirmaciones instantáneas y recordatorios automáticos por correo electrónico para garantizar la asistencia.</p>
            </div>

            {/* Feature 3 */}
            <div className="card p-8 bg-slate-50/50 border-transparent hover:border-brand-200 transition-colors">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 mb-6">
                <Clock className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Sincronización total</h3>
              <p className="text-slate-600 leading-relaxed">Define tus horarios de trabajo, configura bloqueos personalizados y visualiza todo en un calendario profesional interactivo.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200/50 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" />
            <span className="text-slate-900 font-bold">AgendaPro</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 AgendaPro. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  )
}

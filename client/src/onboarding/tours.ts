import type { DriveStep } from 'driver.js'

// Tutorial guiado del panel del profesional.
// Cada sección tiene su propio recorrido corto, que se muestra la primera vez
// que el profesional entra a ella. Los elementos se marcan con data-tour="...".

export type TourKey = 'dashboard' | 'calendar' | 'appointments' | 'availability' | 'services' | 'settings'

export const ALL_TOURS: TourKey[] = ['dashboard', 'calendar', 'appointments', 'availability', 'services', 'settings']

export const ROUTE_TOURS: Record<string, TourKey> = {
  '/dashboard': 'dashboard',
  '/calendar': 'calendar',
  '/appointments': 'appointments',
  '/availability': 'availability',
  '/services': 'services',
  '/settings': 'settings',
}

const sel = (name: string) => `[data-tour="${name}"]`

/** El menú lateral solo se ve en escritorio; en el celular se resalta el botón de menú. */
function navElement(): Element {
  const desktopNav = document.querySelector(sel('nav'))
  if (desktopNav instanceof HTMLElement && desktopNav.offsetParent !== null) return desktopNav
  return document.querySelector(sel('mobile-menu')) ?? document.body
}

function navItem(path: string) {
  return (): Element => {
    const link = document.querySelector(`${sel('nav')} a[href="${path}"]`)
    if (link instanceof HTMLElement && link.offsetParent !== null) return link
    return navElement()
  }
}

export interface Tour {
  /** Elemento que indica que la página terminó de cargar. */
  ready: string
  steps: DriveStep[]
}

export const TOURS: Record<TourKey, Tour> = {
  dashboard: {
    ready: sel('dashboard-stats'),
    steps: [
      {
        popover: {
          title: '¡Bienvenido a Blinktime! 👋',
          description:
            'Te mostramos en un minuto cómo funciona tu panel. Puedes saltar el tutorial cuando quieras y volver a verlo desde <b>Ver tutorial</b> en el menú.',
        },
      },
      {
        element: navElement,
        popover: {
          title: 'Tu menú',
          description:
            'Desde aquí llegas a cada sección. La primera vez que entres a cada una te explicaremos qué puedes hacer en ella.',
          side: 'right',
        },
      },
      {
        element: sel('booking-link'),
        popover: {
          title: 'Tu link de agendamiento',
          description:
            'Esta es tu página pública. Compártela en Instagram, WhatsApp o tu web: tus pacientes ven tus horarios libres y agendan solos, <b>sin crear cuenta</b>. Usa los íconos para copiarla o abrirla.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: sel('dashboard-stats'),
        popover: {
          title: 'Tu día en números',
          description: 'Cuántas citas tienes hoy, cuántas solicitudes esperan tu aprobación y cuántas citas vienen.',
          side: 'bottom',
        },
      },
      {
        element: sel('dashboard-upcoming'),
        popover: {
          title: 'Próximas citas',
          description: 'Tus siguientes citas pendientes y aprobadas. Para gestionarlas, entra a <b>Citas</b> o al <b>Calendario</b>.',
          side: 'top',
        },
      },
      {
        element: navItem('/availability'),
        popover: {
          title: 'Antes de recibir citas',
          description:
            'Configura tus horarios en <b>Disponibilidad</b> y crea tus <b>Servicios</b>. Si no tienes días activos, nadie podrá agendar contigo.',
          side: 'right',
        },
      },
      {
        element: sel('tour-replay'),
        popover: {
          title: '¿Quieres repasar?',
          description: 'Con <b>Ver tutorial</b> vuelves a ver estas guías cuando quieras.',
          side: 'right',
          align: 'end',
        },
      },
    ],
  },

  calendar: {
    ready: sel('calendar-toolbar'),
    steps: [
      {
        element: sel('calendar-toolbar'),
        popover: {
          title: 'Muévete por las fechas',
          description:
            'Usa las flechas para avanzar o retroceder, <b>Hoy</b> para volver al día actual, y cambia la vista entre <b>Mes, Semana, Día y Agenda</b>.',
          side: 'bottom',
        },
      },
      {
        element: sel('calendar-stats'),
        popover: {
          title: 'Resumen rápido',
          description: 'Citas de hoy, de esta semana y solicitudes que aún debes aprobar.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: sel('calendar-grid'),
        popover: {
          title: 'Tus citas',
          description:
            'Cada cita aparece con un color según su estado. <b>Haz clic en una cita</b> para ver el detalle: aprobarla, completarla, cancelarla, eliminarla o enviarle un test al paciente.',
          side: 'top',
        },
      },
      {
        element: sel('calendar-legend'),
        popover: {
          title: 'Colores y canceladas',
          description: 'La leyenda explica cada color. Las citas canceladas están ocultas; puedes mostrarlas con este botón.',
          side: 'top',
        },
      },
    ],
  },

  appointments: {
    ready: sel('appointments-stats'),
    steps: [
      {
        element: sel('appointments-stats'),
        popover: {
          title: 'Tus citas por estado',
          description:
            '<b>Pendiente</b>: espera tu aprobación. <b>Aprobada</b>: confirmada. <b>Completada</b>: ya se realizó. <b>Cancelada</b>: no se realizará. Toca una tarjeta para filtrar.',
          side: 'bottom',
        },
      },
      {
        element: sel('appointments-filters'),
        popover: {
          title: 'Buscar y filtrar',
          description: 'Busca por nombre del paciente, email o servicio, o filtra por estado.',
          side: 'bottom',
        },
      },
      {
        element: sel('appointments-table'),
        popover: {
          title: 'Detalle de cada cita',
          description:
            '<b>Haz clic en una fila</b> para abrir el detalle. Ahí puedes <b>aprobar</b>, <b>marcar como completada</b>, <b>cancelar</b> (le avisamos al paciente por correo) y <b>enviar tests</b> como PHQ-9 o GAD-7.',
          side: 'top',
        },
      },
      {
        element: sel('appointments-delete'),
        popover: {
          title: 'Eliminar una cita',
          description:
            'La papelera borra la cita <b>definitivamente</b> y no avisa al paciente. Si quieres que el paciente se entere, mejor <b>cancélala</b> desde el detalle.',
          side: 'left',
        },
      },
    ],
  },

  availability: {
    ready: sel('availability-weekly'),
    steps: [
      {
        element: sel('availability-weekly'),
        popover: {
          title: 'Tu horario semanal',
          description:
            'Activa los días que atiendes y elige la hora de inicio y término. Con <b>Copiar a semana</b> repites un horario en los demás días hábiles. Los cambios se <b>guardan solos</b>.',
          side: 'top',
        },
      },
      {
        element: sel('availability-blocked'),
        popover: {
          title: 'Fechas bloqueadas',
          description:
            'Usa <b>Agregar bloqueo</b> para vacaciones, trámites o cualquier horario en que no puedas atender. En esas horas nadie podrá agendar.',
          side: 'top',
        },
      },
    ],
  },

  services: {
    ready: sel('services-new'),
    steps: [
      {
        element: sel('services-new'),
        popover: {
          title: 'Crea tus servicios',
          description:
            'Cada servicio es un tipo de atención (por ejemplo, "Primera consulta" o "Sesión de seguimiento"). Tus pacientes eligen uno al agendar.',
          side: 'left',
        },
      },
      {
        element: sel('services-list'),
        popover: {
          title: 'Duración, precio y límites',
          description:
            'Cada servicio define su duración, precio, tiempo libre antes y después de la cita, y un máximo de citas por semana. Puedes editarlo, eliminarlo o desactivarlo para que deje de aparecer en tu página.',
          side: 'top',
        },
      },
    ],
  },

  settings: {
    ready: sel('settings-profile'),
    steps: [
      {
        element: sel('settings-profile'),
        popover: {
          title: 'Tu información',
          description:
            'Tu nombre, especialidad y descripción aparecen en tu página pública. La <b>zona horaria</b> es importante: define en qué hora se muestran tus horarios. Aquí también puedes limitar cuántas citas aceptas por día o por semana.',
          side: 'top',
        },
      },
      {
        element: sel('settings-link'),
        popover: {
          title: 'Tu link y cómo se aprueban las citas',
          description:
            'Personaliza la dirección de tu página, desactívala temporalmente si no quieres recibir citas, y elige si las solicitudes se <b>aprueban automáticamente</b> o las apruebas tú una por una.',
          side: 'top',
        },
      },
      {
        element: sel('settings-save'),
        popover: {
          title: 'No olvides guardar',
          description: 'Los cambios de esta página se aplican al presionar <b>Guardar cambios</b>.',
          side: 'top',
          align: 'end',
        },
      },
    ],
  },
}

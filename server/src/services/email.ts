import { Resend } from 'resend'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale/es'

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
// Default "from" email for Resend testing domain (you can change this to your verified domain later)
const FROM_EMAIL = 'AgendaPro <onboarding@resend.dev>'

export interface EmailContact {
  name: string
  email: string
}

export interface AppointmentDetails {
  serviceName: string
  startsAt: string
  endsAt: string
  token?: string
}

const formatDate = (isoString: string) => {
  return format(parseISO(isoString), "EEEE d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Correo al paciente: Cita Creada (Pendiente)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendAppointmentCreatedEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails
) {
  const dateStr = formatDate(apt.startsAt)
  const cancelUrl = `${APP_URL}/cancel/${apt.token}`

  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${patient.name},</h2>
      <p>Tu solicitud de cita ha sido recibida y está <strong>pendiente de confirmación</strong> por parte de ${professional.name}.</p>
      <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0;"><strong>Fecha y Hora:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
      </div>
      <p>Te notificaremos apenas el profesional confirme la cita.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #64748b;">
        Si necesitas cancelar esta solicitud, haz clic aquí: <br/>
        <a href="${cancelUrl}">${cancelUrl}</a>
      </p>
    </div>
  `

  return sendEmail(patient.email, `Cita recibida con ${professional.name}`, html)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Correo al profesional: Nueva Solicitud
// ─────────────────────────────────────────────────────────────────────────────
export async function sendNewRequestEmailToProfessional(
  professional: EmailContact,
  patient: EmailContact,
  apt: AppointmentDetails
) {
  const dateStr = formatDate(apt.startsAt)

  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${professional.name},</h2>
      <p>Tienes una <strong>nueva solicitud de cita</strong> de ${patient.name}.</p>
      <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Paciente:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 5px 0 0 0;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0;"><strong>Fecha y Hora:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
      </div>
      <p>Por favor revisa tu panel para confirmar o cancelar esta cita.</p>
      <a href="${APP_URL}/appointments" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a mi panel</a>
    </div>
  `

  return sendEmail(professional.email, `Nueva solicitud de cita: ${patient.name}`, html)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Correo al paciente: Cita Confirmada
// ─────────────────────────────────────────────────────────────────────────────
export async function sendAppointmentConfirmedEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails
) {
  const dateStr = formatDate(apt.startsAt)
  const cancelUrl = `${APP_URL}/cancel/${apt.token}`

  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">¡Cita Confirmada, ${patient.name}!</h2>
      <p>${professional.name} ha <strong>confirmado</strong> tu cita.</p>
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0; margin: 20px 0;">
        <p style="margin: 0; color: #065f46;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #065f46;"><strong>Fecha y Hora:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
      </div>
      <p>Nos vemos pronto.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      <p style="font-size: 12px; color: #64748b;">
        Para cancelar la cita en caso de imprevisto, usa este enlace:<br/>
        <a href="${cancelUrl}">${cancelUrl}</a>
      </p>
    </div>
  `

  return sendEmail(patient.email, `¡Tu cita con ${professional.name} fue confirmada!`, html)
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Correo a ambos: Cita Cancelada
// ─────────────────────────────────────────────────────────────────────────────
export async function sendAppointmentCancelledEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails,
  cancelledBy: 'patient' | 'professional',
  reason?: string
) {
  const dateStr = formatDate(apt.startsAt)
  const isPatient = cancelledBy === 'patient'

  // Correo para el paciente
  const patientHtml = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${patient.name},</h2>
      <p>Tu cita con ${professional.name} ha sido <strong>cancelada</strong>.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Fecha:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
        ${reason ? `<p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Motivo:</strong> ${reason}</p>` : ''}
      </div>
    </div>
  `
  
  // Correo para el profesional
  const profHtml = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${professional.name},</h2>
      <p>La cita con ${patient.name} ha sido <strong>cancelada</strong>.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Paciente:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Fecha:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
        ${reason ? `<p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Motivo:</strong> ${reason}</p>` : ''}
      </div>
    </div>
  `

  await Promise.all([
    sendEmail(patient.email, `Cita Cancelada: ${professional.name}`, patientHtml),
    sendEmail(professional.email, `Cita Cancelada: ${patient.name}`, profHtml)
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Send Function
// ─────────────────────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log('\n[MOCK EMAIL]')
    console.log(`To: ${to}`)
    console.log(`Subject: ${subject}`)
    console.log(`Body length: ${html.length} chars`)
    console.log('--------------------------------------------------\n')
    return { id: 'mock-id' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error('[Resend Error]', error)
      return null
    }

    console.log(`[Resend Success] Email sent to ${to} (ID: ${data?.id})`)
    return data
  } catch (err) {
    console.error('[Resend Exception]', err)
    return null
  }
}

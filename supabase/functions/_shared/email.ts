import { Resend } from "npm:resend@6.12.2"

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

const resendApiKey = Deno.env.get("RESEND_API_KEY")
const resend = resendApiKey ? new Resend(resendApiKey) : null
const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173"
const rescheduleLimitHoursBefore = Number(Deno.env.get("RESCHEDULE_LIMIT_HOURS_BEFORE") ?? 24)
const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Blinktime <notificaciones@blinktime.lat>"

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) return { id: "mock-id" }

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject,
    html,
  })

  if (error) {
    throw new Error(error.message ?? "Resend error")
  }
}

export async function sendAppointmentCreatedEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails,
) {
  const dateStr = formatDate(apt.startsAt)
  const cancelUrl = `${appUrl}/cancel/${apt.token}`

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

export async function sendNewRequestEmailToProfessional(
  professional: EmailContact,
  patient: EmailContact,
  apt: AppointmentDetails,
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
      <a href="${appUrl}/appointments" style="display: inline-block; background-color: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ir a mi panel</a>
    </div>
  `
  return sendEmail(professional.email, `Nueva solicitud de cita: ${patient.name}`, html)
}

export async function sendAppointmentConfirmedEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails,
) {
  const dateStr = formatDate(apt.startsAt)
  const cancelUrl = `${appUrl}/cancel/${apt.token}`
  const rescheduleUrl = `${appUrl}/reschedule/${apt.token}`

  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">¡Cita Confirmada, ${patient.name}!</h2>
      <p>${professional.name} ha <strong>confirmado</strong> tu cita.</p>
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0; margin: 20px 0;">
        <p style="margin: 0; color: #065f46;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #065f46;"><strong>Fecha y Hora:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
      </div>
      <p style="font-size: 12px; color: #64748b;">
        Si necesitas reagendar, usa este enlace (hasta ${rescheduleLimitHoursBefore}h antes):<br/>
        <a href="${rescheduleUrl}">${rescheduleUrl}</a><br/><br/>
        Para cancelar la cita en caso de imprevisto, usa este enlace:<br/>
        <a href="${cancelUrl}">${cancelUrl}</a>
      </p>
    </div>
  `

  return sendEmail(patient.email, `¡Tu cita con ${professional.name} fue confirmada!`, html)
}

export async function sendAppointmentConfirmedEmailToProfessional(
  professional: EmailContact,
  patient: EmailContact,
  apt: AppointmentDetails,
) {
  const dateStr = formatDate(apt.startsAt)
  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${professional.name},</h2>
      <p>Confirmaste la cita de <strong>${patient.name}</strong>.</p>
      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border: 1px solid #a7f3d0; margin: 20px 0;">
        <p style="margin: 0; color: #065f46;"><strong>Paciente:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 5px 0 0 0; color: #065f46;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #065f46;"><strong>Fecha y Hora:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
      </div>
    </div>
  `
  return sendEmail(professional.email, `Cita confirmada: ${patient.name}`, html)
}

export async function sendAppointmentRescheduledEmailToProfessional(
  professional: EmailContact,
  patient: EmailContact,
  apt: AppointmentDetails,
  previousStartsAt: string,
) {
  const previousDateStr = formatDate(previousStartsAt)
  const newDateStr = formatDate(apt.startsAt)
  const html = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${professional.name},</h2>
      <p>${patient.name} <strong>reagendó</strong> una cita.</p>
      <div style="background-color: #eff6ff; padding: 15px; border-radius: 8px; border: 1px solid #bfdbfe; margin: 20px 0;">
        <p style="margin: 0; color: #1e3a8a;"><strong>Paciente:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 5px 0 0 0; color: #1e3a8a;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #1e3a8a;"><strong>Horario anterior:</strong> <span style="text-transform: capitalize;">${previousDateStr}</span></p>
        <p style="margin: 5px 0 0 0; color: #1e3a8a;"><strong>Nuevo horario:</strong> <span style="text-transform: capitalize;">${newDateStr}</span></p>
      </div>
    </div>
  `
  return sendEmail(professional.email, `Cita reagendada: ${patient.name}`, html)
}

export async function sendAppointmentCancelledEmail(
  patient: EmailContact,
  professional: EmailContact,
  apt: AppointmentDetails,
  cancelledBy: "patient" | "professional",
  reason?: string,
) {
  const dateStr = formatDate(apt.startsAt)
  const actor = cancelledBy === "patient" ? "paciente" : "profesional"

  const patientHtml = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${patient.name},</h2>
      <p>Tu cita con ${professional.name} ha sido <strong>cancelada</strong> por ${actor}.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Fecha:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
        ${reason ? `<p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Motivo:</strong> ${reason}</p>` : ""}
      </div>
    </div>
  `

  const profHtml = `
    <div style="font-family: sans-serif; max-w-md; margin: 0 auto;">
      <h2 style="color: #0f172a;">Hola ${professional.name},</h2>
      <p>La cita con ${patient.name} ha sido <strong>cancelada</strong> por ${actor}.</p>
      <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca; margin: 20px 0;">
        <p style="margin: 0; color: #991b1b;"><strong>Paciente:</strong> ${patient.name} (${patient.email})</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Servicio:</strong> ${apt.serviceName}</p>
        <p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Fecha:</strong> <span style="text-transform: capitalize;">${dateStr}</span></p>
        ${reason ? `<p style="margin: 5px 0 0 0; color: #991b1b;"><strong>Motivo:</strong> ${reason}</p>` : ""}
      </div>
    </div>
  `

  await Promise.all([
    sendEmail(patient.email, `Cita Cancelada: ${professional.name}`, patientHtml),
    sendEmail(professional.email, `Cita Cancelada: ${patient.name}`, profHtml),
  ])
}


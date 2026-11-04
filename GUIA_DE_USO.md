# Cómo funciona Blinktime

Guía del flujo de la plataforma: qué hace cada parte, qué ve el profesional, qué ve el paciente y cuándo ocurre cada aviso. No entra en detalles técnicos.

---

## 1. La idea en una frase

El profesional comparte **su link de agendamiento**. Sus pacientes ven los horarios libres y reservan solos, **sin crear cuenta**. Blinktime avisa por correo, recuerda la cita por WhatsApp el día anterior y le da al profesional un panel para gestionarlo todo.

Hay dos tipos de personas:

| Quién | Tiene cuenta | Qué hace |
|---|---|---|
| **Profesional** (psicólogo, kinesiólogo, etc.) | Sí | Configura horarios y servicios, aprueba y gestiona citas, envía tests |
| **Paciente** | **No** | Agenda, cancela, reagenda y responde tests desde enlaces que recibe |

---

## 2. Primeros pasos del profesional

1. **Crear cuenta** en blinktime.lat. Se crea automáticamente su perfil y su link (por ejemplo `blinktime.lat/book/ana-garcia`).
2. **Tutorial de bienvenida.** La primera vez que entra a cada sección del panel aparecen mensajes flotantes que explican cada parte. Se puede **saltar** en cualquier momento y volver a verlo con **Ver tutorial** en el menú.
3. **Disponibilidad:** activar los días que atiende y el horario de cada día. Sin al menos un día activo, **nadie puede agendar**.
4. **Servicios:** crear los tipos de atención (por ejemplo "Primera consulta", 60 min, $30.000).
5. **Configuración:** revisar nombre, especialidad, zona horaria y decidir si las citas se aprueban solas o a mano.
6. **Compartir el link** en Instagram, WhatsApp, la web, etc.

---

## 3. Las secciones del panel

### Dashboard
- Saludo y fecha del día.
- **Link de agendamiento** con botones para copiarlo o abrirlo. El punto verde indica que está activo.
- Tres números: **citas hoy**, **por confirmar** y **próximas citas**.
- Lista de las próximas citas pendientes y aprobadas.

### Calendario
- Vistas de **Mes, Semana, Día y Agenda**. Flechas para moverse y botón **Hoy**.
- Resumen arriba: citas de hoy, de esta semana y solicitudes por aprobar.
- Cada cita tiene un color según su estado:
  - 🟡 **Pendiente**: espera aprobación.
  - 🟢 **Aprobada**: confirmada.
  - ⚪ **Completada**: ya se realizó.
  - 🔴 **Cancelada**: oculta por defecto; se puede mostrar con "Mostrar canceladas".
- Una línea roja marca la hora actual.
- **Al hacer clic en una cita** se abre su detalle (ver "Detalle de una cita").

### Citas
- Tarjetas con el conteo por estado; al tocarlas se filtra la lista.
- Buscador por nombre, email o servicio, y filtro por estado.
- Tabla con todas las citas. Al hacer clic en una fila se abre el detalle.
- **Papelera** en cada fila para eliminar la cita definitivamente.

### Detalle de una cita
Se abre desde Citas o desde el Calendario. Muestra fecha, servicio y datos del paciente (nombre, email, teléfono, notas, y si confirmó asistencia por WhatsApp). Acciones:

| Acción | Qué pasa | ¿Se avisa al paciente? |
|---|---|---|
| **Aprobar cita** (solo si está pendiente) | Pasa a "Aprobada" | Sí, por correo, con links para reagendar o cancelar |
| **Marcar como completada** | Pasa a "Completada" | No |
| **Cancelar cita** | Pasa a "Cancelada" y libera el horario | Sí, por correo (también le llega copia al profesional) |
| **Eliminar cita** | Se borra para siempre, con sus recordatorios | **No.** Para avisar, conviene cancelar en vez de eliminar |
| **Enviar test** | Ver sección 7 | El paciente recibe el enlace |

### Disponibilidad
- **Horario semanal:** activar o desactivar cada día y definir hora de inicio y término. El botón **Copiar a semana** repite un horario en los demás días hábiles. **Se guarda automáticamente.**
- **Fechas bloqueadas:** con **Agregar bloqueo** se reserva un rango (vacaciones, trámites), de día completo o por horas, con un motivo opcional que solo ve el profesional. En esos horarios nadie puede agendar.

### Servicios
Cada servicio tiene:
- **Nombre y descripción** (los ve el paciente al agendar).
- **Duración** de la cita.
- **Precio y moneda** (por defecto CLP).
- **Tiempo libre antes y después** de la cita (por ejemplo, 10 minutos para tomar notas). Ese tiempo queda bloqueado en la agenda.
- **Máximo de citas por semana** de ese servicio (opcional).
- **Activo o inactivo:** un servicio inactivo deja de aparecer en la página pública sin borrarse.

### Configuración
- **Información personal:** nombre, especialidad, descripción y teléfono (aparecen en la página pública, salvo el teléfono), **zona horaria** y límites opcionales de **citas por día** y **por semana**.
- **Link de agendamiento:**
  - Personalizar la dirección (por ejemplo `dr-juan-perez`). El sistema avisa si ya está en uso.
  - **Activar o desactivar** la página: desactivada, nadie puede agendar.
  - **Aprobar citas automáticamente:** si está activado, las nuevas reservas quedan aprobadas al instante; si no, quedan pendientes hasta que el profesional las apruebe.
- Los cambios se aplican con **Guardar cambios**.

---

## 4. El recorrido del paciente

### Agendar
1. Entra al link del profesional.
2. Elige un **servicio**.
3. Ve los **horarios libres de los próximos 45 días**. Solo aparecen horarios que:
   - están dentro de la disponibilidad del profesional,
   - no chocan con otra cita (considerando el tiempo libre antes y después),
   - no están bloqueados,
   - no superan los límites diarios o semanales,
   - no están en el pasado.
4. Ingresa nombre, email, teléfono y notas opcionales, y confirma.
5. La cita queda **pendiente** (o **aprobada**, si el profesional activó la aprobación automática).

> El teléfono es importante: sin teléfono no se envía el recordatorio por WhatsApp.

### Cancelar
- Desde el enlace "cancelar" que llega en los correos.
- Puede cancelar **en cualquier momento** antes de la cita, mientras no esté completada. Puede indicar un motivo.
- Se avisa por correo al paciente y al profesional.

### Reagendar
- Desde el enlace "reagendar" del correo de cita aprobada.
- Solo hasta **24 horas antes** de la cita.
- Elige un nuevo horario libre. La cita **mantiene su estado** (si estaba aprobada, sigue aprobada).
- Se avisa por correo **al profesional** con el horario anterior y el nuevo.

---

## 5. Correos automáticos

| Momento | Al paciente | Al profesional |
|---|---|---|
| Paciente agenda (aprobación manual) | "Cita recibida", pendiente de confirmación, con link para cancelar | "Nueva solicitud de cita" |
| Paciente agenda (aprobación automática) | "Cita aprobada", con links para reagendar y cancelar | "Nueva solicitud de cita" |
| Profesional aprueba | "Cita aprobada", con links para reagendar y cancelar | Confirmación de que la aprobó |
| Cancelación (por cualquiera de los dos) | "Cita cancelada", con el motivo si lo hay | "Cita cancelada" |
| Paciente reagenda | — | "Cita reagendada", horario anterior y nuevo |
| Paciente responde **NO** por WhatsApp | "Cita cancelada" | "Cita cancelada" |
| Profesional envía un test (si elige enviarlo por correo) | Invitación con el enlace al cuestionario | — |
| Paciente responde un test | — | Aviso de que respondió (sin puntajes) |

No se envían correos al marcar una cita como completada ni al eliminarla.

---

## 6. Recordatorios por WhatsApp

- **Cuándo:** el sistema revisa **cada 15 minutos** si hay citas que empiezan **dentro de 24 horas** (entre 24 h y 24 h 30 min desde ese momento). En la práctica, el recordatorio llega **unas 24 horas antes** de la cita.
- **A quién:** a pacientes con teléfono registrado y cita **pendiente o aprobada**.
- **Cuántas veces:** **uno por cita**.
- **Qué dice:** recuerda el servicio, el día y la hora, y pide confirmar asistencia.
- **Respuestas del paciente:**
  - **SI** → queda registrado que asistirá. El profesional lo ve en la cita ("Confirmó asistencia vía WhatsApp") y con un ✓ verde en la lista.
  - **NO** → **la cita se cancela automáticamente**, se libera el horario y se avisa por correo a ambos.
  - Otra cosa → se le pide responder SI o NO.
  - Si el paciente tiene varias citas pendientes, se le pide incluir el código del recordatorio (por ejemplo "NO ABC12345").

**Casos a tener en cuenta:**
- Una cita agendada con **menos de 24 horas de anticipación no recibe recordatorio**.
- Si el paciente **reagenda después de recibir el recordatorio**, no recibe uno nuevo para el nuevo horario.
- Responder "SI" registra la asistencia, pero **no aprueba** una cita pendiente: eso lo sigue haciendo el profesional.

---

## 7. Tests psicológicos (PHQ-9 y GAD-7)

Pensado para psicólogos que quieren que el paciente responda un cuestionario antes, durante o después de la sesión.

**Tests disponibles** (versiones oficiales en español):
- **PHQ-9:** síntomas depresivos, 9 preguntas.
- **GAD-7:** síntomas de ansiedad, 7 preguntas.

### Cómo se envía
1. En el detalle de una cita → **Enviar test**.
2. Elegir uno o ambos tests.
3. Elegir cómo hacerlo llegar:
   - **Por correo** (automático, al email de la cita).
   - **Copiar enlace** para pegarlo donde quiera.
   - **Enviar por WhatsApp** (abre WhatsApp con el mensaje listo, si la cita tiene teléfono).
   - **Código QR** para que el paciente lo escanee y responda **en la sesión**.
   - **Abrir aquí** para que responda en el dispositivo del profesional.

### Cómo responde el paciente
- Abre el enlace. **No necesita cuenta.**
- Acepta compartir sus respuestas con el profesional.
- Responde **una pregunta por pantalla**, elige una opción y presiona **Continuar**. Puede volver atrás.
- Al final revisa y envía. Ve un mensaje de agradecimiento, **nunca su puntaje**.
- El enlace **sirve una sola vez** y **vence a los 7 días**. El profesional puede anularlo antes.

### Qué ve el profesional
- En la cita, cada test aparece como **Pendiente**, **Respondido**, **Vencido** o **Anulado**.
- En los respondidos: **puntaje**, **nivel de severidad** con color y cada respuesta.
- También el **historial del paciente en otras citas** (se agrupa por su email), para ver su evolución.

| Test | Puntaje | Niveles |
|---|---|---|
| PHQ-9 | 0 a 27 | 0–4 mínima · 5–9 leve · 10–14 moderada · 15–19 moderadamente severa · 20–27 severa |
| GAD-7 | 0 a 21 | 0–4 mínima · 5–9 leve · 10–14 moderada · 15–21 severa |

### Alerta de riesgo
Si en el **PHQ-9** el paciente responde cualquier cosa distinta de "Ningún día" en la **pregunta 9** (pensamientos de muerte o de hacerse daño):
- El resultado se marca en **rojo** con una alerta en el panel.
- El profesional recibe un correo con el asunto **"⚠️ Requiere atención"**.
- Al paciente se le muestran recursos de ayuda: **\*4141** (Línea de Prevención del Suicidio, Chile) y **131** (emergencias).

> Los tests son herramientas de **tamizaje**, no diagnósticos. La interpretación es del profesional.

---

## 8. Privacidad

- El paciente no tiene cuenta: todo funciona con enlaces personales.
- Los datos de contacto del profesional (email y teléfono) **no son públicos**.
- Los resultados de los tests **solo los ve el profesional** que los envió. Los correos de aviso no incluyen puntajes ni respuestas.
- Eliminar una cita borra sus recordatorios, pero **los tests respondidos se conservan** en el historial del paciente.

---

## 9. Resumen de tiempos

| Qué | Tiempo |
|---|---|
| Horarios que ve el paciente al agendar o reagendar | Próximos 45 días |
| Recordatorio por WhatsApp | ~24 horas antes de la cita (revisión cada 15 min) |
| Límite para reagendar | Hasta 24 horas antes de la cita |
| Límite para cancelar (paciente) | Cualquier momento antes de la cita |
| Validez del enlace de un test | 7 días, un solo uso |
| Guardado de la disponibilidad | Automático |
| Guardado de la configuración | Al presionar "Guardar cambios" |

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// --- Middlewares de seguridad ---
app.use(helmet())
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde', code: 'RATE_LIMIT_EXCEEDED' },
})
app.use(globalLimiter)

// Rate limiting estricto para rutas públicas de agendamiento
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Demasiadas solicitudes de agendamiento', code: 'BOOKING_RATE_LIMIT' },
})

// --- Rutas ---
import authRouter from './routes/auth'
import professionalsRouter from './routes/professionals'
import appointmentsRouter from './routes/appointments'
import professionalRouter from './routes/professional'

app.use('/api/auth', authRouter)
app.use('/api/professionals', professionalsRouter)
app.use('/api/appointments', bookingLimiter, appointmentsRouter)
app.use('/api/professional', professionalRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada', code: 'NOT_FOUND' })
})

// Error handler global
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err.message)
  res.status(500).json({ error: 'Error interno del servidor', code: 'INTERNAL_ERROR' })
})

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  console.log(`📅 AgendaPro API — modo ${process.env.NODE_ENV}`)
})

export default app

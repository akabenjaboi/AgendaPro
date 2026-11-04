import { useCallback, useEffect, useRef, useState } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { supabase } from '../lib/supabase'
import { ALL_TOURS, ROUTE_TOURS, TOURS, type TourKey } from './tours'

const READY_TIMEOUT_MS = 8000

/** Espera a que aparezca un elemento (la página puede estar cargando datos). */
function waitForElement(selector: string, signal: { cancelled: boolean }): Promise<boolean> {
  return new Promise(resolve => {
    const started = Date.now()
    const check = () => {
      if (signal.cancelled) return resolve(false)
      if (document.querySelector(selector)) return resolve(true)
      if (Date.now() - started > READY_TIMEOUT_MS) return resolve(false)
      setTimeout(check, 150)
    }
    check()
  })
}

/**
 * Muestra el recorrido de la sección actual la primera vez que el profesional
 * la visita. Lo que ya vio se guarda en `professionals.onboarding_seen`.
 */
export function useOnboarding(userId: string | undefined, pathname: string) {
  const [seen, setSeen] = useState<string[] | null>(null)
  const driverRef = useRef<Driver | null>(null)
  const seenRef = useRef<string[] | null>(null)
  const suppressMarkRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('professionals')
      .select('onboarding_seen')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        // Si falla la lectura, no mostramos nada antes que molestar en cada visita.
        setSeen(error || !data ? [...ALL_TOURS] : (data.onboarding_seen ?? []))
      })
  }, [userId])

  useEffect(() => { seenRef.current = seen }, [seen])

  const persist = useCallback((next: string[]) => {
    setSeen(next)
    if (!userId) return
    void supabase.from('professionals').update({ onboarding_seen: next }).eq('user_id', userId)
  }, [userId])

  const markSeen = useCallback((keys: TourKey[]) => {
    persist([...new Set([...(seenRef.current ?? []), ...keys])])
  }, [persist])

  const tourKey: TourKey | undefined = ROUTE_TOURS[pathname]

  useEffect(() => {
    if (!seen || !tourKey || seen.includes(tourKey)) return
    const tour = TOURS[tourKey]
    const signal = { cancelled: false }
    let skippedAll = false

    waitForElement(tour.ready, signal).then(found => {
      if (!found || signal.cancelled) return

      const d = driver({
        steps: tour.steps,
        showProgress: tour.steps.length > 1,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Atrás',
        doneBtnText: '¡Entendido!',
        closeBtnLabel: 'Cerrar',
        popoverClass: 'blinktime-tour',
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 12,
        skipMissingElement: true,
        smoothScroll: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        onPopoverRender: popover => {
          const skip = document.createElement('button')
          skip.type = 'button'
          skip.className = 'blinktime-tour-skip'
          skip.textContent = 'Saltar tutorial'
          skip.addEventListener('click', () => {
            skippedAll = true
            d.destroy()
          })
          popover.footer.insertBefore(skip, popover.footer.firstChild)
        },
        onDestroyed: () => {
          driverRef.current = null
          // Si la página cambió o se pidió repetir el tutorial, no se marca como visto.
          if (signal.cancelled || suppressMarkRef.current) return
          markSeen(skippedAll ? [...ALL_TOURS] : [tourKey])
        },
      })
      driverRef.current = d
      d.drive()
    })

    return () => {
      signal.cancelled = true
      driverRef.current?.destroy()
    }
  }, [seen, tourKey, markSeen])

  /** Vuelve a mostrar todos los recorridos, empezando por la sección actual. */
  const replay = useCallback(() => {
    suppressMarkRef.current = true
    driverRef.current?.destroy()
    suppressMarkRef.current = false
    persist([])
  }, [persist])

  return { replay }
}

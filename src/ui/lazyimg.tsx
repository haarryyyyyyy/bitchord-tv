// Artwork loads only near the screen, a few at a time: Google's image servers answer a burst
// of ~90 requests with HTTP 429, and fewer decoded images keeps TV memory down.
import { useEffect, useRef } from 'preact/hooks'

const MAX_PARALLEL = 6
const RETRY_MS = 1500
let running = 0
const queue: HTMLImageElement[] = []

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const el = queue.shift()!
    const src = el.dataset.src
    if (!src || !el.isConnected) continue
    running++
    const done = (ok: boolean) => {
      running--
      el.onload = el.onerror = null
      if (ok) el.classList.add('loaded')
      else if (!el.dataset.retried) {
        el.dataset.retried = '1'
        setTimeout(() => (queue.push(el), pump()), RETRY_MS)
      }
      pump()
    }
    el.onload = () => done(true)
    el.onerror = () => done(false)
    el.src = src
  }
}

const io =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              io!.unobserve(e.target)
              queue.push(e.target as HTMLImageElement)
            }
          pump()
        },
        { rootMargin: '400px 600px' },
      )
    : null

export function LazyImg({ src, size, class: cls }: { src: string; size: number; class?: string }) {
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !src) return
    el.dataset.src = src
    delete el.dataset.retried
    el.classList.remove('loaded')
    if (io) io.observe(el)
    else el.src = src
    return () => io && io.unobserve(el)
  }, [src])
  return <img ref={ref} class={'lazy ' + (cls || '')} width={size} height={size} alt="" decoding="async" />
}
